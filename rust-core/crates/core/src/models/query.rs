//! Query model for search and filtering operations

use super::{ModelResult, Validate, Timestamped, JsonSerializable};
use crate::errors::CoreError;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Represents a search query with filters and options
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Query {
    /// Unique identifier for the query
    pub id: String,
    /// The search text or pattern
    pub text: String,
    /// Type of query (semantic, keyword, regex, etc.)
    pub query_type: QueryType,
    /// Filters to apply to the search
    pub filters: QueryFilters,
    /// Search options and parameters
    pub options: QueryOptions,
    /// Results limit
    pub limit: Option<usize>,
    /// Results offset for pagination
    pub offset: Option<usize>,
    /// Query execution context
    pub context: QueryContext,
    /// When the query was created
    pub created_at: DateTime<Utc>,
    /// When the query was last executed
    pub executed_at: Option<DateTime<Utc>>,
}

/// Types of queries supported
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum QueryType {
    /// Semantic search using embeddings
    Semantic,
    /// Keyword-based search
    Keyword,
    /// Regular expression search
    Regex,
    /// Fuzzy text search
    Fuzzy,
    /// Exact match search
    Exact,
    /// Code structure search (AST-based)
    Structural,
    /// Combined search using multiple methods
    Hybrid,
}

/// Filters that can be applied to queries
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct QueryFilters {
    /// Filter by programming languages
    pub languages: Option<Vec<String>>,
    /// Filter by file paths (glob patterns)
    pub file_paths: Option<Vec<String>>,
    /// Filter by entity types
    pub entity_types: Option<Vec<String>>,
    /// Filter by codebase IDs
    pub codebase_ids: Option<Vec<String>>,
    /// Filter by file size range (min, max in bytes)
    pub file_size_range: Option<(u64, u64)>,
    /// Filter by date range (created_at)
    pub date_range: Option<(DateTime<Utc>, DateTime<Utc>)>,
    /// Filter by visibility (public, private, etc.)
    pub visibility: Option<Vec<String>>,
    /// Custom filters as key-value pairs
    pub custom: HashMap<String, String>,
}

/// Options for query execution
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QueryOptions {
    /// Include code snippets in results
    pub include_snippets: bool,
    /// Include relationships in results
    pub include_relationships: bool,
    /// Include metadata in results
    pub include_metadata: bool,
    /// Similarity threshold for semantic search (0.0 to 1.0)
    pub similarity_threshold: Option<f32>,
    /// Maximum snippet length in characters
    pub max_snippet_length: Option<usize>,
    /// Highlight matches in snippets
    pub highlight_matches: bool,
    /// Sort order for results
    pub sort_by: SortBy,
    /// Whether to use cache for results
    pub use_cache: bool,
    /// Timeout for query execution in seconds
    pub timeout_seconds: Option<u64>,
}

/// Sort options for query results
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SortBy {
    /// Sort by relevance score (default)
    Relevance,
    /// Sort by creation date
    CreatedAt,
    /// Sort by last modified date
    ModifiedAt,
    /// Sort by file path
    FilePath,
    /// Sort by entity name
    Name,
    /// Sort by file size
    FileSize,
    /// Sort by language
    Language,
}

/// Context information for query execution
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QueryContext {
    /// User or system that initiated the query
    pub initiator: String,
    /// Session ID for tracking related queries
    pub session_id: Option<String>,
    /// Request ID for tracing
    pub request_id: Option<String>,
    /// Additional context metadata
    pub metadata: HashMap<String, String>,
}

/// Query execution statistics
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QueryStats {
    /// Total execution time in milliseconds
    pub execution_time_ms: u64,
    /// Number of results found
    pub results_count: usize,
    /// Number of files searched
    pub files_searched: usize,
    /// Whether results were served from cache
    pub from_cache: bool,
    /// Index version used for search
    pub index_version: Option<String>,
    /// Memory usage during query execution
    pub memory_usage_bytes: Option<u64>,
}

