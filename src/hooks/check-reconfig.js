#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

    checkReconfigure(workspaceDir);
  } catch (e) {
    // Silent failure - don't block on errors
    process.exit(0);
  }
});

function checkReconfigure(workspaceDir) {
  const versionFile = path.join(workspaceDir, '.5', 'version.json');
  const flagFile = path.join(workspaceDir, '.5', '.reconfig-reminder');

  if (!fs.existsSync(versionFile)) {
    process.exit(0);
  }

  let versionData;
  try {
    versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
  } catch (e) {
    process.exit(0);
  }

  const { configuredAt, configuredAtCommit } = versionData;

  // No configure data yet - skip (user hasn't run /5:configure)
  if (!configuredAt) {
    process.exit(0);
  }

  // Calculate days elapsed
  let daysElapsed = 0;
  try {
    daysElapsed = Math.floor((Date.now() - new Date(configuredAt).getTime()) / (1000 * 60 * 60 * 24));
  } catch (e) {
    process.exit(0);
  }

  // Count commits since configured
  let commitCount = 0;
  if (configuredAtCommit) {
    try {
      const result = execSync(`git rev-list --count ${configuredAtCommit}..HEAD`, {
        cwd: workspaceDir,
        timeout: 3000,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      commitCount = parseInt(result.trim(), 10) || 0;
    } catch (e) {
      // Git command failed (commit not found, not a repo, etc.) - skip
    }
  }

  // Write or remove temp flag file (never touches version.json)
  const COMMIT_THRESHOLD = 50;
  const DAYS_THRESHOLD = 30;
  const shouldRemind = daysElapsed >= DAYS_THRESHOLD || commitCount >= COMMIT_THRESHOLD;

  try {
    if (shouldRemind) {
      fs.writeFileSync(flagFile, '1');
    } else if (fs.existsSync(flagFile)) {
      fs.unlinkSync(flagFile);
    }
  } catch (e) {
    // Can't write/delete temp file - skip
  }

  process.exit(0);
}
