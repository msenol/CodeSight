# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Version: v0.1.1**
**Last Updated: May 9, 2026**

## Project Overview

CodeSight MCP Server - **Enterprise-grade hybrid TypeScript/Rust implementation** with comprehensive AI-powered code intelligence platform and exceptional code quality:

- **✅ TypeScript MCP Server** (`typescript-mcp/`): Full MCP protocol with 16 tools (11 core + 5 AI-powered), SQLite with shared TS/Rust read/write
- **✅ React Frontend** (`src/`): Web UI with Vite and TypeScript
- **✅ Express API** (`api/`): REST API server with WebSocket support
- **✅ Rust FFI Bridge** (`rust-core/`): NAPI-RS implementation with 8 exports (Parser, Indexer, Analyzer, Embedding crates)
- **✅ Multi-Language Support**: 8 programming languages with Tree-sitter
- **✅ ONNX Embeddings**: Real 384-dim sentence embeddings via `all-MiniLM-L6-v2`
- **✅ Rust Analyzer**: AST-based complexity analysis and Rabin-Karp duplicate detection
- **✅ Enterprise CI/CD**: 7 GitHub Actions workflows with comprehensive testing
- **✅ Production Docker**: Complete containerization with PostgreSQL, Redis, monitoring
- **✅ Professional Tooling**: Unified ESLint, TypeScript configs, security scanning
- **✅ Phase 3.4 Integration**: Advanced LLM integration, database adapters, security middleware
- **✅ Phase 4.1 AI Features**: 5 advanced AI-powered tools with comprehensive LLM integration
- **✅ Phase 5 Complete**: Rust FFI bridge with 8 NAPI exports, 10/10 MCP integration test pass
- **✅ Message Queuing**: BullMQ with Redis backend for background job processing
- **✅ LLM Integration**: llama.cpp, Ollama, HuggingFace with intelligent fallback routing
- **✅ Database Layer**: SQLite, PostgreSQL, DuckDB vector store with unified interfaces
- **✅ Security Stack**: JWT authentication, rate limiting, CORS, comprehensive logging
- **✅ Enterprise Caching**: Redis distributed caching with advanced features
- **✅ Enhanced Memory Management**: 4GB memory limit for complex AI analysis tasks
- 🏆 **Code Quality Excellence**: 95% TypeScript error reduction (1000+ → ~95 remaining issues)
- 🏆 **Zero ESLint Errors**: Perfect lint compliance with 0 errors, 0 warnings
- 🏆 **Rule 15 Compliance**: Enterprise-grade code with proper root cause analysis and permanent fixes
- 🏆 **Type Safety Enhanced**: Comprehensive 'any' type elimination and systematic interface improvements
- 🏆 **Production Ready**: Complete enterprise integration stack with monitoring and observability
- 🏆 **Docker Testing Infrastructure**: Comprehensive real-project testing with automated workflows
- 🏆 **Real Code Search**: Enhanced search functionality with external project validation
- 🏆 **REST API Contract Tests**: 11 comprehensive contract tests (T018-T028) with full endpoint coverage
- 🏆 **Integration Test Scenarios**: 5 integration scenarios (T029-T033) for real-world validation
- 🏆 **Performance Benchmarking**: 5 benchmark suites (T084-T088) with detailed metrics and monitoring
- 🏆 **AI Tool Testing**: 5 comprehensive AI tool test suites with full integration coverage
- 🏆 **Enhanced Test Coverage**: 72 comprehensive tests with 100% pass rate including AI validation
- 🏆 **TDD Framework Excellence**: Complete test-driven development with contract testing methodology
- 🏆 **Phase 5 Complete**: Rust FFI bridge with 8 NAPI exports, 10/10 MCP integration test pass

## Essential Commands

### Setup

```bash
# One-command setup (install + build everything)
npm run setup
```

### CLI

```bash
cd typescript-mcp

# Index, search, stats
node dist/cli/index.js index /path/to/project
node dist/cli/index.js search "query"
node dist/cli/index.js stats

# Build
npm run build:full       # TypeScript + native
npm run build:native      # Native module only
npm run build             # TypeScript only

# Tests
npm test                  # Unit tests
npm run test:contract     # Contract tests
npm run test:integration  # Integration tests
cd ../rust-core && cargo test  # Rust tests
```

