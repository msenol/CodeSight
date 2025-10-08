import { FastifyRequest, FastifyReply } from 'fastify';
import { Logger } from '../services/logger';

const logger = new Logger('ConfigurationController');

export interface ConfigurationProfile {
  id: string;
  name: string;
  profile: 'default' | 'performance' | 'accuracy' | 'minimal';
  indexing_config: {
    parallel_workers: number;
    batch_size: number;
    include_patterns: string[];
    exclude_patterns: string[];
    language_detection: boolean;
  };
  search_config: {
    max_results: number;
    similarity_threshold: number;
    include_content: boolean;
    enable_semantic_search: boolean;
  };
  model_config: {
    embedding_model: string;
    llm_provider: 'ollama' | 'llamacpp' | 'huggingface' | 'none';
    model_parameters: Record<string, any>;
  };
  storage_config: {
    database_type: 'sqlite' | 'postgresql' | 'duckdb';
    connection_string?: string;
    cache_size_mb: number;
  };
  cache_config: {
    enable_redis: boolean;
    redis_url?: string;
    ttl_seconds: number;
  };
  privacy_config: {
    disable_telemetry: boolean;
    local_only: boolean;
    anonymize_data: boolean;
  };
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface ConfigurationResponse {
  success: boolean;
  configuration?: ConfigurationProfile;
  configurations?: ConfigurationProfile[];
  error?: string;
}

// Mock configuration storage (in production, this would be a database)
const configStore = new Map<string, ConfigurationProfile>();
const configCounter = { value: 1 };

// Initialize with default configuration
const defaultConfig: ConfigurationProfile = {
  id: 'default-config',
  name: 'Default Configuration',
  profile: 'default',
  indexing_config: {
    parallel_workers: 4,
    batch_size: 500,
    include_patterns: ['**/*.ts', '**/*.js', '**/*.py', '**/*.rs', '**/*.go', '**/*.java'],
    exclude_patterns: ['**/node_modules/**', '**/target/**', '**/dist/**', '**/.git/**'],
    language_detection: true
  },
  search_config: {
    max_results: 50,
    similarity_threshold: 0.7,
    include_content: true,
    enable_semantic_search: true
  },
  model_config: {
    embedding_model: 'all-MiniLM-L6-v2',
    llm_provider: 'ollama',
    model_parameters: {
      temperature: 0.7,
      max_tokens: 1000
    }
  },
  storage_config: {
    database_type: 'sqlite',
    cache_size_mb: 512
  },
  cache_config: {
    enable_redis: false,
    ttl_seconds: 3600
  },
  privacy_config: {
    disable_telemetry: true,
    local_only: true,
    anonymize_data: false
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_active: true
};

// Store default configuration
configStore.set(defaultConfig.id, defaultConfig);

export class ConfigurationController {
  async getConfigurations(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { profile, active_only } = request.query as {
        profile?: string;
        active_only?: string;
      };

      let configurations = Array.from(configStore.values());

      // Apply filters
      if (profile) {
        configurations = configurations.filter(config => config.profile === profile);
      }
      if (active_only === 'true') {
        configurations = configurations.filter(config => config.is_active);
      }

      const response: ConfigurationResponse = {
        success: true,
        configurations
      };

      return reply.send(response);
    } catch (error) {
      logger.error('Failed to get configurations', { error: error.message });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve configurations'
      } as ConfigurationResponse);
    }
  }

  async getConfiguration(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      if (!id) {
        return reply.status(400).send({
          success: false,
          error: 'Configuration ID is required'
        } as ConfigurationResponse);
      }

      const configuration = configStore.get(id);

      if (!configuration) {
        return reply.status(404).send({
          success: false,
          error: 'Configuration not found'
        } as ConfigurationResponse);
      }

      const response: ConfigurationResponse = {
        success: true,
        configuration
      };

      return reply.send(response);
    } catch (error) {
      logger.error('Failed to get configuration', { error: error.message });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve configuration'
      } as ConfigurationResponse);
    }
  }

  async createConfiguration(request: FastifyRequest<{ Body: Partial<ConfigurationProfile> }>, reply: FastifyReply) {
    try {
      const configData = request.body;

      if (!configData.name || !configData.profile) {
        return reply.status(400).send({
          success: false,
          error: 'Name and profile are required'
        } as ConfigurationResponse);
      }

      // Validate profile type
      const validProfiles = ['default', 'performance', 'accuracy', 'minimal'];
      if (!validProfiles.includes(configData.profile)) {
        return reply.status(400).send({
          success: false,
          error: `Invalid profile. Must be one of: ${validProfiles.join(', ')}`
        } as ConfigurationResponse);
      }

      const configId = `config-${configCounter.value++}`;
      const now = new Date().toISOString();

      const configuration: ConfigurationProfile = {
        id: configId,
        name: configData.name,
        profile: configData.profile,
        indexing_config: configData.indexing_config || defaultConfig.indexing_config,
        search_config: configData.search_config || defaultConfig.search_config,
        model_config: configData.model_config || defaultConfig.model_config,
        storage_config: configData.storage_config || defaultConfig.storage_config,
        cache_config: configData.cache_config || defaultConfig.cache_config,
        privacy_config: configData.privacy_config || defaultConfig.privacy_config,
        created_at: now,
        updated_at: now,
        is_active: false
      };

      configStore.set(configId, configuration);

      logger.info('Configuration created', { configId, name: configData.name, profile: configData.profile });

      const response: ConfigurationResponse = {
        success: true,
        configuration
      };

      return reply.status(201).send(response);
    } catch (error) {
      logger.error('Failed to create configuration', { error: error.message });
      return reply.status(500).send({
        success: false,
        error: 'Failed to create configuration'
      } as ConfigurationResponse);
    }
  }

  async updateConfiguration(request: FastifyRequest<{ Body: Partial<ConfigurationProfile> }>, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const updateData = request.body;

      if (!id) {
        return reply.status(400).send({
          success: false,
          error: 'Configuration ID is required'
        } as ConfigurationResponse);
      }

      const existingConfig = configStore.get(id);

      if (!existingConfig) {
        return reply.status(404).send({
          success: false,
          error: 'Configuration not found'
        } as ConfigurationResponse);
      }

      // Don't allow changing the default configuration ID
      if (id === 'default-config' && updateData.profile) {
        return reply.status(400).send({
          success: false,
          error: 'Cannot change profile of default configuration'
        } as ConfigurationResponse);
      }

      // Update configuration
      const updatedConfig: ConfigurationProfile = {
        ...existingConfig,
        ...updateData,
        id: existingConfig.id, // Preserve ID
        updated_at: new Date().toISOString()
      };

      configStore.set(id, updatedConfig);

      logger.info('Configuration updated', { configId: id, updatedFields: Object.keys(updateData) });

      const response: ConfigurationResponse = {
        success: true,
        configuration: updatedConfig
      };

      return reply.send(response);
    } catch (error) {
      logger.error('Failed to update configuration', { error: error.message });
      return reply.status(500).send({
        success: false,
        error: 'Failed to update configuration'
      } as ConfigurationResponse);
    }
  }

  async deleteConfiguration(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      if (!id) {
        return reply.status(400).send({
          success: false,
          error: 'Configuration ID is required'
        } as ConfigurationResponse);
      }

      const configuration = configStore.get(id);

      if (!configuration) {
        return reply.status(404).send({
          success: false,
          error: 'Configuration not found'
        } as ConfigurationResponse);
      }

      // Don't allow deleting the default configuration
      if (id === 'default-config') {
        return reply.status(400).send({
          success: false,
          error: 'Cannot delete default configuration'
        } as ConfigurationResponse);
      }

      configStore.delete(id);

      logger.info('Configuration deleted', { configId: id, name: configuration.name });

      return reply.status(204).send();
    } catch (error) {
      logger.error('Failed to delete configuration', { error: error.message });
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete configuration'
      } as ConfigurationResponse);
    }
  }

  async setActiveConfiguration(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      if (!id) {
        return reply.status(400).send({
          success: false,
          error: 'Configuration ID is required'
        } as ConfigurationResponse);
      }

      const configuration = configStore.get(id);

      if (!configuration) {
        return reply.status(404).send({
          success: false,
          error: 'Configuration not found'
        } as ConfigurationResponse);
      }

      // Deactivate all other configurations with the same profile
      for (const [configId, config] of configStore.entries()) {
        if (config.profile === configuration.profile && configId !== id) {
          config.is_active = false;
        }
      }

      // Activate the selected configuration
      configuration.is_active = true;
      configuration.updated_at = new Date().toISOString();

      logger.info('Configuration activated', {
        configId: id,
        name: configuration.name,
        profile: configuration.profile
      });

      const response: ConfigurationResponse = {
        success: true,
        configuration
      };

      return reply.send(response);
    } catch (error) {
      logger.error('Failed to activate configuration', { error: error.message });
      return reply.status(500).send({
        success: false,
        error: 'Failed to activate configuration'
      } as ConfigurationResponse);
    }
  }

  async validateConfiguration(request: FastifyRequest<{ Body: Partial<ConfigurationProfile> }>, reply: FastifyReply) {
    try {
      const configData = request.body;
      const errors: string[] = [];

      // Validate required fields
      if (!configData.name || configData.name.trim().length === 0) {
        errors.push('Name is required and cannot be empty');
      }

      if (!configData.profile) {
        errors.push('Profile is required');
      } else {
        const validProfiles = ['default', 'performance', 'accuracy', 'minimal'];
        if (!validProfiles.includes(configData.profile)) {
          errors.push(`Invalid profile. Must be one of: ${validProfiles.join(', ')}`);
        }
      }

      // Validate indexing config
      if (configData.indexing_config) {
        if (configData.indexing_config.parallel_workers && configData.indexing_config.parallel_workers < 1) {
          errors.push('parallel_workers must be at least 1');
        }
        if (configData.indexing_config.batch_size && configData.indexing_config.batch_size < 1) {
          errors.push('batch_size must be at least 1');
        }
      }

      // Validate search config
      if (configData.search_config) {
        if (configData.search_config.max_results && configData.search_config.max_results < 1) {
          errors.push('max_results must be at least 1');
        }
        if (configData.search_config.similarity_threshold &&
            (configData.search_config.similarity_threshold < 0 || configData.search_config.similarity_threshold > 1)) {
          errors.push('similarity_threshold must be between 0 and 1');
        }
      }

      // Validate storage config
      if (configData.storage_config) {
        const validDatabases = ['sqlite', 'postgresql', 'duckdb'];
        if (configData.storage_config.database_type && !validDatabases.includes(configData.storage_config.database_type)) {
          errors.push(`Invalid database_type. Must be one of: ${validDatabases.join(', ')}`);
        }
        if (configData.storage_config.cache_size_mb && configData.storage_config.cache_size_mb < 1) {
          errors.push('cache_size_mb must be at least 1');
        }
      }

      const response = {
        valid: errors.length === 0,
        errors,
        metadata: {
          fields_validated: Object.keys(configData).length,
          errors_count: errors.length
        }
      };

      return reply.send(response);
    } catch (error) {
      logger.error('Configuration validation failed', { error: error.message });
      return reply.status(500).send({
        valid: false,
        errors: ['Validation failed due to internal error']
      });
    }
  }
}

// Factory function for dependency injection
export function createConfigurationController(): ConfigurationController {
  return new ConfigurationController();
}