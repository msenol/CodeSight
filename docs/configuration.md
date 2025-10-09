# Configuration and Deployment Guide

**Production-Ready Configuration** for CodeSight v0.1.0 - Enterprise MCP Server with hybrid TypeScript/Rust architecture, comprehensive monitoring, multi-language support, and exceptional code quality with 62% lint improvement achievement.

## Overview

This guide provides complete configuration and deployment instructions for the CodeSight MCP Server, covering development, production, and enterprise environments with Docker, Kubernetes, and CI/CD integration.

## Quick Start

### Development Environment

```bash
# Clone and setup
git clone <repository-url>
cd codesight-mcp

# Install dependencies
npm install

# Build Rust FFI bridge (optional for performance)
cd rust-core && cargo build --release && cd ..

# Start development environment
npm run dev

# Index your codebase
node dist/cli/index.js index /path/to/project

# Test search
node dist/cli/index.js search "authentication functions"
```

### Docker Development

```bash
# Start with Docker Compose
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose logs -f

# Access services
# MCP Server: http://localhost:3001
# API Server: http://localhost:4000
# Frontend: http://localhost:3000
```

## Environment Configuration

### Environment Variables

#### Core Application

```bash
# Application Settings
NODE_ENV=production
APP_NAME=codesight
APP_VERSION=0.1.0
PORT=4000
HOST=0.0.0.0

# Database Configuration
DATABASE_URL=postgresql://postgres:password@postgres:5432/code_intelligence
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=code_intelligence

# Redis Configuration
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
```

#### MCP Server Configuration

```bash
# MCP Settings
MCP_PORT=3001
MCP_HOST=0.0.0.0
MCP_ENABLE_LOGGING=true
MCP_LOG_LEVEL=info

# MCP Tools
MCP_ENABLE_SEARCH=true
MCP_ENABLE_INDEXING=true
MCP_ENABLE_ANALYSIS=true
MCP_MAX_RESULTS=100
MCP_SEARCH_TIMEOUT=5000
```

#### Rust FFI Configuration

```bash
# Rust FFI Bridge
ENABLE_RUST_FFI=true
RUST_FFI_PATH=./rust-core/target/release
FFI_GRACEFUL_FALLBACK=true
FFI_TIMEOUT=5000
MAX_CONCURRENT_FFI_CALLS=10

# NAPI-RS Settings
NAPI_MODULE_PATH=./codesight-native.node
NAPI_DEBUG=false
```

#### Performance Configuration

```bash
# Indexing Performance
INDEXING_BATCH_SIZE=100
INDEXING_MAX_CONCURRENT=4
INDEXING_TIMEOUT=30000
INDEXING_PARALLEL_WORKERS=4

# Search Performance
SEARCH_MAX_RESULTS=100
SEARCH_TIMEOUT=5000
SEARCH_ENABLE_FUZZY=true
SEARCH_FUZZY_THRESHOLD=0.6

# Caching
ENABLE_CACHE=true
CACHE_TTL=3600
CACHE_MAX_SIZE=1000
```

#### Monitoring and Security

```bash
# Metrics and Health
ENABLE_METRICS=true
METRICS_PORT=9090
METRICS_PATH=/metrics
HEALTH_CHECK_PATH=/health

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW=900000
```

### Configuration Files

#### Development Configuration (.env)

```bash
NODE_ENV=development
DATABASE_URL=sqlite://./data/code_intelligence.db
REDIS_URL=redis://localhost:6379
ENABLE_RUST_FFI=true
RUST_FFI_PATH=../rust-core/target/release
FFI_GRACEFUL_FALLBACK=true
LOG_LEVEL=debug
```

#### Production Configuration (.env.production)

```bash
NODE_ENV=production
DATABASE_URL=postgresql://postgres:password@postgres:5432/code_intelligence
REDIS_URL=redis://redis:6379
ENABLE_RUST_FFI=true
FFI_GRACEFUL_FALLBACK=true
LOG_LEVEL=info
ENABLE_METRICS=true
```

## Docker Deployment

