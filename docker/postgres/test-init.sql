-- PostgreSQL initialization script for test environment
-- Sets up the database schema for MCP testing

-- Create extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create main code entities table with full-text search capabilities
CREATE TABLE IF NOT EXISTS code_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- function, class, variable, etc.
    language TEXT,
    start_line INTEGER,
    end_line INTEGER,
    content TEXT,
    code_hash TEXT,
    signature TEXT,
    complexity_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vector column for semantic search
ALTER TABLE code_entities ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_code_entities_name ON code_entities USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_code_entities_content ON code_entities USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_code_entities_file_path ON code_entities(file_path);
CREATE INDEX IF NOT EXISTS idx_code_entities_language ON code_entities(language);
CREATE INDEX IF NOT EXISTS idx_code_entities_type ON code_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_code_entities_created_at ON code_entities(created_at);

-- Create full-text search configuration
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'code_search') THEN
        CREATE TEXT SEARCH CONFIGURATION code_search (
            COPY = english
        );
    END IF;
END $$;

-- Create codebase tracking table
CREATE TABLE IF NOT EXISTS codebases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    path TEXT NOT NULL,
    language TEXT,
    file_count INTEGER DEFAULT 0,
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create search history table for testing
CREATE TABLE IF NOT EXISTS search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    codebase_id UUID REFERENCES codebases(id),
    results_count INTEGER DEFAULT 0,
    search_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create test performance metrics table
CREATE TABLE IF NOT EXISTS test_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_name TEXT NOT NULL,
    project_name TEXT NOT NULL,
    operation_type TEXT NOT NULL, -- search, index, stats
    duration_ms INTEGER,
    memory_usage_mb INTEGER,
    results_count INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert test data for validation
INSERT INTO codebases (name, path, language) VALUES
('test-project', '/app/test-data/test-project', 'typescript'),
('benchmark-project', '/app/test-data/benchmark-project', 'javascript')
ON CONFLICT (name) DO NOTHING;

-- Create a test code entity for validation
INSERT INTO code_entities (name, file_path, entity_type, language, start_line, end_line, content, signature) VALUES
('testFunction', '/app/test-data/test-project/utils.ts', 'function', 'typescript', 1, 10, 'function testFunction() { return true; }', 'testFunction(): boolean')
ON CONFLICT DO NOTHING;

-- Create sample search queries for testing
CREATE TABLE IF NOT EXISTS sample_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    expected_entities TEXT[] DEFAULT '{}',
    query_type TEXT DEFAULT 'search', -- search, pattern, semantic
    difficulty TEXT DEFAULT 'easy' -- easy, medium, hard
);

-- Insert sample queries
INSERT INTO sample_queries (query, expected_entities, query_type, difficulty) VALUES
('function', ARRAY['testFunction'], 'search', 'easy'),
('testFunction', ARRAY['testFunction'], 'search', 'easy'),
('class', ARRAY[], 'search', 'medium'),
('async.*await', ARRAY[], 'pattern', 'hard')
ON CONFLICT DO NOTHING;

-- Grant permissions to test user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO test_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO test_user;

-- Create view for test data validation
CREATE OR REPLACE VIEW test_validation AS
SELECT
    cb.name as codebase_name,
    COUNT(ce.id) as entity_count,
    COUNT(DISTINCT ce.language) as language_count,
    COUNT(DISTINCT ce.entity_type) as entity_type_count,
    MIN(ce.start_line) as min_line,
    MAX(ce.end_line) as max_line
FROM codebases cb
LEFT JOIN code_entities ce ON cb.name = ce.file_path
GROUP BY cb.name;

-- Create function to reset test data
CREATE OR REPLACE FUNCTION reset_test_data()
RETURNS void AS $$
BEGIN
    -- Clear test metrics
    DELETE FROM test_metrics;

    -- Clear search history
    DELETE FROM search_history;

    -- Reset code entities (keep codebases)
    DELETE FROM code_entities;

    -- Insert back test entity
    INSERT INTO code_entities (name, file_path, entity_type, language, start_line, end_line, content, signature) VALUES
    ('testFunction', '/app/test-data/test-project/utils.ts', 'function', 'typescript', 1, 10, 'function testFunction() { return true; }', 'testFunction(): boolean');

    RAISE NOTICE 'Test data reset completed';
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to code_entities table
CREATE TRIGGER update_code_entities_updated_at
    BEFORE UPDATE ON code_entities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create test indexes for performance testing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_code_entities_composite
ON code_entities(language, entity_type, start_line);

-- Create partial index for test entities only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_entities
ON code_entities(name)
WHERE file_path LIKE '%test%';

-- Add comments for documentation
COMMENT ON TABLE code_entities IS 'Stores indexed code entities for search and analysis';
COMMENT ON TABLE codebases IS 'Tracks indexed codebases and their metadata';
COMMENT ON TABLE search_history IS 'Logs all search queries for analysis';
COMMENT ON TABLE test_metrics IS 'Stores performance metrics for testing';

-- Create statistics view for monitoring
CREATE OR REPLACE VIEW indexing_statistics AS
SELECT
    cb.name as codebase_name,
    COUNT(ce.id) as total_entities,
    COUNT(CASE WHEN ce.entity_type = 'function' THEN 1 END) as functions,
    COUNT(CASE WHEN ce.entity_type = 'class' THEN 1 END) as classes,
    COUNT(CASE WHEN ce.entity_type = 'variable' THEN 1 END) as variables,
    COUNT(DISTINCT ce.language) as languages_used,
    cb.indexed_at,
    cb.last_modified
FROM codebases cb
LEFT JOIN code_entities ce ON cb.name || '/' = REPLACE(SUBSTRING(ce.file_path FROM 1 FOR POSITION('/src/' IN ce.file_path)), '/src/', '')
GROUP BY cb.id, cb.name, cb.indexed_at, cb.last_modified;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Test PostgreSQL database initialized successfully';
    RAISE NOTICE 'Extensions: vector, pg_trgm created';
    RAISE NOTICE 'Tables: code_entities, codebases, search_history, test_metrics created';
    RAISE NOTICE 'Indexes and views created for optimal performance';
    RAISE NOTICE 'Test data and validation functions ready';
END $$;