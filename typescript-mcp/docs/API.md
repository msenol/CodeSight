# CodeSight MCP Server API Documentation

**Version: Phase 4.1**
**Last Updated: November 14, 2025**

This document provides comprehensive API documentation for the CodeSight MCP Server, including both REST endpoints and MCP protocol tools, with a focus on the new AI-powered features.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Core API Endpoints](#core-api-endpoints)
- [AI-Powered Endpoints (Phase 4.1)](#ai-powered-endpoints-phase-41)
- [WebSocket API](#websocket-api)
- [MCP Protocol Tools](#mcp-protocol-tools)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

---

## Overview

The CodeSight MCP Server provides both REST API endpoints and MCP protocol tools for code intelligence operations. The server supports:

- **REST API**: HTTP/JSON endpoints for web integration
- **MCP Protocol**: Native Model Context Protocol for AI assistant integration
- **WebSocket**: Real-time communication and streaming
- **AI Integration**: Multi-provider LLM support with intelligent fallback

### Base URL

```
Development: http://localhost:4000
Production: https://api.codesight.ai
```

### API Versioning

All endpoints are versioned using URL prefixes:
- `/api/v1/` - Current stable version
- `/api/v2/` - Beta features (including AI endpoints)

---

## Authentication

### API Key Authentication

```http
Authorization: Bearer YOUR_API_KEY
```

### JWT Authentication

```http
Authorization: JWT YOUR_JWT_TOKEN
```

### Environment Setup

```bash
# Development
export API_KEY="dev-api-key"
export JWT_SECRET="dev-jwt-secret"

# Production
export API_KEY="prod-api-key"
export JWT_SECRET="prod-jwt-secret"
export CORS_ORIGIN="https://yourdomain.com"
```

---

## Core API Endpoints

### Codebase Management

#### Create Codebase
```http
POST /api/v1/codebases
Content-Type: application/json

{
  "name": "my-project",
  "path": "/path/to/project",
  "description": "Project description",
  "language": "typescript"
}
```

**Response**:
```json
{
  "id": "codebase-123",
  "name": "my-project",
  "status": "created",
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### Index Codebase
```http
POST /api/v1/codebases/{codebase_id}/index
Content-Type: application/json

{
  "languages": ["typescript", "javascript"],
  "exclude_patterns": ["node_modules/**", "*.test.ts"],
  "parallel_workers": 4
}
```

**Response**:
```json
{
  "job_id": "job-456",
  "status": "started",
  "estimated_duration": "30s"
}
```

#### Get Codebase Status
```http
GET /api/v1/codebases/{codebase_id}
```

**Response**:
```json
{
  "id": "codebase-123",
  "name": "my-project",
  "status": "indexed",
  "stats": {
    "files_count": 150,
    "entities_count": 377,
    "last_indexed": "2024-01-01T01:00:00Z"
  }
}
```

### Search and Analysis

#### Search Code
```http
POST /api/v1/search
Content-Type: application/json

{
  "codebase_id": "codebase-123",
  "query": "authentication middleware",
  "max_results": 10,
  "context_lines": 3
}
```

**Response**:
```json
{
  "results": [
    {
      "file": "src/middleware/auth.ts",
      "line": 15,
      "content": "export function authenticateToken(req, res, next) { ... }",
      "score": 0.95
    }
  ],
  "total_matches": 5,
  "execution_time_ms": 45
}
```

#### Get API Endpoints
```http
GET /api/v1/codebases/{codebase_id}/api-endpoints?framework=express
```

**Response**:
```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/users",
      "handler": "getUsers",
      "file": "src/routes/users.ts",
      "line": 23
    }
  ],
  "total_count": 8
}
```

---

## AI-Powered Endpoints (Phase 4.1)

### AI Code Review

#### Comprehensive Code Review
```http
POST /api/v2/ai/code-review
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "codebase_id": "codebase-123",
  "file_path": "src/service/user.ts",
  "review_type": "comprehensive",
  "context": {
    "pr_description": "Add user authentication feature",
    "changed_files": ["src/service/user.ts", "src/middleware/auth.ts"],
    "target_branch": "main"
  },
  "ai_provider": "anthropic-claude"
}
```

**Response**:
```json
{
  "review_id": "review-789",
  "overall_score": 85,
  "metrics": {
    "complexity_score": 7,
    "maintainability_index": 78,
    "security_score": 9,
    "performance_score": 8
  },
  "issues": [
    {
      "id": "issue-1",
      "severity": "medium",
      "category": "security",
      "title": "Potential SQL injection vulnerability",
      "description": "The query construction at line 45 may be vulnerable to SQL injection",
      "line": 45,
      "confidence": 0.85,
      "suggestion": "Use parameterized queries instead of string concatenation"
    }
  ],
  "recommendations": [
    {
      "action": "Extract validation logic",
      "priority": "high",
      "rationale": "Improves code reusability and testability"
    }
  ],
  "execution_time_ms": 650
}
```

#### Security-Focused Review
```http
POST /api/v2/ai/code-review/security
Content-Type: application/json

