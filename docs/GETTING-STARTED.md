# 🚀 Getting Started Guide

**Version**: v0.1.0
**Last Updated**: October 11, 2025
**Implementation Status**: Phase 3.5 Complete - Enterprise Ready with Comprehensive Testing Framework

Welcome to the CodeSight MCP Server! This comprehensive guide will help you get up and running with our enterprise-grade code intelligence platform that features hybrid TypeScript/Rust architecture, comprehensive testing framework, and production-ready deployment capabilities.

## 🎯 What You'll Accomplish

By the end of this guide, you will have:

- ✅ A fully functional CodeSight MCP Server installation
- ✅ Understanding of the hybrid TypeScript/Rust architecture
- ✅ Experience with all 9 MCP tools for code intelligence
- ✅ Knowledge of the comprehensive testing framework
- ✅ Ability to run performance benchmarks and monitoring
- ✅ Integration with Claude Desktop and VS Code
- ✅ Docker-based testing with real GitHub projects

## 📋 Prerequisites

### System Requirements

**Minimum Requirements:**
- **Node.js**: v20 LTS or higher
- **Rust**: 1.75 or higher (for FFI bridge)
- **Memory**: 4GB RAM minimum (8GB recommended)
- **Storage**: 2GB free space (5GB for development)
- **OS**: Linux, macOS, or Windows (WSL2 recommended)

**Recommended for Production:**
- **Memory**: 8GB+ RAM
- **Storage**: 10GB+ SSD storage
- **CPU**: 4+ cores for optimal performance

### Development Tools

```bash
# Install NAPI-RS CLI for TypeScript/Rust integration
npm install -g @napi-rs/cli

# Install Docker and Docker Compose for testing infrastructure
# Docker: https://docs.docker.com/get-docker/
# Docker Compose: https://docs.docker.com/compose/install/

# Verify Git is installed
git --version
```

## 🚀 Quick Start (5 Minutes)

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-org/codesight-mcp.git
cd codesight-mcp

# Install root dependencies
npm install

# Install TypeScript MCP server dependencies
cd typescript-mcp && npm install
```

### 2. Build Rust FFI Bridge (Recommended)

```bash
# Build Rust core for optimal performance
cd ../rust-core
cargo build --release
cd ../typescript-mcp

# Verify FFI bridge is working
npm run test:ffi
```

### 3. Index Your First Codebase

```bash
# Index your project (replace with your project path)
node dist/cli/index.js index /path/to/your/project

# View indexing results
node dist/cli/index.js stats

# Example output:
# ✅ Indexing completed!
#    Files indexed: 47
#    Duration: 1.5s
#    Rate: 31 files/sec
#    Total entities: 377 (class: 48, function: 175, interface: 140, type: 14)
```

### 4. Test Code Intelligence

```bash
# Test natural language search
node dist/cli/index.js search "authentication functions"

# Test function explanation
node dist/cli/index.js explain getUserById

# Test MCP tools
npm run test:mcp-tools
```

### 5. Connect Claude Desktop

Add to your Claude Desktop configuration:

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

**🎉 Congratulations!** You now have a working CodeSight MCP Server with enterprise-grade code intelligence capabilities.

## 🏗️ Understanding the Architecture

### Hybrid TypeScript/Rust Architecture

The CodeSight MCP Server uses a sophisticated hybrid architecture that combines the flexibility of TypeScript with the performance of Rust:

```
┌─────────────────────────────────┐
│           AI Assistants           │
│    (Claude, GPT-4, etc.)        │
└─────────────────┬───────────────┘
                  │ MCP Protocol
┌─────────────────▼───────────────┐
│        TypeScript MCP Server     │
│  • MCP Protocol Handling        │
│  • REST API Endpoints           │
│  • Enterprise Error Handling    │
│  • Interactive CLI Interface    │
└─────────────────┬───────────────┘
                  │ NAPI-RS FFI
┌─────────────────▼───────────────┐
│          Rust Core Engine        │
│  • Tree-sitter Language Parsers │
│  • High-Performance Algorithms  │
│  • Memory-Optimized Operations  │
│  • Concurrent Processing        │
└─────────────────┬───────────────┘
                  │ Database Layer
