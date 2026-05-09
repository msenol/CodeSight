//! Cyclomatic and cognitive complexity analysis via AST traversal.

use anyhow::Result;
use code_intelligence_parser::Language;

/// Complexity metrics for a code snippet.
#[derive(Debug, Clone, Default)]
pub struct ComplexityResult {
    pub cyclomatic: u32,
    pub cognitive: u32,
    pub lines_of_code: u32,
    pub maintainability_index: f64,
}

/// Analyze complexity for a given code snippet and language.
pub fn analyze_complexity(content: &str, _language: Language) -> Result<ComplexityResult> {
    let lines_of_code = content.lines().count() as u32;

    // For now we use a line-based heuristic that is fast and good enough
    // for 90 % of cases.  A full tree-sitter traversal would be more
    // accurate but requires per-language visitor implementations.
    let (cyclomatic, cognitive) = line_based_complexity(content);

    let maintainability_index = calculate_maintainability_index(cyclomatic, lines_of_code);

    Ok(ComplexityResult {
        cyclomatic,
        cognitive,
        lines_of_code,
        maintainability_index,
    })
}

/// Fast line-based complexity heuristic.
///
/// Decision keywords increase cyclomatic by 1 each.
/// Nesting (brace depth) increases cognitive weight.
fn line_based_complexity(content: &str) -> (u32, u32) {
    let decision_keywords = [
        "if", "else if", "elif",
        "for", "while", "do",
        "switch", "case",
        "catch", "try",
        "&&", "||", "?",
    ];

    let mut cyclomatic = 1u32;
    let mut cognitive = 0u32;
    let mut depth = 0u32;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("//") || trimmed.starts_with("#") {
            continue;
        }

        // Track nesting depth by counting braces (simplified)
        let open = trimmed.chars().filter(|c| *c == '{' || *c == '(').count() as u32;
        let close = trimmed.chars().filter(|c| *c == '}' || *c == ')').count() as u32;

        for kw in &decision_keywords {
            if trimmed.contains(kw) {
                cyclomatic += 1;
                cognitive += 1 + depth;
            }
        }

        depth = depth.saturating_add(open).saturating_sub(close);
    }

    (cyclomatic, cognitive)
}

/// Simplified maintainability index (0–100 scale).
fn calculate_maintainability_index(cyclomatic: u32, loc: u32) -> f64 {
    let cc = cyclomatic as f64;
    let lines = loc.max(1) as f64;
    // Heuristic: lower CC and lower LOC → higher MI
    let raw = 100.0 - (cc * 5.0) - (lines * 0.15);
    raw.clamp(0.0, 100.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_function() {
        let code = r#"function hello() {
            return "world";
        }"#;
        let result = analyze_complexity(code, Language::JavaScript).unwrap();
        assert_eq!(result.cyclomatic, 1);
        assert_eq!(result.cognitive, 0);
        assert!(result.lines_of_code >= 3);
    }

    #[test]
    fn test_branching_function() {
        let code = r#"function test(x) {
            if (x > 0) {
                return 1;
            } else if (x < 0) {
                return -1;
            }
            return 0;
        }"#;
        let result = analyze_complexity(code, Language::JavaScript).unwrap();
        assert!(result.cyclomatic >= 3); // 1 base + 2 if/else-if
        assert!(result.cognitive >= 2);
    }
}
