# Data Model: Code Intelligence MCP Server

**Generated**: 2025-09-21
**Status**: Complete

## Core Entities

### 1. Codebase
**Description**: Root entity representing a project or repository being indexed
```yaml
fields:
  id: UUID
  name: string
  path: string (absolute filesystem path)
  size_bytes: integer
  file_count: integer
  language_stats: map<string, integer> (language -> file count)
  index_version: string
  last_indexed: timestamp
  configuration_id: UUID (FK -> Configuration)
  status: enum (unindexed, indexing, indexed, error)

relationships:
  - has_many: CodeEntity
  - has_many: IndexJob
  - has_one: Configuration
  - has_many: CacheEntry

validations:
  - path must be absolute and exist
  - name must be unique
  - size_bytes >= 0
  - file_count >= 0

state_transitions:
  unindexed -> indexing -> indexed
  indexing -> error (on failure)
  indexed -> indexing (on re-index)
```

### 2. CodeEntity
**Description**: A discrete element in code (function, class, method, variable, etc.)
```yaml
fields:
  id: UUID
  codebase_id: UUID (FK -> Codebase)
  entity_type: enum (function, class, method, variable, import, type, interface, enum, constant)
  name: string
  qualified_name: string (fully qualified path)
  file_path: string (relative to codebase root)
  start_line: integer
  end_line: integer
  start_column: integer
  end_column: integer
  language: string
  signature: string (optional, for functions/methods)
  visibility: enum (public, private, protected, internal)
  documentation: text (extracted comments)
  ast_hash: string (content hash for change detection)
  embedding_id: UUID (FK -> Embedding, optional)

relationships:
  - belongs_to: Codebase
  - has_many: CodeRelationship (as source)
  - has_many: CodeRelationship (as target)
  - has_one: Embedding (optional)
  - has_many: CodeMetric

validations:
  - start_line <= end_line
  - start_column >= 0, end_column >= 0
  - file_path must be relative
  - name not empty
  - valid entity_type
```

### 3. CodeRelationship
**Description**: Represents relationships between code entities
```yaml
fields:
  id: UUID
  source_entity_id: UUID (FK -> CodeEntity)
  target_entity_id: UUID (FK -> CodeEntity)
  relationship_type: enum (imports, calls, extends, implements, references, uses, depends_on)
  confidence: float (0.0 to 1.0)
  context: string (optional, snippet showing relationship)

relationships:
  - belongs_to: CodeEntity (source)
  - belongs_to: CodeEntity (target)

validations:
  - source_entity_id != target_entity_id
  - confidence between 0.0 and 1.0
  - valid relationship_type
```

### 4. Index
**Description**: Searchable index structure for a codebase
```yaml
fields:
  id: UUID
  codebase_id: UUID (FK -> Codebase)
  index_type: enum (keyword, ast, semantic, vector)
  status: enum (building, ready, corrupted, rebuilding)
  created_at: timestamp
  updated_at: timestamp
  size_bytes: integer
  entry_count: integer
  metadata: JSON (index-specific configuration)

relationships:
  - belongs_to: Codebase
  - has_many: IndexEntry

validations:
  - valid index_type
  - size_bytes >= 0
  - entry_count >= 0

state_transitions:
  building -> ready
  ready -> rebuilding -> ready
  any -> corrupted (on error)
```

### 5. Query
**Description**: Natural language or structured query request
```yaml
fields:
  id: UUID
  query_text: string
  query_type: enum (natural_language, structured, regex)
  intent: enum (find_function, explain_code, trace_flow, find_usage, security_audit, find_api, check_complexity)
  codebase_id: UUID (FK -> Codebase)
  user_id: string (optional, for tracking)
  timestamp: timestamp
  execution_time_ms: integer
  result_count: integer
  cache_hit: boolean

relationships:
  - belongs_to: Codebase
  - has_many: QueryResult
  - has_one: CacheEntry (optional)

validations:
  - query_text not empty
  - valid query_type and intent
  - execution_time_ms >= 0
  - result_count >= 0
```

### 6. Embedding
**Description**: Vector representation of code for semantic search
```yaml
fields:
  id: UUID
  entity_id: UUID (FK -> CodeEntity, optional)
  content_hash: string (for deduplication)
  model_name: string (e.g., "all-MiniLM-L6-v2")
  vector: array<float> (dimension based on model)
  dimension: integer
  created_at: timestamp
  metadata: JSON (additional context)

relationships:
  - belongs_to: CodeEntity (optional)
  - has_many: VectorSearchResult

validations:
  - vector dimension matches dimension field
  - dimension > 0
  - valid model_name
  - content_hash not empty
```

### 7. CacheEntry
**Description**: Cached results of expensive operations
```yaml
fields:
  id: UUID
  cache_key: string (unique)
  cache_type: enum (query_result, embedding, parse_result, analysis_result)
  value: BLOB
  size_bytes: integer
  ttl_seconds: integer
  created_at: timestamp
  expires_at: timestamp
  access_count: integer
  last_accessed: timestamp
  codebase_id: UUID (FK -> Codebase, optional)

relationships:
  - belongs_to: Codebase (optional)

validations:
  - cache_key not empty and unique
  - size_bytes >= 0
  - ttl_seconds > 0
  - expires_at > created_at
  - access_count >= 0
```

