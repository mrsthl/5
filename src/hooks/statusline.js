#!/usr/bin/env node
// Claude Code Statusline
// Shows: model | folder | branch | off-peak | 5hr-usage | cost | context | reset-time

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

    // 🚀 Off-peak indicator (weekdays before 5 AM or after 11 AM PT; all weekends)
    // PT = UTC-8 (PST) or UTC-7 (PDT). Use UTC-7 as approximation (covers PDT/PST conservatively).
    const nowUtc = new Date();
    const ptHour = (nowUtc.getUTCHours() - 7 + 24) % 24; // approximate PT
    const ptDay = new Date(nowUtc.getTime() - 7 * 3600 * 1000).getUTCDay(); // 0=Sun,6=Sat
    const isWeekend = ptDay === 0 || ptDay === 6;
    const isPeak = !isWeekend && ptHour >= 5 && ptHour < 11;
    if (!isPeak) {
      parts.push('\x1b[32m🚀 off-peak\x1b[0m');
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
