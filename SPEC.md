# Student Name Forename/Surname Split Specification

## Status

- Draft v1.0

## Purpose

This document defines the intended behaviour for splitting a student's displayed name into separate Forename and Surname columns in frontend tables.

Throughout this document the British spelling "honourific" is used.

The feature will be used to:

- Present student names as two distinct columns (Forename, Surname) wherever a student name column is displayed.
- Keep backend name persistence untouched; the split is derived live on the frontend.

This feature is **not** intended to:

- Add column drag-and-drop reordering (dropped: Ant Design Table has no native support and the documented approach requires dnd-kit plus substantial custom code).
- Persist any column or display preference anywhere (session-only React state; dropped alongside dragging).
- Change how names are stored, transported, or validated by the backend.

## Agreed product decisions

1. The single stored `studentName`/`name` string is split on screen: **first whitespace-separated token = Forename; the remainder (joined by single spaces) = Surname**.
2. If the stored name has no whitespace, the whole string is the Forename and Surname renders as an empty string.
3. No column reordering UI of any kind is added in this feature (explicitly dropped after consulting Ant Design v6 documentation).
4. The split applies to both existing tables that render student names and is **documented as a standing requirement for all future tables containing a student name column**.
5. The transport shape (`StudentSummary.name`, `PerStudentRow.studentName`, etc.) is unchanged; Zod schemas at the transport boundary are untouched.

## Existing system constraints

### Backend or API constraints already in place

- The backend returns a single display-name string per student (`name` in `ClassFull.students`, `studentName` in analysis rows). No backend or API changes are permitted or required.

### Current data-shape constraints

- Follow `docs/developer/data-shapes/INDEX.md`: because no persistence/transport shape changes, no canonical data-shape updates should be required; verify during implementation and update the data-shapes docs only if a review finds a contract is touched.

### Frontend or consumer architecture constraints

- Tables render via Ant Design `Table` (`antd` v6), canonical usage in `studentAveragesTableColumns.tsx` and `TaskHeatmapTable.tsx`.
- Existing shared comparator `compareStudentNames` sorts on the full name string with a `studentId` tie-break and must keep working for default ascending sort.
- Honourifics (e.g. "Miss") are **not** special-cased at display time: they are not typically stored in Google Classroom, so the first-token rule applies to any leading honourific without adjustment.

## Domain and contract recommendations

### Why this approach is preferable

- A single shared split helper avoids duplicated tokenisation logic in two features (shared-helpers standard applies).
- Deriving columns at render time keeps the backend contract untouched and testable in isolation.

### Recommended data shapes

No change to stored or transported shapes. Recommended frontend-only derived shape:

```ts
{
  forename: string, // first whitespace-separated token (empty string if name is empty)
  surname: string,  // remaining tokens joined by single spaces (empty string if only one token)
}
```

## Feature architecture

### Placement

- Shared split helper: a frontend shared helper module under `src/frontend/src/utils/` (subject to `frontend-shared-helpers-and-abstraction-standards.md`; this is a new helper as none exists).
- Consumers: `features/classPage/studentAveragesTableColumns.tsx` (+ `StudentAveragesTableCard.tsx` data flow via `classPageAdapter.ts`) and `features/taskHeatmap/TaskHeatmapTable.tsx` (+ `taskHeatmapTableColumns.tsx` row model, adapters in `services/dataAnalysis/heatmapAdapter*.ts`).
- No duplicate per-feature name-splitting logic is permitted.

## Main user-facing surface specification

### Fields, columns, or visible sections

1. Replace the single "Student Name" column with two adjacent columns: "Forename" then "Surname", in both tables.
2. Column widths: preserve the original 200px student-name pair total using the shared tokens `APP_COL_WIDTH_FORENAME` and `APP_COL_WIDTH_SURNAME` in `src/frontend/src/theme/spacing.ts` (the single `APP_COL_WIDTH_STUDENT_NAME` token is removed; follow the spacing/width standards doc).

### Sorting rules

- The two new columns are titled **Forename** and **Surname**, replacing the single "Student Name" column in all in-scope tables; E2E and unit assertions must target these titles.
- Default sort remains full-name ascending (existing `compareStudentNames`, downstream adapter pre-sort unchanged) so initial order is unchanged.
- Forename column sorts by forename; Surname column sorts by surname, each using a comparator built from the split helper (deterministic `studentId` tie-break preserved for testability). Existing multi-sort priorities are preserved.
- Class-page sort plumbing (`classPageModel.ts` inline `column: 'studentName' | MetricColumnKey` type, `DEFAULT_SORT = { column: 'studentName', direction: 'asc' }`, the `studentName` sort branch) must be reworked onto the new keys: existing `studentName` sort-key entries replaced by forename/surname sort keys, and the clear-sort/reset fallback continues to resolve to **full-name ascending order** (via the unchanged `compareStudentNames` ordering). The only named `SortColumn` type lives in `StudentAveragesTableCard.tsx` (duplicate `SortColumn` at line ~76 with `normaliseSorter` reset logic).

### Rendering rules

- Names render as plain `<Typography.Text>` as today; metric-cell aria-labels keep using the full name string (forename + surname joined by a space) so screen-reader behaviour does not lose information.

## Error, loading, and empty-state rules

- Empty/missing name strings simply produce two empty column cells; no fallbacks, defaults, or warnings are introduced (no-defaults rule).

## Backend changes required to support agreed behaviour

1. None.

## Testing expectations

- Frontend unit/component tests: split helper edge cases (0, 1, 2, multi-token names, extra internal spaces collapse to single spaces in surname); column definitions render Forename/Surname with correct sorters in both tables; `classPageModel` sort-state tests.
- Playwright E2E: `task-heatmap.spec.ts` (asserts the literal 'Student Name' column header), `heatmaps.spec.ts` (merged-heatmap full-name aria-labels) updated to new titles; `navigation-screenshots.spec.ts` snapshots for the two affected surfaces regenerated via `--update-snapshots` (per-snapshot tolerance check, not relying on `maxDiffPixelRatio: 0.1`).
- Fixtures: use `scripts/synthetic-test-data/` (Faker, seeded). The generator must emit honourific-free names (see Existing system constraints); update the generator and regenerate committed profiles as part of this feature. Synthetic generator fixture conventions per `docs/developer/testing/synthetic-test-data.md`.

## Documentation and rollout notes

- Add the standing requirement ("all tables displaying a student name show Forename and Surname, derived via the shared split helper") to the frontend shared-helpers canonical doc and the frontend `AGENTS.md` signpost.
- Record the two canonical consumer tables in the canonical doc entry.

## V1 scope recommendation

### Include in v1

- Shared split helper + Forename/Surname columns in Student Averages and Task Heatmap tables.
- Sorting per split column; default full-name ordering unchanged.
- Fixture updates via the synthetic data generator; unit + e2e coverage.
- Documentation entry standing the requirement for all future tables.

### Defer from v1

- Any column-reordering interaction (dropped).
- Honourific-aware parsing or locale-specific name conventions.

## Open questions

- None.