/// Query result item
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QueryResult {
    /// Unique identifier for the result
    pub id: String,
    /// Entity ID that matched
    pub entity_id: String,
    /// Relevance score (0.0 to 1.0)
    pub score: f32,
    /// Code snippet if requested
    pub snippet: Option<String>,
    /// Highlighted snippet if requested
    pub highlighted_snippet: Option<String>,
    /// File path of the match
    pub file_path: String,
    /// Line number of the match
    pub line_number: Option<usize>,
    /// Column number of the match
    pub column_number: Option<usize>,
    /// Match context (surrounding code)
    pub context: Option<String>,
    /// Additional metadata
    pub metadata: HashMap<String, String>,
}

/// Complete query execution result
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QueryResponse {
    /// The original query
    pub query: Query,
    /// Query execution statistics
    pub stats: QueryStats,
    /// List of results
    pub results: Vec<QueryResult>,
    /// Whether there are more results available
    pub has_more: bool,
    /// Total count of all matching results (before pagination)
    pub total_count: usize,
    /// Next page token for pagination
    pub next_page_token: Option<String>,
}

impl Query {
    /// Create a new query
    pub fn new(
        text: String,
        query_type: QueryType,
        initiator: String,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            text,
            query_type,
            filters: QueryFilters::default(),
            options: QueryOptions::default(),
            limit: None,
            offset: None,
            context: QueryContext {
                initiator,
                session_id: None,
                request_id: None,
                metadata: HashMap::new(),
            },
            created_at: Utc::now(),
            executed_at: None,
        }
    }

    /// Create a semantic search query
    pub fn semantic(text: String, initiator: String) -> Self {
        Self::new(text, QueryType::Semantic, initiator)
    }

    /// Create a keyword search query
    pub fn keyword(text: String, initiator: String) -> Self {
        Self::new(text, QueryType::Keyword, initiator)
    }

    /// Create a regex search query
    pub fn regex(pattern: String, initiator: String) -> Self {
        Self::new(pattern, QueryType::Regex, initiator)
    }

    /// Add language filter
    pub fn with_languages(mut self, languages: Vec<String>) -> Self {
        self.filters.languages = Some(languages);
        self
    }

    /// Add file path filter
    pub fn with_file_paths(mut self, paths: Vec<String>) -> Self {
        self.filters.file_paths = Some(paths);
        self
    }

    /// Add entity type filter
    pub fn with_entity_types(mut self, types: Vec<String>) -> Self {
        self.filters.entity_types = Some(types);
        self
    }

    /// Add codebase filter
    pub fn with_codebases(mut self, codebase_ids: Vec<String>) -> Self {
        self.filters.codebase_ids = Some(codebase_ids);
        self
    }

    /// Set result limit
    pub fn with_limit(mut self, limit: usize) -> Self {
        self.limit = Some(limit);
        self
    }

    /// Set result offset
    pub fn with_offset(mut self, offset: usize) -> Self {
        self.offset = Some(offset);
        self
    }

    /// Set similarity threshold for semantic search
    pub fn with_similarity_threshold(mut self, threshold: f32) -> Self {
        self.options.similarity_threshold = Some(threshold.clamp(0.0, 1.0));
        self
    }

    /// Enable snippet inclusion
    pub fn with_snippets(mut self, max_length: Option<usize>) -> Self {
        self.options.include_snippets = true;
        self.options.max_snippet_length = max_length;
        self
    }

    /// Enable relationship inclusion
    pub fn with_relationships(mut self) -> Self {
        self.options.include_relationships = true;
        self
    }

    /// Set sort order
    pub fn sort_by(mut self, sort: SortBy) -> Self {
        self.options.sort_by = sort;
        self
    }

    /// Set session ID
    pub fn with_session(mut self, session_id: String) -> Self {
        self.context.session_id = Some(session_id);
        self
    }

    /// Set request ID
    pub fn with_request_id(mut self, request_id: String) -> Self {
        self.context.request_id = Some(request_id);
        self
    }

    /// Mark query as executed
    pub fn mark_executed(&mut self) {
        self.executed_at = Some(Utc::now());
    }

    /// Check if query has been executed
    pub fn is_executed(&self) -> bool {
        self.executed_at.is_some()
    }

    /// Get query age in seconds
    pub fn age_seconds(&self) -> i64 {
        (Utc::now() - self.created_at).num_seconds()
    }

    /// Check if query is semantic search
    pub fn is_semantic(&self) -> bool {
        matches!(self.query_type, QueryType::Semantic | QueryType::Hybrid)
    }

    /// Check if query has filters
    pub fn has_filters(&self) -> bool {
        self.filters.languages.is_some()
            || self.filters.file_paths.is_some()
            || self.filters.entity_types.is_some()
            || self.filters.codebase_ids.is_some()
            || self.filters.file_size_range.is_some()
            || self.filters.date_range.is_some()
            || self.filters.visibility.is_some()
            || !self.filters.custom.is_empty()
    }

    /// Get effective limit (with default)
    pub fn effective_limit(&self) -> usize {
        self.limit.unwrap_or(50)
    }

    /// Get effective offset (with default)
    pub fn effective_offset(&self) -> usize {
        self.offset.unwrap_or(0)
    }
}

