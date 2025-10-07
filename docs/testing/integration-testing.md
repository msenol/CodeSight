# Integration Testing Guide

**Comprehensive Integration Test Suite (27/27 Tests Passing)**

This guide provides detailed documentation for the integration testing framework of the CodeSight MCP Server, covering Claude Desktop, VS Code, and end-to-end workflow testing.

## Overview

The integration testing suite validates the entire CodeSight MCP Server implementation with real-world scenarios and production-like conditions. With 27/27 tests passing, we ensure complete MCP protocol compliance and integration readiness for AI assistants and development tools.

### Test Coverage Breakdown

- **Claude Desktop Integration**: 9/9 tests passing
- **VS Code Integration**: 11/11 tests passing
- **End-to-End Workflows**: 7/7 tests passing
- **Total Integration Tests**: 27/27 tests passing

## Test Architecture

### Testing Philosophy

Our integration testing follows these principles:

1. **Real Server Testing**: Live MCP server instances for authentic testing
2. **Production-like Environments**: Testing in conditions that mirror production
3. **Comprehensive Coverage**: All MCP tools and integration scenarios
4. **Performance Validation**: Measured performance metrics under load
5. **Error Recovery Testing**: Comprehensive failure scenario validation
6. **Multi-Client Support**: Validated integration with different AI assistant clients

### Test Infrastructure

```
Integration Test Framework
├── Test Server Management
│   ├── Live MCP Server Instances
│   ├── Configuration Management
│   └── Resource Cleanup
├── Test Scenarios
│   ├── Claude Desktop Integration (9 tests)
│   ├── VS Code Integration (11 tests)
│   └── End-to-End Workflows (7 tests)
├── Performance Monitoring
│   ├── Response Time Metrics
│   ├── Memory Usage Tracking
│   └── Concurrency Testing
└── Validation Framework
    ├── MCP Protocol Compliance
    ├── Tool Functionality Validation
    └── Error Handling Verification
```

## Test Suites

### Claude Desktop Integration Tests (9/9 passing)

These tests validate complete integration with Claude Desktop, ensuring the MCP server works correctly with AI assistants.

#### Test Coverage:
- ✅ **MCP server startup and initialization**: Validate server startup with all 9 tools
- ✅ **MCP protocol compliance (2024-11-05)**: Full specification validation
- ✅ **Tool listing and discovery**: Verify all 9 MCP tools are properly discoverable
- ✅ **Real search functionality**: Test search with actual SQLite database queries
- ✅ **Function explanation capabilities**: Validate function explanation with codebase lookup
- ✅ **Configuration file validation**: Test Claude Desktop configuration handling
- ✅ **Error handling and graceful recovery**: Comprehensive error scenario testing
- ✅ **Connection persistence**: Validate multiple request handling
- ✅ **Debug logging and monitoring**: Ensure proper logging infrastructure

#### Running Claude Desktop Tests:
```bash
npm run test:claude-desktop
```

### VS Code Integration Tests (11/11 passing)

These tests validate workspace analysis capabilities when integrated with VS Code extensions.

#### Test Coverage:
- ✅ **Workspace structure detection**: Analyze VS Code workspace layout
- ✅ **TypeScript file parsing**: Parse and understand TypeScript files
- ✅ **Cross-reference finding**: Find references across workspace files
- ✅ **API endpoint detection**: Discover and document API endpoints
- ✅ **Code complexity analysis**: Calculate complexity metrics for files
- ✅ **Data flow tracing**: Trace data flow through the codebase
- ✅ **Duplicate code detection**: Identify similar code patterns
- ✅ **Refactoring suggestions**: Provide improvement recommendations
- ✅ **Security vulnerability analysis**: Detect potential security issues
- ✅ **Dynamic file change handling**: Test real-time file change processing
- ✅ **Extension configuration compatibility**: Validate VS Code extension setup

#### Running VS Code Tests:
```bash
npm run test:vscode
```

### End-to-End Workflow Tests (7/7 passing)

These tests validate real-world usage scenarios and complete workflows.

#### Test Coverage:
- ✅ **Complete Claude Desktop session workflow**: Full AI assistant session simulation
- ✅ **VS Code development workflow**: Developer workflow with code analysis
- ✅ **Multi-language project analysis**: Cross-language codebase analysis
- ✅ **Real-time codebase changes**: Dynamic code change handling
- ✅ **Error recovery and resilience**: System failure recovery testing
- ✅ **Performance and load testing**: Concurrent request handling
- ✅ **Concurrent request processing**: Multi-threaded operation validation

#### Running Workflow Tests:
```bash
npm run test:e2e
```

## Running Integration Tests

### Individual Test Suites

```bash
# Claude Desktop integration tests (9 tests)
npm run test:claude-desktop

# VS Code integration tests (11 tests)
npm run test:vscode

# End-to-end workflow tests (7 tests)
npm run test:e2e

# Quick integration validation (Claude + VS Code)
npm run test:quickstart
```

### Complete Integration Test Suite

```bash
# Run all integration tests (27 tests)
npm run test:integration:all

# Full test suite with coverage
npm run test:all
```

### Test Output Example

```
> codesight-mcp@0.1.0 test:integration:all

✓ Claude Desktop Integration Tests (9/9)
✓ VS Code Integration Tests (11/11)
✓ End-to-End Workflows (7/7)

Summary: 27/27 tests passing
Duration: ~82 seconds
```

## Test Environment Setup

### Prerequisites

- Node.js v18+ with TypeScript support
- Rust toolchain (for FFI bridge testing)
- SQLite database (for persistence testing)
- MCP client simulation framework

