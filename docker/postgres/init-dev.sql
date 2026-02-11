-- Development Database Initialization Script for CodeSight MCP Server

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS codesight;
CREATE SCHEMA IF NOT EXISTS mcp_tools;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_code_entities_type ON codesight.code_entities(type);
CREATE INDEX IF NOT EXISTS idx_code_entities_name ON codesight.code_entities(name);
CREATE INDEX IF NOT EXISTS idx_code_entities_file_path ON codesight.code_entities(file_path);
CREATE INDEX IF NOT EXISTS idx_code_entities_start_line ON codesight.code_entities(start_line);
CREATE INDEX IF NOT EXISTS idx_code_entities_end_line ON codesight.code_entities(end_line);

-- Create full-text search indexes
CREATE INDEX IF NOT EXISTS idx_code_entities_search ON codesight.code_entities USING gin(to_tsvector('english', name || ' ' || COALESCE(docstring, '')));
CREATE INDEX IF NOT EXISTS idx_code_files_search ON codesight.code_files USING gin(to_tsvector('english', file_path || ' ' || COALESCE(content, '')));

-- Set up development data
INSERT INTO codesight.code_entities (
    id,
    name,
    type,
    language,
    file_path,
    start_line,
    end_line,
    docstring,
    metadata,
    created_at,
    updated_at
) VALUES
    (
        uuid_generate_v4(),
        'example_function',
        'function',
        'typescript',
        'src/example.ts',
        1,
        10,
        'This is an example function for development testing',
        '{"complexity": 5, "lines_of_code": 10}',
        NOW(),
        NOW()
    ) ON CONFLICT DO NOTHING;

-- Create test users for development
INSERT INTO codesight.users (id, username, email, created_at, updated_at)
VALUES
    (
        uuid_generate_v4(),
        'dev_user',
        'dev@codesight.local',
        NOW(),
        NOW()
    ) ON CONFLICT DO NOTHING;

-- Create sample project for testing
INSERT INTO codesight.projects (id, name, description, repository_url, created_at, updated_at)
VALUES
    (
        uuid_generate_v4(),
        'Test Project',
        'A test project for development environment',
        'https://github.com/test/project',
        NOW(),
        NOW()
    ) ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA codesight TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA codesight TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA mcp_tools TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA mcp_tools TO postgres;

-- Create development views
CREATE OR REPLACE VIEW codesight.v_entity_summary AS
SELECT
    type,
    language,
    COUNT(*) as count,
    AVG(CAST((metadata->>'complexity') AS INTEGER)) as avg_complexity,
    AVG(end_line - start_line + 1) as avg_lines
FROM codesight.code_entities
GROUP BY type, language;

-- Create function for code search
CREATE OR REPLACE FUNCTION codesight.search_code(search_query text)
RETURNS TABLE (
    id uuid,
    name text,
    type text,
    language text,
    file_path text,
    start_line integer,
    end_line integer,
    docstring text,
    relevance_score real
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ce.id,
        ce.name,
        ce.type,
        ce.language,
        ce.file_path,
        ce.start_line,
        ce.end_line,
        ce.docstring,
        ts_rank(to_tsvector('english', ce.name || ' ' || COALESCE(ce.docstring, '')), plainto_tsquery('english', search_query)) as relevance_score
    FROM
        codesight.code_entities ce
    WHERE
        to_tsvector('english', ce.name || ' ' || COALESCE(ce.docstring, '')) @@ plainto_tsquery('english', search_query)
    ORDER BY
        relevance_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Output development setup complete message
DO $$
BEGIN
    RAISE NOTICE 'CodeSight MCP development database initialized successfully';
    RAISE NOTICE 'Sample data inserted for testing';
    RAISE NOTICE 'Views and functions created for development';
END $$;