//! FFI bindings for Code Intelligence MCP Server

use napi_derive::napi;
use napi::{Result, Error};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;
use rusqlite::{Connection, params};
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
#[napi(object)]
pub struct CodeEntity {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub entity_type: String,
    pub start_line: i32,
    pub end_line: i32,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[napi(object)]
pub struct SearchResult {
    pub file: String,
    pub line: i32,
    pub content: String,
    pub score: f64,
}

/// Initialize the Code Intelligence engine
#[napi]
pub fn init_engine() -> Result<()> {
    // Initialize SQLite database
    let db_path = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:///tmp/code-intelligence.db".to_string())
        .replace("sqlite://", "");

    let conn = Connection::open(&db_path)
        .map_err(|e| Error::from_reason(format!("Failed to open database: {}", e)))?;

    // Create tables
    conn.execute(
        "CREATE TABLE IF NOT EXISTS code_entities (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            start_line INTEGER,
            end_line INTEGER,
            content TEXT,
            indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    ).map_err(|e| Error::from_reason(format!("Failed to create table: {}", e)))?;

    Ok(())
}

/// Parse a file and extract entities
#[napi]
pub fn parse_file(file_path: String, content: String) -> Result<Vec<CodeEntity>> {
    let mut entities = Vec::new();

    // Simple regex-based extraction for now (functions and classes)
    let lines: Vec<&str> = content.lines().collect();

    for (idx, line) in lines.iter().enumerate() {
        let line_num = (idx + 1) as i32;

        // Extract function declarations (simple pattern)
        if line.contains("function ") || line.contains("async function") {
            if let Some(name) = extract_function_name(line) {
                entities.push(CodeEntity {
                    id: format!("{}:{}:{}", file_path, line_num, name),
                    name: name.clone(),
                    file_path: file_path.clone(),
                    entity_type: "function".to_string(),
                    start_line: line_num,
                    end_line: line_num + 5, // Approximate
                    content: line.to_string(),
                });
            }
        }

        // Extract class declarations
        if line.contains("class ") || line.contains("export class") {
            if let Some(name) = extract_class_name(line) {
                entities.push(CodeEntity {
                    id: format!("{}:{}:{}", file_path, line_num, name),
                    name: name.clone(),
                    file_path: file_path.clone(),
                    entity_type: "class".to_string(),
                    start_line: line_num,
                    end_line: line_num + 10, // Approximate
                    content: line.to_string(),
                });
            }
        }

        // Extract const/let/var declarations
        if line.trim().starts_with("const ") || line.trim().starts_with("let ") || line.trim().starts_with("var ") {
            if let Some(name) = extract_variable_name(line) {
                entities.push(CodeEntity {
                    id: format!("{}:{}:{}", file_path, line_num, name),
                    name: name.clone(),
                    file_path: file_path.clone(),
                    entity_type: "variable".to_string(),
                    start_line: line_num,
                    end_line: line_num,
                    content: line.to_string(),
                });
            }
        }
    }

    Ok(entities)
}

/// Search for code entities
#[napi]
pub fn search_code(query: String, _codebase_path: Option<String>) -> Result<Vec<SearchResult>> {
    let db_path = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:///tmp/code-intelligence.db".to_string())
        .replace("sqlite://", "");

    let conn = Connection::open(&db_path)
        .map_err(|e| Error::from_reason(format!("Failed to open database: {}", e)))?;

    // Simple keyword search
    let search_pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT file_path, start_line, content FROM code_entities
         WHERE name LIKE ?1 OR content LIKE ?1
         ORDER BY
            CASE WHEN name = ?2 THEN 0
                 WHEN name LIKE ?3 THEN 1
                 ELSE 2 END,
            start_line
         LIMIT 20"
    ).map_err(|e| Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let exact_match = query.clone();
    let starts_with = format!("{}%", query);

    let results = stmt.query_map(params![&search_pattern, &exact_match, &starts_with], |row| {
        Ok(SearchResult {
            file: row.get(0)?,
            line: row.get(1)?,
            content: row.get(2)?,
            score: calculate_score(&query, &row.get::<_, String>(2)?),
        })
    }).map_err(|e| Error::from_reason(format!("Query failed: {}", e)))?;

    let mut search_results = Vec::new();
    for result in results {
        if let Ok(r) = result {
            search_results.push(r);
        }
    }

    Ok(search_results)
}

/// Generate embeddings for text (placeholder for now)
#[napi]
pub fn generate_embedding(text: String) -> Result<Vec<f32>> {
    // Simple hash-based mock embedding
    let hash = text.chars().fold(0u32, |acc, c| acc.wrapping_add(c as u32));
    let mut embedding = vec![0.0; 384];
    for i in 0..384 {
        embedding[i] = ((hash.wrapping_mul(i as u32 + 1) % 1000) as f32) / 1000.0;
    }
    Ok(embedding)
}

/// Index a codebase
#[napi]
pub fn index_codebase(path: String) -> Result<String> {
    let codebase_path = Path::new(&path);
    if !codebase_path.exists() {
        return Err(Error::from_reason(format!("Path does not exist: {}", path)));
    }

    // Initialize database
    init_engine()?;

    let db_path = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:///tmp/code-intelligence.db".to_string())
        .replace("sqlite://", "");

    let conn = Connection::open(&db_path)
        .map_err(|e| Error::from_reason(format!("Failed to open database: {}", e)))?;

    // Clear existing entries for this codebase
    conn.execute("DELETE FROM code_entities WHERE file_path LIKE ?1",
                 params![format!("{}%", path)])
        .map_err(|e| Error::from_reason(format!("Failed to clear old entries: {}", e)))?;

    let mut indexed_count = 0;
    let extensions = vec!["js", "ts", "jsx", "tsx", "mjs", "cjs"];

    // Walk through directory
    for entry in WalkDir::new(codebase_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let path = entry.path();

        // Skip node_modules and other ignored paths
        if path.to_str().unwrap_or("").contains("node_modules") ||
           path.to_str().unwrap_or("").contains(".git") ||
           path.to_str().unwrap_or("").contains("dist") ||
           path.to_str().unwrap_or("").contains("build") {
            continue;
        }

        // Check if file has valid extension
        if let Some(ext) = path.extension() {
            if !extensions.contains(&ext.to_str().unwrap_or("")) {
                continue;
            }
        } else {
            continue;
        }

        // Read and parse file
        if let Ok(content) = fs::read_to_string(path) {
            let file_path = path.to_str().unwrap_or("").to_string();

            if let Ok(entities) = parse_file(file_path.clone(), content) {
                // Insert entities into database
                for entity in entities {
                    conn.execute(
                        "INSERT OR REPLACE INTO code_entities (id, name, file_path, entity_type, start_line, end_line, content)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        params![
                            entity.id,
                            entity.name,
                            entity.file_path,
                            entity.entity_type,
                            entity.start_line,
                            entity.end_line,
                            entity.content
                        ],
                    ).ok(); // Ignore individual insert errors
                }
                indexed_count += 1;
            }
        }
    }

