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

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    global: false,
    local: false,
    uninstall: false,
    help: false
  };

  for (const arg of args) {
    if (arg === '--global' || arg === '-g') options.global = true;
    else if (arg === '--local' || arg === '-l') options.local = true;
    else if (arg === '--uninstall' || arg === '-u') options.uninstall = true;
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
  --uninstall, -u   Remove installation from current directory
  --help, -h        Show this help message

Examples:
  npx 5-phase-workflow              # Install locally
  npx 5-phase-workflow --global     # Install globally
  npx 5-phase-workflow --uninstall  # Remove from current directory
`);
}

// Get installation target path
function getTargetPath(isGlobal) {
  if (isGlobal) {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    return path.join(homeDir, '.claude');
  }
  return path.join(process.cwd(), '.claude');
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

// Detect project type by examining files in current directory
function detectProjectType() {
  const cwd = process.cwd();

  if (fs.existsSync(path.join(cwd, 'package.json'))) {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    if (pkg.dependencies?.['next'] || pkg.devDependencies?.['next']) return 'nextjs';
    if (pkg.dependencies?.['express'] || pkg.devDependencies?.['express']) return 'express';
    if (pkg.dependencies?.['@nestjs/core']) return 'nestjs';
    return 'javascript';
  }

  if (fs.existsSync(path.join(cwd, 'build.gradle')) || fs.existsSync(path.join(cwd, 'build.gradle.kts'))) {
    return 'gradle-java';
  }

  if (fs.existsSync(path.join(cwd, 'pom.xml'))) {
    return 'maven-java';
  }

  if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) {
    return 'rust';
  }

  if (fs.existsSync(path.join(cwd, 'go.mod'))) {
    return 'go';
  }

  if (fs.existsSync(path.join(cwd, 'requirements.txt')) || fs.existsSync(path.join(cwd, 'pyproject.toml'))) {
    const hasDjango = fs.existsSync(path.join(cwd, 'manage.py'));
    const hasFlask = fs.existsSync(path.join(cwd, 'app.py')) || fs.existsSync(path.join(cwd, 'wsgi.py'));
    if (hasDjango) return 'django';
    if (hasFlask) return 'flask';
    return 'python';
  }

  return 'unknown';
}

// Get default config based on project type
function getDefaultConfig(projectType) {
  const baseConfig = {
    ticket: {
      pattern: '[A-Z]+-\\d+',
      extractFromBranch: true
    },
    build: {
      command: 'auto',
      testCommand: 'auto'
    },
    reviewTool: 'auto'
  };

  // Project-specific overrides
  const overrides = {
    'gradle-java': {
      build: {
        command: './gradlew build -x test -x javadoc --offline',
        testCommand: './gradlew test --offline'
      }
    },
    'maven-java': {
      build: {
        command: 'mvn compile',
        testCommand: 'mvn test'
      }
    },
    'javascript': {
      build: {
        command: 'npm run build',
        testCommand: 'npm test'
      }
    },
    'nextjs': {
      build: {
        command: 'npm run build',
        testCommand: 'npm test'
      }
    },
    'express': {
      build: {
        command: 'npm run build || tsc',
        testCommand: 'npm test'
      }
    },
    'nestjs': {
      build: {
        command: 'npm run build',
        testCommand: 'npm test'
      }
    },
    'rust': {
      build: {
        command: 'cargo build',
        testCommand: 'cargo test'
      }
    },
    'go': {
      build: {
        command: 'go build ./...',
        testCommand: 'go test ./...'
      }
    },
    'python': {
      build: {
        command: 'python -m py_compile **/*.py',
        testCommand: 'pytest'
      }
    },
    'django': {
      build: {
        command: 'python manage.py check',
        testCommand: 'python manage.py test'
      }
    },
    'flask': {
      build: {
        command: 'python -m py_compile **/*.py',
        testCommand: 'pytest'
      }
    }
  };

  return {
    ...baseConfig,
    ...(overrides[projectType] || {}),
    projectType
  };
}

// Initialize config file
function initializeConfig(targetPath) {
  const configDir = path.join(targetPath, '.5');
  const configFile = path.join(configDir, 'config.json');

  if (fs.existsSync(configFile)) {
    log.info('Config file already exists, skipping initialization');
    return;
  }

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const projectType = detectProjectType();
  const config = getDefaultConfig(projectType);

  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  log.success(`Created config file with detected project type: ${projectType}`);
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
    const merged = { ...newSettings, ...existingSettings };
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

// Perform installation
function install(isGlobal) {
  const targetPath = getTargetPath(isGlobal);
  const sourcePath = getSourcePath();

  log.header('5-Phase Workflow Installation');
  log.info(`Target: ${targetPath}`);
  log.info(`Source: ${sourcePath}`);

  // Check if already installed
  const exists = checkExistingInstallation(targetPath);
  if (exists) {
    log.warn('Installation already exists at this location');
    log.info('To upgrade, run with --uninstall first, then reinstall');
    return;
  }

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

  // Initialize config
  if (!isGlobal) {
    initializeConfig(targetPath);
  }

  log.header('Installation Complete!');
  log.info('Available commands:');
  log.info('  /5:plan-feature          - Start feature planning (Phase 1)');
  log.info('  /5:plan-implementation   - Create implementation plan (Phase 2)');
  log.info('  /5:implement-feature     - Execute implementation (Phase 3)');
  log.info('  /5:verify-implementation - Verify implementation (Phase 4)');
  log.info('  /5:review-code          - Code review (Phase 5)');
  log.info('  /5:configure            - Interactive project setup');
  log.info('');
  log.info(`Config file: ${path.join(targetPath, '.5', 'config.json')}`);
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

  // Remove directories
  const dirs = ['commands/5', 'agents', 'skills', 'hooks', 'templates'];
  for (const dir of dirs) {
    const fullPath = path.join(targetPath, dir);
    if (fs.existsSync(fullPath)) {
      removeDir(fullPath);
      log.success(`Removed ${dir}`);
    }
  }

  // Remove config
  const configDir = path.join(targetPath, '.5');
  if (fs.existsSync(configDir)) {
    removeDir(configDir);
    log.success('Removed .5/ config directory');
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

  if (options.uninstall) {
    uninstall();
    return;
  }

  install(options.global);
}

main();
