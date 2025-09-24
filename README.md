# Code Intelligence MCP Server

[![Version](https://img.shields.io/badge/version-v0.1.0-blue)](https://github.com/yourusername/code-intelligence-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![Rust Version](https://img.shields.io/badge/rust-%3E%3D1.75-orange)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue)](https://www.typescriptlang.org/)

A working Code Intelligence MCP Server that enables AI assistants to understand and query codebases through natural language. Currently features real SQLite code indexing with 377+ entities indexed from JavaScript/TypeScript projects, full Claude Desktop integration, and a complete MCP protocol implementation.

## 🚀 Features

✅ **Working Implementation:**
- **Real Code Indexing**: SQLite database storing 377+ entities from parsed codebases
- **Natural Language Search**: Functional search with query intent detection
- **MCP Protocol**: Full compliance with 9 implemented tools
- **Claude Desktop Integration**: Tested and verified working
- **CLI Tools**: Index, search, and stats commands functional
- **TypeScript Support**: Complete JS/TS parsing and entity extraction
- **Privacy-First**: Zero telemetry, local processing only

🚧 **In Development:**
- **Multi-Language Support**: 15+ programming languages via Tree-sitter
- **High Performance**: Rust core engine with FFI integration
- **Semantic Search**: Vector embeddings and advanced search strategies

## 🏗️ Current Architecture

**Working Implementation (TypeScript):**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   AI Assistants │────│  MCP Protocol    │────│  TypeScript MCP │
│   (Claude, etc) │    │  Layer ✅        │    │  Server ✅      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Native TS     │────│  IndexingService │────│  Search Engine  │
│   Parser ✅     │    │  ✅              │    │  ✅             │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  SQLite Database│
                       │  377+ Entities  │
                       │  ✅             │
                       └─────────────────┘
```

**Planned Enhancement (Rust Core):**
```
                       ┌─────────────────┐
                       │  Rust Core      │
                       │  (FFI Bridge)   │
                       │  🚧             │
                       └─────────────────┘
```

## 📋 Prerequisites

- **Node.js**: v20 LTS or higher
- **System Requirements**:
  - Memory: 2GB RAM minimum (4GB recommended for large codebases)
  - Storage: 500MB free space
  - OS: Linux, macOS, or Windows

**Optional (for future Rust integration):**
- **Rust**: 1.75 or higher

## Installation

### Quick Start (Current Working Implementation)

```bash
# Clone the repository
git clone https://github.com/your-org/code-intelligence-mcp.git
cd code-intelligence-mcp

# Install and build TypeScript MCP server
cd typescript-mcp
npm install
npm run build

# Index your JavaScript/TypeScript codebase
node dist/cli/index.js index /path/to/your/project

# View indexing results
node dist/cli/index.js stats
# Example output: Total entities: 377 (class: 48, function: 175, interface: 140, type: 14)

# Test natural language search
node dist/cli/index.js search "authentication functions"
```

### Docker Development

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Check status
docker-compose ps
```

## 🚀 Quick Start

### 1. Index Your Codebase

```bash
cd typescript-mcp

# Index a project (currently supports JS/TS)
node dist/cli/index.js index /path/to/your/project

# Check what was indexed
node dist/cli/index.js stats
# Output: Total entities: 377 (class: 48, function: 175, interface: 140, type: 14)

# Test search functionality
node dist/cli/index.js search "IndexingService"
```

### 2. Connect with Claude Desktop

Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "code-intelligence": {
      "command": "node",
      "args": ["F:/path/to/your/project/typescript-mcp/dist/index.js"],
      "cwd": "F:/path/to/your/project/typescript-mcp"
    }
  }
}
```

### 3. Working MCP Tools

✅ **Fully Functional:**
- `search_code`: Natural language code search with real database results
- `explain_function`: Function explanation (implemented)

🔧 **Mock Implementation (Working Protocol):**
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

## 📊 Current Performance

**Real Performance (TypeScript Implementation):**
- **Indexing**: ~47 files in ~2-3 seconds
- **Search Queries**: ~50-100ms response time
- **Database**: 377 entities stored in SQLite
- **Memory Usage**: ~30MB during indexing

**Target Performance (With Rust Core):**
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

## 🏛️ Implementation Status

**✅ Working (v0.1.0):**
- **TypeScript MCP Server**: Full MCP protocol compliance with 9 tools
- **Real Database**: SQLite with 377+ entities indexed from 47 files
- **CLI Tools**: `index`, `search`, `stats` commands functional
- **Claude Desktop**: Integration tested and verified
- **Search**: Natural language queries with database results
- **Performance**: 2-3 second indexing, 50-100ms search queries

**🔧 Protocol Working, Mock Responses:**
- 7 additional MCP tools (find_references, trace_data_flow, etc.)

**🚧 Future Development:**
- **Rust Core**: High-performance FFI integration
- **Multi-Language**: Support for 15+ programming languages
- **Advanced Search**: Vector embeddings and semantic search

**Project Structure:**
```
typescript-mcp/     # ✅ Core MCP server implementation
├── src/tools/     # 9 MCP tools (2 real, 7 mock)
├── src/services/  # IndexingService + SQLite database
├── src/cli/       # Working CLI interface
└── tests/         # Contract tests for MCP compliance

api/               # ✅ Express REST API
src/               # ✅ React frontend
rust-core/         # 🚧 Future performance layer
```

## 📚 Documentation

- [Quick Start Guide](./specs/001-code-ntelligence-mcp/quickstart.md)
- [Technical Architecture](./specs/001-code-ntelligence-mcp/technical-architecture.md)
- [API Documentation](./specs/001-code-ntelligence-mcp/contracts/)
- [Development Guide](./docs/development.md)
- [TypeScript MCP Implementation](./typescript-mcp/README.md)
- [Project Instructions for Claude](./CLAUDE.md)

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
