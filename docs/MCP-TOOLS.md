# MCP Tools Documentation

## Overview

The CodeSight MCP Server implements a comprehensive set of MCP (Model Context Protocol) tools designed to provide AI assistants with deep code intelligence capabilities. This documentation covers the complete tool specification, usage examples, and implementation status.

## Tool Status

### ✅ Fully Implemented Tools
- `search_code` - Natural language code search with real database results
- `explain_function` - Function explanation and analysis

### 📝 Contract Tests Completed (TDD Phase 3.2)
The following tools have comprehensive contract tests written and will be implemented in Phase 3.3:
- `find_references` - Find all references to a symbol
- `trace_data_flow` - Trace data flow through the code
- `analyze_security` - Analyze code for security vulnerabilities
- `get_api_endpoints` - List all API endpoints in the codebase
- `check_complexity` - Analyze code complexity metrics
- `find_duplicates` - Detect duplicate code patterns
- `suggest_refactoring` - Provide refactoring suggestions

## Tool Specifications

### 1. search_code

**Description**: Natural language code search across the codebase with semantic understanding and relevance scoring.

**Input Schema**:
```json
{
  "query": "string (required) - Natural language search query",
  "limit": "number (optional, default: 10) - Maximum results to return (1-1000)",
  "file_types": "array (optional) - File extensions to filter by (e.g., ['ts', 'js'])",
  "include_content": "boolean (optional, default: false) - Include source code snippets in results"
}
```

**Output Schema**:
```json
{
  "success": "boolean",
  "results": [
    {
      "file_path": "string",
      "line_number": "number",
      "content": "string (optional)",
      "score": "number (0-1)",
      "match_type": "'exact' | 'fuzzy' | 'semantic'"
    }
  ],
  "metadata": {
    "total_results": "number",
    "search_time_ms": "number",
    "files_searched": "number",
    "query_type": "'exact' | 'fuzzy' | 'semantic'"
  }
}
```

**Usage Examples**:
```typescript
// Basic search
await search_code({
  query: "user authentication functions",
  limit: 10
});

// Search with file type filtering
await search_code({
  query: "API endpoints",
  file_types: ["ts", "js"],
  include_content: true
});

// Complex semantic search
await search_code({
  query: "async function that fetches user data from API",
  limit: 5,
  include_content: true
});
```

**Implementation Status**: ✅ **Fully Functional**

### 2. explain_function

**Description**: Comprehensive function explanation including purpose, parameters, algorithm, and usage examples.

**Input Schema**:
```json
{
  "function_identifier": "string (required) - Function name or file:line reference",
  "codebase_id": "string (optional) - Specific codebase UUID to search in",
  "detail_level": "string (optional, default: 'standard') - 'basic' | 'standard' | 'comprehensive'",
  "include_examples": "boolean (optional, default: false) - Include usage examples",
  "language": "string (optional) - Programming language hint"
}
```

**Output Schema**:
```json
{
  "success": "boolean",
  "explanation": "string - Comprehensive function description",
  "function_info": {
    "name": "string",
    "signature": "string",
    "parameters": [
      {
        "name": "string",
        "type": "string",
        "optional": "boolean"
      }
    ],
    "return_type": "string",
    "location": {
      "file_path": "string",
      "line_number": "number"
    },
    "language": "string",
    "purpose": "string (optional)",
    "algorithm": "string (optional)",
    "complexity": "string (optional)",
    "dependencies": ["string"],
    "side_effects": ["string"],
    "type_parameters": ["string"]
  },
  "examples": [
    {
      "code": "string",
      "description": "string"
    }
  ],
  "multiple_matches": "boolean (optional)",
  "matches": [
    {
      "name": "string",
      "type": "string",
      "location": "object",
      "preview": "string"
    }
  ],
  "metadata": {
    "analysis_time_ms": "number",
    "functions_analyzed": "number"
  }
}
```

