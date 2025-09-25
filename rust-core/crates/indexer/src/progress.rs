//! Progress tracking for indexing operations

use std::time::{Duration, Instant};
use serde::{Serialize, Deserialize};

/// Detailed progress information for indexing operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressTracker {
    pub total_files: usize,
    pub processed_files: usize,
    pub total_entities: usize,
    pub current_file: Option<String>,
    pub errors: Vec<ProgressError>,
    pub start_time: Instant,
    pub last_update: Instant,
    pub estimated_time_remaining: Option<Duration>,
    pub throughput: f64, // files per second
    pub status: ProgressStatus,
}

/// Progress status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProgressStatus {
    Idle,
    Scanning,
    Indexing,
    Completing,
    Completed,
    Failed,
    Cancelled,
}

/// Progress error information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressError {
    pub file_path: String,
    pub error_message: String,
    pub timestamp: Instant,
    pub error_type: ErrorType,
}

/// Error type categorization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ErrorType {
    FileNotFound,
    PermissionDenied,
    ParseError,
    MemoryError,
    Timeout,
    Unknown,
}

impl ProgressTracker {
    /// Create a new progress tracker
    pub fn new() -> Self {
        Self {
            total_files: 0,
            processed_files: 0,
            total_entities: 0,
            current_file: None,
            errors: Vec::new(),
            start_time: Instant::now(),
            last_update: Instant::now(),
            estimated_time_remaining: None,
            throughput: 0.0,
            status: ProgressStatus::Idle,
        }
    }

    /// Start a new indexing operation
    pub fn start(&mut self, estimated_files: usize) {
        self.total_files = estimated_files;
        self.processed_files = 0;
        self.total_entities = 0;
        self.errors.clear();
        self.start_time = Instant::now();
        self.last_update = Instant::now();
        self.estimated_time_remaining = None;
        self.throughput = 0.0;
        self.status = ProgressStatus::Scanning;
    }

    /// Update progress when starting to scan
    pub fn set_scanning(&mut self) {
        self.status = ProgressStatus::Scanning;
        self.last_update = Instant::now();
    }

    /// Update progress when starting to index
    pub fn set_indexing(&mut self, total_files: usize) {
        self.total_files = total_files;
        self.status = ProgressStatus::Indexing;
        self.last_update = Instant::now();
    }

    /// Update progress when a file is processed
    pub fn file_processed(&mut self, file_path: String, entity_count: usize) {
        self.processed_files += 1;
        self.total_entities += entity_count;
        self.current_file = Some(file_path);
        self.last_update = Instant::now();
        self.update_estimates();
    }

    /// Add an error
    pub fn add_error(&mut self, file_path: String, error_message: String, error_type: ErrorType) {
        self.errors.push(ProgressError {
            file_path,
            error_message,
            timestamp: Instant::now(),
            error_type,
        });
        self.last_update = Instant::now();
    }

    /// Mark as completed
    pub fn complete(&mut self) {
        self.status = ProgressStatus::Completed;
        self.estimated_time_remaining = Some(Duration::from_secs(0));
        self.last_update = Instant::now();
    }

    /// Mark as failed
    pub fn fail(&mut self, error_message: String) {
        self.status = ProgressStatus::Failed;
        self.add_error("system".to_string(), error_message, ErrorType::Unknown);
        self.last_update = Instant::now();
    }

    /// Cancel the operation
    pub fn cancel(&mut self) {
        self.status = ProgressStatus::Cancelled;
        self.last_update = Instant::now();
    }

    /// Get completion percentage
    pub fn completion_percentage(&self) -> f64 {
        if self.total_files == 0 {
            0.0
        } else {
            (self.processed_files as f64 / self.total_files as f64) * 100.0
        }
    }

    /// Get elapsed time
    pub fn elapsed_time(&self) -> Duration {
        self.start_time.elapsed()
    }

    /// Update time estimates and throughput
    fn update_estimates(&mut self) {
        let elapsed = self.elapsed_time();
        if elapsed.as_secs() > 0 {
            self.throughput = self.processed_files as f64 / elapsed.as_secs_f64();
        }

        if self.processed_files > 0 {
            let avg_time_per_file = elapsed / self.processed_files as u32;
            let remaining_files = self.total_files.saturating_sub(self.processed_files);
            self.estimated_time_remaining = Some(avg_time_per_file * remaining_files as u32);
        }
    }

