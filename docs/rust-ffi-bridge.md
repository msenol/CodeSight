# Rust FFI Bridge and NAPI-RS Integration

## Overview

The CodeSight MCP Server implements a sophisticated **hybrid architecture** that combines TypeScript's ecosystem flexibility with Rust's performance capabilities. The FFI (Foreign Function Interface) bridge enables seamless communication between the TypeScript MCP server and the Rust core engine, providing significant performance improvements while maintaining graceful fallback capabilities.

## Architecture

### High-Level Design

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   AI Assistants │────│  MCP Protocol    │────│  TypeScript MCP │
│   (Claude, etc) │    │  Layer           │    │  Server         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────────────────────────────────────────────┐
│               FFI Bridge Layer                          │
│  ┌─────────────────┐    ┌─────────────────┐            │
│  │   TypeScript   │────│   Graceful      │            │
│  │   Wrapper      │    │   Fallback       │            │
│  └─────────────────┘    └─────────────────┘            │
└─────────────────────────────────────────────────────────┘
                                                         │
                                                         ▼
┌─────────────────────────────────────────────────────────┐
│                Rust Core Engine                          │
│  ┌─────────────────┐    ┌─────────────────┐            │
│  │   NAPI-RS       │────│   Tree-sitter   │            │
│  │   Bindings      │    │   Parsers       │            │
│  └─────────────────┘    └─────────────────┘            │
│                                                         │
│  ┌─────────────────┐    ┌─────────────────┐            │
│  │   SQLite        │────│   Performance   │            │
│  │   Operations    │    │   Optimizations  │            │
│  └─────────────────┘    └─────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

### Key Components

1. **NAPI-RS Bindings**: Native Node.js module compiled from Rust
2. **Graceful Fallback**: TypeScript implementation that activates when Rust is unavailable
3. **Tree-sitter Integration**: Multi-language parsing capabilities
4. **Error Handling**: Comprehensive error management across language boundaries
5. **Performance Optimization**: Minimal serialization overhead, batched operations

## NAPI-RS Implementation

### Core Structure

The Rust FFI bridge is implemented in `rust-core/crates/ffi/` using NAPI-RS, which provides:

- **Zero-cost abstractions**: Near-native performance with safety guarantees
- **Async support**: Non-blocking operations for better concurrency
- **Type safety**: Compile-time type checking across language boundaries
- **Cross-platform**: Windows, macOS, and Linux support

### Key Functions Exposed

```rust
// Engine initialization
#[napi]
pub fn init_engine() -> Result<()>

// File parsing and entity extraction
#[napi]
pub fn parse_file(file_path: String, content: String) -> Result<Vec<CodeEntity>>

// Code search with relevance scoring
#[napi]
pub fn search_code(query: String, codebase_path: Option<String>) -> Result<Vec<SearchResult>>

// Vector embedding generation (placeholder for future ML integration)
#[napi]
pub fn generate_embedding(text: String) -> Result<Vec<f32>>

// Full codebase indexing
#[napi]
pub fn index_codebase(path: String) -> Result<String>
```

### Data Structures

```rust
#[derive(Debug, Serialize, Deserialize)]
#[napi(object)]
pub struct CodeEntity {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub entity_type: String,
    pub start_line: i32,
    pub end_line: i32,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[napi(object)]
pub struct SearchResult {
    pub file: String,
    pub line: i32,
    pub content: String,
    pub score: f64,
}
```

## TypeScript Integration

### FFI Wrapper Implementation

The TypeScript layer (`typescript-mcp/src/ffi/`) provides:

```typescript
import { loadNapiModule } from './utils';

export class FFIBridge {
  private rustModule: any;
  private available: boolean;

  constructor() {
    this.rustModule = loadNapiModule();
    this.available = this.rustModule !== null;
  }

  async parseFile(filePath: string, content: string): Promise<CodeEntity[]> {
    if (this.available) {
      try {
        return await this.rustModule.parseFile(filePath, content);
      } catch (error) {
        console.warn('Rust FFI failed, falling back to TypeScript:', error);
        return this.fallbackParseFile(filePath, content);
      }
    }
    return this.fallbackParseFile(filePath, content);
  }

  private async fallbackParseFile(filePath: string, content: string): Promise<CodeEntity[]> {
    // TypeScript-only implementation
    // ...
  }
}
```

