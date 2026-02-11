//! Embedding model for vector representations of code

use super::{Validate, Timestamped};
use crate::errors::CoreError;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Represents a vector embedding of code or text
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Embedding {
    /// Unique identifier for the embedding
    pub id: String,
    /// ID of the entity this embedding represents
    pub entity_id: String,
    /// Type of entity being embedded
    pub entity_type: EmbeddingEntityType,
    /// The vector representation
    pub vector: Vec<f32>,
    /// Dimensionality of the vector
    pub dimensions: usize,
    /// Model used to generate the embedding
    pub model: EmbeddingModel,
    /// Version of the model
    pub model_version: String,
    /// Hash of the source content
    pub content_hash: String,
    /// Metadata about the embedding
    pub metadata: EmbeddingMetadata,
    /// When the embedding was created
    pub created_at: DateTime<Utc>,
    /// When the embedding was last updated
    pub updated_at: DateTime<Utc>,
}

/// Types of entities that can be embedded
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EmbeddingEntityType {
    /// Code function or method
    Function,
    /// Code class or struct
    Class,
    /// Code module or namespace
    Module,
    /// Variable or field
    Variable,
    /// Comment or documentation
    Comment,
    /// Entire file
    File,
    /// Code snippet or fragment
    Snippet,
    /// Query text
    Query,
    /// Documentation text
    Documentation,
    /// Test case
    Test,
}

/// Embedding model information
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EmbeddingModel {
    /// Name of the model
    pub name: String,
    /// Provider of the model (OpenAI, Cohere, etc.)
    pub provider: String,
    /// Model configuration
    pub config: ModelConfig,
}

/// Configuration for embedding models
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ModelConfig {
    /// Maximum input length in tokens
    pub max_input_length: usize,
    /// Output dimensions
    pub output_dimensions: usize,
    /// Whether the model supports batching
    pub supports_batching: bool,
    /// Maximum batch size
    pub max_batch_size: Option<usize>,
    /// Model-specific parameters
    pub parameters: HashMap<String, String>,
}

/// Metadata associated with an embedding
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct EmbeddingMetadata {
    /// Source file path
    pub source_file: Option<String>,
    /// Programming language
    pub language: Option<String>,
    /// Line number in source file
    pub line_number: Option<usize>,
    /// Column number in source file
    pub column_number: Option<usize>,
    /// Length of original text in characters
    pub text_length: Option<usize>,
    /// Number of tokens in the input
    pub token_count: Option<usize>,
    /// Processing time in milliseconds
    pub processing_time_ms: Option<u64>,
    /// Quality score of the embedding (0.0 to 1.0)
    pub quality_score: Option<f32>,
    /// Additional custom metadata
    pub custom: HashMap<String, String>,
}

/// Batch of embeddings for efficient processing
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EmbeddingBatch {
    /// Unique identifier for the batch
    pub id: String,
    /// List of embeddings in the batch
    pub embeddings: Vec<Embedding>,
    /// Model used for the batch
    pub model: EmbeddingModel,
    /// Total processing time for the batch
    pub processing_time_ms: u64,
    /// When the batch was created
    pub created_at: DateTime<Utc>,
}

/// Request for creating embeddings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EmbeddingRequest {
    /// Unique identifier for the request
    pub id: String,
    /// List of texts to embed
    pub texts: Vec<EmbeddingInput>,
    /// Model to use for embedding
    pub model: EmbeddingModel,
    /// Whether to normalize the vectors
    pub normalize: bool,
    /// Additional options
    pub options: EmbeddingOptions,
}

/// Input for embedding generation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EmbeddingInput {
    /// Unique identifier for this input
    pub id: String,
    /// Text content to embed
    pub text: String,
    /// Type of entity
    pub entity_type: EmbeddingEntityType,
    /// Associated entity ID
    pub entity_id: Option<String>,
    /// Metadata for this input
    pub metadata: EmbeddingMetadata,
}

/// Options for embedding generation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct EmbeddingOptions {
    /// Whether to truncate long inputs
    pub truncate: bool,
    /// Maximum input length (overrides model default)
    pub max_length: Option<usize>,
    /// Whether to include metadata in response
    pub include_metadata: bool,
    /// Timeout for the request in seconds
    pub timeout_seconds: Option<u64>,
    /// Whether to use cache for identical inputs
    pub use_cache: bool,
}

/// Similarity calculation result
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SimilarityResult {
    /// Similarity score (0.0 to 1.0)
    pub score: f32,
    /// Distance metric used
    pub metric: SimilarityMetric,
    /// First embedding ID
    pub embedding_id_1: String,
    /// Second embedding ID
    pub embedding_id_2: String,
}

