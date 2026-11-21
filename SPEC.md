# Class assessment summary metadata (baseline averages and student standings) Specification

## Status

- Draft v1.2 — revised after independent review: single owner for target selection and rolling history defined, helper-level mechanism for isolated baseline scores specified, `AssignmentSummaryAnalyser` accounted for, list alignment and overlap rules fixed, and wording corrections applied. All product questions resolved; no open questions remain.

## Purpose

This document defines the intended behaviour for extending the ABClass assessment-summary snapshot (`metadata`) with baseline-mode class averages and top/bottom-three student standings, and for recording those values from the existing post-analysis metadata-refresh task.

The feature will be used to:

- Preserve the existing all-task class and recent-assignment averages unchanged.
- Record the class average computed from the baseline task set — the tasks attempted by every student in the top tenth of the roster by attempted-task count.
- Record which students rank highest and lowest by their overall composite score, in both the all-task and baseline bases, together with their names, full criterion scores and full scores for the latest three assignments.
- Keep existing classes readable after the shape changes, by normalising old-shape stored snapshots on the backend read path.
- Give `DataAnalysisService` a single authoritative owner for all of the above calculation, so later changes to analysis logic flow through to metadata without a second calculation to reconcile.

This feature is **not** intended to:

- Change how any value is displayed in the UI. No production component currently renders metadata scores, and this feature adds no rendering.
- Add a new analysis mode or change the existing `topDecileBaseline` derivation, its pool rule, or its task-key intersection rule.
- Duplicate averaging, weighting, attempt detection or metric rollup logic outside the data-analysis service.
- Change the metadata freshness trigger (newest-assignment timestamp gate).
- Change who owns freshness decisions or rolling assignment history: those remain with the writer/projection owner.
- Persist the baseline pool student IDs or baseline task keys; they remain an internal derivation.
- Change the baseline pool fraction, weighted scoring, criterion weightings, or score rounding.
- Make the backend calculate, refresh, or backfill metadata; it remains a frontend-supplied snapshot validated and stored by the backend.

## Agreed product decisions

