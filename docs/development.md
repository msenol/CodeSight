# Development Guide

## Overview

This guide covers development practices, workflows, and standards for contributing to the CodeSight MCP Server project. The project follows enterprise-grade development standards with emphasis on code quality, testing, and documentation.

## Development Environment Setup

### Prerequisites

- **Node.js**: v20 LTS or higher
- **Rust**: 1.75 or higher (for FFI bridge development)
- **Docker**: 20.10+ (for local development environment)
- **Git**: For version control

### Quick Setup

```bash
# Clone the repository
git clone https://github.com/your-org/codesight-mcp.git
cd codesight-mcp

# Install root dependencies
npm install

# Setup TypeScript MCP server
cd typescript-mcp
npm install
npm run build

# Setup Rust core (optional for FFI development)
cd ../rust-core
cargo build
cd ../typescript-mcp

# Start development environment
docker-compose -f docker-compose.dev.yml up -d
npm run dev
```

## Project Structure

```
codesight-mcp/
├── typescript-mcp/          # TypeScript MCP Server
│   ├── src/
│   │   ├── tools/          # MCP tool implementations
│   │   ├── services/       # Business logic services
│   │   ├── controllers/    # REST API controllers
│   │   ├── middleware/     # Express middleware
│   │   ├── cli/           # Command-line interface
│   │   ├── ffi/           # Rust FFI bridge integration
│   │   └── types/         # TypeScript type definitions
│   ├── tests/
│   │   ├── contract/      # MCP tool contract tests
│   │   ├── integration/   # Integration tests
│   │   ├── unit/          # Unit tests
│   │   └── performance/   # Performance tests
│   ├── dist/              # Compiled JavaScript output
│   └── package.json
├── rust-core/              # Rust performance layer
│   ├── crates/
│   │   ├── core/          # Core functionality
│   │   ├── ffi/           # NAPI-RS bindings
│   │   ├── parser/        # Tree-sitter parsers
│   │   └── indexer/       # Indexing algorithms
│   ├── benches/           # Performance benchmarks
│   └── Cargo.toml
├── src/                    # React frontend (optional)
├── api/                    # Express API server (optional)
├── docs/                   # Documentation
├── specs/                  # Technical specifications
└── docker-compose.yml      # Development environment
```

## Development Workflow

### 1. Feature Development

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Write Tests First (TDD)**
   ```bash
   # Create contract test for new MCP tool
   cd typescript-mcp
   # Create test in tests/contract/test_new_tool.ts
   npm run test:contract
   ```

3. **Implement Feature**
   ```bash
   # Implement tool in src/tools/new-tool.ts
   npm run build
   npm run test
   ```

4. **Run Full Test Suite**
   ```bash
   npm run test:all
   npm run test:integration
   npm run test:performance
   ```

### 2. MCP Tool Development

#### Contract Test First
Always write comprehensive contract tests before implementation:

```typescript
// tests/contract/test_new_tool.ts
describe('new_tool MCP Tool - Contract Test', () => {
  it('should validate input schema correctly', async () => {
    const tool = mockServer.getTool('new_tool');
    expect(tool.inputSchema.required).toContain('required_param');
  });

  it('should handle basic functionality', async () => {
    const result = await tool.call({
      required_param: 'test_value',
      optional_param: 'optional_value'
    });
    expect(result.success).toBe(true);
  });
});
```

#### Tool Implementation
```typescript
// src/tools/new-tool.ts
import { z } from 'zod';

const inputSchema = z.object({
  required_param: z.string(),
  optional_param: z.string().optional()
});

export async function handleNewTool(input: z.infer<typeof inputSchema>) {
  // Implementation logic
  return {
    success: true,
    result: processedData
  };
}
```

### 3. Rust FFI Development

#### Adding New Rust Functions
```rust
// rust-core/src/lib.rs
#[napi]
pub fn rust_function(input: String) -> Result<String, String> {
    // Rust implementation
    Ok(format!("Processed: {}", input))
}
```

#### TypeScript Integration
```typescript
// typescript-mcp/src/ffi/rust-bridge.ts
let rustModule: any;

try {
  rustModule = require('../native/index.node');
} catch (error) {
  console.warn('Rust FFI not available, using fallback');
  // Fallback implementation
}

export function callRustFunction(input: string): string {
  if (rustModule) {
    return rustModule.rustFunction(input);
  }
  // TypeScript fallback
  return `Fallback processed: ${input}`;
}
```