{
  "codebase_id": "codebase-123",
  "code_snippet": "function login(username, password) { ... }",
  "review_type": "security-focused"
}
```

#### Batch Code Review
```http
POST /api/v2/ai/code-review/batch
Content-Type: application/json

{
  "codebase_id": "codebase-123",
  "files": ["src/service/*.ts", "src/controller/*.ts"],
  "review_type": "basic"
}
```

### Intelligent Refactoring

#### Refactoring Analysis
```http
POST /api/v2/ai/refactoring
Content-Type: application/json

{
  "codebase_id": "codebase-123",
  "file_path": "src/service/user.ts",
  "refactoring_type": "reduce-complexity",
  "target_scope": "function",
  "preferences": {
    "preserve_behavior": true,
    "backward_compatible": true,
    "test_driven": true
  }
}
```

**Response**:
```json
{
  "refactoring_id": "refactor-456",
  "overall_assessment": {
    "refactoring_potential": 75,
    "code_quality_score": 68,
    "maintainability_improvement": 15,
    "effort_required": 40
  },
  "suggestions": [
    {
      "id": "suggestion-1",
      "title": "Extract validation method",
      "category": "extract-method",
      "impact": "high",
      "effort": "medium",
      "confidence": 0.90,
      "benefits": ["Improved readability", "Better testability"],
      "original_code": "function processUser(userData) { /* 50 lines */ }",
      "refactored_code": "function processUser(userData) { validateUserData(userData); /* rest */ }\n\nfunction validateUserData(userData) { /* extracted validation */ }",
      "location": {
        "file": "src/service/user.ts",
        "start_line": 23,
        "end_line": 72
      }
    }
  ],
  "execution_time_ms": 800
}
```

### Bug Prediction

#### Proactive Bug Analysis
```http
POST /api/v2/ai/bug-prediction
Content-Type: application/json

{
  "codebase_id": "codebase-123",
  "file_path": "src/payment/processor.ts",
  "prediction_type": "ml-enhanced",
  "scope": "function",
  "historical_data": {
    "bug_history": [
      { "location": "src/payment/processor.ts:45", "type": "null_pointer", "severity": "high" }
    ],
    "test_coverage": 0.75
  }
}
```

**Response**:
```json
{
  "prediction_id": "predict-789",
  "overall_risk_assessment": {
    "risk_category": "medium",
    "bug_risk_score": 65,
    "predicted_bugs": 2,
    "confidence_level": 0.82
  },
  "identified_risks": [
    {
      "id": "risk-1",
      "title": "Potential null pointer exception",
      "category": "runtime-error",
      "severity": "high",
      "likelihood": 0.75,
      "impact": "high",
      "location": {
        "file_path": "src/payment/processor.ts",
        "line_start": 45,
        "line_end": 47
      },
      "description": "Variable 'paymentResult' may be null when API call fails",
      "mitigation_strategies": [
        "Add null check before accessing paymentResult",
        "Implement proper error handling",
        "Add validation for API response"
      ]
    }
  ],
  "hotspots": [
    {
      "location": "src/payment/processor.ts:40-55",
      "risk_concentration": "high",
      "bug_types": ["null_pointer", "api_failure"]
    }
  ],
  "execution_time_ms": 1200
}
```

### Context-Aware Code Generation

#### Generate Code
```http
POST /api/v2/ai/code-generation
Content-Type: application/json

