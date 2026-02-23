#!/usr/bin/env node
// Claude Code Statusline
// Shows: model | directory | context usage

const fs = require('fs');
const path = require('path');
const os = require('os');

// Read JSON from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const model = data.model?.display_name || 'Claude';
    const dir = data.workspace?.current_dir || process.cwd();
    const session = data.session_id || '';
    const remaining = data.context_window?.remaining_percentage;

    // Context window display (shows USED percentage)
    let ctx = '';
    if (remaining != null) {
      const rem = Math.round(remaining);
      const used = Math.max(0, Math.min(100, 100 - rem));

      // Build progress bar (10 segments)
      const filled = Math.floor(used / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

      // Color based on usage
      if (used < 50) {
        ctx = ` \x1b[32m${bar} ${used}%\x1b[0m`;
      } else if (used < 65) {
        ctx = ` \x1b[33m${bar} ${used}%\x1b[0m`;
      } else if (used < 80) {
        ctx = ` \x1b[38;5;208m${bar} ${used}%\x1b[0m`;
      } else {
        ctx = ` \x1b[5;31m💀 ${bar} ${used}%\x1b[0m`;
      }
    }

    // Shorten directory path for display
    const shortDir = dir.replace(os.homedir(), '~');

    // Check for available update and reconfigure reminder
    let updateIndicator = '';
    let reconfigIndicator = '';
    try {
      const versionFile = path.join(dir, '.5', 'version.json');
      const versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));

      // Update check
      const latest = versionData.latestAvailableVersion;
      const installed = versionData.installedVersion;
      if (latest && installed && compareVersions(installed, latest) < 0) {
        updateIndicator = ` | \x1b[33m↑${latest} → /5:update\x1b[0m`;
      }

      // Reconfigure check (reads flag file in .5/, gitignored)
      const flagFile = path.join(dir, '.5', '.reconfig-reminder');
      if (fs.existsSync(flagFile)) {
        reconfigIndicator = ` | \x1b[35m↻ /5:reconfigure\x1b[0m`;
      }
    } catch (e) {
      // No version file or parse error — no indicator
    }

    // Build and output statusline: model | directory | context | update | reconfig
    const statusline = `\x1b[36m${model}\x1b[0m | \x1b[90m${shortDir}\x1b[0m${ctx}${updateIndicator}${reconfigIndicator}`;
    process.stdout.write(statusline);

  } catch (e) {
    // Silent fail - don't break statusline on parse errors
  }
});

// Compare semver versions: returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
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