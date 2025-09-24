# API Documentation

## Overview

The Code Intelligence MCP Server provides both MCP protocol tools and REST API endpoints for code intelligence operations.

## Base URL

```
Development: http://localhost:4000
Production: https://api.code-intelligence.example.com
```

## Authentication

Currently, the API operates without authentication in development mode. Production deployments should implement appropriate authentication mechanisms.

## MCP Tools (Model Context Protocol)

MCP tools are accessed through the Model Context Protocol. See [MCP-TOOLS.md](MCP-TOOLS.md) for detailed documentation.

## REST API Endpoints

### Health Check

#### GET /health
Check server health status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-09-25T10:00:00.000Z"
}
```

#### GET /api/health
Detailed health check with version information.

**Response:**
```json
{
  "success": true,
  "message": "Code Intelligence MCP Server is running",
  "version": "0.1.0"
}
```

### Codebase Management

#### GET /api/codebase
List all codebases.

**Query Parameters:**
- `page` (number): Page number for pagination (default: 1)
- `limit` (number): Items per page (default: 20)
- `status` (string): Filter by status (active, inactive, archived)
- `language` (string): Filter by programming language
- `search` (string): Search term

**Response:**
```json
{
  "success": true,
  "data": {
    "codebases": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "My Project",
        "language": "TypeScript",
        "status": "active",
        "file_count": 156,
        "entity_count": 1234
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_items": 100
    }
  }
}
```

#### GET /api/codebase/:id
Get specific codebase details.

**Parameters:**
- `id` (uuid): Codebase ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Project",
    "description": "Project description",
    "repository_url": "https://github.com/org/repo",
    "local_path": "/path/to/project",
    "language": "TypeScript",
    "framework": "React",
    "status": "active",
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-20T15:30:00Z",
    "last_indexed": "2025-01-20T14:00:00Z"
  }
}
```

#### POST /api/codebase
Create a new codebase.

**Request Body:**
```json
{
  "name": "My Project",
  "description": "Project description",
  "repository_url": "https://github.com/org/repo",
  "local_path": "/path/to/project",
  "language": "TypeScript",
  "framework": "React",
  "tags": ["frontend", "web"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Project",
    "status": "pending_index"
  }
}
```

#### PUT /api/codebase/:id
Update codebase information.

**Parameters:**
- `id` (uuid): Codebase ID

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "status": "active"
}
```

#### DELETE /api/codebase/:id
Delete a codebase.

**Parameters:**
- `id` (uuid): Codebase ID
- `force` (boolean): Force delete even if active (query param)

### Indexing

#### POST /api/codebase/:id/index
Start or restart indexing for a codebase.

**Parameters:**
- `id` (uuid): Codebase ID

**Request Body:**
```json
{
  "force_reindex": false,
  "include_tests": true,
  "include_dependencies": false,
  "file_patterns": ["*.ts", "*.tsx"],
  "exclude_patterns": ["node_modules/**", "dist/**"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "indexing_id": "idx_1234567890",
    "status": "in_progress",
    "started_at": "2025-01-20T14:00:00Z"
  }
}
```

#### GET /api/codebase/:id/index/status
Get indexing status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "in_progress",
    "progress": {
      "files_processed": 50,
      "total_files": 156,
      "entities_found": 500,
      "completion_percentage": 32
    }
  }
}
```

### Code Analysis

#### POST /api/analyze/complexity
Analyze code complexity.

**Request Body:**
```json
{
  "entity_id": "550e8400-e29b-41d4-a716-446655440001",
  "include_suggestions": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cyclomatic_complexity": 8,
    "cognitive_complexity": 12,
    "lines_of_code": 145,
    "maintainability_index": 72.5,
    "suggestions": [
      "Consider extracting method for lines 45-67"
    ]
  }
}
```

#### POST /api/analyze/security
Run security analysis.

