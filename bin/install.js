#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Active runtime ('claude' or 'codex') — set once in main()
let activeRuntime = 'claude';

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
    return data.packageVersion;
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
    help: false,
    runtime: 'claude' // 'claude' or 'codex'
  };

  for (const arg of args) {
    if (arg === '--global' || arg === '-g') options.global = true;
    else if (arg === '--local' || arg === '-l') options.local = true;
    else if (arg === '--uninstall' || arg === '-u') options.uninstall = true;
    else if (arg === '--upgrade' || arg === '--force' || arg === '-U') options.upgrade = true;
    else if (arg === '--check') options.check = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--codex') options.runtime = 'codex';
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
  --codex           Install for Codex CLI (to ~/.codex/ or ./.codex/)
  --upgrade, -U     Upgrade to latest version (auto-update, no prompt)
  --force           Alias for --upgrade
  --check           Check installed version and available updates
  --uninstall, -u   Remove installation from current directory
  --help, -h        Show this help message

Examples:
  npx 5-phase-workflow              # Install locally for Claude Code
  npx 5-phase-workflow --global     # Install globally for Claude Code
  npx 5-phase-workflow --codex      # Install locally for Codex CLI
  npx 5-phase-workflow --codex -g   # Install globally for Codex CLI
  npx 5-phase-workflow --upgrade    # Auto-update to latest version
  npx 5-phase-workflow --check      # Check version without updating
  npx 5-phase-workflow --uninstall  # Remove from current directory
`);
}

// Get config directory name for active runtime
function getRuntimeDirName() {
  if (activeRuntime === 'codex') return '.codex';
  return '.claude';
}

// Get installation target path (.claude/ or .codex/ directory)
function getTargetPath(isGlobal) {
  const dirName = getRuntimeDirName();
  if (isGlobal) {
    if (activeRuntime === 'codex' && process.env.CODEX_HOME) {
      return process.env.CODEX_HOME;
    }
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    return path.join(homeDir, dirName);
  }
  return path.join(process.cwd(), dirName);
}

// Get data path (.5/ directory for config, version, features)
// Local installs: <project>/.5 (project root)
// Global installs: ~/<runtime-dir>/.5 (alongside global install)
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

// Files removed from the package before manifest tracking existed.
// This list is frozen — future removals are handled by manifest diffing.
const LEGACY_REMOVED_FILES = [
  'agents/feature-planner.md',
  'agents/implementation-planner.md',
  'agents/review-processor.md',
  'agents/step-executor.md',
  'agents/integration-agent.md',
  'agents/step-fixer.md',
  'agents/step-verifier.md',
  'agents/verification-agent.md',
  'templates/STACK.md',
  'templates/STRUCTURE.md',
  'templates/CONVENTIONS.md',
  'templates/INTEGRATIONS.md',
  'skills/configure-project'
];

// Get list of workflow-owned files/directories (not user-created)
function getWorkflowManagedFiles() {
  return {
    // Commands: only the 5/ namespace
    commands: ['5'],

    // Agents: separate agent files referenced by commands via agent: frontmatter
    agents: [
      'component-executor.md'
    ],

    // Skills: specific skill directories
    skills: [
      'configure-docs-index',
      'configure-skills',
      'generate-readme'
    ],

    // Hooks: specific hook files
    hooks: [
      'statusline.js',
      'check-updates.js',
      'check-reconfig.js',
      'plan-guard.js',
      'config-guard.js'
    ],

    // References: lookup tables and schemas read on-demand by commands
    references: [
      'configure-tables.md'
    ],

    // Templates: specific template files
    templates: [
      // Project documentation templates
      'ARCHITECTURE.md',
      'CONCERNS.md',
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

// Flatten getWorkflowManagedFiles() into a list of relative paths (relative to target dir)
function getFileManifest() {
  if (activeRuntime === 'codex') return getCodexFileManifest();

  const managed = getWorkflowManagedFiles();
  const manifest = [];

  // Commands are directories
  for (const cmd of managed.commands) {
    manifest.push(`commands/${cmd}`);
  }

  // Agents are files
  for (const agent of managed.agents) {
    manifest.push(`agents/${agent}`);
  }

  // Skills are directories
  for (const skill of managed.skills) {
    manifest.push(`skills/${skill}`);
  }

  // Hooks are files
  for (const hook of managed.hooks) {
    manifest.push(`hooks/${hook}`);
  }

  // Templates are files (may include nested paths like workflow/FEATURE-SPEC.md)
  for (const template of managed.templates) {
    manifest.push(`templates/${template}`);
  }

  // References are files
  if (managed.references) {
    for (const ref of managed.references) {
      manifest.push(`references/${ref}`);
    }
  }

  return manifest;
}

// ── Codex conversion functions ──────────────────────────────────────────────

// Extract YAML frontmatter and body from a markdown file
function extractFrontmatterAndBody(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: content };
  return { frontmatter: match[1], body: match[2] };
}

// Extract a single field value from YAML frontmatter (simple key: value)
function extractFrontmatterField(frontmatter, field) {
  if (!frontmatter) return null;
  const match = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim() : null;
}

// Convert /5:command-name references to $5-command-name (Codex skill mentions)
function convertSlashCommandsToCodexMentions(content) {
  return content.replace(/\/5:([a-z0-9-]+)/g, (_, name) => `$5-${name}`);
}

// Convert Claude command markdown to Codex-compatible content
function convertClaudeToCodexMarkdown(content) {
  let converted = convertSlashCommandsToCodexMentions(content);
  // Replace .claude/ path references with .codex/
  converted = converted.replace(/\.claude\//g, '.codex/');
  return converted;
}

// Generate the adapter header that teaches Codex how to map Claude Code concepts
function getCodexSkillAdapterHeader(skillName) {
  const invocation = `$${skillName}`;
  return `<codex_skill_adapter>
## Skill Invocation
- This skill is invoked by mentioning \`${invocation}\`.
- Treat all user text after \`${invocation}\` as the skill argument.

## Tool Mapping (Claude Code → Codex)
This skill was authored for Claude Code. Map these tool references:

| Claude Code | Codex Equivalent |
|-------------|------------------|
| \`AskUserQuestion\` | Ask the user directly in conversation |
| \`Task(subagent_type="Explore")\` | Research the codebase yourself using available tools |
| \`Task(prompt="...")\` | \`spawn_agent(message="...")\` |
| \`Read\` | \`read_file\` |
| \`Write\` | \`write_file\` |
| \`Edit\` | \`patch\` |
| \`Bash\` | \`shell\` |
| \`Glob\` | \`glob\` / \`list_directory\` |
| \`Grep\` | \`grep\` / \`search\` |
| \`TaskCreate/TaskUpdate\` | Track progress internally |
| \`EnterPlanMode\` | Not available — use structured output instead |

## Guard Rules (replaces plan-guard hook)
During planning phases (plan-feature, plan-implementation):
- Do NOT write to any file outside \`.5/\`
- Do NOT write source code — only specifications and plans
- Do NOT spawn implementation agents — only Explore/research agents
</codex_skill_adapter>`;
}

