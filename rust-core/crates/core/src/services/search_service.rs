//! Search service for querying and retrieving code entities

use crate::error::CoreError;
use crate::models::{
    query::{
        Query, QueryType, QueryResult, QueryResponse, QueryFilters, 
        QueryOptions, SortBy, QueryStats
    },
    code_entity::{CodeEntity, EntityType},
    embedding::{Embedding, SimilarityResult, SimilarityMetric},
    cache_entry::CacheEntry,
    configuration::Configuration,
};
use crate::services::{
    Service, ServiceHealth, ConfigurationService, EmbeddingService, CacheService
};
use crate::traits::{Validate, Timestamped};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use uuid::Uuid;

/// Service for searching code entities and content
#[derive(Debug)]
pub struct SearchService {
    config_service: Arc<ConfigurationService>,
    embedding_service: Arc<EmbeddingService>,
    cache_service: Arc<CacheService>,
    search_indexes: Arc<RwLock<HashMap<String, SearchIndex>>>,
    metrics: Arc<RwLock<SearchMetrics>>,
    query_history: Arc<RwLock<Vec<Query>>>,
}

/// Search service metrics
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct SearchMetrics {
    pub total_queries: u64,
    pub successful_queries: u64,
    pub failed_queries: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub average_query_time_ms: f64,
    pub average_results_count: f64,
    pub semantic_queries: u64,
    pub keyword_queries: u64,
    pub fuzzy_queries: u64,
    pub regex_queries: u64,
}

/// Search index for fast lookups
#[derive(Debug, Clone)]
pub struct SearchIndex {
    pub id: String,
    pub codebase_id: String,
    pub index_type: SearchIndexType,
    pub entities: HashMap<String, CodeEntity>,
    pub embeddings: HashMap<String, Embedding>,
    pub keyword_index: KeywordIndex,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Types of search indexes
#[derive(Debug, Clone, PartialEq)]
pub enum SearchIndexType {
    /// Full-text keyword search
    Keyword,
    /// Semantic vector search
    Semantic,
    /// Combined keyword and semantic
    Hybrid,
}

/// Keyword index for text-based search
#[derive(Debug, Clone, Default)]
pub struct KeywordIndex {
    /// Word to entity IDs mapping
    pub word_to_entities: HashMap<String, Vec<String>>,
    /// Entity ID to words mapping
    pub entity_to_words: HashMap<String, Vec<String>>,
    /// N-gram index for fuzzy search
    pub ngram_index: HashMap<String, Vec<String>>,
}

/// Search request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchRequest {
    pub query: Query,
    pub use_cache: bool,
    pub explain: bool,
}

/// Search explanation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchExplanation {
    pub query_analysis: QueryAnalysis,
    pub search_strategy: SearchStrategy,
    pub index_usage: Vec<IndexUsage>,
    pub scoring_details: Vec<ScoringDetail>,
    pub performance_stats: PerformanceStats,
}

/// Query analysis details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryAnalysis {
    pub original_query: String,
    pub processed_terms: Vec<String>,
    pub query_type: QueryType,
    pub filters_applied: Vec<String>,
    pub estimated_complexity: f64,
}

/// Search strategy used
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchStrategy {
    pub strategy_type: String,
    pub indexes_used: Vec<String>,
    pub fallback_strategies: Vec<String>,
    pub optimization_applied: Vec<String>,
}

/// Index usage information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexUsage {
    pub index_id: String,
    pub index_type: String,
    pub entries_scanned: usize,
    pub entries_matched: usize,
    pub scan_time_ms: u64,
}

/// Scoring details for results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoringDetail {
    pub entity_id: String,
    pub base_score: f64,
    pub boost_factors: HashMap<String, f64>,
    pub final_score: f64,
    pub explanation: String,
}

/// Performance statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceStats {
    pub total_time_ms: u64,
    pub query_parsing_ms: u64,
    pub index_search_ms: u64,
    pub result_ranking_ms: u64,
    pub cache_lookup_ms: u64,
    pub memory_used_bytes: usize,
}

/// Advanced search options
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AdvancedSearchOptions {
    pub boost_factors: HashMap<String, f64>,
    pub custom_scoring: Option<String>,
    pub result_diversification: bool,
    pub personalization: Option<PersonalizationOptions>,
    pub temporal_boost: Option<TemporalBoostOptions>,
}

/// Personalization options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonalizationOptions {
    pub user_id: String,
    pub preferred_languages: Vec<String>,
    pub search_history_weight: f64,
    pub expertise_level: ExpertiseLevel,
}

