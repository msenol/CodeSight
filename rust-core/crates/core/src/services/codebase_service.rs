//! Codebase service for managing code repositories

use crate::error::CoreError;
use crate::models::{
    codebase::{Codebase, CodebaseStatus, LanguageStats},
    configuration::Configuration,
};
use crate::services::{Service, ServiceHealth, ConfigurationService};
use crate::traits::{Validate, Timestamped};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use tokio::fs;
use uuid::Uuid;

/// Service for managing codebases
#[derive(Debug)]
pub struct CodebaseService {
    config_service: Arc<ConfigurationService>,
    codebases: Arc<RwLock<HashMap<String, Codebase>>>,
    storage_path: PathBuf,
    metrics: Arc<RwLock<CodebaseMetrics>>,
}

/// Codebase service metrics
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct CodebaseMetrics {
    pub total_codebases: usize,
    pub active_codebases: usize,
    pub total_files: usize,
    pub total_size_bytes: u64,
    pub indexing_operations: u64,
    pub scan_operations: u64,
    pub last_scan_duration_ms: Option<u64>,
    pub average_scan_duration_ms: f64,
    pub errors_count: u64,
}

/// Codebase creation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCodebaseRequest {
    pub name: String,
    pub path: PathBuf,
    pub description: Option<String>,
    pub configuration_id: Option<String>,
    pub auto_index: bool,
}

/// Codebase update request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCodebaseRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub configuration_id: Option<String>,
    pub status: Option<CodebaseStatus>,
}

/// Codebase scan result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodebaseScanResult {
    pub codebase_id: String,
    pub files_found: usize,
    pub total_size_bytes: u64,
    pub language_stats: LanguageStats,
    pub scan_duration_ms: u64,
    pub errors: Vec<ScanError>,
}

/// Scan error information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanError {
    pub file_path: String,
    pub error_type: String,
    pub message: String,
    pub line_number: Option<usize>,
}

/// Codebase search filters
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CodebaseFilters {
    pub status: Option<CodebaseStatus>,
    pub language: Option<String>,
    pub min_size_bytes: Option<u64>,
    pub max_size_bytes: Option<u64>,
    pub created_after: Option<DateTime<Utc>>,
    pub created_before: Option<DateTime<Utc>>,
    pub name_pattern: Option<String>,
}

/// Codebase list options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListCodebasesOptions {
    pub filters: Option<CodebaseFilters>,
    pub sort_by: Option<CodebaseSortBy>,
    pub sort_order: Option<SortOrder>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

/// Codebase sorting options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CodebaseSortBy {
    Name,
    CreatedAt,
    UpdatedAt,
    Size,
    FileCount,
    Language,
}

/// Sort order
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SortOrder {
    Ascending,
    Descending,
}

impl CodebaseService {
    /// Create a new codebase service
    pub async fn new(config_service: Arc<ConfigurationService>) -> Result<Self, CoreError> {
        let config = config_service.get_current_config().await?;
        let storage_path = PathBuf::from("./data/codebases");
        
        // Ensure storage directory exists
        if !storage_path.exists() {
            fs::create_dir_all(&storage_path).await.map_err(|e| {
                CoreError::IoError(format!("Failed to create storage directory: {}", e))
            })?;
        }

        Ok(Self {
            config_service,
            codebases: Arc::new(RwLock::new(HashMap::new())),
            storage_path,
            metrics: Arc::new(RwLock::new(CodebaseMetrics::default())),
        })
    }

