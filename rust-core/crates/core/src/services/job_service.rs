//! Job service for managing background tasks and job execution

use crate::error::CoreError;
use crate::models::{
    index_job::{
        IndexJob, IndexJobType, IndexJobStatus, JobPriority, IndexJobConfig,
        JobProgress, JobStats, JobError, JobMetadata, JobQueueEntry,
        JobExecutionContext, WorkerInfo, ResourceAllocation
    },
    configuration::Configuration,
};
use crate::services::{Service, ServiceHealth, ConfigurationService};
use crate::traits::{Validate, Timestamped};
use async_trait::async_trait;
use chrono::{DateTime, Utc, Duration};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, RwLock};
use tokio::time::{timeout, Duration as TokioDuration};
use uuid::Uuid;

/// Service for managing jobs and background tasks
#[derive(Debug)]
pub struct JobService {
    config_service: Arc<ConfigurationService>,
    jobs: Arc<RwLock<HashMap<String, IndexJob>>>,
    job_queue: Arc<RwLock<JobQueue>>,
    workers: Arc<RwLock<Vec<JobWorker>>>,
    scheduler: Arc<RwLock<JobScheduler>>,
    metrics: Arc<RwLock<JobServiceMetrics>>,
    job_history: Arc<RwLock<Vec<JobExecutionRecord>>>,
}

/// Job service metrics
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct JobServiceMetrics {
    pub total_jobs: u64,
    pub queued_jobs: u64,
    pub running_jobs: u64,
    pub completed_jobs: u64,
    pub failed_jobs: u64,
    pub cancelled_jobs: u64,
    pub total_workers: u64,
    pub active_workers: u64,
    pub idle_workers: u64,
    pub average_execution_time_ms: f64,
    pub average_queue_time_ms: f64,
    pub throughput_jobs_per_hour: f64,
    pub error_rate: f64,
    pub job_type_distribution: HashMap<String, u64>,
    pub priority_distribution: HashMap<String, u64>,
}

/// Job queue management
#[derive(Debug, Default)]
pub struct JobQueue {
    pub high_priority: VecDeque<JobQueueEntry>,
    pub normal_priority: VecDeque<JobQueueEntry>,
    pub low_priority: VecDeque<JobQueueEntry>,
    pub delayed_jobs: Vec<DelayedJob>,
    pub recurring_jobs: Vec<RecurringJob>,
}

/// Delayed job entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelayedJob {
    pub job_entry: JobQueueEntry,
    pub execute_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

/// Recurring job configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecurringJob {
    pub id: String,
    pub name: String,
    pub job_type: IndexJobType,
    pub config: IndexJobConfig,
    pub schedule: JobSchedule,
    pub enabled: bool,
    pub last_run: Option<DateTime<Utc>>,
    pub next_run: DateTime<Utc>,
    pub run_count: u64,
    pub created_at: DateTime<Utc>,
}

/// Job schedule configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobSchedule {
    pub schedule_type: ScheduleType,
    pub interval_seconds: Option<u64>,
    pub cron_expression: Option<String>,
    pub timezone: Option<String>,
    pub max_runs: Option<u64>,
    pub end_date: Option<DateTime<Utc>>,
}

/// Schedule types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ScheduleType {
    Once,
    Interval,
    Cron,
    Daily,
    Weekly,
    Monthly,
}

/// Job worker
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobWorker {
    pub id: String,
    pub name: String,
    pub status: WorkerStatus,
    pub current_job: Option<String>,
    pub supported_job_types: Vec<IndexJobType>,
    pub max_concurrent_jobs: u32,
    pub current_job_count: u32,
    pub total_jobs_processed: u64,
    pub successful_jobs: u64,
    pub failed_jobs: u64,
    pub average_processing_time_ms: f64,
    pub last_activity: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub resource_allocation: ResourceAllocation,
}

/// Worker status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WorkerStatus {
    Idle,
    Busy,
    Paused,
    Offline,
    Error,
    Maintenance,
}

/// Job scheduler
#[derive(Debug, Default)]
pub struct JobScheduler {
    pub enabled: bool,
    pub check_interval_seconds: u64,
    pub max_concurrent_jobs: u32,
    pub job_timeout_seconds: u64,
    pub retry_attempts: u32,
    pub retry_delay_seconds: u64,
}

