use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::sync::{mpsc, Semaphore};
use tokio::task::JoinHandle;
use serde::{Deserialize, Serialize};
use anyhow::{Result, anyhow};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexingTask {
    pub id: uuid::Uuid,
    pub file_path: PathBuf,
    pub priority: TaskPriority,
    pub estimated_size: usize,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub dependencies: Vec<uuid::Uuid>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum TaskPriority {
    Low = 1,
    Normal = 2,
    High = 3,
    Critical = 4,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexingResult {
    pub task_id: uuid::Uuid,
    pub file_path: PathBuf,
    pub success: bool,
    pub processing_time: Duration,
    pub entities_extracted: usize,
    pub file_size: usize,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerStats {
    pub worker_id: usize,
    pub tasks_completed: usize,
    pub total_processing_time: Duration,
    pub average_task_time: Duration,
    pub current_task: Option<uuid::Uuid>,
    pub is_busy: bool,
    pub errors_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParallelIndexerConfig {
    pub max_workers: usize,
    pub min_workers: usize,
    pub queue_capacity: usize,
    pub worker_timeout: Duration,
    pub auto_scaling: bool,
    pub load_balancing_strategy: LoadBalancingStrategy,
    pub batch_size: usize,
    pub memory_limit_mb: usize,
    pub cpu_threshold: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum LoadBalancingStrategy {
    RoundRobin,
    LeastLoaded,
    PriorityBased,
    SizeAware,
    Adaptive,
}

impl Default for ParallelIndexerConfig {
    fn default() -> Self {
        Self {
            max_workers: num_cpus::get(),
            min_workers: 1,
            queue_capacity: 10000,
            worker_timeout: Duration::from_secs(300), // 5 minutes
            auto_scaling: true,
            load_balancing_strategy: LoadBalancingStrategy::Adaptive,
            batch_size: 10,
            memory_limit_mb: 2048, // 2GB
            cpu_threshold: 0.8, // 80%
        }
    }
}

#[derive(Debug)]
struct Worker {
    id: usize,
    handle: JoinHandle<()>,
    stats: Arc<Mutex<WorkerStats>>,
    shutdown_tx: mpsc::Sender<()>,
}

#[derive(Debug)]
struct TaskQueue {
    high_priority: VecDeque<IndexingTask>,
    normal_priority: VecDeque<IndexingTask>,
    low_priority: VecDeque<IndexingTask>,
    dependency_map: HashMap<uuid::Uuid, Vec<uuid::Uuid>>, // task_id -> dependent_tasks
}

impl TaskQueue {
    fn new() -> Self {
        Self {
            high_priority: VecDeque::new(),
            normal_priority: VecDeque::new(),
            low_priority: VecDeque::new(),
            dependency_map: HashMap::new(),
        }
    }
    
    fn push(&mut self, task: IndexingTask) {
        // Handle dependencies
        if !task.dependencies.is_empty() {
            for dep_id in &task.dependencies {
                self.dependency_map
                    .entry(*dep_id)
                    .or_insert_with(Vec::new)
                    .push(task.id);
            }
        }
        
        match task.priority {
            TaskPriority::Critical | TaskPriority::High => {
                self.high_priority.push_back(task);
            },
            TaskPriority::Normal => {
                self.normal_priority.push_back(task);
            },
            TaskPriority::Low => {
                self.low_priority.push_back(task);
            },
        }
    }
    
    fn pop(&mut self) -> Option<IndexingTask> {
        // Try high priority first
        if let Some(task) = self.pop_ready_task(&mut self.high_priority) {
            return Some(task);
        }
        
        // Then normal priority
        if let Some(task) = self.pop_ready_task(&mut self.normal_priority) {
            return Some(task);
        }
        
        // Finally low priority
        self.pop_ready_task(&mut self.low_priority)
    }
    
    fn pop_ready_task(&mut self, queue: &mut VecDeque<IndexingTask>) -> Option<IndexingTask> {
        for i in 0..queue.len() {
            if let Some(task) = queue.get(i) {
                // Check if all dependencies are completed
                if task.dependencies.is_empty() {
                    return queue.remove(i);
                }
            }
        }
        None
    }
    
    fn mark_completed(&mut self, task_id: uuid::Uuid) {
        // Remove completed task from dependency map and check for newly available tasks
        if let Some(dependent_tasks) = self.dependency_map.remove(&task_id) {
            for dependent_id in dependent_tasks {
                self.remove_dependency(dependent_id, task_id);
            }
        }
    }
    
    fn remove_dependency(&mut self, task_id: uuid::Uuid, completed_dep: uuid::Uuid) {
        // Find and update the task to remove the completed dependency
        let queues = [&mut self.high_priority, &mut self.normal_priority, &mut self.low_priority];
        
        for queue in queues {
            for task in queue.iter_mut() {
                if task.id == task_id {
                    task.dependencies.retain(|&dep| dep != completed_dep);
                    break;
                }
            }
        }
    }
    
    fn len(&self) -> usize {
        self.high_priority.len() + self.normal_priority.len() + self.low_priority.len()
    }
    
    fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

pub struct ParallelIndexer {
    config: ParallelIndexerConfig,
    workers: Vec<Worker>,
    task_queue: Arc<Mutex<TaskQueue>>,
    task_tx: mpsc::Sender<IndexingTask>,
    result_rx: Arc<Mutex<mpsc::Receiver<IndexingResult>>>,
    result_tx: mpsc::Sender<IndexingResult>,
    semaphore: Arc<Semaphore>,
    is_running: Arc<Mutex<bool>>,
    completed_tasks: Arc<Mutex<HashMap<uuid::Uuid, IndexingResult>>>,
}

impl ParallelIndexer {
    pub fn new(config: ParallelIndexerConfig) -> Result<Self> {
        let (task_tx, _task_rx) = mpsc::channel(config.queue_capacity);
        let (result_tx, result_rx) = mpsc::channel(config.queue_capacity);
        
        Ok(Self {
            semaphore: Arc::new(Semaphore::new(config.max_workers)),
            config,
            workers: Vec::new(),
            task_queue: Arc::new(Mutex::new(TaskQueue::new())),
            task_tx,
            result_rx: Arc::new(Mutex::new(result_rx)),
            result_tx,
            is_running: Arc::new(Mutex::new(false)),
            completed_tasks: Arc::new(Mutex::new(HashMap::new())),
        })
    }
    
    pub async fn start(&mut self) -> Result<()> {
        {
            let mut running = self.is_running.lock().unwrap();
            if *running {
                return Err(anyhow!("Indexer is already running"));
            }
            *running = true;
        }
        
        // Start initial workers
        for i in 0..self.config.min_workers {
            self.spawn_worker(i).await?;
        }
        
        // Start the task dispatcher
        self.start_task_dispatcher().await;
        
        // Start auto-scaling if enabled
        if self.config.auto_scaling {
            self.start_auto_scaler().await;
        }
        
        Ok(())
    }
    
    pub async fn stop(&mut self) -> Result<()> {
        {
            let mut running = self.is_running.lock().unwrap();
            *running = false;
        }
        
        // Send shutdown signals to all workers
        for worker in &self.workers {
            let _ = worker.shutdown_tx.send(()).await;
        }
        
        // Wait for all workers to finish
        while let Some(worker) = self.workers.pop() {
            let _ = worker.handle.await;
        }
        
        Ok(())
    }
    
    pub async fn submit_task(&self, task: IndexingTask) -> Result<()> {
        if !*self.is_running.lock().unwrap() {
            return Err(anyhow!("Indexer is not running"));
        }
        
        {
            let mut queue = self.task_queue.lock().unwrap();
            queue.push(task);
        }
        
        Ok(())
    }
    
    pub async fn submit_batch(&self, tasks: Vec<IndexingTask>) -> Result<()> {
        for task in tasks {
            self.submit_task(task).await?;
        }
        Ok(())
    }
    
    pub fn get_worker_stats(&self) -> Vec<WorkerStats> {
        self.workers
            .iter()
            .map(|worker| worker.stats.lock().unwrap().clone())
            .collect()
    }
    
    pub fn get_queue_status(&self) -> (usize, usize, usize) {
        let queue = self.task_queue.lock().unwrap();
        (
            queue.high_priority.len(),
            queue.normal_priority.len(),
            queue.low_priority.len(),
        )
    }
    
    pub fn get_completed_tasks(&self) -> HashMap<uuid::Uuid, IndexingResult> {
        self.completed_tasks.lock().unwrap().clone()
    }
    
    async fn spawn_worker(&mut self, worker_id: usize) -> Result<()> {
        let (shutdown_tx, mut shutdown_rx) = mpsc::channel(1);
        
        let stats = Arc::new(Mutex::new(WorkerStats {
            worker_id,
            tasks_completed: 0,
            total_processing_time: Duration::ZERO,
            average_task_time: Duration::ZERO,
            current_task: None,
            is_busy: false,
            errors_count: 0,
        }));
        
        let task_queue = Arc::clone(&self.task_queue);
        let result_tx = self.result_tx.clone();
        let semaphore = Arc::clone(&self.semaphore);
        let is_running = Arc::clone(&self.is_running);
        let worker_stats = Arc::clone(&stats);
        let config = self.config.clone();
        
        let handle = tokio::spawn(async move {
            Self::worker_loop(
                worker_id,
                task_queue,
                result_tx,
                semaphore,
                is_running,
                worker_stats,
                config,
                &mut shutdown_rx,
            ).await;
        });
        
        self.workers.push(Worker {
            id: worker_id,
            handle,
            stats,
            shutdown_tx,
        });
        
        Ok(())
    }
    
    async fn worker_loop(
        worker_id: usize,
        task_queue: Arc<Mutex<TaskQueue>>,
        result_tx: mpsc::Sender<IndexingResult>,
        semaphore: Arc<Semaphore>,
        is_running: Arc<Mutex<bool>>,
        stats: Arc<Mutex<WorkerStats>>,
        config: ParallelIndexerConfig,
        shutdown_rx: &mut mpsc::Receiver<()>,
    ) {
        while *is_running.lock().unwrap() {
            // Check for shutdown signal
            if shutdown_rx.try_recv().is_ok() {
                break;
            }
            
            // Acquire semaphore permit
            let _permit = match semaphore.try_acquire() {
                Ok(permit) => permit,
                Err(_) => {
                    tokio::time::sleep(Duration::from_millis(10)).await;
                    continue;
                }
            };
            
            // Get next task
            let task = {
                let mut queue = task_queue.lock().unwrap();
                queue.pop()
            };
            
            if let Some(task) = task {
                // Update worker stats
                {
                    let mut worker_stats = stats.lock().unwrap();
                    worker_stats.current_task = Some(task.id);
                    worker_stats.is_busy = true;
                }
                
                // Process the task
                let start_time = Instant::now();
                let result = Self::process_task(task, config.worker_timeout).await;
                let processing_time = start_time.elapsed();
                
                // Update worker stats
                {
                    let mut worker_stats = stats.lock().unwrap();
                    worker_stats.tasks_completed += 1;
                    worker_stats.total_processing_time += processing_time;
                    worker_stats.average_task_time = 
                        worker_stats.total_processing_time / worker_stats.tasks_completed as u32;
                    worker_stats.current_task = None;
                    worker_stats.is_busy = false;
                    
                    if !result.success {
                        worker_stats.errors_count += 1;
                    }
                }
                
                // Mark task as completed in queue
                {
                    let mut queue = task_queue.lock().unwrap();
                    queue.mark_completed(result.task_id);
                }
                
                // Send result
                if let Err(e) = result_tx.send(result).await {
                    log::error!("Worker {}: Failed to send result: {}", worker_id, e);
                    break;
                }
            } else {
                // No tasks available, sleep briefly
                tokio::time::sleep(Duration::from_millis(50)).await;
            }
        }
        
        log::info!("Worker {} shutting down", worker_id);
    }
    
    async fn process_task(task: IndexingTask, timeout: Duration) -> IndexingResult {
        let start_time = Instant::now();
        
        // Simulate file processing with timeout
        let result = tokio::time::timeout(timeout, async {
            Self::index_file(&task.file_path).await
        }).await;
        
        let processing_time = start_time.elapsed();
        
        match result {
            Ok(Ok((entities_extracted, file_size))) => {
                IndexingResult {
                    task_id: task.id,
                    file_path: task.file_path,
                    success: true,
                    processing_time,
                    entities_extracted,
                    file_size,
                    error_message: None,
                }
            },
            Ok(Err(e)) => {
                IndexingResult {
                    task_id: task.id,
                    file_path: task.file_path,
                    success: false,
                    processing_time,
                    entities_extracted: 0,
                    file_size: 0,
                    error_message: Some(e.to_string()),
                }
            },
            Err(_) => {
                IndexingResult {
                    task_id: task.id,
                    file_path: task.file_path,
                    success: false,
                    processing_time,
                    entities_extracted: 0,
                    file_size: 0,
                    error_message: Some("Task timeout".to_string()),
                }
            },
        }
    }
    
    async fn index_file(file_path: &Path) -> Result<(usize, usize)> {
        // Mock implementation - replace with actual indexing logic
        let file_size = tokio::fs::metadata(file_path)
            .await
            .map(|m| m.len() as usize)
            .unwrap_or(0);
        
        // Simulate processing time based on file size
        let processing_time = Duration::from_millis((file_size / 1000).max(10) as u64);
        tokio::time::sleep(processing_time).await;
        
        // Mock entities extracted
        let entities_extracted = file_size / 100; // Rough estimate
        
        Ok((entities_extracted, file_size))
    }
    
    async fn start_task_dispatcher(&self) {
        let result_rx = Arc::clone(&self.result_rx);
        let completed_tasks = Arc::clone(&self.completed_tasks);
        let is_running = Arc::clone(&self.is_running);
        
        tokio::spawn(async move {
            let mut rx = result_rx.lock().unwrap();
            
            while *is_running.lock().unwrap() {
                if let Ok(result) = rx.try_recv() {
                    let mut completed = completed_tasks.lock().unwrap();
                    completed.insert(result.task_id, result);
                } else {
                    tokio::time::sleep(Duration::from_millis(10)).await;
                }
            }
        });
    }
    
    async fn start_auto_scaler(&self) {
        let workers_ref = Arc::new(Mutex::new(&self.workers));
        let task_queue = Arc::clone(&self.task_queue);
        let is_running = Arc::clone(&self.is_running);
        let config = self.config.clone();
        
        tokio::spawn(async move {
            let mut scale_check_interval = tokio::time::interval(Duration::from_secs(30));
            
            while *is_running.lock().unwrap() {
                scale_check_interval.tick().await;
                
                let queue_len = {
                    let queue = task_queue.lock().unwrap();
                    queue.len()
                };
                
                let workers_count = {
                    let workers = workers_ref.lock().unwrap();
                    workers.len()
                };
                
                // Scale up if queue is growing
                if queue_len > workers_count * 2 && workers_count < config.max_workers {
                    log::info!("Scaling up: queue_len={}, workers={}", queue_len, workers_count);
                    // Note: In a real implementation, you'd need a way to add workers dynamically
                }
                
                // Scale down if workers are idle
                if queue_len < workers_count / 2 && workers_count > config.min_workers {
                    log::info!("Scaling down: queue_len={}, workers={}", queue_len, workers_count);
                    // Note: In a real implementation, you'd need a way to remove workers dynamically
                }
            }
        });
    }
    
    pub fn optimize_for_workload(&mut self, file_sizes: &[usize], file_types: &[String]) {
        // Analyze workload characteristics
        let avg_file_size = file_sizes.iter().sum::<usize>() / file_sizes.len().max(1);
        let max_file_size = *file_sizes.iter().max().unwrap_or(&0);
        
        // Adjust configuration based on workload
        if avg_file_size > 1024 * 1024 { // Large files (>1MB)
            self.config.max_workers = (num_cpus::get() / 2).max(1); // Use fewer workers for large files
            self.config.worker_timeout = Duration::from_secs(600); // Longer timeout
        } else if avg_file_size < 1024 { // Small files (<1KB)
            self.config.max_workers = num_cpus::get() * 2; // More workers for small files
            self.config.batch_size = 50; // Larger batches
        }
        
        // Adjust based on file types
        let has_complex_files = file_types.iter().any(|t| {
            matches!(t.as_str(), "ts" | "tsx" | "js" | "jsx" | "py" | "rs")
        });
        
        if has_complex_files {
            self.config.load_balancing_strategy = LoadBalancingStrategy::SizeAware;
        }
        
        log::info!("Optimized configuration for workload: avg_size={}, max_size={}, workers={}", 
                  avg_file_size, max_file_size, self.config.max_workers);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::fs;
    
    #[tokio::test]
    async fn test_parallel_indexer_basic() {
        let config = ParallelIndexerConfig {
            max_workers: 2,
            min_workers: 1,
            queue_capacity: 100,
            ..Default::default()
        };
        
        let mut indexer = ParallelIndexer::new(config).unwrap();
        indexer.start().await.unwrap();
        
        // Create test files
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        fs::write(&file_path, "test content").unwrap();
        
        let task = IndexingTask {
            id: uuid::Uuid::new_v4(),
            file_path,
            priority: TaskPriority::Normal,
            estimated_size: 100,
            created_at: chrono::Utc::now(),
            dependencies: vec![],
        };
        
        indexer.submit_task(task).await.unwrap();
        
        // Wait for processing
        tokio::time::sleep(Duration::from_millis(100)).await;
        
        let stats = indexer.get_worker_stats();
        assert!(!stats.is_empty());
        
        indexer.stop().await.unwrap();
    }
    
    #[test]
    fn test_task_queue_priority() {
        let mut queue = TaskQueue::new();
        
        let low_task = IndexingTask {
            id: uuid::Uuid::new_v4(),
            file_path: PathBuf::from("low.txt"),
            priority: TaskPriority::Low,
            estimated_size: 100,
            created_at: chrono::Utc::now(),
            dependencies: vec![],
        };
        
        let high_task = IndexingTask {
            id: uuid::Uuid::new_v4(),
            file_path: PathBuf::from("high.txt"),
            priority: TaskPriority::High,
            estimated_size: 100,
            created_at: chrono::Utc::now(),
            dependencies: vec![],
        };
        
        queue.push(low_task);
        queue.push(high_task.clone());
        
        // High priority task should be popped first
        let popped = queue.pop().unwrap();
        assert_eq!(popped.id, high_task.id);
    }
    
    #[test]
    fn test_task_dependencies() {
        let mut queue = TaskQueue::new();
        
        let dep_id = uuid::Uuid::new_v4();
        let task_id = uuid::Uuid::new_v4();
        
        let dependent_task = IndexingTask {
            id: task_id,
            file_path: PathBuf::from("dependent.txt"),
            priority: TaskPriority::High,
            estimated_size: 100,
            created_at: chrono::Utc::now(),
            dependencies: vec![dep_id],
        };
        
        queue.push(dependent_task);
        
        // Should not be able to pop task with unresolved dependencies
        assert!(queue.pop().is_none());
        
        // Mark dependency as completed
        queue.mark_completed(dep_id);
        
        // Now should be able to pop the task
        assert!(queue.pop().is_some());
    }
}