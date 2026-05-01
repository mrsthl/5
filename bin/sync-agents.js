#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  dim: '\x1b[2m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}i${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${msg}${colors.reset}\n`),
  dim: (msg) => console.log(`  ${colors.dim}${msg}${colors.reset}`)
};

// ── Workflow-managed file lists (must match install.js) ────────────────────

const WORKFLOW_MANAGED_SKILLS = new Set([
  'configure-docs-index',
  'configure-skills',
  'generate-readme'
]);

const WORKFLOW_MANAGED_AGENTS = new Set([
  'component-executor.md',
  'step-executor-agent.md',
  'step-orchestrator-agent.md',
  'verification-agent.md'
]);

const RULES_SYNC_START = '<!-- 5-sync:rules-start -->';
const RULES_SYNC_END = '<!-- 5-sync:rules-end -->';
const AGENTS_SYNC_START = '<!-- 5-sync:agents-start -->';
const AGENTS_SYNC_END = '<!-- 5-sync:agents-end -->';

// ── Conversion functions (mirrors install.js logic) ────────────────────────

function extractFrontmatterAndBody(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: content };
  return { frontmatter: match[1], body: match[2] };
}

function extractFrontmatterField(frontmatter, field) {
  if (!frontmatter) return null;
  const match = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim() : null;
}

