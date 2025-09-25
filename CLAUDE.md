# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Version: v0.1.0**

## Project Overview

Code Intelligence MCP Server - A **hybrid TypeScript/Rust implementation** with real SQLite database integration and sophisticated NAPI-RS FFI bridge:
- **✅ TypeScript MCP Server** (`typescript-mcp/`): Full MCP protocol, 377+ entities indexed in SQLite
- **✅ React Frontend** (`src/`): Web UI with Vite and TypeScript
- **✅ Express API** (`api/`): REST API server
- **✅ Rust FFI Bridge** (`rust-core/`): Complete NAPI-RS implementation with Tree-sitter parsers
- **✅ Multi-Language Support**: 15+ programming languages with real-time parsing

## Current Working State

**✅ Fully Functional:**
- MCP Protocol with 9 tools (2 fully implemented, 7 with mock responses)
- Real SQLite indexing: 47 files → 377 entities in 1-2 seconds (with Rust FFI)
- CLI commands: `index`, `search`, `stats`
- Claude Desktop integration tested and verified
- Natural language search with database results
- Complete Rust FFI bridge with NAPI-RS integration
- Multi-language Tree-sitter parsers for 15+ languages
- Graceful fallback between Rust and TypeScript implementations
- Error handling across FFI boundaries

**🚧 Planned Enhancements:**
- Advanced semantic search with vector embeddings
- Further performance optimization through Rust integration
- Enterprise features (multi-tenant, analytics)

## Essential Commands

### CLI (Fully Working)
```bash
# Build and setup
cd typescript-mcp && npm install && npm run build

# Build Rust FFI bridge (optional, provides performance boost)
cd ../rust-core && cargo build --release && cd ../typescript-mcp

# Index codebase (JS/TS, with multi-language support)
node dist/cli/index.js index /path/to/project

# Search and stats
node dist/cli/index.js search "query"
node dist/cli/index.js stats

# Test FFI bridge integration
node dist/cli/index.js test-ffi
```

### Claude Desktop Integration
```json
{
  "mcpServers": {
    "code-intelligence": {
      "command": "node",
      "args": ["F:/path/to/typescript-mcp/dist/index.js"],
      "cwd": "F:/path/to/typescript-mcp"
    }
  }
}
```

### Development
```bash
npm install           # Root dependencies
npm run dev          # Start dev environment
npm run build        # Production build
npm test             # All tests

# Rust development
cd rust-core
cargo build         # Debug build
cargo build --release  # Release build
cargo test          # Run Rust tests
cargo bench         # Run performance benchmarks

# Hybrid build (TypeScript + Rust)
npm run build:hybrid # Build both TypeScript and Rust components
```

## MCP Tools Status

**✅ Real Implementation:**
- `search_code`: Natural language search with SQLite results
- `explain_function`: Function explanation with codebase lookup

**🔧 Mock Implementation (Working Protocol):**
- `find_references`, `trace_data_flow`, `analyze_security`
- `get_api_endpoints`, `check_complexity`, `find_duplicates`, `suggest_refactoring`

## Performance Metrics

**Current (Hybrid TypeScript + Rust):**
- 47 files → 1-2s indexing → 377 entities
- Search queries: 20-50ms (with Rust FFI)
- Memory: ~25MB during indexing
- Multi-language support: 15+ languages with Tree-sitter

**Performance Benchmarks:**
| Operation | TypeScript Only | Hybrid (TS+Rust) | Improvement |
|-----------|-----------------|-----------------|-------------|
| File Indexing | 2-3 seconds | 1-2 seconds | 2x faster |
| Search Query | 50-100ms | 20-50ms | 2.5x faster |
| Memory Usage | ~30MB | ~25MB | 17% reduction |
| Multi-Language | JS/TS only | 15+ languages | 7.5x coverage |

**Target (Production Scale):**
- Small projects (<1K): <2s indexing, <20ms queries
- Medium projects (1K-10K): <15s indexing, <50ms queries
- Large projects (10K-100K): <3min indexing, <100ms queries

## Project Structure

```
typescript-mcp/        # ✅ Working MCP server
├── src/tools/        # 9 MCP tools implemented
├── src/services/     # IndexingService with SQLite
├── src/cli/          # CLI commands
├── src/ffi/          # ✅ Rust FFI bridge integration
└── tests/contract/   # MCP protocol tests

rust-core/            # ✅ Performance layer with NAPI-RS
├── crates/ffi/       # ✅ NAPI-RS bindings
├── crates/core/      # Core services
├── crates/parser/    # Tree-sitter parsers
└── benches/          # Performance benchmarks

api/                  # ✅ Express REST server
src/                  # ✅ React frontend
```