/// Job execution record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobExecutionRecord {
    pub job_id: String,
    pub job_type: IndexJobType,
    pub status: IndexJobStatus,
    pub worker_id: String,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub duration_ms: Option<u64>,
    pub queue_time_ms: u64,
    pub memory_used_mb: Option<f64>,
    pub cpu_usage_percent: Option<f64>,
    pub error: Option<JobError>,
    pub retry_count: u32,
}

/// Job creation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateJobRequest {
    pub job_type: IndexJobType,
    pub codebase_id: String,
    pub priority: JobPriority,
    pub config: IndexJobConfig,
    pub metadata: Option<JobMetadata>,
    pub delay_seconds: Option<u64>,
    pub max_retries: Option<u32>,
    pub timeout_seconds: Option<u64>,
}

/// Job update request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateJobRequest {
    pub job_id: String,
    pub status: Option<IndexJobStatus>,
    pub priority: Option<JobPriority>,
    pub config: Option<IndexJobConfig>,
    pub metadata: Option<JobMetadata>,
}

/// Job query filters
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct JobQueryFilters {
    pub job_types: Option<Vec<IndexJobType>>,
    pub statuses: Option<Vec<IndexJobStatus>>,
    pub priorities: Option<Vec<JobPriority>>,
    pub codebase_ids: Option<Vec<String>>,
    pub worker_ids: Option<Vec<String>>,
    pub created_after: Option<DateTime<Utc>>,
    pub created_before: Option<DateTime<Utc>>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

/// Job statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatistics {
    pub total_jobs: u64,
    pub jobs_by_status: HashMap<IndexJobStatus, u64>,
    pub jobs_by_type: HashMap<IndexJobType, u64>,
    pub jobs_by_priority: HashMap<JobPriority, u64>,
    pub average_execution_time_ms: f64,
    pub average_queue_time_ms: f64,
    pub success_rate: f64,
    pub error_rate: f64,
    pub throughput_last_hour: u64,
    pub throughput_last_day: u64,
}

impl JobService {
    /// Create a new job service
    pub async fn new(config_service: Arc<ConfigurationService>) -> Result<Self, CoreError> {
        Ok(Self {
            config_service,
            jobs: Arc::new(RwLock::new(HashMap::new())),
            job_queue: Arc::new(RwLock::new(JobQueue::default())),
            workers: Arc::new(RwLock::new(Vec::new())),
            scheduler: Arc::new(RwLock::new(JobScheduler::default())),
            metrics: Arc::new(RwLock::new(JobServiceMetrics::default())),
            job_history: Arc::new(RwLock::new(Vec::new())),
        })
    }

    /// Create a new job
    pub async fn create_job(&self, request: CreateJobRequest) -> Result<String, CoreError> {
        // Validate request
        request.config.validate()?;
        
        // Create job
        let job_id = Uuid::new_v4().to_string();
        let mut job = IndexJob::new(
            job_id.clone(),
            request.codebase_id,
            request.job_type,
            request.priority,
            request.config,
        );
        
        // Set optional fields
        if let Some(metadata) = request.metadata {
            job.metadata = metadata;
        }
        
        // Store job
        {
            let mut jobs = self.jobs.write().unwrap();
            jobs.insert(job_id.clone(), job.clone());
        }
        
        // Queue job
        if let Some(delay_seconds) = request.delay_seconds {
            self.schedule_delayed_job(job, delay_seconds).await?;
        } else {
            self.queue_job(job).await?;
        }
        
        // Update metrics
        self.update_job_creation_metrics(&request.job_type, &request.priority).await;
        
        Ok(job_id)
    }

    /// Get job by ID
    pub async fn get_job(&self, job_id: &str) -> Result<IndexJob, CoreError> {
        let jobs = self.jobs.read().unwrap();
        jobs.get(job_id)
            .cloned()
            .ok_or_else(|| CoreError::NotFound(format!("Job '{}' not found", job_id)))
    }

    /// Update job
    pub async fn update_job(&self, request: UpdateJobRequest) -> Result<(), CoreError> {
        let mut jobs = self.jobs.write().unwrap();
        let job = jobs.get_mut(&request.job_id)
            .ok_or_else(|| CoreError::NotFound(format!("Job '{}' not found", request.job_id)))?;
        
        // Update fields
        if let Some(status) = request.status {
            job.status = status;
        }
        
        if let Some(priority) = request.priority {
            job.priority = priority;
        }
        
        if let Some(config) = request.config {
            config.validate()?;
            job.config = config;
        }
        
        if let Some(metadata) = request.metadata {
            job.metadata = metadata;
        }
        
        job.updated_at = Utc::now();
        
        Ok(())
    }

