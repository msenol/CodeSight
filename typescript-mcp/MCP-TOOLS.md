# MCP Tools Documentation - CodeSight AI-Powered Code Intelligence

**Version: Phase 4.1**
**Last Updated: November 14, 2025**

This document provides comprehensive documentation for all 14 MCP tools implemented in the CodeSight server, including 9 core tools and 5 advanced AI-powered tools.

## Table of Contents

- [Core Tools (Phase 3.0-3.5)](#core-tools-phase-30---35)
  - [search_code](#search_code)
  - [explain_function](#explain_function)
  - [find_references](#find_references)
  - [trace_data_flow](#trace_data_flow)
  - [analyze_security](#analyze_security)
  - [get_api_endpoints](#get_api_endpoints)
  - [check_complexity](#check_complexity)
  - [find_duplicates](#find_duplicates)
  - [suggest_refactoring](#suggest_refactoring)
- [AI-Powered Tools (Phase 4.1)](#ai-powered-tools-phase-41)
  - [ai_code_review](#ai_code_review)
  - [intelligent_refactoring](#intelligent_refactoring)
  - [bug_prediction](#bug_prediction)
  - [context_aware_code_generation](#context_aware_code_generation)
  - [technical_debt_analysis](#technical_debt_analysis)
- [Tool Configuration](#tool-configuration)
- [Performance Metrics](#performance-metrics)
- [Usage Examples](#usage-examples)

---

## Core Tools (Phase 3.0 - 3.5)

### search_code

**Purpose**: Natural language search across the indexed codebase with relevance scoring and context.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Natural language search query (e.g., 'authentication functions', 'database connection logic')"
    },
    "codebase_id": {
      "type": "string",
      "description": "Codebase identifier for multi-codebase environments"
    }
  },
  "required": ["query", "codebase_id"]
}
```

**Output Format**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Found X matches for \"query\" in Yms:\n\n📄 file1.ts:line1 (score: 0.95)\n   code snippet...\n\n📄 file2.ts:line2 (score: 0.87)\n   code snippet..."
    }
  ]
}
```

**Features**:
- Natural language query processing
- SQLite database search with relevance scoring
- Context-aware results with file paths and line numbers
- Sub-50ms response times for most queries
- Support for multiple code patterns and synonyms

**Performance**:
- Response Time: 20-50ms (with Rust FFI)
- Memory Usage: ~25MB base
- Scalability: Handles 1000+ codebases efficiently

---

### explain_function

**Purpose**: Provides detailed explanations of what functions do, including parameters, return values, and complexity metrics.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "function_name": {
      "type": "string",
      "description": "Name of the function to explain"
    },
    "codebase_id": {
      "type": "string",
      "description": "Codebase identifier"
    }
  },
  "required": ["function_name", "codebase_id"]
}
```

**Output Format**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "📚 Function: functionName in codebase\n\nPurpose: Detailed description of what the function does...\n\nParameters:\n- param1: Type and description\n- param2: Type and description\n\nReturns: Return type and description\n\nComplexity: Medium (Cyclomatic complexity: 5)\n\nUsage: Example usage patterns..."
    }
  ]
}
```

**Features**:
- Function signature analysis
- Parameter and return value documentation
- Cyclomatic complexity calculation
- Usage pattern identification
- Cross-reference detection

---

### find_references

**Purpose**: Locates all references to a symbol (function, variable, class, etc.) across the entire codebase.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "symbol_name": {
      "type": "string",
      "description": "Name of the symbol to find references for"
    },
    "codebase_id": {
      "type": "string",
      "description": "Codebase identifier"
    }
  },
  "required": ["symbol_name", "codebase_id"]
}
```

**Output Format**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "🔍 References for \"symbolName\" in codebase:\n\n- src/index.ts:15 - Import statement\n- src/index.ts:45 - Function call\n- src/utils.ts:23 - Variable assignment\n- tests/index.test.ts:10 - Test usage\n\nTotal: X references found"
    }
  ]
}
```

**Features**:
- Cross-file reference tracking
- Reference type classification (imports, calls, assignments, etc.)
- Test file reference detection
- Dead code identification

---

### trace_data_flow

**Purpose**: Traces the flow of data through variables and functions, showing how data is transformed and passed through the system.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "variable_name": {
      "type": "string",
      "description": "Name of the variable to trace"
    },
    "file_path": {
      "type": "string",
      "description": "File path containing the variable"
    },
    "codebase_id": {
      "type": "string",
      "description": "Codebase identifier"
    }
  },
  "required": ["variable_name", "file_path", "codebase_id"]
}
```

**Output Format**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "🔄 Data flow for \"variableName\" in filePath:\n\n1. Initialized at line 10: const variableName = getData();\n2. Modified at line 25: variableName = transform(variableName);\n3. Passed to function at line 30: processData(variableName);\n4. Returned at line 45: return { result: variableName };\n\nFlow type: Linear with 1 branch"
    }
  ]
}
```

**Features**:
- Variable lifecycle tracking
- Data transformation visualization
- Branch and merge point identification
- Type inference along data flow

---

### analyze_security

**Purpose**: Comprehensive security vulnerability analysis with risk assessment and remediation recommendations.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "file_path": {
      "type": "string",
      "description": "File path to analyze (optional, analyzes entire codebase if not provided)"
    },
    "codebase_id": {
      "type": "string",
      "description": "Codebase identifier"
    }
  },
  "required": ["codebase_id"]
}
```

**Output Format**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "🔒 Security Analysis for scope:\n\n⚠️ Medium Risk:\n- Potential SQL injection at line 45 (use parameterized queries)\n- Missing input validation at line 78\n\nℹ️ Low Risk:\n- Consider using environment variables for API keys (line 12)\n- Add rate limiting to public endpoints\n\n✅ Good Practices Found:\n- Proper JWT validation\n- HTTPS enforcement\n- Input sanitization in most endpoints"
    }
  ]
}
```

**Security Checks**:
- SQL injection detection
- XSS vulnerability scanning
- Authentication and authorization analysis
- Input validation verification
- Secret and credential exposure detection
- OWASP Top 10 compliance checking

---

### get_api_endpoints

**Purpose**: Automatically discovers and documents all API endpoints in the codebase with HTTP methods, parameters, and response codes.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "framework": {
      "type": "string",
      "description": "Framework type (express, fastify, nestjs, etc.)",
      "enum": ["express", "fastify", "nestjs", "koa", "hapi", "auto-detect"]
    },
    "codebase_id": {
      "type": "string",
      "description": "Codebase identifier"
    }
  },
  "required": ["codebase_id"]
}
```

**Output Format**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "🌐 API Endpoints in codebase (framework):\n\nGET /api/users - Get all users\nGET /api/users/:id - Get user by ID\nPOST /api/users - Create new user\nPUT /api/users/:id - Update user\nDELETE /api/users/:id - Delete user\nGET /api/health - Health check\nPOST /api/auth/login - User login\nPOST /api/auth/logout - User logout\n\nTotal: X endpoints"
    }
  ]
}
```

**Supported Frameworks**:
- Express.js
- Fastify
- NestJS
- Koa.js
- Hapi.js
- Automatic framework detection

---

### check_complexity

**Purpose**: Analyzes code complexity metrics including cyclomatic complexity, cognitive complexity, and maintainability index.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "file_path": {
      "type": "string",
      "description": "File path to analyze"
    },
    "codebase_id": {
      "type": "string",
      "description": "Codebase identifier"
    }
  },
  "required": ["file_path", "codebase_id"]
}
```

**Output Format**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "📊 Complexity Analysis for filePath:\n\nOverall Metrics:\n- Cyclomatic Complexity: 12 (Moderate)\n- Cognitive Complexity: 8 (Low)\n- Lines of Code: 245\n- Functions: 15\n\nComplex Functions:\n1. processData() - Complexity: 8 (line 45)\n2. validateInput() - Complexity: 6 (line 120)\n3. transformResult() - Complexity: 5 (line 180)\n\nRecommendation: Consider refactoring processData() function"
    }
  ]
}
```

**Metrics Provided**:
- Cyclomatic Complexity
- Cognitive Complexity
- Maintainability Index
- Lines of Code
- Function count
- Complexity distribution
- Refactoring recommendations

---

### find_duplicates

**Purpose**: Detects duplicate code patterns across the codebase using advanced similarity algorithms with configurable thresholds.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "min_lines": {
      "type": "number",
      "description": "Minimum number of lines for duplicate detection (default: 5)",
      "default": 5
    },
    "similarity_threshold": {
      "type": "number",
      "description": "Similarity threshold between 0-1 (default: 0.8)",
      "default": 0.8
    },
    "codebase_id": {
      "type": "string",
      "description": "Codebase identifier"
    }
  },
  "required": ["codebase_id"]
}
```

**Output Format**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "🔁 Duplicate Code in codebase (min X lines, similarity Y%):\n\nDuplicate Block 1 (12 lines):\n- src/utils.ts:45-57\n- src/helpers.ts:23-35\nSimilarity: 95%\n\nDuplicate Block 2 (8 lines):\n- src/api/users.ts:78-86\n- src/api/products.ts:92-100\nSimilarity: 88%\n\nTotal: X duplicate blocks found\nPotential lines saved: Y"
    }
  ]
}
```

**Features**:
- Structural similarity detection
- Token-based analysis
- Variable name normalization
- Whitespace and comment tolerance
- Refactoring opportunity identification

---

### suggest_refactoring

**Purpose**: Provides intelligent refactoring suggestions based on code analysis, best practices, and design patterns.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "file_path": {
      "type": "string",
      "description": "File path to analyze for refactoring"
    },
    "refactoring_type": {
      "type": "string",
      "enum": ["extract-method", "rename-variable", "reduce-complexity", "improve-naming", "apply-pattern", "all"],
      "description": "Type of refactoring to focus on",
      "default": "all"
    },
    "codebase_id": {
      "type": "string",
      "description": "Codebase identifier"
    }
  },
  "required": ["file_path", "codebase_id"]
}
```

**Output Format**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "♻️ Refactoring Suggestions for filePath:\n\n1. Extract Method (High Priority):\n   - Lines 45-78: Extract validation logic into separate function\n   - Lines 120-145: Create reusable data transformer\n\n2. Reduce Complexity:\n   - Function processData() has 8 conditional branches\n   - Consider using strategy pattern or lookup table\n\n3. Remove Dead Code:\n   - Unused variable 'tempData' at line 92\n   - Commented code block at lines 156-168\n\n4. Improve Naming:\n   - Rename 'x' to 'userData' (line 34)\n   - Rename 'proc' to 'processedResult' (line 67)"
    }
  ]
}
```

