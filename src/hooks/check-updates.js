#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read JSON from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    let workspaceDir = process.cwd();
    if (input.trim()) {
      const data = JSON.parse(input);
      workspaceDir = data.cwd || data.workspace?.current_dir || workspaceDir;
    }

    checkForUpdates(workspaceDir).catch(() => process.exit(0));
  } catch (e) {
    // Silent failure - don't block on errors
    process.exit(0);
  }
});

async function checkForUpdates(workspaceDir) {
  const versionFile = path.join(workspaceDir, '.5', 'version.json');

  // Check if version.json exists
  if (!fs.existsSync(versionFile)) {
    // Not installed or legacy install - skip
    process.exit(0);
  }

  let versionData;
  try {
    versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
  } catch (e) {
    // Corrupted file - skip
    process.exit(0);
  }

  // Compare versions
  const installed = versionData.packageVersion;
  const latestVersion = await getLatestVersion();

  let newLatest = null;
  if (latestVersion && compareVersions(installed, latestVersion) < 0) {
    newLatest = latestVersion;
  }

  // Read/write latestAvailableVersion from .update-cache.json (gitignored)
  const cacheFile = path.join(path.dirname(versionFile), '.update-cache.json');
  let cacheData = {};
  if (fs.existsSync(cacheFile)) {
    try { cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch(e) {}
  }
  const oldLatest = cacheData.latestAvailableVersion || null;
  if (newLatest !== oldLatest) {
    cacheData.latestAvailableVersion = newLatest;
    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
  }

  process.exit(0);
}

// Get latest version from npm registry
async function getLatestVersion() {
  return new Promise((resolve) => {
    const https = require('https');
    const req = https.get(
      'https://registry.npmjs.org/foifi/latest',
      { timeout: 3000 },
      (res) => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const pkg = JSON.parse(data);
            resolve(pkg.version);
          } catch (e) {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

// Compare semver versions, including pre-release ordering
function compareVersions(v1, v2) {
  const parsed1 = parseSemver(v1);
  const parsed2 = parseSemver(v2);

  for (let i = 0; i < 3; i++) {
    if (parsed1.core[i] > parsed2.core[i]) return 1;
    if (parsed1.core[i] < parsed2.core[i]) return -1;
  }

  return comparePrerelease(parsed1.prerelease, parsed2.prerelease);
}

function parseSemver(version) {
  const normalized = String(version || '').trim().replace(/^v/, '').split('+')[0];
  const prereleaseIndex = normalized.indexOf('-');
  const corePart = prereleaseIndex === -1 ? normalized : normalized.slice(0, prereleaseIndex);
  const prereleasePart = prereleaseIndex === -1 ? '' : normalized.slice(prereleaseIndex + 1);
  const core = corePart.split('.').slice(0, 3).map(part => parseInt(part, 10) || 0);
  while (core.length < 3) core.push(0);

  return {
    core,
    prerelease: prereleasePart ? prereleasePart.split(/[.-]/) : []
  };
}

function comparePrerelease(pre1, pre2) {
  if (pre1.length === 0 && pre2.length === 0) return 0;
  if (pre1.length === 0) return 1;
  if (pre2.length === 0) return -1;

  const length = Math.max(pre1.length, pre2.length);
  for (let i = 0; i < length; i++) {
    const id1 = pre1[i];
    const id2 = pre2[i];
    if (id1 === undefined) return -1;
    if (id2 === undefined) return 1;
    if (id1 === id2) continue;

    const id1Numeric = /^[0-9]+$/.test(id1);
    const id2Numeric = /^[0-9]+$/.test(id2);
    if (id1Numeric && id2Numeric) {
      const n1 = parseInt(id1, 10);
      const n2 = parseInt(id2, 10);
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
      continue;
    }
    if (id1Numeric) return -1;
    if (id2Numeric) return 1;
    return id1 > id2 ? 1 : -1;
  }

  return 0;
}
