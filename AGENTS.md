## AssessmentBot – Core Agent Contract

This file defines cross-component rules only.
For implementation details, always load component-specific instructions first.

### 1. Read-First Routing (Mandatory)

Before editing code, read the instruction file(s) for every component you touch:

- Backend (`src/backend/**`): `docs/developer/AGENT_BACKEND.md`
- Frontend (`src/frontend/**`): `docs/developer/AGENT_FRONTEND.md`
- Builder (`scripts/builder/**`, `build/**` pipeline behaviour): `docs/developer/AGENT_BUILDER.md`

If a task spans multiple components, read and apply all relevant instruction files.
If rules conflict, prefer the stricter rule and preserve runtime compatibility.

### 2. Active vs Deprecated Areas

- Active implementation areas: `src/backend`, `src/frontend`, `scripts/builder`.
- `src/AdminSheet` and `src/AssessmentRecordTemplate` are deprecated reference sources.
- Do not add new features in deprecated areas unless explicitly requested.

### 3. Core Principles (All Components)

1. KISS: implement the simplest working solution.
2. Only fulfil the explicit request; no speculative scope expansion.
3. Use British English in comments, docs, and user-facing text.
4. Reuse existing modules/utilities before creating new abstractions.
5. Do not silently swallow errors.
6. Do not add production code purely to satisfy tests.
7. Keep changes minimal, localised, and consistent with existing patterns.

### 4. Delegation Protocol

- Legacy `src/AdminSheet/UI/**` work: delegate to `UI Specialist` (`.github/agents/UI.agent.md`).
- Test implementation work: delegate to `Testing Specialist` (`.github/agents/Testing.agent.md`).

Sub-agents are stateless. Provide explicit context in prompts:

- relevant source snippets
- concrete requirements
- error/output details
- exact changes already made

### 5. Shared Config Rule

Before changing any TypeScript or ESLint configuration, read:

- `docs/developer/TypeScriptAndLintConfigHierarchy.md`

Keep shared standards in shared/root config and runtime-specific behaviour in leaf configs.

### 6. Ambiguity Rule

State 1-2 concise assumptions and proceed with the simplest compliant implementation.
