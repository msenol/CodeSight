# Code Intelligence MCP Server

[![Version](https://img.shields.io/badge/version-v0.1.0--dev-blue)](https://github.com/yourusername/code-intelligence-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![Rust Version](https://img.shields.io/badge/rust-%3E%3D1.75-orange)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue)](https://www.typescriptlang.org/)

A high-performance Code Intelligence MCP Server that enables AI assistants to understand and query codebases through natural language. Supports 15+ programming languages, handles monorepos with 100K+ files, and operates fully offline.

## 🚀 Features

- **Natural Language Queries**: Search and analyze code using plain English
- **Multi-Language Support**: 15+ programming languages via Tree-sitter
- **High Performance**: Rust core engine with TypeScript MCP interface
- **Offline Operation**: Local LLM support with Ollama/llama.cpp
- **Scalable Architecture**: From small projects to large monorepos
- **MCP Protocol**: Seamless integration with AI assistants
- **Privacy-First**: Zero telemetry, local processing by default

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   AI Assistants │────│  MCP Protocol    │────│  TypeScript MCP │
│   (Claude, etc) │    │  Layer           │    │  Server         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         │ FFI Bridge
                                                         │ (Napi-rs)
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Tree-sitter   │────│  Rust Core       │────│  Tantivy Search │
│   Parsing       │    │  Engine          │    │  Index          │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Storage Layer  │
                       │  SQLite/PgSQL   │
                       └─────────────────┘
```

## 📋 Prerequisites

- **Node.js**: v20 LTS or higher
- **Rust**: 1.75 or higher
- **System Requirements**:
  - Memory: 4GB RAM minimum, 8GB recommended
  - Storage: 2GB free space
  - OS: Linux, macOS, or Windows

## Installation

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-org/code-intelligence-mcp.git
cd code-intelligence-mcp

# Start with Docker Compose
docker-compose up -d

# Check status
docker-compose ps
```

### Option 2: Local Development

```bash
# Install dependencies
npm install

# Build Rust core
cd rust-core
cargo build --release
cd ..

# Build TypeScript MCP
cd typescript-mcp
npm install
npm run build
cd ..

# Start the server
npm run dev
```

## 🚀 Quick Start

### 1. Start the MCP Server

```bash
# Run in MCP mode (stdio)
npm run start:mcp

# Or run in REST API mode
npm run start:rest

# Or run both (hybrid mode)
npm run start:hybrid
```

### 2. Connect with AI Assistant

For Claude Desktop integration, add to your config:

```json
{
  "mcpServers": {
    "code-intelligence": {
      "command": "node",
      "args": ["./typescript-mcp/dist/index.js", "mcp"]
    }
  }
}
```

### 3. Available MCP Tools

The server exposes these tools for AI assistants:

- `search_code`: Natural language code search across the codebase
- `explain_function`: Explain what a specific function does
- `find_references`: Find all references to a symbol
- `trace_data_flow`: Trace data flow through the code
- `analyze_security`: Analyze code for security vulnerabilities
- `get_api_endpoints`: List all API endpoints in the codebase
- `check_complexity`: Analyze code complexity metrics
- `find_duplicates`: Detect duplicate code patterns
- `suggest_refactoring`: Provide refactoring suggestions

## 🔧 Configuration

### Environment Variables

```bash
# Server Configuration
PORT=4000
HOST=0.0.0.0
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/code_intelligence
REDIS_URL=redis://localhost:6379

# LLM Configuration
LLM_PROVIDER=ollama
LLM_MODEL=codellama:7b
LLM_ENDPOINT=http://localhost:11434

# Performance
INDEXING_PARALLEL_WORKERS=4
INDEXING_BATCH_SIZE=500
CACHE_SIZE_MB=512
```

## 📊 Performance Targets

| Project Size | Indexing Time | Query Response |
|--------------|---------------|----------------|
| Small (<1K files) | <5 seconds | <50ms |
| Medium (1K-10K files) | <30 seconds | <100ms |
| Large (10K-100K files) | <5 minutes | <200ms |
| Monorepos (>100K files) | <20 minutes | <500ms |

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:contract

# Run with coverage
npm run test:coverage
```

## 🏛️ Project Structure

```
ProjectAra/
├── typescript-mcp/     # TypeScript MCP server
│   ├── src/
│   │   ├── tools/     # MCP tool implementations
│   │   ├── services/  # Core services
│   │   └── ffi/       # Rust FFI bridge
│   └── tests/
│       └── contract/  # MCP contract tests
├── rust-core/         # Rust core engine
│   ├── crates/
│   │   ├── core/      # Core models and services
│   │   ├── parser/    # Tree-sitter parsing
│   │   ├── indexer/   # Code indexing
│   │   ├── search/    # Search implementation
│   │   └── storage/   # Database layer
│   └── benches/       # Performance benchmarks
├── api/               # REST API server
├── src/               # React frontend
└── docs/              # Documentation

- [Quick Start Guide](./specs/001-code-ntelligence-mcp/quickstart.md)
- [Technical Architecture](./specs/001-code-ntelligence-mcp/technical-architecture.md)
- [API Documentation](./specs/001-code-ntelligence-mcp/contracts/)
- [Development Guide](./docs/development.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone and setup
git clone https://github.com/your-org/code-intelligence-mcp.git
cd code-intelligence-mcp
npm install

# Start development environment
docker-compose -f docker-compose.dev.yml up -d
npm run dev
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Tree-sitter](https://tree-sitter.github.io/) for language parsing
- [Tantivy](https://github.com/quickwit-oss/tantivy) for search indexing
- [Model Context Protocol](https://modelcontextprotocol.io/) for AI integration
- [Ollama](https://ollama.ai/) for local LLM support

## 📞 Support

- [GitHub Issues](https://github.com/your-org/code-intelligence-mcp/issues)
- [Documentation](https://docs.code-intelligence-mcp.com)
- [Community Discord](https://discord.gg/code-intelligence)

---

**Built with ❤️ for developers who value privacy and performance**
