# 🐳 Docker Testing with GitHub Projects - Quick Start Guide

## 🎯 Overview

This guide helps you set up and run comprehensive MCP server testing using real GitHub projects in isolated Docker containers.

## 📋 Prerequisites

- Docker and Docker Compose installed
- Git installed
- 4GB+ available RAM
- 10GB+ available disk space

## 🚀 Quick Start (5 Minutes)

### 1. Download Test Projects
```bash
# Download popular GitHub projects for testing
./scripts/download-test-projects.sh
```

### 2. Start Test Environment
```bash
# Start Docker containers with isolated ports
docker-compose -f docker-compose.test.yml up -d

# Wait for services to be ready (30-60 seconds)
docker-compose -f docker-compose.test.yml logs -f test-code-intelligence
```

### 3. Index Projects
```bash
# Index downloaded projects for MCP testing
./scripts/index-test-projects.sh
```

### 4. Run Tests
```bash
# Run comprehensive tests with real projects
./scripts/test-real-projects.sh
```

### 5. Generate Report
```bash
# Generate detailed performance report
./scripts/generate-project-report.sh
```

## 📊 Available Scripts

| Script | Purpose | Duration |
|--------|---------|----------|
| `download-test-projects.sh` | Download GitHub projects | 2-5 min |
| `analyze-projects.sh` | Analyze project statistics | 1 min |
| `index-test-projects.sh` | Index projects for MCP | 5-15 min |
| `test-real-projects.sh` | Run comprehensive tests | 5-10 min |
| `benchmark-real-projects.sh` | Performance benchmarking | 10-20 min |
| `generate-project-report.sh` | Generate HTML/JSON reports | 2 min |

## 🔧 Test Environment Details

### Port Configuration
| Service | Port | Purpose |
|---------|------|---------|
| MCP Server | 4000 | REST API |
| WebSocket/MCP | 8080 | WebSocket connections |
| Test PostgreSQL | 5433 | Test database |
| Test Redis | 6380 | Test cache |
| Test Grafana | 4002 | Monitoring dashboard |
| Test Prometheus | 9092 | Metrics collection |

### Project Categories
- **Small Projects**: lodash, axios, prettier (< 1K files)
- **Medium Projects**: express, fastapi (1K-10K files)
- **Large Projects**: react, nextjs, vite (10K+ files)

## 🧪 Test Scenarios

### 1. Basic Search Testing
```bash
# Test search functionality
docker exec projectara-test-mcp node dist/minimal-index.js search \
  --query="function" \
  --codebase-id="react" \
  --limit=10
```

### 2. Performance Testing
```bash
# Run performance benchmarks
./scripts/benchmark-real-projects.sh
```

### 3. Cross-Project Analysis
```bash
# Search across all projects
docker exec projectara-test-mcp node dist/minimal-index.js search \
  --query="import" \
  --across-projects \
  --limit=20
```

### 4. API Testing
```bash
# Test REST API
curl -X POST http://localhost:4000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "useState", "codebase_id": "react"}'
```

### 5. WebSocket Testing
```bash
# Test WebSocket/MCP connection
wscat -c ws://localhost:8080 -x '{"jsonrpc": "2.0", "method": "search_code", "params": {"query": "function"}}'
```

## 📈 Monitoring and Logs

### View Logs
```bash
# MCP Server logs
docker-compose -f docker-compose.test.yml logs test-code-intelligence

# Database logs
docker-compose -f docker-compose.test.yml logs test-postgres

# All services logs
docker-compose -f docker-compose.test.yml logs
```

### Monitor Performance
```bash
# Container resource usage
docker stats projectara-test-mcp

# Memory usage details
docker exec projectara-test-mcp node -e "console.log(process.memoryUsage())"
```

### Access Grafana Dashboard
1. Open http://localhost:4002
2. Login with: admin / test_admin
3. View MCP Server metrics

## 🔍 Results and Reports