// Convert a Claude command .md file into a Codex SKILL.md
function convertClaudeCommandToCodexSkill(content, skillName) {
  const converted = convertClaudeToCodexMarkdown(content);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);

  let description = `Run 5-Phase Workflow: ${skillName}`;
  if (frontmatter) {
    const maybeDesc = extractFrontmatterField(frontmatter, 'description');
    if (maybeDesc) description = maybeDesc;
  }

  // Truncate description for metadata
  const shortDesc = description.length > 180 ? `${description.slice(0, 177)}...` : description;
  const adapter = getCodexSkillAdapterHeader(skillName);

  return `---
name: ${skillName}
description: ${description}
metadata:
  short-description: ${shortDesc}
---

${adapter}

${body.trimStart()}`;
}

// Convert a Claude SKILL.md to Codex-compatible SKILL.md (lighter conversion, no adapter needed for skills)
function convertClaudeSkillToCodexSkill(content) {
  return convertClaudeToCodexMarkdown(content);
}

// Get file manifest for Codex installs (skills-based structure)
function getCodexFileManifest() {
  const managed = getWorkflowManagedFiles();
  const manifest = [];

  // Commands become skills
  // Each command file in commands/5/ becomes skills/5-{name}/SKILL.md
  const commandsSrc = path.join(getSourcePath(), 'commands', '5');
  if (fs.existsSync(commandsSrc)) {
    const files = fs.readdirSync(commandsSrc).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const name = file.replace('.md', '');
      manifest.push(`skills/5-${name}`);
    }
  }

  // Original skills also become Codex skills
  for (const skill of managed.skills) {
    manifest.push(`skills/${skill}`);
  }

  // Templates are copied as-is
  for (const template of managed.templates) {
    manifest.push(`templates/${template}`);
  }

  // References are copied as-is
  if (managed.references) {
    for (const ref of managed.references) {
      manifest.push(`references/${ref}`);
    }
  }

  // Instructions file
  manifest.push('instructions.md');

  return manifest;
}