{
  "codebase_id": "codebase-123",
  "prompt": "Create a user authentication service with JWT token validation",
  "generation_type": "function",
  "context": {
    "file_path": "src/service/",
    "surrounding_code": "import jwt from 'jsonwebtoken';\nimport bcrypt from 'bcrypt';",
    "project_structure": "src/service/, src/middleware/, src/models/",
    "existing_patterns": ["dependency-injection", "error-handling-middleware"],
    "dependencies": ["jsonwebtoken", "bcrypt", "express"],
    "coding_standards": {
      "language": "typescript",
      "style_guide": "eslint-config-standard",
      "naming_conventions": ["camelCase-functions", "PascalCase-classes"]
    }
  },
  "constraints": {
    "max_lines": 50,
    "complexity_limit": 10,
    "test_required": true,
    "documentation_required": true,
    "performance_optimized": true
  }
}
```

**Response**:
```json
{
  "generation_id": "gen-123",
  "code_metadata": {
    "type": "function",
    "estimated_lines": 35,
    "language": "typescript"
  },
  "generated_code": "/**\n * Authenticates user credentials and generates JWT token\n * @param username - User's username\n * @param password - User's password\n * @returns JWT token if authentication successful\n */\nexport async function authenticateUser(\n  username: string,\n  password: string\n): Promise<string> {\n  try {\n    const user = await User.findOne({ username });\n    if (!user) {\n      throw new AuthenticationError('Invalid credentials');\n    }\n    \n    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);\n    if (!isPasswordValid) {\n      throw new AuthenticationError('Invalid credentials');\n    }\n    \n    return jwt.sign(\n      { userId: user.id, username: user.username },\n      process.env.JWT_SECRET!,\n      { expiresIn: '24h' }\n    );\n  } catch (error) {\n    logger.error('Authentication failed:', error);\n    throw error;\n  }\n}",
  "validation_results": {
    "syntax_valid": true,
    "potential_issues": [],
    "lint_errors": []
  },
  "context_analysis": {
    "style_compliance": 95,
    "naming_convention_compliance": 100,
    "architectural_alignment": 88
  },
  "suggestions": {
    "optimization_opportunities": [
      "Add rate limiting for authentication attempts",
      "Implement password complexity validation"
    ]
  },
  "confidence_score": 92,
  "execution_time_ms": 800
}
```

### Technical Debt Analysis

#### Comprehensive Debt Assessment
```http
POST /api/v2/ai/technical-debt
Content-Type: application/json

{
  "codebase_id": "codebase-123",
  "scope": "system",
  "analysis_depth": "comprehensive",
  "include_recommendations": true,
  "historical_data": {
    "previous_debt_scores": [75, 78, 82],
    "remediation_history": [
      { "date": "2024-01-01", "action": "refactored-auth-service", "impact": 5 }
    ]
  }
}
```

**Response**:
```json
{
  "analysis_id": "debt-456",
  "overall_assessment": {
    "debt_category": "moderate",
    "total_debt_score": 68,
    "interest_rate": 12,
    "principal": 150,
    "estimated_interest": 18
  },
  "financial_impact": {
    "current_cost_per_month": 2500,
    "projected_cost_6_months": 3600,
    "projected_cost_12_months": 5400,
    "roi_potential": 180
  },
  "hotspots": [
    {
      "location": "src/legacy/payment-system",
      "debt_concentration": "high",
      "primary_issues": ["outdated-dependencies", "monolithic-structure"],
      "recommended_actions": [
        "Migrate to modern framework",
        "Break into microservices"
      ]
    }
  ],
  "priority_matrix": {
    "quick_wins": [
      {
        "title": "Update deprecated dependencies",
        "impact_score": 8,
        "effort_score": 3,
        "roi": 267
      }
    ],
    "strategic_projects": [
      {
        "title": "Refactor authentication system",
        "impact_score": 9,
        "effort_score": 8,
        "timeline": "3-4 months"
      }
    ]
  },
  "recommendations": [
    {
      "category": "immediate",
      "action": "Fix security vulnerabilities in auth module",
      "priority": "critical",
      "estimated_effort": "1 week",
      "business_impact": "High - Security risk reduction"
    }
  ],
  "execution_time_ms": 1500
}
```

---

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('ws://localhost:4000/ws');

// Authenticate
ws.send(JSON.stringify({
  type: 'auth',
  token: 'YOUR_JWT_TOKEN'
}));
```

