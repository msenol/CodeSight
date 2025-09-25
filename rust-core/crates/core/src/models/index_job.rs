//! Index job model for managing indexing operations

use super::{ModelResult, Validate, Timestamped, JsonSerializable};
use crate::errors::CoreError;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Represents an indexing job in the system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IndexJob {
    /// Unique identifier for the job
    pub id: String,
    /// Codebase ID being indexed
    pub codebase_id: String,
    /// Job type
    pub job_type: IndexJobType,
    /// Current status of the job
    pub status: IndexJobStatus,
    /// Job priority
    pub priority: JobPriority,
    /// Job configuration
    pub config: IndexJobConfig,
    /// Job progress information
    pub progress: JobProgress,
    /// Job statistics
    pub stats: JobStats,
    /// Error information if job failed
    pub error: Option<JobError>,
    /// Job metadata
    pub metadata: JobMetadata,
    /// When the job was created
    pub created_at: DateTime<Utc>,
    /// When the job was started
    pub started_at: Option<DateTime<Utc>>,
    /// When the job was completed
    pub completed_at: Option<DateTime<Utc>>,
    /// When the job was last updated
    pub updated_at: DateTime<Utc>,
}

/// Types of indexing jobs
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum IndexJobType {
    /// Full indexing of a codebase
    FullIndex,
    /// Incremental indexing (only changed files)
    IncrementalIndex,
    /// Re-indexing specific files
    FileReindex,
    /// Embedding generation
    EmbeddingGeneration,
    /// Index optimization
    IndexOptimization,
    /// Index cleanup
    IndexCleanup,
    /// Index validation
    IndexValidation,
    /// Index migration
    IndexMigration,
    /// Custom indexing job
    Custom(String),
}

/// Job status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum IndexJobStatus {
    /// Job is queued and waiting to start
    Queued,
    /// Job is currently running
    Running,
    /// Job completed successfully
    Completed,
    /// Job failed with an error
    Failed,
    /// Job was cancelled
    Cancelled,
    /// Job is paused
    Paused,
    /// Job is retrying after a failure
    Retrying,
    /// Job is being cleaned up
    Cleanup,
}

/// Job priority levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, PartialOrd, Ord, Eq)]
pub enum JobPriority {
    /// Lowest priority
    Low = 1,
    /// Normal priority
    Normal = 2,
    /// High priority
    High = 3,
    /// Critical priority
    Critical = 4,
    /// Emergency priority
    Emergency = 5,
}

/// Job configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct IndexJobConfig {
    /// Batch size for processing
    pub batch_size: usize,
    /// Number of parallel workers
    pub parallel_workers: usize,
    /// Maximum file size to process (bytes)
    pub max_file_size_bytes: usize,
    /// File patterns to include
    pub include_patterns: Vec<String>,
    /// File patterns to exclude
    pub exclude_patterns: Vec<String>,
    /// Whether to follow symbolic links
    pub follow_symlinks: bool,
    /// Whether to index hidden files
    pub index_hidden_files: bool,
    /// Whether to generate embeddings
    pub generate_embeddings: bool,
    /// Whether to update existing entries
    pub update_existing: bool,
    /// Job timeout in seconds
    pub timeout_seconds: Option<u64>,
    /// Maximum retries on failure
    pub max_retries: u32,
    /// Retry delay in seconds
    pub retry_delay_seconds: u64,
    /// Custom configuration options
    pub custom_options: HashMap<String, String>,
}

/// Job progress information
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct JobProgress {
    /// Total number of items to process
    pub total_items: usize,
    /// Number of items processed
    pub processed_items: usize,
    /// Number of items that failed
    pub failed_items: usize,
    /// Number of items skipped
    pub skipped_items: usize,
    /// Current progress percentage (0.0 to 100.0)
    pub percentage: f64,
    /// Current phase of the job
    pub current_phase: JobPhase,
    /// Estimated time remaining in seconds
    pub estimated_remaining_seconds: Option<u64>,
    /// Current processing rate (items per second)
    pub processing_rate: f64,
    /// Last processed item
    pub last_processed_item: Option<String>,
}

