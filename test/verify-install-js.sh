#!/bin/bash
# Verification script to check that workflow-owned files are listed in install.js.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "========================================"
echo "Verifying install.js Configuration"
echo "========================================"
echo ""

node <<'NODE'
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const NC = '\x1b[0m';

function listEntries(dir, options = {}) {
  if (!fs.existsSync(dir)) return [];

  const entries = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (options.directoriesOnly && entry.isDirectory()) {
      entries.push(entry.name);
    } else if (options.filesOnly && entry.isFile()) {
      entries.push(entry.name);
    }
  }
  return entries.sort();
}

function listFilesRecursive(rootDir) {
  if (!fs.existsSync(rootDir)) return [];

  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push(path.relative(rootDir, fullPath).split(path.sep).join('/'));
      }
    }
  }
  walk(rootDir);
  return files.sort();
}

function getManagedFiles() {
  const source = fs.readFileSync('bin/install.js', 'utf8');
  const start = source.indexOf('function getWorkflowManagedFiles()');
  const end = source.indexOf('// Flatten getWorkflowManagedFiles()', start);
  if (start === -1 || end === -1) {
    throw new Error('Could not locate getWorkflowManagedFiles() in bin/install.js');
  }

  const context = {};
  vm.runInNewContext(`${source.slice(start, end)}\nmanaged = getWorkflowManagedFiles();`, context);
  return context.managed;
}

function compareLists(category, repoList, installList) {
  console.log(`=== ${category} ===`);
  console.log('');
  console.log('Files in repository:');
  console.log(repoList.join('\n') || '(none)');
  console.log('');
  console.log('Listed in install.js:');
  console.log(installList.join('\n') || '(none)');
  console.log('');

  const repoSet = new Set(repoList);
  const installSet = new Set(installList);
  const missing = repoList.filter(file => !installSet.has(file));
  const extra = installList.filter(file => !repoSet.has(file));

  if (missing.length > 0 || extra.length > 0) {
    if (missing.length > 0) {
      console.log(`${RED}Missing from install.js:${NC}`);
      for (const file of missing) console.log(`  - ${file}`);
    }
    if (extra.length > 0) {
      console.log(`${RED}Listed in install.js but missing from repository:${NC}`);
      for (const file of extra) console.log(`  - ${file}`);
    }
    console.log('');
    return 1;
  }

  console.log(`${GREEN}All files listed in install.js${NC}`);
  console.log('');
  return 0;
}

const managed = getManagedFiles();
let errors = 0;

errors += compareLists(
  'Commands',
  listEntries('src/commands', { directoriesOnly: true }),
  [...(managed.commands || [])].sort()
);

errors += compareLists(
  'Agents',
  listEntries('src/agents', { filesOnly: true }),
  [...(managed.agents || [])].sort()
);

errors += compareLists(
  'Skills',
  listEntries('src/skills', { directoriesOnly: true }),
  [...(managed.skills || [])].sort()
);

errors += compareLists(
  'Hooks',
  listEntries('src/hooks', { filesOnly: true }),
  [...(managed.hooks || [])].sort()
);

errors += compareLists(
  'Templates',
  listFilesRecursive('src/templates'),
  [...(managed.templates || [])].sort()
);

errors += compareLists(
  'References',
  listFilesRecursive('src/references'),
  [...(managed.references || [])].sort()
);

errors += compareLists(
  'Helper Binaries',
  listEntries('bin', { filesOnly: true }).filter(file => file === 'sync-agents.js'),
  [...(managed.binHelpers || [])].sort()
);

console.log('========================================');
if (errors === 0) {
  console.log(`${GREEN}All workflow files are properly listed in install.js${NC}`);
  console.log('');
  console.log('install.js verification PASSED');
} else {
  console.log(`${RED}Found ${errors} categories with manifest drift${NC}`);
  console.log('');
  console.log('Please update getWorkflowManagedFiles() in bin/install.js.');
  console.log('');
  console.log('install.js verification FAILED');
  process.exit(1);
}
NODE
