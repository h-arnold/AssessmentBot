# Feature Delivery Plan (TDD-First)

## Delivery status

- Current section: Section 1 complete — backend metadata validator delivered; Section 2 (frontend metadata Zod schema) is next.
- Regression-checker session ID: `feat-enahncedABClassMetadata` (passed explicitly; this worktree is detached HEAD, so branch-based resolution is unavailable).
- Baseline report: `.ts-regression-checker/reports/session-feat-enahncedABClassMetadata/baseline/baseline.txt` (created 2026-11-19T22:39:22Z; 6 of 8 checks passing, zero regressions, zero new failures).
- Accepted baseline debt: (a) `backend-lint-check` fails on 4 pre-existing `max-lines` warnings in untouched test files (`assignmentDefinitionPartials.unit.test.js`, `dbManager.test.js`, `classroomApiClient.test.js`, `batchUpdateUtility.test.js`); (b) `frontend-e2e-check` recorded exit 143 after an environment-hung Playwright process was terminated during baseline capture — this plan adds no E2E tests (no user-visible change) and no E2E file is in the authorised change surface. These files and checks are outside every section's change surface; no section may repair them.
- Start-up environment note: root and frontend `node_modules` were empty and were installed with `npm ci` and `npm --prefix src/frontend ci`. A first baseline captured before installation was discarded as contaminated.
- Pre-flight docs registration: three planned entries marked `Not implemented` were added to `docs/developer/backend/api-layer.md`, `docs/developer/data-shapes/frontend-data-analysis-response.md` and `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, satisfying the section-start planning gate.

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md`.
2. Read the planned-only entries in `@docs/developer/data-shapes/abclass.md` (§ Planned changes) and `@docs/developer/data-shapes/frontend-data-analysis-response.md` (§ Planned class summary contract), plus the planned helper entries in `@docs/developer/backend/api-layer.md` (§ Shared helpers) and `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (§ 9.28).
3. Treat those documents as the source of truth for product behaviour and contracts; use this plan only for sequencing and testing.

## Scope and assumptions

### Scope

- Backend ABClass metadata validator: legacy/current shape tolerance, null normalisation, nested-field validation, file separation.
- Frontend metadata Zod schema: legacy/current acceptance and current-shape emission.
- A typed `AttemptBaselineUnavailableError` and a `ClassSummary` analyser/schema registered in `DataAnalysisService`, owning all new calculation.
- Writer integration: consume the summary, retain freshness and rolling history, map and write the five-field snapshot.
- Synthetic generator/validator extension, fixture regeneration, parity/round-trip test updates.
- Regression hardening and documentation.

### Out of scope

- UI display of the new fields.
- Persisting baseline pool IDs or baseline task keys.
- Changing the freshness gate, `postAnalysisFeedback.ts`, invalidation, or attempt identity.
- Changing `analyse(input, 'averaging')`, `analyseAssignmentSummary()`, or any analysis input schema.
- A new synthetic profile, view, or corpus rescale.

### Assumptions

1. The writer remains the owner of `getMetadataRefreshDecision()` and `mergeClassMetadata()`; the analyser receives `{ target, recentAssignments }` and performs no selection or history work.
2. `ClassSummary` carries analyser-native four-state `MetricResult` values; the writer converts them with the existing `projectAverageScores()` mapping.
3. Baseline eligibility for the canonical fixtures is already verified (see § Spec planning handoff); no generator extension is needed for realistic baseline data.
4. All three named backend/frontend lint gates (`max-lines: 500` backend, 550-line frontend decomposition) are binding.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API/entry points thin; all new calculation lives in `DataAnalysisService`.
- Fail fast on invalid inputs and persistence failures; the only tolerated analysis failure is `AttemptBaselineUnavailableError`.
- Never catch broadly, never message-match, never swallow errors.
- Set defaults only in constructors; no `null` defaults outside the existing ownership boundaries.
- Use British English in comments and docs.
- Use `./`/`../` for nearby modules; aliases only at two or more parent traversals.

### TDD workflow (mandatory per section)

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.
5. **Docs sync (optional)**: update canonical docs when behaviour or data shapes change; record outcome or skip reason.
6. **Plan compaction**: after verification, compact the completed section to a summary retaining contracts, decisions, constraints and follow-ups; preserve other sections, the deferred-findings ledger and the implementation-notes subsection.

### Delegation mandatory reads (mandatory for sub-agent execution)

Every delegated handoff must use `@`-prefixed paths so the at-mention plugin attaches file contents. Do not paste file contents into prompts.

Shared across sections:

- `@SPEC.md`
- `@docs/developer/data-shapes/abclass.md`
- `@docs/developer/data-shapes/frontend-data-analysis-response.md`
- `@AGENTS.md` (already injected), `@src/frontend/AGENTS.md` and `@src/backend/AGENTS.md` (injected when touching component files)

Per-phase reads for the documentation and data-shape agents (used in every section that changes contracts or docs):

Docs agent:

- `@SPEC.md`, `@ACTION_PLAN.md`
- `@docs/developer/data-shapes/abclass.md`, `@docs/developer/data-shapes/frontend-data-analysis-response.md`
- `@docs/developer/frontend/data-analysis-architecture.md`, `@docs/developer/testing/synthetic-test-data.md`
- `@docs/developer/backend/api-layer.md`, `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

