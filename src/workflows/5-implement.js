export const meta = {
  name: '5-implement',
  description: 'Execute a full plan: derive steps, run executors in parallel waves, verify. Claude Code only; Codex uses the prose loop.',
  whenToUse: 'Invoked by the /5:implement command for full plans when the Workflow tool is available. Compact plans never reach it; the command implements them inline.',
  phases: [
    { title: 'Orchestrate', detail: 'one orchestrator agent derives steps + components' },
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
// final result. The /5:implement command runs the fast-path build/test check and
// auto-commit after this returns. Nothing is persisted: a rerun starts over.
//
// Models: haiku for mechanical work, sonnet for ordinary logic, opus at effort
// medium for complex work and for every retry. With args.advisor (opt-in, from
// .5/config.json) executors consult Claude Code's advisor tool at decision points
// and the first retry stays on the planned model.
// ─────────────────────────────────────────────────────────────────────────────

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'verify', 'skipped'],
  properties: {
    status: { enum: ['success', 'failed'] },
    filesCreated: { type: 'array', items: { type: 'string' } },
    filesModified: { type: 'array', items: { type: 'string' } },
    verify: { enum: ['passed', 'failed', 'skipped'] },
    deviations: { type: 'string', description: 'none or a brief list' },
    skipped: { type: 'string', description: 'none, or what was deliberately not built and when to add it' },
    error: { type: 'string', description: 'none or an error description' }
  }
}

const VERIFICATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'completeness', 'infrastructure', 'scope'],
  properties: {
    status: { enum: ['passed', 'partial', 'failed'] },
    completeness: { enum: ['passed', 'partial', 'failed'] },
    infrastructure: { enum: ['passed', 'failed'] },
    acceptanceCriteria: { type: 'string', description: 'satisfied/total, e.g. "3/3"' },
    scope: { enum: ['passed', 'drift'] },
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
          model: { enum: ['haiku', 'sonnet', 'opus'] },
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
          model: { enum: ['haiku', 'sonnet', 'opus'] },
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
Config: ${a.paths.config} (read only if present)

The plan has no fixed shape. Derive the components from whatever it describes: one component per target file (or tightly coupled file group), named in short kebab-case, then turn them into steps + components:
- Group independent components into one step with mode "parallel"; use "sequential" only when components touch the same file, one imports another, or there is an explicit dependency.
- Prefer fewer steps. Tests run after the components they validate.
- model "haiku" for mechanical work (UI tweaks, tests, docs, config, simple single-file edits); "sonnet" for ordinary logic; "opus" only for complex logic, cross-module behavior, security/auth, data migrations, or public API contracts.
- 1-2 high-signal patternRefs per component with line ranges or symbols so executors avoid whole-file reads. Take them from the plan where it names patterns, else find them with Glob/Grep.
- verifyCommands: narrowest relevant check first, then project build/test.
- Exclude work the plan defers or rules out. Represent every other component once. dependsOn must reference existing component names.

Return an object matching the schema (steps[] and pendingComponents[]).`
}

const ADVISOR_RULE = 'Advisor: if an advisor tool is available, consult it before committing to an approach when the intent is ambiguous or crosses modules, and when the same verify failure returns after a fix. Do not consult it for mechanical edits or to confirm work that already passes.'

function retryContext(previous, a) {
  const failure = previous
    ? `status ${previous.status}, verify ${previous.verify}, error: ${previous.error || 'none'}, deviations: ${previous.deviations || 'none'}`
    : 'the agent crashed without returning a result'
  const advisor = a.advisor ? ' Consult the advisor, if available, before your first edit.' : ''
  return `This is a RETRY of a failed attempt (${failure}). Read the target as the previous attempt left it, find the root cause, and correct it.${advisor}`
}

function executorPrompt(c, a, opts) {
  const refs = (c.patternRefs || []).map(r => `  - ${r.file}${r.read ? ` (${r.read})` : ''}${r.reason ? ` — ${r.reason}` : ''}`).join('\n') || '  - none'
  const verify = (c.verifyCommands || []).join(' && ') || 'infer the narrowest relevant test/build command'
  const standards = a.standards || {}
  const repoStandards = (standards.repo || []).map(f => `  - ${f}`).join('\n') || '  - none found'
  const styles = (standards.styles || []).map(f => `  - ${f}`).join('\n') || '  - none found'
  const retry = opts && opts.retry ? `\n${retryContext(opts.result, a)}` : ''
  const advisor = a.advisor ? `\n\n${ADVISOR_RULE}` : ''
  return `You are a Step Executor. Implement EXACTLY this component and nothing more.${retry}

Component: ${c.name}
Action: ${c.action}
Target file: ${c.file}${c.sourceFile ? `\nSource file (rename from): ${c.sourceFile}` : ''}
Intent: ${c.description || ''}

Read only these pattern references (ranges/symbols), plus the target file for modify/rename — and for create when it already exists:
${refs}

Standards — read the parts that apply to your target and follow them. Repository standards win over the style skills.
Repository standards:
${repoStandards}
Style skills:
${styles}

Rules: Nothing is persisted between runs, so your work may already be done: for \`create\`, read the target first when it exists — if it already fulfils the intent, report success with no change; otherwise complete it, never overwrite it blindly. Smallest coherent change; reuse what already exists in this codebase before writing new code, then prefer stdlib, native platform features, and installed dependencies; touch only the target file and what it strictly needs (its test, an import site); mirror existing naming/exports/layout/tests; follow any local skill or rule; add no new dependency; no abstraction or error handling beyond what the intent requires. Fix mechanical issues you cause (imports, types, lint). STOP and report failed for missing dependencies, unplanned auth/schema/API/contract changes, or unclear product decisions. If verify fails only from pre-existing unrelated issues, report that as a deviation with the exact evidence — do not mark the component failed. Do not make more than three attempts on the same failing issue.${advisor}

Then run: ${verify}

Return structured output: status, filesCreated, filesModified, verify, deviations (none or brief), skipped (none, or what you deliberately did not build — add when ...), error (none or description). Keep it concise — no logs or diffs unless failed.`
}

