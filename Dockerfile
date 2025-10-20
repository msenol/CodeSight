# Multi-stage Docker build for Code Intelligence MCP Server
# Stage 1: Rust build environment
FROM rust:1.80-slim as rust-builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Rust workspace files
COPY rust-core/Cargo.toml rust-core/Cargo.lock ./
COPY rust-core/crates ./crates

# Build Rust components
RUN cargo build --release

# Stage 2: Node.js build environment
FROM node:25-slim as node-builder

# Install system dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy TypeScript MCP files
COPY typescript-mcp/package*.json ./
RUN npm ci --only=production

# Copy source code and build
COPY typescript-mcp/src ./src
COPY typescript-mcp/tsconfig.json ./
RUN npm run build

# Stage 3: Runtime environment
FROM node:25-slim as runtime

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r codeint \
    && useradd -r -g codeint codeint

# Set working directory
WORKDIR /app

# Copy built artifacts from previous stages
COPY --from=rust-builder /app/target/release/libcode_intelligence_core.so ./lib/
COPY --from=node-builder /app/dist ./dist
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/package.json ./

# Copy configuration files
COPY docker/config.json ./config/
COPY docker/entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Create data directories
RUN mkdir -p /app/data /app/logs /app/cache \
    && chown -R codeint:codeint /app

# Switch to non-root user
USER codeint

# Expose ports
EXPOSE 4000 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node dist/health-check.js

# Set environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV DATA_DIR=/app/data
ENV CACHE_DIR=/app/cache

# Entry point
ENTRYPOINT ["./entrypoint.sh"]
CMD ["hybrid"]