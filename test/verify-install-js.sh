#!/bin/bash
# Verification script to check that workflow-owned files are listed in install.js.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "========================================"
echo "Verifying install.js Configuration"
echo "========================================"
echo ""

node <<'NODE'
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const NC = '\x1b[0m';

function listEntries(dir, options = {}) {
  if (!fs.existsSync(dir)) return [];

  const entries = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (options.directoriesOnly && entry.isDirectory()) {
      entries.push(entry.name);
    } else if (options.filesOnly && entry.isFile()) {
      entries.push(entry.name);
    }
  }
  return entries.sort();
}

function listFilesRecursive(rootDir) {
  if (!fs.existsSync(rootDir)) return [];

  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push(path.relative(rootDir, fullPath).split(path.sep).join('/'));
      }
    }
  }
  walk(rootDir);
  return files.sort();
}

function getManagedFiles() {
  const source = fs.readFileSync('bin/install.js', 'utf8');
  const start = source.indexOf('function getWorkflowManagedFiles()');
  const end = source.indexOf('// Flatten getWorkflowManagedFiles()', start);
  if (start === -1 || end === -1) {
    throw new Error('Could not locate getWorkflowManagedFiles() in bin/install.js');
  }

  const context = {};
  vm.runInNewContext(`${source.slice(start, end)}\nmanaged = getWorkflowManagedFiles();`, context);
  return context.managed;
}

function compareLists(category, repoList, installList) {
  console.log(`=== ${category} ===`);
  console.log('');
  console.log('Files in repository:');
  console.log(repoList.join('\n') || '(none)');
  console.log('');
  console.log('Listed in install.js:');
  console.log(installList.join('\n') || '(none)');
  console.log('');

  const repoSet = new Set(repoList);
  const installSet = new Set(installList);
  const missing = repoList.filter(file => !installSet.has(file));
  const extra = installList.filter(file => !repoSet.has(file));

  if (missing.length > 0 || extra.length > 0) {
    if (missing.length > 0) {
      console.log(`${RED}Missing from install.js:${NC}`);
      for (const file of missing) console.log(`  - ${file}`);
    }
    if (extra.length > 0) {
      console.log(`${RED}Listed in install.js but missing from repository:${NC}`);
      for (const file of extra) console.log(`  - ${file}`);
    }
    console.log('');
    return 1;
  }

  console.log(`${GREEN}All files listed in install.js${NC}`);
  console.log('');
  return 0;
}

const managed = getManagedFiles();
let errors = 0;

function verifyReviewContract() {
  console.log('=== Review Contract ===');
  console.log('');

  const addressCommand = fs.readFileSync('src/commands/5/address-review-findings.md', 'utf8');
  const reviewCommand = fs.readFileSync('src/commands/5/review.md', 'utf8');
  const implementCommand = fs.readFileSync('src/commands/5/implement.md', 'utf8');
  const install = fs.readFileSync('bin/install.js', 'utf8');
  const required = [
    {
      label: 'review delegates to the built-in code-review skill',
      ok: reviewCommand.includes('Skill(skill: "code-review"')
    },
    {
      label: 'review keeps a fallback path for runtimes without the skill',
      ok: reviewCommand.includes('**Fallback path**')
    },
    {
      label: 'review no longer references CodeRabbit',
      ok: !/coderabbit/i.test(reviewCommand)
    },
    {
      label: 'security-review runs once, in /5:review, on security-sensitive diffs',
      ok: reviewCommand.includes('Skill(skill: "security-review")') && !implementCommand.includes('Skill(skill: "security-review")')
    },
    {
      label: 'Codex adapter maps security-review',
      ok: install.includes('Skill(skill="security-review")')
    },
    {
      label: 'address-review applies fixes itself, without helper commands',
      ok: !/\/5:(apply-review-findings|triage-pr-comments|reply-pr-comments)/.test(addressCommand)
    }
  ];

  let failures = 0;
  for (const check of required) {
    if (check.ok) {
      console.log(`${GREEN}✓ ${check.label}${NC}`);
    } else {
      console.log(`${RED}✗ ${check.label}${NC}`);
      failures += 1;
    }
  }
  console.log('');
  return failures > 0 ? 1 : 0;
}