// ── End Codex conversion functions ──────────────────────────────────────────

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

  // Update specific references
  if (managed.references && managed.references.length > 0) {
    const referencesSrc = path.join(sourcePath, 'references');
    const referencesDest = path.join(targetPath, 'references');
    if (!fs.existsSync(referencesDest)) {
      fs.mkdirSync(referencesDest, { recursive: true });
    }
    for (const ref of managed.references) {
      const src = path.join(referencesSrc, ref);
      const dest = path.join(referencesDest, ref);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }
    log.success('Updated references/ (workflow files only)');
  }
}

// Clean up files that were previously installed but are no longer managed
function cleanupOrphanedFiles(targetPath, dataDir) {
  const versionFile = path.join(dataDir, 'version.json');
  const currentManifest = getFileManifest();
  const currentSet = new Set(currentManifest);

  let oldManifest = null;
  if (fs.existsSync(versionFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      oldManifest = data.manifest || null;
    } catch (e) {
      // Corrupted file, treat as no manifest
    }
  }

  if (oldManifest) {
    // Manifest exists: diff old vs current, delete orphans
    for (const entry of oldManifest) {
      if (!currentSet.has(entry)) {
        const fullPath = path.join(targetPath, entry);
        if (fs.existsSync(fullPath)) {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            removeDir(fullPath);
          } else {
            fs.unlinkSync(fullPath);
          }
          log.info(`Removed orphaned: ${entry}`);
        }
      }
    }
  } else {
    // No manifest (legacy upgrade): use static legacy removals list
    for (const entry of LEGACY_REMOVED_FILES) {
      const fullPath = path.join(targetPath, entry);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        log.info(`Removed legacy orphan: ${entry}`);
      }
    }
  }
}

// Ensure .5/.gitignore exists and contains .update-cache.json
function ensureDotFiveGitignore(dataDir) {
  const gitignorePath = path.join(dataDir, '.gitignore');
  const entry = '.update-cache.json';
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    if (!content.includes(entry)) {
      fs.appendFileSync(gitignorePath, '\n' + entry + '\n');
    }
  } else {
    fs.writeFileSync(gitignorePath, entry + '\n');
  }
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
    installedAt: now,
    lastUpdated: now,
    installationType: isGlobal ? 'global' : 'local',
    manifest: getFileManifest()
  };

  fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));
  ensureDotFiveGitignore(dataDir);
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
  if (activeRuntime === 'codex') {
    // Codex: commands are installed as skills/5-plan-feature/SKILL.md
    const markerFile = path.join(targetPath, 'skills', '5-plan-feature', 'SKILL.md');
    return fs.existsSync(markerFile);
  }
  const markerFile = path.join(targetPath, 'commands', '5', 'plan-feature.md');
  return fs.existsSync(markerFile);
}

