# Code Review — Section 8 Documentation Diff (feat/preview-card-real-data-wiring)

**Reviewer:** Code Reviewer (frontend)
**Scope:** Documentation-only cleanup — shared-helpers registry status update + removal of dangling `TASK_PREVIEW_CARD_LAYOUT.md` references from 7 files.
**Verdict:** CLEAN (one out-of-scope observation recorded for transparency).

---

## Files read

Mandatory:

- `/home/developer/AssessmentBot/ACTION_PLAN.md` — Section 8 "Documentation and rollout notes" (lines 1332–1409) + global constraints (§9.18.16 status gate) + revision history context.
- `/home/developer/AssessmentBot/SPEC.md` — "Documentation and rollout notes" (lines 523–545).
- `/home/developer/AssessmentBot/src/frontend/AGENTS.md` — full.

In-scope changed files (verified via `git diff` + targeted reads):

1. `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` — §9.18.16 region (lines 804–830) and §9.18.13 region around line 746.
2. `src/frontend/src/features/classPage/TaskHeatmapPage.tsx` — diff only.
3. `src/frontend/src/features/classPage/TaskHeatmapTable.tsx` — diff only.
4. `src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx` — diff only.
5. `src/frontend/src/features/classPage/TaskPreviewCard.tsx` — diff only.
6. `src/frontend/src/features/classPage/ClassPageHeatmapView.spec.tsx` — diff only.
7. `src/frontend/src/components/ImageRenderer/ImageRenderer.tsx` — diff only.
8. `src/frontend/e2e-tests/task-preview-card.spec.ts` — diff only.

Verification commands:

- `git diff` (all in-scope files) — confirmed exact line-level changes.
- Repo-wide `grep TASK_PREVIEW_CARD_LAYOUT` — enumerated every occurrence.
- `grep TASK_PREVIEW_CARD_LAYOUT` scoped to `src/frontend/` — **no files found**.
- `ls TASK_PREVIEW_CARD_LAYOUT.md` — **file does not exist** (confirms the references are genuinely dangling; the prior scratchpad review `review_PR_I9.md` incorrectly asserted the doc exists).
- `npm run lint:frontend` — 0 errors (1 pre-existing unrelated warning in `apiService.spec.ts`, not in scope).

---

## Review against mandated focus items

**1. Scoping discipline (7 source files).** Each of files #2–#8 removes ONLY the specified dangling reference; no logic, no unrelated comment, no formatting changes:

- `TaskHeatmapPage.tsx`: removed exactly the `@see TASK_PREVIEW_CARD_LAYOUT.md — §"Surface hierarchy", §"Outer layout"` line; `ACTION_PLAN.md §5` and `SPEC.md` `@see` lines intact.
- `TaskHeatmapTable.tsx`: removed exactly the `TASK_PREVIEW_CARD_LAYOUT.md` `@see` line; other `@see` lines intact.
- `TaskHeatmapTable.spec.tsx`: removed exactly the `TASK_PREVIEW_CARD_LAYOUT.md` `@see` line; other `@see` lines intact.
- `ClassPageHeatmapView.spec.tsx`: removed exactly the `TASK_PREVIEW_CARD_LAYOUT.md` `@see` line; other `@see` lines intact.
- `ImageRenderer.tsx`: removed only `(see \`TASK_PREVIEW_CARD_LAYOUT.md\` §5 — Student Response section)`, leaving `@remarks` body intact (`The maxHeight: 400 constraint matches the layout specification which prevents the image from making the popover card overflow the viewport.`).
- `task-preview-card.spec.ts`: removed only the `@see TASK_PREVIEW_CARD_LAYOUT.md — popover region hierarchy` line; the `@see ACTION_PLAN.md §8`, `@see SPEC.md`, and `@see docs/developer/frontend/frontend-playwright-e2e.md` lines are PRESERVED.

**2. TaskPreviewCard.tsx (#5).** Only the `(see \`TASK_PREVIEW_CARD_LAYOUT.md\` §2)` parentheticals removed from the two JSDoc blocks (CARD_BODY_MAX_HEIGHT and CARD_MAX_WIDTH). Surrounding dimensions text ("Exempt from the 8px grid as it is a max-height/max-width constraint, not a spacing value.") preserved intact. ✓

**3. ImageRenderer.tsx (#7).** Only the `(see …)` line removed; surrounding `@remarks` intact. ✓

**4. Registry (#1).** Exactly the three §9.18.16 helper entries read `Implemented` with `Implementation notes`:

- Item 24 `buildCellPreviewLookup` → `Implemented`
- Item 25 `assembleTaskPreviewData` → `Implemented`
- Item 26 `spreadsheetToMarkdownTable` → `Implemented`
  All other §9.18.16 entries and all other sections of the doc are untouched by the diff. ✓

**5. No new references introduced.** The diff only DELETES references; no new `TASK_PREVIEW_CARD_LAYOUT` (or other dangling) references are added. The `src/frontend/` subtree is confirmed clean of the literal (acceptance criterion 3 satisfied). ✓

**Additional gating checks.** Lint green on the changed files; no scope creep; no `console.*`; British English unaffected (comment removals only).

---

## OUT-OF-SCOPE OBSERVATION (not a blocking issue)

`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md:746` contains a pre-existing dangling reference:
`…auto-navigating back to the overview with NO in-view Alert/error UI (per SPEC.md/TASK_PREVIEW_CARD_LAYOUT.md).`

This is:

- Pre-existing — NOT part of this change's diff (the registry doc diff touched only §9.18.16 at lines ~810–830).
- Located in `docs/developer/frontend/`, which is explicitly OUTSIDE the `src/frontend/` search scope defined by ACTION_PLAN Section 8 acceptance criterion 3 / required check 2 (those check `src/frontend/` only, including `e2e-tests/`).
- Therefore intentionally excluded from the Section 8 cleanup scope and not an in-scope finding.

It is recorded here for transparency only. If the team later wants full repo-wide consistency (including `docs/`), this single line would be the remaining item to address — but doing so is outside the agreed scope of this change and should not be mixed into this documentation pass.

---

## Conclusion

**CLEAN.** All eight in-scope files match the documented per-file scoping rules exactly: the three §9.18.16 entries are `Implemented`, the seven dangling `TASK_PREVIEW_CARD_LAYOUT.md` references are removed (with `@see`/`(see …)` preserved where required, and surrounding prose untouched), no new dangling references were introduced, and `src/frontend/` is verified free of the literal. Lint passes. PNG snapshot files were excluded per the out-of-scope exclusion.

> Remember, you must address **all** in-scope review items and then resubmit to the reviewer until the review comes back clean.
