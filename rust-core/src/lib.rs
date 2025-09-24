pub mod models;
pub mod services;
pub mod utils;
pub mod config;

pub use models::*;
pub use services::*;
pub use utils::*;
pub use config::*;

// Re-export commonly used types
pub use anyhow::{Result, Error};
pub use uuid::Uuid;
pub use chrono::{DateTime, Utc};
pub use serde::{Deserialize, Serialize};

// Version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub const NAME: &str = env!("CARGO_PKG_NAME");

/// Initialize the library with default configuration
pub fn init() -> Result<()> {
    // Initialize logging
    env_logger::init();
    
    // Initialize any global state if needed
    Ok(())
}

/// Initialize the library with custom configuration
pub fn init_with_config(config: Config) -> Result<()> {
    // Initialize with custom configuration
    env_logger::init();
    
    // Apply configuration
    log::info!("Initializing Code Intelligence MCP Server with config: {:?}", config);
    
    Ok(())
}