### Development Docker Compose

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  mcp-server:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: codesight-mcp
    ports:
      - "3001:3001"
    volumes:
      - .:/app
      - /app/node_modules
      - ./data:/app/data
    environment:
      - NODE_ENV=development
      - DATABASE_URL=sqlite:///app/data/code_intelligence.db
      - ENABLE_RUST_FFI=true
      - RUST_FFI_PATH=/app/rust-core/target/release
    depends_on:
      - redis
    networks:
      - codesight-network

  api-server:
    build:
      context: ./api
      dockerfile: Dockerfile
    container_name: codesight-api
    ports:
      - "4000:4000"
    volumes:
      - ./api:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/code_intelligence
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    networks:
      - codesight-network

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: codesight-frontend
    ports:
      - "3000:3000"
    volumes:
      - ./src:/app/src
      - /app/node_modules
    environment:
      - VITE_API_BASE_URL=http://localhost:4000
      - VITE_MCP_BASE_URL=http://localhost:3001
    depends_on:
      - api-server
    networks:
      - codesight-network

  postgres:
    image: postgres:15-alpine
    container_name: codesight-postgres
    environment:
      - POSTGRES_DB=code_intelligence
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./api/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    networks:
      - codesight-network

  redis:
    image: redis:7-alpine
    container_name: codesight-redis
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    ports:
      - "6379:6379"
    networks:
      - codesight-network

volumes:
  postgres-data:
  redis-data:

networks:
  codesight-network:
    driver: bridge
```

### Production Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  mcp-server:
    image: codesight/mcp-server:latest
    container_name: codesight-mcp-prod
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - codesight-data:/app/data
      - codesight-logs:/app/logs
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/code_intelligence
      - REDIS_URL=redis://redis:6379
      - ENABLE_RUST_FFI=true
      - FFI_GRACEFUL_FALLBACK=true
      - ENABLE_METRICS=true
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - codesight-network

  nginx:
    image: nginx:alpine
    container_name: codesight-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - mcp-server
    networks:
      - codesight-network

  postgres:
    image: postgres:15-alpine
    container_name: codesight-postgres-prod
    restart: unless-stopped
    environment:
      - POSTGRES_DB=code_intelligence
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./backups:/backups
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d code_intelligence"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - codesight-network

  redis:
    image: redis:7-alpine
    container_name: codesight-redis-prod
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks:
      - codesight-network

  prometheus:
    image: prom/prometheus:latest
    container_name: codesight-prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    networks:
      - codesight-network

  grafana:
    image: grafana/grafana:latest
    container_name: codesight-grafana
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
      - ./grafana/datasources:/etc/grafana/provisioning/datasources:ro
    networks:
      - codesight-network

volumes:
  codesight-data:
  codesight-logs:
  postgres-data:
  redis-data:
  prometheus-data:
  grafana-data:

networks:
  codesight-network:
    driver: bridge
```

### Dockerfile

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    pkgconfig \
    libssl-dev \
    build-base

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY typescript-mcp/package*.json ./typescript-mcp/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build Rust components
FROM rust:1.75-slim AS rust-builder

WORKDIR /app
COPY rust-core ./rust-core/

# Build Rust FFI
RUN cd rust-core && cargo build --release

# Build application
FROM base AS builder

# Copy Rust build artifacts
COPY --from=rust-builder /app/rust-core/target/release ./rust-core/target/release

# Build TypeScript
RUN cd typescript-mcp && npm run build

# Production image
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    ca-certificates \
    tini

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/rust-core/target/release ./rust-core/target/release
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/typescript-mcp/dist ./typescript-mcp/dist/

# Copy configuration
COPY typescript-mcp/config ./config/

# Set permissions
RUN chown -R nodejs:nodejs /app

# Create directories
RUN mkdir -p /app/data /app/logs && \
    chown -R nodejs:nodejs /app/data /app/logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "typescript-mcp/dist/index.js"]
```

## Kubernetes Deployment

### Helm Chart Installation

```bash
# Add Helm repository
helm repo add codesight https://charts.codesight.dev
helm repo update

# Install with default values
helm install codesight codesight/mcp-server

# Install with custom values
helm install codesight codesight/mcp-server \
  --set image.tag=v0.1.0 \
  --set resources.requests.memory=2Gi \
  --set replicaCount=3 \
  --set postgresql.auth.postgresPassword=your-password \
  --set redis.auth.enabled=true \
  --set redis.auth.password=your-redis-password
