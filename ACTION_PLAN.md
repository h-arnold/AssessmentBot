# Task Preview Card — Feature Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md` (Task Preview Card Specification, draft v1.6).
2. Read `TASK_PREVIEW_CARD_LAYOUT.md` (Task Preview Card Layout Specification).
3. Treat those documents as the source of truth for product behaviour, contracts, and layout rules.
4. Use this action plan to sequence delivery and testing; do not restate or redefine material already settled in the spec or layout docs.

## Scope and assumptions

### Scope

- New `TaskPreviewCard` presentational component (popover content)
- New `MarkdownRenderer` shared component (`react-markdown` + `remark-gfm`) in `src/frontend/src/components/`
- New `ImageRenderer` shared component (base64 `<img>`) in `src/frontend/src/components/`
- Popover integration in `TaskHeatmapTable` wrapping metric sub-cell `render` functions
- Feature-local fixture copies in `classPage/fixtures/` with unique taskIds
- `getTaskPreviewData` adapter with deterministic metricKey→fixture lookup
- `react-markdown` and `remark-gfm` added to `src/frontend/package.json`
- Playwright E2E tests with web-first content assertions and supplementary screenshots
- Unit/component tests for all new components and the fixture adapter
- Update four dangling `@see TASK_HEATMAP_LAYOUT.md` references to point to the new layout spec

### Out of scope

- Live wiring to the `assignmentAssessment` service (next implementation round)
- SPREADSHEET (Sheets) and `base` task artifact rendering
- Custom popover styling beyond Ant Design defaults
- Keyboard focus trigger for the popover
- Removal of feature-local fixture copies (done when service is wired)

### Assumptions

1. `react-markdown` and `remark-gfm` bundle cleanly through the Vite/GAS builder pipeline (pure JS/TS, no CDN).
2. The existing `MetricPill` and `MetricIconLabel` components are stable and can be reused without modification.
3. The heatmap table's existing `render` function for metric sub-cells can be wrapped in a `Popover` without breaking sorting, filtering, or aria-label behaviour.
4. Wrapping ~450 cells (50 rows × 3 tasks × 3 metric sub-columns, worst case) in individual `Popover` components has acceptable render cost (Ant Design `Popover` is lazy).
5. The `taskId` parameter in `getTaskPreviewData` is unused in v1 but retained for the forward-looking contract.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API/entry points thin and delegate behaviour to services or controllers.
- Fail fast on invalid inputs and persistence failures.
- Avoid defensive guards that hide wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.
- Export service functions as `function` declarations, not `const` arrow functions (frontend AGENTS §2).
- All spacing must follow the 8px grid system.
- Production source must not import from `src/test/**`.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan must define and enforce mandatory documentation reads.

For each delegated phase (`Testing Specialist`, `Implementation`, `Code Reviewer`, `Docs`, `De-Sloppification`, or planning agents when used):

1. list required documentation file paths under that phase before delegation
2. require the sub-agent handoff to include `Files read` with explicit file paths
3. verify every mandatory file is listed before accepting the handoff
4. if any mandatory file is missing, return the work to the same sub-agent and block progression to the next phase

### Shared-helper planning gate (mandatory when helper changes are expected)

When a section is likely to introduce helper reuse, helper extension, or new shared helpers:

1. record helper decisions in that section before implementation
2. include: decision (`reuse` | `extend` | `new` | `keep local`), owning path, and call-site rationale
3. add planned helper entries to the relevant canonical docs with status `Not implemented`
4. during documentation pass, reconcile planned entries against actual implementation and update status/details accordingly

### Validation commands hierarchy

- Backend lint: `npm run lint:backend`
- Frontend lint: `npm run lint:frontend`
- Builder lint (if touched): `npm run lint:builder`
- Backend tests: `npm run test:backend -- <target>`
- Frontend unit tests: `npm run test:frontend -- <target>`
- Frontend e2e tests (if UX changes): `npm run test:frontend:e2e -- <target>`

---

## Section 1 — Dependencies and fixture setup

### Objective

Add `react-markdown` and `remark-gfm` to the frontend package, and copy the three test fixture JSON files into a feature-local `fixtures/` directory with unique taskIds.

### Constraints

- `react-markdown` and `remark-gfm` must be added to `src/frontend/package.json` (not the root).
- Fixture copies must have unique `taskId` values to avoid the `t_eb2bc6cd1605` collision.
- Both the top-level key and the nested `artifact.taskId` field must be updated in each fixture copy. The fixture object also has a top-level `taskId` field and an `id` field; these should also be updated for fidelity, even though the v1 loader does not use them.
- Production source must not import from `src/test/**`.