function claudeToCodexContent(content) {
  return content
    .replace(/\/5:([a-z0-9-]+)/g, (_, name) => `$5-${name}`)
    .replace(/\.claude\//g, '.codex/');
}

function codexToClaudeContent(content) {
  return content
    .replace(/\$5-([a-z0-9-]+)/g, (_, name) => `/5:${name}`)
    .replace(/\.codex\//g, '.claude/')
    .replace(/<codex_skill_adapter>[\s\S]*?<\/codex_skill_adapter>\n*/g, '');
}

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
| \`Agent(subagent_type="Explore")\` | Research the codebase yourself using available tools |
| \`Agent(prompt="...")\` | \`spawn_agent(message="...")\` |
| \`Read\` | \`read_file\` |
| \`Write\` | \`write_file\` |
| \`Edit\` | \`patch\` |
| \`Bash\` | \`shell\` |
| \`Glob\` | \`glob\` / \`list_directory\` |
| \`Grep\` | \`grep\` / \`search\` |
| \`TaskCreate/TaskUpdate\` | Track progress internally |
| \`EnterPlanMode\` | Not available — use structured output instead |

## Guard Rules
During the planning phase ($5-plan):
- Do NOT write source code.
- Do NOT write files outside \`.5/\`.
- Do NOT spawn implementation agents.
</codex_skill_adapter>`;
}

function convertClaudeCommandToCodexSkill(content, skillName) {
  const converted = claudeToCodexContent(content);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);

  let description = `Custom command: ${skillName}`;
  if (frontmatter) {
    const maybeDesc = extractFrontmatterField(frontmatter, 'description');
    if (maybeDesc) description = maybeDesc;
  }

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

function convertClaudeSkillToCodex(content) {
  return claudeToCodexContent(content);
}

function convertCodexSkillToClaude(content) {
  return codexToClaudeContent(content);
}

// ── File helpers ────────────────────────────────────────────────────────────

function copyDirContents(src, dest, transformMd) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirContents(srcPath, destPath, transformMd);
    } else if (transformMd && entry.name.endsWith('.md')) {
      const content = fs.readFileSync(srcPath, 'utf8');
      fs.writeFileSync(destPath, transformMd(content));
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function dirContentsEqual(dirA, dirB, transformFn) {
  if (!fs.existsSync(dirA) || !fs.existsSync(dirB)) return false;

  const filesA = fs.readdirSync(dirA).sort();
  const filesB = fs.readdirSync(dirB).sort();
  if (filesA.length !== filesB.length) return false;

  for (const file of filesA) {
    if (!filesB.includes(file)) return false;
    const pathA = path.join(dirA, file);
    const pathB = path.join(dirB, file);
    const statA = fs.statSync(pathA);
    const statB = fs.statSync(pathB);
    if (statA.isDirectory() !== statB.isDirectory()) return false;
    if (statA.isDirectory()) {
      if (!dirContentsEqual(pathA, pathB, transformFn)) return false;
    } else {
      let contentA = fs.readFileSync(pathA, 'utf8');
      const contentB = fs.readFileSync(pathB, 'utf8');
      if (file.endsWith('.md') && transformFn) {
        contentA = transformFn(contentA);
      }
      if (contentA !== contentB) return false;
    }
  }
  return true;
}

// ── Inventory ──────────────────────────────────────────────────────────────

function findProjectRoot() {
  // Walk up from cwd to find .5/ or .claude/ or .codex/
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.5')) ||
        fs.existsSync(path.join(dir, '.claude')) ||
        fs.existsSync(path.join(dir, '.codex'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function isClaudeInstalled(root) {
  return fs.existsSync(path.join(root, '.claude', 'commands', '5', 'plan.md')) ||
    fs.existsSync(path.join(root, '.claude', 'commands', '5', 'plan-feature.md'));
}

function isCodexInstalled(root) {
  return fs.existsSync(path.join(root, '.codex', 'skills', '5-plan', 'SKILL.md')) ||
    fs.existsSync(path.join(root, '.codex', 'skills', '5-plan-feature', 'SKILL.md'));
}

function getClaudeUserSkills(root) {
  const skillsDir = path.join(root, '.claude', 'skills');
  if (!fs.existsSync(skillsDir)) return [];
  return fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => !WORKFLOW_MANAGED_SKILLS.has(name));
}

function getCodexUserSkills(root) {
  const skillsDir = path.join(root, '.codex', 'skills');
  if (!fs.existsSync(skillsDir)) return [];
  return fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => !name.startsWith('5-') && !WORKFLOW_MANAGED_SKILLS.has(name));
}

function getClaudeCustomCommands(root) {
  const commandsDir = path.join(root, '.claude', 'commands');
  if (!fs.existsSync(commandsDir)) return [];
  const namespaces = fs.readdirSync(commandsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== '5')
    .map(d => d.name);

  const commands = [];
  for (const ns of namespaces) {
    const nsDir = path.join(commandsDir, ns);
    const files = fs.readdirSync(nsDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      commands.push({ namespace: ns, name: file.replace('.md', ''), file });
    }
  }
  return commands;
}

function getClaudeCustomAgents(root) {
  const agentsDir = path.join(root, '.claude', 'agents');
  if (!fs.existsSync(agentsDir)) return [];
  return fs.readdirSync(agentsDir)
    .filter(f => f.endsWith('.md') && !WORKFLOW_MANAGED_AGENTS.has(f));
}

function getClaudeRules(root) {
  const rulesDir = path.join(root, '.claude', 'rules');
  if (!fs.existsSync(rulesDir)) return [];
  return fs.readdirSync(rulesDir).filter(f => f.endsWith('.md'));
}

// ── Sync action classification ─────────────────────────────────────────────

function classifySkillActions(root) {
  const claudeSkills = getClaudeUserSkills(root);
  const codexSkills = getCodexUserSkills(root);
  const claudeSet = new Set(claudeSkills);
  const codexSet = new Set(codexSkills);

  const actions = [];

  // Claude → Codex
  for (const skill of claudeSkills) {
    const claudeDir = path.join(root, '.claude', 'skills', skill);
    const codexDir = path.join(root, '.codex', 'skills', skill);
    if (!codexSet.has(skill)) {
      actions.push({ type: 'new', direction: 'claude-to-codex', category: 'skill', name: skill });
    } else if (!dirContentsEqual(claudeDir, codexDir, convertClaudeSkillToCodex)) {
      actions.push({ type: 'updated', direction: 'claude-to-codex', category: 'skill', name: skill });
    } else {
      actions.push({ type: 'in-sync', direction: 'both', category: 'skill', name: skill });
    }
  }

  // Codex → Claude
  for (const skill of codexSkills) {
    if (claudeSet.has(skill)) continue; // Already handled above
    const claudeDir = path.join(root, '.claude', 'skills', skill);
    if (!fs.existsSync(claudeDir)) {
      actions.push({ type: 'new', direction: 'codex-to-claude', category: 'skill', name: skill });
    }
  }

  return actions;
}

function classifyCommandActions(root) {
  const commands = getClaudeCustomCommands(root);
  const actions = [];

  for (const cmd of commands) {
    const skillName = `${cmd.namespace}-${cmd.name}`;
    const codexSkillDir = path.join(root, '.codex', 'skills', skillName);
    if (!fs.existsSync(codexSkillDir)) {
      actions.push({ type: 'new', direction: 'claude-to-codex', category: 'command', name: `${cmd.namespace}/${cmd.name}`, skillName });
    } else {
      // Check if content changed
      const claudeContent = fs.readFileSync(path.join(root, '.claude', 'commands', cmd.namespace, cmd.file), 'utf8');
      const converted = convertClaudeCommandToCodexSkill(claudeContent, skillName);
      const existing = fs.readFileSync(path.join(codexSkillDir, 'SKILL.md'), 'utf8');
      if (converted !== existing) {
        actions.push({ type: 'updated', direction: 'claude-to-codex', category: 'command', name: `${cmd.namespace}/${cmd.name}`, skillName });
      } else {
        actions.push({ type: 'in-sync', direction: 'both', category: 'command', name: `${cmd.namespace}/${cmd.name}` });
      }
    }
  }

  return actions;
}

function classifyRulesActions(root) {
  const rules = getClaudeRules(root);
  if (rules.length === 0) return [];

  const instructionsPath = path.join(root, '.codex', 'instructions.md');
  if (!fs.existsSync(instructionsPath)) {
    return [{ type: 'new', direction: 'claude-to-codex', category: 'rules', name: `${rules.length} rule file(s)` }];
  }

  const instructions = fs.readFileSync(instructionsPath, 'utf8');
  const newSection = buildRulesSection(root, rules);

  // Extract existing section
  const startIdx = instructions.indexOf(RULES_SYNC_START);
  const endIdx = instructions.indexOf(RULES_SYNC_END);
  if (startIdx === -1 || endIdx === -1) {
    return [{ type: 'new', direction: 'claude-to-codex', category: 'rules', name: `${rules.length} rule file(s)` }];
  }

  const existing = instructions.substring(startIdx, endIdx + RULES_SYNC_END.length);
  if (existing === newSection) {
    return [{ type: 'in-sync', direction: 'both', category: 'rules', name: `${rules.length} rule file(s)` }];
  }
  return [{ type: 'updated', direction: 'claude-to-codex', category: 'rules', name: `${rules.length} rule file(s)` }];
}

function classifyAgentActions(root) {
  const agents = getClaudeCustomAgents(root);
  if (agents.length === 0) return [];

  const instructionsPath = path.join(root, '.codex', 'instructions.md');
  if (!fs.existsSync(instructionsPath)) {
    return [{ type: 'new', direction: 'claude-to-codex', category: 'agents', name: `${agents.length} agent(s)` }];
  }

  const instructions = fs.readFileSync(instructionsPath, 'utf8');
  const newSection = buildAgentsSection(root, agents);

  const startIdx = instructions.indexOf(AGENTS_SYNC_START);
  const endIdx = instructions.indexOf(AGENTS_SYNC_END);
  if (startIdx === -1 || endIdx === -1) {
    return [{ type: 'new', direction: 'claude-to-codex', category: 'agents', name: `${agents.length} agent(s)` }];
  }

  const existing = instructions.substring(startIdx, endIdx + AGENTS_SYNC_END.length);
  if (existing === newSection) {
    return [{ type: 'in-sync', direction: 'both', category: 'agents', name: `${agents.length} agent(s)` }];
  }
  return [{ type: 'updated', direction: 'claude-to-codex', category: 'agents', name: `${agents.length} agent(s)` }];
}

// ── Build sync content ─────────────────────────────────────────────────────

function buildRulesSection(root, ruleFiles) {
  const rulesDir = path.join(root, '.claude', 'rules');
  let section = `${RULES_SYNC_START}\n## Project Rules\n\n`;
  section += '> Synced from .claude/rules/ — do not edit this section manually.\n';
  section += '> Re-run /5:synchronize-agents (or $5-synchronize-agents) to update.\n\n';

  for (const file of ruleFiles) {
    const content = fs.readFileSync(path.join(rulesDir, file), 'utf8');
    const { body } = extractFrontmatterAndBody(content);
    const name = file.replace('.md', '');
    section += `### ${name}\n\n${body.trim()}\n\n`;
  }

  section += RULES_SYNC_END;
  return section;
}

function buildAgentsSection(root, agentFiles) {
  const agentsDir = path.join(root, '.claude', 'agents');
  let section = `${AGENTS_SYNC_START}\n## Custom Agent References\n\n`;
  section += '> Synced from .claude/agents/ — do not edit this section manually.\n';
  section += '> In Codex, use `spawn_agent()` with equivalent instructions.\n\n';

  for (const file of agentFiles) {
    const content = fs.readFileSync(path.join(agentsDir, file), 'utf8');
    const converted = claudeToCodexContent(content);
    const name = file.replace('.md', '');
    section += `### ${name}\n\n${converted.trim()}\n\n`;
  }

  section += AGENTS_SYNC_END;
  return section;
}

function updateInstructionsSection(instructionsContent, startMarker, endMarker, newSection) {
  const startIdx = instructionsContent.indexOf(startMarker);
  const endIdx = instructionsContent.indexOf(endMarker);

  if (startIdx !== -1 && endIdx !== -1) {
    // Replace existing section
    return instructionsContent.substring(0, startIdx) +
      newSection +
      instructionsContent.substring(endIdx + endMarker.length);
  }
  // Append
  return instructionsContent.trimEnd() + '\n\n' + newSection + '\n';
}

// ── Execute sync ───────────────────────────────────────────────────────────

function executeSync(root, actions) {
  const counts = { 'claude-to-codex': { new: 0, updated: 0 }, 'codex-to-claude': { new: 0, updated: 0 }, synced: 0 };

  for (const action of actions) {
    if (action.type === 'in-sync') {
      counts.synced++;
      continue;
    }

    if (action.category === 'skill') {
      if (action.direction === 'claude-to-codex') {
        syncSkillClaudeToCodex(root, action.name);
      } else {
        syncSkillCodexToClaude(root, action.name);
      }
      counts[action.direction][action.type]++;
    } else if (action.category === 'command') {
      syncCommandClaudeToCodex(root, action);
      counts['claude-to-codex'][action.type]++;
    }
    // rules and agents are handled separately in batch
  }

  // Sync rules to instructions.md
  const ruleActions = actions.filter(a => a.category === 'rules' && a.type !== 'in-sync');
  if (ruleActions.length > 0) {
    syncRulesToInstructions(root);
    for (const a of ruleActions) counts['claude-to-codex'][a.type]++;
  }

  // Sync agents to instructions.md
  const agentActions = actions.filter(a => a.category === 'agents' && a.type !== 'in-sync');
  if (agentActions.length > 0) {
    syncAgentsToInstructions(root);
    for (const a of agentActions) counts['claude-to-codex'][a.type]++;
  }

  return counts;
}

function syncSkillClaudeToCodex(root, skillName) {
  const src = path.join(root, '.claude', 'skills', skillName);
  const dest = path.join(root, '.codex', 'skills', skillName);
  copyDirContents(src, dest, convertClaudeSkillToCodex);
  log.dim(`skill: ${skillName} → .codex/skills/${skillName}/`);
}

function syncSkillCodexToClaude(root, skillName) {
  const src = path.join(root, '.codex', 'skills', skillName);
  const dest = path.join(root, '.claude', 'skills', skillName);
  copyDirContents(src, dest, convertCodexSkillToClaude);
  log.dim(`skill: ${skillName} → .claude/skills/${skillName}/`);
}

function syncCommandClaudeToCodex(root, action) {
  const [ns, name] = action.name.split('/');
  const srcFile = path.join(root, '.claude', 'commands', ns, `${name}.md`);
  const content = fs.readFileSync(srcFile, 'utf8');
  const converted = convertClaudeCommandToCodexSkill(content, action.skillName);

  const destDir = path.join(root, '.codex', 'skills', action.skillName);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.writeFileSync(path.join(destDir, 'SKILL.md'), converted);
  log.dim(`command: ${action.name} → .codex/skills/${action.skillName}/`);
}

function syncRulesToInstructions(root) {
  const rules = getClaudeRules(root);
  const section = buildRulesSection(root, rules);
  const instructionsPath = path.join(root, '.codex', 'instructions.md');
  let content = fs.existsSync(instructionsPath) ? fs.readFileSync(instructionsPath, 'utf8') : '';
  content = updateInstructionsSection(content, RULES_SYNC_START, RULES_SYNC_END, section);
  fs.writeFileSync(instructionsPath, content);
  log.dim(`rules: ${rules.length} file(s) → .codex/instructions.md`);
}

function syncAgentsToInstructions(root) {
  const agents = getClaudeCustomAgents(root);
  const section = buildAgentsSection(root, agents);
  const instructionsPath = path.join(root, '.codex', 'instructions.md');
  let content = fs.existsSync(instructionsPath) ? fs.readFileSync(instructionsPath, 'utf8') : '';
  content = updateInstructionsSection(content, AGENTS_SYNC_START, AGENTS_SYNC_END, section);
  fs.writeFileSync(instructionsPath, content);
  log.dim(`agents: ${agents.length} file(s) → .codex/instructions.md`);
}

// ── Display ────────────────────────────────────────────────────────────────

function formatActionLabel(type) {
  if (type === 'new') return `${colors.green}NEW${colors.reset}`;
  if (type === 'updated') return `${colors.yellow}UPD${colors.reset}`;
  return `${colors.dim}OK${colors.reset}`;
}

function printSummary(actions) {
  const claudeToCodex = actions.filter(a => a.direction === 'claude-to-codex');
  const codexToClaude = actions.filter(a => a.direction === 'codex-to-claude');
  const inSync = actions.filter(a => a.type === 'in-sync');

  if (claudeToCodex.length > 0) {
    console.log('  Claude → Codex:');
    for (const a of claudeToCodex) {
      console.log(`    [${formatActionLabel(a.type)}] ${a.category}: ${a.name}`);
    }
  }

  if (codexToClaude.length > 0) {
    console.log('  Codex → Claude:');
    for (const a of codexToClaude) {
      console.log(`    [${formatActionLabel(a.type)}] ${a.category}: ${a.name}`);
    }
  }

  if (inSync.length > 0) {
    console.log(`  ${colors.dim}Already in sync: ${inSync.length} item(s)${colors.reset}`);
  }
}

function printResults(counts) {
  const c2c = counts['claude-to-codex'];
  const c2cl = counts['codex-to-claude'];
  const total = c2c.new + c2c.updated + c2cl.new + c2cl.updated;

  if (total === 0 && counts.synced > 0) {
    log.success(`Everything is already in sync (${counts.synced} item(s))`);
    return;
  }

  console.log('');
  if (c2c.new + c2c.updated > 0) {
    console.log(`  Claude → Codex: ${c2c.new} new, ${c2c.updated} updated`);
  }
  if (c2cl.new + c2cl.updated > 0) {
    console.log(`  Codex → Claude: ${c2cl.new} new, ${c2cl.updated} updated`);
  }
  if (counts.synced > 0) {
    console.log(`  ${colors.dim}Skipped: ${counts.synced} (already in sync)${colors.reset}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const quiet = args.includes('--quiet');

  const root = findProjectRoot();

  if (!quiet) {
    log.header('Synchronize Agent Runtimes');
  }

  // Step 1: Detect runtimes
  const hasClaude = isClaudeInstalled(root);
  const hasCodex = isCodexInstalled(root);

  if (!hasClaude && !hasCodex) {
    log.error('No runtime installations found.');
    log.info('Install Claude Code: npx foif');
    log.info('Install Codex: npx foif --codex');
    process.exit(1);
  }

  if (!hasClaude) {
    log.error('Claude Code runtime not installed.');
    log.info('Install with: npx foif');
    process.exit(1);
  }

  if (!hasCodex) {
    log.error('Codex runtime not installed.');
    log.info('Install with: npx foif --codex');
    process.exit(1);
  }

  if (!quiet) {
    log.success('Both runtimes detected');
  }

  // Step 2-3: Inventory and classify
  const actions = [
    ...classifySkillActions(root),
    ...classifyCommandActions(root),
    ...classifyRulesActions(root),
    ...classifyAgentActions(root)
  ];

  if (actions.length === 0) {
    log.info('No user-generated content found to synchronize.');
    process.exit(0);
  }

  const actionable = actions.filter(a => a.type !== 'in-sync');

  if (actionable.length === 0) {
    log.success(`Everything is already in sync (${actions.length} item(s))`);
    process.exit(0);
  }

  // Step 4: Show summary
  if (!quiet) {
    console.log('');
    printSummary(actions);
    console.log('');
  }

  if (dryRun) {
    log.info('Dry run — no changes made.');
    process.exit(0);
  }

  // Step 5: Execute
  const counts = executeSync(root, actions);

  // Step 6: Report
  if (!quiet) {
    log.header('Synchronization Complete');
    printResults(counts);
  }
}

main();
