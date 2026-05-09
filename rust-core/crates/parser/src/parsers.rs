//! Language-specific parsers for Code Intelligence MCP Server

use crate::CodeEntity;
use crate::EntityType;
use crate::{Language, LanguageParser, ParseResult};
use anyhow::Result;
use std::path::Path;
use std::sync::Mutex;
use tree_sitter::Parser;
use uuid::Uuid;

pub struct TypeScriptParser {
    parser: Mutex<Parser>,
}

impl TypeScriptParser {
    pub fn new() -> Self {
        let mut parser = Parser::new();
        parser
            .set_language(tree_sitter_typescript::language_typescript().into())
            .expect("Failed to set TypeScript language");
        Self {
            parser: Mutex::new(parser),
        }
    }
}

impl Default for TypeScriptParser {
    fn default() -> Self {
        Self::new()
    }
}

impl LanguageParser for TypeScriptParser {
    fn parse_file(&self, file_path: &Path, content: &str) -> Result<ParseResult> {
        let tree = self
            .parser
            .lock()
            .unwrap()
            .parse(content, None)
            .ok_or_else(|| anyhow::anyhow!("Failed to parse TypeScript file"))?;
        let entities = self.extract_entities(&tree, content)?;

        Ok(ParseResult {
            file_path: file_path.to_string_lossy().to_string(),
            language: Language::TypeScript,
            entities,
            imports: vec![],
            exports: vec![],
            errors: vec![],
            parse_time_ms: 0,
        })
    }

    fn extract_entities(&self, tree: &tree_sitter::Tree, content: &str) -> Result<Vec<CodeEntity>> {
        extract_entities_from_tree(tree, content, Language::TypeScript)
    }

    fn get_language(&self) -> Language {
        Language::TypeScript
    }
}

pub struct JavaScriptParser {
    parser: Mutex<Parser>,
}

impl JavaScriptParser {
    pub fn new() -> Self {
        let mut parser = Parser::new();
        parser
            .set_language(tree_sitter_javascript::language().into())
            .expect("Failed to set parser language");
        Self {
            parser: Mutex::new(parser),
        }
    }
}

impl Default for JavaScriptParser {
    fn default() -> Self {
        Self::new()
    }
}

impl LanguageParser for JavaScriptParser {
    fn parse_file(&self, file_path: &Path, content: &str) -> Result<ParseResult> {
        let tree = self
            .parser
            .lock()
            .unwrap()
            .parse(content, None)
            .ok_or_else(|| anyhow::anyhow!("Failed to parse JavaScript file"))?;
        let entities = self.extract_entities(&tree, content)?;

        Ok(ParseResult {
            file_path: file_path.to_string_lossy().to_string(),
            language: Language::JavaScript,
            entities,
            imports: vec![],
            exports: vec![],
            errors: vec![],
            parse_time_ms: 0,
        })
    }

    fn extract_entities(&self, tree: &tree_sitter::Tree, content: &str) -> Result<Vec<CodeEntity>> {
        extract_entities_from_tree(tree, content, Language::JavaScript)
    }

    fn get_language(&self) -> Language {
        Language::JavaScript
    }
}

pub struct PythonParser {
    parser: Mutex<Parser>,
}

impl PythonParser {
    pub fn new() -> Self {
        let mut parser = Parser::new();
        parser
            .set_language(tree_sitter_python::language().into())
            .expect("Failed to set parser language");
        Self {
            parser: Mutex::new(parser),
        }
    }
}

impl Default for PythonParser {
    fn default() -> Self {
        Self::new()
    }
}

impl LanguageParser for PythonParser {
    fn parse_file(&self, file_path: &Path, content: &str) -> Result<ParseResult> {
        let tree = self
            .parser
            .lock()
            .unwrap()
            .parse(content, None)
            .ok_or_else(|| anyhow::anyhow!("Failed to parse Python file"))?;
        let entities = self.extract_entities(&tree, content)?;

        Ok(ParseResult {
            file_path: file_path.to_string_lossy().to_string(),
            language: Language::Python,
            entities,
            imports: vec![],
            exports: vec![],
            errors: vec![],
            parse_time_ms: 0,
        })
    }

    fn extract_entities(&self, tree: &tree_sitter::Tree, content: &str) -> Result<Vec<CodeEntity>> {
        extract_entities_from_tree(tree, content, Language::Python)
    }

    fn get_language(&self) -> Language {
        Language::Python
    }
}

pub struct RustParser {
    parser: Mutex<Parser>,
}

impl RustParser {
    pub fn new() -> Self {
        let mut parser = Parser::new();
        parser
            .set_language(tree_sitter_rust::language().into())
            .expect("Failed to set parser language");
        Self {
            parser: Mutex::new(parser),
        }
    }
}