### Delegation mandatory reads (when sub-agents are used)

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC.md`
- `TASK_PREVIEW_CARD_LAYOUT.md`
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Shared helper plan

No shared helper changes in this section.

### Acceptance criteria

- `react-markdown` and `remark-gfm` are listed in `src/frontend/package.json` dependencies.
- Three fixture copies exist at `src/frontend/src/features/classPage/fixtures/` with unique taskIds:
  - `imageTask.json` → `t_preview_image_001`
  - `textTask.json` → `t_preview_text_001`
  - `table_task.json` → `t_preview_table_001`
- `npm run lint:frontend` passes.

### Required test cases (Red first)

No tests needed for this section (dependency addition and file copy).

### Section checks

- `npm run lint:frontend`
- Fixture files exist with correct taskIds.

### Optional `@remarks` JSDoc follow-through

None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Added `react-markdown` (`^10.1.0`) and `remark-gfm` (`^4.0.1`) to `src/frontend/package.json` `dependencies` and ran `npm install` in `src/frontend/` (node_modules + lockfile updated). Copied `imageTask.json`, `textTask.json`, and `table_task.json` from `src/frontend/src/test/shared/` into `src/frontend/src/features/classPage/fixtures/`, rewriting the top-level key, `id`, `taskId`, and nested `artifact.taskId` to unique values `t_preview_image_001`, `t_preview_text_001`, and `t_preview_table_001` respectively (types IMAGE/TEXT/TABLE). Transformation done via a throwaway Node script; source fixtures untouched.
- **Deviations from plan:** None.
- **Follow-up implications for later sections:** none.

**Status: Complete** — lint clean, all 1618 frontend unit tests pass (no regressions). Reviewed clean by Code Reviewer.

---

## Section 2 — ImageRenderer component

### Objective

Create a presentational `ImageRenderer` shared component that renders a base64 data URL as an `<img>` element with appropriate constraints and accessibility attributes.

### Constraints

- Lives in `src/frontend/src/components/` as a shared component (expected to be reused across the project).
- Accepts `src` (base64 data URL string) and optional `alt` text.
- Image must have `maxWidth: '100%'`, `height: 'auto'`, and `maxHeight: 400`.
- Must have `alt` attribute for accessibility.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `SPEC.md`
- `TASK_PREVIEW_CARD_LAYOUT.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC.md`
- `TASK_PREVIEW_CARD_LAYOUT.md`
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `TASK_PREVIEW_CARD_LAYOUT.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`

### Shared helper plan

Helper decision entries:

1. Helper: `ImageRenderer` presentational component
   - Decision: `new`
   - Owning module/path: `src/frontend/src/components/ImageRenderer/ImageRenderer.tsx`
   - Call-site rationale: renders base64 data URLs as constrained `<img>` elements for the task preview card and future consumers. Placed in their own subdirectories under `src/frontend/src/components/` as the user expects reuse across the project.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §3 (Canonical helper map — new entry)
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `ImageRenderer` renders an `<img>` element with the provided `src` as the data URL.
- The image has `alt="Student response image"` by default (overridable via prop).
- The image has `maxWidth: '100%'`, `height: 'auto'`, and `maxHeight: 400`.
- Component is presentational (no state, no side effects).

### Required test cases (Red first)

Frontend tests:

1. Renders an `<img>` with the correct `src` attribute.
2. Renders with the default `alt` text "Student response image".
3. Renders with a custom `alt` text when provided.
4. Applies the correct inline styles (`maxWidth`, `height`, `maxHeight`).

### Section checks

- `npm run test:frontend -- src/frontend/src/components/ImageRenderer/ImageRenderer.spec.tsx`
- `npm run lint:frontend`
- Planned `ImageRenderer` shared-helper entry added to the canonical helper map (§3) with status `Not implemented` before implementation starts (per the global Shared-helper planning gate).

### Optional `@remarks` JSDoc follow-through

- Document that `maxHeight: 400` is set per the layout spec and may be adjusted if needed.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Created `src/frontend/src/components/ImageRenderer/ImageRenderer.tsx` (function declaration `ImageRenderer`, props `src` + optional `alt` defaulting to `"Student response image"`, inline `style` `{ maxWidth: '100%', height: 'auto', maxHeight: 400 }`) and `ImageRenderer.spec.tsx` (4 tests). Added a planned `ImageRenderer` entry to `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §3.5 (status `Not implemented`).
- **Deviations from plan:** The test asserts inline styles via direct `img.style` reads (`.maxWidth === '100%'`, `.height === 'auto'`, `.maxHeight === '400px'`) rather than `toHaveStyle`, because the shared `src/frontend/src/test/setup.ts` `getComputedStyleMock` does not normalise multi-word CSS properties / `px` lengths the way `@testing-library/jest-dom`'s `toHaveStyle` expects. The shared harness was deliberately left unmodified (out of scope and brittle). `maxHeight` is a numeric `400` so React emits valid `max-height: 400px` (a unitless non-zero length is invalid CSS).
- **Follow-up implications for later sections:** none.