/// Job phases
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum JobPhase {
    /// Initializing the job
    Initializing,
    /// Scanning for files
    Scanning,
    /// Parsing files
    Parsing,
    /// Analyzing code
    Analyzing,
    /// Generating embeddings
    GeneratingEmbeddings,
    /// Building indexes
    BuildingIndexes,
    /// Optimizing indexes
    OptimizingIndexes,
    /// Finalizing the job
    Finalizing,
    /// Cleaning up
    Cleanup,
    /// Custom phase
    Custom(String),
}

/// Job statistics
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct JobStats {
    /// Total execution time in milliseconds
    pub total_execution_time_ms: u64,
    /// Time spent in each phase
    pub phase_times: HashMap<String, u64>,
    /// Number of files processed
    pub files_processed: usize,
    /// Number of entities created
    pub entities_created: usize,
    /// Number of relationships created
    pub relationships_created: usize,
    /// Number of embeddings generated
    pub embeddings_generated: usize,
    /// Total bytes processed
    pub bytes_processed: u64,
    /// Peak memory usage in bytes
    pub peak_memory_bytes: Option<usize>,
    /// Average processing rate (items/second)
    pub avg_processing_rate: f64,
    /// Number of retries performed
    pub retry_count: u32,
    /// Cache hit ratio
    pub cache_hit_ratio: Option<f64>,
}

/// Job error information
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JobError {
    /// Error code
    pub code: String,
    /// Error message
    pub message: String,
    /// Detailed error description
    pub details: Option<String>,
    /// Stack trace if available
    pub stack_trace: Option<String>,
    /// File that caused the error
    pub file_path: Option<String>,
    /// Line number where error occurred
    pub line_number: Option<usize>,
    /// Whether the error is recoverable
    pub recoverable: bool,
    /// When the error occurred
    pub occurred_at: DateTime<Utc>,
}

/// Job metadata
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct JobMetadata {
    /// User or system that initiated the job
    pub initiated_by: Option<String>,
    /// Reason for the job
    pub reason: Option<String>,
    /// Job tags for categorization
    pub tags: Vec<String>,
    /// Parent job ID if this is a sub-job
    pub parent_job_id: Option<String>,
    /// Child job IDs if this job spawned others
    pub child_job_ids: Vec<String>,
    /// Job dependencies
    pub dependencies: Vec<String>,
    /// Worker node that processed the job
    pub worker_node: Option<String>,
    /// Additional custom metadata
    pub custom: HashMap<String, String>,
}

/// Job queue entry
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JobQueueEntry {
    /// Job ID
    pub job_id: String,
    /// Job priority
    pub priority: JobPriority,
    /// When the job was queued
    pub queued_at: DateTime<Utc>,
    /// Estimated execution time in seconds
    pub estimated_duration_seconds: Option<u64>,
    /// Job dependencies that must complete first
    pub dependencies: Vec<String>,
    /// Whether the job can be executed in parallel
    pub parallel_execution: bool,
}

/// Job execution context
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JobExecutionContext {
    /// Execution ID
    pub execution_id: String,
    /// Job being executed
    pub job: IndexJob,
    /// Worker information
    pub worker: WorkerInfo,
    /// Execution environment
    pub environment: HashMap<String, String>,
    /// Resource allocations
    pub resources: ResourceAllocation,
    /// When execution started
    pub started_at: DateTime<Utc>,
}

/// Worker information
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WorkerInfo {
    /// Worker ID
    pub id: String,
    /// Worker name
    pub name: String,
    /// Worker version
    pub version: String,
    /// Worker capabilities
    pub capabilities: Vec<String>,
    /// Current load (0.0 to 1.0)
    pub current_load: f64,
    /// Available memory in bytes
    pub available_memory_bytes: usize,
    /// Available CPU cores
    pub available_cpu_cores: usize,
}

/// Resource allocation for job execution
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ResourceAllocation {
    /// Allocated memory in bytes
    pub memory_bytes: usize,
    /// Allocated CPU cores
    pub cpu_cores: usize,
    /// Allocated disk space in bytes
    pub disk_space_bytes: Option<usize>,
    /// Network bandwidth allocation
    pub network_bandwidth_bps: Option<u64>,
    /// Temporary directory for job execution
    pub temp_directory: Option<String>,
}

