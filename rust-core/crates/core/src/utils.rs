//! Utility functions for the Code Intelligence MCP Server

use std::path::Path;
use uuid::Uuid;

/// Generate a short UUID (8 characters)
pub fn short_uuid() -> String {
    Uuid::new_v4().to_string()[..8].to_string()
}

/// Normalize a file path to use forward slashes
pub fn normalize_path(path: &str) -> String {
    path.replace('\\', "/")
}

/// Get file extension from path
pub fn get_file_extension(path: &str) -> Option<String> {
    Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
}

/// Check if a file should be indexed based on its extension
pub fn is_indexable_file(path: &str) -> bool {
    const INDEXABLE_EXTENSIONS: &[&str] = &[
        "rs", "ts", "tsx", "js", "jsx", "py", "go", "java", "cpp", "cc", "cxx", "hpp", "h",
        "cs", "php", "rb", "swift", "kt", "kts", "scala", "sc", "dart", "ex", "exs",
        "c", "m", "mm", "pl", "pm", "r", "R", "sh", "bash", "zsh", "fish",
        "sql", "graphql", "gql", "proto", "thrift", "avro", "json", "yaml", "yml",
        "toml", "xml", "html", "htm", "css", "scss", "sass", "less", "vue", "svelte",
        "md", "mdx", "rst", "txt", "tex", "org", "adoc", "asciidoc",
    ];

    get_file_extension(path)
        .map(|ext| INDEXABLE_EXTENSIONS.contains(&ext.as_str()))
        .unwrap_or(false)
}

/// Sanitize a string for safe display
pub fn sanitize_string(input: &str) -> String {
    input
        .chars()
        .filter(|c| c.is_ascii_graphic() || c.is_ascii_whitespace())
        .collect()
}

/// Calculate similarity between two strings using Levenshtein distance
pub fn string_similarity(a: &str, b: &str) -> f32 {
    if a == b {
        return 1.0;
    }
    
    if a.is_empty() || b.is_empty() {
        return 0.0;
    }
    
    let len_a = a.len();
    let len_b = b.len();
    let max_len = len_a.max(len_b);
    
    let distance = levenshtein_distance(a, b);
    1.0 - (distance as f32 / max_len as f32)
}

/// Calculate Levenshtein distance between two strings
fn levenshtein_distance(a: &str, b: &str) -> usize {
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let len_a = a_chars.len();
    let len_b = b_chars.len();
    
    if len_a == 0 {
        return len_b;
    }
    if len_b == 0 {
        return len_a;
    }
    
    let mut matrix = vec![vec![0; len_b + 1]; len_a + 1];
    
    // Initialize first row and column
    for i in 0..=len_a {
        matrix[i][0] = i;
    }
    for j in 0..=len_b {
        matrix[0][j] = j;
    }
    
    // Fill the matrix
    for i in 1..=len_a {
        for j in 1..=len_b {
            let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
            matrix[i][j] = (matrix[i - 1][j] + 1)
                .min(matrix[i][j - 1] + 1)
                .min(matrix[i - 1][j - 1] + cost);
        }
    }
    
    matrix[len_a][len_b]
}

/// Format bytes as human-readable string
pub fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB", "PB"];
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

/// Format duration as human-readable string
pub fn format_duration(duration: std::time::Duration) -> String {
    let total_seconds = duration.as_secs();
    
    if total_seconds < 60 {
        format!("{:.1}s", duration.as_secs_f64())
    } else if total_seconds < 3600 {
        let minutes = total_seconds / 60;
        let seconds = total_seconds % 60;
        format!("{}m {}s", minutes, seconds)
    } else {
        let hours = total_seconds / 3600;
        let minutes = (total_seconds % 3600) / 60;
        format!("{}h {}m", hours, minutes)
    }
}

/// Extract language from file extension
pub fn language_from_extension(extension: &str) -> Option<&'static str> {
    match extension.to_lowercase().as_str() {
        "rs" => Some("rust"),
        "ts" | "tsx" => Some("typescript"),
        "js" | "jsx" | "mjs" => Some("javascript"),
        "py" | "pyi" => Some("python"),
        "go" => Some("go"),
        "java" => Some("java"),
        "cpp" | "cc" | "cxx" | "hpp" | "h" => Some("cpp"),
        "cs" => Some("csharp"),
        "php" => Some("php"),
        "rb" => Some("ruby"),
        "swift" => Some("swift"),
        "kt" | "kts" => Some("kotlin"),
        "scala" | "sc" => Some("scala"),
        "dart" => Some("dart"),
        "ex" | "exs" => Some("elixir"),
        "c" => Some("c"),
        "m" | "mm" => Some("objective-c"),
        "pl" | "pm" => Some("perl"),
        "r" => Some("r"),
        "sh" | "bash" | "zsh" | "fish" => Some("shell"),
        "sql" => Some("sql"),
        "graphql" | "gql" => Some("graphql"),
        "proto" => Some("protobuf"),
        "json" => Some("json"),
        "yaml" | "yml" => Some("yaml"),
        "toml" => Some("toml"),
        "xml" => Some("xml"),
        "html" | "htm" => Some("html"),
        "css" => Some("css"),
        "scss" | "sass" => Some("scss"),
        "less" => Some("less"),
        "vue" => Some("vue"),
        "svelte" => Some("svelte"),
        "md" | "mdx" => Some("markdown"),
        "tex" => Some("latex"),
        _ => None,
    }
}

