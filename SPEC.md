# Task Preview Card Specification

## Status

- Draft v1.5
- Addresses Planner Reviewer findings from v1.4 re-review: fixed header example contradiction (I-1), locked `MetricPill` `precision={0}` and `compact={true}` in Section 4 (I-2), clarified `MetricResult` reassembly with schema-valid values (I-3), added concrete E2E hover-target cell locators (I-4), reworded smoke test to available fixture scale (I-5), corrected @see count to four code locations (N-1), updated helper-plan decision label for shared renderers (N-2), specified MarkdownRenderer CSS is co-located (N-3), updated SPEC version in Read-First (N-4), aligned scaling wording (N-5).
- **Scope change:** `ImageRenderer` and `MarkdownRenderer` are now placed directly in `src/frontend/src/components/` as shared components (user decision; expected reuse across the project).
- Previous revisions: v1.4 scoped E2E label assertions (I-2), removed unreachable defensive null (I-3), fixed arithmetic (N-1), clarified header format (N-2), assigned composite aria-label (N-3), fixed taskId imprecision (N-4), noted `TaskPreviewData | null` (N-5). v1.3 fixed file tree (I4), set concrete maxHeight values (I5), corrected render-cost claim (I1). v1.2 resolved unreachable null-return test (M1), documented known v1 demo artefact (M2), added shared-helper planning gate (M3), broadened @see scope (M4), documented unused taskId (M5), adopted MetricIconLabel (S1).
- Added precise next-round wiring path analysis confirming existing data shapes (`AssignmentFull`, `StudentSubmission`, `StudentSubmissionItem`, `BaseTaskArtifact`, `Assessment`) align perfectly with the `TaskPreviewData` contract — no backend changes needed, purely frontend wiring.

## Purpose

This document defines the intended behaviour for the **Task Preview Card** — a rich Ant Design Popover that appears when hovering over (or clicking to pin) an individual metric sub-cell in the `TaskHeatmapTable`.

The feature will be used to:

- Surface the LLM reasoning behind a specific metric score (completeness, accuracy, or SPaG) without leaving the heatmap view
- Display the student's original artifact response alongside the reasoning, rendered appropriately for the artifact type (image, markdown table, or markdown text)
- Provide a substantially richer preview experience than the legacy Google Sheets heatmap comment popup

This feature is **not** intended to:

- Support SPREADSHEET (Sheets) task artifacts — explicitly out of scope
- Replace or modify the heatmap table layout, sorting, or filtering behaviour
- Wire into the live `assignmentAssessment` service in v1 — placeholder data only

## Agreed product decisions

1. **Individual metric sub-cell trigger.** Each of the three metric sub-columns (completeness, accuracy, spag) within a task column triggers its own popover. Hovering the completeness sub-cell shows completeness reasoning; hovering accuracy shows accuracy reasoning; etc.
2. **Hover + click-to-pin.** The popover uses Ant Design `Popover` with `trigger={['hover', 'click']}`. Hover provides quick preview; click pins the popover open for reading longer reasoning. Keyboard focus trigger is deferred to a later round (the trigger element is not made focusable in v1).
3. **react-markdown for rendering.** The project will add `react-markdown` and `remark-gfm` as dependencies for rendering markdown tables and formatted text. No `marked`/`DOMPurify` approach. `rehype-raw` is **not** added — raw HTML in student markdown is escaped by `react-markdown`'s default behaviour, guarding against stored XSS when real data is wired in.
4. **Feature-local fixture copies in v1.** The three test fixture JSON files are copied into a feature-local `fixtures/` directory under `classPage/` with unique `taskId` values to avoid key collisions. A deterministic `taskId → fixture file` lookup table in the adapter maps heatmap cells to fixtures. These copies are temporary and will be removed when the `assignmentAssessment` service is wired in the next round.
5. **Three artifact renderers.** The card supports three artifact types via dedicated renderers:
   - `IMAGE`: base64 data URL rendered as an `<img>` element
   - `TABLE`: markdown table string rendered via `react-markdown` + `remark-gfm`
   - `TEXT`: markdown text string rendered via `react-markdown`
   - SPREADSHEET and `base` artifact types are explicitly excluded; the loader returns `null` for these.
6. **Card content structure.** The popover contains three stacked sections:
   - **Header**: metric icon + label + score value (e.g. "Completeness: 5")
   - **Reasoning**: the LLM reasoning text for the hovered metric
   - **Student Response**: the artifact content, rendered by the appropriate renderer
