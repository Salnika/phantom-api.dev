#!/usr/bin/env node

/**
 * Documentation Generation Script
 * 
 * This script generates comprehensive documentation for the Phantom API monorepo:
 * 1. Generates TypeDoc documentation for phantom-api and phantom-api-backend packages
 * 2. Moves generated docs to public-doc structure
 * 3. Builds the final MkDocs site with all documentation
 * 
 * Usage: yarn run docs:generate
 */

const { execSync } = require('child_process');
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

function logStep(step, message) {
  log(`\n[${step}] ${message}`, chalk.bold.cyan);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function executeCommand(command, cwd = process.cwd(), options = {}) {
  try {
    log(`Executing: ${command}`, 'blue');
    const result = execSync(command, { 
      cwd, 
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf-8',
      ...options
    });
    return result;
  } catch (error) {
    logError(`Command failed: ${command}`);
    logError(`Error: ${error.message}`);
    if (!options.continueOnError) {
      process.exit(1);
    }
    return null;
  }
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    log(`Created directory: ${dirPath}`, 'green');
  }
}

function removeDirectoryIfExists(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    log(`Removed directory: ${dirPath}`, 'yellow');
  }
}

function copyDirectory(src, dest) {
  try {
    removeDirectoryIfExists(dest);
    ensureDirectoryExists(path.dirname(dest));
    
    // Use cp command for better cross-platform compatibility
    executeCommand(`cp -r "${src}" "${dest}"`, process.cwd(), { silent: true });
    log(`Copied ${src} → ${dest}`, 'green');
  } catch (error) {
    logWarning(`Failed to copy ${src} to ${dest}: ${error.message}`);
  }
}

function checkPrerequisites() {
  logStep('1', 'Checking prerequisites...');
  
  // Check if required packages are available
  const requiredCommands = ['typedoc', 'mkdocs'];
  
  for (const cmd of requiredCommands) {
    try {
      executeCommand(`which ${cmd}`, process.cwd(), { silent: true });
      logSuccess(`${cmd} is available`);
    } catch (error) {
      logError(`${cmd} is not available. Please install it first.`);
      if (cmd === 'typedoc') {
        log('Install with: yarn add -D typedoc', 'blue');
      } else if (cmd === 'mkdocs') {
        log('Install with: pip install mkdocs mkdocs-material', 'blue');
      } else {
        logError(`Unknown error: ${error.message}`);
      }
      process.exit(1);
    }
  }
  
  // Check if workspace directories exist
  const workspaceDirs = ['phantom-api', 'phantom-api-backend', 'public-doc'];
  
  for (const dir of workspaceDirs) {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      logError(`Workspace directory ${dir} not found`);
      process.exit(1);
    }
    logSuccess(`Found workspace: ${dir}`);
  }
}

function generateTypeDocForPackage(packageName) {
  logStep('2', `Generating TypeDoc documentation for ${packageName}...`);
  
  const packagePath = path.join(process.cwd(), packageName);
  const typedocConfigPath = path.join(packagePath, 'typedoc.json');
  
  if (!fs.existsSync(typedocConfigPath)) {
    logWarning(`No typedoc.json found for ${packageName}, skipping...`);
    return false;
  }
  
  // Clean existing docs directory
  const docsPath = path.join(packagePath, 'docs');
  removeDirectoryIfExists(docsPath);
  
  // Generate TypeDoc documentation
  executeCommand('yarn typedoc', packagePath);
  
  // Verify documentation was generated
  if (fs.existsSync(docsPath)) {
    logSuccess(`TypeDoc documentation generated for ${packageName}`);
    return true;
  } else {
    logWarning(`TypeDoc documentation not found after generation for ${packageName}`);
    return false;
  }
}

function moveDocsToPublicDoc() {
  logStep('3', 'Moving generated documentation to public-doc...');
  
  const publicDocPath = path.join(process.cwd(), 'public-doc');
  const apiReferencePath = path.join(publicDocPath, 'docs', 'api-reference');
  
  // Ensure api-reference directory exists
  ensureDirectoryExists(apiReferencePath);
  
  // Move phantom-api docs
  const phantomApiDocsPath = path.join(process.cwd(), 'phantom-api', 'docs', 'phantom-api');
  if (fs.existsSync(phantomApiDocsPath)) {
    const destPath = path.join(apiReferencePath, 'client-package');
    copyDirectory(phantomApiDocsPath, destPath);
    logSuccess('Moved phantom-api documentation');
  } else {
    logWarning('phantom-api documentation not found');
  }
  
  // Move phantom-api-backend docs
  const phantomBackendDocsPath = path.join(process.cwd(), 'phantom-api-backend', 'docs', 'phantom-api-backend');
  if (fs.existsSync(phantomBackendDocsPath)) {
    const destPath = path.join(apiReferencePath, 'backend-api');
    copyDirectory(phantomBackendDocsPath, destPath);
    logSuccess('Moved phantom-api-backend documentation');
  } else {
    logWarning('phantom-api-backend documentation not found');
  }
}

