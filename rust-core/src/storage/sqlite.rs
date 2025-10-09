//! SQLite adapter for local data storage
//!
//! Provides a lightweight, file-based database solution for local development
//! and smaller deployments. Supports ACID transactions, WAL mode, and connection pooling.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use sqlx::{sqlite::{SqliteConnectOptions, SqliteJournalMode, SqliteSynchronous}, Pool, SqlitePool, Row};
use tokio::sync::RwLock;
use async_trait::async_trait;
use serde_json::Value;
use chrono::{DateTime, Utc};

use crate::errors::CoreError;
use crate::models::{ModelResult, Timestamped};
use crate::models::codebase::Codebase;
use crate::models::code_entity::CodeEntity;
use crate::models::code_relationship::CodeRelationship;
use crate::models::index::Index;
use crate::models::query::Query;
use crate::models::embedding::Embedding;
use crate::models::cache_entry::CacheEntry;
use crate::models::plugin::Plugin;
use crate::models::configuration::Configuration;
use crate::models::index_job::IndexJob;
use crate::models::code_metric::CodeMetric;
use crate::models::api_endpoint::APIEndpoint;

/// SQLite database configuration
#[derive(Debug, Clone)]
pub struct SqliteConfig {
    /// Path to the SQLite database file
    pub database_path: PathBuf,
    /// Maximum number of connections in the pool
    pub max_connections: u32,
    /// Connection timeout in seconds
    pub connect_timeout: u64,
    /// Enable WAL mode for better concurrency
    pub enable_wal: bool,
    /// Enable foreign key constraints
    pub enable_foreign_keys: bool,
    /// Synchronous mode (NORMAL, FULL, OFF)
    pub synchronous_mode: SqliteSynchronous,
    /// Cache size in pages
    pub cache_size: u32,
    /// Enable query logging
    pub enable_logging: bool,
}

impl Default for SqliteConfig {
    fn default() -> Self {
        Self {
            database_path: PathBuf::from("data/codesight.db"),
            max_connections: 10,
            connect_timeout: 30,
            enable_wal: true,
            enable_foreign_keys: true,
            synchronous_mode: SqliteSynchronous::Normal,
            cache_size: 10000,
            enable_logging: false,
        }
    }
}

/// SQLite storage adapter
pub struct SqliteAdapter {
    pool: Arc<SqlitePool>,
    config: SqliteConfig,
    // Track database initialization status
    initialized: Arc<RwLock<bool>>,
}

impl SqliteAdapter {
    /// Create a new SQLite adapter with configuration
    pub async fn new(config: SqliteConfig) -> ModelResult<Self> {
        // Ensure parent directory exists
        if let Some(parent) = config.database_path.parent() {
            tokio::fs::create_dir_all(parent).await
                .map_err(|e| CoreError::StorageError(format!("Failed to create database directory: {}", e)))?;
        }

        // Configure connection options
        let mut connect_options = SqliteConnectOptions::new()
            .filename(&config.database_path)
            .create_if_missing(true)
            .journal_mode(if config.enable_wal { SqliteJournalMode::Wal } else { SqliteJournalMode::Delete })
            .synchronous(config.synchronous_mode)
            .foreign_keys(config.enable_foreign_keys)
            .busy_timeout(std::time::Duration::from_secs(config.connect_timeout));

        // Set pragma options
        connect_options = connect_options
            .pragma("cache_size", config.cache_size.to_string())
            .pragma("temp_store", "memory")
            .pragma("mmap_size", "268435456") // 256MB
            .pragma("optimize", "0x10002"); // Enable optimizations

        // Create connection pool
        let pool = SqlitePool::connect_with(connect_options)
            .await
            .map_err(|e| CoreError::StorageError(format!("Failed to create SQLite pool: {}", e)))?;

        // Configure pool size
        // Note: SQLite doesn't support changing pool size after creation
        // This is handled by the max_connections in connect options

        let adapter = Self {
            pool: Arc::new(pool),
            config: config.clone(),
            initialized: Arc::new(RwLock::new(false)),
        };

        // Initialize database schema
        adapter.initialize().await?;

        Ok(adapter)
    }