/// User expertise level
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExpertiseLevel {
    Beginner,
    Intermediate,
    Advanced,
    Expert,
}

/// Temporal boost options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemporalBoostOptions {
    pub boost_recent: bool,
    pub decay_factor: f64,
    pub time_window_days: u32,
}

/// Search suggestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchSuggestion {
    pub suggestion: String,
    pub suggestion_type: SuggestionType,
    pub confidence: f64,
    pub estimated_results: usize,
}

/// Types of search suggestions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SuggestionType {
    Autocomplete,
    DidYouMean,
    RelatedQuery,
    PopularQuery,
}

impl SearchService {
    /// Create a new search service
    pub async fn new(
        config_service: Arc<ConfigurationService>,
        embedding_service: Arc<EmbeddingService>,
        cache_service: Arc<CacheService>,
    ) -> Result<Self, CoreError> {
        Ok(Self {
            config_service,
            embedding_service,
            cache_service,
            search_indexes: Arc::new(RwLock::new(HashMap::new())),
            metrics: Arc::new(RwLock::new(SearchMetrics::default())),
            query_history: Arc::new(RwLock::new(Vec::new())),
        })
    }

    /// Execute a search query
    pub async fn search(
        &self,
        request: SearchRequest,
    ) -> Result<QueryResponse, CoreError> {
        let start_time = std::time::Instant::now();
        let mut query = request.query;
        
        // Validate query
        query.validate()?;
        
        // Check cache if enabled
        if request.use_cache {
            if let Ok(cached_result) = self.get_cached_result(&query).await {
                self.update_cache_hit_metrics().await;
                return Ok(cached_result);
            }
        }
        
        self.update_cache_miss_metrics().await;
        
        // Mark query as executed
        query.mark_executed();
        
        // Store query in history
        {
            let mut history = self.query_history.write().unwrap();
            history.push(query.clone());
            
            // Keep only last 1000 queries
            if history.len() > 1000 {
                history.remove(0);
            }
        }
        
        // Execute search based on query type
        let mut results = match query.query_type {
            QueryType::Semantic => self.semantic_search(&query).await?,
            QueryType::Keyword => self.keyword_search(&query).await?,
            QueryType::Fuzzy => self.fuzzy_search(&query).await?,
            QueryType::Regex => self.regex_search(&query).await?,
            QueryType::Exact => self.exact_search(&query).await?,
            QueryType::Structural => self.structural_search(&query).await?,
            QueryType::Hybrid => self.hybrid_search(&query).await?,
        };
        
        // Apply filters
        results = self.apply_filters(results, &query.filters).await?;
        
        // Sort results
        self.sort_results(&mut results, &query.options.sort_by);
        
        // Apply pagination
        let total_count = results.len();
        let offset = query.effective_offset();
        let limit = query.effective_limit();
        
        let has_more = offset + limit < total_count;
        let paginated_results = results
            .into_iter()
            .skip(offset)
            .take(limit)
            .collect();
        
        // Calculate execution time
        let execution_time = start_time.elapsed();
        
        // Create response
        let stats = QueryStats {
            execution_time_ms: execution_time.as_millis() as u64,
            results_count: paginated_results.len(),
            files_searched: 0, // Would be calculated in real implementation
            from_cache: false,
            index_version: Some("1.0".to_string()),
            memory_usage_bytes: None,
        };
        
        let response = QueryResponse {
            query: query.clone(),
            stats,
            results: paginated_results,
            has_more,
            total_count,
            next_page_token: if has_more {
                Some(format!("offset:{}", offset + limit))
            } else {
                None
            },
        };
        
        // Cache result if enabled
        if request.use_cache {
            let _ = self.cache_result(&query, &response).await;
        }
        
        // Update metrics
        self.update_search_metrics(&query, &response, execution_time).await;
        
        Ok(response)
    }

    /// Perform semantic search using embeddings
    async fn semantic_search(&self, query: &Query) -> Result<Vec<QueryResult>, CoreError> {
        let mut results = Vec::new();
        
        // Generate embedding for query text
        // In a real implementation, this would use the embedding service
        // For now, return empty results
        
        Ok(results)
    }