### Docker Testing Infrastructure (New)

```bash
# Quick start Docker testing with real GitHub projects
./scripts/download-test-projects.sh           # Download test projects
docker-compose -f docker-compose.test.yml up -d  # Start test environment
./scripts/index-test-projects.sh             # Index projects
./scripts/test-real-projects.sh              # Run comprehensive tests
./scripts/generate-project-report.sh         # Generate performance report

# Monitor test environment
docker-compose -f docker-compose.test.yml logs -f test-code-intelligence
curl http://localhost:4000/health             # Check MCP server health

# Access test dashboards
# Test Grafana: http://localhost:4002 (admin/test_admin)
# Test Prometheus: http://localhost:9092

# Test individual components
docker exec projectara-test-mcp node dist/minimal-index.js search --query="function"
curl -X POST http://localhost:4000/api/search -H "Content-Type: application/json" -d '{"query": "useState"}'
```

### Claude Desktop Integration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "codesight": {
      "command": "node",
      "args": ["/path/to/CodeSight/typescript-mcp/dist/index.js"]
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

# Hybrid development (TypeScript + Rust + AI)
npm run build:hybrid # Build both TypeScript and Rust components
npm run test:ffi     # Test FFI bridge integration
npm run test:ai      # Test AI integrations

# AI provider testing
npm run test:ai-claude    # Test Claude integration
npm run test:ai-openai    # Test OpenAI integration
npm run test:ai-ollama    # Test Ollama integration

