#!/usr/bin/env node

// Plan Guard - PreToolUse Hook
// Prevents LLM breakout from planning phases by blocking:
// - Task agents other than Explore (when not in implementation mode)
// - Write operations outside .5/ (when not in implementation mode)
//
// Implementation mode is detected by scanning .5/features/*/state.json
// for any feature with "status": "in-progress"

const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || '';

    // Short-circuit: only check Task and Write tools
    if (toolName !== 'Task' && toolName !== 'Write') {
      process.exit(0);
    }

    const workspaceDir = data.cwd || data.workspace?.current_dir || process.cwd();
    const toolInput = data.tool_input || {};

    // Check if any feature is in implementation mode
    if (isImplementationMode(workspaceDir)) {
      process.exit(0); // All tools allowed during implementation
    }

    // Planning mode enforcement
    if (toolName === 'Task') {
      const agentType = toolInput.subagent_type || '';
      if (agentType && agentType !== 'Explore') {
        process.stderr.write(
          `BLOCKED: Only Explore agents are allowed during planning phases. ` +
          `Attempted: subagent_type="${agentType}". ` +
          `To use other agent types, start implementation with /5:implement-feature.`
        );
        process.exit(2);
      }
    }

    if (toolName === 'Write') {
      const filePath = toolInput.file_path || '';
      if (filePath && !isInsideDotFive(filePath, workspaceDir)) {
        process.stderr.write(
          `BLOCKED: Writing outside .5/ is not allowed during planning phases. ` +
          `Attempted: "${filePath}". ` +
          `Planning commands may only write to .5/features/. ` +
          `To write source files, start implementation with /5:implement-feature.`
        );
        process.exit(2);
      }
    }

    process.exit(0);
  } catch (e) {
    // Silent failure - don't block on parse errors
    process.exit(0);
  }
});

function isInsideDotFive(filePath, workspaceDir) {
  const resolved = path.resolve(workspaceDir, filePath);
  const dotFiveDir = path.join(workspaceDir, '.5');
  const claudeDotFiveDir = path.join(workspaceDir, '.claude', '.5');
  return resolved.startsWith(dotFiveDir + path.sep) ||
         resolved.startsWith(claudeDotFiveDir + path.sep) ||
         resolved === dotFiveDir ||
         resolved === claudeDotFiveDir;
}

function isImplementationMode(workspaceDir) {
  // Scan .5/features/*/state.json for any "in-progress" status
  const featuresDir = path.join(workspaceDir, '.claude', '.5', 'features');

  if (!fs.existsSync(featuresDir)) {
    return false;
  }

  try {
    const features = fs.readdirSync(featuresDir, { withFileTypes: true });
    for (const entry of features) {
      if (!entry.isDirectory()) continue;
      const stateFile = path.join(featuresDir, entry.name, 'state.json');
      if (!fs.existsSync(stateFile)) continue;
      try {
        const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        if (state.status === 'in-progress') {
          return true;
        }
      } catch (e) {
        // Skip corrupted state files
      }
    }
  } catch (e) {
    // Can't read features dir - assume planning mode (safe default)
  }

  return false;
}