7. **Header score format.** The header displays the metric icon (via the existing `MetricIconLabel` component, reused from heatmap column headers) followed by the metric label (sourced from `METRIC_DISPLAY_META.get(metricKey).label`) and the score value only (e.g. "Completeness" + "5" as separate elements in a flex row — not a single concatenated string). No denominator is shown because `TaskPreviewData` does not carry a max score. This is consistent with the existing `MetricPill` component which also renders only the value. See the layout spec §2 for the exact three-element header structure.

## Existing system constraints

### Frontend architecture constraints

- The `TaskHeatmapTable` (`src/frontend/src/features/classPage/TaskHeatmapTable.tsx`) renders metric sub-cells via Ant Design `Table` column `render` functions. The popover must wrap the existing cell `render` output without breaking the table layout, sorting, or filtering.
- The `HeatmapCell` type (`src/frontend/src/services/dataAnalysis/heatmapAdapter.ts`) currently carries only `MetricResult` objects (score + state). It does **not** carry reasoning text or artifact content. The popover component receives this data via props from a separate data source (feature-local fixture copies in v1; the `assignmentAssessment` service in a later round).
- All spacing must follow the 8px grid system (`docs/developer/frontend/frontend-spacing-and-padding-standards.md`).
- All frontend-to-backend calls must route through `callApi` in `apiService.ts` (not applicable in v1 since data is placeholder).
- Export functions as `function` declarations, not `const` arrow functions (`src/frontend/AGENTS.md` §2).
- Production source must not import from `src/test/**` (`src/frontend/AGENTS.md` §8). Fixture copies for v1 live in `src/frontend/src/features/classPage/fixtures/`, not `src/test/shared/`.

### Current data-shape constraints

The test fixture data shape (from `imageTask.json`, `textTask.json`, `table_task.json`):

```ts
{
  [taskId: string]: {
    id: string;
    taskId: string;
    artifact: {
      taskId: string;
      role: string;
      pageId: string;
      documentId: string;
      content: string;           // base64 data URL for IMAGE; markdown string for TEXT/TABLE
      contentHash: string;
      metadata: Record<string, unknown>;
      uid: string;
      type: 'IMAGE' | 'TEXT' | 'TABLE';
    };
    assessments: {
      completeness: { score: number; reasoning: string };
      accuracy: { score: number; reasoning: string };
      spag: { score: number; reasoning: string };
    };
    feedback: Record<string, unknown>;
  };
}
```

**v1 fixture key resolution:** The three fixture files are copied to `src/frontend/src/features/classPage/fixtures/` with the following unique `taskId` values (changed from the originals to avoid the `t_eb2bc6cd1605` collision between `textTask.json` and `table_task.json`):

| Fixture file      | v1 `taskId`           | Artifact type |
| ----------------- | --------------------- | ------------- |
| `imageTask.json`  | `t_preview_image_001` | IMAGE         |
| `textTask.json`   | `t_preview_text_001`  | TEXT          |
| `table_task.json` | `t_preview_table_001` | TABLE         |

The adapter's deterministic lookup table maps every metric sub-cell by `metricKey` to one of these three fixture entries for v1 demonstration purposes. The exact mapping is:

- All cells with `metricKey === 'completeness'` → `t_preview_image_001` (IMAGE)
- All cells with `metricKey === 'accuracy'` → `t_preview_text_001` (TEXT)
- All cells with `metricKey === 'spag'` → `t_preview_table_001` (TABLE)

This alternating-by-metric mapping ensures every cell in the heatmap demonstrates a different artifact type, keeping the v1 demo varied without requiring per-task fixture data. These copies and the mapping table are removed when the `assignmentAssessment` service is wired.

The `MetricResult` discriminated union (`src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`):

```ts
type MetricResult =
  | {
      state: 'computed';
      value: number;
      totalWeight: number;
      applicableDataPoints: number;
      totalDataPoints: number;
    }
  | {
      state: 'notAttempted';
      value: 'N';
      totalWeight: number;
      applicableDataPoints: 0;
      totalDataPoints: number;
    }
  | {
      state: 'error';
      value: 'E';
      totalWeight: number;
      applicableDataPoints: 0;
      totalDataPoints: number;
    };
```

### Dependency constraints

