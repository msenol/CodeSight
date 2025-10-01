/**
 * Shared Environment Configuration Utility
 *
 * This module provides a unified way to access environment variables
 * across all components of the CodeSight project.
 *
 * Generated: 2025-01-27
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables based on NODE_ENV
function loadEnvironment() {
  const nodeEnv = process.env.NODE_ENV || 'development';

  const envFiles = [`.env.${nodeEnv}.local`, `.env.${nodeEnv}`, '.env.local', '.env'];

  // Load from the current directory first
  for (const file of envFiles) {
    if (fs.existsSync(file)) {
      dotenv.config({ path: file });
      break;
    }
  }

  // Also load from project root if in subdirectory
  const projectRoot = process.cwd();
  while (projectRoot !== path.parse(projectRoot).root) {
    const rootEnvFile = path.join(projectRoot, '.env');
    if (fs.existsSync(rootEnvFile)) {
      dotenv.config({ path: rootEnvFile });
      break;
    }
    // Go up one directory
    const parentDir = path.dirname(projectRoot);
    if (parentDir === projectRoot) {
      break;
    }
    process.chdir(parentDir);
  }
}

// Load environment variables
loadEnvironment();

/**
 * Environment configuration interface
 */
export interface EnvConfig {
  // Application
  nodeEnv: string;
  appName: string;
  appVersion: string;
  port: number;
  host: string;
  apiPrefix: string;

  // Database
  databaseUrl: string;
  postgresHost: string;
  postgresPort: number;
  postgresUser: string;
  postgresPassword: string;
  postgresDb: string;
  dbPoolMin: number;
  dbPoolMax: number;
  dbConnectionTimeout: number;

  // Redis
  redisUrl: string;
  redisHost: string;
  redisPort: number;
  redisPassword: string;
  redisDb: number;

  // MCP Server
  mcpPort: number;
  mcpHost: string;
  mcpEnableLogging: boolean;
  mcpLogLevel: string;
  mcpEnableSearch: boolean;
  mcpEnableIndexing: boolean;
  mcpEnableAnalysis: boolean;
  mcpMaxResults: number;
  mcpSearchTimeout: number;

  // Rust FFI
  enableRustFfi: boolean;
  rustFfiPath: string;
  ffiGracefulFallback: boolean;
  napiModulePath: string;
  napiDebug: boolean;

  // API Server
  apiPort: number;
  apiHost: string;
  apiEnableCors: boolean;
  apiEnableRateLimit: boolean;
  apiRateLimitRequests: number;
  apiRateLimitWindow: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;

  // Frontend
  frontendPort: number;
  frontendHost: string;
  viteApiBaseUrl: string;
  viteMcpBaseUrl: string;
  viteEnableDevTools: boolean;

  // Logging
  logLevel: string;
  logFormat: string;
  logFile: string;
  logMaxSize: string;
  logMaxFiles: number;

  // Monitoring
  enableMetrics: boolean;
  metricsPort: number;
  metricsPath: string;
  healthCheckPath: string;
  healthCheckInterval: number;

  // Security
  corsOrigin: string;
  corsMethods: string;
  corsHeaders: string;
  rateLimitEnabled: boolean;
  rateLimitWindow: number;
  rateLimitMaxRequests: number;
  helmetEnabled: boolean;
  xssProtection: boolean;
  contentSecurityPolicy: boolean;

  // Directories
  dataDir: string;
  cacheDir: string;
  logsDir: string;
  uploadsDir: string;
  tempDir: string;
  rustTargetDir: string;
  rustReleaseDir: string;

  // Development
  devMode: boolean;
  devHotReload: boolean;
  devSourceMaps: boolean;
  devVerboseLogging: boolean;
  testMode: boolean;
  testDatabaseUrl: string;
  testRedisUrl: string;

  // Performance
  enableCache: boolean;
  cacheTtl: number;
  cacheMaxSize: number;
  enableCompression: boolean;
  compressionLevel: number;
  indexingBatchSize: number;
  indexingMaxConcurrent: number;
  indexingTimeout: number;
  searchMaxResults: number;
  searchTimeout: number;
  searchEnableFuzzy: boolean;
  searchFuzzyThreshold: number;

