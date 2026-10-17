# Frontend ABClass Metadata and Shared Post-Analysis Tasks Specification

## Status

Planning complete with independent clean specification, layout and action-plan
reviews, 17 October 2026. No production implementation is authorised by this
planning request. This is a separate frontend workstream; preserve the unfinished
root `ACTION_PLAN.md` and the backend specification at `docs/plans/SPEC.md`.

## Purpose

Consume and write the backend ABClass metadata contract without schema drift, and
provide one shared, extensible post-analysis hook. Its first task maintains compact
class averages and a rolling history of up to three distinct assignment averages.

## Agreed product decisions

1. Refresh after successful averaging analysis, not after assessment admission.
   `startAssessmentRun` only schedules a trigger. There is no trustworthy completion
   API today; no polling or ProgressTracker work is included.
2. Integrate the same shared hook into the Class page and standalone Heatmaps
   analysis owners. Run effects after commit, never inside `useMemo`, render,
   `DataAnalysisService.analyse()` or a pure analyser.
3. Use the newest assignment in the **complete class's assignment partials** as the
   interim target, regardless of the heatmap selection. This supersedes the initial
   preference for an explicitly assessed target, following the user's clarification.
4. The cheap freshness gate compares target `assignmentId` and its partial
   `updatedAt` with the corresponding stored recent entry. An identical timestamp
   means no calculation or write is needed. Do not compare scores, definition
   changes, filters or class-summary timestamps to manufacture a refresh.
5. When metadata is null, calculate full-class averages and exactly one target
   assignment average. Do not backfill other historical assignments.
6. Replace a target already present by assignment ID; otherwise add one entry.
   Keep the three newest assignment timestamps, evicting the oldest if necessary.
   Reusable definition keys do not identify assignment instances.
7. Preserve usable analysis if post-analysis work fails; expose structured task
   failure, log diagnostics, and display a non-blocking warning notification.
8. Use the existing queued API infrastructure for ABClass writes. Its FIFO is
   per job name, not global. Share the existing `classesBulkMutation` lane with
   class writes; protect the complete read/check/calculate/merge/write operation
   from same-lane interleaving, not only the final network request.
9. Session-local serialisation is sufficient. The user explicitly rejected extra
   cross-session concurrency protection as disproportionate for current usage.
10. Keep `DataAnalysisService` synchronous and free of I/O. The shared hook owns
    the post-run lifecycle and is the documented extension point for future tasks.

## Existing system constraints

- `callApi` remains the sole frontend transport boundary to backend `apiHandler`.
  Keep envelope parsing, retries, authorisation and request tracking unchanged.
- Backend metadata model/persistence support is partially implemented in another
  worktree. Frontend delivery requires the completed backend request and response
  contract, not the unfinished mapper/transport code in this checkout.
- `ClassFullSchema` and `ClassPartialSchema` currently strip metadata. Both must
  instead require the same shared nullable metadata schema on successful reads.
- Legacy persistence absence is normalised to null by the **backend**. Missing
  response metadata is a contract failure, not a frontend default or rollout shim.
- Heatmaps analyses selected assignment instances. Such a result cannot be stored
  as full-class averages. Its hook receives the unsliced full class separately.
- Existing analyser task identities are definition-scoped. An assignment average
  must isolate one assignment instance before analysis, even when definitions repeat.
- No backend runtime imports in frontend code; no realistic replacement fixture
  system; defaults stay constructor-owned.

## Data contracts and validation

### ABClass wire metadata

Mirror `docs/plans/SPEC.md` exactly, using one adjacent frontend Zod owner shared
by full reads, partial reads and mutation schemas:

```ts
type AverageScore = number | 'N' | 'E' | 'excluded';
type AverageScores = {
  completeness: AverageScore;
  accuracy: AverageScore;
  spag: AverageScore;
  overall: AverageScore;
};
type ABClassMetadata = {
  classAverages: AverageScores & { updatedAt: string };
  recentAssignments: {
    assignmentId: string;
    assignmentDefinitionKey: string;
    averages: AverageScores;
    updatedAt: string;
  }[];
} | null;
```

- Numeric values are finite and in inclusive 0–5; fractions and zero are retained.
  No rounding, coercion, percentages or marker-to-zero conversion.
- Every non-null object's required fields are own properties; only ordinary or
  null-prototype records are accepted. Reject unexpected own keys, including symbol
  keys, inherited-only required fields, Dates and class instances. Preserve the
  backend's strictness for metadata without tightening unrelated class fields.
- Only metadata itself may be null. Recent arrays are dense, contain zero to three
  complete entries, have no unexpected own array properties, have unique assignment
  IDs, and are ordered by non-increasing timestamp. Equal times retain supplied order.
- Identifiers are non-empty already-trimmed opaque strings. Metadata timestamps
  must be real canonical UTC `YYYY-MM-DDTHH:mm:ss.sssZ` values, without offsets,
  counter suffixes or calendar normalisation. The broader existing ISO schema is
  not an adequate substitute.
