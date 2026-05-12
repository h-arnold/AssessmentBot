---
name: regression-checker
description: Runs tests, linters, and CI routines to establish baselines and detect regressions between agent runs.
license: MIT
compatibility: Mistral Vibe CLI
user-invocable: true
allowed-tools:
  - bash
  - read_file
  - write_file
---

# Regression Checker Skill

## Purpose

**Calling agents MUST use `regression-checker` instead of running full test/lint suites directly.**

This subagent establishes baselines and detects regressions across backend, frontend, and builder modules. It handles the complete validation pipeline so calling agents can focus on their specific tasks.

## When to Call

- **Before implementation**: Establish baseline
- **After changes**: Detect regressions
- **Code review**: Verify stability
- **Refactoring**: Ensure safety

## Invocation

```bash
task agent=regression-checker task="Session: <session-name>. <action>"
```

**Session name is MANDATORY.** Without it, the subagent returns an immediate error.

### Actions

| Action                  | Purpose                                     |
| ----------------------- | ------------------------------------------- |
| `Establish baseline`    | First run — creates baseline.json           |
| `Check for regressions` | Subsequent runs — compares against baseline |
| Any other text          | Treated as "check for regressions"          |

## Session Naming

Use descriptive, unique names:

- `feat/<feature-name>` — Feature implementation
- `fix/<issue-id>` — Bug fix verification
- `refactor/<module>` — Refactoring safety
- `pr-<number>` — Pull request validation

## What It Runs

All 8 commands in order:

1. `npm run lint` — Backend ESLint
2. `npm test` — Backend Vitest
3. `npm run frontend:lint` — Frontend ESLint
4. `npm run frontend:test` — Frontend Vitest
5. `npm run builder:lint` — Builder ESLint
6. `npm run builder:test` — Builder Vitest
7. `npm run builder:compile` — Builder TypeScript
8. `npm run build` — Full CI build

## Key Rule for Calling Agents

**Do NOT run `npm test`, `npm run lint`, `npm run frontend:test`, etc. directly.**

Instead, delegate to regression-checker:

```bash
# WRONG - calling agent runs tests directly
task agent=implementation task="... run npm test ..."

# RIGHT - delegate to regression-checker
task agent=regression-checker task="Session: feat/xyz. Check for regressions."
```

## Output

- **Baseline (first run)**: Saved to scratchpad, returns summary
- **Comparison (subsequent runs)**: Identifies regressions, new failures, fixes
- **Always**: Human-readable report + JSON file

## Reports Location

Saved to the agent's scratchpad under `regression-checker/<session-name>/`

- `baseline.json` — First run
- `report-<timestamp>.json` — Comparison runs

The agent returns the full path of the saved file.

## Targeted Testing Exception

Calling agents **MAY** run targeted, module-specific tests during development:

- `npm test -- tests/controllers/AssignmentController.test.js`
- `npm run frontend:test -- AssessmentForm.spec.tsx`
- `npm run builder:test -- stages/validate.test.ts`

Use targeted runs for iterative development. Use regression-checker for full validation before handoff or merge.