## Code Standards

### TypeScript Standards

#### 1. Type Safety
- **No `any` types**: Use proper TypeScript interfaces
- **Strict mode**: All files must pass strict type checking
- **Explicit returns**: All functions must have explicit return types
- **Zod validation**: Use Zod for runtime type validation

```typescript
// Good
interface UserData {
  id: string;
  name: string;
  email: string;
}

async function getUser(id: string): Promise<UserData | null> {
  // Implementation
}

// Bad
async function getUser(id: any): any {
  // Implementation
}
```

#### 2. Error Handling
- **Comprehensive error handling**: All async operations must handle errors
- **Typed errors**: Use custom error classes with proper types
- **Graceful degradation**: Fallback implementations for FFI calls

```typescript
class CodeSightError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CodeSightError';
  }
}

async function safeOperation<T>(
  operation: () => Promise<T>,
  fallback: () => T
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.warn('Operation failed, using fallback:', error);
    return fallback();
  }
}
```

#### 3. Code Organization
- **Single responsibility**: Each function/class has one clear purpose
- **Dependency injection**: Use dependency injection for testability
- **Module structure**: Clear module boundaries and interfaces

```typescript
// services/user-service.ts
export class UserService {
  constructor(
    private database: Database,
    private logger: Logger
  ) {}

  async getUser(id: string): Promise<User | null> {
    try {
      return await this.database.users.findById(id);
    } catch (error) {
      this.logger.error('Failed to get user', { id, error });
      throw new CodeSightError('Database error', 'DATABASE_ERROR', error);
    }
  }
}
```

### Rust Standards

#### 1. Error Handling
```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CodeSightError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    
    #[error("Parsing error: {0}")]
    Parsing(String),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub type Result<T> = std::result::Result<T, CodeSightError>;
```

#### 2. Performance Optimization
```rust
use rayon::prelude::*;

pub fn process_files_parallel(files: Vec<PathBuf>) -> Result<Vec<ProcessedFile>> {
    files
        .par_iter()
        .map(|file| process_file(file))
        .collect::<Result<Vec<_>>>()
}
```

## Testing Strategy

### 1. Test Categories

#### Unit Tests
- Test individual functions and classes
- Mock external dependencies
- Fast execution (< 100ms per test)

```typescript
// tests/unit/user-service.test.ts
describe('UserService', () => {
  it('should return user when found', async () => {
    const mockDatabase = createMockDatabase();
    const service = new UserService(mockDatabase, mockLogger);
    
    mockDatabase.users.findById.mockResolvedValue(mockUser);
    
    const result = await service.getUser('user-123');
    
    expect(result).toEqual(mockUser);
  });
});
```

#### Integration Tests
- Test component interactions
- Use real database (testcontainers)
- Test API endpoints

```typescript
// tests/integration/api.test.ts
describe('User API', () => {
  let app: FastifyInstance;
  let container: StartedTestContainer;

  beforeAll(async () => {
    container = await new PostgreSQLTestContainer().start();
    app = await createTestApp(container.getConnectionUri());
  });

  it('should create user via API', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { name: 'Test User', email: 'test@example.com' }
    });

    expect(response.statusCode).toBe(201);
  });
});
```

#### Contract Tests
- Test MCP tool specifications
- Validate input/output schemas
- Test error scenarios

```typescript
// tests/contract/test_search_code.ts
describe('search_code MCP Tool - Contract Test', () => {
  it('should validate input schema correctly', async () => {
    const schema = tool.inputSchema;
    expect(schema.required).toContain('query');
    expect(schema.properties.query.type).toBe('string');
  });
});
```

#### Performance Tests
- Benchmark critical operations
- Validate performance requirements
- Load testing

```typescript
// tests/performance/search.test.ts
describe('Search Performance', () => {
  it('should complete search within 50ms', async () => {
    const startTime = performance.now();
    
    await searchCode({ query: 'test query' });
    
    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(50);
  });
});
```

### 2. Test Commands

```bash
# Run all tests
npm run test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:contract
npm run test:performance

# Run tests with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## Build and Deployment

### Development Build
```bash
# TypeScript build
cd typescript-mcp
npm run build

# Rust build (debug)
cd ../rust-core
cargo build

