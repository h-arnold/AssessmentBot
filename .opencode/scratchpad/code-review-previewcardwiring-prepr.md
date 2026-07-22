# Pre-PR Code Review — `feat/PreviewCardWiring` vs `main`

**Focus:** Frontend layout / design principles / accessibility
(8px grid spacing, width-token ownership, loading/busy accessibility semantics,
keyboard activation, motion conventions)

**Reviewer:** Code Reviewer (hy3)
**Date:** 2026-07-22
**Constraint:** Lint/type-check/tests NOT run. Review is diff-focused with incidental context.

---

## Summary

**Verdict: Needs Improvement.** The wiring is functionally sound and keyboard activation is
correctly handled, but two width/accessibility-standards deviations in the new popover
skeleton (`role="status"` with no label; raw `400` width literal duplicated from
`CARD_MAX_WIDTH`) and one misleading comment should be addressed before merge. No Critical
blockers found in the layout/a11y focus areas.

Files read (mandatory + docs):

- `src/frontend/src/features/classPage/TaskHeatmapTable.tsx`
- `src/frontend/src/features/classPage/TaskPreviewCard.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx`
- `src/frontend/src/components/ImageRenderer/ImageRenderer.tsx`
- `src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts`
- `src/frontend/e2e-tests/task-preview-card.spec.ts`
- Docs: `frontend-spacing-and-padding-standards.md`, `frontend-loading-and-width-standards.md`,
  `frontend-shell-navigation-and-motion.md`, `frontend-modal-patterns.md`
- `.opencode/agents/code-reviewer.md`, `src/frontend/AGENTS.md`

(Note: `assembleTaskPreviewData.ts` / `buildCellPreviewLookup.ts` are new data-transform
modules referenced by the diff; they are out of scope for this layout/a11y review and were
not layout-audited.)

---

## DIFF FINDINGS

### Improvement — Loading-state accessibility: `role="status"` region has no label

- **File:line:** `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:195-199`
- **Evidence:** The new `TaskPreviewSkeleton` renders
  `<div role="status" aria-busy="true" style={{ width: 400 }}>` with **only** skeleton
  primitives inside it — no text content and no `aria-label`.
- **Standard:** `frontend-loading-and-width-standards.md` §8 — "Initial blocking load must
  expose accessible loading semantics, such as a labelled `role="status"` region while the
  skeleton is present." A `role="status"` live region announces changes to its _content_; an
  empty region yields no screen-reader announcement. "Visual affordances alone are not
  sufficient."
- **Fix:** Add an accessible name or visible/invisible text, e.g.
  `<div role="status" aria-busy="true" aria-label="Loading task preview" style={{ width: 400 }}>`
  (or include a visually-hidden "Loading…" `Typography.Text`). Keep `aria-busy` on the
  region.

### Improvement — Width-token ownership: raw `400` literal duplicated from `CARD_MAX_WIDTH`

- **File:line:** `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:198`
  (and the cross-reference comment at `:185-189`)
- **Evidence:** `style={{ width: 400 }}` hard-codes the popover width. The same value is
  owned privately as `const CARD_MAX_WIDTH = 400;` in
  `src/frontend/src/features/classPage/TaskPreviewCard.tsx:66`. The skeleton comment at
  `:185-189` explicitly states these constants "must NOT be refactored out of
  TaskPreviewCard.tsx" while simultaneously duplicating the `400` literal locally.
- **Standard:** `frontend-loading-and-width-standards.md` §7 — "Do not duplicate raw width
  literals across feature code or CSS." Width tokens are the authoritative source of truth;
  the embedded "must NOT be refactored out" instruction in a comment directly conflicts with
  this ownership rule and with the KISS/DRY guidance in `AGENTS.md`.
- **Fix:** Export `CARD_MAX_WIDTH` from `TaskPreviewCard.tsx` (or introduce a shared
  width token) and import it here instead of re-typing `400`. Remove the contradictory
  "must NOT be refactored out" comment.

### Nitpick — Misleading comment cross-references an unused constant