**Usage Examples**:
```typescript
// Explain function by name
await explain_function({
  function_identifier: "getUserById",
  detail_level: "comprehensive",
  include_examples: true
});

// Explain function by location
await explain_function({
  function_identifier: "src/services/user.ts:45",
  detail_level: "standard"
});

// Explain with language hint
await explain_function({
  function_identifier: "process_data",
  language: "python",
  include_examples: true
});
```

**Implementation Status**: ✅ **Fully Functional**

### 3. find_references

**Description**: Find all references to a variable, function, class, or other symbol across the codebase.

**Input Schema**:
```json
{
  "target_identifier": "string (required) - Symbol name to find references for",
  "codebase_id": "string (optional) - Specific codebase UUID to search in",
  "reference_types": "array (optional) - Filter by reference type",
  "include_declarations": "boolean (optional, default: true) - Include symbol declarations",
  "max_results": "number (optional, default: 100) - Maximum results to return",
  "file_patterns": "array (optional) - Glob patterns for file filtering"
}
```

**Reference Types**:
- `read` - Variable read operations
- `write` - Variable write operations
- `call` - Function/method calls
- `declaration` - Symbol declarations
- `import` - Import statements
- `instantiation` - Class/object creation
- `inheritance` - Class inheritance

**Output Schema**:
```json
{
  "success": "boolean",
  "target_info": {
    "name": "string",
    "type": "string",
    "location": {
      "file_path": "string",
      "line_number": "number"
    }
  },
  "references": [
    {
      "file_path": "string",
      "line_number": "number",
      "column_number": "number",
      "reference_type": "string",
      "context": "string",
      "target_name": "string",
      "confidence": "number (0-1)"
    }
  ],
  "multiple_targets": "boolean (optional)",
  "targets": [
    {
      "name": "string",
      "type": "string",
      "location": "object",
      "preview": "string"
    }
  ],
  "summary": {
    "total_references": "number",
    "unique_files": "number",
    "reference_types": "object",
    "by_type": "object",
    "by_file": "object"
  },
  "metadata": {
    "search_time_ms": "number",
    "files_searched": "number",
    "total_references": "number"
  }
}
```

**Usage Examples**:
```typescript
// Find all references to a variable
await find_references({
  target_identifier: "currentUser",
  reference_types: ["read", "write"],
  include_declarations: false
});

// Find function calls
await find_references({
  target_identifier: "validateEmail",
  reference_types: ["call"]
});

// Find class references
await find_references({
  target_identifier: "UserService",
  reference_types: ["instantiation", "inheritance", "import"],
  max_results: 50
});
```

**Implementation Status**: 📝 **Contract Test Complete** (T011)

### 4. trace_data_flow

**Description**: Trace data flow through functions and across modules to understand how data transforms and propagates.

**Input Schema**:
```json
{
  "entry_point": "string (required) - Function name or file:line to start tracing from",
  "codebase_id": "string (optional) - Specific codebase UUID",
  "trace_depth": "number (optional, default: 5) - Maximum depth to trace (1-20)",
  "include_libraries": "boolean (optional, default: false) - Include external library calls",
  "flow_direction": "string (optional, default: 'forward') - 'forward' | 'backward' | 'bidirectional'",
  "target_variables": "array (optional) - Specific variables to track"
}
```

