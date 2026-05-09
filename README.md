# CodeSight MCP Server

[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/msenol/CodeSight/ci.yml?branch=main)](https://github.com/msenol/CodeSight/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![Rust Version](https://img.shields.io/badge/rust-%3E%3D1.75-orange)](https://www.rust-lang.org/)

> AI-powered code intelligence for your IDE. Index any codebase, then ask questions about it in natural language via Claude, Cursor, VS Code, or any MCP client.

**16 tools** — search, explain, trace data flow, find duplicates, analyze security, check complexity, AI code review, bug prediction, and more.

**8 languages** — JavaScript, TypeScript, Python, Rust, Go, Java, C/C++, Ruby.

---

## Install

**Prerequisites**: [Node.js](https://nodejs.org/) v20+ and [Rust](https://www.rust-lang.org/) 1.75+

```bash
git clone https://github.com/msenol/CodeSight.git
cd CodeSight
npm run setup
```

`npm run setup` installs dependencies, compiles the Rust native module, and builds TypeScript.

---

## Use with Your IDE

### Claude Desktop

Edit `claude_desktop_config.json`:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

### VS Code (Continue)

Edit `~/.continue/config.json`:

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

### VS Code (Cline)

Add in Cline MCP settings:

```json
{
  "codesight": {
    "command": "node",
    "args": ["/path/to/CodeSight/typescript-mcp/dist/index.js"]
  }
}
```

### Cursor

Edit `~/.cursor/mcp.json`:

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

### Windsurf

Edit `~/.codeium/windsurf/mcp_config.json`:

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

### Zed

Edit `~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "codesight": {
      "command": "node",
      "args": ["/path/to/CodeSight/typescript-mcp/dist/index.js"]
    }
  }
}
```

Restart your IDE after editing the config.

---

## Index Your Project

```bash
cd typescript-mcp

# Index
node dist/cli/index.js index /path/to/your/project

# Check stats
node dist/cli/index.js stats
```

Then ask your AI assistant anything about your code.

---

## What Can You Ask?

### Navigate Code

| Ask | What happens |
|-----|--------------|
| "Show me all authentication functions" | Searches your codebase for auth-related functions |
| "What does `validateToken` do?" | Explains the function with context from your code |
| "Where is `UserService` used?" | Finds all references across files |
| "Trace the data flow of `userId`" | Shows how the variable moves through your code |
| "List all API endpoints" | Discovers Express/Fastify/NestJS routes |

### Check Quality

| Ask | What happens |
|-----|--------------|
| "What's the complexity of this module?" | Cyclomatic + cognitive complexity analysis |
| "Find duplicate code patterns" | Detects copy-pasted code blocks |
| "Suggest refactoring for this file" | Actionable improvement suggestions |
| "Analyze the entire codebase complexity" | System-wide complexity report |

### Security

| Ask | What happens |
|-----|--------------|
| "Check for security vulnerabilities" | Scans for SQL injection, XSS, hardcoded secrets |
| "Are there any SQL injection risks?" | Targeted security analysis |

### AI-Powered (requires API key)

| Ask | What happens |
|-----|--------------|
| "Review this code for quality issues" | AI code review with scoring |
| "Predict potential bugs in this module" | ML-enhanced bug prediction |
| "Generate a REST endpoint for users" | Context-aware code generation |
| "How can I refactor this service?" | AI-driven refactoring recommendations |
| "What's our technical debt?" | Technical debt assessment with ROI |

---

## MCP Tools (16)

### Core Tools (11) — backed by Rust

| Tool | Description |
|------|-------------|
| `search_code` | Natural language search (~4ms via SQLite) |
| `explain_function` | Function explanation with codebase context |
| `find_references` | Cross-file symbol reference finding |
| `trace_data_flow` | Variable data flow tracing |
| `analyze_security` | Security vulnerability detection |
| `get_api_endpoints` | API endpoint discovery |
| `check_complexity` | AST-based complexity analysis |
| `find_duplicates` | Rabin-Karp duplicate detection |
| `suggest_refactoring` | Refactoring recommendations |
| `index_codebase` | Parallel indexing with SQLite persistence |
| `analyze_codebase_complexity` | System-wide complexity analysis |

### AI Tools (5)

| Tool | Description |
|------|-------------|
| `ai_code_review` | AI-powered code review with quality scoring |
| `intelligent_refactoring` | AI-driven refactoring recommendations |
| `bug_prediction` | Proactive bug prediction and risk assessment |
| `context_aware_code_generation` | Code generation with project context |
| `technical_debt_analysis` | Technical debt assessment with prioritization |

---

## CLI

```bash
cd typescript-mcp

node dist/cli/index.js index <path>        # Index a codebase
node dist/cli/index.js search <query>      # Search code
node dist/cli/index.js stats               # Show statistics
node dist/cli/index.js server              # Start MCP server (stdio)
```

---

## AI Features

AI tools require an API key. Add to `typescript-mcp/.env`:

```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=xiaomi/mimo-v2-flash:free
```

Get a free key at [openrouter.ai/keys](https://openrouter.ai/keys).

**Supported providers**: OpenRouter (100+ models), Anthropic, OpenAI, Ollama (local).

If no key is set, CodeSight falls back to rule-based analysis — everything still works, just without AI.

---

## REST API

CodeSight also runs as an HTTP server (port 4000):

```bash
# Start
cd typescript-mcp && node dist/index.js

# Search
curl -X POST http://localhost:4000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "authentication"}'

# Index
curl -X POST http://localhost:4000/api/index \
  -H "Content-Type: application/json" \
  -d '{"path": "/path/to/project"}'

# Health
curl http://localhost:4000/health

# Call any MCP tool
curl -X POST http://localhost:4000/mcp/call \
  -H "Content-Type: application/json" \
  -d '{"tool": "check_complexity", "args": {"file_path": "src/index.ts"}}'
```

---

## Docker

```bash
# Production (PostgreSQL + Redis)
docker-compose up -d

# Development (hot reload)
docker-compose -f docker-compose.dev.yml up -d

# Check status
docker-compose ps
```

| Service | Port | Purpose |
|---------|------|---------|
| code-intelligence | 4000, 8080 | MCP Server + REST API |
| postgres | 5432 | Database |
| redis | 6379 | Caching |

---

## Supported Languages

| Language | Parsing | Complexity | Duplicates |
|----------|---------|------------|------------|
| JavaScript | ✅ | ✅ | ✅ |
| TypeScript | ✅ | ✅ | ✅ |
| Python | ✅ | ✅ | ✅ |
| Rust | ✅ | ✅ | ✅ |
| Go | ✅ | ✅ | ✅ |
| Java | ✅ | ✅ | ✅ |
| C/C++ | ✅ | ✅ | ✅ |
| Ruby | ✅ | ✅ | ✅ |

---

## Performance

| Operation | Speed | Notes |
|-----------|-------|-------|
| Indexing | ~123ms (73 files) | Parallel Rust processing |
| Search | ~4ms | SQLite-backed keyword search |
| Complexity | ~2ms | AST-based Rust analysis |
| Duplicates | O(n) | Rabin-Karp rolling hash |

---

## Documentation

- [**User Guide**](./docs/USER-GUIDE.md) — Detailed setup, use cases, troubleshooting
- [MCP Tools Reference](./docs/MCP-TOOLS.md) — All 16 tools documented
- [REST API Reference](./docs/API.md) — HTTP endpoints
- [Rust FFI Bridge](./docs/rust-ffi-bridge.md) — Native module architecture
- [Performance Benchmarks](./docs/PERFORMANCE-BENCHMARKING.md) — Detailed metrics

---

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgments

- [Tree-sitter](https://tree-sitter.github.io/) — language parsing
- [NAPI-RS](https://napi.rs/) — Rust/Node.js bridge
- [Model Context Protocol](https://modelcontextprotocol.io/) — AI integration standard
- [fastembed](https://github.com/Anush008/fastembed) — ONNX embeddings
