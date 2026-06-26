export const meta = {
  name: '5-implement',
  description: 'Execute a unified plan: derive steps, run executors in parallel waves, verify. Claude Code only; Codex uses the prose loop.',
  whenToUse: 'Invoked by the /5:implement command when the Workflow tool is available. Reads args from the command, returns final state for the command to persist to state.json.',
  phases: [
    { title: 'Orchestrate', detail: 'derive steps + components (agent for non-trivial plans, inline for compact)' },
    { title: 'Execute', detail: 'one executor agent per component; parallel components fire together per step' },
    { title: 'Verify', detail: 'inline when all passed + mechanical, else one verification agent' }
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract note: the executor / orchestrator / verifier prompts below are the
// inline, schema-validated form of src/agents/*-agent.md. Those .md files remain
// the canonical human-readable contract; keep these prompts in sync with them.
//
// This script has NO filesystem access. It orchestrates agents and RETURNS the
// final state object. The /5:implement command (which has Write) persists
// state.json + state-events.jsonl and runs auto-commit after this returns.
// ─────────────────────────────────────────────────────────────────────────────

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'verify'],
  properties: {
    status: { enum: ['success', 'failed'] },
    filesCreated: { type: 'array', items: { type: 'string' } },
    filesModified: { type: 'array', items: { type: 'string' } },
    verify: { enum: ['passed', 'failed', 'skipped'] },
    deviations: { type: 'string', description: 'none or a brief list' },
    error: { type: 'string', description: 'none or an error description' }
  }
}

const VERIFICATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'completeness', 'infrastructure', 'quality'],
  properties: {
    status: { enum: ['passed', 'partial', 'failed'] },
    completeness: { enum: ['passed', 'partial', 'failed'] },
    infrastructure: { enum: ['passed', 'failed'] },
    acceptanceCriteria: { type: 'string', description: 'satisfied/total, e.g. "3/3"' },
    quality: { enum: ['passed', 'partial', 'failed'] },
    commands: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['command', 'status'],
        properties: {
          command: { type: 'string' },
          status: { enum: ['passed', 'failed', 'skipped'] },
          summary: { type: 'string' }
        }
      }
    },
    failures: { type: 'array', items: { type: 'string' } }
  }
}

const STATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['steps', 'pendingComponents'],
  properties: {
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['number', 'name', 'mode', 'components'],
        properties: {
          number: { type: 'integer' },
          name: { type: 'string' },
          mode: { enum: ['parallel', 'sequential'] },
          model: { enum: ['haiku', 'sonnet'] },
          components: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    pendingComponents: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'action', 'step', 'mode', 'model', 'file'],
        properties: {
          name: { type: 'string' },
          action: { enum: ['create', 'modify', 'delete', 'rename'] },
          step: { type: 'integer' },
          mode: { enum: ['parallel', 'sequential'] },
          model: { enum: ['haiku', 'sonnet'] },
          file: { type: 'string' },
          sourceFile: { type: ['string', 'null'] },
          description: { type: 'string' },
          dependsOn: { type: 'array', items: { type: 'string' } },
          patternRefs: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['file'],
              properties: {
                file: { type: 'string' },
                read: { type: 'string' },
                reason: { type: 'string' }
              }
            }
          },
          verifyCommands: { type: 'array', items: { type: 'string' } },
          notes: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }
}

// ── Prompt builders ──────────────────────────────────────────────────────────

function orchestratorPrompt(a) {
  return `You are a Step Orchestrator. Read these files and RETURN execution state as structured output. Do NOT write any file.

Feature: ${a.feature}
Plan: ${a.paths.plan}
Codebase scan: ${a.paths.scan} (read only if present)
Config: ${a.paths.config} (read only if present)

Turn the lean component checklist in the plan into steps + components:
- Group independent components into one step with mode "parallel"; use "sequential" only when components touch the same file, one imports another, or there is an explicit dependency.
- Prefer fewer steps. Tests run after the components they validate.
- model "haiku" by default (mechanical, UI, tests, docs, config, single-file). model "sonnet" only for complex logic, cross-module, security/auth, migrations, or public API.
- 1-2 high-signal patternRefs per component with line ranges or symbols so executors avoid whole-file reads.
- verifyCommands: narrowest relevant check first, then project build/test.
- Exclude [DEFERRED] work. Represent every other component once. dependsOn must reference existing component names.

Return an object matching the schema (steps[] and pendingComponents[]).`
}

