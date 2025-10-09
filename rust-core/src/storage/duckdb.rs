//! DuckDB vector store for high-performance vector operations
//!
//! Provides optimized vector storage and similarity search using DuckDB with VSS extension.
//! Ideal for local deployments requiring fast vector operations without external dependencies.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use duckdb::{Connection, params};
use tokio::sync::RwLock;
use serde_json::Value;
use chrono::{DateTime, Utc};

use crate::errors::CoreError;
use crate::models::embedding::Embedding;
use crate::models::code_entity::CodeEntity;

/// DuckDB vector store configuration
#[derive(Debug, Clone)]
pub struct DuckDbConfig {
    /// Path to the DuckDB database file
    pub database_path: PathBuf,
    /// Vector dimension for embeddings
    pub vector_dimension: usize,
    /// Index type for vectors (ivf_flat, ivf_pq, hnsw)
    pub index_type: VectorIndexType,
    /// Number of threads for operations
    pub threads: u32,
    /// Memory limit in MB
    pub memory_limit: u64,
    /// Enable extension loading
    pub enable_extensions: bool,
    /// Page size for the database
    pub page_size: u32,
}

/// Vector index types supported by DuckDB VSS
#[derive(Debug, Clone)]
pub enum VectorIndexType {
    IVFFlat,
    IVFPQ,
    HNSW,
}

impl DuckDbConfig {
    pub fn new(database_path: PathBuf, vector_dimension: usize) -> Self {
        Self {
            database_path,
            vector_dimension,
            index_type: VectorIndexType::IVFFlat,
            threads: 4,
            memory_limit: 1024, // 1GB
            enable_extensions: true,
            page_size: 4096,
        }
    }
}

/// DuckDB vector store for embeddings and similarity search
pub struct DuckDbVectorStore {
    conn: Arc<RwLock<Connection>>,
    config: DuckDbConfig,
    initialized: Arc<RwLock<bool>>,
}

impl DuckDbVectorStore {
    /// Create a new DuckDB vector store
    pub async fn new(config: DuckDbConfig) -> ModelResult<Self> {
        // Ensure parent directory exists
        if let Some(parent) = config.database_path.parent() {
            tokio::fs::create_dir_all(parent).await
                .map_err(|e| CoreError::StorageError(format!("Failed to create database directory: {}", e)))?;
        }

        // Open DuckDB connection
        let conn = Connection::open(&config.database_path)
            .map_err(|e| CoreError::StorageError(format!("Failed to open DuckDB: {}", e)))?;

        // Configure database
        Self::configure_connection(&conn, &config)?;

        let store = Self {
            conn: Arc::new(RwLock::new(conn)),
            config: config.clone(),
            initialized: Arc::new(RwLock::new(false)),
        };

        // Initialize database schema
        store.initialize().await?;

        Ok(store)
    }

    /// Configure DuckDB connection settings
    fn configure_connection(conn: &Connection, config: &DuckDbConfig) -> ModelResult<()> {
        // Set thread count
        conn.pragma_update(None, "threads", config.threads as i64)
            .map_err(|e| CoreError::StorageError(format!("Failed to set threads: {}", e)))?;

        // Set memory limit
        conn.pragma_update(None, "memory_limit", format!("{}MB", config.memory_limit))
            .map_err(|e| CoreError::StorageError(format!("Failed to set memory limit: {}", e)))?;

        // Set page size
        conn.pragma_update(None, "page_size", config.page_size as i64)
            .map_err(|e| CoreError::StorageError(format!("Failed to set page size: {}", e)))?;

        // Enable auto-optimization
        conn.pragma_update(None, "enable_progress_bar", false)
            .map_err(|e| CoreError::StorageError(format!("Failed to disable progress bar: {}", e)))?;

        conn.pragma_update(None, "auto_optimize", true)
            .map_err(|e| CoreError::StorageError(format!("Failed to enable auto optimize: {}", e)))?;

        Ok(())
    }

