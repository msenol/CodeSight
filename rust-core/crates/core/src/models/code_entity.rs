//! CodeEntity model implementation
//!
//! Represents a discrete element in code (function, class, method, variable, etc.)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{ModelResult, Timestamped, Validate};
use crate::errors::CoreError;

/// Type of code entity
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EntityType {
    /// Function or procedure
    Function,
    /// Class definition
    Class,
    /// Method within a class
    Method,
    /// Variable declaration
    Variable,
    /// Import or include statement
    Import,
    /// Type definition
    Type,
    /// Interface definition
    Interface,
    /// Enumeration
    Enum,
    /// Constant value
    Constant,
}

/// Visibility level of a code entity
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Visibility {
    /// Publicly accessible
    Public,
    /// Private to the containing scope
    Private,
    /// Protected (accessible to subclasses)
    Protected,
    /// Internal to the module/package
    Internal,
}

impl Default for Visibility {
    fn default() -> Self {
        Self::Public
    }
}

/// A discrete element in code with its location and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeEntity {
    /// Unique identifier for the entity
    pub id: Uuid,
    /// Reference to the codebase this entity belongs to
    pub codebase_id: Uuid,
    /// Type of the code entity
    pub entity_type: EntityType,
    /// Simple name of the entity
    pub name: String,
    /// Fully qualified name (e.g., "com.example.MyClass.myMethod")
    pub qualified_name: String,
    /// File path relative to codebase root
    pub file_path: String,
    /// Starting line number (1-indexed)
    pub start_line: u32,
    /// Ending line number (1-indexed)
    pub end_line: u32,
    /// Starting column number (0-indexed)
    pub start_column: u32,
    /// Ending column number (0-indexed)
    pub end_column: u32,
    /// Programming language
    pub language: String,
    /// Function/method signature (optional)
    pub signature: Option<String>,
    /// Visibility level
    pub visibility: Visibility,
    /// Extracted documentation/comments
    pub documentation: Option<String>,
    /// Hash of the AST content for change detection
    pub ast_hash: Option<String>,
    /// Reference to associated embedding (optional)
    pub embedding_id: Option<Uuid>,
    /// Timestamp when the entity was created
    pub created_at: DateTime<Utc>,
    /// Timestamp when the entity was last updated
    pub updated_at: Option<DateTime<Utc>>,
}