Data Shapes Agent:

- `@docs/developer/data-shapes/INDEX.md`, `@docs/developer/data-shapes/abclass.md`, `@docs/developer/data-shapes/frontend-data-analysis-response.md`
- `@src/backend/Models/ABClassMetadata.js`, `@src/frontend/src/services/abClass/abClassMetadata.zod.ts`
- `@src/frontend/src/services/dataAnalysis/dataAnalysisService.ts`, `@src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.ts`

Per-section reads for Testing Specialist, Implementation and Code Reviewer are listed below.

### Shared-helper planning gate (mandatory when helper changes are expected)

Record decision (`reuse` | `extend` | `new` | `keep local`), owning path and call-site rationale per section. Planned entries must exist in the canonical helper docs with status `Not implemented` before implementation, and be reconciled during the docs pass.

### Validation commands hierarchy

- Backend lint: `npm run lint:backend:check`
- Frontend lint: `npm run lint:frontend:check`
- Builder/synthetic lint: `npm run lint:synthetic:check`
- Backend tests: `npm run test:backend -- <target>`
- Frontend unit tests: `npm run test:frontend -- <target>`
- Synthetic tests: `npm run test:synthetic -- <target>`
- Full gate: `npm run run-all-checks`

---

## Section 1 — Backend metadata validator: legacy tolerance, five-field shape, separation

### Outcome (compacted)

`ABClassMetadata` accepts both the legacy two-field snapshot and the current five-field snapshot, and `ABClass.toJSON()`/`toPartialJSON()` always emit the five-field shape through the same owner, inserting `null` for absent new fields. Nested baseline/standings validation and defensive copying were extracted to `src/backend/Models/ABClassMetadataStandings.js`; the facade is 349 lines and the helper 182 lines, both within the 500-line gate. Reads normalise in memory and never write, repair or backfill stored bytes; request provenance and `INVALID_REQUEST` adaptation are unchanged.

### Retained for later sections

**Emitted five-field shape and data shape.** `ABClassMetadata` is the sole backend validation and copy owner. Every emitted non-null snapshot has exactly these five fields:

```js
{
  (classAverages, // existing: completeness, accuracy, spag, overall, updatedAt
    recentAssignments, // existing: dense 0–3 entries, unique assignmentId, non-increasing updatedAt
    baselineAverages, // four scores + updatedAt, or null
    allTaskStandings, // { top, bottom } or null
    baselineStandings); // { top, bottom } or null
}
```

A non-null standings object has exactly `top` and `bottom`, each a dense array of 0–3 entries `{ studentId, studentName, scores, recentAssignmentScores }`. `recentAssignmentScores` holds exactly one `AverageScores` set per `recentAssignments` entry, aligned by index. Each score set is the four fields `completeness`, `accuracy`, `spag`, `overall`, each a finite number 0–5 or exactly `'N'`, `'E'`, `'excluded'`, with no coercion. Only whole `metadata` and the three new fields may be `null`; no nested score or list entry is nullable.

**Validation boundaries later sections must mirror.** Omitting all three new fields is the legacy path; a present `undefined`, an unexpected own field, a sparse list, a malformed nested entry, or a `recentAssignmentScores` length that differs from `recentAssignments` rejects as a non-request `ABClassMetadataValidationError` carrying a nested `fieldPath` (for example `metadata.allTaskStandings.top[0].scores.overall`). Duplicate students across `top`/`bottom` are valid at the validator level; disjointness is a producer rule for the Section 3 analyser, not a validator rule, so the frontend schema and parity tests must not add it. Stored ISO timestamps revived by `DateUtils.deepConvertDates()` validate, and `toJSON()`/`toPartialJSON()` return equal but independently detached copies.

**Module ownership, load order and harness wiring.** `src/backend/Models/ABClassMetadata.js` remains the facade and owns the shared score, record, array-strictness and timestamp rules (`_metrics`, `_checkRecord`, `_checkArrayKeys`, `_assertDenseIndex`, `validateAverageScore(s)`, `_validateTimestamp`). `src/backend/Models/ABClassMetadataStandings.js` owns `validateBaselineAverages`, `validateStandings`, `validateStandingList`, `validateStandingEntry`, `validateRecentAssignmentScores`, `_validateIdentifier` and the matching `copy*` helpers. Every cross-module reference (`ABClassMetadataStandings`, `Validate`, `Assessment`, `ABClassMetadataValidationError`) resolves inside a method body: the builder concatenates backend files by filename, so the facade loads before the helper and no module-load-time reference is safe. In `tests/setupGlobals.js`, `g.ABClassMetadataStandings` is attached immediately before `g.ABClassMetadata` with the matching comment.