### Environment Variables

```bash
# Test Configuration
NODE_ENV=test
TEST_DATABASE_URL=sqlite://./test-data/codesight-test.db
RUST_FFI_PATH=../rust-core/target/release
ENABLE_RUST_FFI=true
FFI_GRACEFUL_FALLBACK=true

# Performance Testing
INDEXING_PARALLEL_WORKERS=4
INDEXING_BATCH_SIZE=500
CACHE_SIZE_MB=512

# Logging
LOG_LEVEL=debug
TEST_DEBUG_LOGS=true
```

## Test Performance Metrics

### Current Performance Metrics

| Test Suite | Avg Duration | Success Rate | Memory Usage | Notes |
|-------------|--------------|--------------|--------------|-------|
| Claude Desktop | ~28 seconds | 100% | ~25MB | Full MCP protocol validation |
| VS Code Integration | ~25 seconds | 100% | ~30MB | Workspace analysis simulation |
| E2E Workflows | ~29 seconds | 100% | ~35MB | Real-world scenario testing |

### Performance Benchmarks

**Search Response Times:**
- Average: 20-50ms (with Rust FFI)
- 95th percentile: <100ms
- 99th percentile: <200ms

**Indexing Performance:**
- Small codebase (<1K files): 1-2 seconds
- Medium codebase (1K-10K files): <15 seconds
- Large codebase (10K-100K files): <3 minutes

## Continuous Integration

### CI/CD Integration

The integration tests are integrated into the CI/CD pipeline:

```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests
on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - name: Install dependencies
        run: npm ci
      - name: Build Rust FFI
        run: cd rust-core && cargo build --release
      - name: Run Integration Tests
        run: npm run test:integration:all
      - name: Upload Test Results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

### Quality Gates

**Integration Test Quality Gates:**
- **Pass Rate**: 100% (27/27 tests)
- **Performance**: No regression beyond 10%
- **Memory Usage**: No memory leaks detected
- **Error Handling**: All error scenarios properly handled
- **MCP Compliance**: Full protocol compliance validation

## Troubleshooting

### Common Issues

**Test Failures:**
1. **Database Connection Issues**: Ensure SQLite is accessible
2. **FFI Bridge Problems**: Verify Rust build completed successfully
3. **Port Conflicts**: Check for conflicting MCP server instances
4. **Memory Issues**: Increase available memory for large test suites

**Performance Issues:**
1. **Slow Indexing**: Reduce parallel workers or increase timeout
2. **High Memory Usage**: Optimize batch size and caching settings
3. **Network Timeouts**: Increase timeout for external service calls

### Debug Mode

```bash
# Enable debug logging for integration tests
LOG_LEVEL=debug npm run test:integration:all

# Run tests with detailed output
npm run test:integration:all -- --verbose

# Generate test coverage report
npm run test:coverage
```

## Test Development

### Adding New Integration Tests

1. **Create Test File**: Add to `tests/integration/`
2. **Follow Naming Convention**: `[tool]-integration.test.ts`
3. **Include Setup/Teardown**: Proper resource management
4. **Validate MCP Protocol**: Ensure protocol compliance
5. **Add Performance Metrics**: Measure response times and resource usage

### Test Structure Example

```typescript
// tests/integration/new-tool-integration.test.ts
describe('New Tool Integration Tests', () => {
  let server: MCPServer;
  let testCodebase: TestCodebase;

  beforeEach(async () => {
    server = await createTestServer();
    testCodebase = await createTestCodebase();
  });

  afterEach(async () => {
    await server.stop();
    await testCodebase.cleanup();
  });

  test('should handle new tool functionality', async () => {
    const response = await server.callTool('new_tool', {
      // test parameters
    });

    expect(response.success).toBe(true);
    expect(response.content).toHaveLength.gt(0);
  });
});
```

## Future Enhancements

### Planned Test Improvements

1. **Multi-Platform Testing**: Windows, macOS, Linux validation
2. **Load Testing**: Higher concurrency and sustained load scenarios
3. **Edge Case Testing**: Unusual file types and large codebases
4. **Integration Testing**: Third-party tool integrations
5. **Security Testing**: Vulnerability scanning and penetration testing

### Automation Goals

- **Self-Healing Tests**: Automatic recovery from transient failures
- **Performance Regression Detection**: Automatic performance baseline validation
- **Test Data Management**: Automated test data generation and cleanup
- **Parallel Test Execution**: Optimized test suite runtime

## Conclusion

The CodeSight MCP Server integration testing suite provides comprehensive validation of the entire system with 27/27 tests passing. This ensures production readiness, MCP protocol compliance, and reliable integration with AI assistants and development tools.

### Key Achievements

- ✅ **Complete Coverage**: All MCP tools and integration scenarios tested
- ✅ **Real-World Validation**: Production-like testing conditions
- ✅ **Performance Assurance**: Measured performance metrics and optimization
- ✅ **Error Resilience**: Comprehensive error handling and recovery testing
- ✅ **Multi-Client Support**: Validated integration with Claude Desktop and VS Code

### Next Steps

1. Expand test coverage for additional AI assistant integrations
2. Implement continuous performance monitoring
3. Add automated security testing
4. Enhance load testing capabilities
5. Improve test automation and self-healing capabilities

---

**For more information:**
- [Main Project Documentation](../README.md)
- [MCP Tools Reference](./MCP-TOOLS.md)
- [Development Guide](./development.md)
- [Performance Benchmarks](./performance-benchmarks.md)