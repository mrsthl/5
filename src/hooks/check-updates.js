#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read stdin (Claude Code passes JSON)
let inputData = '';
process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    // Parse hook input (contains workspace info)
    const hookData = JSON.parse(inputData);
    const workspaceDir = hookData.workingDirectory || process.cwd();

    checkForUpdates(workspaceDir);
  } catch (e) {
    // Silent failure - don't block on errors
    process.exit(0);
  }
});

function checkForUpdates(workspaceDir) {
  const versionFile = path.join(workspaceDir, '.claude', '.5', 'version.json');

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

  // Check if we should run (daily frequency)
  const now = Date.now();
  const lastCheck = versionData.updateCheckLastRun
    ? new Date(versionData.updateCheckLastRun).getTime()
    : 0;
  const frequency = (versionData.updateCheckFrequency || 86400) * 1000; // Convert to ms

  if (now - lastCheck < frequency) {
    // Checked recently, skip
    process.exit(0);
  }

  // Update last check time
  versionData.updateCheckLastRun = new Date().toISOString();
  fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));

  // Compare versions
  const installed = versionData.installedVersion;
  const packageVersion = getPackageVersion(workspaceDir);

  if (!packageVersion || installed === packageVersion) {
    // No update available
    process.exit(0);
  }

  // Check if update is available (installed < package)
  if (compareVersions(installed, packageVersion) < 0) {
    // Show update notification
    console.log(`\n\x1b[34mℹ\x1b[0m Update available: ${installed} → ${packageVersion}`);
    console.log(`  Run: \x1b[1mnpx 5-phase-workflow --upgrade\x1b[0m\n`);
  }

  process.exit(0);
}

// Get package version from local package.json
function getPackageVersion(workspaceDir) {
  // Try to find package.json in node_modules/5-phase-workflow
  const pkgPath = path.join(workspaceDir, 'node_modules', '5-phase-workflow', 'package.json');

  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return pkg.version;
    } catch (e) {
      return null;
    }
  }

  return null;
}

// Compare semver versions
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }

  return 0;
}
