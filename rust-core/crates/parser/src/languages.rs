//! Language-specific configuration and utilities

use crate::Language;
use std::collections::HashSet;

/// Language configuration
pub struct LanguageConfig {
    pub name: &'static str,
    pub extensions: &'static [&'static str],
    pub keywords: &'static [&'static str],
    pub comment_patterns: &'static [&'static str],
    pub string_delimiters: &'static [&'static str],
    pub function_patterns: &'static [&'static str],
    pub class_patterns: &'static [&'static str],
}

impl Language {
    /// Get configuration for this language
    pub fn config(&self) -> &'static LanguageConfig {
        match self {
            Language::TypeScript => &TYPESCRIPT_CONFIG,
            Language::JavaScript => &JAVASCRIPT_CONFIG,
            Language::Python => &PYTHON_CONFIG,
            Language::Rust => &RUST_CONFIG,
            Language::Go => &GO_CONFIG,
            Language::Java => &JAVA_CONFIG,
            Language::Cpp => &CPP_CONFIG,
            Language::CSharp => &CSHARP_CONFIG,
        }
    }

    /// Get file extensions for this language
    pub fn extensions(&self) -> &'static [&'static str] {
        self.config().extensions
    }

    /// Get keywords for this language
    pub fn keywords(&self) -> &'static [&'static str] {
        self.config().keywords
    }

    /// Check if a file extension belongs to this language
    pub fn supports_extension(&self, extension: &str) -> bool {
        self.config().extensions.contains(&extension)
    }
}

/// TypeScript configuration
const TYPESCRIPT_CONFIG: LanguageConfig = LanguageConfig {
    name: "TypeScript",
    extensions: &["ts", "tsx"],
    keywords: &[
        "function", "class", "interface", "type", "enum", "const", "let", "var",
        "if", "else", "for", "while", "do", "switch", "case", "default", "break", "continue",
        "return", "yield", "await", "async", "import", "export", "from", "as", "default",
        "extends", "implements", "super", "this", "new", "delete", "typeof", "instanceof",
        "in", "void", "null", "undefined", "true", "false", "try", "catch", "finally",
        "throw", "public", "private", "protected", "static", "readonly", "abstract",
    ],
    comment_patterns: &["//", "/*", "*/"],
    string_delimiters: &["\"", "'", "`"],
    function_patterns: &[
        r"function\s+(\w+)",
        r"async\s+function\s+(\w+)",
        r"const\s+(\w+)\s*=\s*\(",
        r"const\s+(\w+)\s*=\s*async",
        r"(\w+)\s*:\s*function",
    ],
    class_patterns: &[
        r"class\s+(\w+)",
        r"export\s+class\s+(\w+)",
        r"export\s+default\s+class\s+(\w+)",
        r"interface\s+(\w+)",
    ],
};

/// JavaScript configuration
const JAVASCRIPT_CONFIG: LanguageConfig = LanguageConfig {
    name: "JavaScript",
    extensions: &["js", "jsx", "mjs", "cjs"],
    keywords: &[
        "function", "class", "const", "let", "var", "if", "else", "for", "while", "do",
        "switch", "case", "default", "break", "continue", "return", "yield", "await", "async",
        "import", "export", "from", "as", "default", "extends", "super", "this", "new", "delete",
        "typeof", "instanceof", "in", "void", "null", "undefined", "true", "false", "try",
        "catch", "finally", "throw", "with",
    ],
    comment_patterns: &["//", "/*", "*/"],
    string_delimiters: &["\"", "'", "`"],
    function_patterns: &[
        r"function\s+(\w+)",
        r"async\s+function\s+(\w+)",
        r"const\s+(\w+)\s*=\s*\(",
        r"const\s+(\w+)\s*=\s*async",
        r"(\w+)\s*:\s*function",
    ],
    class_patterns: &[
        r"class\s+(\w+)",
        r"export\s+class\s+(\w+)",
        r"export\s+default\s+class\s+(\w+)",
    ],
};