    /// Initialize database schema and extensions
    async fn initialize(&self) -> ModelResult<()> {
        let mut initialized = self.initialized.write().await;
        if *initialized {
            return Ok(());
        }

        let conn = self.conn.read().await;

        // Load VSS extension if available
        if self.config.enable_extensions {
            match conn.load_extension("vss") {
                Ok(_) => {
                    log::info!("VSS extension loaded successfully");
                }
                Err(e) => {
                    log::warn!("Failed to load VSS extension: {}. Vector operations will be limited.", e);
                }
            }
        }

        // Create embeddings table
        let create_table_sql = format!(
            r#"
            CREATE TABLE IF NOT EXISTS embeddings (
                id TEXT PRIMARY KEY,
                entity_id TEXT,
                content_hash TEXT NOT NULL,
                model_name TEXT NOT NULL,
                vector REAL[{}] NOT NULL,
                metadata JSON NOT NULL DEFAULT '{{}}',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP
            )
            "#,
            self.config.vector_dimension
        );

        conn.execute(&create_table_sql, [])
            .map_err(|e| CoreError::StorageError(format!("Failed to create embeddings table: {}", e)))?;

        // Create vector index if VSS extension is available
        let index_sql = match self.config.index_type {
            VectorIndexType::IVFFlat => {
                format!(
                    r#"
                    CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings
                    USING vss_ivfflat(vector, list_count=100)
                    "#
                )
            }
            VectorIndexType::IVFPQ => {
                format!(
                    r#"
                    CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings
                    USING vss_ivf_pq(vector, list_count=100, m=16)
                    "#
                )
            }
            VectorIndexType::HNSW => {
                format!(
                    r#"
                    CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings
                    USING vss_hnsw(vector, m=16)
                    "#
                )
            }
        };

        // Try to create vector index, may fail if VSS extension is not available
        if let Err(e) = conn.execute(&index_sql, []) {
            log::warn!("Failed to create vector index: {}. Vector search will use brute force.", e);
        }

        // Create supporting indexes
        let supporting_indexes = vec![
            "CREATE INDEX IF NOT EXISTS idx_embeddings_entity_id ON embeddings(entity_id)",
            "CREATE INDEX IF NOT EXISTS idx_embeddings_content_hash ON embeddings(content_hash)",
            "CREATE INDEX IF NOT EXISTS idx_embeddings_model_name ON embeddings(model_name)",
            "CREATE INDEX IF NOT EXISTS idx_embeddings_created_at ON embeddings(created_at)",
        ];

        for index_sql in supporting_indexes {
            conn.execute(index_sql, [])
                .map_err(|e| CoreError::StorageError(format!("Failed to create index: {}", e)))?;
        }

        // Create metadata table for vector search statistics
        conn.execute(
            r#"
            CREATE TABLE IF NOT EXISTS vector_search_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                search_type TEXT NOT NULL,
                query_dimension INTEGER NOT NULL,
                result_count INTEGER NOT NULL,
                execution_time_ms REAL NOT NULL,
                index_used BOOLEAN,
                timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            "#,
            [],
        )
        .map_err(|e| CoreError::StorageError(format!("Failed to create stats table: {}", e)))?;

        drop(conn);
        *initialized = true;
        Ok(())
    }

    /// Insert or update an embedding
    pub async fn upsert_embedding(&self, embedding: &Embedding) -> ModelResult<()> {
        let conn = self.conn.read().await;

        let vector_str: String = embedding.vector
            .iter()
            .map(|x| x.to_string())
            .collect::<Vec<_>>()
            .join(",");

        let metadata_json = serde_json::to_string(&embedding.metadata)
            .map_err(|e| CoreError::SerializationError(e.to_string()))?;

        conn.execute(
            r#"
            INSERT OR REPLACE INTO embeddings
            (id, entity_id, content_hash, model_name, vector, metadata, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, CURRENT_TIMESTAMP)
            "#,
            params![
                embedding.id.to_string(),
                embedding.entity_id.map(|id| id.to_string()),
                embedding.content_hash,
                embedding.model_name,
                format!("[{}]", vector_str),
                metadata_json,
            ],
        )
        .map_err(|e| CoreError::StorageError(format!("Failed to upsert embedding: {}", e)))?;

        Ok(())
    }

