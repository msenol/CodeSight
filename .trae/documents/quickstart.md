# Quickstart Guide: Code Intelligence MCP Server

**Generated**: 2025-01-27
**Version**: 1.0.0
**Estimated Time**: 15-30 minutes

## Overview

This guide walks you through setting up and using the Code Intelligence MCP Server to enable AI assistants to understand and query your codebases through natural language.

## Prerequisites

### System Requirements
- **OS**: Linux, macOS, or Windows
- **Memory**: 4GB RAM minimum, 8GB recommended
- **Storage**: 2GB free space for installation
- **CPU**: Multi-core processor recommended

### Software Dependencies
- **Rust**: 1.75+ (for core engine)
- **Node.js**: v20 LTS (for MCP interface)
- **Docker**: Optional, for containerized deployment
- **Git**: For codebase management

## Installation

### Option 1: Binary Installation (Recommended)
```bash
# Download latest release
curl -L https://github.com/your-org/code-intelligence-mcp/releases/latest/download/code-intelligence-mcp-linux.tar.gz | tar xz

# Move to system path
sudo mv code-intelligence-mcp /usr/local/bin/

# Verify installation
code-intelligence-mcp --version
```

### Option 2: Docker Installation
```bash
# Pull the latest image
docker pull your-org/code-intelligence-mcp:latest

# Run with volume mount
docker run -d \
  --name code-intelligence \
  -p 3000:3000 \
  -v /path/to/your/code:/workspace \
  your-org/code-intelligence-mcp:latest
```

### Option 3: Build from Source
```bash
# Clone repository
git clone https://github.com/your-org/code-intelligence-mcp.git
cd code-intelligence-mcp

# Build Rust core
cd rust-core
cargo build --release

# Build TypeScript MCP
cd ../typescript-mcp
npm install
npm run build

# Install globally
npm install -g .
```

## Quick Setup

### 1. Initialize Configuration
```bash
# Create default configuration
code-intelligence-mcp init

# This creates ~/.config/code-intelligence-mcp/config.json
```

### 2. Add Your First Codebase
```bash
# Index a local project
code-intelligence-mcp add-codebase \
  --name "my-project" \
  --path "/path/to/your/project" \
  --languages "typescript,python,rust"

# Monitor indexing progress
code-intelligence-mcp status
```

### 3. Start the MCP Server
```bash
# Start server with default configuration
code-intelligence-mcp serve --port 3000

# Server will be available at http://localhost:3000
```

## Integration Scenarios

### Scenario 1: Claude Desktop Integration

**Goal**: Enable Claude Desktop to query your codebase through natural language.

**Steps**:
1. **Configure Claude Desktop MCP**:
   ```json
   // Add to Claude Desktop MCP configuration
   {
     "mcpServers": {
       "code-intelligence": {
         "command": "code-intelligence-mcp",
         "args": ["mcp-server"],
         "env": {
           "CODEBASE_PATH": "/path/to/your/project"
         }
       }
     }
   }
   ```

2. **Restart Claude Desktop**

3. **Test Integration**:
   - Open Claude Desktop
   - Ask: "Where is user authentication implemented in my codebase?"
   - Verify Claude can access and analyze your code

**Expected Result**: Claude responds with specific file locations and code snippets related to authentication.

### Scenario 2: VS Code Extension Integration

**Goal**: Use the code intelligence features directly within VS Code.

**Steps**:
1. **Install VS Code Extension**:
   ```bash
   code --install-extension your-org.code-intelligence-mcp
   ```

2. **Configure Extension**:
   - Open VS Code settings
   - Search for "Code Intelligence"
   - Set server URL: `http://localhost:3000`

3. **Test Features**:
   - Right-click on a function → "Explain Function"
   - Use Command Palette → "Find References"
   - Search: "Show all API endpoints"

**Expected Result**: VS Code displays intelligent code analysis and search results.

### Scenario 3: CI/CD Pipeline Integration

**Goal**: Integrate code intelligence into your CI/CD pipeline for automated analysis.

**Steps**:
1. **Add to GitHub Actions**:
   ```yaml
   # .github/workflows/code-analysis.yml
   name: Code Intelligence Analysis
   on: [push, pull_request]
   
   jobs:
     analyze:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - name: Run Code Intelligence
           run: |
             docker run --rm \
               -v ${{ github.workspace }}:/workspace \
               your-org/code-intelligence-mcp:latest \
               analyze --format json > analysis.json
         - name: Upload Results
           uses: actions/upload-artifact@v3
           with:
             name: code-analysis
             path: analysis.json
   ```

2. **Test Pipeline**:
   - Push code changes
   - Check Actions tab for analysis results

**Expected Result**: Automated code analysis reports in CI/CD pipeline.

### Scenario 4: Local LLM with Ollama

**Goal**: Use local LLM for code explanations without external API calls.

**Steps**:
1. **Install Ollama**:
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

2. **Download Code Model**:
   ```bash
   ollama pull codellama:7b
   ```

3. **Configure Code Intelligence**:
   ```bash
   # Update configuration to use Ollama
   code-intelligence-mcp config set llm.provider ollama
   code-intelligence-mcp config set llm.model codellama:7b
   code-intelligence-mcp config set llm.endpoint http://localhost:11434
   ```

