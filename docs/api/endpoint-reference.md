# API Endpoint Reference

## Overview

The Code Intelligence MCP Server provides both REST API endpoints and MCP protocol tools for code analysis and intelligence operations.

## Base URLs

- **REST API**: `http://localhost:4000/api`
- **MCP WebSocket**: `ws://localhost:8080`
- **Frontend**: `http://localhost:5173`

## Authentication

Currently, the API operates without authentication in development mode. Production deployment should implement appropriate authentication mechanisms.

## REST API Endpoints

### Health Check

#### GET /api/health

Check server health status.

**Response:**

```json
{
  "status": "healthy",
  "version": "0.1.0-dev",
  "timestamp": "2025-09-24T12:00:00Z"
}
```

### Code Analysis

#### POST /api/analyze/search

Search code using natural language queries.

**Request Body:**

```json
{
  "query": "find all React components with useState",
  "codebase_id": "project-1",
  "options": {
    "limit": 20,
    "include_context": true
  }
}
```

**Response:**

```json
{
  "results": [
    {
      "file": "src/components/Dashboard.tsx",
      "line": 15,
      "match": "const [data, setData] = useState()",
      "context": "...",
      "relevance": 0.95
    }
  ],
  "total": 42,
  "query_time_ms": 45
}
```

#### POST /api/analyze/explain

Explain what a function does.

**Request Body:**

```json
{
  "function_name": "processUserData",
  "file_path": "src/utils/dataProcessor.ts",
  "codebase_id": "project-1"
}
```

**Response:**

```json
{
  "explanation": "This function processes user data by...",
  "parameters": [
    {
      "name": "userData",
      "type": "UserData",
      "description": "Raw user data object"
    }
  ],
  "returns": {
    "type": "ProcessedData",
    "description": "Cleaned and validated user data"
  },
  "side_effects": ["Logs to console", "Updates cache"],
  "complexity": "O(n)"
}
```

#### POST /api/analyze/references

Find all references to a symbol.

**Request Body:**

```json
{
  "symbol": "UserContext",
  "codebase_id": "project-1",
  "include_imports": true
}
```

**Response:**

```json
{
  "references": [
    {
      "file": "src/App.tsx",
      "line": 5,
      "type": "import",
      "context": "import { UserContext } from './contexts'"
    },
    {
      "file": "src/components/Profile.tsx",
      "line": 12,
      "type": "usage",
      "context": "const user = useContext(UserContext)"
    }
  ],
  "total": 8
}
```

#### POST /api/analyze/dataflow

Trace data flow through the code.

**Request Body:**

```json
{
  "variable": "apiKey",
  "starting_point": "src/config.ts",
  "codebase_id": "project-1"
}
```

**Response:**

```json
{
  "flow": [
    {
      "file": "src/config.ts",
      "line": 3,
      "operation": "declaration",
      "code": "const apiKey = process.env.API_KEY"
    },
    {
      "file": "src/api/client.ts",
      "line": 7,
      "operation": "import",
      "code": "import { apiKey } from '../config'"
    },
    {
      "file": "src/api/client.ts",
      "line": 15,
      "operation": "usage",
      "code": "headers: { 'X-API-Key': apiKey }"
    }
  ],
  "risk_level": "medium",
  "recommendations": ["Consider using environment variable directly"]
}
```

#### POST /api/analyze/security

Analyze code for security vulnerabilities.

**Request Body:**

```json
{
  "codebase_id": "project-1",
  "scan_type": "full",
  "rules": ["xss", "sql-injection", "secrets"]
}
```

**Response:**

```json
{
  "vulnerabilities": [
    {
      "type": "potential-xss",
      "severity": "medium",
      "file": "src/components/UserInput.tsx",
      "line": 23,
      "description": "User input rendered without sanitization",
      "recommendation": "Use DOMPurify or similar library"
    }
  ],
  "summary": {
    "total": 3,
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 0
  },
  "scan_time_ms": 1250
}
```

#### GET /api/analyze/endpoints

List all API endpoints in the codebase.

**Query Parameters:**

- `codebase_id`: Project identifier
- `framework`: Optional framework filter (express, fastify, etc.)