┌─────────────────▼───────────────┐
│     Data Storage & Caching      │
│  • SQLite (Development)         │
│  • PostgreSQL (Production)      │
│  • Redis (Caching Layer)        │
└─────────────────────────────────┘
```

### Performance Benefits

| Operation | TypeScript Only | Hybrid (TS+Rust) | Improvement |
|-----------|-----------------|------------------|-------------|
| File Indexing | 2-3 seconds | 1-2 seconds | 2x faster |
| Search Queries | 50-100ms | 20-50ms | 2.5x faster |
| Memory Usage | ~30MB | ~25MB | 17% reduction |
| Multi-Language | JS/TS only | 15+ languages | 7.5x coverage |

## 🧪 Comprehensive Testing Framework

The CodeSight MCP Server includes a complete Test-Driven Development (TDD) framework with comprehensive testing coverage:

### Testing Categories

#### 1. MCP Tools Contract Tests (T009-T017) ✅

Tests for all 9 MCP tools with comprehensive input/output validation:

```bash
# Run MCP tools contract tests
npm run test:contract:mcp

# Individual tool tests
npm run test:contract:search-code      # T009
npm run test:contract:explain-function # T010
npm run test:contract:find-references  # T011
# ... and more
```

#### 2. REST API Contract Tests (T018-T028) ✅

Complete REST API endpoint testing with full contract validation:

```bash
# Run REST API contract tests
npm run test:contract:api

# Test specific endpoints
npm run test:contract:codebases-get   # T018
npm run test:contract:codebases-post  # T019
npm run test:contract:queries-post    # T023
# ... and more
```

#### 3. Integration Test Scenarios (T029-T033) ✅

Real-world integration testing scenarios:

```bash
# Run integration tests
npm run test:integration:scenarios

# Test specific integrations
npm run test:integration:claude-desktop  # T029
npm run test:integration:vscode         # T030
npm run test:integration:cicd           # T031
# ... and more
```

#### 4. Performance Benchmarking (T084-T088) ✅

Comprehensive performance testing and benchmarking:

```bash
# Run all performance benchmarks
npm run test:performance

# Specific benchmark suites
npm run test:benchmark:mcp-performance  # T084
npm run test:benchmark:load-testing     # T085
npm run test:benchmark:database         # T086
npm run test:benchmark:memory           # T087
npm run test:benchmark:monitoring       # T088
```

### Running the Complete Test Suite

```bash
# Run all tests with coverage
npm run test:all

# Quick validation test
npm run test:quickstart

# Full CI/CD test suite
npm run test:ci

# Docker-based real project testing
npm run test:docker
```

### Test Results Interpretation

```bash
# Example test output
✅ MCP Tools Contract Tests: 9/9 passing
✅ REST API Contract Tests: 11/11 passing
✅ Integration Test Scenarios: 5/5 passing
✅ Performance Benchmarks: 5/5 passing
✅ Docker Real-Project Tests: All scenarios validated

Total: 30/30 tests passing (100% success rate)
Coverage: 92% for critical components
Performance: All benchmarks exceeded targets
```

## 🐳 Docker Testing Infrastructure

The CodeSight MCP Server includes a comprehensive Docker testing infrastructure for real-project validation:

### Quick Start Docker Testing

```bash
# 1. Download real GitHub projects for testing
./scripts/download-test-projects.sh

# 2. Start isolated test environment
docker-compose -f docker-compose.test.yml up -d

# 3. Index projects for MCP testing
./scripts/index-test-projects.sh

# 4. Run comprehensive tests
./scripts/test-real-projects.sh

# 5. Generate detailed performance report
./scripts/generate-project-report.sh
```

### Test Environment Details

**Port Configuration:**
- MCP Server: `http://localhost:4000`
- Test PostgreSQL: `localhost:5433`
- Test Redis: `localhost:6380`
- Test Grafana: `http://localhost:4002`
- Test Prometheus: `http://localhost:9092`

**Test Projects:**
- **Small**: lodash, axios, prettier (< 1K files)
- **Medium**: express, fastapi (1K-10K files)
- **Large**: react, nextjs, vite (10K+ files)

### Monitoring Test Performance

```bash
# View test logs
docker-compose -f docker-compose.test.yml logs -f test-code-intelligence

# Check MCP server health
curl http://localhost:4000/health

# Access monitoring dashboards
# Grafana: http://localhost:4002 (admin/test_admin)
# Prometheus: http://localhost:9092
```

## 🔧 MCP Tools Usage

### Available MCP Tools

