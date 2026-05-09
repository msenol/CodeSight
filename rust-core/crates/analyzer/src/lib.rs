//! Code analysis engine — complexity metrics and duplicate detection.
//!
//! Uses AST traversal (via tree-sitter) for accurate metrics rather than regex.

use anyhow::Result;
use code_intelligence_parser::CodeParser;
use std::path::Path;

pub mod complexity;
pub mod duplication;

pub use complexity::{analyze_complexity, ComplexityResult};
pub use duplication::{find_duplicates, DuplicateBlock};

/// Analyze a single file for complexity metrics.
pub fn analyze_file_complexity(file_path: &Path, content: &str) -> Result<ComplexityResult> {
    let parser = CodeParser::new();
    let lang = parser.detect_language(file_path)?;
    analyze_complexity(content, lang)
}

/// Find duplicates across a list of (file_path, content) pairs.
pub fn find_duplicates_in_files(
    files: &[(String, String)],
    min_lines: usize,
) -> Result<Vec<DuplicateBlock>> {
    let mut contents = Vec::with_capacity(files.len());
    for (path, content) in files {
        contents.push((path.as_str(), content.as_str()));
    }
    find_duplicates(&contents, min_lines)
}
