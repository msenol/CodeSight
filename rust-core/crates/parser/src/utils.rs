//! Utility functions for code parsing

use anyhow::Result;
use std::path::{Path, PathBuf};
use crate::all_supported_extensions;

/// Check if a file should be ignored based on common ignore patterns
pub fn should_ignore_file(file_path: &Path) -> bool {
    let path_str = file_path.to_string_lossy().to_lowercase();

    // Common directories and files to ignore
    let ignore_patterns = vec![
        "node_modules",
        ".git",
        ".idea",
        ".vscode",
        "target",
        "build",
        "dist",
        "out",
        "coverage",
        "vendor",
        "bower_components",
        ".env",
        ".log",
        ".tmp",
        ".temp",
        "package-lock.json",
        "yarn.lock",
        "Cargo.lock",
        ".DS_Store",
        "Thumbs.db",
    ];

    for pattern in ignore_patterns {
        if path_str.contains(pattern) {
            return true;
        }
    }

    false
}

/// Check if a file is supported based on its extension
pub fn is_supported_file(file_path: &Path) -> bool {
    if let Some(extension) = file_path.extension().and_then(|ext| ext.to_str()) {
        all_supported_extensions().contains(&extension.to_lowercase())
    } else {
        false
    }
}

/// Get the relative path from a base directory
pub fn get_relative_path(base: &Path, file_path: &Path) -> Result<PathBuf> {
    file_path.strip_prefix(base)
        .map(|p| p.to_path_buf())
        .map_err(|_| anyhow::anyhow!("Failed to get relative path"))
}

/// Normalize file path separators
pub fn normalize_path(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();

    for component in path.components() {
        match component {
            std::path::Component::ParentDir => {
                // Handle parent directory references
                if let Some(parent) = normalized.parent() {
                    normalized = parent.to_path_buf();
                }
            },
            std::path::Component::CurDir => {
                // Skip current directory references
                continue;
            },
            _ => {
                normalized.push(component);
            }
        }
    }

    normalized
}

/// Calculate file hash for change detection
pub fn calculate_file_hash(content: &str) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Extract file extension with multiple dots support
pub fn extract_file_extension(file_path: &Path) -> Option<String> {
    let file_name = file_path.file_name()?.to_str()?;

    // Handle multi-part extensions like .tsx, .test.js, etc.
    if let Some(dot_idx) = file_name.rfind('.') {
        Some(file_name[dot_idx + 1..].to_lowercase())
    } else {
        None
    }
}

/// Sanitize string for use in identifiers
pub fn sanitize_identifier(name: &str) -> String {
    name.chars()
        .map(|c| {
            match c {
                'a'..='z' | 'A'..='Z' | '0'..='9' | '_' => c,
                '-' => '_',
                ' ' => '_',
                _ => '_',
            }
        })
        .collect()
}

/// Truncate string with ellipsis
pub fn truncate_string(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len.saturating_sub(3)])
    }
}