/// Python configuration
const PYTHON_CONFIG: LanguageConfig = LanguageConfig {
    name: "Python",
    extensions: &["py", "pyw"],
    keywords: &[
        "def", "class", "if", "elif", "else", "for", "while", "try", "except", "finally",
        "with", "as", "import", "from", "return", "yield", "pass", "break", "continue",
        "and", "or", "not", "in", "is", "lambda", "global", "nonlocal", "del", "assert",
        "async", "await", "raise", "True", "False", "None",
    ],
    comment_patterns: &["#"],
    string_delimiters: &["\"", "'", "'''", "\"\"\""],
    function_patterns: &[
        r"def\s+(\w+)",
        r"async\s+def\s+(\w+)",
    ],
    class_patterns: &[
        r"class\s+(\w+)",
    ],
};

/// Rust configuration
const RUST_CONFIG: LanguageConfig = LanguageConfig {
    name: "Rust",
    extensions: &["rs"],
    keywords: &[
        "fn", "struct", "enum", "impl", "trait", "mod", "use", "pub", "const", "static",
        "let", "mut", "if", "else", "match", "for", "while", "loop", "break", "continue",
        "return", "where", "type", "self", "Self", "super", "crate", "extern", "unsafe",
        "async", "await", "move", "ref", "dyn", "abstract", "become", "box", "do", "final",
        "macro", "override", "priv", "typeof", "unsized", "virtual", "yield",
    ],
    comment_patterns: &["//", "/*", "*/", "///", "//!"],
    string_delimiters: &["\"", "b\"", "r\"", "br\""],
    function_patterns: &[
        r"fn\s+(\w+)",
        r"async\s+fn\s+(\w+)",
        r"pub\s+fn\s+(\w+)",
        r"pub\s+async\s+fn\s+(\w+)",
    ],
    class_patterns: &[
        r"struct\s+(\w+)",
        r"pub\s+struct\s+(\w+)",
        r"enum\s+(\w+)",
        r"pub\s+enum\s+(\w+)",
        r"trait\s+(\w+)",
        r"pub\s+trait\s+(\w+)",
    ],
};

/// Go configuration
const GO_CONFIG: LanguageConfig = LanguageConfig {
    name: "Go",
    extensions: &["go"],
    keywords: &[
        "func", "type", "struct", "interface", "var", "const", "import", "package",
        "if", "else", "for", "range", "switch", "case", "default", "break", "continue",
        "return", "go", "defer", "select", "chan", "map", "slice", "fallthrough",
    ],
    comment_patterns: &["//", "/*", "*/"],
    string_delimiters: &["\"", "`"],
    function_patterns: &[
        r"func\s+(\w+)",
        r"func\s+\([^)]*\)\s+(\w+)",
        r"func\s+\([^)]*\)\s+\([^)]*\)\s+(\w+)",
    ],
    class_patterns: &[
        r"type\s+(\w+)\s+struct",
        r"type\s+(\w+)\s+interface",
    ],
};

/// Java configuration
const JAVA_CONFIG: LanguageConfig = LanguageConfig {
    name: "Java",
    extensions: &["java"],
    keywords: &[
        "class", "interface", "enum", "public", "private", "protected", "static", "final",
        "abstract", "synchronized", "volatile", "transient", "native", "strictfp",
        "if", "else", "for", "while", "do", "switch", "case", "default", "break", "continue",
        "return", "try", "catch", "finally", "throw", "throws", "assert", "import", "package",
        "void", "boolean", "byte", "char", "short", "int", "long", "float", "double",
        "true", "false", "null", "this", "super", "new", "instanceof",
    ],
    comment_patterns: &["//", "/*", "*/", "/**", "*/"],
    string_delimiters: &["\""],
    function_patterns: &[
        r"(?:public|private|protected|static|final|synchronized|native|abstract)?\s*\w+\s+(\w+)\s*\(",
    ],
    class_patterns: &[
        r"(?:public|private|protected|static|final|abstract)?\s*class\s+(\w+)",
        r"(?:public|private|protected|static|final|abstract)?\s*interface\s+(\w+)",
        r"(?:public|private|protected|static|final|abstract)?\s*enum\s+(\w+)",
    ],
};

