//! Indexing service for processing and indexing code files

use crate::error::CoreError;
use crate::models::{
    codebase::{Codebase, CodebaseStatus},
    code_entity::{CodeEntity, EntityType, Visibility},
    code_relationship::{CodeRelationship, RelationshipType},
    index::{Index, IndexType, IndexStatus},
    index_job::{IndexJob, IndexJobType, IndexJobStatus, JobPriority, JobPhase},
    configuration::Configuration,
};
use crate::services::{
    Service, ServiceHealth, ConfigurationService, CodebaseService, 
    EmbeddingService, PluginService
};
use crate::traits::{Validate, Timestamped};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use tokio::fs;
use uuid::Uuid;

/// Service for indexing code files and building searchable indexes
#[derive(Debug)]
pub struct IndexingService {
    config_service: Arc<ConfigurationService>,
    codebase_service: Arc<CodebaseService>,
    embedding_service: Arc<EmbeddingService>,
    plugin_service: Arc<PluginService>,
    active_jobs: Arc<RwLock<HashMap<String, IndexJob>>>,
    indexes: Arc<RwLock<HashMap<String, Index>>>,
    metrics: Arc<RwLock<IndexingMetrics>>,
    worker_pool: Arc<RwLock<WorkerPool>>,
}

/// Indexing service metrics
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct IndexingMetrics {
    pub total_jobs_processed: u64,
    pub successful_jobs: u64,
    pub failed_jobs: u64,
    pub total_files_indexed: u64,
    pub total_entities_created: u64,
    pub total_relationships_created: u64,
    pub total_embeddings_generated: u64,
    pub average_indexing_time_ms: f64,
    pub current_active_jobs: usize,
    pub queue_size: usize,
    pub worker_utilization: f64,
}

/// Worker pool for parallel indexing
#[derive(Debug)]
pub struct WorkerPool {
    workers: Vec<IndexingWorker>,
    max_workers: usize,
    active_workers: usize,
}

/// Individual indexing worker
#[derive(Debug, Clone)]
pub struct IndexingWorker {
    pub id: String,
    pub status: WorkerStatus,
    pub current_job_id: Option<String>,
    pub files_processed: u64,
    pub last_activity: DateTime<Utc>,
}

/// Worker status
#[derive(Debug, Clone, PartialEq)]
pub enum WorkerStatus {
    Idle,
    Processing,
    Error(String),
}

/// Indexing request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexingRequest {
    pub codebase_id: String,
    pub job_type: IndexJobType,
    pub priority: JobPriority,
    pub file_paths: Option<Vec<String>>,
    pub force_reindex: bool,
    pub generate_embeddings: bool,
    pub update_existing: bool,
}

/// Indexing result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexingResult {
    pub job_id: String,
    pub codebase_id: String,
    pub status: IndexJobStatus,
    pub files_processed: usize,
    pub entities_created: usize,
    pub relationships_created: usize,
    pub embeddings_generated: usize,
    pub duration_ms: u64,
    pub errors: Vec<IndexingError>,
}

/// Indexing error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexingError {
    pub file_path: String,
    pub error_type: String,
    pub message: String,
    pub line_number: Option<usize>,
    pub recoverable: bool,
}

/// File processing context
#[derive(Debug, Clone)]
pub struct FileProcessingContext {
    pub file_path: PathBuf,
    pub codebase_id: String,
    pub language: Option<String>,
    pub content: String,
    pub size_bytes: usize,
    pub last_modified: DateTime<Utc>,
}

/// Parsed file result
#[derive(Debug, Clone)]
pub struct ParsedFileResult {
    pub entities: Vec<CodeEntity>,
    pub relationships: Vec<CodeRelationship>,
    pub metadata: FileMetadata,
    pub errors: Vec<IndexingError>,
}

/// File metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub lines_of_code: usize,
    pub complexity_score: Option<f64>,
    pub dependencies: Vec<String>,
    pub exports: Vec<String>,
    pub imports: Vec<String>,
    pub comments_ratio: f64,
}

