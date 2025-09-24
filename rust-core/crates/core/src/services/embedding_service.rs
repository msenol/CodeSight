//! Embedding service for generating and managing vector embeddings

use crate::error::CoreError;
use crate::models::{
    embedding::{
        Embedding, EmbeddingModel, EmbeddingRequest, EmbeddingInput, EmbeddingBatch,
        EmbeddingMetadata, SimilarityResult, SimilarityMetric, EmbeddingEntityType
    },
    code_entity::CodeEntity,
    configuration::Configuration,
};
use crate::services::{Service, ServiceHealth, ConfigurationService};
use crate::traits::{Validate, Timestamped};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use tokio::time::{timeout, Duration};
use uuid::Uuid;

/// Service for generating and managing embeddings
#[derive(Debug)]
pub struct EmbeddingService {
    config_service: Arc<ConfigurationService>,
    providers: Arc<RwLock<HashMap<String, Box<dyn EmbeddingProvider>>>>,
    embeddings_cache: Arc<RwLock<HashMap<String, Embedding>>>,
    metrics: Arc<RwLock<EmbeddingMetrics>>,
    request_queue: Arc<RwLock<Vec<EmbeddingRequest>>>,
}

/// Embedding service metrics
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct EmbeddingMetrics {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub total_embeddings_generated: u64,
    pub total_tokens_processed: u64,
    pub average_generation_time_ms: f64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub provider_usage: HashMap<String, u64>,
    pub batch_requests: u64,
    pub single_requests: u64,
}

/// Embedding provider trait
#[async_trait]
pub trait EmbeddingProvider: Send + Sync + std::fmt::Debug {
    /// Get provider name
    fn name(&self) -> &str;
    
    /// Get supported models
    fn supported_models(&self) -> Vec<EmbeddingModel>;
    
    /// Generate embeddings for a batch of inputs
    async fn generate_embeddings(
        &self,
        request: &EmbeddingRequest,
    ) -> Result<EmbeddingBatch, CoreError>;
    
    /// Check if provider is available
    async fn health_check(&self) -> Result<(), CoreError>;
    
    /// Get provider configuration
    fn get_config(&self) -> ProviderConfig;
}

/// Provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub name: String,
    pub endpoint: String,
    pub api_key: Option<String>,
    pub timeout_seconds: u64,
    pub max_retries: u32,
    pub rate_limit_per_minute: Option<u32>,
    pub supported_models: Vec<String>,
}

/// OpenAI embedding provider
#[derive(Debug)]
pub struct OpenAIProvider {
    config: ProviderConfig,
    client: reqwest::Client,
}

/// Embedding generation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateEmbeddingsRequest {
    pub inputs: Vec<EmbeddingInput>,
    pub model: EmbeddingModel,
    pub options: EmbeddingGenerationOptions,
}

/// Embedding generation options
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EmbeddingGenerationOptions {
    pub normalize: bool,
    pub batch_size: Option<usize>,
    pub use_cache: bool,
    pub priority: EmbeddingPriority,
    pub timeout_seconds: Option<u64>,
}

/// Embedding generation priority
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EmbeddingPriority {
    Low,
    Normal,
    High,
    Critical,
}

/// Embedding search request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingSearchRequest {
    pub query_embedding: Vec<f32>,
    pub codebase_ids: Option<Vec<String>>,
    pub entity_types: Option<Vec<EmbeddingEntityType>>,
    pub similarity_threshold: f32,
    pub limit: usize,
    pub metric: SimilarityMetric,
}

/// Embedding search result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingSearchResult {
    pub results: Vec<SimilarityResult>,
    pub total_searched: usize,
    pub search_time_ms: u64,
}

/// Batch processing status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchStatus {
    pub batch_id: String,
    pub status: BatchProcessingStatus,
    pub total_items: usize,
    pub processed_items: usize,
    pub failed_items: usize,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

/// Batch processing status enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum BatchProcessingStatus {
    Queued,
    Processing,
    Completed,
    Failed,
    Cancelled,
}

