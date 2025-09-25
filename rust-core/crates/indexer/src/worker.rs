//! Worker thread for parallel indexing

use anyhow::Result;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::engine::Engine;
use code_intelligence_core::CodeEntity;

/// Indexing worker for processing files in parallel
pub struct Worker {
    id: usize,
    engine: Arc<RwLock<Engine>>,
}

impl Worker {
    /// Create a new indexing worker
    pub fn new(id: usize, engine: Arc<RwLock<Engine>>) -> Self {
        Self { id, engine }
    }

    /// Process a single file
    pub async fn process_file(&self, file_path: &Path, content: &str) -> Result<Vec<CodeEntity>> {
        let engine = self.engine.read().await;
        engine.process_file(file_path, content).await
    }

    /// Get worker ID
    pub fn id(&self) -> usize {
        self.id
    }

    /// Get worker status (simplified)
    pub async fn is_busy(&self) -> bool {
        // In a real implementation, this would track the worker's current state
        false
    }
}

/// Worker pool for managing multiple indexing workers
pub struct WorkerPool {
    workers: Vec<Worker>,
    next_worker: usize,
}

impl WorkerPool {
    /// Create a new worker pool with the given number of workers
    pub fn new(size: usize, engine: Arc<RwLock<Engine>>) -> Self {
        let mut workers = Vec::new();
        for i in 0..size {
            workers.push(Worker::new(i, Arc::clone(&engine)));
        }

        Self {
            workers,
            next_worker: 0,
        }
    }

    /// Get the next available worker (round-robin)
    pub fn next_worker(&mut self) -> &Worker {
        let worker = &self.workers[self.next_worker];
        self.next_worker = (self.next_worker + 1) % self.workers.len();
        worker
    }

    /// Get all workers
    pub fn workers(&self) -> &[Worker] {
        &self.workers
    }

    /// Get the number of workers
    pub fn len(&self) -> usize {
        self.workers.len()
    }

    /// Check if any worker is busy
    pub async fn any_busy(&self) -> bool {
        for worker in &self.workers {
            if worker.is_busy().await {
                return true;
            }
        }
        false
    }

    /// Wait for all workers to finish (simplified)
    pub async fn wait_all(&self) -> Result<()> {
        // In a real implementation, this would wait for all workers to complete
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::Engine;
    use crate::IndexingConfig;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_worker_creation() {
        let config = IndexingConfig::default();
        let engine = Arc::new(RwLock::new(Engine::new(config)));
        let worker = Worker::new(1, Arc::clone(&engine));

        assert_eq!(worker.id(), 1);
        assert!(!worker.is_busy().await);
    }

    #[tokio::test]
    async fn test_worker_pool() {
        let config = IndexingConfig::default();
        let engine = Arc::new(RwLock::new(Engine::new(config)));
        let mut pool = WorkerPool::new(4, Arc::clone(&engine));

        assert_eq!(pool.len(), 4);

        let worker1 = pool.next_worker();
        let worker2 = pool.next_worker();
        let worker3 = pool.next_worker();
        let worker4 = pool.next_worker();
        let worker5 = pool.next_worker(); // Should wrap around

        assert_eq!(worker1.id(), worker5.id()); // Round-robin should work
    }

    #[tokio::test]
    async fn test_worker_process_file() {
        let config = IndexingConfig::default();
        let engine = Arc::new(RwLock::new(Engine::new(config)));
        let worker = Worker::new(1, Arc::clone(&engine));

        let temp_dir = TempDir::new().unwrap();
        let test_file = temp_dir.path().join("test.ts");
        let content = "function test() { return 'hello'; }";

        let entities = worker.process_file(&test_file, content).await.unwrap();

        // Should process the file successfully
        assert!(!entities.is_empty());
    }
}