1. The single `ABClassMetadata` shape is shared by the ABClass full document and the `abclass_partials` registry; there is no separate `ABClassPartials` metadata model.
2. Three fields are added: `baselineAverages`, `allTaskStandings` and `baselineStandings`. Each is nullable in the persisted and transport shape. `null` covers both "legacy snapshot not yet regenerated" and "baseline not computable for this class".
3. Backend normalisation owns legacy compatibility. `ABClassMetadata.validateMetadata()` accepts the legacy two-field shape and the current five-field shape; `ABClass.toJSON()` and `ABClass.toPartialJSON()` always emit the current five-field shape via the same owner, inserting `null` for absent new fields. Normalisation happens in memory on read; reads never write, repair or backfill stored records.
4. Frontend Zod mirrors that contract: `ABClassMetadataSchema` accepts legacy and current inputs and emits the current five-field shape with `null` placeholders. Mutation requests validate the emitted current shape.
5. Every new write emits the full current shape. `allTaskStandings` is always non-null on a new write (an empty standings object when nobody is rankable); `baselineAverages` and `baselineStandings` are null only when baseline mode is unavailable.
6. "Baseline" means the existing `topDecileBaseline` analysis mode: pool = top `min(|candidates|, max(2, ceil(0.1 × rosterSize)))` students by distinct attempted task keys (ties by `studentId` ascending); baseline task keys = intersection of the pool's attempt sets.
7. The baseline is derived once from the full-class analysis and reused for every recent-assignment score. Isolated assignment analyses do not derive their own pool or baseline task set.
8. Baseline unavailability is the documented `deriveAttemptBaseline` failure — roster below 3 students, fewer than 2 attempt candidates, or an empty pool intersection, signalled as in decision 16. Those cases produce `baselineAverages: null` and `baselineStandings: null`; the refresh still succeeds and still writes the all-task fields. All other failures propagate.
9. Standings are ranked by the student's `overall` composite metric (`perStudent.overall`). Only finite numeric values are rankable; `'N'`, `'E'` and `'excluded'` are not ranked. Top is descending, bottom is ascending, ties break by `studentId` ascending, and each list holds 0–3 dense entries.
10. Standings are stored separately per basis: `allTaskStandings` (absolute mode) and `baselineStandings` (baseline mode), so the two rankings may differ.
11. The two lists in a basis are disjoint: take the top three first, then the bottom three from the remaining rankable students. Each standing entry carries `studentId`, `studentName`, the full four-score set for that basis, and the full four-score set for each of the three newest assignments in the fresh class (aligned by index to `ClassSummary.recentAssignments`).
12. All score calculation and assembly is owned by a dedicated `classSummary` analyser registered in `DataAnalysisService`. It composes the existing `AveragingAnalyser` and reuses its exported `rollupMetric`, `computeOverallComposite` and `convertToBaselineExcluded` helpers. Per-student task metrics are filtered by `taskKey` against the whole-class baseline set in the analyser; no new averaging or rollup maths is introduced. No averaging logic is added to the metadata writer or any other consumer. Later changes to analysis logic therefore reach metadata through one owner.
13. `DataAnalysisService` exposes `analyseClassSummary(input, options)`, validated by a dedicated `ClassSummarySchema`. The analyser is held in its own `classSummaryAnalyser` field, matching the existing `summaryAnalyser` field pattern; the averaging registry is not widened. The options carry the refresh target and the newest three assignment instances from the fresh class; `DataAnalysisService.analyse(input, 'averaging')` and `analyseAssignmentSummary(...)` remain unchanged.
14. The writer/projection owner (`abClassMetadataService.ts` + `metadataProjection.ts`) keeps freshness decisions and the rolling `recentAssignments` history. It calls `analyseClassSummary()` with the target and newest assignments, then only maps the validated summary into metadata, stamps the summary clock and writes it. `postAnalysisTasks.ts`, `refreshABClassMetadata.ts`, `postAnalysisFeedback.ts` and `postAnalysisInvalidation.ts` are unchanged.
15. `ClassSummary` carries analyser-native four-state `MetricResult` values; conversion to the metadata score union uses the existing `projectAverageScores()` mapping. The analyser does not emit a metadata timestamp.
16. Baseline unavailability is signalled by a dedicated `AttemptBaselineUnavailableError` thrown only for the three documented `deriveAttemptBaseline` failure conditions (roster below 3, fewer than 2 candidates, empty pool intersection). It extends `Error` and keeps the existing messages. `ClassSummaryAnalyser` catches only that type around the baseline-mode analysis and emits `available: false`; every other error propagates. No message matching or broad catch is used. This typed error is the only change to `attemptBaselineSelection.ts`.
17. No frontend layout, navigation, or visible-state change is in scope.

## Existing system constraints

### Backend or API constraints already in place

- `ABClassMetadata` (`src/backend/Models/ABClassMetadata.js`) is the sole backend validation/copy owner. `ABClass` validates and copies metadata in its constructor, `setMetadata()`, `toJSON()`, `toPartialJSON()` and `fromJSON()`; the same owner is used for stored-partial validation and request validation.
- `ABClassValidation._validateRequestMetadata()` gates mutation requests before any read, roster refresh or write; only a typed `ABClassMetadataValidationError` with `inputSource: 'request'` becomes `INVALID_REQUEST`. Invalid stored metadata remains a non-request integrity failure.
- Backend files are concatenated GAS scripts; runtime references to `Validate` and `Assessment` are resolved at call time because `ABClassMetadata.js` sorts before `Models/Assessment.js`. New helper files must respect that load-order model.
- `eslint.config.js` sets `max-lines: 500` for `src/backend/**/*.js` with zero-warning lint gates. Any file in scope must stay at or under that gate.
- `google.script.run` forbids live `Date` values in payloads; metadata timestamps are canonical UTC strings and JsonDbApp revives stored ISO strings as `Date` objects, which stored metadata validation converts back before validation.

### Current data-shape constraints

- Score union: finite number in inclusive range 0–5, or exactly `'N'`, `'E'`, `'excluded'`. No coercion, rounding, or cross-metric inference.
- `recentAssignments` is a dense array of zero to three entries with unique `assignmentId`, non-increasing `updatedAt`, and identifiers that are non-empty already-trimmed strings.
- Metadata is strictly shape-validated today: unexpected own fields are rejected and every listed field is required. Legacy compatibility must be introduced without weakening the current-shape rules.
- Canonical data-shape docs: `docs/developer/data-shapes/abclass.md` (§ Sub-entity: ABClassMetadata) and `docs/developer/data-shapes/frontend-data-analysis-response.md` (§ Attempt-baseline contract changes, § Metadata refresh execution contracts).
- `AnalysisFilterSchema`, `AveragingAnalyserInputSchema` and `DataAnalysisResponseSchema` are unchanged by this feature; the new analyser consumes the existing input and emits a separately validated output.

