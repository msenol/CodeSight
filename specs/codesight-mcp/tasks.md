# Tasks: CodeSight MCP Server

**Input**: Design documents from `/specs/codesight-mcp/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)

```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- **Rust core**: `rust-core/` for Rust components
- **TypeScript MCP**: `typescript-mcp/` for Node.js components
- Paths shown below follow hybrid architecture structure

## Phase 3.1: Setup

- [ ] T001 Create project structure with Rust core and TypeScript MCP directories
- [ ] T002 Initialize Rust workspace in rust-core/ with Cargo.toml
- [ ] T003 Initialize TypeScript project in typescript-mcp/ with package.json
- [ ] T004 [P] Configure Rust linting (clippy) and formatting (rustfmt)
- [ ] T005 [P] Configure TypeScript linting (ESLint) and formatting (Prettier)
- [ ] T006 [P] Set up Napi-rs for Rust-Node.js FFI bindings
- [ ] T007 Create Docker multi-stage build configuration
- [ ] T008 [P] Configure GitHub Actions CI/CD pipeline

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

### MCP Tool Contract Tests (9 tools)

- [x] T009 [P] Contract test for search_code tool in tests/contract/test_search_code.ts ✅ COMPLETED
- [x] T010 [P] Contract test for explain_function tool in tests/contract/test_explain_function.ts ✅ COMPLETED
- [x] T011 [P] Contract test for find_references tool in tests/contract/test_find_references.ts ✅ COMPLETED
- [x] T012 [P] Contract test for trace_data_flow tool in tests/contract/test_trace_data_flow.ts ✅ COMPLETED
- [x] T013 [P] Contract test for analyze_security tool in tests/contract/test_analyze_security.ts ✅ COMPLETED
- [x] T014 [P] Contract test for get_api_endpoints tool in tests/contract/test_get_api_endpoints.ts ✅ COMPLETED
- [x] T015 [P] Contract test for check_complexity tool in tests/contract/test_check_complexity.ts ✅ COMPLETED
- [x] T016 [P] Contract test for find_duplicates tool in tests/contract/test_find_duplicates.ts ✅ COMPLETED
- [x] T017 [P] Contract test for suggest_refactoring tool in tests/contract/test_suggest_refactoring.ts ✅ COMPLETED

### REST API Contract Tests (11 endpoints)

- [ ] T018 [P] Contract test GET /codebases in tests/contract/test_codebases_get.ts
- [ ] T019 [P] Contract test POST /codebases in tests/contract/test_codebases_post.ts
- [ ] T020 [P] Contract test GET /codebases/{id} in tests/contract/test_codebases_id_get.ts
- [ ] T021 [P] Contract test DELETE /codebases/{id} in tests/contract/test_codebases_id_delete.ts
- [ ] T022 [P] Contract test POST /codebases/{id}/index in tests/contract/test_codebases_index.ts
- [ ] T023 [P] Contract test GET /codebases/{id}/stats in tests/contract/test_codebases_stats.ts
- [ ] T024 [P] Contract test POST /queries in tests/contract/test_queries_post.ts
- [ ] T025 [P] Contract test GET /jobs in tests/contract/test_jobs_get.ts
- [ ] T026 [P] Contract test GET /jobs/{id} in tests/contract/test_jobs_id_get.ts
- [ ] T027 [P] Contract test GET /health in tests/contract/test_health.ts
- [ ] T028 [P] Contract test GET /metrics in tests/contract/test_metrics.ts

### Integration Tests (5 scenarios from quickstart)

- [ ] T029 [P] Integration test VS Code extension scenario in tests/integration/test_vscode_integration.ts
- [ ] T030 [P] Integration test Claude Desktop MCP scenario in tests/integration/test_claude_desktop.ts
- [ ] T031 [P] Integration test CI/CD pipeline scenario in tests/integration/test_cicd_integration.ts
- [ ] T032 [P] Integration test local LLM Ollama scenario in tests/integration/test_local_llm.ts
- [ ] T033 [P] Integration test large monorepo scenario in tests/integration/test_monorepo_scale.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Rust Core - Data Models (12 entities)