**Response:**

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/users",
      "file": "src/routes/users.ts",
      "line": 10,
      "handler": "getUsers",
      "middleware": ["authenticate", "authorize"]
    },
    {
      "method": "POST",
      "path": "/api/users",
      "file": "src/routes/users.ts",
      "line": 25,
      "handler": "createUser",
      "middleware": ["authenticate", "validate"]
    }
  ],
  "total": 24,
  "frameworks": ["express"]
}
```

#### POST /api/analyze/complexity

Check code complexity metrics.

**Request Body:**

```json
{
  "file_path": "src/utils/calculator.ts",
  "codebase_id": "project-1",
  "metrics": ["cyclomatic", "cognitive", "halstead"]
}
```

**Response:**

```json
{
  "file": "src/utils/calculator.ts",
  "functions": [
    {
      "name": "calculate",
      "cyclomatic_complexity": 8,
      "cognitive_complexity": 12,
      "lines_of_code": 45,
      "parameters": 3,
      "maintainability_index": 72,
      "risk": "medium"
    }
  ],
  "file_summary": {
    "total_functions": 5,
    "average_complexity": 6.2,
    "max_complexity": 12,
    "total_lines": 250
  }
}
```

### Codebase Management

#### POST /api/codebase/index

Index a new codebase for analysis.

**Request Body:**

```json
{
  "id": "project-1",
  "path": "/path/to/project",
  "name": "My Project",
  "languages": ["typescript", "javascript"],
  "exclude": ["node_modules", "dist", ".git"]
}
```

**Response:**

```json
{
  "codebase_id": "project-1",
  "status": "indexing",
  "files_found": 523,
  "estimated_time_seconds": 30
}
```

#### GET /api/codebase/{id}/status

Get indexing status for a codebase.

**Response:**

```json
{
  "codebase_id": "project-1",
  "status": "ready",
  "files_indexed": 523,
  "total_files": 523,
  "index_time_ms": 28500,
  "last_updated": "2025-09-24T12:00:00Z",
  "statistics": {
    "total_functions": 1250,
    "total_classes": 85,
    "total_lines": 45000,
    "languages": {
      "typescript": 18500,
      "javascript": 12000,
      "css": 8500,
      "html": 6000
    }
  }
}
```

#### DELETE /api/codebase/{id}

Remove a codebase from the index.

**Response:**

```json
{
  "message": "Codebase removed successfully",
  "codebase_id": "project-1"
}
```

## MCP Protocol Tools

The following tools are available through the Model Context Protocol:

### search_code

Search for code patterns using natural language.

**Parameters:**

- `query` (string): Natural language search query
- `codebase_id` (string): Target codebase identifier

### explain_function

Get detailed explanation of a function.

**Parameters:**

- `function_name` (string): Name of the function
- `codebase_id` (string): Target codebase identifier

### find_references

Find all references to a symbol.

**Parameters:**

- `symbol` (string): Symbol to find references for
- `codebase_id` (string): Target codebase identifier

### trace_data_flow

Trace how data flows through the code.

**Parameters:**

- `variable` (string): Variable to trace
- `codebase_id` (string): Target codebase identifier

### analyze_security

Scan for security vulnerabilities.

**Parameters:**

- `codebase_id` (string): Target codebase identifier
- `scan_type` (string): Type of scan (quick/full)

### get_api_endpoints

List all API endpoints in the codebase.

**Parameters:**

- `codebase_id` (string): Target codebase identifier

### check_complexity

Analyze code complexity metrics.

**Parameters:**

- `file_path` (string): File to analyze
- `codebase_id` (string): Target codebase identifier

## Error Responses

All endpoints follow a consistent error response format:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Codebase not found",
    "details": {
      "codebase_id": "project-1"
    }
  },
  "status": 404,
  "timestamp": "2025-09-24T12:00:00Z"
}
```

### Common Error Codes

- `INVALID_REQUEST`: Malformed request body
- `RESOURCE_NOT_FOUND`: Requested resource doesn't exist
- `CODEBASE_NOT_INDEXED`: Codebase needs indexing
- `INDEXING_IN_PROGRESS`: Operation unavailable during indexing
- `INTERNAL_ERROR`: Server-side error
- `RATE_LIMIT_EXCEEDED`: Too many requests

## Rate Limiting

Development mode: No rate limiting
Production mode: 100 requests per minute per IP

## WebSocket Events

The MCP WebSocket server emits the following events:

- `indexing.started`: Indexing process started
- `indexing.progress`: Progress update (% complete)
- `indexing.completed`: Indexing finished
- `analysis.started`: Analysis operation started
- `analysis.completed`: Analysis operation completed
- `error`: Error occurred

## Performance Considerations

1. **Caching**: Results are cached for 5 minutes
2. **Pagination**: Large result sets support pagination
3. **Streaming**: Large responses can be streamed
4. **Batch Operations**: Multiple queries can be batched

## SDK Examples

### JavaScript/TypeScript

```typescript
import { CodeIntelligenceClient } from '@code-intelligence/sdk';

const client = new CodeIntelligenceClient({
  baseUrl: 'http://localhost:4000',
  websocketUrl: 'ws://localhost:8080'
});

// Search code
const results = await client.search({
  query: 'React components with hooks',
  codebaseId: 'my-project'
});

// Explain function
const explanation = await client.explainFunction({
  functionName: 'processData',
  codebaseId: 'my-project'
});
```

### cURL Examples

```bash
# Health check
curl http://localhost:4000/api/health

# Search code
curl -X POST http://localhost:4000/api/analyze/search \
  -H "Content-Type: application/json" \
  -d '{"query":"useState hooks","codebase_id":"project-1"}'

# Get codebase status
curl http://localhost:4000/api/codebase/project-1/status
```

## Upcoming Features

- GraphQL API support
- Real-time collaboration features
- Advanced semantic search with AI embeddings
- Custom rule creation for security analysis
- Integration with popular IDEs
- Webhook support for CI/CD pipelines

## Support

For API issues or feature requests, please open an issue in the project repository.
