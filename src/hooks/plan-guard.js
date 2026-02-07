#!/usr/bin/env node

// Plan Guard - PreToolUse Hook
// Prevents LLM breakout from planning phases by blocking:
// - Task agents other than Explore (when not in implementation mode)
// - Write operations outside .5/ (when not in implementation mode)
//
// Planning mode is detected per-feature by checking if that specific feature's
// state.json exists. Only the feature in implementation mode gets unrestricted
// tool access. Other features remain in planning mode.

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

    // Determine which feature is being targeted and check its state
    const targetFeature = getTargetFeature(toolName, toolInput, workspaceDir);
    if (targetFeature && isFeatureInImplementationMode(workspaceDir, targetFeature)) {
      process.exit(0); // Tools allowed for features in implementation mode
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

function getTargetFeature(toolName, toolInput, workspaceDir) {
  // Extract the feature name from the tool input context
  const featuresDir = path.join(workspaceDir, '.claude', '.5', 'features');

  if (toolName === 'Write' || toolName === 'Edit') {
    // Check if the file path is inside a feature directory
    const filePath = toolInput.file_path || '';
    const resolved = path.resolve(workspaceDir, filePath);
    if (resolved.startsWith(featuresDir + path.sep)) {
      // Extract feature name: .claude/.5/features/{feature-name}/...
      const relative = resolved.slice(featuresDir.length + 1);
      const featureName = relative.split(path.sep)[0];
      if (featureName) return featureName;
    }
  }

  if (toolName === 'Task') {
    // Check the task prompt for feature name references
    const prompt = toolInput.prompt || '';
    const desc = toolInput.description || '';
    const combined = prompt + ' ' + desc;

    // Try to match a feature directory that exists
    try {
      if (fs.existsSync(featuresDir)) {
        const features = fs.readdirSync(featuresDir, { withFileTypes: true });
        for (const entry of features) {
          if (!entry.isDirectory()) continue;
          if (combined.includes(entry.name)) {
            return entry.name;
          }
        }
      }
    } catch (e) {
      // Ignore read errors
    }
  }

  return null;
}

function isFeatureInImplementationMode(workspaceDir, featureName) {
  // Check if this specific feature has a state.json (created in Phase 3)
  const stateFile = path.join(
    workspaceDir, '.claude', '.5', 'features', featureName, 'state.json'
  );
  return fs.existsSync(stateFile);
}
