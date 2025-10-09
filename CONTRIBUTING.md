# Contributing to CodeSight MCP Server

Thank you for your interest in contributing to CodeSight MCP Server! This document provides guidelines and instructions for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation Guidelines](#documentation-guidelines)

## 🤝 Code of Conduct

This project adheres to a [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v20 LTS or higher
- **Rust**: 1.75 or higher (for FFI bridge development)
- **NAPI-RS CLI**: `npm install -g @napi-rs/cli`

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/codesight-mcp.git
cd codesight-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### Development Setup

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d
npm run dev

# Build Rust FFI bridge (optional)
cd rust-core
cargo build --release
cd ../typescript-mcp
```

## 🔄 Development Workflow

### 1. Fork the Repository

Fork the repository on GitHub and clone your fork locally.

```bash
git clone https://github.com/your-username/codesight-mcp.git
cd codesight-mcp
git remote add upstream https://github.com/your-org/codesight-mcp.git
```

### 2. Create a Feature Branch

Create a new branch for your feature or bug fix.

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-fix-name
```

### 3. Make Your Changes

- Follow the [Coding Standards](#coding-standards)
- Write tests for your changes
- Update documentation as needed
- Ensure all tests pass

### 4. Commit Your Changes

Write clear and descriptive commit messages.

```bash
git add .
git commit -m "feat: add new MCP tool for code analysis

- Implement code analysis functionality
- Add comprehensive tests
- Update documentation

Closes #123"
```

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## 📝 Pull Request Process

### PR Requirements

- **Title**: Clear and descriptive title following [Conventional Commits](https://www.conventionalcommits.org/)
- **Description**: Detailed description of changes
- **Tests**: All tests must pass
- **Documentation**: Update relevant documentation
- **Breaking Changes**: Clearly document any breaking changes

### PR Template

```markdown
## Changes
- [ ] Describe the changes made in this PR

## Testing
- [ ] Describe how you tested these changes
- [ ] All tests pass locally

## Documentation
- [ ] Relevant documentation updated
- [ ] README updated if needed

## Breaking Changes
- [ ] No breaking changes
- [ ] Breaking changes described:

## Checklist
- [ ] Code follows project standards
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] PR title follows conventional commits
```

### Review Process

1. **Automated Checks**: All CI checks must pass
2. **Code Review**: At least one maintainer review required
3. **Feedback**: Address review comments
4. **Approval**: Maintainer approval required for merge

## 💻 Coding Standards

### TypeScript Standards

- Use TypeScript 5.3+ features appropriately
- Follow strict TypeScript configuration
- Use proper type annotations
- Implement error handling with proper types

```typescript
// ✅ Good
interface SearchResult {
  id: string;
  name: string;
  relevance: number;
}

async function searchCode(query: string): Promise<SearchResult[]> {
  try {
    const results = await indexingService.search(query);
    return results;
  } catch (error) {
    logger.error('Search failed:', error);
    throw new Error(`Search failed: ${error.message}`);
  }
}

// ❌ Bad
async function searchCode(query) {
  return indexingService.search(query);
}
```

### Rust Standards (for FFI Bridge)

- Follow Rust 2021 edition
- Use `clippy` for linting
- Implement proper error handling
- Use `serde` for serialization

```rust
// ✅ Good
use napi_derive::napi;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
#[napi(object)]
pub struct CodeEntity {
    pub id: String,
    pub name: String,
    pub entity_type: String,
    pub file_path: String,
}

#[napi]
pub fn parse_code(file_path: String) -> Result<Vec<CodeEntity>> {
    // Implementation
}
```

### File Organization

```
typescript-mcp/
├── src/
│   ├── tools/         # MCP tool implementations
│   ├── services/      # Core services
│   ├── cli/          # CLI commands
│   ├── ffi/          # FFI bridge integration
│   └── types/        # TypeScript definitions
├── tests/
│   ├── unit/         # Unit tests
│   ├── integration/  # Integration tests
│   └── contract/     # MCP protocol tests
└── docs/            # Documentation
```

## 🧪 Testing Guidelines

### Test Structure

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test component interactions
- **Contract Tests**: Test MCP protocol compliance

### Writing Tests

```typescript
// ✅ Good test example
describe('SearchCodeTool', () => {
  let searchCodeTool: SearchCodeTool;

  beforeEach(() => {
    searchCodeTool = new SearchCodeTool();
  });

  describe('execute', () => {
    it('should return search results for valid query', async () => {
      const result = await searchCodeTool.execute({
        query: 'authentication function',
        limit: 10
      });

      expect(result).toHaveProperty('results');
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should handle empty query gracefully', async () => {
      const result = await searchCodeTool.execute({
        query: '',
        limit: 10
      });

      expect(result.results).toEqual([]);
    });
  });
});
```

### Test Coverage

- Maintain minimum 80% test coverage
- All critical paths must be covered
- Include both success and error cases
- Test edge cases and boundary conditions

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:contract

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## 📚 Documentation Guidelines

### Code Documentation

- Use JSDoc for TypeScript functions and classes
- Document public APIs thoroughly
- Include examples for complex functionality

```typescript
/**
 * Search for code entities using natural language queries
 * @param query - Natural language search query
 * @param limit - Maximum number of results to return
 * @returns Promise<SearchResult[]> Array of search results
 * @example
 * const results = await searchCode('authentication functions', 10);
 */
export async function searchCode(
  query: string,
  limit: number = 10
): Promise<SearchResult[]> {
  // Implementation
}
```

### README Updates

- Update README for new features or breaking changes
- Include installation and usage instructions
- Add performance benchmarks for significant changes

### API Documentation

- Document all MCP tools and their parameters
- Include request/response examples
- Document error cases and handling

## 🏆 Recognition

Contributors will be recognized in:

- [Contributors](./CONTRIBUTORS.md) file
- Release notes for significant contributions
- GitHub repository contributors section

## 🆘 Getting Help

- **Discord**: [Community Server](https://discord.gg/codesight)
- **GitHub Issues**: [Create an issue](https://github.com/your-org/codesight-mcp/issues)
- **Documentation**: [Project Documentation](https://docs.codesight-mcp.com)

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the [MIT License](./LICENSE).

---

Thank you for contributing to CodeSight MCP Server! 🎉