- Schema parsing returns detached snapshots. Do not retain mutable input aliases.
- `getABClass` still returns top-level null for not found. `getABClassPartials`
  still returns an array, including empty; every existing class has metadata/null.

### Mutation requests and responses

- Add typed validated frontend `upsertABClass` and `updateABClass` wrappers and
  adjacent request schemas. They call the existing method names through the queue.
- Preserve current required upsert configuration and optional editable update
  fields; metadata is an additional optional whole-value replacement.
- Actual omission preserves existing metadata (new-class omission yields null on
  the backend); explicit null clears; a complete object replaces. Own-property
  undefined is invalid and must fail before enqueue/dispatch. Never implement
  nested patches or serialise omission as null/undefined.
- Both mutation responses parse through `ClassPartialSchema` using
  `parseApiResponse`. Reads retain their existing wrappers and response parsing.
- No deletion response change, new backend endpoint, new error-envelope property,
  or migration of unrelated bulk workflows is included.

### Metric projection

Map validated `MetricResult` explicitly: computed → its numeric `value`,
notAttempted → `N`, error → `E`, excluded → literal `excluded` (not null).
Reuse existing weighted `perClass` results for all four metrics, including weighted
overall. Never average assignment averages or task-display numbers independently.

## Feature architecture

```text
Class page / standalone Heatmaps successful averaging result
└── usePostAnalysisTasks (shared, post-commit)
    └── runPostAnalysisTasks (ordered named task runner)
        └── refreshABClassMetadata (first registered task)
            ├── cheap assignment-partial timestamp gate
            └── existing queued API lane: fresh read → recheck → analysis → write
```

- Hook owner: `src/frontend/src/hooks/usePostAnalysisTasks.ts`.
- Shared non-React task lifecycle/context: `services/dataAnalysis/postAnalysis/`.
- Metadata schemas and API persistence: `services/abClass/`.
- Both current surface owners call the same hook; neither imports the other feature.
- The task runner accepts an ordered readonly list of `{ id, run(context) }`
  descriptors. Task IDs are unique; duplicates fail loudly. The production list
  initially contains only `refreshABClassMetadata`; do not add future tasks now.
- Common context contains the successful validated averaging result, the complete
  class, and live definition partials. Each task owns its own eligibility/freshness
  decision. Do not make the entire hook's future-task lifecycle depend on metadata
  timestamps. Task failures are recorded individually; subsequent independent tasks
  still run in declared order. No dependency graph, dynamic plug-in loader or event bus.
- The hook reports per-task `pending`, `succeeded`, `skipped` or `failed` outcomes;
  skipped metadata includes `noAssignments`, `unchanged` or `staleSource` reasons.
  Failed outcomes retain the normalised Error separately from user-safe copy.
- Effect replay, equal rerenders and metadata-only cache refreshes must not create
  a retry/write loop. One attempt per metadata source version per mounted owner;
  a remount/reload or genuinely newer source version may try again after failure.
  Same-version duplicate work from different owners is rechecked inside the queue.
- Unmount/navigation suppresses old-owner state updates and notifications, but does
  not abort or pretend to cancel an already active queued network write.

## Metadata refresh workflow

### Eligibility and freshness

1. A successful validated averaging run and trustworthy complete class/definitions
   are required. Failed/skipped analysis never starts post-analysis work. Separate
   descriptive `analyseAssignmentSummary` calls do not trigger a second metadata run.
2. If the complete class has no assignments, skip without creating metadata.
3. Validate candidate partial timestamps with the canonical metadata timestamp
   contract; null/malformed timestamps fail the task, never substitute the clock.
   Select newest descending; ties use assignment ID ascending for deterministic
   **target selection only**, without re-sorting stored equal-time entries.
4. If the target's stored entry has equal `updatedAt`, skip, even if current
   weightings or scores differ. Metadata is an assignment-version snapshot and can
   remain stale after definition/weighting/roster-only changes by design.
5. A cached target older than its stored entry, or older than the newest stored
   recent timestamp, is stale input: skip without regressing the stored snapshot.
   Equal timestamps for different IDs remain eligible.

### Queued operation

1. Only after the cheap gate says changed, enqueue one complete operation on
   `classesBulkMutation`. Extend the existing FIFO with local deferred-task support;
   functions never enter a GAS payload. Retain existing queue APIs, FIFO, rejection,
   pending cancellation and active-not-aborted semantics. No second queue.
2. Inside the lane, freshly read `getABClass` through its validated service (not
   the five-minute query cache), and re-evaluate target/freshness against that
   authoritative complete document. Not found fails without upsert/recreation.
3. If already current, finish skipped without calculation or write. If changed,
   require a matching live definition partial for every class assignment; do not
   silently let the analyser drop assignments and call the result full-class.
4. Analyse the fresh complete class with no date/topic/definition/selection filters
   and the existing constructor's standard criterion weights. Analyse the target
   separately using the same pure service with only that assignment in the class.
   These internal calculations do not recursively dispatch post-analysis tasks.
