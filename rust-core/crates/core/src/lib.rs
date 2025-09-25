//! Core types and traits for Code Intelligence MCP Server

pub mod types;
pub mod traits;
pub mod errors;
pub mod config;
pub mod models;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Core configuration for the Code Intelligence system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub database_url: String,
    pub redis_url: Option<String>,
    pub embedding_model_path: Option<String>,
    pub max_workers: usize,
    pub cache_size: usize,
    pub log_level: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            database_url: "sqlite://./code_intelligence.db".to_string(),
            redis_url: None,
            embedding_model_path: None,
            max_workers: num_cpus::get(),
            cache_size: 1000,
            log_level: "info".to_string(),
        }
    }
}

/// Core entity types
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EntityType {
    Function,
    Class,
    Interface,
    Variable,
    Constant,
    Module,
    Import,
    Export,
}

/// Core code entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeEntity {
    pub id: Uuid,
    pub name: String,
    pub entity_type: EntityType,
    pub file_path: String,
    pub start_line: u32,
    pub end_line: u32,
    pub content: String,
    pub metadata: HashMap<String, String>,
}

/// Search result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub entity: CodeEntity,
    pub score: f32,
    pub highlights: Vec<String>,
}

/// Query types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum QueryType {
    Keyword,
    Semantic,
    Hybrid,
}

/// Search query
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQuery {
    pub text: String,
    pub query_type: QueryType,
    pub limit: usize,
    pub filters: HashMap<String, String>,
}

/// Initialize the core system
pub fn init() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    tracing::info!("Code Intelligence Core initialized");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_config_default() {
        let config = Config::default();
        assert_eq!(config.database_url, "sqlite://./code_intelligence.db");
        assert!(config.max_workers > 0);
    }
    
    #[test]
    fn test_entity_creation() {
        let entity = CodeEntity {
            id: Uuid::new_v4(),
            name: "test_function".to_string(),
            entity_type: EntityType::Function,
            file_path: "test.rs".to_string(),
            start_line: 1,
            end_line: 10,
            content: "fn test_function() {}".to_string(),
            metadata: HashMap::new(),
        };
        
        assert_eq!(entity.name, "test_function");
        assert_eq!(entity.entity_type, EntityType::Function);
    }
    
    #[test]
    fn test_search_query() {
        let query = SearchQuery {
            text: "function".to_string(),
            query_type: QueryType::Keyword,
            limit: 10,
            filters: HashMap::new(),
        };
        
        assert_eq!(query.text, "function");
        assert_eq!(query.limit, 10);
    }
}