# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Version: v0.1.0-dev**

## Project Overview

Code Intelligence MCP Server - A hybrid TypeScript/Rust architecture that enables AI assistants to understand and query codebases through natural language. The project consists of:
- **TypeScript MCP Server** (`typescript-mcp/`): Handles MCP protocol communication with AI assistants
- **Rust Core Engine** (`rust-core/`): High-performance code parsing, indexing, and search
- **React Frontend** (`src/`): Web UI for visualization and management
- **Express API** (`api/`): REST API server for web access

## Architecture

The system uses a three-layer architecture:
1. **MCP Protocol Layer**: TypeScript server implementing Model Context Protocol for AI assistant integration
2. **FFI Bridge**: Napi-rs connects TypeScript to Rust for performance-critical operations
3. **Rust Core**: Tree-sitter parsing, Tantivy search indexing, SQLite/PostgreSQL storage

Key architectural decisions:
- Rust handles all CPU-intensive operations (parsing, indexing, searching)
- TypeScript manages protocol communication and orchestration
- Storage can be SQLite (development) or PostgreSQL (production)
- Redis for caching in production environments

## Development Commands

### Full Project Commands
```bash
# Install all dependencies (root + subprojects)
npm install

# Start development environment (client + server)
npm run dev

# Run all tests
npm test

# Run specific test suites
npm run test:unit          # Unit tests (TypeScript + Rust)
npm run test:integration    # Integration tests
npm run test:contract       # Contract tests
npm run test:performance    # Performance benchmarks
npm run test:load          # K6 load tests

# Build production
npm run build

# Lint and type checking
npm run lint
npm run check
```

### Rust Core Commands
```bash
cd rust-core

# Build Rust core
cargo build --release

# Run Rust tests
cargo test

# Run benchmarks
cargo bench

# Run specific crate tests
cargo test -p core
cargo test -p parser
cargo test -p indexer
```

### TypeScript MCP Commands
```bash
cd typescript-mcp

# Build TypeScript MCP
npm run build
npm run build:full    # With Rust FFI bindings

# Development mode
npm run dev

# Run tests
npm run test
npm run test:coverage
npm run test:watch

# Lint and format
npm run lint
npm run format
npm run type-check
```

### Docker Commands
```bash
# Start with Docker Compose
docker-compose up -d

# Development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose logs -f code-intelligence
```

## Project Structure

- `rust-core/`: Rust workspace with specialized crates
  - `crates/core/`: Core models and services
  - `crates/parser/`: Tree-sitter language parsing
  - `crates/indexer/`: Code indexing engine
  - `crates/search/`: Tantivy search implementation
  - `crates/embedding/`: Vector embeddings for semantic search
  - `crates/storage/`: Database abstractions
  - `crates/cache/`: Caching layer
  - `crates/ffi/`: Foreign function interface for TypeScript

- `typescript-mcp/`: TypeScript MCP server implementation
  - Implements Model Context Protocol
  - Communicates with Rust core via FFI
  - Contract tests in `tests/contract/`

- `api/`: Express.js REST API server
  - Entry point: `api/server.ts`
  - Routes defined in `api/routes/`
  - Runs via nodemon in development

- `src/`: React frontend application
  - Vite-based build system
  - TypeScript with React 18
  - Tailwind CSS for styling

## Testing Strategy

The project uses a multi-level testing approach:

1. **Unit Tests**: Test individual functions and modules
   - TypeScript: Jest with ts-jest
   - Rust: Built-in cargo test

2. **Contract Tests**: Verify MCP protocol compliance (`typescript-mcp/tests/contract/`)
   - `test_search_code.ts`: Natural language search
   - `test_explain_function.ts`: Function explanation
   - `test_find_references.ts`: Reference finding
   - `test_trace_data_flow.ts`: Data flow analysis
   - `test_analyze_security.ts`: Security analysis
   - `test_get_api_endpoints.ts`: API discovery
   - `test_check_complexity.ts`: Complexity checking

3. **Integration Tests**: Test component interactions

4. **Performance Tests**: Benchmark critical paths
   - Rust benchmarks in `rust-core/benches/`
   - Load testing with K6 in `tests/load/`

5. **Memory Tests**: Profile memory usage in Rust components

## Environment Configuration

Required environment variables for different contexts:

### Development
```bash
NODE_ENV=development
PORT=4000
DATABASE_URL=sqlite://./data/code_intelligence.db
```

### Production with Docker
```bash
NODE_ENV=production
DATABASE_URL=postgresql://postgres:password@postgres:5432/code_intelligence
REDIS_URL=redis://redis:6379
LLM_PROVIDER=ollama
LLM_ENDPOINT=http://localhost:11434
```

## MCP Integration