**Test-harness pattern.** `tests/models/abclassMetadataFiveFieldShape.test.js` selects legacy rows structurally from the committed `small`/`medium`/`large-representative` `classesById.json` views, excluding any row already carrying a new field, so Section 5 fixture regeneration cannot silently switch it to a current-shape row. Invalid, boundary and present-`undefined` probes stay local; no realism or type-matching gate was relaxed and no profile or view was added.

**`@remarks` commitments (delivered in code).** `ABClassMetadata` records why the legacy shape is accepted on reads without backfill; `ABClassMetadataStandings` records why nested validators live in a sibling module (lint gate, GAS load order) and why every `ABClassMetadata` reference is call-time.

**Doc-entry status.** The behaviour delivered here corresponds to the extended shape, legacy tolerance/null normalisation and validator module separation entries in `abclass.md` § Planned changes; their doc markers are reconciled in the final Documentation and rollout section. The frontend parity and snapshot-source entries remain `Not implemented` for Sections 2–4, as do all shared-helper and data-shape entries owned by Sections 2–5.

### Shared helper plan — delivered

1. Helper: backend metadata nested-field validators
   - Status: **Delivered**. Planning decision: `new` (extracted facade helper).
   - Owning module/path: `src/backend/Models/ABClassMetadataStandings.js` (182 lines).
   - Call sites: `ABClassMetadata.validateMetadata()` via `_validateNewFields`, and `ABClassMetadata._copyMetadata()`; keeps the facade under the lint gate without duplicating request or transport rules.
   - Canonical doc target: `@docs/developer/backend/api-layer.md` § Shared helpers; doc-entry reconciliation is tracked by the final Documentation and rollout section.

### Section checks

Passed: `npm run test:backend -- tests/models/abclassMetadataIntegration.test.js` (10/10), `npm run test:backend -- tests/models/abclassMetadataRecordBoundaries.test.js` (7/7), the new `tests/models/abclassMetadataFiveFieldShape.test.js` (13/13), the full backend suite (3792 tests), and `npm run lint:backend:check` with only the four accepted baseline warnings. Both modules are ≤ 500 lines and `tests/setupGlobals.js` loads the helper before the facade uses it.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Facade `src/backend/Models/ABClassMetadata.js` is 349 lines; nested validators and copy helpers live in the new sibling `src/backend/Models/ABClassMetadataStandings.js` (182 lines). Both call-time only, guarded exports, helper global wired before the facade in `tests/setupGlobals.js`. The facade owns shared record/score/array/timestamp rules; the helper owns only nested validators/copy. Docs sync reconciled the extended-shape, legacy-tolerance and validator-separation bullets in `docs/developer/data-shapes/abclass.md` and the `ABClassMetadataStandings` helper entry in `docs/developer/backend/api-layer.md`; the frontend-parity and snapshot-source bullets remain `Not implemented` for Sections 2–4. No new documentation pages created.
- **Deviations from plan:** Beyond the two test files the plan named (`abclassMetadataBoundary.test.js`, `abclassMetadataIntegration.test.js`), eight additional direct-dependent suites needed mechanical two-field→five-field null-placeholder expectation updates because the shared validator's emitted shape changed; all were reviewed and triaged as legitimate consequences of this section's diff, with assertions kept strict (and some strengthened). No behaviour under test was changed.
- **Follow-up implications for later sections:** Sections 2–4 must consume the five-field shape with `null` placeholders; the frontend schema and parity tests must NOT enforce top/bottom disjointness (validator/producer split). Frontend parity and snapshot-source doc entries remain `Not implemented`.
- **Regression gate:** passed at section completion. Report `.ts-regression-checker/reports/session-feat-enahncedABClassMetadata/runs/2026-11-19T23-58-40.614Z/comparison.txt` — 7/8 checks passing, 0 regressions, 0 new failures, 0 fixes; the sole failing check is the accepted `backend-lint-check` baseline debt (same 4 `max-lines` warnings in untouched files). E2E now passes.

---

## Section 2 — Frontend metadata Zod schema: legacy/current acceptance and emission

### Objective

Extend the single frontend metadata schema owner so legacy and current inputs are accepted and the current five-field shape is emitted with null placeholders, in parity with Section 1.

### Constraints

- `ClassFullSchema`, `ClassPartialSchema` and the mutation schemas keep referencing `ABClassMetadataSchema`; no second schema owner.
- Strict record checks and canonical timestamp rules unchanged for existing fields.
- `NonNullableABClassMetadataSchema` emits all five fields; each new field nullable but required in output.
- Frontend file stays under 550 lines.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist: `@src/frontend/src/services/abClass/abClassMetadata.zod.ts`, `@src/frontend/src/services/abClass/abClassMetadata.zod.spec.ts`, `@src/frontend/src/services/abClass/abClassMetadata.zod.strict.spec.ts`, `@src/frontend/src/test/abClass/abClassMetadataFixtures.ts`, `@docs/developer/frontend/frontend-testing.md`