### 8. Plugin
**Description**: Extension module for additional functionality
```yaml
fields:
  id: UUID
  name: string
  version: string
  plugin_type: enum (language, analyzer, tool, formatter)
  enabled: boolean
  configuration: JSON
  capabilities: array<string>
  supported_languages: array<string> (optional)
  installed_at: timestamp
  updated_at: timestamp

relationships:
  - has_many: PluginExecution

validations:
  - name not empty and unique
  - valid semver version
  - valid plugin_type
  - capabilities not empty for enabled plugins
```

### 9. Configuration
**Description**: User settings for system behavior
```yaml
fields:
  id: UUID
  name: string
  profile: enum (default, performance, accuracy, minimal)
  indexing_config: JSON
  search_config: JSON
  model_config: JSON
  storage_config: JSON
  cache_config: JSON
  privacy_config: JSON
  created_at: timestamp
  updated_at: timestamp
  is_active: boolean

relationships:
  - has_many: Codebase

validations:
  - name not empty
  - valid profile
  - only one active configuration per profile
  - all config fields are valid JSON
```

### 10. IndexJob
**Description**: Background job for indexing operations
```yaml
fields:
  id: UUID
  codebase_id: UUID (FK -> Codebase)
  job_type: enum (full_index, incremental_update, reindex, analyze)
  status: enum (queued, running, completed, failed, cancelled)
  priority: integer (1-10, higher is more urgent)
  started_at: timestamp (optional)
  completed_at: timestamp (optional)
  error_message: text (optional)
  files_processed: integer
  files_total: integer
  progress_percentage: float

relationships:
  - belongs_to: Codebase
  - has_many: IndexJobLog

validations:
  - priority between 1 and 10
  - files_processed <= files_total
  - progress_percentage between 0.0 and 100.0

state_transitions:
  queued -> running -> completed
  running -> failed (on error)
  queued -> cancelled
  running -> cancelled
```

### 11. CodeMetric
**Description**: Computed metrics for code quality and complexity
```yaml
fields:
  id: UUID
  entity_id: UUID (FK -> CodeEntity)
  metric_type: enum (cyclomatic_complexity, cognitive_complexity, lines_of_code, maintainability_index, test_coverage)
  value: float
  computed_at: timestamp
  metadata: JSON (metric-specific details)

relationships:
  - belongs_to: CodeEntity

validations:
  - valid metric_type
  - value >= 0 for most metrics
  - maintainability_index between 0 and 100
```

### 12. APIEndpoint
**Description**: Discovered REST or GraphQL API endpoints
```yaml
fields:
  id: UUID
  codebase_id: UUID (FK -> Codebase)
  entity_id: UUID (FK -> CodeEntity)
  path: string (e.g., "/api/users/{id}")
  method: enum (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD, GraphQL)
  handler_function: string (qualified function name)
  request_schema: JSON (optional)
  response_schema: JSON (optional)
  authentication_required: boolean
  discovered_at: timestamp

relationships:
  - belongs_to: Codebase
  - belongs_to: CodeEntity
  - has_many: APIParameter

validations:
  - path starts with "/"
  - valid HTTP method or GraphQL
  - handler_function not empty
```

## Relationships Summary

### One-to-Many
- Codebase → CodeEntity
- Codebase → IndexJob
- Codebase → Index
- CodeEntity → CodeRelationship
- CodeEntity → CodeMetric
- Index → IndexEntry
- Query → QueryResult
- Plugin → PluginExecution
- Configuration → Codebase
- IndexJob → IndexJobLog
- APIEndpoint → APIParameter

### Many-to-Many (via join tables)
- CodeEntity ↔ CodeEntity (via CodeRelationship)
- Query ↔ CacheEntry (via cache_key lookup)

### Optional Relationships
- CodeEntity → Embedding (not all entities have embeddings)
- CacheEntry → Codebase (some caches are global)
- Embedding → CodeEntity (some embeddings are for queries)

## Data Integrity Rules

### Referential Integrity
- Cascading delete: Codebase deletion removes all related entities
- Restrict delete: Cannot delete Configuration if Codebases reference it
- Set null: Plugin deletion sets null on historical execution records

### Unique Constraints
- (codebase_id, qualified_name) unique for CodeEntity
- cache_key unique globally for CacheEntry
- (name, version) unique for Plugin
- (codebase_id, path, method) unique for APIEndpoint

### Check Constraints
- file_path in CodeEntity must be within codebase path
- vector dimension must match model requirements
- TTL must be positive for cache entries
- Progress percentage between 0 and 100

## Performance Indexes

### Primary Indexes
- CodeEntity: (codebase_id, entity_type, name)
- CodeRelationship: (source_entity_id, relationship_type)
- Embedding: (content_hash) for deduplication
- CacheEntry: (cache_key, expires_at)
- Query: (codebase_id, timestamp DESC)

### Full-Text Search Indexes
- CodeEntity.name, CodeEntity.documentation
- Query.query_text
- APIEndpoint.path

### Covering Indexes
- CodeEntity: (codebase_id, file_path) INCLUDE (start_line, end_line)
- CodeRelationship: (target_entity_id) INCLUDE (source_entity_id, relationship_type)

## Migration Strategy

### Version 1.0.0 (Initial)
- All core entities as defined above
- Basic indexes for primary access patterns
- Default configuration profiles

### Future Versions (Planned)
- Version 1.1.0: Add semantic versioning to CodeEntity
- Version 1.2.0: Add collaboration features (shared queries, annotations)
- Version 1.3.0: Add incremental embedding updates
- Version 2.0.0: Multi-tenant support with workspace isolation