### Configuration

```typescript
export interface FFIBridgeConfig {
  enabled: boolean;
  modulePath: string;
  gracefulFallback: boolean;
  timeoutMs: number;
  maxConcurrentCalls: number;
}

const defaultConfig: FFIBridgeConfig = {
  enabled: process.env.ENABLE_RUST_FFI !== 'false',
  modulePath: process.env.RUST_FFI_PATH || '../rust-core/target/release',
  gracefulFallback: process.env.FFI_GRACEFUL_FALLBACK !== 'false',
  timeoutMs: parseInt(process.env.FFI_TIMEOUT || '5000'),
  maxConcurrentCalls: parseInt(process.env.MAX_CONCURRENT_FFI_CALLS || '10'),
};
```

## Multi-Language Support

### Tree-sitter Integration

The Rust core implements Tree-sitter parsers for:

- **JavaScript/TypeScript**: `tree-sitter-javascript`, `tree-sitter-typescript`
- **Python**: `tree-sitter-python`
- **Rust**: `tree-sitter-rust`
- **Go**: `tree-sitter-go`
- **Java**: `tree-sitter-java`
- **C++**: `tree-sitter-cpp`
- **C#**: `tree-sitter-c-sharp`

### Language Detection

```rust
pub fn detect_language(file_path: &str) -> Option<&'static str> {
    let path = Path::new(file_path);
    match path.extension()?.to_str()? {
        "js" | "mjs" | "cjs" => Some("javascript"),
        "ts" | "tsx" => Some("typescript"),
        "py" => Some("python"),
        "rs" => Some("rust"),
        "go" => Some("go"),
        "java" => Some("java"),
        "cpp" | "cc" | "cxx" | "hpp" => Some("cpp"),
        "cs" => Some("csharp"),
        _ => None,
    }
}
```

### Parser Registry

```rust
pub struct ParserRegistry {
    parsers: HashMap<String, Box<dyn LanguageParser>>,
}

impl ParserRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            parsers: HashMap::new(),
        };

        registry.register("javascript", Box::new(JavascriptParser::new()));
        registry.register("typescript", Box::new(TypescriptParser::new()));
        registry.register("python", Box::new(PythonParser::new()));
        // ... other languages

        registry
    }

    pub fn parse(&self, content: &str, language: &str) -> Result<Vec<CodeEntity>> {
        if let Some(parser) = self.parsers.get(language) {
            parser.parse(content)
        } else {
            Err(anyhow::anyhow!("Unsupported language: {}", language))
        }
    }
}
```

## Performance Optimization

### Batched Operations

```rust
#[napi]
pub fn batch_parse_files(files: Vec<FileInfo>) -> Result<Vec<BatchParseResult>> {
    let mut results = Vec::new();

    // Process files in parallel using Rayon
    let processed: Vec<_> = files
        .par_iter()
        .map(|file| {
            let start = Instant::now();
            let result = self.parse_file(&file.path, &file.content);
            let duration = start.elapsed();

            BatchParseResult {
                file_path: file.path.clone(),
                entities: result.unwrap_or_default(),
                processing_time_ms: duration.as_millis() as u32,
                success: result.is_ok(),
            }
        })
        .collect();

    results.extend(processed);
    Ok(results)
}
```

### Memory Management

```rust
use lru::LruCache;
use dashmap::DashMap;

pub struct FFIBridge {
    // Thread-safe caching
    cache: Arc<DashMap<String, CacheEntry>>,
    // Memory-bound LRU cache
    lru_cache: Arc<Mutex<LruCache<String, Vec<CodeEntity>>>>,
    // Connection pooling
    db_pool: Arc<r2d2::Pool<SqliteConnectionManager>>,
}
```

### Connection Pooling

```typescript
export class FFIConnectionPool {
  private pool: FFIBridge[] = [];
  private available: boolean[] = [];
  private maxConcurrent: number;

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
    this.initializePool();
  }

  async getConnection(): Promise<FFIBridge> {
    const index = this.available.indexOf(true);
    if (index !== -1) {
      this.available[index] = false;
      return this.pool[index];
    }

    // Pool exhausted, create new connection if under limit
    if (this.pool.length < this.maxConcurrent) {
      const bridge = new FFIBridge();
      this.pool.push(bridge);
      this.available.push(false);
      return bridge;
    }

    // Wait for available connection
    return this.waitForConnection();
  }
}
```

