# Pre-PR Review — `feat/PreviewCardWiring` (data-shape / schema consistency)

**Reviewer focus:** Frontend data-shape / schema consistency for the new `assembleTaskPreviewData`,
`buildCellPreviewLookup`, `spreadsheetToMarkdownTable`, `TaskPreviewCard` prop types, and the
`TaskHeatmapTable` → `TaskHeatmapPage` data flow.

**Verdict: Needs Improvement** — every changed view-model/prop shape lines up with the upstream
Zod contracts (`AssignmentFull`, `BaseTaskArtifactSchema`, `AssessmentSchema`, `MetricResult`,
`HeatmapMetricKey`), so there is no current build- or type-breaking defect. However, several
places rely on fragile/loose shapes that will silently diverge if the backend schema or the
artifact-type set changes.

**Constraint note:** Per the brief, lint, type-check, and tests were **not** run. Findings below
are from static reading of the diff plus the upstream type contracts it depends on.

---

## DIFF FINDINGS

### Improvement — `assembleTaskPreviewData.ts:65-85` (`coerceArtifactType`) lacks exhaustiveness safety

The `switch` over `CellPreviewData['artifactType']` covers the five current members
(`TEXT`, `TABLE`, `IMAGE`, `SPREADSHEET`, `base`) but has **no `default` branch and no `never`
assertion**. It currently type-checks only because `ArtifactType` (buildCellPreviewLookup.ts:9) is
exhaustively handled. If a new artifact type is added to `BaseTaskArtifactSchema`
(assignmentAssessment.zod.ts:47-60) **and** to `ArtifactType`, but this `switch` is missed, the
function falls through and returns `undefined` at runtime while still being typed as
`TaskPreviewData['artifactType']` — a silent type lie.

**Fix:** add a typed exhaustiveness guard, e.g.
`default: { const _exhaustive: never = type; return _exhaustive; }` (or an explicit safe fallback).
This converts a latent runtime bug into a compile error at the extension point.

### Improvement — `buildCellPreviewLookup.ts:9` (`ArtifactType`) duplicates the Zod discriminator

`type ArtifactType = 'TEXT' | 'TABLE' | 'IMAGE' | 'SPREADSHEET' | 'base'` is a hand-rolled copy of
the `BaseTaskArtifactSchema` discriminated union (assignmentAssessment.zod.ts:47-60). The JSDoc at
buildCellPreviewLookup.ts:5-8 even admits the coupling. This is the root cause of the fragility in
the finding above: three independent declarations (`BaseTaskArtifactSchema`, `ArtifactType`, and
the `coerceArtifactType` switch) must be kept in lock-step.

**Fix:** where practical, derive the discriminator from the schema (e.g. `z.infer` of a
`z.enum([...])` shared type) or export a single source-of-truth type consumed by both the schema
and `buildCellPreviewLookup`.

### Improvement — `buildCellPreviewLookup.ts:48-50` `reasoning` is keyed by `HeatmapMetricKey` against arbitrary-named `assessments`

`reasoning: Object.fromEntries(HEATMAP_METRIC_KEYS.map((key) => [key, assessments[key]?.reasoning ?? null]))`
looks up `assessments[key]` where `key ∈ {'completeness','accuracy','spag'}`. But `assessments` is
typed `Record<string, Assessment>` (assignmentAssessment.zod.ts:88), keyed by **backend metric
names** which are not constrained to equal the three heatmap keys. If the backend ever emits
assessment keys that differ (e.g. `spelling` instead of `spag`), the reasoning for that metric
silently becomes `null` and then `''` downstream (assembleTaskPreviewData.ts:42).

**Fix:** assert/document the invariant that `AssessmentFull` assessment keys are exactly the
`HeatmapMetricKey` set, or map explicitly from backend metric keys → `HeatmapMetricKey`.

### Improvement — `TaskHeatmapTable.tsx:279-289` null-cell path fabricates a card whose state can contradict the lookup

`assembleTaskPreviewData` always returns a non-null `TaskPreviewData` (assembleTaskPreviewData.ts:24-44),
so the Popover content is now unconditionally a `TaskPreviewCard` (previously
`content={previewData ? <Card/> : null}`). In the `cellData === null` branch it returns
`metricState: metricResult.state` and empty content (lines 36-44). When the heatmap metric `m`
has `state === 'computed'` but the lookup has **no submission** for that (student, task), the card
shows a _computed_ score with empty content and empty reasoning, contradicting the "no submission"
semantics that `renderArtifact` only applies for `notAttempted`/`error`
(TaskPreviewCard.tsx:136-142).

**Fix:** when `cellData === null`, derive `metricState` explicitly (e.g. treat as `notAttempted`)
rather than forwarding the heatmap's possibly-computed state, or otherwise reconcile the two view
models so a computed score is never shown with empty content.

