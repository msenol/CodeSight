# TypeScript MCP Server

The TypeScript implementation of the Code Intelligence MCP Server, providing Model Context Protocol support for AI assistants to understand and query codebases.

## Overview

This module implements the MCP protocol layer that enables AI assistants like Claude to interact with codebases through natural language queries. It acts as the interface between AI assistants and the high-performance Rust core engine.

## Architecture

```
AI Assistant <-> MCP Protocol <-> TypeScript Server <-> FFI Bridge <-> Rust Core
```

## Features

- **MCP Protocol Implementation**: Full compliance with Model Context Protocol specification
- **9 Specialized Tools**: Comprehensive code analysis capabilities
- **FFI Bridge**: High-performance communication with Rust core via Napi-rs
- **Multiple Transport Modes**: stdio, WebSocket, and REST API support
- **Contract Tests**: Extensive test coverage ensuring protocol compliance

## Available MCP Tools

1. **search_code** - Natural language code search across the codebase
2. **explain_function** - Explain what a specific function does
3. **find_references** - Find all references to a symbol
4. **trace_data_flow** - Trace data flow through the code
5. **analyze_security** - Analyze code for security vulnerabilities
6. **get_api_endpoints** - List all API endpoints in the codebase
7. **check_complexity** - Analyze code complexity metrics
8. **find_duplicates** - Detect duplicate code patterns
9. **suggest_refactoring** - Provide refactoring suggestions

## Installation

```bash
cd typescript-mcp
npm install
npm run build
```

## Development

### Build Commands

```bash
# Development build with watch mode
npm run dev

# Production build
npm run build

# Build with Rust FFI bindings
npm run build:full
```

### Testing

```bash
# Run all tests
npm test

# Run contract tests specifically
npm run test:contract

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## Usage

### As MCP Server (stdio mode)

```bash
# Start MCP server for AI assistant integration
node dist/index.js mcp
```

### As REST API

```bash
# Start REST API server on port 4000
node dist/index.js rest
```

### Hybrid Mode

```bash
# Run both MCP and REST API
node dist/index.js hybrid
```

## Configuration

Configuration is managed through environment variables and `src/config.ts`:

```typescript
// Default configuration
{
  server: {
    port: 4000,
    host: '0.0.0.0'
  },
  mcp: {
    transport: 'stdio' // or 'websocket'
  },
  rust: {
    ffiPath: './rust-core/target/release'
  }
}
```

## Contract Tests

All MCP tools have comprehensive contract tests ensuring protocol compliance:

- `test_search_code.ts` - Natural language search validation
- `test_explain_function.ts` - Function explanation validation
- `test_find_references.ts` - Reference finding validation
- `test_trace_data_flow.ts` - Data flow analysis validation
- `test_analyze_security.ts` - Security analysis validation
- `test_get_api_endpoints.ts` - API discovery validation
- `test_check_complexity.ts` - Complexity analysis validation

Run contract tests:

```bash
npm run test:contract
```

## Project Structure

```
typescript-mcp/
├── src/
│   ├── index.ts           # Main entry point
│   ├── server.ts          # Fastify server setup
│   ├── config.ts          # Configuration management
│   ├── tools/             # MCP tool implementations
│   │   ├── search-code.ts
│   │   ├── explain-function.ts
│   │   └── ...
│   ├── services/          # Core services
│   │   ├── logger.ts
│   │   ├── codebase-service.ts
│   │   └── llm-service.ts
│   ├── ffi/              # Rust FFI bridge
│   │   └── rust-bridge.ts
│   └── types/            # TypeScript type definitions
└── tests/
    └── contract/         # MCP contract tests
```

## FFI Bridge

The TypeScript server communicates with the Rust core through an FFI bridge using Napi-rs:

```typescript
// Example FFI call
import { searchCode } from './ffi/rust-bridge';

const results = await searchCode({
  query: "authentication logic",
  codebaseId: "project-id",
  limit: 10
});
```

## Performance

- **Startup Time**: <1 second
- **Request Processing**: <100ms overhead
- **Memory Usage**: ~50MB base
- **Concurrent Requests**: 100+ supported

## Dependencies

Key dependencies:
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `fastify` - High-performance web framework
- `zod` - Runtime type validation
- `@napi-rs/cli` - Rust FFI tooling

## Contributing

1. Ensure all tests pass: `npm test`
2. Run linting: `npm run lint`
3. Check types: `npm run type-check`
4. Format code: `npm run format`

## License

MIT - See LICENSE file for details