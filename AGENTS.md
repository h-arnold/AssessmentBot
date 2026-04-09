# AssessmentBot – Core Agent Contract

This file defines cross-component rules only.
For implementation details, always load component-specific instructions first.

### 1. Read-First Routing (Mandatory)

Before editing code, read the instruction file(s) for every component you touch:

- Backend (`src/backend/**`): `src/backend/AGENTS.md`
- Frontend (`src/frontend/**`): `src/frontend/AGENTS.md`
- Builder (`scripts/builder/**`, `build/**` pipeline behaviour): `scripts/builder/AGENTS.md`

If a task spans multiple components, read and apply all relevant instruction files.
If rules conflict, prefer the stricter rule and preserve runtime compatibility.

### 2. Active vs Deprecated Areas

- Active implementation areas: `src/backend`, `src/frontend`, `scripts/builder`.
- `src/AdminSheet` and `src/AssessmentRecordTemplate` are deprecated reference sources.
- Do not add new features in deprecated areas unless explicitly requested.

### 3. Core Principles (All Components)

1. KISS: implement the simplest working solution.
2. Fail fast and loudly in development; never hide errors behind catch-and-ignore logic.
3. Only fulfil the explicit request; no speculative scope expansion.
4. Use British English in comments, docs, and user-facing text.
5. Reuse existing modules/utilities before creating new abstractions.
6. Never silently swallow errors.
7. Never set defaults unless explicitly instructed to do so.
8. Do not add production code purely to satisfy tests.
9. Keep changes minimal, localised, and consistent with existing patterns.
10. Never disable lint rules without express permission from the user; if a rule triggers cascading failures, stop and ask before turning it off.

### 4. Delegation Protocol

- Available project agents (source of truth: `.github/agents`; keep matching `.codex/agents/*.toml` files behaviourally aligned for the Codex runtime):
  - `Planner` (`.github/agents/planner.agent.md`) for clarification-driven planning that produces `SPEC.md`, optional frontend layout specs, and `ACTION_PLAN.md`.
  - `Planner Reviewer` (`.github/agents/planner-reviewer.agent.md`) for impartial second-pass review of planning artefacts against the codebase before later documents or implementation depend on them.
  - `Testing Specialist` (`.github/agents/Testing.agent.md`) for test implementation and test debugging.
  - `Code Reviewer` (`.github/agents/code-reviewer.agent.md`) for code review and standards checks.
  - `Implementation` (`.github/agents/implementation.agent.md`) for focused implementation tasks.
  - `Docs` (`.github/agents/docs.agent.md`) for developer-documentation and JSDoc updates.
  - `De-Sloppification` (`.github/agents/de-sloppification.agent.md`) for slop review and simplification.

Sub-agents are stateless. Provide explicit context in prompts:

- relevant source snippets
- concrete requirements
- error/output details
- exact changes already made

#### 4.1 Invocation Directives

Copilot environment:

- Use `runSubagent` with an object argument and pass full context in the `prompt` body.
- Include: files read, constraints, exact requested outcome, and expected deliverables.
- Keep planning-review prompts deliberately open where possible so the reviewer is not anchored by the caller's theory of the problem.
- Example patterns:

```javascript
// For clarification-driven planning
runSubagent({
  prompt: [
    'Files read: AGENTS.md, existing SPEC.md/ACTION_PLAN.md/layout docs, and relevant source entrypoints.',
    'Constraints: keep planning artefacts separate; use repository templates; no production-code changes.',
    'Exact requested outcome: clarify the feature until you can write SPEC.md, any required frontend layout spec, and ACTION_PLAN.md.',
    'Expected deliverables: updated planning documents plus explicit assumptions, open questions, and readiness for implementation orchestration.',
  ].join('\n'),
  description: 'Planning for a new feature',
  agentName: 'Planner',
});

// For impartial planning review
runSubagent({
  prompt: [
    'Files read: SPEC.md, companion planning docs, and the relevant code areas or entrypoints.',
    'Constraints: review impartially; inspect the actual files and code; do not rewrite the document.',
    'Exact requested outcome: review the planning artefact for gaps, inconsistencies, ambiguities, and downstream implementation risks.',
    'Expected deliverables: findings ordered by severity, open questions or assumptions, and a summary of whether the document is safe to build on.',
  ].join('\n'),
  description: 'Independent review of planning artefact',
  agentName: 'Planner Reviewer',
});

// For source code review
runSubagent({
  prompt: [
    'Files read: updated AssignmentService files, related tests, AGENTS guidance, and any touched docs.',
    'Constraints: review for lint compliance, DRY, SOLID, correctness, and documentation accuracy.',
    'Exact requested outcome: inspect the actual diff and identify any blocking issues or meaningful improvements.',
    'Expected deliverables: findings ordered by severity, residual risks, and a clear pass/fail summary.',
  ].join('\n'),
  description: 'Code review for AssignmentService changes',
  agentName: 'Code Reviewer',
});

// For test implementation and debugging
runSubagent({
  prompt: [
    'Files read: SubmissionRepository, related tests, testing docs, and relevant AGENTS guidance.',
    'Constraints: stay within the requested edge cases and use the module test conventions.',
    'Exact requested outcome: implement and debug the required tests, then run the relevant test command.',
    'Expected deliverables: changed test files, commands run, outcomes, assumptions, and any remaining risks.',
  ].join('\n'),
  description: 'Test work for SubmissionRepository',
  agentName: 'Testing Specialist',
});

// For focused implementation
runSubagent({
  prompt: [
    'Files read: builder manifest merge code, nearby tests, AGENTS guidance, and any relevant builder docs.',
    'Constraints: minimal scope, preserve existing builder behaviour, and keep validation green.',
    'Exact requested outcome: implement the requested builder manifest merge fix and run the relevant lint/tests.',
    'Expected deliverables: files changed, what changed, commands run, outcomes, assumptions, and remaining risks.',
  ].join('\n'),
  description: 'Implementation for builder manifest merge fix',
  agentName: 'Implementation',
});
```

