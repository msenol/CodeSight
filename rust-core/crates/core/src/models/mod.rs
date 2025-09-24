//! Core data models for the Code Intelligence MCP Server
//!
//! This module contains all the fundamental data structures used throughout
//! the system, including entities, relationships, and configuration types.

pub mod codebase;
pub mod code_entity;
pub mod code_relationship;
pub mod index;
pub mod query;
pub mod embedding;
pub mod cache_entry;
pub mod plugin;
pub mod configuration;
pub mod index_job;
pub mod code_metric;
pub mod api_endpoint;

// Re-export all models for convenience
pub use codebase::*;
pub use code_entity::*;
pub use code_relationship::*;
pub use index::*;
pub use query::*;
pub use embedding::*;
pub use cache_entry::*;
pub use plugin::*;
pub use configuration::*;
pub use index_job::*;
pub use code_metric::*;
pub use api_endpoint::*;

/// Common result type used throughout the models
pub type ModelResult<T> = Result<T, crate::error::CodeIntelligenceError>;

/// Trait for models that can be validated
pub trait Validate {
    fn validate(&self) -> ModelResult<()>;
}

/// Trait for models that have timestamps
pub trait Timestamped {
    fn created_at(&self) -> chrono::DateTime<chrono::Utc>;
    fn updated_at(&self) -> Option<chrono::DateTime<chrono::Utc>>;
}

/// Trait for models that can be serialized to/from JSON
pub trait JsonSerializable: serde::Serialize + for<'de> serde::Deserialize<'de> {}

/// Implement JsonSerializable for types that already implement Serialize + Deserialize
impl<T> JsonSerializable for T where T: serde::Serialize + for<'de> serde::Deserialize<'de> {}