/// Check if a path matches any of the given patterns
pub fn matches_patterns(path: &str, patterns: &[String]) -> bool {
    patterns.iter().any(|pattern| matches_pattern(path, pattern))
}

/// Check if a path matches a glob pattern
pub fn matches_pattern(path: &str, pattern: &str) -> bool {
    // Simple glob matching - in practice, you'd use a proper glob library
    if pattern.contains('*') {
        if pattern.starts_with('*') && pattern.ends_with('*') {
            let middle = &pattern[1..pattern.len() - 1];
            path.contains(middle)
        } else if pattern.starts_with('*') {
            let suffix = &pattern[1..];
            path.ends_with(suffix)
        } else if pattern.ends_with('*') {
            let prefix = &pattern[..pattern.len() - 1];
            path.starts_with(prefix)
        } else {
            // More complex pattern - simplified implementation
            path.contains(&pattern.replace('*', ""))
        }
    } else {
        path == pattern || path.ends_with(&format!("/{}", pattern))
    }
}

/// Generate a hash for content
pub fn hash_content(content: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Truncate string to specified length with ellipsis
pub fn truncate_string(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else if max_len <= 3 {
        "...".to_string()
    } else {
        format!("{}...", &s[..max_len - 3])
    }
}

/// Extract words from text for indexing
pub fn extract_words(text: &str) -> Vec<String> {
    text.split_whitespace()
        .flat_map(|word| {
            // Split on common delimiters
            word.split(&['(', ')', '[', ']', '{', '}', '<', '>', ',', ';', ':', '.', '!', '?'])
        })
        .filter(|word| !word.is_empty() && word.len() > 1)
        .map(|word| word.to_lowercase())
        .collect()
}

/// Calculate confidence score based on multiple factors
pub fn calculate_confidence(factors: &[(f32, f32)]) -> f32 {
    if factors.is_empty() {
        return 0.0;
    }
    
    let weighted_sum: f32 = factors.iter().map(|(score, weight)| score * weight).sum();
    let total_weight: f32 = factors.iter().map(|(_, weight)| weight).sum();
    
    if total_weight > 0.0 {
        (weighted_sum / total_weight).clamp(0.0, 1.0)
    } else {
        0.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_short_uuid() {
        let uuid = short_uuid();
        assert_eq!(uuid.len(), 8);
    }

    #[test]
    fn test_normalize_path() {
        assert_eq!(normalize_path("path\\to\\file"), "path/to/file");
        assert_eq!(normalize_path("path/to/file"), "path/to/file");
    }

    #[test]
    fn test_get_file_extension() {
        assert_eq!(get_file_extension("file.rs"), Some("rs".to_string()));
        assert_eq!(get_file_extension("file.TXT"), Some("txt".to_string()));
        assert_eq!(get_file_extension("file"), None);
    }

    #[test]
    fn test_is_indexable_file() {
        assert!(is_indexable_file("main.rs"));
        assert!(is_indexable_file("app.ts"));
        assert!(is_indexable_file("script.py"));
        assert!(!is_indexable_file("image.png"));
        assert!(!is_indexable_file("binary"));
    }

    #[test]
    fn test_string_similarity() {
        assert_eq!(string_similarity("hello", "hello"), 1.0);
        assert_eq!(string_similarity("", ""), 1.0);
        assert_eq!(string_similarity("hello", ""), 0.0);
        assert!(string_similarity("hello", "hallo") > 0.5);
        assert!(string_similarity("hello", "world") < 0.5);
    }

    #[test]
    fn test_format_bytes() {
        assert_eq!(format_bytes(512), "512 B");
        assert_eq!(format_bytes(1024), "1.0 KB");
        assert_eq!(format_bytes(1536), "1.5 KB");
        assert_eq!(format_bytes(1024 * 1024), "1.0 MB");
    }

    #[test]
    fn test_language_from_extension() {
        assert_eq!(language_from_extension("rs"), Some("rust"));
        assert_eq!(language_from_extension("ts"), Some("typescript"));
        assert_eq!(language_from_extension("py"), Some("python"));
        assert_eq!(language_from_extension("unknown"), None);
    }

    #[test]
    fn test_matches_pattern() {
        assert!(matches_pattern("file.txt", "*.txt"));
        assert!(matches_pattern("path/file.txt", "*.txt"));
        assert!(matches_pattern("node_modules/package", "node_modules*"));
        assert!(matches_pattern("test.log", "test.log"));
        assert!(!matches_pattern("file.rs", "*.txt"));
    }

    #[test]
    fn test_truncate_string() {
        assert_eq!(truncate_string("hello", 10), "hello");
        assert_eq!(truncate_string("hello world", 8), "hello...");
        assert_eq!(truncate_string("hi", 2), "hi");
        assert_eq!(truncate_string("hello", 3), "...");
    }

    #[test]
    fn test_extract_words() {
        let words = extract_words("Hello, world! This is a test.");
        assert!(words.contains(&"hello".to_string()));
        assert!(words.contains(&"world".to_string()));
        assert!(words.contains(&"test".to_string()));
        assert!(!words.contains(&"a".to_string())); // Single letter filtered out
    }

    #[test]
    fn test_calculate_confidence() {
        let factors = vec![(0.8, 1.0), (0.6, 0.5), (0.9, 2.0)];
        let confidence = calculate_confidence(&factors);
        assert!(confidence > 0.7 && confidence < 0.9);
        
        assert_eq!(calculate_confidence(&[]), 0.0);
        assert_eq!(calculate_confidence(&[(1.0, 1.0)]), 1.0);
    }
}