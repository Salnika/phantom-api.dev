#!/usr/bin/env node

/**
 * Script to prepare the dist folder for npm publishing
 * Copies package.json and README.md to dist folder
 */

const fs = require('fs');
const path = require('path');

const sourceDir = __dirname + '/..';
const distDir = path.join(sourceDir, 'dist');

console.log('🚀 Preparing dist folder for npm publishing...');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  console.error('❌ Error: dist directory does not exist. Run "yarn build" first.');
  process.exit(1);
}

try {
  // Copy package.json to dist
  const packageJsonPath = path.join(sourceDir, 'package.json');
  const distPackageJsonPath = path.join(distDir, 'package.json');
  
  if (fs.existsSync(packageJsonPath)) {
    fs.copyFileSync(packageJsonPath, distPackageJsonPath);
    console.log('✅ Copied package.json to dist/');
  } else {
    console.error('❌ Error: package.json not found');
    process.exit(1);
  }

  // Copy README.md to dist
  const readmePath = path.join(sourceDir, 'README.md');
  const distReadmePath = path.join(distDir, 'README.md');
  
  if (fs.existsSync(readmePath)) {
    fs.copyFileSync(readmePath, distReadmePath);
    console.log('✅ Copied README.md to dist/');
  } else {
    console.warn('⚠️  Warning: README.md not found');
  }

  // Copy LICENSE if it exists
  const licensePath = path.join(sourceDir, 'LICENSE');
  const distLicensePath = path.join(distDir, 'LICENSE');
  
  if (fs.existsSync(licensePath)) {
    fs.copyFileSync(licensePath, distLicensePath);
    console.log('✅ Copied LICENSE to dist/');
  }

  // Update package.json paths in dist
  const distPackageJson = JSON.parse(fs.readFileSync(distPackageJsonPath, 'utf8'));
  
  // Remove scripts that are not needed in published package
  if (distPackageJson.scripts) {
    const keepScripts = ['postinstall'];
    const filteredScripts = {};
    
    Object.keys(distPackageJson.scripts).forEach(script => {
      if (keepScripts.includes(script)) {
        filteredScripts[script] = distPackageJson.scripts[script];
      }
    });
    
    if (Object.keys(filteredScripts).length > 0) {
      distPackageJson.scripts = filteredScripts;
    } else {
      delete distPackageJson.scripts;
    }
  }

  // Remove devDependencies from published package
  delete distPackageJson.devDependencies;
  
  // Remove publish config since we're publishing from dist
  delete distPackageJson.publishConfig;
  
  // Update main and types paths (remove dist/ prefix since we're in dist)
  if (distPackageJson.main && distPackageJson.main.startsWith('dist/')) {
    distPackageJson.main = distPackageJson.main.replace('dist/', './');
  }
  if (distPackageJson.types && distPackageJson.types.startsWith('dist/')) {
    distPackageJson.types = distPackageJson.types.replace('dist/', './');
  }
  
  // Update bin paths
  if (distPackageJson.bin) {
    Object.keys(distPackageJson.bin).forEach(binName => {
      if (distPackageJson.bin[binName].startsWith('dist/')) {
        distPackageJson.bin[binName] = distPackageJson.bin[binName].replace('dist/', './');
      }
    });
  }

  // Write updated package.json
  fs.writeFileSync(distPackageJsonPath, JSON.stringify(distPackageJson, null, 2) + '\n');
  console.log('✅ Updated package.json paths for publishing');

  console.log('🎉 Dist folder prepared successfully!');
  console.log('📦 Ready to publish from dist/ directory');
  
} catch (error) {
  console.error('❌ Error preparing dist folder:', error.message);
  process.exit(1);
}