Implementation: `@src/frontend/src/services/abClass/abClassMetadata.zod.ts`, `@docs/developer/data-shapes/abclass.md`, `@docs/developer/frontend/frontend-architecture.md`

Code Reviewer: `@SPEC.md`, `@src/frontend/src/services/abClass/abClassMetadata.zod.ts`

### Shared helper plan

1. Helper: metadata schema owner
   - Decision: `extend`
   - Owning module/path: `src/frontend/src/services/abClass/abClassMetadata.zod.ts`
   - Call-site rationale: all class read/write schemas reference this one owner; adding new schemas here avoids a parallel contract.
   - Relevant canonical doc target: `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` § 9.28
   - Planned doc status: `Not implemented` (recorded as part of the planned metadata enrichment) — reconcile in docs pass.

### Data-shape planning block

- Changes: frontend validation schema.
- Planned-only entries: `@docs/developer/data-shapes/abclass.md` § Planned changes (Frontend parity bullet).
- Remove `Not implemented` on delivery.

### Canonical-fixture note

- Use `src/frontend/src/test/abClass/abClassMetadataFixtures.ts` with committed `small`/`medium`/`large-representative` class-partial views.
- Invalid shape/score/identifier/ordering/timestamp probes remain local boundary fixtures.
- No profile or corpus change.

### Acceptance criteria

- `ABClassMetadataSchema.parse(legacy)` produces the five-field current shape with three nulls.
- `NonNullableABClassMetadataSchema.parse(current)` preserves all fields and rejects present `undefined`, unexpected keys and malformed nested entries.
- `recentAssignmentScores.length === recentAssignments.length` (0–3) enforced.
- `ClassFullSchema`/`ClassPartialSchema`/mutation schemas still accept the field and reject malformed metadata.
- File ≤ 550 lines; frontend lint and touched suites green.

### Required test cases (Red first)

1. Legacy committed fixture parses and emits null placeholders.
2. Current-shape fixture with populated fields round-trips.
3. Present `undefined` for each new field rejects.
4. Non-null standings with wrong list length, sparse list, missing identity, invalid score, or extra key reject.
5. `top`/`bottom` are validated as dense 0–3 arrays; no uniqueness rule added.
6. Regression: existing `abClassMetadata.zod*.spec.ts` suites pass unchanged except explicit new cases.

### Section checks

- `npm run test:frontend -- src/services/abClass/abClassMetadata.zod`
- `npm run lint:frontend:check`.
- Confirm no second metadata schema was introduced.

### Optional `@remarks` JSDoc follow-through

Record why the nullable union accepts a legacy input but emits the current shape, and why disjointness is not enforced by the schema.

### Implementation notes / deviations / follow-up

- Record any schema-shape adjustment and the planned-entry reconciliation.

---

## Section 3 — Typed baseline error and `ClassSummary` analyser/service registration

### Objective

Add `AttemptBaselineUnavailableError`, build the `ClassSummary` analyser and schema as the sole owner of the new calculation, and register it in `DataAnalysisService` without changing existing entry points.

### Constraints

- All calculation reuses `AveragingAnalyser`, `rollupMetric`, `computeOverallComposite` and `convertToBaselineExcluded`; no new averaging maths.
- `AnalysisFilterSchema`, `AveragingAnalyserInputSchema`, `DataAnalysisResponseSchema` unchanged.
- `analyse(input, 'averaging')` and `analyseAssignmentSummary()` unchanged; `AssignmentSummaryAnalyser` keeps its own field.
- The analyser receives `{ target, recentAssignments }`; no freshness selection or rolling history.
- Catch only `AttemptBaselineUnavailableError`; all other errors propagate.
- **File separation**: `attemptBaselineSelection.ts` is **279 lines** → ~295 with the typed error. `dataAnalysisService.ts` is **89 lines** → ~120. New `classSummaryAnalyser.ts` projected **~280–330 lines**, new `classSummary.zod.ts` **~150–190 lines**. All ≤ 550; do not inflate the service.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist: `@src/frontend/src/services/dataAnalysis/analysers/attemptBaselineSelection.spec.ts`, `@src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.baselineMode.spec.ts`, `@src/frontend/src/services/dataAnalysis/dataAnalysis.mediumBaselineRoundTrip.spec.ts`, `@docs/developer/frontend/frontend-testing.md`

Implementation: `@src/frontend/src/services/dataAnalysis/dataAnalysisService.ts`, `@src/frontend/src/services/dataAnalysis/analysers/attemptBaselineSelection.ts`, `@src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts`, `@src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts`, `@src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.composite.ts`, `@docs/developer/frontend/data-analysis-architecture.md`, `@docs/developer/data-shapes/frontend-data-analysis-response.md`

