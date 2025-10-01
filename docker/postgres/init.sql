-- CodeSight PostgreSQL Database Initialization
-- This script initializes the database with required schemas and tables

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE codesight'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'codesight');

\c codesight;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create users and permissions
CREATE USER IF NOT EXISTS codesight_user WITH PASSWORD 'codesight_password';
GRANT ALL PRIVILEGES ON DATABASE codesight TO codesight_user;
GRANT ALL ON SCHEMA public TO codesight_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO codesight_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO codesight_user;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO codesight_user;

-- Create tables for CodeSight
CREATE TABLE IF NOT EXISTS code_entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    file_path TEXT NOT NULL,
    line_number INTEGER,
    content TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS code_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES code_entities(id) ON DELETE CASCADE,
    target_id UUID REFERENCES code_entities(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_id, target_id, relationship_type)
);

CREATE TABLE IF NOT EXISTS code_indexes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID REFERENCES code_entities(id) ON DELETE CASCADE,
    index_type VARCHAR(50) NOT NULL,
    index_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS search_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_text TEXT NOT NULL,
    query_type VARCHAR(50) NOT NULL,
    results_count INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    user_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usage_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type VARCHAR(50) NOT NULL,
    metric_value DECIMAL NOT NULL,
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_code_entities_name ON code_entities(name);
CREATE INDEX IF NOT EXISTS idx_code_entities_type ON code_entities(type);
CREATE INDEX IF NOT EXISTS idx_code_entities_file_path ON code_entities(file_path);
CREATE INDEX IF NOT EXISTS idx_code_entities_metadata ON code_entities USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_code_relationships_source ON code_relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_code_relationships_target ON code_relationships(target_id);
CREATE INDEX IF NOT EXISTS idx_code_relationships_type ON code_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_code_indexes_entity_id ON code_indexes(entity_id);
CREATE INDEX IF NOT EXISTS idx_code_indexes_type ON code_indexes(index_type);
CREATE INDEX IF NOT EXISTS idx_search_queries_created_at ON search_queries(created_at);
CREATE INDEX IF NOT EXISTS idx_search_queries_query_type ON search_queries(query_type);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_type ON usage_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_timestamp ON usage_metrics(timestamp);

-- Create full-text search index
CREATE INDEX IF NOT EXISTS idx_code_entities_fts ON code_entities
USING GIN(to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(content, '')));

