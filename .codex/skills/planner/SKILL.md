---
name: Planner
description: Clarifies requirements and produces `SPEC.md`, optional frontend layout specs, and `ACTION_PLAN.md` before implementation starts.
---

# Planner

Use this skill to turn an initial request into the minimum planning artefacts needed for safe implementation.

Do not implement production code.

## Mandatory first step

Before asking questions or drafting anything, read:

- `AGENTS.md`
- the relevant component `AGENTS.md` files for any touched area:
  - `src/backend/AGENTS.md`
  - `src/frontend/AGENTS.md`
  - `scripts/builder/AGENTS.md`
- `docs/developer/SPEC_TEMPLATE.md`
- `docs/developer/LAYOUT_SPEC_TEMPLATE.md`
- `docs/developer/ACTION_PLAN_TEMPLATE.md`
- any existing root `SPEC.md`, `ACTION_PLAN.md`, and similar layout docs
- enough nearby code to ground the request in the actual architecture

## Workflow

1. Start with a short working summary of the problem, likely scope, affected components, and current assumptions.
2. Ask only the smallest set of high-value questions needed next.
3. Restate confirmed decisions, remaining open questions, and assumptions after each reply.
4. Continue until the unanswered details would no longer materially change the structure of the spec.
5. If a detail remains ambiguous, state one or two concise assumptions and proceed with the simplest compliant interpretation.

## Spec

Write or update `SPEC.md` first.

Use the template, keep behaviour and scope boundaries separate from implementation sequencing, and record explicit non-goals and open questions.

Submit the draft to `Planner Reviewer` with neutral context only:

- the user request or objective
- the document path
- companion planning-doc paths, if any
- relevant code areas or entrypoints

Address valid findings and repeat until the spec is clean enough to build on.

If the reviewer finds gaps that require user clarification, stop and ask the minimum questions needed before revising the spec.

## Layout spec

Write a separate layout spec only when the request materially affects frontend structure or workflow.

If one is required:

1. Read `docs/developer/LAYOUT_SPEC_TEMPLATE.md`.
2. Inspect the existing frontend surface and similar root layout docs.
3. Consult the official Ant Design docs only for candidate components.
4. Turn that into focused follow-up questions about real trade-offs.
5. Write the layout spec as a separate root document with a descriptive name.
6. Submit it to `Planner Reviewer` with neutral context only.

Skip the layout spec for backend-only, API-only, or non-visual refactor work, and say why it was skipped.

## Action plan

After the spec and any required layout spec are complete, write `ACTION_PLAN.md` as a TDD-first delivery plan.

Split the work into small independently testable sections. Each section must include:

- objective
- constraints
- acceptance criteria
- required red-first test cases
- section checks

Follow TDD ordering inside each section: Red, Green, Refactor.

Submit the action plan to `Planner Reviewer` with neutral context only, then address findings until it is clean enough for implementation orchestration.

## Handoff

Return the finished planning artefacts with:

- files created or updated
- what was decided
- assumptions made
- whether a layout spec was required and why
- remaining open questions or deliberate deferrals
- readiness for implementation orchestration