**Status: Complete** — 4 tests pass, lint clean, all 1622 frontend unit tests green (no regression). Reviewed clean by Code Reviewer (one minor JSDoc type-reference nitpick fixed).

---

## Section 3 — MarkdownRenderer component

### Objective

Create a presentational `MarkdownRenderer` shared component that renders markdown text (including tables) using `react-markdown` + `remark-gfm`.

### Constraints

- Lives in `src/frontend/src/components/` as a shared component (expected to be reused across the project).
- Accepts markdown string as children.
- Must use `react-markdown` with `remark-gfm` plugin for table support.
- Must NOT use `rehype-raw` (XSS guard).
- Tables rendered by the component should have basic styling (borders, padding) via a co-located CSS module or inline style object within `MarkdownRenderer.tsx` — not a new global stylesheet.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `SPEC.md`
- `TASK_PREVIEW_CARD_LAYOUT.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC.md`
- `TASK_PREVIEW_CARD_LAYOUT.md`
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `TASK_PREVIEW_CARD_LAYOUT.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`

### Shared helper plan

Helper decision entries:

1. Helper: `MarkdownRenderer` presentational component
   - Decision: `new`
   - Owning module/path: `src/frontend/src/components/MarkdownRenderer/MarkdownRenderer.tsx`
   - Call-site rationale: renders markdown text and tables for the task preview card and future consumers. Placed in their own subdirectories under `src/frontend/src/components/` as the user expects reuse across the project.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §3 (Canonical helper map — new entry)
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `MarkdownRenderer` renders markdown text (paragraphs, bold, italic, lists) correctly.
- `MarkdownRenderer` renders markdown tables with `remark-gfm` plugin.
- Raw HTML in markdown is escaped (no `rehype-raw`).
- Tables have basic styling (borders, padding) via co-located CSS.

### Required test cases (Red first)

Frontend tests:

1. Renders plain text markdown correctly.
2. Renders bold and italic text.
3. Renders a markdown table with correct structure (`<table>`, `<tr>`, `<td>`).
4. Escapes raw HTML (does not render `<script>` tags, etc.).
5. Renders lists (ordered and unordered).

### Section checks

- `npm run test:frontend -- src/frontend/src/components/MarkdownRenderer/MarkdownRenderer.spec.tsx`
- `npm run lint:frontend`
- Planned `MarkdownRenderer` shared-helper entry added to the canonical helper map (§3) with status `Not implemented` before implementation starts (per the global Shared-helper planning gate).

### Optional `@remarks` JSDoc follow-through

- Document that `rehype-raw` is intentionally excluded for XSS protection.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** none.

---

## Section 4 — TaskPreviewCard component

### Objective

Create the `TaskPreviewCard` presentational component that displays the metric header (icon + label + score), reasoning section, and student response section.

### Constraints