    /// Cancel job
    pub async fn cancel_job(&self, job_id: &str) -> Result<(), CoreError> {
        // Update job status
        {
            let mut jobs = self.jobs.write().unwrap();
            let job = jobs.get_mut(job_id)
                .ok_or_else(|| CoreError::NotFound(format!("Job '{}' not found", job_id)))?;
            
            match job.status {
                IndexJobStatus::Queued | IndexJobStatus::Running => {
                    job.status = IndexJobStatus::Cancelled;
                    job.completed_at = Some(Utc::now());
                    job.updated_at = Utc::now();
                }
                _ => {
                    return Err(CoreError::ValidationError(
                        "Job cannot be cancelled in current status".to_string()
                    ));
                }
            }
        }
        
        // Remove from queue if queued
        self.remove_from_queue(job_id).await;
        
        // Update metrics
        self.update_job_cancellation_metrics().await;
        
        Ok(())
    }

    /// Retry failed job
    pub async fn retry_job(&self, job_id: &str) -> Result<(), CoreError> {
        let job = {
            let mut jobs = self.jobs.write().unwrap();
            let job = jobs.get_mut(job_id)
                .ok_or_else(|| CoreError::NotFound(format!("Job '{}' not found", job_id)))?;
            
            if job.status != IndexJobStatus::Failed {
                return Err(CoreError::ValidationError(
                    "Only failed jobs can be retried".to_string()
                ));
            }
            
            // Reset job status
            job.status = IndexJobStatus::Queued;
            job.started_at = None;
            job.completed_at = None;
            job.error = None;
            job.updated_at = Utc::now();
            
            job.clone()
        };
        
        // Re-queue job
        self.queue_job(job).await?;
        
        Ok(())
    }

    /// List jobs with filters
    pub async fn list_jobs(&self, filters: JobQueryFilters) -> Vec<IndexJob> {
        let jobs = self.jobs.read().unwrap();
        let mut filtered_jobs: Vec<IndexJob> = jobs.values()
            .filter(|job| self.matches_filters(job, &filters))
            .cloned()
            .collect();
        
        // Sort by creation time (newest first)
        filtered_jobs.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        
        // Apply pagination
        if let Some(offset) = filters.offset {
            if offset < filtered_jobs.len() {
                filtered_jobs = filtered_jobs.into_iter().skip(offset).collect();
            } else {
                filtered_jobs.clear();
            }
        }
        
        if let Some(limit) = filters.limit {
            filtered_jobs.truncate(limit);
        }
        
        filtered_jobs
    }

    /// Get job queue status
    pub async fn get_queue_status(&self) -> JobQueueStatus {
        let queue = self.job_queue.read().unwrap();
        
        JobQueueStatus {
            high_priority_count: queue.high_priority.len(),
            normal_priority_count: queue.normal_priority.len(),
            low_priority_count: queue.low_priority.len(),
            delayed_jobs_count: queue.delayed_jobs.len(),
            recurring_jobs_count: queue.recurring_jobs.len(),
            total_queued: queue.high_priority.len() + queue.normal_priority.len() + queue.low_priority.len(),
        }
    }

    /// Add worker
    pub async fn add_worker(&self, worker: JobWorker) -> Result<(), CoreError> {
        let mut workers = self.workers.write().unwrap();
        workers.push(worker);
        
        // Update metrics
        let mut metrics = self.metrics.write().unwrap();
        metrics.total_workers += 1;
        if workers.last().unwrap().status == WorkerStatus::Idle {
            metrics.idle_workers += 1;
        }
        
        Ok(())
    }

    /// Remove worker
    pub async fn remove_worker(&self, worker_id: &str) -> Result<(), CoreError> {
        let mut workers = self.workers.write().unwrap();
        let initial_len = workers.len();
        workers.retain(|w| w.id != worker_id);
        
        if workers.len() == initial_len {
            return Err(CoreError::NotFound(format!("Worker '{}' not found", worker_id)));
        }
        
        // Update metrics
        let mut metrics = self.metrics.write().unwrap();
        if metrics.total_workers > 0 {
            metrics.total_workers -= 1;
        }
        
        Ok(())
    }

    /// Get worker status
    pub async fn get_workers(&self) -> Vec<JobWorker> {
        self.workers.read().unwrap().clone()
    }

