use crate::models::query::Query;
use crate::models::search_result::SearchResult;
use crate::models::code_entity::CodeEntity;
use crate::services::query_cache::{QueryCache, QueryCacheConfig};
use std::collections::HashMap;
use std::sync::Arc;
use anyhow::Result;

pub struct SearchService {
    query_cache: Arc<QueryCache>,
    enable_caching: bool,
    enable_fuzzy_matching: bool,
    similarity_threshold: f64,
}

impl SearchService {
    pub fn new() -> Self {
        Self {
            query_cache: Arc::new(QueryCache::with_default_config()),
            enable_caching: true,
            enable_fuzzy_matching: true,
            similarity_threshold: 0.85,
        }
    }
    
    pub fn with_cache_config(cache_config: QueryCacheConfig) -> Self {
        Self {
            query_cache: Arc::new(QueryCache::new(cache_config)),
            enable_caching: true,
            enable_fuzzy_matching: true,
            similarity_threshold: 0.85,
        }
    }
    
    pub fn disable_caching(&mut self) {
        self.enable_caching = false;
    }
    
    pub fn set_similarity_threshold(&mut self, threshold: f64) {
        self.similarity_threshold = threshold;
    }
    
    pub async fn search(&self, query: &Query) -> Result<Vec<SearchResult>> {
        let start_time = std::time::Instant::now();
        
        // Check cache first if enabled
        if self.enable_caching {
            if let Some(cached_result) = self.query_cache.get(query) {
                // Update query with cache hit info
                return Ok(cached_result.results);
            }
            
            // Try fuzzy matching for similar queries
            if self.enable_fuzzy_matching {
                if let Some(similar_result) = self.query_cache.find_similar(query, self.similarity_threshold) {
                    return Ok(similar_result.results);
                }
            }
        }
        
        // Perform actual search
        let results = self.perform_search(query).await?;
        let execution_time = start_time.elapsed().as_millis() as u64;
        
        // Cache the results if enabled
        if self.enable_caching {
            self.query_cache.put(query, results.clone(), execution_time);
        }
        
        Ok(results)
    }
    
    async fn perform_search(&self, query: &Query) -> Result<Vec<SearchResult>> {
        // Determine search strategy based on query type and intent
        match query.intent {
            Some(crate::models::query::QueryIntent::FindFunction) => {
                self.keyword_search(query).await
            },
            Some(crate::models::query::QueryIntent::ExplainCode) => {
                self.semantic_search(query).await
            },
            Some(crate::models::query::QueryIntent::TraceFlow) => {
                self.trace_search(query).await
            },
            Some(crate::models::query::QueryIntent::SecurityAudit) => {
                self.security_search(query).await
            },
            _ => {
                self.hybrid_search(query).await
            }
        }
    }
    
    pub async fn keyword_search(&self, query: &Query) -> Result<Vec<SearchResult>> {
        // Fast keyword-based search using inverted index
        // This would typically use a search engine like Tantivy
        
        let keywords = self.extract_keywords(&query.query_text);
        let mut results = Vec::new();
        
        // Mock implementation - replace with actual search logic
        for (i, keyword) in keywords.iter().enumerate() {
            if i >= 10 { break; } // Limit results
            
            results.push(SearchResult {
                id: uuid::Uuid::new_v4(),
                entity_id: uuid::Uuid::new_v4(),
                file_path: format!("src/{}_{}.rs", keyword, i),
                start_line: i as i32 * 10 + 1,
                end_line: i as i32 * 10 + 5,
                code_snippet: format!("fn {}() {{ /* implementation */ }}", keyword),
                relevance_score: 0.9 - (i as f64 * 0.1),
                entity_type: crate::models::code_entity::EntityType::Function,
                context: vec![format!("Context for {}", keyword)],
                match_type: crate::models::search_result::MatchType::Keyword,
                highlights: vec![],
            });
        }
        
        Ok(results)
    }
    
    pub async fn semantic_search(&self, query: &Query) -> Result<Vec<SearchResult>> {
        // Semantic search using embeddings and vector similarity
        // This would typically use embedding models and vector databases
        
        let mut results = Vec::new();
        
        // Mock implementation - replace with actual semantic search
        results.push(SearchResult {
            id: uuid::Uuid::new_v4(),
            entity_id: uuid::Uuid::new_v4(),
            file_path: "src/semantic_match.rs".to_string(),
            start_line: 1,
            end_line: 10,
            code_snippet: "// Semantically similar code".to_string(),
            relevance_score: 0.95,
            entity_type: crate::models::code_entity::EntityType::Function,
            context: vec!["Semantic context".to_string()],
            match_type: crate::models::search_result::MatchType::Semantic,
            highlights: vec![],
        });
        
        Ok(results)
    }
    