impl Default for QueryOptions {
    fn default() -> Self {
        Self {
            include_snippets: false,
            include_relationships: false,
            include_metadata: true,
            similarity_threshold: None,
            max_snippet_length: Some(200),
            highlight_matches: true,
            sort_by: SortBy::Relevance,
            use_cache: true,
            timeout_seconds: Some(30),
        }
    }
}

impl QueryResult {
    /// Create a new query result
    pub fn new(
        entity_id: String,
        score: f32,
        file_path: String,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            entity_id,
            score: score.clamp(0.0, 1.0),
            snippet: None,
            highlighted_snippet: None,
            file_path,
            line_number: None,
            column_number: None,
            context: None,
            metadata: HashMap::new(),
        }
    }

    /// Set snippet
    pub fn with_snippet(mut self, snippet: String) -> Self {
        self.snippet = Some(snippet);
        self
    }

    /// Set highlighted snippet
    pub fn with_highlighted_snippet(mut self, highlighted: String) -> Self {
        self.highlighted_snippet = Some(highlighted);
        self
    }

    /// Set line and column numbers
    pub fn with_position(mut self, line: usize, column: Option<usize>) -> Self {
        self.line_number = Some(line);
        self.column_number = column;
        self
    }

    /// Set context
    pub fn with_context(mut self, context: String) -> Self {
        self.context = Some(context);
        self
    }

    /// Add metadata
    pub fn with_metadata(mut self, key: String, value: String) -> Self {
        self.metadata.insert(key, value);
        self
    }

    /// Check if result has high relevance
    pub fn is_highly_relevant(&self) -> bool {
        self.score >= 0.8
    }

    /// Check if result has snippet
    pub fn has_snippet(&self) -> bool {
        self.snippet.is_some()
    }
}

impl Validate for Query {
    fn validate(&self) -> Result<(), CoreError> {
        if self.text.trim().is_empty() {
            return Err(CoreError::ValidationError(
                "Query text cannot be empty".to_string(),
            ));
        }

        if self.text.len() > 10000 {
            return Err(CoreError::ValidationError(
                "Query text too long (max 10000 characters)".to_string(),
            ));
        }

        if let Some(threshold) = self.options.similarity_threshold {
            if !(0.0..=1.0).contains(&threshold) {
                return Err(CoreError::ValidationError(
                    "Similarity threshold must be between 0.0 and 1.0".to_string(),
                ));
            }
        }

        if let Some(limit) = self.limit {
            if limit == 0 || limit > 10000 {
                return Err(CoreError::ValidationError(
                    "Limit must be between 1 and 10000".to_string(),
                ));
            }
        }

        if let Some(timeout) = self.options.timeout_seconds {
            if timeout == 0 || timeout > 300 {
                return Err(CoreError::ValidationError(
                    "Timeout must be between 1 and 300 seconds".to_string(),
                ));
            }
        }

        if self.context.initiator.trim().is_empty() {
            return Err(CoreError::ValidationError(
                "Query initiator cannot be empty".to_string(),
            ));
        }

        Ok(())
    }
}

impl Timestamped for Query {
    fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    fn updated_at(&self) -> Option<DateTime<Utc>> {
        self.executed_at
    }
}