/// Count lines of code (excluding empty lines and comments)
pub fn count_lines_of_code(content: &str) -> usize {
    content.lines()
        .filter(|line| {
            let trimmed = line.trim();
            !trimmed.is_empty() &&
            !trimmed.starts_with("//") &&
            !trimmed.starts_with("#") &&
            !trimmed.starts_with("/*") &&
            !trimmed.starts_with("*") &&
            !trimmed.starts_with("'''") &&
            !trimmed.starts_with(r#"""""#)
        })
        .count()
}

/// Extract file statistics
pub struct FileStats {
    pub total_lines: usize,
    pub code_lines: usize,
    pub comment_lines: usize,
    pub blank_lines: usize,
    pub complexity: usize,
}

impl FileStats {
    pub fn new(content: &str) -> Self {
        let lines: Vec<&str> = content.lines().collect();
        let total_lines = lines.len();

        let mut code_lines = 0;
        let mut comment_lines = 0;
        let mut blank_lines = 0;
        let mut complexity = 0;

        for line in &lines {
            let trimmed = line.trim();

            if trimmed.is_empty() {
                blank_lines += 1;
            } else if trimmed.starts_with("//") ||
                     trimmed.starts_with("#") ||
                     trimmed.starts_with("/*") ||
                     trimmed.starts_with("*") ||
                     trimmed.starts_with("'''") ||
                     trimmed.starts_with(r#"""""#) {
                comment_lines += 1;
            } else {
                code_lines += 1;

                // Calculate complexity (simplified)
                if trimmed.contains("if") ||
                   trimmed.contains("else if") ||
                   trimmed.contains("for") ||
                   trimmed.contains("while") ||
                   trimmed.contains("switch") ||
                   trimmed.contains("case") ||
                   trimmed.contains("try") ||
                   trimmed.contains("catch") {
                    complexity += 1;
                }
            }
        }

        Self {
            total_lines,
            code_lines,
            comment_lines,
            blank_lines,
            complexity,
        }
    }
}

/// Format file size in human readable format
pub fn format_file_size(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];

    let mut size = bytes as f64;
    let mut unit_index = 0;

    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }

    if unit_index == 0 {
        format!("{} {}", bytes, UNITS[unit_index])
    } else {
        format!("{:.1} {}", size, UNITS[unit_index])
    }
}

/// Get line and column from byte offset
pub fn get_line_column_from_offset(content: &str, offset: usize) -> (usize, usize) {
    let mut line = 1;
    let mut column = 1;

    for (i, c) in content.char_indices() {
        if i == offset {
            break;
        }

        if c == '\n' {
            line += 1;
            column = 1;
        } else {
            column += 1;
        }
    }

    (line, column)
}

/// Extract content between line numbers
pub fn extract_lines(content: &str, start_line: usize, end_line: usize) -> String {
    let lines: Vec<&str> = content.lines().collect();

    if start_line == 0 || end_line == 0 || start_line > end_line {
        return String::new();
    }

    let start = start_line.saturating_sub(1);
    let end = end_line.min(lines.len());

    lines[start..end].join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_should_ignore_file() {
        assert!(should_ignore_file(&PathBuf::from("node_modules/package.json")));
        assert!(should_ignore_file(&PathBuf::from(".git/HEAD")));
        assert!(!should_ignore_file(&PathBuf::from("src/main.ts")));
    }

    #[test]
    fn test_is_supported_file() {
        assert!(is_supported_file(&PathBuf::from("test.ts")));
        assert!(is_supported_file(&PathBuf::from("test.js")));
        assert!(!is_supported_file(&PathBuf::from("test.txt")));
    }

    #[test]
    fn test_calculate_file_hash() {
        let content1 = "function test() {}";
        let content2 = "function test() {}";
        let content3 = "function different() {}";

        assert_eq!(calculate_file_hash(content1), calculate_file_hash(content2));
        assert_ne!(calculate_file_hash(content1), calculate_file_hash(content3));
    }

    #[test]
    fn test_file_stats() {
        let content = r#"
// This is a comment
function test() {
    if (true) {
        return "hello";
    }
}

// Another comment
"#;

        let stats = FileStats::new(content);
        assert_eq!(stats.total_lines, 9);
        assert!(stats.code_lines > 0);
        assert!(stats.comment_lines > 0);
        assert!(stats.blank_lines > 0);
        assert!(stats.complexity > 0);
    }

    #[test]
    fn test_format_file_size() {
        assert_eq!(format_file_size(512), "512 B");
        assert_eq!(format_file_size(1024), "1.0 KB");
        assert_eq!(format_file_size(1048576), "1.0 MB");
    }

    #[test]
    fn test_extract_lines() {
        let content = "line1\nline2\nline3\nline4";
        assert_eq!(extract_lines(content, 2, 3), "line2\nline3");
        assert_eq!(extract_lines(content, 1, 1), "line1");
    }
}