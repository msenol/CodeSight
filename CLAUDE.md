# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Version: v0.1.0**

## Project Overview

Code Intelligence MCP Server - A **working TypeScript implementation** with real SQLite database integration:
- **✅ TypeScript MCP Server** (`typescript-mcp/`): Full MCP protocol, 377+ entities indexed in SQLite
- **✅ React Frontend** (`src/`): Web UI with Vite and TypeScript
- **✅ Express API** (`api/`): REST API server
- **🚧 Rust Core** (`rust-core/`): Architecture ready for high-performance integration

## Current Working State

**✅ Fully Functional:**
- MCP Protocol with 9 tools (2 fully implemented, 7 with mock responses)
- Real SQLite indexing: 47 files → 377 entities in 2-3 seconds
- CLI commands: `index`, `search`, `stats`
- Claude Desktop integration tested and verified
- Natural language search with database results

**🚧 Planned Enhancements:**
- Rust FFI integration for performance
- Multi-language support (15+ languages via Tree-sitter)
- Advanced semantic search with vector embeddings

## Essential Commands

### CLI (Fully Working)
```bash
# Build and setup
cd typescript-mcp && npm install && npm run build

# Index codebase (JS/TS)
node dist/cli/index.js index /path/to/project

# Search and stats
node dist/cli/index.js search "query"
node dist/cli/index.js stats
```

### Claude Desktop Integration
```json
{
  "mcpServers": {
    "code-intelligence": {
      "command": "node",
      "args": ["F:/path/to/typescript-mcp/dist/index.js"],
      "cwd": "F:/path/to/typescript-mcp"
    }
  }
}
```

### Development
```bash
npm install           # Root dependencies
npm run dev          # Start dev environment
npm run build        # Production build
npm test             # All tests
```

## MCP Tools Status

**✅ Real Implementation:**
- `search_code`: Natural language search with SQLite results
- `explain_function`: Function explanation with codebase lookup

**🔧 Mock Implementation (Working Protocol):**
- `find_references`, `trace_data_flow`, `analyze_security`
- `get_api_endpoints`, `check_complexity`, `find_duplicates`, `suggest_refactoring`

## Performance Metrics

**Current (TypeScript):**
- 47 files → 2-3s indexing → 377 entities
- Search queries: 50-100ms
- Memory: ~30MB during indexing

**Target (With Rust):**
- Small projects (<1K): <5s indexing, <50ms queries
- Medium projects (1K-10K): <30s indexing, <100ms queries

## Project Structure

```
typescript-mcp/        # ✅ Working MCP server
├── src/tools/        # 9 MCP tools implemented
├── src/services/     # IndexingService with SQLite
├── src/cli/          # CLI commands
└── tests/contract/   # MCP protocol tests

rust-core/            # 🚧 Future performance layer
api/                  # ✅ Express REST server
src/                  # ✅ React frontend
```

## Environment Configuration

**Development:**
```bash
NODE_ENV=development
PORT=4000
DATABASE_URL=sqlite://./data/code_intelligence.db
```

**Production:**
```bash
NODE_ENV=production
DATABASE_URL=postgresql://postgres:password@postgres:5432/code_intelligence
REDIS_URL=redis://redis:6379
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