  // External Services
  openaiApiKey: string;
  githubToken: string;
  dockerRegistryToken: string;

  // Docker
  dockerEnvironment: string;
  dockerComposeProject: string;
  dockerNetwork: string;
  dockerExternalNetwork: string;

  // CI/CD
  ci: boolean;
  cd: boolean;
  githubActions: boolean;
  buildNumber: string;
  buildCommit: string;

  // Feature Flags
  enableTelemetry: boolean;
  enableAnalytics: boolean;
  enableErrorReporting: boolean;
  enableAutoUpdates: boolean;
  enableBetaFeatures: boolean;
}

/**
 * Helper function to get environment variable with fallback
 */
function getEnv<T extends string | number | boolean>(key: string, defaultValue: T): T {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }

  // Type conversion based on default value type
  if (typeof defaultValue === 'boolean') {
    const boolValue = value.toLowerCase() === 'true' || value === '1';
    return boolValue as T;
  }
  if (typeof defaultValue === 'number') {
    const numValue = parseInt(value, 10);
    return (isNaN(numValue) ? defaultValue : numValue) as T;
  }

  return value as T;
}

/**
 * Load and validate environment configuration
 */
export function loadConfig(): EnvConfig {
  const config: EnvConfig = {
    // Application
    nodeEnv: getEnv('NODE_ENV', 'development'),
    appName: getEnv('APP_NAME', 'codesight'),
    appVersion: getEnv('APP_VERSION', '0.1.0'),
    port: getEnv('PORT', 4000),
    host: getEnv('HOST', 'localhost'),
    apiPrefix: getEnv('API_PREFIX', '/api'),

    // Database
    databaseUrl: getEnv('DATABASE_URL', 'sqlite://./data/code_intelligence.db'),
    postgresHost: getEnv('POSTGRES_HOST', 'localhost'),
    postgresPort: getEnv('POSTGRES_PORT', 5432),
    postgresUser: getEnv('POSTGRES_USER', 'postgres'),
    postgresPassword: getEnv('POSTGRES_PASSWORD', 'password'),
    postgresDb: getEnv('POSTGRES_DB', 'code_intelligence'),
    dbPoolMin: getEnv('DB_POOL_MIN', 2),
    dbPoolMax: getEnv('DB_POOL_MAX', 10),
    dbConnectionTimeout: getEnv('DB_CONNECTION_TIMEOUT', 30000),

    // Redis
    redisUrl: getEnv('REDIS_URL', 'redis://localhost:6379'),
    redisHost: getEnv('REDIS_HOST', 'localhost'),
    redisPort: getEnv('REDIS_PORT', 6379),
    redisPassword: getEnv('REDIS_PASSWORD', ''),
    redisDb: getEnv('REDIS_DB', 0),

    // MCP Server
    mcpPort: getEnv('MCP_PORT', 3001),
    mcpHost: getEnv('MCP_HOST', 'localhost'),
    mcpEnableLogging: getEnv('MCP_ENABLE_LOGGING', true),
    mcpLogLevel: getEnv('MCP_LOG_LEVEL', 'info'),
    mcpEnableSearch: getEnv('MCP_ENABLE_SEARCH', true),
    mcpEnableIndexing: getEnv('MCP_ENABLE_INDEXING', true),
    mcpEnableAnalysis: getEnv('MCP_ENABLE_ANALYSIS', true),
    mcpMaxResults: getEnv('MCP_MAX_RESULTS', 100),
    mcpSearchTimeout: getEnv('MCP_SEARCH_TIMEOUT', 5000),

    // Rust FFI
    enableRustFfi: getEnv('ENABLE_RUST_FFI', true),
    rustFfiPath: getEnv('RUST_FFI_PATH', '../rust-core/target/release'),
    ffiGracefulFallback: getEnv('FFI_GRACEFUL_FALLBACK', true),
    napiModulePath: getEnv('NAPI_MODULE_PATH', './codesight-native.node'),
    napiDebug: getEnv('NAPI_DEBUG', false),

    // API Server
    apiPort: getEnv('API_PORT', 4001),
    apiHost: getEnv('API_HOST', 'localhost'),
    apiEnableCors: getEnv('API_ENABLE_CORS', true),
    apiEnableRateLimit: getEnv('API_ENABLE_RATE_LIMIT', true),
    apiRateLimitRequests: getEnv('API_RATE_LIMIT_REQUESTS', 100),
    apiRateLimitWindow: getEnv('API_RATE_LIMIT_WINDOW', 60000),
    jwtSecret: getEnv('JWT_SECRET', 'your-super-secret-jwt-key'),
    jwtExpiresIn: getEnv('JWT_EXPIRES_IN', '7d'),
    jwtRefreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '30d'),

    // Frontend
    frontendPort: getEnv('FRONTEND_PORT', 3000),
    frontendHost: getEnv('FRONTEND_HOST', 'localhost'),
    viteApiBaseUrl: getEnv('VITE_API_BASE_URL', 'http://localhost:4000'),
    viteMcpBaseUrl: getEnv('VITE_MCP_BASE_URL', 'http://localhost:3001'),
    viteEnableDevTools: getEnv('VITE_ENABLE_DEV_TOOLS', true),

    // Logging
    logLevel: getEnv('LOG_LEVEL', 'info'),
    logFormat: getEnv('LOG_FORMAT', 'json'),
    logFile: getEnv('LOG_FILE', './logs/app.log'),
    logMaxSize: getEnv('LOG_MAX_SIZE', '10MB'),
    logMaxFiles: getEnv('LOG_MAX_FILES', 5),

    // Monitoring
    enableMetrics: getEnv('ENABLE_METRICS', true),
    metricsPort: getEnv('METRICS_PORT', 9090),
    metricsPath: getEnv('METRICS_PATH', '/metrics'),
    healthCheckPath: getEnv('HEALTH_CHECK_PATH', '/health'),
    healthCheckInterval: getEnv('HEALTH_CHECK_INTERVAL', 30000),

    // Security
    corsOrigin: getEnv('CORS_ORIGIN', 'http://localhost:3000'),
    corsMethods: getEnv('CORS_METHODS', 'GET,POST,PUT,DELETE,OPTIONS'),
    corsHeaders: getEnv('CORS_HEADERS', 'Content-Type,Authorization'),
    rateLimitEnabled: getEnv('RATE_LIMIT_ENABLED', true),
    rateLimitWindow: getEnv('RATE_LIMIT_WINDOW', 900000),
    rateLimitMaxRequests: getEnv('RATE_LIMIT_MAX_REQUESTS', 100),
    helmetEnabled: getEnv('HELMET_ENABLED', true),
    xssProtection: getEnv('XSS_PROTECTION', true),
    contentSecurityPolicy: getEnv('CONTENT_SECURITY_POLICY', true),

    // Directories
    dataDir: getEnv('DATA_DIR', './data'),
    cacheDir: getEnv('CACHE_DIR', './cache'),
    logsDir: getEnv('LOGS_DIR', './logs'),
    uploadsDir: getEnv('UPLOADS_DIR', './uploads'),
    tempDir: getEnv('TEMP_DIR', './temp'),
    rustTargetDir: getEnv('RUST_TARGET_DIR', '../rust-core/target'),
    rustReleaseDir: getEnv('RUST_RELEASE_DIR', '../rust-core/target/release'),

    // Development
    devMode: getEnv('DEV_MODE', false),
    devHotReload: getEnv('DEV_HOT_RELOAD', true),
    devSourceMaps: getEnv('DEV_SOURCE_MAPS', true),
    devVerboseLogging: getEnv('DEV_VERBOSE_LOGGING', false),
    testMode: getEnv('TEST_MODE', false),
    testDatabaseUrl: getEnv('TEST_DATABASE_URL', 'sqlite://./data/test_code_intelligence.db'),
    testRedisUrl: getEnv('TEST_REDIS_URL', 'redis://localhost:6379/1'),

    // Performance
    enableCache: getEnv('ENABLE_CACHE', true),
    cacheTtl: getEnv('CACHE_TTL', 3600),
    cacheMaxSize: getEnv('CACHE_MAX_SIZE', 1000),
    enableCompression: getEnv('ENABLE_COMPRESSION', true),
    compressionLevel: getEnv('COMPRESSION_LEVEL', 6),
    indexingBatchSize: getEnv('INDEXING_BATCH_SIZE', 100),
    indexingMaxConcurrent: getEnv('INDEXING_MAX_CONCURRENT', 4),
    indexingTimeout: getEnv('INDEXING_TIMEOUT', 30000),
    searchMaxResults: getEnv('SEARCH_MAX_RESULTS', 100),
    searchTimeout: getEnv('SEARCH_TIMEOUT', 5000),
    searchEnableFuzzy: getEnv('SEARCH_ENABLE_FUZZY', true),
    searchFuzzyThreshold: getEnv('SEARCH_FUZZY_THRESHOLD', 0.6),

    // External Services
    openaiApiKey: getEnv('OPENAI_API_KEY', ''),
    githubToken: getEnv('GITHUB_TOKEN', ''),
    dockerRegistryToken: getEnv('DOCKER_REGISTRY_TOKEN', ''),

    // Docker
    dockerEnvironment: getEnv('DOCKER_ENVIRONMENT', 'development'),
    dockerComposeProject: getEnv('DOCKER_COMPOSE_PROJECT', 'codesight'),
    dockerNetwork: getEnv('DOCKER_NETWORK', 'codesight-network'),
    dockerExternalNetwork: getEnv('DOCKER_EXTERNAL_NETWORK', 'host'),

    // CI/CD
    ci: getEnv('CI', false),
    cd: getEnv('CD', false),
    githubActions: getEnv('GITHUB_ACTIONS', false),
    buildNumber: getEnv('BUILD_NUMBER', 'local'),
    buildCommit: getEnv('BUILD_COMMIT', 'local'),

    // Feature Flags
    enableTelemetry: getEnv('ENABLE_TELEMETRY', false),
    enableAnalytics: getEnv('ENABLE_ANALYTICS', false),
    enableErrorReporting: getEnv('ENABLE_ERROR_REPORTING', false),
    enableAutoUpdates: getEnv('ENABLE_AUTO_UPDATES', false),
    enableBetaFeatures: getEnv('ENABLE_BETA_FEATURES', false),
  };

  // Validate critical configuration
  validateConfig(config);

  return config;
}