## Environment Configuration

**Development:**
```bash
NODE_ENV=development
PORT=4000
DATABASE_URL=sqlite://./data/code_intelligence.db
RUST_FFI_PATH=../rust-core/target/release
ENABLE_RUST_FFI=true
```

**Production:**
```bash
NODE_ENV=production
DATABASE_URL=postgresql://postgres:password@postgres:5432/code_intelligence
REDIS_URL=redis://redis:6379
RUST_FFI_PATH=./rust-core/target/release
ENABLE_RUST_FFI=true
FFI_GRACEFUL_FALLBACK=true
```

## Critical Development Rules

### 1. **Git Commit Restriction**
NEVER perform git commits unless explicitly requested by user.

### 2. **File Creation**
Only create necessary files. Always prefer editing existing files.

### 3. **Version Management**
Follow semantic versioning: 0.1.x for patches, 0.x.0 for features, x.0.0 for breaking changes.

### 4. **Package Management**
Always use latest stable versions. Avoid beta/alpha releases.

### 5. **DRY Principle** (CRITICAL)
Never duplicate code. Extract common logic into reusable utilities/components.

### 6. **FFI Bridge Development** (NEW CRITICAL)
**Rust/TypeScript Integration Best Practices:**
- Always implement graceful fallback when calling Rust functions from TypeScript
- Use proper error handling across FFI boundaries (Result<T, Error> types)
- Minimize data serialization overhead between languages
- Batch operations when possible to reduce FFI call overhead
- Test both Rust-only and TypeScript-only paths independently
- Validate data structures at FFI boundaries using serde/zod
- Handle platform-specific compilation issues gracefully
- Use NAPI-RS for Node.js native modules (not direct FFI)

**Development Workflow:**
1. Develop Rust functionality with comprehensive tests
2. Expose functions via NAPI-RS with proper error handling
3. Implement TypeScript wrapper with fallback logic
4. Test both integrated and fallback scenarios
5. Profile performance and optimize critical paths


### 15. **Problem Çözme Yaklaşımı & DRY Prensibi**

Zero errors/warnings (Kural 15) ve kod tekrarını önleme

- **Temel Kural**: Hiçbir durumda kısayol bulma, kolaya kaçma, çevresinden dolaşma yapılmamalı
- **DRY (Don't Repeat Yourself)**:
  - Kod tekrarı tespit edildiğinde MUTLAKA refactor edilmeli
  - Ortak logic'ler shared utility/component/hook olarak çıkarılmalı
  - Copy-paste yerine reusable abstraction'lar oluşturulmalı
  - İlerde hata yapma riski yüksek pattern'ler Claude hooks'a eklenmeli
- **Dependency & CI Management**:
  - Major dependency updates yapılırken breaking change impact analysis
  - CI pipeline conflicts çözümünde root cause analysis yaklaşımı
  - Test dependencies (JwtService vb.) proper injection pattern'leri
  - Package version conflicts resolution strategy
- **Hook Çalışmasında**: PreToolUse hook'u hata verdiğinde hook'u atlama veya devre dışı bırakma yaklaşımları yasak
- **Teknik Problemlerde**: ESLint v9 hatası, build problemi, dependency çakışması gibi durumlarda geçici workaround'lar yasak
- **Doğru Yaklaşım**:
  - Problemin kök nedenini bul ve düzelt
  - Proper configuration ve implementation uygula
  - Best practices'e uygun çözümler geliştir
  - Sistem bütünlüğünü koru
  - Tekrarlayan hataları Claude hooks config'e ekle
- **Yasak Yaklaşımlar**:
  - "Şimdilik devre dışı bırak, sonra düzeltiriz"
  - "Basit bir workaround yapalım"
  - "Hook'u atlatalım, önemli değil"
  - "Hızlı bir düzeltme yapalım"
  - "Copy-paste yapalım, sonra düzeltiriz"
- **Özet**: Her problem için kapsamlı, doğru, kalıcı ve DRY-compliant çözüm üret

**Prohibited Approaches:**
- Temporary workarounds
- Copy-paste solutions
- Ignoring errors/warnings
- Quick fixes without proper analysis

**Required Approach:**
- Find root cause of problems
- Apply proper configuration
- Follow best practices
- Maintain system integrity