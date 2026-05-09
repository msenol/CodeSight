//! SQLite persistence layer for the indexing engine.
//!
//! Shares the same `code-intelligence.db` schema as the TypeScript side:
//!   - code_entities (id, name, file_path, entity_type, start_line, end_line, content, codebase_id, indexed_at)
//!   - codebases     (id, name, path, languages, status, file_count, entity_count, indexed_at, updated_at)

use anyhow::Result;
use chrono::Utc;
use rusqlite::{params, Connection, OpenFlags};
use std::path::Path;

/// A lightweight SQLite-backed storage layer.
pub struct Storage {
    conn: Connection,
}

impl Storage {
    /// Open (or create) the SQLite database at `db_path` and ensure the schema exists.
    pub fn new(db_path: &Path) -> Result<Self> {
        let conn = Connection::open_with_flags(
            db_path,
            OpenFlags::SQLITE_OPEN_CREATE | OpenFlags::SQLITE_OPEN_READ_WRITE,
        )?;
        let mut storage = Self { conn };
        storage.ensure_schema()?;
        Ok(storage)
    }

    fn ensure_schema(&mut self) -> Result<()> {
        self.conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS code_entities (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                file_path   TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                start_line  INTEGER,
                end_line    INTEGER,
                content     TEXT,
                codebase_id TEXT NOT NULL DEFAULT '',
                indexed_at  DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_name        ON code_entities(name);
            CREATE INDEX IF NOT EXISTS idx_file_path   ON code_entities(file_path);
            CREATE INDEX IF NOT EXISTS idx_entity_type ON code_entities(entity_type);
            CREATE INDEX IF NOT EXISTS idx_codebase_id ON code_entities(codebase_id);

            CREATE TABLE IF NOT EXISTS codebases (
                id            TEXT PRIMARY KEY,
                name          TEXT NOT NULL,
                path          TEXT NOT NULL,
                languages     TEXT,
                status        TEXT DEFAULT 'indexed',
                file_count    INTEGER DEFAULT 0,
                entity_count  INTEGER DEFAULT 0,
                indexed_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            "#,
        )?;
        Ok(())
    }

    // ------------------------------------------------------------------
    // Codebase operations
    // ------------------------------------------------------------------

    /// Insert or replace a codebase record.
    pub fn upsert_codebase(
        &mut self,
        id: &str,
        name: &str,
        path: &str,
        languages: Option<&str>,
        file_count: usize,
        entity_count: usize,
    ) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            r#"
            INSERT INTO codebases (id, name, path, languages, status, file_count, entity_count, indexed_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, 'indexed', ?5, ?6, ?7, ?7)
            ON CONFLICT(id) DO UPDATE SET
                name         = excluded.name,
                path         = excluded.path,
                languages    = excluded.languages,
                status       = 'indexed',
                file_count   = excluded.file_count,
                entity_count = excluded.entity_count,
                updated_at   = excluded.updated_at
            "#,
            params![id, name, path, languages, file_count as i64, entity_count as i64, now],
        )?;
        Ok(())
    }

    /// Remove all entity rows belonging to a given codebase.
    pub fn clear_codebase_entities(&mut self, codebase_id: &str) -> Result<()> {
        self.conn
            .execute("DELETE FROM code_entities WHERE codebase_id = ?1", [codebase_id])?;
        Ok(())
    }

    // ------------------------------------------------------------------
    // Entity operations
    // ------------------------------------------------------------------

    /// Insert a single code entity.
    pub fn insert_entity(
        &mut self,
        id: &str,
        name: &str,
        file_path: &str,
        entity_type: &str,
        start_line: u32,
        end_line: u32,
        content: &str,
        codebase_id: &str,
    ) -> Result<()> {
        self.conn.execute(
            r#"
            INSERT INTO code_entities (id, name, file_path, entity_type, start_line, end_line, content, codebase_id)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(id) DO UPDATE SET
                name        = excluded.name,
                file_path   = excluded.file_path,
                entity_type = excluded.entity_type,
                start_line  = excluded.start_line,
                end_line    = excluded.end_line,
                content     = excluded.content,
                codebase_id = excluded.codebase_id,
                indexed_at  = CURRENT_TIMESTAMP
            "#,
            params![
                id,
                name,
                file_path,
                entity_type,
                start_line as i64,
                end_line as i64,
                content,
                codebase_id
            ],
        )?;
        Ok(())
    }

    /// Bulk-insert entities inside a single transaction.
    pub fn insert_entities_batch(
        &mut self,
        entities: &[EntityRow],
    ) -> Result<()> {
        let tx = self.conn.transaction()?;
        {
            let mut stmt = tx.prepare_cached(
                r#"
                INSERT INTO code_entities (id, name, file_path, entity_type, start_line, end_line, content, codebase_id)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                ON CONFLICT(id) DO UPDATE SET
                    name        = excluded.name,
                    file_path   = excluded.file_path,
                    entity_type = excluded.entity_type,
                    start_line  = excluded.start_line,
                    end_line    = excluded.end_line,
                    content     = excluded.content,
                    codebase_id = excluded.codebase_id,
                    indexed_at  = CURRENT_TIMESTAMP
                "#,
            )?;
            for e in entities {
                stmt.execute(params![
                    e.id, e.name, e.file_path, e.entity_type,
                    e.start_line as i64, e.end_line as i64,
                    e.content, e.codebase_id
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    // ------------------------------------------------------------------
    // Search
    // ------------------------------------------------------------------

    /// Keyword search over entity names (case-insensitive LIKE).
    pub fn search_entities(
        &self,
        query: &str,
        codebase_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<SearchResult>> {
        let like = format!("%{}%", query.replace('%', "\\%").replace('_', "\\_"));
        let sql = if codebase_id.is_some() {
            r#"
            SELECT name, file_path, entity_type, start_line, end_line, content
            FROM code_entities
            WHERE name LIKE ?1 AND codebase_id = ?2
            ORDER BY name
            LIMIT ?3
            "#
        } else {
            r#"
            SELECT name, file_path, entity_type, start_line, end_line, content
            FROM code_entities
            WHERE name LIKE ?1
            ORDER BY name
            LIMIT ?2
            "#
        };

        let mut stmt = self.conn.prepare(sql)?;
        let rows = if let Some(cid) = codebase_id {
            stmt.query_map(params![like, cid, limit as i64], |row| {
                Ok(SearchResult {
                    name: row.get(0)?,
                    file_path: row.get(1)?,
                    entity_type: row.get(2)?,
                    start_line: row.get::<_, i64>(3)? as u32,
                    end_line: row.get::<_, i64>(4)? as u32,
                    content: row.get(5)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?
        } else {
            stmt.query_map(params![like, limit as i64], |row| {
                Ok(SearchResult {
                    name: row.get(0)?,
                    file_path: row.get(1)?,
                    entity_type: row.get(2)?,
                    start_line: row.get::<_, i64>(3)? as u32,
                    end_line: row.get::<_, i64>(4)? as u32,
                    content: row.get(5)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?
        };

        Ok(rows)
    }
}

/// A flattened entity row suitable for bulk insertion.
#[derive(Debug, Clone)]
pub struct EntityRow {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub entity_type: String,
    pub start_line: u32,
    pub end_line: u32,
    pub content: String,
    pub codebase_id: String,
}

/// A single search result row.
#[derive(Debug, Clone)]
pub struct SearchResult {
    pub name: String,
    pub file_path: String,
    pub entity_type: String,
    pub start_line: u32,
    pub end_line: u32,
    pub content: String,
}