**Refactoring Categories**:
- Method extraction
- Variable renaming
- Complexity reduction
- Design pattern application
- Dead code removal
- Naming improvements

---

## AI-Powered Tools (Phase 4.1)

### ai_code_review

**Purpose**: AI-powered comprehensive code review with intelligent suggestions, quality scoring, and best practice analysis.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "file_path": {
      "type": "string",
      "description": "File path to review (optional, analyzes code snippet if not provided)"
    },
    "code_snippet": {
      "type": "string",
      "description": "Code snippet to review (optional, uses file_path if not provided)"
    },
    "review_type": {
      "type": "string",
      "enum": ["basic", "comprehensive", "security-focused", "performance-focused"],
      "description": "Type of code review to perform"
    },
    "codebase_id": {
      "type": "string",
      "description": "Codebase identifier"
    },
    "context": {
      "type": "object",
      "properties": {
        "pr_description": { "type": "string" },
        "changed_files": { "type": "array", "items": { "type": "string" } },
        "target_branch": { "type": "string" }
      },
      "description": "Additional context for the review"
    }
  },
  "required": ["codebase_id", "review_type"]
}
```

**Output Format**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "🤖 AI Code Review (review_type)\n\nOverall Score: X/100\n\n📊 Metrics:\n- Complexity Score: X\n- Maintainability Index: X\n- Security Score: X\n\n🔍 Issues Found: X\n\n1. SEVERITY: Title\n   Description\n   Category: category | Confidence: X%\n   Suggestion: detailed suggestion\n\n💡 Key Recommendations:\n1. action (priority)\n   Rationale: explanation"
    }
  ]
}
```

