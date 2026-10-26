export const meta = {
  name: '5-implement',
  description: 'Execute a full plan: derive steps, run executors in parallel waves, verify, review, fix the findings. Claude Code only; Codex uses the prose loop.',
  whenToUse: 'Invoked by the /5:implement command for full plans when the Workflow tool is available. Compact plans never reach it; the command implements them inline.',
  phases: [
    { title: 'Orchestrate', detail: 'one orchestrator agent derives steps + components' },
    { title: 'Execute', detail: 'one executor agent per component; parallel components fire together per step; blocked components rerun after the next step' },
    { title: 'Verify', detail: 'inline when all passed + mechanical, else one verification agent' },
    { title: 'Review', detail: 'correctness, standards, and — when the plan calls for them — security and flow reviewers in parallel' },
    { title: 'Fix', detail: 'one fixer per file for every clear finding, then build/test/lint with one repair round' }
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract note: the executor / orchestrator / verifier prompts below are the
// inline, schema-validated form of src/agents/*-agent.md. Those .md files remain
// the canonical human-readable contract; keep these prompts in sync with them.
//
// The reviewer prompts are the schema-validated form of src/commands/5/review.md,
// the fixer prompt and the triage rules that of address-review-findings.md.
//
// This script has NO filesystem access. It orchestrates agents and RETURNS the
// final result. The /5:implement command writes the findings file, asks the user
// about the few findings that need a decision, runs the scope check, and
// auto-commits after this returns. Nothing is persisted: a rerun starts over.
//
// Models: haiku for mechanical work, sonnet for ordinary logic, opus at effort
// medium for complex work and for every retry. With args.advisor (opt-in, from
// .5/config.json; the command sets it only when the advisor tool is available)
// executors consult Claude Code's advisor tool at decision points and the first
// retry stays on the planned model, at least sonnet.
// ─────────────────────────────────────────────────────────────────────────────

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'verify', 'skipped'],
  properties: {
    status: { enum: ['success', 'failed', 'blocked'] },
    blockedBy: { type: 'string', description: 'when blocked: the project file or symbol that does not exist yet' },
    filesCreated: { type: 'array', items: { type: 'string' } },
    filesModified: { type: 'array', items: { type: 'string' } },
    verify: { enum: ['passed', 'failed', 'skipped'] },
    deviations: { type: 'string', description: 'none or a brief list' },
    skipped: { type: 'string', description: 'none, or what was deliberately not built and when to add it' },
    error: { type: 'string', description: 'none or an error description' }
  }
}

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['file', 'description', 'action'],
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          severity: { enum: ['error', 'warning', 'suggestion'] },
          description: { type: 'string' },
          fix: { type: 'string', description: 'the concrete change to make' },
          action: { enum: ['fix', 'decide', 'skip'] },
          reason: { type: 'string', description: 'one line: why skip, or which decision the user must make' }
        }
      }
    }
  }
}

const FIX_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'status'],
        properties: {
          id: { type: 'string' },
          status: { enum: ['applied', 'rejected', 'failed'] },
          note: { type: 'string', description: 'one line: what changed, or why rejected/failed' }
        }
      }
    },
    filesModified: { type: 'array', items: { type: 'string' } }
  }
}

const CHECKS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'commands'],
  properties: {
    status: { enum: ['passed', 'failed'] },
    commands: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['command', 'status'],
        properties: {
          category: { enum: ['build', 'test', 'e2e', 'lint'] },
          command: { type: 'string' },
          status: { enum: ['passed', 'failed', 'skipped', 'pre-existing'] },
          summary: { type: 'string' }
        }
      }
    },
    filesModified: { type: 'array', items: { type: 'string' } }
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
    securitySensitive: { type: 'boolean', description: 'the change touches auth, authorization, user input, secrets, crypto, or SQL/shell/path construction' },
    lifecycleSensitive: { type: 'boolean', description: 'the change touches install, update, migration, deploy, or bootstrap paths, or ordering across files' },
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
- Dependencies: for each component, list the project files and symbols it includes, requires, imports, calls, or tests. When another component creates one of them, add that component to dependsOn and put it in an EARLIER step — never the same parallel step or a later one.
- securitySensitive: true when the plan touches auth, authorization, user input handling, secrets, cryptography, or SQL/shell/path construction. lifecycleSensitive: true when it touches install, update, migration, deploy, or bootstrap paths, or the order in which files are written, uploaded, or loaded.

