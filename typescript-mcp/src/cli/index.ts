#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/**
 * CLI for CodeSight MCP Server
 */

import { Command } from 'commander';
import { indexingService } from '../services/indexing-service.js';
// import { logger } from '../services/logger.js'; // Rule 15: Unused import reserved for future implementation
import chalk from 'chalk';
import * as path from 'path';

// Node.js global declarations
declare const process: {
  env: Record<string, string | undefined>;
  cwd: () => string;
  exit: () => never;
};


declare const console: {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

const program = new Command();

program.name('codesight').description('CodeSight MCP Server CLI').version('0.1.0');

program
  .command('index <path>')
  .description('Index a codebase')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (codebasePath: string, options: { verbose?: boolean }) => {
    if (options.verbose) {
      if (typeof process !== 'undefined') {
        process.env.LOG_LEVEL = 'debug';
      }
    }

    const absolutePath = path.isAbsolute(codebasePath)
      ? codebasePath
      : path.resolve(typeof process !== 'undefined' ? process.cwd() : '.', codebasePath);


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
      stats.byType.forEach((item: Record<string, unknown>) => {

        console.log(`   ${item.entity_type}: ${item.count}`);
      });
    } catch (error) {

      console.error(chalk.red('❌ Indexing failed:'), error);
      if (typeof process !== 'undefined') {
        process.exit();
      }
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

      results.forEach((result: Record<string, unknown>, index: number) => {


        console.log(
          `${chalk.cyan(`${index + 1}. ${result.name}`)} (score: ${(result.score as number).toFixed(2)})`,
        );

        console.log(`   📄 ${result.file}:${result.line}`);

        console.log(chalk.gray(`   ${result.content}`));

        console.log();
      });
    } catch (error) {

      console.error(chalk.red('❌ Search failed:'), error);
      if (typeof process !== 'undefined') {
        process.exit();
      }
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

      console.error(chalk.red('❌ Failed to get stats:'), error);
      if (typeof process !== 'undefined') {
        process.exit();
      }
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
