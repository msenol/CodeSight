//! High-performance indexing engine for Code Intelligence MCP Server

pub mod engine;
pub mod worker;
pub mod progress;
pub mod queue;

use anyhow::Result;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;
use code_intelligence_core::CodeEntity;

/// Main indexing engine
pub struct IndexingEngine {
    engine: Arc<RwLock<engine::Engine>>,
    config: IndexingConfig,
}

/// Indexing configuration
#[derive(Debug, Clone)]
pub struct IndexingConfig {
    pub max_workers: usize,
    pub batch_size: usize,
    pub timeout_seconds: u64,
    pub enable_parallel: bool,
    pub ignore_patterns: Vec<String>,
    pub file_extensions: Vec<String>,
}

impl Default for IndexingConfig {
    fn default() -> Self {
        Self {
            max_workers: num_cpus::get(),
            batch_size: 100,
            timeout_seconds: 300,
            enable_parallel: true,
            ignore_patterns: vec![
                "node_modules".to_string(),
                ".git".to_string(),
                "target".to_string(),
                "dist".to_string(),
                "build".to_string(),
            ],
            file_extensions: vec![
                "ts".to_string(),
                "js".to_string(),
                "tsx".to_string(),
                "jsx".to_string(),
                "py".to_string(),
                "rs".to_string(),
                "go".to_string(),
                "java".to_string(),
                "cpp".to_string(),
                "cs".to_string(),
            ],
        }
    }
}

/// Indexing progress
#[derive(Debug, Clone)]
pub struct IndexingProgress {
    pub total_files: usize,
    pub processed_files: usize,
    pub total_entities: usize,
    pub current_file: Option<String>,
    pub errors: Vec<String>,
    pub start_time: std::time::Instant,
    pub estimated_time_remaining: Option<std::time::Duration>,
}

impl IndexingEngine {
    /// Create a new indexing engine with default configuration
    pub fn new() -> Self {
        Self::with_config(IndexingConfig::default())
    }

    /// Create a new indexing engine with custom configuration
    pub fn with_config(config: IndexingConfig) -> Self {
        let engine = Arc::new(RwLock::new(engine::Engine::new(config.clone())));

        Self {
            engine,
            config,
        }
    }

    /// Index a codebase at the given path
    pub async fn index_codebase(&self, path: &Path) -> Result<IndexingProgress> {
        tracing::info!("Starting indexing for codebase: {:?}", path);

        let start_time = std::time::Instant::now();
        let mut progress = IndexingProgress {
            total_files: 0,
            processed_files: 0,
            total_entities: 0,
            current_file: None,
            errors: Vec::new(),
            start_time,
            estimated_time_remaining: None,
        };

        // Scan for files
        let files = self.scan_files(path).await?;
        progress.total_files = files.len();

        // Process files
        if self.config.enable_parallel && files.len() > 10 {
            self.process_files_parallel(files, &mut progress).await?;
        } else {
            self.process_files_sequential(files, &mut progress).await?;
        }

        tracing::info!("Indexing completed in {:?}", start_time.elapsed());
        Ok(progress)
    }

    /// Scan directory for files to index
    async fn scan_files(&self, path: &Path) -> Result<Vec<std::path::PathBuf>> {
        use walkdir::WalkDir;

        let mut files = Vec::new();

        for entry in WalkDir::new(path)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();

            if !path.is_file() {
                continue;
            }

            // Check ignore patterns
            let path_str = path.to_string_lossy();
            if self.config.ignore_patterns.iter().any(|pattern| path_str.contains(pattern)) {
                continue;
            }

            // Check file extension
            if let Some(extension) = path.extension().and_then(|ext| ext.to_str()) {
                if !self.config.file_extensions.contains(&extension.to_lowercase()) {
                    continue;
                }
            } else {
                continue;
            }

            files.push(path.to_path_buf());
        }

