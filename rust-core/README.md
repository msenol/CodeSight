# Rust Core Engine

High-performance code parsing, indexing, and search engine for the CodeSight MCP Server.

## Overview

The Rust core provides the computational backbone for code intelligence operations, handling all CPU-intensive tasks including parsing, indexing, searching, and analysis. It's designed for maximum performance and scalability.

## Architecture

```
┌────────────────┐
│  TypeScript    │
│  MCP Server    │
└────────┬───────┘
         │ FFI (Napi-rs)
┌────────▼───────┐
│   Rust Core    │
├────────────────┤
│ • Parser       │ ← Tree-sitter
│ • Indexer      │ ← Parallel processing
│ • Search       │ ← Tantivy
│ • Storage      │ ← SQLite/PostgreSQL
│ • Cache        │ ← LRU/DashMap
└────────────────┘
```

## Features

- **Multi-Language Parsing**: 15+ languages via Tree-sitter
- **Parallel Indexing**: Rayon-based parallel processing
- **Full-Text Search**: Tantivy search engine integration
- **Incremental Updates**: Smart differential indexing
- **Memory Efficient**: Streaming and chunked processing
- **Database Agnostic**: SQLite for development, PostgreSQL for production

## Workspace Structure

```
rust-core/
├── Cargo.toml             # Workspace configuration
├── crates/
│   ├── core/             # Core models and traits
│   ├── parser/           # Tree-sitter language parsing
│   ├── indexer/          # Code indexing engine
│   ├── search/           # Search implementation
│   ├── embedding/        # Vector embeddings (future)
│   ├── storage/          # Database abstractions
│   ├── cache/            # Caching layer
│   └── ffi/              # Foreign function interface
└── benches/              # Performance benchmarks
```

## Installation

### Prerequisites

- Rust 1.75 or higher
- Cargo and rustup installed
- C++ compiler for Tree-sitter

### Build

```bash
cd rust-core

# Development build
cargo build

# Release build (optimized)
cargo build --release

# Run tests
cargo test

# Run benchmarks
cargo bench
```

## Crate Descriptions

### core
Central definitions for models, traits, and shared types used across all crates.

```rust
// Key structures
CodeEntity      // Functions, classes, variables
Codebase       // Project metadata
SearchResult   // Query results
```

### parser
Tree-sitter based parsing for multiple programming languages.

```rust
// Supported languages
- TypeScript/JavaScript
- Python
- Rust
- Go
- Java
- C/C++
- And more...
```

### indexer
High-performance parallel indexing of codebases.

```rust
// Features
- Incremental updates
- Parallel file processing
- Symbol extraction
- Dependency tracking
```

### search
Tantivy-based full-text search with code-aware features.

```rust
// Capabilities
- Natural language queries
- Fuzzy matching
- Semantic search (planned)
- Faceted search
```

### storage
Database abstraction layer supporting multiple backends.

```rust
// Backends
- SQLite (development)
- PostgreSQL (production)
- In-memory (testing)
```

### cache
Multi-level caching for improved performance.

```rust
// Cache types
- LRU cache for queries
- DashMap for concurrent access
- Redis integration (production)
```

### ffi
Foreign Function Interface for TypeScript integration.

```rust
// Exposed functions
search_code()
index_codebase()
get_entity()
analyze_complexity()
```

## Performance Benchmarks

Run benchmarks:

```bash
cargo bench
```

### Current Performance Targets

| Operation | Small (<1K files) | Medium (1K-10K) | Large (10K-100K) |
|-----------|------------------|-----------------|-------------------|
| Indexing  | <2s              | <20s            | <3min             |
| Search    | <30ms            | <50ms           | <150ms            |
| Parse     | <10ms/file       | <10ms/file      | <10ms/file        |

## Development

### Running Tests

```bash
# All tests
cargo test

# Specific crate
cargo test -p code-intelligence-parser

# With output
cargo test -- --nocapture

# Integration tests
cargo test --test '*'
```

### Code Coverage

```bash
# Install tarpaulin
cargo install cargo-tarpaulin

# Generate coverage
cargo tarpaulin --out Html
```

### Profiling

```bash
# CPU profiling
cargo build --release
perf record --call-graph=dwarf target/release/benchmark
perf report

# Memory profiling
valgrind --tool=massif target/release/benchmark
```

## Configuration

### Development (SQLite)

```toml
[database]
url = "sqlite:./data/codesight.db"
pool_size = 5
```

### Production (PostgreSQL)

```toml
[database]
url = "postgresql://user:pass@localhost/codesight"
pool_size = 20
```

## Error Handling

The codebase uses `thiserror` for error definitions and `anyhow` for error propagation:

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ParseError {
    #[error("Unsupported language: {0}")]
    UnsupportedLanguage(String),

    #[error("Parse failed: {0}")]
    ParseFailed(String),
}
```

## Logging

Structured logging via `tracing`:

```rust
use tracing::{info, debug, error};

info!("Indexing started for codebase: {}", codebase_id);
debug!("Processing file: {}", file_path);
error!("Failed to parse: {}", error);
```

## Contributing

1. Follow Rust style guidelines
2. Run `cargo clippy` before committing
3. Add tests for new functionality
4. Update benchmarks for performance-critical code
5. Document public APIs with rustdoc

## Dependencies

Key dependencies:
- `tokio` - Async runtime
- `rayon` - Parallel processing
- `tree-sitter` - Language parsing
- `tantivy` - Search engine (disabled for initial development)
- `sqlx` - Database access
- `serde` - Serialization
- `dashmap` - Concurrent hashmap

## License

MIT - See LICENSE file for details