impl IndexingService {
    /// Create a new indexing service
    pub async fn new(
        config_service: Arc<ConfigurationService>,
        codebase_service: Arc<CodebaseService>,
        embedding_service: Arc<EmbeddingService>,
        plugin_service: Arc<PluginService>,
    ) -> Result<Self, CoreError> {
        let config = config_service.get_current_config().await?;
        let max_workers = config.indexing.parallel_workers;
        
        let worker_pool = WorkerPool::new(max_workers);
        
        Ok(Self {
            config_service,
            codebase_service,
            embedding_service,
            plugin_service,
            active_jobs: Arc::new(RwLock::new(HashMap::new())),
            indexes: Arc::new(RwLock::new(HashMap::new())),
            metrics: Arc::new(RwLock::new(IndexingMetrics::default())),
            worker_pool: Arc::new(RwLock::new(worker_pool)),
        })
    }

    /// Queue a new indexing job
    pub async fn queue_indexing_job(
        &self,
        request: IndexingRequest,
    ) -> Result<IndexJob, CoreError> {
        // Validate request
        let codebase = self.codebase_service.get_codebase(&request.codebase_id).await?;
        
        // Create indexing job
        let mut job = IndexJob::new(
            request.codebase_id.clone(),
            request.job_type,
            request.priority,
        );
        
        // Configure job based on request
        job.config.generate_embeddings = request.generate_embeddings;
        job.config.update_existing = request.update_existing;
        
        if let Some(file_paths) = request.file_paths {
            job.config.include_patterns = file_paths;
        }
        
        job.validate()?;
        
        // Add to active jobs
        {
            let mut active_jobs = self.active_jobs.write().unwrap();
            active_jobs.insert(job.id.clone(), job.clone());
        }
        
        // Update metrics
        {
            let mut metrics = self.metrics.write().unwrap();
            metrics.queue_size += 1;
        }
        
        // Start processing if workers are available
        self.try_start_job(&job.id).await?;
        
        Ok(job)
    }

    /// Get indexing job status
    pub async fn get_job_status(&self, job_id: &str) -> Result<IndexJob, CoreError> {
        let active_jobs = self.active_jobs.read().unwrap();
        active_jobs
            .get(job_id)
            .cloned()
            .ok_or_else(|| CoreError::NotFound(format!("Job with ID '{}' not found", job_id)))
    }

    /// Cancel an indexing job
    pub async fn cancel_job(&self, job_id: &str) -> Result<(), CoreError> {
        let mut job = self.get_job_status(job_id).await?;
        
        if job.is_running() {
            job.cancel();
            
            let mut active_jobs = self.active_jobs.write().unwrap();
            active_jobs.insert(job_id.to_string(), job);
            
            // Free up worker
            self.free_worker_for_job(job_id).await;
        }
        
        Ok(())
    }

    /// Get all active jobs
    pub async fn get_active_jobs(&self) -> Vec<IndexJob> {
        let active_jobs = self.active_jobs.read().unwrap();
        active_jobs.values().cloned().collect()
    }

    /// Get indexing metrics
    pub async fn get_metrics(&self) -> IndexingMetrics {
        let mut metrics = self.metrics.read().unwrap().clone();
        
        // Update current active jobs count
        let active_jobs = self.active_jobs.read().unwrap();
        metrics.current_active_jobs = active_jobs.len();
        
        // Update worker utilization
        let worker_pool = self.worker_pool.read().unwrap();
        metrics.worker_utilization = worker_pool.utilization();
        
        metrics
    }

    /// Try to start a queued job
    async fn try_start_job(&self, job_id: &str) -> Result<(), CoreError> {
        let available_worker = {
            let mut worker_pool = self.worker_pool.write().unwrap();
            worker_pool.get_available_worker()
        };
        
        if let Some(worker_id) = available_worker {
            self.start_job_on_worker(job_id, &worker_id).await?;
        }
        
        Ok(())
    }

    /// Start a job on a specific worker
    async fn start_job_on_worker(&self, job_id: &str, worker_id: &str) -> Result<(), CoreError> {
        let mut job = self.get_job_status(job_id).await?;
        job.start();
        
        // Update job in active jobs
        {
            let mut active_jobs = self.active_jobs.write().unwrap();
            active_jobs.insert(job_id.to_string(), job.clone());
        }
        
        // Assign worker
        {
            let mut worker_pool = self.worker_pool.write().unwrap();
            worker_pool.assign_job_to_worker(worker_id, job_id)?;
        }
        
        // Start processing in background
        let service = self.clone();
        let job_id = job_id.to_string();
        let worker_id = worker_id.to_string();
        
        tokio::spawn(async move {
            if let Err(e) = service.process_job(&job_id, &worker_id).await {
                eprintln!("Job processing failed: {}", e);
                let _ = service.handle_job_error(&job_id, e).await;
            }
        });
        
        Ok(())
    }

