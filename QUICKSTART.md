# 🚀 CodeSight MCP Quick Start Guide

Get up and running with CodeSight MCP Server in under 5 minutes!

## ⚡ Instant Setup

### 1. System Requirements
- **Node.js 18+** (recommended: 20)
- **Rust 1.75+** (for performance features)

### 2. One-Command Installation

```bash
# Clone and setup automatically
git clone <repository-url> CodeSight
cd CodeSight
./scripts/dev-setup.sh
```

### 3. Manual Setup (5 minutes)

```bash
# Install Rust (if not installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

# Install dependencies
npm install
cd typescript-mcp && npm install && cd ..

# Build the project
cd typescript-mcp
source "$HOME/.cargo/env"
npm run build:full
```

## 🎯 Your First Use

### Index a Codebase
```bash
# Index your project
node dist/cli/index.js index /path/to/your/project

# Search your code
node dist/cli/index.js search "function name"
node dist/cli/index.js search "API endpoint"
node dist/cli/index.js search "TODO comments"

# View statistics
node dist/cli/index.js stats
```

### Start MCP Server
```bash
# Start in stdio mode (for Claude Desktop)
node dist/cli/index.js server

# Or start as HTTP server
node dist/server.js
```

## 🔧 Claude Desktop Integration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "codesight": {
      "command": "node",
      "args": ["/path/to/codesight/typescript-mcp/dist/cli/index.js", "server"],
      "cwd": "/path/to/codesight/typescript-mcp"
    }
  }
}
```

## 📊 Available MCP Tools

- **`search_code`**: Natural language code search
- **`explain_function`**: Function explanation with context
- **`find_references`**: Find all references to symbols
- **`trace_data_flow`**: Track variable usage
- **`analyze_security`**: Security vulnerability analysis
- **`get_api_endpoints`**: List API endpoints
- **`check_complexity`**: Code complexity metrics
- **`find_duplicates`**: Duplicate code detection
- **`suggest_refactoring`**: Refactoring recommendations

## 🧪 Quick Testing

```bash
# Test health
node dist/health-check-cli.js

# Test with sample project
mkdir test-project
echo 'function hello() { return "world"; }' > test-project/app.js
node dist/cli/index.js index ./test-project
node dist/cli/index.js search "hello"

# Run basic tests
npm test
```

## 🐳 Docker Quick Start (Optional)

```bash
# With Docker and Docker Compose
docker-compose -f docker-compose.dev.yml up -d

# Access services:
# MCP Server: http://localhost:4000
# Database: localhost:5433
# Redis: localhost:6380
```

## ❓ Need Help?

- **Full Documentation**: `DEVELOPMENT.md`
- **API Reference**: Check `/docs` directory
- **Troubleshooting**: See `DEVELOPMENT.md#troubleshooting`
- **Issues**: Open GitHub issue

## 🎉 You're Ready!

You now have a fully functional CodeSight MCP Server running! Start by indexing your favorite project and try natural language searches.

**Example searches to try:**
- "find authentication functions"
- "show me database connection code"
- "where are API endpoints defined"
- "look for error handling patterns"

Happy coding! 🚀