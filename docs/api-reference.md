# CodeSight MCP Server - API Reference

## Overview

The CodeSight MCP Server provides a comprehensive REST API for code intelligence operations alongside the MCP protocol interface. This reference covers all available endpoints, authentication, and usage examples.

## Base Configuration

### Development Server
- **Base URL**: `http://localhost:4000`
- **Protocol**: HTTP/HTTPS
- **Content-Type**: `application/json`

### Production Server
- **Base URL**: `https://your-domain.com`
- **Protocol**: HTTPS only
- **Authentication**: JWT token required

## Authentication

### Development
No authentication required in development mode.

### Production
```bash
# JWT Token Authentication
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     https://your-domain.com/api/codebases
```

## API Endpoints

### Health Check Endpoints

#### GET /health
Simple health check returning server status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-08T10:30:00.000Z",
  "version": "0.1.0",
  "uptime": 3600
}
```

#### GET /health/detailed
Comprehensive health check with component status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-08T10:30:00.000Z",
  "uptime": 3600,
  "components": {
    "database": "healthy",
    "rust_ffi": "healthy",
    "cache": "healthy",
    "indexer": "healthy"
  },
  "version": "0.1.0",
  "memory": {
    "used_mb": 25,
    "available_mb": 1024
  }
}
```

#### GET /health/ready
Readiness check for load balancer integration.

**Response:**
```json
{
  "ready": true,
  "timestamp": "2025-01-08T10:30:00.000Z",
  "checks": {
    "database": "ready",
    "mcp_server": "ready"
  }
}
```

#### GET /health/live
Liveness check for container orchestration.

**Response:**
```json
{
  "alive": true,
  "timestamp": "2025-01-08T10:30:00.000Z",
  "uptime": 3600
}
```

### Codebase Management

#### GET /api/codebases
List all indexed codebases.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `sort` (optional): Sort field (name, created_at, updated_at)
- `order` (optional): Sort order (asc, desc)

