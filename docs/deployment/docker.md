---
sidebar_position: 1
---

# Docker Deployment

This guide covers deploying the Code Intelligence MCP Server using Docker containers. Docker provides a consistent, portable deployment environment that works across different platforms.

## Prerequisites

- Docker Engine 20.10 or later
- Docker Compose 2.0 or later
- At least 4GB RAM available for containers
- 10GB free disk space for images and data

## Quick Start with Docker

### Using Pre-built Image

The fastest way to get started is using our pre-built Docker image:

```bash
# Pull the latest image
docker pull code-intelligence/mcp-server:latest

# Run with basic configuration
docker run -d \
  --name code-intel-server \
  -p 3000:3000 \
  -v /path/to/your/code:/workspace \
  -v code-intel-data:/app/data \
  -e NODE_ENV=production \
  code-intelligence/mcp-server:latest
```

### Verify Deployment

```bash
# Check container status
docker ps

# Check logs
docker logs code-intel-server

# Test health endpoint
curl http://localhost:3000/health
```

## Docker Compose Deployment

### Basic Setup

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  code-intelligence:
    image: code-intelligence/mcp-server:latest
    container_name: code-intel-server
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./workspace:/workspace:ro
      - code-intel-data:/app/data
      - ./config:/app/config:ro
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - MAX_WORKERS=4
      - MEMORY_LIMIT=2048
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    networks:
      - code-intel-network

volumes:
  code-intel-data:
    driver: local

networks:
  code-intel-network:
    driver: bridge
```

### Production Setup with Database

For production deployments with external database:

```yaml
version: '3.8'

services:
  code-intelligence:
    image: code-intelligence/mcp-server:latest
    container_name: code-intel-server
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./workspace:/workspace:ro
      - code-intel-data:/app/data
      - ./config:/app/config:ro
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - MAX_WORKERS=8
      - MEMORY_LIMIT=4096
      - DATABASE_URL=postgresql://user:password@postgres:5432/code_intel
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 120s
    networks:
      - code-intel-network

  postgres:
    image: postgres:15-alpine
    container_name: code-intel-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=code_intel
      - POSTGRES_USER=code_intel_user
      - POSTGRES_PASSWORD=secure_password_here
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U code_intel_user -d code_intel"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - code-intel-network

  redis:
    image: redis:7-alpine
    container_name: code-intel-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass redis_password_here
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks:
      - code-intel-network

  nginx:
    image: nginx:alpine
    container_name: code-intel-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - nginx-logs:/var/log/nginx
    depends_on:
      - code-intelligence
    networks:
      - code-intel-network

volumes:
  code-intel-data:
  postgres-data:
  redis-data:
  nginx-logs:

networks:
  code-intel-network:
    driver: bridge
```

### Deploy with Docker Compose

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f code-intelligence

# Stop services
docker-compose down

# Stop and remove volumes (careful!)
docker-compose down -v
```

## Building Custom Images

### Multi-stage Dockerfile

Create a custom `Dockerfile`:

```dockerfile
# Build stage for Rust components
FROM rust:1.75-slim as rust-builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy Rust source
COPY rust-core/ ./rust-core/

# Build Rust components
WORKDIR /app/rust-core
RUN cargo build --release

# Build stage for TypeScript components
FROM node:18-alpine as node-builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY typescript-mcp/package*.json ./typescript-mcp/

# Install dependencies
RUN npm ci --only=production

# Copy TypeScript source
COPY typescript-mcp/ ./typescript-mcp/

# Build TypeScript
WORKDIR /app/typescript-mcp
RUN npm run build

# Production stage
FROM node:18-alpine as production

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
COPY --from=rust-builder /app/rust-core/target/release/librust_core.so ./lib/
COPY --from=node-builder /app/node_modules ./node_modules/
COPY --from=node-builder /app/typescript-mcp/dist ./dist/

# Copy configuration and scripts
COPY docker/entrypoint.sh ./
COPY docker/config.json ./config/

# Set permissions
RUN chown -R nodejs:nodejs /app && \
    chmod +x ./entrypoint.sh

# Create data directories
RUN mkdir -p /app/data /app/logs && \
    chown -R nodejs:nodejs /app/data /app/logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./entrypoint.sh"]
```

### Build Script

Create `scripts/build-docker.sh`:

```bash
#!/bin/bash
set -e

# Configuration
IMAGE_NAME="code-intelligence/mcp-server"
VERSION=${1:-"latest"}
PLATFORM=${2:-"linux/amd64,linux/arm64"}

echo "Building Docker image: ${IMAGE_NAME}:${VERSION}"

# Build multi-platform image
docker buildx build \
    --platform ${PLATFORM} \
    --tag ${IMAGE_NAME}:${VERSION} \
    --tag ${IMAGE_NAME}:latest \
    --push \
    .

echo "Build completed successfully!"
```

## Configuration Management

### Environment Variables

Key environment variables for Docker deployment:

```bash
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Performance
MAX_WORKERS=4
MEMORY_LIMIT=2048
CPU_LIMIT=2

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379

# Security
API_KEY_SECRET=your-secret-key
JWT_SECRET=your-jwt-secret
CORS_ORIGIN=https://your-domain.com

# Features
ENABLE_METRICS=true
ENABLE_TRACING=true
ENABLE_PROFILING=false
```