- Presentational only — receives all data via props, no internal state or side effects.
- Reuses `MetricIconLabel` for the header icon.
- Reuses `MetricPill` for the header score (reassembled `MetricResult`) with `precision={0}` and `compact={true}` (per layout spec §2).
- Uses `Typography` for section labels and reasoning text.
- Uses `Divider` between reasoning and student response sections.
- Uses `ImageRenderer` or `MarkdownRenderer` based on artifact type.
- Card body has `maxHeight: 480` with `overflow: 'auto'` for scrolling.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `SPEC.md`
- `TASK_PREVIEW_CARD_LAYOUT.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC.md`
- `TASK_PREVIEW_CARD_LAYOUT.md`
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`
- `src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx`
- `src/frontend/src/components/MetricIconLabel/MetricIconLabel.tsx`

Code Reviewer mandatory docs:

- `SPEC.md`
- `TASK_PREVIEW_CARD_LAYOUT.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`

### Shared helper plan

No new shared helpers. Reuses existing `MetricPill` and `MetricIconLabel`.

### Acceptance criteria

- Renders the header with `MetricIconLabel`, metric label, and `MetricPill` score.
- Renders the reasoning section with label and text (or placeholder if empty).
- Renders the student response section with the appropriate renderer based on artifact type.
- Renders "Task data not available" when no preview data is provided.
- Card body scrolls when content exceeds `maxHeight`.

### Required test cases (Red first)

Frontend tests:

1. Renders the header with correct metric icon, label, and score for a computed metric.
2. Renders the header with "N" for a notAttempted metric.
3. Renders the header with "E" for an error metric.
4. Renders the reasoning section with the provided reasoning text.
5. Renders "No reasoning available" when reasoning is empty.
6. Renders an IMAGE artifact using `ImageRenderer`.
7. Renders a TABLE artifact using `MarkdownRenderer`.
8. Renders a TEXT artifact using `MarkdownRenderer`.
9. Renders "No submission available" when artifact content is empty (notAttempted).
10. Renders "Error loading response" when artifact content is empty (error).
11. Renders "Task data not available" when no preview data is provided.
12. Renders the computed score as an integer (e.g. "5", not "5.00") — verifies `MetricPill` is called with `precision={0}`.

### Section checks

- `npm run test:frontend -- src/frontend/src/features/classPage/TaskPreviewCard.spec.tsx`
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

- Document the `MetricResult` reassembly logic (from `metricState` + `metricScore` with schema-valid values per SPEC §"MetricPill reuse").
- Document the known v1 demo artefact (notAttempted/error cells show fixture reasoning/artifact regardless of cell state).

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** none.

---

## Section 5 — getTaskPreviewData adapter

### Objective

Create the `getTaskPreviewData` pure function that resolves preview data for a given heatmap cell using the deterministic metricKey→fixture lookup table.

### Constraints

- Pure function, no React imports, no side effects.
- In v1, the `taskId` parameter is unused (lookup is keyed by `metricKey` only).
- Returns `TaskPreviewData | null`.
- Deterministic mapping: completeness → image fixture, accuracy → text fixture, spag → table fixture.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `SPEC.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC.md`
- `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts` (MetricResult type)

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`

### Shared helper plan

No shared helper changes.

### Acceptance criteria

- Returns correct `TaskPreviewData` for `metricKey === 'completeness'` (IMAGE artifact).
- Returns correct `TaskPreviewData` for `metricKey === 'accuracy'` (TEXT artifact).
- Returns correct `TaskPreviewData` for `metricKey === 'spag'` (TABLE artifact).
- The `taskId` parameter is accepted but not used (forward-looking contract).

### Required test cases (Red first)

Frontend tests:

1. Returns IMAGE artifact data for `metricKey === 'completeness'`.
2. Returns TEXT artifact data for `metricKey === 'accuracy'`.
3. Returns TABLE artifact data for `metricKey === 'spag'`.
4. Preserves `metricScore` and `metricState` from the input `metricResult`.

### Section checks

- `npm run test:frontend -- src/frontend/src/features/classPage/taskPreviewFixtures.spec.ts`
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

- Document that `taskId` is unused in v1 but retained for the service-wiring contract.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** none.

---

## Section 6 — Popover integration in TaskHeatmapTable

### Objective

Wrap each metric sub-cell's `render` function in `TaskHeatmapTable` with an Ant Design `Popover` that displays the `TaskPreviewCard`.

### Constraints

- Must not break existing table layout, sorting, filtering, or aria-label behaviour.
- Popover uses `trigger={['hover', 'click']}` and `placement="right"`.
- The trigger element remains a plain `<span>` (non-focusable) in v1.
- `TaskHeatmapTable` imports `getTaskPreviewData` directly from `taskPreviewFixtures.ts` (co-located in `classPage/`; no prop drilling needed per frontend AGENTS §3 and KISS).

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `SPEC.md`
- `TASK_PREVIEW_CARD_LAYOUT.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC.md`
- `TASK_PREVIEW_CARD_LAYOUT.md`
- `src/frontend/src/features/classPage/TaskHeatmapTable.tsx`
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `TASK_PREVIEW_CARD_LAYOUT.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`

### Shared helper plan

No shared helper changes.

### Acceptance criteria