- [x] T034 [P] Codebase model in rust-core/src/models/codebase.rs ✅ IMPLEMENTED
- [x] T035 [P] CodeEntity model in rust-core/src/models/code_entity.rs ✅ IMPLEMENTED
- [x] T036 [P] CodeRelationship model in rust-core/src/models/code_relationship.rs ✅ IMPLEMENTED
- [x] T037 [P] Index model in rust-core/src/models/index.rs ✅ IMPLEMENTED
- [x] T038 [P] Query model in rust-core/src/models/query.rs ✅ IMPLEMENTED
- [x] T039 [P] Embedding model in rust-core/src/models/embedding.rs ✅ IMPLEMENTED
- [x] T040 [P] CacheEntry model in rust-core/src/models/cache_entry.rs ✅ IMPLEMENTED
- [x] T041 [P] Plugin model in rust-core/src/models/plugin.rs ✅ IMPLEMENTED
- [x] T042 [P] Configuration model in rust-core/src/models/configuration.rs ✅ IMPLEMENTED
- [x] T043 [P] IndexJob model in rust-core/src/models/index_job.rs ✅ IMPLEMENTED
- [x] T044 [P] CodeMetric model in rust-core/src/models/code_metric.rs ✅ IMPLEMENTED
- [x] T045 [P] APIEndpoint model in rust-core/src/models/api_endpoint.rs ✅ IMPLEMENTED

### Rust Core - Services

- [x] T046 Parser service with tree-sitter in rust-core/src/services/parser.rs ✅ IMPLEMENTED
- [x] T047 Indexer service with tantivy in rust-core/src/services/indexer.rs ✅ IMPLEMENTED
- [x] T048 Search service with hybrid ranking in rust-core/src/services/search.rs ✅ IMPLEMENTED
- [x] T049 Embedding service with ONNX in rust-core/src/services/embedding.rs ✅ IMPLEMENTED
- [x] T050 Cache service with LRU/Redis in rust-core/src/services/cache.rs ✅ IMPLEMENTED
- [x] T051 Storage service with SQLite/PostgreSQL in rust-core/src/services/storage.rs ✅ IMPLEMENTED
- [x] T052 [P] Analyzer service for AST analysis in rust-core/src/services/analyzer.rs ✅ IMPLEMENTED
- [x] T053 [P] Security scanner service in rust-core/src/services/security.rs ✅ IMPLEMENTED
- [x] T054 [P] Metrics calculator service in rust-core/src/services/metrics.rs ✅ IMPLEMENTED

### TypeScript MCP - Tool Implementations (9 tools)

- [x] T055 search_code MCP tool in typescript-mcp/src/tools/search-code.ts ✅ IMPLEMENTED
- [x] T056 explain_function MCP tool in typescript-mcp/src/tools/explain-function.ts ✅ IMPLEMENTED
- [x] T057 find_references MCP tool in typescript-mcp/src/tools/find-references.ts ✅ IMPLEMENTED
- [x] T058 trace_data_flow MCP tool in typescript-mcp/src/tools/trace-data-flow.ts ✅ IMPLEMENTED
- [x] T059 analyze_security MCP tool in typescript-mcp/src/tools/analyze-security.ts ✅ IMPLEMENTED
- [x] T060 get_api_endpoints MCP tool in typescript-mcp/src/tools/get-api-endpoints.ts ✅ IMPLEMENTED
- [x] T061 check_complexity MCP tool in typescript-mcp/src/tools/check-complexity.ts ✅ IMPLEMENTED
- [x] T062 find_duplicates MCP tool in typescript-mcp/src/tools/find-duplicates.ts ✅ IMPLEMENTED
- [x] T063 suggest_refactoring MCP tool in typescript-mcp/src/tools/suggest-refactoring.ts ✅ IMPLEMENTED

### TypeScript REST API - Endpoints

- [x] T064 Codebases controller in typescript-mcp/src/controllers/codebases.ts ✅ IMPLEMENTED
- [x] T065 Queries controller in typescript-mcp/src/controllers/queries.ts ✅ IMPLEMENTED
- [x] T066 Jobs controller in typescript-mcp/src/controllers/jobs.ts ✅ IMPLEMENTED
- [x] T067 Configuration controller in typescript-mcp/src/controllers/configuration.ts ✅ IMPLEMENTED
- [x] T068 Health/Metrics controller in typescript-mcp/src/controllers/monitoring.ts ✅ IMPLEMENTED

