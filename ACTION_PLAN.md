# Task Preview Card — Real-Data Wiring: Delivery Plan (TDD-First)

> **Revision:** Sixth review pass (planner-reviewer Improvements I1–I2
> and Nitpicks N1–N2 addressed):
> **I1 (Section 5.5 `getAssignment` payload construction misdirected):**
> the prior revision instructed the Playwright agent to "extend
> `buildItem`", but `buildItem` (lines 204–219 of
> `task-heatmap-end-to-end-helpers.ts`) constructs objects inside
> `buildClassFullDocument`'s `submissions[]` validated by the partial
> `StudentSubmissionPartialSchema` (`classDetailService.zod.ts` lines
> 63–88) — it is NOT reused for the new `getAssignment` payload. The
> revised §5.5 reframes the `getAssignment` payload as a **fresh
> construction** (new `buildAssignmentFullDocument` helper or inline
> literal inside `createHeatmapScenario`; do NOT extend `buildItem`),
> enumerates the additional `StudentSubmissionSchema` +
> `StudentSubmissionItemSchema` required fields (`studentName`,
> `assignmentId`, `documentId`, `createdAt`, `updatedAt`, `id`,
> `feedback` — lines 84–110), and documents the `assignmentDefinition`
> sub-shape (`AssignmentDefinitionSchema` lines 116–134). The SPEC
> §"E2E plumbing updates" prose is updated in lock-step.
> **I2 (Section 3 + Section 5 mandatory-read gaps):** §3
> `assembleTaskPreviewData` Testing + Implementation mandatory docs
> now include `buildCellPreviewLookup.ts` (the `CellPreviewData` type's
> home) and `spreadsheetToMarkdownTable.ts` (the SPREADSHEET converter
> it calls); §5 `TaskHeatmapTable` Testing + Implementation mandatory
> docs now include `buildCellPreviewLookup.ts` (the `CellPreviewLookup`
> type) and `assembleTaskPreviewData.ts` (the mapping function called
> in the cell `render`). The mandatory-read evidence gate now
> correctly covers the type/signature contracts these sections
> import/consume.
> **N1 (IMAGE content renderability not called out):** §5.5 Objective 3
> now notes that the IMAGE-seeded `task_001` artifact's `content` MUST
> be a non-empty renderable image source (data URI or URL) so
> `ImageRenderer` produces an `<img>` element and the existing
> `popover.locator('img')).toHaveCount(1)` assertion holds. The SPEC
> §"E2E plumbing updates" includes the same note.
> **N2 (SPEC inline single-entry snippet contradicted two-entry
> requirement):** the inline `scenario.getAssignment = [{ ... }]`
> snippet replaced with the explicit two-entry array
> `[{ kind: 'success', data: ... }, { kind: 'success', data: ... }]`.
> )
>
> **Prior:** Fourth review pass (planning-reviewer Critical C1 and
> Improvements I1–I3 / Nitpicks N1–N2 addressed:
> **C1 (Critical — E2E `task-preview-card.spec.ts` regression risk):**
> the existing E2E spec asserts popover content sourced from the fixture
> adapter deleted in Section 6; once Section 5 wires the popover to a
> real `getAssignment` query, `installRuntimeMock` does not intercept
> `'getAssignment'` (the method is absent from `allMethods` at
> `endToEndRuntimeMocks.ts` lines 476–490) and `createHeatmapScenario`
> seeds no `getAssignment` payload, so the four popover tests would hang,
> throw, or render the error `Alert` instead of real content. New
> Section 5.5 lands **after** Section 5 (real-data wiring) and **before**
> Section 6 (fixture deletion) to add `'getAssignment'` to `allMethods`,
> extend `RuntimeScenario` with a `getAssignment?` field, seed a
> schema-valid two-entry `AssignmentFull` payload in
> `createHeatmapScenario` keyed on Student Two × `task_001`/`task_002`/
> `task_003`, and replace the `/preview cards work properly/i`
> fixture-derived assertion at `task-preview-card.spec.ts` line 132
> with an assertion against the seeded real content; Section 5.5
> delegates to `Playwright` per `AGENTS.md` §6 / §9.
> **I1:** `taskId` behavioural change surfaced as a minor user-visible
> side-effect under SPEC §"Agreed product decisions" item 4 (popover
> header now uses the heatmap column's real `taskColumn.taskId`, not the
> fixture adapter's `t_preview_*` identifier; locked by Section 3 test
> 13).
> **I2:** Regression "Required test cases / checks" list extended with
> an E2E step (`npm run test:frontend:e2e -- task-preview-card`) and
> explicit acceptance-criteria entries for `ClassPage.spec.tsx` and
> `task-preview-card.spec.ts`; Section checks gain an
> `/preview cards work properly/i` removal confirmation.
> **I3:** `frontend-spacing-and-padding-standards.md` added to Section 4
> Code Reviewer mandatory reads (the error-`Alert` UI wiring + page
> `Card` wrapper host the popover surface; `src/frontend/AGENTS.md` §4
> "Mandatory spacing and padding read" applies — parity with Section 5).
> **N1:** SPEC §"New: Task Preview Skeleton" `keep local` phrasing
> aligned with the action-plan Shared helper plan wording.
> **N2:** SPEC prose stating `cellPreviewLookup.get(...)?.get(...)` "returns
> `undefined`" now notes the `?? null` coercion before passing into
> `assembleTaskPreviewData` (`cellData` is `CellPreviewData | null`, not
> `| undefined`).
> )
>
> **Prior:** Third review pass (reviewer findings I1–I3, N1–N2
> addressed on the first cycle; one follow-up Critical found and resolved on
> resubmission: §4/§5 prop-type ownership overlap resolved by moving the three
> `TaskHeatmapTable` required-prop additions into Section 4 (type-only,
> consumption stays in Section 5) so the repo stays TypeScript-green between
> sections; `assignmentAssessment.zod.ts` added to Section 4 mandatory reads
> so the default-mock `AssignmentFull` fixture can be built schema-valid;
> hook-placement constraint added to Section 4 to keep React hooks-call order
> stable across the early-return paths; Section 4 Test #9 augmented with the
> deduplication scope rationale; Documentation Required check 2 search path
> widened from `src/frontend/src/` to `src/frontend/` to cover
> `e2e-tests/`.
> **Resubmission Critical fix:** `ClassPage.spec.tsx`'s heatmap-view test
> (lines 259–317) renders real `TaskHeatmapPage` via `vi.importActual`'d
> `ClassPageContent` with no `QueryClientProvider` and no `getAssignment`
> mock — it would break once `useQuery` is added. Section 4 Test
> infrastructure requirements, mandatory reads, acceptance criteria, Test
> #11, and section checks now all include `ClassPage.spec.tsx`).
> **SPEC Nitpick addressed:** explicit `innerMap.set(item.taskId, …)` step
> added to the derivation rules so the bare-`taskId` inner keying is
> unambiguous in the prose.
> **Resubmission-2 Nitpick addressed:** §4 Test infrastructure bullet 2
> reworded from "both spec files" to "all three spec files"
> (`TaskHeatmapPage.spec.tsx`, `ClassPageHeatmapView.spec.tsx`,
> `ClassPage.spec.tsx`) and bullet 3 (default-mock guidance) extended to
> enumerate all three, with per-file rationale noting that
> `TaskHeatmapPage.spec.tsx`'s two error-handling tests also exercise the
> real `useQuery` path before the early returns take over.
>
> **Prior:** Second review pass (reviewer findings C1, C2, I1–I5, N1–N2
> addressed: `taskId` pass-through + Refresh-while-pending test
> infrastructure made explicit, `QueryClient`+`assignmentAssessmentService`
> mock guidance added to Section 4, identifier-alignment assumption split,
> `TaskPreviewSkeleton` placement pinned to inline + `keep local`,
> `TASK_PREVIEW_CARD_LAYOUT.md` cleanup enumeration extended from 2 to 7
> files, `grep` phrasing made tool-neutral).

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md` (Task Preview Card real-data wiring, v1.3).
2. Read `docs/developer/frontend/frontend-loading-and-width-standards.md`.
3. Read `docs/developer/frontend/frontend-react-query-and-prefetch.md`.
4. Read `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18.16.
5. Read `docs/developer/frontend/frontend-logging-and-error-handling.md`.
6. Treat those documents as the source of truth for product behaviour, contracts, and layout rules.

## Scope and assumptions

### Scope

- Three new pure helper modules: `buildCellPreviewLookup`, `spreadsheetToMarkdownTable`, `assembleTaskPreviewData`.
- `useQuery(getAssignmentQueryOptions(...))` added to `TaskHeatmapPage`.
- `TaskHeatmapTable` receives three new required props and replaces fixture-based popover content with real data.
- Popover skeleton and error `Alert` states.
- Refresh button in `TaskHeatmapPage` wraps the parent `refetch` to also refetch the assignment query.
- Deletion of 5 fixture-related files (3 JSON, `taskPreviewFixtures.ts`, `taskPreviewFixtures.spec.ts`).
- Removal of stale `@remarks` block from `TaskPreviewCard.tsx`.

### Out of scope

- Changing `useClassPageData` or the ClassPage prefetch policy.
- Adding a dedicated spreadsheet renderer component.
- Popover-level retry button.
- Creating `TASK_PREVIEW_CARD_LAYOUT.md`.

### Assumptions

1. `AssignmentFull.submissions[].studentId` matches `ClassFull.students[].id` (and therefore `HeatmapRow.studentId`); `StudentSubmissionItem.taskId` matches `HeatmapTaskColumn.taskId`. These backend invariants are covered by a joined-fixture test in Section 1.
2. `getAssignmentQueryOptions` with `retry: false` and `staleTime: 300_000` is the correct query configuration (matches existing prefetch usage).

---

## Global constraints and quality gates

### Engineering constraints

- Keep new helpers pure (no React, no Ant Design, no I/O).
- Keep component changes minimal and localised.
- Fail fast on invalid inputs; do not silently swallow errors.
- Use British English in comments and documentation.
- All frontend-to-backend calls route through existing `callApi` (no new transport).

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate

When a section is delegated to sub-agents (`Testing Specialist`, `Implementation`, `Code Reviewer`, `Docs`):

1. List required documentation file paths under that phase before delegation.
2. Require the sub-agent handoff to include `Files read` with explicit file paths.
3. Verify every mandatory file is listed before accepting the handoff.
4. If any mandatory file is missing, return the work to the same sub-agent and block progression.

### Shared-helper planning gate

Three new helpers are planned in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18.16 with status `Not implemented`. During the documentation pass (Section 8), update their status to `Implemented`.

### Validation commands hierarchy

- Backend lint: `npm run lint:backend`
- Frontend lint: `npm run lint:frontend`
- Frontend unit tests: `npm run test:frontend -- <target>`
- Frontend test watch (development): `npm run test:frontend:watch -- <target>`

---

## Section 1 — `buildCellPreviewLookup` pure helper

### Objective

Create a pure function that transforms `AssignmentFull` into a
`Map<studentId, Map<taskId, CellPreviewData>>` keyed lookup for O(1) popover
data retrieval.

### Constraints

- Pure function — no React, Ant Design, or I/O imports.
- Accepts `AssignmentFull` (non-null; the caller guards against `null`).
- Returns `Map<string, Map<string, CellPreviewData>>`.
- `CellPreviewData` interface and `CellPreviewLookup` type alias
  (`ReadonlyMap<string, ReadonlyMap<string, CellPreviewData>>`) are exported
  from this module.
- Reasoning is extracted per `HEATMAP_METRIC_KEYS` (`completeness`, `accuracy`, `spag`) reading `item.assessments[key]?.reasoning ?? null`.
- If multiple items in a submission share the same `taskId`, the first encountered wins.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md` (multi-dimensional lookup design section)
- `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts`
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricDisplayMeta.ts`
- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`
- `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `SPEC.md` (multi-dimensional lookup design section)
- `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts`
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricDisplayMeta.ts`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §4 (extraction rules)

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Shared helper plan

1. Helper: `buildCellPreviewLookup`
   - Decision: `new` (recorded at §9.18.16 item 24)
   - Owning module/path: `src/frontend/src/features/classPage/buildCellPreviewLookup.ts`
   - Call-site rationale: called by `TaskHeatmapPage` via `useMemo`; consumed by `TaskHeatmapTable` cell renders
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18.16
   - Planned doc status: `Not implemented`

### Acceptance criteria

- Given a valid `AssignmentFull` with submissions, returns a Map keyed by `studentId` → `taskId` → `CellPreviewData`.
- Missing student returns `undefined` from outer Map.
- Missing task returns `undefined` from inner Map.
- `CellPreviewData.artifactType` matches `item.artifact.type`.
- `CellPreviewData.artifactContent` matches `item.artifact.content`.
- `CellPreviewData.reasoning.completeness` matches `item.assessments.completeness?.reasoning ?? null`.
- Same pattern for `accuracy` and `spag`.
- Multiple items with the same `taskId` in one submission: first-wins.
- Empty `submissions` array returns an empty Map.

### Required test cases (Red first)

1. Single submission, single task, TEXT artifact, all three assessments
   present → correct `CellPreviewData` with `artifactType: 'TEXT'` and
   `artifactContent` as the string.
   1a. Same structure with TABLE artifact → `artifactType: 'TABLE'`.
   1b. Same structure with IMAGE artifact → `artifactType: 'IMAGE'`.
   1c. Same structure with all three assessments populated →
   `reasoning.completeness`, `reasoning.accuracy`, `reasoning.spag`
   all match their respective `item.assessments[key].reasoning` (locks
   the "Same pattern for `accuracy` and `spag`" acceptance criterion
   explicitly).
2. Single submission, single task, only completeness assessed → `accuracy`/`spag` reasoning are `null`.
3. Multiple submissions for different students → correct student-level keys.
4. Submission with multiple items (different `taskId`s) → both tasks in inner Map.
5. Submission with duplicate `taskId` items → first encountered wins.
6. **Joined-fixture test**: realistic `AssignmentFull` fixture where `submission.studentId` and `item.taskId` match entries in a `ClassFull`-derived heatmap (validating the identifier-space alignment assumption per SPEC §"Assumptions").
7. Empty `submissions` array → empty Map.
8. Submission with `SPREADSHEET` artifact → `artifactType` is `'SPREADSHEET'`, `artifactContent` is the 2D array.
9. **Negative identifier-drift test**: realistic `AssignmentFull` fixture where
   `submission.items[].taskId` does **not** match any heatmap column `taskId`
   → `cellPreviewLookup.get(studentId)?.get(<any heatmap taskId>)` returns
   `undefined` (locks SPEC §"Assumptions — `taskId` alignment"; documents the
   graceful-empty failure mode when identifier space drifts).

### Section checks

- `npm run test:frontend -- buildCellPreviewLookup`
- `npm run lint:frontend`
- Planned helper entry in canonical doc present with `Not implemented`.

---

## Section 2 — `spreadsheetToMarkdownTable` pure helper

### Objective

Create a pure function that converts a spreadsheet 2D array
(`Array<Array<string | number | null>> | null`) to a GitHub-flavoured markdown
table string, for rendering via the existing `MarkdownRenderer`.

### Constraints

- Pure function — no React, Ant Design, or I/O imports.
- Accepts `Array<Array<string | number | null>>`.
- Returns a GitHub-flavoured markdown table string (pipe-delimited, header
  separator row).
- Empty array `[]` returns `''`.
- Null cells render as empty strings.
- The pipe delimiter (`|`) is escaped as `\|` inside cell values; no other
  escaping is applied.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md` (SPREADSHEET → markdown helper section)
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `SPEC.md` (SPREADSHEET → markdown helper section)
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §4

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Shared helper plan

1. Helper: `spreadsheetToMarkdownTable`
   - Decision: `new` (recorded at §9.18.16 item 26)
   - Owning module/path: `src/frontend/src/features/classPage/spreadsheetToMarkdownTable.ts`
   - Call-site rationale: called by `assembleTaskPreviewData` when artifact type is `SPREADSHEET`
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18.16
   - Planned doc status: `Not implemented`

### Acceptance criteria

- Empty array `[]` → `''`.
- Single header row with one data row → correct markdown table.
- Multiple data rows with mixed types (string, number, null) → null cells
  rendered as empty, numbers as strings.
- Cell content containing `|` → pipe is escaped as `\|`.

### Required test cases (Red first)

1. Empty array → `''`.
2. `[['A', 'B'], [1, 2]]` → markdown table with header row and one data row.
3. `[['Name', 'Score']]` → header-only markdown table (no data rows).
4. `[['Name', 'Score'], ['Alice', 95], ['Bob', null]]` → null cell rendered
   as empty.
5. Cell with pipe character → correctly escaped as `\|` in output.

### Section checks

- `npm run test:frontend -- spreadsheetToMarkdownTable`
- `npm run lint:frontend`

---

## Section 3 — `assembleTaskPreviewData` mapping helper

### Objective

Create a pure function that assembles a `TaskPreviewData` from a
`CellPreviewData` (or `null`), the analyser's `MetricResult`, the metric key,
and the task ID. This is the single point where wider backend types are
narrowed to the `TaskPreviewCard` contract.

### Constraints

- Pure function — no React, Ant Design, or I/O imports.
- Signature:
  ```ts
  function assembleTaskPreviewData(
    cellData: CellPreviewData | null,
    metricResult: MetricResult,
    metricKey: HeatmapMetricKey,
    taskId: string
  ): TaskPreviewData;
  ```
- Artifact type coercion per SPEC coercion table.
- Reasoning extraction: `cellData?.reasoning[metricKey] ?? ''`.
- `metricScore` and `metricState` pass through from `metricResult`.
- `metricKey` is passed through unchanged into `TaskPreviewData.metricKey`.
- `taskId` passed through from the `taskColumn.taskId` argument.
- SPREADSHEET → delegates to `spreadsheetToMarkdownTable`.
- `null` cellData → empty defaults (`artifactType: 'TEXT'`, `artifactContent: ''`, `reasoning: ''`).

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md` (Assembly mapping section)
- `src/frontend/src/features/classPage/TaskPreviewCard.tsx` (TaskPreviewData interface)
- `src/frontend/src/features/classPage/buildCellPreviewLookup.ts` (imports `CellPreviewData` type used in the `assembleTaskPreviewData` signature)
- `src/frontend/src/features/classPage/spreadsheetToMarkdownTable.ts` (called by `assembleTaskPreviewData` for SPREADSHEET → markdown conversion)
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricDisplayMeta.ts`
- `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `SPEC.md` (Assembly mapping section)
- `src/frontend/src/features/classPage/TaskPreviewCard.tsx`
- `src/frontend/src/features/classPage/buildCellPreviewLookup.ts` (imports `CellPreviewData` type)
- `src/frontend/src/features/classPage/spreadsheetToMarkdownTable.ts` (called for SPREADSHEET)
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §4

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Shared helper plan

1. Helper: `assembleTaskPreviewData`
   - Decision: `new` (recorded at §9.18.16 item 25)
   - Owning module/path: `src/frontend/src/features/classPage/assembleTaskPreviewData.ts`
   - Call-site rationale: single mapping point for all artifact type coercions
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18.16
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `TEXT` artifact → `artifactType: 'TEXT'`, `artifactContent` as string.
- `TABLE` artifact → `artifactType: 'TABLE'`, `artifactContent` as string.
- `IMAGE` artifact → `artifactType: 'IMAGE'`, `artifactContent` as string.
- `SPREADSHEET` artifact → `artifactType: 'TABLE'`, `artifactContent` from
  `spreadsheetToMarkdownTable`.
- `base` artifact → `artifactType: 'TEXT'`, `artifactContent: ''`.
- `null` cellData → `artifactType: 'TEXT'`, `artifactContent: ''`,
  `reasoning: ''`.
- `metricScore` and `metricState` equal `metricResult.value` and
  `metricResult.state`.
- `taskId` is forwarded unchanged from the caller-supplied `taskId`
  parameter for **both** the populated and the `null` `cellData` branch
  (the parameter is not derived from `cellData`; see SPEC §"Assembly mapping
  — `taskId` propagation"). The popover header `taskId` must therefore stay
  stable across loading / no-submission / populated states.
- Reasoning is empty string when assessment is absent for the metric key.

### Required test cases (Red first)

1. TEXT artifact, computed metric → correct `TaskPreviewData`.
2. TABLE artifact → correct `TaskPreviewData`.
3. IMAGE artifact → correct `TaskPreviewData`.
4. SPREADSHEET artifact → `artifactType: 'TABLE'`, content is markdown.
5. `base` artifact → `artifactType: 'TEXT'`, `artifactContent: ''`.
6. `null` cellData → empty defaults.
7. `notAttempted` metric → `metricState: 'notAttempted'`, `metricScore: 'N'`.
8. `error` metric → `metricState: 'error'`, `metricScore: 'E'`.
9. Assessment present for the metric key → returned `reasoning` matches
   `cellData.reasoning[metricKey]`.
10. Assessment missing for specific metric key → `reasoning: ''`.
11. `metricKey` is passed through unchanged into `TaskPreviewData.metricKey` for
    each of `completeness`, `accuracy`, and `spag`.
12. `taskId` pass-through — populated branch: `assembleTaskPreviewData(<TEXT cellData>, computedMetric, 'completeness', 'task-7').taskId === 'task-7'`.
13. `taskId` pass-through — null branch: `assembleTaskPreviewData(null, computedMetric, 'spag', 'task-9').taskId === 'task-9'` (locks the SPEC §"Assembly mapping — `taskId` propagation" contract so the popover header stays stable across loading / no-submission / populated states).

### Section checks

- `npm run test:frontend -- assembleTaskPreviewData`
- `npm run lint:frontend`

---

## Section 4 — Wire `TaskHeatmapPage` with assignment `useQuery`

### Objectives

1. Add `useQuery(getAssignmentQueryOptions(classFull.classId, assignmentId))`
   to `TaskHeatmapPage`.
2. Derive `cellPreviewLookup` via `useMemo`.
3. Derive `showAssignmentError` as `assignmentQuery.isError || assignmentQuery.data === null`.
4. **Add the three required props** (`cellPreviewLookup`, `isAssignmentLoading`,
   `showAssignmentError`) to `TaskHeatmapTable`'s prop type as a **type-only**
   change (the props are declared and accepted but **not yet consumed** in the
   cell `render`; consumption, skeleton, and error states land in Section 5).
   This keeps the repo TypeScript-green between sections — the page will pass
   the props (Objective 6) and the table must already accept them.
5. Update `TaskHeatmapTable.spec.tsx` so every existing render of
   `TaskHeatmapTable` passes placeholder values for the three new required
   props (`cellPreviewLookup: null`, `isAssignmentLoading: false`,
   `showAssignmentError: false`) so the existing table specs stay green
   without feature-level consumption. No new assertions are added in this
   section for the table's popover behaviour — those land in Section 5.
6. Pass `cellPreviewLookup`, `isAssignmentLoading`, and `showAssignmentError`
   into `TaskHeatmapTable` from `TaskHeatmapPage`.
7. Wrap the Refresh button to also call `assignmentQuery.refetch()`.
8. Add error-logging effects (separate `useRef` guards for error vs not-found).

### Test infrastructure requirements

**Required for `TaskHeatmapPage.spec.tsx`, `ClassPageHeatmapView.spec.tsx`,
and `ClassPage.spec.tsx`** (all three render real `TaskHeatmapPage` — the
first two directly inside antd `<App>`; `ClassPage.spec.tsx` reaches it
indirectly via `vi.importActual('./ClassPageContent')` in its heatmap-view
test — without any React Query context — verified on branch
`feat/PreviewCardWiring`):

- `TaskHeatmapPage.spec.tsx`: both existing tests render real
  `TaskHeatmapPage` inside antd `<App>` with no provider; once `useQuery`
  is added (before the early returns per the hook-placement rule below),
  both throw `No QueryClient set`.
- `ClassPageHeatmapView.spec.tsx`: the `Harness` (lines 205–228) renders
  real `ClassPageContent` → real `TaskHeatmapPage`; same breakage.
- `ClassPage.spec.tsx`: only the **heatmap-view test** (lines 259–317,
  "hides the Back to Classes nav card when the heatmap view is active")
  is affected. It overrides the `ClassPageContent` mock with the real
  component via `vi.importActual` (line 298–300) and clicks a
  `RecentAssignmentCard` → triggers `onOpenHeatmap` → real
  `TaskHeatmapPage`. The other `ClassPage.spec.tsx` tests render the
  mocked `ClassPageContent` (lines 62–64) and never reach
  `TaskHeatmapPage`, so they need no Query-Client wiring. `TaskHeatmapTable`
  is mocked in `ClassPage.spec.tsx` (lines 89–91), so the table-side
  placeholder props from Objective 5 are not consumed by this test —
  the only requirement here is the Query-Client wrapper + `getAssignment`
  mock so the real `TaskHeatmapPage`'s `useQuery` does not throw and does
  not fire a real `callApi`.

1. **`QueryClientProvider` wrapper.** Use the `createTestQueryClient` +
   `createTestWrapper` pattern already established in
   `useClassPageData.spec.ts` (lines 80–96), or use the shared
   `renderWithFrontendProviders` helper in
   `src/frontend/src/test/renderWithFrontendProviders.tsx` which already
   wraps with a per-test `QueryClientProvider`. The existing
   `ClassPageHeatmapView.spec.tsx` harness (lines 205–228) renders real
   `ClassPageContent` (which renders real `TaskHeatmapPage`); adding
   `useQuery` to `TaskHeatmapPage` will throw `No QueryClient set` there
   too if the harness is not wrapped in a `QueryClientProvider`.
2. **Mock the `getAssignment` queryFn.** The `queryFn` for
   `getAssignmentQueryOptions` is `() => getAssignment({ courseId,
assignmentId })` from
   `src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts`.
   Add to **all three** spec files (`TaskHeatmapPage.spec.tsx`,
   `ClassPageHeatmapView.spec.tsx`, and `ClassPage.spec.tsx`) a module-level
   mock:
   ```ts
   vi.mock('../../services/assignmentAssessment/assignmentAssessmentService', () => ({
     getAssignment: vi.fn(),
   }));
   ```
   The mock path inside each spec file follows that file's existing relative
   import depth (all three live under `src/frontend/src/features/classPage/`,
   so the path is the same). The mock is per-test-driven
   (`.mockResolvedValue`, `.mockResolvedValueOnce`, `.mockRejectedValueOnce`)
   for the `isPending` / `isError` / `data === null` branches. Do **not**
   mock `@tanstack/react-query` globally — the existing
   `useClassPageData.spec.ts` does so only because it tests the hook; the
   three page-level specs must use a real `QueryClient` so they exercise the
   real `useQuery` contract. `ClassPage.spec.tsx` only needs the mock active
   for the heatmap-view test (lines 259–317); the other `ClassPage.spec.tsx`
   tests render the mocked `ClassPageContent` and never reach
   `TaskHeatmapPage`, so the mock is inert for them but harmless to declare
   at module scope.
3. **Default-mock the queryFn to a non-null `AssignmentFull` fixture** in
   **all three** spec files to keep the existing (non-assignment-fetch
   related) assertions green without per-test fixture noise:
   - `ClassPageHeatmapView.spec.tsx` (lines 250–325) — the overview/heatmap
     assertions render real `TaskHeatmapPage` and would otherwise fire a
     real `callApi`. The "auto-navigate back" test (line 309) still works
     because that path tests `adaptMetricsToHeatmap`'s generic Error, not
     the assignment-query failure.
   - `TaskHeatmapPage.spec.tsx` — both error-handling tests (the
     `TaskTitlesUnavailableError` Alert test and the generic-error
     auto-navigate-back test) exercise the real `useQuery` path before the
     early returns take over, so the default mock prevents a real
     `callApi`/unhandled rejection there too. Per-test `.mockRejectedValueOnce`
     / `.mockResolvedValueOnce` overrides drive the dedicated
     `isPending` / `isError` / `data === null` assertions (Tests 2–5, 7–8).
   - `ClassPage.spec.tsx` — the heatmap-view test (lines 259–317) only needs
     the default mock so the real `TaskHeatmapPage` render does not fire a
     real `callApi` while the test asserts the Back- nav-card visibility.

### Constraints

- `isAssignmentLoading` = `assignmentQuery.isPending` (not `isFetching`).
- Error log: `logFrontendError('TaskHeatmapPage', error)` with dedicated
  `useRef` guard.
- Not-found log: `logFrontendEvent('warn', { context: 'TaskHeatmapPage', errorMessage: 'Assignment not found in AssignmentFull payload' })` with dedicated `useRef` guard.
- The existing `adaptMetricsToHeatmap` call and its error handling are unchanged.
- `assignmentQuery.refetch()` is called unconditionally in the Refresh
  handler; rely on React Query v5's deduplication behaviour when the query
  is already pending (do not add a feature-level guard around the
  `refetch` call — see SPEC §"Refresh behaviour"). The Red-phase test
  below locks this contract.
- **Hook-placement rule (hooks-call-order safety).** All new hooks —
  `useQuery` and the two assignment-query logging `useEffect`s with their
  `useRef` guards — must be placed **before** the existing
  `if (isGenericError) return null;` early return in `TaskHeatmapPage`.
  The component has two conditional early returns (`isGenericError` →
  `null`; `isTitleError` → `Alert`); placing new hooks after either would
  break React's hooks-call order on a later render that takes the early
  path ("Rendered fewer hooks than expected"). Do not introduce any new
  conditional early returns above the existing ones.
- The three required props added to `TaskHeatmapTable` (Objective 4) are
  **type-only in this section**: the cell `render` continues to call
  `getTaskPreviewData` (still imported from `taskPreviewFixtures`) until
  Section 5 replaces it. Do not remove the `getTaskPreviewData` import in
  this section.
- File current (`TaskHeatmapPage.tsx`): 212 lines. Projected after changes:
  ~280 lines (under 500-line threshold; no file separation needed).
- File current (`TaskHeatmapTable.tsx`): 352 lines. Projected after the
  type-only prop addition: ~358 lines. The consumption, skeleton, and
  error-state changes in Section 5 take it to ~420 lines (still under the
  500-line threshold). No file separation needed in either section.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md` (Component changes / TaskHeatmapPage section; §"Refresh behaviour")
- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapPage.spec.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapTable.tsx` (the three required prop types are added here in Objective 4)
- `src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx` (updated for placeholder props in Objective 5)
- `src/frontend/src/features/classPage/ClassPageHeatmapView.spec.tsx`
- `src/frontend/src/features/classPage/ClassPage.spec.tsx` (the heatmap-view test at lines 259–317 uses `vi.importActual('./ClassPageContent')` so a real `TaskHeatmapPage` mounts; needs the Query-Client wrapper + `getAssignment` mock per Test infrastructure requirements)
- `src/frontend/src/query/sharedQueries.ts`
- `src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts` (the queryFn mocked in Test infrastructure §2)
- `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` (`AssignmentFullSchema` + `StudentSubmissionSchema` + `BaseTaskArtifactSchema` discriminated-union shapes required to construct the schema-valid `AssignmentFull` default-mock fixture per Test infrastructure §3)
- `src/frontend/src/features/classPage/useClassPageData.spec.ts` (lines 80–96 — `createTestQueryClient` / `createTestWrapper` pattern to follow for the `QueryClientProvider` wrapper per Test infrastructure §1)
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapTable.tsx` (Objective 4 prop-type addition; do not consume in this section)
- `src/frontend/src/features/classPage/buildCellPreviewLookup.ts` (created in Section 1; exports the `CellPreviewLookup` type and `CellPreviewData` interface imported by the Objective 4 prop-type addition in `TaskHeatmapTable.tsx`)
- `src/frontend/src/features/classPage/ClassPage.spec.tsx` (the heatmap-view test renders real `TaskHeatmapPage` via real `ClassPageContent`; the Query-Client wrapper + `getAssignment` mock must be added there too — see Test infrastructure requirements)
- `src/frontend/src/query/sharedQueries.ts`
- `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` (the `AssignmentFull` shape the page now fetches; needed to distinguish `data === null` not-found from `isError` correctly in the new logging effects)
- `docs/developer/frontend/frontend-react-query-and-prefetch.md` §5 (view-entry prefetch)
- `docs/developer/frontend/frontend-logging-and-error-handling.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `docs/developer/frontend/frontend-logging-and-error-handling.md`
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`
  (Section 4 introduces the error-`Alert` UI wiring and the page-level
  `Card` wrapper at `TaskHeatmapPage.tsx:207` that hosts the popover table;
  per `src/frontend/AGENTS.md` §4 "**Mandatory spacing and padding read**"
  and §11, the spacing doc is a hard read before reviewing any UI element
  that affects layout spacing — required here for symmetry with Section 5
  which already lists it.)

### Acceptance criteria

- `useQuery` is called with `courseId = classFull.classId` and
  `assignmentId`.
- `cellPreviewLookup` is derived via `useMemo`, keyed on
  `assignmentQuery.data`.
- `showAssignmentError` is `true` when `assignmentQuery.isError` is `true`.
- `showAssignmentError` is `true` when `assignmentQuery.data === null`.
- `showAssignmentError` is `false` when `assignmentQuery.data` is non-null
  and not errored.
- `cellPreviewLookup`, `isAssignmentLoading`, and `showAssignmentError` are
  passed as props into `TaskHeatmapTable`.
- `TaskHeatmapTable`'s prop type declares the three new props as
  **required** (type-only; not yet consumed in the cell `render` —
  consumption lands in Section 5).
- `TaskHeatmapTable.spec.tsx` passes the three new required props on every
  existing render (`cellPreviewLookup: null`, `isAssignmentLoading: false`,
  `showAssignmentError: false`) so the existing table assertions stay green.
- `ClassPage.spec.tsx` heatmap-view test is wrapped in a
  `QueryClientProvider` with the `getAssignment` queryFn mocked so the
  real `TaskHeatmapPage` render path (reached via `vi.importActual`'d
  `ClassPageContent`) does not throw and does not fire a real `callApi`.
- `ClassPageHeatmapView.spec.tsx` (renders real `TaskHeatmapPage` via the
  `Harness` component at lines 205–228 inside antd `<App>`) is wrapped in
  a `QueryClientProvider` with the `getAssignment` queryFn mocked so the
  two heatmap-view-state tests (lines 249–275, 281–297) stay green — the
  real `TaskHeatmapPage`'s `useQuery` no longer throws `No QueryClient
set` and no real `callApi` fires.
- The `getTaskPreviewData` import remains in `TaskHeatmapTable.tsx` (it is
  removed in Section 5, not here).
- Refresh button calls both `refetch` (parent) and `assignmentQuery.refetch()`.
- Error logged once via `logFrontendError` with `useRef` guard.
- Not-found logged once via `logFrontendEvent('warn', ...)` with separate
  `useRef` guard.
- New hooks (`useQuery` + the two logging `useEffect`s and their `useRef`
  guards) are placed before the existing `if (isGenericError) return null;`
  early return (hooks-call-order safety).

### Required test cases (Red first)

1. `useQuery` receives correct `courseId` and `assignmentId`.
2. While `isPending`, `cellPreviewLookup` is `null` and `isAssignmentLoading`
   is `true`.
3. On success, `cellPreviewLookup` is a non-null Map.
4. `showAssignmentError` is `true` when `isError` (fetch failure).
5. `showAssignmentError` is `true` when `data` is `null` (not found).
6. Refresh button calls both parent `refetch` and `assignmentRefetch`.
7. Error effect logs once (not twice in StrictMode).
8. Not-found effect logs once as warn.
9. Refresh clicked while `assignmentQuery.isPending === true` does not throw
   and the mocked `getAssignment` queryFn is invoked at most once during
   the controlled pre-first-settle window — pressing Refresh multiple
   times before the initial fetch resolves does not fire additional
   `getAssignment` calls (locks SPEC §"Refresh behaviour"). This is a
   black-box observable: call `assignmentQuery.refetch()` twice in
   rapid succession while `isPending` has not yet transitioned to
   `false`, and assert the mock was called exactly once. (No assertion
   is made about background-refetch behaviour — after `data` is
   populated React Query cancels and re-issues `refetch()` per its
   documented semantics, which is out of scope for this test.)
10. `TaskHeatmapTable.spec.tsx` existing renders are updated to pass the
    three new required props (`cellPreviewLookup: null`,
    `isAssignmentLoading: false`, `showAssignmentError: false`); existing
    table assertions remain green (no new popover-state assertions are
    added in this section).
11. `ClassPage.spec.tsx` heatmap-view test (lines 259–317) is wrapped in a
    `QueryClientProvider` and the `getAssignment` queryFn is mocked (per the
    Test infrastructure requirements); the existing "hides the Back to
    Classes nav card when the heatmap view is active" assertion still
    passes (the click → `onOpenHeatmap` → real `TaskHeatmapPage` render no
    longer throws `No QueryClient set` and no real `callApi` fires).
12. `ClassPageHeatmapView.spec.tsx` is wrapped in a `QueryClientProvider`
    with the `getAssignment` queryFn mocked (per the Test infrastructure
    requirements); the two existing heatmap-view-state tests still pass
    (the Harness at lines 205–228 renders real `ClassPageContent` →
    real `TaskHeatmapPage`, whose new `useQuery` no longer throws
    `No QueryClient set` and no real `callApi` fires).

### Section checks

- `npm run test:frontend -- TaskHeatmapPage`
- `npm run test:frontend -- TaskHeatmapTable`
- `npm run test:frontend -- ClassPageHeatmapView`
- `npm run test:frontend -- ClassPage`
- `npm run lint:frontend`

---

## Section 5 — Wire `TaskHeatmapTable` with real data and new states

### Objectives

1. **Consume** the three required props (`cellPreviewLookup`,
   `isAssignmentLoading`, `showAssignmentError`) that were added to
   `TaskHeatmapTable`'s prop type in Section 4. (Do **not** re-declare the
   prop type — Section 4 owns the type-only addition; this section owns the
   in-component consumption and state branching.)
2. Replace `getTaskPreviewData(taskColumn.taskId, metric, m)` call with
   `cellPreviewLookup` + `assembleTaskPreviewData`.
3. Add `TaskPreviewSkeleton` as an **inline, non-exported, feature-local**
   component defined directly inside `TaskHeatmapTable.tsx` (see SPEC
   §"New: Task Preview Skeleton (inline in `TaskHeatmapTable`)" — single
   call-site, no reuse path; do not create a separate file and do not
   export). The skeleton hard-codes its shape with a comment cross-referencing
   `TaskPreviewCard`'s private `CARD_MAX_WIDTH = 400` and
   `CARD_BODY_MAX_HEIGHT = 480` constants (do not refactor those constants
   out of `TaskPreviewCard.tsx`).
4. Add compact error `Alert` for the `showAssignmentError` state.
5. Remove the import of `getTaskPreviewData` (currently from
   `taskPreviewFixtures`) from `TaskHeatmapTable`.

### Constraints

- The three required props (`cellPreviewLookup`, `isAssignmentLoading`,
  `showAssignmentError`) were already added to `TaskHeatmapTable`'s prop
  type in Section 4 (type-only). This section consumes them; do not modify
  the prop-type declaration.
- `TaskHeatmapTable.spec.tsx` already passes placeholder values for the
  three props from Section 4's update; this section replaces those
  placeholders with per-test fixtures that drive the skeleton / error /
  real-data / empty-lookup assertions.
- The popover trigger (hover/click on score) remains interactive in all states.
- Skeleton: Ant Design `Skeleton` with card-like shape, wrapped in
  `role="status"` and `aria-busy="true"`.
- Error Alert: `<Alert type="error" showIcon message="Couldn't load task details" />`.
- `cellPreviewLookup.get(record.studentId)?.get(taskColumn.taskId) ?? null`
  resolves the cell data for the popover.
- When the lookup returns `undefined`, `assembleTaskPreviewData(null, ...)`
  produces empty defaults.
- Existing column definitions, sorters, filters, and cell styling are
  unchanged.
- The new props (`cellPreviewLookup`, `isAssignmentLoading`, `showAssignmentError`)
  must be passed into `buildTaskMetricSubColumns` and added to the
  `columns` `useMemo` dependency array (`[taskColumns, tableFilters]` at
  `TaskHeatmapTable.tsx` line 329 — the `useMemo` itself begins at line 307) to prevent stale-closure bugs — the popover `render` closure
  inside `buildTaskMetricSubColumns` reads these values.
- File current: 358 lines (after Section 4's type-only prop addition).
  Projected after the consumption + skeleton + error-state changes: ~420
  lines (under the 500-line threshold; no file separation needed).

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md` (Component changes / TaskHeatmapTable section)
- `src/frontend/src/features/classPage/TaskHeatmapTable.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx`
- `src/frontend/src/features/classPage/buildCellPreviewLookup.ts` (exports `CellPreviewLookup` type and `CellPreviewData` interface consumed by `TaskHeatmapTable`'s new `cellPreviewLookup` prop)
- `src/frontend/src/features/classPage/assembleTaskPreviewData.ts` (called in the cell `render` to assemble `TaskPreviewData` from lookup + metric)
- `docs/developer/frontend/frontend-loading-and-width-standards.md` §3, §8
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/frontend/src/features/classPage/TaskHeatmapTable.tsx`
- `src/frontend/src/features/classPage/buildCellPreviewLookup.ts` (imports `CellPreviewLookup` type)
- `src/frontend/src/features/classPage/assembleTaskPreviewData.ts` (called in the cell `render` for the real-data popover content)
- `src/frontend/src/features/classPage/TaskPreviewCard.tsx` (note: skeleton references the private `CARD_MAX_WIDTH` and `CARD_BODY_MAX_HEIGHT` constants in this file via a comment cross-reference; do not refactor those constants out)
- `docs/developer/frontend/frontend-loading-and-width-standards.md` §3, §8
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`

### Shared helper plan

1. Helper: `TaskPreviewSkeleton` (the inline skeleton component used in the
   `isAssignmentLoading` popover state)
   - Decision: `keep local` — single call-site in `TaskHeatmapTable.tsx`; no
     reuse path either now or under any in-scope follow-up. Inline,
     non-exported, feature-local. Do not add to the canonical shared-helpers
     registry; do not create a separate file or export. Rationale: SPEC §"New:
     Task Preview Skeleton (inline in `TaskHeatmapTable`)" opts for KISS over
     premature abstraction. The Code Reviewer must verify that the
     implementation does **not** introduce a separate `TaskPreviewSkeleton.tsx`
     file or export a `TaskPreviewSkeleton` symbol — that would be a
     speculative abstraction find.

### Acceptance criteria

- `isAssignmentLoading === true` → popover renders skeleton, not real card.
- `showAssignmentError === true` → popover renders error `Alert`, not real
  card.
- `cellPreviewLookup` non-null and lookup returns data → popover renders
  `TaskPreviewCard` with real artifact and reasoning.
- Lookup returns `undefined` → popover renders `TaskPreviewCard` with empty
  content ("No submission available" / "No reasoning available").
- `getTaskPreviewData` import is removed.
- Existing table behaviours (sorting, filtering, pagination, cell styling)
  are preserved.

### Required test cases (Red first)

1. Skeleton renders in popover when `isAssignmentLoading` is `true`.
2. Error `Alert` renders in popover when `showAssignmentError` is `true`.
3. Real `TaskPreviewCard` renders when lookup returns data.
4. Empty artifact/reasoning when `cellPreviewLookup.get(studentId)?.get(taskId)`
   returns `undefined`.
5. Metric score cell display is unchanged across all states.

### Section checks

- `npm run test:frontend -- TaskHeatmapTable`
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

- `TaskHeatmapTable`: document the three popover states (skeleton / error /
  real) and the lookup path in a `@remarks` block on the `render` callback
  or at the component level, so future maintainers understand the state
  branching without tracing the props.

---

## Section 5.5 — Update E2E `task-preview-card.spec.ts` for real-data popover

### Objective

The E2E spec `src/frontend/e2e-tests/task-preview-card.spec.ts` currently
asserts popover content sourced from the fixture adapter deleted in
Section 6. Once Section 5 wires the popover to a real `getAssignment`
query, the runtime-mock plumbing must intercept `'getAssignment'` and
seed a schema-valid `AssignmentFull` payload, or the four existing
popover tests (IMAGE / TEXT / TABLE hover, pinned-popover click) fail.
This section lands **before** Section 6's fixture deletion so the E2E
suite stays green when the fixture adapter is removed.

### Objectives (detailed)

1. Add `'getAssignment'` to the `allMethods` array in
   `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts` (around lines
   476–490) so `installRuntimeMock` intercepts the new `useQuery`'s
   `queryFn` (`() => getAssignment({ courseId, assignmentId })`) routed
   through `callApi`.
2. Add an optional `getAssignment?: ReadonlyArray<ResponseItem>` field to
   the `RuntimeScenario` type in the same file (around lines 50–63) so
   scenario factories can seed `getAssignment` queues.
3. Extend `createHeatmapScenario` in
   `src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts` to
   seed a schema-valid `AssignmentFull` `getAssignment` payload:
   - **The `getAssignment` payload is a NEW construction**, NOT a
     reuse/extension of `buildItem`. The existing `buildItem` (lines
     204–219) constructs objects embedded inside
     `buildClassFullDocument`'s `submissions[]` (line 183) — those are
     validated by the partial `StudentSubmissionPartialSchema`
     (`classDetailService.zod.ts` lines 63–88) where `artifact.type` is
     `z.string()` and most other fields are optional/nullable. The new
     `getAssignment` payload's `submissions[].items[].artifact` and
     `assessments[key]` must independently satisfy the **strict**
     `BaseTaskArtifactSchema` + `AssessmentSchema` in
     `assignmentAssessment.zod.ts` (lines 21–24, 47–60). The Playwright
     agent MUST build the `getAssignment` submissions fresh (e.g. via a
     new local `buildAssignmentFullDocument` helper in
     `task-heatmap-end-to-end-helpers.ts`, or as an inline literal inside
     `createHeatmapScenario`) — do not extend or repurpose `buildItem`,
     which serves the unrelated `ClassFull` partial path.
   - `submissions[].studentId === '100000000005'` (Student Two — the
     student targeted by all four popover tests).
   - `submissions[].items[].taskId` matches the existing
     `'task_001'` / `'task_002'` / `'task_003'` heatmap columns
     (`HEATMAP_TASK_IDS`).
   - **Each `StudentSubmission` must satisfy `StudentSubmissionSchema`**
     (`assignmentAssessment.zod.ts` lines 102–110): requires `studentId,
studentName, assignmentId, documentId (string | null), items,
createdAt, updatedAt`. (The existing `buildItem` does NOT produce
     a full `StudentSubmission`; the new `getAssignment` submissions
     must.)
   - **Each `StudentSubmissionItem` must satisfy
     `StudentSubmissionItemSchema`** (lines 84–96): requires `id: string`,
     `taskId: string`, `artifact: BaseTaskArtifactSchema`,
     `assessments: Record<string, AssessmentSchema>`, `feedback:
Record<string, { type, createdAt }>`. The `id` and `feedback`
     fields are easy to forget — the seeded items MUST carry both (a
     deterministic `id` like `ssi-${studentId}-${taskId}` and an empty
     `feedback: {}` record both satisfy the schema).
   - **Artifact type per task, not per metric.** Under real-data
     wiring each `StudentSubmissionItem` (one per `taskId`) produces a
     single `CellPreviewData` with a single `artifactType`, used for
     all three metric sub-columns of that task. The existing E2E suite
     relied on the fixture adapter's `metricKey → {image, text, table}`
     switch to render different artifact types per metric on the SAME
     `task_001` cell; under real-data wiring, that mapping is
     structurally impossible. Distribute the three artifact types
     across the three tasks so each existing E2E assertion can be
     satisfied by hovering the correct `taskId`:
     - `task_001` → `IMAGE` artifact (existing IMAGE / completeness
       hover test, line 107 — score 5, see `HEATMAP_SUBMISSION_SCORES['100000000005'].task_001.completeness`).
       The IMAGE `content` MUST be a **non-empty, renderable** image
       source string (data URI or URL) so `ImageRenderer` produces an
       `<img>` element and the `popover.locator('img')).toHaveCount(1)`
       assertion holds.
     - `task_002` → `TEXT` artifact (rewritten TEXT / accuracy hover
       test targets `task_002` — score 4,
       `HEATMAP_SUBMISSION_SCORES['100000000005'].task_002.accuracy`).
       The TEXT `content` SHOULD be non-empty deterministic markdown so
       the rewritten popover-content assertion (replacing the deleted
       `/preview cards work properly/i` text) has a stable target.
     - `task_003` → `TABLE` artifact (rewritten TABLE / spag hover
       test targets `task_003` — score 5,
       `HEATMAP_SUBMISSION_SCORES['100000000005'].task_003.spag`).
       The TABLE `content` MUST be a non-empty markdown string so
       `MarkdownRenderer` produces a `<table>` DOM element and the
       `popover.locator('table')).toHaveCount(1)` assertion holds.
   - Each `StudentSubmissionItem.artifact` MUST be a complete
     `BaseTaskArtifactSchema` instance — the full required-field set
     is enumerated in §"Constraints" below (the `BaseTaskArtifactFields`
     extension) and in `assignmentAssessment.zod.ts` lines 26–34, 47–60.
   - Each item's `assessments[key]` carries `score` (number) and
     `reasoning` (string) per `AssessmentSchema`
     (`assignmentAssessment.zod.ts` lines 21–24) so the popover's
     Reasoning section shows real content. Use distinct, deterministic
     `reasoning` strings per (task, metric) pair so the popover-content
     assertions can target non-fixture, real-data text.
   - **`assignmentDefinition` field.** The top-level `AssignmentFull`
     payload must carry a non-null `assignmentDefinition` matching
     `AssignmentDefinitionSchema` (lines 116–134) — a complex nested
     object with `primaryTitle`, `primaryTopic`, `yearGroupKey`,
     `yearGroupLabel`, `alternateTitles`, `alternateTopics`,
     `documentType`, `referenceDocumentId`, `templateDocumentId`,
     `referenceLastModified`, `templateLastModified`,
     `assignmentWeighting`, `definitionKey`, `tasks: Record<string,
TaskDefinitionSchema>`, `createdAt`, `updatedAt`. The Playwright
     agent may seed a minimal-but-valid `assignmentDefinition` (the
     popover tests do NOT assert on the assignment-definition data) so
     long as the schema passes; the existing
     `buildAssignmentDefinitionPartial` (lines 263–287) is a useful
     shape template but produces the **partial** shape (no
     `referenceLastModified` / `templateLastModified` / `tasks` as
     `Record<string, TaskDefinitionSchema>`), so the agent must
     construct the full `AssignmentDefinitionSchema` independently.
   - Seed **two** identical `getAssignment` success entries
     (`{ kind: 'success', data: ... }, { kind: 'success', data: ... }`)
     mirroring the existing `getABClass` two-entry pattern so React 19
     StrictMode double-effect does not exhaust the queue.
4. Update `src/frontend/e2e-tests/task-preview-card.spec.ts`:
   - **IMAGE / completeness test (lines 91–112):** keep the hover
     target `'Student Two, task_001, Completeness: 5'` unchanged
     (already matches the IMAGE artifact seeded at `task_001`). Keep
     the `popover.locator('img')).toHaveCount(1)` assertion at line 107.
   - **TEXT / accuracy test (lines 114–137):** change the hover target
     from `'Student Two, task_001, Accuracy: 3'` to
     `'Student Two, task_002, Accuracy: 4'` so the test exercises
     `task_002` (the TEXT-seeded task). Replace the line-132 assertion
     `/preview cards work properly/i` (sourced from the deleted
     `fixtures/textTask.json`) with an assertion against the
     deterministic `reasoning` string the seeded `AssignmentFull`
     provides at `task_002.accuracy.reasoning`.
   - **TABLE / spag test (lines 139–160):** change the hover target
     from `'Student Two, task_001, SPaG: 4'` to
     `'Student Two, task_003, SPaG: 5'` so the test exercises
     `task_003` (the TABLE-seeded task). Keep the
     `popover.locator('table')).toHaveCount(1)` assertion at line 155
     (the markdown table rendered via `MarkdownRenderer` produces a
     `<table>` element).
   - **Pinned-popover click test (lines 162–189):** keep the click
     target `'Student Two, task_001, Completeness: 5'` unchanged
     (`task_001` IMAGE, same as the existing test). Keep
     `assertPopoverStructure('Completeness')` unchanged.
   - Keep `assertPopoverStructure` unchanged — it is structural
     (`[aria-label^="${metricLabel} score:"]`, Reasoning / Student
     Response labels) and unaffected by the wiring change.
   - Keep all four existing tests; do not add new E2E test files.

### Constraints

- Do not modify the production code touched by Sections 1–5.
- The mock-shape requirements follow SPEC §"E2E plumbing updates" and
  §"Testing expectations → E2E tests (Playwright)" — those sections are
  the source of truth.
- StrictMode two-entry pattern is mandatory for `getAssignment` (same
  rationale as `getABClass` at `task-heatmap-end-to-end-helpers.ts` lines
  307–315).
- The seeded `AssignmentFull` must satisfy `AssignmentFullSchema`
  (`assignmentAssessment.zod.ts` lines 155–170), which is `.strict()` at
  the top level — it requires `courseId, assignmentId, assignmentName,
dueDate, updatedAt, createdAt, documentType, referenceDocumentId,
templateDocumentId, tasks, submissions, assignmentDefinition`.
  `callApi` validates the response via `AssignmentFullResponseSchema`
  (`.nullable()`), so a schema-invalid fixture returns `null` and the
  popover shows the error `Alert` instead of seeded content.
- Each `StudentSubmissionItem.artifact` must satisfy
  `BaseTaskArtifactSchema` — the discriminated union extends
  `BaseTaskArtifactFields` (`assignmentAssessment.zod.ts` lines 26–34),
  which requires **all** of `taskId: string`, `role: string`,
  `pageId: string`, `documentId: string`, `uid: string`,
  `contentHash: string | null`, `metadata: Record<string, unknown>`,
  plus the discriminant `type` and a type-matching `content` field:
  - `'TEXT' | 'TABLE' | 'IMAGE'` → `content: string | null` (IMAGE
    content MUST be non-empty + renderable per Objective 3 N1 note)
  - `'SPREADSHEET'` →
    `content: Array<Array<string | number | null>> | null`
  - `'base'` → `content: unknown`
    **The existing `buildItem` (`task-heatmap-end-to-end-helpers.ts`
    lines 204–219) is NOT to be extended** — it builds objects inside
    `buildClassFullDocument`'s `submissions[]` (validated by the partial
    `StudentSubmissionPartialSchema` in `classDetailService.zod.ts`
    lines 63–88, where `artifact.type` is `z.string()` and most fields
    are optional/nullable). The new `getAssignment` payload's submissions
    must be constructed fresh (e.g. new `buildAssignmentFullDocument`
    helper or inline literal inside `createHeatmapScenario`) and their
    items must independently satisfy the strict `BaseTaskArtifactSchema`
    shape above (the existing `type: 'page'` value from `buildItem` is
    invalid under the strict schema).
- Each `StudentSubmissionItem.assessments[key]` must satisfy
  `AssessmentSchema` (`assignmentAssessment.zod.ts` lines 21–24) —
  requires **both** `score: number` AND `reasoning: string`. The
  existing `buildItem` (used only for the `ClassFull` partial path)
  supplies only `score`; the new `getAssignment` submissions built per
  the bullet above MUST add a non-empty `reasoning` for each metric on
  each task so the popover's Reasoning section renders real seeded
  content. The SPEC's "E2E plumbing updates" section is updated to
  mirror this requirement so SPEC and ACTION_PLAN stay aligned on the
  `assessment.reasoning` field.

- The four existing E2E tests must continue to pass without TIMEOUT or
  unhandled-rejection errors. The E2E suite runs in the repo regression
  config (`frontend-e2e-check` running `npm run test:frontend:e2e` —
  see `.ts-regression-checker/regression.config.json`), so silent E2E
  breakage will surface during the Regression gate.
- File current (`endToEndRuntimeMocks.ts`): ~735 lines. Projected after
  the `getAssignment` `allMethods` + `RuntimeScenario` additions: ~745
  lines. This file is **already over** the 500-line LOC threshold before
  this work — pre-existing, not introduced by this cycle. The change
  here is two small additions (a string literal in a const array, an
  optional field in a type), not behavioural logic. No file separation
  is planned in this cycle: the file is a single co-located runtime-mock
  registry and splitting it would fragment the `installRuntimeMock`
  entrypoint. The Code Reviewer must verify projected LOC and flag if
  the additions push the file meaningfully further over the threshold.
- File current (`task-heatmap-end-to-end-helpers.ts`): 357 lines.
  Projected after `AssignmentFull` seeding: ~420 lines (under 500-line
  threshold; no file separation needed).
- File current (`task-preview-card.spec.ts`): 190 lines. Projected after
  the assertion + hover-target updates: ~200 lines.

### Delegation mandatory reads

Playwright mandatory docs (E2E test work delegates to `Playwright`, per
`AGENTS.md` §6 / §9):

- `SPEC.md` (§"E2E plumbing updates"; §"Testing expectations → E2E
  tests (Playwright)"; §"Agreed product decisions" item 4 for the
  `taskId` behavioural change)
- `src/frontend/e2e-tests/task-preview-card.spec.ts` (the four existing
  tests being adapted; line 132 fixture-derived assertion)
- `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts` (the
  `allMethods` array and `RuntimeScenario` / `ResponseItem` types)
- `src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts`
  (`createHeatmapScenario`, `HEATMAP_TASK_IDS`, `HEATMAP_STUDENTS`,
  `buildClassFullDocument`'s `buildItem` artifact type)
- `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts`
  (`AssignmentFullSchema`, `StudentSubmissionSchema`,
  `StudentSubmissionItemSchema`, `BaseTaskArtifactSchema`,
  `AssessmentSchema` — required to construct the schema-valid
  `AssignmentFull` default-mock fixture)
- `docs/developer/frontend/frontend-playwright-e2e.md` (runtime mocks,
  StrictMode rule)
- `ACTION_PLAN.md` (this section)

Implementation mandatory docs (production-source-side runtime-mock
helpers are production code from a build perspective; if the Playwright
agent does not own the helper-file edits, the Implementation agent owns
them):

- `SPEC.md` (§"E2E plumbing updates")
- `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`
- `src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts`
- `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts`
- `docs/developer/frontend/frontend-playwright-e2e.md`
- `ACTION_PLAN.md` (this section)

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-playwright-e2e.md`
- `docs/developer/frontend/frontend-testing.md`
- `ACTION_PLAN.md` (this section)

### Shared helper plan

None — this section touches test infrastructure only; no production
shared helper is introduced, extended, or extracted. The runtime-mock
helpers under `src/frontend/e2e-tests/shared/` and
`src/frontend/e2e-tests/helpers/` are not in the `frontend-shared-helpers-and-abstraction-standards.md`
registry (that registry governs shared production helpers, not test
helpers).

### Acceptance criteria

- `installRuntimeMock` intercepts `'getAssignment'` (visible as the
  `allMethods` array containing the string literal `'getAssignment'`).
- `RuntimeScenario` declares an optional
  `getAssignment?: ReadonlyArray<ResponseItem>` field.
- `createHeatmapScenario()` returns a scenario whose `getAssignment`
  entry is an array of **two** identical success responses carrying a
  schema-valid `AssignmentFull` payload (one entry per StrictMode
  double-effect).
- The seeded `AssignmentFull`'s `submissions[].studentId` includes
  `'100000000005'` (Student Two) and that submission's `items` carry
  all three of `'task_001'`, `'task_002'`, `'task_003'` with
  `assessment` `score` + `reasoning` per metric and a
  `BaseTaskArtifactSchema`-valid `artifact.type`.
- `task-preview-card.spec.ts` line 132 no longer references the
  `/preview cards work properly/i` fixture-derived text.
- The four existing `Task Preview Card popover` E2E tests
  (image-completeness-hover, text-accuracy-hover, table-spag-hover,
  completeness-pinned) all pass against the real-data wiring.
- No new E2E test files are created.

### Required test cases / checks (Red first)

E2E tests are the executable verification for this section — there is no
Vitest unit-test layer over the runtime mocks. The Playwright agent
delegation produces the four passing E2E tests below.

1. **Red (before helper-file edits):** running
   `npm run test:frontend:e2e -- task-preview-card` fails because the
   popover either hangs on the unmocked `getAssignment` call (timeout)
   or renders the error `Alert`. Document the failure mode (timeout
   vs error-Alert) in the Playwright agent's `Files read` evidence.
2. **Green (after helper-file + assertion edits):** the same four
   existing tests pass:
   - `shows IMAGE preview card when hovering a completeness cell`
   - `shows TEXT preview card when hovering an accuracy cell`
   - `shows TABLE preview card when hovering a spag cell`
   - `pins the popover when clicking a cell and keeps it visible after mouse leave`
3. **Schema-validity assertion (added to the E2E scenario helper spec
   if one exists, or implicitly verified by the four passing E2E
   tests):** the seeded `AssignmentFull` `getAssignment` payload parses
   cleanly through `AssignmentFullResponseSchema` (i.e. the popover
   shows real content rather than the `"Couldn't load task details"`
   error Alert — that visible-content behaviour is the schema-validity
   proof in the E2E layer).
4. **StrictMode two-entry guard:** the second call to `getAssignment`
   (React 19 StrictMode double-effect) does NOT exhaust the queue —
   the queue has two entries. Verified implicitly by the four passing
   tests running to completion without a `Network error` / queue-empty
   failure.

### Section checks

- `npm run test:frontend:e2e -- task-preview-card` (all four popover
  tests green).
- Mandatory-read evidence gate passed for the Playwright + Code Reviewer
  delegated handoffs.
- No new shared-helper registry entries are added (this section touches
  test infrastructure only — the shared-helper planning gate is N/A).

### Optional `@remarks` JSDoc follow-through

- `task-heatmap-end-to-end-helpers.ts`'s `createHeatmapScenario`: add
  a `@remarks` note recording why `getAssignment` is now seeded with
  two entries (StrictMode double-effect) and that the inner items'
  `artifact.type` is one of the `BaseTaskArtifactSchema` union members.
  Future maintainers editing the scenario for unrelated reasons might
  otherwise revert `artifact.type` to `'page'` and silently break the
  popover.
- `endToEndRuntimeMocks.ts`'s `RuntimeScenario` type: when adding the
  `getAssignment?` field, add a one-line `@remarks` cross-reference to
  the `getABClass` two-entry pattern.

---

## Section 6 — Delete fixtures and stale code

### Objectives

1. Delete five files:
   - `src/frontend/src/features/classPage/taskPreviewFixtures.ts`
   - `src/frontend/src/features/classPage/taskPreviewFixtures.spec.ts`
   - `src/frontend/src/features/classPage/fixtures/imageTask.json`
   - `src/frontend/src/features/classPage/fixtures/textTask.json`
   - `src/frontend/src/features/classPage/fixtures/table_task.json`
2. Remove the stale `@remarks` block ("Known v1 demo artefact") from
   `TaskPreviewCard.tsx` lines 23–28.
3. Verify no remaining imports of `getTaskPreviewData` or `taskPreviewFixtures`
   anywhere in `src/frontend/src/`.

### Constraints

- Do not modify any other files.
- The `fixtures/` directory may be removed if empty after file deletion.
- Section 5.5 must already have landed (the E2E `task-preview-card.spec.ts`
  adaptation is what keeps the popover tests green once the fixture
  adapter is removed). Section 6 deletes the fixture adapter that Sections
  5 and 5.5 have replaced — without Section 5.5 the E2E suite would fail
  as soon as the fixture adapter import is removed.

### Delegation mandatory reads

Implementation mandatory docs:

- `SPEC.md` (Deleted files section)
- `src/frontend/src/features/classPage/TaskPreviewCard.tsx`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`

### Acceptance criteria

- The five listed files no longer exist on disk.
- A content search across `src/frontend/src/` finds no remaining occurrence
  of the literal `taskPreviewFixtures`.
- A content search across `src/frontend/src/` finds no remaining occurrence
  of the literal `getTaskPreviewData`.
- The `@remarks` "Known v1 demo artefact" paragraph is removed from
  `TaskPreviewCard.tsx`.
- `npm run lint:frontend` passes.
- All existing classPage specs pass.

### Section checks

- Verify via the project's content-search tool of choice (the agent's own
  Grep tool, ripgrep, or equivalent) that the literal strings
  `taskPreviewFixtures` and `getTaskPreviewData` no longer occur anywhere
  in `src/frontend/src/`.
- `npm run test:frontend -- classPage`
- `npm run lint:frontend`

---

## Regression and contract hardening

### Objective

Verify that all existing tests remain green and no regressions are introduced
by the wiring changes.

### Constraints

- Run focused test suites first, then broader validation.

### Acceptance criteria

- All classPage spec files pass.
- `useClassPageData.spec.ts` passes (no changes to that hook).
- `TaskHeatmapTable.spec.tsx` passes (updated for new props).
- `TaskHeatmapPage.spec.tsx` passes (updated for new useQuery).
- `ClassPageHeatmapView.spec.tsx` passes.
- `ClassPage.spec.tsx` passes (heatmap-view test wrapped in
  `QueryClientProvider` with `getAssignment` queryFn mocked — see Section 4).
- `TaskPreviewCard.spec.tsx` passes.
- `task-preview-card.spec.ts` E2E passes (popover tests adapted to real-data
  wiring — see Section 5.5).
- Frontend lint passes.
- No new TypeScript errors.

### Required test cases / checks

1. `npm run test:frontend -- classPage` (all classPage specs).
2. `npm run test:frontend -- buildCellPreviewLookup`
3. `npm run test:frontend -- spreadsheetToMarkdownTable`
4. `npm run test:frontend -- assembleTaskPreviewData`
5. `npm run test:frontend:e2e -- task-preview-card` (the four E2E popover
   tests adapted in Section 5.5; matches the repo regression config's
   `frontend-e2e-check` step at `.ts-regression-checker/regression.config.json`).
6. `npm run lint:frontend`

### Section checks

- Run the commands above and ensure all are green.
- Confirm `task-preview-card.spec.ts` no longer references the deleted
  `/preview cards work properly/i` fixture text (Section 5.5).

---

## Documentation and rollout notes

### Objective

Update canonical documentation to reflect the implemented helpers and
address stale references.

### Constraints

- Only modify documents relevant to the touched areas.
- The `TASK_PREVIEW_CARD_LAYOUT.md` doc does not exist and is **not created**
  in this cycle. Seven files across `src/frontend/` carry stale `@see` /
  `(see …)` references to it and must all be cleaned up together to leave the
  repo self-consistent (per SPEC §"Documentation and rollout notes"). Of the
  seven, only `ImageRenderer.tsx` and `e2e-tests/task-preview-card.spec.ts`
  live outside `features/classPage/`; both are explicitly included here
  because their `@see` / `(see …)` references point at the popover-rendering
  section of the (non-existent) layout doc and would otherwise be left
  dangling, leaving the repo in an inconsistent state.

### Docs delegation mandatory reads

Docs mandatory docs:

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18.16
- `src/frontend/src/features/classPage/buildCellPreviewLookup.ts`
- `src/frontend/src/features/classPage/spreadsheetToMarkdownTable.ts`
- `src/frontend/src/features/classPage/assembleTaskPreviewData.ts`
- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapTable.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx` (dangling `@see` on lines 9–12)
- `src/frontend/src/features/classPage/TaskPreviewCard.tsx` (dangling `see` on lines 63, 71)
- `src/frontend/src/features/classPage/ClassPageHeatmapView.spec.tsx` (dangling `@see` on lines 15–17)
- `src/frontend/src/components/ImageRenderer/ImageRenderer.tsx` (dangling `@see` on line 9)
- `src/frontend/e2e-tests/task-preview-card.spec.ts` (dangling `@see` on line 15)
- `ACTION_PLAN.md` (this document)

### Acceptance criteria

1. Three planned helper entries in
   `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   §9.18.16 updated from `Not implemented` to `Implemented` with short
   implementation notes.
2. Dangling `@see TASK_PREVIEW_CARD_LAYOUT.md` references — and parenthetical
   references of the form `(see \`TASK_PREVIEW_CARD_LAYOUT.md\` §n)` — are
   removed from **all seven** files identified in the SPEC §"Documentation and
   rollout notes" enumeration:
   - `src/frontend/src/features/classPage/TaskHeatmapPage.tsx` (lines 9–11)
   - `src/frontend/src/features/classPage/TaskHeatmapTable.tsx` (lines 15–17)
   - `src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx` (lines 9–12)
   - `src/frontend/src/features/classPage/TaskPreviewCard.tsx` (lines 63, 71; remove only the `(see … §2)` parentheticals, leaving surrounding text intact because the dimensions they describe still apply)
   - `src/frontend/src/features/classPage/ClassPageHeatmapView.spec.tsx` (lines 15–17)
   - `src/frontend/src/components/ImageRenderer/ImageRenderer.tsx` (line 9; remove only the `@see` or `(see …)` line — in-scope here per the Constraints note above, even though the file is outside `features/classPage/`)
   - `src/frontend/e2e-tests/task-preview-card.spec.ts` (line 15; remove only the `@see` line, leaving the remaining `@see` references to `ACTION_PLAN.md`, `SPEC.md`, and `docs/developer/frontend/frontend-playwright-e2e.md` intact)
3. Verify with a repository-wide search that no remaining `TASK_PREVIEW_CARD_LAYOUT`
   string literal exists in `src/frontend/` (including `src/frontend/e2e-tests/`).
4. Any other stale `@see` or `@link` references to deleted
   `taskPreviewFixtures` are removed (none currently exist in `@see` /
   `@link` tags in the repo — this is a defensive check only).

### Required checks

1. Verify §9.18.16 entries show `Implemented`.
2. Verify with a content search across `src/frontend/` — i.e. both
   `src/frontend/src/` **and** `src/frontend/e2e-tests/` — that the literal
   string `TASK_PREVIEW_CARD_LAYOUT` does not occur in any source or spec
   file (per acceptance criterion 3 above). The `e2e-tests/` subtree is
   outside `src/frontend/src/` but contains `task-preview-card.spec.ts`,
   which is one of the seven files enumerated for cleanup.
3. Verify `taskPreviewFixtures` references are absent from all `@see`/`@link`
   tags.
4. `npm run lint:frontend` passes.

### Optional `@remarks` JSDoc review

- Confirm the stale `@remarks` block in `TaskPreviewCard.tsx` (Section 6) was
  removed.
- Confirm the new `@remarks` on `TaskHeatmapTable`'s popover state branching
  (Section 5) is present.
- Confirm `buildCellPreviewLookup`, `assembleTaskPreviewData`, and
  `spreadsheetToMarkdownTable` have adequate JSDoc describing their
  contracts.

---

## Suggested implementation order

1. Section 1 — `buildCellPreviewLookup` (pure helper, no dependencies)
2. Section 2 — `spreadsheetToMarkdownTable` (pure helper, no dependencies)
3. Section 3 — `assembleTaskPreviewData` (depends on Sections 1 and 2 for
   types and the spreadsheet converter)
4. Section 4 — Wire `TaskHeatmapPage` (depends on Section 1 for
   `buildCellPreviewLookup`)
5. Section 5 — Wire `TaskHeatmapTable` (depends on Sections 1–4 for all
   contracts and data flow)
6. Section 5.5 — Update E2E `task-preview-card.spec.ts` for real-data
   popover (depends on Section 5 — the popover must be wired through the
   real `getAssignment` query before the runtime mocks can be tested; lands
   **before** Section 6 so the E2E suite stays green once the fixture
   adapter is removed — delegates to `Playwright` per `AGENTS.md` §6 / §9)
7. Section 6 — Delete fixtures (depends on Sections 5 and 5.5 for import
   removal and E2E mock plumbing; without Section 5.5 the E2E suite fails
   the moment the fixture adapter import is removed)
8. Regression and contract hardening
9. Documentation and rollout

---

## Progress log & baseline

### Baseline (established at branch start — `feat/preview-card-real-data-wiring`)

- **Baseline session:** `feat-preview-card-real-data-wiring` (regression-checker,
  mode `baseline`, created 2026-07-19).
- **Overall baseline status:** FAILING — **3 pre-existing failures**, all
  accepted as technical debt and **unrelated** to the preview-card feature:

  1. `backend-lint-check` — 14 `max-lines` warnings in legacy backend JS files
     (e.g. `ConfigurationManagerClass.js`, `SlidesParser.js`, `DriveManager.js`).
     Warnings only; not touched by this plan's scope.
  2. `frontend-lint-check` — 1 `no-magic-numbers` warning in
     `src/frontend/src/services/apiService.spec.ts:304`. Pre-existing; outside
     this plan's scope.
  3. `frontend-e2e-check` — 2 failed E2E tests at baseline:
     - `progress count updates as queued create calls complete`
     - `supports keyboard-only edits and focuses the first invalid field when API key is required`
       Neither is in `task-preview-card.spec.ts`; both are pre-existing and out of
       this plan's scope.

- **E2E flakiness observation (recorded after Sections 1–3 compare runs):** the
  `frontend-e2e-check` failures churn between runs across THREE unrelated specs —
  `classes-crud-bulk-progress.spec.ts` (`progress count updates...`,
  `cancelling a multi-row create...`) and `settings-backend.spec.ts`
  (`supports keyboard-only edits...`). These tests are NOT in
  `task-preview-card.spec.ts` and have NO dependency on the preview-card helper
  modules (`buildCellPreviewLookup`, `spreadsheetToMarkdownTable`,
  `assembleTaskPreviewData`). The regression-checker's run-to-run diff
  misclassifies this churn as "regressions"/"new failures" because the _set_ of
  failing E2E tests changes between runs. This is environment flakiness, not a
  genuine defect introduced by this plan. **The genuine, in-scope regression
  gate is satisfied at every section:** `frontend-test-coverage` (Vitest — the
  suite the plan's code actually affects), `builder-compile` (tsc), and
  `lint:frontend` for the new files all remain GREEN. Progression is therefore
  NOT blocked by the churning E2E failures; they remain documented technical
  debt.

- **Clean baseline suites (must stay green through the plan):** `builder-lint`,
  `backend-test-coverage`, `frontend-test-coverage`, `builder-test-coverage`,
  `builder-compile`. The `frontend-test-coverage` (Vitest) suite is the primary
  gate for Sections 1–6 unit/component work and is **green** at baseline and
  through Sections 1–3.

- **Regression Gate rule for this branch:** progression is blocked only on
  _new_ regressions or _new_ failures within the preview-card scope. The three
  baseline failure families above (backend-lint, frontend-lint, and the churning
  unrelated E2E specs) are documented technical debt and are **not** blocking.
  **Planned Section 5 → 5.5 E2E breakage (explicitly authorised by this plan):**
  Section 5 removes the `getTaskPreviewData` fixture rendering from
  `TaskHeatmapTable.tsx`, so the popover now queries the real `getAssignment`
  query. Until Section 5.5 lands, the `task-preview-card.spec.ts` E2E popover
  tests (IMAGE/TEXT/TABLE hover + pinned-popover) FAIL because `installRuntimeMock`
  does not yet intercept `getAssignment` (Section 5.5) and the assertions still
  reference the deleted fixture text. This is an anticipated, plan-owned
  regression owned by Section 5.5 (which must run before Section 6). It is NOT a
  defect in Section 5's component wiring — the Vitest `TaskHeatmapTable.spec.tsx`
  suite (16/16) confirms the real-data popover behaves correctly. Progression
  past Section 5 is therefore permitted; Section 5.5 MUST restore E2E green for
  `task-preview-card.spec.ts` before Section 6 deletes the fixtures.

### Section status

| Section                               | Phase  | Status   |
| ------------------------------------- | ------ | -------- |
| 1 — `buildCellPreviewLookup`          | red    | complete |
| 1 — `buildCellPreviewLookup`          | green  | complete |
| 1 — `buildCellPreviewLookup`          | commit | complete |
| 2 — `spreadsheetToMarkdownTable`      | red    | complete |
| 2 — `spreadsheetToMarkdownTable`      | green  | complete |
| 2 — `spreadsheetToMarkdownTable`      | commit | complete |
| 3 — `assembleTaskPreviewData`         | red    | complete |
| 3 — `assembleTaskPreviewData`         | green  | complete |
| 3 — `assembleTaskPreviewData`         | commit | complete |
| 4 — Wire `TaskHeatmapPage`            | red    | complete |
| 4 — Wire `TaskHeatmapPage`            | green  | complete |
| 4 — Wire `TaskHeatmapPage`            | commit | complete |
| 5 — Wire `TaskHeatmapTable`           | red    | complete |
| 5 — Wire `TaskHeatmapTable`           | green  | complete |
| 5 — Wire `TaskHeatmapTable`           | commit | complete |
| 5.5 — E2E `task-preview-card.spec.ts` | —      | complete |
| 6 — Delete fixtures                   | —      | complete |
| 7 — Regression & contract hardening   | —      | complete |
| 8 — Documentation & rollout           | —      | complete |

### Section 5.5 — completion record (2026-07-19)

- **Red/green:** Delegated to `Playwright` agent. `task-preview-card.spec.ts`
  (4 popover tests) adapted to real-data assertions; `endToEndRuntimeMocks.ts`
  gained `getAssignment` in `allMethods` + optional `RuntimeScenario.getAssignment?`;
  `task-heatmap-end-to-end-helpers.ts` gained `buildAssignmentFullDocument` and
  seeded two identical `getAssignment` success entries (StrictMode) in
  `createHeatmapScenario`. Per-task artifacts: `task_001→IMAGE`,
  `task_002→TEXT`, `task_003→TABLE`.
- **Review:** `Code Reviewer` returned CLEAN with one non-blocking nitpick —
  orphaned/detached JSDoc block above `buildAssignmentFullDocument`. Fixed by
  `Implementation` (deleted the orphaned block only; lint clean on changed file).
- **Regression Gate (compare, `feat/preview-card-real-data-wiring`):** Overall
  FAILING with **0 regressions**, **0 new failures**, **1 fix**
  (`classes-crud-bulk-progress.spec.ts` passed this run). The only failing checks
  are the 3 baseline debt families (backend-lint 14 max-lines, frontend-lint 1
  pre-existing `apiService.spec.ts` magic number, frontend-e2e 1 flaky
  `settings-backend.spec.ts`). **`task-preview-card.spec.ts` is NOT among the
  failing E2E suites** — the Section 5 → 5.5 planned breakage is RESOLVED. In-scope
  suites (`frontend-test-coverage` Vitest, `builder-compile` tsc, `builder-lint`,
  backend/frontend/builder test-coverage) all GREEN. Progression to Section 6 is
  permitted.

### Section 6 — completion record (2026-07-19)

- **Red (baseline safety):** Confirmed all 19 classPage Vitest spec files pass
  (232 tests) WITH fixtures present; content search confirmed `getTaskPreviewData`
  and `taskPreviewFixtures` appear ONLY inside the files slated for deletion — so
  deletion is safe (no other source depends on them).
- **Green:** Delegated to `Implementation`. Deleted the five files
  (`taskPreviewFixtures.ts`, `taskPreviewFixtures.spec.ts`, `fixtures/imageTask.json`,
  `fixtures/textTask.json`, `fixtures/table_task.json`); removed the now-empty
  `fixtures/` directory; removed the stale "Known v1 demo artefact" `@remarks`
  paragraph from `TaskPreviewCard.tsx` (comment-only edit, no logic touched).
- **Review:** `Code Reviewer` returned CLEAN — zero dangling imports, no barrel
  re-exports, diff strictly limited to the 6 in-scope files, `lint:frontend` 0
  errors. LSP diagnostics on the deleted files are the expected consequence of the
  co-dependent deletion and self-resolve on commit.
- **Section checks:** content search for both literals = 0 occurrences in
  `src/frontend/src/`; `npm run test:frontend -- classPage` = 18 files / 228 tests
  pass; `npm run lint:frontend` passes (pre-existing `apiService.spec.ts` warning
  only).
- **Regression Gate (compare):** Overall FAILING with **0 regressions**, **0 new
  failures**, **1 fix** (`classes-crud-bulk-progress.spec.ts`). Only the 3 baseline
  debt families fail; `task-preview-card.spec.ts` is NOT in the failing E2E set —
  fixture deletion did not break the real-data popover E2E. In-scope suites all
  GREEN. Progression to Section 7 is permitted.

### Section 7 — completion record (2026-07-19)

- **Verification battery (Vitest) — `Testing Specialist`:** All 5 commands PASS.
  - `npm run test:frontend -- classPage` → 18 files / 228 tests green (deleted
    `taskPreviewFixtures.spec.ts` absent).
  - `buildCellPreviewLookup` (14), `spreadsheetToMarkdownTable` (5),
    `assembleTaskPreviewData` (16) all green.
  - `npm run lint:frontend` → 0 errors (only pre-existing `apiService.spec.ts:304`
    magic-number warning = baseline debt).
  - All 7 acceptance-criteria spec files pass: `useClassPageData.spec.ts` (30),
    `TaskHeatmapTable.spec.tsx` (16), `TaskHeatmapPage.spec.tsx` (11),
    `ClassPageHeatmapView.spec.tsx` (3), `ClassPage.spec.tsx` (6),
    `TaskPreviewCard.spec.tsx` (11), plus remaining classPage specs.
- **Verification battery (E2E) — `Playwright`:** `npm run test:frontend:e2e --
task-preview-card` → **4/4 popover tests PASS** (IMAGE/TEXT/TABLE/pinned) against
  real-data wiring. Confirmed spec contains NO `/preview cards work properly/i`
  fixture text. Deterministic single-worker run, no flakiness observed.
- **Regression Gate (compare, two runs):** First run reported Regressions=1 /
  NewFailures=1 because the churning flaky E2E set flipped (`classes-crud-bulk-progress.spec.ts`
  failed that run instead of `settings-backend.spec.ts`); a **second run returned
  Regressions=0 / NewFailures=0 / Fixes=1**, proving it is the documented
  environment flakiness, NOT a preview-card defect. The failing E2E
  (`settings-backend.spec.ts`) is categorically outside preview-card scope and was
  failing at baseline. `task-preview-card.spec.ts` is NOT in the failing E2E set in
  either run. In-scope suites (Vitest `frontend-test-coverage`, `builder-compile`
  tsc, `builder-lint`, backend/frontend/builder test-coverage) all GREEN.
- **Conclusion:** All Section 7 acceptance criteria met. No new TypeScript errors,
  no new lint errors, no genuine regressions. Progression to Section 8 is permitted.
  (Section 7 is verification-only; the only file change is this ACTION_PLAN.md
  progress update, committed separately.)

### Section 8 — completion record (2026-07-20)

- **Documentation pass — `Docs` agent:** All in-scope work CLEAN.
  - Part A: `frontend-shared-helpers-and-abstraction-standards.md` §9.18.16 entries
    24 (`buildCellPreviewLookup`), 25 (`assembleTaskPreviewData`), 26
    (`spreadsheetToMarkdownTable`) changed `Not implemented` → `Implemented` with
    short British-English implementation notes. All other §9.18.16 entries untouched.
  - Part B: Dangling `TASK_PREVIEW_CARD_LAYOUT.md` references removed from all seven
    enumerated files with exact per-file scoping (TaskHeatmapPage, TaskHeatmapTable,
    TaskHeatmapTable.spec, TaskPreviewCard [parentheticals only],
    ClassPageHeatmapView.spec, ImageRenderer [line only],
    task-preview-card.spec [line only; other @see preserved]).
  - Part C verified: zero `TASK_PREVIEW_CARD_LAYOUT` in `src/frontend/src/` +
    `e2e-tests/`; zero `taskPreviewFixtures` in `@see`/`@link`; `lint:frontend` 0 errors.
- **Review — `Code Reviewer`:** CLEAN. Confirmed scoping discipline on all 8 in-scope
  files; flagged a pre-existing dangling `(per SPEC.md/TASK_PREVIEW_CARD_LAYOUT.md)`
  reference at `frontend-shared-helpers-and-abstraction-standards.md:746` (§9.18.13,
  outside the seven-file enumeration).
- **User directive (2026-07-20):** "Remove the layout document entirely." The
  §9.18.13 dangling reference was therefore ALSO removed → `(per SPEC.md)`.
  Re-verified: zero `TASK_PREVIEW_CARD_LAYOUT` references remain in any committed
  source/doc path (only `ACTION_PLAN.md`/`SPEC.md` themselves mention it, as
  branch-ephemeral planning artefacts per user policy). The layout document is now
  fully removed.
- **Regression Gate (compare):** Overall FAILING with **0 regressions**, **0 new
  failures**, **1 fix** (`classes-crud-bulk-progress.spec.ts`). Only the 3 baseline
  debt families fail; in-scope suites GREEN. Progression to post-implementation
  passes permitted.
- **Note:** `ACTION_PLAN.md`/`SPEC.md` are branch-ephemeral per user policy; they will
  be removed at branch completion (after de-sloppification + final docs pass), not now
  (still required as execution source).

### De-Sloppification pass (2026-07-20)

- **Scope:** Full branch diff vs base `feat/PreviewCardWiring` (merge-base `9e28eb7`),
  17 implementation files (excluded planning docs + deleted fixtures + PNG snapshots).
- **`De-Sloppification` agent findings:** 4 minor issues, no blocking defects.
  - FIXED (Medium): `assembleTaskPreviewData.ts` — removed unattached duplicated
    file-level JSDoc (lines 1-27); function-level JSDoc retained.
  - FIXED (Low): `ImageRenderer.tsx` — reworded broken JSDoc sentence that referenced
    the now-deleted layout doc → "The `maxHeight: 400` constraint prevents the image
    from making the popover card overflow the viewport."
  - FIXED (Medium, SPEC-alignment): `buildCellPreviewLookup.ts` — changed
    `CellPreviewData.reasoning` to `Record<HeatmapMetricKey, string | null>` and
    iterated canonical `HEATMAP_METRIC_KEYS` (SPEC §"CellPreviewData" prescribes this;
    prior code hard-coded the three keys). Safe ripple: `assembleTaskPreviewData.ts`
    reads `cellData.reasoning[metricKey]` (unchanged), `TaskPreviewCard.tsx` unaffected.
  - SKIPPED (Low): `TaskHeatmapTable.tsx` unconditional `assembleTaskPreviewData` call —
    pure function, no side effects, harmless; top-level computation is a clean KISS
    pattern. Deliberate non-action (no speculative refactor).
- **Validation:** `lint:frontend` 0 errors; `buildCellPreviewLookup` + `assembleTaskPreviewData`
  Vitest suites = 30 tests pass; `tsc -b` exit 0.
- **Review — `Code Reviewer`:** CLEAN (all 3 fix files; scope confined; SPEC contract
  confirmed).
- **Regression Gate (compare):** Overall FAILING, **0 regressions**, **0 new failures**,
  **1 fix** (`classes-crud-bulk-progress.spec.ts`). In-scope suites GREEN.
