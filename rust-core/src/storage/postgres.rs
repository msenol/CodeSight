//! PostgreSQL adapter for enterprise data storage
//!
//! Provides a robust, scalable database solution for enterprise deployments.
//! Supports advanced features like pgvector for vector search, connection pooling,
//! and high availability configurations.

use std::time::Duration;
use std::sync::Arc;
use sqlx::{postgres::{PgConnectOptions, PgPoolOptions}, Pool, Postgres, Row};
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

/// PostgreSQL database configuration
#[derive(Debug, Clone)]
pub struct PostgresConfig {
    /// Database connection URL
    pub database_url: String,
    /// Maximum number of connections in the pool
    pub max_connections: u32,
    /// Minimum number of connections in the pool
    pub min_connections: u32,
    /// Connection timeout in seconds
    pub connect_timeout: u64,
    /// Idle timeout in seconds
    pub idle_timeout: u64,
    /// Max lifetime of connections in seconds
    pub max_lifetime: Option<u64>,
    /// Enable SSL/TLS
    pub ssl_mode: SslMode,
    /// Application name for connection tracking
    pub application_name: String,
    /// Enable query logging
    pub enable_logging: bool,
    /// Schema name (default: public)
    pub schema: String,
    /// Enable pgvector extension
    pub enable_pgvector: bool,
}

/// SSL configuration modes
#[derive(Debug, Clone)]
pub enum SslMode {
    Disable,
    Allow,
    Prefer,
    Require,
}

impl Default for PostgresConfig {
    fn default() -> Self {
        Self {
            database_url: "postgresql://postgres:password@localhost:5432/codesight".to_string(),
            max_connections: 20,
            min_connections: 5,
            connect_timeout: 30,
            idle_timeout: 600,
            max_lifetime: Some(1800), // 30 minutes
            ssl_mode: SslMode::Prefer,
            application_name: "codesight-mcp".to_string(),
            enable_logging: false,
            schema: "public".to_string(),
            enable_pgvector: true,
        }
    }
}

/// PostgreSQL storage adapter
pub struct PostgresAdapter {
    pool: Arc<Pool<Postgres>>,
    config: PostgresConfig,
    // Track database initialization status
    initialized: Arc<RwLock<bool>>,
}

impl PostgresAdapter {
    /// Create a new PostgreSQL adapter with configuration
    pub async fn new(config: PostgresConfig) -> ModelResult<Self> {
        // Parse connection URL and configure options
        let mut connect_options = PgConnectOptions::from_str(&config.database_url)
            .map_err(|e| CoreError::StorageError(format!("Invalid database URL: {}", e)))?;

        // Configure connection options
        connect_options = connect_options
            .application_name(&config.application_name)
            .connect_timeout(Duration::from_secs(config.connect_timeout))
            .idle_timeout(Duration::from_secs(config.idle_timeout));

        // Configure SSL
        match config.ssl_mode {
            SslMode::Disable => {
                connect_options = connect_options.ssl_mode(sqlx::postgres::PgSslMode::Disable);
            }
            SslMode::Allow => {
                connect_options = connect_options.ssl_mode(sqlx::postgres::PgSslMode::Allow);
            }
            SslMode::Prefer => {
                connect_options = connect_options.ssl_mode(sqlx::postgres::PgSslMode::Prefer);
            }
            SslMode::Require => {
                connect_options = connect_options.ssl_mode(sqlx::postgres::PgSslMode::Require);
            }
        }

        // Create connection pool
        let pool = PgPoolOptions::new()
            .max_connections(config.max_connections)
            .min_connections(config.min_connections)
            .max_lifetime(config.max_lifetime.map(Duration::from_secs))
            .idle_timeout(Duration::from_secs(config.idle_timeout))
            .acquire_timeout(Duration::from_secs(config.connect_timeout))
            .connect_with(connect_options)
            .await
            .map_err(|e| CoreError::StorageError(format!("Failed to create PostgreSQL pool: {}", e)))?;

        let adapter = Self {
            pool: Arc::new(pool),
            config: config.clone(),
            initialized: Arc::new(RwLock::new(false)),
        };

        // Initialize database schema
        adapter.initialize().await?;

        Ok(adapter)
    }