    /// Create recurring job
    pub async fn create_recurring_job(
        &self,
        name: String,
        job_type: IndexJobType,
        config: IndexJobConfig,
        schedule: JobSchedule,
    ) -> Result<String, CoreError> {
        let recurring_job_id = Uuid::new_v4().to_string();
        
        let next_run = self.calculate_next_run(&schedule, None)?;
        
        let recurring_job = RecurringJob {
            id: recurring_job_id.clone(),
            name,
            job_type,
            config,
            schedule,
            enabled: true,
            last_run: None,
            next_run,
            run_count: 0,
            created_at: Utc::now(),
        };
        
        let mut queue = self.job_queue.write().unwrap();
        queue.recurring_jobs.push(recurring_job);
        
        Ok(recurring_job_id)
    }

    /// Get job statistics
    pub async fn get_statistics(&self) -> JobStatistics {
        let jobs = self.jobs.read().unwrap();
        let total_jobs = jobs.len() as u64;
        
        let mut jobs_by_status = HashMap::new();
        let mut jobs_by_type = HashMap::new();
        let mut jobs_by_priority = HashMap::new();
        
        let mut total_execution_time = 0u64;
        let mut total_queue_time = 0u64;
        let mut completed_jobs = 0u64;
        let mut successful_jobs = 0u64;
        
        for job in jobs.values() {
            // Count by status
            *jobs_by_status.entry(job.status.clone()).or_insert(0) += 1;
            
            // Count by type
            *jobs_by_type.entry(job.job_type.clone()).or_insert(0) += 1;
            
            // Count by priority
            *jobs_by_priority.entry(job.priority.clone()).or_insert(0) += 1;
            
            // Calculate execution times
            if let (Some(started), Some(completed)) = (job.started_at, job.completed_at) {
                let execution_time = (completed - started).num_milliseconds() as u64;
                total_execution_time += execution_time;
                completed_jobs += 1;
                
                if job.status == IndexJobStatus::Completed {
                    successful_jobs += 1;
                }
            }
            
            if let Some(started) = job.started_at {
                let queue_time = (started - job.created_at).num_milliseconds() as u64;
                total_queue_time += queue_time;
            }
        }
        
        let average_execution_time_ms = if completed_jobs > 0 {
            total_execution_time as f64 / completed_jobs as f64
        } else {
            0.0
        };
        
        let average_queue_time_ms = if total_jobs > 0 {
            total_queue_time as f64 / total_jobs as f64
        } else {
            0.0
        };
        
        let success_rate = if completed_jobs > 0 {
            successful_jobs as f64 / completed_jobs as f64
        } else {
            0.0
        };
        
        let error_rate = 1.0 - success_rate;
        
        // Calculate throughput (simplified)
        let now = Utc::now();
        let one_hour_ago = now - Duration::hours(1);
        let one_day_ago = now - Duration::days(1);
        
        let throughput_last_hour = jobs.values()
            .filter(|job| job.created_at > one_hour_ago)
            .count() as u64;
        
        let throughput_last_day = jobs.values()
            .filter(|job| job.created_at > one_day_ago)
            .count() as u64;
        
        JobStatistics {
            total_jobs,
            jobs_by_status,
            jobs_by_type,
            jobs_by_priority,
            average_execution_time_ms,
            average_queue_time_ms,
            success_rate,
            error_rate,
            throughput_last_hour,
            throughput_last_day,
        }
    }

    /// Get service metrics
    pub async fn get_metrics(&self) -> JobServiceMetrics {
        let mut metrics = self.metrics.read().unwrap().clone();
        
        // Update real-time metrics
        let jobs = self.jobs.read().unwrap();
        metrics.total_jobs = jobs.len() as u64;
        metrics.queued_jobs = jobs.values().filter(|j| j.status == IndexJobStatus::Queued).count() as u64;
        metrics.running_jobs = jobs.values().filter(|j| j.status == IndexJobStatus::Running).count() as u64;
        metrics.completed_jobs = jobs.values().filter(|j| j.status == IndexJobStatus::Completed).count() as u64;
        metrics.failed_jobs = jobs.values().filter(|j| j.status == IndexJobStatus::Failed).count() as u64;
        metrics.cancelled_jobs = jobs.values().filter(|j| j.status == IndexJobStatus::Cancelled).count() as u64;
        
        let workers = self.workers.read().unwrap();
        metrics.total_workers = workers.len() as u64;
        metrics.active_workers = workers.iter().filter(|w| w.status == WorkerStatus::Busy).count() as u64;
        metrics.idle_workers = workers.iter().filter(|w| w.status == WorkerStatus::Idle).count() as u64;
        
        metrics
    }