# Hybrid build
cd ../typescript-mcp
npm run build:hybrid
```

### Production Build
```bash
# TypeScript build
cd typescript-mcp
npm run build:prod

# Rust build (release)
cd ../rust-core
cargo build --release

# Create distribution
cd ../typescript-mcp
npm run dist
```

### Docker Development
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose logs -f typescript-mcp

# Stop environment
docker-compose -f docker-compose.dev.yml down
```

## Performance Optimization

### 1. TypeScript Optimization
- **Lazy loading**: Load modules on demand
- **Caching**: Cache expensive operations
- **Batching**: Batch database operations

```typescript
class SearchService {
  private cache = new LRUCache<string, SearchResult>(1000);

  async search(query: string): Promise<SearchResult> {
    const cacheKey = `search:${query}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const result = await this.performSearch(query);
    this.cache.set(cacheKey, result);
    return result;
  }
}
```

### 2. Rust Optimization
- **Parallel processing**: Use Rayon for CPU-bound tasks
- **Memory efficiency**: Use efficient data structures
- **Zero-copy**: Minimize memory allocations

```rust
use rayon::prelude::*;

pub fn index_files(files: &[PathBuf]) -> Result<Vec<IndexedFile>> {
    files
        .par_iter()
        .map(|file| {
            let content = std::fs::read_to_string(file)?;
            let parsed = parse_content(&content)?;
            Ok(IndexedFile::new(file, parsed))
        })
        .collect()
}
```

## Code Review Process

### 1. Pre-commit Checklist
- [ ] All tests pass
- [ ] No TypeScript compilation errors
- [ ] Code follows style guidelines
- [ ] Documentation is updated
- [ ] Performance impact is considered

### 2. Pull Request Requirements
- **Clear description**: Explain what and why
- **Test coverage**: New features have tests
- **Documentation**: Updated where necessary
- **Breaking changes**: Clearly documented

### 3. Review Guidelines
- **Functionality**: Does it work as intended?
- **Code quality**: Is it maintainable and readable?
- **Performance**: Are there performance implications?
- **Security**: Are there security concerns?

## Debugging

### 1. TypeScript Debugging
```bash
# Debug with Node.js
node --inspect-brk dist/index.js

# Use VS Code debugger
# Add launch configuration to .vscode/launch.json
```

### 2. Rust Debugging
```bash
# Debug with GDB
cargo build
gdb target/debug/codesight-core

# Use Rust IDE support
cargo check
cargo clippy
```

### 3. Integration Debugging
```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Test MCP tools directly
node dist/cli/index.js test-ffi
node dist/cli/index.js search "test query"
```

## Common Issues and Solutions

### 1. FFI Bridge Issues
```bash
# Symptoms: Rust functions not found
# Solution: Rebuild native module
cd typescript-mcp
npm run build:native

# Symptoms: Platform-specific errors
# Solution: Check NAPI-RS configuration
napi build --platform
```

### 2. Database Issues
```bash
# Symptoms: SQLite database locked
# Solution: Check for open connections
lsof data/codesight.db

# Symptoms: Migration errors
# Solution: Recreate database
rm data/codesight.db
npm run dev
```

### 3. Performance Issues
```bash
# Symptoms: Slow indexing
# Solution: Check Rust compilation
cd rust-core
cargo build --release

# Symptoms: Memory leaks
# Solution: Profile with Node.js
node --inspect dist/cli/index.js
# Use Chrome DevTools Memory tab
```

## Contributing Guidelines

### 1. Before Contributing
- Read this development guide
- Set up development environment
- Run existing tests to ensure everything works

### 2. Making Changes
- Create feature branch from main
- Write tests before implementation (TDD)
- Follow code standards and patterns
- Update documentation as needed

### 3. Submitting Changes
- Create pull request with clear description
- Ensure all tests pass
- Address code review feedback
- Squash commits for clean history

## Getting Help

### Documentation
- [API Reference](./api-reference.md)
- [MCP Tools Documentation](./mcp-tools.md)
- [Architecture Overview](../specs/codesight-mcp/)

### Community
- GitHub Issues: Report bugs and request features
- Discord: Real-time discussion and support
- Documentation: Detailed guides and examples

### Development Support
- Review existing code patterns
- Check test files for usage examples
- Use debug logging to troubleshoot issues
- Reach out to maintainers for guidance

---

This development guide is a living document. Please suggest improvements and updates as the project evolves.