## Phase 3.4: Integration

### FFI Bridge & Communication

- [x] T069 Napi-rs bindings for Rust functions in rust-core/src/ffi/mod.rs ✅ IMPLEMENTED
- [x] T070 TypeScript FFI client wrapper in typescript-mcp/src/ffi/rust-bridge.ts ✅ IMPLEMENTED
- [x] T071 [P] Message queue setup with BullMQ in typescript-mcp/src/queue/index.ts ✅ IMPLEMENTED

### LLM Integration

- [x] T072 [P] llama.cpp integration in typescript-mcp/src/llm/llama.ts ✅ IMPLEMENTED
- [x] T073 [P] Ollama client integration in typescript-mcp/src/llm/ollama.ts ✅ IMPLEMENTED
- [x] T074 [P] HuggingFace fallback in typescript-mcp/src/llm/huggingface.ts ✅ IMPLEMENTED
- [x] T075 [P] Model router with fallback logic in typescript-mcp/src/llm/router.ts ✅ IMPLEMENTED

### Database & Storage

- [x] T076 [P] SQLite adapter in rust-core/src/storage/sqlite.rs ✅ IMPLEMENTED
- [x] T077 [P] PostgreSQL adapter in rust-core/src/storage/postgres.rs ✅ IMPLEMENTED
- [x] T078 [P] DuckDB vector store in rust-core/src/storage/duckdb.rs ✅ IMPLEMENTED
- [x] T079 [P] Redis cache adapter in rust-core/src/cache/redis.rs ✅ IMPLEMENTED

### Middleware & Security

- [x] T080 [P] JWT authentication middleware in typescript-mcp/src/middleware/auth.ts ✅ IMPLEMENTED
- [x] T081 [P] Rate limiting middleware in typescript-mcp/src/middleware/rate-limit.ts ✅ IMPLEMENTED
- [x] T082 [P] CORS and security headers in typescript-mcp/src/middleware/security.ts ✅ IMPLEMENTED
- [x] T083 [P] Request/response logging in typescript-mcp/src/middleware/logging.ts ✅ IMPLEMENTED

## Phase 3.5: Polish

### Performance & Optimization

- [ ] T084 [P] Benchmark suite with Criterion.rs in rust-core/benches/
- [ ] T085 [P] Load tests with k6 in tests/load/
- [ ] T086 Memory profiling and optimization
- [ ] T087 Query performance optimization with caching
- [ ] T088 Parallel indexing performance tuning

### Documentation

- [ ] T089 [P] API documentation with OpenAPI/Swagger
- [ ] T090 [P] User guide with Docusaurus
- [ ] T091 [P] Architecture Decision Records (ADRs)
- [ ] T092 [P] Deployment guide for Docker/Kubernetes
- [ ] T093 [P] Plugin development guide

### CLI & Developer Experience

- [x] T094 CLI command interface in typescript-mcp/src/cli/index.ts ✅ IMPLEMENTED
- [ ] T095 Interactive configuration wizard
- [ ] T096 Progress indicators for long operations
- [ ] T097 Error messages with actionable suggestions

### Monitoring & Observability

- [ ] T098 Prometheus metrics exporter
- [ ] T099 OpenTelemetry tracing setup
- [ ] T100 Grafana dashboard templates

## Dependencies

### Critical Path

```
Setup (T001-T008) → Tests (T009-T033) → Models (T034-T045) → Services (T046-T054) → APIs (T055-T068) → Integration (T069-T083) → Polish (T084-T100)
```

### Blocking Dependencies

- T001-T003 block all other tasks (project setup)
- T006 blocks T069-T070 (FFI setup required)
- T034-T045 block T046-T054 (models before services)
- T046-T054 block T055-T068 (services before APIs)
- All tests (T009-T033) must fail before implementation

### Parallel Opportunities

- All [P] marked tasks in same phase can run concurrently
- Contract tests (T009-T028) can all run in parallel
- Model implementations (T034-T045) can all run in parallel
- Documentation tasks (T089-T093) can all run in parallel

## Parallel Execution Examples

### Example 1: Run all MCP contract tests