// JsonSerializable is automatically implemented for all types via the blanket impl in mod.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_query_creation() {
        let query = Query::semantic("test function".to_string(), "user123".to_string());
        
        assert_eq!(query.text, "test function");
        assert_eq!(query.query_type, QueryType::Semantic);
        assert_eq!(query.context.initiator, "user123");
        assert!(!query.is_executed());
        assert!(query.validate().is_ok());
    }

    #[test]
    fn test_query_builder() {
        let query = Query::keyword("function".to_string(), "user".to_string())
            .with_languages(vec!["rust".to_string(), "typescript".to_string()])
            .with_limit(100)
            .with_snippets(Some(300))
            .sort_by(SortBy::Relevance);

        assert_eq!(query.filters.languages, Some(vec!["rust".to_string(), "typescript".to_string()]));
        assert_eq!(query.limit, Some(100));
        assert!(query.options.include_snippets);
        assert_eq!(query.options.max_snippet_length, Some(300));
        assert!(query.has_filters());
    }

    #[test]
    fn test_query_validation() {
        let mut query = Query::semantic("".to_string(), "user".to_string());
        assert!(query.validate().is_err());

        query.text = "valid query".to_string();
        assert!(query.validate().is_ok());

        query.limit = Some(0);
        assert!(query.validate().is_err());

        query.limit = Some(50);
        query.options.similarity_threshold = Some(1.5);
        assert!(query.validate().is_err());
    }

    #[test]
    fn test_query_execution() {
        let mut query = Query::semantic("test".to_string(), "user".to_string());
        assert!(!query.is_executed());
        
        query.mark_executed();
        assert!(query.is_executed());
        assert!(query.age_seconds() >= 0);
    }

    #[test]
    fn test_query_result() {
        let result = QueryResult::new(
            "entity123".to_string(),
            0.95,
            "src/main.rs".to_string(),
        )
        .with_snippet("fn main() {}".to_string())
        .with_position(10, Some(5))
        .with_metadata("language".to_string(), "rust".to_string());

        assert_eq!(result.entity_id, "entity123");
        assert_eq!(result.score, 0.95);
        assert!(result.is_highly_relevant());
        assert!(result.has_snippet());
        assert_eq!(result.line_number, Some(10));
        assert_eq!(result.column_number, Some(5));
        assert_eq!(result.metadata.get("language"), Some(&"rust".to_string()));
    }

    #[test]
    fn test_query_types() {
        let semantic = Query::semantic("test".to_string(), "user".to_string());
        assert!(semantic.is_semantic());

        let keyword = Query::keyword("test".to_string(), "user".to_string());
        assert!(!keyword.is_semantic());

        let regex = Query::regex(r"fn\s+\w+".to_string(), "user".to_string());
        assert_eq!(regex.query_type, QueryType::Regex);
    }

    #[test]
    fn test_query_filters() {
        let query = Query::semantic("test".to_string(), "user".to_string())
            .with_languages(vec!["rust".to_string()])
            .with_file_paths(vec!["src/**/*.rs".to_string()])
            .with_entity_types(vec!["function".to_string()])
            .with_codebases(vec!["codebase1".to_string()]);

        assert!(query.has_filters());
        assert_eq!(query.filters.languages, Some(vec!["rust".to_string()]));
        assert_eq!(query.filters.file_paths, Some(vec!["src/**/*.rs".to_string()]));
        assert_eq!(query.filters.entity_types, Some(vec!["function".to_string()]));
        assert_eq!(query.filters.codebase_ids, Some(vec!["codebase1".to_string()]));
    }

    #[test]
    fn test_query_options() {
        let options = QueryOptions::default();
        assert!(!options.include_snippets);
        assert!(!options.include_relationships);
        assert!(options.include_metadata);
        assert!(options.highlight_matches);
        assert_eq!(options.sort_by, SortBy::Relevance);
        assert!(options.use_cache);
        assert_eq!(options.timeout_seconds, Some(30));
    }

    #[test]
    fn test_effective_values() {
        let query = Query::semantic("test".to_string(), "user".to_string());
        assert_eq!(query.effective_limit(), 50);
        assert_eq!(query.effective_offset(), 0);

        let query_with_values = query.with_limit(100).with_offset(20);
        assert_eq!(query_with_values.effective_limit(), 100);
        assert_eq!(query_with_values.effective_offset(), 20);
    }
}