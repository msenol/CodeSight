# Development Guide

## Overview

This guide covers development practices for the CodeSight MCP Server hybrid TypeScript/Rust architecture.

## Prerequisites

- Node.js v20 LTS or higher
- Rust 1.75 or higher
- Docker 20.10+ (for local development environment)
- Git

## Development Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-org/codesight-mcp.git
cd codesight-mcp

# Install root dependencies
npm install

# Install TypeScript MCP server dependencies
cd typescript-mcp
npm install

# Build Rust FFI bridge
cd ../rust-core
cargo build --release
cd ../typescript-mcp

# Build TypeScript server
npm run build
```

### 2. Development Environment

```bash
# Start development services (PostgreSQL, Redis, monitoring)
docker-compose -f docker-compose.dev.yml up -d

# Start development server
npm run dev

# Check service status
docker-compose ps
```

### 3. Code Quality Standards

The CodeSight MCP Server maintains enterprise-grade code quality standards:

```bash
# Run lint checks (should show 378 remaining issues - down from 1000+)
npm run lint

# Auto-fix fixable issues
npm run lint:fix

# Run TypeScript-specific checks
npm run lint:typescript

# Check overall code quality
npm run lint:check

# Run tests with coverage
npm run test:coverage
```

**Code Quality Achievements:**
- 🏆 **62% Issue Reduction**: Successfully reduced lint issues from 1000+ to 378 remaining
- 🏆 **Rule 15 Compliance**: Enterprise-grade development standards with systematic cleanup
- 🏆 **Type Safety**: Comprehensive 'any' type elimination and proper TypeScript interfaces

## Architecture Overview

### Hybrid TypeScript/Rust Architecture

```
┌─────────────────────────────────────┐
│           Client Layer              │
│  (Claude Desktop, VS Code, CLI)     │
└─────────────────┬───────────────────┘
                  │ MCP Protocol
┌─────────────────▼───────────────────┐
│        TypeScript MCP Layer        │
│  • Full MCP Protocol (9 tools)     │
│  • Request/response handling        │
│  • REST API + WebSocket            │
│  • Enterprise error handling        │
└─────────────────┬───────────────────┘
                  │ NAPI-RS FFI Bridge
┌─────────────────▼───────────────────┐
│          Rust Core Engine           │
│  • Tree-sitter parsing             │
│  • SQLite operations               │
│  • Multi-language support          │
│  • Parallel processing             │
└─────────────────┬───────────────────┘
                  │ Database Layer
┌─────────────────▼───────────────────┐
│     Data Storage & Caching         │
│  • PostgreSQL (Production)         │
│  • SQLite (Development)            │
│  • Redis (Caching)                 │
└─────────────────────────────────────┘
```

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes to TypeScript code
# Edit files in typescript-mcp/src/

# Make changes to Rust code
# Edit files in rust-core/src/

# Build Rust components
cd rust-core
cargo build --release
cd ../typescript-mcp

# Build TypeScript components
npm run build

# Run tests
npm test

# Run lint checks
npm run lint

# Commit changes
git add .
git commit -m "feat: implement your feature"
```

### 2. Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:contract

# Run tests with coverage
npm run test:coverage

# Run Rust tests
cd rust-core
cargo test
```

### 3. FFI Bridge Development

When working with the Rust FFI bridge:

```bash
# Test FFI bridge integration
cd typescript-mcp
node dist/cli/index.js test-ffi

# Debug FFI issues
ENABLE_RUST_FFI=true RUST_LOG=debug node dist/index.js