**AI Features**:
- Multi-provider AI analysis (Claude, GPT-4, Ollama)
- Context-aware code understanding
- Intelligent pattern recognition
- Quality scoring with confidence levels
- Actionable improvement suggestions
- Security vulnerability detection
- Performance optimization recommendations

**Review Types**:
- **Basic**: Quick overview of major issues and improvements
- **Comprehensive**: In-depth analysis covering all aspects
- **Security-focused**: Emphasis on security vulnerabilities and best practices
- **Performance-focused**: Optimization and performance improvement suggestions

---

### intelligent_refactoring

**Purpose**: AI-driven refactoring recommendations with code transformation suggestions, impact analysis, and implementation guidance.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "file_path": {
      "type": "string",
      "description": "File path to refactor (optional, uses code_snippet if not provided)"
    },
    "code_snippet": {
      "type": "string",
      "description": "Code snippet to refactor (optional, uses file_path if not provided)"
    },
    "refactoring_type": {
      "type": "string",
      "enum": ["extract-method", "rename-variable", "reduce-complexity", "optimize-performance", "improve-readability", "apply-pattern"],
      "description": "Type of refactoring to focus on"
    },
    "target_scope": {
      "type": "string",
      "enum": ["function", "class", "module", "entire-file"],
      "description": "Scope of refactoring analysis"
    },
    "codebase_id": {
      "type": "string",
      "description": "Codebase identifier"
    },
    "preferences": {
      "type": "object",
      "properties": {
        "preserve_behavior": { "type": "boolean" },
        "backward_compatible": { "type": "boolean" },
        "test_driven": { "type": "boolean" }
      },
      "description": "Refactoring preferences and constraints"
    }
  },
  "required": ["codebase_id", "refactoring_type"]
}
```

**Output Format**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "♻️ Intelligent Refactoring Analysis\n\nOverall Assessment:\n- Refactoring Potential: X%\n- Code Quality Score: X/100\n- Maintainability Improvement: +X\n- Effort Required: X%\n\n📋 Found X Refactoring Opportunities:\n\n1. Title\n   Category: category | Impact: impact\n   Effort: effort | Confidence: X%\n   Benefits: benefit1, benefit2\n\n   Original Code:\n   code excerpt...\n\n   Suggested Code:\n   refactored code..."
    }
  ]
}
```

