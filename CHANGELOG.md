# Changelog

All notable changes to the Code Intelligence MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-dev] - 2025-09-25

### Added
- Initial implementation of Code Intelligence MCP Server
- TypeScript MCP server with Model Context Protocol support
- Rust core engine for high-performance code analysis
- 9 MCP tools for comprehensive code intelligence:
  - `search_code` - Natural language code search
  - `explain_function` - Function explanation
  - `find_references` - Symbol reference finding
  - `trace_data_flow` - Data flow analysis
  - `analyze_security` - Security vulnerability analysis
  - `get_api_endpoints` - API endpoint discovery
  - `check_complexity` - Code complexity analysis
  - `find_duplicates` - Duplicate code detection
  - `suggest_refactoring` - Refactoring suggestions
- FFI bridge between TypeScript and Rust using Napi-rs
- Multiple transport modes (stdio, REST API, WebSocket)
- Comprehensive contract tests for all MCP tools
- React frontend for web UI
- Express API server
- Docker support for containerized deployment
- Support for 15+ programming languages via Tree-sitter
- SQLite support for development
- PostgreSQL support for production

### Infrastructure
- Workspace-based Rust architecture
- Modular crate structure:
  - Core models and services
  - Parser module with Tree-sitter
  - Indexer with parallel processing
  - Search module (Tantivy ready)
  - Storage abstraction layer
  - Caching layer with LRU/DashMap
  - FFI module for TypeScript integration
- CI/CD pipeline with GitHub Actions
- Performance benchmarks for Rust components
- Load testing with K6

### Documentation
- Comprehensive README files for all modules
- MCP tools documentation
- Architecture diagrams
- API documentation
- Contract test specifications
- Performance targets and benchmarks

### Developer Experience
- Hot reload for development
- TypeScript type safety throughout
- Extensive test coverage
- Docker Compose for easy setup
- Environment-based configuration
- Structured logging with tracing

## [Unreleased]

### Planned Features
- Semantic search with vector embeddings
- Redis caching for production
- GraphQL API support
- Real-time code monitoring
- IDE plugins (VSCode, IntelliJ)
- Cloud deployment options
- Multi-tenant support
- Advanced security scanning
- Code review automation
- Git integration

### Performance Improvements
- Tantivy search engine integration
- Distributed indexing
- Query optimization
- Memory usage optimization
- Incremental indexing improvements

---

## Version History

- **0.1.0-dev** (Current) - Initial development release
- **0.0.1** - Project initialization

## Upgrade Guide

### From 0.0.1 to 0.1.0-dev

This is the initial development release. Fresh installation is recommended:

```bash
git clone https://github.com/your-org/code-intelligence-mcp.git
cd code-intelligence-mcp
npm install
npm run build
```

## Breaking Changes

None yet - this is the initial release.

## Deprecations

None yet - this is the initial release.

## Security

No known security issues in this release.

For security vulnerabilities, please email security@example.com

## Contributors

See [CONTRIBUTORS.md](CONTRIBUTORS.md) for a list of contributors.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.