To integrate with AI assistants like Claude Desktop, the TypeScript MCP server exposes these tools:
- `search_code`: Natural language code search
- `explain_function`: Explain what a function does
- `find_references`: Find all references to a symbol
- `trace_data_flow`: Trace data flow through code
- `analyze_security`: Security vulnerability analysis
- `get_api_endpoints`: List API endpoints
- `check_complexity`: Analyze code complexity
- `find_duplicates`: Detect duplicate code patterns
- `suggest_refactoring`: Provide refactoring suggestions

The server runs on port 8080 (WebSocket) and 4000 (REST API) by default.

## Performance Targets

The system is designed to handle:
- Small projects (<1K files): <5s indexing, <50ms queries
- Medium projects (1K-10K files): <30s indexing, <100ms queries
- Large projects (10K-100K files): <5min indexing, <200ms queries
- Monorepos (>100K files): <20min indexing, <500ms queries

## Key Dependencies

- **TypeScript Side**: Express, Vite, React, @modelcontextprotocol/sdk
- **Rust Side**: tokio, rayon, tree-sitter, tantivy, sqlx
- **FFI Bridge**: napi-rs for TypeScript-Rust communication
- **Testing**: Jest, Vitest, K6 for load testing

## Critical Development Rules

### 1. **Date Usage**
Always use current date dynamically when documenting or coding - never use hardcoded dates.

### 2. **Git Commit Restriction**
NEVER perform git commits unless explicitly requested by the user with "commit" or similar command.

### 3. **File Creation**
Only create necessary files. Avoid creating redundant or unnecessary files.

### 4. **Change Notification**
Clearly notify the user of all changes made to the codebase.

### 5. **User Approval**
Obtain user approval for critical changes before implementation.

### 6. **Temporary Files**
All temporary files must be saved in appropriate temp directories:
- General temp files: `.tmp/` or `temp/`
- Trae specific: `.trae/tmp/`
- TypeScript MCP: `typescript-mcp/.tmp/`

### 7. **Version Management**
Follow semantic versioning strictly:
- **Patch (0.1.x)**: Bug fixes, minor improvements
- **Minor (0.x.0)**: New features, non-breaking changes
- **Major (x.0.0)**: Breaking changes, production-ready releases
- Be conservative with version bumps, avoid reaching 1.0.0 prematurely

### 8. **Package Management**
When adding npm packages:
- Always use LATEST STABLE versions
- Avoid beta, alpha, RC versions
- Install with `@latest` tag
- Prioritize security and compatibility
- Check both root and subproject package.json files

### 9. **Docker-First Development**
Prioritize Docker for all development operations:
- Use docker-compose for service orchestration
- Debug within Docker containers when possible
- Ensure all services work in containerized environment
- Test both SQLite (dev) and PostgreSQL (prod) configurations

### 10. **Performance Monitoring**
Always consider performance implications:
- Run benchmarks after significant changes to Rust core
- Monitor memory usage with profiling tools
- Keep query response times within targets
- Use caching appropriately (Redis in production)

### 11. **File Size Limits**
Keep documentation concise and focused:
- CLAUDE.md should remain under 40,000 characters
- Move detailed information to appropriate docs/ subdirectories
- Summarize completed features rather than listing all details

### 12. **Testing Before Changes**
- Run relevant tests before making significant changes
- Use contract tests to verify MCP protocol compliance
- Benchmark performance-critical paths
- Ensure all test suites pass before marking work complete

### 15. **Problem Solving Approach & DRY Principle** (MOST CRITICAL RULE)
Zero errors/warnings and preventing code duplication:

**Core Rule**: Never take shortcuts, workarounds, or bypass proper solutions.

**DRY (Don't Repeat Yourself)**:
- Refactor immediately when code duplication is detected
- Extract common logic into shared utilities/components/hooks
- Create reusable abstractions instead of copy-paste
- Document recurring error patterns for future reference

**Dependency & CI Management**:
- Analyze breaking change impacts before major updates
- Apply root cause analysis for CI pipeline conflicts
- Use proper injection patterns for test dependencies
- Implement clear package version conflict resolution

**Correct Approach**:
- Find and fix the root cause of problems
- Apply proper configuration and implementation
- Develop solutions following best practices
- Maintain system integrity
- Document recurring issues for team awareness

**Prohibited Approaches**:
- "Let's disable it temporarily and fix later"
- "Let's do a simple workaround"
- "Let's bypass the hook, it's not important"
- "Let's do a quick fix"
- "Let's copy-paste and fix later"
- Ignoring ESLint errors or build problems
- Using temporary workarounds for dependency conflicts

**Summary**: Produce comprehensive, correct, permanent, and DRY-compliant solutions for every problem.