```

### Custom Kubernetes Manifests

#### Namespace and Configuration

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: codesight
  labels:
    name: codesight
    app.kubernetes.io/name: codesight
    app.kubernetes.io/version: "0.1.0"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: codesight-config
  namespace: codesight
data:
  config.json: |
    {
      "server": {
        "port": 3001,
        "host": "0.0.0.0",
        "timeout": 30000
      },
      "mcp": {
        "enableLogging": true,
        "logLevel": "info",
        "maxResults": 100,
        "searchTimeout": 5000
      },
      "indexing": {
        "batchSize": 100,
        "maxConcurrent": 4,
        "timeout": 30000
      },
      "search": {
        "maxResults": 100,
        "timeout": 5000,
        "enableFuzzy": true,
        "fuzzyThreshold": 0.6
      },
      "rust": {
        "enableFFI": true,
        "gracefulFallback": true,
        "timeout": 5000,
        "maxConcurrentCalls": 10
      },
      "monitoring": {
        "enableMetrics": true,
        "metricsPort": 9090,
        "healthCheckPath": "/health"
      }
    }
```

#### Deployment and Services

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: codesight-mcp
  namespace: codesight
  labels:
    app: codesight-mcp
    version: v0.1.0
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1
  selector:
    matchLabels:
      app: codesight-mcp
  template:
    metadata:
      labels:
        app: codesight-mcp
        version: v0.1.0
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: codesight
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: codesight-mcp
        image: codesight/mcp-server:v0.1.0
        imagePullPolicy: IfNotPresent
        ports:
        - name: http
          containerPort: 3001
          protocol: TCP
        - name: metrics
          containerPort: 9090
          protocol: TCP
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: codesight-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: codesight-secrets
              key: redis-url
        - name: ENABLE_RUST_FFI
          value: "true"
        - name: FFI_GRACEFUL_FALLBACK
          value: "true"
        - name: ENABLE_METRICS
          value: "true"
        volumeMounts:
        - name: config
          mountPath: /app/config
          readOnly: true
        - name: data
          mountPath: /app/data
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 60
          periodSeconds: 30
          timeoutSeconds: 10
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
      volumes:
      - name: config
        configMap:
          name: codesight-config
      - name: data
        persistentVolumeClaim:
          claimName: codesight-data
---
apiVersion: v1
kind: Service
metadata:
  name: codesight-mcp
  namespace: codesight
  labels:
    app: codesight-mcp
spec:
  type: LoadBalancer
  ports:
  - name: http
    port: 80
    targetPort: http
    protocol: TCP
  selector:
    app: codesight-mcp
---
apiVersion: v1
kind: Service
metadata:
  name: codesight-metrics
  namespace: codesight
  labels:
    app: codesight-mcp
    component: metrics
spec:
  type: ClusterIP
  ports:
  - name: metrics
    port: 9090
    targetPort: metrics
    protocol: TCP
  selector:
    app: codesight-mcp
