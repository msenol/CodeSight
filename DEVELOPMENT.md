# CodeSight MCP Development Guide

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ (recommend 20)
- **Rust** 1.75+ with cargo
- **PostgreSQL** 16+ (optional, for production testing)
- **Redis** 7+ (optional, for production testing)

### Installation & Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd CodeSight

# 2. Install Node.js dependencies
npm install
cd typescript-mcp && npm install && cd ..

# 3. Install and setup Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

# 4. Build the project
cd typescript-mcp
source "$HOME/.cargo/env"
npm run build:full

# 5. Test the installation
node dist/health-check-cli.js
node dist/cli/index.js --help
```

## 🏗️ Project Structure

```
CodeSight/
├── typescript-mcp/          # TypeScript MCP Server
│   ├── src/                # Source code
│   ├── dist/               # Build output
│   ├── tests/              # Test suites
│   └── package.json        # Dependencies
├── rust-core/              # Rust FFI Bridge
│   ├── crates/             # Rust crates
│   ├── src/                # Source code
│   └── Cargo.toml          # Rust dependencies
├── scripts/                # Utility scripts
├── docker/                 # Docker configurations
├── docs/                   # Documentation
└── tests/                  # Integration tests
```

## 🔧 Development Workflow

### 1. TypeScript Development

```bash
# Development mode with hot reload
cd typescript-mcp
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Testing
npm test

# Building
npm run build
```

### 2. Rust Development

```bash
# Development build
cd rust-core
cargo build

# Release build
cargo build --release

# Testing
cargo test

# Linting
cargo clippy --all-targets --all-features -- -D warnings

# Formatting
cargo fmt

# Benchmarking
cargo bench
```

### 3. Full Integration Development

```bash
# Build both TypeScript and Rust
cd typescript-mcp
source "$HOME/.cargo/env"
npm run build:full

# Test integration
npm run test:contract
npm run test:integration
```

## 🧪 Testing

### Unit Tests
```bash
# TypeScript tests
cd typescript-mcp && npm test

# Rust tests
cd rust-core && cargo test
```

### Integration Tests
```bash
# Contract tests (MCP protocol compliance)
cd typescript-mcp && npm run test:contract

# Integration scenarios
npm run test:integration

# Performance benchmarks
npm run test:benchmark
```

### Manual Testing
```bash
# Test MCP server manually
cd typescript-mcp
node dist/cli/index.js index ./test-data
node dist/cli/index.js search "function"
node dist/cli/index.js stats

# Test health endpoints
node dist/health-check-cli.js
```

## 🐳 Docker Development (Optional)

### Development Environment
```bash
# Use the setup script (requires Docker and Docker Compose)
./scripts/dev-setup.sh

# Manual Docker setup
docker-compose -f docker-compose.dev.yml up -d
docker-compose -f docker-compose.dev.yml logs -f
```

### Docker Services
- **MCP Server**: http://localhost:4000
- **WebSocket**: ws://localhost:8080
- **PostgreSQL**: localhost:5433
- **Redis**: localhost:6380
- **pgAdmin**: http://localhost:5050
- **Redis Commander**: http://localhost:8081

## 🔍 Code Architecture

### TypeScript MCP Server
- **CLI Tools**: Command-line interface for code analysis
- **MCP Protocol**: Model Context Protocol implementation
- **REST API**: HTTP endpoints for external integration
- **WebSocket**: Real-time communication
- **Rust Bridge**: FFI integration with Rust core

### Rust Core Engine
- **Parser**: Multi-language Tree-sitter parsing
- **Indexer**: SQLite database operations
- **Search**: Full-text search and relevance scoring
- **Cache**: Redis-based caching layer
- **FFI**: Node.js native bindings

## 📊 Performance Optimization

### Development Performance
1. **TypeScript**: Use `npm run dev` for hot reload
2. **Rust**: Use `cargo check` for fast compilation checking
3. **Database**: Use in-memory SQLite for development
4. **Caching**: Enable local file system cache

### Production Performance
1. **Rust Release**: Always use `--release` builds
2. **Database**: Use PostgreSQL with proper indexes
3. **Caching**: Enable Redis with appropriate TTL
4. **Monitoring**: Use Prometheus + Grafana

## 🛠️ Debugging

### TypeScript Debugging
```bash
# Debug with Node.js inspector
cd typescript-mcp
node --inspect-brk dist/index.js

