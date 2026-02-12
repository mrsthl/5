#!/usr/bin/env node

// Plan Guard - PreToolUse Hook
// Prevents LLM breakout from planning phases by blocking:
// - Task agents other than Explore (when not in implementation mode)
// - Write/Edit operations outside .5/ (when not in implementation mode)
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

    // Short-circuit: only check Task, Write, and Edit tools
    if (toolName !== 'Task' && toolName !== 'Write' && toolName !== 'Edit') {
      process.exit(0);
    }

    const workspaceDir = data.cwd || data.workspace?.current_dir || process.cwd();

    // If no planning phase is active, allow all tools
    if (!isPlanningActive(workspaceDir)) {
      process.exit(0);
    }

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
        const blockCount = incrementBlockCount(workspaceDir);
        const escalation = blockCount >= 3
          ? ` WARNING: Block #${blockCount}. You are repeatedly attempting actions outside your planning role. STOP. Complete your planning artifact and output the completion message.`
          : '';
        process.stderr.write(
          `BLOCKED: Only Explore agents are allowed during planning phases. ` +
          `Attempted: subagent_type="${agentType}". ` +
          `REDIRECT: Return to your planning process. ` +
          `If you need codebase information, use subagent_type=Explore. ` +
          `If you are done planning, output the completion message and STOP.${escalation}`
        );
        process.exit(2);
      }
    }

    if (toolName === 'Write' || toolName === 'Edit') {
      const filePath = toolInput.file_path || '';
      if (filePath && !isInsideDotFive(filePath, workspaceDir)) {
        const blockCount = incrementBlockCount(workspaceDir);
        const isSourceFile = !filePath.includes('.5/') && !filePath.includes('.claude/');
        const escalation = blockCount >= 3
          ? ` WARNING: Block #${blockCount}. Repeated violations. Complete your planning artifact and STOP.`
          : '';
        const redirectMsg = isSourceFile
          ? `REDIRECT: You are in a planning phase. You may ONLY write to .5/features/. ` +
            `Source file creation happens in Phase 3 (/5:implement-feature).`
          : `REDIRECT: The path "${filePath}" is outside the allowed .5/ directory. ` +
            `Check your file path — you should be writing to .5/features/{name}/.`;
        process.stderr.write(
          `BLOCKED: ${toolName} outside .5/ is not allowed during planning phases. ` +
          `Attempted: "${filePath}". ${redirectMsg}${escalation}`
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
  return resolved.startsWith(dotFiveDir + path.sep) ||
         resolved === dotFiveDir;
}

function getTargetFeature(toolName, toolInput, workspaceDir) {
  // Extract the feature name from the tool input context
  const featuresDir = path.join(workspaceDir, '.5', 'features');

  if (toolName === 'Write' || toolName === 'Edit') {
    // Check if the file path is inside a feature directory
    const filePath = toolInput.file_path || '';
    const resolved = path.resolve(workspaceDir, filePath);
    if (resolved.startsWith(featuresDir + path.sep)) {
      // Extract feature name: .5/features/{feature-name}/...
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

function isPlanningActive(workspaceDir) {
  const markerPath = path.join(workspaceDir, '.5', '.planning-active');
  if (!fs.existsSync(markerPath)) return false;
  try {
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    if (marker.startedAt) {
      const elapsed = Date.now() - new Date(marker.startedAt).getTime();
      if (elapsed > 4 * 60 * 60 * 1000) {
        try { fs.unlinkSync(markerPath); } catch (e) {}
        return false;
      }
    }
    return true;
  } catch (e) {
    return true; // Unreadable marker → fail-safe, assume active
  }
}

function incrementBlockCount(workspaceDir) {
  const markerPath = path.join(workspaceDir, '.5', '.planning-active');
  try {
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    marker.blockCount = (marker.blockCount || 0) + 1;
    fs.writeFileSync(markerPath, JSON.stringify(marker, null, 2));
    return marker.blockCount;
  } catch (e) {
    return 1;
  }
}

function isFeatureInImplementationMode(workspaceDir, featureName) {
  // Check if this specific feature has a state.json (created in Phase 3)
  const stateFile = path.join(
    workspaceDir, '.5', 'features', featureName, 'state.json'
  );
  return fs.existsSync(stateFile);
}
