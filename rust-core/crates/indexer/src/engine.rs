//! Core indexing engine implementation

use anyhow::Result;
use std::path::Path;
use std::collections::HashMap;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::{IndexingConfig, IndexingProgress};
use code_intelligence_core::CodeEntity;
use code_intelligence_parser::{CodeParser, Language, ParseResult};

/// Core indexing engine
pub struct Engine {
    parser: CodeParser,
    config: IndexingConfig,
    indexed_entities: RwLock<HashMap<Uuid, CodeEntity>>,
    progress: RwLock<IndexingProgress>,
    is_running: RwLock<bool>,
}

impl Engine {
    /// Create a new indexing engine
    pub fn new(config: IndexingConfig) -> Self {
        Self {
            parser: CodeParser::new(),
            config,
            indexed_entities: RwLock::new(HashMap::new()),
            progress: RwLock::new(IndexingProgress {
                total_files: 0,
                processed_files: 0,
                total_entities: 0,
                current_file: None,
                errors: Vec::new(),
                start_time: std::time::Instant::now(),
                estimated_time_remaining: None,
            }),
            is_running: RwLock::new(false),
        }
    }

    /// Process a single file and extract entities
    pub async fn process_file(&self, file_path: &Path, content: &str) -> Result<Vec<CodeEntity>> {
        let parse_result = self.parser.parse_file(file_path, content)?;

        let mut entities = Vec::new();
        for mut entity in parse_result.entities {
            // Set file path
            entity.file_path = file_path.to_string_lossy().to_string();

            // Store the entity
            let mut indexed_entities = self.indexed_entities.write().await;
            indexed_entities.insert(entity.id, entity.clone());

            entities.push(entity);
        }

        Ok(entities)
    }

    /// Get current progress
    pub fn get_progress(&self) -> &IndexingProgress {
        // This is a simplified version - in real implementation would use proper locking
        &IndexingProgress {
            total_files: 0,
            processed_files: 0,
            total_entities: 0,
            current_file: None,
            errors: Vec::new(),
            start_time: std::time::Instant::now(),
            estimated_time_remaining: None,
        }
    }

    /// Stop the indexing process
    pub async fn stop(&self) -> Result<()> {
        let mut is_running = self.is_running.write().await;
        *is_running = false;
        Ok(())
    }

    /// Clear all indexed data
    pub async fn clear(&self) -> Result<()> {
        let mut indexed_entities = self.indexed_entities.write().await;
        indexed_entities.clear();

        let mut progress = self.progress.write().await;
        *progress = IndexingProgress {
            total_files: 0,
            processed_files: 0,
            total_entities: 0,
            current_file: None,
            errors: Vec::new(),
            start_time: std::time::Instant::now(),
            estimated_time_remaining: None,
        };

        Ok(())
    }

    /// Update configuration
    pub async fn update_config(&mut self, new_config: IndexingConfig) -> Result<()> {
        self.config = new_config;
        Ok(())
    }

    /// Get all indexed entities
    pub async fn get_entities(&self) -> Vec<CodeEntity> {
        let indexed_entities = self.indexed_entities.read().await;
        indexed_entities.values().cloned().collect()
    }

    /// Search for entities by name
    pub async fn search_entities(&self, query: &str) -> Vec<CodeEntity> {
        let indexed_entities = self.indexed_entities.read().await;
        let query_lower = query.to_lowercase();

        indexed_entities
            .values()
            .filter(|entity| entity.name.to_lowercase().contains(&query_lower))
            .cloned()
            .collect()
    }

    /// Get entities by file path
    pub async fn get_entities_by_file(&self, file_path: &str) -> Vec<CodeEntity> {
        let indexed_entities = self.indexed_entities.read().await;

        indexed_entities
            .values()
            .filter(|entity| entity.file_path == file_path)
            .cloned()
            .collect()
    }

    /// Get statistics
    pub async fn get_statistics(&self) -> IndexingStatistics {
        let indexed_entities = self.indexed_entities.read().await;

        let mut by_type = HashMap::new();
        let mut by_language = HashMap::new();

        for entity in indexed_entities.values() {
            // Count by entity type
            *by_type.entry(format!("{:?}", entity.entity_type)).or_insert(0) += 1;

            // Count by language (simplified - would need to detect from file path)
            if let Some(extension) = Path::new(&entity.file_path).extension().and_then(|ext| ext.to_str()) {
                *by_language.entry(extension.to_string()).or_insert(0) += 1;
            }
        }

        IndexingStatistics {
            total_entities: indexed_entities.len(),
            by_type,
            by_language,
        }
    }
}

/// Indexing statistics
#[derive(Debug, Clone)]
pub struct IndexingStatistics {
    pub total_entities: usize,
    pub by_type: HashMap<String, usize>,
    pub by_language: HashMap<String, usize>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_engine_process_file() {
        let config = IndexingConfig::default();
        let engine = Engine::new(config);

        let temp_dir = TempDir::new().unwrap();
        let test_file = temp_dir.path().join("test.ts");
        let content = r#"
function testFunction() {
    return "hello";
}

const testVariable = "test";
"#;

        let entities = engine.process_file(&test_file, content).await.unwrap();

        // Should have extracted entities
        assert!(!entities.is_empty());

        // Should be stored in indexed entities
        let indexed_entities = engine.indexed_entities.read().await;
        assert!(indexed_entities.len() > 0);
    }

    #[tokio::test]
    async fn test_engine_search() {
        let config = IndexingConfig::default();
        let engine = Engine::new(config);

        let temp_dir = TempDir::new().unwrap();
        let test_file = temp_dir.path().join("test.ts");
        let content = r#"
function specificFunction() {
    return "hello";
}
"#;

        engine.process_file(&test_file, content).await.unwrap();

        let results = engine.search_entities("specificFunction").await;
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "specificFunction");
    }

    #[tokio::test]
    async fn test_engine_statistics() {
        let config = IndexingConfig::default();
        let engine = Engine::new(config);

        let temp_dir = TempDir::new().unwrap();
        let test_file = temp_dir.path().join("test.ts");
        let content = r#"
function testFunction() {
    return "hello";
}
"#;

        engine.process_file(&test_file, content).await.unwrap();

        let stats = engine.get_statistics().await;
        assert!(stats.total_entities > 0);
        assert!(stats.by_type.len() > 0);
    }
}