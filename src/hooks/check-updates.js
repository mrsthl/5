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
  const installed = versionData.installedVersion;
  const latestVersion = await getLatestVersion();

  let newLatest = null;
  if (latestVersion && compareVersions(installed, latestVersion) < 0) {
    newLatest = latestVersion;
  }

  // Only write if latestAvailableVersion actually changed
  const oldLatest = versionData.latestAvailableVersion || null;
  if (newLatest !== oldLatest) {
    versionData.latestAvailableVersion = newLatest;

    // Clean up legacy throttling fields
    delete versionData.updateCheckLastRun;
    delete versionData.updateCheckFrequency;

    fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));
  }

  process.exit(0);
}

// Get latest version from npm registry
async function getLatestVersion() {
  return new Promise((resolve) => {
    const https = require('https');
    const req = https.get(
      'https://registry.npmjs.org/5-phase-workflow/latest',
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

// Compare semver versions
// Uses parseInt to handle pre-release tags (e.g., "2-beta" → 2)
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = v2.split('.').map(p => parseInt(p, 10) || 0);

  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }

  return 0;
}
