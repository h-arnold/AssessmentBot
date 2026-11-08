---
description: Batch the decided findings in a pre-PR review doc and fix them through implement/review loops
---

Work through the recorded decisions in $ARGUMENTS (defaults to `PR_REVIEW.md` at the repository root when empty) and fix every finding the document marks for action.

## 1. Scope and batching

1. Read the review document. Collect every finding whose recorded decision is **Fix now**, **Amend doc**, or **Rename now**. Hold **Raise issue** decisions for the wrap-up; take no action on **Drop**, **Accept as-is**, duplicates, and note-only findings.
2. Group the actionable findings into batches that keep each diff reviewable:
   - one layer per batch (backend production, backend tests, frontend src, frontend specs, E2E, docs/data shapes);
   - findings that touch the same lines, the same helper, or the same contract go in one batch;
   - order batches so later batches build on earlier ones, and put test-only batches after the production batches they pin.
3. Write the batch plan (batches, findings, files, status) into a "Fix batches" progress section in the review document before implementing, and keep that section updated after every batch.

## 2. Per-batch loop

For each batch, in order:

1. Delegate implementation to the right specialist sub-agent: `implementation` for production code, `testing-specialist` for unit/component/backend tests, `playwright` for E2E work, `data-shapes-agent` for canonical data-shape specs, `docs` for other documentation. The implementing agent owns production/docs changes ONLY; when a change alters behaviour, a fresh `testing-specialist` session owns ALL test updates — both rewriting existing pins and adding new ones — briefed with the DESIRED implementation behaviour (not the diff) so the tests reflect what the code should do. Give the sub-agent the verbatim finding text and recorded decisions, the exact files to change, the constraints, and a Mandatory Reading section listing task-specific files as `@`-prefixed paths followed by a space. Never attach agent definitions or AGENTS.md files — those are injected automatically.
2. Submit the resulting diff to `code-reviewer` for review.
3. Send every review finding back to the implementing sub-agent as a fresh, fully contextualised fix instruction, then re-submit to `code-reviewer`. Repeat until the review returns clean. Start a fresh sub-agent session for each fix cycle; resume a session only when it returned an error or an empty response.
4. If the batch changed persistence, transport, or validation boundaries, have `data-shapes-agent` reconcile the canonical data-shape specs before sign-off. A behaviour change documented outside the data-shape specs carries its documentation update in the same batch.
5. Run the scoped checks for the touched layers (the `:check` lint variants, type checks, and scoped tests) and fix any failure inside the loop.
6. Update the review document's progress section: batch status, findings resolved, checks run, commit hash.
7. Commit the batch as one commit whose message names the findings it resolves. The commit must pass the pre-commit hooks; never bypass them.

## 3. Wrap-up

- Raise one GitHub issue per **Raise issue** decision with `gh issue create`, referencing the review document and the affected files.
- Run the full local gate (`npm run run-all-checks`) and confirm it passes.
- Report the final status per batch, the issues raised, and anything consciously deferred.