# Debug tests
node --inspect-brk node_modules/.bin/vitest run
```

### Rust Debugging
```bash
# Debug with GDB
cd rust-core
cargo build
gdb target/debug/codesight-core

# Debug tests
cargo test -- --nocapture
```

### Integration Debugging
```bash
# Enable debug logging
export LOG_LEVEL=debug
export RUST_LOG=debug

# Run with verbose output
cd typescript-mcp
node dist/cli/index.js --verbose index ./test-data
```

## 📝 MCP Tools Development

### Adding New MCP Tools
1. **Implement Tool Logic** (TypeScript):
   ```typescript
   // src/tools/new-tool.ts
   export async function handleNewTool(params: ToolParams): Promise<ToolResult> {
     // Implementation
   }
   ```

2. **Register Tool**:
   ```typescript
   // src/index.ts
   server.setRequestHandler('tools/call', async (request) => {
     if (request.params.name === 'new_tool') {
       return await handleNewTool(request.params.arguments);
     }
   });
   ```

3. **Add Tests**:
   ```typescript
   // tests/contract/new-tool.test.ts
   describe('new_tool', () => {
     it('should handle new tool requests', async () => {
       // Test implementation
     });
   });
   ```

## 🔐 Security Development

### Development Security
- Use development-only secrets (see `.env.dev`)
- Enable all security features in development
- Test with various authentication scenarios

### Security Testing
```bash
# Run security audits
npm audit
cd rust-core && cargo audit

# Test authentication flows
curl -H "Authorization: Bearer <token>" http://localhost:4000/api/secure
```

## 📈 Monitoring & Observability

### Development Monitoring
```bash
# Enable metrics collection
export ENABLE_METRICS=true
export METRICS_PORT=9090

# View metrics
curl http://localhost:9090/metrics
```

### Health Checks
```bash
# Basic health check
curl http://localhost:4000/health

# Detailed health check
curl http://localhost:4000/health/detailed
```

## 🚀 Deployment Preparation

### Pre-deployment Checklist
1. **Build**: `npm run build:full`
2. **Test**: `npm run test:all`
3. **Lint**: `npm run lint && cd rust-core && cargo clippy`
4. **Security**: `npm audit && cd rust-core && cargo audit`
5. **Documentation**: Update README and API docs

### Environment Configuration
```bash
# Production environment variables
export NODE_ENV=production
export DATABASE_URL=postgresql://user:pass@host:5432/db
export REDIS_URL=redis://host:6379
export JWT_SECRET=<secure-secret>
export API_KEY=<secure-key>
```

## 🤝 Contributing

### Code Style
- **TypeScript**: ESLint + Prettier configuration
- **Rust**: rustfmt + clippy configuration
- **Commits**: Conventional commit messages

### Submitting Changes
1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Make changes and test: `npm run ci`
4. Submit pull request with description

## 🆘 Troubleshooting

### Common Issues
1. **Build Failures**:
   - Clear caches: `npm cache clean --force`, `cargo clean`
   - Update dependencies: `npm update`, `cargo update`

2. **Rust FFI Issues**:
   - Check Rust toolchain: `rustc --version`
   - Rebuild Rust: `cargo build --release`

3. **Database Issues**:
   - Check connection: `psql $DATABASE_URL`
   - Reset database: `npm run db:reset`

4. **Performance Issues**:
   - Enable profiling: `export ENABLE_PROFILING=true`
   - Check memory usage: `node --inspect dist/index.js`

### Getting Help
- Check logs: `tail -f logs/app.log`
- Review documentation in `/docs`
- Open issue on GitHub with detailed description

## 📚 Additional Resources

- **MCP Protocol**: [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- **Tree-sitter**: [Tree-sitter Documentation](https://tree-sitter.github.io/)
- **NAPI-RS**: [NAPI-RS Guide](https://napi.rs/)
- **SQLite**: [SQLite Documentation](https://sqlite.org/docs.html)
- **PostgreSQL**: [PostgreSQL Docs](https://www.postgresql.org/docs/)
- **Redis**: [Redis Documentation](https://redis.io/documentation)