function executorPrompt(c, a, opts) {
  const refs = (c.patternRefs || []).map(r => `  - ${r.file}${r.read ? ` (${r.read})` : ''}${r.reason ? ` — ${r.reason}` : ''}`).join('\n') || '  - none'
  const verify = (c.verifyCommands || []).join(' && ') || 'infer the narrowest relevant test/build command'
  const retry = opts && opts.retry
    ? '\nThis is a RETRY of a failed attempt — read the error context carefully and correct the root cause.'
    : ''
  return `You are a Step Executor. Implement EXACTLY this component and nothing more.${retry}

Component: ${c.name}
Action: ${c.action}
Target file: ${c.file}${c.sourceFile ? `\nSource file (rename from): ${c.sourceFile}` : ''}
Intent: ${c.description || ''}

Read only these pattern references (ranges/symbols), plus the target file for modify/rename:
${refs}

Rules: smallest coherent change; mirror existing naming/exports/layout/tests; follow any local skill or rule; add no new dependency; no abstraction or error handling beyond what the intent requires. Fix mechanical issues you cause (imports, types, lint). STOP and report failed for missing dependencies, unplanned auth/schema/API/contract changes, or unclear product decisions. If verify fails only from pre-existing unrelated issues, report that as a deviation with the exact evidence — do not mark the component failed. Do not make more than three attempts on the same failing issue.

Then run: ${verify}

Return structured output: status, filesCreated, filesModified, verify, deviations (none or brief), error (none or description). Keep it concise — no logs or diffs unless failed.`
}

