#!/usr/bin/env node

/**
 * CLI script for migrating from SQLite to PostgreSQL
 * Usage: tsx src/scripts/migrate-to-postgres.ts [options]
 */

import dotenv from 'dotenv';
dotenv.config();

import { program } from 'commander';
import { logger } from '../logger';
import { databaseMigration } from '../database/migration';
import path from 'path';
import { pathManager } from '../storage/path-manager';

// CLI Configuration
program
  .name('migrate-to-postgres')
  .description('Migrate Phantom API data from SQLite to PostgreSQL')
  .version('1.0.0');

program
  .option('-s, --sqlite-path <path>', 'Path to SQLite database file', pathManager.getDatabasePath())
  .option('-b, --backup', 'Create backup of SQLite database before migration', false)
  .option('-v, --validate', 'Validate migration by comparing record counts', false)
  .option('--dry-run', 'Show what would be migrated without actually doing it', false)
  .parse();

const options = program.opts();

/**
 * Main migration process
 */
async function runMigration() {
  try {
    logger.info('Starting SQLite to PostgreSQL migration');
    logger.info('Options:', options);

    // Validate PostgreSQL configuration
    const requiredEnvVars = [
      'POSTGRES_HOST',
      'POSTGRES_PORT', 
      'POSTGRES_DB',
      'POSTGRES_USER',
      'POSTGRES_PASSWORD'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      logger.error('Missing PostgreSQL environment variables:', missingVars);
      logger.error('Please set the following environment variables:');
      missingVars.forEach(varName => {
        logger.error(`  ${varName}`);
      });
      process.exit(1);
    }

    // Check if SQLite database exists
    const sqlitePath = path.resolve(options.sqlitePath);
    logger.info(`Using SQLite database: ${sqlitePath}`);

    if (options.dryRun) {
      logger.info('DRY RUN MODE - No actual migration will be performed');
      logger.info('Would migrate from:', sqlitePath);
      logger.info('Would migrate to:', {
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT,
        database: process.env.POSTGRES_DB,
        user: process.env.POSTGRES_USER
      });
      return;
    }

    // Create backup if requested
    if (options.backup) {
      logger.info('Creating SQLite backup...');
      const backupPath = await databaseMigration.createSQLiteBackup(sqlitePath);
      logger.info(`Backup created: ${backupPath}`);
    }

    // Perform migration
    logger.info('Starting migration process...');
    await databaseMigration.migrateSQLiteToPostgreSQL(sqlitePath);
    logger.info('Migration completed successfully!');

    // Validate migration if requested
    if (options.validate) {
      logger.info('Validating migration...');
      const isValid = await databaseMigration.validateMigration(sqlitePath);
      
      if (isValid) {
        logger.info('Migration validation passed ✅');
      } else {
        logger.error('Migration validation failed ❌');
        process.exit(1);
      }
    }

    logger.info('Migration process completed successfully!');
    logger.info('');
    logger.info('Next steps:');
    logger.info('1. Update your .env file to set DATABASE_TYPE=postgresql');
    logger.info('2. Restart your Phantom API application');
    logger.info('3. Verify that all data is accessible');

  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Migration interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('Migration terminated');
  process.exit(1);
});

// Run migration
runMigration();