- Hovering over a metric sub-cell shows the popover with the correct preview card.
- Clicking a metric sub-cell pins the popover open.
- The popover displays the correct metric header, reasoning, and student response.
- Existing table sorting, filtering, and aria-label behaviour is preserved.
- The popover does not break the heatmap table layout.
- Smoke test: the heatmap renders and remains interactive with the available test fixture after the Popover wrapper is added.

### Required test cases (Red first)

Frontend tests:

1. Wraps each metric sub-cell in a Popover component.
2. Popover content renders the TaskPreviewCard with correct data.
3. Existing aria-label on the cell is preserved.
4. Existing cell style (tone colour) is preserved.
5. Smoke test: the heatmap renders and remains interactive (cells are clickable/hoverable) with the available test fixture after the Popover wrapper is added. Note: the 50-row scaling bound (per `pageSize: 50` in `TaskHeatmapTable.tsx`) is not exercisable with the seeded 10-student fixture; the risk is accepted on the basis of Ant Design Popover laziness.

### Section checks

- `npm run test:frontend -- src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx`
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

- Document that the Popover wrapper is added to the existing `render` function without changing the cell's visual appearance.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** none.

---

## Section 7 — @see reference updates

### Objective

Update the four dangling `@see TASK_HEATMAP_LAYOUT.md` references in code to point to the new layout spec. (The fifth reference in `frontend-shared-helpers-and-abstraction-standards.md:741` was already corrected.)

### Constraints

- Must update all four code files: `TaskHeatmapTable.tsx`, `TaskHeatmapPage.tsx`, `ClassPageHeatmapView.spec.tsx`, `TaskHeatmapTable.spec.tsx`.