### 5. Shared Config Rule

Before changing any TypeScript or ESLint configuration, read:

- `docs/developer/builder/TypeScriptAndLintConfigHierarchy.md`

Keep shared standards in shared/root config and runtime-specific behaviour in leaf configs.

### 5.1 Policy source-of-truth signposts

To avoid policy drift, keep detailed policy in dedicated docs and use AGENTS files as routing signposts only:

- Frontend logging and error-handling policy: `docs/developer/frontend/frontend-logging-and-error-handling.md`
- Frontend testing policy and commands: `docs/developer/frontend/frontend-testing.md`

If guidance appears in multiple places, update the canonical doc first, then keep AGENTS references brief and consistent.

### 6. Agentic Workflow for Non-Trivial Changes

If `SPEC.md`, any required frontend layout spec, or `ACTION_PLAN.md` are missing or materially stale for the requested work, delegate planning to `Planner` first and use the resulting artefacts as the source of truth for the implementation loop below.

Planning artefacts should pass through `Planner Reviewer` after each document draft so gaps or contradictions are corrected before later planning documents inherit them.

For non-trivial code changes (multi-file logic changes, behavioural changes, refactors, or risky fixes), follow this mandatory loop:

1. Delegate implementation to `Implementation` (`.github/agents/implementation.agent.md`).
2. Submit the resulting diff to `Code Reviewer` (`.github/agents/code-reviewer.agent.md`) for review.
3. If review returns findings, send those findings back to `Implementation` to apply fixes.
4. Re-submit updated changes to `Code Reviewer`.
5. Repeat steps 3-4 until review returns clean (no outstanding issues).
6. Pass the changes to the `Docs` (`.github/agents/docs.agent.md`) agent to update relevant documentation, if applicable.

Rules:

- Do not mark non-trivial work complete before a clean reviewer pass.
- Preserve explicit handoff context each cycle: changed files, review findings, constraints, and acceptance criteria.
- Keep the loop scoped to the requested task; avoid opportunistic refactors unless requested.

### 7. Ambiguity Rule

State 1-2 concise assumptions and proceed with the simplest compliant implementation.

**REMEMBER**: You must always adhere to the prime directives and core principles, even when making assumptions.

### 8. Lint Command Hierarchy

When validating lint output, use the runtime-specific commands defined in the config hierarchy:

- Backend GAS JavaScript: `npm run lint`
- Frontend TypeScript/React: `npm run frontend:lint`
- Builder TypeScript: `npm run builder:lint`
- All lint checks in sequence: `npm run lint && npm run frontend:lint && npm run builder:lint`

Do not run frontend or builder files through the root backend ESLint command directly; use their leaf configs via the commands above.

### 9. Testing Delegation Policy

- Do not define or duplicate module-specific test file naming/location conventions in `AGENTS.md` files.
- Always delegate test implementation/debugging tasks to `Testing Specialist` when your environment supports sub-agent delegation.
- If delegation is unavailable, read `.github/agents/Testing.agent.md` plus the relevant module testing docs before changing tests:
  - `docs/developer/backend/backend-testing.md`
  - `docs/developer/frontend/frontend-testing.md`
  - `docs/developer/builder/builder-script.md`