**Response:**
```json
{
  "success": true,
  "codebases": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "my-project",
      "path": "/path/to/my-project",
      "language": "typescript",
      "status": "indexed",
      "created_at": "2025-01-08T10:00:00.000Z",
      "updated_at": "2025-01-08T10:30:00.000Z",
      "stats": {
        "files_count": 47,
        "entities_count": 377,
        "functions_count": 175,
        "classes_count": 48
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

#### POST /api/codebases
Create a new codebase entry.

**Request Body:**
```json
{
  "name": "my-project",
  "path": "/path/to/my-project",
  "language": "typescript",
  "description": "My TypeScript project"
}
```

**Response:**
```json
{
  "success": true,
  "codebase": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "my-project",
    "path": "/path/to/my-project",
    "language": "typescript",
    "description": "My TypeScript project",
    "status": "pending",
    "created_at": "2025-01-08T10:30:00.000Z",
    "updated_at": "2025-01-08T10:30:00.000Z"
  }
}
```

#### GET /api/codebases/{id}
Get details of a specific codebase.

**Path Parameters:**
- `id`: Codebase UUID

**Response:**
```json
{
  "success": true,
  "codebase": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "my-project",
    "path": "/path/to/my-project",
    "language": "typescript",
    "description": "My TypeScript project",
    "status": "indexed",
    "created_at": "2025-01-08T10:00:00.000Z",
    "updated_at": "2025-01-08T10:30:00.000Z",
    "stats": {
      "files_count": 47,
      "entities_count": 377,
      "functions_count": 175,
      "classes_count": 48,
      "interfaces_count": 140,
      "types_count": 14
    },
    "configuration": {
      "indexing_options": {
        "include_patterns": ["**/*.ts", "**/*.js"],
        "exclude_patterns": ["node_modules/**", "dist/**"]
      }
    }
  }
}
```

#### DELETE /api/codebases/{id}
Delete a codebase and all associated data.

**Path Parameters:**
- `id`: Codebase UUID

**Response:**
```json
{
  "success": true,
  "message": "Codebase deleted successfully"
}
```

#### POST /api/codebases/{id}/index
Start indexing process for a codebase.

**Path Parameters:**
- `id`: Codebase UUID

**Request Body (optional):**
```json
{
  "force_reindex": false,
  "indexing_options": {
    "parallel_workers": 4,
    "batch_size": 500
  }
}
```

**Response:**
```json
{
  "success": true,
  "job_id": "job-uuid-123",
  "message": "Indexing started",
  "estimated_duration": "2-3 minutes"
}
```

#### GET /api/codebases/{id}/stats
Get detailed statistics for a codebase.

**Path Parameters:**
- `id`: Codebase UUID

**Response:**
```json
{
  "success": true,
  "stats": {
    "files_count": 47,
    "entities_count": 377,
    "functions_count": 175,
    "classes_count": 48,
    "interfaces_count": 140,
    "types_count": 14,
    "lines_of_code": 15420,
    "last_indexed": "2025-01-08T10:30:00.000Z",
    "indexing_duration_ms": 1500,
    "languages": [
      {
        "name": "typescript",
        "files_count": 35,
        "lines_count": 12000
      },
      {
        "name": "javascript",
        "files_count": 12,
        "lines_count": 3420
      }
    ]
  }
}
```

### Search Operations

#### POST /api/queries
Perform natural language search across codebases.

**Request Body:**
```json
{
  "query": "user authentication functions",
  "codebase_id": "550e8400-e29b-41d4-a716-446655440000",
  "limit": 10,
  "offset": 0,
  "filters": {
    "file_types": ["ts", "js"],
    "entity_types": ["function", "class"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "entity-uuid-123",
      "name": "authenticateUser",
      "type": "function",
      "file_path": "src/auth/auth.service.ts",
      "line_number": 45,
      "score": 0.95,
      "snippet": "export async function authenticateUser(credentials: LoginCredentials): Promise<User>",
      "context": [
        "// Authenticate user with provided credentials",
        "export async function authenticateUser(credentials: LoginCredentials): Promise<User> {",
        "  const user = await userRepository.findByEmail(credentials.email);",
        "  if (!user || !await bcrypt.compare(credentials.password, user.passwordHash)) {",
        "    throw new UnauthorizedError('Invalid credentials');",
        "  }",
        "  return user;",
        "}"
      ]
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 25,
    "has_more": true
  },
  "query_intent": "find_function",
  "execution_time_ms": 45
}
```

### Job Management

#### GET /api/jobs
List all background jobs.

**Query Parameters:**
- `status` (optional): Filter by status (pending, running, completed, failed)
- `type` (optional): Filter by job type (indexing, analysis)
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "id": "job-uuid-123",
      "type": "indexing",
      "status": "completed",
      "progress": 100,
      "created_at": "2025-01-08T10:30:00.000Z",
      "started_at": "2025-01-08T10:30:05.000Z",
      "completed_at": "2025-01-08T10:31:30.000Z",
      "result": {
        "files_processed": 47,
        "entities_indexed": 377
      }
    }
  ]
}
```

#### GET /api/jobs/{id}
Get details of a specific job.

**Path Parameters:**
- `id`: Job UUID

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "job-uuid-123",
    "type": "indexing",
    "status": "running",
    "progress": 75,
    "created_at": "2025-01-08T10:30:00.000Z",
    "started_at": "2025-01-08T10:30:05.000Z",
    "estimated_completion": "2025-01-08T10:31:45.000Z",
    "details": {
      "current_file": "src/services/user.service.ts",
      "files_processed": 35,
      "total_files": 47,
      "entities_indexed": 280
    }
  }
}
```

### MCP Tools (REST API Alternative)

#### POST /api/tools/search_code
REST API alternative to the `search_code` MCP tool.

**Request Body:**
```json
{
  "query": "authentication functions",
  "codebase_id": "codebase-uuid",
  "limit": 10,
  "file_types": ["ts", "js"],
  "include_content": true
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "file_path": "src/auth/auth.service.ts",
      "line_number": 45,
      "content": "export async function authenticateUser(credentials: LoginCredentials): Promise<User>",
      "score": 0.95,
      "match_type": "semantic"
    }
  ],
  "metadata": {
    "total_results": 5,
    "search_time_ms": 25,
    "files_searched": 47
  }
}
```

#### POST /api/tools/explain_function
REST API alternative to the `explain_function` MCP tool.

**Request Body:**
```json
{
  "function_identifier": "authenticateUser",
  "codebase_id": "codebase-uuid",
  "detail_level": "comprehensive",
  "include_examples": true
}
```

**Response:**
```json
{
  "success": true,
  "explanation": "The authenticateUser function validates user credentials against the database...",
  "function_info": {
    "name": "authenticateUser",
    "signature": "async function authenticateUser(credentials: LoginCredentials): Promise<User>",
    "parameters": [
      {
        "name": "credentials",
        "type": "LoginCredentials",
        "optional": false
      }
    ],
    "return_type": "Promise<User>",
    "location": {
      "file_path": "src/auth/auth.service.ts",
      "line_number": 45
    }
  },
  "examples": [
    {
      "code": "const user = await authenticateUser({ email: 'user@example.com', password: 'password123' });",
      "description": "Basic authentication usage"
    }
  ]
}
```

### Metrics and Monitoring

#### GET /metrics
Prometheus-compatible metrics endpoint.

**Response (text/plain):**
```
# HELP codesight_api_requests_total Total number of API requests
# TYPE codesight_api_requests_total counter
codesight_api_requests_total{method="GET",endpoint="/health",status="200"} 1234

# HELP codesight_search_duration_seconds Search query duration
# TYPE codesight_search_duration_seconds histogram
codesight_search_duration_seconds_bucket{le="0.01"} 100
codesight_search_duration_seconds_bucket{le="0.05"} 300
codesight_search_duration_seconds_bucket{le="0.1"} 450
codesight_search_duration_seconds_bucket{le="+Inf"} 500