    /// Perform keyword-based search
    async fn keyword_search(&self, query: &Query) -> Result<Vec<QueryResult>, CoreError> {
        let mut results = Vec::new();
        let search_terms = self.extract_search_terms(&query.text);
        
        // Search in keyword indexes
        let indexes = self.search_indexes.read().unwrap();
        for index in indexes.values() {
            if index.index_type == SearchIndexType::Keyword || 
               index.index_type == SearchIndexType::Hybrid {
                let index_results = self.search_keyword_index(&index.keyword_index, &search_terms);
                results.extend(index_results);
            }
        }
        
        Ok(results)
    }

    /// Perform fuzzy search
    async fn fuzzy_search(&self, query: &Query) -> Result<Vec<QueryResult>, CoreError> {
        let mut results = Vec::new();
        let search_terms = self.extract_search_terms(&query.text);
        
        // Use n-gram index for fuzzy matching
        let indexes = self.search_indexes.read().unwrap();
        for index in indexes.values() {
            let fuzzy_results = self.search_fuzzy_index(&index.keyword_index, &search_terms);
            results.extend(fuzzy_results);
        }
        
        Ok(results)
    }

    /// Perform regex search
    async fn regex_search(&self, query: &Query) -> Result<Vec<QueryResult>, CoreError> {
        let mut results = Vec::new();
        
        // Compile regex pattern
        let regex = match regex::Regex::new(&query.text) {
            Ok(regex) => regex,
            Err(e) => {
                return Err(CoreError::ValidationError(
                    format!("Invalid regex pattern: {}", e),
                ));
            }
        };
        
        // Search through entities
        let indexes = self.search_indexes.read().unwrap();
        for index in indexes.values() {
            for entity in index.entities.values() {
                if regex.is_match(&entity.name) || 
                   regex.is_match(&entity.qualified_name) ||
                   entity.signature.as_ref().map_or(false, |sig| regex.is_match(sig)) {
                    
                    let result = QueryResult::new(
                        entity.id.clone(),
                        1.0, // Regex matches get full score
                        entity.file_path.clone(),
                    );
                    results.push(result);
                }
            }
        }
        
        Ok(results)
    }

    /// Perform exact search
    async fn exact_search(&self, query: &Query) -> Result<Vec<QueryResult>, CoreError> {
        let mut results = Vec::new();
        let search_text = query.text.to_lowercase();
        
        // Search for exact matches
        let indexes = self.search_indexes.read().unwrap();
        for index in indexes.values() {
            for entity in index.entities.values() {
                let score = if entity.name.to_lowercase() == search_text {
                    1.0
                } else if entity.qualified_name.to_lowercase() == search_text {
                    0.9
                } else if entity.signature.as_ref()
                    .map_or(false, |sig| sig.to_lowercase().contains(&search_text)) {
                    0.8
                } else {
                    continue;
                };
                
                let result = QueryResult::new(
                    entity.id.clone(),
                    score,
                    entity.file_path.clone(),
                );
                results.push(result);
            }
        }
        
        Ok(results)
    }

    /// Perform structural search (AST-based)
    async fn structural_search(&self, query: &Query) -> Result<Vec<QueryResult>, CoreError> {
        // Structural search would analyze AST patterns
        // For now, return empty results
        Ok(Vec::new())
    }

    /// Perform hybrid search (combining multiple methods)
    async fn hybrid_search(&self, query: &Query) -> Result<Vec<QueryResult>, CoreError> {
        let mut all_results = Vec::new();
        
        // Combine semantic and keyword search
        let semantic_results = self.semantic_search(query).await?;
        let keyword_results = self.keyword_search(query).await?;
        
        // Merge and deduplicate results
        let mut seen_entities = std::collections::HashSet::new();
        
        // Add semantic results with higher weight
        for mut result in semantic_results {
            if seen_entities.insert(result.entity_id.clone()) {
                result.score *= 1.2; // Boost semantic results
                all_results.push(result);
            }
        }
        
        // Add keyword results
        for result in keyword_results {
            if seen_entities.insert(result.entity_id.clone()) {
                all_results.push(result);
            }
        }
        
        Ok(all_results)
    }

    /// Extract search terms from query text
    fn extract_search_terms(&self, text: &str) -> Vec<String> {
        text.split_whitespace()
            .map(|term| term.to_lowercase())
            .filter(|term| term.len() > 1)
            .collect()
    }