    /// Process an indexing job
    async fn process_job(&self, job_id: &str, worker_id: &str) -> Result<(), CoreError> {
        let start_time = std::time::Instant::now();
        
        // Get job and codebase
        let mut job = self.get_job_status(job_id).await?;
        let codebase = self.codebase_service.get_codebase(&job.codebase_id).await?;
        
        // Update codebase status
        self.update_codebase_status(&job.codebase_id, CodebaseStatus::Indexing).await?;
        
        let mut result = IndexingResult {
            job_id: job_id.to_string(),
            codebase_id: job.codebase_id.clone(),
            status: IndexJobStatus::Running,
            files_processed: 0,
            entities_created: 0,
            relationships_created: 0,
            embeddings_generated: 0,
            duration_ms: 0,
            errors: Vec::new(),
        };
        
        // Process based on job type
        match job.job_type {
            IndexJobType::FullIndex => {
                self.process_full_index(&mut job, &codebase, &mut result).await?;
            }
            IndexJobType::IncrementalIndex => {
                self.process_incremental_index(&mut job, &codebase, &mut result).await?;
            }
            IndexJobType::FileReindex => {
                self.process_file_reindex(&mut job, &codebase, &mut result).await?;
            }
            IndexJobType::EmbeddingGeneration => {
                self.process_embedding_generation(&mut job, &codebase, &mut result).await?;
            }
            _ => {
                return Err(CoreError::ValidationError(
                    format!("Unsupported job type: {:?}", job.job_type),
                ));
            }
        }
        
        // Complete job
        let duration = start_time.elapsed();
        result.duration_ms = duration.as_millis() as u64;
        
        if result.errors.is_empty() {
            job.complete();
            result.status = IndexJobStatus::Completed;
            self.update_codebase_status(&job.codebase_id, CodebaseStatus::Ready).await?;
        } else {
            let error = crate::models::index_job::JobError::new(
                "INDEXING_ERRORS".to_string(),
                format!("Indexing completed with {} errors", result.errors.len()),
                true,
            );
            job.fail(error);
            result.status = IndexJobStatus::Failed;
        }
        
        // Update job
        {
            let mut active_jobs = self.active_jobs.write().unwrap();
            active_jobs.insert(job_id.to_string(), job);
        }
        
        // Update metrics
        self.update_metrics_after_job(&result).await;
        
        // Free worker
        self.free_worker_for_job(job_id).await;
        
        Ok(())
    }

    /// Process full index
    async fn process_full_index(
        &self,
        job: &mut IndexJob,
        codebase: &Codebase,
        result: &mut IndexingResult,
    ) -> Result<(), CoreError> {
        job.update_progress(0, 0, JobPhase::Scanning);
        
        // Scan for files
        let files = self.scan_codebase_files(codebase).await?;
        job.update_progress(0, files.len(), JobPhase::Parsing);
        
        // Process each file
        for (index, file_path) in files.iter().enumerate() {
            if let Err(e) = self.process_file(file_path, codebase, result).await {
                result.errors.push(IndexingError {
                    file_path: file_path.to_string_lossy().to_string(),
                    error_type: "PROCESSING_ERROR".to_string(),
                    message: e.to_string(),
                    line_number: None,
                    recoverable: true,
                });
            }
            
            job.update_progress(index + 1, files.len(), JobPhase::Parsing);
        }
        
        // Generate embeddings if requested
        if job.config.generate_embeddings {
            job.update_progress(result.files_processed, result.files_processed, JobPhase::GeneratingEmbeddings);
            self.generate_embeddings_for_entities(codebase, result).await?;
        }
        
        // Build indexes
        job.update_progress(result.files_processed, result.files_processed, JobPhase::BuildingIndexes);
        self.build_indexes(codebase, result).await?;
        
        Ok(())
    }

    /// Process incremental index
    async fn process_incremental_index(
        &self,
        job: &mut IndexJob,
        codebase: &Codebase,
        result: &mut IndexingResult,
    ) -> Result<(), CoreError> {
        // For now, implement as full index
        // In a real implementation, this would only process changed files
        self.process_full_index(job, codebase, result).await
    }

