#!/usr/bin/env node
// Stop hook: when the uncommitted diff adds a dependency, make Claude justify it once
// before finishing. New dependencies are the most reliable, heuristic-free drift signal.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Each extractor returns the dependency identities a manifest declares. The hook compares
// those sets with HEAD, so config edits and version bumps of existing packages never count.
const pep508Name = spec => (spec.trim().match(/^([A-Za-z0-9][A-Za-z0-9._-]*)/) || [])[1];
const normalizePy = name => name && name.toLowerCase().replace(/[_.]+/g, '-');
const jsonKeys = sections => text => { const json = JSON.parse(text); return sections.flatMap(s => Object.keys(json[s] || {})); };
const matchAll = (text, re, pick) => [...text.matchAll(re)].map(pick);

function requirementsDeps(text) {
  return text.split('\n')
    .map(l => l.replace(/#.*/, '').trim())
    .filter(l => l && !l.startsWith('-'))
    .map(l => normalizePy(pep508Name(l)))
    .filter(Boolean);
}

// Minimal TOML walk for Cargo.toml, Pipfile, and pyproject.toml (PEP 621, PEP 735, Poetry).
function tomlDeps(text) {
  const deps = [];
  let section = '';
  let inArray = false;
  // Collects quoted specs; returns true once the array closes (a `]` outside quotes, not in "pkg[extra]").
  const arrayLine = line => {
    matchAll(line, /"([^"]+)"|'([^']+)'/g, m => normalizePy(pep508Name(m[1] || m[2]))).forEach(d => d && deps.push(d));
    return line.replace(/"[^"]*"|'[^']*'/g, '').includes(']');
  };

  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s#.*$/, '').trim();
    if (inArray) { inArray = !arrayLine(line); continue; }
    const header = line.match(/^\[\[?([^\]]+)\]\]?$/);
    if (header) {
      section = header[1].trim();
      const dotted = section.match(/(?:^|\.)(?:dependencies|dev-dependencies|build-dependencies)\.([^.]+)$/);
      if (dotted) deps.push(dotted[1]); // Cargo: [dependencies.serde]
      continue;
    }
    const key = (line.match(/^"?([A-Za-z0-9_.-]+)"?\s*=/) || [])[1];
    if (!key) continue;
    const arrayOfSpecs = (section === 'project' && key === 'dependencies') ||
      section === 'project.optional-dependencies' || section === 'dependency-groups';
    if (arrayOfSpecs && line.includes('[')) {
      inArray = !arrayLine(line.slice(line.indexOf('[') + 1));
    } else if (/(?:^|\.)(?:dependencies|dev-dependencies|build-dependencies|packages|dev-packages)$/.test(section) && key !== 'python') {
      deps.push(key);
    }
  }
  return deps;
}

function goModDeps(text) {
  const deps = [];
  let inBlock = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (/^require\s*\($/.test(line)) { inBlock = true; continue; }
    if (inBlock && line === ')') { inBlock = false; continue; }
    if (line.includes('// indirect')) continue; // pulled in by tooling, not chosen
    const spec = inBlock ? line : (line.match(/^require\s+(.+)$/) || [])[1];
    const mod = spec && spec.split(/\s+/)[0];
    if (mod && !mod.startsWith('//')) deps.push(mod);
  }
  return deps;
}

const EXTRACTORS = [
  [/^package\.json$/, jsonKeys(['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'])],
  [/^composer\.json$/, jsonKeys(['require', 'require-dev'])],
  [/^requirements.*\.txt$/, requirementsDeps],
  [/^(pyproject\.toml|Pipfile|Cargo\.toml)$/, tomlDeps],
  [/^go\.mod$/, goModDeps],
  [/^Gemfile$/, text => matchAll(text, /^\s*gem\s+['"]([^'"]+)['"]/gm, m => m[1])],
  [/^pom\.xml$/, text => matchAll(text, /<dependency>([\s\S]*?)<\/dependency>/g, m =>
    [/<groupId>([^<]+)</, /<artifactId>([^<]+)</].map(re => (m[1].match(re) || [])[1] || '?').join(':'))],
  [/^build\.gradle(\.kts)?$/, text => matchAll(text,
    /^\s*(?:implementation|api|compileOnly|runtimeOnly|testImplementation|testRuntimeOnly|annotationProcessor|kapt|ksp|classpath)\s*\(?\s*(?:['"]([^'":]+:[^'":]+)|(libs\.[\w.]+))/gm,
    m => m[1] || m[2])],
  [/\.csproj$/, text => matchAll(text, /<PackageReference\s+Include="([^"]+)"/gi, m => m[1])]
];

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function headVersion(root, file) {
  try { return git(root, ['show', `HEAD:${file}`]); } catch (e) { return null; }
}

function addedDependencies(root) {
  const changed = git(root, ['diff', 'HEAD', '--name-only']).split('\n').filter(Boolean);
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
  const found = [];

  for (const file of new Set([...changed, ...untracked])) {
    const extract = (EXTRACTORS.find(([re]) => re.test(path.basename(file))) || [])[1];
    const abs = path.join(root, file);
    if (!extract || !fs.existsSync(abs)) continue;
    try {
      const before = headVersion(root, file);
      const old = new Set(before ? extract(before) : []);
      extract(fs.readFileSync(abs, 'utf8'))
        .filter(d => !old.has(d))
        .forEach(d => found.push(`${d} (${file})`));
    } catch (e) {
      // Unparseable manifest (e.g. mid-edit JSON): skip this file, keep checking the others.
    }
  }
  return [...new Set(found)];
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