# Docker development with AI services
docker-compose -f docker-compose.dev.yml up -d
```

## MCP Tools Status

**✅ Core Tools (Phase 5 Complete — 11 Rust-Backed Tools):**

- `search_code`: SQLite-backed keyword search via Rust (~4ms)
- `explain_function`: Function explanation with codebase lookup
- `find_references`: Find all references to a symbol with cross-file analysis
- `trace_data_flow`: Trace data flow through the code with variable tracking
- `analyze_security`: Analyze code for security vulnerabilities
- `get_api_endpoints`: List all API endpoints in the codebase
- `check_complexity`: AST-based complexity analysis via Rust
- `find_duplicates`: Rabin-Karp rolling hash detection via Rust
- `suggest_refactoring`: Provide refactoring suggestions with implementation guidance
- `index_codebase`: Parallel codebase indexing with SQLite persistence (Rust)
- `analyze_codebase_complexity`: System-wide complexity analysis

**🤖 AI-Powered Tools (Phase 4.1 Complete):**

- `ai_code_review`: Comprehensive AI-powered code review with intelligent suggestions and quality analysis
- `intelligent_refactoring`: AI-driven refactoring recommendations with code transformation suggestions
- `bug_prediction`: Proactive bug prediction and risk assessment using ML-enhanced analysis
- `context_aware_code_generation`: Context-aware code generation with project understanding and style compliance
- `technical_debt_analysis`: Comprehensive technical debt assessment with business impact analysis and prioritization

**🔧 REST API Contract Tests (T018-T028):**

- ✅ **Codebases Management**: GET, POST, PUT, DELETE operations (T018-T021)
- ✅ **Indexing Operations**: Codebase indexing with progress tracking (T022)
- ✅ **Query Operations**: Search and analysis queries (T023)
- ✅ **Job Management**: Background job status and monitoring (T024-T025)
- ✅ **Health Checks**: System health and metrics endpoints (T026-T027)
- ✅ **Error Handling**: Comprehensive error response validation (T028)

**🔧 Integration Test Scenarios (T029-T033):**

- ✅ **Claude Desktop Integration**: Complete MCP server integration (T029)
- ✅ **VS Code Integration**: Workspace analysis and code intelligence (T030)
- ✅ **CI/CD Pipeline Integration**: Automated testing workflows (T031)
- ✅ **Multi-language Project Analysis**: Cross-language functionality (T032)
- ✅ **Performance Load Testing**: Concurrent user scenarios (T033)

**🔧 Performance Benchmarking (T084-T088):**

- ✅ **MCP Tools Performance**: Tool-specific performance metrics (T084)
- ✅ **Concurrent Load Testing**: Multi-user load testing (T085)
- ✅ **Database Optimization**: Query performance and indexing (T086)
- ✅ **Memory Optimization**: Memory usage and leak detection (T087)
- ✅ **Monitoring Dashboard**: Real-time performance monitoring (T088)

**🔧 Current Implementation Status (Phase 5 Complete):**

- ✅ **All 16 MCP Tools Fully Implemented**: 11 core + 5 AI-powered tools with comprehensive testing
- ✅ **Enhanced Test Coverage**: 72 comprehensive tests with 100% pass rate including AI validation
- ✅ **Zero Compilation Errors**: Perfect TypeScript and Rust compilation status
- ✅ **Zero ESLint Errors**: Perfect lint compliance across entire codebase (0 errors, 38 pre-existing warnings)
- ✅ **Enterprise-Grade Quality**: Rule 15 compliance with systematic error resolution
- ✅ **Production Ready**: Complete monitoring, observability, and performance optimization
- ✅ **AI Infrastructure**: Multi-provider LLM support with intelligent fallback routing
- ✅ **Enhanced Memory**: 4GB memory limit for complex AI analysis tasks
- ✅ **Complete TDD Framework**: All contract tests passing with comprehensive coverage including AI tools
- ✅ **AI Performance Optimization**: Sub-second AI responses with intelligent caching
- ✅ **AI Provider Testing**: Comprehensive testing for Claude, GPT-4, Ollama, and rule-based fallbacks
- ✅ **REST API Endpoint**: `/mcp/call` HTTP endpoint for non-MCP client access
- ✅ **Edge Case Handling**: Comprehensive edge case testing with proper error status codes (400, 404, 408, 413, 500)
- ✅ **Rust Compute Layer**: 4 crates — Parser, Indexer, Analyzer, Embedding
- ✅ **ONNX Embeddings**: Real 384-dim vectors via `all-MiniLM-L6-v2` (~23MB model)
- ✅ **FFI Bridge**: 8 NAPI exports with lazy init and graceful fallback

## AI Development Guidelines (Phase 4.1)

### 18. **AI/LLM Integration Development** (CRITICAL)

**Multi-Provider AI Architecture Best Practices:**

- **Provider Selection**: Always implement multiple AI providers with intelligent routing
  - Primary: OpenRouter (recommended - user-configurable, 100+ models available)
  - OpenRouter Models:
    - `xiaomi/mimo-v2-flash:free` (**RECOMMENDED** - Free tier, best quality, detects specific vulnerabilities)
    - `z-ai/glm-4.5-air:free` (Free tier, basic analysis)
    - `anthropic/claude-3.5-haiku` (Fast, cost-effective)
    - `openai/gpt-4o-mini` (Balanced cost/quality)
    - `anthropic/claude-3.5-sonnet` (Best for code analysis)
  - Secondary: Anthropic Claude (direct API, best for code analysis)
  - Tertiary: OpenAI GPT-4 (good all-rounder with multimodal)
  - Local: Ollama (offline capability, privacy-focused)
  - Fallback: Rule-based (always available, basic analysis)

- **Intelligent Fallback Strategy**:
  1. Try preferred provider (OpenRouter with user-configured model)
  2. Fall back to Anthropic Claude (if API key configured)
  3. Fall back to OpenAI GPT-4 (if API key configured)
  4. Use local provider if available (Ollama)
  5. Always have rule-based fallback as last resort
  6. Log all fallback events for monitoring

- **AI Prompt Engineering**:
  - Use context-aware prompts with project structure information
  - Include coding standards and architectural patterns in prompts
  - Implement prompt templates for consistent AI interactions
  - Validate AI outputs with rule-based checks
  - Cache expensive AI operations with intelligent invalidation

- **Performance Optimization**:
  - Implement response caching at multiple levels (memory, Redis)
  - Batch AI operations when possible to reduce API calls
  - Use streaming responses for long-running AI operations
  - Monitor AI costs and implement usage quotas
  - Optimize prompt size to reduce token usage

- **Privacy and Security**:
  - Never send sensitive data (passwords, API keys) to external AI services
  - Implement code scanning to detect sensitive information before AI processing
  - Provide user controls for enabling/disabling AI features
  - Log AI interactions for audit and compliance
  - Use environment-specific AI configurations (dev vs prod)

**AI Tool Development Workflow:**

1. **Design AI Interface**: Define clear input/output contracts for AI tools
2. **Implement Provider Abstraction**: Create common interface for all AI providers
3. **Add Rule-Based Fallback**: Ensure functionality works without AI providers
4. **Implement Caching Layer**: Add intelligent caching for AI responses
5. **Test All Providers**: Validate functionality with OpenRouter, Claude, GPT-4, Ollama, rule-based
6. **Performance Testing**: Measure response times and optimize bottlenecks
7. **Cost Monitoring**: Track AI usage and implement cost controls (especially for OpenRouter)
8. **Error Handling**: Graceful degradation when AI providers fail

**AI Tool Testing Strategy:**

- **Unit Tests**: Test individual AI tool logic with mock providers
- **Integration Tests**: Test with real AI providers (OpenRouter, Claude, GPT-4, Ollama)
- **Fallback Tests**: Verify rule-based fallback functionality
- **Performance Tests**: Measure AI response times and resource usage
- **Cost Tests**: Validate AI cost tracking and quota enforcement
- **Privacy Tests**: Ensure sensitive data is not sent to external services

### 19. **AI Performance and Cost Management** (CRITICAL)

**Performance Requirements:**

- **AI Response Times**: Target <1 second for most AI operations
- **Memory Overhead**: Keep AI-related memory usage under 30MB additional
- **Concurrency**: Support multiple concurrent AI operations with proper queuing
- **Caching Hit Rate**: Aim for >70% cache hit rate for repeated AI queries
- **Error Recovery**: <5 second recovery time when AI providers fail

**Cost Optimization Strategies:**

- **Prompt Optimization**: Minimize token usage while maintaining quality
- **Smart Caching**: Cache responses with intelligent cache invalidation
- **Batch Processing**: Combine multiple small AI requests into batches
- **Provider Selection**: Choose cost-effective providers for different use cases
- **Usage Monitoring**: Real-time cost tracking with configurable limits

**Quality Assurance:**

- **Confidence Scoring**: Rate AI suggestions with confidence levels
- **Validation Rules**: Use rule-based validation to filter bad AI suggestions
- **Human Review**: Implement review workflows for critical AI recommendations
- **Continuous Learning**: Learn from user feedback to improve AI quality
- **A/B Testing**: Compare different AI providers and prompt strategies

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

# AI/LLM Configuration (Development)
PREFERRED_AI_PROVIDER=openrouter

# OpenRouter Configuration (Recommended)
# Get your API key from https://openrouter.ai/keys
OPENROUTER_API_KEY=your-openrouter-api-key
# Free tier model for testing (Xiaomi Mimo - best quality free tier)
OPENROUTER_MODEL=xiaomi/mimo-v2-flash:free
# Other options: z-ai/glm-4.5-air:free, anthropic/claude-3.5-haiku, openai/gpt-4o-mini, anthropic/claude-3.5-sonnet

# Optional: Direct AI provider access (for fallback)
ANTHROPIC_API_KEY=your-anthropic-api-key
OPENAI_API_KEY=your-openai-api-key
OLLAMA_BASE_URL=http://localhost:11434

ENABLE_AI_FALLBACK=true
AI_CACHE_ENABLED=true
AI_TIMEOUT_MS=30000
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

# AI/LLM Configuration (Production)
PREFERRED_AI_PROVIDER=openrouter

# OpenRouter Configuration (Recommended for production)
OPENROUTER_API_KEY=your-production-openrouter-key
# Production models (higher quality, cost applies):
OPENROUTER_MODEL=anthropic/claude-3.5-haiku
# Alternatives: openai/gpt-4o-mini, anthropic/claude-3.5-sonnet, xiaomi/mimo-v2-flash:free

# Optional: Direct AI provider access (for fallback)
ANTHROPIC_API_KEY=your-production-anthropic-key
OPENAI_API_KEY=your-production-openai-key
OLLAMA_BASE_URL=http://ollama:11434

ENABLE_AI_FALLBACK=true
AI_CACHE_ENABLED=true
AI_TIMEOUT_MS=45000
AI_COST_LIMIT_PER_HOUR=50.00
AI_RATE_LIMIT_PER_MINUTE=100

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

- Use NAPI-RS for Node.js native modules via `npx napi build --platform --release`
- Build produces `index.js`, `index.d.ts`, and `.node` binary in `rust-core/crates/ffi/`
- TypeScript loads the native module via `createRequire` in `typescript-mcp/src/rust-bridge.ts`
- 8 NAPI exports: `init_engine`, `parse_file`, `index_codebase`, `search_code`, `analyze_complexity`, `find_duplicates`, `generate_embedding`, `get_statistics`, `clear`
- Lazy initialization pattern — no manual `initEngine()` call required
- Graceful fallback to TypeScript when native module unavailable
- Use proper error handling across FFI boundaries (Result<T, Error> types)
- Data structures: `CodeEntity`, `SearchResult`, `ComplexityMetrics`, `DuplicateResult`
- Batch operations when possible to reduce FFI call overhead
- Test both Rust-only and TypeScript-only paths independently

**Development Workflow:**

1. Develop Rust functionality in `rust-core/crates/` (parser, indexer, analyzer, embedding)
2. Expose functions via NAPI-RS with `#[napi]` macro and proper error handling
3. Build with `npx napi build --platform --release` from `rust-core/crates/ffi/`
4. TypeScript wrapper in `typescript-mcp/src/rust-bridge.ts` with lazy init
5. Test both integrated (`cargo test`, `npm test`) and fallback scenarios
6. Profile performance and optimize critical paths

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