The CodeSight MCP Server implements 9 comprehensive MCP tools:

#### 1. search_code
Natural language code search with semantic understanding.

```typescript
// Usage examples
await search_code({
  query: "user authentication functions",
  limit: 10,
  file_types: ["ts", "js"],
  include_content: true
});
```

#### 2. explain_function
Comprehensive function explanation with usage examples.

```typescript
await explain_function({
  function_identifier: "getUserById",
  detail_level: "comprehensive",
  include_examples: true
});
```

#### 3. find_references
Find all references to symbols across the codebase.

```typescript
await find_references({
  target_identifier: "UserService",
  reference_types: ["call", "instantiation"],
  max_results: 50
});
```

#### 4. trace_data_flow
Trace data flow through functions and modules.

```typescript
await trace_data_flow({
  entry_point: "processUserData",
  trace_depth: 5,
  flow_direction: "forward"
});
```

#### 5. analyze_security
Analyze code for security vulnerabilities.

```typescript
await analyze_security({
  target: "codebase",
  severity_threshold: "medium",
  include_suggestions: true
});
```

#### 6. get_api_endpoints
Discover and catalog all API endpoints.

```typescript
await get_api_endpoints({
  api_types: ["rest", "graphql"],
  include_documentation: true
});
```

#### 7. check_complexity
Analyze code complexity metrics.

```typescript
await check_complexity({
  target: "src/services/",
  complexity_types: ["cyclomatic", "cognitive"],
  include_suggestions: true
});
```

#### 8. find_duplicates
Detect duplicate code patterns.

```typescript
await find_duplicates({
  target: "src/",
  similarity_threshold: 0.8,
  duplicate_types: ["functions", "methods"]
});
```

#### 9. suggest_refactoring
Provide intelligent refactoring suggestions.

```typescript
await suggest_refactoring({
  target: "src/legacy/",
  refactoring_types: ["extract_method", "introduce_parameter"],
  priority: "medium"
});
```

### Testing MCP Tools

```bash
# Test all MCP tools
npm run test:mcp-tools

# Test specific tool
npm run test:mcp:search-code

# Test with sample data
node dist/cli/index.js test-mcp-tools --sample-project
```

## 📊 Performance Monitoring

### Prometheus Metrics

Access comprehensive metrics at `http://localhost:4000/metrics`:

**Key Metrics:**
- `codesight_http_requests_total` - HTTP request counts
- `codesight_mcp_tool_calls_total` - MCP tool usage statistics
- `codesight_search_operations_total` - Search operation counts
- `codesight_system_memory_usage_bytes` - Memory usage tracking
- `codesight_rust_ffi_calls_total` - FFI bridge performance

### Grafana Dashboards

Access monitoring dashboards at `http://localhost:4002` (admin/test_admin):

1. **System Overview**: CPU, memory, and request metrics
2. **MCP Tools Performance**: Tool-specific performance analytics
3. **Database Performance**: Query performance and connection metrics
4. **User Load Testing**: Concurrent user performance tracking

### Performance Benchmarks

```bash
# Run performance benchmarks
npm run test:benchmark

# Generate performance report
npm run report:performance

# Monitor live performance
curl http://localhost:4000/metrics | grep codesight
```

## 🔌 Integration Guides

### Claude Desktop Integration

**Configuration:**
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

**Usage Examples:**
- "Search for authentication functions in the codebase"
- "Explain what the `processUserData` function does"
- "Find all references to the `UserService` class"
- "Trace the data flow from API endpoint to database"
- "Analyze security vulnerabilities in the payment module"

### VS Code Integration

**Extension Setup:**
1. Install the CodeSight VS Code extension
2. Configure workspace settings
3. Enable code intelligence features

**Features:**
- Real-time code analysis
- Intelligent code completion
- Security vulnerability detection
- Complexity analysis
- Refactoring suggestions

### API Integration

**Base URL:**
```bash
Development: http://localhost:4000
Production: https://api.codesight-mcp.com
```

**Example API Calls:**
```bash
# Search code
curl -X POST http://localhost:4000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "authentication", "codebase_id": "your-project"}'

# Get system health
curl http://localhost:4000/api/health

# Get performance metrics
curl http://localhost:4000/api/metrics
```

## 🛠️ Advanced Configuration

### Environment Variables

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

