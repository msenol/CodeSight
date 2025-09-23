# Quick Start Guide: Code Intelligence MCP Server

**Version**: 1.0.0
**Generated**: 2025-09-21

## Prerequisites

- Node.js v20 LTS or higher
- Rust 1.75+ (for building from source)
- 2GB RAM minimum (8GB recommended)
- 500MB disk space for base installation

## Installation

### Option 1: npm (Recommended)
```bash
npm install -g @codeintelligence/mcp-server
```

### Option 2: Docker
```bash
docker pull codeintelligence/mcp-server:latest
docker run -d -p 3000:3000 -v /path/to/code:/workspace codeintelligence/mcp-server
```

### Option 3: Build from Source
```bash
git clone https://github.com/codeintelligence/mcp-server.git
cd mcp-server
cargo build --release
npm install
npm run build
```

## Quick Setup

### 1. Initialize Configuration
```bash
mcp-server init
```

This creates a default configuration file at `~/.mcp-server/config.toml`

### 2. Index Your First Codebase
```bash
# Add and index a codebase
mcp-server add /path/to/your/project --name "MyProject"

# Check indexing status
mcp-server status MyProject
```

### 3. Test Natural Language Search
```bash
# Search using natural language
mcp-server search "MyProject" "where is user authentication implemented?"

# Find API endpoints
mcp-server search "MyProject" "show all REST endpoints"

# Trace data flow
mcp-server trace "MyProject" "REST API /users" "database"
```

## Integration Scenarios

### Scenario 1: VS Code Integration

1. Install the Code Intelligence extension
2. Open your project
3. Use Command Palette: `Code Intelligence: Index Workspace`
4. Ask questions in the sidebar panel

**Verification Steps:**
- Type a natural language query in the search panel
- Results should appear within 200ms for indexed projects
- Click on results to navigate to code

### Scenario 2: Claude Desktop Integration

1. Ensure MCP server is running:
```bash
mcp-server start --daemon
```

2. Configure Claude Desktop to use local MCP server:
```json
{
  "mcpServers": {
    "code-intelligence": {
      "command": "mcp-server",
      "args": ["serve"],
      "env": {
        "MCP_SERVER_URL": "http://localhost:3000"
      }
    }
  }
}
```

3. Test in Claude Desktop:
- Ask: "Search my codebase for authentication logic"
- Ask: "Show me all API endpoints that modify user data"
- Ask: "Find security vulnerabilities in my code"

**Verification Steps:**
- Claude should have access to MCP tools
- Queries should return code snippets with context
- File paths should be accurate and clickable

### Scenario 3: CI/CD Pipeline Integration

1. Add to GitHub Actions:
```yaml
- name: Code Intelligence Analysis
  uses: codeintelligence/mcp-action@v1
  with:
    command: analyze
    fail-on: high-complexity
```

2. Add to Jenkins:
```groovy
stage('Code Analysis') {
    steps {
        sh 'mcp-server analyze --format junit > analysis.xml'
    }
}
```

**Verification Steps:**
- Pipeline should complete successfully
- Reports should be generated in specified format
- High complexity code should trigger warnings

### Scenario 4: Local LLM Integration

1. Install Ollama:
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull codellama
```

2. Configure MCP server to use Ollama:
```toml
[llm]
provider = "ollama"
model = "codellama"
endpoint = "http://localhost:11434"
```

3. Test code explanation:
```bash
mcp-server explain "MyProject" "function:processPayment"
```

**Verification Steps:**
- Explanations should be generated locally
- No external API calls should be made
- Response time should be <2 seconds

### Scenario 5: Large Monorepo Setup

1. Configure for performance:
```toml
[indexing]
parallel_workers = 8
incremental = true
cache_size = "2GB"

[performance]
profile = "monorepo"
shard_threshold = 50000
```

2. Initial index:
```bash
mcp-server add /path/to/monorepo --name "Monorepo" --profile monorepo
mcp-server index "Monorepo" --parallel
```

3. Monitor progress:
```bash
mcp-server status "Monorepo" --watch
```

**Verification Steps:**
- Indexing should complete within 20 minutes for 100K+ files
- Memory usage should stay below 16GB
- Queries should respond within 500ms

## Validation Checklist

### Basic Functionality
- [ ] Server starts without errors
- [ ] Can add and index a codebase
- [ ] Natural language search returns relevant results
- [ ] Response times meet performance targets

### MCP Protocol
- [ ] All 9 MCP tools are accessible
- [ ] Tool responses follow correct schema
- [ ] Error handling returns proper MCP errors
- [ ] Context includes file paths and line numbers

### Performance Targets
- [ ] Small project (<1K files): <5s indexing, <50ms queries
- [ ] Medium project (1K-10K): <30s indexing, <100ms queries
- [ ] Large project (10K-100K): <5min indexing, <200ms queries

### Privacy & Security
- [ ] No external connections without explicit configuration
- [ ] .gitignore patterns are respected
- [ ] No telemetry data is sent
- [ ] Sensitive files are excluded (.env, keys, etc.)

### Offline Operation
- [ ] All core features work without internet
- [ ] Local LLM integration functions properly
- [ ] Embeddings are generated locally
- [ ] No degradation in air-gapped environment

## Troubleshooting

### Issue: Slow indexing
```bash
# Check system resources
mcp-server diagnostics

# Increase parallel workers
mcp-server config set indexing.parallel_workers 16

# Enable incremental indexing
mcp-server config set indexing.incremental true
```

### Issue: High memory usage
```bash
# Reduce cache size
mcp-server config set performance.cache_size "500MB"

# Enable memory profiling
mcp-server --profile memory index "MyProject"
```

### Issue: Poor search results
```bash
# Check index completeness
mcp-server verify "MyProject"

# Rebuild index with better model
mcp-server reindex "MyProject" --model CodeBERT
```

## Performance Benchmarks

Run the included benchmark suite:
```bash
mcp-server benchmark --all
```

Expected results:
- Indexing: 10K files/minute on 8-core CPU
- Query latency: p50 < 50ms, p99 < 200ms
- Memory per 10K files: < 500MB
- Cache hit rate: > 80% after warmup

## Next Steps

1. **Customize Configuration**: Edit `~/.mcp-server/config.toml`
2. **Add Language Plugins**: `mcp-server plugin install <language>`
3. **Set Up Monitoring**: Enable Prometheus metrics endpoint
4. **Configure IDE Integration**: Install extensions for your editor
5. **Explore Advanced Features**: Security analysis, refactoring suggestions

## Support

- Documentation: https://docs.codeintelligence.dev
- GitHub Issues: https://github.com/codeintelligence/mcp-server/issues
- Community Forum: https://forum.codeintelligence.dev