### 16. **Test-Driven Development (TDD) Methodology** (CRITICAL)

**TDD Best Practices for MCP Server Development:**

- **Contract-First Development**: Always write contract tests before implementation (T009-T028)
- **Integration Scenarios**: Validate real-world usage patterns with integration tests (T029-T033)
- **Performance Benchmarking**: Include performance tests for all critical paths (T084-T088)
- **Docker Validation**: Use real GitHub projects for comprehensive testing
- **Regression Testing**: Ensure all tests pass before merging changes
- **Coverage Requirements**: Maintain >90% test coverage for all critical components

**TDD Workflow:**

1. **Write Contract Test**: Define expected behavior with contract test
2. **Run Test (Fail)**: Verify test fails initially (red phase)
3. **Implement Minimum Code**: Write simplest implementation to pass test
4. **Run Test (Pass)**: Verify implementation meets contract (green phase)
5. **Refactor**: Improve code while maintaining test coverage (refactor phase)
6. **Integration Test**: Validate with real-world scenarios
7. **Performance Test**: Ensure performance requirements are met
8. **Documentation**: Update documentation to reflect changes

**Test Categories:**

- **Unit Tests**: Component-level functionality testing
- **Contract Tests**: API contract compliance and MCP protocol validation
- **Integration Tests**: End-to-end workflow validation
- **Performance Tests**: Load testing and benchmarking
- **Docker Tests**: Real-project validation in isolated environments

