//! Core indexing engine implementation

use anyhow::Result;
use std::path::Path;
use std::collections::HashMap;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::{IndexingConfig, IndexingProgress};
use code_intelligence_core::{CodeEntity, EntityType as CoreEntityType};
use code_intelligence_parser::{CodeParser, CodeEntity as ParserCodeEntity};

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
        for parser_entity in parse_result.entities {
            // Convert parser entity to core entity
            let core_entity = self.convert_parser_to_core_entity(parser_entity, file_path);

            // Store the entity
            let mut indexed_entities = self.indexed_entities.write().await;
            indexed_entities.insert(core_entity.id, core_entity.clone());

            entities.push(core_entity);
        }

        Ok(entities)
    }

    /// Convert parser entity type to core entity type
    fn convert_entity_type(&self, parser_type: code_intelligence_parser::EntityType) -> CoreEntityType {
        match parser_type {
            code_intelligence_parser::EntityType::Function => CoreEntityType::Function,
            code_intelligence_parser::EntityType::Class => CoreEntityType::Class,
            code_intelligence_parser::EntityType::Interface => CoreEntityType::Interface,
            code_intelligence_parser::EntityType::Variable => CoreEntityType::Variable,
            code_intelligence_parser::EntityType::Constant => CoreEntityType::Constant,
            code_intelligence_parser::EntityType::Module => CoreEntityType::Module,
            code_intelligence_parser::EntityType::Import => CoreEntityType::Import,
            code_intelligence_parser::EntityType::Export => CoreEntityType::Import, // Map Export to Import
        }
    }

    /// Convert parser entity to core entity
    fn convert_parser_to_core_entity(&self, parser_entity: ParserCodeEntity, file_path: &Path) -> CodeEntity {
        // Convert parser entity to core entity using the simpler structure
        CodeEntity {
            id: Uuid::new_v4(),
            name: parser_entity.name,
            entity_type: self.convert_entity_type(parser_entity.entity_type),
            file_path: file_path.to_string_lossy().to_string(),
            start_line: parser_entity.start_line,
            end_line: parser_entity.end_line,
            content: parser_entity.content,
            metadata: {
                let mut metadata = std::collections::HashMap::new();
                if let Some(signature) = parser_entity.signature {
                    metadata.insert("signature".to_string(), signature);
                }
                if let Some(documentation) = parser_entity.documentation {
                    metadata.insert("documentation".to_string(), documentation);
                }
                metadata.insert("start_column".to_string(), parser_entity.start_column.to_string());
                metadata.insert("end_column".to_string(), parser_entity.end_column.to_string());
                metadata
            },
        }
    }

    /// Get current progress
    pub async fn get_progress(&self) -> IndexingProgress {
        let progress = self.progress.read().await;
        IndexingProgress {
            total_files: progress.total_files,
            processed_files: progress.processed_files,
            total_entities: progress.total_entities,
            current_file: progress.current_file.clone(),
            errors: progress.errors.clone(),
            start_time: progress.start_time,
            estimated_time_remaining: progress.estimated_time_remaining,
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