use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct APIEndpoint {
    pub id: String,
    pub name: String,
    pub path: String,
    pub method: HTTPMethod,
    pub controller: String,
    pub action: Option<String>,
    pub description: Option<String>,
    pub parameters: Vec<Parameter>,
    pub responses: Vec<Response>,
    pub middleware: Vec<String>,
    pub tags: Vec<String>,
    pub deprecated: bool,
    pub security_requirements: Vec<SecurityRequirement>,
    pub file_path: String,
    pub line_number: Option<u32>,
    pub documentation_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HTTPMethod {
    GET,
    POST,
    PUT,
    DELETE,
    PATCH,
    HEAD,
    OPTIONS,
    CONNECT,
    TRACE,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parameter {
    pub name: String,
    pub param_type: ParameterType,
    pub location: ParameterLocation,
    pub required: bool,
    pub description: Option<String>,
    pub schema: Option<Schema>,
    pub default_value: Option<serde_json::Value>,
    pub example: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ParameterType {
    String,
    Number,
    Integer,
    Boolean,
    Array,
    Object,
    File,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ParameterLocation {
    Query,
    Path,
    Header,
    Cookie,
    Body,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Response {
    pub status_code: u16,
    pub description: String,
    pub content_type: Option<String>,
    pub schema: Option<Schema>,
    pub example: Option<serde_json::Value>,
    pub headers: Vec<ResponseHeader>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseHeader {
    pub name: String,
    pub description: Option<String>,
    pub schema: Schema,
    pub required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Schema {
    pub schema_type: SchemaType,
    pub format: Option<String>,
    pub properties: Option<Vec<SchemaProperty>>,
    pub items: Option<Box<Schema>>,
    pub required: Option<Vec<String>>,
    pub enum_values: Option<Vec<serde_json::Value>>,
    pub minimum: Option<f64>,
    pub maximum: Option<f64>,
    pub min_length: Option<u32>,
    pub max_length: Option<u32>,
    pub pattern: Option<String>,
    pub example: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SchemaType {
    String,
    Number,
    Integer,
    Boolean,
    Array,
    Object,
    Null,
    Any,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaProperty {
    pub name: String,
    pub schema: Schema,
    pub required: bool,
    pub description: Option<String>,
    pub example: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityRequirement {
    pub name: String,
    pub scopes: Vec<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointGroup {
    pub id: String,
    pub name: String,
    pub base_path: String,
    pub description: Option<String>,
    pub endpoints: Vec<String>, // Endpoint IDs
    pub common_parameters: Vec<Parameter>,
    pub common_responses: Vec<Response>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct APIDocumentation {
    pub id: String,
    pub title: String,
    pub version: String,
    pub description: Option<String>,
    pub base_url: String,
    pub endpoints: Vec<APIEndpoint>,
    pub groups: Vec<EndpointGroup>,
    pub schemas: Vec<SchemaDefinition>,
    pub security_schemes: Vec<SecurityScheme>,
    pub servers: Vec<ServerInfo>,
    pub generated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaDefinition {
    pub name: String,
    pub schema: Schema,
    pub description: Option<String>,
    pub example: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityScheme {
    pub name: String,
    pub scheme_type: SecuritySchemeType,
    pub description: Option<String>,
    pub bearer_format: Option<String>,
    pub oauth_flows: Option<OAuthFlows>,
    pub open_id_connect_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecuritySchemeType {
    ApiKey,
    Http,
    OAuth2,
    OpenIdConnect,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthFlows {
    pub implicit: Option<OAuthFlow>,
    pub password: Option<OAuthFlow>,
    pub client_credentials: Option<OAuthFlow>,
    pub authorization_code: Option<OAuthFlow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthFlow {
    pub authorization_url: Option<String>,
    pub token_url: Option<String>,
    pub refresh_url: Option<String>,
    pub scopes: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    pub url: String,
    pub description: Option<String>,
    pub variables: Option<std::collections::HashMap<String, ServerVariable>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerVariable {
    pub default_value: String,
    pub description: Option<String>,
    pub enum_values: Option<Vec<String>>,
}

impl APIEndpoint {
    pub fn new(
        id: String,
        name: String,
        path: String,
        method: HTTPMethod,
        controller: String,
        file_path: String,
    ) -> Self {
        let now = Utc::now();
        Self {
            id,
            name,
            path,
            method,
            controller,
            action: None,
            description: None,
            parameters: Vec::new(),
            responses: Vec::new(),
            middleware: Vec::new(),
            tags: Vec::new(),
            deprecated: false,
            security_requirements: Vec::new(),
            file_path,
            line_number: None,
            documentation_url: None,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn with_description(mut self, description: String) -> Self {
        self.description = Some(description);
        self
    }

    pub fn with_action(mut self, action: String) -> Self {
        self.action = Some(action);
        self
    }

    pub fn with_line_number(mut self, line_number: u32) -> Self {
        self.line_number = Some(line_number);
        self
    }

    pub fn add_parameter(mut self, parameter: Parameter) -> Self {
        self.parameters.push(parameter);
        self
    }

    pub fn add_response(mut self, response: Response) -> Self {
        self.responses.push(response);
        self
    }

    pub fn add_middleware(mut self, middleware: String) -> Self {
        self.middleware.push(middleware);
        self
    }

    pub fn add_tag(mut self, tag: String) -> Self {
        self.tags.push(tag);
        self
    }

    pub fn add_security_requirement(mut self, security: SecurityRequirement) -> Self {
        self.security_requirements.push(security);
        self
    }

    pub fn set_deprecated(mut self, deprecated: bool) -> Self {
        self.deprecated = deprecated;
        self
    }

    pub fn get_path_with_method(&self) -> String {
        format!("{} {}", self.method, self.path)
    }

    pub fn get_content_types(&self) -> Vec<String> {
        self.responses
            .iter()
            .filter_map(|r| r.content_type.clone())
            .collect()
    }

    pub fn has_parameter(&self, name: &str, location: ParameterLocation) -> bool {
        self.parameters.iter().any(|p| p.name == name && matches!(p.location, location))
    }

    pub fn get_required_parameters(&self) -> Vec<&Parameter> {
        self.parameters.iter().filter(|p| p.required).collect()
    }

    pub fn is_authenticated(&self) -> bool {
        !self.security_requirements.is_empty()
    }

    pub fn is_deprecated(&self) -> bool {
        self.deprecated
    }

    pub fn update_timestamp(&mut self) {
        self.updated_at = Utc::now();
    }
}

impl Parameter {
    pub fn new(
        name: String,
        param_type: ParameterType,
        location: ParameterLocation,
        required: bool,
    ) -> Self {
        Self {
            name,
            param_type,
            location,
            required,
            description: None,
            schema: None,
            default_value: None,
            example: None,
        }
    }

    pub fn with_description(mut self, description: String) -> Self {
        self.description = Some(description);
        self
    }

    pub fn with_schema(mut self, schema: Schema) -> Self {
        self.schema = Some(schema);
        self
    }

    pub fn with_default(mut self, default: serde_json::Value) -> Self {
        self.default_value = Some(default);
        self
    }

    pub fn with_example(mut self, example: serde_json::Value) -> Self {
        self.example = Some(example);
        self
    }
}

impl Response {
    pub fn new(status_code: u16, description: String) -> Self {
        Self {
            status_code,
            description,
            content_type: None,
            schema: None,
            example: None,
            headers: Vec::new(),
        }
    }

    pub fn with_content_type(mut self, content_type: String) -> Self {
        self.content_type = Some(content_type);
        self
    }

    pub fn with_schema(mut self, schema: Schema) -> Self {
        self.schema = Some(schema);
        self
    }

    pub fn with_example(mut self, example: serde_json::Value) -> Self {
        self.example = Some(example);
        self
    }

    pub fn add_header(mut self, header: ResponseHeader) -> Self {
        self.headers.push(header);
        self
    }

    pub fn is_success(&self) -> bool {
        self.status_code >= 200 && self.status_code < 300
    }

    pub fn is_error(&self) -> bool {
        self.status_code >= 400
    }
}

impl Schema {
    pub fn new(schema_type: SchemaType) -> Self {
        Self {
            schema_type,
            format: None,
            properties: None,
            items: None,
            required: None,
            enum_values: None,
            minimum: None,
            maximum: None,
            min_length: None,
            max_length: None,
            pattern: None,
            example: None,
        }
    }

    pub fn string() -> Self {
        Self::new(SchemaType::String)
    }

    pub fn number() -> Self {
        Self::new(SchemaType::Number)
    }

    pub fn integer() -> Self {
        Self::new(SchemaType::Integer)
    }

    pub fn boolean() -> Self {
        Self::new(SchemaType::Boolean)
    }

    pub fn array(items: Schema) -> Self {
        Self {
            schema_type: SchemaType::Array,
            items: Some(Box::new(items)),
            ..Default::default()
        }
    }

    pub fn object() -> Self {
        Self::new(SchemaType::Object)
    }

    pub fn with_format(mut self, format: String) -> Self {
        self.format = Some(format);
        self
    }

    pub fn with_properties(mut self, properties: Vec<SchemaProperty>) -> Self {
        self.properties = Some(properties);
        self
    }

    pub fn with_required(mut self, required: Vec<String>) -> Self {
        self.required = Some(required);
        self
    }

    pub fn with_enum(mut self, enum_values: Vec<serde_json::Value>) -> Self {
        self.enum_values = Some(enum_values);
        self
    }

    pub fn with_minimum(mut self, minimum: f64) -> Self {
        self.minimum = Some(minimum);
        self
    }

    pub fn with_maximum(mut self, maximum: f64) -> Self {
        self.maximum = Some(maximum);
        self
    }

    pub fn with_example(mut self, example: serde_json::Value) -> Self {
        self.example = Some(example);
        self
    }
}

impl Default for Schema {
    fn default() -> Self {
        Self::new(SchemaType::Any)
    }
}

impl std::fmt::Display for HTTPMethod {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            HTTPMethod::GET => write!(f, "GET"),
            HTTPMethod::POST => write!(f, "POST"),
            HTTPMethod::PUT => write!(f, "PUT"),
            HTTPMethod::DELETE => write!(f, "DELETE"),
            HTTPMethod::PATCH => write!(f, "PATCH"),
            HTTPMethod::HEAD => write!(f, "HEAD"),
            HTTPMethod::OPTIONS => write!(f, "OPTIONS"),
            HTTPMethod::CONNECT => write!(f, "CONNECT"),
            HTTPMethod::TRACE => write!(f, "TRACE"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_endpoint_creation() {
        let endpoint = APIEndpoint::new(
            "endpoint-1".to_string(),
            "Get Users".to_string(),
            "/api/users".to_string(),
            HTTPMethod::GET,
            "UserController".to_string(),
            "src/controllers/user_controller.rs".to_string(),
        );

        assert_eq!(endpoint.name, "Get Users");
        assert_eq!(endpoint.path, "/api/users");
        assert_eq!(endpoint.method, HTTPMethod::GET);
        assert!(!endpoint.deprecated);
    }

    #[test]
    fn test_endpoint_with_modifiers() {
        let endpoint = APIEndpoint::new(
            "endpoint-2".to_string(),
            "Create User".to_string(),
            "/api/users".to_string(),
            HTTPMethod::POST,
            "UserController".to_string(),
            "src/controllers/user_controller.rs".to_string(),
        )
        .with_description("Create a new user".to_string())
        .with_action("create".to_string())
        .with_line_number(42)
        .add_tag("users".to_string())
        .set_deprecated(false);

        assert_eq!(endpoint.description, Some("Create a new user".to_string()));
        assert_eq!(endpoint.action, Some("create".to_string()));
        assert_eq!(endpoint.line_number, Some(42));
        assert!(endpoint.tags.contains(&"users".to_string()));
    }

    #[test]
    fn test_parameter_creation() {
        let param = Parameter::new(
            "userId".to_string(),
            ParameterType::String,
            ParameterLocation::Path,
            true,
        )
        .with_description("User ID".to_string())
        .with_example("12345".to_string().into());

        assert_eq!(param.name, "userId");
        assert!(param.required);
        assert_eq!(param.description, Some("User ID".to_string()));
    }

    #[test]
    fn test_response_creation() {
        let success_response = Response::new(
            200,
            "User created successfully".to_string(),
        )
        .with_content_type("application/json".to_string())
        .with_schema(Schema::object());

        assert_eq!(success_response.status_code, 200);
        assert!(success_response.is_success());
        assert!(!success_response.is_error());
    }

    #[test]
    fn test_schema_creation() {
        let string_schema = Schema::string()
            .with_format("email".to_string())
            .with_minimum(5.0)
            .with_maximum(100.0)
            .with_example("user@example.com".to_string().into());

        assert!(matches!(string_schema.schema_type, SchemaType::String));
        assert_eq!(string_schema.format, Some("email".to_string()));

        let array_schema = Schema::array(Schema::string());
        assert!(matches!(array_schema.schema_type, SchemaType::Array));
    }

    #[test]
    fn test_endpoint_utilities() {
        let endpoint = APIEndpoint::new(
            "endpoint-3".to_string(),
            "Get User".to_string(),
            "/api/users/{id}".to_string(),
            HTTPMethod::GET,
            "UserController".to_string(),
            "src/controllers/user_controller.rs".to_string(),
        )
        .add_parameter(Parameter::new(
            "id".to_string(),
            ParameterType::String,
            ParameterLocation::Path,
            true,
        ))
        .add_security_requirement(SecurityRequirement {
            name: "bearerAuth".to_string(),
            scopes: vec!["read:users".to_string()],
            description: Some("Bearer token authentication".to_string()),
        });

        assert_eq!(endpoint.get_path_with_method(), "GET /api/users/{id}");
        assert!(endpoint.has_parameter("id", ParameterLocation::Path));
        assert!(endpoint.is_authenticated());
        assert!(!endpoint.is_deprecated());
    }
}