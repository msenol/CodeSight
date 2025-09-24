# Changelog

All notable changes to the Code Intelligence MCP Server project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Documentation maintenance system with automated consistency checks
- Version consistency check script (`scripts/check-version-consistency.sh`)
- Documentation maintenance guide
- API endpoint reference documentation
- Health score monitoring for documentation quality

### Changed
- Updated project name to `code-intelligence-mcp`
- Synchronized version to v0.1.0-dev across all components

### Fixed
- Package.json version mismatch
- Documentation structure organization

## [0.1.0-dev] - 2025-09-24

### Added
- Initial project setup with hybrid TypeScript/Rust architecture
- TypeScript MCP server implementation
- Rust core engine for high-performance operations
- React frontend for visualization
- Express API server for REST endpoints
- Docker support with compose configurations
- MCP protocol tools:
  - `search_code` - Natural language code search
  - `explain_function` - Function explanation
  - `find_references` - Symbol reference finding
  - `trace_data_flow` - Data flow analysis
  - `analyze_security` - Security vulnerability analysis
  - `get_api_endpoints` - API endpoint discovery
  - `check_complexity` - Code complexity analysis

### Architecture
- Three-layer architecture:
  1. MCP Protocol Layer (TypeScript)
  2. FFI Bridge (Napi-rs)
  3. Rust Core (Tree-sitter, Tantivy, SQLite/PostgreSQL)

### Testing
- Unit tests for TypeScript and Rust components
- Contract tests for MCP protocol compliance
- Integration tests for component interactions
- Performance benchmarks
- Load testing with K6

### Development Environment
- Vite-based frontend build
- Nodemon for API server development
- Cargo workspace for Rust components
- Concurrently for parallel development servers

### Documentation
- CLAUDE.md for AI assistant guidance
- README.md with setup instructions
- Architecture documentation
- API documentation
- Testing guidelines

### Dependencies
- **Frontend**: React 18, Vite, Tailwind CSS
- **Backend**: Express, TypeScript
- **Rust**: Tokio, Rayon, Tree-sitter, Tantivy, SQLx
- **Testing**: Jest, K6, Cargo test
- **Build**: Docker, Docker Compose

### Performance Targets
- Small projects (<1K files): <5s indexing, <50ms queries
- Medium projects (1K-10K files): <30s indexing, <100ms queries
- Large projects (10K-100K files): <5min indexing, <200ms queries
- Monorepos (>100K files): <20min indexing, <500ms queries

## [0.0.1] - 2025-09-21

### Added
- Initial project scaffolding from Specify template
- Basic project structure
- Git repository initialization

---

## Version History Legend

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** in case of vulnerabilities

## Versioning Strategy

This project follows Semantic Versioning:
- **MAJOR** version (1.0.0): Incompatible API changes, production release
- **MINOR** version (0.1.0): New functionality, backwards compatible
- **PATCH** version (0.0.1): Backwards compatible bug fixes
- **Pre-release** (-dev, -alpha, -beta, -rc): Development versions

Current version: **v0.1.0-dev** (Active Development)