impl Default for RustParser {
    fn default() -> Self {
        Self::new()
    }
}

impl LanguageParser for RustParser {
    fn parse_file(&self, file_path: &Path, content: &str) -> Result<ParseResult> {
        let tree = self
            .parser
            .lock()
            .unwrap()
            .parse(content, None)
            .ok_or_else(|| anyhow::anyhow!("Failed to parse Rust file"))?;
        let entities = self.extract_entities(&tree, content)?;

        Ok(ParseResult {
            file_path: file_path.to_string_lossy().to_string(),
            language: Language::Rust,
            entities,
            imports: vec![],
            exports: vec![],
            errors: vec![],
            parse_time_ms: 0,
        })
    }

    fn extract_entities(&self, tree: &tree_sitter::Tree, content: &str) -> Result<Vec<CodeEntity>> {
        extract_entities_from_tree(tree, content, Language::Rust)
    }

    fn get_language(&self) -> Language {
        Language::Rust
    }
}

pub struct GoParser {
    parser: Mutex<Parser>,
}

impl GoParser {
    pub fn new() -> Self {
        let mut parser = Parser::new();
        parser
            .set_language(tree_sitter_go::language().into())
            .expect("Failed to set parser language");
        Self {
            parser: Mutex::new(parser),
        }
    }
}

impl Default for GoParser {
    fn default() -> Self {
        Self::new()
    }
}

impl LanguageParser for GoParser {
    fn parse_file(&self, file_path: &Path, content: &str) -> Result<ParseResult> {
        let tree = self
            .parser
            .lock()
            .unwrap()
            .parse(content, None)
            .ok_or_else(|| anyhow::anyhow!("Failed to parse Go file"))?;
        let entities = self.extract_entities(&tree, content)?;

        Ok(ParseResult {
            file_path: file_path.to_string_lossy().to_string(),
            language: Language::Go,
            entities,
            imports: vec![],
            exports: vec![],
            errors: vec![],
            parse_time_ms: 0,
        })
    }

    fn extract_entities(&self, tree: &tree_sitter::Tree, content: &str) -> Result<Vec<CodeEntity>> {
        extract_entities_from_tree(tree, content, Language::Go)
    }

    fn get_language(&self) -> Language {
        Language::Go
    }
}

pub struct JavaParser {
    parser: Mutex<Parser>,
}

impl JavaParser {
    pub fn new() -> Self {
        let mut parser = Parser::new();
        parser
            .set_language(tree_sitter_java::language().into())
            .expect("Failed to set parser language");
        Self {
            parser: Mutex::new(parser),
        }
    }
}

impl Default for JavaParser {
    fn default() -> Self {
        Self::new()
    }
}

impl LanguageParser for JavaParser {
    fn parse_file(&self, file_path: &Path, content: &str) -> Result<ParseResult> {
        let tree = self
            .parser
            .lock()
            .unwrap()
            .parse(content, None)
            .ok_or_else(|| anyhow::anyhow!("Failed to parse Java file"))?;
        let entities = self.extract_entities(&tree, content)?;

        Ok(ParseResult {
            file_path: file_path.to_string_lossy().to_string(),
            language: Language::Java,
            entities,
            imports: vec![],
            exports: vec![],
            errors: vec![],
            parse_time_ms: 0,
        })
    }

    fn extract_entities(&self, tree: &tree_sitter::Tree, content: &str) -> Result<Vec<CodeEntity>> {
        extract_entities_from_tree(tree, content, Language::Java)
    }

    fn get_language(&self) -> Language {
        Language::Java
    }
}

pub struct CppParser {
    parser: Mutex<Parser>,
}

impl CppParser {
    pub fn new() -> Self {
        let mut parser = Parser::new();
        parser
            .set_language(tree_sitter_cpp::language().into())
            .expect("Failed to set parser language");
        Self {
            parser: Mutex::new(parser),
        }
    }
}

impl Default for CppParser {
    fn default() -> Self {
        Self::new()
    }
}

impl LanguageParser for CppParser {
    fn parse_file(&self, file_path: &Path, content: &str) -> Result<ParseResult> {
        let tree = self
            .parser
            .lock()
            .unwrap()
            .parse(content, None)
            .ok_or_else(|| anyhow::anyhow!("Failed to parse C++ file"))?;
        let entities = self.extract_entities(&tree, content)?;

        Ok(ParseResult {
            file_path: file_path.to_string_lossy().to_string(),
            language: Language::Cpp,
            entities,
            imports: vec![],
            exports: vec![],
            errors: vec![],
            parse_time_ms: 0,
        })
    }