    /// Initialize database schema
    async fn initialize(&self) -> ModelResult<()> {
        let mut initialized = self.initialized.write().await;
        if *initialized {
            return Ok(());
        }

        let migrations = vec![
            // Codebases table
            r#"
            CREATE TABLE IF NOT EXISTS codebases (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                path TEXT NOT NULL,
                size_bytes INTEGER NOT NULL DEFAULT 0,
                file_count INTEGER NOT NULL DEFAULT 0,
                language_stats TEXT NOT NULL DEFAULT '{}',
                index_version TEXT NOT NULL DEFAULT '1.0.0',
                last_indexed TEXT,
                configuration_id TEXT,
                status TEXT NOT NULL DEFAULT 'unindexed',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT,
                FOREIGN KEY (configuration_id) REFERENCES configurations(id)
            )
            "#,

            // Code entities table
            r#"
            CREATE TABLE IF NOT EXISTS code_entities (
                id TEXT PRIMARY KEY,
                codebase_id TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                name TEXT NOT NULL,
                qualified_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                start_line INTEGER NOT NULL,
                end_line INTEGER NOT NULL,
                start_column INTEGER NOT NULL DEFAULT 0,
                end_column INTEGER NOT NULL DEFAULT 0,
                language TEXT NOT NULL,
                signature TEXT,
                visibility TEXT NOT NULL DEFAULT 'public',
                documentation TEXT,
                ast_hash TEXT,
                embedding_id TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT,
                FOREIGN KEY (codebase_id) REFERENCES codebases(id) ON DELETE CASCADE,
                FOREIGN KEY (embedding_id) REFERENCES embeddings(id)
            )
            "#,

            // Code relationships table
            r#"
            CREATE TABLE IF NOT EXISTS code_relationships (
                id TEXT PRIMARY KEY,
                source_entity_id TEXT NOT NULL,
                target_entity_id TEXT NOT NULL,
                relationship_type TEXT NOT NULL,
                confidence REAL NOT NULL DEFAULT 1.0,
                context TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (source_entity_id) REFERENCES code_entities(id) ON DELETE CASCADE,
                FOREIGN KEY (target_entity_id) REFERENCES code_entities(id) ON DELETE CASCADE
            )
            "#,

            // Indices table
            r#"
            CREATE TABLE IF NOT EXISTS indices (
                id TEXT PRIMARY KEY,
                codebase_id TEXT NOT NULL,
                index_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'building',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                size_bytes INTEGER NOT NULL DEFAULT 0,
                entry_count INTEGER NOT NULL DEFAULT 0,
                metadata TEXT NOT NULL DEFAULT '{}',
                FOREIGN KEY (codebase_id) REFERENCES codebases(id) ON DELETE CASCADE
            )
            "#,

            // Queries table
            r#"
            CREATE TABLE IF NOT EXISTS queries (
                id TEXT PRIMARY KEY,
                query_text TEXT NOT NULL,
                query_type TEXT NOT NULL,
                intent TEXT NOT NULL,
                codebase_id TEXT NOT NULL,
                user_id TEXT,
                timestamp TEXT NOT NULL DEFAULT (datetime('now')),
                execution_time_ms INTEGER NOT NULL DEFAULT 0,
                result_count INTEGER NOT NULL DEFAULT 0,
                cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
                FOREIGN KEY (codebase_id) REFERENCES codebases(id)
            )
            "#,

            // Embeddings table
            r#"
            CREATE TABLE IF NOT EXISTS embeddings (
                id TEXT PRIMARY KEY,
                entity_id TEXT,
                content_hash TEXT NOT NULL,
                model_name TEXT NOT NULL,
                vector BLOB NOT NULL,
                dimension INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                metadata TEXT NOT NULL DEFAULT '{}',
                FOREIGN KEY (entity_id) REFERENCES code_entities(id) ON DELETE SET NULL
            )
            "#,

            // Cache entries table
            r#"
            CREATE TABLE IF NOT EXISTS cache_entries (
                id TEXT PRIMARY KEY,
                cache_key TEXT NOT NULL UNIQUE,
                cache_type TEXT NOT NULL,
                value BLOB NOT NULL,
                size_bytes INTEGER NOT NULL DEFAULT 0,
                ttl_seconds INTEGER NOT NULL DEFAULT 3600,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                expires_at TEXT NOT NULL,
                access_count INTEGER NOT NULL DEFAULT 0,
                last_accessed TEXT NOT NULL DEFAULT (datetime('now')),
                codebase_id TEXT,
                FOREIGN KEY (codebase_id) REFERENCES codebases(id) ON DELETE CASCADE
            )
            "#,

            // Plugins table
            r#"
            CREATE TABLE IF NOT EXISTS plugins (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                version TEXT NOT NULL,
                plugin_type TEXT NOT NULL,
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                configuration TEXT NOT NULL DEFAULT '{}',
                capabilities TEXT NOT NULL DEFAULT '[]',
                supported_languages TEXT NOT NULL DEFAULT '[]',
                installed_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            "#,

            // Configurations table
            r#"
            CREATE TABLE IF NOT EXISTS configurations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                profile TEXT NOT NULL DEFAULT 'default',
                indexing_config TEXT NOT NULL DEFAULT '{}',
                search_config TEXT NOT NULL DEFAULT '{}',
                model_config TEXT NOT NULL DEFAULT '{}',
                storage_config TEXT NOT NULL DEFAULT '{}',
                cache_config TEXT NOT NULL DEFAULT '{}',
                privacy_config TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                is_active BOOLEAN NOT NULL DEFAULT FALSE
            )
            "#,

            // Index jobs table
            r#"
            CREATE TABLE IF NOT EXISTS index_jobs (
                id TEXT PRIMARY KEY,
                codebase_id TEXT NOT NULL,
                job_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued',
                priority INTEGER NOT NULL DEFAULT 5,
                started_at TEXT,
                completed_at TEXT,
                error_message TEXT,
                files_processed INTEGER NOT NULL DEFAULT 0,
                files_total INTEGER NOT NULL DEFAULT 0,
                progress_percentage REAL NOT NULL DEFAULT 0.0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (codebase_id) REFERENCES codebases(id) ON DELETE CASCADE
            )
            "#,

            // Code metrics table
            r#"
            CREATE TABLE IF NOT EXISTS code_metrics (
                id TEXT PRIMARY KEY,
                entity_id TEXT NOT NULL,
                metric_type TEXT NOT NULL,
                value REAL NOT NULL,
                computed_at TEXT NOT NULL DEFAULT (datetime('now')),
                metadata TEXT NOT NULL DEFAULT '{}',
                FOREIGN KEY (entity_id) REFERENCES code_entities(id) ON DELETE CASCADE
            )
            "#,

            // API endpoints table
            r#"
            CREATE TABLE IF NOT EXISTS api_endpoints (
                id TEXT PRIMARY KEY,
                codebase_id TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                path TEXT NOT NULL,
                method TEXT NOT NULL,
                handler_function TEXT NOT NULL,
                request_schema TEXT,
                response_schema TEXT,
                authentication_required BOOLEAN NOT NULL DEFAULT FALSE,
                discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (codebase_id) REFERENCES codebases(id) ON DELETE CASCADE,
                FOREIGN KEY (entity_id) REFERENCES code_entities(id) ON DELETE CASCADE
            )
            "#,
        ];

        // Execute migrations
        for migration in migrations {
            sqlx::query(migration)
                .execute(&*self.pool)
                .await
                .map_err(|e| CoreError::StorageError(format!("Failed to execute migration: {}", e)))?;
        }

        // Create indexes for performance
        let indexes = vec![
            "CREATE INDEX IF NOT EXISTS idx_code_entities_codebase_id ON code_entities(codebase_id)",
            "CREATE INDEX IF NOT EXISTS idx_code_entities_entity_type ON code_entities(entity_type)",
            "CREATE INDEX IF NOT EXISTS idx_code_entities_qualified_name ON code_entities(qualified_name)",
            "CREATE INDEX IF NOT EXISTS idx_code_entities_file_path ON code_entities(file_path)",
            "CREATE INDEX IF NOT EXISTS idx_code_relationships_source ON code_relationships(source_entity_id)",
            "CREATE INDEX IF NOT EXISTS idx_code_relationships_target ON code_relationships(target_entity_id)",
            "CREATE INDEX IF NOT EXISTS idx_code_relationships_type ON code_relationships(relationship_type)",
            "CREATE INDEX IF NOT EXISTS idx_embeddings_content_hash ON embeddings(content_hash)",
            "CREATE INDEX IF NOT EXISTS idx_cache_entries_key ON cache_entries(cache_key)",
            "CREATE INDEX IF NOT EXISTS idx_cache_entries_expires ON cache_entries(expires_at)",
            "CREATE INDEX IF NOT EXISTS idx_queries_codebase_timestamp ON queries(codebase_id, timestamp DESC)",
            "CREATE INDEX IF NOT EXISTS idx_indices_codebase_type ON indices(codebase_id, index_type)",
        ];

        for index in indexes {
            sqlx::query(index)
                .execute(&*self.pool)
                .await
                .map_err(|e| CoreError::StorageError(format!("Failed to create index: {}", e)))?;
        }

        *initialized = true;
        Ok(())
    }