    /// Process file reindex
    async fn process_file_reindex(
        &self,
        job: &mut IndexJob,
        codebase: &Codebase,
        result: &mut IndexingResult,
    ) -> Result<(), CoreError> {
        let file_paths: Vec<PathBuf> = job.config.include_patterns
            .iter()
            .map(|p| PathBuf::from(p))
            .collect();
        
        job.update_progress(0, file_paths.len(), JobPhase::Parsing);
        
        for (index, file_path) in file_paths.iter().enumerate() {
            if let Err(e) = self.process_file(file_path, codebase, result).await {
                result.errors.push(IndexingError {
                    file_path: file_path.to_string_lossy().to_string(),
                    error_type: "PROCESSING_ERROR".to_string(),
                    message: e.to_string(),
                    line_number: None,
                    recoverable: true,
                });
            }
            
            job.update_progress(index + 1, file_paths.len(), JobPhase::Parsing);
        }
        
        Ok(())
    }

    /// Process embedding generation
    async fn process_embedding_generation(
        &self,
        job: &mut IndexJob,
        codebase: &Codebase,
        result: &mut IndexingResult,
    ) -> Result<(), CoreError> {
        job.update_progress(0, 1, JobPhase::GeneratingEmbeddings);
        self.generate_embeddings_for_entities(codebase, result).await?;
        job.update_progress(1, 1, JobPhase::GeneratingEmbeddings);
        Ok(())
    }

    /// Scan codebase for indexable files
    async fn scan_codebase_files(&self, codebase: &Codebase) -> Result<Vec<PathBuf>, CoreError> {
        let mut files = Vec::new();
        let path = PathBuf::from(&codebase.path);
        
        self.scan_directory_recursive(&path, &mut files).await?;
        
        // Filter files based on configuration
        let config = self.config_service.get_current_config().await?;
        files.retain(|file| {
            // Check file size
            if let Ok(metadata) = std::fs::metadata(file) {
                if metadata.len() > config.indexing.max_file_size_bytes as u64 {
                    return false;
                }
            }
            
            // Check if file is indexable
            crate::utils::is_indexable_file(&file.to_string_lossy())
        });
        
        Ok(files)
    }

    /// Recursively scan directory for files
    async fn scan_directory_recursive(
        &self,
        dir_path: &Path,
        files: &mut Vec<PathBuf>,
    ) -> Result<(), CoreError> {
        let mut dir = fs::read_dir(dir_path).await.map_err(|e| {
            CoreError::IoError(format!("Failed to read directory: {}", e))
        })?;
        
        while let Some(entry) = dir.next_entry().await.map_err(|e| {
            CoreError::IoError(format!("Failed to read directory entry: {}", e))
        })? {
            let path = entry.path();
            let metadata = entry.metadata().await.map_err(|e| {
                CoreError::IoError(format!("Failed to read metadata: {}", e))
            })?;
            
            if metadata.is_file() {
                files.push(path);
            } else if metadata.is_dir() {
                // Skip hidden directories and common ignore patterns
                if let Some(dir_name) = path.file_name().and_then(|s| s.to_str()) {
                    if !dir_name.starts_with('.') && 
                       dir_name != "node_modules" && 
                       dir_name != "target" &&
                       dir_name != "build" &&
                       dir_name != "dist" {
                        self.scan_directory_recursive(&path, files).await?;
                    }
                }
            }
        }
        
        Ok(())
    }

    /// Process a single file
    async fn process_file(
        &self,
        file_path: &Path,
        codebase: &Codebase,
        result: &mut IndexingResult,
    ) -> Result<(), CoreError> {
        // Read file content
        let content = fs::read_to_string(file_path).await.map_err(|e| {
            CoreError::IoError(format!("Failed to read file: {}", e))
        })?;
        
        // Get file metadata
        let metadata = fs::metadata(file_path).await.map_err(|e| {
            CoreError::IoError(format!("Failed to read file metadata: {}", e))
        })?;
        
        // Determine language
        let language = file_path
            .extension()
            .and_then(|ext| ext.to_str())
            .and_then(|ext| crate::utils::language_from_extension(ext))
            .map(|lang| lang.to_string());
        
        // Create processing context
        let context = FileProcessingContext {
            file_path: file_path.to_path_buf(),
            codebase_id: codebase.id.clone(),
            language,
            content,
            size_bytes: metadata.len() as usize,
            last_modified: metadata.modified()
                .map(|time| DateTime::<Utc>::from(time))
                .unwrap_or_else(|_| Utc::now()),
        };
        
        // Parse file
        let parsed_result = self.parse_file(&context).await?;
        
        // Update result
        result.files_processed += 1;
        result.entities_created += parsed_result.entities.len();
        result.relationships_created += parsed_result.relationships.len();
        result.errors.extend(parsed_result.errors);
        
        // Store entities and relationships
        // In a real implementation, these would be stored in a database
        
        Ok(())
    }