// Helper to show commands
function showCommandsHelp(isGlobal) {
  if (activeRuntime === 'codex') {
    log.info('Available skills (invoke with $ prefix in Codex):');
    log.info('  $5-plan-feature              - Start feature planning (Phase 1)');
    log.info('  $5-plan-implementation       - Create implementation plan (Phase 2)');
    log.info('  $5-implement-feature         - Execute implementation (Phase 3)');
    log.info('  $5-verify-implementation     - Verify implementation (Phase 4)');
    log.info('  $5-review-code               - Code review (Phase 5)');
    log.info('  $5-address-review-findings   - Apply review findings & PR comments');
    log.info('  $5-configure                 - Interactive project setup');
    log.info('  $5-reconfigure               - Refresh docs/skills (no Q&A)');
    log.info('  $5-eject                     - Eject from update mechanism');
    log.info('  $5-unlock                    - Remove planning guard lock');
  } else {
    log.info('Available commands:');
    log.info('  /5:plan-feature              - Start feature planning (Phase 1)');
    log.info('  /5:plan-implementation       - Create implementation plan (Phase 2)');
    log.info('  /5:implement-feature         - Execute implementation (Phase 3)');
    log.info('  /5:verify-implementation     - Verify implementation (Phase 4)');
    log.info('  /5:review-code               - Code review (Phase 5)');
    log.info('  /5:address-review-findings   - Apply review findings & PR comments');
    log.info('  /5:configure                 - Interactive project setup');
    log.info('  /5:reconfigure               - Refresh docs/skills (no Q&A)');
    log.info('  /5:eject                     - Eject from update mechanism');
    log.info('  /5:unlock                    - Remove planning guard lock');
  }
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
  const dirs = ['commands', 'agents', 'skills', 'hooks', 'templates', 'references'];
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
  log.info('Tip: Configure will offer to install helpful plugins like skill-creator');

  showCommandsHelp(isGlobal);
}

// Perform update (preserves user-created files, updates .5/ data directory)
function performUpdate(targetPath, sourcePath, isGlobal, versionInfo) {
  log.header(`Updating from ${versionInfo.installed || 'legacy'} to ${versionInfo.available}`);
  log.info('Preserving user-created commands, agents, skills, and hooks');

  // Selectively update only workflow-managed files (preserves user content)
  selectiveUpdate(targetPath, sourcePath);

  // Clean up orphaned files from previous versions
  const dataDir = getDataPath(isGlobal);
  cleanupOrphanedFiles(targetPath, dataDir);

  // Merge settings (deep merge preserves user customizations)
  mergeSettings(targetPath, sourcePath);

  // Update version.json
  const versionFile = path.join(dataDir, 'version.json');
  const now = new Date().toISOString();

  const existing = fs.existsSync(versionFile)
    ? JSON.parse(fs.readFileSync(versionFile, 'utf8'))
    : {};
  const versionData = {
    packageVersion: versionInfo.available,
    installedAt: existing.installedAt || now,
    lastUpdated: now,
    installationType: existing.installationType || (isGlobal ? 'global' : 'local'),
    manifest: getFileManifest()
  };

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));
  ensureDotFiveGitignore(dataDir);

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

// ── Codex install/update/uninstall ──────────────────────────────────────────

// Generate instructions.md for Codex (replaces hooks + settings.json)
function generateCodexInstructions(targetPath) {
  const content = `# 5-Phase Workflow — Codex Instructions

This file is managed by the 5-Phase Workflow installer. It provides Codex with
the context it needs to run the workflow skills correctly.

## Workflow Overview

The 5-Phase Workflow provides structured feature development:

1. **Plan Feature** (\`$5-plan-feature\`) — Requirements gathering & feature spec
2. **Plan Implementation** (\`$5-plan-implementation\`) — Technical planning
3. **Implement Feature** (\`$5-implement-feature\`) — Orchestrated implementation
4. **Verify Implementation** (\`$5-verify-implementation\`) — Build & test verification
5. **Review Code** (\`$5-review-code\`) — Code review

## Data Directory

All workflow state lives in \`.5/\` at the project root:
- \`.5/config.json\` — Project configuration
- \`.5/features/{name}/feature.md\` — Feature specifications
- \`.5/features/{name}/plan.md\` — Implementation plans
- \`.5/features/{name}/state.json\` — Implementation state

## Guard Rules

During planning phases (plan-feature, plan-implementation):
- Do NOT write files outside \`.5/\`
- Do NOT write source code — only specifications and plans
- The \`.5/.planning-active\` marker indicates planning is in progress

## Configuration

Run \`$5-configure\` after installation to set up your project.

## Templates & References

Templates are in \`.codex/templates/\` and references in \`.codex/references/\`.
Skills reference these paths for output formatting.
`;

  fs.writeFileSync(path.join(targetPath, 'instructions.md'), content);
  log.success('Generated instructions.md');
}