function buildMkDocs() {
  logStep('5', 'Building MkDocs site...');
  
  const publicDocPath = path.join(process.cwd(), 'public-doc');
  
  // Clean previous build
  const sitePath = path.join(publicDocPath, 'site');
  removeDirectoryIfExists(sitePath);
  
  // Build MkDocs site
  executeCommand('mkdocs build', publicDocPath);
  
  if (fs.existsSync(sitePath)) {
    logSuccess('MkDocs site built successfully');
  } else {
    logError('MkDocs site build failed');
  }
}

function generateSummaryReport() {
  logStep('6', 'Generating summary report...');
  
  const report = {
    timestamp: new Date().toISOString(),
    packages: {},
    mkdocs: false
  };
  
  // Check phantom-api docs
  const phantomApiDocs = path.join(process.cwd(), 'public-doc', 'docs', 'api-reference', 'client-package');
  report.packages['phantom-api'] = fs.existsSync(phantomApiDocs);
  
  // Check phantom-api-backend docs
  const phantomBackendDocs = path.join(process.cwd(), 'public-doc', 'docs', 'api-reference', 'backend-api');
  report.packages['phantom-api-backend'] = fs.existsSync(phantomBackendDocs);
  
  // Check MkDocs site
  const sitePath = path.join(process.cwd(), 'public-doc', 'site');
  report.mkdocs = fs.existsSync(sitePath);
  
  // Display report
  log('\n' + '='.repeat(50), chalk.cyan);
  log('DOCUMENTATION GENERATION REPORT', chalk.bold);
  log('='.repeat(50), chalk.cyan);
  
  log(`📅 Generated at: ${report.timestamp}`, chalk.blue);
  log('\n📦 Package Documentation:', chalk.blue);
  
  for (const [pkg, success] of Object.entries(report.packages)) {
    const status = success ? '✅' : '❌';
    const color = success ? chalk.green : chalk.red;
    log(`   ${status} ${pkg}`, color);
  }
  
  log('\n🌐 MkDocs Site:', chalk.blue);
  const mkdocsStatus = report.mkdocs ? '✅' : '❌';
  const mkdocsColor = report.mkdocs ? chalk.green : chalk.red;
  log(`   ${mkdocsStatus} Site build`, mkdocsColor);
  
  if (report.mkdocs) {
    const siteUrl = 'http://localhost:8000';
    log(`\n🚀 Documentation ready!`, chalk.green);
    log(`   Run: yarn docs:serve`, chalk.blue);
    log(`   Open: ${siteUrl}`, chalk.blue);
  }
  
  log('\n' + '='.repeat(50), chalk.cyan);
  
  return report;
}

async function main() {
  log('\n🚀 Starting documentation generation...', chalk.bold);
  
  try {
    // Step 1: Check prerequisites
    checkPrerequisites();
    
    // Step 2: Generate TypeDoc for each package
    const packages = ['phantom-api', 'phantom-api-backend'];
    const generatedPackages = [];
    
    for (const pkg of packages) {
      if (generateTypeDocForPackage(pkg)) {
        generatedPackages.push(pkg);
      }
    }
    
    if (generatedPackages.length === 0) {
      logWarning('No TypeDoc documentation was generated');
    }
    
    // Step 3: Move docs to public-doc
    moveDocsToPublicDoc();
    
    
    // Step 4: Build MkDocs site
    buildMkDocs();
    
    // Step 5: Generate summary report
    const report = generateSummaryReport();
    
    // Exit with appropriate code
    const allSuccessful = Object.values(report.packages).every(Boolean) && report.mkdocs;
    process.exit(allSuccessful ? 0 : 1);
    
  } catch (error) {
    logError(`Documentation generation failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  generateTypeDocForPackage,
  moveDocsToPublicDoc,
  buildMkDocs,
  generateSummaryReport
};