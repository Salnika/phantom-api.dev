#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import api from './index';

/**
 * Main command-line interface program for managing database migrations via Phantom API.
 */
const program = new Command();

program
  .name('migration')
  .description('CLI for managing database migrations via Phantom API')
  .version('1.0.0');

/**
 * Defines the 'pull' command to generate new migration files on the backend.
 */
program.command('pull')
  .description('Generates new migration files on the backend')
  .action(async () => {
    try {
      console.log(chalk.blue('Requesting migration pull from backend...'));
      
      // Set endpoint for the global client
      api.setEndpoint(process.env.PHANTOM_API_URL || 'http://localhost:3000');
      
      // Use the proper public API method
      const response = await api.pullMigrations();
      
      if (response.success) {
        console.log(chalk.green(response.message || 'Migration pull successful.'));
        if (response.data && Array.isArray(response.data)) {
          console.log(chalk.cyan(`Generated ${response.data.length} migration file(s).`));
        }
      } else {
        console.log(chalk.red(response.error || 'Migration pull failed.'));
      }
    } catch (error) {
      console.error(chalk.red('Error during migration pull:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse(process.argv);