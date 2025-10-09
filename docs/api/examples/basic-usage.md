# Basic API Usage Examples

This guide provides practical examples for using the CodeSight MCP Server API for common tasks.

## Prerequisites

1. **Server Running**: Ensure the CodeSight MCP Server is running
```bash
cd typescript-mcp
npm start
```

2. **Authentication**: Get your JWT token (if authentication is enabled)
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "your-user", "password": "your-password"}'
```

## Quick Start Example

### 1. Check Server Health
```bash
curl http://localhost:4000/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T12:00:00.000Z",
  "version": "0.1.0",
  "uptime": 3600
}
```

### 2. Create a Codebase
```bash
curl -X POST http://localhost:4000/api/codebases \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "my-project",
    "path": "/path/to/your/project",
    "language": "typescript",
    "description": "My awesome TypeScript project"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "codebase": {
    "id": "uuid-here",
    "name": "my-project",
    "path": "/path/to/your/project",
    "status": "unindexed",
    "created_at": "2025-01-01T12:00:00.000Z"
  }
}
```

### 3. List Codebases
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:4000/api/codebases
```

### 4. Search Code
```bash
curl -X POST http://localhost:4000/api/queries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "authentication function with JWT",
    "codebase_id": "your-codebase-id",
    "limit": 10
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "result-uuid",
      "name": "authenticateUser",
      "type": "function",
      "file_path": "src/auth/auth.service.ts",
      "line_number": 42,
      "score": 0.95,
      "snippet": "function authenticateUser(token: string): Promise<User> {..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1
  },
  "execution_time_ms": 123
}
```

## Real-World Examples

### Example 1: Security Audit

Find all authentication-related functions and analyze them for security issues:

```bash
# Step 1: Find authentication functions
curl -X POST http://localhost:4000/api/queries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "authentication login password validation",
    "codebase_id": "your-codebase-id",
    "limit": 20,
    "filters": {
      "file_types": ["ts", "js", "py"],
      "entity_types": ["function", "method"]
    }
  }'

# Step 2: Analyze security for each found function
curl -X POST http://localhost:4000/api/tools/analyze_security \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "file_path": "src/auth/auth.service.ts",
    "codebase_id": "your-codebase-id",
    "analysis_level": "comprehensive"
  }'
```

### Example 2: Code Refactoring

Find complex functions that need refactoring:

```bash
# Step 1: Find complex functions
curl -X POST http://localhost:4000/api/queries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "large complex function with many parameters",
    "codebase_id": "your-codebase-id",
    "limit": 15,
    "filters": {
      "min_line_count": 50,
      "entity_types": ["function"]
    }
  }'

# Step 2: Check complexity for specific files
curl -X POST http://localhost:4000/api/tools/check_complexity \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "file_path": "src/services/user.service.ts",
    "codebase_id": "your-codebase-id",
    "include_suggestions": true
  }'

# Step 3: Get refactoring suggestions
curl -X POST http://localhost:4000/api/tools/suggest_refactoring \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "file_path": "src/services/user.service.ts",
    "codebase_id": "your-codebase-id",
    "refactoring_types": ["extract", "simplify", "optimize"]
  }'
```

### Example 3: API Discovery

Find all API endpoints in your codebase:

```bash
curl -X POST http://localhost:4000/api/tools/get_api_endpoints \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "codebase_id": "your-codebase-id",
    "include_methods": ["GET", "POST", "PUT", "DELETE"],
    "include_documentation": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "result": {
    "endpoints": [
      {
        "path": "/api/users",
        "method": "GET",
        "controller": "UserController",
        "function": "getUsers",
        "documentation": "Retrieve all users with pagination",
        "parameters": [
          {
            "name": "page",
            "type": "query",
            "required": false,
            "default": "1"
          }
        ]
      }
    ],
    "total_count": 15
  }
}
```

### Example 4: Duplicate Code Detection

Find duplicate code patterns:

```bash
curl -X POST http://localhost:4000/api/tools/find_duplicates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "codebase_id": "your-codebase-id",
    "similarity_threshold": 0.8,
    "include_suggestions": true
  }'
```

### Example 5: Function Explanation

Get detailed explanation of a specific function:

```bash
curl -X POST http://localhost:4000/api/tools/explain_function \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "function_identifier": "processPayment",
    "codebase_id": "your-codebase-id",
    "detail_level": "comprehensive"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "result": {
    "function": {
      "name": "processPayment",
      "signature": "processPayment(amount: number, method: string): Promise<Transaction>",
      "file_path": "src/payment/payment.service.ts",
      "line_number": 15
    },
    "explanation": {
      "summary": "This function processes payment transactions with validation and error handling",
      "parameters": [
        {
          "name": "amount",
          "type": "number",
          "description": "Payment amount in currency units"
        },
        {
          "name": "method",
          "type": "string",
          "description": "Payment method (credit_card, paypal, etc.)"
        }
      ],
      "returns": {
        "type": "Promise<Transaction>",
        "description": "Promise resolving to completed transaction details"
      },
      "dependencies": ["PaymentValidator", "TransactionService", "Logger"],
      "complexity": "Medium",
      "side_effects": ["Creates database records", "Calls external payment gateway"]
    }
  }
}
```

