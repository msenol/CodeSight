# AI Tools Documentation

CodeSight MCP Server includes 5 advanced AI-powered tools for comprehensive code intelligence.

## Overview

All AI tools support multiple LLM providers through OpenRouter:

- **OpenRouter** (Recommended): Access to 100+ AI models including Claude, GPT-4, Gemini, Llama
- **Free Tier Available**: `xiaomi/mimo-v2-flash:free` for production-quality analysis without cost
- **Intelligent Fallback**: Automatic fallback to rule-based analysis if AI fails

## Configuration

### Environment Variables

```bash
# Set OpenRouter as preferred provider
PREFERRED_AI_PROVIDER=openrouter

# Get API key from https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Choose your model
OPENROUTER_MODEL=xiaomi/mimo-v2-flash:free  # **RECOMMENDED** - Best free tier
# OPENROUTER_MODEL=z-ai/glm-4.5-air:free  # Free tier, basic analysis
# OPENROUTER_MODEL=anthropic/claude-3.5-haiku  # Fast, cost-effective
# OPENROUTER_MODEL=openai/gpt-4o-mini  # Balanced quality
# OPENROUTER_MODEL=anthropic/claude-3.5-sonnet  # Best for code
```

### Model Selection Guide

| Model | Cost | Best For | Speed | Quality |
|-------|------|----------|-------|---------|
| `xiaomi/mimo-v2-flash:free` | **Free** | **Testing, production use** | Medium | **Excellent** |
| `z-ai/glm-4.5-air:free` | Free | Basic testing | Medium | Basic |
| `anthropic/claude-3.5-haiku` | ~$0.80/1M tokens | Fast code analysis | Fast | Very Good |
| `openai/gpt-4o-mini` | ~$0.15/1M tokens | Cost-effective quality | Fast | Very Good |
| `anthropic/claude-3.5-sonnet` | ~$3/1M tokens | Deep code analysis | Medium | Best |

### Free Tier Comparison

| Feature | GLM-4.5-Air | Xiaomi Mimo v2 Flash |
|---------|-------------|---------------------|
| **Actual AI Calls** | ❌ No (fallback to rules) | ✅ Yes (100%) |
| **SQL Injection Detection** | ❌ No | ✅ Yes (95% confidence) |
| **Command Injection Detection** | ❌ No | ✅ Yes (95% confidence) |
| **Password Security Issues** | ❌ No | ✅ Yes (90% confidence) |
| **Issues Found** | 1 (generic) | 6-10 (specific) |
| **Response Time** | ~2s (fallback) | ~25s (real AI) |
| **Recommendation** | Not recommended | **Recommended** |

## AI Tools

### 1. AI Code Review (`ai_code_review`)

Comprehensive AI-powered code review with intelligent suggestions.

**Usage:**
```typescript
await mcp.call({
  name: "ai_code_review",
  arguments: {
    code_snippet: "function example() { ... }",
    codebase_id: "my-project",
    review_type: "comprehensive"  // basic | comprehensive | security | performance
  }
})
```

**Response:**
```json
{
  "overall_score": 75,
  "issues": [
    {
      "type": "security",
      "title": "SQL Injection Risk",
      "severity": "critical",
      "description": "User input concatenated into SQL query",
      "suggestion": "Use parameterized queries",
      "confidence": 95
    }
  ],
  "metrics": {
    "complexity_score": 65,
    "maintainability_index": 72,
    "security_score": 60
  },
  "summary": {
    "strengths": ["Good error handling"],
    "improvements": ["Add input validation"],
    "blocking_issues": ["Critical security vulnerability"]
  }
}
```

### 2. Bug Prediction (`bug_prediction`)

Proactive bug prediction and risk assessment using ML-enhanced analysis.

**Usage:**
```typescript
await mcp.call({
  name: "bug_prediction",
  arguments: {
    code_snippet: "function example() { ... }",
    codebase_id: "my-project",
    prediction_type: "ml-enhanced",  // proactive | reactive | pattern-based | ml-enhanced
    scope: "class",  // function | class | module | system
    analysis_depth: "standard"  // basic | standard | comprehensive
  }
})
```

**Response:**
```json
{
  "overall_risk_assessment": {
    "bug_risk_score": 70,
    "risk_category": "high",
    "predicted_bugs": 3
  },
  "identified_risks": [
    {
      "title": "Null Pointer Exception",
      "category": "null-pointer",
      "severity": "high",
      "likelihood": 75,
      "description": "Variable used without null check",
      "mitigation_strategy": "Add null validation before use"
    }
  ]
}
```

### 3. Context-Aware Code Generation (`context_aware_code_generation`)

Generate code that understands your project structure and follows your patterns.

**Usage:**
```typescript
await mcp.call({
  name: "context_aware_code_generation",
  arguments: {
    prompt: "Create a user authentication service",
    requirement: "JWT-based authentication with bcrypt",
    context: {
      language: "typescript",
      framework: "express",
      libraries: ["jsonwebtoken", "bcrypt"],
      style: "async/await",
      conventions: ["camelCase", "error-first callbacks"]
    },
    generation_type: "module",  // function | class | module | test | documentation
    codebase_id: "my-project"
  }
})
```