- **File:line:** `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:185-189`
- **Evidence:** The `TaskPreviewSkeleton` doc-comment states it cross-references
  `CARD_BODY_MAX_HEIGHT = 480`, but the function never uses `480` anywhere — it uses
  `height: 120` for the image placeholder (`:217`). The stated dependency is inaccurate.
- **Fix:** Drop the `CARD_BODY_MAX_HEIGHT = 480` reference from the comment (or, if a
  max-height shape match is intended, actually constrain the skeleton to `480`).

### Nitpick — British-English identifier "artifact" in new E2E helper

- **File:line:** `src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts:327,344`
  (and `HEATMAP_ARTIFACT_CONTENT` at `:321`, `buildArtifact`/`artifactTypeFor` at `:330-346`)
- **Evidence:** New identifiers use American spelling `artifact*` (e.g.
  `HEATMAP_ARTIFACT_CONTENT`, `artifactTypeFor`, `buildArtifact`). `AGENTS.md` §3 / British
  English rule require British English in identifiers.
- **Note:** This is _consistent_ with the pre-existing `TaskPreviewCard.tsx` convention
  (`artifactType`, `artifactContent`, `renderArtifact`), so it is not a new regression; a
  project-wide rename is out of scope. Flagged opportunistically for awareness.
- **Fix (optional):** If a rename is desired, align on `artefact*` project-wide; otherwise
  accept the established convention.

---

## INCIDENTAL FINDINGS (not in diff, same focus area / file)

### Improvement — Popover trigger `<span>` lacks an accessible name/haspopup state

- **File:line:** `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:300-312`
  (pre-existing; not added by this diff)
- **Evidence:** The trigger is
  `<span tabIndex={0} role="button" style={{ padding: APP_GAP_XS, display: 'inline-block' }}>`
  with `onKeyDown` for Enter/Space → `click()`. Keyboard activation is correct (positive),
  but the span has **no `aria-label`**, so its accessible name is just the score digit
  (e.g. "4, button"). The descriptive label exists only on the parent `<td>` via `onCell`
  (`:271` → `aria-label`: `${studentName}, ${taskId}, ${label}: ${score}`). There is also
  no `aria-haspopup` / `aria-expanded` to signal the popover relationship.
- **Standard:** `frontend-loading-and-width-standards.md` §8 (accessible names) and general
  a11y best practice for popover triggers.
- **Fix:** Add `aria-label` to the span mirroring the cell label plus an intent hint (e.g.
  `${studentName}, ${taskId}, ${label}: ${score} — view task details`), and consider
  `aria-haspopup="dialog"`. This is squarely within the keyboard/accessibility focus, so
  worth raising even though it predates the branch.

---

## Positive confirmations (focus areas, no action needed)

- **8px grid:** All spacing uses `APP_GAP_MD` (16), `APP_GAP_SM` (8),
  `APP_GAP_XS` (4 — documented half-unit exception at `:297-299` and `frontend-spacing…` §1.2).
  No non-grid padding/margin/gap introduced. `width:400` / `maxHeight:480` are width/height
  constraints explicitly exempted from the 8px grid (`TaskPreviewCard.tsx:52-66`).
- **Keyboard activation:** Enter/Space → `click()` on the popover trigger is correctly wired
  (`:304-309`).
- **Motion:** No custom motion introduced; Ant Design Popover default animation untouched.
  Shell motion token/CSS conventions (`frontend-shell-navigation-and-motion.md`) unaffected.
- **Broken `@see` cleanup:** Removed references to `TASK_PREVIEW_CARD_LAYOUT.md`, which no
  longer exists in the repo — correct housekeeping.
- **E2E assertions:** `task-preview-card.spec.ts` updated to target real-data cells
  (`task_002/Accuracy:4`, `task_003/SPaG:5`) and assert rendered markdown/`<table>`/`<img>`
  content, matching the descriptive `aria-label` format produced by `onCell`.

---

## Reminder to calling agent

> Remember, you must address **all** in-scope review items and then resubmit to the reviewer
> until the review comes back clean.