### Configuration Files

Create `config/production.json`:

```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0",
    "timeout": 30000
  },
  "indexing": {
    "maxWorkers": 8,
    "batchSize": 100,
    "memoryLimit": "2GB"
  },
  "search": {
    "cacheSize": 1000,
    "cacheTTL": 3600
  },
  "security": {
    "rateLimit": {
      "windowMs": 900000,
      "max": 1000
    }
  },
  "monitoring": {
    "metrics": {
      "enabled": true,
      "port": 9090
    },
    "healthCheck": {
      "enabled": true,
      "interval": 30000
    }
  }
}
```

## Nginx Configuration

Create `nginx.conf` for reverse proxy:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream code_intelligence {
        server code-intelligence:3000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    server {
        listen 80;
        server_name your-domain.com;
        
        # Redirect HTTP to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
        ssl_prefer_server_ciphers off;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

        # Gzip compression
        gzip on;
        gzip_vary on;
        gzip_min_length 1024;
        gzip_types text/plain application/json application/javascript text/css;

        location / {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://code_intelligence;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        location /health {
            proxy_pass http://code_intelligence/health;
            access_log off;
        }

        location /metrics {
            proxy_pass http://code_intelligence:9090/metrics;
            allow 10.0.0.0/8;
            allow 172.16.0.0/12;
            allow 192.168.0.0/16;
            deny all;
        }
    }
}
```

## Monitoring and Logging

### Docker Compose with Monitoring

```yaml
version: '3.8'

services:
  # ... existing services ...

  prometheus:
    image: prom/prometheus:latest
    container_name: code-intel-prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    networks:
      - code-intel-network

  grafana:
    image: grafana/grafana:latest
    container_name: code-intel-grafana
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin_password_here
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
      - ./grafana/datasources:/etc/grafana/provisioning/datasources:ro
    networks:
      - code-intel-network

  loki:
    image: grafana/loki:latest
    container_name: code-intel-loki
    restart: unless-stopped
    ports:
      - "3100:3100"
    volumes:
      - ./loki-config.yml:/etc/loki/local-config.yaml:ro
      - loki-data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    networks:
      - code-intel-network

volumes:
  prometheus-data:
  grafana-data:
  loki-data:
```

### Log Management

Configure centralized logging:

```yaml
# Add to your main service
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
    labels: "service=code-intelligence"
```

## Backup and Recovery

### Backup Script

Create `scripts/backup.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/backups/code-intelligence"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p ${BACKUP_DIR}/${DATE}

# Backup database
docker exec code-intel-postgres pg_dump -U code_intel_user code_intel > \
    ${BACKUP_DIR}/${DATE}/database.sql

# Backup data volumes
docker run --rm -v code-intel-data:/data -v ${BACKUP_DIR}/${DATE}:/backup \
    alpine tar czf /backup/data.tar.gz -C /data .

# Backup configuration
cp -r ./config ${BACKUP_DIR}/${DATE}/

echo "Backup completed: ${BACKUP_DIR}/${DATE}"
```

### Recovery Script

Create `scripts/restore.sh`:

```bash
#!/bin/bash
set -e

BACKUP_PATH=$1

if [ -z "$BACKUP_PATH" ]; then
    echo "Usage: $0 <backup_path>"
    exit 1
fi

# Stop services
docker-compose down

# Restore database
docker-compose up -d postgres
sleep 10
docker exec -i code-intel-postgres psql -U code_intel_user code_intel < \
    ${BACKUP_PATH}/database.sql

# Restore data
docker run --rm -v code-intel-data:/data -v ${BACKUP_PATH}:/backup \
    alpine tar xzf /backup/data.tar.gz -C /data

# Start all services
docker-compose up -d

echo "Restore completed from: ${BACKUP_PATH}"
```

## Troubleshooting

### Common Issues

**Container won't start:**
```bash
# Check logs
docker logs code-intel-server

# Check resource usage
docker stats

# Inspect container
docker inspect code-intel-server
```

**Performance issues:**
```bash
# Monitor resource usage
docker stats --no-stream

# Check container limits
docker inspect code-intel-server | grep -i memory

# Adjust resources in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 4G
      cpus: '2'
```

**Network connectivity:**
```bash
# Test internal connectivity
docker exec code-intel-server curl http://postgres:5432

# Check network configuration
docker network ls
docker network inspect code-intel-network
```

### Health Checks

Monitor container health:

```bash
# Check health status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Detailed health check
docker inspect --format='{{json .State.Health}}' code-intel-server
```

## Security Best Practices

1. **Use non-root user in containers**
2. **Scan images for vulnerabilities**
3. **Use secrets management**
4. **Enable container security scanning**
5. **Implement network segmentation**
6. **Regular security updates**

```bash
# Scan image for vulnerabilities
docker scout cves code-intelligence/mcp-server:latest

# Use Docker secrets
docker secret create db_password password.txt
```

## Next Steps

- [Kubernetes Deployment](kubernetes) for orchestration
- [Cloud Platforms](cloud-platforms) for managed services
- [Scaling Guide](scaling) for high availability
- [Security Guide](security) for production hardening

---

**Need help?** Check our [troubleshooting guide](../troubleshooting/common-issues) or join the [community discussions](https://github.com/your-org/code-intelligence-mcp/discussions).