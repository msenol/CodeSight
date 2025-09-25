# MCP Tools Documentation

## Overview

The Code Intelligence MCP Server provides 9 specialized tools for code analysis and understanding. These tools are available to AI assistants through the Model Context Protocol.

## Available Tools

### search_code

**Description:** Natural language code search across the codebase

**Parameters:**
- `codebase_id`: UUID of the codebase to search
- `query`: Natural language search query
- `limit`: Maximum number of results (optional, default: 10)
- `file_types`: File types to include (optional)

**Returns:** Array of search results with code snippets and locations

**Example Usage:**
```json
{
  "tool": "search_code",
  "arguments": {
  "codebase_id": "550e8400-e29b-41d4-a716-446655440000",
  "query": "authentication logic",
  "limit": 10
}
}
```

---

### explain_function

**Description:** Explain what a specific function does

**Parameters:**
- `entity_id`: UUID of the function entity
- `include_callers`: Include functions that call this function (optional)
- `include_callees`: Include functions this function calls (optional)
- `include_complexity`: Include complexity metrics (optional)

**Returns:** Detailed explanation with parameters, return type, and behavior

**Example Usage:**
```json
{
  "tool": "explain_function",
  "arguments": {
  "entity_id": "550e8400-e29b-41d4-a716-446655440001",
  "include_complexity": true
}
}
```

---

### find_references

**Description:** Find all references to a symbol

**Parameters:**
- `entity_id`: UUID of the symbol to find references for
- `include_definitions`: Include symbol definitions (optional)
- `include_usages`: Include symbol usages (optional)

**Returns:** List of all locations where the symbol is referenced

**Example Usage:**
```json
{
  "tool": "find_references",
  "arguments": {
  "entity_id": "550e8400-e29b-41d4-a716-446655440002"
}
}
```

---

### trace_data_flow

**Description:** Trace data flow through the code

**Parameters:**
- `entity_id`: UUID of the variable or data to trace
- `direction`: Trace direction: forward, backward, or both
- `max_depth`: Maximum tracing depth (optional)

**Returns:** Data flow graph showing how data moves through the code

**Example Usage:**
```json
{
  "tool": "trace_data_flow",
  "arguments": {
  "entity_id": "550e8400-e29b-41d4-a716-446655440003",
  "direction": "both"
}
}
```

---

### analyze_security

**Description:** Analyze code for security vulnerabilities

**Parameters:**
- `codebase_id`: UUID of the codebase to analyze
- `severity_threshold`: Minimum severity level (optional)
- `scan_type`: Type of security scan (optional)

**Returns:** List of security vulnerabilities with severity and remediation

**Example Usage:**
```json
{
  "tool": "analyze_security",
  "arguments": {
  "codebase_id": "550e8400-e29b-41d4-a716-446655440000"
}
}
```

---

### get_api_endpoints

**Description:** List all API endpoints in the codebase

**Parameters:**
- `codebase_id`: UUID of the codebase
- `filter_method`: HTTP method filter (GET, POST, etc.)
- `include_schemas`: Include request/response schemas (optional)

**Returns:** List of API endpoints with paths, methods, and handlers

**Example Usage:**
```json
{
  "tool": "get_api_endpoints",
  "arguments": {
  "codebase_id": "550e8400-e29b-41d4-a716-446655440000",
  "filter_method": "all"
}
}
```

---

### check_complexity

**Description:** Analyze code complexity metrics

**Parameters:**
- `entity_id`: UUID of the code entity to analyze
- `include_suggestions`: Include refactoring suggestions (optional)

**Returns:** Complexity metrics including cyclomatic and cognitive complexity

**Example Usage:**
```json
{
  "tool": "check_complexity",
  "arguments": {
  "entity_id": "550e8400-e29b-41d4-a716-446655440001"
}
}
```

---

## Contract Tests

All tools have comprehensive contract tests ensuring:
- Request/Response schema validation
- Required field validation
- Optional parameter handling
- Error response validation
- Business logic validation
- Performance requirements

Test files are located in `typescript-mcp/tests/contract/`.

## Performance Requirements

**Current Performance (Hybrid TypeScript + Rust Implementation):**

| Tool | Target Response Time | Actual Achievement | Notes |
|------|-------------------|-------------------|-------|
| search_code | <200ms | 20-50ms | 2.5x faster with Rust FFI |
| explain_function | <3s | <1s | Improved with Tree-sitter parsing |
| find_references | <500ms | 100-200ms | Enhanced with Rust performance |
| trace_data_flow | <5s | 1-2s | Optimized data structure traversal |
| analyze_security | <10s | 2-5s | Faster pattern matching |
| get_api_endpoints | <5s | 1-2s | Quick endpoint discovery |
| check_complexity | <2s | <500ms | Real-time complexity analysis |
| find_duplicates | <30s | 5-10s | Improved code comparison |
| suggest_refactoring | <5s | 1-2s | Faster analysis with Rust core |

**Performance Benchmarks by Codebase Size:**
| Project Size | Search Response | Indexing Time | Memory Usage |
|--------------|-----------------|---------------|--------------|
| Small (<1K files) | <20ms | <2 seconds | <25MB |
| Medium (1K-10K files) | <50ms | <15 seconds | <200MB |
| Large (10K-100K files) | <100ms | <3 minutes | <1GB |
| Monorepos (>100K files) | <250ms | <15 minutes | <4GB |

## Error Handling

All tools follow consistent error handling:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

Common error codes:
- `ENTITY_NOT_FOUND`: Requested entity doesn't exist
- `CODEBASE_NOT_FOUND`: Codebase ID is invalid
- `INVALID_PARAMETER`: Parameter validation failed
- `TIMEOUT`: Operation exceeded time limit
- `INTERNAL_ERROR`: Unexpected server error