    /// Create a new codebase
    pub async fn create_codebase(
        &self,
        request: CreateCodebaseRequest,
    ) -> Result<Codebase, CoreError> {
        // Validate request
        if request.name.trim().is_empty() {
            return Err(CoreError::ValidationError(
                "Codebase name cannot be empty".to_string(),
            ));
        }

        if !request.path.exists() {
            return Err(CoreError::ValidationError(
                "Codebase path does not exist".to_string(),
            ));
        }

        // Check if codebase with same name already exists
        {
            let codebases = self.codebases.read().unwrap();
            if codebases.values().any(|cb| cb.name == request.name) {
                return Err(CoreError::AlreadyExists(
                    format!("Codebase with name '{}' already exists", request.name),
                ));
            }
        }

        // Create codebase
        let mut codebase = Codebase::new(
            request.name,
            request.path.to_string_lossy().to_string(),
            request.configuration_id.unwrap_or_else(|| "default".to_string()),
        );

        if let Some(description) = request.description {
            codebase.description = Some(description);
        }

        codebase.validate()?;

        // Perform initial scan
        let scan_result = self.scan_codebase_internal(&codebase).await?;
        codebase.update_stats(
            scan_result.total_size_bytes,
            scan_result.files_found,
            scan_result.language_stats,
        );

        // Store codebase
        {
            let mut codebases = self.codebases.write().unwrap();
            codebases.insert(codebase.id.clone(), codebase.clone());
        }

        // Update metrics
        self.update_metrics().await;

        // Save to persistent storage
        self.save_codebase(&codebase).await?;

        // Auto-index if requested
        if request.auto_index {
            // Note: This would trigger indexing service
            // For now, just mark as ready for indexing
            // self.indexing_service.queue_full_index(&codebase.id).await?;
        }

        Ok(codebase)
    }

    /// Get a codebase by ID
    pub async fn get_codebase(&self, id: &str) -> Result<Codebase, CoreError> {
        let codebases = self.codebases.read().unwrap();
        codebases
            .get(id)
            .cloned()
            .ok_or_else(|| CoreError::NotFound(format!("Codebase with ID '{}' not found", id)))
    }

    /// Update a codebase
    pub async fn update_codebase(
        &self,
        id: &str,
        request: UpdateCodebaseRequest,
    ) -> Result<Codebase, CoreError> {
        let mut codebase = self.get_codebase(id).await?;

        // Apply updates
        if let Some(name) = request.name {
            // Check for name conflicts
            {
                let codebases = self.codebases.read().unwrap();
                if codebases.values().any(|cb| cb.id != id && cb.name == name) {
                    return Err(CoreError::AlreadyExists(
                        format!("Codebase with name '{}' already exists", name),
                    ));
                }
            }
            codebase.name = name;
        }

        if let Some(description) = request.description {
            codebase.description = Some(description);
        }

        if let Some(configuration_id) = request.configuration_id {
            codebase.configuration_id = configuration_id;
        }

        if let Some(status) = request.status {
            codebase.status = status;
        }

        codebase.updated_at = Utc::now();
        codebase.validate()?;

        // Update in memory
        {
            let mut codebases = self.codebases.write().unwrap();
            codebases.insert(id.to_string(), codebase.clone());
        }

        // Save to persistent storage
        self.save_codebase(&codebase).await?;

        Ok(codebase)
    }

    /// Delete a codebase
    pub async fn delete_codebase(&self, id: &str) -> Result<(), CoreError> {
        // Check if codebase exists
        let codebase = self.get_codebase(id).await?;

        // Remove from memory
        {
            let mut codebases = self.codebases.write().unwrap();
            codebases.remove(id);
        }

        // Remove from persistent storage
        let file_path = self.storage_path.join(format!("{}.json", id));
        if file_path.exists() {
            fs::remove_file(file_path).await.map_err(|e| {
                CoreError::IoError(format!("Failed to delete codebase file: {}", e))
            })?;
        }

        // Update metrics
        self.update_metrics().await;

        Ok(())
    }

    /// List codebases with optional filtering and sorting
    pub async fn list_codebases(
        &self,
        options: Option<ListCodebasesOptions>,
    ) -> Result<Vec<Codebase>, CoreError> {
        let codebases = self.codebases.read().unwrap();
        let mut results: Vec<Codebase> = codebases.values().cloned().collect();

        if let Some(opts) = options {
            // Apply filters
            if let Some(filters) = opts.filters {
                results = self.apply_filters(results, filters);
            }

            // Apply sorting
            if let Some(sort_by) = opts.sort_by {
                let sort_order = opts.sort_order.unwrap_or(SortOrder::Ascending);
                self.sort_codebases(&mut results, sort_by, sort_order);
            }

            // Apply pagination
            if let Some(offset) = opts.offset {
                if offset < results.len() {
                    results = results.into_iter().skip(offset).collect();
                } else {
                    results.clear();
                }
            }

            if let Some(limit) = opts.limit {
                results.truncate(limit);
            }
        }

        Ok(results)
    }

