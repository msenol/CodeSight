//! Entity extraction from parsed code

use std::collections::HashMap;
use regex::Regex;
use anyhow::Result;
use uuid::Uuid;
use chrono::Utc;

use code_intelligence_core::models::{CodeEntity, EntityType, Visibility};
use crate::Language;

/// Entity extraction patterns for different languages
pub struct EntityExtractor {
    patterns: HashMap<Language, LanguagePatterns>,
}

/// Language-specific extraction patterns
struct LanguagePatterns {
    function: Vec<String>,
    class: Vec<String>,
    variable: Vec<String>,
    imports: Vec<String>,
}

impl EntityExtractor {
    /// Create a new entity extractor
    pub fn new() -> Self {
        let mut patterns = HashMap::new();

        // TypeScript/JavaScript patterns
        patterns.insert(Language::TypeScript, LanguagePatterns {
            function: vec![
                r"(?m)^(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*\w+\s*)?\{".to_string(),
                r"(?m)^(\w+)\s*=\s*(?:async\s+)?function\s*\([^)]*\)\s*(?::\s*\w+\s*)?\{".to_string(),
                r"(?m)^(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+\s*)?\s*=>".to_string(),
                r"(?m)^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)".to_string(),
            ],
            class: vec![
                r"(?m)^class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{".to_string(),
                r"(?m)^interface\s+(\w+)(?:\s+extends\s+\w+(?:\s*,\s*\w+)*)?\s*\{".to_string(),
                r"(?m)^type\s+(\w+)\s*=".to_string(),
                r"(?m)^enum\s+(\w+)\s*\{".to_string(),
            ],
            variable: vec![
                r"(?m)^(?:const|let|var)\s+(\w+)\s*[:=]".to_string(),
                r"(?m)^(?:private|public|protected)?\s*(?:readonly\s+)?(\w+)\s*[:=]".to_string(),
            ],
            imports: vec![
                r#"import\s+.*?\s+from\s+['"]([^'"]+)['"]"#.to_string(),
                r#"import\s+['"]([^'"]+)['"]"#.to_string(),
                r#"require\(['"]([^'"]+)['"]\)"#.to_string(),
            ],
        });

        Self { patterns }
    }

    /// Extract entities from code content
    pub fn extract_entities(&self, content: &str, language: Language, file_path: &str) -> Result<Vec<CodeEntity>> {
        let patterns = self.patterns.get(&language)
            .ok_or_else(|| anyhow::anyhow!("Unsupported language: {:?}", language))?;

        let mut entities = Vec::new();
        let codebase_id = Uuid::new_v4();
        let now = Utc::now();

        // Extract functions
        for pattern in &patterns.function {
            let re = Regex::new(pattern)?;
            for cap in re.captures_iter(content) {
                if let Some(name) = cap.get(1) {
                    let line_num = content[..name.start()].lines().count() as u32;
                    let entity = CodeEntity::new(
                        codebase_id,
                        EntityType::Function,
                        name.as_str().to_string(),
                        name.as_str().to_string(),
                        file_path.to_string(),
                        line_num,
                        line_num,
                        language.to_string(),
                    )
                    .with_signature(name.as_str().to_string())
                    .with_visibility(Visibility::Public);
                    entities.push(entity);
                }
            }
        }

        // Extract classes
        for pattern in &patterns.class {
            let re = Regex::new(pattern)?;
            for cap in re.captures_iter(content) {
                if let Some(name) = cap.get(1) {
                    let line_num = content[..name.start()].lines().count() as u32;
                    let entity_type = if pattern.contains("interface") {
                        EntityType::Interface
                    } else if pattern.contains("enum") {
                        EntityType::Enum
                    } else if pattern.contains("type") {
                        EntityType::Type
                    } else {
                        EntityType::Class
                    };

                    let entity = CodeEntity::new(
                        codebase_id,
                        entity_type,
                        name.as_str().to_string(),
                        name.as_str().to_string(),
                        file_path.to_string(),
                        line_num,
                        line_num,
                        language.to_string(),
                    )
                    .with_signature(name.as_str().to_string())
                    .with_visibility(Visibility::Public);
                    entities.push(entity);
                }
            }
        }

        // Extract variables
        for pattern in &patterns.variable {
            let re = Regex::new(pattern)?;
            for cap in re.captures_iter(content) {
                if let Some(name) = cap.get(1) {
                    let line_num = content[..name.start()].lines().count() as u32;
                    let entity = CodeEntity::new(
                        codebase_id,
                        EntityType::Variable,
                        name.as_str().to_string(),
                        name.as_str().to_string(),
                        file_path.to_string(),
                        line_num,
                        line_num,
                        language.to_string(),
                    )
                    .with_signature(name.as_str().to_string())
                    .with_visibility(Visibility::Public);
                    entities.push(entity);
                }
            }
        }

        // Extract imports
        for pattern in &patterns.imports {
            let re = Regex::new(pattern)?;
            for cap in re.captures_iter(content) {
                if let Some(name) = cap.get(1) {
                    let line_num = content[..name.start()].lines().count() as u32;
                    let entity = CodeEntity::new(
                        codebase_id,
                        EntityType::Import,
                        name.as_str().to_string(),
                        name.as_str().to_string(),
                        file_path.to_string(),
                        line_num,
                        line_num,
                        language.to_string(),
                    )
                    .with_signature(name.as_str().to_string())
                    .with_visibility(Visibility::Public);
                    entities.push(entity);
                }
            }
        }

        Ok(entities)
    }
}

impl Default for EntityExtractor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_function() {
        let extractor = EntityExtractor::new();
        let ts_code = r#"
function testFunction(param: string): number {
    return 42;
}
        "#;

        let entities = extractor.extract_entities(ts_code, Language::TypeScript, "test.ts").unwrap();
        assert_eq!(entities.len(), 1);
        assert_eq!(entities[0].name, "testFunction");
        assert_eq!(entities[0].entity_type, EntityType::Function);
    }

    #[test]
    fn test_extract_class() {
        let extractor = EntityExtractor::new();
        let ts_code = r#"
class TestClass {
    private value: number;

    constructor(value: number) {
        this.value = value;
    }
}
        "#;

        let entities = extractor.extract_entities(ts_code, Language::TypeScript, "test.ts").unwrap();
        assert_eq!(entities.len(), 1);
        assert_eq!(entities[0].name, "TestClass");
        assert_eq!(entities[0].entity_type, EntityType::Class);
    }

    #[test]
    fn test_extract_import() {
        let extractor = EntityExtractor::new();
        let ts_code = r#"
import { useState } from 'react';
import axios from 'axios';
        "#;

        let entities = extractor.extract_entities(ts_code, Language::TypeScript, "test.ts").unwrap();
        assert_eq!(entities.len(), 2);
        assert!(entities.iter().any(|e| e.name == "react"));
        assert!(entities.iter().any(|e| e.name == "axios"));
    }
}