    /// Process job queue (internal method for scheduler)
    pub async fn process_queue(&self) -> Result<(), CoreError> {
        let mut queue = self.job_queue.write().unwrap();
        let mut workers = self.workers.write().unwrap();
        
        // Find available workers
        let available_workers: Vec<&mut JobWorker> = workers.iter_mut()
            .filter(|w| w.status == WorkerStatus::Idle && w.current_job_count < w.max_concurrent_jobs)
            .collect();
        
        if available_workers.is_empty() {
            return Ok(());
        }
        
        // Process high priority jobs first
        for worker in available_workers {
            if let Some(job_entry) = queue.high_priority.pop_front() {
                self.assign_job_to_worker(worker, job_entry).await?;
            } else if let Some(job_entry) = queue.normal_priority.pop_front() {
                self.assign_job_to_worker(worker, job_entry).await?;
            } else if let Some(job_entry) = queue.low_priority.pop_front() {
                self.assign_job_to_worker(worker, job_entry).await?;
            }
        }
        
        Ok(())
    }

    /// Queue job for execution
    async fn queue_job(&self, job: IndexJob) -> Result<(), CoreError> {
        let job_entry = JobQueueEntry {
            job_id: job.id.clone(),
            codebase_id: job.codebase_id.clone(),
            job_type: job.job_type.clone(),
            priority: job.priority.clone(),
            config: job.config.clone(),
            context: JobExecutionContext {
                job_id: job.id.clone(),
                codebase_id: job.codebase_id.clone(),
                user_id: None,
                session_id: None,
                environment: HashMap::new(),
            },
            queued_at: Utc::now(),
        };
        
        let mut queue = self.job_queue.write().unwrap();
        
        match job.priority {
            JobPriority::High => queue.high_priority.push_back(job_entry),
            JobPriority::Normal => queue.normal_priority.push_back(job_entry),
            JobPriority::Low => queue.low_priority.push_back(job_entry),
        }
        
        Ok(())
    }

    /// Schedule delayed job
    async fn schedule_delayed_job(&self, job: IndexJob, delay_seconds: u64) -> Result<(), CoreError> {
        let execute_at = Utc::now() + Duration::seconds(delay_seconds as i64);
        
        let job_entry = JobQueueEntry {
            job_id: job.id.clone(),
            codebase_id: job.codebase_id.clone(),
            job_type: job.job_type.clone(),
            priority: job.priority.clone(),
            config: job.config.clone(),
            context: JobExecutionContext {
                job_id: job.id.clone(),
                codebase_id: job.codebase_id.clone(),
                user_id: None,
                session_id: None,
                environment: HashMap::new(),
            },
            queued_at: Utc::now(),
        };
        
        let delayed_job = DelayedJob {
            job_entry,
            execute_at,
            created_at: Utc::now(),
        };
        
        let mut queue = self.job_queue.write().unwrap();
        queue.delayed_jobs.push(delayed_job);
        
        Ok(())
    }

    /// Remove job from queue
    async fn remove_from_queue(&self, job_id: &str) {
        let mut queue = self.job_queue.write().unwrap();
        
        queue.high_priority.retain(|entry| entry.job_id != job_id);
        queue.normal_priority.retain(|entry| entry.job_id != job_id);
        queue.low_priority.retain(|entry| entry.job_id != job_id);
        queue.delayed_jobs.retain(|delayed| delayed.job_entry.job_id != job_id);
    }