```

## CI/CD Configuration

### GitHub Actions Workflows

#### Main CI/CD Pipeline

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  NODE_VERSION: '18'
  RUST_VERSION: '1.75'
  REGISTRY: ghcr.io
  IMAGE_NAME: codesight-mcp

jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18, 20]

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'

    - name: Setup Rust
      uses: dtolnay/rust-toolchain@v1
      with:
        toolchain: ${{ env.RUST_VERSION }}
        components: rustfmt, clippy

    - name: Install dependencies
      run: npm ci

    - name: Run Rust tests
      run: |
        cd rust-core
        cargo test --release
        cargo clippy --release -- -D warnings

    - name: Run TypeScript tests
      run: |
        npm test
        npm run test:coverage
        npm run test:contract

    - name: Build project
      run: npm run build:full

    - name: Run integration tests
      run: npm run test:integration

    - name: Run performance tests
      run: npm run test:performance

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        flags: unittests
        name: codecov-umbrella

  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    needs: test

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'

    - name: Upload Trivy scan results to GitHub Security tab
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'

  build-and-push:
    name: Build and Push Docker Image
    runs-on: ubuntu-latest
    needs: [test, security-scan]
    if: github.ref == 'refs/heads/main'

    permissions:
      contents: read
      packages: write

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ github.repository }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=semver,pattern={{version}}
          type=semver,pattern={{major}}.{{minor}}

    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        platforms: linux/amd64,linux/arm64
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build-and-push
    if: github.ref == 'refs/heads/develop'
    environment: staging

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Deploy to Kubernetes
      uses: azure/k8s-deploy@v1
      with:
        manifests: |
          k8s/namespace.yaml
          k8s/configmap.yaml
          k8s/deployment.yaml
          k8s/service.yaml
        kubectl-version: 'latest'

    - name: Run smoke tests
      run: |
        npm run test:smoke

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build-and-push
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Deploy to Kubernetes
      uses: azure/k8s-deploy@v1
      with:
        manifests: |
          k8s/namespace.yaml
          k8s/configmap.yaml
          k8s/deployment.yaml
          k8s/service.yaml
          k8s/hpa.yaml
        kubectl-version: 'latest'

    - name: Run integration tests
      run: |
        npm run test:integration

    - name: Notify deployment
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        channel: '#deployments'
        webhook_url: ${{ secrets.SLACK_WEBHOOK }}
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

#### Performance Benchmark Workflow

```yaml
# .github/workflows/performance.yml
name: Performance Benchmarks

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 6 * * 1'  # Every Monday at 6 AM

jobs:
  benchmark:
    name: Run Performance Benchmarks
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Setup Rust
      uses: dtolnay/rust-toolchain@v1
      with:
        toolchain: '1.75'
        components: rustfmt

    - name: Install dependencies
      run: npm ci

    - name: Build project
      run: npm run build:full

    - name: Run Rust benchmarks
      run: |
        cd rust-core
        cargo bench --release

    - name: Run Node.js benchmarks
      run: npm run test:performance

    - name: Generate benchmark report
      run: npm run benchmark:report

    - name: Upload benchmark results
      uses: actions/upload-artifact@v3
      with:
        name: benchmark-results
        path: benchmark-results/

    - name: Comment PR with benchmark results
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v6
      with:
        script: |
          const fs = require('fs');
          const results = fs.readFileSync('benchmark-results/summary.json', 'utf8');
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: `## Performance Benchmark Results\n\n\`\`\`json\n${results}\n\`\`\``
          });
```

## Monitoring and Observability

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'codesight-mcp'
    static_configs:
      - targets: ['codesight-mcp:3001']
    metrics_path: '/metrics'
    scrape_interval: 30s
    scrape_timeout: 10s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

### Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "id": null,
    "title": "CodeSight MCP Server",
    "tags": ["codesight", "mcp"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{job=\"codesight-mcp\"}[5m])",
            "legendFormat": "{{method}} {{status}}"
          }
        ],
        "yAxes": [{ "min": 0 }]
      },
      {
        "id": 2,
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job=\"codesight-mcp\"}[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket{job=\"codesight-mcp\"}[5m]))",
            "legendFormat": "50th percentile"
          }
        ]
      },
      {
        "id": 3,
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "process_resident_memory_bytes{job=\"codesight-mcp\"}",
            "legendFormat": "Resident Memory"
          },
          {
            "expr": "process_virtual_memory_bytes{job=\"codesight-mcp\"}",
            "legendFormat": "Virtual Memory"
          }
        ]
      },
      {
        "id": 4,
        "title": "CPU Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(process_cpu_seconds_total{job=\"codesight-mcp\"}[5m]) * 100",
            "legendFormat": "CPU Usage %"
          }
        ]
      },
      {
        "id": 5,
        "title": "FFI Bridge Health",
        "type": "stat",
        "targets": [
          {
            "expr": "codesight_ffi_availability{job=\"codesight-mcp\"}",
            "legendFormat": "FFI Available"
          }
        ]
      },
      {
        "id": 6,
        "title": "Search Performance",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(codesight_search_requests_total{job=\"codesight-mcp\"}[5m])",
            "legendFormat": "Search Requests"
          },
          {
            "expr": "histogram_quantile(0.95, rate(codesight_search_duration_seconds_bucket{job=\"codesight-mcp\"}[5m]))",
            "legendFormat": "Search 95th %ile"
          }
        ]
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
```

## Security Configuration

### Network Policies