function verifyPrompt(a, results) {
  const ran = results.flatMap(s => s.items.map(i =>
    `  step ${s.step} ${i.component.name}: ${i.result ? i.result.status : 'no result'} (verify ${i.result ? i.result.verify : '?'})${i.escalated ? ' [escalated to opus]' : i.retried ? ' [retried]' : ''}`))
  const summary = ran.join('\n') || '  (no components ran)'
  const repoStandards = ((a.standards && a.standards.repo) || []).join(', ') || 'none found'
  const baseline = (a.baseline && a.baseline.length)
    ? a.baseline.map(b => `  ${b.command || b.details && b.details.command || '?'}: ${b.status}${b.summary ? ` — ${b.summary}` : ''}`).join('\n')
    : '  (none recorded)'
  return `You are a Verification Agent. Verify only; do not implement fixes.

Feature: ${a.feature}
Plan: ${a.paths.plan}
Config: ${a.paths.config} (read only if present)
Repository standards: ${repoStandards}

Baseline (pre-change) command results — treat any failure listed here as PRE-EXISTING, not caused by this change:
${baseline}

Component results:
${summary}

Checks — only whether the plan was built and works; code quality and correctness belong to /5:review, which runs next: completeness (every planned component done, and any acceptance criteria the plan states addressed); files exist for create/modify, rename moved correctly, delete removed; build + test pass (reuse the baseline and component results above when they already prove status — rerun only the commands whose inputs changed, not identical passing ones); scope (run \`git status --short\` and \`git diff HEAD --stat\`, and read untracked files directly since \`git diff HEAD\` omits them: every changed file traces to a planned component — its target, its test, an import site, or a file a repository standard requires (such as a changelog entry); flag files outside the plan, work the plan rules out or defers, new dependencies no component requires, and unrequested abstractions — report drift only in scope; it does not change status). Prefer changed files over broad scanning.

Return structured output: status, completeness, infrastructure, acceptanceCriteria ("satisfied/total"), scope, commands[], failures[] (one "drift: {path} — {why}" entry per drift finding).`
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Model options per tier. Opus runs at medium effort: deep enough for complex work, cheaper than high.
function modelOpts(model) {
  return model === 'opus' ? { model: 'opus', effort: 'medium' } : { model: model || 'haiku' }
}

// A crashed agent (null result) counts as failed: an infra error should not be treated more
// harshly than a clean structured failure. verify "failed" alone is no retry reason: it can come
// from pre-existing issues, which the verifier separates using the baseline.
function needsRetry(result) {
  return result == null || result.status === 'failed'
}

// Retries escalate to opus. With the advisor opted in, the first retry stays on the planned model
// and consults the advisor instead; only the second escalates.
function retryModel(c, attempt, a) {
  return a.advisor && attempt === 1 ? c.model : 'opus'
}

// Runs one component and retries it up to twice, handing each retry the previous failure.
async function runComponent(c, a) {
  const run = (model, label, previous) => agent(executorPrompt(c, a, previous),
    { label, phase: 'Execute', ...modelOpts(model), schema: RESULT_SCHEMA }).catch(() => null)

  const item = { component: c, result: await run(c.model, `exec:${c.name}`), retried: false, escalated: false }
  for (let attempt = 1; attempt <= 2 && needsRetry(item.result); attempt++) {
    const model = retryModel(c, attempt, a)
    log(`retry ${c.name} (attempt ${attempt + 1}) on ${model || 'haiku'}`)
    item.retried = true
    item.escalated = item.escalated || model === 'opus'
    const retried = await run(model, `retry:${c.name}`, { retry: true, result: item.result })
    if (retried) item.result = retried
  }
  return item
}

async function runStep(step, components, a) {
  const stepComps = components.filter(c => step.components.includes(c.name))
  let items
  if (step.mode === 'parallel') {
    // Fire every parallel component together, retries included — true concurrency, one wave.
    items = await parallel(stepComps.map(c => () => runComponent(c, a)))
  } else {
    // Sequential components depend on each other, so each one is retried before the next starts.
    items = []
    for (const c of stepComps) items.push(await runComponent(c, a))
  }
  return { step: step.number, name: step.name, mode: step.mode, items }
}

// ── Main ─────────────────────────────────────────────────────────────────────

const a = args || {}

phase('Orchestrate')
const plan = await agent(orchestratorPrompt(a), { label: 'orchestrate', phase: 'Orchestrate', schema: STATE_SCHEMA })
const steps = plan.steps
const components = plan.pendingComponents

phase('Execute')
const results = []
for (const step of steps) {
  results.push(await runStep(step, components, a))
}

phase('Verify')
const allItems = results.flatMap(s => s.items)
const allPassed = allItems.length > 0 && allItems.every(i => i.result && i.result.status === 'success' && i.result.verify !== 'failed')
// Mechanical when every component was planned as haiku and none needed a retry; anything
// else signals reasoning-level work that warrants the full verification agent.
const usedOpus = components.some(c => c.model === 'opus') || allItems.some(i => i.escalated)
const mechanical = !usedOpus && !allItems.some(i => i.retried) && components.every(c => (c.model || 'haiku') === 'haiku')
// Deterministic scope signal: files an executor touched beyond its planned target(s).
// Tests and import sites are legitimate, so this is reported for the user, never a failure.
const extraFiles = allItems.flatMap(i => {
  const stripDot = f => f.replace(/^\.\//, '')
  const planned = new Set([i.component.file, i.component.sourceFile].filter(Boolean).map(stripDot))
  const touched = i.result ? [...(i.result.filesCreated || []), ...(i.result.filesModified || [])].map(stripDot) : []
  return touched.filter(f => !planned.has(f)).map(f => ({ component: i.component.name, file: f }))
})
if (extraFiles.length) log(`scope: ${extraFiles.length} file(s) touched outside planned targets`)
let verification
if (allPassed && mechanical) {
  log('all components passed + mechanical — no verification agent; /5:implement runs build/test and the scope check')
  // No shell access here: /5:implement runs build/test and the scope check itself when it sees inline: true.
  verification = { status: 'passed', completeness: 'passed', infrastructure: 'passed', acceptanceCriteria: 'n/a', commands: [], failures: [], inline: true }
} else {
  verification = await agent(verifyPrompt(a, results), {
    label: 'verify', phase: 'Verify', ...modelOpts(usedOpus ? 'opus' : 'sonnet'), schema: VERIFICATION_SCHEMA
  })
}

// Returned to the /5:implement command for the fast-path check, per-step staging, and the report.
return {
  feature: a.feature,
  steps,
  components,
  results: results.map(s => ({
    step: s.step,
    name: s.name,
    mode: s.mode,
    items: s.items.map(i => ({ component: i.component.name, file: i.component.file, sourceFile: i.component.sourceFile, retried: i.retried, escalated: i.escalated, result: i.result }))
  })),
  verification,
  extraFiles,
  status: verification.status === 'passed' ? 'completed' : 'failed'
}