    /// Assign job to worker
    async fn assign_job_to_worker(
        &self,
        worker: &mut JobWorker,
        job_entry: JobQueueEntry,
    ) -> Result<(), CoreError> {
        // Update worker status
        worker.status = WorkerStatus::Busy;
        worker.current_job = Some(job_entry.job_id.clone());
        worker.current_job_count += 1;
        worker.last_activity = Utc::now();
        
        // Update job status
        {
            let mut jobs = self.jobs.write().unwrap();
            if let Some(job) = jobs.get_mut(&job_entry.job_id) {
                job.status = IndexJobStatus::Running;
                job.started_at = Some(Utc::now());
                job.updated_at = Utc::now();
            }
        }
        
        // In a real implementation, this would start the actual job execution
        // For now, we'll simulate job completion
        tokio::spawn({
            let job_id = job_entry.job_id.clone();
            let worker_id = worker.id.clone();
            let jobs = Arc::clone(&self.jobs);
            let workers = Arc::clone(&self.workers);
            
            async move {
                // Simulate job execution
                tokio::time::sleep(TokioDuration::from_secs(1)).await;
                
                // Complete job
                {
                    let mut jobs = jobs.write().unwrap();
                    if let Some(job) = jobs.get_mut(&job_id) {
                        job.status = IndexJobStatus::Completed;
                        job.completed_at = Some(Utc::now());
                        job.updated_at = Utc::now();
                    }
                }
                
                // Free worker
                {
                    let mut workers = workers.write().unwrap();
                    if let Some(worker) = workers.iter_mut().find(|w| w.id == worker_id) {
                        worker.status = WorkerStatus::Idle;
                        worker.current_job = None;
                        if worker.current_job_count > 0 {
                            worker.current_job_count -= 1;
                        }
                        worker.total_jobs_processed += 1;
                        worker.successful_jobs += 1;
                    }
                }
            }
        });
        
        Ok(())
    }

    /// Check if job matches filters
    fn matches_filters(&self, job: &IndexJob, filters: &JobQueryFilters) -> bool {
        if let Some(ref job_types) = filters.job_types {
            if !job_types.contains(&job.job_type) {
                return false;
            }
        }
        
        if let Some(ref statuses) = filters.statuses {
            if !statuses.contains(&job.status) {
                return false;
            }
        }
        
        if let Some(ref priorities) = filters.priorities {
            if !priorities.contains(&job.priority) {
                return false;
            }
        }
        
        if let Some(ref codebase_ids) = filters.codebase_ids {
            if !codebase_ids.contains(&job.codebase_id) {
                return false;
            }
        }
        
        if let Some(created_after) = filters.created_after {
            if job.created_at <= created_after {
                return false;
            }
        }
        
        if let Some(created_before) = filters.created_before {
            if job.created_at >= created_before {
                return false;
            }
        }
        
        true
    }

    /// Calculate next run time for recurring job
    fn calculate_next_run(
        &self,
        schedule: &JobSchedule,
        last_run: Option<DateTime<Utc>>,
    ) -> Result<DateTime<Utc>, CoreError> {
        let base_time = last_run.unwrap_or_else(Utc::now);
        
        match schedule.schedule_type {
            ScheduleType::Once => Ok(base_time),
            ScheduleType::Interval => {
                if let Some(interval) = schedule.interval_seconds {
                    Ok(base_time + Duration::seconds(interval as i64))
                } else {
                    Err(CoreError::ValidationError("Interval not specified".to_string()))
                }
            }
            ScheduleType::Daily => Ok(base_time + Duration::days(1)),
            ScheduleType::Weekly => Ok(base_time + Duration::weeks(1)),
            ScheduleType::Monthly => Ok(base_time + Duration::days(30)), // Simplified
            ScheduleType::Cron => {
                // In a real implementation, this would parse cron expressions
                Ok(base_time + Duration::hours(1))
            }
        }
    }

    /// Update job creation metrics
    async fn update_job_creation_metrics(&self, job_type: &IndexJobType, priority: &JobPriority) {
        let mut metrics = self.metrics.write().unwrap();
        
        let type_name = format!("{:?}", job_type);
        *metrics.job_type_distribution.entry(type_name).or_insert(0) += 1;
        
        let priority_name = format!("{:?}", priority);
        *metrics.priority_distribution.entry(priority_name).or_insert(0) += 1;
    }

    /// Update job cancellation metrics
    async fn update_job_cancellation_metrics(&self) {
        let mut metrics = self.metrics.write().unwrap();
        metrics.cancelled_jobs += 1;
    }
}

/// Job queue status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobQueueStatus {
    pub high_priority_count: usize,
    pub normal_priority_count: usize,
    pub low_priority_count: usize,
    pub delayed_jobs_count: usize,
    pub recurring_jobs_count: usize,
    pub total_queued: usize,
}

