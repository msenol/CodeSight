# CodeSight User Guide

**Version**: v0.1.1
**Last Updated**: May 9, 2026

## Table of Contents

- [Quick Setup](#quick-setup)
- [MCP Clients](#mcp-clients)
- [Use Cases](#use-cases)
- [AI Features](#ai-features)
- [CLI Reference](#cli-reference)
- [REST API](#rest-api)
- [Docker / Team Setup](#docker--team-setup)

---

## Quick Setup

**Prerequisites**: Node.js v20+, Rust 1.75+

```bash
git clone https://github.com/msenol/CodeSight.git
cd CodeSight
npm run setup
```

Index your project:

```bash
cd typescript-mcp
node dist/cli/index.js index /path/to/your/project
```

---

## MCP Clients

### Claude Desktop

Edit `claude_desktop_config.json`:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

Restart Claude Desktop. You should see the CodeSight tools available.

### VS Code (with Continue)

Install the [Continue](https://continue.dev/) extension, then edit `~/.continue/config.json`:

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

### VS Code (with Cline)

Install the [Cline](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev) extension, then add MCP server in Cline settings:

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

### Any MCP Client (stdio transport)

CodeSight implements the standard MCP protocol over stdio. Any MCP-compatible client can connect:

```bash
# Test manually
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node typescript-mcp/dist/index.js
```

---

## Use Cases

After indexing your project, ask your AI assistant:

### Code Navigation

| Question | Tool Used |
|----------|-----------|
| "Show me all authentication functions" | `search_code` |
| "What does `validateToken` do?" | `explain_function` |
| "Where is `UserService` used?" | `find_references` |
| "Trace the data flow of `userId`" | `trace_data_flow` |
| "List all API endpoints" | `get_api_endpoints` |

### Code Quality

| Question | Tool Used |
|----------|-----------|
| "What's the complexity of this module?" | `check_complexity` |
| "Find duplicate code patterns" | `find_duplicates` |
| "Suggest refactoring for this file" | `suggest_refactoring` |
| "Analyze the entire codebase complexity" | `analyze_codebase_complexity` |

### Security

| Question | Tool Used |
|----------|-----------|
| "Check for security vulnerabilities" | `analyze_security` |
| "Are there any SQL injection risks?" | `analyze_security` |
| "Find hardcoded secrets" | `analyze_security` |

### AI-Powered (requires API key)

| Question | Tool Used |
|----------|-----------|
| "Review this code for quality issues" | `ai_code_review` |
| "Predict potential bugs in this module" | `bug_prediction` |
| "Generate a REST endpoint for users" | `context_aware_code_generation` |
| "How can I refactor this service?" | `intelligent_refactoring` |
| "What's our technical debt?" | `technical_debt_analysis` |

### Real-World Workflow Examples

**Onboarding to a new project:**
```
1. "Index this project" → index_codebase
2. "What's the architecture?" → get_api_endpoints + search_code
3. "Show me the main entry points" → search_code
4. "How does authentication work?" → trace_data_flow
```

**Before a code review:**
```
1. "Check complexity of changed files" → check_complexity
2. "Find duplicates near these changes" → find_duplicates
3. "Security scan on this module" → analyze_security
4. "Review this PR" → ai_code_review
```

**Refactoring session:**
```
1. "What's the tech debt in /src/services?" → technical_debt_analysis
2. "Suggest refactoring for UserService" → suggest_refactoring
3. "Find all references before I rename" → find_references
4. "Generate improved version" → context_aware_code_generation
```

---

## AI Features

AI features require an API key. CodeSight supports multiple providers with automatic fallback.

### Setup

```bash
cd typescript-mcp
cp .env.example .env
```

Edit `.env`:

```env
# Recommended: Free tier available
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=xiaomi/mimo-v2-flash:free
```

Get a free key at [openrouter.ai/keys](https://openrouter.ai/keys).

### Available Providers

| Provider | Config Variable | Models |
|----------|----------------|--------|
| **OpenRouter** (recommended) | `OPENROUTER_API_KEY` | 100+ models, free tier available |
| **Anthropic** | `ANTHROPIC_API_KEY` | Claude 3.5 Sonnet, Haiku |
| **OpenAI** | `OPENAI_API_KEY` | GPT-4o, GPT-4o-mini |
| **Ollama** (local) | `OLLAMA_BASE_URL` | Llama, Mistral, etc. |

### Model Recommendations

| Use Case | Model | Cost |
|----------|-------|------|
| Development/testing | `xiaomi/mimo-v2-flash:free` | Free |
| Production quality | `anthropic/claude-3.5-haiku` | Low cost |
| Best analysis | `anthropic/claude-3.5-sonnet` | Higher cost |
| Local/private | Ollama + Llama 3.1 | Free (self-hosted) |

### Fallback Behavior

If the primary provider fails, CodeSight automatically falls back:
1. OpenRouter → Anthropic → OpenAI → Ollama → Rule-based analysis

No configuration needed — fallback is automatic.

---

## CLI Reference

```bash
cd typescript-mcp
```

### Index

```bash
node dist/cli/index.js index <path> [options]

# Options:
#   -v, --verbose    Enable verbose logging
#   --no-progress    Disable progress indicator

# Examples:
node dist/cli/index.js index ~/my-project
node dist/cli/index.js index . -v
```

### Search

```bash
node dist/cli/index.js search <query>

# Examples:
node dist/cli/index.js search "authentication"
node dist/cli/index.js search "database connection"
node dist/cli/index.js search "error handling"
```

### Stats

```bash
node dist/cli/index.js stats

# Output example:
# 📊 Database Statistics:
#    Total entities: 161038
#    By Type:
#    - function: 15705
#    - class: 3830
#    - method: 17101
#    - variable: 54184
```

### Server Mode

```bash
# Start as MCP server (stdio transport — for Claude Desktop, etc.)
node dist/cli/index.js server

# Or directly:
node dist/index.js
```

---

## REST API

CodeSight also exposes a REST API via Fastify (port 4000 by default).

### Start REST Server

```bash
cd typescript-mcp

# MCP + REST hybrid mode (default)
node dist/index.js

# REST only
node dist/index.js --mode rest
```

### Endpoints

```bash
# Health check
curl http://localhost:4000/health

# Search
curl -X POST http://localhost:4000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "authentication functions"}'

# Index a codebase
curl -X POST http://localhost:4000/api/index \
  -H "Content-Type: application/json" \
  -d '{"path": "/path/to/project"}'

# Get stats
curl http://localhost:4000/api/stats

# Call any MCP tool via HTTP
curl -X POST http://localhost:4000/mcp/call \
  -H "Content-Type: application/json" \
  -d '{"tool": "check_complexity", "args": {"file_path": "src/index.ts"}}'
```

### Environment Variables

```env
PORT=4000
HOST=0.0.0.0
```

---

## Docker / Team Setup

### Production (PostgreSQL + Redis)

```bash
# Start all services
docker-compose up -d

# Includes:
# - CodeSight MCP Server (port 4000)
# - PostgreSQL with pgvector (port 5432)
# - Redis (port 6379)

# Check status
docker-compose ps

# View logs
docker-compose logs -f code-intelligence
```

### Development

```bash
# Dev environment with hot reload
docker-compose -f docker-compose.dev.yml up -d
```

### Docker Compose Configuration

The default `docker-compose.yml` includes:

| Service | Port | Purpose |
|---------|------|---------|
| code-intelligence | 4000, 8080 | MCP Server + REST API |
| postgres | 5432 | Database (pgvector) |
| redis | 6379 | Caching |

### Team Usage

For team environments, deploy CodeSight as a shared service:

```bash
# 1. Deploy with Docker
docker-compose up -d

# 2. Team members connect via REST API
curl -X POST http://codesight-server:4000/api/search \
  -d '{"query": "payment processing"}'

# 3. Or configure Claude Desktop to use remote server
# (requires HTTP transport — see REST API section)
```

### Environment Variables for Production

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://postgres:password@postgres:5432/code_intelligence
REDIS_URL=redis://redis:6379
OPENROUTER_API_KEY=sk-or-v1-your-production-key
OPENROUTER_MODEL=anthropic/claude-3.5-haiku
```

---

## Supported Languages

CodeSight parses these languages with Tree-sitter:

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

## Troubleshooting

**MCP server not showing tools in Claude Desktop:**
- Verify the path in config is absolute
- Restart Claude Desktop after config changes
- Test manually: `node typescript-mcp/dist/index.js` should start without errors

**Index returns 0 entities:**
- Check the path is correct and contains source files
- Run with verbose: `node dist/cli/index.js index /path -v`

**AI features not working:**
- Check `.env` file exists in `typescript-mcp/`
- Verify API key is valid
- CodeSight falls back to rule-based analysis if all providers fail

**Docker build fails:**
- Ensure Docker has 4GB+ memory allocated
- Check ports 4000, 5432, 6379 are not in use

**Search returns no results:**
- Run `node dist/cli/index.js stats` to verify index has data
- Re-index if needed: `node dist/cli/index.js index /path`
