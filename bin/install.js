#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${msg}${colors.reset}\n`)
};

// Version comparison (semver)
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

// Get installed version from .5/version.json
function getInstalledVersion(isGlobal) {
  const versionFile = path.join(getDataPath(isGlobal), 'version.json');
  if (!fs.existsSync(versionFile)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
    return data.installedVersion;
  } catch (e) {
    return null; // Corrupted file, treat as missing
  }
}

// Get package version from package.json
function getPackageVersion() {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return pkg.version;
}

// Get full version info
function getVersionInfo(targetPath, isGlobal) {
  const exists = checkExistingInstallation(targetPath);
  if (!exists) {
    return { exists: false };
  }

  const installed = getInstalledVersion(isGlobal);
  const available = getPackageVersion();

  if (!installed) {
    // Legacy install without version.json
    return {
      exists: true,
      installed: null,
      available,
      needsUpdate: true,
      legacy: true
    };
  }

  const needsUpdate = compareVersions(installed, available) < 0;

  return {
    exists: true,
    installed,
    available,
    needsUpdate
  };
}

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    global: false,
    local: false,
    uninstall: false,
    upgrade: false,
    check: false,
    help: false
  };

  for (const arg of args) {
    if (arg === '--global' || arg === '-g') options.global = true;
    else if (arg === '--local' || arg === '-l') options.local = true;
    else if (arg === '--uninstall' || arg === '-u') options.uninstall = true;
    else if (arg === '--upgrade' || arg === '--force' || arg === '-U') options.upgrade = true;
    else if (arg === '--check') options.check = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
  }

  // Default to local if neither specified
  if (!options.global && !options.local && !options.uninstall) {
    options.local = true;
  }

  return options;
}

// Show help message
function showHelp() {
  console.log(`
${colors.bright}5-Phase Workflow Installer${colors.reset}

Usage: npx 5-phase-workflow [options]

Options:
  --global, -g      Install to ~/.claude/ (available across all projects)
  --local, -l       Install to ./.claude/ (project-specific, default)
  --upgrade, -U     Upgrade to latest version (auto-update, no prompt)
  --force           Alias for --upgrade
  --check           Check installed version and available updates
  --uninstall, -u   Remove installation from current directory
  --help, -h        Show this help message

Examples:
  npx 5-phase-workflow              # Install locally or prompt for update
  npx 5-phase-workflow --global     # Install globally
  npx 5-phase-workflow --upgrade    # Auto-update to latest version
  npx 5-phase-workflow --check      # Check version without updating
  npx 5-phase-workflow --uninstall  # Remove from current directory
`);
}

// Get installation target path (.claude/ directory)
function getTargetPath(isGlobal) {
  if (isGlobal) {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    return path.join(homeDir, '.claude');
  }
  return path.join(process.cwd(), '.claude');
}

// Get data path (.5/ directory for config, version, features)
// Local installs: <project>/.5 (project root)
// Global installs: ~/.claude/.5 (alongside global install)
function getDataPath(isGlobal) {
  if (isGlobal) {
    return path.join(getTargetPath(true), '.5');
  }
  return path.join(process.cwd(), '.5');
}

// Migrate data from old .claude/.5/ to new .5/ location (local installs only)
// This runs during upgrades so existing users don't lose config/features/version data.
function migrateDataDir(isGlobal) {
  // Global installs: old and new paths are both ~/.claude/.5 — no migration needed
  if (isGlobal) return;

  const oldDir = path.join(process.cwd(), '.claude', '.5');
  const newDir = getDataPath(false); // <project>/.5

  if (!fs.existsSync(oldDir)) return;

  // If new dir doesn't exist, move everything over
  if (!fs.existsSync(newDir)) {
    fs.mkdirSync(newDir, { recursive: true });
  }

  // Copy all files/dirs from old to new (skip files that already exist in new)
  copyDirMerge(oldDir, newDir);

  // Remove old directory
  removeDir(oldDir);
  log.success('Migrated .claude/.5/ → .5/');
}

