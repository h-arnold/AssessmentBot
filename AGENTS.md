## AssessmentBot – Core Agent Contract

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

- Available project agents (source of truth: `.github/agents`):
  - `Testing Specialist` (`.github/agents/Testing.agent.md`) for test implementation and test debugging.
  - `Code Reviewer` (`.github/agents/code-reviewer.agent.md`) for code review and standards checks.
  - `Implementation` (`.github/agents/implementation.agent.md`) for focused implementation tasks.

Sub-agents are stateless. Provide explicit context in prompts:

- relevant source snippets
- concrete requirements
- error/output details
- exact changes already made

#### 4.1 Invocation Directives

Copilot environment:

- Use `runSubagent` and pass full context in the `prompt` body.
- Include: files read, constraints, exact requested outcome, and expected deliverables.
- Example pattern:
  - `runSubagent(agent: "Testing Specialist", prompt: "<context + requirements + changed files>")`

Codex environment:

- Use `codex-delegate` from repository root.
- Example pattern:
  - `codex-delegate --role implementation --task "<task>" --instructions "<constraints and acceptance criteria>" --working-dir . --timeout-minutes 10`
- For testing/review tasks, use the corresponding role template when present (for example `testing` or `code-reviewer`).
- If a required role is not available in `.codex/<role>.md`, use `implementation` with explicit instructions.

### 5. Shared Config Rule

Before changing any TypeScript or ESLint configuration, read:

- `docs/developer/builder/TypeScriptAndLintConfigHierarchy.md`

Keep shared standards in shared/root config and runtime-specific behaviour in leaf configs.

### 6. Agentic Workflow for Non-Trivial Changes

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