## Error Handling Examples

### Handling Validation Errors
```bash
# This will return a 400 error
curl -X POST http://localhost:4000/api/queries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "",
    "codebase_id": "invalid-id",
    "limit": 1000
  }'
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "query": "Query cannot be empty",
      "codebase_id": "Invalid codebase ID format",
      "limit": "Limit must be between 1 and 100"
    }
  }
}
```

### Handling Authentication Errors
```bash
# This will return a 401 error
curl http://localhost:4000/api/codebases
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Missing or invalid authentication token"
  }
}
```

## Performance Tips

### 1. Use Specific Queries
```bash
# Good: Specific query
curl -X POST http://localhost:4000/api/queries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "JWT token validation function",
    "codebase_id": "your-codebase-id",
    "limit": 10
  }'

# Avoid: Too general query
curl -X POST http://localhost:4000/api/queries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "function",
    "codebase_id": "your-codebase-id",
    "limit": 100
  }'
```

### 2. Use Filters Effectively
```bash
# Good: Filtered search
curl -X POST http://localhost:4000/api/queries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "authentication",
    "codebase_id": "your-codebase-id",
    "limit": 10,
    "filters": {
      "file_types": ["ts", "js"],
      "entity_types": ["function"],
      "min_line_count": 5
    }
  }'
```

### 3. Batch Operations
```bash
# Instead of multiple small searches, use a broader search
curl -X POST http://localhost:4000/api/queries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "authentication OR authorization OR login OR security",
    "codebase_id": "your-codebase-id",
    "limit": 50
  }'
```

## Integration Examples

### Node.js Integration
```javascript
const axios = require('axios');

class CodeSightClient {
  constructor(baseURL, authToken) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async searchCode(query, codebaseId, options = {}) {
    try {
      const response = await this.client.post('/api/queries', {
        query,
        codebase_id: codebaseId,
        limit: options.limit || 10,
        filters: options.filters || {}
      });
      return response.data;
    } catch (error) {
      throw new Error(`Search failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async analyzeSecurity(filePath, codebaseId) {
    try {
      const response = await this.client.post('/api/tools/analyze_security', {
        file_path: filePath,
        codebase_id: codebaseId,
        analysis_level: 'comprehensive'
      });
      return response.data;
    } catch (error) {
      throw new Error(`Security analysis failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

// Usage
const client = new CodeSightClient('http://localhost:4000', 'your-jwt-token');

async function auditCodebase() {
  const results = await client.searchCode('authentication', 'codebase-id');
  console.log('Found authentication functions:', results.results);

  for (const result of results.results) {
    const securityAnalysis = await client.analyzeSecurity(result.file_path, 'codebase-id');
    console.log(`Security analysis for ${result.file_path}:`, securityAnalysis.result);
  }
}
```

### Python Integration
```python
import requests
import json

class CodeSightClient:
    def __init__(self, base_url, auth_token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {auth_token}',
            'Content-Type': 'application/json'
        }

    def search_code(self, query, codebase_id, limit=10, filters=None):
        url = f"{self.base_url}/api/queries"
        data = {
            'query': query,
            'codebase_id': codebase_id,
            'limit': limit,
            'filters': filters or {}
        }

        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        return response.json()

    def explain_function(self, function_id, codebase_id, detail_level='comprehensive'):
        url = f"{self.base_url}/api/tools/explain_function"
        data = {
            'function_identifier': function_id,
            'codebase_id': codebase_id,
            'detail_level': detail_level
        }

        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        return response.json()

# Usage
client = CodeSightClient('http://localhost:4000', 'your-jwt-token')

# Search for functions
results = client.search_code('authentication', 'your-codebase-id')
print(f"Found {len(results['results'])} authentication functions")

# Explain a specific function
if results['results']:
    explanation = client.explain_function(
        results['results'][0]['name'],
        'your-codebase-id'
    )
    print(f"Function explanation: {json.dumps(explanation['result']['explanation'], indent=2)}")
```

## Next Steps

- Explore the [Advanced Usage](./advanced-usage.md) guide
- Check the [MCP Tools Reference](../mcp-tools.md)
- Review the [OpenAPI specification](./openapi.yaml)
- Try the [Postman collection](../testing/postman/) for interactive testing

---

For more examples and advanced usage patterns, see the advanced usage documentation.