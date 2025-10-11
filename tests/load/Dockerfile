# Dockerfile for CodeSight MCP Load Testing Suite (T085)
# Multi-stage build for k6 load testing environment

FROM node:18-alpine AS base

# Install k6
RUN apk add --no-cache \
    curl \
    bash \
    && curl -L https://github.com/grafana/k6/releases/download/v0.46.0/k6-v0.46.0-linux-amd64.tar.gz -o k6.tar.gz \
    && tar -xzf k6.tar.gz -C /usr/local/bin \
    && rm k6.tar.gz

# Install k6-reporter for HTML reports
RUN npm install -g k6-reporter

WORKDIR /scripts

# Copy test files
COPY *.js ./
COPY package.json ./
COPY README.md ./

# Set permissions
RUN chmod +x *.js

# Environment variables
ENV K6_PROMETHEUS_RW_SERVER_URL=http://prometheus:9090/api/v1/write
ENV K6_STATSD_ENABLED=false
ENV K6_DASHBOARD_ENABLED=false

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD k6 version || exit 1

# Create non-root user for security
RUN addgroup -g 1001 -S k6user && \
    adduser -S k6user -u 1001 -G k6user
RUN chown -R k6user:k6user /scripts
USER k6user

# Default command - show help
CMD ["npm", "run", "help"]