Return an object matching the schema (securitySensitive, lifecycleSensitive, steps[] and pendingComponents[]).`
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

Rules: Nothing is persisted between runs, so your work may already be done: for \`create\`, read the target first when it exists — if it already fulfils the intent, report success with no change; otherwise complete it, never overwrite it blindly. Smallest coherent change; reuse what already exists in this codebase before writing new code, then prefer stdlib, native platform features, and installed dependencies; touch only the target file and what it strictly needs (its test, an import site); mirror existing naming/exports/layout/tests; follow any local skill or rule; add no new dependency; no abstraction or error handling beyond what the intent requires. Fix mechanical issues you cause (imports, types, lint). When a project file or symbol your component needs does not exist yet, do not create it: STOP and report status blocked with blockedBy — /5:implement reruns you after the next step. STOP and report failed for a missing package, unplanned auth/schema/API/contract changes, or unclear product decisions. If verify fails only from pre-existing unrelated issues, report that as a deviation with the exact evidence — do not mark the component failed. Do not make more than three attempts on the same failing issue.${advisor}

Then run: ${verify}

Return structured output: status, blockedBy (only when blocked), filesCreated, filesModified, verify, deviations (none or brief), skipped (none, or what you deliberately did not build — add when ...), error (none or description). Keep it concise — no logs or diffs unless failed.`
}