#[async_trait]
impl Service for JobService {
    async fn initialize(&self) -> Result<(), CoreError> {
        // Initialize default workers
        let default_workers = vec![
            JobWorker {
                id: "worker_1".to_string(),
                name: "Default Worker 1".to_string(),
                status: WorkerStatus::Idle,
                current_job: None,
                supported_job_types: vec![
                    IndexJobType::FullIndex,
                    IndexJobType::IncrementalIndex,
                    IndexJobType::FileReindex,
                ],
                max_concurrent_jobs: 1,
                current_job_count: 0,
                total_jobs_processed: 0,
                successful_jobs: 0,
                failed_jobs: 0,
                average_processing_time_ms: 0.0,
                last_activity: Utc::now(),
                created_at: Utc::now(),
                resource_allocation: ResourceAllocation {
                    max_memory_mb: 512,
                    max_cpu_percent: 50,
                    max_disk_io_mb_per_sec: 100,
                    max_network_io_mb_per_sec: 50,
                },
            },
            JobWorker {
                id: "worker_2".to_string(),
                name: "Default Worker 2".to_string(),
                status: WorkerStatus::Idle,
                current_job: None,
                supported_job_types: vec![
                    IndexJobType::EmbeddingGeneration,
                    IndexJobType::FileReindex,
                ],
                max_concurrent_jobs: 2,
                current_job_count: 0,
                total_jobs_processed: 0,
                successful_jobs: 0,
                failed_jobs: 0,
                average_processing_time_ms: 0.0,
                last_activity: Utc::now(),
                created_at: Utc::now(),
                resource_allocation: ResourceAllocation {
                    max_memory_mb: 1024,
                    max_cpu_percent: 75,
                    max_disk_io_mb_per_sec: 200,
                    max_network_io_mb_per_sec: 100,
                },
            },
        ];
        
        for worker in default_workers {
            self.add_worker(worker).await?;
        }
        
        // Initialize scheduler
        {
            let mut scheduler = self.scheduler.write().unwrap();
            scheduler.enabled = true;
            scheduler.check_interval_seconds = 5;
            scheduler.max_concurrent_jobs = 10;
            scheduler.job_timeout_seconds = 3600;
            scheduler.retry_attempts = 3;
            scheduler.retry_delay_seconds = 60;
        }
        
        Ok(())
    }

    async fn shutdown(&self) -> Result<(), CoreError> {
        // Cancel all running jobs
        let job_ids: Vec<String> = {
            let jobs = self.jobs.read().unwrap();
            jobs.values()
                .filter(|job| job.status == IndexJobStatus::Running || job.status == IndexJobStatus::Queued)
                .map(|job| job.id.clone())
                .collect()
        };
        
        for job_id in job_ids {
            if let Err(e) = self.cancel_job(&job_id).await {
                eprintln!("Failed to cancel job {}: {}", job_id, e);
            }
        }
        
        // Set all workers offline
        {
            let mut workers = self.workers.write().unwrap();
            for worker in workers.iter_mut() {
                worker.status = WorkerStatus::Offline;
            }
        }
        
        Ok(())
    }

    async fn health_check(&self) -> ServiceHealth {
        let workers = self.workers.read().unwrap();
        let jobs = self.jobs.read().unwrap();
        
        // Check if we have active workers
        let active_workers = workers.iter()
            .filter(|w| w.status != WorkerStatus::Offline && w.status != WorkerStatus::Error)
            .count();
        
        if active_workers == 0 {
            return ServiceHealth::unhealthy(
                "No active job workers".to_string(),
            );
        }
        
        // Check for stuck jobs
        let stuck_jobs = jobs.values()
            .filter(|job| {
                job.status == IndexJobStatus::Running &&
                job.started_at.map_or(false, |started| {
                    (Utc::now() - started).num_hours() > 1
                })
            })
            .count();
        
        if stuck_jobs > 0 {
            return ServiceHealth::degraded(
                format!("{} jobs appear to be stuck", stuck_jobs),
            );
        }
        
        ServiceHealth::healthy()
    }

    fn name(&self) -> &'static str {
        "JobService"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn create_test_service() -> JobService {
        let config_service = Arc::new(ConfigurationService::new().await.unwrap());
        JobService::new(config_service).await.unwrap()
    }

    #[tokio::test]
    async fn test_job_service_creation() {
        let service = create_test_service().await;
        assert_eq!(service.name(), "JobService");
    }

    #[tokio::test]
    async fn test_job_creation() {
        let service = create_test_service().await;
        
        let request = CreateJobRequest {
            job_type: IndexJobType::FullIndex,
            codebase_id: "test_codebase".to_string(),
            priority: JobPriority::Normal,
            config: IndexJobConfig::default(),
            metadata: None,
            delay_seconds: None,
            max_retries: None,
            timeout_seconds: None,
        };
        
        let job_id = service.create_job(request).await.unwrap();
        assert!(!job_id.is_empty());
        
        // Verify job exists
        let job = service.get_job(&job_id).await.unwrap();
        assert_eq!(job.job_type, IndexJobType::FullIndex);
        assert_eq!(job.status, IndexJobStatus::Queued);
    }

