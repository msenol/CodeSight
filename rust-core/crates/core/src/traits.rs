//! Core traits for Code Intelligence

use crate::errors::Result;
use async_trait::async_trait;

/// Parser trait for different languages
#[async_trait]
pub trait Parser: Send + Sync {
    async fn parse(&self, content: &str) -> Result<Vec<crate::CodeEntity>>;
    fn get_language(&self) -> String;
}

/// Indexer trait for different storage backends
#[async_trait]
pub trait Indexer: Send + Sync {
    async fn index(&self, entities: Vec<crate::CodeEntity>) -> Result<()>;
    async fn search(&self, query: &str) -> Result<Vec<crate::SearchResult>>;
}

/// Cache trait for different caching strategies
#[async_trait]
pub trait Cache: Send + Sync {
    async fn get(&self, key: &str) -> Result<Option<String>>;
    async fn set(&self, key: &str, value: &str) -> Result<()>;
    async fn invalidate(&self, key: &str) -> Result<()>;
    async fn clear(&self) -> Result<()>;
}

/// Storage trait for different storage backends
#[async_trait]
pub trait Storage: Send + Sync {
    async fn store(&self, key: &str, value: &[u8]) -> Result<()>;
    async fn retrieve(&self, key: &str) -> Result<Option<Vec<u8>>>;
    async fn delete(&self, key: &str) -> Result<()>;
    async fn list(&self, prefix: &str) -> Result<Vec<String>>;
}

/// Embedding generator trait
#[async_trait]
pub trait EmbeddingGenerator: Send + Sync {
    async fn generate(&self, text: &str) -> Result<Vec<f32>>;
    async fn batch_generate(&self, texts: Vec<&str>) -> Result<Vec<Vec<f32>>>;
    fn dimension(&self) -> usize;
}