    /// Scan a codebase to update file statistics
    pub async fn scan_codebase(&self, id: &str) -> Result<CodebaseScanResult, CoreError> {
        let mut codebase = self.get_codebase(id).await?;
        
        let scan_result = self.scan_codebase_internal(&codebase).await?;
        
        // Update codebase with scan results
        codebase.update_stats(
            scan_result.total_size_bytes,
            scan_result.files_found,
            scan_result.language_stats.clone(),
        );

        // Update in memory and storage
        {
            let mut codebases = self.codebases.write().unwrap();
            codebases.insert(id.to_string(), codebase);
        }
        self.save_codebase(&self.get_codebase(id).await?).await?;

        // Update metrics
        {
            let mut metrics = self.metrics.write().unwrap();
            metrics.scan_operations += 1;
            metrics.last_scan_duration_ms = Some(scan_result.scan_duration_ms);
            
            // Update average scan duration
            if metrics.scan_operations == 1 {
                metrics.average_scan_duration_ms = scan_result.scan_duration_ms as f64;
            } else {
                metrics.average_scan_duration_ms = 
                    (metrics.average_scan_duration_ms * (metrics.scan_operations - 1) as f64 + 
                     scan_result.scan_duration_ms as f64) / metrics.scan_operations as f64;
            }
        }

        Ok(scan_result)
    }

    /// Get codebase statistics
    pub async fn get_codebase_stats(&self, id: &str) -> Result<CodebaseStats, CoreError> {
        let codebase = self.get_codebase(id).await?;
        
        Ok(CodebaseStats {
            id: codebase.id,
            name: codebase.name,
            file_count: codebase.file_count,
            size_bytes: codebase.size_bytes,
            language_stats: codebase.language_stats,
            status: codebase.status,
            last_indexed: codebase.last_indexed,
            created_at: codebase.created_at,
            updated_at: codebase.updated_at,
        })
    }

    /// Get service metrics
    pub async fn get_metrics(&self) -> CodebaseMetrics {
        self.metrics.read().unwrap().clone()
    }

    /// Load codebases from persistent storage
    async fn load_codebases(&self) -> Result<(), CoreError> {
        if !self.storage_path.exists() {
            return Ok(());
        }

        let mut dir = fs::read_dir(&self.storage_path).await.map_err(|e| {
            CoreError::IoError(format!("Failed to read storage directory: {}", e))
        })?;

        while let Some(entry) = dir.next_entry().await.map_err(|e| {
            CoreError::IoError(format!("Failed to read directory entry: {}", e))
        })? {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                match self.load_codebase_from_file(&path).await {
                    Ok(codebase) => {
                        let mut codebases = self.codebases.write().unwrap();
                        codebases.insert(codebase.id.clone(), codebase);
                    }
                    Err(e) => {
                        eprintln!("Failed to load codebase from {:?}: {}", path, e);
                    }
                }
            }
        }

