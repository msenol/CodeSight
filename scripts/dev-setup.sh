#!/bin/bash

# CodeSight MCP Development Environment Setup Script
# This script sets up a complete development environment with Docker

set -e

echo "🚀 Setting up CodeSight MCP Development Environment..."

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p data/logs
mkdir -p data/certs
mkdir -p test-data/sample-project
mkdir -p docker/postgres

# Create a sample test project
echo "📝 Creating sample test project..."
cat > test-data/sample-project/example.ts << 'EOF'
/**
 * Example function for testing CodeSight MCP
 * This function demonstrates basic TypeScript syntax
 */
export function calculateSum(a: number, b: number): number {
    return a + b;
}

/**
 * Example class for testing
 */
export class Calculator {
    private history: number[] = [];

    /**
     * Add a number to the calculator history
     */
    add(value: number): void {
        this.history.push(value);
    }

    /**
     * Get the sum of all numbers in history
     */
    getTotal(): number {
        return this.history.reduce((sum, value) => sum + value, 0);
    }

    /**
     * Clear the calculator history
     */
    clear(): void {
        this.history = [];
    }
}

// Export instance for testing
export const calculator = new Calculator();
EOF

cat > test-data/sample-project/package.json << 'EOF'
{
  "name": "test-project",
  "version": "1.0.0",
  "description": "Test project for CodeSight MCP",
  "main": "example.ts",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": ["test", "typescript"],
  "author": "CodeSight Team",
  "license": "MIT"
}
EOF

# Environment setup
echo "🔧 Setting up environment variables..."
if [ ! -f .env.dev ]; then
    cat > .env.dev << 'EOF'
# Development Environment Variables
NODE_ENV=development
LOG_LEVEL=debug
PORT=4000
HOST=0.0.0.0

# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5433/codesight_dev
REDIS_URL=redis://localhost:6380

# Storage Configuration
STORAGE_BACKEND=postgresql
CACHE_BACKEND=redis

# Rust FFI Configuration
RUST_FFI_PATH=./rust-core/target/release
ENABLE_RUST_FFI=true
FFI_GRACEFUL_FALLBACK=true

# Development Features
HOT_RELOAD=true
ENABLE_DEBUG=true
ENABLE_PROFILING=true

# Security (development only - less strict)
JWT_SECRET=dev-jwt-secret-not-for-production
API_KEY=dev-api-key-not-for-production
CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
ENABLE_TRACING=true
EOF
    echo "✅ Created .env.dev file"
else
    echo "ℹ️  .env.dev file already exists"
fi

# Create development docker-compose override
echo "🐳 Setting up Docker development environment..."
if [ ! -f docker-compose.override.yml ]; then
    cat > docker-compose.override.yml << 'EOF'
version: '3.8'

services:
  codesight-dev:
    volumes:
      - .:/app:cached
      - /app/node_modules
      - rust-core-target:/app/rust-core/target
    environment:
      - NODE_ENV=development
      - HOT_RELOAD=true
    command: npm run dev

  postgres-dev:
    ports:
      - "5433:5432"

  redis-dev:
    ports:
      - "6380:6379"
EOF
    echo "✅ Created docker-compose.override.yml"
else
    echo "ℹ️  docker-compose.override.yml already exists"
fi

# Build and start development environment
echo "🔨 Building development Docker images..."
docker-compose -f docker-compose.dev.yml build

echo "🚀 Starting development environment..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are healthy
echo "🔍 Checking service health..."
if docker-compose -f docker-compose.dev.yml ps | grep -q "Up"; then
    echo "✅ Development environment is running!"
else
    echo "❌ Some services failed to start. Check the logs:"
    docker-compose -f docker-compose.dev.yml logs
    exit 1
fi

# Index the test project
echo "📊 Indexing test project..."
sleep 5
docker-compose -f docker-compose.dev.yml exec -T codesight-dev node dist/cli/index.js index /app/test-data/sample-project || echo "⚠️  Indexing failed, but environment is ready"

# Display access information
echo ""
echo "🎉 CodeSight MCP Development Environment is ready!"
echo ""
echo "📋 Access Information:"
echo "  • MCP Server (REST API): http://localhost:4000"
echo "  • MCP Server (WebSocket): ws://localhost:8080"
echo "  • Node.js Debugger: localhost:9229"
echo "  • PostgreSQL Database: localhost:5433"
echo "  • Redis Cache: localhost:6380"
echo "  • pgAdmin (Database UI): http://localhost:5050"
echo "    - Email: admin@codesight.dev"
echo "    - Password: admin"
echo "  • Redis Commander: http://localhost:8081"
echo "  • Documentation: http://localhost:3000"
echo ""
echo "🔧 Development Commands:"
echo "  • View logs: docker-compose -f docker-compose.dev.yml logs -f"
echo "  • Stop environment: docker-compose -f docker-compose.dev.yml down"
echo "  • Restart service: docker-compose -f docker-compose.dev.yml restart codesight-dev"
echo "  • Access container: docker-compose -f docker-compose.dev.yml exec codesight-dev bash"
echo ""
echo "🧪 Testing Commands:"
echo "  • Test MCP server: curl http://localhost:4000/health"
echo "  • Search code: curl -X POST http://localhost:4000/api/search -H 'Content-Type: application/json' -d '{\"query\": \"function\"}'"
echo "  • View stats: curl http://localhost:4000/api/stats"
echo ""
echo "📚 Documentation: Check the /docs directory for API documentation"
echo "💡 Tip: Use 'docker-compose -f docker-compose.dev.yml logs -f codesight-dev' to watch real-time logs"
echo ""