// Install commands as Codex skills
function installCodexSkills(targetPath, sourcePath) {
  const commandsSrc = path.join(sourcePath, 'commands', '5');
  const skillsDest = path.join(targetPath, 'skills');

  if (!fs.existsSync(commandsSrc)) return;

  const files = fs.readdirSync(commandsSrc).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const name = file.replace('.md', '');
    const skillName = `5-${name}`;
    const content = fs.readFileSync(path.join(commandsSrc, file), 'utf8');
    const converted = convertClaudeCommandToCodexSkill(content, skillName);

    const skillDir = path.join(skillsDest, skillName);
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), converted);
  }
  log.success(`Installed ${files.length} workflow skills`);

  // Also convert and install original workflow skills (configure-docs-index, configure-skills, generate-readme)
  const managed = getWorkflowManagedFiles();
  for (const skill of managed.skills) {
    const skillSrc = path.join(sourcePath, 'skills', skill);
    if (!fs.existsSync(skillSrc)) continue;

    const skillDestDir = path.join(skillsDest, skill);
    if (!fs.existsSync(skillDestDir)) {
      fs.mkdirSync(skillDestDir, { recursive: true });
    }

    // Copy all files in the skill directory, converting .md files
    const skillFiles = fs.readdirSync(skillSrc);
    for (const sf of skillFiles) {
      const srcFile = path.join(skillSrc, sf);
      const destFile = path.join(skillDestDir, sf);
      if (sf.endsWith('.md')) {
        const content = fs.readFileSync(srcFile, 'utf8');
        fs.writeFileSync(destFile, convertClaudeSkillToCodexSkill(content));
      } else {
        fs.copyFileSync(srcFile, destFile);
      }
    }
  }
  log.success('Installed utility skills');
}

// Codex fresh installation
function performCodexFreshInstall(targetPath, sourcePath, isGlobal) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
    log.success(`Created ${targetPath}`);
  }

  // Install commands as Codex skills
  installCodexSkills(targetPath, sourcePath);

  // Copy templates and references as-is (just path conversion)
  for (const dir of ['templates', 'references']) {
    const src = path.join(sourcePath, dir);
    const dest = path.join(targetPath, dir);
    if (fs.existsSync(src)) {
      copyDir(src, dest);
      log.success(`Installed ${dir}/`);
    }
  }

  // Generate instructions.md (replaces hooks + settings.json)
  generateCodexInstructions(targetPath);

  // Initialize version tracking (shared .5/ directory)
  initializeVersionJson(isGlobal);

  log.header('Codex Installation Complete!');
  log.info('');
  log.info('Next step: Configure your project');
  log.info('Mention: $5-configure');
  log.info('');
  log.info('This will:');
  log.info('  • Detect your project type and build commands');
  log.info('  • Set up ticket tracking conventions');
  log.info('  • Generate comprehensive documentation');
  log.info('  • Create project-specific skills');

  showCommandsHelp(isGlobal);
}