**Request Body:**
```json
{
  "codebase_id": "550e8400-e29b-41d4-a716-446655440000",
  "severity_threshold": "medium",
  "scan_type": "quick"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "vulnerabilities": [
      {
        "id": "vuln_001",
        "type": "sql_injection",
        "severity": "high",
        "file": "src/db/queries.ts",
        "line": 45,
        "description": "Potential SQL injection vulnerability",
        "remediation": "Use parameterized queries"
      }
    ],
    "summary": {
      "total": 3,
      "high": 1,
      "medium": 2,
      "low": 0
    }
  }
}
```

### Search

#### POST /api/search
Search code with natural language.

**Request Body:**
```json
{
  "codebase_id": "550e8400-e29b-41d4-a716-446655440000",
  "query": "authentication logic",
  "limit": 10,
  "file_types": ["ts", "tsx"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "result_001",
        "entity_id": "550e8400-e29b-41d4-a716-446655440002",
        "file_path": "src/auth/login.ts",
        "line_start": 25,
        "line_end": 45,
        "code_snippet": "function authenticate(username, password) {...}",
        "relevance_score": 0.95
      }
    ],
    "total_results": 5
  }
}
```

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {},
  "timestamp": "2025-01-20T15:30:00Z"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `INVALID_REQUEST` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

## Rate Limiting

The API implements rate limiting in production:
- 100 requests per minute for general endpoints
- 10 requests per minute for heavy operations (indexing, analysis)

Rate limit headers:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

## WebSocket API

For real-time updates, connect to the WebSocket endpoint:

```
ws://localhost:8080
wss://api.code-intelligence.example.com/ws
```

### Events

#### indexing_progress
Real-time indexing progress updates.

```json
{
  "event": "indexing_progress",
  "data": {
    "codebase_id": "550e8400-e29b-41d4-a716-446655440000",
    "progress": 45,
    "current_file": "src/components/App.tsx"
  }
}
```

#### analysis_complete
Notification when analysis completes.

```json
{
  "event": "analysis_complete",
  "data": {
    "analysis_id": "analysis_123",
    "type": "security",
    "status": "complete"
  }
}
```

## SDK Usage

### JavaScript/TypeScript

```typescript
import { CodeIntelligenceClient } from '@code-intelligence/sdk';

const client = new CodeIntelligenceClient({
  baseUrl: 'http://localhost:4000',
  apiKey: 'your-api-key' // For production
});

// Search code
const results = await client.searchCode({
  codebaseId: 'project-id',
  query: 'authentication'
});

// Analyze complexity
const complexity = await client.analyzeComplexity({
  entityId: 'function-id'
});
```

### Python

```python
from code_intelligence import Client

client = Client(
    base_url="http://localhost:4000",
    api_key="your-api-key"  # For production
)

# Search code
results = client.search_code(
    codebase_id="project-id",
    query="authentication"
)

# Analyze security
vulnerabilities = client.analyze_security(
    codebase_id="project-id"
)
```

## Pagination

List endpoints support pagination:

```
GET /api/codebase?page=2&limit=50
```

Pagination response includes:
- `current_page`: Current page number
- `total_pages`: Total number of pages
- `total_items`: Total number of items
- `items_per_page`: Items per page
- `has_next`: Boolean for next page
- `has_prev`: Boolean for previous page

## Filtering and Sorting

Most list endpoints support filtering and sorting:

```
GET /api/codebase?status=active&language=TypeScript&sort_by=updated_at&sort_order=desc
```

Common parameters:
- `sort_by`: Field to sort by
- `sort_order`: `asc` or `desc`
- `search`: Text search
- `filter`: Predefined filters

## Batch Operations

Some endpoints support batch operations:

```json
POST /api/batch
{
  "operations": [
    {
      "method": "POST",
      "path": "/api/analyze/complexity",
      "body": { "entity_id": "id1" }
    },
    {
      "method": "POST",
      "path": "/api/analyze/complexity",
      "body": { "entity_id": "id2" }
    }
  ]
}
```

## Webhooks

Configure webhooks for async notifications:

```json
POST /api/webhooks
{
  "url": "https://your-app.com/webhook",
  "events": ["indexing_complete", "analysis_complete"],
  "secret": "webhook-secret"
}
```

## API Versioning

The API uses header-based versioning:

```
X-API-Version: 1.0
```

Default version is the latest stable version. Specify older versions for compatibility.