// Copy directory recursively, skipping files that already exist at destination
function copyDirMerge(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirMerge(srcPath, destPath);
    } else if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Get source path (package installation directory)
function getSourcePath() {
  // When installed via npm, __dirname is <install-location>/bin
  // Source files are in <install-location>/src
  return path.join(__dirname, '..', 'src');
}

// Copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Remove directory recursively
function removeDir(dir) {
  if (fs.existsSync(dir)) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        removeDir(fullPath);
      } else {
        fs.unlinkSync(fullPath);
      }
    }

    fs.rmdirSync(dir);
  }
}

// Get list of workflow-owned files/directories (not user-created)
function getWorkflowManagedFiles() {
  return {
    // Commands: only the 5/ namespace
    commands: ['5'],

    // Agents: separate agent files referenced by commands via agent: frontmatter
    agents: [
      'feature-planner.md',
      'implementation-planner.md',
      'component-executor.md'
    ],

    // Skills: specific skill directories
    skills: [
      'build-project',
      'run-tests',
      'configure-project',
      'generate-readme'
    ],

    // Hooks: specific hook files
    hooks: [
      'statusline.js',
      'check-updates.js',
      'plan-guard.js',
      'config-guard.js'
    ],

    // Templates: specific template files
    templates: [
      // Project documentation templates
      'ARCHITECTURE.md',
      'CONCERNS.md',
      'CONVENTIONS.md',
      'INTEGRATIONS.md',
      'STACK.md',
      'STRUCTURE.md',
      'TESTING.md',
      // Workflow output templates
      'workflow/FEATURE-SPEC.md',
      'workflow/PLAN.md',
      'workflow/STATE.json',
      'workflow/VERIFICATION-REPORT.md',
      'workflow/REVIEW-FINDINGS.md',
      'workflow/REVIEW-SUMMARY.md',
      'workflow/FIX-PLAN.md'
    ]
  };
}

// Selectively update only workflow-managed files, preserve user content
function selectiveUpdate(targetPath, sourcePath) {
  const managed = getWorkflowManagedFiles();

  // Update commands/5/ only
  const commandsSrc = path.join(sourcePath, 'commands', '5');
  const commandsDest = path.join(targetPath, 'commands', '5');
  if (fs.existsSync(commandsSrc)) {
    if (fs.existsSync(commandsDest)) {
      removeDir(commandsDest);
    }
    copyDir(commandsSrc, commandsDest);
    log.success('Updated commands/5/');
  }

  // Update specific agents (referenced by commands via agent: frontmatter)
  if (managed.agents.length > 0) {
    const agentsSrc = path.join(sourcePath, 'agents');
    const agentsDest = path.join(targetPath, 'agents');
    if (!fs.existsSync(agentsDest)) {
      fs.mkdirSync(agentsDest, { recursive: true });
    }
    for (const agent of managed.agents) {
      const src = path.join(agentsSrc, agent);
      const dest = path.join(agentsDest, agent);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }
    log.success('Updated agents/ (workflow files only)');
  }

  // Update specific skills
  const skillsSrc = path.join(sourcePath, 'skills');
  const skillsDest = path.join(targetPath, 'skills');
  if (!fs.existsSync(skillsDest)) {
    fs.mkdirSync(skillsDest, { recursive: true });
  }
  for (const skill of managed.skills) {
    const src = path.join(skillsSrc, skill);
    const dest = path.join(skillsDest, skill);
    if (fs.existsSync(src)) {
      if (fs.existsSync(dest)) {
        removeDir(dest);
      }
      copyDir(src, dest);
    }
  }
  log.success('Updated skills/ (workflow skills only)');

  // Update specific hooks
  const hooksSrc = path.join(sourcePath, 'hooks');
  const hooksDest = path.join(targetPath, 'hooks');
  if (!fs.existsSync(hooksDest)) {
    fs.mkdirSync(hooksDest, { recursive: true });
  }
  for (const hook of managed.hooks) {
    const src = path.join(hooksSrc, hook);
    const dest = path.join(hooksDest, hook);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }
  log.success('Updated hooks/ (workflow files only)');

  // Update specific templates (including nested directories like workflow/)
  const templatesSrc = path.join(sourcePath, 'templates');
  const templatesDest = path.join(targetPath, 'templates');
  if (!fs.existsSync(templatesDest)) {
    fs.mkdirSync(templatesDest, { recursive: true });
  }
  for (const template of managed.templates) {
    const src = path.join(templatesSrc, template);
    const dest = path.join(templatesDest, template);
    if (fs.existsSync(src)) {
      // Ensure parent directory exists for nested paths (e.g., workflow/FEATURE-SPEC.md)
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(src, dest);
    }
  }
  log.success('Updated templates/ (workflow files only)');
}

