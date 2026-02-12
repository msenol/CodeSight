#!/usr/bin/env node

 
 
 
 
 
/**
 * CLI for CodeSight MCP Server
 */

import { Command } from 'commander';
import { indexingService } from '../services/indexing-service.js';
// import { logger } from '../services/logger.js'; // Rule 15: Unused import reserved for future implementation
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as readline from 'readline';
import process from 'process';

// Progress indicator utilities
class ProgressIndicator {
  private total: number;
  private current: number;
  private width: number;
  private startTime: number;
  private lastUpdate: number;

  constructor(total: number, width: number = 40) {
    this.total = total;
    this.current = 0;
    this.width = width;
    this.startTime = Date.now();
    this.lastUpdate = 0;
  }

  update(current: number, message?: string): void {
    this.current = current;
    const now = Date.now();

    // Update only every 100ms to avoid flickering
    if (now - this.lastUpdate < 100) {
      return;
    }
    this.lastUpdate = now;

    // Ensure percentage is between 0 and 1 (Rule 15: proper boundary handling)
    const percentage = this.total > 0 ? Math.min(1, Math.max(0, current / this.total)) : 0;
    const filled = Math.min(this.width, Math.max(0, Math.floor(percentage * this.width)));
    const empty = Math.max(0, this.width - filled);

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percentText = `${(percentage * 100).toFixed(1)}%`;
    const elapsed = ((now - this.startTime) / 1000).toFixed(1);
    const rate = current > 0 ? (current / (now - this.startTime) * 1000).toFixed(0) : '0';

    process.stdout.write('\r' + [
      chalk.blue('[') + chalk.green(bar) + chalk.blue(']'),
      chalk.cyan(percentText),
      chalk.gray(`${current}/${this.total}`),
      chalk.yellow(`${rate}/s`),
      message ? chalk.white(message) : '',
      chalk.gray(`(${elapsed}s)`)
    ].filter(Boolean).join(' '));

    if (current >= this.total) {
      process.stdout.write('\n');
    }
  }

  increment(message?: string): void {
    this.update(this.current + 1, message);
  }

  finish(message?: string): void {
    this.update(this.total, message || 'Complete!');
  }
}

class Spinner {
  private frames: string[];
  private currentFrame: number;
  private interval: NodeJS.Timeout | null;
  private message: string;

  constructor(message: string = 'Processing...') {
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.currentFrame = 0;
    this.interval = null;
    this.message = message;
  }

  start(): void {
    this.interval = setInterval(() => {
      process.stdout.write(`\r${chalk.cyan(this.frames[this.currentFrame])} ${this.message}`);
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 100);
  }

  update(message: string): void {
    this.message = message;
  }

  stop(message?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write('\r' + (message || this.message) + '\n');
  }
}

// Enhanced error handling with actionable suggestions
class CLIErrorHandler {
  static handleError(error: unknown, context: string = 'operation'): void {
    const errorStr = error instanceof Error ? error.message : String(error);

    console.error(chalk.red(`\n❌ ${context} failed:`), errorStr);

    // Provide specific suggestions based on error patterns
    this.provideSuggestions(errorStr);

    // Exit with appropriate error code
    if (typeof process !== 'undefined') {
      process.exit(this.getErrorCode(errorStr));
    }
  }