# HELP codesight_indexed_entities_total Total indexed entities
# TYPE codesight_indexed_entities_total gauge
codesight_indexed_entities_total{codebase="my-project"} 377
```

## Error Handling

### Error Response Format

All API endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "query",
      "issue": "cannot be empty"
    },
    "request_id": "req-uuid-123"
  }
}
```

### HTTP Status Codes

- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict
- `422 Unprocessable Entity`: Validation failed
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error
- `502 Bad Gateway`: Upstream service unavailable
- `503 Service Unavailable`: Service temporarily unavailable

### Common Error Codes

- `VALIDATION_ERROR`: Request validation failed
- `AUTHENTICATION_REQUIRED`: JWT token missing or invalid
- `PERMISSION_DENIED`: Insufficient permissions
- `RESOURCE_NOT_FOUND`: Requested resource not found
- `CODEBASE_NOT_FOUND`: Codebase ID not found
- `INDEXING_IN_PROGRESS`: Codebase is currently being indexed
- `SEARCH_TIMEOUT`: Search query exceeded timeout
- `RATE_LIMIT_EXCEEDED`: API rate limit exceeded
- `INTERNAL_ERROR`: Unexpected server error

## Rate Limiting

### Default Limits
- **Authentication endpoints**: 5 requests per minute
- **Search endpoints**: 100 requests per minute
- **Codebase management**: 20 requests per minute
- **Health checks**: 1000 requests per minute

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1641600000
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { CodeSightAPI } from '@codesight/sdk';

const client = new CodeSightAPI({
  baseURL: 'http://localhost:4000',
  apiKey: process.env.CODESIGHT_API_KEY
});

// Search code
const results = await client.search({
  query: 'authentication functions',
  codebaseId: 'codebase-uuid',
  limit: 10
});

// Get codebase stats
const stats = await client.getCodebaseStats('codebase-uuid');

// Start indexing
const job = await client startIndexing('codebase-uuid');
```

### Python

```python
from codesight import CodeSightClient

client = CodeSightClient(
    base_url='http://localhost:4000',
    api_key='your-api-key'
)

# Search code
results = client.search(
    query='authentication functions',
    codebase_id='codebase-uuid',
    limit=10
)

# Get codebase stats
stats = client.get_codebase_stats('codebase-uuid')
```

### cURL

```bash
# Health check
curl -X GET http://localhost:4000/health

# Search code
curl -X POST http://localhost:4000/api/queries \
  -H "Content-Type: application/json" \
  -d '{
    "query": "authentication functions",
    "codebase_id": "codebase-uuid",
    "limit": 10
  }'

# Get codebase details
curl -X GET http://localhost:4000/api/codebases/codebase-uuid \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## WebSocket API

### Connection
```javascript
const ws = new WebSocket('ws://localhost:8080');

// Authentication
ws.send(JSON.stringify({
  type: 'auth',
  token: 'your-jwt-token'
}));
```

### Real-time Events
```javascript
// Subscribe to indexing progress
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'indexing',
  codebase_id: 'codebase-uuid'
}));

// Receive updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Indexing progress:', data.progress);
};
```

## Configuration

### Environment Variables

```bash
# Server Configuration
NODE_ENV=production
PORT=4000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://postgres:password@postgres:5432/codesight
REDIS_URL=redis://redis:6379

# Security
JWT_SECRET=your-jwt-secret
API_KEY=your-api-key
CORS_ORIGIN=https://yourdomain.com

# Performance
INDEXING_PARALLEL_WORKERS=8
INDEXING_BATCH_SIZE=1000
CACHE_SIZE_MB=1024

# Monitoring
LOG_LEVEL=info
LOG_FORMAT=json
SENTRY_DSN=your-sentry-dsn
PROMETHEUS_ENDPOINT=http://prometheus:9090
```

## Deployment

### Docker Compose

```yaml
services:
  codesight-api:
    image: codesight/mcp-server:latest
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/codesight
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: codesight-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: codesight-api
  template:
    metadata:
      labels:
        app: codesight-api
    spec:
      containers:
      - name: codesight-api
        image: codesight/mcp-server:latest
        ports:
        - containerPort: 4000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: codesight-secrets
              key: database-url
```

## Testing

### API Testing with Postman

Import the Postman collection from `docs/api/codesight-api.postman_collection.json` to test all endpoints.

### Health Check Script

```bash
#!/bin/bash
# Simple health check script

response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health)

if [ $response -eq 200 ]; then
    echo "✅ API is healthy"
    exit 0
else
    echo "❌ API is unhealthy (HTTP $response)"
    exit 1
fi
```

## Changelog

### v0.1.0 (2025-01-08)
- Initial API release
- Core codebase management endpoints
- Search functionality
- MCP tools REST API alternatives
- Comprehensive health check endpoints
- Job management system
- Metrics and monitoring support

---

For more information, see the [main documentation](../README.md) or [MCP tools documentation](./mcp-tools.md).