impl CodeEntity {
    /// Create a new code entity
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        codebase_id: Uuid,
        entity_type: EntityType,
        name: String,
        qualified_name: String,
        file_path: String,
        start_line: u32,
        end_line: u32,
        language: String,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            codebase_id,
            entity_type,
            name,
            qualified_name,
            file_path,
            start_line,
            end_line,
            start_column: 0,
            end_column: 0,
            language,
            signature: None,
            visibility: Visibility::default(),
            documentation: None,
            ast_hash: None,
            embedding_id: None,
            created_at: Utc::now(),
            updated_at: None,
        }
    }

    /// Set the column positions
    pub fn with_columns(mut self, start_column: u32, end_column: u32) -> Self {
        self.start_column = start_column;
        self.end_column = end_column;
        self
    }

    /// Set the signature
    pub fn with_signature(mut self, signature: String) -> Self {
        self.signature = Some(signature);
        self
    }

    /// Set the visibility
    pub fn with_visibility(mut self, visibility: Visibility) -> Self {
        self.visibility = visibility;
        self
    }

    /// Set the documentation
    pub fn with_documentation(mut self, documentation: String) -> Self {
        self.documentation = Some(documentation);
        self
    }

    /// Set the AST hash
    pub fn with_ast_hash(mut self, ast_hash: String) -> Self {
        self.ast_hash = Some(ast_hash);
        self
    }

    /// Update the entity's content and mark as updated
    pub fn update_content(&mut self, ast_hash: Option<String>, documentation: Option<String>) {
        self.ast_hash = ast_hash;
        self.documentation = documentation;
        self.updated_at = Some(Utc::now());
    }

    /// Associate an embedding with this entity
    pub fn set_embedding(&mut self, embedding_id: Uuid) {
        self.embedding_id = Some(embedding_id);
        self.updated_at = Some(Utc::now());
    }

    /// Get the number of lines this entity spans
    pub fn line_count(&self) -> u32 {
        if self.end_line >= self.start_line {
            self.end_line - self.start_line + 1
        } else {
            1
        }
    }

    /// Check if this entity is a callable (function or method)
    pub fn is_callable(&self) -> bool {
        matches!(self.entity_type, EntityType::Function | EntityType::Method)
    }

    /// Check if this entity is a type definition
    pub fn is_type_definition(&self) -> bool {
        matches!(
            self.entity_type,
            EntityType::Class | EntityType::Interface | EntityType::Type | EntityType::Enum
        )
    }

    /// Check if this entity has documentation
    pub fn has_documentation(&self) -> bool {
        self.documentation.as_ref().is_some_and(|doc| !doc.trim().is_empty())
    }

    /// Get a short display name for the entity
    pub fn display_name(&self) -> String {
        match &self.signature {
            Some(sig) if self.is_callable() => format!("{}{}", self.name, sig),
            _ => self.name.clone(),
        }
    }

    /// Get the entity's location as a string
    pub fn location_string(&self) -> String {
        format!("{}:{}:{}", self.file_path, self.start_line, self.start_column)
    }

    /// Check if the entity spans multiple lines
    pub fn is_multiline(&self) -> bool {
        self.start_line != self.end_line
    }

    /// Get the file extension from the file path
    pub fn file_extension(&self) -> Option<&str> {
        std::path::Path::new(&self.file_path)
            .extension()
            .and_then(|ext| ext.to_str())
    }

    /// Check if this entity contains a given line number
    pub fn contains_line(&self, line: u32) -> bool {
        line >= self.start_line && line <= self.end_line
    }

    /// Check if this entity overlaps with another entity's range
    pub fn overlaps_with(&self, other: &CodeEntity) -> bool {
        if self.file_path != other.file_path {
            return false;
        }
        
        !(self.end_line < other.start_line || other.end_line < self.start_line)
    }
}

impl Validate for CodeEntity {
    fn validate(&self) -> ModelResult<()> {
        if self.name.trim().is_empty() {
            return Err(CoreError::ValidationError(
                "Entity name cannot be empty".to_string(),
            ));
        }

        if self.qualified_name.trim().is_empty() {
            return Err(CoreError::ValidationError(
                "Qualified name cannot be empty".to_string(),
            ));
        }

        if self.file_path.trim().is_empty() {
            return Err(CoreError::ValidationError(
                "File path cannot be empty".to_string(),
            ));
        }

        if self.language.trim().is_empty() {
            return Err(CoreError::ValidationError(
                "Language cannot be empty".to_string(),
            ));
        }

        if self.start_line == 0 {
            return Err(CoreError::ValidationError(
                "Start line must be greater than 0".to_string(),
            ));
        }

        if self.end_line == 0 {
            return Err(CoreError::ValidationError(
                "End line must be greater than 0".to_string(),
            ));
        }

        if self.start_line > self.end_line {
            return Err(CoreError::ValidationError(
                "Start line cannot be greater than end line".to_string(),
            ));
        }

        // Validate file path is relative (cross-platform check)
        let path = std::path::Path::new(&self.file_path);
        // Check for absolute paths on both Unix and Windows platforms
        if path.is_absolute() || self.file_path.starts_with('/') {
            return Err(CoreError::ValidationError(
                "File path must be relative to codebase root".to_string(),
            ));
        }

        Ok(())
    }
}