/**
 * Validate critical configuration values
 */
function validateConfig(config: EnvConfig): void {
  const errors: string[] = [];

  // Check required configuration based on environment
  if (config.nodeEnv === 'production') {
    if (!config.jwtSecret || config.jwtSecret === 'your-super-secret-jwt-key') {
      errors.push('JWT_SECRET must be set in production');
    }

    if (config.databaseUrl.includes('localhost')) {
      errors.push('DATABASE_URL should not use localhost in production');
    }
  }

  // Check port conflicts
  const ports = [config.port, config.mcpPort, config.apiPort, config.frontendPort];
  const uniquePorts = new Set(ports);
  if (uniquePorts.size !== ports.length) {
    errors.push('Port conflicts detected - ensure all services use different ports');
  }

  // Check critical directories
  const requiredDirs = [config.dataDir, config.cacheDir, config.logsDir];
  for (const dir of requiredDirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (error) {
      errors.push(`Cannot create directory: ${dir} - ${error}`);
    }
  }

  if (errors.length > 0) {
    // eslint-disable-next-line no-console
    console.error('Configuration validation failed:');
    errors.forEach(error => {
      // eslint-disable-next-line no-console
      console.error(`  - ${error}`);
    });
    throw new Error('Invalid configuration');
  }
}

/**
 * Create environment-specific configuration
 */
export function createEnvironmentConfig(
  env: string = process.env.NODE_ENV || 'development',
): EnvConfig {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = env;

  try {
    return loadConfig();
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
}

// Default configuration export
export const config = loadConfig();

// Export utilities
export { getEnv };
export default config;