function verifyPrompt(a, results, resumeDone) {
  const ran = results.flatMap(s => s.items.map(i =>
    `  step ${s.step} ${i.component.name}: ${i.result ? i.result.status : 'no result'} (verify ${i.result ? i.result.verify : '?'})${i.escalated ? ' [escalated to sonnet]' : ''}`))
  const prior = [...(resumeDone || [])]
    .filter(n => !results.some(s => s.items.some(i => i.component.name === n)))
    .map(n => `  ${n}: completed in a prior session`)
  const summary = [...ran, ...prior].join('\n') || '  (no components ran this invocation)'
  const baseline = (a.baseline && a.baseline.length)
    ? a.baseline.map(b => `  ${b.command || b.details && b.details.command || '?'}: ${b.status}${b.summary ? ` — ${b.summary}` : ''}`).join('\n')
    : '  (none recorded)'
  return `You are a Verification Agent. Verify only; do not implement fixes.

Feature: ${a.feature}
Plan: ${a.paths.plan}
Config: ${a.paths.config} (read only if present)

Baseline (pre-change) command results — treat any failure listed here as PRE-EXISTING, not caused by this change:
${baseline}

Component results:
${summary}

Checks: completeness (every planned component done, acceptance criteria addressed); files exist for create/modify, rename moved correctly, delete removed; build + test pass (reuse the baseline and component results above when they already prove status — rerun only the commands whose inputs changed, not identical passing ones); correctness (inspect changed files, not just existence); quality (logic-bearing changes have tests when a test framework exists). Prefer changed files over broad scanning.

Return structured output: status, completeness, infrastructure, acceptanceCriteria ("satisfied/total"), quality, commands[], failures[].`
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Build a single trivial step in JS for compact plans (no orchestrator agent).
function compactSteps(components) {
  const norm = components.map((c, i) => ({
    name: c.name,
    action: c.action || 'modify',
    step: 1,
    mode: 'parallel',
    model: c.model || 'haiku',
    file: c.file,
    sourceFile: c.sourceFile || null,
    description: c.description || '',
    dependsOn: c.dependsOn || [],
    patternRefs: c.patternRefs || [],
    verifyCommands: c.verifyCommands || [],
    notes: []
  }))
  // If two components write the same file or one depends on another, fall back to sequential.
  const files = norm.map(c => c.file)
  const fileConflict = new Set(files).size !== files.length
  const hasDep = norm.some(c => c.dependsOn && c.dependsOn.length)
  const mode = (fileConflict || hasDep) ? 'sequential' : 'parallel'
  norm.forEach(c => { c.mode = mode })
  const stepModel = norm.some(c => c.model === 'sonnet') ? 'sonnet' : 'haiku'
  return {
    steps: [{ number: 1, name: 'implement', mode, model: stepModel, components: norm.map(c => c.name) }],
    pendingComponents: norm
  }
}

async function runStep(step, components, a) {
  const stepComps = components.filter(c => step.components.includes(c.name))
  if (!stepComps.length) return { step: step.number, name: step.name, mode: step.mode, items: [] }

  let waveResults
  if (step.mode === 'parallel' && stepComps.length > 1) {
    // Fire every parallel component together — true concurrency, one wave.
    waveResults = await parallel(stepComps.map(c => () =>
      agent(executorPrompt(c, a), { label: `exec:${c.name}`, phase: 'Execute', model: c.model || 'haiku', schema: RESULT_SCHEMA })
        .then(result => ({ component: c, result }))
        .catch(() => ({ component: c, result: null }))))
  } else {
    waveResults = []
    for (const c of stepComps) {
      const result = await agent(executorPrompt(c, a), { label: `exec:${c.name}`, phase: 'Execute', model: c.model || 'haiku', schema: RESULT_SCHEMA })
        .catch(() => null)
      waveResults.push({ component: c, result })
    }
  }

  // Retry failed OR crashed (null) components up to twice, escalating to sonnet.
  // A crashed agent (null result) is retried too — an infra error should not be
  // treated more harshly than a clean structured failure.
  for (const wr of waveResults) {
    let attempt = 1
    while ((wr.result == null || wr.result.status === 'failed') && attempt <= 2) {
      log(`retry ${wr.component.name} (attempt ${attempt + 1}) on sonnet`)
      wr.escalated = true
      const retried = await agent(executorPrompt(wr.component, a, { retry: true }),
        { label: `retry:${wr.component.name}`, phase: 'Execute', model: 'sonnet', schema: RESULT_SCHEMA }).catch(() => null)
      if (retried) wr.result = retried
      attempt++
    }
  }

  return { step: step.number, name: step.name, mode: step.mode, items: waveResults }
}

// ── Main ─────────────────────────────────────────────────────────────────────

const a = args || {}
const resume = a.resume || {}
const resumeDone = new Set(resume.completedComponents || [])

phase('Orchestrate')
let plan
if (Array.isArray(resume.steps) && resume.steps.length && Array.isArray(resume.pendingComponents) && resume.pendingComponents.length) {
  // Resume: reuse the steps/components derived in the original run (stored in state.json).
  // Re-deriving via the orchestrator agent is non-deterministic and could rename components,
  // breaking name-based resume matching — so never re-orchestrate on resume.
  log(`resume: reusing ${resume.steps.length} prior step(s); ${resumeDone.size} component(s) already complete`)
  plan = { steps: resume.steps, pendingComponents: resume.pendingComponents }
} else if (a.isCompact && Array.isArray(a.components) && a.components.length) {
  log(`compact plan: ${a.components.length} component(s), no orchestrator agent`)
  plan = compactSteps(a.components)
} else {
  plan = await agent(orchestratorPrompt(a), { label: 'orchestrate', phase: 'Orchestrate', schema: STATE_SCHEMA })
}
const steps = plan.steps
const components = plan.pendingComponents

phase('Execute')
const results = []
for (const step of steps) {
  const remaining = components.filter(c => step.components.includes(c.name) && !resumeDone.has(c.name))
  if (!remaining.length) { log(`step ${step.number} already complete (resume), skipping`); continue }
  const stepResult = await runStep({ ...step, components: remaining.map(c => c.name) }, components, a)
  results.push(stepResult)
}

phase('Verify')
const allItems = results.flatMap(s => s.items)
const allPassed = allItems.length > 0 && allItems.every(i => i.result && i.result.status === 'success' && i.result.verify !== 'failed')
// Non-mechanical when a component was planned as sonnet OR needed a sonnet retry to pass —
// either signals reasoning-level work that warrants the full verification agent.
const usedSonnet = components.some(c => (c.model || 'haiku') === 'sonnet') || allItems.some(i => i.escalated)
let verification
if (allPassed && !usedSonnet) {
  log('all components passed + mechanical (no sonnet, no escalation) — inline verify, no verification agent')
  verification = { status: 'passed', completeness: 'passed', infrastructure: 'passed', acceptanceCriteria: 'n/a', quality: 'passed', commands: [], failures: [], inline: true }
} else {
  if (!allItems.length) log('no components ran this invocation (resume) — verifying the already-completed feature against the plan')
  verification = await agent(verifyPrompt(a, results, resumeDone), {
    label: 'verify', phase: 'Verify', model: usedSonnet ? 'sonnet' : 'haiku', schema: VERIFICATION_SCHEMA
  })
}

// Union prior + newly-succeeded so the command can MERGE (not replace) completed history on resume.
const newlyCompleted = allItems.filter(i => i.result && i.result.status === 'success').map(i => i.component.name)
const completedComponents = [...new Set([...resumeDone, ...newlyCompleted])]

// Returned to the /5:implement command, which persists state.json + state-events.jsonl and auto-commits.
// steps + components are returned so a later resume can pass them back (deterministic, no re-orchestration).
return {
  feature: a.feature,
  steps,
  components,
  completedComponents,
  results: results.map(s => ({
    step: s.step,
    name: s.name,
    mode: s.mode,
    items: s.items.map(i => ({ component: i.component.name, file: i.component.file, sourceFile: i.component.sourceFile, escalated: !!i.escalated, result: i.result }))
  })),
  verification,
  status: verification.status === 'passed' ? 'completed' : 'failed'
}