**AI Capabilities**:
- Context-aware refactoring suggestions
- Impact analysis and risk assessment
- Automated code transformation examples
- Effort estimation and prioritization
- Test-driven refactoring guidance
- Architectural pattern application

**Refactoring Types**:
- **extract-method**: Identify and extract reusable methods
- **rename-variable**: Suggest meaningful variable names
- **reduce-complexity**: Simplify complex logic structures
- **optimize-performance**: Improve performance characteristics
- **improve-readability**: Enhance code clarity and maintainability
- **apply-pattern**: Suggest design pattern applications

---

### bug_prediction

**Purpose**: Proactive bug prediction and risk assessment using ML-enhanced analysis, historical data, and pattern recognition.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "file_path": {
      "type": "string",
      "description": "File path to analyze (optional, uses code_snippet if not provided)"
    },
    "code_snippet": {
      "type": "string",
      "description": "Code snippet to analyze (optional, uses file_path if not provided)"
    },
    "prediction_type": {
      "type": "string",
      "enum": ["proactive", "reactive", "pattern-based", "ml-enhanced"],
      "description": "Type of bug prediction analysis"
    },
    "scope": {
      "type": "string",
      "enum": ["function", "class", "module", "system"],
      "description": "Scope of bug prediction analysis"
    },
    "codebase_id": {
      "type": "string",
      "description": "Codebase identifier"
    },
    "historical_data": {
      "type": "object",
      "description": "Historical bug and testing data for better predictions"
    }
  },
  "required": ["codebase_id", "prediction_type", "scope"]
}
```

**Output Format**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "🔮 Bug Prediction Analysis (prediction_type)\n\nRisk Assessment: RISK_CATEGORY\nBug Risk Score: X/100\nPredicted Bugs: X\n\n🚨 Identified Risks: X\n\n1. Title\n   Category: category | Severity: severity\n   Likelihood: X% | Impact: impact\n   Location: file_path:line_start\n   Description: detailed description\n   Mitigation: strategy1, strategy2\n\n🎯 Hotspots: X\n1. location (Risk: risk_concentration)\n   Issues: issue_types"
    }
  ]
}
```