function verifyProjectInstructionsContract() {
  console.log('=== Project Instructions Contract ===');
  console.log('');

  const template = fs.readFileSync('src/templates/AGENTS.md', 'utf8');
  const agentsSkill = fs.readFileSync('src/skills/configure-agents-md/SKILL.md', 'utf8');
  const reviewStyle = fs.readFileSync('src/skills/review-style/SKILL.md', 'utf8');
  const settings = fs.readFileSync('src/settings.json', 'utf8');
  const required = [
    {
      label: 'AGENTS.md template is one marked block',
      ok: template.startsWith('<!-- foifi:start') && template.trimEnd().endsWith('<!-- foifi:end -->')
    },
    {
      label: 'configure-agents-md leaves content outside the block unchanged',
      ok: agentsSkill.includes('Leave every other byte unchanged') && !/overwrite `CLAUDE\.md`/.test(agentsSkill)
    },
    {
      label: 'review-style treats the foifi block as workflow rules',
      ok: reviewStyle.includes('<!-- foifi:start')
    },
    {
      label: 'Codex rules go into the AGENTS.md foifi block, not unread files',
      ok: fs.readFileSync('src/skills/configure-rules/SKILL.md', 'utf8').includes('## Codex: rules in AGENTS.md') && fs.readFileSync('bin/sync-agents.js', 'utf8').includes("path.join(root, 'AGENTS.md')") && !fs.readFileSync('bin/sync-agents.js', 'utf8').includes("'instructions.md'") && !fs.readFileSync('bin/install.js', 'utf8').includes('generateCodexInstructions') && agentsSkill.includes('5-sync:rules-start')
    },
    {
      label: 'config-guard hook is gone from settings.json',
      ok: !settings.includes('config-guard')
    }
  ];

  let failures = 0;
  for (const check of required) {
    if (check.ok) {
      console.log(`${GREEN}✓ ${check.label}${NC}`);
    } else {
      console.log(`${RED}✗ ${check.label}${NC}`);
      failures += 1;
    }
  }
  console.log('');
  return failures > 0 ? 1 : 0;
}

errors += compareLists(
  'Commands',
  listEntries('src/commands', { directoriesOnly: true }),
  [...(managed.commands || [])].sort()
);

errors += compareLists(
  'Codex-only Commands',
  listEntries('src/codex-commands', { filesOnly: true }),
  [...(managed.codexCommands || [])].sort()
);

errors += compareLists(
  'Agents',
  listEntries('src/agents', { filesOnly: true }),
  [...(managed.agents || [])].sort()
);

errors += compareLists(
  'Workflows',
  listEntries('src/workflows', { filesOnly: true }),
  [...(managed.workflows || [])].sort()
);

errors += compareLists(
  'Skills',
  listEntries('src/skills', { directoriesOnly: true }),
  [...(managed.skills || [])].sort()
);

errors += compareLists(
  'Hooks',
  listEntries('src/hooks', { filesOnly: true }),
  [...(managed.hooks || [])].sort()
);

errors += compareLists(
  'Templates',
  listFilesRecursive('src/templates'),
  [...(managed.templates || [])].sort()
);

errors += compareLists(
  'References',
  listFilesRecursive('src/references'),
  [...(managed.references || [])].sort()
);

errors += compareLists(
  'Helper Binaries',
  listEntries('bin', { filesOnly: true }).filter(file => file === 'sync-agents.js'),
  [...(managed.binHelpers || [])].sort()
);

function verifySyncAgentsSkills() {
  console.log('=== sync-agents.js Managed Skills ===');
  console.log('');

  const source = fs.readFileSync('bin/sync-agents.js', 'utf8');
  const match = source.match(/const WORKFLOW_MANAGED_SKILLS = new Set\(\[([\s\S]*?)\]\)/);
  const syncSkills = match ? [...match[1].matchAll(/'([^']+)'/g)].map(m => m[1]).sort() : [];
  const installSkills = [...(managed.skills || [])].sort();

  if (syncSkills.join('\n') === installSkills.join('\n')) {
    console.log(`${GREEN}✓ WORKFLOW_MANAGED_SKILLS matches install.js skills${NC}`);
    console.log('');
    return 0;
  }
  console.log(`${RED}✗ WORKFLOW_MANAGED_SKILLS differs from install.js skills${NC}`);
  console.log(`  sync-agents.js: ${syncSkills.join(', ') || '(none found)'}`);
  console.log(`  install.js:     ${installSkills.join(', ')}`);
  console.log('');
  return 1;
}

