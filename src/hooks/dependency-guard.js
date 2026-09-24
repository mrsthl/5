#!/usr/bin/env node
// Stop hook: when the uncommitted diff adds a dependency, make Claude justify it once
// before finishing. New dependencies are the most reliable, heuristic-free drift signal.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const JSON_MANIFESTS = { 'package.json': ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'], 'composer.json': ['require', 'require-dev'] };
const LINE_MANIFESTS = /^(requirements.*\.txt|pyproject\.toml|Pipfile|go\.mod|Cargo\.toml|Gemfile|pom\.xml|build\.gradle(\.kts)?|.*\.csproj)$/;

// Comments, brackets, section headers, and package metadata — not dependencies.
const IGNORED_LINE = /^(#|\/\/|<!--|[[\](){}])|^(version|name|description|edition|authors)\s*=|^(module|go|toolchain)\s|\($/;

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function jsonDeps(text, sections) {
  const json = JSON.parse(text);
  return sections.flatMap(s => Object.keys(json[s] || {}));
}

function headVersion(cwd, file) {
  try { return git(cwd, ['show', `HEAD:${file}`]); } catch (e) { return null; }
}

function addedDependencies(cwd) {
  const changed = git(cwd, ['diff', 'HEAD', '--name-only']).split('\n').filter(Boolean);
  const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
  const found = [];

  for (const file of [...new Set([...changed, ...untracked])]) {
    const base = path.basename(file);
    const abs = path.join(cwd, file);
    if (!fs.existsSync(abs)) continue;

    if (JSON_MANIFESTS[base]) {
      const before = headVersion(cwd, file);
      const old = new Set(before ? jsonDeps(before, JSON_MANIFESTS[base]) : []);
      jsonDeps(fs.readFileSync(abs, 'utf8'), JSON_MANIFESTS[base])
        .filter(d => !old.has(d))
        .forEach(d => found.push(`${d} (${file})`));
    } else if (LINE_MANIFESTS.test(base)) {
      const diff = untracked.includes(file)
        ? fs.readFileSync(abs, 'utf8').split('\n').map(l => `+${l}`)
        : git(cwd, ['diff', 'HEAD', '-U0', '--', file]).split('\n');
      diff
        .filter(l => l.startsWith('+') && !l.startsWith('+++'))
        .map(l => l.slice(1).trim())
        .filter(l => l && !IGNORED_LINE.test(l))
        .forEach(l => found.push(`${l} (${file})`));
    }
  }
  return found;
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    if (data.stop_hook_active) process.exit(0); // Claude is already continuing because of a Stop hook

    const root = git(data.cwd || process.cwd(), ['rev-parse', '--show-toplevel']).trim(); // git paths are root-relative
    const deps = addedDependencies(root);
    if (!deps.length) process.exit(0);

    // Ask once per session and dependency set, so an accepted dependency doesn't nag on every stop.
    const stateFile = path.join(root, '.5', '.dependency-guard.json');
    const signature = `${data.session_id || ''}:${deps.slice().sort().join('|')}`;
    let seen = [];
    try { seen = JSON.parse(fs.readFileSync(stateFile, 'utf8')).signatures || []; } catch (e) { /* first run */ }
    if (seen.includes(signature)) process.exit(0);
    if (fs.existsSync(path.dirname(stateFile))) {
      fs.writeFileSync(stateFile, JSON.stringify({ signatures: [...seen, signature].slice(-20) })); // concurrent sessions
    }

    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `Uncommitted changes add dependencies:\n${deps.map(d => `- ${d}`).join('\n')}\n\n` +
        'For each one: if the user asked for it or added it themselves, keep it and name it in your reply. ' +
        'Otherwise remove it with the package manager (never edit a lockfile by hand) and use existing code, ' +
        'the standard library, a native platform feature, or an installed dependency instead.'
    }));
    process.exit(0);
  } catch (e) {
    process.exit(0); // Never block on errors (not a git repo, no HEAD, unparseable manifest)
  }
});