// Initialize version.json after successful install
function initializeVersionJson(isGlobal) {
  const dataDir = getDataPath(isGlobal);
  const versionFile = path.join(dataDir, 'version.json');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const version = getPackageVersion();
  const now = new Date().toISOString();

  const versionData = {
    packageVersion: version,
    installedVersion: version,
    installedAt: now,
    lastUpdated: now,
    installationType: isGlobal ? 'global' : 'local'
  };

  fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));
  log.success('Initialized version tracking');
}

// Merge hook arrays by matching on the command path.
// Keeps user overrides for existing hooks, adds new hooks from source.
function mergeHookArrays(targetArr, sourceArr) {
  const result = [...targetArr];
  for (const sourceEntry of sourceArr) {
    const sourceCmd = sourceEntry.hooks?.[0]?.command || '';
    const exists = result.some(entry => {
      const cmd = entry.hooks?.[0]?.command || '';
      return cmd === sourceCmd;
    });
    if (!exists) {
      result.push(sourceEntry);
    }
  }
  return result;
}

// Hook event keys that contain arrays of hook entries
const HOOK_ARRAY_KEYS = new Set([
  'PreToolUse', 'PostToolUse', 'SessionStart', 'SessionEnd',
  'PreCompact', 'PostCompact'
]);

// Deep merge for settings.json
function deepMerge(target, source, parentKey) {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      // Recursively merge nested objects
      result[key] = deepMerge(result[key] || {}, source[key], key);
    } else if (Array.isArray(source[key]) && Array.isArray(result[key]) && HOOK_ARRAY_KEYS.has(key)) {
      // Hook arrays: merge by command path to add new hooks
      result[key] = mergeHookArrays(result[key], source[key]);
    } else {
      // For primitives and non-hook arrays: use source if target doesn't have it
      if (!(key in result)) {
        result[key] = source[key];
      }
      // User's existing value takes precedence if it exists
    }
  }
  return result;
}

// Merge settings.json into existing
function mergeSettings(targetPath, sourcePath) {
  const targetSettings = path.join(targetPath, 'settings.json');
  const sourceSettings = path.join(sourcePath, 'settings.json');

  if (!fs.existsSync(sourceSettings)) {
    return;
  }

  const newSettings = JSON.parse(fs.readFileSync(sourceSettings, 'utf8'));

  if (fs.existsSync(targetSettings)) {
    const existingSettings = JSON.parse(fs.readFileSync(targetSettings, 'utf8'));
    const merged = deepMerge(newSettings, existingSettings);
    fs.writeFileSync(targetSettings, JSON.stringify(merged, null, 2));
    log.info('Merged settings with existing configuration');
  } else {
    fs.copyFileSync(sourceSettings, targetSettings);
    log.success('Installed settings.json');
  }
}

// Check if installation exists
function checkExistingInstallation(targetPath) {
  const markerFile = path.join(targetPath, 'commands', '5', 'plan-feature.md');
  return fs.existsSync(markerFile);
}