**AI Analysis Features**:
- Machine learning-based risk assessment
- Historical bug pattern analysis
- Code complexity correlation
- Developer experience factor analysis
- Test coverage correlation
- Integration point risk identification

**Prediction Types**:
- **proactive**: Identify potential bugs before they occur
- **reactive**: Analyze existing code for likely bug sources
- **pattern-based**: Use known bug patterns for prediction
- **ml-enhanced**: Advanced ML models with multiple data sources

---

### context_aware_code_generation

**Purpose**: AI-powered context-aware code generation that understands project structure, coding standards, and architectural patterns.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "prompt": {
      "type": "string",
      "description": "Natural language description of code to generate"
    },
    "context": {
      "type": "object",
      "properties": {
        "file_path": { "type": "string" },
        "surrounding_code": { "type": "string" },
        "project_structure": { "type": "string" },
        "existing_patterns": { "type": "array", "items": { "type": "string" } },
        "dependencies": { "type": "array", "items": { "type": "string" } },
        "coding_standards": {
          "type": "object",
          "properties": {
            "language": { "type": "string" },
            "style_guide": { "type": "string" },
            "naming_conventions": { "type": "array", "items": { "type": "string" } }
          }
        }
      },
      "description": "Project and code context for generation"
    },
    "generation_type": {
      "type": "string",
      "enum": ["function", "class", "module", "test", "documentation", "configuration"],
      "description": "Type of code to generate"
    },
    "constraints": {
      "type": "object",
      "properties": {
        "max_lines": { "type": "number" },
        "complexity_limit": { "type": "number" },
        "test_required": { "type": "boolean" },
        "documentation_required": { "type": "boolean" },
        "performance_optimized": { "type": "boolean" }
      },
      "description": "Generation constraints and requirements"
    },
    "codebase_id": {
      "type": "string",
      "description": "Codebase identifier"
    }
  },
  "required": ["codebase_id", "prompt", "generation_type"]
}
```

**Output Format**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "⚡ Context-Aware Code Generation\n\nGenerated: type (X lines)\nLanguage: language\nConfidence Score: X/100\n\n📝 Generated Code:\n```language\ngenerated code\n```\n\n✅ Validation: PASSED/FAILED\nIssues: X\n\n📊 Context Compliance:\n- Style Compliance: X%\n- Naming Convention: X%\n- Architectural Alignment: X%\n\n💡 Suggestions:\n- optimization suggestions"
    }
  ]
}
```

