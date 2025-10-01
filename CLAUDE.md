# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Version: v0.1.0**
**Last Updated: October 1, 2025**

## Project Overview

CodeSight MCP Server - **Enterprise-grade hybrid TypeScript/Rust implementation** with comprehensive code intelligence platform and exceptional code quality:
- **✅ TypeScript MCP Server** (`typescript-mcp/`): Full MCP protocol, 377+ entities indexed in SQLite
- **✅ React Frontend** (`src/`): Web UI with Vite and TypeScript
- **✅ Express API** (`api/`): REST API server with WebSocket support
- **✅ Rust FFI Bridge** (`rust-core/`): Complete NAPI-RS implementation with Tree-sitter parsers
- **✅ Multi-Language Support**: 15+ programming languages with real-time parsing
- **✅ Enterprise CI/CD**: 7 GitHub Actions workflows with comprehensive testing
- **✅ Production Docker**: Complete containerization with PostgreSQL, Redis, monitoring
- **✅ Professional Tooling**: Unified ESLint, TypeScript configs, security scanning
- 🏆 **Code Quality Excellence**: 62% lint improvement (1000+ → 378 remaining issues)
- 🏆 **Rule 15 Compliance**: Enterprise-grade code with systematic cleanup
- 🏆 **Type Safety Enhanced**: Comprehensive 'any' type elimination

## Essential Commands

### CLI (Enterprise-Ready)
```bash
# Build and setup
cd typescript-mcp && npm install && npm run build

# Build Rust FFI bridge (recommended for production performance)
cd ../rust-core && cargo build --release && cd ../typescript-mcp

# Index codebase (JS/TS, with multi-language support)
node dist/cli/index.js index /path/to/project

# Search and stats
node dist/cli/index.js search "query"
node dist/cli/index.js stats

# Test FFI bridge integration
node dist/cli/index.js test-ffi

# Run comprehensive tests
npm test
npm run test:contract
npm run test:performance
```

### Claude Desktop Integration
```json
{
  "mcpServers": {
    "codesight": {
      "command": "node",
      "args": ["F:/path/to/codesight-mcp/typescript-mcp/dist/index.js"],
      "cwd": "F:/path/to/codesight-mcp/typescript-mcp"
    }
  }
}
```

### Development
```bash
# Root dependencies and TypeScript development
npm install           # Root dependencies
npm run dev          # Start development environment
npm run build        # Production build
npm test             # All tests
npm run test:coverage # Run tests with coverage

# Rust development
cd rust-core
cargo build         # Debug build
cargo build --release  # Release build
cargo test          # Run Rust tests
cargo bench         # Run performance benchmarks
cargo clippy        # Lint Rust code

# Hybrid development (TypeScript + Rust)
npm run build:hybrid # Build both TypeScript and Rust components
npm run test:ffi     # Test FFI bridge integration

# Docker development
docker-compose -f docker-compose.dev.yml up -d
```

## MCP Tools Status

**✅ Real Implementation:**
- `search_code`: Natural language search with SQLite results
- `explain_function`: Function explanation with codebase lookup

**🔧 Mock Implementation (Working Protocol):**
- `find_references`, `trace_data_flow`, `analyze_security`
- `get_api_endpoints`, `check_complexity`, `find_duplicates`, `suggest_refactoring`

## Environment Configuration

**Development Configuration:**
```bash
# Server Configuration
NODE_ENV=development
PORT=4000
HOST=0.0.0.0

# Database
DATABASE_URL=sqlite://./data/codesight.db
RUST_FFI_PATH=../rust-core/target/release
ENABLE_RUST_FFI=true
FFI_GRACEFUL_FALLBACK=true

# Performance
INDEXING_PARALLEL_WORKERS=4
INDEXING_BATCH_SIZE=500
CACHE_SIZE_MB=512
```