    fn extract_entities(&self, tree: &tree_sitter::Tree, content: &str) -> Result<Vec<CodeEntity>> {
        extract_entities_from_tree(tree, content, Language::Cpp)
    }

    fn get_language(&self) -> Language {
        Language::Cpp
    }
}

pub struct CSharpParser {
    parser: Mutex<Parser>,
}

impl CSharpParser {
    pub fn new() -> Self {
        let mut parser = Parser::new();
        parser
            .set_language(tree_sitter_c_sharp::language().into())
            .expect("Failed to set parser language");
        Self {
            parser: Mutex::new(parser),
        }
    }
}

impl Default for CSharpParser {
    fn default() -> Self {
        Self::new()
    }
}

impl LanguageParser for CSharpParser {
    fn parse_file(&self, file_path: &Path, content: &str) -> Result<ParseResult> {
        let tree = self
            .parser
            .lock()
            .unwrap()
            .parse(content, None)
            .ok_or_else(|| anyhow::anyhow!("Failed to parse C# file"))?;
        let entities = self.extract_entities(&tree, content)?;

        Ok(ParseResult {
            file_path: file_path.to_string_lossy().to_string(),
            language: Language::CSharp,
            entities,
            imports: vec![],
            exports: vec![],
            errors: vec![],
            parse_time_ms: 0,
        })
    }

    fn extract_entities(&self, tree: &tree_sitter::Tree, content: &str) -> Result<Vec<CodeEntity>> {
        extract_entities_from_tree(tree, content, Language::CSharp)
    }

    fn get_language(&self) -> Language {
        Language::CSharp
    }
}

// ---------------------------------------------------------------------------
// Shared entity extraction — DRY: one traversal function for all languages
// ---------------------------------------------------------------------------

/// Extract code entities from a tree-sitter AST via recursive traversal.
/// Handles function, class, method, and arrow_function nodes.
fn extract_entities_from_tree(
    tree: &tree_sitter::Tree,
    content: &str,
    _language: Language,
) -> Result<Vec<CodeEntity>> {
    let mut entities = Vec::new();
    let root = tree.root_node();
    traverse_node(&root, content, &mut entities);
    Ok(entities)
}

fn traverse_node(node: &tree_sitter::Node, content: &str, entities: &mut Vec<CodeEntity>) {
    let kind = node.kind();

    match kind {
        "function_declaration" | "function" | "method_definition" | "method_declaration" => {
            if let Some(name) = node_name(node, content) {
                entities.push(build_entity(name, EntityType::Function, node, content));
            }
        }
        "class_declaration"
        | "class"
        | "class_definition"
        | "interface_declaration"
        | "interface" => {
            if let Some(name) = node_name(node, content) {
                entities.push(build_entity(name, EntityType::Class, node, content));
            }
        }
        "arrow_function" => {
            // Arrow functions often appear in variable declarators — capture the variable name
            if let Some(parent) = node.parent() {
                if parent.kind() == "variable_declarator" {
                    if let Some(name) = node_name(&parent, content) {
                        entities.push(build_entity(name, EntityType::Function, node, content));
                    }
                }
            }
        }
        "variable_declarator" | "variable_declaration" => {
            if let Some(name) = node_name(node, content) {
                entities.push(build_entity(name, EntityType::Variable, node, content));
            }
        }
        _ => {}
    }

    for i in 0..node.child_count() {
        if let Some(child) = node.child(i) {
            traverse_node(&child, content, entities);
        }
    }
}

/// Try to extract the identifier name from a node.
fn node_name(node: &tree_sitter::Node, content: &str) -> Option<String> {
    for i in 0..node.child_count() {
        let child = node.child(i)?;
        if child.kind() == "identifier" || child.kind() == "type_identifier" {
            return Some(child_text(&child, content).to_string());
        }
    }
    None
}

fn child_text<'a>(node: &tree_sitter::Node<'a>, content: &'a str) -> &'a str {
    &content[node.start_byte()..node.end_byte()]
}

fn build_entity(
    name: String,
    entity_type: EntityType,
    node: &tree_sitter::Node,
    content: &str,
) -> CodeEntity {
    let start_line = node.start_position().row as u32 + 1;
    let end_line = node.end_position().row as u32 + 1;
    let entity_content = child_text(node, content).to_string();

    CodeEntity {
        id: Uuid::new_v4(),
        name,
        entity_type,
        file_path: String::new(), // filled by caller
        start_line,
        end_line,
        start_column: node.start_position().column as u32,
        end_column: node.end_position().column as u32,
        content: entity_content,
        signature: None,
        documentation: None,
        visibility: None,
        parameters: vec![],
        return_type: None,
        dependencies: vec![],
        metadata: std::collections::HashMap::new(),
    }
}
