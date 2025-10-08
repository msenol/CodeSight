//! Data models for the CodeSight MCP Server
//! 
//! This module contains all the core data structures used throughout the application,
//! including entities, relationships, and configuration objects.

pub mod code_metric;
pub mod api_endpoint;

// Re-export commonly used types
pub use code_metric::{
    CodeMetric, MetricType, MetricThreshold, MetricSummary, 
    MetricIssue, IssueSeverity
};
pub use api_endpoint::{
    APIEndpoint, HTTPMethod, Parameter, ParameterType, ParameterLocation,
    Response, ResponseHeader, Schema, SchemaType, SchemaProperty,
    SecurityRequirement, EndpointGroup, APIDocumentation, SchemaDefinition,
    SecurityScheme, SecuritySchemeType, OAuthFlows, OAuthFlow, ServerInfo, ServerVariable
};