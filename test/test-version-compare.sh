#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

node <<'NODE'
const fs = require('fs');
const vm = require('vm');

const targets = [
  {
    path: 'bin/install.js',
    start: 'function compareVersions',
    end: '// Get installed version from .5/version.json'
  },
  {
    path: 'src/hooks/check-updates.js',
    start: 'function compareVersions',
    end: null
  },
  {
    path: 'src/hooks/statusline.js',
    start: 'function compareVersions',
    end: null
  }
];

const cases = [
  ['2.0.0-beta-10', '2.0.0-beta-2', 1],
  ['2.0.0-beta-2', '2.0.0-beta-10', -1],
  ['2.0.0', '2.0.0-beta-10', 1],
  ['2.0.0-beta-10', '2.0.0', -1],
  ['2.0.0-alpha', '2.0.0-beta', -1],
  ['2.0.0-beta.2', '2.0.0-beta.10', -1],
  ['2.0.0+build.1', '2.0.0+build.2', 0],
  ['v2.0.1', '2.0.0', 1]
];

for (const target of targets) {
  const source = fs.readFileSync(target.path, 'utf8');
  const start = source.indexOf(target.start);
  if (start === -1) {
    throw new Error(`${target.path}: comparator not found`);
  }

  const end = target.end ? source.indexOf(target.end, start) : source.length;
  if (end === -1) {
    throw new Error(`${target.path}: comparator end marker not found`);
  }

  const context = {};
  vm.runInNewContext(source.slice(start, end), context);

  for (const [left, right, expected] of cases) {
    const actual = Math.sign(context.compareVersions(left, right));
    if (actual !== expected) {
      throw new Error(`${target.path}: compareVersions(${left}, ${right}) returned ${actual}, expected ${expected}`);
    }
  }
}

console.log('SemVer comparison regression tests passed');
NODE
