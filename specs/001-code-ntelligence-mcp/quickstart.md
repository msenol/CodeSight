# Quick Start Guide: Code Intelligence MCP Server

**Version**: v0.1.0-dev (Current Implementation)
**Updated**: September 2025

## Current Implementation Status

✅ **Working Features:**
- Real code indexing with SQLite database
- JavaScript/TypeScript parsing and entity extraction
- MCP protocol compliance with Claude Desktop integration
- CLI tools for indexing and searching
- 377+ entities indexed from parsed codebases

🚧 **Planned Features:**
- Rust core integration for performance
- Multi-language support (15+ languages)
- Advanced semantic search with embeddings

## Prerequisites

- Node.js v20 LTS or higher
- 2GB RAM minimum (sufficient for current TypeScript implementation)
- 100MB disk space for installation

## Installation & Setup

### 1. Clone and Build

```bash
git clone https://github.com/your-org/code-intelligence-mcp.git
cd code-intelligence-mcp/typescript-mcp
npm install
npm run build
```

### 2. Index Your Codebase

```bash
# Index a JavaScript/TypeScript project
node dist/cli/index.js index /path/to/your/project

# View indexing statistics
node dist/cli/index.js stats
# Output: Total entities: 377 (class: 48, function: 175, interface: 140, type: 14)

# Test search functionality
node dist/cli/index.js search "IndexingService"
```

### 3. Claude Desktop Integration

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

### 4. Test MCP Integration

Start the MCP server:
```bash
node dist/index.js
```

In Claude Desktop, try:
- "Search for authentication functions in my codebase"
- "Explain what the IndexingService class does"
- "Find all function definitions in the project"

## Current Capabilities

### ✅ Working MCP Tools

1. **search_code**: Real database search with query intent detection
   - Returns actual results from SQLite database
   - Relevance scoring and ranking
   - Supports natural language queries

2. **explain_function**: Function explanation with codebase lookup
   - Retrieves actual function definitions
   - Provides context and usage information

### 🔧 Protocol-Ready Tools (Mock Implementation)

3. **find_references**: Find symbol references
4. **trace_data_flow**: Data flow analysis
5. **analyze_security**: Security vulnerability detection
6. **get_api_endpoints**: API endpoint discovery
7. **check_complexity**: Code complexity analysis
8. **find_duplicates**: Duplicate code detection
9. **suggest_refactoring**: Refactoring suggestions

## Entity Types Supported

Current TypeScript parser extracts:
- **Functions**: Regular, arrow, async functions (175 found)
- **Interfaces**: TypeScript interfaces (140 found)
- **Classes**: ES6 classes with export detection (48 found)
- **Types**: TypeScript type aliases (14 found)

## Performance Metrics

**Current Implementation:**
- **Indexing Speed**: 47 files in ~2-3 seconds
- **Search Response**: 50-100ms query time
- **Memory Usage**: ~30MB during indexing
- **Database Storage**: SQLite with efficient indexing

## Validation Checklist

### ✅ Current Status
- [x] MCP server starts and connects to Claude Desktop
- [x] Code indexing works for JS/TS projects
- [x] Search returns real results from database
- [x] Claude Desktop integration verified
- [x] CLI tools functional (index, search, stats)

### 🚧 In Progress
- [ ] Multi-language support (Rust integration)
- [ ] Advanced semantic search
- [ ] All 9 MCP tools with real implementations
- [ ] Performance optimization with Rust core

## Troubleshooting

### Issue: Module not found errors
```bash
# Ensure build completed successfully
cd typescript-mcp
npm run build
ls dist/  # Should show compiled JavaScript files
```

### Issue: Database not created
```bash
# Check if indexing ran successfully
node dist/cli/index.js stats
# Should show entity counts, not zero
```

### Issue: Claude Desktop connection fails
```bash
# Verify MCP server starts without errors
node dist/index.js
# Should show MCP server initialization logs
```

### Issue: Search returns no results
```bash
# Verify codebase was indexed
node dist/cli/index.js stats

# Try exact function name search
node dist/cli/index.js search "exact_function_name"
```

## Architecture Overview

**Current TypeScript Implementation:**
```
CLI Commands → IndexingService → SQLite Database → SearchService → MCP Tools
```

**Planned Rust Integration:**
```
MCP Protocol → TypeScript Server → FFI Bridge → Rust Core → Tree-sitter + Tantivy
```

## File Structure

```
typescript-mcp/
├── dist/
│   ├── cli/index.js          # ✅ Working CLI
│   └── index.js              # ✅ MCP server
├── src/
│   ├── services/
│   │   ├── indexing-service.ts  # ✅ Real SQLite indexing
│   │   └── search-service.ts    # ✅ Query processing
│   ├── tools/                   # ✅ 9 MCP tools
│   └── cli/                     # ✅ CLI implementation
└── tests/
    └── contract/                # ✅ All tools tested
```

## Next Steps

1. **Try It Out**: Index your own JS/TS project and test search
2. **Claude Integration**: Set up Claude Desktop and test MCP tools
3. **Explore Codebase**: Use CLI to understand indexed entities
4. **Report Issues**: Provide feedback on search relevance and indexing

## Support

- **Current Status**: Active development, core features working
- **GitHub Issues**: For bug reports and feature requests
- **Documentation**: See main README.md and typescript-mcp/README.md
- **Architecture**: Review CLAUDE.md for technical details

---

**Note**: This is an active development version with working core functionality. The Rust integration and additional language support are planned for future releases.