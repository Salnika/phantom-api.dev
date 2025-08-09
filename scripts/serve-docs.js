#!/usr/bin/env node

/**
 * Documentation Server Script
 * 
 * This script serves the generated documentation with MkDocs
 * and provides helpful information about accessing the docs.
 * 
 * Usage: yarn run docs:serve
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

function log(message, style = 'white') {
  if (typeof style === 'string') {
    console.log(chalk[style](message));
  } else {
    console.log(style(message));
  }
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function checkDocumentationExists() {
  const publicDocPath = path.join(process.cwd(), 'public-doc');
  const sitePath = path.join(publicDocPath, 'site');
  
  if (!fs.existsSync(sitePath)) {
    logError('Documentation site not found!');
    log('Please run: yarn docs:generate', 'yellow');
    return false;
  }
  
  // Check if API reference exists
  const apiRefPath = path.join(publicDocPath, 'docs', 'api-reference');
  if (!fs.existsSync(apiRefPath)) {
    log('⚠️  API Reference documentation not found', 'yellow');
    log('   Run: yarn docs:generate to generate API docs', 'blue');
  }
  
  return true;
}

function displayWelcomeMessage() {
  log('\n' + '='.repeat(60), chalk.cyan);
  log('📚 PHANTOM API DOCUMENTATION SERVER', chalk.bold);
  log('='.repeat(60), chalk.cyan);
  
  log('\n🌐 Server Information:', chalk.blue);
  log('   URL: http://localhost:8000', chalk.green);
  log('   Press Ctrl+C to stop the server', chalk.yellow);
  
  log('\n📖 Available Documentation:', chalk.blue);
  log('   • Getting Started Guide', chalk.green);
  log('   • API Documentation', chalk.green);
  log('   • API Reference (TypeDoc)', chalk.green);
  log('   • Admin Tools Guide', chalk.green);
  log('   • Examples & Tutorials', chalk.green);
  
  log('\n🔧 Useful Commands:', chalk.blue);
  log('   • yarn docs:generate - Regenerate documentation', chalk.cyan);
  log('   • yarn docs:serve - Start documentation server', chalk.cyan);
  
  log('\n' + '='.repeat(60), chalk.cyan);
  log('\n🚀 Starting MkDocs server...', chalk.bold);
}

function serveDocs() {
  const publicDocPath = path.join(process.cwd(), 'public-doc');
  
  // Start MkDocs serve
  const mkdocsProcess = spawn('mkdocs', ['serve'], {
    cwd: publicDocPath,
    stdio: 'inherit'
  });
  
  mkdocsProcess.on('error', (error) => {
    logError(`Failed to start MkDocs server: ${error.message}`);
    log('Make sure MkDocs is installed: pip install mkdocs mkdocs-material', 'blue');
    process.exit(1);
  });
  
  mkdocsProcess.on('close', (code) => {
    if (code === 0) {
      logSuccess('Documentation server stopped');
    } else {
      logError(`Documentation server exited with code ${code}`);
    }
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    log('\n\n👋 Stopping documentation server...', 'yellow');
    mkdocsProcess.kill();
    process.exit(0);
  });
}

function main() {
  // Display welcome message
  displayWelcomeMessage();
  
  // Check if documentation exists
  if (!checkDocumentationExists()) {
    process.exit(1);
  }
  
  // Start serving documentation
  serveDocs();
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  checkDocumentationExists,
  serveDocs
};