    /// Parse a file to extract entities and relationships
    async fn parse_file(
        &self,
        context: &FileProcessingContext,
    ) -> Result<ParsedFileResult, CoreError> {
        // This is a simplified parser - in a real implementation,
        // this would use language-specific parsers via plugins
        
        let mut entities = Vec::new();
        let mut relationships = Vec::new();
        let mut errors = Vec::new();
        
        // Basic parsing - extract function definitions
        let lines: Vec<&str> = context.content.lines().collect();
        
        for (line_num, line) in lines.iter().enumerate() {
            let line = line.trim();
            
            // Simple function detection (this would be much more sophisticated in reality)
            if let Some(language) = &context.language {
                match language.as_str() {
                    "rust" => {
                        if line.starts_with("fn ") || line.starts_with("pub fn ") {
                            if let Some(entity) = self.parse_rust_function(line, line_num + 1, context) {
                                entities.push(entity);
                            }
                        }
                    }
                    "typescript" | "javascript" => {
                        if line.starts_with("function ") || line.contains(" function ") {
                            if let Some(entity) = self.parse_js_function(line, line_num + 1, context) {
                                entities.push(entity);
                            }
                        }
                    }
                    "python" => {
                        if line.starts_with("def ") || line.starts_with("async def ") {
                            if let Some(entity) = self.parse_python_function(line, line_num + 1, context) {
                                entities.push(entity);
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
        
        // Calculate metadata
        let metadata = FileMetadata {
            lines_of_code: lines.len(),
            complexity_score: None,
            dependencies: Vec::new(),
            exports: Vec::new(),
            imports: Vec::new(),
            comments_ratio: 0.0,
        };
        
        Ok(ParsedFileResult {
            entities,
            relationships,
            metadata,
            errors,
        })
    }

    /// Parse Rust function
    fn parse_rust_function(
        &self,
        line: &str,
        line_number: usize,
        context: &FileProcessingContext,
    ) -> Option<CodeEntity> {
        // Extract function name (simplified)
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let name_part = if parts[0] == "pub" { parts[2] } else { parts[1] };
            if let Some(name) = name_part.split('(').next() {
                return Some(CodeEntity::new(
                    context.codebase_id.clone(),
                    EntityType::Function,
                    name.to_string(),
                    context.file_path.to_string_lossy().to_string(),
                    line_number,
                    context.language.clone().unwrap_or_else(|| "rust".to_string()),
                ));
            }
        }
        None
    }

    /// Parse JavaScript/TypeScript function
    fn parse_js_function(
        &self,
        line: &str,
        line_number: usize,
        context: &FileProcessingContext,
    ) -> Option<CodeEntity> {
        // Extract function name (simplified)
        if let Some(start) = line.find("function ") {
            let after_function = &line[start + 9..];
            if let Some(name) = after_function.split('(').next() {
                let name = name.trim();
                if !name.is_empty() {
                    return Some(CodeEntity::new(
                        context.codebase_id.clone(),
                        EntityType::Function,
                        name.to_string(),
                        context.file_path.to_string_lossy().to_string(),
                        line_number,
                        context.language.clone().unwrap_or_else(|| "javascript".to_string()),
                    ));
                }
            }
        }
        None
    }

    /// Parse Python function
    fn parse_python_function(
        &self,
        line: &str,
        line_number: usize,
        context: &FileProcessingContext,
    ) -> Option<CodeEntity> {
        // Extract function name (simplified)
        let start_pos = if line.starts_with("async def ") { 10 } else { 4 };
        let after_def = &line[start_pos..];
        if let Some(name) = after_def.split('(').next() {
            let name = name.trim();
            if !name.is_empty() {
                return Some(CodeEntity::new(
                    context.codebase_id.clone(),
                    EntityType::Function,
                    name.to_string(),
                    context.file_path.to_string_lossy().to_string(),
                    line_number,
                    context.language.clone().unwrap_or_else(|| "python".to_string()),
                ));
            }
        }
        None
    }

    /// Generate embeddings for entities
    async fn generate_embeddings_for_entities(
        &self,
        codebase: &Codebase,
        result: &mut IndexingResult,
    ) -> Result<(), CoreError> {
        // In a real implementation, this would generate embeddings for all entities
        // For now, just increment the counter
        result.embeddings_generated = result.entities_created;
        Ok(())
    }

    /// Build indexes
    async fn build_indexes(
        &self,
        codebase: &Codebase,
        result: &mut IndexingResult,
    ) -> Result<(), CoreError> {
        // Create or update indexes
        let index = Index::new(
            codebase.id.clone(),
            IndexType::FullText,
        );
        
        {
            let mut indexes = self.indexes.write().unwrap();
            indexes.insert(index.id.clone(), index);
        }
        
        Ok(())
    }

    /// Update codebase status
    async fn update_codebase_status(
        &self,
        codebase_id: &str,
        status: CodebaseStatus,
    ) -> Result<(), CoreError> {
        // In a real implementation, this would update the codebase status
        // For now, just return Ok
        Ok(())
    }

    /// Handle job error
    async fn handle_job_error(&self, job_id: &str, error: CoreError) -> Result<(), CoreError> {
        if let Ok(mut job) = self.get_job_status(job_id).await {
            let job_error = crate::models::index_job::JobError::new(
                "PROCESSING_ERROR".to_string(),
                error.to_string(),
                true,
            );
            job.fail(job_error);
            
            let mut active_jobs = self.active_jobs.write().unwrap();
            active_jobs.insert(job_id.to_string(), job);
        }
        
        self.free_worker_for_job(job_id).await;
        Ok(())
    }

    /// Free worker for job
    async fn free_worker_for_job(&self, job_id: &str) {
        let mut worker_pool = self.worker_pool.write().unwrap();
        worker_pool.free_worker_for_job(job_id);
    }

    /// Update metrics after job completion
    async fn update_metrics_after_job(&self, result: &IndexingResult) {
        let mut metrics = self.metrics.write().unwrap();
        
        metrics.total_jobs_processed += 1;
        
        if result.status == IndexJobStatus::Completed {
            metrics.successful_jobs += 1;
        } else {
            metrics.failed_jobs += 1;
        }
        
        metrics.total_files_indexed += result.files_processed as u64;
        metrics.total_entities_created += result.entities_created as u64;
        metrics.total_relationships_created += result.relationships_created as u64;
        metrics.total_embeddings_generated += result.embeddings_generated as u64;
        
        // Update average indexing time
        if metrics.total_jobs_processed == 1 {
            metrics.average_indexing_time_ms = result.duration_ms as f64;
        } else {
            metrics.average_indexing_time_ms = 
                (metrics.average_indexing_time_ms * (metrics.total_jobs_processed - 1) as f64 + 
                 result.duration_ms as f64) / metrics.total_jobs_processed as f64;
        }
        
        metrics.queue_size = metrics.queue_size.saturating_sub(1);
    }
}

// Clone implementation for IndexingService
impl Clone for IndexingService {
    fn clone(&self) -> Self {
        Self {
            config_service: self.config_service.clone(),
            codebase_service: self.codebase_service.clone(),
            embedding_service: self.embedding_service.clone(),
            plugin_service: self.plugin_service.clone(),
            active_jobs: self.active_jobs.clone(),
            indexes: self.indexes.clone(),
            metrics: self.metrics.clone(),
            worker_pool: self.worker_pool.clone(),
        }
    }
}

impl WorkerPool {
    fn new(max_workers: usize) -> Self {
        let mut workers = Vec::new();
        for i in 0..max_workers {
            workers.push(IndexingWorker {
                id: format!("worker-{}", i),
                status: WorkerStatus::Idle,
                current_job_id: None,
                files_processed: 0,
                last_activity: Utc::now(),
            });
        }
        
        Self {
            workers,
            max_workers,
            active_workers: 0,
        }
    }
    
    fn get_available_worker(&mut self) -> Option<String> {
        for worker in &mut self.workers {
            if worker.status == WorkerStatus::Idle {
                return Some(worker.id.clone());
            }
        }
        None
    }
    
    fn assign_job_to_worker(&mut self, worker_id: &str, job_id: &str) -> Result<(), CoreError> {
        for worker in &mut self.workers {
            if worker.id == worker_id {
                worker.status = WorkerStatus::Processing;
                worker.current_job_id = Some(job_id.to_string());
                worker.last_activity = Utc::now();
                self.active_workers += 1;
                return Ok(());
            }
        }
        Err(CoreError::NotFound(format!("Worker '{}' not found", worker_id)))
    }
    
    fn free_worker_for_job(&mut self, job_id: &str) {
        for worker in &mut self.workers {
            if worker.current_job_id.as_ref() == Some(&job_id.to_string()) {
                worker.status = WorkerStatus::Idle;
                worker.current_job_id = None;
                worker.last_activity = Utc::now();
                self.active_workers = self.active_workers.saturating_sub(1);
                break;
            }
        }
    }
    
    fn utilization(&self) -> f64 {
        if self.max_workers == 0 {
            0.0
        } else {
            self.active_workers as f64 / self.max_workers as f64
        }
    }
}

#[async_trait]
impl Service for IndexingService {
    async fn initialize(&self) -> Result<(), CoreError> {
        // Initialize worker pool
        let mut worker_pool = self.worker_pool.write().unwrap();
        for worker in &mut worker_pool.workers {
            worker.last_activity = Utc::now();
        }
        Ok(())
    }

    async fn shutdown(&self) -> Result<(), CoreError> {
        // Cancel all active jobs
        let active_jobs: Vec<String> = {
            let active_jobs = self.active_jobs.read().unwrap();
            active_jobs.keys().cloned().collect()
        };
        
        for job_id in active_jobs {
            let _ = self.cancel_job(&job_id).await;
        }
        
        Ok(())
    }

    async fn health_check(&self) -> ServiceHealth {
        let metrics = self.get_metrics().await;
        
        // Check if worker utilization is too high
        if metrics.worker_utilization > 0.9 {
            return ServiceHealth::degraded(
                "High worker utilization".to_string(),
            );
        }
        
        // Check if there are too many failed jobs
        if metrics.total_jobs_processed > 0 {
            let failure_rate = metrics.failed_jobs as f64 / metrics.total_jobs_processed as f64;
            if failure_rate > 0.1 {
                return ServiceHealth::degraded(
                    format!("High failure rate: {:.1}%", failure_rate * 100.0),
                );
            }
        }
        
        ServiceHealth::healthy()
    }

    fn name(&self) -> &'static str {
        "IndexingService"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    async fn create_test_service() -> (IndexingService, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let config_service = Arc::new(ConfigurationService::new().await.unwrap());
        let codebase_service = Arc::new(CodebaseService::new(config_service.clone()).await.unwrap());
        let embedding_service = Arc::new(EmbeddingService::new(config_service.clone()).await.unwrap());
        let plugin_service = Arc::new(PluginService::new(config_service.clone()).await.unwrap());
        
        let service = IndexingService::new(
            config_service,
            codebase_service,
            embedding_service,
            plugin_service,
        ).await.unwrap();
        
        (service, temp_dir)
    }

    #[tokio::test]
    async fn test_queue_indexing_job() {
        let (service, _temp_dir) = create_test_service().await;
        
        // This test would need a real codebase to work
        // For now, just test the service creation
        assert_eq!(service.name(), "IndexingService");
    }

    #[tokio::test]
    async fn test_worker_pool() {
        let mut pool = WorkerPool::new(2);
        
        assert_eq!(pool.max_workers, 2);
        assert_eq!(pool.active_workers, 0);
        assert_eq!(pool.utilization(), 0.0);
        
        let worker_id = pool.get_available_worker().unwrap();
        pool.assign_job_to_worker(&worker_id, "job1").unwrap();
        
        assert_eq!(pool.active_workers, 1);
        assert_eq!(pool.utilization(), 0.5);
        
        pool.free_worker_for_job("job1");
        assert_eq!(pool.active_workers, 0);
        assert_eq!(pool.utilization(), 0.0);
    }

    #[tokio::test]
    async fn test_parse_functions() {
        let (service, temp_dir) = create_test_service().await;
        
        let context = FileProcessingContext {
            file_path: temp_dir.path().join("test.rs"),
            codebase_id: "test".to_string(),
            language: Some("rust".to_string()),
            content: "fn test_function() {}".to_string(),
            size_bytes: 20,
            last_modified: Utc::now(),
        };
        
        let entity = service.parse_rust_function("fn test_function() {}", 1, &context);
        assert!(entity.is_some());
        
        let entity = entity.unwrap();
        assert_eq!(entity.name, "test_function");
        assert_eq!(entity.entity_type, EntityType::Function);
    }
}