impl EmbeddingService {
    /// Create a new embedding service
    pub async fn new(config_service: Arc<ConfigurationService>) -> Result<Self, CoreError> {
        let mut providers: HashMap<String, Box<dyn EmbeddingProvider>> = HashMap::new();
        
        // Initialize OpenAI provider if configured
        if let Ok(openai_provider) = OpenAIProvider::new().await {
            providers.insert("openai".to_string(), Box::new(openai_provider));
        }
        
        Ok(Self {
            config_service,
            providers: Arc::new(RwLock::new(providers)),
            embeddings_cache: Arc::new(RwLock::new(HashMap::new())),
            metrics: Arc::new(RwLock::new(EmbeddingMetrics::default())),
            request_queue: Arc::new(RwLock::new(Vec::new())),
        })
    }

    /// Generate embeddings for a list of inputs
    pub async fn generate_embeddings(
        &self,
        request: GenerateEmbeddingsRequest,
    ) -> Result<Vec<Embedding>, CoreError> {
        let start_time = std::time::Instant::now();
        
        // Validate request
        if request.inputs.is_empty() {
            return Err(CoreError::ValidationError(
                "No inputs provided for embedding generation".to_string(),
            ));
        }
        
        // Check cache if enabled
        let mut cached_embeddings = Vec::new();
        let mut uncached_inputs = Vec::new();
        
        if request.options.use_cache {
            for input in &request.inputs {
                let cache_key = self.generate_cache_key(input, &request.model);
                if let Some(embedding) = self.get_cached_embedding(&cache_key).await {
                    cached_embeddings.push(embedding);
                    self.update_cache_hit_metrics().await;
                } else {
                    uncached_inputs.push(input.clone());
                    self.update_cache_miss_metrics().await;
                }
            }
        } else {
            uncached_inputs = request.inputs.clone();
        }
        
        let mut all_embeddings = cached_embeddings;
        
        // Generate embeddings for uncached inputs
        if !uncached_inputs.is_empty() {
            let embedding_request = EmbeddingRequest::new(uncached_inputs, request.model.clone())
                .with_normalization(request.options.normalize);
            
            let generated_embeddings = self.generate_embeddings_internal(&embedding_request).await?;
            
            // Cache generated embeddings
            if request.options.use_cache {
                for embedding in &generated_embeddings {
                    let cache_key = self.generate_cache_key_for_embedding(embedding);
                    self.cache_embedding(cache_key, embedding.clone()).await;
                }
            }
            
            all_embeddings.extend(generated_embeddings);
        }
        
        // Update metrics
        let generation_time = start_time.elapsed();
        self.update_generation_metrics(&request, &all_embeddings, generation_time).await;
        
        Ok(all_embeddings)
    }

    /// Generate embeddings for code entities
    pub async fn generate_entity_embeddings(
        &self,
        entities: Vec<CodeEntity>,
        model: EmbeddingModel,
    ) -> Result<Vec<Embedding>, CoreError> {
        let inputs: Vec<EmbeddingInput> = entities
            .into_iter()
            .map(|entity| {
                let text = self.entity_to_text(&entity);
                let entity_type = self.code_entity_to_embedding_type(&entity);
                
                EmbeddingInput {
                    id: entity.id.clone(),
                    text,
                    entity_type,
                    entity_id: Some(entity.id),
                    metadata: EmbeddingMetadata {
                        source_file: Some(entity.file_path),
                        language: Some(entity.language),
                        line_number: Some(entity.start_line),
                        ..Default::default()
                    },
                }
            })
            .collect();
        
        let request = GenerateEmbeddingsRequest {
            inputs,
            model,
            options: EmbeddingGenerationOptions {
                use_cache: true,
                normalize: true,
                ..Default::default()
            },
        };
        
        self.generate_embeddings(request).await
    }

