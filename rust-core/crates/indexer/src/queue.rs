//! Task queue for managing indexing operations

use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tokio::sync::{mpsc, oneshot, Mutex as TokioMutex};
use anyhow::Result;

use code_intelligence_core::CodeEntity;

/// Indexing task
#[derive(Debug, Clone)]
pub struct IndexingTask {
    pub id: String,
    pub file_path: PathBuf,
    pub content: String,
    pub priority: TaskPriority,
    pub created_at: std::time::Instant,
}

/// Task priority levels
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum TaskPriority {
    High,
    Normal,
    Low,
}

/// Task result
#[derive(Debug)]
pub struct TaskResult {
    pub task_id: String,
    pub entities: Vec<CodeEntity>,
    pub duration: std::time::Duration,
    pub success: bool,
    pub error: Option<String>,
}

/// Task queue for managing indexing operations
pub struct TaskQueue {
    queue: Arc<Mutex<VecDeque<IndexingTask>>>,
    task_sender: mpsc::UnboundedSender<IndexingTask>,
    task_receiver: Option<mpsc::UnboundedReceiver<IndexingTask>>,
    result_sender: mpsc::UnboundedSender<TaskResult>,
    result_receiver: Option<mpsc::UnboundedReceiver<TaskResult>>,
    active_tasks: Arc<Mutex<std::collections::HashMap<String, oneshot::Sender<TaskResult>>>>,
    metrics: QueueMetrics,
}

/// Queue metrics
#[derive(Debug, Clone, Default)]
pub struct QueueMetrics {
    pub tasks_added: u64,
    pub tasks_completed: u64,
    pub tasks_failed: u64,
    pub average_wait_time: std::time::Duration,
    pub average_processing_time: std::time::Duration,
}

impl TaskQueue {
    /// Create a new task queue
    pub fn new() -> Self {
        let (task_sender, task_receiver) = mpsc::unbounded_channel();
        let (result_sender, result_receiver) = mpsc::unbounded_channel();

        Self {
            queue: Arc::new(Mutex::new(VecDeque::new())),
            task_sender,
            task_receiver: Some(task_receiver),
            result_sender,
            result_receiver: Some(result_receiver),
            active_tasks: Arc::new(Mutex::new(std::collections::HashMap::new())),
            metrics: QueueMetrics::default(),
        }
    }

    /// Add a task to the queue
    pub fn add_task(&mut self, file_path: &Path, content: String, priority: TaskPriority) -> Result<String> {
        let task_id = uuid::Uuid::new_v4().to_string();
        let task = IndexingTask {
            id: task_id.clone(),
            file_path: file_path.to_path_buf(),
            content,
            priority,
            created_at: std::time::Instant::now(),
        };

        let mut queue = self.queue.lock().unwrap();
        queue.push_back(task.clone());
        queue.make_contiguous().sort_by(|a, b| b.priority.cmp(&a.priority));

        // Send to processor
        if let Err(_) = self.task_sender.send(task) {
            return Err(anyhow::anyhow!("Failed to send task to processor"));
        }

        self.metrics.tasks_added += 1;
        Ok(task_id)
    }

    /// Add multiple tasks to the queue
    pub fn add_tasks(&mut self, tasks: Vec<(PathBuf, String, TaskPriority)>) -> Result<Vec<String>> {
        let mut task_ids = Vec::new();

        for (file_path, content, priority) in tasks {
            if let Ok(task_id) = self.add_task(&file_path, content, priority) {
                task_ids.push(task_id);
            }
        }

        Ok(task_ids)
    }

    /// Get the next task from the queue
    pub async fn next_task(&mut self) -> Option<IndexingTask> {
        if let Some(receiver) = &mut self.task_receiver {
            receiver.recv().await
        } else {
            None
        }
    }

    /// Get the queue size
    pub fn size(&self) -> usize {
        let queue = self.queue.lock().unwrap();
        queue.len()
    }

    /// Check if the queue is empty
    pub fn is_empty(&self) -> bool {
        self.size() == 0
    }

    /// Get a task by ID
    pub fn get_task(&self, task_id: &str) -> Option<IndexingTask> {
        let queue = self.queue.lock().unwrap();
        queue.iter().find(|task| task.id == task_id).cloned()
    }

    /// Remove a task by ID
    pub fn remove_task(&mut self, task_id: &str) -> bool {
        let mut queue = self.queue.lock().unwrap();
        if let Some(pos) = queue.iter().position(|task| task.id == task_id) {
            queue.remove(pos);
            true
        } else {
            false
        }
    }

    /// Clear all tasks from the queue
    pub fn clear(&mut self) {
        let mut queue = self.queue.lock().unwrap();
        queue.clear();
    }

    /// Get tasks by priority
    pub fn get_tasks_by_priority(&self, priority: TaskPriority) -> Vec<IndexingTask> {
        let queue = self.queue.lock().unwrap();
        queue.iter()
            .filter(|task| task.priority == priority)
            .cloned()
            .collect()
    }