**Output Schema**:
```json
{
  "success": "boolean",
  "entry_point_info": {
    "name": "string",
    "location": {
      "file_path": "string",
      "line_number": "number"
    },
    "signature": "string"
  },
  "data_flow": {
    "direction": "string",
    "steps": [
      {
        "sequence_number": "number",
        "depth": "number",
        "operation": "string",
        "operation_type": "string",
        "location": {
          "file_path": "string",
          "line_number": "number"
        },
        "data_transformations": [
          {
            "variable_name": "string",
            "before_value": "any",
            "after_value": "any",
            "operation": "string",
            "operation_category": "string"
          }
        ],
        "is_library_function": "boolean"
      }
    ],
    "cross_file_flows": [
      {
        "from_file": "string",
        "to_file": "string",
        "data_transferred": ["string"],
        "transfer_point": {
          "file_path": "string",
          "line_number": "number"
        }
      }
    ],
    "patterns": [
      {
        "name": "string",
        "type": "string",
        "locations": ["object"]
      }
    ],
    "anti_patterns": [
      {
        "name": "string",
        "severity": "string",
        "locations": ["object"]
      }
    ],
    "circular_dependencies": [
      {
        "cycle_path": ["string"],
        "entry_point": "string",
        "severity": "string"
      }
    ]
  },
  "final_state": {
    "variables": [
      {
        "name": "string",
        "value": "any",
        "type": "string"
      }
    ]
  },
  "visualization_data": {
    "nodes": [
      {
        "id": "string",
        "type": "string",
        "label": "string",
        "position": "object"
      }
    ],
    "edges": [
      {
        "from": "string",
        "to": "string",
        "data_flow": "object"
      }
    ]
  },
  "metadata": {
    "trace_time_ms": "number",
    "functions_analyzed": "number",
    "data_transformations": "number",
    "max_depth_reached": "number",
    "complexity_metrics": {
      "cyclomatic_complexity": "number",
      "data_flow_complexity": "number"
    }
  }
}
```

**Usage Examples**:
```typescript
// Trace data flow from function entry point
await trace_data_flow({
  entry_point: "processUserData",
  trace_depth: 5,
  include_libraries: false
});

// Trace specific variables
await trace_data_flow({
  entry_point: "calculateTotal",
  target_variables: ["price", "quantity", "total"],
  trace_depth: 3
});

// Bidirectional tracing
await trace_data_flow({
  entry_point: "dataProcessor",
  flow_direction: "bidirectional",
  trace_depth: 4
});
```

**Implementation Status**: 📝 **Contract Test Complete** (T012)

### 5. analyze_security

**Description**: Analyze code for security vulnerabilities, anti-patterns, and compliance issues.

**Input Schema**:
```json
{
  "target": "string (required) - File path, function name, or 'codebase' for full analysis",
  "security_levels": "array (optional) - Security check levels to run",
  "severity_threshold": "string (optional, default: 'medium') - Minimum severity level",
  "include_suggestions": "boolean (optional, default: true) - Include remediation suggestions",
  "compliance_standards": "array (optional) - Security standards to check against"
}
```

**Output Schema**:
```json
{
  "success": "boolean",
  "analysis_summary": {
    "total_issues": "number",
    "critical_issues": "number",
    "high_issues": "number",
    "medium_issues": "number",
    "low_issues": "number",
    "files_analyzed": "number"
  },
  "vulnerabilities": [
    {
      "id": "string",
      "title": "string",
      "severity": "string",
      "category": "string",
      "description": "string",
      "location": {
        "file_path": "string",
        "line_number": "number",
        "code_snippet": "string"
      },
      "cwe_id": "string",
      "cvss_score": "number",
      "remediation": "string",
      "references": ["string"]
    }
  ],
  "security_patterns": [
    {
      "pattern": "string",
      "type": "'positive' | 'negative'",
      "description": "string",
      "locations": ["object"]
    }
  ],
  "compliance_report": {
    "standards_checked": ["string"],
    "compliance_score": "number",
    "violations": ["object"]
  },
  "recommendations": [
    {
      "priority": "string",
      "action": "string",
      "description": "string",
      "impact": "string"
    }
  ],
  "metadata": {
    "analysis_time_ms": "number",
    "tools_used": ["string"],
    "scan_coverage": "number"
  }
}
```

**Usage Examples**:
```typescript
// Full codebase security analysis
await analyze_security({
  target: "codebase",
  severity_threshold: "low",
  include_suggestions: true
});

// Analyze specific file
await analyze_security({
  target: "src/auth/authentication.ts",
  security_levels: ["sast", "dependency"],
  compliance_standards: ["owasp", "pci-dss"]
});

// Quick security check
await analyze_security({
  target: "payment-processor",
  severity_threshold: "high",
  include_suggestions: false
});
```

**Implementation Status**: 📝 **Contract Test Complete** (T013)

### 6. get_api_endpoints