### 17. **Docker Testing Infrastructure Usage** (CRITICAL)

**Real-Project Testing Best Practices:**

- Always use Docker testing infrastructure when validating MCP functionality with real projects
- Test with multiple project sizes: small (<1K files), medium (1K-10K), large (10K+ files)
- Verify search performance meets benchmarks: <50ms for small, <100ms for medium, <200ms for large projects
- Monitor memory usage during testing: ensure <400MB for small, <800MB for medium projects
- Use test environment isolation: separate PostgreSQL, Redis, and monitoring for testing
- Validate cross-project search functionality and multi-language parsing capabilities
- Generate comprehensive performance reports after each testing session
- Check that all test containers are healthy before running test suites

**Docker Testing Workflow:**

1. Download test projects using standardized scripts
2. Start isolated test environment with dedicated databases
3. Index projects with progress tracking and performance monitoring
4. Run comprehensive MCP tool tests across all project sizes
5. Validate search functionality with real-world queries
6. Generate detailed performance and functionality reports
7. Clean up test environment after validation complete

**Test Environment Requirements:**

- Minimum 4GB RAM for small/medium project testing
- 10GB+ disk space for external test projects and databases
- Isolated network configuration (172.21.0.0/16 subnet)
- Separate port allocations to avoid conflicts with development environment
- Health checks for all services before testing begins

# important-instruction-reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

      IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.
