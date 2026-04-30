#!/usr/bin/env node

// Plan Guard - PreToolUse Hook
// Prevents LLM breakout from planning phases by blocking:
// - Agent/Task agents other than Explore (when not in implementation mode)
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

    // Short-circuit: only check Agent, Task, Write, Edit, EnterPlanMode, and Bash tools
    if (toolName !== 'Agent' && toolName !== 'Task' && toolName !== 'Write' && toolName !== 'Edit' && toolName !== 'EnterPlanMode' && toolName !== 'Bash') {
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
    if (toolName === 'EnterPlanMode') {
      const blockCount = incrementBlockCount(workspaceDir);
      const phase = getPlanningPhase(workspaceDir);
      const escalation = blockCount >= 3
        ? ` CRITICAL: Block #${blockCount}. You have attempted to break out of planning ${blockCount} times. You MUST return to your current step in the Progress Checklist, complete your planning artifact, output the completion message, and STOP. Do NOT attempt any other action.`
        : '';
      process.stderr.write(
        `BLOCKED: EnterPlanMode is not allowed during workflow planning. ` +
        `The 3-phase workflow has its own planning process. ` +
        `REDIRECT: You are in ${phase || 'a planning phase'}. Return to your Progress Checklist. ` +
        `Find the last "✓ Step N complete" you output, then continue with Step N+1. ` +
        `Write your output to .5/features/{name}/ and output the completion message when done.${escalation}`
      );
      process.exit(2);
    }

    if (toolName === 'Agent' || toolName === 'Task') {
      const agentType = toolInput.subagent_type || '';
      if (agentType && agentType !== 'Explore') {
        const blockCount = incrementBlockCount(workspaceDir);
        const phase = getPlanningPhase(workspaceDir);
        const escalation = blockCount >= 3
          ? ` CRITICAL: Block #${blockCount}. You are a planner, NOT an implementer. You have attempted to spawn non-Explore agents ${blockCount} times. Implementation happens in /5:implement. Return to your Progress Checklist immediately, complete your planning artifact, and STOP.`
          : '';
        process.stderr.write(
          `BLOCKED: Only Explore agents are allowed during planning. ` +
          `Attempted: subagent_type="${agentType}". ` +
          `You are in ${phase || 'the planning phase'}. Implementation agents are /5:implement only. ` +
          `REDIRECT: Return to your Progress Checklist. Find your last "✓ Step N complete" and continue with Step N+1. ` +
          `If you need codebase information, use subagent_type=Explore. ` +
          `If you are done planning, output the completion message and STOP.${escalation}`
        );
        process.exit(2);
      }
    }

    if (toolName === 'Bash') {
      const command = toolInput.command || '';
      // Detect file-writing shell commands that bypass Write/Edit guards
      const writePatterns = /\b(cat\s*>|cat\s*<<|echo\s.*>|tee\s|printf\s.*>|cp\s|mv\s|mkdir\s.*&&.*>|sed\s+-i|awk\s.*>|touch\s|install\s)/;
      if (writePatterns.test(command)) {
        const blockCount = incrementBlockCount(workspaceDir);
        const phase = getPlanningPhase(workspaceDir);
        const escalation = blockCount >= 3
          ? ` CRITICAL: Block #${blockCount}. You are repeatedly attempting to write files via Bash to bypass planning guards. STOP immediately.`
          : '';
        process.stderr.write(
          `BLOCKED: File-writing Bash commands are not allowed during planning. ` +
          `You are in ${phase || 'the planning phase'}. ` +
          `REDIRECT: Return to your Progress Checklist. Planners do not create or modify source files. ` +
          `Complete your planning artifact and output the completion message.${escalation}`
        );
        process.exit(2);
      }
    }

    if (toolName === 'Write' || toolName === 'Edit') {
      const filePath = toolInput.file_path || '';
      if (!filePath) {
        process.exit(0);
      }

      const phase = getPlanningPhase(workspaceDir);

      // First check: block anything outside .5/
      if (!isInsideDotFive(filePath, workspaceDir)) {
        const blockCount = incrementBlockCount(workspaceDir);
        const isSourceFile = !filePath.includes('.5/') && !filePath.includes('.claude/');
        const escalation = blockCount >= 3
          ? ` CRITICAL: Block #${blockCount}. You have attempted to write source files ${blockCount} times. You are a PLANNER, not an implementer. Writing source code is /5:implement's job. Return to your Progress Checklist, finish your planning artifact, and STOP.`
          : '';
        const redirectMsg = isSourceFile
          ? `REDIRECT: You are in ${phase || 'the planning phase'}. You may ONLY write to .5/features/. ` +
            `Source file creation happens in /5:implement. ` +
            `Return to your Progress Checklist — find your last "✓ Step N complete" and continue with Step N+1.`
          : `REDIRECT: The path "${filePath}" is outside the allowed .5/ directory. ` +
            `Check your file path — you should be writing to .5/features/{name}/.`;
        process.stderr.write(
          `BLOCKED: ${toolName} outside .5/ is not allowed during planning. ` +
          `Attempted: "${filePath}". ${redirectMsg}${escalation}`
        );
        process.exit(2);
      }

      // Second check: during plan, only allow specific files
      if (normalizePlanningPhase(phase) === 'plan' && !isAllowedPlanFile(filePath, workspaceDir)) {
        const blockCount = incrementBlockCount(workspaceDir);
        const escalation = blockCount >= 3
          ? ` CRITICAL: Block #${blockCount}. You are attempting to create implementation artifacts during planning. Planning ONLY produces plan.md and codebase-scan.md. STOP and output your completion message.`
          : '';
        process.stderr.write(
          `BLOCKED: During plan, you may only write to .planning-active, codebase-scan.md, and plan.md. ` +
          `Attempted: "${filePath}". ` +
          `REDIRECT: If you have already written plan.md, output the completion message and STOP. ` +
          `Do NOT create source files or state.json during planning.${escalation}`
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

function isAllowedPlanFile(filePath, workspaceDir) {
  const resolved = path.resolve(workspaceDir, filePath);
  const dotFiveDir = path.join(workspaceDir, '.5');

  // Allow .5/.planning-active
  if (resolved === path.join(dotFiveDir, '.planning-active')) return true;

  // Allow .5/features/{name}/plan.md and .5/features/{name}/codebase-scan.md
  const featuresDir = path.join(dotFiveDir, 'features');
  if (resolved.startsWith(featuresDir + path.sep)) {
    const basename = path.basename(resolved);
    if (basename === 'plan.md' || basename === 'codebase-scan.md') return true;
  }

  return false;
}

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

  if (toolName === 'Agent' || toolName === 'Task') {
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

function getPlanningPhase(workspaceDir) {
  const markerPath = path.join(workspaceDir, '.5', '.planning-active');
  try {
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    return marker.phase || null;
  } catch (e) {
    return null;
  }
}

function normalizePlanningPhase(phase) {
  if (!phase) return 'plan';
  if (phase === 'plan-feature' || phase === 'plan-implementation') return 'plan';
  if (phase === 'plan') return 'plan';
  return 'plan';
}

function isFeatureInImplementationMode(workspaceDir, featureName) {
  // Check if this specific feature has a state.json (created by /5:implement)
  const stateFile = path.join(
    workspaceDir, '.5', 'features', featureName, 'state.json'
  );
  return fs.existsSync(stateFile);
}
