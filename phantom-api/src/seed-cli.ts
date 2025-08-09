#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import api from './index';

/**
 * Main command-line interface program for managing seed data via Phantom API.
 */
const program = new Command();

program
  .name('seed')
  .description('CLI for managing seed data via Phantom API')
  .version('1.0.0');

/**
 * Defines the 'generate' command to generate new seed data files on the backend.
 */
program.command('generate')
  .description('Generates new seed data files on the backend')
  .action(async () => {
    try {
      console.log(chalk.blue('Requesting seed data generation from backend...'));
      
      // Set endpoint for the global client
      api.setEndpoint(process.env.PHANTOM_API_URL || 'http://localhost:3000');
      
      // Use the proper public API method
      const response = await api.generateSeedData();
      
      if (response.success) {
        console.log(chalk.green(response.message || 'Seed data generation successful.'));
        if (response.data && Array.isArray(response.data)) {
          console.log(chalk.cyan(`Generated ${response.data.length} seed file(s).`));
        }
      } else {
        console.log(chalk.red(response.error || 'Seed data generation failed.'));
      }
    } catch (error) {
      console.error(chalk.red('Error during seed data generation:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse(process.argv);