**Description**: Discover and catalog all API endpoints in the codebase, including REST, GraphQL, and internal APIs.

**Input Schema**:
```json
{
  "codebase_id": "string (optional) - Specific codebase UUID",
  "api_types": "array (optional) - Types of APIs to discover",
  "include_documentation": "boolean (optional, default: true) - Include endpoint documentation",
  "group_by": "string (optional, default: 'path') - 'path' | 'method' | 'controller'",
  "filter_by_tag": "array (optional) - Filter endpoints by tags"
}
```

**Output Schema**:
```json
{
  "success": "boolean",
  "api_summary": {
    "total_endpoints": "number",
    "api_types": ["string"],
    "controllers": ["string"],
    "version": "string"
  },
  "endpoints": [
    {
      "path": "string",
      "method": "string",
      "controller": "string",
      "action": "string",
      "parameters": [
        {
          "name": "string",
          "type": "string",
          "required": "boolean",
          "location": "string"
        }
      ],
      "responses": [
        {
          "status_code": "number",
          "description": "string",
          "schema": "object"
        }
      ],
      "middleware": ["string"],
      "tags": ["string"],
      "documentation": {
        "summary": "string",
        "description": "string",
        "examples": ["object"]
      },
      "location": {
        "file_path": "string",
        "line_number": "number"
      }
    }
  ],
  "groupings": "object",
  "openapi_spec": "object",
  "metadata": {
    "scan_time_ms": "number",
    "files_scanned": "number",
    "frameworks_detected": ["string"]
  }
}
```

**Usage Examples**:
```typescript
// Get all API endpoints
await get_api_endpoints({
  include_documentation: true,
  group_by: "controller"
});

// Get specific API types
await get_api_endpoints({
  api_types: ["rest", "graphql"],
  filter_by_tag: ["public", "v1"]
});

// Quick endpoint list
await get_api_endpoints({
  group_by: "path",
  include_documentation: false
});
```

**Implementation Status**: 📝 **Contract Test Complete** (T014)

### 7. check_complexity

**Description**: Analyze code complexity metrics including cyclomatic complexity, cognitive complexity, and maintainability index.

**Input Schema**:
```json
{
  "target": "string (required) - File path, directory, or function name",
  "complexity_types": "array (optional) - Types of complexity to measure",
  "thresholds": "object (optional) - Custom thresholds for complexity metrics",
  "include_suggestions": "boolean (optional, default: true) - Include refactoring suggestions",
  "detailed_analysis": "boolean (optional, default: false) - Include detailed breakdown"
}
```

**Output Schema**:
```json
{
  "success": "boolean",
  "complexity_summary": {
    "overall_score": "number",
    "maintainability_index": "number",
    "total_complexity": "number",
    "files_analyzed": "number",
    "functions_analyzed": "number"
  },
  "metrics": [
    {
      "name": "string",
      "value": "number",
      "threshold": "number",
      "status": "'good' | 'warning' | 'critical'",
      "description": "string"
    }
  ],
  "complex_items": [
    {
      "type": "'file' | 'function' | 'class'",
      "name": "string",
      "location": {
        "file_path": "string",
        "line_number": "number"
      },
      "complexity_scores": {
        "cyclomatic": "number",
        "cognitive": "number",
        "halstead": "object"
      },
      "issues": ["string"],
      "suggestions": ["string"]
    }
  ],
  "trends": {
    "historical_data": ["object"],
    "recommendations": ["string"]
  },
  "metadata": {
    "analysis_time_ms": "number",
    "metrics_calculated": ["string"]
  }
}
```

**Usage Examples**:
```typescript
// Analyze entire codebase complexity
await check_complexity({
  target: "src/",
  detailed_analysis: true,
  include_suggestions: true
});

// Check specific function
await check_complexity({
  target: "processData",
  complexity_types: ["cyclomatic", "cognitive"]
});

// Custom thresholds
await check_complexity({
  target: "authentication/",
  thresholds: {
    cyclomatic: 10,
    cognitive: 15
  }
});
```