impl IndexJob {
    /// Create a new index job
    pub fn new(
        codebase_id: String,
        job_type: IndexJobType,
        priority: JobPriority,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            codebase_id,
            job_type,
            status: IndexJobStatus::Queued,
            priority,
            config: IndexJobConfig::default(),
            progress: JobProgress::default(),
            stats: JobStats::default(),
            error: None,
            metadata: JobMetadata::default(),
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            updated_at: Utc::now(),
        }
    }

    /// Create a full index job
    pub fn full_index(codebase_id: String) -> Self {
        Self::new(codebase_id, IndexJobType::FullIndex, JobPriority::Normal)
    }

    /// Create an incremental index job
    pub fn incremental_index(codebase_id: String) -> Self {
        Self::new(codebase_id, IndexJobType::IncrementalIndex, JobPriority::High)
    }

    /// Create an embedding generation job
    pub fn embedding_generation(codebase_id: String) -> Self {
        Self::new(codebase_id, IndexJobType::EmbeddingGeneration, JobPriority::Normal)
    }

    /// Set job configuration
    pub fn with_config(mut self, config: IndexJobConfig) -> Self {
        self.config = config;
        self.updated_at = Utc::now();
        self
    }

    /// Set job metadata
    pub fn with_metadata(mut self, metadata: JobMetadata) -> Self {
        self.metadata = metadata;
        self.updated_at = Utc::now();
        self
    }

    /// Set job priority
    pub fn with_priority(mut self, priority: JobPriority) -> Self {
        self.priority = priority;
        self.updated_at = Utc::now();
        self
    }

    /// Start the job
    pub fn start(&mut self) {
        self.status = IndexJobStatus::Running;
        self.started_at = Some(Utc::now());
        self.progress.current_phase = JobPhase::Initializing;
        self.updated_at = Utc::now();
    }

    /// Complete the job successfully
    pub fn complete(&mut self) {
        self.status = IndexJobStatus::Completed;
        self.completed_at = Some(Utc::now());
        self.progress.percentage = 100.0;
        self.progress.current_phase = JobPhase::Finalizing;
        self.calculate_total_execution_time();
        self.updated_at = Utc::now();
    }

    /// Fail the job with an error
    pub fn fail(&mut self, error: JobError) {
        self.status = IndexJobStatus::Failed;
        self.completed_at = Some(Utc::now());
        self.error = Some(error);
        self.calculate_total_execution_time();
        self.updated_at = Utc::now();
    }

    /// Cancel the job
    pub fn cancel(&mut self) {
        self.status = IndexJobStatus::Cancelled;
        self.completed_at = Some(Utc::now());
        self.calculate_total_execution_time();
        self.updated_at = Utc::now();
    }

    /// Pause the job
    pub fn pause(&mut self) {
        if self.status == IndexJobStatus::Running {
            self.status = IndexJobStatus::Paused;
            self.updated_at = Utc::now();
        }
    }

    /// Resume the job
    pub fn resume(&mut self) {
        if self.status == IndexJobStatus::Paused {
            self.status = IndexJobStatus::Running;
            self.updated_at = Utc::now();
        }
    }

    /// Retry the job
    pub fn retry(&mut self) {
        if self.can_retry() {
            self.status = IndexJobStatus::Retrying;
            self.stats.retry_count += 1;
            self.error = None;
            self.updated_at = Utc::now();
        }
    }

    /// Check if the job can be retried
    pub fn can_retry(&self) -> bool {
        matches!(self.status, IndexJobStatus::Failed) &&
        self.stats.retry_count < self.config.max_retries &&
        self.error.as_ref().map(|e| e.recoverable).unwrap_or(false)
    }

    /// Update job progress
    pub fn update_progress(
        &mut self,
        processed_items: usize,
        total_items: usize,
        current_phase: JobPhase,
    ) {
        self.progress.processed_items = processed_items;
        self.progress.total_items = total_items;
        self.progress.current_phase = current_phase;
        
        if total_items > 0 {
            self.progress.percentage = (processed_items as f64 / total_items as f64) * 100.0;
        }
        
        self.calculate_processing_rate();
        self.estimate_remaining_time();
        self.updated_at = Utc::now();
    }

    /// Calculate processing rate
    fn calculate_processing_rate(&mut self) {
        if let Some(started_at) = self.started_at {
            let elapsed_seconds = (Utc::now() - started_at).num_seconds() as f64;
            if elapsed_seconds > 0.0 {
                self.progress.processing_rate = self.progress.processed_items as f64 / elapsed_seconds;
                self.stats.avg_processing_rate = self.progress.processing_rate;
            }
        }
    }

    /// Estimate remaining time
    fn estimate_remaining_time(&mut self) {
        if self.progress.processing_rate > 0.0 {
            let remaining_items = self.progress.total_items - self.progress.processed_items;
            self.progress.estimated_remaining_seconds = 
                Some((remaining_items as f64 / self.progress.processing_rate) as u64);
        }
    }

    /// Calculate total execution time
    fn calculate_total_execution_time(&mut self) {
        if let (Some(started_at), Some(completed_at)) = (self.started_at, self.completed_at) {
            self.stats.total_execution_time_ms = 
                (completed_at - started_at).num_milliseconds() as u64;
        }
    }

    /// Check if the job is running
    pub fn is_running(&self) -> bool {
        matches!(self.status, IndexJobStatus::Running | IndexJobStatus::Retrying)
    }

    /// Check if the job is completed
    pub fn is_completed(&self) -> bool {
        matches!(
            self.status,
            IndexJobStatus::Completed | IndexJobStatus::Failed | IndexJobStatus::Cancelled
        )
    }

    /// Check if the job is successful
    pub fn is_successful(&self) -> bool {
        self.status == IndexJobStatus::Completed
    }

    /// Get job duration
    pub fn duration(&self) -> Option<chrono::Duration> {
        match (self.started_at, self.completed_at) {
            (Some(start), Some(end)) => Some(end - start),
            (Some(start), None) => Some(Utc::now() - start),
            _ => None,
        }
    }

    /// Get job age
    pub fn age(&self) -> chrono::Duration {
        Utc::now() - self.created_at
    }

    /// Add a tag to the job
    pub fn add_tag(&mut self, tag: String) {
        if !self.metadata.tags.contains(&tag) {
            self.metadata.tags.push(tag);
            self.updated_at = Utc::now();
        }
    }

    /// Remove a tag from the job
    pub fn remove_tag(&mut self, tag: &str) {
        self.metadata.tags.retain(|t| t != tag);
        self.updated_at = Utc::now();
    }

    /// Check if job has a specific tag
    pub fn has_tag(&self, tag: &str) -> bool {
        self.metadata.tags.contains(&tag.to_string())
    }

    /// Set custom metadata
    pub fn set_custom_metadata(&mut self, key: String, value: String) {
        self.metadata.custom.insert(key, value);
        self.updated_at = Utc::now();
    }

    /// Get custom metadata
    pub fn get_custom_metadata(&self, key: &str) -> Option<&String> {
        self.metadata.custom.get(key)
    }
}

