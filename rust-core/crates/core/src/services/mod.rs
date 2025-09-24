//! Core services for the Code Intelligence MCP Server

pub mod codebase_service;
pub mod indexing_service;
pub mod search_service;
pub mod embedding_service;
pub mod cache_service;
pub mod plugin_service;
pub mod configuration_service;
pub mod job_service;
pub mod analytics_service;

// Re-export services
pub use codebase_service::CodebaseService;
pub use indexing_service::IndexingService;
pub use search_service::SearchService;
pub use embedding_service::EmbeddingService;
pub use cache_service::CacheService;
pub use plugin_service::PluginService;
pub use configuration_service::ConfigurationService;
pub use job_service::JobService;
pub use analytics_service::AnalyticsService;

use crate::error::CoreError;
use async_trait::async_trait;
use std::sync::Arc;

/// Service registry for managing all core services
#[derive(Debug, Clone)]
pub struct ServiceRegistry {
    pub codebase: Arc<CodebaseService>,
    pub indexing: Arc<IndexingService>,
    pub search: Arc<SearchService>,
    pub embedding: Arc<EmbeddingService>,
    pub cache: Arc<CacheService>,
    pub plugin: Arc<PluginService>,
    pub configuration: Arc<ConfigurationService>,
    pub job: Arc<JobService>,
    pub analytics: Arc<AnalyticsService>,
}

impl ServiceRegistry {
    /// Create a new service registry
    pub async fn new() -> Result<Self, CoreError> {
        let configuration = Arc::new(ConfigurationService::new().await?);
        let cache = Arc::new(CacheService::new(configuration.clone()).await?);
        let codebase = Arc::new(CodebaseService::new(configuration.clone()).await?);
        let embedding = Arc::new(EmbeddingService::new(configuration.clone()).await?);
        let plugin = Arc::new(PluginService::new(configuration.clone()).await?);
        let indexing = Arc::new(IndexingService::new(
            configuration.clone(),
            codebase.clone(),
            embedding.clone(),
            plugin.clone(),
        ).await?);
        let search = Arc::new(SearchService::new(
            configuration.clone(),
            embedding.clone(),
            cache.clone(),
        ).await?);
        let job = Arc::new(JobService::new(
            configuration.clone(),
            indexing.clone(),
        ).await?);
        let analytics = Arc::new(AnalyticsService::new(configuration.clone()).await?);

        Ok(Self {
            codebase,
            indexing,
            search,
            embedding,
            cache,
            plugin,
            configuration,
            job,
            analytics,
        })
    }

    /// Initialize all services
    pub async fn initialize(&self) -> Result<(), CoreError> {
        self.configuration.initialize().await?;
        self.cache.initialize().await?;
        self.codebase.initialize().await?;
        self.embedding.initialize().await?;
        self.plugin.initialize().await?;
        self.indexing.initialize().await?;
        self.search.initialize().await?;
        self.job.initialize().await?;
        self.analytics.initialize().await?;
        Ok(())
    }

    /// Shutdown all services
    pub async fn shutdown(&self) -> Result<(), CoreError> {
        self.analytics.shutdown().await?;
        self.job.shutdown().await?;
        self.search.shutdown().await?;
        self.indexing.shutdown().await?;
        self.plugin.shutdown().await?;
        self.embedding.shutdown().await?;
        self.codebase.shutdown().await?;
        self.cache.shutdown().await?;
        self.configuration.shutdown().await?;
        Ok(())
    }

    /// Get health status of all services
    pub async fn health_check(&self) -> ServiceHealthStatus {
        let mut status = ServiceHealthStatus::new();
        
        status.add_service("configuration", self.configuration.health_check().await);
        status.add_service("cache", self.cache.health_check().await);
        status.add_service("codebase", self.codebase.health_check().await);
        status.add_service("embedding", self.embedding.health_check().await);
        status.add_service("plugin", self.plugin.health_check().await);
        status.add_service("indexing", self.indexing.health_check().await);
        status.add_service("search", self.search.health_check().await);
        status.add_service("job", self.job.health_check().await);
        status.add_service("analytics", self.analytics.health_check().await);
        
        status
    }
}