**Production Configuration:**
```bash
# Server Configuration
NODE_ENV=production
PORT=4000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://postgres:password@postgres:5432/codesight
REDIS_URL=redis://redis:6379
RUST_FFI_PATH=./rust-core/target/release
ENABLE_RUST_FFI=true
FFI_GRACEFUL_FALLBACK=true

# Performance
INDEXING_PARALLEL_WORKERS=8
INDEXING_BATCH_SIZE=1000
CACHE_SIZE_MB=1024

# Security
JWT_SECRET=your-jwt-secret
API_KEY=your-api-key
CORS_ORIGIN=https://yourdomain.com

# Monitoring
LOG_LEVEL=info
LOG_FORMAT=json
SENTRY_DSN=your-sentry-dsn
PROMETHEUS_ENDPOINT=http://prometheus:9090
```

## Critical Development Rules

### 1. **Git Commit Restriction**
NEVER perform git commits unless explicitly requested by user.

### 2. **File Creation**
Only create necessary files. Always prefer editing existing files.

### 3. **Version Management**
Follow semantic versioning: 0.1.x for patches, 0.x.0 for features, x.0.0 for breaking changes.

### 4. **Package Management**
Always use latest stable versions. Avoid beta/alpha releases.

### 5. **DRY Principle** (CRITICAL)
Never duplicate code. Extract common logic into reusable utilities/components.

### 6. **FFI Bridge Development** (CRITICAL)
**Rust/TypeScript Integration Best Practices:**
- Always implement graceful fallback when calling Rust functions from TypeScript
- Use proper error handling across FFI boundaries (Result<T, Error> types)
- Minimize data serialization overhead between languages
- Batch operations when possible to reduce FFI call overhead
- Test both Rust-only and TypeScript-only paths independently
- Validate data structures at FFI boundaries using serde/zod
- Handle platform-specific compilation issues gracefully
- Use NAPI-RS for Node.js native modules (not direct FFI)

**Development Workflow:**
1. Develop Rust functionality with comprehensive tests
2. Expose functions via NAPI-RS with proper error handling
3. Implement TypeScript wrapper with fallback logic
4. Test both integrated and fallback scenarios
5. Profile performance and optimize critical paths

### 7. **English-Only Documentation** (CRITICAL)
**Documentation Standards:**
- All documentation, code comments, and commit messages MUST be in English
- This is a non-negotiable requirement for project consistency
- All files, including README, documentation, and inline code comments must use English
- No exceptions allowed for any documentation or code artifacts
- Ensure all technical communication and materials maintain English-only standards

### 15. **Problem Solving Approach & DRY Principle**

Zero errors/warnings and code duplication prevention

- **Fundamental Rule**: Never take shortcuts, find easy ways around, or circumvent proper implementation
- **DRY (Don't Repeat Yourself)**:
  - When code duplication is detected, it MUST be refactored
  - Common logic MUST be extracted into shared utilities/components/hooks
  - Create reusable abstractions instead of copy-paste solutions
  - High-risk error patterns should be added to Claude hooks configuration
- **Dependency & CI Management**:
  - Breaking change impact analysis for major dependency updates
  - Root cause analysis approach for CI pipeline conflict resolution
  - Proper injection patterns for test dependencies (JwtService, etc.)
  - Package version conflicts resolution strategy
- **Hook Operations**: Approaches that skip or disable PreToolUse hooks when they error are prohibited
- **Technical Issues**: Temporary workarounds for ESLint v9 errors, build problems, dependency conflicts are prohibited
- **Correct Approach**:
  - Find and fix the root cause of problems
  - Apply proper configuration and implementation
  - Develop solutions that follow best practices
  - Maintain system integrity
  - Add recurring errors to Claude hooks configuration
- **Prohibited Approaches**:
  - "Disable it for now, we'll fix it later"
  - "Create a simple workaround"
  - "Skip the hook, it's not important"
  - "Make a quick fix"
  - "Copy-paste, we'll refactor later"
- **Summary**: Produce comprehensive, correct, permanent, and DRY-compliant solutions for every problem

**Prohibited Approaches:**
- Temporary workarounds
- Copy-paste solutions
- Ignoring errors/warnings
- Quick fixes without proper analysis

**Required Approach:**
- Find root cause of problems
- Apply proper configuration
- Follow best practices
- Maintain system integrity

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.


      IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.