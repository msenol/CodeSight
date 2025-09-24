# ADR-0001: Hybrid Rust/TypeScript Architecture

## Status

Accepted

## Date

2024-01-15

## Context

We need to build a high-performance code intelligence server that can:

1. Parse and index large codebases efficiently
2. Provide fast semantic search capabilities
3. Integrate seamlessly with AI assistants via the Model Context Protocol (MCP)
4. Support multiple programming languages
5. Scale to handle enterprise-level codebases

The main architectural decision is choosing the technology stack that balances performance, developer productivity, and ecosystem compatibility.

## Decision

We will implement a **hybrid architecture** with:

- **Rust core engine** for performance-critical operations:
  - Code parsing with Tree-sitter
  - Full-text search with Tantivy
  - Embedding generation with ONNX Runtime
  - Parallel indexing and processing
  - Memory-efficient data structures

- **TypeScript MCP layer** for integration and API:
  - Model Context Protocol implementation
  - REST API endpoints
  - Request/response handling
  - Tool definitions and schemas
  - Integration with Node.js ecosystem

## Rationale

### Why Rust for the Core Engine?

1. **Performance**: Rust provides near-C performance with memory safety
2. **Concurrency**: Excellent support for parallel processing without data races
3. **Memory Efficiency**: Zero-cost abstractions and precise memory control
4. **Tree-sitter Integration**: Native Rust bindings for syntax parsing
5. **Search Performance**: Tantivy (Rust) provides faster indexing than Elasticsearch
6. **WASM Compatibility**: Future option to run in browsers or edge environments

### Why TypeScript for the MCP Layer?

1. **MCP Ecosystem**: Official MCP SDK is in TypeScript
2. **Rapid Development**: Faster iteration for API and integration logic
3. **Rich Ecosystem**: Extensive npm packages for utilities and integrations
4. **Type Safety**: TypeScript provides compile-time type checking
5. **Community**: Large developer community familiar with Node.js/TypeScript
6. **Tooling**: Excellent debugging and development tools

### Why Not Alternative Approaches?

**Pure Rust Approach:**
- ❌ Limited MCP ecosystem support
- ❌ Slower development for API logic
- ❌ Fewer integration libraries
- ✅ Maximum performance
- ✅ Single language codebase

**Pure TypeScript/Node.js Approach:**
- ❌ Performance bottlenecks for large codebases
- ❌ Memory usage concerns
- ❌ Limited parallel processing capabilities
- ✅ Rapid development
- ✅ Rich ecosystem

**Python Approach:**
- ❌ Performance limitations (GIL)
- ❌ Memory usage for large datasets
- ❌ Deployment complexity
- ✅ ML/AI ecosystem
- ✅ Rapid prototyping

**Go Approach:**
- ❌ Limited Tree-sitter bindings
- ❌ Smaller ecosystem for search/ML
- ✅ Good performance
- ✅ Simple deployment

## Implementation Details

### Architecture Layers

```
┌─────────────────────────────────────┐
│           Client Layer              │
│  (Claude Desktop, VS Code, CLI)     │
└─────────────────┬───────────────────┘
                  │ MCP Protocol
┌─────────────────▼───────────────────┐
│        TypeScript MCP Layer        │
│  • Tool definitions                 │
│  • Request/response handling        │
│  • REST API endpoints              │
│  • Authentication & validation      │
└─────────────────┬───────────────────┘
                  │ FFI/IPC
┌─────────────────▼───────────────────┐
│          Rust Core Engine           │
│  • Tree-sitter parsing             │
│  • Tantivy search indexing         │
│  • ONNX embedding generation       │
│  • Parallel processing             │
│  • Memory management               │
└─────────────────────────────────────┘
```

### Communication Interface

**Foreign Function Interface (FFI):**
- Rust exposes C-compatible functions
- TypeScript calls via Node.js native addons
- Efficient data serialization with MessagePack
- Async operations with callback patterns

**Data Flow:**
1. TypeScript receives MCP requests
2. Validates and transforms request data
3. Calls Rust functions via FFI
4. Rust processes data and returns results
5. TypeScript formats response for MCP protocol

### Performance Characteristics

**Expected Performance:**
- Indexing: ~1000 files/second (typical TypeScript project)
- Search: <100ms response time for most queries
- Memory: ~50MB base + ~1MB per 1000 indexed files
- Concurrency: Support for 100+ simultaneous requests

## Consequences

### Positive

1. **Best of Both Worlds**: Performance where needed, productivity where beneficial
2. **Scalability**: Rust core can handle large codebases efficiently
3. **Maintainability**: Clear separation of concerns between layers
4. **Ecosystem Access**: Can leverage both Rust and Node.js ecosystems
5. **Future Flexibility**: Can optimize individual components independently

### Negative

1. **Complexity**: Two languages and build systems to maintain
2. **FFI Overhead**: Some performance cost for cross-language calls
3. **Deployment**: More complex build and deployment process
4. **Team Skills**: Requires expertise in both Rust and TypeScript
5. **Debugging**: Cross-language debugging can be challenging

### Mitigation Strategies

1. **Build Automation**: Comprehensive CI/CD pipeline for both languages
2. **Interface Design**: Minimize FFI calls with batched operations
3. **Documentation**: Clear guidelines for cross-language development
4. **Testing**: Extensive integration tests for FFI boundary
5. **Monitoring**: Performance monitoring for both layers

## Alternatives Considered

### 1. Pure Rust with HTTP API

**Pros:**
- Single language
- Maximum performance
- Simple deployment

**Cons:**
- Limited MCP ecosystem
- Slower API development
- Less flexible for integrations

**Decision:** Rejected due to MCP ecosystem limitations

### 2. TypeScript with Native Modules

**Pros:**
- Single primary language
- Good performance for critical paths
- Rich ecosystem

**Cons:**
- Complex native module development
- Platform-specific compilation
- Limited performance gains

**Decision:** Rejected in favor of full Rust core

### 3. Microservices Architecture

**Pros:**
- Language independence
- Horizontal scalability
- Service isolation

**Cons:**
- Network overhead
- Deployment complexity
- Latency concerns

**Decision:** Rejected for initial version, may reconsider for cloud deployment

## Implementation Plan

### Phase 1: Core Foundation
1. Rust core with basic parsing and indexing
2. TypeScript FFI bindings
3. Basic MCP tool implementations

### Phase 2: Feature Complete
1. Full search capabilities
2. Embedding generation
3. Complete MCP tool suite

### Phase 3: Optimization
1. Performance tuning
2. Memory optimization
3. Parallel processing improvements

## Success Metrics

1. **Performance**: Index 10,000 files in <60 seconds
2. **Memory**: <2GB RAM for 100,000 file codebase
3. **Latency**: <100ms for 95% of search queries
4. **Reliability**: 99.9% uptime in production
5. **Developer Experience**: <5 minutes from install to first query

## Related ADRs

- [ADR-0002: Tree-sitter for Code Parsing](0002-tree-sitter-parsing.md)
- [ADR-0003: Tantivy for Full-text Search](0003-tantivy-search.md)
- [ADR-0004: ONNX Runtime for Embeddings](0004-onnx-embeddings.md)
- [ADR-0005: SQLite for Metadata Storage](0005-sqlite-storage.md)

## References

- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Tree-sitter Documentation](https://tree-sitter.github.io/tree-sitter/)
- [Tantivy Search Engine](https://github.com/quickwit-oss/tantivy)
- [ONNX Runtime](https://onnxruntime.ai/)
- [Rust FFI Guide](https://doc.rust-lang.org/nomicon/ffi.html)