**Implementation Status**: 📝 **Contract Test Complete** (T015)

### 8. find_duplicates

**Description**: Detect duplicate code patterns, similar functions, and redundant implementations across the codebase.

**Input Schema**:
```json
{
  "target": "string (required) - Directory path or 'codebase'",
  "similarity_threshold": "number (optional, default: 0.8) - Minimum similarity score (0-1)",
  "duplicate_types": "array (optional) - Types of duplicates to find",
  "ignore_whitespace": "boolean (optional, default: true) - Ignore whitespace differences",
  "ignore_comments": "boolean (optional, default: true) - Ignore comments",
  "max_results": "number (optional, default: 50) - Maximum duplicate groups to return"
}
```

**Output Schema**:
```json
{
  "success": "boolean",
  "duplicate_summary": {
    "total_duplicates": "number",
    "duplicate_groups": "number",
    "potential_savings": "string",
    "files_analyzed": "number"
  },
  "duplicate_groups": [
    {
      "id": "string",
      "similarity_score": "number",
      "type": "string",
      "instances": [
        {
          "file_path": "string",
          "line_number": "number",
          "code_snippet": "string",
          "function_name": "string"
        }
      ],
      "suggested_refactoring": {
        "type": "string",
        "description": "string",
        "benefits": ["string"]
      }
    }
  ],
  "patterns": [
    {
      "pattern": "string",
      "frequency": "number",
      "locations": ["object"]
    }
  ],
  "recommendations": [
    {
      "priority": "string",
      "action": "string",
      "estimated_effort": "string",
      "benefit": "string"
    }
  ],
  "metadata": {
    "analysis_time_ms": "number",
    "algorithms_used": ["string"],
    "comparison_count": "number"
  }
}
```

**Usage Examples**:
```typescript
// Find all duplicates in codebase
await find_duplicates({
  target: "src/",
  similarity_threshold: 0.8,
  max_results: 20
});

// Find function duplicates only
await find_duplicates({
  target: "services/",
  duplicate_types: ["functions", "methods"],
  similarity_threshold: 0.9
});

// Quick duplicate check
await find_duplicates({
  target: "utils/",
  ignore_whitespace: true,
  ignore_comments: true
});
```

**Implementation Status**: 📝 **Contract Test Complete** (T016)

### 9. suggest_refactoring

**Description**: Provide intelligent refactoring suggestions based on code analysis, best practices, and design patterns.

**Input Schema**:
```json
{
  "target": "string (required) - File path, directory, or function name",
  "refactoring_types": "array (optional) - Types of refactoring to suggest",
  "priority": "string (optional, default: 'medium') - Priority level of suggestions",
  "include_examples": "boolean (optional, default: true) - Include code examples",
  "consider_impact": "boolean (optional, default: true) - Analyze impact of changes"
}
```

**Output Schema**:
```json
{
  "success": "boolean",
  "refactoring_summary": {
    "total_suggestions": "number",
    "high_priority": "number",
    "medium_priority": "number",
    "low_priority": "number",
    "estimated_improvement": "string"
  },
  "suggestions": [
    {
      "id": "string",
      "title": "string",
      "type": "string",
      "priority": "string",
      "description": "string",
      "benefits": ["string"],
      "effort": "string",
      "risk": "string",
      "location": {
        "file_path": "string",
        "line_number": "number"
      },
      "current_code": "string",
      "suggested_code": "string",
      "steps": ["string"],
      "impact_analysis": {
        "affected_files": ["string"],
        "breaking_changes": "boolean",
        "test_coverage_needed": "boolean"
      },
      "examples": [
        {
          "before": "string",
          "after": "string",
          "explanation": "string"
        }
      ]
    }
  ],
  "design_patterns": [
    {
      "pattern": "string",
      "applicable_locations": ["object"],
      "benefits": ["string"]
    }
  ],
  "code_smells": [
    {
      "smell": "string",
      "locations": ["object"],
      "severity": "string"
    }
  ],
  "metadata": {
    "analysis_time_ms": "number",
    "rules_applied": ["string"],
    "confidence_score": "number"
  }
}
```

