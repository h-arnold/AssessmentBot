# AssessmentBot – Core Agent Contract

This file defines cross-component rules only; component-specific rules live in the component `AGENTS.md` files.

## 1. Project Overview

AssessmentBot is a Google Apps Script tool that marks student submissions to Google Classroom assignments across three criteria — Completeness, Accuracy, and SPaG — for each task. For the project overview, see `README.md`; for the scoring model, see `docs/pedagogy/data-analysis-scoring.md`.

**Stack**

- **Backend:** Google Apps Script (V8, plain JavaScript), deployed as a GAS web app.
- **Frontend:** React + TypeScript (Vite) with Ant Design.
- **Persistence:** application data is stored in Google Drive-backed [JsonDbApp](https://github.com/h-arnold/JsonDbApp) collections ([docs](https://h-arnold.github.io/JsonDbApp/)); its source is vendored under `scripts/builder/vendor/jsondbapp` and inlined into the GAS bundle.
- **LLM marking:** the backend sends assessment requests to a separately deployed [Assessment Bot LLM Service](https://github.com/h-arnold/AssessmentBot-LLM-Service).
- **Build:** Node-based TypeScript pipeline in `scripts/builder`.

**Agent instructions**

- Cross-component rules: `AGENTS.md` (this file).
- Component rules: `src/backend/AGENTS.md`, `src/frontend/AGENTS.md`, `scripts/builder/AGENTS.md`.
- Agent definitions: `.opencode/agents/*.md`. Skills: `.opencode/skills/*/SKILL.md`. Plugins: `.opencode/plugins/*.ts`. Shared OpenCode settings: `opencode.jsonc`.

opencode injects this file automatically, and injects a component file once you interact with a file in that component's directory or below. Read a component file directly only when the injected content does not cover your task.

## 2. Prime Directives

These apply to all components.

### 2.1 Coding Principles

1. KISS: implement the simplest working solution.
2. Fail fast and loudly in development; never hide errors behind catch-and-ignore logic.
3. Only fulfil the explicit request; no speculative scope expansion.
4. Use British English in comments, docs, and user-facing text.
5. Reuse existing modules/utilities before creating new abstractions.
6. Never silently swallow errors.
7. Never set defaults unless explicitly instructed to do so.
8. Do not add production code purely to satisfy tests.
9. Keep changes minimal, localised, and consistent with existing patterns.
10. **Default values must be set in a module's constructor only.** If defaults are found elsewhere, they should be opportunistically moved to the constructor of the module.
11. Use `./` or `../` (including immediate-parent descendants such as `../sibling/x`) for nearby modules; use configured aliases when reaching two or more parent traversals (for example `../../x`). Builder TypeScript and Node test code support component aliases, and backend tests use aliases; production backend GAS code is concatenated and does not use Node module aliases. Opportunistically migrate noncompliant imports in files already touched, preserving import semantics.

### 2.2 Codebase Conduct

1. Never disable lint rules without express permission from the user; if a rule triggers cascading failures, stop and ask before turning it off.
2. **Never push commits that fail pre-commit hooks (lint, type-check, tests).** If the pre-commit hook fails, fix all errors before committing. Do not use `--no-verify` or any other method to bypass hooks.
3. **Worktree awareness.** Other agents may be working concurrently. Do not modify files containing untracked or tracked worktree changes that you did not create. Verify with `git status` before editing.

## 3. Working Environment

### 3.1 Temporary Workspace

All agents **must** use `.opencode/scratchpad/` as the temporary workspace for files that should not be tracked by git. Use this instead of `/tmp` or other system temp directories when writing ephemeral artefacts (e.g. diagnostic dumps, intermediate reports, exploration notes). This directory is already covered by `.gitignore` and will never be committed.

### 3.2 Ambiguity Rule

State 1-2 concise assumptions and proceed with the simplest compliant implementation. The prime directives still apply when you make assumptions.

## 4. Delegation Protocol

Project agents are defined in `.opencode/agents` (source of truth). opencode injects the available agent list at runtime; delegate using those agent IDs.

Sub-agents are stateless. Provide explicit context in prompts:

- relevant source snippets
- concrete requirements
- error/output details
- exact changes already made
- mandatory documentation that must be read for the task, written as `@`-prefixed paths
  (e.g. `@SPEC.md`, `@src/backend/Services/AssessmentService.js`); bare paths in prose are
  not injected. The `.opencode/plugins/at-mention-inject/` plugin runs on every prompt —
  ordinary messages, slash commands, and subagent prompts — and attaches each `@path` token
  that exists inside the session's location root; files over 200 KiB are skipped. The child
  receives `Attached file: <name>` followed by the raw contents, with no line numbers. Always
  follow the token with a space: it ends only at whitespace, a comma, a backtick or a period,
  so any other trailing punctuation (a quote, bracket, semicolon or colon) becomes part of the
  path and the mention is silently skipped.
- Do not attach agent definition files (`.opencode/agents/*.md`) or agent instruction files (`AGENTS.md`).
  Sub-agents already have their own instructions injected.

Sub-agent handoffs must include a `Mandatory Reading` section listing mandatory task-specific files as
`@`-prefixed paths. Do not re-list documentation the sub-agent is already required to read per its own instructions.
Injection of these paths is what makes the documentation available, so no further read-evidence gate is required.

Prompt sub-agents in unambiguous, imperative language. State the required deliverable and the constraints explicitly: name what the sub-agent must produce, and set out the scope limits, forbidden actions, and conventions to follow. Sub-agents cannot infer unstated intent, so do not rely on implication.

## 5. Implementation and Review Loop

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

## 6. Commands and Configuration

### 6.1 Lint Command Hierarchy

Lint runs from the repository root. The plain variants pass `--fix` and rewrite files; use the `:check` variants to verify without modifying anything.

| Scope                                           | Fix in place             | Verify only                    |
| ----------------------------------------------- | ------------------------ | ------------------------------ |
| Backend GAS JavaScript (`src/backend`, `tests`) | `npm run lint:backend`   | `npm run lint:backend:check`   |
| Frontend TypeScript/React                       | `npm run lint:frontend`  | `npm run lint:frontend:check`  |
| Builder TypeScript and OpenCode plugins         | `npm run lint:builder`   | `npm run lint:builder:check`   |
| Synthetic test data                             | `npm run lint:synthetic` | `npm run lint:synthetic:check` |
| All scopes                                      | `npm run lint`           | `npm run lint:check`           |

Do not run frontend or builder files through the root backend ESLint command directly; use their leaf configs via the commands above.

The complete command set is defined in `package.json`; run the full local gate with `npm run run-all-checks` (lint, coverage, type checks, and production build).

`npm run typecheck:all` type-checks every TypeScript project (builder source and Vitest tooling, frontend app/Node/E2E, OpenCode plugins, and the synthetic test TypeScript). It is the type gate for CI, the regression checker, `run-all-checks`, and the pre-commit hook. See `docs/developer/builder/TypeScriptAndLintConfigHierarchy.md`.

### 6.2 Shared Config Rule

Before changing any TypeScript or ESLint configuration, read:

- `docs/developer/builder/TypeScriptAndLintConfigHierarchy.md`

Keep shared standards in shared/root config and runtime-specific behaviour in leaf configs.

## 7. Documentation and Policy Ownership

### 7.1 Policy Source-of-Truth Signposts

To avoid policy drift, keep detailed policy in dedicated docs and use AGENTS files as routing signposts only:

- Security approach, threat model, and data-handling rules: `docs/developer/security/README.md`
- Backend logging and error-handling policy: `docs/developer/backend/backend-logging-and-error-handling.md`
- Frontend logging and error-handling policy: `docs/developer/frontend/frontend-logging-and-error-handling.md`
- Frontend testing policy and commands: `docs/developer/frontend/frontend-testing.md`

Module-specific test file naming and location conventions belong in the module testing docs; do not duplicate them in `AGENTS.md` files.

If guidance appears in multiple places, update the canonical doc first, then keep AGENTS references brief and consistent.

### 7.2 Same-Change Documentation Obligation

Any change that alters documented behaviour must carry its canonical documentation update in the same change. Delegate documentation updates to the `Docs` agent (`.opencode/agents/docs.md`) and canonical data-shape specification updates to the `Data Shapes Agent` (`.opencode/agents/data-shapes-agent.md`).
