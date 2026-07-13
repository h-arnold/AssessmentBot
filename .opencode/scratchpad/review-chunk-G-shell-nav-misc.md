# Code Review — Chunk G (shell, navigation, pages, theme, components, misc features, CONFIG)

**Reviewer**: Code Reviewer agent
**Diff base**: `feat/ReactFrontend...HEAD`
**Modules touched**: Frontend (`src/frontend/**`)
**Mandatory docs read**: `AGENTS.md` (root + `src/frontend`), `frontend-testing.md`, `frontend-shared-helpers-and-abstraction-standards.md`, `frontend-spacing-and-padding-standards.md`, `frontend-shell-navigation-and-motion.md`, `frontend-modal-patterns.md`, `frontend-logging-and-error-handling.md`, `TypeScriptAndLintConfigHierarchy.md`, `https://ant.design/llms.txt`.

---

## Summary

**Verdict: NEEDS IMPROVEMENT (blocking E2E regression)**

Chunk-G files themselves are standards-compliant and pass lint, type-check, and unit tests. However, the overall PR's Playwright E2E suite is **red** (2 failures in `e2e-tests/task-heatmap.spec.ts`) caused by a duplicate class-name `<h2>` heading rendered by `ClassPage.tsx` and `TaskHeatmapPage.tsx`. Those files are **outside this chunk's assigned scope** but are part of the same PR, so the PR cannot merge until E2E is green. The defect must be fixed (by the classPage owner) before re-submission. A handful of non-blocking in-chunk improvements/nitpicks are also listed.

> Note: the actual PR diff is far larger than the 28 files in this chunk — it includes the entire `features/classPage/*` rewrite. This review covers only the chunk-G file list; cross-chunk issues are flagged for coordination.

---

## Automated Checks

| Check            | Command                                         | Result                                                                                                                  |
| ---------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Lint (frontend)  | `npm run lint:frontend`                         | **PASS for in-scope files** (no errors/warnings). 2 repo-wide errors exist in **out-of-scope** files (see Cross-chunk). |
| Type-check       | `npm exec tsc -- -b src/frontend/tsconfig.json` | **PASS (exit 0)**                                                                                                       |
| Unit (Vitest)    | 6 in-scope specs                                | **PASS — 180 tests**                                                                                                    |
| E2E (Playwright) | `npm run test:frontend:e2e`                     | **2 FAILURES / 223** — both in `task-heatmap.spec.ts` (out-of-scope, root-caused below)                                 |

---

## Critical / Blocking

### C1 (Cross-chunk, PR-blocking) — Duplicate class-name `<h2>` breaks Task Heatmap E2E

- **Evidence**: Playwright failures at `e2e-tests/task-heatmap.spec.ts:40` and `:73`.
  - `getByRole('heading', { name: '7C2 Digital Technology 2025-2026' })` resolves to **2 elements** (strict-mode violation).
- **Root cause**: Both the parent and child page render the class name as a title:
  - `src/frontend/src/features/classPage/ClassPage.tsx:76` → `<PageTitleCard title={className} titleLevel={2} />`
  - `src/frontend/src/features/classPage/TaskHeatmapPage.tsx:172` (and the title-error path at `:156`) → `<PageTitleCard title={className} titleLevel={2} />`
  - The `PageTitleCard` component (chunk-G, `src/frontend/src/components/PageHeader.tsx`) is correct; the duplication is a **usage bug in the classPage feature**, which is outside this chunk but part of the same PR.
- **Impact**: 2 E2E tests fail; the PR cannot merge with red E2E.
- **Required action (classPage owner)**: Decide the intended title hierarchy. Typically the parent `ClassPage` owns the class-name title and the child (`TaskHeatmapPage` / `ClassPageContent`) should render only the assignment/section title — or suppress the parent's class-name title when a child view is active. Fix before merge.

### C2 (Cross-chunk, PR-blocking) — Lint error in `TaskHeatmapTable.spec.tsx`

- `src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx:20:1` → `error  Missing JSDoc @param "page" type (jsdoc/require-param-type)`.
- This file is in the full PR diff but outside chunk G. Must be fixed (add `@param {unknown} page` / correct type) before merge, since pre-commit lint is mandated by `AGENTS.md` §3.11.

---

## Improvement (non-blocking, in-chunk)

### I1 — Deprecated `Collapse.Panel` usage (`ClassesManagementPanel.tsx`)

- `src/frontend/src/features/classes/ClassesManagementPanel.tsx` renders `<Collapse.Panel>` with a comment noting it "triggers a deprecation warning in Ant Design v6". `Collapse.Panel` is deprecated in favour of the `items` prop.
- The comment justifies it as the only way to retain keyboard support with custom header components. Acceptable as a deliberate trade-off, but **verify `Collapse.Panel` is still present (not removed) in the pinned antd v6 version** and track a migration task, since a future antd bump could remove it and crash the panel.

### I2 — Default parameter on `PageSection` (`PageSection.tsx`)