### Frontend or consumer architecture constraints

- `abClassMetadata.zod.ts` owns the frontend metadata schema; `ClassFullSchema`, `ClassPartialSchema` and the mutation request schemas all reference it.
- `DataAnalysisService` holds a `Map<string, AveragingAnalyser>` for `analyse()` and a separate `summaryAnalyser: AssignmentSummaryAnalyser` field for `analyseAssignmentSummary()`. Both existing entry points must keep working; the new analyser is held in its own `classSummaryAnalyser` field, matching that existing separate-field pattern, so the averaging registry is unchanged.
- `AveragingAnalyser` already emits `perClass`, `perStudent`, `perStudentTaskMetrics` and `attemptBaseline` in baseline mode, and its row/composite helpers are exported for reuse.
- `TaskDisplayMetric` (three states: `computed`, `notAttempted`, `error`) is structurally a subset of the four-state `MetricResult`, so no conversion layer is needed to pass task display metrics to `rollupMetric`.
- The refresh writer currently calls `DataAnalysisService.analyse()` twice and projects `perClass` through `projectAverageScores()`; this is replaced by one `analyseClassSummary()` call.
- No production component reads metadata score values. Class-page cards and tables are computed live from analyser output.
- Frontend files over 550 lines in scope must be decomposed in the same change.

## Domain and contract recommendations

### Why this approach is preferable

- A single analyser owns every calculation, so later analysis changes only need to be made once; the metadata writer cannot drift from the UI calculations.
- Freshness and rolling history stay in their existing owner, so no second decision path is introduced and the "no refresh on score/definition/roster-only change" rule is preserved.
- Reuses the existing baseline derivation and rollup helpers rather than duplicating the ten-percent pool rule or averaging maths.
- Keeps one authoritative metadata shape for both stores and both read paths, so the backend, Zod schemas, generator and parity test stay aligned.
- Backend normalisation is the only option that makes legacy stored snapshots readable without requiring a write before validation and without relaxing a frontend throw into a warning that would still leave backend reads failing.

### Recommended data shapes

#### `ABClassMetadata` (current, after this change)

```ts
type AverageScore = number | 'N' | 'E' | 'excluded';

type AverageScores = {
  completeness: AverageScore;
  accuracy: AverageScore;
  spag: AverageScore;
  overall: AverageScore;
};

type ClassAverages = AverageScores & { updatedAt: string };

type RecentAssignment = {
  assignmentId: string;
  assignmentDefinitionKey: string;
  averages: AverageScores;
  updatedAt: string;
};

type BaselineAverages = AverageScores & { updatedAt: string };

type StudentStanding = {
  studentId: string;
  studentName: string;
  scores: AverageScores;
  recentAssignmentScores: AverageScores[]; // one per supplied recent assignment (zero to three)
};

type StudentStandings = {
  top: StudentStanding[];
  bottom: StudentStanding[];
};

type ABClassMetadata = {
  classAverages: ClassAverages; // existing
  recentAssignments: RecentAssignment[]; // existing
  baselineAverages: BaselineAverages | null;
  allTaskStandings: StudentStandings | null;
  baselineStandings: StudentStandings | null;
} | null;
```

#### `ClassSummary` (service output, in-memory only)

```ts
type MetricScores = {
  completeness: MetricResult;
  accuracy: MetricResult;
  spag: MetricResult;
  overall: MetricResult;
};

type MetricStanding = {
  studentId: string;
  studentName: string;
  scores: MetricScores;
  recentAssignmentScores: MetricScores[];
};

type MetricStandings = { top: MetricStanding[]; bottom: MetricStanding[] };

type ClassSummary = {
  classId: string;
  allTasks: { classAverages: MetricScores; standings: MetricStandings };
  baseline: {
    available: boolean;
    classAverages: MetricScores | null;
    standings: MetricStandings | null;
  };
  target: {
    assignmentId: string;
    assignmentDefinitionKey: string;
    updatedAt: string;
    averages: MetricScores;
  };
  recentAssignments: Array<{
    assignmentId: string;
    assignmentDefinitionKey: string;
    updatedAt: string;
  }>;
};
```