    /// Search for similar embeddings
    pub async fn search_similar(
        &self,
        request: EmbeddingSearchRequest,
    ) -> Result<EmbeddingSearchResult, CoreError> {
        let start_time = std::time::Instant::now();
        
        let embeddings_cache = self.embeddings_cache.read().unwrap();
        let mut results = Vec::new();
        let mut total_searched = 0;
        
        for embedding in embeddings_cache.values() {
            // Apply filters
            if let Some(ref codebase_ids) = request.codebase_ids {
                if !codebase_ids.contains(&embedding.entity_id) {
                    continue;
                }
            }
            
            if let Some(ref entity_types) = request.entity_types {
                if !entity_types.contains(&embedding.entity_type) {
                    continue;
                }
            }
            
            total_searched += 1;
            
            // Calculate similarity
            let similarity = self.calculate_similarity(
                &request.query_embedding,
                &embedding.vector,
                &request.metric,
            )?;
            
            if similarity >= request.similarity_threshold {
                results.push(SimilarityResult {
                    score: similarity,
                    metric: request.metric.clone(),
                    embedding_id_1: "query".to_string(),
                    embedding_id_2: embedding.id.clone(),
                });
            }
        }
        
        // Sort by similarity score
        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
        
        // Apply limit
        results.truncate(request.limit);
        
        let search_time = start_time.elapsed();
        
        Ok(EmbeddingSearchResult {
            results,
            total_searched,
            search_time_ms: search_time.as_millis() as u64,
        })
    }

    /// Calculate similarity between two vectors
    fn calculate_similarity(
        &self,
        vector1: &[f32],
        vector2: &[f32],
        metric: &SimilarityMetric,
    ) -> Result<f32, CoreError> {
        if vector1.len() != vector2.len() {
            return Err(CoreError::ValidationError(
                "Vectors must have the same dimensions".to_string(),
            ));
        }
        
        match metric {
            SimilarityMetric::Cosine => {
                let dot_product: f32 = vector1.iter().zip(vector2.iter()).map(|(a, b)| a * b).sum();
                let norm1: f32 = vector1.iter().map(|x| x * x).sum::<f32>().sqrt();
                let norm2: f32 = vector2.iter().map(|x| x * x).sum::<f32>().sqrt();
                
                if norm1 == 0.0 || norm2 == 0.0 {
                    Ok(0.0)
                } else {
                    Ok(dot_product / (norm1 * norm2))
                }
            }
            SimilarityMetric::DotProduct => {
                Ok(vector1.iter().zip(vector2.iter()).map(|(a, b)| a * b).sum())
            }
            SimilarityMetric::Euclidean => {
                let distance: f32 = vector1
                    .iter()
                    .zip(vector2.iter())
                    .map(|(a, b)| (a - b).powi(2))
                    .sum::<f32>()
                    .sqrt();
                Ok(1.0 / (1.0 + distance)) // Convert distance to similarity
            }
            SimilarityMetric::Manhattan => {
                let distance: f32 = vector1
                    .iter()
                    .zip(vector2.iter())
                    .map(|(a, b)| (a - b).abs())
                    .sum();
                Ok(1.0 / (1.0 + distance)) // Convert distance to similarity
            }
        }
    }

    /// Generate embeddings using available providers
    async fn generate_embeddings_internal(
        &self,
        request: &EmbeddingRequest,
    ) -> Result<Vec<Embedding>, CoreError> {
        let providers = self.providers.read().unwrap();
        
        // Try to find a provider that supports the requested model
        for provider in providers.values() {
            if provider.supported_models().iter().any(|m| m.name == request.model.name) {
                match provider.generate_embeddings(request).await {
                    Ok(batch) => {
                        self.update_provider_usage_metrics(&provider.name()).await;
                        return Ok(batch.embeddings);
                    }
                    Err(e) => {
                        eprintln!("Provider {} failed: {}", provider.name(), e);
                        continue;
                    }
                }
            }
        }
        
        Err(CoreError::NotFound(
            "No available provider for the requested model".to_string(),
        ))
    }

    /// Convert code entity to embedding text
    fn entity_to_text(&self, entity: &CodeEntity) -> String {
        let mut text_parts = Vec::new();
        
        // Add entity name
        text_parts.push(entity.name.clone());
        
        // Add qualified name if different
        if entity.qualified_name != entity.name {
            text_parts.push(entity.qualified_name.clone());
        }
        
        // Add signature if available
        if let Some(ref signature) = entity.signature {
            text_parts.push(signature.clone());
        }
        
        // Add documentation if available
        if let Some(ref documentation) = entity.documentation {
            text_parts.push(documentation.clone());
        }
        
        text_parts.join(" ")
    }

