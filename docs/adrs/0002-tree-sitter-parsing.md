# ADR-0002: Tree-sitter for Code Parsing

## Status

Accepted

## Date

2024-01-15

## Context

The Code Intelligence MCP Server needs to parse source code from multiple programming languages to extract:

1. **Syntax Structure**: Functions, classes, variables, imports
2. **Semantic Information**: Scope relationships, type information
3. **Code Entities**: Extractable elements for search and analysis
4. **Error Recovery**: Handle incomplete or malformed code gracefully
5. **Performance**: Parse large codebases efficiently

We need a parsing solution that:
- Supports multiple programming languages
- Provides incremental parsing for real-time updates
- Offers robust error recovery
- Integrates well with Rust
- Has active community support

## Decision

We will use **Tree-sitter** as our primary code parsing technology.

Tree-sitter is an incremental parsing system that builds concrete syntax trees for source code and provides:
- Multi-language support with grammar-based parsers
- Incremental parsing for efficient updates
- Error recovery and fault tolerance
- Native Rust bindings
- Rich ecosystem of language grammars

## Rationale

### Why Tree-sitter?

1. **Multi-language Support**:
   - 40+ officially supported languages
   - Consistent API across all languages
   - Community-maintained grammars for additional languages

2. **Performance**:
   - Incremental parsing: only re-parse changed sections
   - Linear time complexity O(n)
   - Memory efficient with shared tree nodes
   - Parallel parsing capabilities

3. **Robustness**:
   - Excellent error recovery
   - Handles incomplete/malformed code
   - Continues parsing after syntax errors
   - Provides error nodes for debugging

4. **Integration**:
   - Native Rust bindings (`tree-sitter` crate)
   - Zero-copy string operations
   - Direct memory access to syntax trees
   - Efficient serialization support

5. **Ecosystem**:
   - Used by GitHub, Atom, Neovim, and other major tools
   - Active development and community
   - Extensive documentation and examples
   - Language Server Protocol integration

### Supported Languages (Priority Order)

**Tier 1 (Full Support)**:
- TypeScript/JavaScript
- Python
- Rust
- Java
- C/C++

**Tier 2 (Good Support)**:
- Go
- C#
- PHP
- Ruby
- Swift

**Tier 3 (Basic Support)**:
- Kotlin
- Scala
- Dart
- Lua
- Shell scripts

## Implementation Details

### Architecture

```rust
// Core parsing interface
pub struct CodeParser {
    parsers: HashMap<Language, tree_sitter::Parser>,
    queries: HashMap<Language, QuerySet>,
}

pub struct QuerySet {
    functions: tree_sitter::Query,
    classes: tree_sitter::Query,
    imports: tree_sitter::Query,
    variables: tree_sitter::Query,
    comments: tree_sitter::Query,
}

pub struct ParseResult {
    tree: tree_sitter::Tree,
    entities: Vec<CodeEntity>,
    errors: Vec<ParseError>,
    metrics: ParseMetrics,
}
```

### Language Detection

```rust
pub fn detect_language(file_path: &Path, content: &str) -> Language {
    // 1. File extension mapping
    if let Some(lang) = detect_by_extension(file_path) {
        return lang;
    }
    
    // 2. Shebang detection
    if let Some(lang) = detect_by_shebang(content) {
        return lang;
    }
    
    // 3. Content heuristics
    detect_by_content_heuristics(content)
}
```

### Query Patterns

Tree-sitter queries for extracting code entities:

```scheme
;; Function definitions (TypeScript)
(function_declaration
  name: (identifier) @function.name
  parameters: (formal_parameters) @function.params
  body: (statement_block) @function.body)

(method_definition
  name: (property_name) @method.name
  value: (function_expression
    parameters: (formal_parameters) @method.params
    body: (statement_block) @method.body))

;; Class definitions
(class_declaration
  name: (type_identifier) @class.name
  body: (class_body) @class.body)

;; Import statements
(import_statement
  source: (string) @import.source
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @import.name))))
```

### Incremental Parsing

```rust
pub struct IncrementalParser {
    tree: Option<tree_sitter::Tree>,
    parser: tree_sitter::Parser,
    old_content: String,
}

impl IncrementalParser {
    pub fn update(&mut self, new_content: &str, edits: &[InputEdit]) -> ParseResult {
        if let Some(ref mut tree) = self.tree {
            // Apply edits to existing tree
            for edit in edits {
                tree.edit(edit);
            }
            
            // Incremental parse
            let new_tree = self.parser.parse(new_content, Some(tree))?;
            self.tree = Some(new_tree);
        } else {
            // Full parse for first time
            self.tree = Some(self.parser.parse(new_content, None)?);
        }
        
        self.extract_entities()
    }
}
```

### Error Handling

```rust
pub enum ParseError {
    SyntaxError {
        line: usize,
        column: usize,
        message: String,
        severity: ErrorSeverity,
    },
    UnsupportedLanguage(String),
    ParserInitializationFailed(String),
    QueryExecutionFailed(String),
}

pub enum ErrorSeverity {
    Error,    // Prevents further analysis
    Warning,  // Analysis can continue
    Info,     // Informational only
}
```

## Performance Characteristics

### Benchmarks