// Helper to show commands
function showCommandsHelp(isGlobal) {
  log.info('Available commands:');
  log.info('  /5:plan-feature          - Start feature planning (Phase 1)');
  log.info('  /5:plan-implementation   - Create implementation plan (Phase 2)');
  log.info('  /5:implement-feature     - Execute implementation (Phase 3)');
  log.info('  /5:verify-implementation - Verify implementation (Phase 4)');
  log.info('  /5:review-code          - Code review (Phase 5)');
  log.info('  /5:configure            - Interactive project setup');
  log.info('  /5:unlock               - Remove planning guard lock');
  log.info('');
  log.info(`Config file: ${path.join(getDataPath(isGlobal), 'config.json')}`);
}

// Fresh installation
function performFreshInstall(targetPath, sourcePath, isGlobal) {
  // Create target directory if it doesn't exist
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
    log.success(`Created ${targetPath}`);
  }

  // Copy directories
  const dirs = ['commands', 'agents', 'skills', 'hooks', 'templates'];
  for (const dir of dirs) {
    const src = path.join(sourcePath, dir);
    const dest = path.join(targetPath, dir);

    if (fs.existsSync(src)) {
      copyDir(src, dest);
      log.success(`Installed ${dir}/`);
    }
  }

  // Merge settings
  mergeSettings(targetPath, sourcePath);

  // Initialize version tracking
  initializeVersionJson(isGlobal);

  log.header('Installation Complete!');
  log.info('');
  log.info('Next step: Configure your project');
  log.info('Run: /5:configure');
  log.info('');
  log.info('This will:');
  log.info('  • Detect your project type and build commands');
  log.info('  • Set up ticket tracking conventions');
  log.info('  • Generate comprehensive documentation (CLAUDE.md)');
  log.info('  • Create project-specific skills');
  log.info('');

  showCommandsHelp(isGlobal);
}

// Perform update (preserves user-created files, updates .5/ data directory)
function performUpdate(targetPath, sourcePath, isGlobal, versionInfo) {
  log.header(`Updating from ${versionInfo.installed || 'legacy'} to ${versionInfo.available}`);
  log.info('Preserving user-created commands, agents, skills, and hooks');

  // Selectively update only workflow-managed files (preserves user content)
  selectiveUpdate(targetPath, sourcePath);

  // Merge settings (deep merge preserves user customizations)
  mergeSettings(targetPath, sourcePath);

  // Update version.json
  const dataDir = getDataPath(isGlobal);
  const versionFile = path.join(dataDir, 'version.json');

  let versionData;
  if (fs.existsSync(versionFile)) {
    versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
  } else {
    // Legacy install, create version.json
    versionData = {
      installedAt: new Date().toISOString(),
      installationType: isGlobal ? 'global' : 'local'
    };
  }

  versionData.packageVersion = versionInfo.available;
  versionData.installedVersion = versionInfo.available;
  versionData.lastUpdated = new Date().toISOString();

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));

  // Create features directory if it doesn't exist
  const featuresDir = path.join(dataDir, 'features');
  if (!fs.existsSync(featuresDir)) {
    fs.mkdirSync(featuresDir, { recursive: true });
    log.info('Feature folders nest under .5/features/');
    log.info('See RELEASE_NOTES.md for migration if you have in-progress features');
  }

  log.header('Update Complete!');
  log.success(`Now running version ${versionInfo.available}`);
  showCommandsHelp(isGlobal);
}