        self.update_metrics().await;
        Ok(())
    }

    /// Load a single codebase from file
    async fn load_codebase_from_file(&self, path: &Path) -> Result<Codebase, CoreError> {
        let content = fs::read_to_string(path).await.map_err(|e| {
            CoreError::IoError(format!("Failed to read codebase file: {}", e))
        })?;

        let codebase: Codebase = serde_json::from_str(&content).map_err(|e| {
            CoreError::ParseError(format!("Failed to parse codebase JSON: {}", e))
        })?;

        codebase.validate()?;
        Ok(codebase)
    }

    /// Save a codebase to persistent storage
    async fn save_codebase(&self, codebase: &Codebase) -> Result<(), CoreError> {
        let file_path = self.storage_path.join(format!("{}.json", codebase.id));
        let content = serde_json::to_string_pretty(codebase).map_err(|e| {
            CoreError::ParseError(format!("Failed to serialize codebase: {}", e))
        })?;

        fs::write(file_path, content).await.map_err(|e| {
            CoreError::IoError(format!("Failed to write codebase file: {}", e))
        })?;

        Ok(())
    }

    /// Internal codebase scanning implementation
    async fn scan_codebase_internal(
        &self,
        codebase: &Codebase,
    ) -> Result<CodebaseScanResult, CoreError> {
        let start_time = std::time::Instant::now();
        let path = PathBuf::from(&codebase.path);
        
        if !path.exists() {
            return Err(CoreError::NotFound(
                format!("Codebase path '{}' does not exist", codebase.path),
            ));
        }

        let mut files_found = 0;
        let mut total_size_bytes = 0;
        let mut language_stats = LanguageStats::new();
        let mut errors = Vec::new();

        // Recursive directory traversal
        match self.scan_directory(&path, &mut files_found, &mut total_size_bytes, &mut language_stats, &mut errors).await {
            Ok(_) => {},
            Err(e) => {
                errors.push(ScanError {
                    file_path: path.to_string_lossy().to_string(),
                    error_type: "SCAN_ERROR".to_string(),
                    message: e.to_string(),
                    line_number: None,
                });
            }
        }

        let scan_duration_ms = start_time.elapsed().as_millis() as u64;

        Ok(CodebaseScanResult {
            codebase_id: codebase.id.clone(),
            files_found,
            total_size_bytes,
            language_stats,
            scan_duration_ms,
            errors,
        })
    }

    /// Recursively scan a directory
    async fn scan_directory(
        &self,
        dir_path: &Path,
        files_found: &mut usize,
        total_size_bytes: &mut u64,
        language_stats: &mut LanguageStats,
        errors: &mut Vec<ScanError>,
    ) -> Result<(), CoreError> {
        let mut dir = fs::read_dir(dir_path).await.map_err(|e| {
            CoreError::IoError(format!("Failed to read directory: {}", e))
        })?;

        while let Some(entry) = dir.next_entry().await.map_err(|e| {
            CoreError::IoError(format!("Failed to read directory entry: {}", e))
        })? {
            let path = entry.path();
            let metadata = match entry.metadata().await {
                Ok(metadata) => metadata,
                Err(e) => {
                    errors.push(ScanError {
                        file_path: path.to_string_lossy().to_string(),
                        error_type: "METADATA_ERROR".to_string(),
                        message: e.to_string(),
                        line_number: None,
                    });
                    continue;
                }
            };

            if metadata.is_file() {
                *files_found += 1;
                *total_size_bytes += metadata.len();

                // Determine language from file extension
                if let Some(extension) = path.extension().and_then(|s| s.to_str()) {
                    if let Some(language) = crate::utils::language_from_extension(extension) {
                        language_stats.increment(language, 1);
                    }
                }
            } else if metadata.is_dir() {
                // Skip hidden directories and common ignore patterns
                if let Some(dir_name) = path.file_name().and_then(|s| s.to_str()) {
                    if dir_name.starts_with('.') || 
                       dir_name == "node_modules" || 
                       dir_name == "target" ||
                       dir_name == "build" ||
                       dir_name == "dist" {
                        continue;
                    }
                }

                // Recursively scan subdirectory
                if let Err(e) = self.scan_directory(&path, files_found, total_size_bytes, language_stats, errors).await {
                    errors.push(ScanError {
                        file_path: path.to_string_lossy().to_string(),
                        error_type: "DIRECTORY_SCAN_ERROR".to_string(),
                        message: e.to_string(),
                        line_number: None,
                    });
                }
            }
        }

        Ok(())
    }

    /// Apply filters to codebase list
    fn apply_filters(&self, mut codebases: Vec<Codebase>, filters: CodebaseFilters) -> Vec<Codebase> {
        if let Some(status) = filters.status {
            codebases.retain(|cb| cb.status == status);
        }

        if let Some(language) = filters.language {
            codebases.retain(|cb| cb.language_stats.languages.contains_key(&language));
        }

        if let Some(min_size) = filters.min_size_bytes {
            codebases.retain(|cb| cb.size_bytes >= min_size);
        }

        if let Some(max_size) = filters.max_size_bytes {
            codebases.retain(|cb| cb.size_bytes <= max_size);
        }

        if let Some(created_after) = filters.created_after {
            codebases.retain(|cb| cb.created_at > created_after);
        }

        if let Some(created_before) = filters.created_before {
            codebases.retain(|cb| cb.created_at < created_before);
        }

        if let Some(pattern) = filters.name_pattern {
            let pattern = pattern.to_lowercase();
            codebases.retain(|cb| cb.name.to_lowercase().contains(&pattern));
        }

        codebases
    }

    /// Sort codebases
    fn sort_codebases(&self, codebases: &mut Vec<Codebase>, sort_by: CodebaseSortBy, order: SortOrder) {
        match sort_by {
            CodebaseSortBy::Name => {
                codebases.sort_by(|a, b| match order {
                    SortOrder::Ascending => a.name.cmp(&b.name),
                    SortOrder::Descending => b.name.cmp(&a.name),
                });
            }
            CodebaseSortBy::CreatedAt => {
                codebases.sort_by(|a, b| match order {
                    SortOrder::Ascending => a.created_at.cmp(&b.created_at),
                    SortOrder::Descending => b.created_at.cmp(&a.created_at),
                });
            }
            CodebaseSortBy::UpdatedAt => {
                codebases.sort_by(|a, b| match order {
                    SortOrder::Ascending => a.updated_at.cmp(&b.updated_at),
                    SortOrder::Descending => b.updated_at.cmp(&a.updated_at),
                });
            }
            CodebaseSortBy::Size => {
                codebases.sort_by(|a, b| match order {
                    SortOrder::Ascending => a.size_bytes.cmp(&b.size_bytes),
                    SortOrder::Descending => b.size_bytes.cmp(&a.size_bytes),
                });
            }
            CodebaseSortBy::FileCount => {
                codebases.sort_by(|a, b| match order {
                    SortOrder::Ascending => a.file_count.cmp(&b.file_count),
                    SortOrder::Descending => b.file_count.cmp(&a.file_count),
                });
            }
            CodebaseSortBy::Language => {
                codebases.sort_by(|a, b| {
                    let lang_a = a.primary_language().unwrap_or("unknown");
                    let lang_b = b.primary_language().unwrap_or("unknown");
                    match order {
                        SortOrder::Ascending => lang_a.cmp(lang_b),
                        SortOrder::Descending => lang_b.cmp(lang_a),
                    }
                });
            }
        }
    }

    /// Update service metrics
    async fn update_metrics(&self) {
        let codebases = self.codebases.read().unwrap();
        let mut metrics = self.metrics.write().unwrap();
        
        metrics.total_codebases = codebases.len();
        metrics.active_codebases = codebases.values()
            .filter(|cb| cb.status == CodebaseStatus::Ready || cb.status == CodebaseStatus::Indexing)
            .count();
        metrics.total_files = codebases.values().map(|cb| cb.file_count).sum();
        metrics.total_size_bytes = codebases.values().map(|cb| cb.size_bytes).sum();
    }
}