  private static provideSuggestions(errorStr: string): void {
    const suggestions: { [key: string]: string[] } = {
      'ENOENT': [
        '💡 The specified file or directory does not exist.',
        '   Please check the path and ensure it\'s correct.',
        '   Use absolute paths or ensure you\'re in the right directory.'
      ],
      'EACCES': [
        '💡 Permission denied. You don\'t have the required permissions.',
        '   Try running with elevated permissions: sudo (Unix) or Administrator (Windows)',
        '   Check file/directory permissions: ls -la (Unix) or Get-Acl (PowerShell)'
      ],
      'EEXIST': [
        '💡 File or directory already exists.',
        '   Remove the existing item or choose a different name/path.',
        '   Use the --force flag if available to overwrite.'
      ],
      'ENOSPC': [
        '💡 No space left on device.',
        '   Free up disk space and try again.',
        '   Check available space: df -h (Unix) or Get-Volume (PowerShell)'
      ],
      'EMFILE': [
        '💡 Too many open files.',
        '   Increase the file descriptor limit: ulimit -n (Unix)',
        '   Close unused file handles in your application.'
      ],
      'ETIMEDOUT': [
        '💡 Operation timed out.',
        '   The operation took too long to complete.',
        '   Try again with a smaller dataset or check system performance.'
      ],
      'ECONNREFUSED': [
        '💡 Connection refused.',
        '   The server is not running or not accepting connections.',
        '   Check if the server is running: codesight server',
        '   Verify the server URL and port are correct.'
      ],
      'ECONNRESET': [
        '💡 Connection reset by peer.',
        '   The server closed the connection unexpectedly.',
        '   Check server logs for errors and try again.'
      ],
      '401': [
        '💡 Authentication failed.',
        '   Check your API key or JWT token.',
        '   Ensure your credentials are valid and not expired.',
        '   Run: codesight setup to configure authentication.'
      ],
      '403': [
        '💡 Access forbidden.',
        '   You don\'t have permission to access this resource.',
        '   Check your user permissions and API key scopes.',
        '   Contact your administrator if needed.'
      ],
      '404': [
        '💡 Resource not found.',
        '   The requested resource doesn\'t exist.',
        '   Verify the resource ID or path is correct.',
        '   Check if the codebase has been indexed: codesight index <path>'
      ],
      '429': [
        '💡 Too many requests.',
        '   You\'ve exceeded the rate limit.',
        '   Wait a moment and try again.',
        '   Consider upgrading your plan for higher limits.'
      ],
      '500': [
        '💡 Internal server error.',
        '   The server encountered an unexpected error.',
        '   Check server logs for more details.',
        '   Report this issue if it persists.'
      ],
      'database': [
        '💡 Database related error.',
        '   Check database connection settings in your configuration.',
        '   Ensure the database server is running and accessible.',
        '   Verify database credentials and permissions.'
      ],
      'rust': [
        '💡 Rust FFI related error.',
        '   Ensure Rust components are built: cd rust-core && cargo build --release',
        '   Check if Rust FFI is enabled in your configuration.',
        '   Try with graceful fallback enabled.'
      ],
      'typescript': [
        '💡 TypeScript compilation error.',
        '   Check TypeScript configuration and types.',
        '   Run: npm run type-check to see detailed errors.',
        '   Ensure all dependencies are installed: npm install'
      ],
      'memory': [
        '💡 Memory allocation error.',
        '   Your system may be running out of memory.',
        '   Try reducing batch size or concurrent operations.',
        '   Close other applications to free up memory.'
      ]
    };

    // Find matching suggestions
    const matchedKeys = Object.keys(suggestions).filter(key =>
      errorStr.toLowerCase().includes(key.toLowerCase())
    );

    if (matchedKeys.length > 0) {
      console.log(chalk.yellow('\n🔧 Possible solutions:'));
      const uniqueSuggestions = new Set<string>();

      matchedKeys.forEach(key => {
        suggestions[key].forEach(suggestion => uniqueSuggestions.add(suggestion));
      });

      Array.from(uniqueSuggestions).forEach(suggestion => {
        console.log(`   ${suggestion}`);
      });
    } else {
      // General suggestions
      console.log(chalk.yellow('\n🔧 General troubleshooting:'));
      console.log('   📖 Check the documentation: https://docs.codesight-mcp.com');
      console.log('   🐛 Report this issue: https://github.com/codesight-mcp/issues');
      console.log('   💬 Get help: https://github.com/codesight-mcp/discussions');
      console.log('   📧 Contact support: support@codesight-mcp.com');
    }

    // Context-specific suggestions
    this.provideContextualSuggestions(errorStr);
  }

