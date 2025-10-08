use crate::{Result, Error};
use serde::{Deserialize, Serialize};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    pub storage_type: StorageType,
    pub connection_string: String,
    pub max_connections: u32,
    pub connection_timeout: u64,
    pub retry_attempts: u32,
    pub cache_size_mb: u32,
    pub enable_compression: bool,
    pub backup_enabled: bool,
    pub backup_interval_hours: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StorageType {
    SQLite,
    PostgreSQL,
    DuckDB,
    Memory,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseStats {
    pub total_size_bytes: u64,
    pub total_records: u64,
    pub total_tables: u32,
    pub indexes_count: u32,
    pub connection_pool_size: u32,
    pub active_connections: u32,
    pub cache_hit_rate: f64,
    pub avg_query_time_ms: f64,
    pub last_backup: Option<DateTime<Utc>>,
    pub uptime_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub rows: Vec<Row>,
    pub columns: Vec<String>,
    pub affected_rows: u64,
    pub execution_time_ms: u64,
    pub query_type: QueryType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Row {
    pub values: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Value {
    Null,
    Bool(bool),
    I64(i64),
    F64(f64),
    String(String),
    Binary(Vec<u8>),
    DateTime(DateTime<Utc>),
    Json(serde_json::Value),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum QueryType {
    Select,
    Insert,
    Update,
    Delete,
    Create,
    Drop,
    Alter,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub id: Uuid,
    pub started_at: DateTime<Utc>,
    pub isolation_level: IsolationLevel,
    pub status: TransactionStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IsolationLevel {
    ReadUncommitted,
    ReadCommitted,
    RepeatableRead,
    Serializable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransactionStatus {
    Active,
    Committed,
    RolledBack,
}

#[async_trait]
pub trait StorageService: Send + Sync {
    /// Initialize the storage service
    async fn initialize(&mut self, config: StorageConfig) -> Result<()>;

    /// Execute a query and return results
    async fn execute_query(&self, query: &str, params: &[Value]) -> Result<QueryResult>;

    /// Execute a query within a transaction
    async fn execute_transaction<F, R>(&self, operations: F) -> Result<R>
    where
        F: FnOnce(&mut dyn TransactionExecutor) -> Result<R> + Send + 'async_trait,
        R: Send + 'async_trait;

    /// Get database statistics
    async fn get_stats(&self) -> Result<DatabaseStats>;

    /// Backup the database
    async fn backup(&self, path: &str) -> Result<()>;

    /// Restore from backup
    async fn restore(&self, path: &str) -> Result<()>;

    /// Optimize the database
    async fn optimize(&self) -> Result<()>;

    /// Check database health
    async fn health_check(&self) -> Result<bool>;

    /// Close connections and cleanup
    async fn close(&mut self) -> Result<()>;
}

#[async_trait]
pub trait TransactionExecutor {
    /// Execute a query within the transaction
    async fn execute(&mut self, query: &str, params: &[Value]) -> Result<QueryResult>;

    /// Commit the transaction
    async fn commit(self) -> Result<()>;

    /// Rollback the transaction
    async fn rollback(self) -> Result<()>;
}

pub struct SQLiteStorage {
    pool: Option<sqlx::Pool<sqlx::Sqlite>>,
    config: Option<StorageConfig>,
    stats: DatabaseStats,
}

impl SQLiteStorage {
    pub fn new() -> Self {
        Self {
            pool: None,
            config: None,
            stats: DatabaseStats {
                total_size_bytes: 0,
                total_records: 0,
                total_tables: 0,
                indexes_count: 0,
                connection_pool_size: 0,
                active_connections: 0,
                cache_hit_rate: 0.0,
                avg_query_time_ms: 0.0,
                last_backup: None,
                uptime_seconds: 0,
            },
        }
    }

    async fn create_tables(&self) -> Result<()> {
        let pool = self.pool.as_ref().ok_or_else(|| Error::msg("Storage not initialized"))?;

        // Create codebases table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS codebases (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                metadata TEXT
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Create code_entities table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS code_entities (
                id TEXT PRIMARY KEY,
                codebase_id TEXT NOT NULL,
                name TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                file_path TEXT NOT NULL,
                line_number INTEGER,
                content TEXT,
                metadata TEXT,
                created_at DATETIME NOT NULL,
                FOREIGN KEY (codebase_id) REFERENCES codebases(id) ON DELETE CASCADE
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Create code_relationships table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS code_relationships (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                relationship_type TEXT NOT NULL,
                metadata TEXT,
                created_at DATETIME NOT NULL,
                FOREIGN KEY (source_id) REFERENCES code_entities(id) ON DELETE CASCADE,
                FOREIGN KEY (target_id) REFERENCES code_entities(id) ON DELETE CASCADE
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Create indexes table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS indexes (
                id TEXT PRIMARY KEY,
                codebase_id TEXT NOT NULL,
                index_type TEXT NOT NULL,
                index_data TEXT NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                FOREIGN KEY (codebase_id) REFERENCES codebases(id) ON DELETE CASCADE
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Create indexes for better performance
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_code_entities_codebase_id ON code_entities(codebase_id)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_code_entities_entity_type ON code_entities(entity_type)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_code_entities_file_path ON code_entities(file_path)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_code_relationships_source_id ON code_relationships(source_id)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_code_relationships_target_id ON code_relationships(target_id)")
            .execute(pool)
            .await?;

        Ok(())
    }

    async fn update_stats(&mut self) -> Result<()> {
        let pool = self.pool.as_ref().ok_or_else(|| Error::msg("Storage not initialized"))?;

        // Get database size
        let size_result: (i64,) = sqlx::query_as(
            "SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()"
        )
        .fetch_one(pool)
        .await?;
        self.stats.total_size_bytes = size_result.0 as u64;

        // Get total records
        let count_result: (i64,) = sqlx::query_as(
            "SELECT SUM(cnt) FROM (
                SELECT COUNT(*) as cnt FROM codebases
                UNION ALL
                SELECT COUNT(*) as cnt FROM code_entities
                UNION ALL
                SELECT COUNT(*) as cnt FROM code_relationships
                UNION ALL
                SELECT COUNT(*) as cnt FROM indexes
            )"
        )
        .fetch_one(pool)
        .await?;
        self.stats.total_records = count_result.0 as u64;

        // Get table count
        let table_result: (i32,) = sqlx::query_as(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table'"
        )
        .fetch_one(pool)
        .await?;
        self.stats.total_tables = table_result.0 as u32;

        // Get index count
        let index_result: (i32,) = sqlx::query_as(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='index'"
        )
        .fetch_one(pool)
        .await?;
        self.stats.indexes_count = index_result.0 as u32;

        Ok(())
    }
}

#[async_trait]
impl StorageService for SQLiteStorage {
    async fn initialize(&mut self, config: StorageConfig) -> Result<()> {
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(config.max_connections)
            .connect(&config.connection_string)
            .await?;

        self.pool = Some(pool);
        self.config = Some(config.clone());
        self.stats.connection_pool_size = config.max_connections;

        // Create necessary tables
        self.create_tables().await?;

        // Update initial statistics
        self.update_stats().await?;

        Ok(())
    }

    async fn execute_query(&self, query: &str, params: &[Value]) -> Result<QueryResult> {
        let pool = self.pool.as_ref().ok_or_else(|| Error::msg("Storage not initialized"))?;
        
        let start_time = std::time::Instant::now();
        
        // Convert params to SQLx values
        let mut query_builder = sqlx::query(query);
        for param in params {
            match param {
                Value::String(s) => query_builder = query_builder.bind(s),
                Value::I64(i) => query_builder = query_builder.bind(i),
                Value::F64(f) => query_builder = query_builder.bind(f),
                Value::Bool(b) => query_builder = query_builder.bind(b),
                Value::Binary(b) => query_builder = query_builder.bind(b),
                Value::DateTime(dt) => query_builder = query_builder.bind(dt),
                Value::Null => {} // NULL parameters don't need binding
                Value::Json(j) => query_builder = query_builder.bind(j.to_string()),
            }
        }

        let query_type = if query.trim_start().to_uppercase().starts_with("SELECT") {
            QueryType::Select
        } else if query.trim_start().to_uppercase().starts_with("INSERT") {
            QueryType::Insert
        } else if query.trim_start().to_uppercase().starts_with("UPDATE") {
            QueryType::Update
        } else if query.trim_start().to_uppercase().starts_with("DELETE") {
            QueryType::Delete
        } else if query.trim_start().to_uppercase().starts_with("CREATE") {
            QueryType::Create
        } else if query.trim_start().to_uppercase().starts_with("DROP") {
            QueryType::Drop
        } else if query.trim_start().to_uppercase().starts_with("ALTER") {
            QueryType::Alter
        } else {
            QueryType::Unknown
        };

        match query_type {
            QueryType::Select => {
                let rows = query_builder.fetch_all(pool).await?;
                let execution_time = start_time.elapsed().as_millis() as u64;

                if rows.is_empty() {
                    return Ok(QueryResult {
                        rows: vec![],
                        columns: vec![],
                        affected_rows: 0,
                        execution_time_ms: execution_time,
                        query_type,
                    });
                }

                // Get column names from the first row
                let columns: Vec<String> = rows[0]
                    .columns()
                    .iter()
                    .map(|col| col.name().to_string())
                    .collect();

                // Convert rows to our format
                let mut result_rows = Vec::new();
                for row in rows {
                    let mut values = Vec::new();
                    for (i, _col) in row.columns().iter().enumerate() {
                        let value = if let Ok(Some(s)) = row.try_get::<Option<String>, _>(i) {
                            Value::String(s)
                        } else if let Ok(Some(i)) = row.try_get::<Option<i64>, _>(i) {
                            Value::I64(i)
                        } else if let Ok(Some(f)) = row.try_get::<Option<f64>, _>(i) {
                            Value::F64(f)
                        } else if let Ok(Some(b)) = row.try_get::<Option<bool>, _>(i) {
                            Value::Bool(b)
                        } else if let Ok(Some(dt)) = row.try_get::<Option<DateTime<Utc>>, _>(i) {
                            Value::DateTime(dt)
                        } else if let Ok(Some(b)) = row.try_get::<Option<Vec<u8>>, _>(i) {
                            Value::Binary(b)
                        } else {
                            Value::Null
                        };
                        values.push(value);
                    }
                    result_rows.push(Row { values });
                }

                Ok(QueryResult {
                    rows: result_rows,
                    columns,
                    affected_rows: 0,
                    execution_time_ms: execution_time,
                    query_type,
                })
            }
            _ => {
                let result = query_builder.execute(pool).await?;
                let execution_time = start_time.elapsed().as_millis() as u64;

                Ok(QueryResult {
                    rows: vec![],
                    columns: vec![],
                    affected_rows: result.rows_affected(),
                    execution_time_ms: execution_time,
                    query_type,
                })
            }
        }
    }

    async fn execute_transaction<F, R>(&self, operations: F) -> Result<R>
    where
        F: FnOnce(&mut dyn TransactionExecutor) -> Result<R> + Send + 'async_trait,
        R: Send + 'async_trait,
    {
        let pool = self.pool.as_ref().ok_or_else(|| Error::msg("Storage not initialized"))?;
        
        let mut tx = pool.begin().await?;
        let mut executor = SQLiteTransactionExecutor { tx: &mut tx };
        
        let result = operations(&mut executor).await;
        
        match result {
            Ok(r) => {
                tx.commit().await?;
                Ok(r)
            }
            Err(e) => {
                tx.rollback().await?;
                Err(e)
            }
        }
    }

    async fn get_stats(&self) -> Result<DatabaseStats> {
        let pool = self.pool.as_ref().ok_or_else(|| Error::msg("Storage not initialized"))?;
        
        // Get active connections
        let active = pool.size() as u32 - pool.num_idle() as u32;
        
        Ok(DatabaseStats {
            active_connections: active,
            ..self.stats.clone()
        })
    }

    async fn backup(&self, path: &str) -> Result<()> {
        let pool = self.pool.as_ref().ok_or_else(|| Error::msg("Storage not initialized"))?;
        
        // Use SQLite backup API
        sqlx::query(&format!("VACUUM INTO '{}'", path))
            .execute(pool)
            .await?;
            
        Ok(())
    }

    async fn restore(&self, path: &str) -> Result<()> {
        // For SQLite, restore means copying the backup file over the current database
        // This would be implemented based on specific requirements
        Err(Error::msg("Restore not implemented for SQLite"))
    }

    async fn optimize(&self) -> Result<()> {
        let pool = self.pool.as_ref().ok_or_else(|| Error::msg("Storage not initialized"))?;
        
        // Analyze tables to update statistics
        sqlx::query("ANALYZE").execute(pool).await?;
        
        // Rebuild the database file to reduce fragmentation
        sqlx::query("VACUUM").execute(pool).await?;
        
        Ok(())
    }

    async fn health_check(&self) -> Result<bool> {
        let pool = self.pool.as_ref().ok_or_else(|| Error::msg("Storage not initialized"))?;
        
        // Simple health check - try to execute a simple query
        match sqlx::query("SELECT 1").fetch_one(pool).await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    async fn close(&mut self) -> Result<()> {
        if let Some(pool) = self.pool.take() {
            pool.close().await;
        }
        Ok(())
    }
}

struct SQLiteTransactionExecutor<'a> {
    tx: &'a mut sqlx::Transaction<'a, sqlx::Sqlite>,
}

#[async_trait]
impl<'a> TransactionExecutor for SQLiteTransactionExecutor<'a> {
    async fn execute(&mut self, query: &str, params: &[Value]) -> Result<QueryResult> {
        let start_time = std::time::Instant::now();
        
        // Similar implementation to execute_query but within transaction
        // This is a simplified version - in production would handle all parameter types
        let mut query_builder = sqlx::query(query);
        for param in params {
            match param {
                Value::String(s) => query_builder = query_builder.bind(s),
                Value::I64(i) => query_builder = query_builder.bind(i),
                Value::F64(f) => query_builder = query_builder.bind(f),
                Value::Bool(b) => query_builder = query_builder.bind(b),
                _ => {} // Handle other types as needed
            }
        }

        let result = query_builder.execute(&mut **self.tx).await?;
        let execution_time = start_time.elapsed().as_millis() as u64;

        Ok(QueryResult {
            rows: vec![],
            columns: vec![],
            affected_rows: result.rows_affected(),
            execution_time_ms: execution_time,
            query_type: QueryType::Unknown,
        })
    }

    async fn commit(self) -> Result<()> {
        // Commit is handled by the outer transaction logic
        Ok(())
    }

    async fn rollback(self) -> Result<()> {
        // Rollback is handled by the outer transaction logic
        Ok(())
    }
}

impl Default for StorageConfig {
    fn default() -> Self {
        Self {
            storage_type: StorageType::SQLite,
            connection_string: "sqlite:./data/codesight.db".to_string(),
            max_connections: 10,
            connection_timeout: 30,
            retry_attempts: 3,
            cache_size_mb: 512,
            enable_compression: true,
            backup_enabled: true,
            backup_interval_hours: 24,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_sqlite_storage_initialization() {
        let mut storage = SQLiteStorage::new();
        let config = StorageConfig {
            connection_string: ":memory:".to_string(),
            ..Default::default()
        };

        let result = storage.initialize(config).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_simple_query() {
        let mut storage = SQLiteStorage::new();
        let config = StorageConfig {
            connection_string: ":memory:".to_string(),
            ..Default::default()
        };

        storage.initialize(config).await.unwrap();

        let result = storage
            .execute_query("SELECT 1 as test", &[])
            .await
            .unwrap();

        assert_eq!(result.rows.len(), 1);
        assert_eq!(result.columns, vec!["test"]);
        assert_eq!(result.query_type, QueryType::Select);
    }

    #[test]
    fn test_storage_config_default() {
        let config = StorageConfig::default();
        assert!(matches!(config.storage_type, StorageType::SQLite));
        assert_eq!(config.max_connections, 10);
        assert!(config.backup_enabled);
    }
}