    /// Get embedding by ID
    pub async fn get_embedding(&self, id: &str) -> ModelResult<Option<Embedding>> {
        let conn = self.conn.read().await;

        let mut stmt = conn.prepare(
            r#"
            SELECT id, entity_id, content_hash, model_name, vector, metadata, created_at, updated_at
            FROM embeddings WHERE id = ?1
            "#
        )
        .map_err(|e| CoreError::StorageError(format!("Failed to prepare statement: {}", e)))?;

        let embedding_row = stmt.query_row(params![id], |row| {
            let vector_str: String = row.get(4)?;
            let vector_str = vector_str.trim_start_matches('[').trim_end_matches(']');
            let vector: Vec<f32> = vector_str
                .split(',')
                .filter_map(|s| s.trim().parse().ok())
                .collect();

            let metadata_json: String = row.get(5)?;
            let metadata: serde_json::Value = serde_json::from_str(&metadata_json)
                .unwrap_or_else(|_| serde_json::Value::Object(serde_json::Map::new()));

            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                vector,
                metadata,
                row.get::<_, String>(6)?,
                row.get::<_, Option<String>>(7)?,
            ))
        });

        match embedding_row {
            Ok((
                id,
                entity_id,
                content_hash,
                model_name,
                vector,
                metadata,
                created_at,
                updated_at,
            )) => {
                let embedding = Embedding {
                    id: id.parse()
                        .map_err(|e| CoreError::SerializationError(format!("Invalid UUID: {}", e)))?,
                    entity_id: entity_id.map(|id| id.parse()
                        .map_err(|e| CoreError::SerializationError(format!("Invalid UUID: {}", e)))?),
                    content_hash,
                    model_name,
                    vector,
                    dimension: vector.len(),
                    created_at: DateTime::parse_from_rfc3339(&created_at)
                        .map_err(|e| CoreError::SerializationError(format!("Invalid timestamp: {}", e)))?
                        .with_timezone(&Utc),
                    metadata,
                };
                Ok(Some(embedding))
            }
            Err(duckdb::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(CoreError::StorageError(format!("Failed to query embedding: {}", e))),
        }
    }

    /// Search for similar vectors
    pub async fn search_similar(
        &self,
        query_vector: &[f32],
        limit: usize,
        similarity_threshold: f32,
        entity_filter: Option<&str>,
    ) -> ModelResult<Vec<(String, f32, String)>> {
        let start_time = std::time::Instant::now();

        if query_vector.len() != self.config.vector_dimension {
            return Err(CoreError::StorageError(
                format!("Query vector dimension {} doesn't match expected {}",
                    query_vector.len(), self.config.vector_dimension)
            ));
        }

        let conn = self.conn.read().await;

        let query_vector_str = query_vector
            .iter()
            .map(|x| x.to_string())
            .collect::<Vec<_>>()
            .join(",");

        let (search_sql, uses_index) = self.build_search_query(entity_filter)?;

        let mut stmt = conn.prepare(&search_sql)
            .map_err(|e| CoreError::StorageError(format!("Failed to prepare search query: {}", e)))?;

        let params = if entity_filter.is_some() {
            params![format!("[{}]", query_vector_str), limit as i64, similarity_threshold, entity_filter.unwrap()]
        } else {
            params![format!("[{}]", query_vector_str), limit as i64, similarity_threshold]
        };

        let rows = stmt.query_map(params, |row| {
            Ok((
                row.get::<_, String>(0)?,  // id
                row.get::<_, f64>(1)?,     // similarity
                row.get::<_, String>(2)?,  // entity_id (optional)
            ))
        })
        .map_err(|e| CoreError::StorageError(format!("Failed to execute search query: {}", e)))?;

        let mut results = Vec::new();
        for row in rows {
            let (id, similarity, entity_id) = row
                .map_err(|e| CoreError::StorageError(format!("Failed to map search result: {}", e)))?;

            if similarity >= similarity_threshold as f64 {
                results.push((id, similarity as f32, entity_id));
            }
        }

        let execution_time = start_time.elapsed().as_millis() as f64;

        // Record search statistics
        self.record_search_stats("vector_similarity", query_vector.len(), results.len(), execution_time, uses_index).await?;

        Ok(results)
    }

    /// Build search query based on available extensions
    fn build_search_query(&self, entity_filter: Option<&str>) -> ModelResult<(String, bool)> {
        let base_query = r#"
            SELECT id,
                   CASE
                       WHEN vector_cosine_similarity = 0.0 THEN 0.5
                       ELSE vector_cosine_similarity
                   END as similarity,
                   COALESCE(entity_id, '') as entity_id
            FROM (
                SELECT id, entity_id,
                       array_distance(vector, ?1) as vector_cosine_similarity
                FROM embeddings
                "#;

        let filter_clause = if entity_filter.is_some() {
            "WHERE entity_id = ?4"
        } else {
            ""
        };

        let order_limit_clause = r#"
            ORDER BY vector_cosine_similarity ASC
            LIMIT ?2
            "#;

        let full_query = if entity_filter.is_some() {
            format!("{} {} HAVING vector_cosine_similarity <= ?3 {}",
                    base_query, filter_clause, order_limit_clause)
        } else {
            format!("{} HAVING vector_cosine_similarity <= ?3 {}",
                    base_query, order_limit_clause)
        };

        // Check if we can use VSS for optimized search
        let vss_query = if entity_filter.is_some() {
            format!(
                r#"
                SELECT id,
                       CASE
                           WHEN distance = 0.0 THEN 0.5
                           ELSE (1.0 - distance)
                       END as similarity,
                       COALESCE(entity_id, '') as entity_id
                FROM (
                    SELECT id, entity_id,
                           vss_distance_cosine(vector, ?1) as distance
                    FROM embeddings
                    WHERE entity_id = ?4
                    ORDER BY distance
                    LIMIT ?2
                )
                WHERE distance <= ?
                "#
            )
        } else {
            format!(
                r#"
                SELECT id,
                       CASE
                           WHEN distance = 0.0 THEN 0.5
                           ELSE (1.0 - distance)
                       END as similarity,
                       COALESCE(entity_id, '') as entity_id
                FROM (
                    SELECT id, entity_id,
                           vss_distance_cosine(vector, ?1) as distance
                    FROM embeddings
                    ORDER BY distance
                    LIMIT ?2
                )
                WHERE distance <= ?
                "#
            )
        };

        // Try to use VSS query first
        Ok((vss_query, true))
    }

    /// Record search statistics
    async fn record_search_stats(
        &self,
        search_type: &str,
        query_dimension: usize,
        result_count: usize,
        execution_time_ms: f64,
        index_used: bool,
    ) -> ModelResult<()> {
        let conn = self.conn.read().await;

        conn.execute(
            r#"
            INSERT INTO vector_search_stats
            (search_type, query_dimension, result_count, execution_time_ms, index_used)
            VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            params![
                search_type,
                query_dimension as i64,
                result_count as i64,
                execution_time_ms,
                index_used,
            ],
        )
        .map_err(|e| CoreError::StorageError(format!("Failed to record search stats: {}", e)))?;

        Ok(())
    }

    /// Delete embedding by ID
    pub async fn delete_embedding(&self, id: &str) -> ModelResult<bool> {
        let conn = self.conn.read().await;

        let affected_rows = conn.execute(
            "DELETE FROM embeddings WHERE id = ?1",
            params![id],
        )
        .map_err(|e| CoreError::StorageError(format!("Failed to delete embedding: {}", e)))?;

        Ok(affected_rows > 0)
    }

    /// Delete embeddings by entity ID
    pub async fn delete_embeddings_by_entity(&self, entity_id: &str) -> ModelResult<u64> {
        let conn = self.conn.read().await;

        let affected_rows = conn.execute(
            "DELETE FROM embeddings WHERE entity_id = ?1",
            params![entity_id],
        )
        .map_err(|e| CoreError::StorageError(format!("Failed to delete embeddings by entity: {}", e)))?;

        Ok(affected_rows)
    }

    /// Get statistics about the vector store
    pub async fn get_stats(&self) -> ModelResult<Value> {
        let conn = self.conn.read().await;

        // Total embeddings count
        let total_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM embeddings",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

        // Unique entities count
        let unique_entities: i64 = conn.query_row(
            "SELECT COUNT(DISTINCT entity_id) FROM embeddings WHERE entity_id IS NOT NULL",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

        // Storage size (approximate)
        let storage_size = conn.query_row(
            "SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()",
            [],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0);

        // Average vector density (non-zero values)
        let avg_density: f64 = conn.query_row(
            "SELECT AVG(CASE WHEN array_length(vector, 1) > 0 THEN 1.0 ELSE 0.0 END) FROM embeddings",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

        // Recent search performance
        let recent_searches: f64 = conn.query_row(
            "SELECT AVG(execution_time_ms) FROM vector_search_stats WHERE timestamp > datetime('now', '-1 hour')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

        let stats = serde_json::json!({
            "total_embeddings": total_count,
            "unique_entities": unique_entities,
            "vector_dimension": self.config.vector_dimension,
            "storage_size_bytes": storage_size,
            "average_vector_density": avg_density,
            "recent_avg_search_time_ms": recent_searches,
            "index_type": format!("{:?}", self.config.index_type),
            "database_path": self.config.database_path.display().to_string(),
        });

        Ok(stats)
    }

    /// Optimize the vector store
    pub async fn optimize(&self) -> ModelResult<()> {
        let conn = self.conn.read().await;

        // Run VACUUM to reclaim space
        conn.execute("VACUUM", [])
            .map_err(|e| CoreError::StorageError(format!("Failed to vacuum: {}", e)))?;

        // Run ANALYZE to update statistics
        conn.execute("ANALYZE", [])
            .map_err(|e| CoreError::StorageError(format!("Failed to analyze: {}", e)))?;

        // Checkpoint to write changes to disk
        conn.pragma_update(None, "wal_checkpoint", "TRUNCATE")
            .map_err(|e| CoreError::StorageError(format!("Failed to checkpoint: {}", e)))?;

        Ok(())
    }

    /// Check if the vector store is healthy
    pub async fn health_check(&self) -> ModelResult<bool> {
        let conn = self.conn.read().await;

        // Simple query to test connectivity
        let result = conn.query_row("SELECT 1", [], |_row| Ok(1))
            .unwrap_or(0);

        Ok(result == 1)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use uuid::Uuid;

    #[tokio::test]
    async fn test_duckdb_vector_store_creation() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_vectors.db");

        let config = DuckDbConfig::new(db_path, 384);
        let store = DuckDbVectorStore::new(config).await.unwrap();

        assert!(store.health_check().await.unwrap());
    }

    #[tokio::test]
    async fn test_embedding_upsert_and_retrieve() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_embedding.db");

        let config = DuckDbConfig::new(db_path, 4);
        let store = DuckDbVectorStore::new(config).await.unwrap();

        let embedding = Embedding {
            id: Uuid::new_v4(),
            entity_id: Some(Uuid::new_v4()),
            content_hash: "test_hash".to_string(),
            model_name: "test_model".to_string(),
            vector: vec![0.1, 0.2, 0.3, 0.4],
            dimension: 4,
            created_at: Utc::now(),
            metadata: serde_json::json!({"test": true}),
        };

        store.upsert_embedding(&embedding).await.unwrap();

        let retrieved = store.get_embedding(&embedding.id.to_string()).await.unwrap();
        assert!(retrieved.is_some());

        let retrieved_embedding = retrieved.unwrap();
        assert_eq!(retrieved_embedding.id, embedding.id);
        assert_eq!(retrieved_embedding.vector, embedding.vector);
    }

    #[tokio::test]
    async fn test_vector_similarity_search() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_search.db");

        let config = DuckDbConfig::new(db_path, 3);
        let store = DuckDbVectorStore::new(config).await.unwrap();

        // Insert test embeddings
        let embedding1 = Embedding {
            id: Uuid::new_v4(),
            entity_id: Some(Uuid::new_v4()),
            content_hash: "hash1".to_string(),
            model_name: "test".to_string(),
            vector: vec![1.0, 0.0, 0.0],
            dimension: 3,
            created_at: Utc::now(),
            metadata: serde_json::json!({}),
        };

        let embedding2 = Embedding {
            id: Uuid::new_v4(),
            entity_id: Some(Uuid::new_v4()),
            content_hash: "hash2".to_string(),
            model_name: "test".to_string(),
            vector: vec![0.0, 1.0, 0.0],
            dimension: 3,
            created_at: Utc::now(),
            metadata: serde_json::json!({}),
        };

        store.upsert_embedding(&embedding1).await.unwrap();
        store.upsert_embedding(&embedding2).await.unwrap();

        // Search for similar vectors
        let query_vector = vec![0.9, 0.1, 0.0];
        let results = store.search_similar(&query_vector, 2, 0.5, None).await.unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].0, embedding1.id.to_string());
        assert!(results[0].1 > 0.8); // High similarity
    }
}