/// Similarity metrics
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SimilarityMetric {
    /// Cosine similarity
    Cosine,
    /// Euclidean distance
    Euclidean,
    /// Dot product
    DotProduct,
    /// Manhattan distance
    Manhattan,
}

/// Search result for embedding similarity search
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EmbeddingSearchResult {
    /// The matching embedding
    pub embedding: Embedding,
    /// Similarity score
    pub score: f32,
    /// Distance from query
    pub distance: f32,
    /// Rank in results
    pub rank: usize,
}

impl Embedding {
    /// Create a new embedding
    pub fn new(
        entity_id: String,
        entity_type: EmbeddingEntityType,
        vector: Vec<f32>,
        model: EmbeddingModel,
        content_hash: String,
    ) -> Self {
        let dimensions = vector.len();
        Self {
            id: Uuid::new_v4().to_string(),
            entity_id,
            entity_type,
            vector,
            dimensions,
            model,
            model_version: "1.0".to_string(),
            content_hash,
            metadata: EmbeddingMetadata::default(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    /// Calculate cosine similarity with another embedding
    pub fn cosine_similarity(&self, other: &Embedding) -> Result<f32, CoreError> {
        if self.dimensions != other.dimensions {
            return Err(CoreError::ValidationError(
                "Embeddings must have the same dimensions".to_string(),
            ));
        }

        let dot_product: f32 = self.vector.iter()
            .zip(other.vector.iter())
            .map(|(a, b)| a * b)
            .sum();

        let norm_a: f32 = self.vector.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = other.vector.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm_a == 0.0 || norm_b == 0.0 {
            return Ok(0.0);
        }

        Ok(dot_product / (norm_a * norm_b))
    }

    /// Calculate Euclidean distance with another embedding
    pub fn euclidean_distance(&self, other: &Embedding) -> Result<f32, CoreError> {
        if self.dimensions != other.dimensions {
            return Err(CoreError::ValidationError(
                "Embeddings must have the same dimensions".to_string(),
            ));
        }

        let distance: f32 = self.vector.iter()
            .zip(other.vector.iter())
            .map(|(a, b)| (a - b).powi(2))
            .sum::<f32>()
            .sqrt();

        Ok(distance)
    }

    /// Calculate dot product with another embedding
    pub fn dot_product(&self, other: &Embedding) -> Result<f32, CoreError> {
        if self.dimensions != other.dimensions {
            return Err(CoreError::ValidationError(
                "Embeddings must have the same dimensions".to_string(),
            ));
        }

        let dot_product: f32 = self.vector.iter()
            .zip(other.vector.iter())
            .map(|(a, b)| a * b)
            .sum();

        Ok(dot_product)
    }

    /// Normalize the embedding vector
    pub fn normalize(&mut self) {
        let norm: f32 = self.vector.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm > 0.0 {
            for value in &mut self.vector {
                *value /= norm;
            }
        }
        self.updated_at = Utc::now();
    }

    /// Get the magnitude (norm) of the vector
    pub fn magnitude(&self) -> f32 {
        self.vector.iter().map(|x| x * x).sum::<f32>().sqrt()
    }

    /// Check if the embedding is normalized
    pub fn is_normalized(&self) -> bool {
        let magnitude = self.magnitude();
        (magnitude - 1.0).abs() < 1e-6
    }

    /// Add metadata
    pub fn with_metadata(mut self, key: String, value: String) -> Self {
        self.metadata.custom.insert(key, value);
        self
    }

    /// Set source file information
    pub fn with_source_info(
        mut self,
        file_path: String,
        language: Option<String>,
        line: Option<usize>,
    ) -> Self {
        self.metadata.source_file = Some(file_path);
        self.metadata.language = language;
        self.metadata.line_number = line;
        self
    }

    /// Set processing information
    pub fn with_processing_info(
        mut self,
        text_length: usize,
        token_count: Option<usize>,
        processing_time_ms: u64,
    ) -> Self {
        self.metadata.text_length = Some(text_length);
        self.metadata.token_count = token_count;
        self.metadata.processing_time_ms = Some(processing_time_ms);
        self
    }

    /// Check if embedding is stale (needs regeneration)
    pub fn is_stale(&self, max_age_days: i64) -> bool {
        let age = Utc::now() - self.created_at;
        age.num_days() > max_age_days
    }

    /// Get embedding age in days
    pub fn age_days(&self) -> i64 {
        (Utc::now() - self.created_at).num_days()
    }

    /// Check if embedding is compatible with a model
    pub fn is_compatible_with_model(&self, model: &EmbeddingModel) -> bool {
        self.model.name == model.name
            && self.model.provider == model.provider
            && self.dimensions == model.config.output_dimensions
    }
}

impl EmbeddingModel {
    /// Create a new embedding model
    pub fn new(name: String, provider: String, config: ModelConfig) -> Self {
        Self {
            name,
            provider,
            config,
        }
    }

    /// Create OpenAI text-embedding-ada-002 model
    pub fn openai_ada_002() -> Self {
        Self::new(
            "text-embedding-ada-002".to_string(),
            "openai".to_string(),
            ModelConfig {
                max_input_length: 8191,
                output_dimensions: 1536,
                supports_batching: true,
                max_batch_size: Some(2048),
                parameters: HashMap::new(),
            },
        )
    }

    /// Create OpenAI text-embedding-3-small model
    pub fn openai_3_small() -> Self {
        Self::new(
            "text-embedding-3-small".to_string(),
            "openai".to_string(),
            ModelConfig {
                max_input_length: 8191,
                output_dimensions: 1536,
                supports_batching: true,
                max_batch_size: Some(2048),
                parameters: HashMap::new(),
            },
        )
    }

    /// Create OpenAI text-embedding-3-large model
    pub fn openai_3_large() -> Self {
        Self::new(
            "text-embedding-3-large".to_string(),
            "openai".to_string(),
            ModelConfig {
                max_input_length: 8191,
                output_dimensions: 3072,
                supports_batching: true,
                max_batch_size: Some(2048),
                parameters: HashMap::new(),
            },
        )
    }

    /// Get model identifier
    pub fn identifier(&self) -> String {
        format!("{}:{}", self.provider, self.name)
    }

    /// Check if model supports the given input length
    pub fn supports_input_length(&self, length: usize) -> bool {
        length <= self.config.max_input_length
    }

    /// Check if model supports batching
    pub fn supports_batching(&self) -> bool {
        self.config.supports_batching
    }

    /// Get maximum batch size
    pub fn max_batch_size(&self) -> usize {
        self.config.max_batch_size.unwrap_or(1)
    }
}

impl EmbeddingRequest {
    /// Create a new embedding request
    pub fn new(texts: Vec<EmbeddingInput>, model: EmbeddingModel) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            texts,
            model,
            normalize: true,
            options: EmbeddingOptions::default(),
        }
    }

    /// Set normalization option
    pub fn with_normalization(mut self, normalize: bool) -> Self {
        self.normalize = normalize;
        self
    }

    /// Set options
    pub fn with_options(mut self, options: EmbeddingOptions) -> Self {
        self.options = options;
        self
    }

    /// Get total text length
    pub fn total_text_length(&self) -> usize {
        self.texts.iter().map(|input| input.text.len()).sum()
    }

    /// Check if request is valid for the model
    pub fn is_valid_for_model(&self) -> bool {
        if !self.model.supports_batching() && self.texts.len() > 1 {
            return false;
        }

        if self.texts.len() > self.model.max_batch_size() {
            return false;
        }

        self.texts.iter().all(|input| {
            self.model.supports_input_length(input.text.len())
        })
    }
}

impl Validate for Embedding {
    fn validate(&self) -> Result<(), CoreError> {
        if self.vector.is_empty() {
            return Err(CoreError::ValidationError(
                "Embedding vector cannot be empty".to_string(),
            ));
        }

        if self.vector.len() != self.dimensions {
            return Err(CoreError::ValidationError(
                "Vector length must match dimensions".to_string(),
            ));
        }

        if self.vector.iter().any(|&x| !x.is_finite()) {
            return Err(CoreError::ValidationError(
                "Embedding vector contains invalid values".to_string(),
            ));
        }

        if self.entity_id.trim().is_empty() {
            return Err(CoreError::ValidationError(
                "Entity ID cannot be empty".to_string(),
            ));
        }

        if self.content_hash.trim().is_empty() {
            return Err(CoreError::ValidationError(
                "Content hash cannot be empty".to_string(),
            ));
        }

        Ok(())
    }
}

impl Timestamped for Embedding {
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
    fn test_embedding_creation() {
        let vector = vec![0.1, 0.2, 0.3, 0.4];
        let model = EmbeddingModel::openai_ada_002();
        let embedding = Embedding::new(
            "entity123".to_string(),
            EmbeddingEntityType::Function,
            vector.clone(),
            model,
            "hash123".to_string(),
        );

        assert_eq!(embedding.entity_id, "entity123");
        assert_eq!(embedding.entity_type, EmbeddingEntityType::Function);
        assert_eq!(embedding.vector, vector);
        assert_eq!(embedding.dimensions, 4);
        assert!(embedding.validate().is_ok());
    }