- `src/frontend/src/pages/PageSection.tsx`: `const { title, children, level = 2 } = properties;`
- Per `AGENTS.md` §13 / Core Principle 7 ("Never set defaults unless explicitly instructed"), consider making `level` a required prop. All current callers (`PageHeader`) already pass `titleLevel` explicitly, so the default is effectively dead. Low severity.

### I3 — `export const` of a memo-wrapped component (`LinkableDefinitionList.tsx`)

- `src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.tsx:24`: `export const LinkableDefinitionList = memo(function LinkableDefinitionList(...)`
- `AGENTS.md` §2 prefers "export functions as functions, not constants assigned to arrow functions" for stack-trace/readability. The `memo()` wrapper is a reasonable justification, but to satisfy the letter of the rule consider:
  `function LinkableDefinitionList(...) {...}; export { LinkableDefinitionList }; export default memo(LinkableDefinitionList);`

---

## Nitpick (non-blocking)

- **`ReferenceDataManagementModalScaffold.tsx`** (line 13) references `React.ReactElement` while line 5 imports `ReactElement`. Standardise on the imported `ReactElement`.
- **`classDetailService.zod.spec.ts`** is 519 lines — slightly over the 500-line soft guideline (`AGENTS.md` review checklist). Optional: split describe blocks. (All 519 lines and their tests are otherwise clean and pass.)
- **`eslint.config.js`** — the `unicorn/no-keyword-prefix` disable is broad; could be narrowed to specific identifiers. Non-blocking, and otherwise the config does **not** weaken shared standards (it adds type-checked + unicorn + security + sonarjs + jsdoc rules on top of `tsBaseRules`).
- **`AppShell.tsx`** Sider `width={220}` / `collapsedWidth={80}` are fixed pixels rather than spacing/width tokens. This is shell chrome and acceptable, but tokenising would improve consistency with `frontend-spacing-and-padding-standards.md`.

---

## Files Reviewed (chunk G — in scope)

- `src/frontend/AGENTS.md`
- `src/frontend/eslint.config.js`
- `src/frontend/src/App.spec.tsx`
- `src/frontend/src/AppShell.tsx`
- `src/frontend/src/ClassSelectionContext.tsx`
- `src/frontend/src/components/PageHeader.tsx`
- `src/frontend/src/components/PageHeader.spec.tsx`
- `src/frontend/src/components/icons/LucideIcon.tsx`
- `src/frontend/src/features/auth/AuthStatusCard.tsx`
- `src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.tsx`
- `src/frontend/src/features/classes/ClassesManagementPanel.tsx`
- `src/frontend/src/features/classes/components/ClassesManagementPanelLoadingState.tsx`
- `src/frontend/src/features/referenceData/ManageTopicsModal.tsx`
- `src/frontend/src/features/referenceData/ReferenceDataInitialLoadingState.tsx`
- `src/frontend/src/features/referenceData/ReferenceDataManagementModalScaffold.tsx`
- `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`
- `src/frontend/src/index.css`
- `src/frontend/src/navigation/appNavigation.tsx`
- `src/frontend/src/pages/AssignmentsPage.tsx`
- `src/frontend/src/pages/ClassesPage.tsx`
- `src/frontend/src/pages/ClassesPage.spec.tsx`
- `src/frontend/src/pages/PageSection.tsx`
- `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.spec.ts`
- `src/frontend/src/services/assignmentDefinition/assignmentDefinitionUtilities.spec.ts`
- `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts`
- `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.ts`
- `src/frontend/src/services/assignmentDefinition/taskPartial.zod.spec.ts`
- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.spec.ts`
- `src/frontend/src/theme/spacing.ts`

## Cross-chunk files referenced in findings (NOT in chunk G, flagged for coordination)

- `src/frontend/src/features/classPage/ClassPage.tsx` (duplicate class-name title)
- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx` (duplicate class-name title)
- `src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx` (lint error)
- `e2e-tests/task-heatmap.spec.ts` (2 failing E2E tests)

---

## Standards Checklist (chunk G)

- [x] No `console.*` in active source (verified by read + grep; `frontendLogger` uses `globalThis.console` intentionally behind the logging boundary — out of this chunk).
- [x] No empty `catch` blocks.
- [x] British English: verified — only `color`/`center`/`centered` matches are CSS/antd API property names (correct), no American prose spellings (`favor`/`behavior`) in scope.
- [x] No speculative scope expansion; changes are spacing-token migration, context plumbing, and new shared components.
- [x] No unrequested default values introduced (see I2 for a pre-existing default worth tightening).
- [x] `@remarks`/`JSDoc` present on new shared components and context.
- [x] Files ≤ 500 lines (only the out-of-chunk spec at 519 lines, noted as nitpick).
- [x] Frontend-only: `App.tsx` remains thin; side effects in hooks; no `src/backend` imports; no `@ant-design/v5-patch-for-react-19`; assets inlineable; Playwright E2E exercised (see C1).
- [x] Spacing: all in-scope UI migrated to `APP_GAP_*` / `APP_SPACE_SIZE_*` tokens (8px grid; `APP_GAP_COMPACT=12` is a documented named token exception).
- [x] Tests: behavioural (assert rendered outcomes / schema parsing), hermetic (no live GAS), and pass (180 unit + 221 E2E).
