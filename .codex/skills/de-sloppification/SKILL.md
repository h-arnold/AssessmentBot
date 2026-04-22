---
name: De-Sloppification
description: Finds and removes AI-slop, duplication, and unnecessary complexity.
---

# De-Sloppification

Use this skill to inspect a codebase, or a clearly scoped subset of it, for concrete slop: code that is technically present but materially unnecessary, over-engineered, duplicated, stale, or suspiciously brittle.

The goal is not generic clean-code feedback. The goal is to find places where the code looks like it was produced by a model that optimised for completion rather than maintainability.

## Mandatory first step

Before reviewing or editing anything:

1. Read the files in scope.
2. Read nearby tests and call sites when they exist.
3. Read enough surrounding code to understand the local pattern before judging it.
4. Read `AGENTS.md`.
5. Read the component-specific `AGENTS.md` for every area you touch.
6. Read in-scope canonical policy docs before judging slop.
   - For frontend scope, include `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` and the related frontend policy docs.
7. Establish the exact package, directory, or feature slice under review.
8. Separate confirmed slop from mere style preference.
9. Inspect package manifests, lockfiles, imports, and current runtime usage before calling something outdated.

Use web research only when freshness matters and the repository context does not already answer the question.

## What counts as slop

Prioritise findings in this order:

1. Dead or stale code
2. Duplicated logic
3. Unnecessary complexity
4. Suspicious defensive code
5. Outdated or mismatched dependencies
6. Generated-code tells
7. Policy deviations

If a candidate does not clearly fit one of these categories, keep investigating before reporting it.

## Workflow

1. Map the area.
2. Search aggressively.
3. Test the necessity.
4. Prefer removal over addition.
5. Verify impact.

When removing slop:

- keep changes minimal and localised
- remove code before creating new code
- preserve existing behaviour unless the explicit goal is to change it
- do not normalise everything into a new abstraction just because it is possible
- do not add defaults, fallback magic, or compatibility scaffolding unless the repository explicitly needs them
- do not silence errors or bury problems behind broader try/catch blocks

## Evidence rules

Do not report a finding unless you can point to concrete evidence:

- file path and line numbers
- the exact smell
- why the code is unnecessary, duplicated, stale, or misleading
- what should happen instead

If the evidence is weak, label it as a hypothesis and keep investigating.

## Validation

If you edit files, validate the touched area before returning work.

Run the relevant lint and test commands for each touched module, using the repository's preferred commands rather than inventing new ones.

If validation is unavailable, state the limitation explicitly and explain what remains unverified.

## Reporting

Return findings in this order:

- Summary: Pass, Needs Improvement, or Fail
- Critical
- Improvement
- Nitpick

For policy-deviation findings, include:

- violated policy doc and rule
- impact
- required correction
- blocker status

## Completion

When the review is complete:

- state whether the codebase is clean of confirmed slop or whether blocking items remain
- list any cleanup work you actually performed
- list the validation commands you ran and their outcomes
- call out any areas you could not verify
- include a `Files read` section with explicit file paths for mandatory docs and canonical policies consulted

Do not mark the review clean while unresolved canonical-policy deviations remain.
