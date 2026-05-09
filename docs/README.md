# CodeSight MCP Server Documentation

## Overview

Welcome to the comprehensive documentation for the CodeSight MCP Server - an enterprise-grade code intelligence platform with hybrid TypeScript/Rust architecture.

**Current Version**: v0.1.1 (Production Ready — Phase 5 Complete)
**Architecture**: Hybrid TypeScript + Rust with NAPI-RS FFI Bridge
**Code Quality**: Enterprise-grade with 95% TypeScript error reduction and zero ESLint errors
**Integration Testing**: 10/10 MCP tools verified via stdio transport
**Rust Compute Layer**: Parser, Indexer, Analyzer, Embedding crates
**AI Tools**: 5 AI-powered tools with OpenRouter integration
**ONNX Embeddings**: Real 384-dim vectors via `all-MiniLM-L6-v2` (~23MB model)
**Docker Testing**: Comprehensive real-project testing with automated workflows

## Quick Links

### 🚀 Getting Started

- [Installation Guide](./configuration.md) - Complete setup instructions
- [Interactive CLI Setup](./cli-setup.md) - Guided configuration wizard (New in Phase 3.5)
- [Development Guide](./development.md) - Development workflow and practices

### 🏗️ Architecture & Design

- [Architecture Overview](./adrs/0001-hybrid-architecture.md) - Hybrid TypeScript/Rust architecture
- [Rust FFI Bridge](./rust-ffi-bridge.md) - NAPI-RS integration details
- [Performance Benchmarks](./PERFORMANCE-BENCHMARKING.md) - Comprehensive performance analysis and benchmarking
- [Getting Started Guide](./GETTING-STARTED.md) - Complete setup and testing framework guide

### 📊 Monitoring & Observability (New in Phase 3.5)

- [Monitoring Guide](./monitoring/README.md) - Comprehensive monitoring setup
- [Prometheus Metrics](./monitoring/prometheus.md) - Metrics collection and configuration
- [OpenTelemetry Tracing](./monitoring/tracing.md) - Distributed tracing setup

### 🧪 Testing & Quality Assurance

- [MCP Tools Documentation](./MCP-TOOLS.md) - Complete MCP protocol tools reference with comprehensive testing framework
- [API Documentation](./API.md) - REST API endpoints with contract testing (T018-T028)
- [Performance Benchmarking](./PERFORMANCE-BENCHMARKING.md) - Performance testing suites (T084-T088)
- [Getting Started Guide](./GETTING-STARTED.md) - Complete setup and testing framework guide
- [API Contract Specifications](./api/openapi.yaml) - OpenAPI specifications
- [Postman Collection](./testing/postman/README.md) - API testing collection

### 🤖 AI Tools (Phase 4.1)

- [AI Tools Documentation](./AI_TOOLS.md) - 5 AI-powered tools with OpenRouter integration
- AI Code Review, Bug Prediction, Context-Aware Code Generation, Intelligent Refactoring, Technical Debt Analysis

### 🔧 API & Integration

- [OpenAPI Specification](./api/openapi.yaml) - Complete API specification (Phase 3.5)

### 📦 Deployment & Operations

- [Configuration Guide](./configuration.md) - Environment setup and configuration
- [Development Documentation](../typescript-mcp/README.md) - TypeScript MCP server details

### 📊 Project Specifications

- [MCP Tools Documentation](./MCP-TOOLS.md) - Complete MCP protocol tools reference
- [Architecture Decision Records](./adrs/) - Design decisions and rationale

## Documentation Structure

```
docs/
├── README.md                    # This file - documentation index
├── MCP-TOOLS.md                 # MCP protocol tools reference
├── configuration.md             # Configuration and deployment guide
├── cli-setup.md                 # Interactive CLI setup guide (Phase 3.5)
├── rust-ffi-bridge.md           # Rust FFI bridge documentation
├── CHANGELOG.md                 # Version history and changes
├── adrs/                        # Architecture Decision Records
│   ├── 0001-hybrid-architecture.md
│   └── 0002-tree-sitter-parsing.md
├── monitoring/                  # Monitoring & observability (Phase 3.5)
│   ├── README.md                # Comprehensive monitoring guide
│   ├── prometheus.md            # Prometheus metrics documentation
│   ├── tracing.md               # OpenTelemetry tracing setup
│   └── grafana/                 # Grafana dashboards
│       ├── codesight-overview.json
│       └── codesight-database.json
├── api/                         # API reference documentation
│   └── openapi.yaml             # OpenAPI 3.0 specification
└── testing/                     # Testing documentation
    └── postman/                 # API testing collection
        └── README.md
```

## Key Features & Achievements

### ✅ Production-Ready Features (v0.1.1)

**Core Functionality:**