impl Timestamped for CodeEntity {
    fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    fn updated_at(&self) -> Option<DateTime<Utc>> {
        self.updated_at
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_code_entity() {
        let codebase_id = Uuid::new_v4();
        let entity = CodeEntity::new(
            codebase_id,
            EntityType::Function,
            "test_function".to_string(),
            "module::test_function".to_string(),
            "src/lib.rs".to_string(),
            10,
            15,
            "rust".to_string(),
        );

        assert_eq!(entity.codebase_id, codebase_id);
        assert_eq!(entity.entity_type, EntityType::Function);
        assert_eq!(entity.name, "test_function");
        assert_eq!(entity.start_line, 10);
        assert_eq!(entity.end_line, 15);
        assert_eq!(entity.line_count(), 6);
        assert!(entity.is_callable());
    }

    #[test]
    fn test_builder_pattern() {
        let entity = CodeEntity::new(
            Uuid::new_v4(),
            EntityType::Method,
            "method".to_string(),
            "Class::method".to_string(),
            "src/class.rs".to_string(),
            5,
            10,
            "rust".to_string(),
        )
        .with_columns(4, 20)
        .with_signature("(self, param: i32) -> String".to_string())
        .with_visibility(Visibility::Private)
        .with_documentation("A test method".to_string());

        assert_eq!(entity.start_column, 4);
        assert_eq!(entity.end_column, 20);
        assert!(entity.signature.is_some());
        assert_eq!(entity.visibility, Visibility::Private);
        assert!(entity.has_documentation());
    }

    #[test]
    fn test_entity_types() {
        let function = CodeEntity::new(
            Uuid::new_v4(),
            EntityType::Function,
            "func".to_string(),
            "func".to_string(),
            "test.rs".to_string(),
            1,
            1,
            "rust".to_string(),
        );
        assert!(function.is_callable());
        assert!(!function.is_type_definition());

        let class = CodeEntity::new(
            Uuid::new_v4(),
            EntityType::Class,
            "MyClass".to_string(),
            "MyClass".to_string(),
            "test.rs".to_string(),
            1,
            1,
            "rust".to_string(),
        );
        assert!(!class.is_callable());
        assert!(class.is_type_definition());
    }

    #[test]
    fn test_location_methods() {
        let entity = CodeEntity::new(
            Uuid::new_v4(),
            EntityType::Function,
            "test".to_string(),
            "test".to_string(),
            "src/lib.rs".to_string(),
            10,
            15,
            "rust".to_string(),
        ).with_columns(4, 20);

        assert_eq!(entity.location_string(), "src/lib.rs:10:4");
        assert!(entity.is_multiline());
        assert!(entity.contains_line(12));
        assert!(!entity.contains_line(20));
        assert_eq!(entity.file_extension(), Some("rs"));
    }

    #[test]
    fn test_overlaps() {
        let entity1 = CodeEntity::new(
            Uuid::new_v4(),
            EntityType::Function,
            "func1".to_string(),
            "func1".to_string(),
            "test.rs".to_string(),
            10,
            20,
            "rust".to_string(),
        );

        let entity2 = CodeEntity::new(
            Uuid::new_v4(),
            EntityType::Function,
            "func2".to_string(),
            "func2".to_string(),
            "test.rs".to_string(),
            15,
            25,
            "rust".to_string(),
        );

        let entity3 = CodeEntity::new(
            Uuid::new_v4(),
            EntityType::Function,
            "func3".to_string(),
            "func3".to_string(),
            "other.rs".to_string(),
            15,
            25,
            "rust".to_string(),
        );

        assert!(entity1.overlaps_with(&entity2));
        assert!(!entity1.overlaps_with(&entity3)); // Different file
    }

    #[test]
    fn test_validation() {
        let mut entity = CodeEntity::new(
            Uuid::new_v4(),
            EntityType::Function,
            "".to_string(), // Empty name
            "test".to_string(),
            "test.rs".to_string(),
            1,
            1,
            "rust".to_string(),
        );
        assert!(entity.validate().is_err());

        entity.name = "test".to_string();
        entity.start_line = 0; // Invalid line number
        assert!(entity.validate().is_err());

        entity.start_line = 10;
        entity.end_line = 5; // End before start
        assert!(entity.validate().is_err());

        entity.end_line = 15;
        entity.file_path = "/absolute/path".to_string(); // Absolute path
        assert!(entity.validate().is_err());

        entity.file_path = "relative/path.rs".to_string();
        assert!(entity.validate().is_ok());
    }
}