- The project has **no existing markdown rendering library**. `react-markdown` and `remark-gfm` must be added to `src/frontend/package.json`.
- Ant Design v6 `Popover` supports `trigger={['hover', 'click']}` natively — no custom implementation needed.
- The GAS builder pipeline bundles frontend dependencies via Vite. `react-markdown` is a pure JS/TS library with no external CDN requirements, so it is compatible with the builder pipeline. A build verification step is included in the action plan.

## Domain and contract recommendations

### Recommended data shapes

#### TaskPreviewData (popover input contract)

```ts
interface TaskPreviewData {
  taskId: string;
  artifactType: 'IMAGE' | 'TEXT' | 'TABLE';
  artifactContent: string;
  metricKey: 'completeness' | 'accuracy' | 'spag';
  metricScore: number | 'N' | 'E';
  metricState: 'computed' | 'notAttempted' | 'error';
  reasoning: string;
}
```

This is the props contract for the `TaskPreviewCard` presentational component. The component accepts `TaskPreviewData | null` — when `null` is passed, it renders "Task data not available" instead of the card content. The interface is deliberately flat and self-contained so the component has no dependency on the heatmap view model or the assignment assessment service shape.

**Trade-off note:** `TaskPreviewData` carries both `metricScore` and `metricState`, which together re-encode a `MetricResult` that the card immediately reassembles for `MetricPill`. Passing the `MetricResult` directly was considered but rejected: the flat contract keeps the component decoupled from the `MetricResult` discriminated union shape (which carries weight/data-point fields irrelevant to the card), and makes the props interface self-documenting for future service-wiring. The reassembly cost is negligible.

**Data source split (explicit):** The `TaskPreviewData` fields come from two independent sources:

- `metricScore` and `metricState` come from the hovered `HeatmapCell`'s `MetricResult` (the heatmap's own data).
- `taskId`, `artifactType`, `artifactContent`, `metricKey`, and `reasoning` come from the fixture/service data source.

In v1, the fixture data is static and always present. When wired to the `assignmentAssessment` service, the service data may be missing for some cells — the loader returns `null` in that case and the popover shows "Task data not available".

#### TaskPreviewLoader contract

```ts
/**
 * Resolves preview data for a given heatmap cell.
 * Returns null when no preview data is available for the cell.
 *
 * @remarks
 * In v1 the `taskId` parameter is part of the forward-looking contract but is
 * **not used** by the implementation — the lookup is keyed purely by `metricKey`
 * via the deterministic mapping table. The parameter is retained so the v1
 * implementation satisfies the service-wiring contract without a signature
 * change later. The "returns null for unknown taskIds" test expectation is
 * therefore **deferred** to the service-wiring round; v1 tests cover the
 * metricKey→fixture mapping only.
 */
function getTaskPreviewData(
  taskId: string,
  metricKey: 'completeness' | 'accuracy' | 'spag',
  metricResult: MetricResult
): TaskPreviewData | null;
```

In v1, this function is implemented by `taskPreviewFixtures.ts` using the deterministic lookup table described in §"Current data-shape constraints". In the next round, it will be replaced by a hook that reads from the prefetched `assignmentAssessment` service data.

### Naming recommendation

Prefer:

- `TaskPreviewCard` — the popover content component
- `MarkdownRenderer` — the shared markdown rendering component
- `ImageRenderer` — the base64-to-image rendering component
- `getTaskPreviewData` — the pure function that resolves preview data for a given cell (v1); becomes `useTaskPreviewData` hook when wired to service

Avoid:

- `HeatmapPopover` — too tied to the heatmap; the card is a general task preview
- `ArtifactPreview` — ambiguous; could refer to reference/template artifacts

## Feature architecture

### Placement

- **Component ownership:** `src/frontend/src/features/classPage/` (feature-local; the popover is only consumed by the heatmap table in v1)
- **Feature-local fixtures:** `src/frontend/src/features/classPage/fixtures/` (temporary v1 copies of test fixture JSON files with unique taskIds)
- **Shared renderers:** `src/frontend/src/components/` (`MarkdownRenderer` and `ImageRenderer` are placed directly as shared components, expected to be reused across the project)

### Proposed high-level tree