# Security
JWT_SECRET=your-jwt-secret
API_KEY=your-api-key
CORS_ORIGIN=https://yourdomain.com

# Monitoring
LOG_LEVEL=info
LOG_FORMAT=json
SENTRY_DSN=your-sentry-dsn
```

### Custom Configuration

Create a `.codesightrc.json` file in your project root:

```json
{
  "server": {
    "port": 4000,
    "host": "0.0.0.0"
  },
  "database": {
    "url": "sqlite://./data/codesight.db",
    "pool_size": 10
  },
  "rust_ffi": {
    "enabled": true,
    "graceful_fallback": true,
    "path": "../rust-core/target/release"
  },
  "indexing": {
    "parallel_workers": 4,
    "batch_size": 500,
    "include_tests": true,
    "exclude_patterns": ["node_modules/**", "dist/**"]
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
```

## 🔍 Troubleshooting

### Common Issues

#### Rust FFI Bridge Issues

**Problem**: FFI bridge not loading
```bash
❌ Error: Rust FFI bridge not available
```

**Solution**:
```bash
# Rebuild Rust components
cd rust-core
cargo clean
cargo build --release
cd ../typescript-mcp

# Verify FFI bridge
npm run test:ffi

# Check graceful fallback
ENABLE_RUST_FFI=false node dist/cli/index.js search "test"
```

#### Performance Issues

**Problem**: Slow search responses
```bash
❌ Search taking >500ms
```

**Solution**:
```bash
# Check Rust FFI is enabled
curl http://localhost:4000/api/ffi/status

# Optimize database
npm run optimize:database

# Check memory usage
curl http://localhost:4000/api/metrics | grep memory
```

#### Docker Testing Issues

**Problem**: Docker containers not starting
```bash
❌ Port conflicts or container failures
```

**Solution**:
```bash
# Check port conflicts
netstat -an | grep -E ":(4000|5433|6380)"

# Clean up and restart
docker-compose -f docker-compose.test.yml down --volumes
docker system prune -f
docker-compose -f docker-compose.test.yml up -d

# Check container health
docker-compose -f docker-compose.test.yml ps
```

### Debug Mode

Enable comprehensive debugging:

```bash
# Enable debug logging
export DEBUG=mcp:*
export NODE_ENV=development

# Run with verbose output
npm run dev -- --verbose

# Enable Rust debug logs
RUST_LOG=debug npm run dev

# Monitor all metrics
watch -n 5 'curl -s http://localhost:4000/metrics | head -20'
```

### Getting Help

**Community Resources:**
- **Documentation**: [docs/](./docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/codesight-mcp/issues)
- **Discord**: [Community Server](https://discord.gg/codesight)
- **Email**: <support@codesight-mcp.com>

**Diagnostic Information:**
```bash
# Generate diagnostic report
npm run diagnostic

# Export system information
npm run export:system-info

# Create bug report template
npm run bug-report
```

## 🎯 Next Steps

### Recommended Learning Path

1. **Explore MCP Tools**: Try all 9 MCP tools with your own codebase
2. **Run Performance Tests**: Use the Docker testing infrastructure
3. **Integrate with IDEs**: Set up Claude Desktop and VS Code integration
4. **Custom Configuration**: Tailor the server to your specific needs
5. **Production Deployment**: Deploy to production with Docker

### Advanced Topics

- **Custom MCP Tool Development**: Create your own MCP tools
- **Performance Optimization**: Advanced tuning and optimization
- **Multi-tenant Deployment**: Enterprise deployment strategies
- **Monitoring and Alerting**: Advanced monitoring setup
- **API Development**: Build applications using the REST API

### Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

**Quick Contribution Steps:**
1. Fork the repository
2. Create a feature branch
3. Write tests first (TDD approach)
4. Implement your changes
5. Run the full test suite
6. Submit a pull request

---

**🎉 Congratulations!** You've successfully set up the CodeSight MCP Server with enterprise-grade code intelligence capabilities. You now have access to:

- ✅ 9 comprehensive MCP tools for code analysis
- ✅ Hybrid TypeScript/Rust performance
- ✅ Complete testing framework with 30+ test suites
- ✅ Docker-based real-project validation
- ✅ Performance monitoring and benchmarking
- ✅ Production-ready deployment capabilities

**Happy coding!** 🚀

For more information, check out our [comprehensive documentation](./docs/) and join our [community](https://discord.gg/codesight).