- **Hybrid Architecture**: TypeScript + Rust with NAPI-RS FFI bridge
- **Real Code Indexing**: SQLite database with 377+ entities indexed
- **MCP Protocol**: Full compliance with 16 implemented tools (11 core + 5 AI-powered)
- **Multi-Language Support**: 8 programming languages with Tree-sitter
- **Performance Optimized**: ~123ms indexing (73 files), ~4ms search queries

**Enterprise Features:**

- **CI/CD Pipelines**: 7 GitHub Actions workflows with comprehensive testing
- **Production Docker**: Complete containerization with PostgreSQL, Redis, monitoring
- **Professional Tooling**: Unified ESLint, TypeScript configs, security scanning
- **Monitoring**: Prometheus metrics, Grafana dashboards, structured logging
- **Advanced Observability**: OpenTelemetry tracing, distributed system monitoring (Phase 3.5)
- **Interactive CLI**: Guided setup wizard with progress tracking and error handling (Phase 3.5)

**Code Quality Excellence:**

- 🏆 **62% Lint Improvement**: Reduced issues from 1000+ to 378 remaining
- 🏆 **Rule 15 Compliance**: Enterprise-grade development standards
- 🏆 **Type Safety Enhanced**: Comprehensive 'any' type elimination

### 🔧 MCP Tools Implementation (16 Tools — 100% Functional)

**Rust-Backed Core Tools (11):**
- `search_code`: SQLite-backed keyword search via Rust
- `index_codebase`: Parallel indexing with SQLite persistence (Rust)
- `explain_function`: Function explanation with codebase lookup
- `find_references`: Symbol reference finding
- `trace_data_flow`: Data flow analysis
- `analyze_security`: Security vulnerability detection
- `get_api_endpoints`: API endpoint discovery
- `check_complexity`: AST-based complexity analysis (Rust)
- `find_duplicates`: Rabin-Karp rolling hash detection (Rust)
- `suggest_refactoring`: Refactoring recommendations
- `analyze_codebase_complexity`: System-wide complexity analysis

**AI-Powered Tools (5):**
- `ai_code_review`: AI-powered code review
- `bug_prediction`: Proactive bug prediction
- `context_aware_code_generation`: Context-aware code generation
- `intelligent_refactoring`: AI-driven refactoring
- `technical_debt_analysis`: Technical debt assessment

## Performance Benchmarks

**Current Hybrid Implementation (TypeScript + Rust):**

| Operation | Performance | Improvement |
|-----------|-------------|-------------|
| File Indexing | ~123ms (73 files, 3K entities) | ~24x faster |
| Search Query | ~4ms (SQLite LIKE) | ~125x faster |
| Complexity Analysis | ~2ms | ~25x faster |
| Duplicate Detection | O(n) Rabin-Karp | scalable |
| Memory Usage | ~25MB during indexing | 17% reduction |

**Performance Scaling:**

| Project Size | Indexing Time | Query Response | Memory Usage |
|--------------|---------------|----------------|--------------|
| Small (<1K files) | <2 seconds | <20ms | <50MB |
| Medium (1K-10K files) | <15 seconds | <50ms | <200MB |
| Large (10K-100K files) | <3 minutes | <100ms | <1GB |
| Monorepos (>100K files) | <15 minutes | <250ms | <4GB |

## Getting Help

### Documentation Search

Use the search functionality in your documentation viewer to find specific topics.

### Community Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/your-org/codesight-mcp/issues)
- **GitHub Discussions**: [Community discussions and Q&A](https://github.com/your-org/codesight-mcp/discussions)
- **Discord Server**: [Real-time chat and support](https://discord.gg/codesight)

### Professional Support

- **Email**: <support@codesight-mcp.com>
- **Documentation Portal**: [https://docs.codesight-mcp.com](https://docs.codesight-mcp.com)

## Contributing to Documentation

### Documentation Standards

- **English Only**: All documentation must be in English (non-negotiable requirement)
- **Enterprise Quality**: Maintain professional, clear, and comprehensive documentation
- **Consistency**: Follow established patterns and formatting
- **Accuracy**: Ensure all technical details are current and verified

### Making Changes

1. Identify the appropriate documentation file
2. Make changes following the existing style
3. Test all links and references
4. Update this index if adding new sections
5. Submit pull requests with clear descriptions

### Documentation Maintenance

See [Documentation Maintenance Guide](./development/documentation-maintenance-guide.md) for detailed guidelines on maintaining and updating documentation.

## Version Information

- **Current Version**: v0.1.1
- **Documentation Last Updated**: April 21, 2026
- **Compatible CodeSight Versions**: v0.1.x
- **Documentation Format**: Markdown with enterprise-grade structure

---

**Built with ❤️ for developers who value comprehensive documentation and enterprise-grade code intelligence**

[⭐ Star this project](https://github.com/your-org/codesight-mcp) if you find the documentation helpful!