### Real-time Code Analysis

```javascript
// Subscribe to code changes
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'code_changes',
  codebase_id: 'codebase-123'
}));

// Receive real-time updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'code_change') {
    console.log('File changed:', data.file_path);
  }
};
```

### Streaming AI Analysis

```javascript
// Start streaming AI analysis
ws.send(JSON.stringify({
  type: 'ai_analysis_start',
  tool: 'code_review',
  file_path: 'src/service/user.ts',
  codebase_id: 'codebase-123'
}));

// Receive streaming results
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'ai_analysis_chunk') {
    console.log('Analysis progress:', data.chunk);
  }
};
```

---

## MCP Protocol Tools

The CodeSight server implements the Model Context Protocol (MCP) for direct integration with AI assistants like Claude.

### Tool Registration

All 14 tools are automatically registered and available through the MCP protocol:

#### Core Tools
- `search_code` - Natural language code search
- `explain_function` - Function explanation and analysis
- `find_references` - Symbol reference finding
- `trace_data_flow` - Data flow analysis
- `analyze_security` - Security vulnerability analysis
- `get_api_endpoints` - API endpoint discovery
- `check_complexity` - Code complexity metrics
- `find_duplicates` - Duplicate code detection
- `suggest_refactoring` - Refactoring suggestions

#### AI-Powered Tools
- `ai_code_review` - AI-powered code review
- `intelligent_refactoring` - AI-driven refactoring analysis
- `bug_prediction` - AI-enhanced bug prediction
- `context_aware_code_generation` - Context-aware code generation
- `technical_debt_analysis` - AI-powered technical debt analysis

### Claude Desktop Integration

```json
{
  "mcpServers": {
    "codesight": {
      "command": "node",
      "args": ["/path/to/typescript-mcp/dist/index.js"],
      "cwd": "/path/to/typescript-mcp",
      "env": {
        "ANTHROPIC_API_KEY": "your-api-key",
        "OPENAI_API_KEY": "your-openai-key",
        "PREFERRED_AI_PROVIDER": "anthropic-claude",
        "AI_CACHE_ENABLED": "true"
      }
    }
  }
}
```

---

## Error Handling

### Standard Error Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": {
      "field": "query",
      "issue": "Required field missing"
    },
    "request_id": "req-123",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `VALIDATION_ERROR` | Invalid input parameters | 400 |
| `AUTHENTICATION_ERROR` | Invalid or missing authentication | 401 |
| `AUTHORIZATION_ERROR` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `CODEBASE_NOT_INDEXED` | Codebase not yet indexed | 422 |
| `AI_PROVIDER_ERROR` | AI provider unavailable | 502 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Server internal error | 500 |

### AI-Specific Errors

```json
{
  "error": {
    "code": "AI_PROVIDER_ERROR",
    "message": "AI provider temporarily unavailable",
    "details": {
      "provider": "anthropic-claude",
      "fallback_used": "rule-based",
      "suggestion": "Try again later or use different AI provider"
    }
  }
}
```

---

## Rate Limiting

### Rate Limits by Endpoint

| Endpoint Type | Rate Limit | Burst Limit |
|---------------|------------|-------------|
| Core API | 100 requests/minute | 200 requests |
| AI Tools | 20 requests/minute | 40 requests |
| Search | 200 requests/minute | 400 requests |
| WebSocket | 50 connections/minute | 100 connections |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
X-RateLimit-Retry-After: 30
```

### AI Cost Limits

Configure AI usage limits:

```bash
# Cost limits per hour
AI_COST_LIMIT_PER_HOUR=50.00