  private static provideContextualSuggestions(errorStr: string): void {
    // Check for specific contexts in the error message
    if (errorStr.includes('indexing') || errorStr.includes('parse')) {
      console.log(chalk.cyan('\n📝 Indexing tips:'));
      console.log('   • Ensure files contain supported code (TS, JS, Python, Rust, etc.)');
      console.log('   • Check that files are not corrupted or binary files');
      console.log('   • Try excluding problematic directories: --exclude node_modules,build,dist');
      console.log('   • Use verbose mode for more details: --verbose');
    }

    if (errorStr.includes('search') || errorStr.includes('query')) {
      console.log(chalk.cyan('\n🔍 Search tips:'));
      console.log('   • Try more specific search terms');
      console.log('   • Use quotes for exact phrases: "function name"');
      console.log('   • Check if the codebase is properly indexed: codesight stats');
      console.log('   • Try different search terms related to your query');
    }

    if (errorStr.includes('configuration') || errorStr.includes('config')) {
      console.log(chalk.cyan('\n⚙️  Configuration tips:'));
      console.log('   • Run the interactive setup: codesight setup');
      console.log('   • Check environment variables: env | grep CODESIGHT');
      console.log('   • Validate configuration file syntax');
      console.log('   • Reset to defaults: rm .env && codesight setup');
    }
  }

