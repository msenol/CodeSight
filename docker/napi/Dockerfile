# Multi-stage Docker build for CodeSight NAPI-RS integration
# Generated: 2025-01-27

# Stage 1: Rust builder
FROM rust:1.75-slim AS rust-builder

# Install system dependencies for Rust compilation
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js for NAPI-RS CLI
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install NAPI-RS CLI globally
RUN npm install -g @napi-rs/cli

# Set working directory
WORKDIR /app

# Copy Rust source code
COPY rust-core/ rust-core/

# Copy package files for caching
COPY typescript-mcp/package.json typescript-mcp/package-lock.json ./typescript-mcp/

# Build Rust FFI module for Linux x64
WORKDIR /app/rust-core
RUN cargo build --release --package code-intelligence-ffi --target x86_64-unknown-linux-gnu

# Package with NAPI-RS
RUN napi build --platform --target x86_64-unknown-linux-gnu

# Stage 2: Node.js builder
FROM node:20-slim AS node-builder

WORKDIR /app

# Copy package files
COPY typescript-mcp/package.json typescript-mcp/package-lock.json ./

# Install dependencies
RUN npm ci

# Copy TypeScript source code
COPY typescript-mcp/ ./

# Copy built native module from Rust builder
COPY --from=rust-builder /app/rust-core/target/x86_64-unknown-linux-gnu/release/libcode_intelligence_ffi.so ./codesight-native.node

# Build TypeScript project
RUN npm run build

# Stage 3: Production runtime
FROM node:20-slim AS production

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd --create-home --shell /bin/bash codesight

WORKDIR /app

# Copy built artifacts from node-builder
COPY --from=node-builder --chown=codesight:codesight /app/dist ./dist
COPY --from=node-builder --chown=codesight:codesight /app/codesight-native.node ./codesight-native.node
COPY --from=node-builder --chown=codesight:codesight /app/package.json ./package.json

# Create directories for data and logs
RUN mkdir -p /app/data /app/logs /app/cache \
    && chown -R codesight:codesight /app

# Switch to non-root user
USER codesight

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node dist/health-check-cli.js || exit 1

# Expose port
EXPOSE 4000

# Environment variables
ENV NODE_ENV=production
ENV RUST_FFI_ENABLED=true
ENV RUST_FFI_PATH=/app/codesight-native.node

# Set entrypoint
ENTRYPOINT ["dumb-init", "--"]

# Default command
CMD ["node", "dist/index.js"]