    Ok(format!("Indexed {} files in {}", indexed_count, path))
}

// Helper functions
fn extract_function_name(line: &str) -> Option<String> {
    let patterns = vec![
        r"function\s+(\w+)",
        r"async\s+function\s+(\w+)",
        r"const\s+(\w+)\s*=\s*\(",
        r"const\s+(\w+)\s*=\s*async",
        r"(\w+)\s*:\s*function",
    ];

    for pattern in patterns {
        if let Ok(re) = regex::Regex::new(pattern) {
            if let Some(cap) = re.captures(line) {
                if let Some(name) = cap.get(1) {
                    return Some(name.as_str().to_string());
                }
            }
        }
    }
    None
}

fn extract_class_name(line: &str) -> Option<String> {
    let patterns = vec![
        r"class\s+(\w+)",
        r"export\s+class\s+(\w+)",
        r"export\s+default\s+class\s+(\w+)",
    ];

    for pattern in patterns {
        if let Ok(re) = regex::Regex::new(pattern) {
            if let Some(cap) = re.captures(line) {
                if let Some(name) = cap.get(1) {
                    return Some(name.as_str().to_string());
                }
            }
        }
    }
    None
}

fn extract_variable_name(line: &str) -> Option<String> {
    let patterns = vec![
        r"(?:const|let|var)\s+(\w+)\s*=",
        r"(?:const|let|var)\s+(\w+)\s*:",
    ];

    for pattern in patterns {
        if let Ok(re) = regex::Regex::new(pattern) {
            if let Some(cap) = re.captures(line) {
                if let Some(name) = cap.get(1) {
                    return Some(name.as_str().to_string());
                }
            }
        }
    }
    None
}

fn calculate_score(query: &str, content: &str) -> f64 {
    let query_lower = query.to_lowercase();
    let content_lower = content.to_lowercase();

    if content_lower.contains(&query_lower) {
        // Exact match gets higher score
        if content_lower == query_lower {
            return 1.0;
        }
        // Starts with query gets high score
        if content_lower.starts_with(&query_lower) {
            return 0.9;
        }
        // Contains query gets medium score
        return 0.7;
    }

    // No match
    0.0
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_init_engine() {
        let result = init_engine();
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_parse_file() {
        let result = parse_file("test.ts".to_string(), "console.log('hello');".to_string());
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_search_code() {
        let result = search_code("function".to_string());
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_generate_embedding() {
        let result = generate_embedding("test text".to_string());
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 384);
    }
    
    #[test]
    fn test_index_codebase() {
        let result = index_codebase("/path/to/code".to_string());
        assert!(result.is_ok());
    }
}