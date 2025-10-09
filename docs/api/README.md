# CodeSight MCP Server API Documentation

## Overview

This directory contains comprehensive API documentation for the CodeSight MCP Server, providing natural language code search, analysis, and comprehensive codebase insights through REST endpoints and MCP tools.

## Documentation Files

### OpenAPI Specification
- **File**: `openapi.yaml`
- **Format**: OpenAPI 3.0.3
- **Purpose**: Machine-readable API specification for automated tools and code generation

### Interactive Documentation
- **File**: `swagger-ui.html`
- **Purpose**: Interactive API exploration and testing interface
- **Usage**: Open in web browser to explore and test API endpoints

## Quick Start

### 1. Start the Server
```bash
cd typescript-mcp
npm install
npm run build
npm start
```

### 2. Access Documentation
Open `http://localhost:4000/docs/api/swagger-ui.html` in your browser

### 3. Test API Health
```bash
curl http://localhost:4000/health
```

## API Features

### Core Endpoints

#### Health Checks
- `GET /health` - Basic health check
- `GET /health/detailed` - Comprehensive health status
- `GET /health/ready` - Readiness probe

#### Codebase Management
- `GET /api/codebases` - List all indexed codebases
- `POST /api/codebases` - Create new codebase for indexing
- `GET /api/codebases/{id}` - Get codebase details
- `DELETE /api/codebases/{id}` - Remove codebase

#### Search Operations
- `POST /api/queries` - Natural language code search
- `GET /api/queries/{id}` - Get search results
- `POST /api/queries/suggest` - Query suggestions

#### MCP Tools
- `POST /api/tools/search_code` - Natural language code search
- `POST /api/tools/explain_function` - Function explanation
- `POST /api/tools/find_references` - Find references
- `POST /api/tools/trace_data_flow` - Data flow analysis
- `POST /api/tools/analyze_security` - Security analysis
- `POST /api/tools/check_complexity` - Complexity analysis
- `POST /api/tools/find_duplicates` - Duplicate detection
- `POST /api/tools/suggest_refactoring` - Refactoring suggestions
- `POST /api/tools/get_api_endpoints` - API endpoint discovery

#### Monitoring
- `GET /metrics` - Prometheus-compatible metrics
- `GET /api/stats` - Usage statistics

### Authentication

The API uses JWT Bearer tokens for authentication:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:4000/api/codebases
```

### Rate Limiting

API requests are rate-limited to ensure fair usage:

- **Standard endpoints**: 100 requests per minute
- **Search endpoints**: 50 requests per minute
- **MCP tools**: 30 requests per minute

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Time until limit resets

## Code Examples

### Natural Language Search

```bash
curl -X POST http://localhost:4000/api/queries \
  -H "Content-Type: application/json" \
  -d '{
    "query": "authentication function with JWT validation",
    "codebase_id": "your-codebase-id",
    "limit": 10,
    "filters": {
      "file_types": ["ts", "js"],
      "entity_types": ["function", "method"]
    }
  }'
```

### MCP Tool Usage

```bash
# Search code using MCP tool
curl -X POST http://localhost:4000/api/tools/search_code \
  -H "Content-Type: application/json" \
  -d '{
    "query": "error handling patterns",
    "codebase_id": "your-codebase-id",
    "limit": 5
  }'

# Explain a function
curl -X POST http://localhost:4000/api/tools/explain_function \
  -H "Content-Type: application/json" \
  -d '{
    "function_identifier": "authenticateUser",
    "codebase_id": "your-codebase-id",
    "detail_level": "comprehensive"
  }'
```

### Codebase Management

```bash
# Create a new codebase
curl -X POST http://localhost:4000/api/codebases \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-project",
    "path": "/path/to/project",
    "language": "typescript",
    "description": "My TypeScript project"
  }'

# List all codebases
curl http://localhost:4000/api/codebases
```

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "metadata": {
    "timestamp": "2025-01-01T00:00:00.000Z",
    "requestId": "uuid",
    "executionTimeMs": 123
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "query",
      "issue": "Required field missing"
    }
  },
  "metadata": {
    "timestamp": "2025-01-01T00:00:00.000Z",
    "requestId": "uuid"
  }
}
```

## SDKs and Tools

### Postman Collection
A Postman collection is available in `../testing/postman/` for easy API testing.

### OpenAPI Generator
You can generate client SDKs using the OpenAPI specification:

```bash
# Generate TypeScript client
openapi-generator-cli generate \
  -i openapi.yaml \
  -g typescript-axios \
  -o ./client-sdk/typescript

# Generate Python client
openapi-generator-cli generate \
  -i openapi.yaml \
  -g python \
  -o ./client-sdk/python
```

## Performance Guidelines

### Query Optimization
- Use specific terms in natural language queries
- Limit result sets with appropriate `limit` parameter
- Use filters to narrow search scope
- Cache frequently used query results

### Bulk Operations
- Batch multiple searches when possible
- Use pagination for large result sets
- Consider async operations for large codebases

### Monitoring
- Monitor response times and error rates
- Track API usage through `/metrics` endpoint
- Set up alerts for performance degradation

## Language Support

The API supports 15+ programming languages:

| Language | Extensions | Status |
|----------|------------|--------|
| TypeScript | `.ts`, `.tsx` | ✅ Full |
| JavaScript | `.js`, `.jsx` | ✅ Full |
| Rust | `.rs` | ✅ Full |
| Python | `.py` | ✅ Full |
| Go | `.go` | ✅ Full |
| Java | `.java` | ✅ Full |
| C++ | `.cpp`, `.cc`, `.cxx` | ✅ Full |
| C# | `.cs` | ✅ Full |
| PHP | `.php` | ✅ Full |
| Ruby | `.rb` | ✅ Full |
| Swift | `.swift` | ✅ Full |
| Kotlin | `.kt`, `.kts` | ✅ Full |
| Scala | `.scala` | ✅ Full |
| Dart | `.dart` | ✅ Full |
| Lua | `.lua` | ✅ Full |

## Error Handling

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable

### Common Error Codes
- `VALIDATION_ERROR` - Invalid request parameters
- `AUTHENTICATION_ERROR` - Invalid or missing authentication
- `AUTHORIZATION_ERROR` - Insufficient permissions
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `RATE_LIMIT_EXCEEDED` - API rate limit exceeded
- `INDEXING_ERROR` - Codebase indexing failed
- `SEARCH_ERROR` - Search operation failed
- `INTERNAL_ERROR` - Unexpected server error

## Support and Contributing

### Getting Help
- 📖 Check this documentation
- 🐛 Report issues on GitHub
- 💬 Join our community discussions

### Contributing
- 🔄 Fork the repository
- 📝 Create feature branches
- ✅ Add tests for new functionality
- 📋 Submit pull requests

### License
This API documentation is part of the CodeSight MCP Server project, licensed under the MIT License.

---

**Last Updated**: January 2025
**API Version**: v0.1.0
**Documentation Version**: 1.0.0