    /// Convert code entity type to embedding entity type
    fn code_entity_to_embedding_type(&self, entity: &CodeEntity) -> EmbeddingEntityType {
        match entity.entity_type {
            crate::models::code_entity::EntityType::Function => EmbeddingEntityType::Function,
            crate::models::code_entity::EntityType::Class => EmbeddingEntityType::Class,
            crate::models::code_entity::EntityType::Module => EmbeddingEntityType::Module,
            crate::models::code_entity::EntityType::Variable => EmbeddingEntityType::Variable,
            crate::models::code_entity::EntityType::Interface => EmbeddingEntityType::Class,
            crate::models::code_entity::EntityType::Enum => EmbeddingEntityType::Class,
            crate::models::code_entity::EntityType::Struct => EmbeddingEntityType::Class,
            crate::models::code_entity::EntityType::Trait => EmbeddingEntityType::Class,
            crate::models::code_entity::EntityType::Constant => EmbeddingEntityType::Variable,
            crate::models::code_entity::EntityType::Type => EmbeddingEntityType::Class,
        }
    }

    /// Generate cache key for embedding input
    fn generate_cache_key(&self, input: &EmbeddingInput, model: &EmbeddingModel) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        input.text.hash(&mut hasher);
        model.identifier().hash(&mut hasher);
        
        format!("embedding:{:x}", hasher.finish())
    }

    /// Generate cache key for existing embedding
    fn generate_cache_key_for_embedding(&self, embedding: &Embedding) -> String {
        format!("embedding:{}", embedding.content_hash)
    }

    /// Get cached embedding
    async fn get_cached_embedding(&self, cache_key: &str) -> Option<Embedding> {
        let cache = self.embeddings_cache.read().unwrap();
        cache.get(cache_key).cloned()
    }

    /// Cache embedding
    async fn cache_embedding(&self, cache_key: String, embedding: Embedding) {
        let mut cache = self.embeddings_cache.write().unwrap();
        cache.insert(cache_key, embedding);
        
        // Limit cache size
        if cache.len() > 10000 {
            // Remove oldest entries (simplified LRU)
            let keys_to_remove: Vec<String> = cache.keys().take(1000).cloned().collect();
            for key in keys_to_remove {
                cache.remove(&key);
            }
        }
    }

    /// Update cache hit metrics
    async fn update_cache_hit_metrics(&self) {
        let mut metrics = self.metrics.write().unwrap();
        metrics.cache_hits += 1;
    }

    /// Update cache miss metrics
    async fn update_cache_miss_metrics(&self) {
        let mut metrics = self.metrics.write().unwrap();
        metrics.cache_misses += 1;
    }

    /// Update provider usage metrics
    async fn update_provider_usage_metrics(&self, provider_name: &str) {
        let mut metrics = self.metrics.write().unwrap();
        *metrics.provider_usage.entry(provider_name.to_string()).or_insert(0) += 1;
    }

    /// Update generation metrics
    async fn update_generation_metrics(
        &self,
        request: &GenerateEmbeddingsRequest,
        embeddings: &[Embedding],
        generation_time: std::time::Duration,
    ) {
        let mut metrics = self.metrics.write().unwrap();
        
        metrics.total_requests += 1;
        
        if embeddings.len() == request.inputs.len() {
            metrics.successful_requests += 1;
        } else {
            metrics.failed_requests += 1;
        }
        
        metrics.total_embeddings_generated += embeddings.len() as u64;
        
        // Update average generation time
        let generation_time_ms = generation_time.as_millis() as f64;
        if metrics.total_requests == 1 {
            metrics.average_generation_time_ms = generation_time_ms;
        } else {
            metrics.average_generation_time_ms = 
                (metrics.average_generation_time_ms * (metrics.total_requests - 1) as f64 + generation_time_ms) 
                / metrics.total_requests as f64;
        }
        
        // Update batch vs single request metrics
        if request.inputs.len() > 1 {
            metrics.batch_requests += 1;
        } else {
            metrics.single_requests += 1;
        }
    }

    /// Get embedding metrics
    pub async fn get_metrics(&self) -> EmbeddingMetrics {
        self.metrics.read().unwrap().clone()
    }

    /// Get available providers
    pub async fn get_providers(&self) -> Vec<String> {
        let providers = self.providers.read().unwrap();
        providers.keys().cloned().collect()
    }

    /// Add embedding provider
    pub async fn add_provider(
        &self,
        name: String,
        provider: Box<dyn EmbeddingProvider>,
    ) -> Result<(), CoreError> {
        let mut providers = self.providers.write().unwrap();
        providers.insert(name, provider);
        Ok(())
    }

    /// Remove embedding provider
    pub async fn remove_provider(&self, name: &str) -> Result<(), CoreError> {
        let mut providers = self.providers.write().unwrap();
        providers.remove(name);
        Ok(())
    }

    /// Clear embedding cache
    pub async fn clear_cache(&self) {
        let mut cache = self.embeddings_cache.write().unwrap();
        cache.clear();
    }
}