// Codex selective update
function codexSelectiveUpdate(targetPath, sourcePath) {
  // Remove old skills and re-install
  const managed = getWorkflowManagedFiles();
  const skillsDest = path.join(targetPath, 'skills');

  // Remove workflow command skills (5-*)
  const commandsSrc = path.join(sourcePath, 'commands', '5');
  if (fs.existsSync(commandsSrc)) {
    const files = fs.readdirSync(commandsSrc).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const name = file.replace('.md', '');
      const skillDir = path.join(skillsDest, `5-${name}`);
      if (fs.existsSync(skillDir)) removeDir(skillDir);
    }
  }

  // Remove utility skills
  for (const skill of managed.skills) {
    const skillDir = path.join(skillsDest, skill);
    if (fs.existsSync(skillDir)) removeDir(skillDir);
  }

  // Re-install all skills
  installCodexSkills(targetPath, sourcePath);

  // Update templates and references
  for (const dir of ['templates', 'references']) {
    const src = path.join(sourcePath, dir);
    const dest = path.join(targetPath, dir);
    if (fs.existsSync(src)) {
      if (fs.existsSync(dest)) removeDir(dest);
      copyDir(src, dest);
    }
  }
  log.success('Updated templates and references');

  // Regenerate instructions.md
  generateCodexInstructions(targetPath);
}

// Codex update
function performCodexUpdate(targetPath, sourcePath, isGlobal, versionInfo) {
  log.header(`Updating Codex install from ${versionInfo.installed || 'legacy'} to ${versionInfo.available}`);
  log.info('Preserving user-created skills');

  codexSelectiveUpdate(targetPath, sourcePath);

  // Clean up orphaned files
  const dataDir = getDataPath(isGlobal);
  cleanupOrphanedFiles(targetPath, dataDir);

  // Update version.json
  const versionFile = path.join(dataDir, 'version.json');
  const now = new Date().toISOString();
  const existing = fs.existsSync(versionFile)
    ? JSON.parse(fs.readFileSync(versionFile, 'utf8'))
    : {};
  const versionData = {
    packageVersion: versionInfo.available,
    installedAt: existing.installedAt || now,
    lastUpdated: now,
    installationType: existing.installationType || (isGlobal ? 'global' : 'local'),
    manifest: getFileManifest()
  };

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));
  ensureDotFiveGitignore(dataDir);

  const featuresDir = path.join(dataDir, 'features');
  if (!fs.existsSync(featuresDir)) {
    fs.mkdirSync(featuresDir, { recursive: true });
  }

  log.header('Update Complete!');
  log.success(`Now running version ${versionInfo.available}`);
  showCommandsHelp(isGlobal);
}

// Codex uninstallation
function codexUninstall() {
  const targetPath = getTargetPath(false);

  log.header('5-Phase Workflow Uninstallation (Codex)');
  log.info(`Target: ${targetPath}`);

  if (!checkExistingInstallation(targetPath)) {
    log.warn('No Codex installation found at this location');
    return;
  }

  // Remove workflow command skills (5-*)
  const commandsSrc = path.join(getSourcePath(), 'commands', '5');
  if (fs.existsSync(commandsSrc)) {
    const files = fs.readdirSync(commandsSrc).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const name = file.replace('.md', '');
      const skillDir = path.join(targetPath, 'skills', `5-${name}`);
      if (fs.existsSync(skillDir)) removeDir(skillDir);
    }
    log.success('Removed workflow skills');
  }

  // Remove utility skills
  const managed = getWorkflowManagedFiles();
  for (const skill of managed.skills) {
    const skillDir = path.join(targetPath, 'skills', skill);
    if (fs.existsSync(skillDir)) removeDir(skillDir);
  }
  log.success('Removed utility skills (preserved user-created skills)');

  // Remove templates
  for (const template of managed.templates) {
    const templatePath = path.join(targetPath, 'templates', template);
    if (fs.existsSync(templatePath)) fs.unlinkSync(templatePath);
  }
  log.success('Removed workflow templates');

  // Remove references
  if (managed.references) {
    for (const ref of managed.references) {
      const refPath = path.join(targetPath, 'references', ref);
      if (fs.existsSync(refPath)) fs.unlinkSync(refPath);
    }
    log.success('Removed workflow references');
  }

  // Remove instructions.md
  const instructionsPath = path.join(targetPath, 'instructions.md');
  if (fs.existsSync(instructionsPath)) {
    fs.unlinkSync(instructionsPath);
    log.success('Removed instructions.md');
  }

  // Remove data directory (.5/)
  const dataDir = getDataPath(false);
  if (fs.existsSync(dataDir)) {
    removeDir(dataDir);
    log.success('Removed .5/ data directory');
  }

  log.header('Uninstallation Complete!');
}