    /// Search keyword index
    fn search_keyword_index(
        &self,
        index: &KeywordIndex,
        terms: &[String],
    ) -> Vec<QueryResult> {
        let mut results = Vec::new();
        let mut entity_scores: HashMap<String, f64> = HashMap::new();
        
        for term in terms {
            if let Some(entity_ids) = index.word_to_entities.get(term) {
                for entity_id in entity_ids {
                    *entity_scores.entry(entity_id.clone()).or_insert(0.0) += 1.0;
                }
            }
        }
        
        for (entity_id, score) in entity_scores {
            let normalized_score = score / terms.len() as f64;
            let result = QueryResult::new(
                entity_id,
                normalized_score as f32,
                "unknown".to_string(), // Would be looked up in real implementation
            );
            results.push(result);
        }
        
        results
    }

    /// Search fuzzy index using n-grams
    fn search_fuzzy_index(
        &self,
        index: &KeywordIndex,
        terms: &[String],
    ) -> Vec<QueryResult> {
        let mut results = Vec::new();
        
        for term in terms {
            let ngrams = self.generate_ngrams(term, 3);
            let mut entity_scores: HashMap<String, f64> = HashMap::new();
            
            for ngram in ngrams {
                if let Some(entity_ids) = index.ngram_index.get(&ngram) {
                    for entity_id in entity_ids {
                        *entity_scores.entry(entity_id.clone()).or_insert(0.0) += 1.0;
                    }
                }
            }
            
            for (entity_id, score) in entity_scores {
                let result = QueryResult::new(
                    entity_id,
                    (score / term.len() as f64) as f32,
                    "unknown".to_string(),
                );
                results.push(result);
            }
        }
        
        results
    }

    /// Generate n-grams for fuzzy search
    fn generate_ngrams(&self, text: &str, n: usize) -> Vec<String> {
        if text.len() < n {
            return vec![text.to_string()];
        }
        
        let mut ngrams = Vec::new();
        for i in 0..=text.len() - n {
            ngrams.push(text[i..i + n].to_string());
        }
        ngrams
    }

    /// Apply filters to search results
    async fn apply_filters(
        &self,
        mut results: Vec<QueryResult>,
        filters: &QueryFilters,
    ) -> Result<Vec<QueryResult>, CoreError> {
        // In a real implementation, this would filter based on:
        // - Languages
        // - File paths
        // - Entity types
        // - Codebase IDs
        // - Date ranges
        // - etc.
        
        Ok(results)
    }

    /// Sort search results
    fn sort_results(&self, results: &mut Vec<QueryResult>, sort_by: &SortBy) {
        match sort_by {
            SortBy::Relevance => {
                results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
            }
            SortBy::Name => {
                results.sort_by(|a, b| a.entity_id.cmp(&b.entity_id));
            }
            SortBy::FilePath => {
                results.sort_by(|a, b| a.file_path.cmp(&b.file_path));
            }
            _ => {
                // Default to relevance
                results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
            }
        }
    }

    /// Get cached search result
    async fn get_cached_result(&self, query: &Query) -> Result<QueryResponse, CoreError> {
        let cache_key = self.generate_cache_key(query);
        
        // Try to get from cache service
        // For now, return error to indicate cache miss
        Err(CoreError::NotFound("Cache miss".to_string()))
    }

    /// Cache search result
    async fn cache_result(&self, query: &Query, response: &QueryResponse) -> Result<(), CoreError> {
        let cache_key = self.generate_cache_key(query);
        
        // Serialize response and store in cache
        // For now, just return Ok
        Ok(())
    }

    /// Generate cache key for query
    fn generate_cache_key(&self, query: &Query) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        query.text.hash(&mut hasher);
        query.query_type.hash(&mut hasher);
        // Hash other relevant query parameters
        
        format!("search:{:x}", hasher.finish())
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

    /// Update search metrics after query execution
    async fn update_search_metrics(
        &self,
        query: &Query,
        response: &QueryResponse,
        execution_time: std::time::Duration,
    ) {
        let mut metrics = self.metrics.write().unwrap();
        
        metrics.total_queries += 1;
        
        if response.results.is_empty() && response.stats.results_count == 0 {
            metrics.failed_queries += 1;
        } else {
            metrics.successful_queries += 1;
        }
        
        // Update query type counters
        match query.query_type {
            QueryType::Semantic => metrics.semantic_queries += 1,
            QueryType::Keyword => metrics.keyword_queries += 1,
            QueryType::Fuzzy => metrics.fuzzy_queries += 1,
            QueryType::Regex => metrics.regex_queries += 1,
            _ => {}
        }
        
        // Update average query time
        let query_time_ms = execution_time.as_millis() as f64;
        if metrics.total_queries == 1 {
            metrics.average_query_time_ms = query_time_ms;
        } else {
            metrics.average_query_time_ms = 
                (metrics.average_query_time_ms * (metrics.total_queries - 1) as f64 + query_time_ms) 
                / metrics.total_queries as f64;
        }
        
        // Update average results count
        let results_count = response.results.len() as f64;
        if metrics.total_queries == 1 {
            metrics.average_results_count = results_count;
        } else {
            metrics.average_results_count = 
                (metrics.average_results_count * (metrics.total_queries - 1) as f64 + results_count) 
                / metrics.total_queries as f64;
        }
    }