```yaml
# k8s/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: codesight-netpol
  namespace: codesight
spec:
  podSelector:
    matchLabels:
      app: codesight-mcp
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3001
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
```

### Resource Limits and Security Context

```yaml
# Security context configuration
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  runAsGroup: 1001
  fsGroup: 1001
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
    - ALL
  seccompProfile:
    type: RuntimeDefault

resources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "2Gi"
    cpu: "1000m"
```

## Backup and Recovery

### Database Backup Script

```bash
#!/bin/bash
# scripts/backup-db.sh
set -e

BACKUP_DIR="/backups/codesight"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p ${BACKUP_DIR}/${DATE}

# Backup PostgreSQL
kubectl exec -n codesight postgres-0 -- pg_dump -U postgres code_intelligence > \
  ${BACKUP_DIR}/${DATE}/postgres_backup.sql

# Backup Redis
kubectl exec -n codesight redis-master -- redis-cli --rdb /tmp/redis_backup.rdb
kubectl cp -n codesight redis-master:/tmp/redis_backup.rdb ${BACKUP_DIR}/${DATE}/redis_backup.rdb

# Compress backups
tar -czf ${BACKUP_DIR}/${DATE}/backup.tar.gz -C ${BACKUP_DIR}/${DATE} .

# Remove old backups
find ${BACKUP_DIR} -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} \;

echo "Backup completed: ${BACKUP_DIR}/${DATE}"
```

### Restore Script

```bash
#!/bin/bash
# scripts/restore-db.sh
set -e

BACKUP_PATH=$1

if [ -z "$BACKUP_PATH" ]; then
  echo "Usage: $0 <backup_path>"
  exit 1
fi

# Extract backup
tar -xzf ${BACKUP_PATH}/backup.tar.gz -C /tmp

# Restore PostgreSQL
kubectl exec -i -n codesight postgres-0 -- psql -U postgres code_intelligence < \
  /tmp/postgres_backup.sql

# Restore Redis
kubectl cp -n codesight /tmp/redis_backup.rdb redis-master:/data/dump.rdb
kubectl exec -n codesight redis-master -- redis-cli --rdb /data/dump.rdb

echo "Restore completed from: ${BACKUP_PATH}"
```

## Troubleshooting

### Common Issues and Solutions

#### Docker Issues

```bash
# Check container status
docker ps -a

# View logs
docker logs codesight-mcp

# Check resource usage
docker stats codesight-mcp

# Restart container
docker restart codesight-mcp

# Enter container for debugging
docker exec -it codesight-mcp sh
```

#### Kubernetes Issues

```bash
# Check pod status
kubectl get pods -n codesight

# Describe pod for events
kubectl describe pod <pod-name> -n codesight

# View logs
kubectl logs <pod-name> -n codesight

# Check resource usage
kubectl top pods -n codesight

# Port forward for local testing
kubectl port-forward service/codesight-mcp 3001:80 -n codesight
```

#### Performance Issues

```bash
# Check FFI bridge status
curl http://localhost:3001/health

# Monitor performance metrics
curl http://localhost:9090/metrics

# Check database connections
kubectl exec -it <postgres-pod> -n codesight -- psql -U postgres -c "SELECT * FROM pg_stat_activity;"

# Check Redis status
kubectl exec -it <redis-pod> -n codesight -- redis-cli info
```

## Best Practices

### Development

1. **Always test with both Rust FFI enabled and disabled**
2. **Use environment-specific configuration files**
3. **Implement proper error handling across FFI boundaries**
4. **Monitor performance metrics during development**
5. **Use Docker for consistent development environments**

### Production

1. **Use non-root containers with proper security contexts**
2. **Implement resource limits and requests**
3. **Set up comprehensive monitoring and alerting**
4. **Configure automated backups and disaster recovery**
5. **Use network policies for network segmentation**
6. **Implement proper secrets management**

### Performance

1. **Enable caching with appropriate TTL values**
2. **Configure connection pooling for databases**
3. **Use horizontal pod autoscaling for variable loads**
4. **Monitor memory usage and optimize as needed**
5. **Regular performance testing and benchmarking**

---

**Need help?** Check our [main README](../README.md#troubleshooting) or join the [community discussions](https://github.com/codesight/codesight-mcp/discussions).