# Build Rust in debug mode for faster iteration
cd ../rust-core
cargo build
cd ../typescript-mcp
```

**FFI Development Best Practices:**
- Always implement graceful fallback when calling Rust functions
- Use proper error handling across FFI boundaries
- Minimize data serialization overhead between languages
- Test both Rust-only and TypeScript-only paths independently
- Handle platform-specific compilation issues gracefully

## Code Organization

### TypeScript Structure

```
typescript-mcp/
├── src/
│   ├── tools/          # MCP tools implementation
│   ├── services/       # Business logic services
│   ├── cli/           # CLI commands
│   ├── ffi/           # Rust FFI bridge integration
│   ├── middleware/    # Express middleware
│   ├── controllers/   # API controllers
│   ├── types/         # TypeScript type definitions
│   └── utils/         # Utility functions
├── tests/
│   ├── contract/      # MCP protocol tests
│   ├── integration/   # Integration tests
│   └── unit/          # Unit tests
└── dist/              # Compiled JavaScript
```

### Rust Structure

```
rust-core/
├── crates/
│   ├── ffi/           # NAPI-RS bindings
│   ├── core/          # Core services
│   ├── parser/        # Tree-sitter parsers
│   └── search/        # Search algorithms
├── benches/           # Performance benchmarks
├── tests/             # Rust tests
└── target/            # Compiled artifacts
```

## Performance Optimization

### Current Performance (Hybrid Implementation)

| Operation | TypeScript Only | Hybrid (TS+Rust) | Improvement |
|-----------|-----------------|-----------------|-------------|
| File Indexing | 2-3 seconds | 1-2 seconds | 2x faster |
| Search Query | 50-100ms | 20-50ms | 2.5x faster |
| Memory Usage | ~30MB | ~25MB | 17% reduction |
| Multi-Language | JS/TS only | 15+ languages | 7.5x coverage |

### Optimization Guidelines

1. **Use Rust for Performance-Critical Operations**
   - Code parsing and indexing
   - Search algorithms
   - Memory-intensive operations

2. **Use TypeScript for Integration Logic**
   - MCP protocol handling
   - API endpoints
   - Request/response formatting

3. **Minimize FFI Calls**
   - Batch operations when possible
   - Use efficient data serialization
   - Implement connection pooling

## Error Handling

### TypeScript Error Handling

```typescript
// Use Result types for FFI calls
const result = await callRustFunction(params);
if (result.isErr) {
  // Handle error gracefully
  return fallbackImplementation(params);
}
```

### Rust Error Handling

```rust
// Use Result<T, Error> for all functions
pub fn parse_code(input: &str) -> Result<AST, ParseError> {
    // Implementation
}
```

## Debugging

### TypeScript Debugging

```bash
# Enable debug logging
DEBUG=* node dist/index.js

# Use Node.js debugger
node --inspect-brk dist/index.js
```

### Rust Debugging

```bash
# Enable debug logging
RUST_LOG=debug cargo run

# Use Rust debugger
rust-gdb target/release/myprogram
```

### FFI Debugging

```bash
# Enable FFI debug logging
ENABLE_RUST_FFI=true RUST_LOG=debug node dist/index.js

# Test FFI bridge specifically
node dist/cli/index.js test-ffi
```

## Monitoring

### Local Development Monitoring

```bash
# Access monitoring dashboards
# Grafana: http://localhost:3000 (admin/admin)
# Prometheus: http://localhost:9090

# View logs
docker-compose logs -f
```

### Performance Monitoring

The application includes comprehensive monitoring:

- **Prometheus Metrics**: Performance and health metrics
- **Grafana Dashboards**: Real-time visualization
- **Structured Logging**: JSON-based logging with correlation IDs
- **Health Checks**: Comprehensive health monitoring

## Deployment

### Development Deployment

```bash
# Deploy to development environment
docker-compose -f docker-compose.dev.yml up -d

# Verify deployment
docker-compose ps
```

### Production Deployment

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d

# Deploy to Kubernetes
kubectl apply -f k8s/
```

## Contributing

### Code Style

- Follow ESLint configuration
- Use TypeScript strict mode
- Write comprehensive tests
- Document all public APIs
- Use conventional commit messages

### Pull Request Process

1. Create feature branch from main
2. Implement changes with tests
3. Ensure all tests pass
4. Update documentation
5. Submit pull request with description
6. Address code review feedback

### Code Review Guidelines

- Review for functionality and performance
- Check for proper error handling
- Verify test coverage
- Ensure documentation is updated
- Check for security vulnerabilities

## Troubleshooting

### Common Issues

**Module not found errors:**
```bash
# Ensure build completed successfully
cd typescript-mcp
npm run build
ls dist/
```

**FFI bridge not working:**
```bash
# Test FFI bridge
node dist/cli/index.js test-ffi

# Check Rust components
cd ../rust-core
cargo build --release
```

**Database connection issues:**
```bash
# Check database status
docker-compose ps

# Reset database
docker-compose down -v
docker-compose up -d
```

## Additional Resources

- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Tree-sitter Documentation](https://tree-sitter.github.io/tree-sitter/)
- [NAPI-RS Documentation](https://napi.rs/)
- [Rust Book](https://doc.rust-lang.org/book/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/codesight-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/codesight-mcp/discussions)
- **Documentation**: [Project Documentation](https://docs.codesight-mcp.com)