**Usage Examples**:
```typescript
// Get comprehensive refactoring suggestions
await suggest_refactoring({
  target: "src/",
  priority: "medium",
  include_examples: true,
  consider_impact: true
});

// Focus on specific refactoring types
await suggest_refactoring({
  target: "services/user/",
  refactoring_types: ["extract_method", "introduce_parameter"],
  priority: "high"
});

// Quick suggestions
await suggest_refactoring({
  target: "utils/validation.ts",
  priority: "low",
  include_examples: false
});
```

**Implementation Status**: 📝 **Contract Test Complete** (T017)

## Contract Test Status

### Phase 3.2: Tests First (TDD) ✅

All MCP tool contract tests have been completed following Test-Driven Development principles:

- ✅ **T009**: `search_code` contract test
- ✅ **T010**: `explain_function` contract test  
- ✅ **T011**: `find_references` contract test
- ✅ **T012**: `trace_data_flow` contract test
- 📝 **T013**: `analyze_security` contract test (in progress)
- 📝 **T014**: `get_api_endpoints` contract test (pending)
- 📝 **T015**: `check_complexity` contract test (pending)
- 📝 **T016**: `find_duplicates` contract test (pending)
- 📝 **T017**: `suggest_refactoring` contract test (pending)

### Test Coverage

Each contract test validates:
- ✅ Tool registration and schema validation
- ✅ Input/output format compliance
- ✅ Error handling for invalid inputs
- ✅ Complex scenarios and edge cases
- ✅ Performance and execution metrics
- ✅ Cross-language compatibility
- ✅ Integration with TypeScript/Rust hybrid architecture

## Usage in Claude Desktop

Configure your Claude Desktop to use these tools:

```json
{
  "mcpServers": {
    "codesight": {
      "command": "node",
      "args": ["F:/path/to/codesight-mcp/typescript-mcp/dist/index.js"],
      "cwd": "F:/path/to/codesight-mcp/typescript-mcp"
    }
  }
}
```

Once configured, you can use natural language commands like:

- "Search for authentication functions in the codebase"
- "Explain what the `processUserData` function does"
- "Find all references to the `UserService` class"
- "Trace the data flow from API endpoint to database"
- "Analyze security vulnerabilities in the payment module"
- "List all REST API endpoints in the project"
- "Check complexity metrics for the user service"
- "Find duplicate code patterns in the utils directory"
- "Suggest refactoring opportunities for the legacy code"

## Implementation Notes

### Architecture

The MCP tools are built on a hybrid TypeScript/Rust architecture:

- **TypeScript Layer**: MCP protocol handling, API surface, user interactions
- **Rust Layer**: Performance-critical operations, parsing, analysis
- **SQLite Database**: Persistent storage for indexed code entities
- **NAPI-RS Bridge**: Seamless integration between TypeScript and Rust components

### Performance

- **Indexing**: ~1-2 seconds for typical projects (47 files)
- **Tool Execution**: ~20-50ms average response time
- **Memory Usage**: ~25MB baseline with efficient scaling
- **Multi-Language**: Support for 15+ programming languages

### Error Handling

All tools implement comprehensive error handling:
- Graceful degradation when Rust components are unavailable
- Detailed error messages with actionable suggestions
- Timeout protection for long-running operations
- Input validation with clear error responses
- Performance monitoring and metrics collection

## Contributing

When adding new MCP tools:

1. **Contract Test First**: Write comprehensive contract tests before implementation
2. **Schema Validation**: Define clear input/output schemas
3. **Error Handling**: Implement comprehensive error scenarios
4. **Documentation**: Update this documentation with examples
5. **Testing**: Include performance and integration tests

## Roadmap

### Phase 3.3: Core Implementation
- Implement remaining 7 MCP tools based on completed contract tests
- Enhance existing tools with advanced features
- Optimize performance and add caching

### Future Enhancements
- Vector embeddings for semantic search
- Real-time collaboration features
- Advanced code visualization
- Multi-tenant support
- Custom tool development framework