function verifyPrompt(a, results) {
  const ran = results.flatMap(s => s.items.map(i =>
    `  step ${s.step} ${i.component.name}: ${i.result ? i.result.status : 'no result'}${i.result && i.result.blockedBy ? ` by ${i.result.blockedBy}` : ''} (verify ${i.result ? i.result.verify : '?'})${i.escalated ? ' [escalated to opus]' : i.retried ? ' [retried]' : ''}`))
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

// The user should be asked as little as possible: "decide" is the exception, "fix" the default.
const TRIAGE_RULE = `Set an action on every finding:
- fix: you are confident it is real and the fix is concrete — a bug, a security issue, a breach of a repository standard, a style finding, or a clearly better way to do the same thing (simpler, reuses existing code, more robust). This is the default.
- decide: ONLY when the right fix depends on a product, API, data, or security trade-off the plan does not settle, or the fix would contradict the plan. Say in reason which decision the user must make.
- skip: you could not confirm it by reading the code, it is outside these files, or the gain is marginal. Say why in reason.
Check uncertain findings against the code yourself before choosing; never pass uncertainty on as decide. Give line, severity (error for bugs and security, warning for likely problems, suggestion for improvements), description, and the concrete fix. Do not edit any file.`

function reviewScope(a, files) {
  return `Review the changes since commit ${a.fixedPoint || 'HEAD'} in exactly these files — they are uncommitted in the working tree; read untracked ones whole, since git diff omits them:
${files.map(f => `  - ${f}`).join('\n')}
Ignore every other change in the working tree.`
}

function correctnessPrompt(a, files) {
  return `You are a Code Reviewer. ${reviewScope(a, files)}

If the built-in code-review skill is available, invoke Skill(skill: "code-review", args: "high") — never with --fix or --comment — and keep only its findings in these files. Otherwise review the diff blind, on its merits: triage files by risk; read full files only for high-risk changes, public API boundaries, security/auth, and data migrations. Report bugs, security, performance, code quality, API design, missing tests, and over-engineering (unnecessary abstractions, single-use indirection, speculative generality, reinventing stdlib or existing dependencies).

${TRIAGE_RULE}`
}

function securityPrompt(a, files) {
  return `You are a Security Reviewer. ${reviewScope(a, files)}

If the built-in security-review skill is available, invoke Skill(skill: "security-review") and keep only its findings in these files. Otherwise review them for authentication and authorization gaps, unvalidated input, leaked secrets, weak cryptography, and SQL/shell/path injection. Every security finding has severity error.

${TRIAGE_RULE}`
}

function standardsPrompt(a, files) {
  return `You are a Standards Reviewer. Invoke Skill(skill: "review-style", args: "${a.fixedPoint || 'HEAD'} files: ${files.join(', ')} report only"); if it cannot be invoked, read .claude/skills/review-style/SKILL.md and follow it with the same arguments. Leave out its Suppressed findings. ⛔️ hard breaches of a repository standard are severity error, ⚠️ judgement calls severity suggestion; a judgement call whose fix is clearly better is fix, otherwise skip.

${TRIAGE_RULE}`
}

function flowPrompt(a, files) {
  return `You are a Flow Reviewer. ${reviewScope(a, files)}

A diff reviewer reads file by file; you trace behavior ACROSS these files and the states they run in. Read the entry points, then follow each flow end to end:
- a fresh install with no earlier state: missing directories, files, config, or database rows;
- an upgrade from the previous version, and an update that stops halfway;
- the order of operations across files: what is written, uploaded, loaded, or required first, and what breaks when that order changes or one step fails;
- output, headers, or side effects that happen before guards, error handling, or error suppression are in place;
- files and helpers the change relies on but does not check, and tests that assert the old order or state.
Report only failures you can describe as a concrete sequence of states.

${TRIAGE_RULE}`
}

function fixerPrompt(a, file, findings) {
  const list = findings.map(f => `  - ${f.id}${f.line ? ` (line ${f.line})` : ''}: ${f.description} → ${f.fix || 'fix as described'}`).join('\n')
  const dirty = (a.dirty || []).join(', ') || 'none'
  return `You are a Review Fixer. Apply these review findings in ${file}:
${list}

Read the file first, then apply the fixes from the highest line to the lowest. Touch another file only when a fix strictly needs it (its test, a caller), and never one of these, which hold the user's own uncommitted work: ${dirty}. Make no unrelated change. When reading the code shows a finding's premise is wrong, mark it rejected with the reason — do not ask. Follow the repository standards first, then the style skills. Run the narrowest relevant test or build for the file.

Return structured output: one item per finding id (applied, rejected, or failed, with a one-line note) and filesModified.`
}

function checksPrompt(a, files) {
  const baseline = (a.baseline && a.baseline.length)
    ? a.baseline.map(b => `  ${b.command || '?'}: ${b.status}`).join('\n')
    : '  (none recorded)'
  return `You are the final Checks agent. Identify the commands from ${a.paths.config} and, only as needed, the project manifests (package.json, Makefile, pyproject.toml, Cargo.toml, Gradle files). Run every available command in the categories build, test, e2e, and lint; skip a category only when no command exists or it is configured as none.

Baseline (pre-change) results — a failure listed here is pre-existing; report it as pre-existing:
${baseline}

When a command fails because of this run's changes, fix the cause with the smallest change in these files only — ${files.join(', ')} — and rerun it. At most two repair attempts per command. Do not touch any other file.

Return structured output: status (passed when every command passed, was skipped, or failed only pre-existing), commands[] with category, command, status, and a one-line summary, and filesModified (repairs only).`
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Model options per tier. Opus runs at medium effort: deep enough for complex work, cheaper than high.
function modelOpts(model) {
  return model === 'opus' ? { model: 'opus', effort: 'medium' } : { model: model || 'haiku' }
}

// A crashed agent (null result) counts as failed: an infra error should not be treated more
// harshly than a clean structured failure. verify "failed" alone is no retry reason: it can come
// from pre-existing issues, which the verifier separates using the baseline. "blocked" is no retry
// reason either: no model can build on a file that does not exist yet, so it waits for the next step.
function needsRetry(result) {
  return result == null || result.status === 'failed'
}

function isBlocked(item) {
  return !!item.result && item.result.status === 'blocked'
}

// Retries escalate to opus. With the advisor available, the first retry stays on the planned model
// (at least sonnet) and consults the advisor instead; only the second escalates.
function retryModel(c, attempt, a) {
  if (!(a.advisor && attempt === 1)) return 'opus'
  return c.model === 'haiku' || !c.model ? 'sonnet' : c.model
}

// Runs one component and retries it up to twice, handing each retry the previous failure.
async function runComponent(c, a) {
  const run = (model, label, previous) => agent(executorPrompt(c, a, previous),
    { label, phase: 'Execute', ...modelOpts(model), schema: RESULT_SCHEMA }).catch(() => null)

  // `last` is the latest attempt, null when it crashed; `item.result` keeps the latest structured result.
  let last = await run(c.model, `exec:${c.name}`)
  const item = { component: c, result: last, retried: false, escalated: false }
  for (let attempt = 1; attempt <= 2 && needsRetry(item.result); attempt++) {
    const model = retryModel(c, attempt, a)
    log(`retry ${c.name} (attempt ${attempt + 1}) on ${model || 'haiku'}`)
    item.retried = true
    item.escalated = item.escalated || model === 'opus'
    last = await run(model, `retry:${c.name}`, { retry: true, result: last })
    if (last) item.result = last
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

// Reruns blocked components in place, once the step that should create what they need has run.
async function rerunBlocked(items, a, afterStep) {
  log(`rerun ${items.length} blocked component(s): ${items.map(i => `${i.component.name} (${i.result.blockedBy || '?'})`).join(', ')}`)
  await parallel(items.map(item => async () => {
    const again = await runComponent(item.component, a)
    if (again.result) item.result = again.result
    item.retried = item.retried || again.retried
    item.escalated = item.escalated || again.escalated
    item.lastTry = afterStep
  }))
}

const stripDot = f => f.replace(/^\.\//, '')

// Review the run's files, triage the findings, fix every clear one, then rerun build/test/lint.
async function reviewAndFix(a, plan, allItems, verification, usedOpus) {
  const runFiles = [...new Set(allItems.flatMap(i => [
    i.component.file, i.component.sourceFile,
    ...(i.result ? [...(i.result.filesCreated || []), ...(i.result.filesModified || [])] : [])
  ]).filter(Boolean).map(stripDot))]
  const dirty = new Set((a.dirty || []).map(stripDot))

  phase('Review')
  const reviewers = [
    { key: 'correctness', prompt: correctnessPrompt, model: 'sonnet' },
    { key: 'standards', prompt: standardsPrompt, model: 'sonnet' }
  ]
  if (plan.securitySensitive) reviewers.push({ key: 'security', prompt: securityPrompt, model: 'sonnet' })
  if (plan.lifecycleSensitive || plan.securitySensitive) reviewers.push({ key: 'flow', prompt: flowPrompt, model: 'opus' })
  const reports = await parallel(reviewers.map(r => () =>
    agent(r.prompt(a, runFiles), { label: `review:${r.key}`, phase: 'Review', ...modelOpts(r.model), schema: FINDINGS_SCHEMA })
      .then(out => out && out.findings.map(f => ({ ...f, reviewer: r.key })))))
  const missing = reviewers.filter((r, n) => !reports[n]).map(r => r.key)
  if (missing.length) log(`reviewer(s) returned nothing: ${missing.join(', ')}`)

  // Dedup by file and line, keep only the run's files; findings in pre-run dirty files are reported, never fixed.
  const findings = []
  const seen = new Set()
  let outside = 0
  for (const f of reports.filter(Boolean).flat()) {
    const file = stripDot(f.file)
    if (!runFiles.includes(file)) { outside++; continue }
    const key = `${file}:${f.line || 0}`
    if (f.line && seen.has(key)) continue
    seen.add(key)
    const finding = { ...f, file, id: `R${findings.length + 1}` }
    if (dirty.has(file) && finding.action !== 'skip') {
      finding.action = 'report'
      finding.reason = 'pre-run dirty file: may sit in your own earlier work, left untouched'
    }
    findings.push(finding)
  }
  if (outside) log(`review: dropped ${outside} finding(s) outside the run's files`)

  phase('Fix')
  const byFile = new Map()
  for (const f of findings.filter(f => f.action === 'fix')) {
    if (!byFile.has(f.file)) byFile.set(f.file, [])
    byFile.get(f.file).push(f)
  }
  const fixModel = plan.securitySensitive ? 'opus' : 'sonnet'
  await parallel([...byFile].map(([file, list]) => async () => {
    const out = await agent(fixerPrompt(a, file, list), { label: `fix:${file}`, phase: 'Fix', ...modelOpts(list.some(f => f.reviewer === 'flow') ? 'opus' : fixModel), schema: FIX_SCHEMA })
      .catch(() => null)
    for (const f of list) {
      const item = out && out.items.find(i => i.id === f.id)
      f.status = item ? item.status : 'failed'
      if (item && item.note) f.note = item.note
    }
  }))
  const applied = findings.filter(f => f.status === 'applied').length
  log(`review: ${findings.length} finding(s), ${applied} fixed, ${findings.filter(f => f.action === 'decide').length} need a decision`)

  // The inline fast path ran no build/test yet, and applied fixes change what the verifier saw.
  let checks = null
  if (applied || verification.inline) {
    checks = await agent(checksPrompt(a, runFiles), { label: 'checks', phase: 'Fix', ...modelOpts(usedOpus ? 'opus' : 'sonnet'), schema: CHECKS_SCHEMA })
  }
  return { reviewers: reviewers.map(r => r.key), missing, runFiles, findings, checks }
}

// ── Main ─────────────────────────────────────────────────────────────────────

const a = args || {}

phase('Orchestrate')
const plan = await agent(orchestratorPrompt(a), { label: 'orchestrate', phase: 'Orchestrate', schema: STATE_SCHEMA })
const steps = plan.steps
const components = plan.pendingComponents

phase('Execute')
// A blocked component waits for the next step, then — if still blocked — for the end of the run.
const results = []
let waiting = []
const late = []
for (let n = 0; n < steps.length; n++) {
  const r = await runStep(steps[n], components, a)
  results.push(r)
  if (waiting.length) {
    await rerunBlocked(waiting, a, n)
    late.push(...waiting.filter(isBlocked))
  }
  waiting = r.items.filter(isBlocked)
  waiting.forEach(i => { i.lastTry = n })
}
const finalRerun = [...late.filter(i => i.lastTry < steps.length - 1), ...waiting]
if (finalRerun.length) await rerunBlocked(finalRerun, a, steps.length)

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
  const planned = new Set([i.component.file, i.component.sourceFile].filter(Boolean).map(stripDot))
  const touched = i.result ? [...(i.result.filesCreated || []), ...(i.result.filesModified || [])].map(stripDot) : []
  return touched.filter(f => !planned.has(f)).map(f => ({ component: i.component.name, file: f }))
})
if (extraFiles.length) log(`scope: ${extraFiles.length} file(s) touched outside planned targets`)
let verification
if (allPassed && mechanical) {
  log('all components passed + mechanical — no verification agent; the Checks agent runs build/test, /5:implement the scope check')
  // No shell access here: the Checks agent in reviewAndFix runs build/test, /5:implement the scope check, when it sees inline: true.
  verification = { status: 'passed', completeness: 'passed', infrastructure: 'passed', acceptanceCriteria: 'n/a', commands: [], failures: [], inline: true }
} else {
  verification = await agent(verifyPrompt(a, results), {
    label: 'verify', phase: 'Verify', ...modelOpts(usedOpus ? 'opus' : 'sonnet'), schema: VERIFICATION_SCHEMA
  })
}

// Reviewing a run that did not build wastes the review: the rerun after the fix reviews again.
let review = null
if (verification.status === 'failed') {
  log('verification failed — review and fix skipped')
} else {
  review = await reviewAndFix(a, plan, allItems, verification, usedOpus)
}
const checksPassed = !review || !review.checks || review.checks.status === 'passed'

// Returned to the /5:implement command for the findings file, the decisions, the scope check, per-step staging, and the report.
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
  review,
  status: verification.status === 'passed' && checksPassed ? 'completed' : 'failed'
}