`ClassSummary.recentAssignments` describes the newest three fresh-class assignment instances, in newest-first order; `recentAssignmentScores[i]` aligns to `recentAssignments[i]`. The writer keeps its own persisted rolling list via `mergeClassMetadata()` and uses `summary.target.averages` for the target's class averages. `ClassSummarySchema` is owned by `src/frontend/src/services/dataAnalysis/classSummary.zod.ts` and is not a wire or persistence shape.

#### Analyse options (not a wire shape)

```ts
type AnalyseClassSummaryOptions = {
  target: AssignmentPartial;
  recentAssignments: AssignmentPartial[]; // newest three fresh-class instances, includes target
};
```

Both are supplied by the writer from the fresh class read; the analyser performs no freshness selection.

#### Accepted metadata input shapes

- Legacy input: `{ classAverages, recentAssignments }` — accepted on read and on write; the emitted value has all three new fields set to `null`.
- Current input: all five fields present; each new field may be `null`. A non-null `StudentStandings` has exactly `top` and `bottom`, each a dense array of 0–3 complete `StudentStanding` entries.

### Naming recommendation

Prefer:

- `baselineAverages`, `allTaskStandings`, `baselineStandings`
- `recentAssignmentScores` for the per-student per-assignment score array
- `ClassSummary` / `analyseClassSummary` for the service output and entry point

Avoid:

- `topDecileAverage` (the baseline is a task-set rule, not a student percentile score)
- `topStudents` / `bottomStudents` (the pair is one `StudentStandings` object per basis)
- `overallAverage` for a student entry (the field is the full `AverageScores` set, with `overall` inside it)

### Validation recommendation

#### Frontend

- `ABClassMetadataSchema` accepts legacy and current shapes; `NonNullableABClassMetadataSchema` emits the current five-field shape with `null` placeholders.
- `ClassSummarySchema` is a strict in-memory schema; each analyser declares its own output schema so `analyseClassSummary()` validates with the right one.
- `StudentStanding.studentId` and `studentName` are non-empty strings. A student appears in at most one of `top` and `bottom` per basis. This is guaranteed by the analyser's disjoint selection and asserted by the `ClassSummarySchema` refinement; the persisted metadata validators on both sides deliberately allow duplicates so frontend/backend parity is preserved.
- `recentAssignmentScores.length` equals `recentAssignments.length` (zero to three); no timestamp is stored inside a standing entry.
- Each new nullable metadata field rejects `undefined` when present; true omission is handled by the legacy-input union only.

#### Backend

- `validateMetadata` accepts the legacy two-field shape or the current five-field shape; `validateClassAverages`, `validateStandings` and `validateStandingEntry` enforce the current-shape rules and are owned by `ABClassMetadata` (or its extracted helper module).
- `ABClass.toJSON()` and `ABClass.toPartialJSON()` always emit all five fields via `ABClassMetadata`, with `null` where the input omitted a new field. Legacy stored absence is accepted; present `undefined` for a new field is invalid.
- Request provenance and error adaptation are unchanged: only a typed request-tagged error becomes `INVALID_REQUEST`.

### Display-resolution recommendation

None. No consumer renders these fields in this feature.

## Feature architecture

### Placement

- Backend: `src/backend/Models/ABClassMetadata.js` remains the facade and single validation/copy owner; new nested validators move to a dedicated sibling module to stay under the 500-line lint gate. `ABClass.js`, controllers, `z_Api` handlers and `ALLOWLISTED_METHOD_HANDLERS` are unchanged.
- Frontend analysis: new `classSummaryAnalyser.ts` and `classSummary.zod.ts` under `src/frontend/src/services/dataAnalysis/`, registered in `DataAnalysisService`. The analyser composes `AveragingAnalyser` and reuses the exported helpers; it owns ranking and per-assignment assembly.
- Frontend schema: `src/frontend/src/services/abClass/abClassMetadata.zod.ts` owns the new metadata schemas and types.
- Frontend writer: `abClassMetadataService.ts` selects the target and newest assignments, calls `analyseClassSummary()`, maps the summary into metadata via `mergeClassMetadata()` and writes it. `metadataProjection.ts` no longer runs its own analysis or projects `perClass`; it retains the `projectAverageScores()` mapping used by `mergeClassMetadata()`.
- `postAnalysisTasks.ts`, `refreshABClassMetadata.ts`, `postAnalysisFeedback.ts` and `postAnalysisInvalidation.ts` are unchanged.