    /// Get summary information
    pub fn summary(&self) -> ProgressSummary {
        ProgressSummary {
            total_files: self.total_files,
            processed_files: self.processed_files,
            completion_percentage: self.completion_percentage(),
            elapsed_time: self.elapsed_time(),
            estimated_time_remaining: self.estimated_time_remaining,
            throughput: self.throughput,
            error_count: self.errors.len(),
            status: self.status.clone(),
        }
    }
}

impl Default for ProgressTracker {
    fn default() -> Self {
        Self::new()
    }
}

/// Progress summary for easy serialization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressSummary {
    pub total_files: usize,
    pub processed_files: usize,
    pub completion_percentage: f64,
    pub elapsed_time: Duration,
    pub estimated_time_remaining: Option<Duration>,
    pub throughput: f64,
    pub error_count: usize,
    pub status: ProgressStatus,
}

/// Progress observer trait for real-time updates
pub trait ProgressObserver: Send + Sync {
    fn on_progress_update(&self, progress: &ProgressSummary);
    fn on_error(&self, error: &ProgressError);
    fn on_complete(&self, summary: &ProgressSummary);
}

/// Progress manager with multiple observers
pub struct ProgressManager {
    tracker: ProgressTracker,
    observers: Vec<Box<dyn ProgressObserver>>,
}

impl ProgressManager {
    /// Create a new progress manager
    pub fn new() -> Self {
        Self {
            tracker: ProgressTracker::new(),
            observers: Vec::new(),
        }
    }

    /// Add a progress observer
    pub fn add_observer(&mut self, observer: Box<dyn ProgressObserver>) {
        self.observers.push(observer);
    }

    /// Remove all observers
    pub fn clear_observers(&mut self) {
        self.observers.clear();
    }

    /// Get a mutable reference to the tracker
    pub fn tracker_mut(&mut self) -> &mut ProgressTracker {
        &mut self.tracker
    }

    /// Get an immutable reference to the tracker
    pub fn tracker(&self) -> &ProgressTracker {
        &self.tracker
    }

    /// Notify observers of progress update
    pub fn notify_progress(&self) {
        let summary = self.tracker.summary();
        for observer in &self.observers {
            observer.on_progress_update(&summary);
        }
    }

    /// Notify observers of error
    pub fn notify_error(&self, error: &ProgressError) {
        for observer in &self.observers {
            observer.on_error(error);
        }
    }

    /// Notify observers of completion
    pub fn notify_complete(&self) {
        let summary = self.tracker.summary();
        for observer in &self.observers {
            observer.on_complete(&summary);
        }
    }
}

impl Default for ProgressManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_progress_tracker() {
        let mut tracker = ProgressTracker::new();
        tracker.start(100);

        assert_eq!(tracker.total_files, 100);
        assert_eq!(tracker.status, ProgressStatus::Scanning);

        tracker.set_indexing(100);
        assert_eq!(tracker.status, ProgressStatus::Indexing);

        tracker.file_processed("test.ts".to_string(), 5);
        assert_eq!(tracker.processed_files, 1);
        assert_eq!(tracker.total_entities, 5);

        let percentage = tracker.completion_percentage();
        assert!(percentage > 0.0 && percentage <= 100.0);

        tracker.complete();
        assert_eq!(tracker.status, ProgressStatus::Completed);
    }

    #[test]
    fn test_progress_summary() {
        let mut tracker = ProgressTracker::new();
        tracker.start(10);
        tracker.file_processed("test.ts".to_string(), 3);

        let summary = tracker.summary();
        assert_eq!(summary.total_files, 10);
        assert_eq!(summary.processed_files, 1);
        assert!(summary.completion_percentage > 0.0);
        assert!(summary.throughput > 0.0);
    }

    #[test]
    fn test_progress_manager() {
        struct TestObserver;
        impl ProgressObserver for TestObserver {
            fn on_progress_update(&self, _progress: &ProgressSummary) {}
            fn on_error(&self, _error: &ProgressError) {}
            fn on_complete(&self, _summary: &ProgressSummary) {}
        }

        let mut manager = ProgressManager::new();
        manager.add_observer(Box::new(TestObserver));
        assert_eq!(manager.observers.len(), 1);

        manager.clear_observers();
        assert_eq!(manager.observers.len(), 0);
    }
}