        Ok(files)
    }

    /// Process files sequentially
    async fn process_files_sequential(&self, files: Vec<std::path::PathBuf>, progress: &mut IndexingProgress) -> Result<()> {
        for file in files {
            progress.current_file = Some(file.to_string_lossy().to_string());

            match self.process_single_file(&file).await {
                Ok(entities) => {
                    progress.total_entities += entities.len();
                }
                Err(e) => {
                    progress.errors.push(format!("Failed to process {}: {}", file.display(), e));
                }
            }

            progress.processed_files += 1;
            self.update_estimated_time(progress);
        }

        Ok(())
    }

    /// Process files in parallel
    async fn process_files_parallel(&self, files: Vec<std::path::PathBuf>, progress: &mut IndexingProgress) -> Result<()> {
        use futures::stream::{self, StreamExt};

        let batch_size = self.config.batch_size;
        let engine = Arc::clone(&self.engine);

        let mut stream = stream::iter(files.chunks(batch_size))
            .map(move |batch| {
                let engine = Arc::clone(&engine);
                async move {
                    let mut results = Vec::new();
                    for file in batch {
                        let content = match tokio::fs::read_to_string(&file).await {
                            Ok(content) => content,
                            Err(e) => {
                                results.push((file.clone(), Err(anyhow::anyhow!("Failed to read file {}: {}", file.display(), e))));
                                continue;
                            }
                        };

                        let engine_instance = engine.write().await;
                        match engine_instance.process_file(&file, &content).await {
                            Ok(entities) => {
                                results.push((file.clone(), Ok(entities)));
                            }
                            Err(e) => {
                                results.push((file.clone(), Err(e)));
                            }
                        }
                    }
                    results
                }
            })
            .buffer_unordered(self.config.max_workers);

        while let Some(batch_results) = stream.next().await {
            for (file, result) in batch_results {
                progress.current_file = Some(file.to_string_lossy().to_string());

                match result {
                    Ok(entities) => {
                        progress.total_entities += entities.len();
                    }
                    Err(e) => {
                        progress.errors.push(format!("Failed to process {}: {}", file.display(), e));
                    }
                }

                progress.processed_files += 1;
                self.update_estimated_time(progress);
            }
        }

        Ok(())
    }

    /// Process a single file
    async fn process_single_file(&self, file_path: &Path) -> Result<Vec<CodeEntity>> {
        let content = tokio::fs::read_to_string(file_path).await
            .map_err(|e| anyhow::anyhow!("Failed to read file {}: {}", file_path.display(), e))?;

        let engine = self.engine.write().await;
        engine.process_file(file_path, &content).await
    }

    /// Update estimated time remaining
    fn update_estimated_time(&self, progress: &mut IndexingProgress) {
        if progress.processed_files > 0 {
            let elapsed = progress.start_time.elapsed();
            let avg_time_per_file = elapsed / progress.processed_files as u32;
            let remaining_files = progress.total_files.saturating_sub(progress.processed_files);
            progress.estimated_time_remaining = Some(avg_time_per_file * remaining_files as u32);
        }
    }

    /// Get current indexing progress
    pub async fn get_progress(&self) -> Result<IndexingProgress> {
        let engine = self.engine.read().await;
        Ok(engine.get_progress().await)
    }

    /// Stop indexing process
    pub async fn stop(&self) -> Result<()> {
        let engine = self.engine.write().await;
        engine.stop().await
    }

    /// Clear all indexed data
    pub async fn clear(&self) -> Result<()> {
        let engine = self.engine.write().await;
        engine.clear().await
    }

    /// Get configuration
    pub fn config(&self) -> &IndexingConfig {
        &self.config
    }

    /// Update configuration
    pub async fn update_config(&mut self, new_config: IndexingConfig) -> Result<()> {
        self.config = new_config;
        let mut engine = self.engine.write().await;
        engine.update_config(self.config.clone()).await
    }
}

impl Default for IndexingEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_indexing_engine() {
        let temp_dir = TempDir::new().unwrap();
        let test_file = temp_dir.path().join("test.ts");
        tokio::fs::write(&test_file, "function test() { return 'hello'; }").await.unwrap();

        let engine = IndexingEngine::new();
        let progress = engine.index_codebase(temp_dir.path()).await.unwrap();

        assert!(progress.processed_files > 0);
        assert!(progress.total_files > 0);
    }

    #[tokio::test]
    async fn test_indexing_config() {
        let config = IndexingConfig::default();
        assert!(config.max_workers > 0);
        assert!(config.batch_size > 0);
        assert!(!config.ignore_patterns.is_empty());
        assert!(!config.file_extensions.is_empty());
    }

    #[tokio::test]
    async fn test_parallel_indexing() {
        let temp_dir = TempDir::new().unwrap();

        // Create test files
        for i in 0..20 {
            let test_file = temp_dir.path().join(format!("test_{}.ts", i));
            tokio::fs::write(&test_file, format!("function test_{}() {{ return 'hello'; }}", i)).await.unwrap();
        }

        let mut config = IndexingConfig::default();
        config.enable_parallel = true;
        config.max_workers = 4;

        let engine = IndexingEngine::with_config(config);
        let progress = engine.index_codebase(temp_dir.path()).await.unwrap();

        assert_eq!(progress.processed_files, 20);
        assert!(progress.total_entities > 0);
    }
}