    /// Initialize database schema and extensions
    async fn initialize(&self) -> ModelResult<()> {
        let mut initialized = self.initialized.write().await;
        if *initialized {
            return Ok(());
        }

        // Enable required extensions
        if self.config.enable_pgvector {
            sqlx::query("CREATE EXTENSION IF NOT EXISTS vector")
                .execute(&*self.pool)
                .await
                .map_err(|e| CoreError::StorageError(format!("Failed to enable pgvector extension: {}", e)))?;
        }

        // Enable UUID extension
        sqlx::query("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
            .execute(&*self.pool)
            .await
            .map_err(|e| CoreError::StorageError(format!("Failed to enable uuid-ossp extension: {}", e)))?;

        // Create schema if it doesn't exist
        if self.config.schema != "public" {
            sqlx::query(&format!("CREATE SCHEMA IF NOT EXISTS {}", self.config.schema))
                .execute(&*self.pool)
                .await
                .map_err(|e| CoreError::StorageError(format!("Failed to create schema: {}", e)))?;
        }

        // Execute migrations
        let migrations = vec![
            // Codebases table
            format!(r#"
            CREATE TABLE IF NOT EXISTS {}.codebases (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name TEXT NOT NULL UNIQUE,
                path TEXT NOT NULL,
                size_bytes BIGINT NOT NULL DEFAULT 0,
                file_count INTEGER NOT NULL DEFAULT 0,
                language_stats JSONB NOT NULL DEFAULT '{}',
                index_version TEXT NOT NULL DEFAULT '1.0.0',
                last_indexed TIMESTAMPTZ,
                configuration_id UUID,
                status TEXT NOT NULL DEFAULT 'unindexed',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ,
                FOREIGN KEY (configuration_id) REFERENCES {}.configurations(id)
            )
            "#, self.config.schema, self.config.schema),

            // Code entities table
            format!(r#"
            CREATE TABLE IF NOT EXISTS {}.code_entities (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                codebase_id UUID NOT NULL,
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
                embedding_id UUID,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ,
                FOREIGN KEY (codebase_id) REFERENCES {}.codebases(id) ON DELETE CASCADE,
                FOREIGN KEY (embedding_id) REFERENCES {}.embeddings(id)
            )
            "#, self.config.schema, self.config.schema, self.config.schema),

            // Code relationships table
            format!(r#"
            CREATE TABLE IF NOT EXISTS {}.code_relationships (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                source_entity_id UUID NOT NULL,
                target_entity_id UUID NOT NULL,
                relationship_type TEXT NOT NULL,
                confidence REAL NOT NULL DEFAULT 1.0,
                context TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                FOREIGN KEY (source_entity_id) REFERENCES {}.code_entities(id) ON DELETE CASCADE,
                FOREIGN KEY (target_entity_id) REFERENCES {}.code_entities(id) ON DELETE CASCADE
            )
            "#, self.config.schema, self.config.schema, self.config.schema),

            // Indices table
            format!(r#"
            CREATE TABLE IF NOT EXISTS {}.indices (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                codebase_id UUID NOT NULL,
                index_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'building',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                size_bytes BIGINT NOT NULL DEFAULT 0,
                entry_count INTEGER NOT NULL DEFAULT 0,
                metadata JSONB NOT NULL DEFAULT '{}',
                FOREIGN KEY (codebase_id) REFERENCES {}.codebases(id) ON DELETE CASCADE
            )
            "#, self.config.schema, self.config.schema),

            // Queries table
            format!(r#"
            CREATE TABLE IF NOT EXISTS {}.queries (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                query_text TEXT NOT NULL,
                query_type TEXT NOT NULL,
                intent TEXT NOT NULL,
                codebase_id UUID NOT NULL,
                user_id TEXT,
                timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                execution_time_ms INTEGER NOT NULL DEFAULT 0,
                result_count INTEGER NOT NULL DEFAULT 0,
                cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
                FOREIGN KEY (codebase_id) REFERENCES {}.codebases(id)
            )
            "#, self.config.schema, self.config.schema),

            // Embeddings table with vector support
            format!(r#"
            CREATE TABLE IF NOT EXISTS {}.embeddings (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                entity_id UUID,
                content_hash TEXT NOT NULL,
                model_name TEXT NOT NULL,
                vector vector(1536),
                dimension INTEGER NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                metadata JSONB NOT NULL DEFAULT '{}',
                FOREIGN KEY (entity_id) REFERENCES {}.code_entities(id) ON DELETE SET NULL
            )
            "#, self.config.schema, self.config.schema),

            // Cache entries table
            format!(r#"
            CREATE TABLE IF NOT EXISTS {}.cache_entries (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                cache_key TEXT NOT NULL UNIQUE,
                cache_type TEXT NOT NULL,
                value BYTEA NOT NULL,
                size_bytes BIGINT NOT NULL DEFAULT 0,
                ttl_seconds INTEGER NOT NULL DEFAULT 3600,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL,
                access_count INTEGER NOT NULL DEFAULT 0,
                last_accessed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                codebase_id UUID,
                FOREIGN KEY (codebase_id) REFERENCES {}.codebases(id) ON DELETE CASCADE
            )
            "#, self.config.schema, self.config.schema),

            // Plugins table
            format!(r#"
            CREATE TABLE IF NOT EXISTS {}.plugins (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name TEXT NOT NULL UNIQUE,
                version TEXT NOT NULL,
                plugin_type TEXT NOT NULL,
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                configuration JSONB NOT NULL DEFAULT '{}',
                capabilities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
                supported_languages TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
                installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            "#, self.config.schema),

            // Configurations table
            format!(r#"
            CREATE TABLE IF NOT EXISTS {}.configurations (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name TEXT NOT NULL UNIQUE,
                profile TEXT NOT NULL DEFAULT 'default',
                indexing_config JSONB NOT NULL DEFAULT '{}',
                search_config JSONB NOT NULL DEFAULT '{}',
                model_config JSONB NOT NULL DEFAULT '{}',
                storage_config JSONB NOT NULL DEFAULT '{}',
                cache_config JSONB NOT NULL DEFAULT '{}',
                privacy_config JSONB NOT NULL DEFAULT '{}',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                is_active BOOLEAN NOT NULL DEFAULT FALSE,
                CONSTRAINT unique_active_profile UNIQUE (profile, is_active) DEFERRABLE INITIALLY DEFERRED
            )
            "#, self.config.schema),

            // Index jobs table
            format!(r#"
            CREATE TABLE IF NOT EXISTS {}.index_jobs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                codebase_id UUID NOT NULL,
                job_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued',
                priority INTEGER NOT NULL DEFAULT 5,
                started_at TIMESTAMPTZ,
                completed_at TIMESTAMPTZ,
                error_message TEXT,
                files_processed INTEGER NOT NULL DEFAULT 0,
                files_total INTEGER NOT NULL DEFAULT 0,
                progress_percentage REAL NOT NULL DEFAULT 0.0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                FOREIGN KEY (codebase_id) REFERENCES {}.codebases(id) ON DELETE CASCADE
            )
            "#, self.config.schema, self.config.schema),

            // Code metrics table
            format!(r#"
            CREATE TABLE IF NOT EXISTS {}.code_metrics (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                entity_id UUID NOT NULL,
                metric_type TEXT NOT NULL,
                value REAL NOT NULL,
                computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                metadata JSONB NOT NULL DEFAULT '{}',
                FOREIGN KEY (entity_id) REFERENCES {}.code_entities(id) ON DELETE CASCADE
            )
            "#, self.config.schema, self.config.schema),

            // API endpoints table
            format!(r#"
            CREATE TABLE IF NOT EXISTS {}.api_endpoints (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                codebase_id UUID NOT NULL,
                entity_id UUID NOT NULL,
                path TEXT NOT NULL,
                method TEXT NOT NULL,
                handler_function TEXT NOT NULL,
                request_schema JSONB,
                response_schema JSONB,
                authentication_required BOOLEAN NOT NULL DEFAULT FALSE,
                discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                FOREIGN KEY (codebase_id) REFERENCES {}.codebases(id) ON DELETE CASCADE,
                FOREIGN KEY (entity_id) REFERENCES {}.code_entities(id) ON DELETE CASCADE
            )
            "#, self.config.schema, self.config.schema, self.config.schema),
        ];

        // Execute migrations
        for migration in migrations {
            sqlx::query(&migration)
                .execute(&*self.pool)
                .await
                .map_err(|e| CoreError::StorageError(format!("Failed to execute migration: {}", e)))?;
        }

        // Create indexes for performance
        let indexes = vec![
            format!("CREATE INDEX IF NOT EXISTS idx_code_entities_codebase_id ON {}.code_entities(codebase_id)", self.config.schema),
            format!("CREATE INDEX IF NOT EXISTS idx_code_entities_entity_type ON {}.code_entities(entity_type)", self.config.schema),
            format!("CREATE INDEX IF NOT EXISTS idx_code_entities_qualified_name ON {}.code_entities(qualified_name)", self.config.schema),
            format!("CREATE INDEX IF NOT EXISTS idx_code_entities_file_path ON {}.code_entities(file_path)", self.config.schema),
            format!("CREATE INDEX IF NOT EXISTS idx_code_relationships_source ON {}.code_relationships(source_entity_id)", self.config.schema),
            format!("CREATE INDEX IF NOT EXISTS idx_code_relationships_target ON {}.code_relationships(target_entity_id)", self.config.schema),
            format!("CREATE INDEX IF NOT EXISTS idx_code_relationships_type ON {}.code_relationships(relationship_type)", self.config.schema),
            format!("CREATE INDEX IF NOT EXISTS idx_embeddings_content_hash ON {}.embeddings(content_hash)", self.config.schema),
            format!("CREATE INDEX IF NOT EXISTS idx_cache_entries_key ON {}.cache_entries(cache_key)", self.config.schema),
            format!("CREATE INDEX IF NOT EXISTS idx_cache_entries_expires ON {}.cache_entries(expires_at)", self.config.schema),
            format!("CREATE INDEX IF NOT EXISTS idx_queries_codebase_timestamp ON {}.queries(codebase_id, timestamp DESC)", self.config.schema),
            format!("CREATE INDEX IF NOT EXISTS idx_indices_codebase_type ON {}.indices(codebase_id, index_type)", self.config.schema),
        ];

        // Add vector index if pgvector is enabled
        if self.config.enable_pgvector {
            indexes.push(format!(
                "CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON {}.embeddings USING ivfflat (vector vector_cosine_ops)",
                self.config.schema
            ));
        }

        for index in indexes {
            sqlx::query(&index)
                .execute(&*self.pool)
                .await
                .map_err(|e| CoreError::StorageError(format!("Failed to create index: {}", e)))?;
        }

        // Create triggers for updated_at timestamps
        let triggers = vec![
            format!(r#"
            CREATE OR REPLACE FUNCTION {}.update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql';
            "#, self.config.schema),

            format!(r#"
            CREATE TRIGGER update_codebases_updated_at BEFORE UPDATE ON {}.codebases
                FOR EACH ROW EXECUTE FUNCTION {}.update_updated_at_column();
            "#, self.config.schema, self.config.schema),

            format!(r#"
            CREATE TRIGGER update_configurations_updated_at BEFORE UPDATE ON {}.configurations
                FOR EACH ROW EXECUTE FUNCTION {}.update_updated_at_column();
            "#, self.config.schema, self.config.schema),
        ];

        for trigger in triggers {
            sqlx::query(&trigger)
                .execute(&*self.pool)
                .await
                .map_err(|e| CoreError::StorageError(format!("Failed to create trigger: {}", e)))?;
        }

        *initialized = true;
        Ok(())
    }

    /// Get connection pool
    pub fn pool(&self) -> Arc<Pool<Postgres>> {
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
            let query = format!("SELECT COUNT(*) as count FROM {}.{}", self.config.schema, table);
            let row = sqlx::query(&query)
                .fetch_one(&*self.pool)
                .await
                .map_err(|e| CoreError::StorageError(format!("Failed to get table stats: {}", e)))?;

            let count: i64 = row.get("count");
            stats.insert(table.to_string(), Value::Number(serde_json::Number::from(count)));
        }

        // Connection pool stats
        stats.insert("pool_size".to_string(),
            Value::Number(serde_json::Number::from(self.pool.size())));
        stats.insert("pool_idle".to_string(),
            Value::Number(serde_json::Number::from(self.pool.num_idle())));

        // PostgreSQL version
        let version_row = sqlx::query("SELECT version()")
            .fetch_one(&*self.pool)
            .await
            .map_err(|e| CoreError::StorageError(format!("Failed to get PostgreSQL version: {}", e)))?;

        let version: String = version_row.get("version");
        stats.insert("postgres_version".to_string(), Value::String(version));

        // Database size
        let size_row = sqlx::query("SELECT pg_size_pretty(pg_database_size(current_database())) as size")
            .fetch_one(&*self.pool)
            .await
            .map_err(|e| CoreError::StorageError(format!("Failed to get database size: {}", e)))?;

        let size: String = size_row.get("size");
        stats.insert("database_size".to_string(), Value::String(size));

        Ok(Value::Object(stats))
    }

    /// Perform database vacuum and analysis
    pub async fn optimize(&self) -> ModelResult<()> {
        // Analyze to update query planner statistics
        sqlx::query("ANALYZE")
            .execute(&*self.pool)
            .await
            .map_err(|e| CoreError::StorageError(format!("Failed to analyze database: {}", e)))?;

        // Reindex for better performance
        sqlx::query("REINDEX DATABASE CONCURRENTLY")
            .execute(&*self.pool)
            .await
            .map_err(|e| CoreError::StorageError(format!("Failed to reindex database: {}", e)))?;

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

    /// Create database backup using pg_dump
    pub async fn backup(&self, backup_path: &str) -> ModelResult<()> {
        use std::process::Command;

        let output = Command::new("pg_dump")
            .arg(&self.config.database_url)
            .arg("--format=custom")
            .arg("--compress=9")
            .arg("--verbose")
            .arg("--file")
            .arg(backup_path)
            .output()
            .map_err(|e| CoreError::StorageError(format!("Failed to execute pg_dump: {}", e)))?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(CoreError::StorageError(format!("pg_dump failed: {}", error)));
        }

        Ok(())
    }

    /// Restore database from backup using pg_restore
    pub async fn restore(&self, backup_path: &str) -> ModelResult<()> {
        use std::process::Command;

        let output = Command::new("pg_restore")
            .arg("--verbose")
            .arg("--clean")
            .arg("--if-exists")
            .arg("--dbname")
            .arg(&self.config.database_url)
            .arg(backup_path)
            .output()
            .map_err(|e| CoreError::StorageError(format!("Failed to execute pg_restore: {}", e)))?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(CoreError::StorageError(format!("pg_restore failed: {}", error)));
        }

        Ok(())
    }

    /// Execute vector similarity search
    pub async fn vector_search(
        &self,
        query_vector: &[f32],
        limit: u32,
        codebase_id: Option<&str>,
    ) -> ModelResult<Vec<Value>> {
        if !self.config.enable_pgvector {
            return Err(CoreError::StorageError("pgvector is not enabled".to_string()));
        }

        let vector_str = query_vector
            .iter()
            .map(|x| x.to_string())
            .collect::<Vec<_>>()
            .join(",");

        let query = if let Some(codebase_id) = codebase_id {
            format!(
                r#"
                SELECT e.id, e.name, e.qualified_name, e.file_path, e.entity_type,
                       1 - (em.vector <=> '[{}]') as similarity
                FROM {}.embeddings em
                JOIN {}.code_entities e ON em.entity_id = e.id
                WHERE e.codebase_id = $1
                ORDER BY similarity DESC
                LIMIT $2
                "#,
                vector_str, self.config.schema, self.config.schema
            )
        } else {
            format!(
                r#"
                SELECT e.id, e.name, e.qualified_name, e.file_path, e.entity_type,
                       1 - (em.vector <=> '[{}]') as similarity
                FROM {}.embeddings em
                JOIN {}.code_entities e ON em.entity_id = e.id
                ORDER BY similarity DESC
                LIMIT $1
                "#,
                vector_str, self.config.schema, self.config.schema
            )
        };

        let rows = if let Some(codebase_id) = codebase_id {
            sqlx::query(&query)
                .bind(codebase_id)
                .bind(limit as i64)
                .fetch_all(&*self.pool)
                .await
                .map_err(|e| CoreError::StorageError(format!("Vector search failed: {}", e)))?
        } else {
            sqlx::query(&query)
                .bind(limit as i64)
                .fetch_all(&*self.pool)
                .await
                .map_err(|e| CoreError::StorageError(format!("Vector search failed: {}", e)))?
        };

        let results: Vec<Value> = rows
            .into_iter()
            .map(|row| {
                serde_json::json!({
                    "id": row.get::<String, _>("id"),
                    "name": row.get::<String, _>("name"),
                    "qualified_name": row.get::<String, _>("qualified_name"),
                    "file_path": row.get::<String, _>("file_path"),
                    "entity_type": row.get::<String, _>("entity_type"),
                    "similarity": row.get::<f64, _>("similarity")
                })
            })
            .collect();

        Ok(results)
    }
}

// Implement Drop for graceful shutdown
impl Drop for PostgresAdapter {
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

    #[test]
    fn test_postgres_config_default() {
        let config = PostgresConfig::default();
        assert_eq!(config.schema, "public");
        assert_eq!(config.max_connections, 20);
        assert!(config.enable_pgvector);
    }

    #[test]
    fn test_ssl_mode_variants() {
        let modes = vec![SslMode::Disable, SslMode::Allow, SslMode::Prefer, SslMode::Require];
        for mode in modes {
            // Test that all SSL modes can be created
            let _ = mode;
        }
    }
}