#!/bin/sh
# Production Docker Entrypoint Script
# Security-focused with health monitoring

set -e

echo "🚀 CodeSight MCP Server - Production Starting..."

# Validate environment
if [ -z "$NODE_ENV" ]; then
    echo "❌ NODE_ENV not set"
    exit 1
fi

if [ "$NODE_ENV" = "production" ]; then
    echo "✅ Production mode enabled"
fi

# Check FFI library (optional)
if [ "$ENABLE_RUST_FFI" = "true" ] && [ -n "$RUST_FFI_PATH" ]; then
    if [ -f "$RUST_FFI_PATH/libcode_intelligence_core.so" ]; then
        echo "✅ Rust FFI library found"
    else
        echo "⚠️  Rust FFI library not found - using graceful fallback"
    fi
fi

# Create data directories if needed
mkdir -p "${DATA_DIR:-/app/data}" 2>/dev/null || true
mkdir -p "${CACHE_DIR:-/app/cache}" 2>/dev/null || true
mkdir -p "/app/logs" 2>/dev/null || true

# Security: Disable unnecessary features
export NODE_NO_WARNINGS=1
export NODE_TLS_REJECT_UNAUTHORIZED=1
export UV_THREADPOOL_SIZE=16

# Log startup info
echo "📊 Configuration:"
echo "   - NODE_ENV: $NODE_ENV"
echo "   - LOG_LEVEL: ${LOG_LEVEL:-info}"
echo "   - MAX_MEMORY: ${NODE_OPTIONS:-default}"
echo "   - FFI_ENABLED: ${ENABLE_RUST_FFI:-false}"
echo ""

# Start application with error handling
exec node --enable-source-maps dist/index.js "$@"
