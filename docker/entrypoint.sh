#!/bin/bash
# Docker entrypoint script for Code Intelligence MCP Server
# Generated: 2025-01-27

set -e

# Default values
MODE=${1:-hybrid}
PORT=${PORT:-4000}
MCP_PORT=${MCP_PORT:-8080}
LOG_LEVEL=${LOG_LEVEL:-info}
DATA_DIR=${DATA_DIR:-/app/data}
CACHE_DIR=${CACHE_DIR:-/app/cache}

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check if a service is running
check_service() {
    local service_name=$1
    local port=$2
    local max_attempts=30
    local attempt=1
    
    log "Checking if $service_name is running on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z localhost $port 2>/dev/null; then
            log "$service_name is running on port $port"
            return 0
        fi
        
        log "Attempt $attempt/$max_attempts: $service_name not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log "ERROR: $service_name failed to start on port $port after $max_attempts attempts"
    return 1
}

# Function to start the MCP server
start_mcp_server() {
    log "Starting MCP server on port $MCP_PORT..."
    
    export NODE_ENV=production
    export LOG_LEVEL=$LOG_LEVEL
    export MCP_PORT=$MCP_PORT
    export DATA_DIR=$DATA_DIR
    export CACHE_DIR=$CACHE_DIR
    
    node dist/mcp-server.js &
    MCP_PID=$!
    
    # Wait for MCP server to be ready
    if check_service "MCP Server" $MCP_PORT; then
        log "MCP server started successfully (PID: $MCP_PID)"
    else
        log "ERROR: Failed to start MCP server"
        exit 1
    fi
}

# Function to start the REST API server
start_rest_server() {
    log "Starting REST API server on port $PORT..."
    
    export NODE_ENV=production
    export LOG_LEVEL=$LOG_LEVEL
    export PORT=$PORT
    export DATA_DIR=$DATA_DIR
    export CACHE_DIR=$CACHE_DIR
    
    node dist/rest-server.js &
    REST_PID=$!
    
    # Wait for REST server to be ready
    if check_service "REST Server" $PORT; then
        log "REST API server started successfully (PID: $REST_PID)"
    else
        log "ERROR: Failed to start REST API server"
        exit 1
    fi
}

# Function to start the hybrid server (both MCP and REST)
start_hybrid_server() {
    log "Starting hybrid server (MCP + REST)..."
    
    export NODE_ENV=production
    export LOG_LEVEL=$LOG_LEVEL
    export PORT=$PORT
    export MCP_PORT=$MCP_PORT
    export DATA_DIR=$DATA_DIR
    export CACHE_DIR=$CACHE_DIR
    
    node dist/index.js &
    HYBRID_PID=$!
    
    # Wait for both services to be ready
    if check_service "Hybrid Server (REST)" $PORT && check_service "Hybrid Server (MCP)" $MCP_PORT; then
        log "Hybrid server started successfully (PID: $HYBRID_PID)"
    else
        log "ERROR: Failed to start hybrid server"
        exit 1
    fi
}

# Function to handle shutdown
shutdown() {
    log "Received shutdown signal, stopping services..."
    
    if [ ! -z "$MCP_PID" ]; then
        log "Stopping MCP server (PID: $MCP_PID)..."
        kill -TERM $MCP_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$REST_PID" ]; then
        log "Stopping REST server (PID: $REST_PID)..."
        kill -TERM $REST_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$HYBRID_PID" ]; then
        log "Stopping hybrid server (PID: $HYBRID_PID)..."
        kill -TERM $HYBRID_PID 2>/dev/null || true
    fi
    
    # Wait for processes to terminate
    sleep 5
    
    log "Shutdown complete"
    exit 0
}

# Set up signal handlers
trap shutdown SIGTERM SIGINT

# Ensure required directories exist
mkdir -p "$DATA_DIR" "$CACHE_DIR" /app/logs

# Set proper permissions
chown -R codeint:codeint "$DATA_DIR" "$CACHE_DIR" /app/logs 2>/dev/null || true

# Initialize the database if needed
if [ ! -f "$DATA_DIR/code_intelligence.db" ]; then
    log "Initializing database..."
    node dist/scripts/init-db.js
fi

# Start services based on mode
case "$MODE" in
    "mcp")
        log "Starting in MCP-only mode"
        start_mcp_server
        wait $MCP_PID
        ;;
    "rest")
        log "Starting in REST-only mode"
        start_rest_server
        wait $REST_PID
        ;;
    "hybrid")
        log "Starting in hybrid mode (MCP + REST)"
        start_hybrid_server
        wait $HYBRID_PID
        ;;
    "cli")
        log "Starting in CLI mode"
        exec node dist/cli/index.js "${@:2}"
        ;;
    *)
        log "ERROR: Unknown mode '$MODE'. Available modes: mcp, rest, hybrid, cli"
        exit 1
        ;;
esac

log "Service stopped"