impl Default for JobPriority {
    fn default() -> Self {
        JobPriority::Normal
    }
}

impl Default for JobPhase {
    fn default() -> Self {
        JobPhase::Initializing
    }
}

impl JobError {
    /// Create a new job error
    pub fn new(code: String, message: String, recoverable: bool) -> Self {
        Self {
            code,
            message,
            details: None,
            stack_trace: None,
            file_path: None,
            line_number: None,
            recoverable,
            occurred_at: Utc::now(),
        }
    }

    /// Create a recoverable error
    pub fn recoverable(code: String, message: String) -> Self {
        Self::new(code, message, true)
    }

    /// Create a non-recoverable error
    pub fn fatal(code: String, message: String) -> Self {
        Self::new(code, message, false)
    }

    /// Add details to the error
    pub fn with_details(mut self, details: String) -> Self {
        self.details = Some(details);
        self
    }

    /// Add file context to the error
    pub fn with_file_context(mut self, file_path: String, line_number: Option<usize>) -> Self {
        self.file_path = Some(file_path);
        self.line_number = line_number;
        self
    }

    /// Add stack trace to the error
    pub fn with_stack_trace(mut self, stack_trace: String) -> Self {
        self.stack_trace = Some(stack_trace);
        self
    }
}

impl JobQueueEntry {
    /// Create a new queue entry
    pub fn new(job_id: String, priority: JobPriority) -> Self {
        Self {
            job_id,
            priority,
            queued_at: Utc::now(),
            estimated_duration_seconds: None,
            dependencies: Vec::new(),
            parallel_execution: true,
        }
    }