    #[tokio::test]
    async fn test_job_cancellation() {
        let service = create_test_service().await;
        
        let request = CreateJobRequest {
            job_type: IndexJobType::FullIndex,
            codebase_id: "test_codebase".to_string(),
            priority: JobPriority::Normal,
            config: IndexJobConfig::default(),
            metadata: None,
            delay_seconds: None,
            max_retries: None,
            timeout_seconds: None,
        };
        
        let job_id = service.create_job(request).await.unwrap();
        
        // Cancel job
        let result = service.cancel_job(&job_id).await;
        assert!(result.is_ok());
        
        // Verify job is cancelled
        let job = service.get_job(&job_id).await.unwrap();
        assert_eq!(job.status, IndexJobStatus::Cancelled);
    }

    #[tokio::test]
    async fn test_job_listing() {
        let service = create_test_service().await;
        
        // Create multiple jobs
        for i in 0..3 {
            let request = CreateJobRequest {
                job_type: IndexJobType::FullIndex,
                codebase_id: format!("codebase_{}", i),
                priority: JobPriority::Normal,
                config: IndexJobConfig::default(),
                metadata: None,
                delay_seconds: None,
                max_retries: None,
                timeout_seconds: None,
            };
            service.create_job(request).await.unwrap();
        }
        
        // List all jobs
        let jobs = service.list_jobs(JobQueryFilters::default()).await;
        assert_eq!(jobs.len(), 3);
        
        // List with filters
        let filters = JobQueryFilters {
            job_types: Some(vec![IndexJobType::FullIndex]),
            limit: Some(2),
            ..Default::default()
        };
        
        let filtered_jobs = service.list_jobs(filters).await;
        assert_eq!(filtered_jobs.len(), 2);
    }

    #[tokio::test]
    async fn test_worker_management() {
        let service = create_test_service().await;
        
        let worker = JobWorker {
            id: "test_worker".to_string(),
            name: "Test Worker".to_string(),
            status: WorkerStatus::Idle,
            current_job: None,
            supported_job_types: vec![IndexJobType::FullIndex],
            max_concurrent_jobs: 1,
            current_job_count: 0,
            total_jobs_processed: 0,
            successful_jobs: 0,
            failed_jobs: 0,
            average_processing_time_ms: 0.0,
            last_activity: Utc::now(),
            created_at: Utc::now(),
            resource_allocation: ResourceAllocation {
                max_memory_mb: 256,
                max_cpu_percent: 25,
                max_disk_io_mb_per_sec: 50,
                max_network_io_mb_per_sec: 25,
            },
        };
        
        // Add worker
        let result = service.add_worker(worker).await;
        assert!(result.is_ok());
        
        // Get workers
        let workers = service.get_workers().await;
        assert!(workers.iter().any(|w| w.id == "test_worker"));
        
        // Remove worker
        let result = service.remove_worker("test_worker").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_job_statistics() {
        let service = create_test_service().await;
        
        // Create some jobs
        for _ in 0..5 {
            let request = CreateJobRequest {
                job_type: IndexJobType::FullIndex,
                codebase_id: "test_codebase".to_string(),
                priority: JobPriority::Normal,
                config: IndexJobConfig::default(),
                metadata: None,
                delay_seconds: None,
                max_retries: None,
                timeout_seconds: None,
            };
            service.create_job(request).await.unwrap();
        }
        
        let stats = service.get_statistics().await;
        assert_eq!(stats.total_jobs, 5);
        assert!(stats.jobs_by_type.contains_key(&IndexJobType::FullIndex));
    }

    #[tokio::test]
    async fn test_recurring_job() {
        let service = create_test_service().await;
        
        let schedule = JobSchedule {
            schedule_type: ScheduleType::Interval,
            interval_seconds: Some(3600), // 1 hour
            cron_expression: None,
            timezone: None,
            max_runs: None,
            end_date: None,
        };
        
        let result = service.create_recurring_job(
            "Test Recurring Job".to_string(),
            IndexJobType::IncrementalIndex,
            IndexJobConfig::default(),
            schedule,
        ).await;
        
        assert!(result.is_ok());
    }
}