    #[test]
    fn test_cosine_similarity() {
        let model = EmbeddingModel::openai_ada_002();
        let embedding1 = Embedding::new(
            "e1".to_string(),
            EmbeddingEntityType::Function,
            vec![1.0, 0.0, 0.0],
            model.clone(),
            "hash1".to_string(),
        );
        let embedding2 = Embedding::new(
            "e2".to_string(),
            EmbeddingEntityType::Function,
            vec![0.0, 1.0, 0.0],
            model,
            "hash2".to_string(),
        );

        let similarity = embedding1.cosine_similarity(&embedding2).unwrap();
        assert!((similarity - 0.0).abs() < 1e-6);

        let embedding3 = Embedding::new(
            "e3".to_string(),
            EmbeddingEntityType::Function,
            vec![1.0, 0.0, 0.0],
            EmbeddingModel::openai_ada_002(),
            "hash3".to_string(),
        );
        let similarity_same = embedding1.cosine_similarity(&embedding3).unwrap();
        assert!((similarity_same - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_embedding_normalization() {
        let mut embedding = Embedding::new(
            "entity".to_string(),
            EmbeddingEntityType::Function,
            vec![3.0, 4.0],
            EmbeddingModel::openai_ada_002(),
            "hash".to_string(),
        );

        assert!(!embedding.is_normalized());
        assert_eq!(embedding.magnitude(), 5.0);

        embedding.normalize();
        assert!(embedding.is_normalized());
        assert!((embedding.magnitude() - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_embedding_models() {
        let ada_002 = EmbeddingModel::openai_ada_002();
        assert_eq!(ada_002.name, "text-embedding-ada-002");
        assert_eq!(ada_002.provider, "openai");
        assert_eq!(ada_002.config.output_dimensions, 1536);
        assert!(ada_002.supports_batching());

        let large = EmbeddingModel::openai_3_large();
        assert_eq!(large.config.output_dimensions, 3072);
        assert!(large.supports_input_length(1000));
        assert!(!large.supports_input_length(10000));
    }

    #[test]
    fn test_embedding_validation() {
        let mut embedding = Embedding::new(
            "".to_string(),
            EmbeddingEntityType::Function,
            vec![1.0, 2.0],
            EmbeddingModel::openai_ada_002(),
            "hash".to_string(),
        );
        assert!(embedding.validate().is_err());

        embedding.entity_id = "valid_id".to_string();
        assert!(embedding.validate().is_ok());

        embedding.vector = vec![];
        assert!(embedding.validate().is_err());

        embedding.vector = vec![f32::NAN, 1.0];
        assert!(embedding.validate().is_err());
    }

    #[test]
    fn test_embedding_request() {
        let input = EmbeddingInput {
            id: "input1".to_string(),
            text: "test function".to_string(),
            entity_type: EmbeddingEntityType::Function,
            entity_id: Some("entity1".to_string()),
            metadata: EmbeddingMetadata::default(),
        };

        let request = EmbeddingRequest::new(
            vec![input],
            EmbeddingModel::openai_ada_002(),
        );

        assert!(request.is_valid_for_model());
        assert_eq!(request.total_text_length(), 13);
    }

    #[test]
    fn test_distance_calculations() {
        let model = EmbeddingModel::openai_ada_002();
        let embedding1 = Embedding::new(
            "e1".to_string(),
            EmbeddingEntityType::Function,
            vec![1.0, 2.0, 3.0],
            model.clone(),
            "hash1".to_string(),
        );
        let embedding2 = Embedding::new(
            "e2".to_string(),
            EmbeddingEntityType::Function,
            vec![4.0, 5.0, 6.0],
            model,
            "hash2".to_string(),
        );

        let euclidean = embedding1.euclidean_distance(&embedding2).unwrap();
        assert!((euclidean - (27.0_f32).sqrt()).abs() < 1e-6);

        let dot_product = embedding1.dot_product(&embedding2).unwrap();
        assert_eq!(dot_product, 32.0); // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
    }

    #[test]
    fn test_embedding_compatibility() {
        let model1 = EmbeddingModel::openai_ada_002();
        let model2 = EmbeddingModel::openai_3_large();
        
        let embedding = Embedding::new(
            "entity".to_string(),
            EmbeddingEntityType::Function,
            vec![0.0; 1536],
            model1.clone(),
            "hash".to_string(),
        );

        assert!(embedding.is_compatible_with_model(&model1));
        assert!(!embedding.is_compatible_with_model(&model2));
    }

    #[test]
    fn test_embedding_age() {
        let embedding = Embedding::new(
            "entity".to_string(),
            EmbeddingEntityType::Function,
            vec![1.0, 2.0],
            EmbeddingModel::openai_ada_002(),
            "hash".to_string(),
        );

        assert_eq!(embedding.age_days(), 0);
        assert!(!embedding.is_stale(30));
    }
}