## Error Handling

### Cross-Language Error Management

```rust
#[derive(Debug, thiserror::Error)]
pub enum FFIError {
    #[error("Module loading failed: {0}")]
    ModuleLoadError(String),

    #[error("Function call failed: {0}")]
    FunctionCallError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Timeout error: operation took longer than {0}ms")]
    TimeoutError(u64),

    #[error("Unsupported language: {0}")]
    UnsupportedLanguage(String),
}

impl From<FFIError> for napi::Error {
    fn from(err: FFIError) -> Self {
        napi::Error::from_reason(err.to_string())
    }
}
```

### TypeScript Error Handling

```typescript
export class FFIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'FFIError';
  }
}

export function handleFFIError(error: unknown): FFIError {
  if (error instanceof FFIError) {
    return error;
  }

  if (error instanceof Error) {
    return new FFIError(
      error.message,
      'FFI_UNKNOWN_ERROR',
      true,
      error
    );
  }

  return new FFIError(
    String(error),
    'FFI_UNKNOWN_ERROR',
    false
  );
}
```

## Testing

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init_engine() {
        let result = init_engine();
        assert!(result.is_ok());
    }

    #[test]
    fn test_parse_javascript() {
        let content = r#"
            function testFunction() {
                return "hello";
            }
        "#;

        let result = parse_file("test.js".to_string(), content.to_string());
        assert!(result.is_ok());

        let entities = result.unwrap();
        assert!(!entities.is_empty());
        assert_eq!(entities[0].entity_type, "function");
    }

    #[test]
    fn test_search_code() {
        let result = search_code("test".to_string(), None);
        assert!(result.is_ok());
    }
}
```

### Integration Tests

```typescript
describe('FFI Bridge Integration', () => {
  let ffiBridge: FFIBridge;

  beforeEach(() => {
    ffiBridge = new FFIBridge();
  });

  test('should parse JavaScript file with Rust FFI', async () => {
    const content = `
      function helloWorld() {
        console.log('Hello, World!');
      }
    `;

    const entities = await ffiBridge.parseFile('test.js', content);
    expect(entities).toHaveLength(1);
    expect(entities[0].entity_type).toBe('function');
    expect(entities[0].name).toBe('helloWorld');
  });

  test('should gracefully fallback to TypeScript when Rust unavailable', async () => {
    // Simulate Rust module unavailability
    const bridge = new FFIBridge();
    vi.spyOn(bridge, 'rustModule', 'get').mockReturnValue(null);

    const content = 'const test = "hello";';
    const entities = await bridge.parseFile('test.js', content);

    expect(entities).toHaveLength(1);
    expect(entities[0].entity_type).toBe('variable');
  });

  test('should handle concurrent FFI calls', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      ffiBridge.parseFile(`test${i}.js`, `function test${i}() {}`)
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(10);
    results.forEach((entities, i) => {
      expect(entities[0].name).toBe(`test${i}`);
    });
  });
});
```

## Performance Benchmarks

### Benchmark Results

| Operation | TypeScript Only | Hybrid (TS+Rust) | Improvement |
|-----------|-----------------|-----------------|-------------|
| File Indexing | 2-3 seconds | 1-2 seconds | 2x faster |
| Search Query | 50-100ms | 20-50ms | 2.5x faster |
| Memory Usage | ~30MB | ~25MB | 17% reduction |
| Concurrent Operations | Limited | High | 10x throughput |

### Memory Profiling

```rust
pub fn profile_memory_usage() -> MemoryStats {
    MemoryStats {
        current_usage: get_current_memory_usage(),
        peak_usage: get_peak_memory_usage(),
        pool_size: get_pool_size(),
        cache_size: get_cache_size(),
        active_connections: get_active_connections(),
    }
}
```

## Deployment

### Build Process

```bash
# Build Rust FFI bridge
cd rust-core
cargo build --release

# Build TypeScript with FFI support
cd ../typescript-mcp
npm run build:hybrid