#[async_trait]
impl Service for CodebaseService {
    async fn initialize(&self) -> Result<(), CoreError> {
        self.load_codebases().await?;
        Ok(())
    }

    async fn shutdown(&self) -> Result<(), CoreError> {
        // Save all codebases before shutdown
        let codebases = self.codebases.read().unwrap();
        for codebase in codebases.values() {
            if let Err(e) = self.save_codebase(codebase).await {
                eprintln!("Failed to save codebase {}: {}", codebase.id, e);
            }
        }
        Ok(())
    }

    async fn health_check(&self) -> ServiceHealth {
        // Check if storage directory is accessible
        if !self.storage_path.exists() {
            return ServiceHealth::unhealthy(
                "Storage directory does not exist".to_string(),
            );
        }

        // Check if we can read/write to storage
        let test_file = self.storage_path.join("health_check.tmp");
        match fs::write(&test_file, "health_check").await {
            Ok(_) => {
                let _ = fs::remove_file(test_file).await;
                ServiceHealth::healthy()
            }
            Err(e) => ServiceHealth::unhealthy(
                format!("Cannot write to storage directory: {}", e),
            ),
        }
    }

    fn name(&self) -> &'static str {
        "CodebaseService"
    }
}

/// Codebase statistics summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodebaseStats {
    pub id: String,
    pub name: String,
    pub file_count: usize,
    pub size_bytes: u64,
    pub language_stats: LanguageStats,
    pub status: CodebaseStatus,
    pub last_indexed: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    async fn create_test_service() -> (CodebaseService, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let config_service = Arc::new(ConfigurationService::new().await.unwrap());
        let service = CodebaseService::new(config_service).await.unwrap();
        (service, temp_dir)
    }

    #[tokio::test]
    async fn test_create_codebase() {
        let (service, temp_dir) = create_test_service().await;
        
        let request = CreateCodebaseRequest {
            name: "test-repo".to_string(),
            path: temp_dir.path().to_path_buf(),
            description: Some("Test repository".to_string()),
            configuration_id: None,
            auto_index: false,
        };

        let codebase = service.create_codebase(request).await.unwrap();
        assert_eq!(codebase.name, "test-repo");
        assert_eq!(codebase.description, Some("Test repository".to_string()));
    }

    #[tokio::test]
    async fn test_get_codebase() {
        let (service, temp_dir) = create_test_service().await;
        
        let request = CreateCodebaseRequest {
            name: "test-repo".to_string(),
            path: temp_dir.path().to_path_buf(),
            description: None,
            configuration_id: None,
            auto_index: false,
        };

        let created = service.create_codebase(request).await.unwrap();
        let retrieved = service.get_codebase(&created.id).await.unwrap();
        
        assert_eq!(created.id, retrieved.id);
        assert_eq!(created.name, retrieved.name);
    }

    #[tokio::test]
    async fn test_list_codebases() {
        let (service, temp_dir) = create_test_service().await;
        
        // Create multiple codebases
        for i in 0..3 {
            let request = CreateCodebaseRequest {
                name: format!("test-repo-{}", i),
                path: temp_dir.path().to_path_buf(),
                description: None,
                configuration_id: None,
                auto_index: false,
            };
            service.create_codebase(request).await.unwrap();
        }

        let codebases = service.list_codebases(None).await.unwrap();
        assert_eq!(codebases.len(), 3);
    }

    #[tokio::test]
    async fn test_update_codebase() {
        let (service, temp_dir) = create_test_service().await;
        
        let request = CreateCodebaseRequest {
            name: "test-repo".to_string(),
            path: temp_dir.path().to_path_buf(),
            description: None,
            configuration_id: None,
            auto_index: false,
        };

        let codebase = service.create_codebase(request).await.unwrap();
        
        let update_request = UpdateCodebaseRequest {
            name: Some("updated-repo".to_string()),
            description: Some("Updated description".to_string()),
            configuration_id: None,
            status: None,
        };

        let updated = service.update_codebase(&codebase.id, update_request).await.unwrap();
        assert_eq!(updated.name, "updated-repo");
        assert_eq!(updated.description, Some("Updated description".to_string()));
    }

    #[tokio::test]
    async fn test_delete_codebase() {
        let (service, temp_dir) = create_test_service().await;
        
        let request = CreateCodebaseRequest {
            name: "test-repo".to_string(),
            path: temp_dir.path().to_path_buf(),
            description: None,
            configuration_id: None,
            auto_index: false,
        };

        let codebase = service.create_codebase(request).await.unwrap();
        
        service.delete_codebase(&codebase.id).await.unwrap();
        
        let result = service.get_codebase(&codebase.id).await;
        assert!(result.is_err());
    }
}