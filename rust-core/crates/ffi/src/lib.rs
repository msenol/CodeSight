//! FFI bindings for Code Intelligence MCP Server
//!
//! Thin NAPI wrapper that delegates to parser, indexer, and core crates.
//! No regex reimplementation — DRY compliance: all parsing logic lives in
//! `code-intelligence-parser` and `code-intelligence-indexer`.

use napi::{Error, Result};
use napi_derive::napi;
use once_cell::sync::Lazy;
use std::path::Path;
use tokio::runtime::Runtime;

// Re-export from workspace crates — these are the single source of truth
use code_intelligence_parser::CodeParser;
use code_intelligence_indexer::IndexingEngine;

/// Default SQLite database shared with the TypeScript side.
fn db_path() -> std::path::PathBuf {
    if let Ok(cwd) = std::env::current_dir() {
        let candidates = [
            cwd.join("code-intelligence.db"),
            cwd.join("data/code-intelligence.db"),
            cwd.join("../typescript-mcp/code-intelligence.db"),
            cwd.join("../../typescript-mcp/code-intelligence.db"),
            cwd.join("../../../typescript-mcp/code-intelligence.db"),
        ];
        for p in &candidates {
            if p.exists() {
                return p.clone();
            }
        }
    }
    std::path::PathBuf::from("code-intelligence.db")
}

// Global Tokio runtime for executing async indexer operations synchronously
// from the Node.js event loop.
static RUNTIME: Lazy<Runtime> =
    Lazy::new(|| Runtime::new().expect("Failed to create Tokio runtime"));

// ---------------------------------------------------------------------------
// NAPI-friendly structs (mirrors parser::CodeEntity without Uuid)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
#[napi(object)]
pub struct CodeEntity {
    pub id: String,
    pub name: String,
    pub entity_type: String,
    pub file_path: String,
    pub start_line: u32,
    pub end_line: u32,
    pub content: String,
}

#[derive(Debug, Clone)]
#[napi(object)]
pub struct SearchResult {
    pub file: String,
    pub line: u32,
    pub content: String,
    pub score: f64,
}

#[derive(Debug, Clone)]
#[napi(object)]
pub struct ComplexityMetrics {
    pub cyclomatic: u32,
    pub cognitive: u32,
    pub lines_of_code: u32,
    pub maintainability_index: f64,
}

#[derive(Debug, Clone)]
#[napi(object)]
pub struct DuplicateResult {
    pub file_a: String,
    pub file_b: String,
    pub start_line_a: u32,
    pub start_line_b: u32,
    pub length: u32,
    pub content: String,
}

// ---------------------------------------------------------------------------
// NAPI exports
// ---------------------------------------------------------------------------

/// Parse a file and extract entities using the real Tree-sitter parser.
#[napi]
pub fn parse_file(file_path: String, content: String) -> Result<Vec<CodeEntity>> {
    let parser = CodeParser::new();
    let path = Path::new(&file_path);

    let parse_result = parser
        .parse_file(path, &content)
        .map_err(|e| Error::from_reason(format!("Parse error: {}", e)))?;

    Ok(parse_result
        .entities
        .into_iter()
        .map(|e| CodeEntity {
            id: e.id.to_string(),
            name: e.name,
            entity_type: format!("{:?}", e.entity_type),
            file_path: e.file_path,
            start_line: e.start_line,
            end_line: e.end_line,
            content: e.content,
        })
        .collect())
}

/// Index an entire codebase using the parallel Rust indexer.
#[napi]
pub fn index_codebase(path: String) -> Result<String> {
    RUNTIME.block_on(async {
        let engine = IndexingEngine::new().with_db_path(db_path());
        let progress = engine
            .index_codebase(Path::new(&path))
            .await
            .map_err(|e| Error::from_reason(format!("Index error: {}", e)))?;

        Ok(format!(
            "Indexed {} files, {} entities in {:?}",
            progress.processed_files,
            progress.total_entities,
            progress.start_time.elapsed()
        ))
    })
}