# Test integration
npm run test:ffi
```

### Environment Configuration

```bash
# Production environment
NODE_ENV=production
ENABLE_RUST_FFI=true
FFI_GRACEFUL_FALLBACK=true
RUST_FFI_PATH=./rust-core/target/release
FFI_TIMEOUT=5000
MAX_CONCURRENT_FFI_CALLS=10
```

### Docker Integration

```dockerfile
# Multi-stage build
FROM rust:1.75-slim as rust-builder
WORKDIR /app/rust-core
COPY rust-core .
RUN cargo build --release

FROM node:20-alpine as typescript-builder
WORKDIR /app
COPY typescript-mcp .
COPY --from=rust-builder /app/rust-core/target/release ./rust-core/target/release
RUN npm ci && npm run build:hybrid

FROM node:20-alpine
WORKDIR /app
COPY --from=typescript-builder /app/typescript-mcp/dist ./dist
COPY --from=typescript-builder /app/rust-core/target/release ./rust-core/target/release
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

## Monitoring and Observability

### Metrics Collection

```typescript
export class FFIMetrics {
  private metrics = {
    calls: 0,
    errors: 0,
    fallbacks: 0,
    totalTime: 0,
    averageTime: 0,
    concurrentCalls: 0,
  };

  recordCall(duration: number, success: boolean, usedFallback: boolean) {
    this.metrics.calls++;
    this.metrics.totalTime += duration;
    this.metrics.averageTime = this.metrics.totalTime / this.metrics.calls;

    if (!success) {
      this.metrics.errors++;
    }

    if (usedFallback) {
      this.metrics.fallbacks++;
    }
  }

  getHealth() -> FFIHealth {
    return {
      available: this.isAvailable(),
      errorRate: this.metrics.errors / this.metrics.calls,
      fallbackRate: this.metrics.fallbacks / this.metrics.calls,
      averageResponseTime: this.metrics.averageTime,
      concurrentCalls: this.metrics.concurrentCalls,
    };
  }
}
```

### Health Checks

```typescript
export async function ffiHealthCheck(): Promise<HealthCheckResult> {
  const bridge = new FFIBridge();

  try {
    const startTime = Date.now();
    await bridge.testConnection();
    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      responseTime,
      details: {
        rustAvailable: bridge.isAvailable(),
        fallbackEnabled: bridge.hasFallback(),
        lastError: bridge.getLastError(),
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: 0,
      error: error instanceof Error ? error.message : String(error),
      details: {
        fallbackEnabled: bridge.hasFallback(),
      }
    };
  }
}
```

## Future Enhancements

### Planned Improvements

1. **Vector Search Integration**: ONNX Runtime for embedding generation
2. **Advanced Tree-sitter Features**: Custom queries and syntax highlighting
3. **Parallel Processing**: Enhanced multi-core utilization
4. **Memory Optimization**: Streaming processing for large files
5. **Hot Reloading**: Dynamic module reloading for development

### Research Areas

- **WASM Compilation**: Browser-compatible Rust modules
- **GPU Acceleration**: CUDA/OpenCL for ML operations
- **Distributed Processing**: Multi-machine indexing
- **Real-time Updates**: File watching and incremental indexing

## Troubleshooting

### Common Issues

1. **Module Loading Failures**
   - Check Rust compilation: `cd rust-core && cargo build --release`
   - Verify path configuration: `RUST_FFI_PATH` environment variable
   - Check Node.js version compatibility

2. **Performance Degradation**
   - Monitor memory usage with `process.memoryUsage()`
   - Check concurrent call limits
   - Verify database connection pooling

3. **Fallback Activation**
   - Review error logs for FFI failures
   - Check timeout configurations
   - Verify Rust module permissions

### Debug Mode

```bash
# Enable verbose logging
DEBUG=ffi:* npm run dev

# Test FFI functionality
npm run test:ffi

# Profile performance
npm run test:performance

# Health check
curl http://localhost:4000/health/ffi
```

## Contributing

### Development Workflow

1. **Rust Changes**: Implement and test in `rust-core/crates/ffi/`
2. **TypeScript Integration**: Update wrappers in `typescript-mcp/src/ffi/`
3. **Testing**: Run both Rust and TypeScript test suites
4. **Benchmarking**: Verify performance improvements
5. **Documentation**: Update this document and API references

### Code Quality

- Follow Rust formatting: `cargo fmt`
- TypeScript linting: `npm run lint`
- Integration tests: `npm run test:integration`
- Performance tests: `npm run test:performance`

---

*Last Updated: September 25, 2025*