  private static getErrorCode(errorStr: string): number {
    // Return appropriate exit codes based on error type
    if (errorStr.includes('ENOENT') || errorStr.includes('404')) {
      return 2; // File not found
    } else if (errorStr.includes('EACCES') || errorStr.includes('401') || errorStr.includes('403')) {
      return 3; // Permission/authentication error
    } else if (errorStr.includes('ECONNREFUSED') || errorStr.includes('500')) {
      return 4; // Server/connection error
    } else if (errorStr.includes('ETIMEDOUT')) {
      return 5; // Timeout error
    } else {
      return 1; // Generic error
    }
  }
}


const program = new Command();

program.name('codesight').description('CodeSight MCP Server CLI').version('0.1.0');

program
  .command('index <path>')
  .description('Index a codebase')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--no-progress', 'Disable progress indicator')
  .action(async (codebasePath: string, options: { verbose?: boolean; progress?: boolean }) => {
    if (options.verbose) {
      if (typeof process !== 'undefined') {
        process.env.LOG_LEVEL = 'debug';
      }
    }

    const absolutePath = path.isAbsolute(codebasePath)
      ? codebasePath
      : path.resolve(typeof process !== 'undefined' ? process.cwd() : '.', codebasePath);

    console.log(chalk.blue(`\n🔍 Indexing codebase: ${absolutePath}`));

    try {
      const startTime = Date.now();
      let fileCount = 0;
      let progress: ProgressIndicator | null = null;
      let spinner: Spinner | null = null;

      if (options.progress !== false) {
        // First, count files to estimate progress
        spinner = new Spinner('Scanning files...');
        spinner.start();

        try {
          const files = await scanDirectory(absolutePath);
          fileCount = files.length;
          spinner.update(`Found ${fileCount} files to index`);
          spinner.stop('Starting indexing...');
        } catch (error) {
          spinner?.stop('Scan failed');
          throw error;
        }

        // Create progress bar
        progress = new ProgressIndicator(fileCount);
      }

      // Enhanced indexing with progress tracking (if service supports it)
      let indexedCount: number;
      if (typeof indexingService.indexCodebaseWithProgress === 'function') {
        indexedCount = await indexingService.indexCodebaseWithProgress(
          absolutePath,
          (current: number, total: number, message?: string) => {
            if (progress && options.progress !== false) {
              progress.update(current, message);
            }
          }
        );
      } else {
        // Fallback to basic indexing
        indexedCount = await indexingService.indexCodebase(absolutePath);
        if (progress) {
          progress.update(indexedCount, 'Indexing files...');
        }
      }

      if (progress && options.progress !== false) {
        progress.finish(`Indexed ${indexedCount} files`);
      }

      const duration = Date.now() - startTime;
      const durationSec = (duration / 1000).toFixed(2);
      const filesPerSec = Math.round(indexedCount / (duration / 1000));

      console.log(chalk.green('\n✅ Indexing completed!'));
      console.log(chalk.blue(`   Files indexed: ${chalk.bold(indexedCount)}`));
      console.log(chalk.blue(`   Duration: ${chalk.bold(durationSec)}s`));
      console.log(chalk.blue(`   Rate: ${chalk.bold(filesPerSec)} files/sec`));

      // Show detailed stats
      const stats = indexingService.getStats();
      console.log(chalk.yellow('\n📊 Database Statistics:'));

      console.log(`   Total entities: ${chalk.bold(stats.total)}`);

      if (stats.byType && stats.byType.length > 0) {
        console.log('\n   By type:');
        stats.byType.forEach((item: Record<string, unknown>) => {
          const count = item.count as number;
          const entityType = item.entity_type as string;
          console.log(`     ${chalk.cyan(entityType.padEnd(12))}: ${chalk.bold(count)}`);
        });
      }

      if (stats.byLanguage && stats.byLanguage.length > 0) {
        console.log('\n   By language:');
        stats.byLanguage.forEach((item: Record<string, unknown>) => {
          const count = item.count as number;
          const language = item.language as string;
          console.log(`     ${chalk.magenta(language.padEnd(12))}: ${chalk.bold(count)}`);
        });
      }

    } catch (error) {
      CLIErrorHandler.handleError(error, 'Indexing');
    }
  });

program
  .command('search <query>')
  .description('Search for code entities')
  .option('-l, --limit <number>', 'Maximum number of results', '10')
  .action((query: string, options: { limit?: string }) => {

    console.log(chalk.blue(`Searching for: ${query}`));

    try {
      const limit = options.limit ? parseInt(options.limit, 10) : 10;
      const results = indexingService.searchCode(query, limit);

      if (results.length === 0) {

        console.log(chalk.yellow('No results found'));
        return;
      }


      console.log(chalk.green(`\nFound ${results.length} results:\n`));

      results.forEach((result, index: number) => {


        console.log(
          `${chalk.cyan(`${index + 1}. ${result.name}`)} (score: ${(result.score).toFixed(2)})`,
        );

        console.log(`   📄 ${result.file}:${result.line}`);

        console.log(chalk.gray(`   ${result.content}`));

        console.log();
      });
    } catch (error) {
      CLIErrorHandler.handleError(error, 'Search');
    }
  });

program
  .command('stats')
  .description('Show database statistics')
  .action(() => {
    try {
      const stats = indexingService.getStats();

      console.log(chalk.yellow('📊 Database Statistics:'));

      console.log(`   Total entities: ${stats.total}`);

      console.log('\n   By Type:');
      stats.byType.forEach((item: Record<string, unknown>) => {

        console.log(`   - ${item.entity_type}: ${item.count}`);
      });
    } catch (error) {
      CLIErrorHandler.handleError(error, 'Get stats');
    }
  });

program
  .command('server')
  .description('Start MCP server in stdio mode')
  .action(async () => {

    console.log(chalk.blue('Starting MCP server...'));

    // Import and run main server
    const { main } = await import('../index.js');
    await main();
  });

// Interactive configuration wizard
program
  .command('setup')
  .description('Interactive configuration wizard for CodeSight MCP Server')
  .action(async () => {
    console.log(chalk.blue.bold('\n🚀 Welcome to CodeSight MCP Server Setup!\n'));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const config: Record<string, any> = {};

    try {
      // Server configuration
      console.log(chalk.yellow('📡 Server Configuration'));
      console.log(chalk.gray('Configure the basic server settings\n'));

      config.port = await askQuestion(rl, 'Server port (default: 4000): ', '4000');
      config.host = await askQuestion(rl, 'Server host (default: 0.0.0.0): ', '0.0.0.0');
      config.nodeEnv = await askQuestion(rl, 'Environment (development/production, default: development): ', 'development');

      // Database configuration
      console.log(chalk.yellow('\n💾 Database Configuration'));
      console.log(chalk.gray('Choose your database backend\n'));

      const dbChoice = await askChoice(rl, 'Database type:', ['sqlite', 'postgresql'], 'sqlite');

      if (dbChoice === 'sqlite') {
        config.database = {
          type: 'sqlite',
          path: await askQuestion(rl, 'SQLite database path (default: ./data/codesight.db): ', './data/codesight.db')
        };
      } else {
        config.database = {
          type: 'postgresql',
          host: await askQuestion(rl, 'PostgreSQL host (default: localhost): ', 'localhost'),
          port: await askQuestion(rl, 'PostgreSQL port (default: 5432): ', '5432'),
          database: await askQuestion(rl, 'Database name (default: codesight): ', 'codesight'),
          username: await askQuestion(rl, 'Username: ', 'postgres'),
          password: await askQuestion(rl, 'Password: ', '', true)
        };
      }

      // Performance configuration
      console.log(chalk.yellow('\n⚡ Performance Configuration'));
      console.log(chalk.gray('Optimize performance for your use case\n'));

      config.indexing = {
        parallelWorkers: parseInt(await askQuestion(rl, 'Indexing parallel workers (default: 4): ', '4'), 10),
        batchSize: parseInt(await askQuestion(rl, 'Indexing batch size (default: 500): ', '500'), 10)
      };

      config.cache = {
        sizeMB: parseInt(await askQuestion(rl, 'Cache size in MB (default: 512): ', '512'), 10)
      };

      // Rust FFI configuration
      console.log(chalk.yellow('\n🦀 Rust FFI Configuration'));
      console.log(chalk.gray('Configure high-performance Rust components\n'));

      const enableRust = await askChoice(rl, 'Enable Rust FFI for better performance?', ['yes', 'no'], 'yes');
      config.rustFFI = {
        enabled: enableRust === 'yes',
        path: await askQuestion(rl, 'Rust library path (default: ../rust-core/target/release): ', '../rust-core/target/release'),
        gracefulFallback: await askChoice(rl, 'Enable graceful fallback if Rust FFI fails?', ['yes', 'no'], 'yes') === 'yes'
      };

      // Authentication configuration
      console.log(chalk.yellow('\n🔐 Authentication Configuration'));
      console.log(chalk.gray('Configure security settings\n'));

      const enableAuth = await askChoice(rl, 'Enable authentication?', ['yes', 'no'], 'no');

      if (enableAuth === 'yes') {
        config.auth = {
          enabled: true,
          jwtSecret: await askQuestion(rl, 'JWT secret (leave empty to auto-generate): ', '', true),
          apiKey: await askQuestion(rl, 'API key (leave empty to auto-generate): ', '', true)
        };

        // Auto-generate secrets if not provided
        if (!config.auth.jwtSecret) {
          config.auth.jwtSecret = generateRandomSecret(32);
        }
        if (!config.auth.apiKey) {
          config.auth.apiKey = generateRandomSecret(24);
        }
      } else {
        config.auth = {
          enabled: false
        };
      }

      // Logging configuration
      console.log(chalk.yellow('\n📝 Logging Configuration'));
      console.log(chalk.gray('Configure logging settings\n'));

      config.logging = {
        level: await askChoice(rl, 'Log level:', ['error', 'warn', 'info', 'debug'], 'info'),
        format: await askChoice(rl, 'Log format:', ['json', 'text'], 'text')
      };

      // Review configuration
      console.log(chalk.yellow('\n📋 Configuration Summary'));
      console.log(chalk.gray('Please review your configuration:\n'));

      displayConfig(config);

      const confirm = await askChoice(rl, 'Save this configuration?', ['yes', 'no', 'edit'], 'yes');

      if (confirm === 'edit') {
        console.log(chalk.blue('\n📝 Edit Configuration'));
        console.log(chalk.gray('Enter the property path to edit (e.g., database.port, auth.enabled)\n'));

        let editing = true;
        while (editing) {
          const propertyPath = await askQuestion(rl, 'Property to edit (or press Enter to finish): ', '');

          if (!propertyPath) {
            editing = false;
            break;
          }

          try {
            const currentValue = getNestedProperty(config, propertyPath);
            const newValue = await askQuestion(rl, `Current value: ${currentValue}\nNew value: `, '');

            if (newValue) {
              setNestedProperty(config, propertyPath, newValue);
              console.log(chalk.green(`✅ Updated ${propertyPath} = ${newValue}`));
            }
          } catch (error) {
            console.log(chalk.red(`❌ Invalid property path: ${propertyPath}`));
          }
        }

        console.log(chalk.yellow('\n📋 Updated Configuration Summary'));
        displayConfig(config);
      }

      if (confirm === 'yes' || confirm === 'edit') {
        // Save configuration
        const configPath = await askQuestion(rl, 'Configuration file path (default: .env): ', '.env');
        await saveConfiguration(config, configPath);

        console.log(chalk.green(`\n✅ Configuration saved to ${configPath}`));
        console.log(chalk.blue('\n🎉 Setup completed successfully!'));
        console.log(chalk.gray('You can now start the server with: codesight server\n'));
      } else {
        console.log(chalk.yellow('\n❌ Setup cancelled. Configuration not saved.'));
      }

    } catch (error) {
      CLIErrorHandler.handleError(error, 'Setup');
    } finally {
      rl.close();
    }
  });

// Helper functions for the interactive setup
function askQuestion(rl: readline.Interface, question: string, defaultValue: string = '', hidden: boolean = false): Promise<string> {
  return new Promise((resolve) => {
    const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;

    if (hidden) {
      // Hide input for passwords/secrets
      const stdin = process.stdin;
      stdin.setRawMode(true);

      let input = '';
      process.stdout.write(prompt);

      stdin.on('data', function(char: string) {
        char = char.toString();

        switch (char) {
          case '\n':
          case '\r':
          case '\u0004': // Ctrl+D
            stdin.setRawMode(false);
            stdin.removeAllListeners('data');
            console.log();
            resolve(input || defaultValue);
            break;
          case '\u0003': // Ctrl+C
            console.log('^C');
            process.exit(0);
            break;
          case '\u007F': // Backspace
            if (input.length > 0) {
              input = input.slice(0, -1);
              process.stdout.write('\b \b');
            }
            break;
          default:
            input += char;
            process.stdout.write('*');
        }
      });
    } else {
      rl.question(prompt, (answer) => {
        resolve(answer || defaultValue);
      });
    }
  });
}

function askChoice(rl: readline.Interface, question: string, choices: string[], defaultChoice: string = ''): Promise<string> {
  return new Promise((resolve) => {
    const choiceList = choices.map((choice, index) => {
      const marker = choice === defaultChoice ? ' (default)' : '';
      return `  ${index + 1}. ${choice}${marker}`;
    }).join('\n');

    rl.question(`${question}\n${choiceList}\nChoice (1-${choices.length}): `, (answer) => {
      const choiceIndex = parseInt(answer, 10) - 1;

      if (choiceIndex >= 0 && choiceIndex < choices.length) {
        resolve(choices[choiceIndex]);
      } else if (!answer && defaultChoice) {
        resolve(defaultChoice);
      } else {
        console.log(chalk.red('Invalid choice. Please try again.'));
        return askChoice(rl, question, choices, defaultChoice).then(resolve);
      }
    });
  });
}

function generateRandomSecret(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function displayConfig(config: Record<string, any>, indent: number = 0): void {
  const spaces = '  '.repeat(indent);

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      console.log(`${spaces}${chalk.cyan(key)}:`);
      displayConfig(value, indent + 1);
    } else {
      if (key.includes('password') || key.includes('secret') || key.includes('key')) {
        console.log(`${spaces}${chalk.cyan(key)}: ${chalk.gray('********')}`);
      } else {
        console.log(`${spaces}${chalk.cyan(key)}: ${chalk.white(value)}`);
      }
    }
  }
}