    /// Get search suggestions
    pub async fn get_suggestions(&self, partial_query: &str) -> Result<Vec<SearchSuggestion>, CoreError> {
        let mut suggestions = Vec::new();
        
        // Generate autocomplete suggestions
        suggestions.extend(self.generate_autocomplete_suggestions(partial_query).await?);
        
        // Generate "did you mean" suggestions
        suggestions.extend(self.generate_did_you_mean_suggestions(partial_query).await?);
        
        // Generate related query suggestions
        suggestions.extend(self.generate_related_suggestions(partial_query).await?);
        
        // Sort by confidence
        suggestions.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());
        
        // Limit to top 10 suggestions
        suggestions.truncate(10);
        
        Ok(suggestions)
    }

    /// Generate autocomplete suggestions
    async fn generate_autocomplete_suggestions(
        &self,
        partial_query: &str,
    ) -> Result<Vec<SearchSuggestion>, CoreError> {
        let mut suggestions = Vec::new();
        
        // Search through entity names for matches
        let indexes = self.search_indexes.read().unwrap();
        for index in indexes.values() {
            for entity in index.entities.values() {
                if entity.name.to_lowercase().starts_with(&partial_query.to_lowercase()) {
                    suggestions.push(SearchSuggestion {
                        suggestion: entity.name.clone(),
                        suggestion_type: SuggestionType::Autocomplete,
                        confidence: 0.9,
                        estimated_results: 1,
                    });
                }
            }
        }
        
        // Deduplicate and limit
        suggestions.sort_by(|a, b| a.suggestion.cmp(&b.suggestion));
        suggestions.dedup_by(|a, b| a.suggestion == b.suggestion);
        suggestions.truncate(5);
        
        Ok(suggestions)
    }

    /// Generate "did you mean" suggestions
    async fn generate_did_you_mean_suggestions(
        &self,
        query: &str,
    ) -> Result<Vec<SearchSuggestion>, CoreError> {
        let mut suggestions = Vec::new();
        
        // Use string similarity to find close matches
        let indexes = self.search_indexes.read().unwrap();
        for index in indexes.values() {
            for entity in index.entities.values() {
                let similarity = crate::utils::string_similarity(query, &entity.name);
                if similarity > 0.7 && similarity < 1.0 {
                    suggestions.push(SearchSuggestion {
                        suggestion: entity.name.clone(),
                        suggestion_type: SuggestionType::DidYouMean,
                        confidence: similarity,
                        estimated_results: 1,
                    });
                }
            }
        }
        
        suggestions.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());
        suggestions.truncate(3);
        
        Ok(suggestions)
    }

    /// Generate related query suggestions
    async fn generate_related_suggestions(
        &self,
        query: &str,
    ) -> Result<Vec<SearchSuggestion>, CoreError> {
        let mut suggestions = Vec::new();
        
        // Analyze query history for related queries
        let history = self.query_history.read().unwrap();
        for past_query in history.iter().rev().take(100) {
            let similarity = crate::utils::string_similarity(query, &past_query.text);
            if similarity > 0.3 && similarity < 0.9 {
                suggestions.push(SearchSuggestion {
                    suggestion: past_query.text.clone(),
                    suggestion_type: SuggestionType::RelatedQuery,
                    confidence: similarity * 0.8, // Lower confidence for related queries
                    estimated_results: 0, // Would be calculated in real implementation
                });
            }
        }
        
        suggestions.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());
        suggestions.truncate(2);
        
        Ok(suggestions)
    }

    /// Get search metrics
    pub async fn get_metrics(&self) -> SearchMetrics {
        self.metrics.read().unwrap().clone()
    }

    /// Get recent search queries
    pub async fn get_recent_queries(&self, limit: usize) -> Vec<Query> {
        let history = self.query_history.read().unwrap();
        history.iter().rev().take(limit).cloned().collect()
    }

    /// Add or update search index
    pub async fn update_search_index(
        &self,
        codebase_id: &str,
        entities: Vec<CodeEntity>,
        embeddings: Vec<Embedding>,
    ) -> Result<(), CoreError> {
        let index_id = format!("index_{}", codebase_id);
        
        // Build keyword index
        let mut keyword_index = KeywordIndex::default();
        
        for entity in &entities {
            let words = crate::utils::extract_words(&entity.name);
            keyword_index.entity_to_words.insert(entity.id.clone(), words.clone());
            
            for word in words {
                keyword_index.word_to_entities
                    .entry(word.clone())
                    .or_insert_with(Vec::new)
                    .push(entity.id.clone());
                
                // Generate n-grams for fuzzy search
                let ngrams = self.generate_ngrams(&word, 3);
                for ngram in ngrams {
                    keyword_index.ngram_index
                        .entry(ngram)
                        .or_insert_with(Vec::new)
                        .push(entity.id.clone());
                }
            }
        }
        
        // Create search index
        let search_index = SearchIndex {
            id: index_id.clone(),
            codebase_id: codebase_id.to_string(),
            index_type: SearchIndexType::Hybrid,
            entities: entities.into_iter().map(|e| (e.id.clone(), e)).collect(),
            embeddings: embeddings.into_iter().map(|e| (e.id.clone(), e)).collect(),
            keyword_index,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        
        // Store index
        {
            let mut indexes = self.search_indexes.write().unwrap();
            indexes.insert(index_id, search_index);
        }
        
        Ok(())
    }

    /// Remove search index
    pub async fn remove_search_index(&self, codebase_id: &str) -> Result<(), CoreError> {
        let index_id = format!("index_{}", codebase_id);
        
        let mut indexes = self.search_indexes.write().unwrap();
        indexes.remove(&index_id);
        
        Ok(())
    }
}