// Perform installation
function install(isGlobal, forceUpgrade = false) {
  const targetPath = getTargetPath(isGlobal);
  const sourcePath = getSourcePath();

  log.header('5-Phase Workflow Installation');
  log.info(`Target: ${targetPath}`);
  log.info(`Source: ${sourcePath}`);

  // Migrate data from old .claude/.5/ to new .5/ location
  migrateDataDir(isGlobal);

  // Check for existing installation and version
  const versionInfo = getVersionInfo(targetPath, isGlobal);

  if (versionInfo.exists) {
    if (versionInfo.legacy) {
      log.warn('Detected legacy installation (no version tracking)');
      log.info(`Upgrading from legacy install to ${versionInfo.available}`);
      performUpdate(targetPath, sourcePath, isGlobal, versionInfo);
      return;
    } else if (versionInfo.needsUpdate) {
      log.info(`Installed: ${versionInfo.installed}`);
      log.info(`Available: ${versionInfo.available}`);

      if (!forceUpgrade) {
        // Prompt user for confirmation
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        rl.question('Update to latest version? (Y/n): ', (answer) => {
          rl.close();
          if (answer.toLowerCase() === 'n' || answer.toLowerCase() === 'no') {
            log.info('Update cancelled');
            return;
          }
          performUpdate(targetPath, sourcePath, isGlobal, versionInfo);
        });
        return; // Wait for user input
      }
      // Force upgrade, no prompt
      performUpdate(targetPath, sourcePath, isGlobal, versionInfo);
      return;
    } else {
      // Same version
      log.success(`Already installed (version ${versionInfo.installed})`);
      return;
    }
  }

  // Fresh install (no existing installation)
  performFreshInstall(targetPath, sourcePath, isGlobal);
}

// Perform uninstallation
function uninstall() {
  const targetPath = getTargetPath(false); // Always local for uninstall

  log.header('5-Phase Workflow Uninstallation');
  log.info(`Target: ${targetPath}`);

  if (!checkExistingInstallation(targetPath)) {
    log.warn('No installation found at this location');
    return;
  }

  const managed = getWorkflowManagedFiles();

  // Remove commands/5/ (workflow namespace only)
  const commands5 = path.join(targetPath, 'commands', '5');
  if (fs.existsSync(commands5)) {
    removeDir(commands5);
    log.success('Removed commands/5/');
  }

  // Remove only workflow-managed agents
  for (const agent of managed.agents) {
    const agentPath = path.join(targetPath, 'agents', agent);
    if (fs.existsSync(agentPath)) {
      fs.unlinkSync(agentPath);
    }
  }
  log.success('Removed workflow agents (preserved user-created agents)');

  // Remove only workflow-managed skills
  for (const skill of managed.skills) {
    const skillPath = path.join(targetPath, 'skills', skill);
    if (fs.existsSync(skillPath)) {
      removeDir(skillPath);
    }
  }
  log.success('Removed workflow skills (preserved user-created skills)');

  // Remove only workflow-managed hooks
  for (const hook of managed.hooks) {
    const hookPath = path.join(targetPath, 'hooks', hook);
    if (fs.existsSync(hookPath)) {
      fs.unlinkSync(hookPath);
    }
  }
  log.success('Removed workflow hooks (preserved user-created hooks)');

  // Remove only workflow-managed templates
  for (const template of managed.templates) {
    const templatePath = path.join(targetPath, 'templates', template);
    if (fs.existsSync(templatePath)) {
      fs.unlinkSync(templatePath);
    }
  }
  log.success('Removed workflow templates (preserved user-created templates)');

  // Remove data directory (.5/)
  const dataDir = getDataPath(false);
  if (fs.existsSync(dataDir)) {
    removeDir(dataDir);
    log.success('Removed .5/ data directory');
  }

  // Also clean up old .claude/.5/ if it still exists
  const oldDataDir = path.join(targetPath, '.5');
  if (fs.existsSync(oldDataDir)) {
    removeDir(oldDataDir);
    log.success('Removed legacy .claude/.5/ directory');
  }

  log.header('Uninstallation Complete!');
}

// Main
function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    return;
  }

  if (options.check) {
    const targetPath = getTargetPath(options.global);
    migrateDataDir(options.global);
    const versionInfo = getVersionInfo(targetPath, options.global);

    if (!versionInfo.exists) {
      log.info('Not installed');
      return;
    }

    log.info(`Installed: ${versionInfo.installed || 'legacy (no version)'}`);
    log.info(`Available: ${versionInfo.available}`);

    if (versionInfo.needsUpdate) {
      log.warn('Update available');
      log.info('Run: npx 5-phase-workflow --upgrade');
    } else {
      log.success('Up to date');
    }
    return;
  }

  if (options.uninstall) {
    uninstall();
    return;
  }

  install(options.global, options.upgrade);
}

main();