### Proposed high-level tree

```text
postAnalysisTasks.ts (unchanged)
└── refreshABClassMetadata.ts (unchanged)
    └── abClassMetadataService.ts (writer; no calculation)
        ├── getMetadataRefreshDecision(classFull)              → target
        ├── newestThreeAssignments(classFull)                  → recentAssignments option
        ├── DataAnalysisService.analyseClassSummary(input, options)
        │   └── ClassSummaryAnalyser
        │       ├── AveragingAnalyser: absolute full class      → classAverages
        │       ├── AveragingAnalyser: baseline full class      → baselineAverages + pool/task keys
        │       ├── AveragingAnalyser: isolated absolute per recent assignment
        │       │   └── whole-class baseline restriction via rollupMetric + computeOverallComposite
        │       ├── disjoint ranking + per-assignment assembly  → both standings
        │       └── ClassSummarySchema.parse
        └── mergeClassMetadata(previous, summary, now())        → five-field snapshot
```

### Out of scope for this surface

- Rendering the new values anywhere in the UI.
- Changing the analysis input schemas or adding a new analysis mode.
- Changing the post-analysis feedback, invalidation or attempt-identity contracts.
- Adding averaging logic outside `DataAnalysisService`.
- Changing `analyseAssignmentSummary()` or `analyse(input, 'averaging')`.

## Data loading and orchestration

### Required datasets or dependencies

- Fresh validated `ClassFull` from `getABClass()` (existing writer behaviour).
- Live `assignmentDefinitionPartials` registry (existing writer behaviour).
- The existing `AveragingAnalyserInput` shape; no new input field is added.
- `AveragingAnalyser` output in absolute and baseline modes, plus isolated per-assignment absolute output.

### Prefetch or initialisation policy

No change. The writer's existing fresh-read-in-lane policy is retained. The freshness gate still compares the newest assignment timestamp against stored `recentAssignments`; a new field's presence or value never triggers a refresh.

### Query or transport additions

None. The write still uses `updateABClass` with `UpdateABClassRequestSchema`; the backend stores the supplied snapshot. No new endpoint, handler or query key is introduced.

## Core derivation model

### Suggested shape

The service output is `ClassSummary` (above). Its derivation rules are owned entirely by `ClassSummaryAnalyser`.

### Derivation or merge rules

#### Baseline selection

- Run the existing `AveragingAnalyser` with `analysisMode: 'topDecileBaseline'` on the full class. Read its `attemptBaseline.poolStudentIds` and `baselineTaskKeys` as the single baseline for all baseline fields; do not re-derive them in the summary analyser.
- Catch only `AttemptBaselineUnavailableError` around that analysis; on that failure emit `available: false` with null averages and standings, and skip isolated baseline assembly. Any other thrown value propagates unchanged. The error is thrown by `deriveAttemptBaseline` for exactly the three documented conditions, and its messages are unchanged.

#### Class averages and target

- `allTasks.classAverages` comes from the full-class absolute `perClass` result; `baseline.classAverages` from the full-class baseline `perClass` result. Both stay as analyser-native `MetricResult` values.
- `summary.target.averages` comes from the isolated absolute analysis of the target, projected to `MetricScores`; it feeds the existing rolling `recentAssignments` entry.

#### Isolated baseline per-assignment scores

- Run the existing `AveragingAnalyser` in absolute mode for each supplied recent assignment; take its `perStudentTaskMetrics`.
- For each student, filter their metrics by `taskKey` against the whole-class baseline key set in the analyser (a plain list filter; the accumulator-map helper does not apply to display metrics).
- Roll up each criterion from those metrics with `rollupMetric(values, criterion)` and derive `overall` with `computeOverallComposite()` using the constructor weights. `TaskDisplayMetric` values are valid `MetricResult` inputs, so no conversion layer is needed.
- If a student has no baseline metrics, roll up their unfiltered metrics and apply `convertToBaselineExcluded` to the criterion results before deriving `overall`, preserving the analyser's baseline exclusion semantics.
- No isolated analysis runs in baseline mode, so no fresh pool or baseline is derived there.

#### Standings ranking