```text
src/frontend/src/features/classPage/
├── TaskHeatmapTable.tsx              (modified: wraps metric cell render with Popover)
├── TaskPreviewCard.tsx               (new: popover content component)
├── TaskPreviewCard.spec.tsx          (new: component tests)
├── taskPreviewFixtures.ts            (new: fixture loader/adapter with deterministic lookup)
├── taskPreviewFixtures.spec.ts       (new: fixture adapter tests)
└── fixtures/
    ├── imageTask.json                (copied from src/test/shared/, taskId changed)
    ├── textTask.json                 (copied from src/test/shared/, taskId changed)
    └── table_task.json               (copied from src/test/shared/, taskId changed)

src/frontend/src/components/
├── ImageRenderer.tsx                 (new: shared base64 image renderer)
├── ImageRenderer.spec.tsx            (new: component tests)
├── MarkdownRenderer.tsx              (new: shared markdown renderer)
└── MarkdownRenderer.spec.tsx         (new: component tests)
```

### Out of scope for this surface

- SPREADSHEET (Sheets) task artifact rendering
- `base` artifact type rendering
- Live wiring to the `assignmentAssessment` service (deferred to next round)
- Modifying the heatmap table layout, column structure, or filtering
- Editing or modifying assessment data from the popover
- Keyboard focus trigger for the popover (deferred; the trigger element is not made focusable in v1)

## Core view model or behavioural model

### TaskPreviewData derivation (v1: from feature-local fixtures)

For v1, the `TaskPreviewData` is derived by:

