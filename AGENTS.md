# AssessmentBot – Core Agent Contract

This file defines cross-component rules only.
For implementation details, always load component-specific instructions first.

### 1. Read-First Routing (Mandatory)

Before editing code, **YOU MUST** read the instruction file(s) for every component you touch:

- Backend (`src/backend/**`): `src/backend/AGENTS.md`
- Frontend (`src/frontend/**`): `src/frontend/AGENTS.md`
- Builder (`scripts/builder/**`, `build/**` pipeline behaviour): `scripts/builder/AGENTS.md`

If a task spans multiple components, read and apply all relevant instruction files.
If rules conflict, prefer the stricter rule and preserve runtime compatibility.

Failing to read these files **will** result in you failing your task.

### 2. Active vs Deprecated Areas

- Active implementation areas: `src/backend`, `src/frontend`, `scripts/builder`.

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
11. **Never push commits that fail pre-commit hooks (lint, type-check, tests).** If the pre-commit hook fails, fix all errors before committing. Do not use `--no-verify` or any other method to bypass hooks.
12. **Default values must be set in a module's constructor only.** If defaults are found elsewhere, they should be opportunistically moved to the constructor of the module.

### 4. Delegation Protocol

- Available project agents (source of truth: `.opencode/agents`):
  - `Planner` (`.opencode/agents/planner.md`) for clarification-driven planning that produces `SPEC.md`, optional frontend layout specs, and `ACTION_PLAN.md`.
  - `Planner Reviewer` (`.opencode/agents/planner-reviewer.md`) for impartial second-pass review of planning artefacts against the codebase before later documents or implementation depend on them.
  - `Testing Specialist` (`.opencode/agents/testing-specialist.md`) for Vitest unit/component test and backend test implementation and debugging.
  - `Playwright` (`.opencode/agents/playwright.md`) for Playwright E2E test implementation and debugging.
  - `Code Reviewer` (`.opencode/agents/code-reviewer.md`) for code review and standards checks.
  - `Implementation` (`.opencode/agents/implementation.md`) for focused implementation tasks.
  - `Docs` (`.opencode/agents/docs.md`) for developer-documentation and JSDoc updates.
  - `Data Shapes Agent` (`.opencode/agents/data-shapes-agent.md`) for creating and maintaining canonical data-shape specifications across persistence, transport, and validation boundaries.
  - `De-Sloppification` (`.opencode/agents/de-sloppification.md`) for slop review.

Sub-agents are stateless. Provide explicit context in prompts:

- relevant source snippets
- concrete requirements
- error/output details
- exact changes already made
- mandatory documentation that must be read for the task, written as `@`-prefixed
  worktree-relative paths (e.g. `@AGENTS.md`, `@src/backend/Services/AssessmentService.js`)
  so opencode injects the line-numbered file contents into the sub-agent's context.
  Bare paths in prose are not injected; only `@path` tokens are, and they must not be
  immediately preceded by a word character or backtick.

Sub-agent handoffs must include a `Mandatory Reading` section listing mandatory files as
`@`-prefixed paths.
If mandatory documentation is missing from `Files read`, return the work to the same sub-agent and do not proceed.

### 5. Shared Config Rule

Before changing any TypeScript or ESLint configuration, read:

- `docs/developer/builder/TypeScriptAndLintConfigHierarchy.md`

Keep shared standards in shared/root config and runtime-specific behaviour in leaf configs.

### 5.1 Policy source-of-truth signposts

To avoid policy drift, keep detailed policy in dedicated docs and use AGENTS files as routing signposts only:

- Backend logging and error-handling policy: `docs/developer/backend/backend-logging-and-error-handling.md`
- Frontend logging and error-handling policy: `docs/developer/frontend/frontend-logging-and-error-handling.md`
- Frontend testing policy and commands: `docs/developer/frontend/frontend-testing.md`

If guidance appears in multiple places, update the canonical doc first, then keep AGENTS references brief and consistent.

### 6. Agentic Workflow for Non-Trivial Changes