    /// Send a task result
    pub fn send_result(&self, result: TaskResult) -> Result<()> {
        self.result_sender.send(result)
            .map_err(|_| anyhow::anyhow!("Failed to send result"))
    }

    /// Get the next result
    pub async fn next_result(&mut self) -> Option<TaskResult> {
        if let Some(receiver) = &mut self.result_receiver {
            receiver.recv().await
        } else {
            None
        }
    }

    /// Wait for a specific task result
    pub async fn wait_for_result(&mut self, task_id: &str) -> Result<TaskResult> {
        let (sender, receiver) = oneshot::channel();

        {
            let mut active_tasks = self.active_tasks.lock().unwrap();
            active_tasks.insert(task_id.to_string(), sender);
        }

        receiver.await
            .map_err(|_| anyhow::anyhow!("Failed to receive task result"))
    }

    /// Get queue metrics
    pub fn metrics(&self) -> QueueMetrics {
        self.metrics.clone()
    }

    /// Get the task receiver (for moving to a different thread)
    pub fn take_task_receiver(&mut self) -> Option<mpsc::UnboundedReceiver<IndexingTask>> {
        self.task_receiver.take()
    }

    /// Get the result receiver (for moving to a different thread)
    pub fn take_result_receiver(&mut self) -> Option<mpsc::UnboundedReceiver<TaskResult>> {
        self.result_receiver.take()
    }
}

impl Default for TaskQueue {
    fn default() -> Self {
        Self::new()
    }
}

/// Task processor for handling indexing tasks
pub struct TaskProcessor {
    queue: Arc<TokioMutex<TaskQueue>>,
    running: Arc<TokioMutex<bool>>,
}

impl TaskProcessor {
    /// Create a new task processor
    pub fn new(queue: Arc<TokioMutex<TaskQueue>>) -> Self {
        Self {
            queue,
            running: Arc::new(TokioMutex::new(false)),
        }
    }

    /// Start processing tasks
    pub async fn start(&self) -> Result<()> {
        {
            let mut running = self.running.lock().await;
            *running = true;
        }

        let queue = Arc::clone(&self.queue);
        let running = Arc::clone(&self.running);

        tokio::spawn(async move {
            while *running.lock().await {
                let task = {
                    let mut queue_guard = queue.lock().await;
                    queue_guard.next_task().await
                };

                if let Some(task) = task {
                    let start_time = std::time::Instant::now();
                    let result = Self::process_task_static(task).await;
                    let _duration = start_time.elapsed();

                    // Send result back
                    if let Ok(queue_guard) = queue.try_lock() {
                        let _ = queue_guard.send_result(result);
                    }
                } else {
                    // No tasks available, wait a bit
                    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                }
            }
        });

        Ok(())
    }

    /// Stop processing tasks
    pub async fn stop(&self) -> Result<()> {
        let mut running = self.running.lock().await;
        *running = false;
        Ok(())
    }

    /// Process a single task (static method for async spawn)
    async fn process_task_static(task: IndexingTask) -> TaskResult {
        let start_time = std::time::Instant::now();

        // In a real implementation, this would use the parser to extract entities
        let entities = Vec::new(); // Placeholder

        TaskResult {
            task_id: task.id,
            entities,
            duration: start_time.elapsed(),
            success: true,
            error: None,
        }
    }

  
    /// Check if the processor is running
    pub async fn is_running(&self) -> bool {
        *self.running.lock().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_task_queue() {
        let mut queue = TaskQueue::new();

        let temp_dir = TempDir::new().unwrap();
        let test_file = temp_dir.path().join("test.ts");
        let content = "function test() { return 'hello'; }";

        // Add a task
        let task_id = queue.add_task(&test_file, content.to_string(), TaskPriority::Normal).unwrap();
        assert!(!task_id.is_empty());
        assert_eq!(queue.size(), 1);

        // Get task by ID
        let task = queue.get_task(&task_id);
        assert!(task.is_some());

        // Remove task
        assert!(queue.remove_task(&task_id));
        assert_eq!(queue.size(), 0);
    }

    #[test]
    fn test_task_priority() {
        let mut queue = TaskQueue::new();

        let temp_dir = TempDir::new().unwrap();

        // Add tasks with different priorities
        queue.add_task(&temp_dir.path().join("low.ts"), "low".to_string(), TaskPriority::Low).unwrap();
        queue.add_task(&temp_dir.path().join("high.ts"), "high".to_string(), TaskPriority::High).unwrap();
        queue.add_task(&temp_dir.path().join("normal.ts"), "normal".to_string(), TaskPriority::Normal).unwrap();

        // High priority should be first
        let tasks = queue.get_tasks_by_priority(TaskPriority::High);
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].file_path.file_name().unwrap().to_str().unwrap(), "high.ts");
    }

    #[tokio::test]
    async fn test_task_processor() {
        let queue = Arc::new(TokioMutex::new(TaskQueue::new()));
        let processor = TaskProcessor::new(Arc::clone(&queue));

        // Start processor
        processor.start().await.unwrap();
        assert!(processor.is_running().await);

        // Stop processor
        processor.stop().await.unwrap();
        assert!(!processor.is_running().await);
    }
}