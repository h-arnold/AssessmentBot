# Code Review — classPage preview-card utilities (feat/PreviewCardWiring)

**Reviewer:** Code Reviewer agent
**Scope:** `buildCellPreviewLookup.ts`, `spreadsheetToMarkdownTable.ts`, `assembleTaskPreviewData.ts`, `assembleTaskPreviewData.spec.ts`, and the `BaseTaskArtifactSchema` (lines 40-60) that the changes depend on.
**Verdict:** NEEDS IMPROVEMENT (no blocking/Critical issues; all automated checks green)

## Automated checks

- `npm run lint:frontend` → 0 errors (1 pre-existing unrelated warning in `src/frontend/src/services/apiService.spec.ts:304` — magic number `-1`; not in scope).
- `npm exec tsc -- -b src/frontend/tsconfig.json` → exit 0 (clean).
- `vitest run` on the three relevant specs → 35 passed (assembleTaskPreviewData 16, buildCellPreviewLookup 14, spreadsheetToMarkdownTable 5).
- Invariant confirmed against backend: `StudentSubmissionItem.assessments` is keyed by `completeness`/`accuracy`/`spag` (see `SheetsAssessor.js:63-65`, `LLMRequestManager.js:241`), so `assessments[key]` with `key ∈ HEATMAP_METRIC_KEYS` is a valid direct lookup.

---

## Summary of changes reviewed

- `buildCellPreviewLookup.ts`: `ArtifactType` now derived from `BaseTaskArtifactSchema`; `CellPreviewData` is now a discriminated union keyed on `artifactType` (so `artifactContent` narrows); comment added about the reasoning invariant.
- `spreadsheetToMarkdownTable.ts`: `cell == null` instead of `cell === null`; ragged-row padding via `Math.max(...rows.map(r => r.length))`.
- `assembleTaskPreviewData.ts`: exhaustive `default`/`never` assertion; `coerceSpreadsheetContent` helper with fail-fast `TypeError` validation; IMAGE null throws `TypeError`; null-cell branch now returns `metricScore: 'N'`/`metricState: 'notAttempted'` (Fix D); `as` cast removed (handled by narrowing).
- `assembleTaskPreviewData.spec.ts`: `as CellPreviewData` cast added to the `cellData` test helper.

---

## Critical

None.

---

## Improvement

### I1 — Orphaned/duplicate JSDoc block in `assembleTaskPreviewData.ts` (lines ~92-102)

When `coerceSpreadsheetContent` was extracted and inserted between `coerceArtifactType` and `coerceArtifactContent`, the _original_ `coerceArtifactContent` JSDoc block was left behind. It now sits immediately above `coerceSpreadsheetContent` and is misleading:

```ts
/**
 * Coerce the artifact content from `unknown` to the `string` expected by
 * `TaskPreviewData`.
 *
 * - `SPREADSHEET` content is converted through `spreadsheetToMarkdownTable`.
 * - `base` content always yields ``.
 * - `TEXT`, `TABLE`, and `IMAGE` content is safely stringified.
 * @param {CellPreviewData} cellData - ...
 * @returns {string} A string representation of the artifact.
 */
```

This block (a) documents the wrong function, (b) describes the _old_ `unknown`-in signature that `coerceArtifactContent` no longer has, and (c) lists behaviour (`TEXT/TABLE/IMAGE stringified`) that `coerceSpreadsheetContent` does not perform. `coerceArtifactContent` already has its own correct JSDoc at lines ~122-133.

**Fix:** delete the stale block at lines ~92-102 so the only JSDoc preceding `coerceSpreadsheetContent` is the `Validate and convert SPREADSHEET artifact content.` one.

### I2 — Test coverage gap: new fail-fast branches untested

The new `TypeError` validation in `assembleTaskPreviewData.ts` is not exercised by any spec:

- `coerceSpreadsheetContent` throws when content is `null` (and when it is not a 2D array).
- `coerceArtifactContent` throws `TypeError('IMAGE artifact content is null')`.

Add tests asserting these throw (e.g. `cellData('SPREADSHEET', null)` and `cellData('IMAGE', null)`). Per the review checklist, new logic should be covered before merge.