- From the relevant `perStudent` rows, keep those whose `overall.state === 'computed'`. Sort by the numeric `overall` value: top descending, bottom ascending, ties by `studentId` ascending.
- Take the top three, then take the bottom three from the remaining students, so the lists are disjoint. Rows with a non-numeric `overall` state are not ranked.
- A student's `scores` is their projected four-metric set for the basis; `recentAssignmentScores[i]` aligns by index to `summary.recentAssignments[i]`.

#### Merge rule

- `mergeClassMetadata()` continues to own the persisted rolling `recentAssignments` history, target replacement, newest-first ordering, uniqueness and the summary timestamp. It now accepts a `ClassSummary` and maps its metric values through `projectAverageScores()`; the existing history rules are unchanged.

## Workflow specification

## Metadata refresh with enriched snapshot

### Eligible inputs or preconditions

- A successful validated averaging run has committed, and the post-analysis task owner has computed a fresh class/source attempt key.
- The fresh full class read returns a class with at least one assignment; otherwise the existing `noAssignments` skip applies.
- All assignments resolve to live definitions; otherwise the existing coverage failure propagates.

### Behaviour

- The writer selects the target with the existing freshness decision and the newest three fresh-class assignment instances, then calls `DataAnalysisService.analyseClassSummary()` once.
- The summary analyser runs the absolute and baseline full-class analyses, the isolated absolute analysis for each recent assignment, and assembles both standings with disjoint ranking.
- If baseline mode is unavailable as defined in decision 8, the summary carries `available: false` with null baseline fields, and the all-task fields are still produced.
- The writer maps the validated summary into the current-shape metadata, stamps the summary clock, validates the whole replacement and enqueues the existing `updateABClass` mutation.
- The response is parsed through `ClassPartialSchema`; a saved outcome is reported exactly as today.

### Success rule

- One validated current-shape snapshot is persisted to both stores, with `classAverages`, `recentAssignments` and `allTaskStandings` populated and `baselineAverages`/`baselineStandings` populated or null.

### Failure rule

- Calculation, validation, read/write and coverage failures propagate exactly as today; no repair, rollback or partial write is introduced.
- Baseline unavailability is not a failure; it is represented by nulls.

## Legacy read normalisation

### Behaviour

- On every read projection (`getABClass`, `getABClassPartials`, mutation summaries), a stored metadata value with only the legacy two fields is accepted by `ABClassMetadata` and emitted with `baselineAverages: null`, `allTaskStandings: null`, `baselineStandings: null`.
- Stored current-shape values are validated and copied exactly as stored.
- Present invalid values, including a present `undefined` for a new field, still fail as integrity errors. No stored byte is changed by a read.

## Error, loading, and empty-state rules

### Blocking failure

- Invalid stored metadata continues to fail the whole read as a non-request integrity error; the row is not dropped or repaired.
- Invalid request metadata continues to return `INVALID_REQUEST`; it applies none of the request's other fields.

### Partial-success state

- Baseline unavailability yields null baseline fields with a fully populated all-task snapshot. No warning to the user is introduced by this feature.

### Empty states

- Fewer than six rankable students produces shorter dense standing lists; fewer than three produces empty lists.
- Fewer than three fresh-class assignments produces a shorter `recentAssignments` summary array and equally short `recentAssignmentScores` arrays.

## Accessibility and usability notes

None. No visible surface changes.

## Backend changes required to support agreed behaviour

1. Extend `ABClassMetadata` validation to accept legacy and current shapes, validate the three new fields, and always emit the current five-field shape via `ABClass` serialisation. Extract nested validators into a dedicated sibling module to stay under the 500-line lint gate.
2. Keep `ABClass` construction, replacement and serialisation calling the same owner; no changes to its metadata call sites beyond what the new emitted shape requires.
3. Keep request provenance, transport error adaptation and stored-integrity failure handling unchanged.

## Planning handoff notes