**AI Capabilities**:
- Project-aware code generation
- Style and pattern consistency
- Architectural compliance checking
- Automated syntax validation
- Performance optimization suggestions
- Integration point identification

**Generation Types**:
- **function**: Generate individual functions with proper signatures
- **class**: Create classes with appropriate methods and properties
- **module**: Generate complete modules with imports/exports
- **test**: Create comprehensive test cases
- **documentation**: Generate documentation and comments
- **configuration**: Create configuration files and settings

---

### technical_debt_analysis

**Purpose**: Comprehensive technical debt assessment with business impact analysis, prioritization matrices, and remediation planning.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "file_path": {
      "type": "string",
      "description": "File path to analyze (optional, analyzes entire codebase if not provided)"
    },
    "scope": {
      "type": "string",
      "enum": ["function", "class", "module", "system"],
      "description": "Scope of technical debt analysis"
    },
    "analysis_depth": {
      "type": "string",
      "enum": ["basic", "comprehensive", "deep"],
      "description": "Depth of technical debt analysis"
    },
    "include_recommendations": {
      "type": "boolean",
      "description": "Include actionable recommendations and remediation plans",
      "default": true
    },
    "codebase_id": {
      "type": "string",
      "description": "Codebase identifier"
    },
    "historical_data": {
      "type": "object",
      "description": "Historical data for trend analysis and prediction"
    }
  },
  "required": ["codebase_id", "scope", "analysis_depth"]
}
```

**Output Format**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "📊 Technical Debt Analysis (analysis_depth)\n\nOverall Assessment: DEBT_CATEGORY\nDebt Score: X/100\nInterest Rate: X%\nPrincipal: X\nEstimated Interest: X\n\n💰 Financial Impact:\n- Current Cost/Month: $X\n- 6-Month Projection: $X\n- 12-Month Projection: $X\n- ROI Potential: X%\n\n🚨 Debt Hotspots: X\n\n1. location\n   Concentration: concentration\n   Issues: issues\n   Actions: actions\n\n🎯 Quick Wins: X\n1. title (Impact: X, Effort: X)"
    }
  ]
}
```

**Analysis Features**:
- Business impact quantification
- Debt interest calculation
- ROI analysis for remediation
- Priority matrix generation
- Trend analysis and prediction
- Cost-benefit analysis

**Analysis Depths**:
- **basic**: High-level debt overview with major issues
- **comprehensive**: Detailed analysis with multiple metrics
- **deep**: Extensive analysis including business impact and trends

---

## Tool Configuration

### Global Configuration

All tools can be configured through environment variables and the configuration system:

```typescript
// Configuration example
{
  tools: {
    search_code: {
      max_results: 10,
      context_lines: 3,
      include_tests: true
    },
    ai_tools: {
      provider: "anthropic-claude",
      timeout_ms: 30000,
      cache_enabled: true,
      fallback_enabled: true
    }
  }
}
```

### AI Tool Configuration

AI-powered tools support additional configuration for provider selection and behavior:

```bash
# Environment variables
ANTHROPIC_API_KEY=your-key
OPENAI_API_KEY=your-key
PREFERRED_AI_PROVIDER=anthropic-claude
AI_CACHE_ENABLED=true
AI_TIMEOUT_MS=30000
```

---

## Performance Metrics

### Core Tools Performance

| Tool | Response Time | Memory Usage | Accuracy | Scalability |
|------|---------------|--------------|----------|-------------|
| search_code | 20-50ms | ~25MB | 95%+ | Excellent |
| explain_function | 10-30ms | ~25MB | 90%+ | Excellent |
| find_references | 15-40ms | ~25MB | 95%+ | Excellent |
| trace_data_flow | 30-80ms | ~30MB | 85%+ | Good |
| analyze_security | 50-150ms | ~35MB | 90%+ | Good |
| get_api_endpoints | 25-60ms | ~25MB | 95%+ | Excellent |
| check_complexity | 20-50ms | ~25MB | 95%+ | Excellent |
| find_duplicates | 100-300ms | ~40MB | 90%+ | Good |
| suggest_refactoring | 40-120ms | ~30MB | 85%+ | Good |