/// Keyword search against the SQLite-backed code_entities table.
#[napi]
pub fn search_code(query: String, codebase_path: Option<String>) -> Result<Vec<SearchResult>> {
    use code_intelligence_indexer::storage::Storage;

    let db = db_path();
    let codebase_id = codebase_path.unwrap_or_default();

    let results = std::thread::spawn(move || {
        let storage = Storage::new(&db).map_err(|e| Error::from_reason(format!("DB open error: {}", e)))?;
        let rows = storage.search_entities(&query, Some(&codebase_id).filter(|s| !s.is_empty()).map(|s| s.as_str()), 50)
            .map_err(|e| Error::from_reason(format!("Search error: {}", e)))?;
        Ok::<_, Error>(rows)
    })
    .join()
    .map_err(|e| Error::from_reason(format!("Search thread panicked: {:?}", e)))??;

    Ok(results
        .into_iter()
        .map(|r| SearchResult {
            file: r.file_path,
            line: r.start_line as u32,
            content: format!("{} ({})", r.name, r.entity_type),
            score: 1.0,
        })
        .collect())
}

/// Analyze cyclomatic / cognitive complexity for a code snippet.
#[napi]
pub fn analyze_complexity(content: String, file_path: String) -> Result<ComplexityMetrics> {
    let lang = code_intelligence_parser::CodeParser::new()
        .detect_language(Path::new(&file_path))
        .unwrap_or(code_intelligence_parser::Language::TypeScript);

    let result = code_intelligence_analyzer::analyze_complexity(&content, lang)
        .map_err(|e| Error::from_reason(format!("Complexity analysis error: {}", e)))?;

    Ok(ComplexityMetrics {
        cyclomatic: result.cyclomatic,
        cognitive: result.cognitive,
        lines_of_code: result.lines_of_code,
        maintainability_index: result.maintainability_index,
    })
}

/// Find duplicate code blocks across multiple files.
#[napi]
pub fn find_duplicates(
    file_paths: Vec<String>,
    contents: Vec<String>,
    min_lines: u32,
) -> Result<Vec<DuplicateResult>> {
    if file_paths.len() != contents.len() {
        return Err(Error::from_reason(
            "file_paths and contents must have the same length".to_string(),
        ));
    }

    let files: Vec<(&str, &str)> = file_paths
        .iter()
        .zip(contents.iter())
        .map(|(p, c)| (p.as_str(), c.as_str()))
        .collect();

    let dups = code_intelligence_analyzer::find_duplicates(&files, min_lines as usize)
        .map_err(|e| Error::from_reason(format!("Duplicate detection error: {}", e)))?;

    Ok(dups
        .into_iter()
        .map(|d| DuplicateResult {
            file_a: d.file_a,
            file_b: d.file_b,
            start_line_a: d.start_line_a,
            start_line_b: d.start_line_b,
            length: d.length,
            content: d.content,
        })
        .collect())
}

/// Generate a real sentence embedding using ONNX Runtime (all-MiniLM-L6-v2).
/// First call downloads the model (~23MB) to the local cache.
#[napi]
pub fn generate_embedding(text: String) -> Result<Vec<f32>> {
    code_intelligence_embedding::generate_embedding(&text)
        .map_err(|e| Error::from_reason(format!("Embedding error: {}", e)))
}

/// Initialize the Rust engine (no-op for now — indexing engine is stateless).
#[napi]
pub fn init_engine() -> Result<()> {
    tracing::info!("Rust Code Intelligence engine initialized");
    Ok(())
}

/// Get engine statistics (placeholder).
#[napi]
pub fn get_statistics() -> Result<String> {
    Ok(r#"{"total_entities":0,"by_type":{},"by_language":{}}"#.to_string())
}

/// Clear indexed data (placeholder).
#[napi]
pub fn clear() -> Result<()> {
    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_file_simple_function() {
        let result = parse_file(
            "test.ts".to_string(),
            "function hello() { return 'world'; }".to_string(),
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_init_engine() {
        assert!(init_engine().is_ok());
    }

    #[test]
    fn test_generate_embedding() {
        let result = generate_embedding("test".to_string());
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 384);
    }
}
