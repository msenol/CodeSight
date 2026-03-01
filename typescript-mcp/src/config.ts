/**
 * Configuration management
 */
import { config as dotenvConfig } from 'dotenv';

declare const process: {
  env: Record<string, string | undefined>;
};

// Load environment variables
dotenvConfig();

export const config = {
  version: process.env.npm_package_version || '0.1.0',
  server: {
    port: parseInt(process.env.PORT ?? '4000', 10),
    host: process.env.HOST ?? '0.0.0.0',
  },
  database: {
    url: process.env.DATABASE_URL ?? 'sqlite:./data/codesight.db',
  },
  llm: {
    provider: process.env.LLM_PROVIDER ?? 'mock',
    apiKey: process.env.LLM_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? 'gpt-3.5-turbo',
  },
  ai: {
    // OpenRouter (Primary recommended provider)
    openRouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
    openRouterModel: process.env.OPENROUTER_MODEL ?? 'xiaomi/mimo-v2-flash:free',

    // Groq (Ultra-fast inference)
    groqApiKey: process.env.GROQ_API_KEY ?? '',
    groqModel: process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant',

    // LM Studio (Local inference)
    lmStudioBaseUrl: process.env.LMSTUDIO_BASE_URL ?? 'http://localhost:1234/v1',
    lmStudioModel: process.env.LMSTUDIO_MODEL ?? '',

    // Ollama (Local inference)
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL ?? 'codellama:7b',

    // HuggingFace (Cloud fallback)
    huggingFaceApiKey: process.env.HUGGINGFACE_API_KEY ?? '',
    huggingFaceModel: process.env.HUGGINGFACE_MODEL ?? 'microsoft/CodeGPT-small-py',

    // Llama.cpp (Local binary)
    llamaModelPath: process.env.LLAMA_MODEL_PATH ?? '',

    // General settings
    preferredProvider: process.env.PREFERRED_AI_PROVIDER ?? 'openrouter',
    enableFallback: process.env.ENABLE_AI_FALLBACK !== 'false',
    cacheEnabled: process.env.AI_CACHE_ENABLED !== 'false',
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS ?? '30000', 10),
  },
  rust: {
    libraryPath: process.env.RUST_LIBRARY_PATH ?? './rust-core/target/release',
  },
};