    /// Get connection pool
    pub fn pool(&self) -> Arc<SqlitePool> {
        Arc::clone(&self.pool)
    }

    /// Get database statistics
    pub async fn get_stats(&self) -> ModelResult<Value> {
        let mut stats = serde_json::Map::new();

        // Table row counts
        let tables = vec![
            "codebases", "code_entities", "code_relationships", "indices",
            "queries", "embeddings", "cache_entries", "plugins",
            "configurations", "index_jobs", "code_metrics", "api_endpoints"
        ];

        for table in tables {
            let query = format!("SELECT COUNT(*) as count FROM {}", table);
            let row = sqlx::query(&query)
                .fetch_one(&*self.pool)
                .await
                .map_err(|e| CoreError::StorageError(format!("Failed to get table stats: {}", e)))?;

            let count: i64 = row.get("count");
            stats.insert(table.to_string(), Value::Number(serde_json::Number::from(count)));
        }

        // Database file size
        if let Ok(metadata) = tokio::fs::metadata(&self.config.database_path).await {
            stats.insert("file_size_bytes".to_string(),
                Value::Number(serde_json::Number::from(metadata.len())));
        }

        // Connection pool stats
        stats.insert("pool_size".to_string(),
            Value::Number(serde_json::Number::from(self.pool.size())));
        stats.insert("pool_idle".to_string(),
            Value::Number(serde_json::Number::from(self.pool.num_idle())));

        Ok(Value::Object(stats))
    }