### I3 — Test assertion gap: Fix D (null-cell override) not asserted

Fix D changed the null-`cellData` branch to return `metricScore: 'N'` and `metricState: 'notAttempted'` _instead of_ forwarding the metric result. The existing null-cell test only checks `artifactType`, `artifactContent`, and `reasoning`:

```ts
it('handles null cellData with TEXT type and empty content and reasoning', () => {
  const result = assembleTaskPreviewData(
    null,
    computedMetric(NULL_CELL_SCORE),
    'completeness',
    'task-6'
  );
  expect(result.artifactType).toBe('TEXT');
  expect(result.artifactContent).toBe('');
  expect(result.reasoning).toBe('');
});
```

It uses a `computed` metric but never asserts the new override. Add `expect(result.metricScore).toBe('N')` and `expect(result.metricState).toBe('notAttempted')` (ideally also a variant with a `computed`/`error` metric to prove the override wins over the forwarded value).

### I4 — Misleading comment in `buildCellPreviewLookup.ts` (Fix C, lines ~60-66)

The added comment says:

> `assessments` is keyed by backend metric names (which may include the heatmap metric keys like `completeness`, `accuracy`, `spag`). `HEATMAP_METRIC_KEYS` maps those to their specific keys.

This implies a transformation/mapping that does not exist. The backend `assessments` record is keyed by **the same** names (`completeness`/`accuracy`/`spag`), which are exactly `HEATMAP_METRIC_KEYS`; the code does a direct `assessments[key]` lookup, not a remap. Reword to avoid implying a transformation, e.g.:

> `assessments` is keyed directly by the heatmap metric names (`completeness`, `accuracy`, `spag`) — the same keys as `HEATMAP_METRIC_KEYS`. A missing key yields `null` reasoning.

---

## Nitpick

### N1 — `as CellPreviewData` cast remains in `createCellPreviewData` (`buildCellPreviewLookup.ts:67`)

The discriminated union is now consumed correctly in `assembleTaskPreviewData` via narrowing, but `createCellPreviewData` still builds a plain object (`artifactContent: unknown`) and casts `as CellPreviewData`. This discards the discriminant narrowing at the type level (sound at runtime because the actual data is correct). A cleaner, fully type-safe alternative is to pass the whole `item.artifact` (a `BaseTaskArtifactSchema` discriminated member) into `createCellPreviewData` so it can narrow internally and build the per-member shape without a cast. Not blocking — the current code is correct.

---

## Notes / non-issues

- No `console.*` calls, no empty `catch`, British English used throughout, no `src/backend` runtime imports, `App.tsx` untouched, `@ant-design/v5-patch` not introduced. All module-frontend checklist items satisfied.
- `coerceArtifactContent` dropping the previous `String(...)` wrapper is correct: TEXT/TABLE/IMAGE content is `string | null` per the schema, so `?? ''` is sufficient and avoids accidental coercion.
- Playwright E2E: these are pure utility changes; the only user-visible behaviour change is the null-cell card now rendering `notAttempted`/`N`. Confirm the existing preview-card E2E still passes for the null-state (and add coverage if none exists) — not blocking since unit behaviour is verified.

## Files read

Mandatory:

- `src/frontend/src/features/classPage/buildCellPreviewLookup.ts`
- `src/frontend/src/features/classPage/spreadsheetToMarkdownTable.ts`
- `src/frontend/src/features/classPage/assembleTaskPreviewData.ts`
- `src/frontend/src/features/classPage/assembleTaskPreviewData.spec.ts`
- `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` (lines 40-60)

Supporting context:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricDisplayMeta.ts` (verifies `HEATMAP_METRIC_KEYS` = `completeness`/`accuracy`/`spag`)
- `src/frontend/src/features/classPage/TaskPreviewCard.tsx` (verifies `TaskPreviewData` contract)
- Backend invariants: `src/backend/Assessors/SheetsAssessor.js` (63-65), `src/backend/RequestHandlers/LLMRequestManager.js` (239-242), `src/backend/Models/StudentSubmission.js` (49-57)
- Other consumers confirming the discriminated-union change compiles: `buildCellPreviewLookup.spec.ts`, `TaskHeatmapTable.spec.tsx`