1. Taking the heatmap cell coordinates (`taskId`, `metricKey`, `metricResult`) — available from the table `render` function context
2. Looking up the fixture entry via the deterministic mapping table in `taskPreviewFixtures.ts`
3. Extracting the reasoning for the hovered `metricKey` from the fixture's `assessments` object
4. Extracting the artifact type and content from the fixture's `artifact` object
5. Taking the score and state from the `metricResult` parameter (not from the fixture's assessment score)

### Derivation rules

#### Metric score display

- `state === 'computed'`: display `value` as integer (e.g. "5")
- `state === 'notAttempted'`: display "N"
- `state === 'error'`: display "E"

#### Reasoning display

- Always display the `reasoning` string from the assessment for the hovered metric key
- If reasoning is empty or missing, display a placeholder: "No reasoning available"

#### Artifact rendering

- `IMAGE`: render `<img src={artifactContent} alt="Student response" />` with max-width constraint
- `TABLE`: render via `<MarkdownRenderer>{artifactContent}</MarkdownRenderer>`
- `TEXT`: render via `<MarkdownRenderer>{artifactContent}</MarkdownRenderer>`

#### MetricPill reuse

The card reassembles a `MetricResult` from `metricState` + `metricScore` to reuse the existing `MetricPill` component for the header score display. This preserves the heatmap tone colour (red/gold/green gradient for computed, grey for notAttempted, volcano for error). The `MetricPill` is called with `precision={0}` (integer scores) and `compact={true}` (smaller footprint for the dense header), per the layout spec §2.

The reassembly must produce a schema-valid `MetricResult` (per `dataAnalysis.zod.ts`). The weight/data-point fields are inert for display (`MetricPill` ignores them) but must satisfy the discriminated-union constraints:

- `computed` → `{ state: 'computed', value, totalWeight: 0, applicableDataPoints: 1, totalDataPoints: 1 }`
- `notAttempted` → `{ state: 'notAttempted', value: 'N', totalWeight: 0, applicableDataPoints: 0, totalDataPoints: 1 }`
- `error` → `{ state: 'error', value: 'E', totalWeight: 0, applicableDataPoints: 0, totalDataPoints: 0 }`

The reassembly is a local concern of `TaskPreviewCard` and does not require a shared helper.

## Main user-facing surface specification

### Recommended components or primitives

- **Ant Design `Popover`** — the trigger wrapper around each metric sub-cell. Configured with `trigger={['hover', 'click']}` and `placement="right"`. Default `mouseEnterDelay` and `mouseLeaveDelay` (0.1s) are used; these may be tuned in the layout spec.
- **Ant Design `Card`** (inside the popover) — the content container with `size="small"`, `title` for the metric header, and body for reasoning + response sections. The card body has `maxHeight: 480` with `overflow: 'auto'` to prevent the popover from exceeding the viewport.
- **Ant Design `Typography`** — for section labels ("Reasoning", "Student Response") and the reasoning text.
- **Ant Design `Divider`** — to separate the reasoning and student response sections.
- **`MetricIconLabel`** — reused from heatmap column headers for the metric icon + accessible tooltip in the popover header (sourced from `METRIC_DISPLAY_META`)
- **`MetricPill`** — for the metric score display in the header (reassembled `MetricResult` as described above).
- **`react-markdown` + `remark-gfm`** — for rendering markdown tables and formatted text.

### Fields, columns, or visible sections

1. **Header**: Three-element flex row (per layout spec §2): `MetricIconLabel` (Lucide icon + accessible tooltip from `METRIC_DISPLAY_META.get(metricKey).label`) + `Typography.Text` (metric label, e.g. "Completeness", sourced from `METRIC_DISPLAY_META.get(metricKey).label`) + `MetricPill` (score value, e.g. "5"). The `[5]` notation denotes the `MetricPill` component, not a concatenated suffix. The metric label is sourced from `METRIC_DISPLAY_META.get(metricKey).label` (canonical label: "SPaG" for spag), not a hardcoded string.
2. **Reasoning section**: Label "Reasoning" + the LLM reasoning text (rendered as plain text via `Typography.Text`)
3. **Student Response section**: Label "Student Response" + the artifact content (rendered by the appropriate renderer)

### Rendering rules

#### Computed metric

- Show the numeric score via `MetricPill` in the header
- Show the reasoning text
- Show the artifact content rendered by type

#### Not-attempted metric

- Show "N" via `MetricPill` in the header
- Show the reasoning text (may be empty — show placeholder if so)
- Show the artifact content if `artifactContent` is a non-empty string; otherwise show "No submission available"

#### Error metric

- Show "E" via `MetricPill` in the header
- Show the reasoning text (may be empty — show placeholder if so)
- Show the artifact content if `artifactContent` is a non-empty string; otherwise show "Error loading response"

#### IMAGE artifact

- Render as `<img>` with `maxWidth: '100%'`, `height: 'auto'`, and `maxHeight: 400` to prevent the popover from growing too tall
- Add `alt="Student response image"` for accessibility

#### TABLE artifact

- Render via `react-markdown` with `remark-gfm` plugin for table support
- Apply basic table styling (borders, padding) via a CSS class

#### TEXT artifact

- Render via `react-markdown` with `remark-gfm` plugin (included for consistency; tables in text content are harmless)
- Preserve paragraph breaks, lists, bold, italic, etc.

#### Known v1 demo artefact: notAttempted/error cells

In v1, the fixture data is static and always carries full reasoning and artifact content regardless of the cell's `metricState`. A `notAttempted` cell will therefore display fixture reasoning such as "The student has fully completed the task…" alongside a full image or table — a semantic mismatch with the "N" score shown in the header. This is a **known v1 demo artefact** caused by the split data source (score/state from the heatmap `MetricResult`, reasoning/artifact from the fixture). When wired to the `assignmentAssessment` service, the reasoning and artifact will match the actual assessment for each cell. This artefact is not treated as a bug in v1 tests or the layout spec.

## Workflow specification

## Hover preview

### Eligible inputs or preconditions

- The user hovers over a metric sub-cell in the `TaskHeatmapTable`
- The cell has a valid `taskId` and the fixture data contains a matching entry

### Behaviour

- After `mouseEnterDelay` (0.1s), the popover appears to the right of the cell
- The popover displays the metric header, reasoning, and student response
- Moving the mouse away closes the popover (unless clicked to pin)

## Click-to-pin

### Eligible inputs or preconditions

- The user clicks on a metric sub-cell that already has a hover popover visible

### Behaviour

- The popover remains open after the mouse leaves the cell
- Clicking the cell again (or clicking outside the popover) closes it
- If the content exceeds the card body `maxHeight` (480px), the body scrolls vertically

## Error, loading, and empty-state rules

### Blocking failure

- If `getTaskPreviewData` returns `null` (no fixture entry for the hovered `taskId`), the popover shows: "Task data not available"
- This should not happen in normal operation with the v1 deterministic mapping (every cell maps to a fixture)

### Empty states

#### No reasoning

- If the reasoning string is empty or missing, display: "No reasoning available"

#### No artifact content

- If `artifactContent` is an empty string or `null`, display: "No submission available" (for notAttempted) or "Error loading response" (for error)
- In v1, all three fixtures carry non-empty artifact content, so these branches are exercised only by synthetic test cases

#### IMAGE render failure

- If the base64 data is invalid, the `<img>` element will show its `alt` text. No additional error handling needed in v1.

## Accessibility and usability notes

- The popover trigger (metric sub-cell) must accept `onMouseEnter`, `onMouseLeave`, and `onClick` events per Ant Design Popover requirements. The trigger element is a plain `<span>` (not focusable) in v1; keyboard focus trigger is deferred.
- The card header's wrapping `Flex` container has an `aria-label` describing the metric and score (e.g. "Completeness score: 5"). The `MetricIconLabel` icon within also carries its own `aria-label` for the metric name.
- The student response image has `alt="Student response image"`
- The popover content is readable at standard zoom levels; the card body scrolls if content exceeds its `maxHeight` (480px)
- `react-markdown` escapes raw HTML by default (no `rehype-raw`), guarding against stored XSS when real student markdown is rendered

## Backend changes required to support agreed behaviour

None for v1. The popover uses feature-local fixture copies.

### Next-round wiring path (documented for the future action plan)

The following analysis confirms the existing data shapes already support the preview card without backend changes:

1. **Prefetch already in place.** `useClassPageData` already prefetches the top-3 assignments via `queryClient.prefetchQuery(getAssignmentQueryOptions(classFull.classId, assignment.assignmentId))`. The query key is `['assignment', courseId, assignmentId]` and the data is cached in React Query.

2. **Service returns the right shape.** `getAssignment` returns `AssignmentFull` which contains `submissions: StudentSubmission[]`. Each `StudentSubmission` has `studentId` and `items: Record<string, StudentSubmissionItem>`. Each `StudentSubmissionItem` has `taskId`, `artifact: BaseTaskArtifact`, and `assessments: Record<string, Assessment>`.

3. **Artifact type alignment.** `BaseTaskArtifactSchema` is a discriminated union on `type`: `'TEXT' | 'TABLE' | 'IMAGE'` (content: `string | null`), `'SPREADSHEET'` (content: 2D array), `'base'` (content: unknown). The three in-scope types map directly to our three renderers. SPREADSHEET and `base` are out of scope.

4. **Assessment alignment.** `AssessmentSchema` is `{ score: number; reasoning: string }` — exactly the shape needed for the reasoning field.

5. **Lookup path.** In the next round, a `useTaskPreviewData(studentId, taskId, metricKey, metricResult)` hook will:
   - Read the prefetched `AssignmentFull` from the React Query cache via `useQuery(getAssignmentQueryOptions(courseId, assignmentId))`
   - Find `submission` where `submission.studentId === studentId`
   - Find `item` where `item.taskId === taskId`
   - Return `TaskPreviewData` with `artifactType` ← `item.artifact.type`, `artifactContent` ← `item.artifact.content`, `reasoning` ← `item.assessments[metricKey]?.reasoning`, and `metricScore`/`metricState` from the heatmap cell's `MetricResult`
   - Return `null` if no matching submission/item is found

6. **Prop flow.** `TaskHeatmapPage` already receives `classFull` (with `classId` = `courseId`) and `assignmentId` as props. These will be passed down to `TaskHeatmapTable` as new props so it can construct the query key.

7. **The `taskId` parameter.** The `getTaskPreviewData` contract's `taskId` parameter is unused in v1 (the lookup is keyed by `metricKey` only) but is retained for the next round where it will be used to find the matching `StudentSubmissionItem`. No signature change is needed.

**Conclusion:** No backend changes are required. The next round is purely a frontend wiring exercise: add a `useTaskPreviewData` hook, pass `courseId`/`assignmentId` through `TaskHeatmapTable`, and replace the fixture adapter with the service-backed hook. The feature-local fixture copies in `classPage/fixtures/` are removed.

## Planning handoff notes

- The `TaskPreviewCard` component is **presentational only** — it receives all data via props and has no internal state or side effects
- The popover wrapper logic lives in `TaskHeatmapTable.tsx` (wrapping the existing `render` function for metric sub-cells)
- The markdown renderer (`MarkdownRenderer`) and image renderer (`ImageRenderer`) are new shared components placed directly in `src/frontend/src/components/` (expected to be reused across the project). The action plan records shared-helper planning gate decisions (`new`) for each, with canonical-doc entries marked `Not implemented` per `ACTION_PLAN_TEMPLATE` §"Shared-helper planning gate".
- The existing `@see TASK_HEATMAP_LAYOUT.md` reference points to a non-existent file in **four code locations**: `TaskHeatmapTable.tsx:16`, `TaskHeatmapPage.tsx:10`, `ClassPageHeatmapView.spec.tsx:17`, and `TaskHeatmapTable.spec.tsx:10`. (The fifth reference in `frontend-shared-helpers-and-abstraction-standards.md:741` was already corrected to `TASK_PREVIEW_CARD_LAYOUT.md`.) The new layout spec (written after this spec is approved) becomes the canonical document and all four code `@see` references are updated during implementation.
- Wrapping every metric sub-cell (up to 50 rows × N tasks × 3 metrics) in its own `Popover` is expected to be fine (Ant Design `Popover` is lazy). The action plan includes a smoke test in §6 verifying the heatmap renders and remains interactive with the available test fixture after the Popover wrapper is added.
- The `maxHeight` values for the card body (480px) and image (400px) are set in the layout spec. The layout spec is the single source of truth for these UI specifics and aligns with `frontend-spacing-and-padding-standards.md`.
- When copying fixture files, the top-level key, the nested `artifact.taskId` field, the object's own top-level `taskId` field, and the `id` field are all updated to the new unique value for fidelity, even though the v1 loader does not use `taskId`.
- **Next-round wiring:** See §"Backend changes required to support agreed behaviour" → "Next-round wiring path" for the full analysis. Key points: `TaskHeatmapTable` will need `courseId` as a new prop (sourced from `classFull.classId` in `TaskHeatmapPage`); the `useTaskPreviewData` hook reads from the existing React Query cache (keyed `['assignment', courseId, assignmentId]`); no backend changes needed.
- **v1 `taskId` value:** The v1 loader ignores the `taskId` parameter and maps by `metricKey`, so the returned `TaskPreviewData.taskId` will be the _fixture's_ taskId (e.g. `t_preview_image_001`), not the hovered cell's real taskId. This is harmless (the field is not displayed in v1) but worth noting for future readers.

## Testing expectations

- **Frontend component tests:** `TaskPreviewCard` renders correctly for each artifact type (IMAGE, TABLE, TEXT) and each metric state (computed, notAttempted, error)
- **Frontend component tests:** `MarkdownRenderer` renders markdown text and tables correctly
- **Frontend component tests:** `ImageRenderer` renders a base64 data URL as an `<img>` element with correct `alt` text
- **Frontend unit tests:** `getTaskPreviewData` returns correct `TaskPreviewData` for each metric key. The "returns null for unknown taskIds" test is **deferred** to the service-wiring round because the v1 loader ignores `taskId` (see contract `@remarks`).
- **Frontend integration tests:** The popover appears on hover and click over metric sub-cells in the `TaskHeatmapTable`
- **Frontend lint:** `npm run lint:frontend` passes with no new errors
- **Build verification:** `react-markdown` and `remark-gfm` bundle cleanly through the Vite build (no external CDN dependencies)

## Documentation and rollout notes

- No canonical docs need updating for v1 (feature-local component with placeholder data)
- When wired to the `assignmentAssessment` service in the next round, update the relevant service docs
- The `@see TASK_HEATMAP_LAYOUT.md` references in `TaskHeatmapTable.tsx`, `TaskHeatmapPage.tsx`, `ClassPageHeatmapView.spec.tsx`, and `TaskHeatmapTable.spec.tsx` are updated to point to the new layout spec during implementation. (The fifth reference in `frontend-shared-helpers-and-abstraction-standards.md:741` was already corrected.)

## V1 scope recommendation

### Include in v1

- `TaskPreviewCard` presentational component with header, reasoning, and student response sections
- `MarkdownRenderer` component using `react-markdown` + `remark-gfm`
- `ImageRenderer` component for base64 PNG display
- Popover integration in `TaskHeatmapTable` wrapping metric sub-cell `render` functions
- Feature-local fixture copies in `classPage/fixtures/` with unique taskIds
- `getTaskPreviewData` adapter with deterministic lookup table
- Component tests for all renderers and the preview card
- Unit tests for the fixture adapter
- `react-markdown` and `remark-gfm` added to `src/frontend/package.json`

### Defer from v1

- Live wiring to the `assignmentAssessment` service (next implementation round)
- SPREADSHEET (Sheets) and `base` task artifact rendering
- Custom popover styling beyond Ant Design defaults
- Keyboard focus trigger for the popover (the trigger element remains a non-focusable `<span>`)
- Removal of feature-local fixture copies (done when service is wired)

## Open questions

None.