// ── End Codex install/update/uninstall ──────────────────────────────────────

// Perform installation
function install(isGlobal, forceUpgrade = false) {
  const targetPath = getTargetPath(isGlobal);
  const sourcePath = getSourcePath();

  const runtimeLabel = activeRuntime === 'codex' ? 'Codex' : 'Claude Code';
  log.header(`5-Phase Workflow Installation (${runtimeLabel})`);
  log.info(`Target: ${targetPath}`);
  log.info(`Source: ${sourcePath}`);

  // Migrate data from old .claude/.5/ to new .5/ location (Claude only)
  if (activeRuntime === 'claude') {
    migrateDataDir(isGlobal);
  }

  // Check for existing installation and version
  const versionInfo = getVersionInfo(targetPath, isGlobal);

  // Select the right install/update functions for this runtime
  const freshInstall = activeRuntime === 'codex' ? performCodexFreshInstall : performFreshInstall;
  const update = activeRuntime === 'codex' ? performCodexUpdate : performUpdate;

  if (versionInfo.exists) {
    if (versionInfo.legacy) {
      log.warn('Detected legacy installation (no version tracking)');
      log.info(`Upgrading from legacy install to ${versionInfo.available}`);
      update(targetPath, sourcePath, isGlobal, versionInfo);
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
          update(targetPath, sourcePath, isGlobal, versionInfo);
        });
        return; // Wait for user input
      }
      // Force upgrade, no prompt
      update(targetPath, sourcePath, isGlobal, versionInfo);
      return;
    } else {
      // Same version
      log.success(`Already installed (version ${versionInfo.installed})`);
      return;
    }
  }

  // Fresh install (no existing installation)
  freshInstall(targetPath, sourcePath, isGlobal);
}

// Perform uninstallation
function uninstall() {
  if (activeRuntime === 'codex') {
    codexUninstall();
    return;
  }

  const targetPath = getTargetPath(false); // Always local for uninstall

  log.header('5-Phase Workflow Uninstallation');
  log.info(`Target: ${targetPath}`);

  if (!checkExistingInstallation(targetPath)) {
    log.warn('No installation found at this location');
    return;
  }

  const managed = getWorkflowManagedFiles();

  // Remove legacy orphaned files that may still exist from older versions
  for (const entry of LEGACY_REMOVED_FILES) {
    const fullPath = path.join(targetPath, entry);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      log.info(`Removed legacy orphan: ${entry}`);
    }
  }

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

  // Remove only workflow-managed references
  if (managed.references) {
    for (const ref of managed.references) {
      const refPath = path.join(targetPath, 'references', ref);
      if (fs.existsSync(refPath)) {
        fs.unlinkSync(refPath);
      }
    }
    log.success('Removed workflow references (preserved user-created references)');
  }

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

  // Set module-level runtime before any path resolution
  activeRuntime = options.runtime;

  if (options.help) {
    showHelp();
    return;
  }

  if (options.check) {
    const targetPath = getTargetPath(options.global);
    migrateDataDir(options.global);
    const versionInfo = getVersionInfo(targetPath, options.global);

    if (!versionInfo.exists) {
      log.info(`Not installed (${activeRuntime})`);
      return;
    }

    log.info(`Runtime: ${activeRuntime}`);
    log.info(`Installed: ${versionInfo.installed || 'legacy (no version)'}`);
    log.info(`Available: ${versionInfo.available}`);

    if (versionInfo.needsUpdate) {
      log.warn('Update available');
      log.info(`Run: npx 5-phase-workflow${activeRuntime === 'codex' ? ' --codex' : ''} --upgrade`);
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