/// C++ configuration
const CPP_CONFIG: LanguageConfig = LanguageConfig {
    name: "C++",
    extensions: &["cpp", "cc", "cxx", "c++", "hpp", "h", "hxx"],
    keywords: &[
        "class", "struct", "union", "enum", "public", "private", "protected", "virtual",
        "static", "const", "extern", "inline", "explicit", "friend", "template", "typename",
        "if", "else", "for", "while", "do", "switch", "case", "default", "break", "continue",
        "return", "goto", "try", "catch", "throw", "new", "delete", "this", "sizeof", "typeid",
        "using", "namespace", "auto", "register", "volatile", "mutable", "constexpr", "decltype",
        "noexcept", "override", "final", "consteval", "constinit", "concept", "requires",
    ],
    comment_patterns: &["//", "/*", "*/"],
    string_delimiters: &["\""],
    function_patterns: &[
        r"(?:\w+\s+)*\w+\s+(\w+)\s*\(",
        r"(?:\w+\s+)*\w+\s+(\w+)\s*\([^)]*\)\s*(?:const|override|final)?\s*;?\s*\{",
    ],
    class_patterns: &[
        r"class\s+(\w+)",
        r"struct\s+(\w+)",
        r"union\s+(\w+)",
        r"enum\s+(\w+)",
        r"template\s*<[^>]*>\s*class\s+(\w+)",
    ],
};

/// C# configuration
const CSHARP_CONFIG: LanguageConfig = LanguageConfig {
    name: "C#",
    extensions: &["cs"],
    keywords: &[
        "class", "struct", "interface", "enum", "public", "private", "protected", "internal",
        "static", "readonly", "const", "sealed", "abstract", "virtual", "override", "extern",
        "unsafe", "async", "await", "partial", "ref", "out", "in", "params", "this", "base",
        "if", "else", "for", "foreach", "while", "do", "switch", "case", "default", "break",
        "continue", "return", "goto", "try", "catch", "finally", "throw", "using", "namespace",
        "new", "typeof", "sizeof", "checked", "unchecked", "lock", "yield", "fixed", "stackalloc",
        "void", "bool", "byte", "sbyte", "char", "short", "ushort", "int", "uint", "long", "ulong",
        "float", "double", "decimal", "object", "string", "dynamic", "var", "true", "false", "null",
    ],
    comment_patterns: &["//", "/*", "*/", "///", "/// <summary>", "/// </summary>"],
    string_delimiters: &["\"", "$\"", "@\""],
    function_patterns: &[
        r"(?:public|private|protected|internal|static|readonly|const|sealed|abstract|virtual|override|extern|unsafe|async)?\s*\w+\s+(\w+)\s*\(",
    ],
    class_patterns: &[
        r"(?:public|private|protected|internal|static|readonly|const|sealed|abstract|virtual|override|extern|unsafe)?\s*class\s+(\w+)",
        r"(?:public|private|protected|internal|static|readonly|const|sealed|abstract|virtual|override|extern|unsafe)?\s*struct\s+(\w+)",
        r"(?:public|private|protected|internal|static|readonly|const|sealed|abstract|virtual|override|extern|unsafe)?\s*interface\s+(\w+)",
        r"(?:public|private|protected|internal|static|readonly|const|sealed|abstract|virtual|override|extern|unsafe)?\s*enum\s+(\w+)",
    ],
};

/// Get all supported file extensions
pub fn all_supported_extensions() -> HashSet<String> {
    let mut extensions = HashSet::new();

    for language in [
        Language::TypeScript,
        Language::JavaScript,
        Language::Python,
        Language::Rust,
        Language::Go,
        Language::Java,
        Language::Cpp,
        Language::CSharp,
    ] {
        for &ext in language.extensions() {
            extensions.insert(ext.to_string());
        }
    }

    extensions
}

/// Detect language from file extension
pub fn detect_language_from_extension(extension: &str) -> Option<Language> {
    match extension {
        "ts" | "tsx" => Some(Language::TypeScript),
        "js" | "jsx" | "mjs" | "cjs" => Some(Language::JavaScript),
        "py" | "pyw" => Some(Language::Python),
        "rs" => Some(Language::Rust),
        "go" => Some(Language::Go),
        "java" => Some(Language::Java),
        "cpp" | "cc" | "cxx" | "c++" | "hpp" | "h" | "hxx" => Some(Language::Cpp),
        "cs" => Some(Language::CSharp),
        _ => None,
    }
}