4. **Test Local LLM**:
   ```bash
   # Query with local model
   code-intelligence-mcp query \
     --codebase "my-project" \
     --question "Explain the main function in app.py"
   ```

**Expected Result**: Detailed code explanations using local LLM without internet connectivity.

### Scenario 5: Large Monorepo Analysis

**Goal**: Index and query a large monorepo with 100K+ files efficiently.

**Steps**:
1. **Configure for Large Scale**:
   ```bash
   # Set high-performance configuration
   code-intelligence-mcp config set indexing.parallel_workers 8
   code-intelligence-mcp config set indexing.batch_size 1000
   code-intelligence-mcp config set storage.backend postgresql
   ```

2. **Start PostgreSQL** (if using):
   ```bash
   docker run -d \
     --name postgres-code-intel \
     -e POSTGRES_DB=code_intelligence \
     -e POSTGRES_USER=admin \
     -e POSTGRES_PASSWORD=secret \
     -p 5432:5432 \
     postgres:16-alpine
   ```

3. **Index Large Codebase**:
   ```bash
   # Index with progress monitoring
   code-intelligence-mcp add-codebase \
     --name "large-monorepo" \
     --path "/path/to/monorepo" \
     --parallel-workers 8 \
     --progress
   ```

4. **Monitor Performance**:
   ```bash
   # Check indexing status and performance
   code-intelligence-mcp metrics
   ```

**Expected Result**: Successful indexing of large codebase within 20 minutes, with sub-500ms query responses.

## Common Commands

### Codebase Management
```bash
# List all codebases
code-intelligence-mcp list

# Show codebase details
code-intelligence-mcp info --name "my-project"

# Update existing codebase
code-intelligence-mcp update --name "my-project"

# Remove codebase
code-intelligence-mcp remove --name "my-project"
```

### Querying
```bash
# Natural language search
code-intelligence-mcp query \
  --codebase "my-project" \
  --question "Where are the API endpoints defined?"

# Find function references
code-intelligence-mcp find-references \
  --codebase "my-project" \
  --function "authenticate_user"

# Analyze security
code-intelligence-mcp analyze-security \
  --codebase "my-project" \
  --patterns "sql_injection,xss"
```

### Server Management
```bash
# Start MCP server
code-intelligence-mcp serve --port 3000

# Start with specific configuration
code-intelligence-mcp serve --config /path/to/config.json

# Health check
curl http://localhost:3000/health
```

## Troubleshooting

### Common Issues

**Issue**: "Failed to index codebase - out of memory"
```bash
# Solution: Reduce batch size and parallel workers
code-intelligence-mcp config set indexing.batch_size 100
code-intelligence-mcp config set indexing.parallel_workers 2
```

**Issue**: "MCP server not responding"
```bash
# Solution: Check server status and restart
code-intelligence-mcp status
code-intelligence-mcp restart
```

**Issue**: "Slow query responses"
```bash
# Solution: Check cache configuration and rebuild indexes
code-intelligence-mcp config set cache.enabled true
code-intelligence-mcp rebuild-index --name "my-project"
```

### Performance Optimization

**For Small Projects** (<1K files):
```bash
code-intelligence-mcp config set storage.backend sqlite
code-intelligence-mcp config set indexing.parallel_workers 2
```

**For Large Projects** (>10K files):
```bash
code-intelligence-mcp config set storage.backend postgresql
code-intelligence-mcp config set indexing.parallel_workers 8
code-intelligence-mcp config set cache.size_mb 1024
```

### Logs and Debugging
```bash
# View logs
code-intelligence-mcp logs --tail 100

# Enable debug logging
code-intelligence-mcp config set logging.level debug

# Export configuration
code-intelligence-mcp config export > my-config.json
```

## Next Steps

### Advanced Configuration
- **Custom Language Support**: Add tree-sitter grammars for new languages
- **Plugin Development**: Create custom analyzers and formatters
- **Model Fine-tuning**: Train domain-specific embedding models

### Integration Examples
- **Slack Bot**: Query codebases from Slack channels
- **Web Dashboard**: Build custom web interface for team usage
- **IDE Plugins**: Develop plugins for other IDEs (IntelliJ, Vim)

### Monitoring and Scaling
- **Prometheus Metrics**: Set up monitoring dashboards
- **Kubernetes Deployment**: Scale for enterprise usage
- **Load Balancing**: Distribute queries across multiple instances

## Support and Resources

- **Documentation**: [Full documentation](https://docs.code-intelligence-mcp.com)
- **GitHub Issues**: [Report bugs and feature requests](https://github.com/your-org/code-intelligence-mcp/issues)
- **Community**: [Join our Discord](https://discord.gg/code-intelligence)
- **Examples**: [Sample configurations and integrations](https://github.com/your-org/code-intelligence-examples)

## Validation Checklist

After completing this quickstart, you should be able to:

- [ ] Successfully install and configure the Code Intelligence MCP Server
- [ ] Index at least one codebase with progress monitoring
- [ ] Query the codebase using natural language
- [ ] Integrate with at least one AI assistant (Claude Desktop or VS Code)
- [ ] View performance metrics and health status
- [ ] Troubleshoot common issues using provided solutions

**Estimated completion time**: 15-30 minutes depending on codebase size and chosen integration scenario.

---

*This quickstart guide covers the essential setup and usage patterns. For advanced features and customization, refer to the full documentation.*