**Parsing Speed** (typical files):
- Small files (<1KB): <1ms
- Medium files (1-10KB): 1-5ms
- Large files (10-100KB): 5-50ms
- Very large files (>100KB): 50-500ms

**Memory Usage**:
- Base parser: ~10MB per language
- Syntax tree: ~2-5x source file size
- Query results: ~10-20% of tree size

**Incremental Parsing Benefits**:
- 10-100x faster for small changes
- Memory reuse for unchanged subtrees
- Enables real-time code analysis

### Optimization Strategies

1. **Parser Pooling**: Reuse parser instances across files
2. **Lazy Loading**: Load language parsers on demand
3. **Query Caching**: Cache compiled queries per language
4. **Parallel Processing**: Parse multiple files concurrently
5. **Memory Management**: Explicit tree disposal for large files

## Alternatives Considered

### 1. Language-Specific Parsers

**Examples**: TypeScript Compiler API, Python AST, Rust syn

**Pros**:
- Native language support
- Complete semantic information
- Official maintenance

**Cons**:
- Different APIs for each language
- Complex integration
- Inconsistent error handling
- Performance varies widely

**Decision**: Rejected due to complexity of maintaining multiple parsers

### 2. ANTLR

**Pros**:
- Mature parsing framework
- Grammar-based approach
- Good tooling support

**Cons**:
- Java-based (JVM dependency)
- Less efficient than Tree-sitter
- Limited incremental parsing
- Complex Rust integration

**Decision**: Rejected due to performance and integration concerns

### 3. Language Server Protocol (LSP)

**Pros**:
- Rich semantic information
- Official language support
- Real-time analysis

**Cons**:
- Requires running language servers
- Complex process management
- High resource usage
- Inconsistent capabilities

**Decision**: Rejected for core parsing, may use for enhanced analysis

### 4. Regular Expressions

**Pros**:
- Simple implementation
- Fast for basic patterns
- No external dependencies

**Cons**:
- Cannot handle nested structures
- Fragile and error-prone
- No semantic understanding
- Poor error recovery

**Decision**: Rejected due to fundamental limitations

## Implementation Plan

### Phase 1: Core Parser (Week 1-2)
1. Basic Tree-sitter integration
2. Language detection
3. Simple entity extraction
4. Error handling framework

### Phase 2: Multi-language Support (Week 3-4)
1. TypeScript/JavaScript parser
2. Python parser
3. Rust parser
4. Query pattern development

### Phase 3: Advanced Features (Week 5-6)
1. Incremental parsing
2. Performance optimization
3. Parallel processing
4. Memory management

### Phase 4: Extended Languages (Week 7-8)
1. Java, C/C++, Go parsers
2. Custom query patterns
3. Language-specific optimizations
4. Comprehensive testing

## Success Metrics

1. **Language Coverage**: Support for top 10 programming languages
2. **Parsing Speed**: <100ms for 95% of files under 50KB
3. **Memory Efficiency**: <5x source file size for syntax trees
4. **Error Recovery**: Successfully parse 99% of real-world files
5. **Incremental Performance**: 10x speedup for small changes

## Risks and Mitigation

### Risk 1: Grammar Quality
**Risk**: Some language grammars may be incomplete or buggy
**Mitigation**: 
- Test with real-world codebases
- Contribute fixes upstream
- Maintain custom grammar forks if needed

### Risk 2: Performance Bottlenecks
**Risk**: Large files may cause memory or performance issues
**Mitigation**:
- Implement file size limits
- Use streaming parsing for very large files
- Provide configuration options

### Risk 3: Language Evolution
**Risk**: New language features may not be supported immediately
**Mitigation**:
- Monitor language grammar updates
- Implement fallback parsing strategies
- Graceful degradation for unsupported syntax

## Monitoring and Metrics

```rust
pub struct ParseMetrics {
    pub parse_time: Duration,
    pub tree_size: usize,
    pub entity_count: usize,
    pub error_count: usize,
    pub memory_usage: usize,
    pub incremental: bool,
}

// Metrics collection
pub fn collect_parse_metrics(result: &ParseResult) -> ParseMetrics {
    ParseMetrics {
        parse_time: result.duration,
        tree_size: result.tree.root_node().byte_range().len(),
        entity_count: result.entities.len(),
        error_count: result.errors.len(),
        memory_usage: estimate_memory_usage(&result.tree),
        incremental: result.was_incremental,
    }
}
```

## Future Considerations

1. **Language Server Integration**: Enhance with LSP for semantic analysis
2. **Custom Grammars**: Develop grammars for domain-specific languages
3. **Streaming Parsing**: Support for very large files
4. **Distributed Parsing**: Parse across multiple machines
5. **Machine Learning**: Use ML to improve parsing accuracy

## Related ADRs

- [ADR-0001: Hybrid Rust/TypeScript Architecture](0001-hybrid-architecture.md)
- **Additional ADRs**: Tantivy Search and Incremental Indexing strategies are documented within the hybrid architecture ADR.

## References

- [Tree-sitter Documentation](https://tree-sitter.github.io/tree-sitter/)
- [Tree-sitter Rust Bindings](https://docs.rs/tree-sitter/)
- [Language Grammar Repository](https://github.com/tree-sitter)
- [Query Syntax Reference](https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax)
- [Performance Benchmarks](https://github.com/tree-sitter/tree-sitter/blob/master/docs/section-4-performance.md)