5. Construct complete class averages and one new/replacement recent entry. Use
   the target partial's exact `updatedAt`; stamp `classAverages.updatedAt` with
   canonical current UTC only when preparing an actual changed write.
6. Preserve all other existing recent entries, replace at the existing position
   for duplicate ID or append a new ID, stable-sort by updatedAt descending and
   retain three. Equal timestamp order remains stable. Initial null metadata yields
   exactly one entry. Validate the complete replacement before dispatch.
7. Send only `{ classId, metadata }` to `updateABClass` inside the queued operation.
   No roster refresh, configuration echo, nested patch, backend retry/rollback or
   speculative repair of corrupt persisted data.
8. Parse the returned partial. On success invalidate the existing `abClass(classId)`
   and `classPartials` query keys once using shared invalidation conventions; no
   manual imperative refetch in mutation cleanup. Refetched metadata triggers a
   timestamp no-op, not another write. Do not invalidate assignment/definition data
   for a metadata-only change. Invoke both invalidations with `throwOnError: true`
   and collect both settlements, so an active-observer refetch failure is observable
   without skipping the second key. Track confirmed persistence separately from
   refresh success; inactive queries are only marked stale, not forcibly fetched.
9. A queue task must not await another enqueue on the same lane (deadlock). All
   network calls inside its reserved slot still route through `callApi`.

## Failure and feedback rules

- Calculation, validation, read or write failure marks only the metadata task as
  failed. Keep the successful analysis and existing page layout usable.
- Use the existing context-aware Ant Design notification API, warning tone,
  dismissible and no automatic expiry. Title: `Class summary not saved`.
  Description: `Analysis is ready, but the class summary could not be saved.
Reload the page to try again.` No retry button or technical payload.
- Once a save is confirmed, a subsequent required refresh failure must not claim
  the save failed. Use title `Class summary refresh failed` and description
  `The class summary was saved, but refreshed data could not be loaded. Reload
the page to refresh it.` Existing query trust/error handling remains authoritative.
- Deduplicate feedback per task/class/source version. Log through existing frontend
  error normalisation/logger with task ID, class/assignment IDs and available request
  correlation. New task-owned logs never include full submissions, roster data or
  raw metadata snapshots. This restriction applies to the new task diagnostics;
  existing shared transport parameter/debug and bounded response-preview diagnostics
  keep their current sanitisation policy unchanged. No logger/redaction redesign
  is included.
- No success/unchanged notifications, no spinner blocking analysis, no automatic
  repeated retry after effect rerenders. Central `callApi` retry policy is unchanged.

## Scope boundaries and rollout

- Backend wire contract completion is a hard integration prerequisite. Do not
  weaken required metadata reads to accommodate the unfinished backend checkout.
- No new reporting panels, card/table changes, settings controls or metadata editor.
  A compact companion feedback/layout document covers the new warning state only.
- No ProgressTracker redesign, polling, explicit assessment-completion detection,
  cross-session locking, revision/CAS contract, backfill, deployment or commit/push.
- Future tasks and a future trustworthy assessment-completion signal are excluded
  work, not unresolved implementation decisions. There are no authorised deliberate
  deferrals in this workstream and no open product questions.

## Testing expectations

- Red-first Zod parity matrix against the backend domain validator in a Node-only
  integration test, including strict raw-object/own-key probes, dense arrays,
  canonical real dates, equal times, repeated definitions and alias isolation.
- Read/mutation transport coverage for null, omission, own undefined, replacement,
  missing response fields, not found and unchanged envelope failures.
- Pure freshness, instance-isolated calculation, all four metric states, no score
  rounding, stable rolling retention and stale-source protection.
- FIFO deferred-operation boundaries, cancellation, failures releasing the lane,
  duplicate source rechecks and no read/merge/write interleaving in that lane.
- Hook post-commit timing, StrictMode, rerender/refetch no-op, future task extension,
  task failure isolation, navigation/unmount and cache invalidation.
- Playwright coverage of the new warning/dismissal and usable analysis on both
  surfaces, plus the ordinary-analysis → queued write → refresh → no-loop journey.
- Use canonical `small`, `medium` and `large-representative` class and definition
  views, already containing metadata. Clone local invalid/boundary scenarios; no
  generator extension is required. Generated supplied scores are not expected
  calculated averages: derive calculation oracles from canonical evidence.

## Planning handoff notes

- Record planned schemas/task lifecycle in `docs/developer/data-shapes/abclass.md`
  and `frontend-data-analysis-response.md` before finalising the action plan. These
  frontend-specific `Not implemented` entries are now recorded.
- Document the shared hook/runner and extension contract prominently in canonical
  frontend helper/analysis docs, marked `Not implemented` until delivered. These
  planned ownership/extension entries are now recorded.
- Follow the checked LOC/splitting inventory, including transport's 499-line module,
  its 1,763-line suite, the 498-line Class-page hook and required-field fixture ripple.
- Preserve backend planning history and the unrelated user-owned change to
  `.opencode/agents/code-reviewer.md`.