### AI Tools Performance

| Tool | Response Time | Memory Overhead | Quality Score | Cost Efficiency |
|------|---------------|-----------------|---------------|----------------|
| ai_code_review | 200-800ms | +15-25MB | 8.5-9.5/10 | Medium |
| intelligent_refactoring | 250-900ms | +20-30MB | 8.0-9.0/10 | Medium |
| bug_prediction | 300-1200ms | +25-35MB | 8.0-9.2/10 | High |
| context_aware_code_generation | 400-1500ms | +25-30MB | 8.5-9.5/10 | Low |
| technical_debt_analysis | 500-2000ms | +30-40MB | 9.0-9.8/10 | Medium |

**Performance Notes:**
- Response times vary by AI provider (Claude fastest, rule-based fastest but lower quality)
- Memory overhead is additional to base ~25MB usage
- Quality scores are based on multi-factor analysis including accuracy and usefulness
- Cost efficiency considers API costs vs. value provided

---

## Usage Examples

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
        "PREFERRED_AI_PROVIDER": "anthropic-claude"
      }
    }
  }
}
```

### Direct API Usage

```typescript
// Example: Using search_code tool
const searchResult = await mcpClient.callTool('search_code', {
  query: 'authentication middleware',
  codebase_id: 'my-project'
});

// Example: AI code review
const reviewResult = await mcpClient.callTool('ai_code_review', {
  file_path: 'src/auth/middleware.ts',
  review_type: 'comprehensive',
  codebase_id: 'my-project'
});

// Example: Bug prediction
const bugPrediction = await mcpClient.callTool('bug_prediction', {
  file_path: 'src/payment/processor.ts',
  prediction_type: 'ml-enhanced',
  scope: 'function',
  codebase_id: 'my-project'
});
```

### CLI Integration

```bash
# Search for code patterns
node dist/cli/index.js search "user authentication"

# AI-powered code review
node dist/cli/index.js ai-review --file="src/service.ts" --type="security-focused"

# Technical debt analysis
node dist/cli/index.js tech-debt --scope="system" --depth="comprehensive"
```

---

## Tool Development Guidelines

### Adding New Tools

1. **Define Interface**: Create clear input/output schemas
2. **Implement Core Logic**: Focus on specific functionality
3. **Add Tests**: Comprehensive unit and integration tests
4. **Document**: Detailed documentation and examples
5. **Performance**: Optimize for response time and memory usage

### AI Tool Development

1. **Provider Abstraction**: Support multiple AI providers
2. **Fallback Strategy**: Rule-based fallback when AI unavailable
3. **Caching**: Implement intelligent response caching
4. **Quality Control**: Validate AI outputs and scoring
5. **Cost Management**: Monitor and control API costs

### Testing Strategy

- **Unit Tests**: Individual tool logic
- **Integration Tests**: End-to-end functionality
- **Performance Tests**: Response time and resource usage
- **AI Tests**: Provider validation and fallback testing
- **Contract Tests**: MCP protocol compliance

---

## Support and Troubleshooting

### Common Issues

1. **AI Tools Not Working**: Check API keys and provider availability
2. **Slow Performance**: Consider enabling caching or using faster providers
3. **Memory Issues**: Monitor memory usage with large codebases
4. **Incomplete Results**: Ensure codebase is properly indexed

### Debug Information

Enable debug logging for troubleshooting:

```bash
LOG_LEVEL=debug node dist/index.js
```

### Performance Monitoring

Monitor tool performance with built-in metrics:

```bash
curl http://localhost:4000/api/metrics
```

---

*This documentation covers all MCP tools as of Phase 4.1. For the latest updates and additional tools, refer to the project repository and release notes.*