    pub async fn hybrid_search(&self, query: &Query) -> Result<Vec<SearchResult>> {
        // Combine keyword and semantic search results
        let mut keyword_results = self.keyword_search(query).await?;
        let semantic_results = self.semantic_search(query).await?;
        
        // Merge and rank results
        keyword_results.extend(semantic_results);
        
        // Sort by relevance score
        keyword_results.sort_by(|a, b| b.relevance_score.partial_cmp(&a.relevance_score).unwrap());
        
        // Remove duplicates and limit results
        keyword_results.truncate(20);
        
        Ok(keyword_results)
    }
    
    pub async fn hybrid_search_with_limit(&self, query: &Query, limit: usize) -> Result<Vec<SearchResult>> {
        let mut results = self.hybrid_search(query).await?;
        results.truncate(limit);
        Ok(results)
    }
    
    async fn trace_search(&self, query: &Query) -> Result<Vec<SearchResult>> {
        // Specialized search for data flow tracing
        // This would analyze call graphs and data dependencies
        Ok(vec![])
    }
    
    async fn security_search(&self, query: &Query) -> Result<Vec<SearchResult>> {
        // Specialized search for security-related code patterns
        // This would use security-specific analyzers
        Ok(vec![])
    }
    
    fn extract_keywords(&self, query_text: &str) -> Vec<String> {
        // Simple keyword extraction - replace with more sophisticated NLP
        query_text
            .to_lowercase()
            .split_whitespace()
            .filter(|word| word.len() > 2) // Filter short words
            .map(|word| word.to_string())
            .collect()
    }
    
    pub fn get_search_stats(&self) -> HashMap<String, u64> {
        let cache_stats = self.query_cache.get_stats();
        let mut stats = HashMap::new();
        
        stats.insert("total_requests".to_string(), cache_stats.total_requests);
        stats.insert("cache_hits".to_string(), cache_stats.cache_hits);
        stats.insert("cache_misses".to_string(), cache_stats.cache_misses);
        stats.insert("cache_evictions".to_string(), cache_stats.evictions);
        stats.insert("cache_size".to_string(), cache_stats.current_size as u64);
        stats.insert("cache_hit_rate_percent".to_string(), (cache_stats.hit_rate() * 100.0) as u64);
        
        stats
    }
    
    pub fn clear_cache(&self) {
        self.query_cache.clear();
    }
    
    pub fn cleanup_expired_cache(&self) {
        self.query_cache.cleanup_expired();
    }
    
    pub async fn warmup_cache(&self, common_queries: Vec<Query>) {
        self.query_cache.warmup(common_queries).await;
    }
    
    pub fn get_cache_stats(&self) -> crate::services::query_cache::QueryCacheStats {
        self.query_cache.get_stats()
    }
    
    pub fn set_parallel_workers(&self, _workers: usize) {
        // Placeholder for parallel worker configuration
        // This would be used to configure parallel search execution
    }
}

impl Default for SearchService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::query::{QueryType, QueryIntent};
    use uuid::Uuid;
    
    fn create_test_query(text: &str) -> Query {
        Query {
            id: Uuid::new_v4(),
            query_text: text.to_string(),
            query_type: QueryType::NaturalLanguage,
            intent: Some(QueryIntent::FindFunction),
            codebase_id: Uuid::new_v4(),
            user_id: Some("test_user".to_string()),
            timestamp: chrono::Utc::now(),
            execution_time_ms: 0,
            result_count: 0,
            cache_hit: false,
        }
    }
    
    #[tokio::test]
    async fn test_search_with_cache() {
        let search_service = SearchService::new();
        let query = create_test_query("test function");
        
        // First search should be cache miss
        let results1 = search_service.search(&query).await.unwrap();
        
        // Second search should be cache hit
        let results2 = search_service.search(&query).await.unwrap();
        
        // Results should be the same
        assert_eq!(results1.len(), results2.len());
        
        // Check cache stats
        let stats = search_service.get_cache_stats();
        assert_eq!(stats.total_requests, 2);
        assert_eq!(stats.cache_hits, 1);
        assert_eq!(stats.cache_misses, 1);
    }
    
    #[tokio::test]
    async fn test_keyword_search() {
        let search_service = SearchService::new();
        let query = create_test_query("authentication function");
        
        let results = search_service.keyword_search(&query).await.unwrap();
        assert!(!results.is_empty());
        
        // Check that results contain expected keywords
        let has_auth_result = results.iter().any(|r| r.file_path.contains("authentication"));
        assert!(has_auth_result);
    }
    
    #[tokio::test]
    async fn test_hybrid_search() {
        let search_service = SearchService::new();
        let query = create_test_query("user authentication");
        
        let results = search_service.hybrid_search(&query).await.unwrap();
        assert!(!results.is_empty());
        
        // Results should be sorted by relevance
        for i in 1..results.len() {
            assert!(results[i-1].relevance_score >= results[i].relevance_score);
        }
    }
}