-- Create functions for search
CREATE OR REPLACE FUNCTION search_code(query_text TEXT)
RETURNS TABLE(id UUID, name VARCHAR, type VARCHAR, file_path TEXT, line_number INTEGER, content TEXT, score FLOAT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ce.id,
        ce.name,
        ce.type,
        ce.file_path,
        ce.line_number,
        ce.content,
        ts_rank(to_tsvector('english', COALESCE(ce.name, '') || ' ' || COALESCE(ce.content, '')),
               to_tsquery('english', query_text)) as score
    FROM code_entities ce
    WHERE to_tsvector('english', COALESCE(ce.name, '') || ' ' || COALESCE(ce.content, '')) @@ to_tsquery('english', query_text)
    ORDER BY score DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function for getting code relationships
CREATE OR REPLACE FUNCTION get_code_relationships(entity_id UUID)
RETURNS TABLE(target_id UUID, target_name VARCHAR, target_type VARCHAR, relationship_type VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ce_target.id as target_id,
        ce_target.name as target_name,
        ce_target.type as target_type,
        cr.relationship_type
    FROM code_relationships cr
    JOIN code_entities ce_target ON cr.target_id = ce_target.id
    WHERE cr.source_id = entity_id;
END;
$$ LANGUAGE plpgsql;

-- Create function for getting usage statistics
CREATE OR REPLACE FUNCTION get_usage_stats(metric_type VARCHAR, start_time TIMESTAMP, end_time TIMESTAMP)
RETURNS TABLE(metric_value DECIMAL, timestamp TIMESTAMP) AS $$
BEGIN
    RETURN QUERY
    SELECT
        um.metric_value,
        um.timestamp
    FROM usage_metrics um
    WHERE um.metric_type = get_usage_stats.metric_type
    AND um.timestamp BETWEEN start_time AND end_time
    ORDER BY um.timestamp;
END;
$$ LANGUAGE plpgsql;

-- Insert initial data
INSERT INTO code_entities (name, type, file_path, content, metadata) VALUES
('CodeSight MCP Server', 'class', 'typescript-mcp/src/index.ts', 'Main MCP server class', '{"language": "typescript", "lines": 150}'),
('IndexingService', 'class', 'typescript-mcp/src/services/IndexingService.ts', 'Service for indexing code entities', '{"language": "typescript", "lines": 300}'),
('SearchEngine', 'class', 'typescript-mcp/src/services/SearchEngine.ts', 'Search engine implementation', '{"language": "typescript", "lines": 200}'),
('CodeEntity', 'interface', 'typescript-mcp/src/types/index.ts', 'Code entity interface definition', '{"language": "typescript", "lines": 50}'),
('FFIBridge', 'class', 'typescript-mcp/src/ffi/Bridge.ts', 'Rust FFI bridge implementation', '{"language": "typescript", "lines": 100}');

-- Insert sample relationships
INSERT INTO code_relationships (source_id, target_id, relationship_type) VALUES
((SELECT id FROM code_entities WHERE name = 'CodeSight MCP Server'),
 (SELECT id FROM code_entities WHERE name = 'IndexingService'), 'uses'),
((SELECT id FROM code_entities WHERE name = 'CodeSight MCP Server'),
 (SELECT id FROM code_entities WHERE name = 'SearchEngine'), 'uses'),
((SELECT id FROM code_entities WHERE name = 'IndexingService'),
 (SELECT id FROM code_entities WHERE name = 'CodeEntity'), 'manages'),
((SELECT id FROM code_entities WHERE name = 'SearchEngine'),
 (SELECT id FROM code_entities WHERE name = 'CodeEntity'), 'queries'),
((SELECT id FROM code_entities WHERE name = 'CodeSight MCP Server'),
 (SELECT id FROM code_entities WHERE name = 'FFIBridge'), 'uses');

-- Insert initial usage metrics
INSERT INTO usage_metrics (metric_type, metric_value, metadata) VALUES
('indexed_files', 47, '{"project": "codesight", "timestamp": "2024-01-01T00:00:00Z"}'),
('indexed_entities', 377, '{"project": "codesight", "timestamp": "2024-01-01T00:00:00Z"}'),
('search_queries', 25, '{"project": "codesight", "timestamp": "2024-01-01T00:00:00Z"}'),
('average_search_time', 35.5, '{"project": "codesight", "unit": "ms", "timestamp": "2024-01-01T00:00:00Z"}');

-- Create view for code statistics
CREATE OR REPLACE VIEW code_statistics AS
SELECT
    COUNT(*) as total_entities,
    COUNT(DISTINCT type) as entity_types,
    COUNT(DISTINCT file_path) as files_indexed,
    AVG(LENGTH(content)) as average_content_length,
    MAX(created_at) as last_indexed
FROM code_entities;

-- Grant permissions to codesight_user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO codesight_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO codesight_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO codesight_user;

-- Set default permissions for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO codesight_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO codesight_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO codesight_user;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_code_entities_composite ON code_entities(type, created_at);
CREATE INDEX IF NOT EXISTS idx_code_relationships_composite ON code_relationships(relationship_type, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_composite ON usage_metrics(metric_type, timestamp);

-- Create function for cleaning old data
CREATE OR REPLACE FUNCTION cleanup_old_data(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM search_queries
    WHERE created_at < CURRENT_TIMESTAMP - (days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function for database health check
CREATE OR REPLACE FUNCTION health_check()
RETURNS TABLE(status VARCHAR, message VARCHAR, timestamp TIMESTAMP) AS $$
BEGIN
    RETURN QUERY
    SELECT
        'healthy' as status,
        'Database is operational' as message,
        CURRENT_TIMESTAMP as timestamp;
END;
$$ LANGUAGE plpgsql;

-- Final verification
SELECT 'Database initialization completed successfully' as status;