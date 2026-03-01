/**
 * Phase 7: RAG (Retrieval-Augmented Generation) Service
 */

import Database from 'better-sqlite3';
import { Logger } from '../services/logger.js';

const logger = new Logger('RAGService');

export interface RAGConfig {
  topK: number;
  similarityThreshold: number;
  dbPath: string;
}

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    source: string;
    language: string;
    type: string;
  };
}

export interface RetrievalResult {
  id: string;
  content: string;
  similarity: number;
  metadata: VectorDocument['metadata'];
}

export class RAGService {
  private config: RAGConfig;
  private db: Database.Database | null = null;
  private isInitialized = false;

  constructor(config: Partial<RAGConfig> = {}) {
    this.config = {
      topK: config.topK ?? 5,
      similarityThreshold: config.similarityThreshold ?? 0.7,
      dbPath: config.dbPath ?? './data/rag.db',
    };
  }

  async initialize(): Promise<void> {
    logger.info('Initializing RAG service');

    try {
      this.db = new Database(this.config.dbPath);
      this.db.pragma('journal_mode = WAL');
      
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS embeddings (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          embedding TEXT NOT NULL,
          source TEXT,
          language TEXT,
          type TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source);
      `);
      
      this.isInitialized = true;
      logger.info('RAG service initialized');
    } catch (error: any) {
      logger.error('Failed to initialize RAG service', error);
      throw error;
    }
  }

  async addDocument(doc: VectorDocument): Promise<void> {
    if (!this.isInitialized || !this.db) {
      throw new Error('RAG not initialized');
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO embeddings (id, content, embedding, source, language, type)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      doc.id,
      doc.content,
      JSON.stringify(doc.embedding),
      doc.metadata.source,
      doc.metadata.language,
      doc.metadata.type
    );
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    const batchSize = 100;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      await Promise.all(batch.map(doc => this.addDocument(doc)));
    }
  }

  async retrieve(queryEmbedding: number[]): Promise<RetrievalResult[]> {
    if (!this.isInitialized || !this.db) {
      return [];
    }

    const startTime = Date.now();
    const stmt = this.db.prepare('SELECT * FROM embeddings ORDER BY rowid LIMIT ?');
    const rows = stmt.all(this.config.topK) as any[];
    
    const results = rows
      .map(row => {
        const embedding = JSON.parse(row.embedding as string);
        const similarity = this.cosineSimilarity(queryEmbedding, embedding);
        return {
          id: row.id,
          content: row.content,
          similarity,
          metadata: { source: row.source, language: row.language, type: row.type },
        };
      })
      .filter(r => r.similarity >= this.config.similarityThreshold)
      .sort((a, b) => b.similarity - a.similarity);

    logger.info('Retrieval completed', { count: results.length, duration: Date.now() - startTime });
    return results;
  }

  async deleteBySource(source: string): Promise<number> {
    if (!this.db) {
      return 0;
    }
    const stmt = this.db.prepare('DELETE FROM embeddings WHERE source = ?');
    return stmt.run(source).changes;
  }

  async clear(): Promise<void> {
    if (!this.db) {
      return;
    }
    this.db.exec('DELETE FROM embeddings');
  }

  getStats(): { count: number; bySource: Record<string, number> } {
    if (!this.db) {
      return { count: 0, bySource: {} };
    }
    
    const countResult = this.db.prepare('SELECT COUNT(*) as count FROM embeddings').get() as any;
    const sourceRows = this.db.prepare('SELECT source, COUNT(*) as count FROM embeddings GROUP BY source').all() as any[];

    return {
      count: countResult?.count || 0,
      bySource: Object.fromEntries(sourceRows.map(r => [r.source, r.count])),
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) {
      return 0;
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  async shutdown(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.isInitialized = false;
  }
}

export function createRAGService(config?: Partial<RAGConfig>): RAGService {
  return new RAGService(config);
}

export default RAGService;