/// Health status for all services
#[derive(Debug, Clone)]
pub struct ServiceHealthStatus {
    pub services: std::collections::HashMap<String, ServiceHealth>,
    pub overall_status: HealthStatus,
}

impl ServiceHealthStatus {
    pub fn new() -> Self {
        Self {
            services: std::collections::HashMap::new(),
            overall_status: HealthStatus::Healthy,
        }
    }

    pub fn add_service(&mut self, name: &str, health: ServiceHealth) {
        if health.status != HealthStatus::Healthy {
            self.overall_status = HealthStatus::Unhealthy;
        }
        self.services.insert(name.to_string(), health);
    }

    pub fn is_healthy(&self) -> bool {
        self.overall_status == HealthStatus::Healthy
    }
}

/// Individual service health information
#[derive(Debug, Clone, PartialEq)]
pub struct ServiceHealth {
    pub status: HealthStatus,
    pub message: Option<String>,
    pub last_check: chrono::DateTime<chrono::Utc>,
    pub response_time_ms: Option<u64>,
}

impl ServiceHealth {
    pub fn healthy() -> Self {
        Self {
            status: HealthStatus::Healthy,
            message: None,
            last_check: chrono::Utc::now(),
            response_time_ms: None,
        }
    }

    pub fn unhealthy(message: String) -> Self {
        Self {
            status: HealthStatus::Unhealthy,
            message: Some(message),
            last_check: chrono::Utc::now(),
            response_time_ms: None,
        }
    }

    pub fn degraded(message: String) -> Self {
        Self {
            status: HealthStatus::Degraded,
            message: Some(message),
            last_check: chrono::Utc::now(),
            response_time_ms: None,
        }
    }

    pub fn with_response_time(mut self, response_time_ms: u64) -> Self {
        self.response_time_ms = Some(response_time_ms);
        self
    }
}

/// Health status enumeration
#[derive(Debug, Clone, PartialEq)]
pub enum HealthStatus {
    /// Service is healthy and operating normally
    Healthy,
    /// Service is degraded but still functional
    Degraded,
    /// Service is unhealthy and not functioning properly
    Unhealthy,
}

/// Base trait for all services
#[async_trait]
pub trait Service: Send + Sync {
    /// Initialize the service
    async fn initialize(&self) -> Result<(), CoreError>;
    
    /// Shutdown the service gracefully
    async fn shutdown(&self) -> Result<(), CoreError>;
    
    /// Check the health of the service
    async fn health_check(&self) -> ServiceHealth;
    
    /// Get service name
    fn name(&self) -> &'static str;
    
    /// Get service version
    fn version(&self) -> &'static str {
        "1.0.0"
    }
}

/// Service configuration trait
pub trait ServiceConfig {
    /// Validate the service configuration
    fn validate(&self) -> Result<(), CoreError>;
    
    /// Get configuration as key-value pairs
    fn to_map(&self) -> std::collections::HashMap<String, String>;
}

/// Service metrics trait
pub trait ServiceMetrics {
    /// Get service metrics
    fn get_metrics(&self) -> std::collections::HashMap<String, f64>;
    
    /// Reset service metrics
    fn reset_metrics(&self);
}

/// Service events
#[derive(Debug, Clone)]
pub enum ServiceEvent {
    /// Service started
    Started { service_name: String },
    /// Service stopped
    Stopped { service_name: String },
    /// Service error occurred
    Error { service_name: String, error: String },
    /// Service configuration changed
    ConfigurationChanged { service_name: String },
    /// Custom service event
    Custom { service_name: String, event_type: String, data: serde_json::Value },
}

/// Service event handler trait
#[async_trait]
pub trait ServiceEventHandler: Send + Sync {
    /// Handle a service event
    async fn handle_event(&self, event: ServiceEvent) -> Result<(), CoreError>;
}

/// Default implementation for ServiceHealthStatus
impl Default for ServiceHealthStatus {
    fn default() -> Self {
        Self::new()
    }
}