impl OpenAIProvider {
    /// Create a new OpenAI provider
    pub async fn new() -> Result<Self, CoreError> {
        let config = ProviderConfig {
            name: "openai".to_string(),
            endpoint: "https://api.openai.com/v1/embeddings".to_string(),
            api_key: std::env::var("OPENAI_API_KEY").ok(),
            timeout_seconds: 30,
            max_retries: 3,
            rate_limit_per_minute: Some(3000),
            supported_models: vec![
                "text-embedding-ada-002".to_string(),
                "text-embedding-3-small".to_string(),
                "text-embedding-3-large".to_string(),
            ],
        };
        
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(config.timeout_seconds))
            .build()
            .map_err(|e| CoreError::NetworkError(format!("Failed to create HTTP client: {}", e)))?;
        
        Ok(Self { config, client })
    }
}

#[async_trait]
impl EmbeddingProvider for OpenAIProvider {
    fn name(&self) -> &str {
        &self.config.name
    }
    
    fn supported_models(&self) -> Vec<EmbeddingModel> {
        vec![
            EmbeddingModel::openai_ada_002(),
            EmbeddingModel::openai_3_small(),
            EmbeddingModel::openai_3_large(),
        ]
    }
    
    async fn generate_embeddings(
        &self,
        request: &EmbeddingRequest,
    ) -> Result<EmbeddingBatch, CoreError> {
        let api_key = self.config.api_key.as_ref().ok_or_else(|| {
            CoreError::ConfigError("OpenAI API key not configured".to_string())
        })?;
        
        // Prepare request payload
        let texts: Vec<String> = request.texts.iter().map(|input| input.text.clone()).collect();
        
        let payload = serde_json::json!({
            "input": texts,
            "model": request.model.name,
            "encoding_format": "float"
        });
        
        // Make API request
        let response = self.client
            .post(&self.config.endpoint)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| CoreError::NetworkError(format!("API request failed: {}", e)))?;
        
        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(CoreError::NetworkError(format!("API error: {}", error_text)));
        }
        
        let response_data: serde_json::Value = response.json().await
            .map_err(|e| CoreError::ParseError(format!("Failed to parse response: {}", e)))?;
        
        // Parse embeddings from response
        let embeddings_data = response_data["data"].as_array()
            .ok_or_else(|| CoreError::ParseError("Invalid response format".to_string()))?;
        
        let mut embeddings = Vec::new();
        
        for (i, embedding_data) in embeddings_data.iter().enumerate() {
            let vector: Vec<f32> = embedding_data["embedding"].as_array()
                .ok_or_else(|| CoreError::ParseError("Invalid embedding format".to_string()))?
                .iter()
                .map(|v| v.as_f64().unwrap_or(0.0) as f32)
                .collect();
            
            let input = &request.texts[i];
            let content_hash = crate::utils::hash_content(&input.text);
            
            let embedding = Embedding::new(
                input.entity_id.clone().unwrap_or_else(|| Uuid::new_v4().to_string()),
                input.entity_type.clone(),
                vector,
                request.model.clone(),
                content_hash,
            ).with_processing_info(
                input.text.len(),
                None, // Token count not provided by OpenAI API
                0, // Processing time calculated elsewhere
            );
            
            embeddings.push(embedding);
        }
        
        Ok(EmbeddingBatch {
            id: Uuid::new_v4().to_string(),
            embeddings,
            model: request.model.clone(),
            processing_time_ms: 0, // Would be calculated in real implementation
            created_at: Utc::now(),
        })
    }
    
    async fn health_check(&self) -> Result<(), CoreError> {
        // Simple health check - try to make a minimal request
        if self.config.api_key.is_none() {
            return Err(CoreError::ConfigError("API key not configured".to_string()));
        }
        
        // In a real implementation, this would make a test API call
        Ok(())
    }
    
    fn get_config(&self) -> ProviderConfig {
        self.config.clone()
    }
}