    /// Set dependencies
    pub fn with_dependencies(mut self, dependencies: Vec<String>) -> Self {
        self.dependencies = dependencies;
        self
    }

    /// Set parallel execution flag
    pub fn with_parallel_execution(mut self, parallel: bool) -> Self {
        self.parallel_execution = parallel;
        self
    }

    /// Check if all dependencies are satisfied
    pub fn dependencies_satisfied(&self, completed_jobs: &[String]) -> bool {
        self.dependencies.iter().all(|dep| completed_jobs.contains(dep))
    }
}

impl Validate for IndexJob {
    fn validate(&self) -> Result<(), CoreError> {
        if self.codebase_id.trim().is_empty() {
            return Err(CoreError::ValidationError(
                "Codebase ID cannot be empty".to_string(),
            ));
        }

        if self.config.batch_size == 0 {
            return Err(CoreError::ValidationError(
                "Batch size must be greater than 0".to_string(),
            ));
        }

        if self.config.parallel_workers == 0 {
            return Err(CoreError::ValidationError(
                "Number of parallel workers must be greater than 0".to_string(),
            ));
        }

        if self.progress.percentage < 0.0 || self.progress.percentage > 100.0 {
            return Err(CoreError::ValidationError(
                "Progress percentage must be between 0.0 and 100.0".to_string(),
            ));
        }

        if self.progress.processed_items > self.progress.total_items {
            return Err(CoreError::ValidationError(
                "Processed items cannot exceed total items".to_string(),
            ));
        }

        Ok(())
    }
}

impl Timestamped for IndexJob {
    fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    fn updated_at(&self) -> Option<DateTime<Utc>> {
        Some(self.updated_at)
    }
}