### Delegation mandatory reads (when sub-agents are used)

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `TASK_PREVIEW_CARD_LAYOUT.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `TASK_PREVIEW_CARD_LAYOUT.md`
- `src/frontend/AGENTS.md`

### Shared helper plan

No shared helper changes.

### Acceptance criteria

- All four code files reference `TASK_PREVIEW_CARD_LAYOUT.md` instead of `TASK_HEATMAP_LAYOUT.md`.
- `npm run lint:frontend` passes.

### Required test cases (Red first)

No tests needed (documentation update only).

### Section checks

- `npm run lint:frontend`
- Grep for `TASK_HEATMAP_LAYOUT.md` returns no matches in the four code files.

### Optional `@remarks` JSDoc follow-through

None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** none.

---

## Section 8 — Playwright E2E tests

### Objective

Create Playwright E2E tests that navigate to the heatmap table, hover over metric sub-cells, and verify the preview card content with web-first assertions. Screenshots are captured as supplementary evidence.

### Constraints

- Must use the existing `createHeatmapScenario` factory from `task-heatmap-end-to-end-helpers.ts`.
- Tests must include web-first content assertions (not screenshot-only) per `frontend-playwright-e2e.md`.
- Screenshots should capture the popover in both hover and pinned states as supplementary evidence.
- Tests should cover all three artifact types (IMAGE, TABLE, TEXT).
- Use structural locators (e.g. `getByText`, `locator('img')`, `toHaveCount(1)`) rather than `toBeVisible()` on `Typography.Text` (which can falsely resolve as hidden per the E2E doc).
- The aria-label values used in the required test cases (e.g. `Student Two, task_001, Completeness: 5`, `Accuracy: 3`, `SPaG: 4`) are illustrative. The Playwright agent must derive the exact `studentName`/`taskId`/score values from the `createHeatmapScenario` fixture data at implementation time, and confirm they match the `onCell` aria-label format in `TaskHeatmapTable.tsx` (`${studentName}, ${taskId}, ${metricLabel}: ${score}`).

### Delegation mandatory reads (when sub-agents are used)

Playwright mandatory docs:

- `docs/developer/frontend/frontend-playwright-e2e.md`
- `SPEC.md`
- `TASK_PREVIEW_CARD_LAYOUT.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-playwright-e2e.md`
- `src/frontend/e2e-tests/task-heatmap.spec.ts`
- `src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts`
- `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`

### Shared helper plan

No shared helper changes.

### Acceptance criteria

- E2E test navigates to the heatmap table.
- E2E test hovers over a completeness cell and asserts the IMAGE preview card content (metric label scoped to popover, "Reasoning", "Student Response", `<img>` element) and captures a screenshot.
- E2E test hovers over an accuracy cell and asserts the TEXT preview card content (metric label scoped to popover, "Reasoning", "Student Response", markdown-rendered text) and captures a screenshot.
- E2E test hovers over a spag cell and asserts the TABLE preview card content (metric label scoped to popover, "Reasoning", "Student Response", `<table>` element) and captures a screenshot.
- E2E test clicks a cell to pin the popover and asserts the popover remains visible after mouse leave.
- Screenshots are stored in `e2e-tests/task-preview-card.spec.ts-snapshots/`.

### Required test cases (Red first)

Playwright E2E tests:

1. Shows IMAGE preview card when hovering over a completeness cell: target a specific cell via its `aria-label` (e.g. `page.locator('[aria-label="Student Two, task_001, Completeness: 5"]')`, matching the pattern from `task-heatmap.spec.ts:65`). Asserts the metric label ("Completeness") scoped to the popover (e.g. `page.locator('.ant-popover').getByText('Completeness')`), "Reasoning" section, "Student Response" section, and an `<img>` element are present; captures screenshot.
2. Shows TEXT preview card when hovering over an accuracy cell: target a specific cell via its `aria-label` (e.g. `page.locator('[aria-label="Student Two, task_001, Accuracy: 3"]')`). Asserts the metric label ("Accuracy") scoped to the popover, "Reasoning" section, "Student Response" section, and markdown-rendered text content are present; captures screenshot.
3. Shows TABLE preview card when hovering over a spag cell: target a specific cell via its `aria-label` (e.g. `page.locator('[aria-label="Student Two, task_001, SPaG: 4"]')`). Asserts the metric label ("SPaG") scoped to the popover, "Reasoning" section, "Student Response" section, and a `<table>` element are present; captures screenshot.
4. Pins the popover when clicking a cell: target a specific cell via its `aria-label`, click to open the popover, then move the mouse to a neutral coordinate (e.g. `page.mouse.move(0, 0)`) to trigger `mouseLeave`. Asserts the popover remains visible after mouse leave; captures screenshot.

### Section checks

- `npm run test:frontend:e2e -- e2e-tests/task-preview-card.spec.ts`
- Screenshots exist in `e2e-tests/task-preview-card.spec.ts-snapshots/`.

### Optional `@remarks` JSDoc follow-through

None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** none.

---

## Regression and contract hardening

### Objective

Run all existing tests and lints to ensure the new feature does not introduce regressions.

### Constraints

- Prefer focused test runs before broader validation.

### Acceptance criteria

- All existing frontend unit tests pass.
- All existing Playwright E2E tests pass.
- Frontend lint passes.
- No new TypeScript errors.

### Required test cases/checks

1. Run `npm run test:frontend` (all frontend unit tests).
2. Run `npm run test:frontend:e2e` (all Playwright E2E tests).
3. Run `npm run lint:frontend`.
4. Verify mandatory-read evidence (`Files read`) is complete for every delegated regression handoff.

### Section checks

- Run the commands listed above and ensure green results.

### Implementation notes / deviations / follow-up

- **Implementation notes:** summarise what was done during regression phase.
- **Deviations from plan:** note any additional work discovered or done.

---

## Documentation and rollout notes

### Objective

Update docs to match implemented feature and highlight any caveats.

### Constraints

- Only modify documents relevant to the touched areas.

### Acceptance criteria

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §3 (Canonical helper map) has planned entries for `ImageRenderer` and `MarkdownRenderer` (status: `Not implemented` → `Implemented`).
- Any deviations or caveats are documented.

### Required checks

1. Verify docs mention the new components and their placement.
2. Confirm notes/deviations fields are filled during implementation.
3. Verify mandatory-read evidence (`Files read`) is complete for delegated docs/review handoffs.
4. Reconcile planned shared-helper entries in canonical docs: update `Not implemented` → `Implemented` where delivered.

### Optional `@remarks` JSDoc review

- Confirm whether any non-obvious design decisions, gotchas, or cross-component interactions discovered during implementation should be preserved in `@remarks` documentation.
- If earlier sections planned `@remarks`, verify that the relevant code now contains them before deleting the action plan.
- If no `@remarks` are needed, record `None`.

### Implementation notes / deviations / follow-up

- ...

---

## Suggested implementation order

1. Section 1 (dependencies and fixture setup)
2. Section 2 (ImageRenderer component)
3. Section 3 (MarkdownRenderer component)
4. Section 4 (TaskPreviewCard component)
5. Section 5 (getTaskPreviewData adapter)
6. Section 6 (Popover integration in TaskHeatmapTable)
7. Section 7 (@see reference updates)
8. Section 8 (Playwright E2E tests)
9. Regression and contract hardening
10. Documentation and rollout notes