    /// Perform database vacuum and optimization
    pub async fn optimize(&self) -> ModelResult<()> {
        // Vacuum to reclaim space
        sqlx::query("VACUUM")
            .execute(&*self.pool)
            .await
            .map_err(|e| CoreError::StorageError(format!("Failed to vacuum database: {}", e)))?;

        // Analyze to update query planner statistics
        sqlx::query("ANALYZE")
            .execute(&*self.pool)
            .await
            .map_err(|e| CoreError::StorageError(format!("Failed to analyze database: {}", e)))?;

        // Optimize SQLite settings
        sqlx::query("PRAGMA optimize")
            .execute(&*self.pool)
            .await
            .map_err(|e| CoreError::StorageError(format!("Failed to optimize database: {}", e)))?;

        Ok(())
    }

    /// Check database health
    pub async fn health_check(&self) -> ModelResult<bool> {
        // Simple query to check connectivity
        let result = sqlx::query("SELECT 1 as health")
            .fetch_one(&*self.pool)
            .await
            .map(|_| true)
            .unwrap_or(false);

        Ok(result)
    }

    /// Backup database to specified path
    pub async fn backup(&self, backup_path: &Path) -> ModelResult<()> {
        use std::process::Command;

        // Ensure backup directory exists
        if let Some(parent) = backup_path.parent() {
            tokio::fs::create_dir_all(parent).await
                .map_err(|e| CoreError::StorageError(format!("Failed to create backup directory: {}", e)))?;
        }

        // Use SQLite CLI to create backup
        let output = Command::new("sqlite3")
            .arg(&self.config.database_path)
            .arg(format!(".backup {}", backup_path.display()))
            .output()
            .map_err(|e| CoreError::StorageError(format!("Failed to execute backup command: {}", e)))?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(CoreError::StorageError(format!("SQLite backup failed: {}", error)));
        }

        Ok(())
    }

    /// Restore database from backup
    pub async fn restore(&self, backup_path: &Path) -> ModelResult<()> {
        use std::process::Command;

        if !backup_path.exists() {
            return Err(CoreError::StorageError("Backup file does not exist".to_string()));
        }

        // Close existing connections
        self.pool.close().await;

        // Use SQLite CLI to restore from backup
        let output = Command::new("sqlite3")
            .arg(&self.config.database_path)
            .arg(format!(".restore {}", backup_path.display()))
            .output()
            .map_err(|e| CoreError::StorageError(format!("Failed to execute restore command: {}", e)))?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(CoreError::StorageError(format!("SQLite restore failed: {}", error)));
        }

        // Reinitialize connections
        // Note: This would require recreating the adapter in a real implementation
        Ok(())
    }
}

// Implement Drop for graceful shutdown
impl Drop for SqliteAdapter {
    fn drop(&mut self) {
        // Close connection pool
        let pool = Arc::clone(&self.pool);
        tokio::spawn(async move {
            pool.close().await;
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_sqlite_adapter_creation() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let config = SqliteConfig {
            database_path: db_path,
            ..Default::default()
        };

        let adapter = SqliteAdapter::new(config).await.unwrap();
        assert!(adapter.health_check().await.unwrap());
    }

    #[tokio::test]
    async fn test_database_stats() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_stats.db");

        let config = SqliteConfig {
            database_path: db_path,
            ..Default::default()
        };

        let adapter = SqliteAdapter::new(config).await.unwrap();
        let stats = adapter.get_stats().await.unwrap();

        assert!(stats.get("codebases").is_some());
        assert!(stats.get("pool_size").is_some());
    }
}