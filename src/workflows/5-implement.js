export const meta = {
  name: '5-implement',
  description: 'Execute a full plan. Derive steps, run executors in parallel waves, then make the change work first: verify and review for bugs, fix. Only a green run gets the standards review and a behaviour-preserving refactor. Claude Code only. Codex uses the prose loop.',
  whenToUse: 'Invoked by the /5:implement command for full plans when the Workflow tool is available. Compact plans never reach it; the command implements them inline.',
  phases: [
    { title: 'Orchestrate', detail: 'one opus orchestrator agent derives the approach summary, steps + components' },
    { title: 'Execute', detail: 'one executor agent per component; parallel components fire together per step and skip build/test, then one step verifier runs the step checks; blocked components rerun after the next step; a failed step stops the run' },
    { title: 'Verify', detail: 'inline when all passed + mechanical, else one verification agent. It runs at the same time as the bug review' },
    { title: 'Review', detail: 'bug review: logic, integration and edge-cases lens reviewers, plus security and flow when the plan calls for them. One sonnet skeptic per reviewer tries to refute its findings as soon as that reviewer finishes' },
    { title: 'Fix', detail: 'one fixer for verification failures and confirmed bug findings, behaviour only. Then the Checks agent runs build/test/e2e/lint with repairs. The verifier reruns when completeness had failed' },
    { title: 'Standards', detail: 'only when the run is functionally green: the review-style reviewer and its skeptic' },
    { title: 'Refactor', detail: 'one behaviour-preserving fixer for the standards findings, then a final Checks run when it changed something' }
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract note: the executor / orchestrator / verifier prompts below are the
// inline, schema-validated form of src/agents/*-agent.md. Those .md files remain
// the canonical human-readable contract; keep these prompts in sync with them.
//
// The reviewer prompts are the schema-validated form of src/commands/5/review.md,
// the fixer prompt and the triage rules that of address-review-findings.md.
// The three bug-hunt lens reviewers (logic, integration, edge-cases) exist only here.
// They replace the code-review skill inside the workflow. At effort high, code-review
// runs in the background and ends the subagent's turn. The reviewer would then return nothing.
//
// This script has NO filesystem access. It orchestrates agents and RETURNS the
// final result. The /5:implement command writes the findings file, asks the user
// about the few findings that need a decision, runs the scope check, and
// auto-commits after this returns. Nothing is persisted: a rerun starts over.
//
// Functionality comes first. The verifier and the bug review run at the same time.
// One fixer then handles verification failures and confirmed bug findings, and the
// Checks agent runs again. Only a functionally green run gets the standards review.
// Its findings go to a refactor fixer that must keep behaviour exactly the same.
// When a step failed and later steps were skipped, only the verifier runs.
//
// Return shape: `review` is null only when steps were skipped. Otherwise it holds
// reviewers, missing, runFiles, findings (both rounds, ids R1.. and S1.., each with
// `round`), fixChecks, refactorChecks, checks (the last of the two that ran), and
// standards ('ran' or 'skipped: <reason>').
//
// Models: haiku for mechanical work, sonnet for ordinary logic, opus at effort
// medium for complex work, for every retry, and for the orchestrator.
// args.advisor is opt-in from .5/config.json. The command sets it only when the
// advisor tool is available. Then executors planned as opus run on sonnet with the
// advisor rule. Retries always run on opus without the advisor.
// Every other agent is told not to call the advisor tool.
//
// Executors in a parallel step with more than one component run no build and no test.
// One step verifier runs the step's checks after them. A red step verifier stops the run.
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

const VERDICTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdicts'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['number', 'real', 'reason'],
        properties: {
          number: { type: 'integer', description: 'number of the finding in the list' },
          real: { type: 'boolean' },
          reason: { type: 'string' }
        }
      }
    }
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
  required: ['summary', 'steps', 'pendingComponents'],
  properties: {
    summary: { type: 'string', description: 'short summary of the approach' },
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
        required: ['name', 'action', 'step', 'mode', 'model', 'files'],
        properties: {
          name: { type: 'string' },
          action: { enum: ['create', 'modify', 'delete', 'rename'] },
          step: { type: 'integer' },
          mode: { enum: ['parallel', 'sequential'] },
          model: { enum: ['haiku', 'sonnet', 'opus'] },
          files: { type: 'array', items: { type: 'string' }, description: 'target files; for rename the destination' },
          sourceFile: { type: ['string', 'null'], description: 'for rename: the origin' },
          description: { type: 'string' },
          acceptanceCriteria: { type: 'array', items: { type: 'string' } },
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

The plan has no fixed shape. Derive the components from whatever it describes, named in short kebab-case, then turn them into steps + components:
- One component is one coherent change to one or a few tightly coupled files. Do not split such a change into one component per file. List its target files in files. For a rename, sourceFile is the origin and files holds the destination.
- Group independent components into one step with mode "parallel"; use "sequential" only when components touch the same files, one imports another, or there is an explicit dependency.
- Prefer fewer steps. Tests run after the components they validate.
- model "haiku" for mechanical work (UI tweaks, tests, docs, config, simple single-file edits); "sonnet" for ordinary logic; "opus" only for complex logic, cross-module behavior, security/auth, data migrations, or public API contracts.
- 1-2 high-signal patternRefs per component with line ranges or symbols so executors avoid whole-file reads. Take them from the plan where it names patterns, else find them with Glob/Grep.
- verifyCommands: narrowest relevant check first, then project build/test.
- Exclude work the plan defers or rules out. Represent every other component once. dependsOn must reference existing component names.
- Dependencies: for each component, list the project files and symbols it includes, requires, imports, calls, or tests. When another component creates one of them, add that component to dependsOn and put it in an EARLIER step — never the same parallel step or a later one.
- acceptanceCriteria: per component, the checkable outcomes it must meet. Take them from the plan where it states them.
- summary: a short summary of the overall approach. Executors get it as context.
- securitySensitive: true when the plan touches auth, authorization, user input handling, secrets, cryptography, or SQL/shell/path construction. lifecycleSensitive: true when it touches install, update, migration, deploy, or bootstrap paths, or the order in which files are written, uploaded, or loaded.

Return an object matching the schema (summary, securitySensitive, lifecycleSensitive, steps[] and pendingComponents[]).${noAdvisorBlock(a)}`
}

const ADVISOR_RULE = 'You have an advisor tool backed by a stronger model. It sees your whole conversation. Call it after you have read the relevant code and before you write anything. Call it again when you are stuck, when a verify fails twice, and before you report failed. Do not call it for routine steps.'

const NO_VERIFY_RULE = 'Run no build and no test. Other executors run at the same time. A step verifier runs after this step. Report verify as skipped.'

// The session advisor reaches every subagent. Only the first attempt of an executor planned as opus uses it.
// That attempt runs on sonnet. Retries run on opus and do not use the advisor.
// The advisor line goes at the end of a prompt as its own paragraph, or nothing when the advisor is off.
function advisorBlock(a, advised) {
  if (!a.advisor) return ''
  return `\n\n${advised ? ADVISOR_RULE : 'Do not call the advisor tool.'}`
}

// For every agent that is not an executor planned as opus.
const noAdvisorBlock = a => advisorBlock(a, false)

function retryContext(previous) {
  const failure = previous
    ? `status ${previous.status}, verify ${previous.verify}, error: ${previous.error || 'none'}, deviations: ${previous.deviations || 'none'}`
    : 'the agent crashed without returning a result'
  return `This is a RETRY of a failed attempt (${failure}). Read the target files as the previous attempt left them, find the root cause, and correct it.`
}

function executorPrompt(c, a, opts) {
  const refs = (c.patternRefs || []).map(r => `  - ${r.file}${r.read ? ` (${r.read})` : ''}${r.reason ? ` — ${r.reason}` : ''}`).join('\n') || '  - none'
  const verify = (c.verifyCommands || []).join(' && ') || 'infer the narrowest relevant test/build command'
  const standards = a.standards || {}
  const repoStandards = (standards.repo || []).map(f => `  - ${f}`).join('\n') || '  - none found'
  const styles = (standards.styles || []).map(f => `  - ${f}`).join('\n') || '  - none found'
  const o = opts || {}
  // runComponent advises only the first attempt of an executor planned as opus.
  const retry = o.retry ? `\n${retryContext(o.result)}` : ''
  const advisor = advisorBlock(a, !!o.advised)
  const verifyLine = o.verify === false ? NO_VERIFY_RULE : `Then run: ${verify}`
  const criteria = (c.acceptanceCriteria || []).map(x => `  - ${x}`).join('\n') || '  - as described in the intent'
  return `You are a Step Executor. Implement EXACTLY this component and nothing more.${retry}

Approach (context only): ${a.summary || 'see the plan'}

Component: ${c.name}
Action: ${c.action}
Target files: ${(c.files || []).join(', ')}${c.sourceFile ? `\nSource file (rename from): ${c.sourceFile}` : ''}
Intent: ${c.description || ''}
Acceptance criteria:
${criteria}

Read only these pattern references (ranges/symbols), plus the target files for modify/rename — and for create when they already exist:
${refs}

Standards — read the parts that apply to your target files and follow them. Repository standards win, then user-level rules (~/.claude/CLAUDE.md, ~/.claude/rules/), then the style skills.
Repository standards:
${repoStandards}
Style skills:
${styles}

Rules: Nothing is persisted between runs, so your work may already be done: for \`create\`, read each target first when it exists — if it already fulfils the intent, report success with no change; otherwise complete it, never overwrite it blindly. Smallest coherent change; reuse what already exists in this codebase before writing new code, then prefer stdlib, native platform features, and installed dependencies; touch only the target files and what they strictly need (its test, an import site); mirror existing naming/exports/layout/tests; follow any local skill or rule; add no new dependency; no abstraction or error handling beyond what the intent requires. Fix mechanical issues you cause (imports, types, lint). When a project file or symbol your component needs does not exist yet, do not create it: STOP and report status blocked with blockedBy — /5:implement reruns you after the next step. STOP and report failed for a missing package, unplanned auth/schema/API/contract changes, or unclear product decisions. If verify fails only from pre-existing unrelated issues, report that as a deviation with the exact evidence — do not mark the component failed. Do not make more than three attempts on the same failing issue.${advisor}

${verifyLine}

Return structured output: status, blockedBy (only when blocked), filesCreated, filesModified, verify, deviations (none or brief), skipped (none, or what you deliberately did not build — add when ...), error (none or description). Keep it concise — no logs or diffs unless failed.`
}

function verifyPrompt(a, results, skippedSteps) {
  const ran = results.flatMap(s => [
    ...s.items.map(i =>
      `  step ${s.step} ${i.component.name}: ${i.result ? i.result.status : 'no result'}${i.result && i.result.blockedBy ? ` by ${i.result.blockedBy}` : ''} (verify ${i.result ? i.result.verify : '?'})${i.escalated ? ' [escalated to opus]' : i.retried ? ' [retried]' : ''}`),
    ...stepVerifies(s).map(v => `  step ${s.step} ${v.label}: ${v.result.status}`)
  ])
  const summary = ran.join('\n') || '  (no components ran)'
  const skipped = (skippedSteps || []).length
    ? `\n\nSkipped steps — not run because an earlier step failed. Their components are not done, so completeness is not passed:\n${skippedSteps.map(s => `  step ${s.number} ${s.name}`).join('\n')}`
    : ''
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
${summary}${skipped}

Checks — only whether the plan was built and works. Code quality and correctness belong to the bug review, which runs at the same time as you: completeness (every planned component done, and any acceptance criteria the plan states addressed); files exist for create/modify, rename moved correctly, delete removed; build + test pass (reuse the baseline and component results above when they already prove status — rerun only the commands whose inputs changed, not identical passing ones); scope (run \`git status --short\` and \`git diff HEAD --stat\`, and read untracked files directly since \`git diff HEAD\` omits them: every changed file traces to a planned component — its target, its test, an import site, or a file a repository standard requires (such as a changelog entry); flag files outside the plan, work the plan rules out or defers, new dependencies no component requires, and unrequested abstractions — report drift only in scope; it does not change status). Prefer changed files over broad scanning.

Return structured output: status, completeness, infrastructure, acceptanceCriteria ("satisfied/total"), scope, commands[], failures[] (one "drift: {path} — {why}" entry per drift finding).${noAdvisorBlock(a)}`
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

// Each lens reviewer hunts bugs from one angle. Each one gets its own skeptic.
const REVIEW_LENSES = [
  { key: 'logic', focus: 'logic errors, wrong conditions, off-by-one, null handling, wrong mapping of fields, broken error handling' },
  { key: 'integration', focus: 'callers and callees of the changed code: broken contracts, changed behaviour for existing users, missing wiring, persistence and transaction issues' },
  { key: 'edge-cases', focus: 'edge cases and concurrency: empty inputs, large inputs, ordering, races, idempotency, time zones, retries' }
]

function lensPrompt(lens, a, files) {
  return `You are a Code Reviewer looking for bugs. ${reviewScope(a, files)}

Focus: ${lens.focus}

Report only real bugs with a concrete failure scenario. No style remarks. Return an empty list if you find nothing.

${TRIAGE_RULE}${noAdvisorBlock(a)}`
}

function securityPrompt(a, files) {
  return `You are a Security Reviewer. ${reviewScope(a, files)}

If the built-in security-review skill is available, invoke Skill(skill: "security-review") and keep only its findings in these files. Otherwise review them for authentication and authorization gaps, unvalidated input, leaked secrets, weak cryptography, and SQL/shell/path injection. Every security finding has severity error.

${TRIAGE_RULE}${noAdvisorBlock(a)}`
}

function standardsPrompt(a, files) {
  return `You are a Standards Reviewer. Invoke Skill(skill: "review-style", args: "${a.fixedPoint || 'HEAD'} files: ${files.join(', ')} report only"). If it cannot be invoked, read .claude/skills/review-style/SKILL.md and follow it with the same arguments. Leave out its Suppressed findings. review-style marks ⛔️ for a repository standard or user-level rule worded as a statement or command. It marks ⚠️ for rules worded with prefer, should or usually, and for every style-skill finding. ⛔️ findings are severity error, ⚠️ findings severity suggestion. A judgement call whose fix is clearly better is fix, otherwise skip. Put the quoted rule sentence into description.

${TRIAGE_RULE}${noAdvisorBlock(a)}`
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

${TRIAGE_RULE}${noAdvisorBlock(a)}`
}

// One skeptic checks all findings of one reviewer at once. Unsure counts as not real.
function skepticPrompt(a, findings) {
  const list = findings.map((f, n) => `${n + 1}. ${f.file}${f.line ? `:${f.line}` : ''} — ${f.description}\n   Fix: ${f.fix || 'as described'}`).join('\n')
  return `You are a Review Skeptic. Try to refute each of these review findings by reading the code yourself. Do not edit any file.

${list}

Judge every finding on its own. Do not let one verdict influence the next.
Set real=false when the finding cannot happen, is already handled, or is not a problem. If unsure, set real=false.
Return one verdict per finding with its number and a one-line reason.${noAdvisorBlock(a)}`
}

// The file of a verification pseudo-finding. The fixer brief names it.
const VERIFICATION_FILE = '(verification)'

// The fix round runs before the standards review. It changes behaviour only.
const FIX_BRIEF = `Fix behaviour only. Do not refactor or restyle. A standards round follows once the change works.
You may fix failed build or test results and unmet acceptance criteria. A finding with file ${VERIFICATION_FILE} is such a problem. Find its files from the description.
Do NOT build missing planned components. Mark such a problem failed with the reason.
Mark a finding that needs a product decision rejected with the reason.`

// The refactor round runs on a change that already works.
const REFACTOR_BRIEF = `The change already works. Behaviour must stay exactly the same.
Fix every hard finding (⛔️, severity error), unless that changes behaviour or contradicts the plan.
Fix a judgement call only when it clearly makes the code easier to read.
Mark every finding you skip rejected with the reason.`

function fixerPrompt(a, findings, brief) {
  const list = findings.map(f => `  - ${f.id} ${f.file}${f.line ? `:${f.line}` : ''}: ${f.description} → ${f.fix || 'fix as described'}`).join('\n')
  const dirty = (a.dirty || []).join(', ') || 'none'
  return `You are a Review Fixer. Apply these findings:
${list}

${brief}

Read each file first, then apply its fixes from the highest line to the lowest. Touch another file only when a fix strictly needs it (its test, a caller), and never one of these, which hold the user's own uncommitted work: ${dirty}. Make no unrelated change. When reading the code shows a finding's premise is wrong, mark it rejected with the reason — do not ask. Reject a finding whose file path is absolute or leaves the repository root through \`..\`. Mark it rejected with that reason (reported as \`FAILED\` in \`/5:address-review-findings\`) and never edit it. Follow the repository standards first, then the user-level rules, then the style skills. Run the narrowest relevant test or build for the changed files.

Return structured output: one item per finding id (applied, rejected, or failed, with a one-line note) and filesModified.${noAdvisorBlock(a)}`
}

// The baseline commands and their status, one per line, for the checks and step-verify prompts.
function baselineLines(a) {
  return (a.baseline && a.baseline.length)
    ? a.baseline.map(b => `  ${b.command || '?'}: ${b.status}`).join('\n')
    : '  (none recorded)'
}

const REPAIR_LIMIT = 'At most two repair attempts per command.'
const CHECKS_RETURN = 'Return structured output: status (passed when every command passed, was skipped, or failed only pre-existing), commands[] with category, command, status, and a one-line summary, and filesModified (repairs only).'

function checksPrompt(a, files) {
  return `You are the final Checks agent. Identify the commands from ${a.paths.config} and, only as needed, the project manifests (package.json, Makefile, pyproject.toml, Cargo.toml, Gradle files). Run every available command in the categories build, test, e2e, and lint; skip a category only when no command exists or it is configured as none.

Baseline (pre-change) results — a failure listed here is pre-existing; report it as pre-existing:
${baselineLines(a)}

When a command fails because of this run's changes, fix the cause with the smallest change in these files only — ${files.join(', ')} — and rerun it. ${REPAIR_LIMIT} Do not touch any other file.

${CHECKS_RETURN}${noAdvisorBlock(a)}`
}

// Runs the checks of components that were built at the same time without verifying.
function stepVerifyPrompt(a, label, items) {
  const filesOf = i => {
    const touched = i.result ? [...(i.result.filesCreated || []), ...(i.result.filesModified || [])] : []
    return touched.length ? touched : (i.component.files || [])
  }
  const files = [...new Set(items.flatMap(filesOf).map(stripDot))]
  const commands = [...new Set(items.flatMap(i => i.component.verifyCommands || []))]
  const list = commands.map(cmd => `  - ${cmd}`).join('\n') || '  - the narrowest build or test covering these files'
  return `You are a Step Verifier for ${label}. Its components were built at the same time, without build or test.

Components and their files:
${items.map(i => `  - ${i.component.name}: ${filesOf(i).join(', ') || 'none'}`).join('\n')}

Run these commands one after another, never at the same time:
${list}

Baseline (pre-change) results. A failure listed here is pre-existing. Report it as pre-existing:
${baselineLines(a)}

When a command fails because of this step, fix the cause with the smallest change in these files only: ${files.join(', ')}. Then rerun it. ${REPAIR_LIMIT} Change nothing else.

${CHECKS_RETURN}${noAdvisorBlock(a)}`
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

// Runs one component and retries it up to twice, handing each retry the previous failure.
// With the advisor on, a component planned as opus runs on sonnet and gets the advisor rule.
// Every retry runs on opus at effort medium, without the advisor.
// `verify` is false when other executors run at the same time. A step verifier then runs the checks.
async function runComponent(c, a, verify = true) {
  const run = (model, label, opts) => agent(executorPrompt(c, a, { ...opts, verify }),
    { label, phase: 'Execute', ...modelOpts(model), schema: RESULT_SCHEMA }).catch(() => null)

  // `last` is the latest attempt, null when it crashed; `item.result` keeps the latest structured result.
  const advised = !!a.advisor && c.model === 'opus'
  let last = await run(advised ? 'sonnet' : c.model, `exec:${c.name}`, { advised })
  const item = { component: c, result: last, retried: false, escalated: false, noVerify: !verify }
  for (let attempt = 1; attempt <= 2 && needsRetry(item.result); attempt++) {
    log(`retry ${c.name} (attempt ${attempt + 1}) on opus`)
    item.retried = true
    item.escalated = item.escalated || c.model !== 'opus'
    last = await run('opus', `retry:${c.name}`, { retry: true, result: last })
    if (last) item.result = last
  }
  return item
}

async function runStep(step, plan, a) {
  const stepComps = plan.pendingComponents.filter(c => step.components.includes(c.name))
  // Concurrent executors must not build or test at the same time. A step verifier covers them.
  const verify = !(step.mode === 'parallel' && stepComps.length > 1)
  let items
  if (step.mode === 'parallel') {
    // Fire every parallel component together, retries included — true concurrency, one wave.
    items = await parallel(stepComps.map(c => () => runComponent(c, a, verify)))
  } else {
    // Sequential components depend on each other, so each one is retried before the next starts.
    items = []
    for (const c of stepComps) items.push(await runComponent(c, a, verify))
  }
  return { step: step.number, name: step.name, mode: step.mode, items, stepVerify: null }
}

// Reruns blocked components in place, once the step that should create what they need has run.
// Two or more reruns run at the same time, so they skip build/test like a parallel step.
async function rerunBlocked(items, a, afterStep) {
  log(`rerun ${items.length} blocked component(s): ${items.map(i => `${i.component.name} (${i.result.blockedBy || '?'})`).join(', ')}`)
  const verify = items.length < 2
  await parallel(items.map(item => async () => {
    const again = await runComponent(item.component, a, verify)
    if (again.result) item.result = again.result
    item.retried = item.retried || again.retried
    item.escalated = item.escalated || again.escalated
    item.noVerify = again.noVerify
    item.lastTry = afterStep
  }))
}

// Runs one step verifier over the successful items that skipped build/test. Returns null when there are none.
// A crashed step verifier counts as failed.
async function verifyStep(a, label, items) {
  const covered = items.filter(i => i.noVerify && i.result && i.result.status === 'success')
  if (!covered.length) return null
  const model = covered.some(i => i.component.model === 'opus') ? 'opus' : 'sonnet'
  const out = await agent(stepVerifyPrompt(a, label, covered), { label: `verify:${label}`, phase: 'Execute', ...modelOpts(model), schema: CHECKS_SCHEMA })
    .catch(() => null)
  const result = out || { status: 'failed', commands: [], error: 'the step verifier returned nothing' }
  log(`verify:${label}: ${result.status}`)
  return result
}

// Every step verifier that ran for one step result: its own, the rerun batch after it, and the final rerun.
function stepVerifies(s) {
  return [
    { label: 'step verifier', result: s.stepVerify },
    { label: 'rerun verifier', result: s.rerunVerify },
    { label: 'final rerun verifier', result: s.finalRerunVerify }
  ].filter(v => v.result)
}

const stripDot = f => f.replace(/^\.\//, '')

// Hands the fix and decide findings of one reviewer to a sonnet skeptic. A refuted finding becomes skip.
// A crashed skeptic or a missing verdict leaves the findings unchanged.
async function refuteFindings(a, key, findings, phaseTitle = 'Review') {
  if (!findings) return findings
  const open = findings.filter(f => f.action === 'fix' || f.action === 'decide')
  if (!open.length) return findings
  const out = await agent(skepticPrompt(a, open), { label: `skeptic:${key}`, phase: phaseTitle, ...modelOpts('sonnet'), schema: VERDICTS_SCHEMA })
    .catch(() => null)
  if (!out) {
    log(`skeptic:${key} returned nothing, findings kept as they are`)
    return findings
  }
  open.forEach((f, n) => {
    const verdict = out.verdicts.find(v => v.number === n + 1)
    if (verdict && !verdict.real) {
      f.action = 'skip'
      f.reason = `refuted: ${verdict.reason}`
      f.refuted = true
    }
  })
  return findings
}

// Every file the run planned or touched.
function runFilesOf(allItems) {
  return [...new Set(allItems.flatMap(i => [
    ...(i.component.files || []), i.component.sourceFile,
    ...(i.result ? [...(i.result.filesCreated || []), ...(i.result.filesModified || [])] : [])
  ]).filter(Boolean).map(stripDot))]
}

// Runs the reviewers. Each reviewer's skeptic starts as soon as that reviewer finishes.
async function runReviewers(a, reviewers, runFiles, phaseTitle) {
  const reports = await pipeline(
    reviewers,
    r => agent(r.prompt(a, runFiles), { label: `review:${r.key}`, phase: phaseTitle, ...modelOpts(r.model), schema: FINDINGS_SCHEMA })
      .catch(() => null)
      .then(out => ({ key: r.key, findings: out && out.findings.map(f => ({ ...f, reviewer: r.key })) })),
    report => refuteFindings(a, report.key, report.findings, phaseTitle)
  )
  const missing = reviewers.filter((r, n) => !reports[n]).map(r => r.key)
  if (missing.length) log(`reviewer(s) returned nothing: ${missing.join(', ')}`)
  return { reports, missing }
}

// Dedup by file, line and normalized description. Keep only the run's files.
// Findings in pre-run dirty files are reported, never fixed.
function collectFindings(reports, runFiles, dirty, prefix, round) {
  const findings = []
  const seen = new Set()
  let outside = 0
  // Refuted findings come last. This way they never take the slot of a live finding with the same key.
  // A finding without a line is never deduped.
  const reported = reports.filter(Boolean).flat()
  const ordered = [...reported.filter(f => f.action !== 'skip'), ...reported.filter(f => f.action === 'skip')]
  for (const f of ordered) {
    const file = stripDot(f.file)
    if (!runFiles.includes(file)) { outside++; continue }
    const normalizedDescription = (f.description || '').trim().toLowerCase().replace(/\s+/g, ' ')
    const key = `${file}:${f.line || 0}:${normalizedDescription}`
    if (f.line && seen.has(key)) continue
    seen.add(key)
    const finding = { ...f, file, round, id: `${prefix}${findings.length + 1}` }
    if (dirty.has(file) && finding.action !== 'skip') {
      finding.action = 'report'
      finding.reason = 'pre-run dirty file: may sit in your own earlier work, left untouched'
    }
    findings.push(finding)
  }
  if (outside) log(`${round} review: dropped ${outside} finding(s) outside the run's files`)
  return findings
}

// The bug review: the three lenses, plus security and flow when the plan calls for them.
async function reviewBugs(a, plan, runFiles, dirty) {
  const reviewers = REVIEW_LENSES.map(lens => ({ key: lens.key, prompt: (a, files) => lensPrompt(lens, a, files), model: 'sonnet' }))
  if (plan.securitySensitive) reviewers.push({ key: 'security', prompt: securityPrompt, model: 'sonnet' })
  if (plan.lifecycleSensitive || plan.securitySensitive) reviewers.push({ key: 'flow', prompt: flowPrompt, model: 'opus' })
  const { reports, missing } = await runReviewers(a, reviewers, runFiles, 'Review')
  return { reviewers: reviewers.map(r => r.key), missing, findings: collectFindings(reports, runFiles, dirty, 'R', 'bugs') }
}

// Security work and flow findings need opus. Everything else is fixed on sonnet.
function fixModel(plan, items) {
  return plan.securitySensitive || items.some(f => f.reviewer === 'flow') ? 'opus' : 'sonnet'
}

// One fixer applies every item it gets. Sets status and note on each item and returns the applied count.
async function fixRound(a, plan, items, brief, label, phaseTitle) {
  if (!items.length) return 0
  const out = await agent(fixerPrompt(a, items, brief), { label, phase: phaseTitle, ...modelOpts(fixModel(plan, items)), schema: FIX_SCHEMA })
    .catch(() => null)
  for (const f of items) {
    const item = out && out.items.find(i => i.id === f.id)
    f.status = item ? item.status : 'failed'
    if (item && item.note) f.note = item.note
  }
  return items.filter(f => f.status === 'applied').length
}

// Verification failures become pseudo-findings V1.. for the fixer. Drift is reported, never fixed.
function verificationProblems(verification) {
  if (verification.status === 'passed' || verification.missing) return []
  return [
    ...(verification.failures || []).filter(f => !f.startsWith('drift:')).map(f => ({ description: f })),
    ...(verification.commands || []).filter(c => c.status === 'failed')
      .map(c => ({ description: `command failed: ${c.command}${c.summary ? ` (${c.summary})` : ''}`, fix: 'make it pass' }))
  ].map((p, n) => ({ ...p, id: `V${n + 1}`, file: VERIFICATION_FILE }))
}

// The standards review and its skeptic. Runs only on a functionally green run.
async function standardsRound(a, runFiles, dirty) {
  phase('Standards')
  const reviewers = [{ key: 'standards', prompt: standardsPrompt, model: 'sonnet' }]
  const { reports, missing } = await runReviewers(a, reviewers, runFiles, 'Standards')
  return { missing, findings: collectFindings(reports, runFiles, dirty, 'S', 'standards') }
}

// A crashed Checks agent counts as failed, like a crashed step verifier. No build or test ran on the code.
const checksAgent = (a, runFiles, label, phaseTitle, usedOpus) =>
  agent(checksPrompt(a, runFiles), { label, phase: phaseTitle, ...modelOpts(usedOpus ? 'opus' : 'sonnet'), schema: CHECKS_SCHEMA })
    .catch(() => null)
    .then(out => out || { status: 'failed', commands: [], error: 'the checks agent returned nothing' })

// ── Main ─────────────────────────────────────────────────────────────────────

const a = args || {}

phase('Orchestrate')
const plan = await agent(orchestratorPrompt(a), { label: 'orchestrate', phase: 'Orchestrate', ...modelOpts('opus'), schema: STATE_SCHEMA })
const steps = plan.steps
const components = plan.pendingComponents
// Executors get the approach summary as context.
const ctx = { ...a, summary: plan.summary }

phase('Execute')
// A blocked component waits for the next step, then — if still blocked — for the end of the run.
// A step whose component still fails after its retries stops the run. Later steps would build on it.
const results = []
let waiting = []
const late = []
for (let n = 0; n < steps.length; n++) {
  const r = await runStep(steps[n], plan, ctx)
  results.push(r)
  // The step verifier runs only when no component of the step failed.
  if (!r.items.some(i => needsRetry(i.result))) r.stepVerify = await verifyStep(ctx, `step-${steps[n].number}`, r.items)
  // A blocked component from the previous step that fails on its rerun stops the run too.
  let rerunFailed = []
  if (waiting.length) {
    await rerunBlocked(waiting, ctx, n)
    late.push(...waiting.filter(isBlocked))
    rerunFailed = waiting.filter(i => needsRetry(i.result))
    if (!rerunFailed.length) r.rerunVerify = await verifyStep(ctx, `step-${steps[n].number}-rerun`, waiting)
  }
  waiting = r.items.filter(isBlocked)
  waiting.forEach(i => { i.lastTry = n })
  // A red step verifier counts like a failed component.
  const failed = [
    ...r.items.filter(i => needsRetry(i.result)).map(i => i.component.name),
    ...rerunFailed.map(i => i.component.name),
    ...stepVerifies(r).filter(v => v.result.status !== 'passed').map(v => v.label)
  ]
  if (failed.length) {
    log(`stopping after step ${steps[n].number}: ${failed.join(', ')} failed`)
    break
  }
}
// `results` holds one entry per step that ran. The final rerun covers only those steps.
const lastRun = results.length - 1
const skippedSteps = steps.slice(results.length).map(s => ({ number: s.number, name: s.name }))
const finalRerun = [...late.filter(i => i.lastTry < lastRun), ...waiting]
if (finalRerun.length) {
  await rerunBlocked(finalRerun, ctx, lastRun + 1)
  if (finalRerun.length > 1 && !finalRerun.some(i => needsRetry(i.result))) {
    results[lastRun].finalRerunVerify = await verifyStep(ctx, 'final-rerun', finalRerun)
  }
}

phase('Verify')
const allItems = results.flatMap(s => s.items)
// verify "skipped" from a parallel executor counts as passed only through its step verifier.
const everyComponentSucceeded = allItems.length > 0 &&
  allItems.every(i => i.result && i.result.status === 'success' && i.result.verify !== 'failed')
const everyStepVerifierPassed = results.every(s => stepVerifies(s).every(v => v.result.status === 'passed'))
const allPassed = everyComponentSucceeded && everyStepVerifierPassed
// Mechanical when every component was planned as haiku and none needed a retry; anything
// else signals reasoning-level work that warrants the full verification agent.
const usedOpus = components.some(c => c.model === 'opus') || allItems.some(i => i.escalated)
const mechanical = !usedOpus && !allItems.some(i => i.retried) && components.every(c => (c.model || 'haiku') === 'haiku')
// Deterministic scope signal: files an executor touched beyond its planned target(s).
// Tests and import sites are legitimate, so this is reported for the user, never a failure.
const extraFiles = allItems.flatMap(i => {
  const planned = new Set([...(i.component.files || []), i.component.sourceFile].filter(Boolean).map(stripDot))
  const touched = i.result ? [...(i.result.filesCreated || []), ...(i.result.filesModified || [])].map(stripDot) : []
  return touched.filter(f => !planned.has(f)).map(f => ({ component: i.component.name, file: f }))
})
if (extraFiles.length) log(`scope: ${extraFiles.length} file(s) touched outside planned targets`)

function verifyInline() {
  log('all components passed + mechanical — no verification agent; the Checks agent runs build/test, /5:implement the scope check')
  // No shell access here. The Checks agent after the fix round runs build/test when it sees inline: true. /5:implement runs the scope check.
  return { status: 'passed', completeness: 'passed', infrastructure: 'passed', acceptanceCriteria: 'n/a', commands: [], failures: [], inline: true }
}

// A crashed verifier fails the run. There is nothing the fixer could act on.
const VERIFY_MISSING = { missing: true, status: 'failed', completeness: 'failed', infrastructure: 'failed', scope: 'passed', commands: [], failures: ['the verification agent returned nothing'] }

const verifyAgent = (label, phaseTitle) =>
  agent(verifyPrompt(a, results, skippedSteps), {
    label, phase: phaseTitle, ...modelOpts(usedOpus ? 'opus' : 'sonnet'), schema: VERIFICATION_SCHEMA
  }).catch(() => null).then(v => v || VERIFY_MISSING)

const runVerification = () => (allPassed && mechanical)
  ? Promise.resolve(verifyInline())
  : verifyAgent('verify', 'Verify')

let verification
let review = null
let fixRoundRan = false
let fixApplied = 0
let vProblems = []
let functionallyGreen = false
if (skippedSteps.length) {
  // A step failed. Reviewing and fixing a half-built change wastes work, so only the verifier runs, for the report.
  verification = await runVerification()
  log('a step failed: review and fix skipped')
} else {
  const runFiles = runFilesOf(allItems)
  const dirty = new Set((a.dirty || []).map(stripDot))

  // Functionality first. The verifier and the bug review run at the same time.
  phase('Review')
  const [v, bugs] = await parallel([
    () => runVerification(),
    () => reviewBugs(a, plan, runFiles, dirty)
  ])
  verification = v || VERIFY_MISSING
  const bugReview = bugs || { reviewers: [], missing: ['bugs'], findings: [] }

  // One fixer for the verification failures and the confirmed bug findings.
  phase('Fix')
  vProblems = verificationProblems(verification)
  const toFix = [...vProblems, ...bugReview.findings.filter(f => f.action === 'fix')]
  fixRoundRan = toFix.length > 0
  fixApplied = await fixRound(a, plan, toFix, FIX_BRIEF, 'fix', 'Fix')
  // The inline fast path ran no build/test yet, and applied fixes change what the verifier saw.
  let fixChecks = null
  if (fixApplied || verification.inline) fixChecks = await checksAgent(a, runFiles, 'checks', 'Fix', usedOpus)
  if (fixApplied && verification.completeness !== 'passed') {
    verification = await verifyAgent('re-verify', 'Fix')
  }
  const bugFindings = bugReview.findings
  log(`bug review: ${bugFindings.length} finding(s), ${bugFindings.filter(f => f.refuted).length} refuted, ${bugFindings.filter(f => f.status === 'applied').length} fixed, ${bugFindings.filter(f => f.action === 'decide').length} need a decision`)

  // Functionally green: complete, build and test pass, and no bug fix failed.
  // When the Checks agent ran, its result replaces the verifier's build and test result.
  const isComplete = verification.completeness === 'passed'
  const buildPassed = fixChecks ? fixChecks.status === 'passed' : verification.infrastructure === 'passed'
  const hasUnfixedBugs = bugFindings.some(f => f.action === 'fix' && f.status === 'failed')
  const notGreen = []
  if (!isComplete) notGreen.push('completeness not passed')
  if (!buildPassed) notGreen.push('build or test failed')
  if (hasUnfixedBugs) notGreen.push('unfixed bug findings')
  functionallyGreen = !notGreen.length

  // Only a working change gets the standards review and the behaviour-preserving refactor.
  let standards = `skipped: ${notGreen.join(', ')}`
  let standardsFindings = []
  let standardsMissing = []
  let refactorChecks = null
  if (functionallyGreen) {
    const std = await standardsRound(a, runFiles, dirty)
    standards = 'ran'
    standardsFindings = std.findings
    standardsMissing = std.missing
    phase('Refactor')
    const refactorApplied = await fixRound(a, plan, standardsFindings.filter(f => f.action === 'fix'), REFACTOR_BRIEF, 'refactor', 'Refactor')
    if (refactorApplied) refactorChecks = await checksAgent(a, runFiles, 'final-checks', 'Refactor', usedOpus)
    log(`standards review: ${standardsFindings.length} finding(s), ${refactorApplied} fixed, ${standardsFindings.filter(f => f.action === 'decide').length} need a decision`)
  } else {
    log(`standards review ${standards}`)
  }

  review = {
    reviewers: [...bugReview.reviewers, ...(functionallyGreen ? ['standards'] : [])],
    missing: [...bugReview.missing, ...standardsMissing],
    runFiles,
    findings: [...bugFindings, ...standardsFindings],
    checks: refactorChecks || fixChecks,
    fixChecks,
    refactorChecks,
    standards
  }
}
const checksPassed = !review || !review.checks || review.checks.status === 'passed'
const status = !skippedSteps.length && functionallyGreen && checksPassed ? 'completed' : 'failed'

// A compact summary for /5:implement. It reads this first and opens the details only when needed.
const stillBlocked = allItems.filter(isBlocked)
const failedCommands = [
  ...(verification.commands || []),
  ...((review && review.fixChecks && review.fixChecks.commands) || []),
  ...((review && review.refactorChecks && review.refactorChecks.commands) || [])
].filter(c => c.status === 'failed')
const roundLine = round => {
  const fs = review.findings.filter(f => f.round === round)
  const fixed = fs.filter(f => f.status === 'applied').length
  const toDecide = fs.filter(f => f.action === 'decide').length
  const failedFixes = fs.filter(f => f.status === 'failed').length
  // Only the bug round has skeptics that refute findings.
  const refuted = round === 'bugs' ? `${fs.filter(f => f.refuted).length} refuted, ` : ''
  return `${fs.length} findings, ${refuted}${fixed} fixed, ${toDecide} decide, ${failedFixes} failed fixes`
}
const checksState = c => c ? c.status : 'not run'
const stepVerifyLine = results.flatMap(s => stepVerifies(s).map(v => `step ${s.step} ${v.label} ${v.result.status}`)).join('; ') || 'none'
const report = [
  `status: ${status}`,
  `components: ${allItems.map(i => `${i.component.name} (${i.result ? i.result.status : 'no result'})`).join('; ') || 'none'}`,
  `step verify: ${stepVerifyLine}`,
  // A fix round can repair a failed verification without rerunning the verifier. Then `status` is what counts.
  `verification: ${verification.status}${fixRoundRan && vProblems.length ? ' (before the fix round, see status and checks)' : ''}`,
  ...failedCommands.map(c => `  failed: ${c.command}${c.summary ? ` (${c.summary})` : ''}`),
  review ? `bug review: ${roundLine('bugs')}` : 'bug review: skipped, a step failed',
  fixRoundRan ? `fix round: ${vProblems.length} verification problems, ${fixApplied} applied` : 'fix round: not run',
  review
    ? (review.standards === 'ran' ? `standards review: ${roundLine('standards')}` : `standards review: ${review.standards}`)
    : 'standards review: skipped: a step failed',
  `checks: after fix round ${checksState(review && review.fixChecks)}, after refactor round ${checksState(review && review.refactorChecks)}`,
  `skipped steps: ${skippedSteps.map(s => `${s.number} ${s.name}`).join(', ') || 'none'}`,
  `blocked: ${stillBlocked.map(i => `${i.component.name} (${i.result.blockedBy || '?'})`).join(', ') || 'none'}`,
  `extra files: ${extraFiles.length}`
].join('\n')

// Returned to the /5:implement command for the findings file, the decisions, the scope check, per-step staging, and the report.
return {
  report,
  feature: a.feature,
  summary: plan.summary,
  steps,
  components,
  results: results.map(s => ({
    step: s.step,
    name: s.name,
    mode: s.mode,
    stepVerify: s.stepVerify || null,
    items: s.items.map(i => ({ component: i.component.name, files: i.component.files, sourceFile: i.component.sourceFile, retried: i.retried, escalated: i.escalated, result: i.result }))
  })),
  verification,
  skippedSteps,
  extraFiles,
  review,
  status
}
