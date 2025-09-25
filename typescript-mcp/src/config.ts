/**
 * Configuration management
 */
import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '4000'),
    host: process.env.HOST || '0.0.0.0'
  },
  database: {
    url: process.env.DATABASE_URL || 'sqlite:./data/codesight.db'
  },
  llm: {
    provider: process.env.LLM_PROVIDER || 'mock',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'gpt-3.5-turbo'
  },
  rust: {
    libraryPath: process.env.RUST_LIBRARY_PATH || './rust-core/target/release'
  }
};