### Improvement — `spreadsheetToMarkdownTable.ts:43-52` ragged rows produce malformed GFM tables

`columnCount` is taken from `rows[0].length` (line 43), but `buildRow` (lines 36-42) iterates only
each row's own cell count. A data row shorter than the header yields a GFM row with fewer `|`
delimiters than the separator row, producing a mis-aligned table.

**Fix:** pad every row to `columnCount` (e.g. `row.concat(Array(columnCount - row.length).fill(null))`)
before formatting.

### Improvement — `buildCellPreviewLookup.ts:19` `artifactContent: unknown` discards the schema's per-type content shape

`CellPreviewData.artifactContent` is `unknown`, so `coerceArtifactContent` must blind-cast it at
assembleTaskPreviewData.ts:98-103 (`cellData.artifactContent as Array<Array<string | number | null>> | null`).
The cast is correct _today_ because `BaseTaskArtifactSchema` types SPREADSHEET content as exactly
that (assignmentAssessment.zod.ts:52-54); but the `unknown` field means a future schema drift on
content shape would not be caught at the `buildCellPreviewLookup` boundary — it would only surface
as a runtime cast failure deep in `spreadsheetToMarkdownTable`.

**Fix:** model `CellPreviewData.artifactContent` as a discriminated union mirroring
`BaseTaskArtifactSchema` so `coerceArtifactContent` narrows without a cast.

### Nitpick — `TaskHeatmapTable.tsx:193-221` `TaskPreviewSkeleton` hard-codes the card width

`TaskPreviewSkeleton` uses `style={{ width: 400 }}` and approximates the header/body dimensions,
while the real dimensions are private constants `CARD_MAX_WIDTH = 400` / `CARD_BODY_MAX_HEIGHT = 480`
(TaskPreviewCard.tsx:58,66). The JSDoc at TaskHeatmapTable.tsx:185-189 explicitly warns those card
constants "must NOT be refactored out", which is a brittle cross-file coupling: a width change in
`TaskPreviewCard` will not propagate to the skeleton.

**Fix:** export a shared width token (e.g. from `theme`) or the constant and reference it in both
places.

---

## INCIDENTAL FINDINGS

### (verified consistent — no action) `TaskHeatmapPage.tsx:162-171` loading/error gating

`showAssignmentError = assignmentQuery.isError || assignmentQuery.data === null` and
`isAssignmentLoading = assignmentQuery.isPending`. Because `getAssignment` returns
`AssignmentFull | null` (assignmentAssessment.zod.ts:183) and the query sets `retry: false`
(sharedQueries.ts:144), a not-found resolves to `data: null` with `isError: false`, so:

- pending → skeleton (`isAssignmentLoading` true, `showAssignmentError` false) — no error flash;
- not-found → `cellPreviewLookup` is `null` (line 166) and `showAssignmentError` true → `Alert`;
- the separate `logFrontendEvent('warn', … 'Assignment not found')` branch (lines 184-197) is gated
  on `data === null && !isPending && !isError`, so it fires exactly once on not-found.

This wiring is internally consistent; flagged only for visibility.

### (verified consistent — no action) cross-module key spaces

The lookup is keyed by `submission.studentId` (buildCellPreviewLookup.ts:77) and `item.taskId`
(buildCellPreviewLookup.ts:69-73), and consumed via `record.studentId` (HeatmapRow.studentId,
heatmapAdapter.ts:45) and `taskColumn.taskId` (HeatmapTaskColumn.taskId, heatmapAdapter.ts:58-60).
`StudentSubmissionItemSchema.taskId` exists (assignmentAssessment.zod.ts:86), so `item.taskId` is
valid. The two view models share the same `studentId`/`taskId` identifier spaces — consistent.

---

## Checks that passed

- `StudentSubmissionItemSchema` has its own `taskId` (assignmentAssessment.zod.ts:86) — `item.taskId`
  usage is correct (not a `item.artifact.taskId` mistake).
- `AssessmentSchema = { score: number; reasoning: string }` (assignmentAssessment.zod.ts:21-24)
  exactly matches `createCellPreviewData`'s `assessments` parameter type.
- SPREADSHEET content is `Array<Array<string | number | null>> | null` (assignmentAssessment.zod.ts:54),
  matching the `coerceArtifactContent` cast target.
- No dangling imports of the deleted `taskPreviewFixtures`/`getTaskPreviewData` remain in `src/`;
  `TASK_PREVIEW_CARD_LAYOUT.md` references were fully removed.
- No British-English deviations found in the changed files (`center` occurrences are Ant Design
  API values, not prose).
- All changed files are well under the 500-line limit.

---

**Reminder to the calling agent:** You must address **all** in-scope review items and then
resubmit to the reviewer until the review comes back clean.