**Response:**
```json
{
  "generated_code": "import jwt from 'jsonwebtoken';\n\nexport class AuthService { ... }",
  "code_metadata": {
    "language": "typescript",
    "type": "module",
    "estimated_lines": 45,
    "complexity_score": 35
  },
  "context_analysis": {
    "style_compliance": 90,
    "naming_convention_compliance": 100,
    "framework_patterns_used": ["express-middleware", "async-controller"]
  }
}
```

### 4. Intelligent Refactoring (`intelligent_refactoring`)

AI-driven refactoring recommendations with code transformation suggestions.

**Usage:**
```typescript
await mcp.call({
  name: "intelligent_refactoring",
  arguments: {
    code_snippet: "function example() { ... }",
    codebase_id: "my-project",
    refactoring_type: "reduce-complexity",  // extract-method | rename-variable | reduce-complexity | optimize-performance
    target_scope: "class",  // function | class | module | entire-file
    preferences: {
      preserve_behavior: true,
      backward_compatible: true,
      test_driven: false
    }
  }
})
```

**Response:**
```json
{
  "overall_assessment": {
    "refactoring_potential": 75,
    "code_quality_score": 68,
    "maintainability_improvement": 20
  },
  "refactoring_suggestions": [
    {
      "title": "Extract Method for validateUser",
      "category": "extraction",
      "priority": "high",
      "effort": "quick",
      "description": "Extract validation logic into separate method",
      "refactored_code": "function validateUser(user) { ... }",
      "benefits": ["Improved readability", "Better testability"],
      "risks": ["Need to update all call sites"]
    }
  ]
}
```

### 5. Technical Debt Analysis (`technical_debt_analysis`)

Comprehensive technical debt assessment with business impact analysis.

**Usage:**
```typescript
await mcp.call({
  name: "technical_debt_analysis",
  arguments: {
    code_snippet: "class UserService { ... }",
    codebase_id: "my-project",
    scope: "class",  // function | class | module | system
    analysis_depth: "comprehensive",  // basic | comprehensive | deep
    include_recommendations: true
  }
})
```

**Response:**
```json
{
  "overall_debt_score": 45,
  "debt_category": "moderate",
  "remediation_estimate": {
    "time": "2-3 weeks",
    "effort_hours": 120
  },
  "debt_items": [
    {
      "title": "High Cyclomatic Complexity",
      "category": "code-quality",
      "severity": "high",
      "impact_score": 75,
      "remediation": {
        "strategy": "refactor",
        "estimated_effort": "days"
      }
    }
  ]
}
```

## Performance Considerations

### Response Times

| Tool | Free Model | Paid Model | Rule-Based Fallback |
|------|-----------|------------|-------------------|
| AI Code Review | 2-5s | 1-3s | <100ms |
| Bug Prediction | 2-5s | 1-3s | <100ms |
| Context-Aware Code Gen | 3-8s | 2-5s | <100ms |
| Intelligent Refactoring | 2-5s | 1-3s | <100ms |
| Technical Debt Analysis | 2-5s | 1-3s | <100ms |

### Cost Estimation

Using `anthropic/claude-3.5-haiku`:
- AI Code Review: ~$0.002 per review
- Bug Prediction: ~$0.001 per analysis
- Context-Aware Code Gen: ~$0.003 per generation
- Intelligent Refactoring: ~$0.002 per suggestion
- Technical Debt Analysis: ~$0.002 per analysis

## Best Practices

1. **Start with Xiaomi Mimo Free Tier**: Use `xiaomi/mimo-v2-flash:free` for production-quality analysis without cost
2. **Upgrade for Speed**: Switch to paid models like `anthropic/claude-3.5-haiku` for faster responses
3. **Enable Caching**: Set `AI_CACHE_ENABLED=true` to reduce API calls
4. **Monitor Costs**: Track usage with `AI_COST_LIMIT_PER_HOUR`
5. **Use Fallbacks**: Rule-based analysis ensures functionality even without AI

## Troubleshooting

### "OpenRouter request failed"

**Cause**: Invalid API key or network issue

**Solution**:
```bash
# Verify API key
echo $OPENROUTER_API_KEY

# Test connectivity
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

### "Failed to parse AI response"

**Cause**: Model returned invalid JSON

**Solution**: System will automatically fall back to rule-based analysis. Consider using a different model:
```bash
# Try Xiaomi Mimo (excellent free tier)
OPENROUTER_MODEL=xiaomi/mimo-v2-flash:free

# Or upgrade to paid model for better JSON handling
OPENROUTER_MODEL=anthropic/claude-3.5-haiku
```

### "AI provider not available"

**Cause**: Preferred provider not configured

**Solution**: Set `PREFERRED_AI_PROVIDER=openrouter` and verify API keys

## API Reference

See the [MCP Protocol Documentation](../specs/001-code-ntelligence-mcp/spec.md) for detailed API specifications.