#[async_trait]
impl Service for SearchService {
    async fn initialize(&self) -> Result<(), CoreError> {
        // Initialize search indexes
        // In a real implementation, this would load existing indexes
        Ok(())
    }

    async fn shutdown(&self) -> Result<(), CoreError> {
        // Save search indexes and metrics
        // In a real implementation, this would persist data
        Ok(())
    }

    async fn health_check(&self) -> ServiceHealth {
        let metrics = self.get_metrics().await;
        
        // Check if search is functioning properly
        if metrics.total_queries > 0 {
            let success_rate = metrics.successful_queries as f64 / metrics.total_queries as f64;
            if success_rate < 0.8 {
                return ServiceHealth::degraded(
                    format!("Low success rate: {:.1}%", success_rate * 100.0),
                );
            }
        }
        
        // Check average query time
        if metrics.average_query_time_ms > 5000.0 {
            return ServiceHealth::degraded(
                format!("High average query time: {:.1}ms", metrics.average_query_time_ms),
            );
        }
        
        ServiceHealth::healthy()
    }

    fn name(&self) -> &'static str {
        "SearchService"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn create_test_service() -> SearchService {
        let config_service = Arc::new(ConfigurationService::new().await.unwrap());
        let embedding_service = Arc::new(EmbeddingService::new(config_service.clone()).await.unwrap());
        let cache_service = Arc::new(CacheService::new(config_service.clone()).await.unwrap());
        
        SearchService::new(config_service, embedding_service, cache_service).await.unwrap()
    }

    #[tokio::test]
    async fn test_search_service_creation() {
        let service = create_test_service().await;
        assert_eq!(service.name(), "SearchService");
    }

    #[tokio::test]
    async fn test_extract_search_terms() {
        let service = create_test_service().await;
        let terms = service.extract_search_terms("hello world test");
        assert_eq!(terms, vec!["hello", "world", "test"]);
    }

    #[tokio::test]
    async fn test_generate_ngrams() {
        let service = create_test_service().await;
        let ngrams = service.generate_ngrams("hello", 3);
        assert_eq!(ngrams, vec!["hel", "ell", "llo"]);
    }

    #[tokio::test]
    async fn test_search_metrics() {
        let service = create_test_service().await;
        let metrics = service.get_metrics().await;
        assert_eq!(metrics.total_queries, 0);
    }

    #[tokio::test]
    async fn test_generate_cache_key() {
        let service = create_test_service().await;
        let query = Query::semantic("test".to_string(), "user".to_string());
        let key1 = service.generate_cache_key(&query);
        let key2 = service.generate_cache_key(&query);
        assert_eq!(key1, key2);
    }
}