# Code Review — PR I9 (Frontend UI-polish)

**Reviewer:** Code Reviewer agent
**Modules in scope:** Frontend (`src/frontend/`) only
**Date:** 2026-07-17
**Verdict:** ✅ PASS (with one non-blocking Improvement note + one optional Nitpick)

All in-scope focus items (I9.1–I9.4) are satisfied. Automated checks are green.
The only substantive note is that the PR's stated _rationale_ for I9.4 is factually
incorrect (the referenced doc exists), but the resulting code is valid, so it is
non-blocking.

---

## Mandatory reading performed

- `src/frontend/AGENTS.md` (full)
- `docs/developer/frontend/frontend-loading-and-width-standards.md` (full, §7 width tokens)
- Changed files: `MarkdownRenderer.module.css`, `TaskHeatmapTable.tsx`, `TaskPreviewCard.tsx`, `TaskPreviewCard.spec.tsx`
- AntD v6 theme source (`useTheme.js`, `AppThemeShell.tsx`) to verify cssVar behaviour
- Runtime probe (throwaway spec, since deleted) confirming `--ant-color-border` is injected by the real app theme wrapper

## Automated checks run

| Check                 | Command                                                         | Result                                              |
| --------------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| Lint (changed TS/TSX) | `eslint` on the 4 files                                         | 0 errors (CSS module skipped by eslint — expected)  |
| Type-check            | `tsc -b tsconfig.json`                                          | 0 errors                                            |
| Unit tests            | `vitest run TaskPreviewCard.spec.tsx TaskHeatmapTable.spec.tsx` | 22 passed (TaskPreviewCard 11, TaskHeatmapTable 11) |

---

## Focus item results

### I9.1 — Border colour token `var(--ant-color-border)` ✅ PASS

- `MarkdownRenderer.module.css` line 8 is now `border: 1px solid var(--ant-color-border)`; `padding: 8px` is unchanged (on the 8px grid). No raw hex remains (diff confirms `#d9d9d9` → gone).
- **cssVar is active in the running app.** `AppThemeShell.tsx` is the real theme wrapper. A runtime probe proved that mounting it injects `--ant-color-border` into a `<style>` tag and applies the `css-var-` class; a _bare_ `ConfigProvider` (no cssVar) does **not** inject it. So the token resolves at runtime.
- Corroborating evidence: 3 pre-existing `--ant-color-*` consumers exist in the repo (`src/frontend/src/index.css:90,96`, `AssignmentsPage.tsx:331`), confirming the project already relies on cssVar being on. The new usage is consistent with established practice.
- Note for accuracy: `themeConfig` in `AppThemeShell` does not explicitly set `cssVar: true`, yet it resolves — this is because AntD's `App` (`AntdApp`) enables cssVar. Not a defect; documented here for transparency.

### I9.2 — Keyboard activation / a11y ✅ PASS

- `TaskHeatmapTable.tsx:241-253`: the Popover trigger `<span>` is now `tabIndex={0}`, `role="button"`, and has an `onKeyDown` that on `Enter` or `' '` (Space) calls `event.preventDefault()` then `(event.currentTarget as HTMLElement).click()`.
- A non-native `<span role="button">` does **not** auto-fire a click on Enter/Space, so the manual `click()` is required and there is no double-activation. The handler opens the popover via the existing `trigger={['hover','click']}` click path.
- `event` is spelled out (no `e` abbreviation) → no `unicorn/prevent-abbreviations` issue. Lint: 0 errors.

### I9.3 — Dead null branch / prop narrowing ✅ PASS

- Caller is solely `TaskHeatmapTable.tsx:236`: `content={previewData ? <TaskPreviewCard data={previewData} /> : null}`. `TaskPreviewCard` only ever receives `previewData` when it is truthy, so the removed `if (data === null)` branch was genuinely unreachable.
- Grep confirms **no other caller** passes `null` to `TaskPreviewCard` (only `TaskHeatmapTable.tsx` in production code; the rest are spec files). tsc: 0 errors, so the narrowed `TaskPreviewData` prop is sound.
- `Typography` import is retained and still used (`renderArtifact` `Typography.Text`, and the card's `Typography.Text` labels).

### I9.4 — Doc references / constants ✅ PASS (with Improvement note)

- The two updated comments now cite `frontend-loading-and-width-standards.md §7`, which is a real, existing section. ✅
- `CARD_MAX_WIDTH` (400) and `CARD_BODY_MAX_HEIGHT` (480) are unchanged, and remain justified single-use max-width/max-height constraints (exempt from the 8px grid as non-spacing values). ✅
- **Improvement (false premise):** The PR description claims `TASK_PREVIEW_CARD_LAYOUT.md` is "non-existent". It **does exist** at the repo root (`/home/developer/AssessmentBot/TASK_PREVIEW_CARD_LAYOUT.md`, ~345 lines per `PR_REVIEW.md:168`). The original references were therefore _not_ dangling. The change swaps two valid, specific references for a valid but more generic one — harmless churn. **Action for the team:** be aware the doc is real so the other 6 references (`ImageRenderer.tsx:9`, `ClassPageHeatmapView.spec.tsx:17`, `TaskHeatmapTable.tsx:16`, `TaskHeatmapPage.tsx:10`, `TaskHeatmapTable.spec.tsx:10`, `e2e-tests/task-preview-card.spec.ts:15`) are NOT defects and should not be "fixed" away. Note `TaskHeatmapTable.tsx:16` (a file in this PR) still references the real doc — consistent with it existing.
- **Nitpick (citation precision):** The comments say "Exempt from the 8px grid … (see frontend-loading-and-width-standards.md §7)." The 8px-grid rule itself lives in `frontend-spacing-and-padding-standards.md`; §7 of the width doc is about width-token ownership. Defensible, but the spacing doc would be the more exact citation.

### British English ✅ PASS

- No new American spellings introduced in the changed code (`border`, `padding`, `content`, `renders` all fine; the removed "Task data not available" text was neutral).

### Out-of-scope

- Pre-existing `apiService.spec.ts:304` no-magic-numbers warning — not touched by this PR, correctly excluded.

---

## Summary of findings

| Severity         | Item                                                                                                                                                                    | Location                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Improvement      | PR premise wrong — `TASK_PREVIEW_CARD_LAYOUT.md` exists; original references were not dangling. Resulting code valid, but team should not "fix" the other 6 references. | `TaskPreviewCard.tsx:63,71` (and repo-wide) |
| Nitpick          | Doc citation for the 8px-grid exemption more precisely belongs to `frontend-spacing-and-padding-standards.md` than width-standards §7.                                  | `TaskPreviewCard.tsx:63,71`                 |
| Optional Nitpick | `onKeyDown` does not guard `event.repeat`; holding Space repeats `click()`, rapidly toggling the popover. Minor; consider `if (event.repeat) return;`.                  | `TaskHeatmapTable.tsx:245-250`              |

No Critical or blocking issues. The four changed files are safe to merge.