- No frontend layout spec is required: the feature stores data only, and no production component renders metadata values.
- Canonical data-shape docs must be updated before the action plan is finalised: `docs/developer/data-shapes/abclass.md` (legacy/current shape, null normalisation, new field rules) and `docs/developer/data-shapes/frontend-data-analysis-response.md` (the new in-memory `ClassSummary` contract, baseline field reuse, whole-class baseline for isolated assignments, and the enriched writer outcome). Planned entries are already recorded as `Not implemented` and must be reconciled during delivery.
- Canonical fixture impact: `scripts/synthetic-test-data/generateClassMetadata.js` and `validateClassMetadata.js` must emit and validate the new fields; committed `small`, `medium` and `large-representative` `classPartials.json` and `classesById.json` must be regenerated through the CLI. `tests/synthetic-analysis/syntheticABClassMetadataFrontendParity.test.ts` and the round-trip suite must cover both legacy and current shapes. No new profile or view is required, and no profile rescale or generator extension is needed. Baseline eligibility was verified during planning by running the real `deriveAttemptBaseline` and `DataAnalysisService.analyse()` over the committed fixtures: all three historical-source refresh fixtures are eligible — `small`/`class-2` (roster 6, 4 candidates, pool 2, 2 baseline keys), `medium`/`class-0` (12, 10, 2, 6 keys) and `large-representative`/`class-1` (6, 4, 2, 4 keys). Every compact class is eligible in both untouched and historical-source form, and `dataAnalysis.mediumBaselineRoundTrip.spec.ts` already pins the medium baseline claims; `medium` is the clearest canonical choice for new baseline tests. The refresh fixture helper actually removes the last array element (`assignment-2-3`, `assignment-0-5`, `assignment-1-4`) although `synthetic-test-data.md` names the preceding IDs; both interpretations remain eligible, so the discrepancy does not block planning.
- Single-owner guarantee: no averaging or rollup logic may be added outside `DataAnalysisService`; the summary analyser calls `AveragingAnalyser` and reuses its exported helpers. Freshness and rolling history remain in `metadataProjection.ts`/`abClassMetadataService.ts`.
- The existing freshness gate is deliberately unchanged; new fields refresh only on the same assignment-timestamp trigger.
- `@postAnalysisFeedback.ts` is out of scope despite the initial request naming it; the user confirmed the existing refresh task owns the write.
- Module sizing and file-separation sequencing belong in `ACTION_PLAN.md`; the binding constraints are the 500-line backend lint gate and the 550-line frontend decomposition rule.

## Testing expectations

- Backend: `ABClassMetadata` legacy/current validation, null normalisation through `ABClass.toJSON()`/`toPartialJSON()`, nested validator boundaries, request-provenance adaptation, and parity with the frontend schema through `syntheticABClassMetadataFrontendParity.test.ts`.
- Frontend analysis: `ClassSummarySchema` boundaries; summary analyser composition with `AveragingAnalyser`; disjoint ranking order, tie-break, marker exclusion and 0–3 list lengths; `AttemptBaselineUnavailableError` for the three documented failures producing nulls while other errors propagate; whole-class baseline restriction for isolated scores using the stated helper flow; per-assignment score alignment; and regressions that `analyse(input, 'averaging')` and `analyseAssignmentSummary()` are unchanged.
- Frontend writer/schema: legacy input normalisation, summary-to-metadata mapping, rolling history unchanged, and writer regression with existing post-analysis suites.
- Synthetic: regenerate committed metadata views, verify byte reproducibility, and extend the round-trip suite for the new shape.
- No E2E tests: no user-visible change.
- No relaxation of realism or type-matching gates in shared harnesses; unsupported cases stay as local boundary probes.

## Documentation and rollout notes

- Canonical docs to update in the same change: `docs/developer/data-shapes/abclass.md`, `docs/developer/data-shapes/frontend-data-analysis-response.md`, `docs/developer/frontend/data-analysis-architecture.md`, `docs/developer/testing/synthetic-test-data.md`, and the backend/frontend shared-helper docs where new helpers are recorded.
- Rollout: existing classes keep legacy stored bytes until a refresh writes the current shape; reads normalise in memory. No migration job, config, or reset is required.
- Deferred follow-ups (not in v1): rendering the new values in the UI, and storing the baseline pool or task keys for traceability.

## V1 scope recommendation

### Include in v1

- Backend legacy-tolerant validation and current-shape emission, with file separation.
- Frontend Zod schema extension with legacy normalisation.
- `ClassSummary` analyser and schema registered in `DataAnalysisService`, composing `AveragingAnalyser` and reusing its helpers, with disjoint ranking and per-assignment assembly.
- Writer changes to consume the summary and map it into all five metadata fields, with baseline-unavailability null handling; freshness and rolling history unchanged.
- Synthetic generator/validator extension, fixture regeneration and parity/round-trip updates.
- Backend and frontend unit coverage; documentation updates.

### Defer from v1

- Any UI display of the new metadata.
- Persisting the baseline pool IDs or baseline task keys.
- Changing the metadata freshness trigger.
