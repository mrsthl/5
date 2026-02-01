#!/usr/bin/env node

/**
 * Build script for bundling hooks using esbuild
 * Runs during npm prepublishOnly to create distributable hook files
 */

const fs = require('fs');
const path = require('path');

// Simple bundler - just copy the file for now
// In a real implementation, you might use esbuild or rollup for bundling

const srcDir = path.join(__dirname, '..', 'src', 'hooks');
const destDir = path.join(__dirname, '..', 'src', 'hooks');

console.log('Building hooks...');

// Check if hooks directory exists
if (!fs.existsSync(srcDir)) {
  console.log('No hooks directory found, skipping build');
  process.exit(0);
}

// Get all .js files in hooks directory
const hookFiles = fs.readdirSync(srcDir)
  .filter(file => file.endsWith('.js'));

if (hookFiles.length === 0) {
  console.log('No hook files found');
  process.exit(0);
}

// For now, just verify files are valid JavaScript
hookFiles.forEach(file => {
  const filePath = path.join(srcDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  try {
    // Basic syntax check
    new Function(content);
    console.log(`✓ ${file} - syntax valid`);
  } catch (error) {
    console.error(`✗ ${file} - syntax error:`);
    console.error(error.message);
    process.exit(1);
  }
});

console.log(`\nBuild complete! ${hookFiles.length} hook file(s) ready`);
console.log('Hooks will be distributed in src/hooks/');