If `SPEC.md`, any required frontend layout spec, or `ACTION_PLAN.md` are missing or materially stale for the requested work, delegate planning to `Planner` first and use the resulting artefacts as the source of truth for the implementation loop below.

Planning artefacts should pass through `Planner Reviewer` after each document draft so gaps or contradictions are corrected before later planning documents inherit them.

For non-trivial code changes (multi-file logic changes, behavioural changes, refactors, or risky fixes), follow this mandatory loop:

1. Delegate implementation to `Implementation` (`.opencode/agents/implementation.md`).
2. Submit the resulting diff to `Code Reviewer` (`.opencode/agents/code-reviewer.md`) for review.
3. If review returns findings, send those findings back to `Implementation` to apply fixes.
4. Re-submit updated changes to `Code Reviewer`.
5. Repeat steps 3-4 until review returns clean (no outstanding issues).
6. Pass the changes to the `Docs` (`.opencode/agents/docs.md`) agent to update relevant documentation, if applicable.
7. If the change affects data persistence, transport, or validation boundaries, pass the changes to `Data Shapes Agent` (`.opencode/agents/data-shapes-agent.md`) to update canonical data-shape specifications. Data-shape docs must be updated before code-review sign-off when shapes are contractually affected.

**E2E test routing:** When a change requires Playwright E2E tests, delegate E2E test work to `Playwright` (`.opencode/agents/playwright.md`), not `Testing Specialist`. The Testing Specialist handles Vitest unit/component and backend tests only.

Rules:

- Do not mark non-trivial work complete before a clean reviewer pass.
- Preserve explicit handoff context each cycle: changed files, review findings, constraints, and acceptance criteria.
- Keep the loop scoped to the requested task; avoid opportunistic refactors unless requested.
- When using `ACTION_PLAN.md`, include phase-level mandatory documentation paths for
  delegated agents as `@`-prefixed worktree-relative paths (e.g. `@ACTION_PLAN.md`,
  `@SPEC.md`) so opencode injects their contents, and enforce a `Files read` evidence gate
  in every delegated handoff.
- If any delegated handoff omits mandatory documentation from `Files read`, return the work to the same sub-agent and block progression until corrected.

### 7. Ambiguity Rule

State 1-2 concise assumptions and proceed with the simplest compliant implementation.

**REMEMBER**: You must always adhere to the prime directives and core principles, even when making assumptions.

### 8. Lint Command Hierarchy

When validating lint output, use the runtime-specific commands defined in the config hierarchy:

- Backend GAS JavaScript: `npm run lint:backend`
- Frontend TypeScript/React: `npm run lint:frontend`
- Builder TypeScript: `npm run lint:builder`
- All lint checks in sequence: `npm run lint:backend && npm run lint:frontend && npm run lint:builder`

Do not run frontend or builder files through the root backend ESLint command directly; use their leaf configs via the commands above.

### 9. Temporary Workspace Convention

All agents **must** use `.opencode/scratchpad/` as the temporary workspace for files that should not be tracked by git. Use this instead of `/tmp` or other system temp directories when writing ephemeral artefacts (e.g. diagnostic dumps, intermediate reports, exploration notes). This directory is already covered by `.gitignore` and will never be committed.

Do not write planning artefacts (`SPEC.md`, `ACTION_PLAN.md`, layout specs, etc.) to scratchpad — those belong in the project root where the orchestrator can retrieve them.

### 10. Testing Delegation Policy

- Do not define or duplicate module-specific test file naming/location conventions in `AGENTS.md` files.
- For Vitest unit/component tests and backend tests, always delegate test implementation/debugging tasks to `Testing Specialist` when your environment supports sub-agent delegation.
- For Playwright E2E tests, always delegate to `Playwright` when your environment supports sub-agent delegation.
- If delegation is unavailable, read `.opencode/agents/testing-specialist.md` (for Vitest/backend) or `.opencode/agents/playwright.md` (for E2E) plus the relevant module testing docs before changing tests:
  - `docs/developer/backend/backend-testing.md`
  - `docs/developer/frontend/frontend-testing.md`
  - `docs/developer/frontend/frontend-playwright-e2e.md`
  - `docs/developer/builder/builder-script.md`