# Request rate limits
AI_RATE_LIMIT_PER_MINUTE=100

# Token limits
AI_TOKEN_LIMIT_PER_REQUEST=10000
```

---

## Examples

### Complete AI-Powered Code Review Workflow

```javascript
// 1. Index the codebase
const indexResponse = await fetch('/api/v1/codebases/my-project/index', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    languages: ['typescript', 'javascript']
  })
});

// 2. Wait for indexing to complete
const jobStatus = await pollJobStatus(indexResponse.job_id);

// 3. Perform AI code review
const reviewResponse = await fetch('/api/v2/ai/code-review', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    codebase_id: 'my-project',
    file_path: 'src/service/user.ts',
    review_type: 'comprehensive'
  })
});

const review = await reviewResponse.json();

// 4. Apply AI refactoring suggestions
if (review.issues.length > 0) {
  const refactorResponse = await fetch('/api/v2/ai/refactoring', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      codebase_id: 'my-project',
      file_path: 'src/service/user.ts',
      refactoring_type: 'extract-method'
    })
  });

  const refactoring = await refactorResponse.json();
  console.log('Refactoring suggestions:', refactoring.suggestions);
}
```

### WebSocket Real-time Analysis

```javascript
const ws = new WebSocket('ws://localhost:4000/ws');

ws.onopen = () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'YOUR_JWT_TOKEN'
  }));

  // Subscribe to file changes
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'file_changes',
    codebase_id: 'my-project'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'file_changed':
      // Trigger automatic AI analysis
      ws.send(JSON.stringify({
        type: 'ai_analysis',
        tool: 'bug_prediction',
        file_path: data.file_path,
        codebase_id: 'my-project'
      }));
      break;

    case 'ai_analysis_complete':
      console.log('AI Analysis:', data.results);
      break;
  }
};
```

### MCP Tool Usage (Claude Desktop)

```json
{
  "tool": "ai_code_review",
  "arguments": {
    "file_path": "src/middleware/auth.ts",
    "review_type": "security-focused",
    "codebase_id": "my-project"
  }
}
```

**Expected Response**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "🤖 AI Code Review (security-focused)\n\nOverall Score: 82/100\n\n🔍 Security Issues Found: 2\n\n1. HIGH: Weak password policy\n   Description: Password validation allows passwords shorter than 8 characters\n   Location: src/middleware/auth.ts:23\n   Suggestion: Implement minimum password length of 8 characters\n\n💡 Key Recommendations:\n1. Implement rate limiting for authentication attempts (High Priority)\n2. Add account lockout after failed attempts (High Priority)"
    }
  ]
}
```

---

## Monitoring and Metrics

### Health Check

```http
GET /api/v1/health
```

**Response**:
```json
{
  "status": "healthy",
  "version": "4.1.0",
  "uptime": 86400,
  "ai_providers": {
    "anthropic-claude": "available",
    "openai-gpt4": "available",
    "ollama": "unavailable",
    "rule-based": "available"
  },
  "performance": {
    "avg_response_time_ms": 150,
    "requests_per_second": 25
  }
}
```

### Metrics Endpoint

```http
GET /api/v1/metrics
Authorization: Bearer YOUR_API_KEY
```

**Response**:
```json
{
  "mcp_tools": {
    "search_code": {
      "calls": 1250,
      "avg_response_time_ms": 45,
      "success_rate": 0.98
    },
    "ai_code_review": {
      "calls": 150,
      "avg_response_time_ms": 650,
      "success_rate": 0.95,
      "ai_provider_usage": {
        "anthropic-claude": 0.7,
        "rule-based": 0.3
      }
    }
  },
  "system": {
    "memory_usage_mb": 150,
    "cpu_usage_percent": 25,
    "active_connections": 45
  }
}
```

---

*This API documentation covers all endpoints and tools as of Phase 4.1. For the latest updates, refer to the project repository and API changelog.*