function getNestedProperty(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setNestedProperty(obj: Record<string, any>, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    return current[key];
  }, obj);

  // Try to parse as JSON or number
  try {
    if (value === 'true' || value === 'false') {
      target[lastKey] = value === 'true';
    } else if (/^\d+$/.test(value)) {
      target[lastKey] = parseInt(value, 10);
    } else if (/^\d+\.\d+$/.test(value)) {
      target[lastKey] = parseFloat(value);
    } else {
      target[lastKey] = value;
    }
  } catch {
    target[lastKey] = value;
  }
}

async function saveConfiguration(config: Record<string, any>, configPath: string): Promise<void> {
  let envContent = '# CodeSight MCP Server Configuration\n';
  envContent += '# Generated by interactive setup wizard\n\n';

  // Server configuration
  envContent += '# Server Settings\n';
  envContent += `PORT=${config.port}\n`;
  envContent += `HOST=${config.host}\n`;
  envContent += `NODE_ENV=${config.nodeEnv}\n\n`;

  // Database configuration
  envContent += '# Database Settings\n';
  if (config.database.type === 'sqlite') {
    envContent += `DATABASE_URL=sqlite://${config.database.path}\n`;
  } else {
    const pg = config.database;
    envContent += `DATABASE_URL=postgresql://${pg.username}:${pg.password}@${pg.host}:${pg.port}/${pg.database}\n`;
  }
  envContent += '\n';

  // Performance configuration
  envContent += '# Performance Settings\n';
  envContent += `INDEXING_PARALLEL_WORKERS=${config.indexing.parallelWorkers}\n`;
  envContent += `INDEXING_BATCH_SIZE=${config.indexing.batchSize}\n`;
  envContent += `CACHE_SIZE_MB=${config.cache.sizeMB}\n\n`;

  // Rust FFI configuration
  envContent += '# Rust FFI Settings\n';
  envContent += `ENABLE_RUST_FFI=${config.rustFFI.enabled}\n`;
  envContent += `RUST_FFI_PATH=${config.rustFFI.path}\n`;
  envContent += `FFI_GRACEFUL_FALLBACK=${config.rustFFI.gracefulFallback}\n\n`;

  // Authentication configuration
  envContent += '# Authentication Settings\n';
  if (config.auth.enabled) {
    envContent += `JWT_SECRET=${config.auth.jwtSecret}\n`;
    envContent += `API_KEY=${config.auth.apiKey}\n`;
  }
  envContent += '\n';

  // Logging configuration
  envContent += '# Logging Settings\n';
  envContent += `LOG_LEVEL=${config.logging.level}\n`;
  envContent += `LOG_FORMAT=${config.logging.format}\n`;

  // Ensure directory exists
  const configDir = path.dirname(configPath);
  if (configDir !== '.') {
    try {
      await fs.mkdir(configDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  // Write configuration file
  await fs.writeFile(configPath, envContent, 'utf8');

  // Create data directory if using SQLite
  if (config.database.type === 'sqlite') {
    const dbDir = path.dirname(config.database.path);
    if (dbDir !== '.') {
      try {
        await fs.mkdir(dbDir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
    }
  }
}

// Helper function to scan directory for file count
async function scanDirectory(dirPath: string, extensions: string[] = ['.ts', '.js', '.tsx', '.jsx', '.py', '.rs', '.go', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.swift', '.kt', '.scala', '.dart', '.lua']): Promise<string[]> {
  const files: string[] = [];

  async function scan(currentPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          // Skip common ignore directories
          if (!['node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'target', '.next', '.nuxt', 'coverage', '.pytest_cache', '__pycache__'].includes(entry.name)) {
            await scan(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  await scan(dirPath);
  return files;
}

program.parse();
