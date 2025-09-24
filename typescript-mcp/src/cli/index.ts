#!/usr/bin/env node

/**
 * CLI for Code Intelligence MCP Server
 */

import { Command } from 'commander';
import { indexingService } from '../services/indexing-service.js';
import { logger } from '../services/logger.js';
import chalk from 'chalk';
import * as path from 'path';

const program = new Command();

program
  .name('code-intelligence')
  .description('Code Intelligence MCP Server CLI')
  .version('0.1.0');

program
  .command('index <path>')
  .description('Index a codebase')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (codebasePath: string, options: any) => {
    if (options.verbose) {
      process.env.LOG_LEVEL = 'debug';
    }

    const absolutePath = path.isAbsolute(codebasePath)
      ? codebasePath
      : path.resolve(process.cwd(), codebasePath);

    console.log(chalk.blue(`Indexing codebase: ${absolutePath}`));

    try {
      const startTime = Date.now();
      const fileCount = await indexingService.indexCodebase(absolutePath);
      const duration = Date.now() - startTime;

      console.log(chalk.green(`✅ Indexed ${fileCount} files in ${duration}ms`));

      // Show stats
      const stats = indexingService.getStats();
      console.log(chalk.yellow('\n📊 Statistics:'));
      console.log(`   Total entities: ${stats.total}`);
      stats.byType.forEach((item: any) => {
        console.log(`   ${item.entity_type}: ${item.count}`);
      });
    } catch (error) {
      console.error(chalk.red('❌ Indexing failed:'), error);
      process.exit(1);
    }
  });

program
  .command('search <query>')
  .description('Search for code entities')
  .option('-l, --limit <number>', 'Maximum number of results', '10')
  .action((query: string, options: any) => {
    console.log(chalk.blue(`Searching for: ${query}`));

    try {
      const results = indexingService.searchCode(query, parseInt(options.limit));

      if (results.length === 0) {
        console.log(chalk.yellow('No results found'));
        return;
      }

      console.log(chalk.green(`\nFound ${results.length} results:\n`));

      results.forEach((result: any, index: number) => {
        console.log(chalk.cyan(`${index + 1}. ${result.name}`) + ` (score: ${result.score.toFixed(2)})`);
        console.log(`   📄 ${result.file}:${result.line}`);
        console.log(chalk.gray(`   ${result.content}`));
        console.log();
      });
    } catch (error) {
      console.error(chalk.red('❌ Search failed:'), error);
      process.exit(1);
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
      stats.byType.forEach((item: any) => {
        console.log(`   - ${item.entity_type}: ${item.count}`);
      });
    } catch (error) {
      console.error(chalk.red('❌ Failed to get stats:'), error);
      process.exit(1);
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

program.parse();