```
Task: "Contract test for search_code tool in tests/contract/test_search_code.ts"
Task: "Contract test for explain_function tool in tests/contract/test_explain_function.ts"
Task: "Contract test for find_references tool in tests/contract/test_find_references.ts"
Task: "Contract test for trace_data_flow tool in tests/contract/test_trace_data_flow.ts"
Task: "Contract test for analyze_security tool in tests/contract/test_analyze_security.ts"
Task: "Contract test for get_api_endpoints tool in tests/contract/test_get_api_endpoints.ts"
Task: "Contract test for check_complexity tool in tests/contract/test_check_complexity.ts"
Task: "Contract test for find_duplicates tool in tests/contract/test_find_duplicates.ts"
Task: "Contract test for suggest_refactoring tool in tests/contract/test_suggest_refactoring.ts"
```

### Example 2: Run all data model implementations

```
Task: "Implement Codebase model in rust-core/src/models/codebase.rs"
Task: "Implement CodeEntity model in rust-core/src/models/code_entity.rs"
Task: "Implement CodeRelationship model in rust-core/src/models/code_relationship.rs"
Task: "Implement Index model in rust-core/src/models/index.rs"
Task: "Implement Query model in rust-core/src/models/query.rs"
Task: "Implement Embedding model in rust-core/src/models/embedding.rs"
Task: "Implement CacheEntry model in rust-core/src/models/cache_entry.rs"
Task: "Implement Plugin model in rust-core/src/models/plugin.rs"
Task: "Implement Configuration model in rust-core/src/models/configuration.rs"
Task: "Implement IndexJob model in rust-core/src/models/index_job.rs"
Task: "Implement CodeMetric model in rust-core/src/models/code_metric.rs"
Task: "Implement APIEndpoint model in rust-core/src/models/api_endpoint.rs"
```

### Example 3: Run all integration tests

```
Task: "Integration test VS Code extension scenario in tests/integration/test_vscode_integration.ts"
Task: "Integration test Claude Desktop MCP scenario in tests/integration/test_claude_desktop.ts"
Task: "Integration test CI/CD pipeline scenario in tests/integration/test_cicd_integration.ts"
Task: "Integration test local LLM Ollama scenario in tests/integration/test_local_llm.ts"
Task: "Integration test large monorepo scenario in tests/integration/test_monorepo_scale.ts"
```

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- Verify tests fail before implementing (TDD requirement)
- Commit after each completed task for granular history
- Use feature branches for experimental changes
- Run benchmarks after optimization tasks

## Task Generation Rules Applied

1. **From Contracts**:
   - MCP tools contract → 9 contract test tasks (T009-T017)
   - REST API contract → 11 endpoint test tasks (T018-T028)
   - Each endpoint → implementation task (T064-T068)

2. **From Data Model**:
   - 12 entities → 12 model creation tasks (T034-T045)
   - Relationships → service layer tasks (T046-T054)

3. **From Quickstart Scenarios**:
   - 5 integration scenarios → 5 integration tests (T029-T033)

4. **From Technical Stack**:
   - Rust + TypeScript → hybrid structure tasks
   - Tree-sitter, tantivy, ONNX → specific service tasks
   - Docker, k6, Prometheus → deployment/monitoring tasks

5. **Constitutional Alignment**:
   - Local-first: Ollama/llama.cpp tasks (T072-T073)
   - Performance: Benchmark and optimization tasks (T084-T088)
   - Language agnostic: Tree-sitter parser task (T046)
   - Privacy: No telemetry tasks, local-only defaults
   - Incremental: Layered service architecture (T046-T054)

## Validation Checklist

- [x] All contracts have corresponding tests (T009-T028)
- [x] All entities have model tasks (T034-T045)
- [x] All tests come before implementation (Phase 3.2 before 3.3)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Constitutional compliance verified:
  - [x] No mandatory external dependencies
  - [x] Performance tests included (T084-T088)
  - [x] Language-agnostic implementation (T046)
  - [x] Privacy-preserving defaults

## Estimated Completion Time

- **Setup**: 2 days
- **Tests**: 3 days (can parallelize to 1 day with team)
- **Core Implementation**: 5 days (can parallelize to 2 days)
- **Integration**: 3 days
- **Polish**: 3 days
- **Total Sequential**: ~16 days
- **Total Parallel (4 developers)**: ~7 days