function verifyPlanModeContract() {
  console.log('=== Plan Mode Contract ===');
  console.log('');

  const planCommand = fs.readFileSync('src/codex-commands/plan.md', 'utf8');
  const agentsTemplate = fs.readFileSync('src/templates/AGENTS.md', 'utf8');
  const implementCommand = fs.readFileSync('src/commands/5/implement.md', 'utf8');
  const configureCommand = fs.readFileSync('src/commands/5/configure.md', 'utf8');
  const reviewCommand = fs.readFileSync('src/commands/5/review.md', 'utf8');
  const orchestratorAgent = fs.readFileSync('src/agents/step-orchestrator-agent.md', 'utf8');
  const settings = fs.readFileSync('src/settings.json', 'utf8');
  const workflow = fs.readFileSync('src/workflows/5-implement.js', 'utf8');

  const required = [
    {
      label: 'Claude Code has no plan command and plans have no prescribed template',
      ok: !fs.existsSync('src/commands/5/plan.md') && agentsTemplate.includes('## Planning') && !fs.existsSync('src/templates/workflow/PLAN.md')
    },
    {
      label: 'AGENTS.md hands an approved plan to /5:implement',
      ok: agentsTemplate.includes('After the user approves a plan, run `/5:implement {plan-path}`')
    },
    {
      label: 'Codex plan command writes to .5/planning and hands off to /5:implement',
      ok: planCommand.includes('.5/planning/{name}.md') && planCommand.includes('/5:implement {name}') && !planCommand.includes('EnterPlanMode')
    },
    {
      label: 'native plan mode file is the only planning artifact',
      ok: !planCommand.includes('codebase-scan') && !workflow.includes('paths.scan')
    },
    {
      label: 'configure points plan mode at .5/planning',
      ok: configureCommand.includes('`plansDirectory`') && configureCommand.includes('".5/planning"')
    },
    {
      label: 'implement finds plans by path, file name, or feature frontmatter',
      ok: implementCommand.includes('`{argument}.md`') && implementCommand.includes('`feature: {argument}`')
    },
    {
      label: 'implement runs /5:review once, scoped to the run, before auto-commit',
      ok: implementCommand.includes('Run `/5:review since {fixed-point} files: {run-files} feature: {feature-name} dirty: {dirty-files}`') && reviewCommand.includes('since {fixed-point} files: {paths} feature: {name} dirty: {paths}') && implementCommand.includes('do not commit; report it') && implementCommand.includes('Never stage a pre-run dirty file') && reviewCommand.includes('drop every finding whose file is not in `{paths}`') && !reviewCommand.includes('Ask once:') && implementCommand.includes('**After the Workflow route:**') && workflow.includes("phase('Review')") && workflow.includes("phase('Fix')") && !implementCommand.includes('Skill(skill: "review-style"') && implementCommand.indexOf('## Step 4: Review') < implementCommand.indexOf('## Step 5: Auto-commit')
    },
    {
      label: 'verification checks only built-and-works; review-style uses two reviewers',
      ok: !workflow.includes('quality:') && !/QUALITY:/.test(implementCommand) && fs.readFileSync('src/skills/review-style/SKILL.md', 'utf8').includes('One **style reviewer** for all styles together')
    },
    {
      label: 'review records review-style findings without fixing them',
      ok: reviewCommand.includes('Skill(skill: "review-style"') && reviewCommand.includes('report only')
    },
    {
      label: 'implement builds compact plans inline, without agents or the workflow',
      ok: implementCommand.includes('### Compact plan: implement inline') && /^allowed-tools:.*\bEdit\b/m.test(implementCommand) && !workflow.includes('isCompact')
    },
    {
      label: 'advisor is opt-in and its rule matches across workflow, prose loop, and executor agent',
      ok: (() => {
        const rule = (workflow.match(/const ADVISOR_RULE = '([^']+)'/) || [])[1];
        const executorAgent = fs.readFileSync('src/agents/step-executor-agent.md', 'utf8');
        const schema = fs.readFileSync('src/references/configure-tables.md', 'utf8');
        return !!rule && implementCommand.includes(rule) && executorAgent.includes(rule.replace('Advisor: if an advisor tool is available, c', 'c'))
          && workflow.includes('a.advisor &&') && schema.includes('"advisor": false');
      })()
    },
    {
      label: 'blocked components wait for the next step instead of retrying',
      ok: workflow.includes("result.status === 'blocked'") && implementCommand.includes('`STATUS: blocked` is no retry reason') && fs.readFileSync('src/agents/step-executor-agent.md', 'utf8').includes('BLOCKED_BY')
    },
    {
      label: 'fast path runs build and test after the change',
      ok: implementCommand.includes('**Fast-path check**') && implementCommand.includes('Run the configured build and test commands once')
    },
    {
      label: 'plan-guard hook is gone from settings.json',
      ok: !settings.includes('plan-guard')
    },
    {
      label: 'no source file references the planning-active marker',
      ok: !planCommand.includes('.planning-active') && !implementCommand.includes('.planning-active')
    },
    {
      label: 'implement persists no run state and creates no tasks',
      ok: !/state\.json|TaskCreate|completedComponents/.test(implementCommand) && !workflow.includes('completedComponents') && !orchestratorAgent.includes('resume')
    },
    {
      label: 'complex work and retries run on opus at medium effort',
      ok: workflow.includes("{ model: 'opus', effort: 'medium' }") && implementCommand.includes('`opus` at `effort: "medium"`') && orchestratorAgent.includes('"opus"')
    }
  ];

  let failures = 0;
  for (const check of required) {
    if (check.ok) {
      console.log(`${GREEN}✓ ${check.label}${NC}`);
    } else {
      console.log(`${RED}✗ ${check.label}${NC}`);
      failures += 1;
    }
  }
  console.log('');
  return failures > 0 ? 1 : 0;
}

errors += verifyReviewContract();
errors += verifyProjectInstructionsContract();
errors += verifySyncAgentsSkills();
errors += verifyPlanModeContract();

console.log('========================================');
if (errors === 0) {
  console.log(`${GREEN}All workflow files are properly listed in install.js${NC}`);
  console.log('');
  console.log('install.js verification PASSED');
} else {
  console.log(`${RED}Found ${errors} categories with manifest drift${NC}`);
  console.log('');
  console.log('Please update getWorkflowManagedFiles() in bin/install.js.');
  console.log('');
  console.log('install.js verification FAILED');
  process.exit(1);
}
NODE