// JsonSerializable is automatically implemented for all types via the blanket impl in mod.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_index_job_creation() {
        let job = IndexJob::new(
            "codebase123".to_string(),
            IndexJobType::FullIndex,
            JobPriority::High,
        );

        assert_eq!(job.codebase_id, "codebase123");
        assert_eq!(job.job_type, IndexJobType::FullIndex);
        assert_eq!(job.priority, JobPriority::High);
        assert_eq!(job.status, IndexJobStatus::Queued);
        assert!(job.validate().is_ok());
    }

    #[test]
    fn test_job_lifecycle() {
        let mut job = IndexJob::full_index("codebase123".to_string());
        
        assert_eq!(job.status, IndexJobStatus::Queued);
        assert!(!job.is_running());
        assert!(!job.is_completed());
        
        job.start();
        assert_eq!(job.status, IndexJobStatus::Running);
        assert!(job.is_running());
        assert!(!job.is_completed());
        
        job.complete();
        assert_eq!(job.status, IndexJobStatus::Completed);
        assert!(!job.is_running());
        assert!(job.is_completed());
        assert!(job.is_successful());
    }

    #[test]
    fn test_job_failure_and_retry() {
        let mut job = IndexJob::incremental_index("codebase123".to_string());
        job.config.max_retries = 3;
        
        let error = JobError::recoverable(
            "PARSE_ERROR".to_string(),
            "Failed to parse file".to_string(),
        );
        
        job.start();
        job.fail(error);
        
        assert_eq!(job.status, IndexJobStatus::Failed);
        assert!(job.can_retry());
        
        job.retry();
        assert_eq!(job.status, IndexJobStatus::Retrying);
        assert_eq!(job.stats.retry_count, 1);
    }

    #[test]
    fn test_job_progress_tracking() {
        let mut job = IndexJob::full_index("codebase123".to_string());
        job.start();
        
        job.update_progress(50, 100, JobPhase::Parsing);
        
        assert_eq!(job.progress.processed_items, 50);
        assert_eq!(job.progress.total_items, 100);
        assert_eq!(job.progress.percentage, 50.0);
        assert_eq!(job.progress.current_phase, JobPhase::Parsing);
    }

    #[test]
    fn test_job_priority_ordering() {
        assert!(JobPriority::Emergency > JobPriority::Critical);
        assert!(JobPriority::Critical > JobPriority::High);
        assert!(JobPriority::High > JobPriority::Normal);
        assert!(JobPriority::Normal > JobPriority::Low);
    }

    #[test]
    fn test_job_tags() {
        let mut job = IndexJob::full_index("codebase123".to_string());
        
        assert!(!job.has_tag("urgent"));
        
        job.add_tag("urgent".to_string());
        assert!(job.has_tag("urgent"));
        
        job.add_tag("manual".to_string());
        assert_eq!(job.metadata.tags.len(), 2);
        
        job.remove_tag("urgent");
        assert!(!job.has_tag("urgent"));
        assert!(job.has_tag("manual"));
    }

    #[test]
    fn test_job_custom_metadata() {
        let mut job = IndexJob::full_index("codebase123".to_string());
        
        job.set_custom_metadata("user_id".to_string(), "user123".to_string());
        assert_eq!(job.get_custom_metadata("user_id"), Some(&"user123".to_string()));
        assert_eq!(job.get_custom_metadata("nonexistent"), None);
    }

    #[test]
    fn test_job_error() {
        let error = JobError::recoverable(
            "IO_ERROR".to_string(),
            "File not found".to_string(),
        )
        .with_details("The specified file does not exist".to_string())
        .with_file_context("src/main.rs".to_string(), Some(42));
        
        assert_eq!(error.code, "IO_ERROR");
        assert!(error.recoverable);
        assert_eq!(error.file_path, Some("src/main.rs".to_string()));
        assert_eq!(error.line_number, Some(42));
    }

    #[test]
    fn test_job_queue_entry() {
        let entry = JobQueueEntry::new("job123".to_string(), JobPriority::High)
            .with_dependencies(vec!["job456".to_string()])
            .with_parallel_execution(false);
        
        assert_eq!(entry.job_id, "job123");
        assert_eq!(entry.priority, JobPriority::High);
        assert!(!entry.parallel_execution);
        
        assert!(!entry.dependencies_satisfied(&[]));
        assert!(entry.dependencies_satisfied(&["job456".to_string()]));
    }

    #[test]
    fn test_job_validation() {
        let mut job = IndexJob::new(
            "".to_string(),
            IndexJobType::FullIndex,
            JobPriority::Normal,
        );
        assert!(job.validate().is_err());
        
        job.codebase_id = "valid_id".to_string();
        assert!(job.validate().is_ok());
        
        job.config.batch_size = 0;
        assert!(job.validate().is_err());
        
        job.config.batch_size = 100;
        job.progress.percentage = 150.0;
        assert!(job.validate().is_err());
    }

    #[test]
    fn test_job_duration() {
        let mut job = IndexJob::full_index("codebase123".to_string());
        
        assert!(job.duration().is_none());
        
        job.start();
        let duration = job.duration();
        assert!(duration.is_some());
        assert!(duration.unwrap().num_seconds() >= 0);
        
        job.complete();
        let final_duration = job.duration();
        assert!(final_duration.is_some());
    }

    #[test]
    fn test_job_factory_methods() {
        let full_job = IndexJob::full_index("codebase123".to_string());
        assert_eq!(full_job.job_type, IndexJobType::FullIndex);
        assert_eq!(full_job.priority, JobPriority::Normal);
        
        let incremental_job = IndexJob::incremental_index("codebase123".to_string());
        assert_eq!(incremental_job.job_type, IndexJobType::IncrementalIndex);
        assert_eq!(incremental_job.priority, JobPriority::High);
        
        let embedding_job = IndexJob::embedding_generation("codebase123".to_string());
        assert_eq!(embedding_job.job_type, IndexJobType::EmbeddingGeneration);
        assert_eq!(embedding_job.priority, JobPriority::Normal);
    }
}