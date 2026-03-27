#!/usr/bin/env node
// Claude Code Statusline
// Shows: model | folder | branch | 5hr-usage | cost | context | reset-time

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read JSON from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const parts = [];

    // 🤖 Model
    const model = data.model?.display_name || 'Claude';
    parts.push(`\x1b[36m🤖 ${model}\x1b[0m`);

    // 📁 Folder (basename only)
    const dir = data.workspace?.current_dir || process.cwd();
    const folderName = path.basename(dir);
    parts.push(`\x1b[90m📁 ${folderName}\x1b[0m`);

    // 🌿 Branch
    let branch = data.worktree?.branch || '';
    if (!branch) {
      try {
        branch = execSync('git rev-parse --abbrev-ref HEAD', {
          encoding: 'utf8', cwd: dir, stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
      } catch (e) { branch = ''; }
    }
    if (branch && branch !== 'HEAD') {
      parts.push(`\x1b[32m🌿 ${branch}\x1b[0m`);
    }

    // ⚡ 5-hour session usage
    const fiveHrUsed = data.rate_limits?.five_hour?.used_percentage;
    if (fiveHrUsed != null) {
      const pct = Math.round(fiveHrUsed);
      const color = pct < 50 ? '\x1b[32m' : pct < 75 ? '\x1b[33m' : '\x1b[31m';
      parts.push(`${color}⚡ ${pct}%\x1b[0m`);
    }

    // 💰 Cost
    const costUsd = data.cost?.total_cost_usd;
    if (costUsd != null) {
      const fmt = costUsd < 0.01 ? costUsd.toFixed(3) : costUsd.toFixed(2);
      parts.push(`\x1b[33m💰 $${fmt}\x1b[0m`);
    }

    // 📊 Context window (progress bar)
    const ctxUsed = data.context_window?.used_percentage;
    const ctxRemaining = data.context_window?.remaining_percentage;
    if (ctxUsed != null || ctxRemaining != null) {
      const used = ctxUsed != null
        ? Math.round(ctxUsed)
        : Math.max(0, Math.min(100, 100 - Math.round(ctxRemaining)));
      const filled = Math.floor(used / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
      let color;
      if (used < 50)      color = '\x1b[32m';
      else if (used < 65) color = '\x1b[33m';
      else if (used < 80) color = '\x1b[38;5;208m';
      else                color = '\x1b[5;31m';
      parts.push(`${color}🧠 ${bar} ${used}%\x1b[0m`);
    }

    // ⏱ Reset time (time until 5hr window resets)
    const resetAt = data.rate_limits?.five_hour?.resets_at;
    if (resetAt) {
      const remaining = resetAt - Math.floor(Date.now() / 1000);
      if (remaining > 0) {
        const h = Math.floor(remaining / 3600);
        const m = Math.floor((remaining % 3600) / 60);
        const label = h > 0 ? `${h}h${m}m` : `${m}m`;
        parts.push(`\x1b[90m⏱ ${label}\x1b[0m`);
      }
    }

    // Update and reconfigure indicators
    try {
      const versionFile = path.join(dir, '.5', 'version.json');
      const versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));

      const cacheFile = path.join(dir, '.5', '.update-cache.json');
      let latest = null;
      if (fs.existsSync(cacheFile)) {
        try {
          const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
          latest = cache.latestAvailableVersion || null;
        } catch (e) {}
      }
      if (latest && versionData.packageVersion && compareVersions(versionData.packageVersion, latest) < 0) {
        parts.push(`\x1b[33m↑${latest} → /5:update\x1b[0m`);
      }

      const flagFile = path.join(dir, '.5', '.reconfig-reminder');
      if (fs.existsSync(flagFile)) {
        parts.push(`\x1b[35m↻ /5:reconfigure\x1b[0m`);
      }
    } catch (e) {}

    process.stdout.write(parts.join(' | '));

  } catch (e) {
    // Silent fail — don't break statusline on parse errors
  }
});

// Compare semver versions: returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = v2.split('.').map(p => parseInt(p, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }
  return 0;
}