### Test Results Location
- **Main results**: `test-results/`
- **Performance data**: `test-results/performance-benchmark-*.json`
- **HTML reports**: `test-results/reports/mcp-test-report-*.html`
- **JSON metrics**: `test-results/reports/metrics-*.json`

### View Latest Report
```bash
# Open latest HTML report
open test-results/reports/mcp-test-report-*.html

# Or view in browser
echo "Open: http://localhost:4002 for live monitoring"
```

## 🛠️ Troubleshooting

### Common Issues

**Docker containers not starting:**
```bash
# Check port conflicts
netstat -an | grep -E ":(4000|5433|6380|8080)"

# Clean up and restart
docker-compose -f docker-compose.test.yml down --volumes
docker-compose -f docker-compose.test.yml up -d
```

**MCP server not healthy:**
```bash
# Check health endpoint
curl http://localhost:4000/health

# View detailed logs
docker-compose -f docker-compose.test.yml logs test-code-intelligence
```

**Indexing fails:**
```bash
# Check if projects are downloaded
ls external-test-projects/

# Check disk space
df -h

# Restart indexing
./scripts/index-test-projects.sh
```

**Performance issues:**
```bash
# Check memory usage
docker stats projectara-test-mcp

# Limit concurrent operations
# Edit scripts to reduce parallel processing
```

### Reset Test Environment
```bash
# Complete reset
docker-compose -f docker-compose.test.yml down --volumes --remove-orphans
docker system prune -f

# Restart fresh
docker-compose -f docker-compose.test.yml up -d
./scripts/index-test-projects.sh
```

## 🎯 Advanced Usage

### Add Custom Projects
```bash
# Add your own project
git clone https://github.com/your-username/your-project.git external-test-projects/your-project

# Index custom project
docker exec projectara-test-mcp node dist/minimal-index.js index \
  /app/external-projects/your-project \
  --codebase-id="your-project"
```

### Run Specific Tests
```bash
# Test only React project
docker exec projectara-test-mcp node dist/minimal-index.js search \
  --query="useState" \
  --codebase-id="react"

# Compare two projects
./scripts/compare-projects.sh react nextjs
```

### Performance Profiling
```bash
# Memory profiling
docker exec projectara-test-mcp node --inspect dist/minimal-index.js

# CPU profiling
docker exec projectara-test-mcp node --prof dist/minimal-index.js search --query="function"
```

## 📊 Expected Performance Metrics

| Project Size | Indexing Time | Search Time | Memory Usage |
|-------------|---------------|-------------|--------------|
| Small (<1K files) | < 30s | < 50ms | 200-400MB |
| Medium (1K-10K) | 1-5 min | < 100ms | 400-800MB |
| Large (10K+) | 5-15 min | < 200ms | 800-1500MB |

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: MCP Docker Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Download test projects
        run: ./scripts/download-test-projects.sh

      - name: Start test environment
        run: docker-compose -f docker-compose.test.yml up -d

      - name: Wait for services
        run: sleep 60

      - name: Index projects
        run: ./scripts/index-test-projects.sh

      - name: Run tests
        run: ./scripts/test-real-projects.sh

      - name: Generate report
        run: ./scripts/generate-project-report.sh

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

## 📞 Support

### Get Help
```bash
# Check script help
./scripts/test-real-projects.sh --help 2>/dev/null || echo "Run script without --help flag"

# Check Docker status
docker-compose -f docker-compose.test.yml ps

# Check system resources
free -h
df -h
```

### Debug Mode
```bash
# Enable debug logging
export DEBUG=mcp:*
docker-compose -f docker-compose.test.yml up -d

# Run tests with verbose output
./scripts/test-real-projects.sh --verbose
```

## 🎉 Success!

When you see:
- ✅ All Docker containers running
- ✅ Projects indexed successfully
- ✅ Tests passing
- ✅ Report generated

Your MCP server is ready for production with real-world project validation!