Code Reviewer: `@SPEC.md`, `@src/frontend/src/services/dataAnalysis/dataAnalysisService.ts`, `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Shared helper plan

1. Helper: `ClassSummaryAnalyser`
   - Decision: `new`
   - Owning module/path: `src/frontend/src/services/dataAnalysis/classSummaryAnalyser.ts` with adjacent `classSummary.zod.ts`
   - Call-site rationale: single owner for summary calculation; writer and any future consumers call `analyseClassSummary()`.
   - Relevant canonical doc target: `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` § 9.28 (entry recorded as `Not implemented`)
   - Planned doc status: `Not implemented` — reconcile in docs pass.
2. Helper: `AttemptBaselineUnavailableError`
   - Decision: `new` (typed error, existing messages)
   - Owning module/path: `src/frontend/src/services/dataAnalysis/analysers/attemptBaselineSelection.ts`
   - Call-site rationale: lets the summary analyser distinguish the three documented unavailability cases from genuine faults without message matching.
   - Relevant canonical doc target: `@docs/developer/data-shapes/frontend-data-analysis-response.md` § Planned class summary contract
   - Planned doc status: `Not implemented`.
3. Helpers reused: `AveragingAnalyser`, `rollupMetric`, `computeOverallComposite`, `convertToBaselineExcluded`, `projectAverageScores` (used by Section 4).

### Data-shape planning block

- Changes: new in-memory `ClassSummary` schema and a typed error contract in the analysis domain.
- Planned-only entries: `@docs/developer/data-shapes/frontend-data-analysis-response.md` § Planned class summary contract (all bullets `Not implemented`).
- Remove `Not implemented` on delivery.

### Canonical-fixture note

- `medium` is the canonical profile for baseline tests (all classes baseline-eligible; `dataAnalysis.mediumBaselineRoundTrip.spec.ts` already pins baseline claims); `small` and `large-representative` provide secondary coverage.
- Historical-source variants use existing `metadataRefreshFixtures.ts` helpers; no generator extension or corpus change.
- Ineligible-roster and empty-intersection probes for the typed error stay local boundary fixtures (invalid/boundary data).

### Acceptance criteria

- `deriveAttemptBaseline` throws `AttemptBaselineUnavailableError` only for the three documented conditions, with unchanged messages and `instanceof Error`.
- `ClassSummarySchema` validates the exact shape: analyser-native metrics, `target`, `recentAssignments`, disjoint standings, aligned score arrays, `available` flag.
- `analyseClassSummary()` composes `AveragingAnalyser`: absolute/baseline full-class results, isolated absolute per supplied recent assignment, whole-class baseline restriction via `rollupMetric`/`computeOverallComposite`, `convertToBaselineExcluded` for students with no baseline metrics.
- Baseline unavailability produces `available: false` with nulls; any other error propagates.
- `analyse()` and `analyseAssignmentSummary()` regression suites pass unchanged.

### Required test cases (Red first)

1. Typed error class thrown for roster < 3, candidates < 2, empty intersection; plain invariant errors remain plain `Error`.
2. `ClassSummarySchema` accepts a complete valid summary and rejects extra keys, wrong metric states, misaligned score arrays and standings where a `studentId` appears in both `top` and `bottom` of one basis. A refinement enforces disjointness; the analyser's disjoint selection is verified separately by test 3.4.
3. Full-class absolute and baseline averages equal the corresponding `AveragingAnalyser.perClass` results.
4. Ranking: numeric-only, descending top / ascending bottom, `studentId` tie-break, disjoint selection, 0–3 dense lists.
5. Isolated baseline scores use the whole-class baseline keys; students with no baseline metrics follow the `convertToBaselineExcluded` path.
6. `recentAssignmentScores[i]` aligns to `recentAssignments[i]`; shorter arrays only when fewer assignments are supplied.
7. Unavailable baseline → `available: false`, null averages/standings, all-task fields still produced; injected arbitrary error propagates.
8. Regression: `averagingAnalyser.baselineMode.spec.ts`, `dataAnalysis.mediumBaselineRoundTrip.spec.ts`, `attemptBaselineSelection.spec.ts` and assignment-summary suites pass.

### Section checks

- `npm run test:frontend -- src/services/dataAnalysis/analysers/attemptBaselineSelection`
- `npm run test:frontend -- src/services/dataAnalysis/dataAnalysis.mediumBaselineRoundTrip`
- `npm run lint:frontend:check`.
- Confirm no analysis input schema changed and no averaging logic added outside this analyser.
- Confirm all new modules ≤ 550 lines.

### Optional `@remarks` JSDoc follow-through

Record why baseline keys are read only from the full-class result, why task display metrics need no conversion for `rollupMetric`, and why only the typed error is caught.

### Implementation notes / deviations / follow-up

- Confirm the analyser is held in its own `classSummaryAnalyser` field (matching `summaryAnalyser`) and that the averaging registry is unchanged; record any deviation.

---

## Section 4 — Writer integration: consume summary, retain history, write five-field snapshot

### Objective

Replace the writer's two direct `analyse()` calls with one `analyseClassSummary()` call, map the result into metadata, and keep freshness and rolling history exactly as before.

### Constraints

- Writer performs no calculation; it selects the target/newest assignments, calls the service, stamps the clock, validates and writes.
- `getMetadataRefreshDecision()`, `mergeClassMetadata()`, `compareAssignmentNewestFirst()` and the queue lane are unchanged in responsibility; `mergeClassMetadata()` now accepts a `ClassSummary` as its score source and maps analyser-native values with `projectAverageScores()`.
- Freshness gate and no-op reasons unchanged; no new query, invalidation or feedback behaviour.
- **File separation**: `metadataProjection.ts` is **159 lines** → ~170; `abClassMetadataService.ts` **93 lines** → ~115. Both ≤ 550. Keep new logic in these owners, not in a new facade.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist: `@src/frontend/src/services/abClass/abClassMetadataService.calculation.spec.ts`, `@src/frontend/src/services/abClass/abClassMetadataService.evidence.spec.ts`, `@src/frontend/src/services/abClass/abClassMetadataService.failure.spec.ts`, `@src/frontend/src/services/abClass/abClassMetadataService.queue.spec.ts`, `@src/frontend/src/test/abClass/metadataRefreshFixtures.ts`, `@docs/developer/frontend/frontend-testing.md`

Implementation: `@src/frontend/src/services/abClass/abClassMetadataService.ts`, `@src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.ts`, `@src/frontend/src/services/dataAnalysis/dataAnalysisService.ts`, `@src/frontend/src/services/abClass/abClassMutations.zod.ts`

Code Reviewer: `@SPEC.md`, `@src/frontend/src/services/abClass/abClassMetadataService.ts`, `@docs/developer/data-shapes/frontend-data-analysis-response.md`

### Shared helper plan

1. Helper: `mergeClassMetadata`
   - Decision: `extend`
   - Owning module/path: `src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.ts`
   - Call-site rationale: single owner of rolling history; now maps `ClassSummary` instead of separate score arguments.
   - Relevant canonical doc target: `@docs/developer/data-shapes/frontend-data-analysis-response.md` § Metadata refresh execution contracts
   - Planned doc status: `Not implemented` for the new mapping behaviour.
2. Helpers reused: `getMetadataRefreshDecision`, `compareAssignmentNewestFirst`, `projectAverageScores`, `refreshABClassMetadataInQueue` lane constant.

### Data-shape planning block

- Changes: writer execution contract and metadata request shape consumption (no new wire shape).
- Planned-only entries: `@docs/developer/data-shapes/frontend-data-analysis-response.md` § Planned class summary contract (Writer consumption bullet) and § Metadata refresh execution contracts.
- Remove `Not implemented` on delivery.

### Canonical-fixture note

- Use the verified historical-source views: `small`/`class-2`, `medium`/`class-0`, `large-representative`/`class-1` from `metadataRefreshFixtures.ts`; all are baseline-eligible (verified with real analysis: pool 2; 2/6/4 baseline keys).
- Null-name untouched-newest failure probes remain as documented boundary evidence.
- No generator extension or new profile.

### Acceptance criteria

- Writer calls `analyseClassSummary(input, { target, recentAssignments })` once, where `input` is the existing `AveragingAnalyserInput` built from the fresh class read.
- Emitted metadata has populated `classAverages`, `recentAssignments`, `allTaskStandings` and `baselineAverages`/`baselineStandings` or nulls.
- Rolling three-entry history, target replacement, newest-first order, unique IDs and summary clock unchanged.
- No-op reasons and failure propagation unchanged; `ClassPartialSchema` parses the response.
- Writer suites green; no calculation added to the writer.

### Required test cases (Red first)

1. Spy on `analyseClassSummary` and assert a single call with two arguments: the full `AveragingAnalyserInput` as `input`, and `{ target, recentAssignments }` as `options`, with the target from `getMetadataRefreshDecision()` and the newest three fresh-class assignments in newest-first order.
2. Saved outcome contains the five-field metadata with values from the summary; stored history entries are retained unchanged except the target.
3. Baseline-unavailable summary yields null baseline fields with all-task fields populated, and still saves.
4. No-op paths (`noAssignments`, `unchanged`, `staleSource`) make no service call, clock read or write.
5. Failure paths (definition coverage, service throw, read/write failure, response parse failure) propagate with lane released.
6. Regression: existing `abClassMetadataService.*.spec.ts`, `refreshABClassMetadata.spec.ts`, `metadataProjection.*.spec.ts` suites pass except intended expectation updates.

### Section checks

- `npm run test:frontend -- src/services/abClass/abClassMetadataService`
- `npm run test:frontend -- src/services/dataAnalysis/postAnalysis/refreshABClassMetadata`
- `npm run lint:frontend:check`.
- Confirm no new query/invalidation/feedback hooks were added.

### Optional `@remarks` JSDoc follow-through

Record why the writer supplies selection inputs rather than deriving baseline itself, and why rolling history is not recomputed from live definitions.

### Implementation notes / deviations / follow-up

- Record the exact `mergeClassMetadata` signature change and doc reconciliation.

---

## Section 5 — Synthetic generator/validator extension and fixture regeneration

### Objective

Extend the test-only metadata generator and validator to the new shape, regenerate the three committed metadata views through the CLI, and update parity/round-trip suites.

### Constraints

- Generator values remain supplied snapshots: no averaging, no clock, no Faker consumption; deterministic seeds and byte reproducibility unchanged.
- Only `classPartials.json` and `classesById.json` change per compact profile; other views rewrite byte-identically.
- No new profile, view, generator stage or rescale; no relaxation of realism/type gates.
- **File separation**: `generateClassMetadata.js` **125 lines** → ~165; `validateClassMetadata.js` **256 lines** → ~320. Both well under their applicable limits; keep the new field logic in these existing stages rather than adding a third script.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist: `@tests/synthetic-analysis/syntheticABClassMetadataFrontendParity.test.ts`, `@tests/synthetic-analysis/syntheticABClassMetadataRoundTrip.test.ts`, `@docs/developer/testing/synthetic-test-data.md`

Implementation: `@scripts/synthetic-test-data/generateClassMetadata.js`, `@scripts/synthetic-test-data/validateClassMetadata.js`, `@docs/developer/testing/synthetic-test-data.md`, `@docs/developer/data-shapes/abclass.md`

Code Reviewer: `@SPEC.md`, `@scripts/synthetic-test-data/generateClassMetadata.js`, `@docs/developer/testing/synthetic-test-data.md`

### Shared helper plan

1. Helper: metadata generator stage
   - Decision: `extend`
   - Owning module/path: `scripts/synthetic-test-data/generateClassMetadata.js`
   - Call-site rationale: single generation stage already projects metadata into both class views.
   - Relevant canonical doc target: `@docs/developer/testing/synthetic-test-data.md` § ABClass metadata generator capability
   - Planned doc status: `Not implemented` for the new field coverage.
2. Helper: raw metadata validator
   - Decision: `extend`
   - Owning module/path: `scripts/synthetic-test-data/validateClassMetadata.js`
   - Call-site rationale: single raw-shape validator used by generation and committed-fixture validation.

### Data-shape planning block

- Changes: test-only fixture data shape, not a production contract; mirrors Sections 1–2.
- Planned-only entries: `@docs/developer/data-shapes/abclass.md` § Planned changes (Frontend parity bullet) and `@docs/developer/testing/synthetic-test-data.md` § ABClass metadata generator capability (the `Not implemented` new-field coverage paragraph).
- Reconcile both markers in the docs pass; `SPEC.md` is the source contract, not a planned-only data-shape entry.

### Canonical-fixture note

- Profiles/views: committed `small` (3 classes), `medium` (4), `large-representative` (4), both `classPartials.json` and `classesById.json`.
- Baseline-eligibility already verified with real analysis; no generator extension for baseline data.
- Regeneration rewrites committed bytes; use the CLI only and verify byte-for-byte reproducibility via the committed-fixture comparison suite. No large-profile rescale is planned, so no generation-time/RSS measurement is required.

### Acceptance criteria

- Generated snapshots include the three new fields with deterministic, documented coverage. Legacy `null` cases are retained exactly where the current matrix has them: `small` class 0 and `large-representative` class 0; `medium` has no legacy case today and keeps none. Every non-null case gains current-shape fields.
- Parity test proves frontend Zod and backend validator agree on both shapes for all three profiles.
- Round-trip test proves legacy/current metadata survives reads, clear-on-null and whole replacement.
- Regenerated committed views are byte-reproducible; no unrelated view changes.

### Required test cases (Red first)

1. Generator emits new fields for each profile with deterministic values; no clock/Faker consumption added.
2. Raw validator accepts legacy and current shapes and rejects malformed nested fields.
3. Frontend/backend parity passes for all three compact profiles on both shapes.
4. Dispatcher round trip preserves null placeholders and whole replacement for the new shape.
5. Committed-fixture regeneration comparison passes after CLI regeneration.

### Section checks

- `npm run test:synthetic -- tests/synthetic-analysis/syntheticABClassMetadataFrontendParity.test.ts`
- `npm run test:synthetic -- tests/synthetic-analysis/syntheticABClassMetadataRoundTrip.test.ts`
- Fixture regeneration command from `@docs/developer/testing/synthetic-test-data.md` § Commands; `npm run lint:synthetic:check`.
- Confirm only the two class-bearing views changed per profile.

### Optional `@remarks` JSDoc follow-through

Record that generated scores are supplied snapshots and never an oracle for calculated averages.

### Implementation notes / deviations / follow-up

- Record regeneration output and any fixture-byte differences observed.

---

## Regression and contract hardening

### Objective

Verify the whole change set and close contract gaps across backend, frontend analysis, writer and synthetic layers.

### Constraints

- Prefer focused suites before broader validation.
- No warning budget on lint gates.

### Acceptance criteria

- All touched backend, frontend and synthetic suites pass.
- Backend/frontend lint and type checks pass; production build succeeds.
- No data-shape or helper entry remains `Not implemented` for delivered work.
- No analysis input schema or existing entry point changed.

### Required test cases/checks

1. `npm run test:backend -- tests/models/abclassMetadataIntegration.test.js` and related metadata suites.
2. `npm run test:frontend -- src/services/abClass` and `npm run test:frontend -- src/services/dataAnalysis`.
3. `npm run test:synthetic -- tests/synthetic-analysis/syntheticABClassMetadataFrontendParity.test.ts tests/synthetic-analysis/syntheticABClassMetadataRoundTrip.test.ts`.
4. `npm run lint:check` and `npm run typecheck:all`.
5. `npm run run-all-checks`.

### Section checks

- Record all command outcomes; investigate every failure before sign-off.

### Implementation notes / deviations / follow-up

- Record any additional work discovered during regression.

---

## Documentation and rollout notes

### Objective

Update canonical docs to match the implemented shapes and record caveats.

### Constraints

- Only modify documents relevant to touched areas.

### Acceptance criteria

- `@docs/developer/data-shapes/abclass.md` and `@docs/developer/data-shapes/frontend-data-analysis-response.md` reflect the implemented shape; all `Not implemented` markers for delivered entries removed.
- `@docs/developer/frontend/data-analysis-architecture.md` describes the new analyser and single-owner guarantee.
- `@docs/developer/testing/synthetic-test-data.md` reflects generator coverage and the verified baseline fixture capability.
- Planned helper entries in `@docs/developer/backend/api-layer.md` and `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` are reconciled.
- `@remarks` decisions from earlier sections are present in code or recorded here.

### Required checks

1. Verify docs mention legacy normalisation and null placeholders.
2. Verify docs name the single analysis owner and the typed error contract.
3. Confirm notes/deviations fields are filled in each section.
4. Confirm no open question was deferred to implementation.

### Optional `@remarks` JSDoc review

Confirm the recorded non-obvious decisions are present; otherwise record `None`.

### Implementation notes / deviations / follow-up

- Record rollout note: existing classes keep legacy bytes until a refresh writes the current shape; reads normalise in memory.

---

## Suggested implementation order

1. Section 1 (backend validator and file separation)
2. Section 2 (frontend metadata schema)
3. Section 3 (typed error, ClassSummary analyser/schema, service registration)
4. Section 4 (writer integration)
5. Section 5 (synthetic fixtures and parity)
6. Regression and contract hardening
7. Documentation and rollout

---

## Deferred and Out-of-Scope Findings

| Finding                                               | Severity    | Scope rationale                                                                                                              | Evidence                                                              | Disposition | User decision                                                           |
| ----------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------- |
| UI display of the new metadata fields                 | Improvement | `SPEC.md` non-goal; no production component renders metadata scores                                                          | `SPEC.md` § Purpose / V1 scope; Kif exploration of frontend consumers | noted       |                                                                         |
| Persisting baseline pool IDs or baseline task keys    | Improvement | `SPEC.md` non-goal; internal derivation only                                                                                 | `SPEC.md` § Purpose / V1 scope                                        | noted       |                                                                         |
| Changing the metadata freshness trigger               | Improvement | Explicitly unchanged contract                                                                                                | `SPEC.md` § Agreed product decisions, § Prefetch policy               | noted       |                                                                         |
| Analysis-input override for whole-class baseline keys | Improvement | Avoided: whole-class keys are applied by the summary analyser via shared rollup helpers, so no input schema change is needed | `SPEC.md` § Core derivation model; `dataAnalysis.zod.ts` unchanged    | disregarded |                                                                         |
| Writing metadata in `postAnalysisFeedback.ts`         | Improvement | User confirmed the existing refresh task owns the write; the feedback hook stays warning-only                                | `SPEC.md` § Planning handoff notes; question-tool confirmation        | noted       | Confirmed by user: use the existing refresh task, not the feedback hook |

Nitpicks are logged in `.opencode/scratchpad/<branch-slug>-deferred-findings.md` (branch name with `/` replaced by `-`), with the two required tables: `Deferred and out-of-scope findings` and `Nitpicks`. Link that ignored working file here if nitpicks are logged during delivery; do not list individual nitpicks in this plan.