impl Default for EmbeddingPriority {
    fn default() -> Self {
        EmbeddingPriority::Normal
    }
}

#[async_trait]
impl Service for EmbeddingService {
    async fn initialize(&self) -> Result<(), CoreError> {
        // Initialize providers and check their health
        let providers = self.providers.read().unwrap();
        for provider in providers.values() {
            if let Err(e) = provider.health_check().await {
                eprintln!("Provider {} health check failed: {}", provider.name(), e);
            }
        }
        Ok(())
    }

    async fn shutdown(&self) -> Result<(), CoreError> {
        // Clear caches and save metrics
        self.clear_cache().await;
        Ok(())
    }

    async fn health_check(&self) -> ServiceHealth {
        let providers = self.providers.read().unwrap();
        
        if providers.is_empty() {
            return ServiceHealth::unhealthy(
                "No embedding providers available".to_string(),
            );
        }
        
        // Check if at least one provider is healthy
        let mut healthy_providers = 0;
        for provider in providers.values() {
            if provider.health_check().await.is_ok() {
                healthy_providers += 1;
            }
        }
        
        if healthy_providers == 0 {
            return ServiceHealth::unhealthy(
                "No healthy embedding providers".to_string(),
            );
        }
        
        if healthy_providers < providers.len() {
            return ServiceHealth::degraded(
                format!("{}/{} providers healthy", healthy_providers, providers.len()),
            );
        }
        
        ServiceHealth::healthy()
    }

    fn name(&self) -> &'static str {
        "EmbeddingService"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn create_test_service() -> EmbeddingService {
        let config_service = Arc::new(ConfigurationService::new().await.unwrap());
        EmbeddingService::new(config_service).await.unwrap()
    }

    #[tokio::test]
    async fn test_embedding_service_creation() {
        let service = create_test_service().await;
        assert_eq!(service.name(), "EmbeddingService");
    }

    #[tokio::test]
    async fn test_calculate_similarity() {
        let service = create_test_service().await;
        
        let vector1 = vec![1.0, 0.0, 0.0];
        let vector2 = vec![0.0, 1.0, 0.0];
        
        let cosine_sim = service.calculate_similarity(&vector1, &vector2, &SimilarityMetric::Cosine).unwrap();
        assert!((cosine_sim - 0.0).abs() < 1e-6);
        
        let dot_product = service.calculate_similarity(&vector1, &vector2, &SimilarityMetric::DotProduct).unwrap();
        assert_eq!(dot_product, 0.0);
    }

    #[tokio::test]
    async fn test_entity_to_text() {
        let service = create_test_service().await;
        
        let entity = CodeEntity::new(
            "codebase1".to_string(),
            crate::models::code_entity::EntityType::Function,
            "test_function".to_string(),
            "test.rs".to_string(),
            1,
            "rust".to_string(),
        );
        
        let text = service.entity_to_text(&entity);
        assert!(text.contains("test_function"));
    }

    #[tokio::test]
    async fn test_cache_key_generation() {
        let service = create_test_service().await;
        
        let input = EmbeddingInput {
            id: "test".to_string(),
            text: "test text".to_string(),
            entity_type: EmbeddingEntityType::Function,
            entity_id: None,
            metadata: EmbeddingMetadata::default(),
        };
        
        let model = EmbeddingModel::openai_ada_002();
        let key1 = service.generate_cache_key(&input, &model);
        let key2 = service.generate_cache_key(&input, &model);
        
        assert_eq!(key1, key2);
    }

    #[tokio::test]
    async fn test_metrics() {
        let service = create_test_service().await;
        let metrics = service.get_metrics().await;
        
        assert_eq!(metrics.total_requests, 0);
        assert_eq!(metrics.cache_hits, 0);
        assert_eq!(metrics.cache_misses, 0);
    }
}