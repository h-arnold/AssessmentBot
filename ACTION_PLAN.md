# Feature Delivery Plan (TDD-First)

## Delivery status

- Current section: Section 4 complete — writer integration delivered (single `analyseClassSummary` call; 3-arg `mergeClassMetadata`; five-field snapshot; Option A score trimming per user decision). RED and GREEN loops reviewed PASS; docs synced; plan compacted; section regression gate passed (0 regressions, 0 new failures); committed and pushed. Section 5 (synthetic generator/validator extension and fixture regeneration) is next. Sections 1–3 complete — backend metadata validator, frontend metadata Zod schema, and typed baseline error + ClassSummary analyser/service registration all delivered; RED and GREEN loops reviewed PASS; authored files kept under the binding line gates; docs synced; section regression gates passed (0 regressions, 0 new failures). Section 3 committed as `43876527` + `668f823d` on `feat/enahncedABClassMetadata-impl`, pushed.
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
- **Commit record:** branch `feat/enahncedABClassMetadata-impl` (dedicated branch created because this worktree is detached HEAD and the intended branch is checked out in the main worktree). Commit `8f8b6ea485e5b2cf9679782ad0d3a53ebb1ff50a` — "feat(abclass): accept legacy and five-field metadata shape in backend validator". `git push -u origin feat/enahncedABClassMetadata-impl` succeeded (new remote branch created, tracking set). Pre-commit hooks (Prettier, backend ESLint, `typecheck:all`) passed.

---

## Section 2 — Frontend metadata Zod schema: legacy/current acceptance and emission

### Outcome (compacted)

The single frontend metadata schema owner (`src/frontend/src/services/abClass/abClassMetadata.zod.ts`) now accepts both the legacy two-field input and the current five-field input and emits the current five-field shape with plain enumerable `null` placeholders, in parity with Section 1. `ABClassMetadataSchema` (nullable, wire/mutation reads) and `NonNullableABClassMetadataSchema` (merge/write path) share one emission transform; no second schema owner was introduced. Red and Green reviews both passed and the section regression gate passed at completion (0 regressions, 0 new failures).

### Retained for later sections

**Single owner, file path and pattern.** `src/frontend/src/services/abClass/abClassMetadata.zod.ts` (337 lines) is the sole frontend metadata validation owner: `ClassFullSchema`, `ClassPartialSchema` and the mutation request schemas all reference `ABClassMetadataSchema`. Added schemas in that file are `BaselineAveragesSchema` (= `ClassAveragesSchema`), `StudentStandingSchema`, `StudentStandingsSchema` and the two public snapshot schemas. Existing strict-record checks (`isExactRecord`, `isBoundedDenseArray`, plain-prototype checks), canonical UTC timestamp rules and the four-state score union (finite 0–5 or exactly `'N'`/`'E'`/`'excluded'`) are unchanged.

**Both public schemas accept legacy/current and emit nulls.** `ABClassMetadataSchema` and `NonNullableABClassMetadataSchema` accept the legacy input (`{ classAverages, recentAssignments }`) and the current five-field input and both emit the current shape. Present `undefined`, unexpected own keys, sparse/malformed nested entries and non-canonical timestamps reject.

**Exact emitted five-field shape with plain enumerable nulls.** `emitCurrentFiveFieldShape()` returns a plain object literal:

```ts
{
  classAverages,      // existing: completeness, accuracy, spag, overall, updatedAt
  recentAssignments,  // existing: dense 0–3, unique assignmentId, non-increasing updatedAt
  baselineAverages,   // null when absent; else four scores + updatedAt
  allTaskStandings,   // null when absent; else { top, bottom }
  baselineStandings,  // null when absent; else { top, bottom }
}
```

The three new fields are ordinary enumerable `null`s (object-literal properties, not `Object.defineProperty(..., enumerable: false)`), matching Section 1's backend emission (`ABClassMetadata.js:333–336`), so they survive `JSON.stringify`, object spread and `structuredClone`. A non-null standings basis has exactly `top` and `bottom`, each a dense array of 0–3 `StudentStanding` entries `{ studentId, studentName, scores, recentAssignmentScores }`; identifiers are non-empty trimmed strings, score sets are exact four-field records and no timestamp is stored inside a standing entry.

**Cross-field rule to mirror.** `recentAssignmentScores.length === recentAssignments.length` (0–3) is enforced by the `validateStandingsScoreAlignment` refinement across both `allTaskStandings` and `baselineStandings` and both `top` and `bottom` lists. There is deliberately **no top/bottom disjointness rule**: duplicate students across the two lists are accepted to preserve parity with the Section 1 backend; disjoint selection is a producer rule for the Section 3 analyser and is asserted by `ClassSummarySchema` (SPEC.md:213).

**Approved surface expansion and complete test surface.** User approved (option 1) making emission contract-faithful with enumerable nulls. This expanded Section 2's authorised test surface to mechanically update every `parse(legacy) === legacy` deep-equality assertion/type literal to expect five enumerable fields with nulls. Direct Section 2 files: `src/frontend/src/services/abClass/abClassMetadata.zod.spec.ts`, `src/frontend/src/services/abClass/abClassMetadata.zod.strict.spec.ts` and the fixture `src/frontend/src/test/abClass/abClassMetadataFixtures.ts`. The complete list of Section 4/5 test files updated under the expansion (two-field→five-field expectations; Sections 4 and 5 need the same updates anyway) is:

- `src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.merge.spec.ts`
- `tests/synthetic-analysis/syntheticABClassMetadataFrontendParity.test.ts`
- `src/frontend/src/services/abClass/abClassMetadataService.calculation.spec.ts`
- `src/frontend/src/services/abClass/abClassMetadataService.queue.spec.ts`
- `src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.freshness.spec.ts`
- `src/frontend/src/services/abClass/refreshABClassMetadata.spec.ts`
- `tests/synthetic-analysis/syntheticABClassMetadataRoundTrip.test.ts`
- `src/frontend/src/services/googleClassrooms/classReadServices.metadata.spec.ts` (gate-regression fix: normalised five-field reads compared to raw two-field committed fixtures)

**Doc-entry and deferred pointers.** Docs sync reconciled the `abclass.md` § Planned changes Frontend-parity bullet (and stale § Sub-entity Frontend Zod cells) and the `frontend-shared-helpers-and-abstraction-standards.md` §9.28 metadata-schema-owner entry to **delivered** — neither remains `Not implemented`. Still pending for later sections: the §9.28 `ClassSummaryAnalyser` (Section 3) and `mergeClassMetadata` (Section 4) entries, and the `abclass.md` Snapshot-source bullet (Sections 3–5). The out-of-scope backend-subset parity gap (backend accepts any subset of the three new fields while the frontend requires exactly two or five keys) is recorded in the `## Deferred and Out-of-Scope Findings` ledger; the `abclass.md` § Validation `abClassMetadata.zod.ts` documentation nitpick is logged for the final documentation pass.

**`@remarks` carried forward in code.** The schema JSDoc records why the nullable union accepts a legacy input but emits the current five-field shape with null placeholders (the nullable union stays for wire reads and mutation requests), why enumerable placeholders are needed for serialisation/cloning, and why top/bottom disjointness is not enforced by the schema (Section 3 producer rule).

### Section checks

Passed: `npm run test:frontend -- src/services/abClass/abClassMetadata.zod` and `npm run lint:frontend:check`; confirmed no second metadata schema was introduced and the schema file is 337 lines (≤ 550). Section regression gate passed at completion: 7/8 checks, 0 regressions, 0 new failures, with the sole failing check being the accepted `backend-lint-check` baseline debt.

### Implementation notes / deviations / follow-up

- Record any schema-shape adjustment and the planned-entry reconciliation.
- **APPROVED SURFACE EXPANSION (user decision, option 1): enumerable null placeholders.** The Green Review found that emitting the three null placeholders via `Object.defineProperty(..., enumerable: false)` contradicts `SPEC.md:34/190/211` and this section's acceptance criterion, and diverges from the Section 1 backend's plain enumerable nulls (`ABClassMetadata.js:333–336`) — `JSON.stringify`, object spread and `structuredClone` dropped the placeholders. The user approved expanding Section 2's authorised change surface to make emission contract-faithful: remove the non-enumerable shim and update every affected `parse(legacy) === legacy` deep-equality assertion to expect five enumerable fields with nulls. This adds the following Section 4/5 test files to Section 2's test surface for minimal mechanical expectation/type-literal updates: `src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.merge.spec.ts`, `tests/synthetic-analysis/syntheticABClassMetadataFrontendParity.test.ts`, `src/frontend/src/services/abClass/abClassMetadataService.calculation.spec.ts`, `src/frontend/src/services/abClass/abClassMetadataService.queue.spec.ts`, `src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.freshness.spec.ts`, `src/frontend/src/services/abClass/refreshABClassMetadata.spec.ts`, and `tests/synthetic-analysis/syntheticABClassMetadataRoundTrip.test.ts` (added after the first test-update run exposed three more normalised-vs-raw comparisons at lines 55, 77 and 188). All are two-field literals that must now expect five enumerable fields with nulls; Sections 4 and 5 require the same updates anyway. Recorded as an approved deviation, not a deferred finding.
- Out-of-scope parity gap recorded in the deferred ledger below: the Section 1 backend accepts any subset of the three new fields while the frontend requires exactly two or five keys.
- **Docs sync outcome:** updated `docs/developer/data-shapes/abclass.md` (Planned-changes preamble and Frontend-parity bullet reconciled to delivered; stale `—` (frontend parity pending) cells in the § Sub-entity Frontend Zod column replaced with the actual schema names) and `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (§9.28 metadata-schema-owner entry marked delivered). No pages created; no JSDoc or other source changes, so no extra code lint/type-check was needed. Out-of-scope documentation drift reported, not fixed: `abclass.md` § Validation's `abClassMetadata.zod.ts` bullet (line ~939) does not name `BaselineAveragesSchema`/`StudentStandingsSchema` or mention legacy-to-five-field emission — logged as a nitpick for the final documentation pass.
- **FAILED section regression gate (first run, superseded):** `.opencode/scratchpad/s2-gate.log`; compare mode, session `feat-enahncedABClassMetadata`, 6/8 checks passing, 3 regressions and 3 new failures — all in `src/frontend/src/services/googleClassrooms/classReadServices.metadata.spec.ts` (test "retains every canonical metadata variant identically through both real response parsers" for small/medium/large-representative), where normalised five-field reads are compared to raw two-field committed fixtures. `backend-lint-check` still fails on the 4 accepted pre-existing `max-lines` warnings; `frontend-e2e-check` passed on this run. This gate did not pass; rework is in progress.

- **PASSED section regression gate (section-completion, supersedes the first run):** `.ts-regression-checker/reports/session-feat-enahncedABClassMetadata/runs/2026-11-20T06-13-49.551Z/comparison.txt`; compare mode, session `feat-enahncedABClassMetadata`, 7/8 checks passing, **0 regressions, 0 new failures**. All new code is clean (frontend lint 0 errors, frontend coverage 330 files / 3231 tests, typecheck, builder checks, frontend E2E all pass). The single failing check is `backend-lint-check` with the 4 accepted pre-existing `max-lines` warnings in untouched test files, unchanged from the baseline debt recorded in Delivery status. Full log: `.opencode/scratchpad/s2-gate-final.log`.
- **Commit and push:** SHA `179c87ade4ddf5904f510a4bacb57f2f4a5b2e2a`, message `feat: Section 2 - frontend ABClass metadata Zod schema five-field emission`, branch `feat/enahncedABClassMetadata-impl`. `git push` succeeded (`ea9101d4..179c87ad`); pre-commit hooks passed (Prettier unchanged, lint, `typecheck:all`). Tree clean after push.

---

## Section 3 — Typed baseline error and `ClassSummary` analyser/service registration

### Outcome (compacted)

`AttemptBaselineUnavailableError` was added for the three documented baseline-unavailability conditions, and a single in-memory `ClassSummary` contract — strict Zod schema plus `ClassSummaryAnalyser` — became the sole owner of all new calculation, registered in `DataAnalysisService` through a distinct `classSummaryAnalyser` field. The analyser composes `AveragingAnalyser` and its exported rollup helpers; no averaging maths was duplicated, and no existing entry point or analysis input schema changed. Both RED and GREEN loops reviewed PASS and all section checks passed.

### Retained for later sections

**`ClassSummary` is in-memory only — not a wire or persistence shape.** `ClassSummarySchema` is owned by `src/frontend/src/services/dataAnalysis/classSummary.zod.ts`; it uses four-state analyser-native `MetricResult` values (`computed` / `notAttempted` / `excluded` / `error`), while conversion to the metadata score union is the writer's `projectAverageScores()` mapping (Section 4). The delivered shape is:

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
  recentAssignmentScores: MetricScores[]; // one per supplied recent assignment
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
    updatedAt: string | null;
    averages: MetricScores;
  };
  recentAssignments: Array<{
    assignmentId: string;
    assignmentDefinitionKey: string;
    updatedAt: string | null;
  }>;
};
```

`recentAssignments` is the newest three fresh-class assignment instances in newest-first order; `recentAssignmentScores[i]` aligns by index to `recentAssignments[i]`. The writer keeps its own persisted rolling list via `mergeClassMetadata()` and uses `summary.target.averages` for the target's class averages (Section 4). **`updatedAt` nuance:** the in-memory identity `updatedAt` is `string | null` because `AssignmentPartialSchema.updatedAt` is nullable on the read shape and `assignmentIdentity()` copies it verbatim; canonical timestamp validation stays with the writer's `CanonicalMetadataTimestampSchema` in Section 4. SPEC.md's `updatedAt: string` is a product-spec simplification; SPEC.md is read-only source of truth and was not edited.

**`ClassSummarySchema` rules (`classSummary.zod.ts`, 172 lines, ≤ 550).** `z.strictObject` throughout rejects extra keys; `MetricScoresSchema` reuses shared `MetricResultSchema`; `AssignmentIdentitySchema` requires non-empty `assignmentId`/`assignmentDefinitionKey` and nullable `updatedAt`; `studentId`/`studentName` are non-empty strings; `top`/`bottom` are arrays capped at 3. A `superRefine` asserts two cross-field rules: `validateStandingsDisjointness` rejects a `studentId` appearing in both `top` and `bottom` of one basis (applied to `allTasks` and to a non-null `baseline`), and `validateScoreAlignment` requires `recentAssignmentScores.length === summary.recentAssignments.length` for both lists of both bases (baseline only when its standings are non-null). Each analyser declares its own output schema so `analyseClassSummary()` parses with this one. The persisted metadata validators deliberately allow duplicate students; disjointness is a producer rule asserted here.

**`ClassSummaryAnalyser` contract (`src/frontend/src/services/dataAnalysis/classSummaryAnalyser.ts`, 381 lines, ≤ 550).** `analyse(input: AveragingAnalyserInput, options: AnalyseClassSummaryOptions): ClassSummary`, where `AnalyseClassSummaryOptions = { target: AssignmentPartial; recentAssignments: AssignmentPartial[] }` — both supplied by the writer from the fresh class read; the analyser performs no freshness selection or rolling history. Optional `CriterionWeightings` are defaulted to `DEFAULT_CRITERION_WEIGHTINGS` (40/40/20) in the constructor. It composes full-class absolute (`allTasks`), full-class baseline (`baseline`), one isolated absolute analysis per recent assignment, and an isolated absolute analysis for the target (`target.averages`). `allTasks.classAverages` and `baseline.classAverages` equal the corresponding `AveragingAnalyser.perClass` results; the summary adds no averaging maths of its own.

- **All-tasks-absolute guarantee:** `allTasks` pins `analysisMode: 'absolute'` unconditionally, regardless of the caller's `filter.analysisMode` (SPEC.md decision 10), so it can never silently equal the baseline basis; documented on `analyse()`'s JSDoc and covered by a regression test in `classSummaryAnalyser.boundary.spec.ts`.
- **Whole-class-baseline-key rule:** baseline task keys are read only from the full-class baseline result (`attemptBaseline.baselineTaskKeys`) and reused for every isolated assignment; no isolated analysis runs in baseline mode, so no second pool or baseline is derived.
- Isolated baseline scores filter each student's per-task display metrics by `taskKey` against those baseline keys, then roll up each criterion with `rollupMetric()` and derive `overall` with `computeOverallComposite()` using constructor weights. `TaskDisplayMetric` is a structural subset of `MetricResult`, so no conversion layer is needed for `rollupMetric`. A student with no baseline metrics is rolled up over unfiltered evidence and each criterion passes through `convertToBaselineExcluded` before the composite is derived.
- **Ranking restriction:** only rows with `overall.state === 'computed'` and a finite numeric value, and only students holding a row in _every_ supplied isolated result, can form a complete aligned standing entry. Top is descending, bottom ascending, ties by `studentId` ascending; take top three first, then bottom three from remaining students so the lists are disjoint and 0–3 dense. The every-isolated-assignment restriction is forced by the canonical medium fixture (newest three assignments have 5/12, 12/12, 3/12 submitters) and the schema's score-alignment refinement; recorded in `buildStandings` `@remarks`.

**`AttemptBaselineUnavailableError` contract (`src/frontend/src/services/dataAnalysis/analysers/attemptBaselineSelection.ts`, 300 lines, ≤ 550).** A typed `Error` subclass thrown by `deriveAttemptBaseline` only for the three documented conditions — roster below 3, fewer than 2 candidates, empty pool intersection — with unchanged messages; plain invariant errors remain plain `Error`. `ClassSummaryAnalyser.analyseBaseline()` catches only this type by `instanceof`, emitting `available: false` with null averages/standings while all-task fields are still produced; every other error propagates unchanged, with no message matching or broad catch.

**`DataAnalysisService` registration (`src/frontend/src/services/dataAnalysis/dataAnalysisService.ts`, 109 lines, ≤ 550).** `analyseClassSummary(input, options)` validates input with the existing schema and output with `ClassSummarySchema`. The analyser is held in a distinct `classSummaryAnalyser` field matching `summaryAnalyser`; the averaging registry is unchanged, and `analyse(input, 'averaging')` and `analyseAssignmentSummary()` are unchanged. `AnalysisFilterSchema`, `AveragingAnalyserInputSchema` and `DataAnalysisResponseSchema` are unchanged. Helpers reused: `AveragingAnalyser`, `rollupMetric`, `computeOverallComposite`, `convertToBaselineExcluded`; `projectAverageScores` is used by Section 4.

**Files and line counts (all authored files ≤ 474, within the 550 gate).** Source: `classSummaryAnalyser.ts` 381, `classSummary.zod.ts` 172, `attemptBaselineSelection.ts` 300 (was 279), `dataAnalysisService.ts` 109 (was 89). Sanctioned RED-review spec splits: `attemptBaselineSelection.spec.ts` 470 (629 pre-split), `classSummaryAnalyser.spec.ts` 421 (585 pre-split), plus siblings `src/frontend/src/services/dataAnalysis/analysers/attemptBaselineSelection.typedError.spec.ts` 264 and `src/frontend/src/services/dataAnalysis/classSummaryAnalyser.boundary.spec.ts` 474; `classSummary.zod.spec.ts` 179 and `dataAnalysisService.spec.ts` 447. Specs stay co-located with their subjects per `averagingAnalyser.*.spec.ts`; source modules stay at the `dataAnalysis/` root.

**Canonical fixtures.** `medium` is the canonical baseline profile (`dataAnalysis.mediumBaselineRoundTrip.spec.ts` pins baseline claims); `small` and `large-representative` are secondary. Historical-source variants use existing `metadataRefreshFixtures.ts` helpers; no generator extension or corpus change. Ineligible-roster, empty-intersection and error-propagation probes stay as local boundary fixtures.

**Docs pointers and deviations.** The `frontend-shared-helpers-and-abstraction-standards.md` § 9.28 `ClassSummaryAnalyser` entry and the `frontend-data-analysis-response.md` § Planned class summary contract entries were planned `Not implemented` and are reconciled by the parallel Docs agent (which owns canonical docs); the `updatedAt: string | null` nuance above is likewise reconciled in `frontend-data-analysis-response.md`. Both review-round deviations and accepted scrutiny decisions are recorded verbatim below; that subsection remains authoritative.

### Section checks

Passed: RED and GREEN loops both reviewed PASS; section targeted suites 7 files / 56 tests, then 7 files / 57 tests after the regression test; `dataAnalysis.mediumBaselineRoundTrip` 9/9; full `npm run test:frontend` 334 files / 3255 tests; `npm run lint:frontend:check` 0 errors / 16 baseline warnings; `tsc -b` and `npm run typecheck:all` exit 0. No analysis input schema changed, no averaging logic added outside the analyser, and all authored modules are ≤ 474 lines.

### Implementation notes / deviations / follow-up

- Confirm the analyser is held in its own `classSummaryAnalyser` field (matching `summaryAnalyser`) and that the averaging registry is unchanged; record any deviation.
- **GREEN review — one Improvement fixed (allTasks mode pin):** the Green Review found `ClassSummaryAnalyser.analyse()` computed the `allTasks` basis with the caller's `filter.analysisMode` verbatim; SPEC.md decision 10 defines `allTasks` as the absolute basis unconditionally, so a baseline-mode input could silently make it equal the baseline basis. Fixed by pinning `analysisMode: 'absolute'` in that pass (matching `analyseBaseline`/`analyseIsolated`), documenting the guarantee on `analyse()`'s JSDoc, and adding a regression test in `classSummaryAnalyser.boundary.spec.ts` that feeds baseline-mode input and asserts `allTasks.classAverages` equals the absolute `perClass` result. Latent only (sole caller supplies absolute).
- **GREEN review — two scrutiny decisions ACCEPTED (no change):** (1) `ClassSummarySchema.updatedAt` is `string | null` in the in-memory shape because `AssignmentPartialSchema.updatedAt` is nullable on the read shape and `assignmentIdentity()` copies verbatim; canonical timestamp validation stays with the writer's `CanonicalMetadataTimestampSchema` (Section 4). SPEC.md's `updatedAt: string` is a product-spec simplification — SPEC.md is read-only source of truth and not in any section's change surface, so it was not edited; the canonical data-shape doc (`frontend-data-analysis-response.md`) will reconcile this in docs sync. (2) Standings consider only students present in every supplied isolated recent assignment — forced by the canonical medium fixture (newest three assignments have 5/12, 12/12, 3/12 submitters) and the schema's score-alignment refinement; documented in `buildStandings` `@remarks`.
- **Docs sync outcome:** updated `docs/developer/data-shapes/frontend-data-analysis-response.md` (Planned class summary contract preamble + four bullets reconciled to delivered; added an `updatedAt: string | null` in-memory note; writer-consumption bullet left `Not implemented` for Section 4) and `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (§9.28 `ClassSummaryAnalyser` entry marked delivered; `mergeClassMetadata` left pending for Section 4). No pages created; JSDoc on new symbols verified accurate, no source changes — no extra code lint/type-check needed. Both docs Prettier-clean. Out-of-scope documentation observations reported, not fixed: new modules absent from the File Index (nitpick); `data-analysis-architecture.md` not yet describing the analyser (deferred to final Documentation-and-rollout); `DataAnalysisService` class-level JSDoc imprecise but pre-existing (nitpick).
- **RED review — sanctioned test-file splits (in-scope, binding 550-line gate):** the Red Review found two authored spec files over the hard 550-line trigger: `attemptBaselineSelection.spec.ts` (629) and `classSummaryAnalyser.spec.ts` (585). The orchestrator expands Section 3's test surface to permit two sibling spec files so the split stays in-section: `src/frontend/src/services/dataAnalysis/analysers/attemptBaselineSelection.typedError.spec.ts` (typed-error block) and `src/frontend/src/services/dataAnalysis/classSummaryAnalyser.boundary.spec.ts` (local boundary fixtures, unavailability and error-propagation describes). Specs stay co-located with their subjects; this follows the existing `averagingAnalyser.*.spec.ts` sibling pattern and satisfies `docs/developer/frontend/frontend-architecture.md` §2/§4. The source-module paths remain the plan-prescribed `classSummaryAnalyser.ts` and `classSummary.zod.ts` at the `dataAnalysis/` root (no reorganisation).

- **PASSED section regression gate (section-completion):** `.ts-regression-checker/reports/session-feat-enahncedABClassMetadata/runs/2026-11-20T08-41-34.019Z/comparison.txt`; compare mode, session `feat-enahncedABClassMetadata`, 7/8 checks passing, **0 regressions, 0 new failures**. All new code is clean (frontend lint 0 errors, frontend coverage pass, typecheck, builder checks, frontend E2E all pass). The single failing check is `backend-lint-check` with the 4 accepted pre-existing `max-lines` warnings in untouched test files, unchanged from baseline debt. Full log: `.opencode/scratchpad/s3-gate.log`.
- **Commit and push:** SHA `438765277f8f161ff4fd4e4f8e02ed5ecaa3cddb`, message `feat: Section 3 - typed baseline error and ClassSummary analyser`, branch `feat/enahncedABClassMetadata-impl`. `git push` succeeded (`e0e7c699..43876527`); pre-commit hooks passed (Prettier unchanged, lint, `typecheck:all`). Tree clean after push.

---

## Section 4 — Writer integration: consume summary, retain history, write five-field snapshot

### Outcome (compacted)

The writer now replaces its two direct `analyse()` calls with exactly one `DataAnalysisService.analyseClassSummary()` call fed from the fresh class read, and maps the validated `ClassSummary` into the five-field metadata snapshot through `mergeClassMetadata()`. All rolling-history, freshness, no-op, failure and queue behaviour is unchanged; no calculation was added to the writer and no schema or Section 3 file changed. RED and GREEN loops both reviewed PASS (GREEN verdict PASS, no findings) and all section checks passed.

### Retained for later sections

**Writer execution contract (`src/frontend/src/services/abClass/abClassMetadataService.ts`, 94 lines).** Exactly one `service.analyseClassSummary(analysisInput, { target: decision.target, recentAssignments })` call, where `analysisInput` is the existing `AveragingAnalyserInput` built from the fresh `getABClass` read with `filter: { classIds: [classFull.classId], analysisMode: 'absolute' }` and the live definition partials. `recentAssignments = classFull.assignments.toSorted(compareAssignmentNewestFirst).slice(0, RECENT_ASSIGNMENT_LIMIT)` — the newest three fresh-class assignments, newest-first. Guard/call order is unchanged: fresh read → not-found throw → `getMetadataRefreshDecision()` → skip return → `requireDefinitionCoverage()` → single summary call → `mergeClassMetadata(..., now())` → `UpdateABClassRequestSchema.parse()` → `callApi()` → `parseApiResponse(ClassPartialSchema, ...)`. `now()` is read only on the changed path; no-op reasons (`noAssignments`/`unchanged`/`staleSource`) make no service call, clock read or write; failures propagate unchanged with the lane released; the lane is still `runApiQueuedTask(CLASSES_BULK_MUTATION_JOB_NAME, ...)` with no try/catch. No new query, invalidation or feedback hook. The `@remarks` on `refreshABClassMetadataInQueue` records why the writer supplies selection inputs rather than deriving the baseline itself and why rolling history is never rebuilt from live definitions.

**`mergeClassMetadata` — new signature and five-field mapping (`src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.ts`, 210 lines).** Signature changed from `mergeClassMetadata(previous, classScores, target, assignmentScores, summaryUpdatedAt)` to `mergeClassMetadata(previous: ABClassMetadata, summary: ClassSummary, summaryUpdatedAt: string)` — three arguments. All five fields are mapped only through the existing `projectAverageScores()`/`projectMetric()` (no duplicated state switch, no new averaging maths), then parsed with `NonNullableABClassMetadataSchema`:

- `classAverages` = projected `summary.allTasks.classAverages` + the summary clock (`summaryUpdatedAt`).
- `recentAssignments` = unchanged rolling history from `previous` plus `summary.target` (ID replace-or-push, newest-first sort, `slice(0, RECENT_ASSIGNMENT_LIMIT)`); never seeded from the summary's three assignments.
- `allTaskStandings` = always non-null `projectStandings(summary.allTasks.standings, scoreCount)`.
- `baselineAverages`/`baselineStandings` = null when `!(summary.baseline.available && … !== null)`, otherwise projected.

`RECENT_ASSIGNMENT_LIMIT` (3) is now exported from `metadataProjection.ts` for the writer's newest-three selection. A baseline-unavailable summary writes null baseline fields with the all-task fields populated and still saves.

**Option A score-trimming rule — user decision (BLOCKER).** The user chose Option A (2026-11-20; recorded as `approved` in the deferred ledger and in the Implementation notes below): keep rolling history unchanged (a fresh `metadata: null` write yields one target entry) and trim every projected standing's `recentAssignmentScores` with `.slice(0, scoreCount)` where `scoreCount = persistedRecent.length` (computed after `recent.slice(0, RECENT_ASSIGNMENT_LIMIT)`), keeping the newest-first prefix. The private `projectStandings(standings, scoreCount)` in `metadataProjection.ts` owns the trim; there is no history seeding from the summary's three assignments. The 3→1 trim is load-bearing: canonical fixtures carry three scores per standing against a fresh one-entry history, so without it `validateStandingsScoreAlignment` (3 ≠ 1) rejects inside `NonNullableABClassMetadataSchema.parse`.

**In-scope expectation update (test case 6).** RED never exercised the `backend.requests` assertion in the `it.each(PROFILES)` calculation test (it short-circuited at the spy call-count check), leaving three stale null-placeholder cases. That single expectation was updated non-vacuously to derive the five-field values from the real returned `ClassSummary` via a call-through spy (`calculate.mock.results[0].value`), with a hard baseline-eligibility guard (`throw` unless `available && classAverages !== null`) across all three profiles. No other expectation was weakened.

**Delivered files and line counts.** Production: `src/frontend/src/services/abClass/abClassMetadataService.ts` 94 (was 93), `src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.ts` 210 (was 159) — both ≤ 210 and well under the 550 gate. New sibling spec: `src/frontend/src/services/abClass/abClassMetadataService.summaryConsumption.spec.ts` 410 (new). Modified specs: `src/frontend/src/services/abClass/abClassMetadataService.calculation.spec.ts` 292, `src/frontend/src/services/abClass/abClassMetadataService.failure.spec.ts` 173, `src/frontend/src/services/abClass/abClassMetadataService.queue.spec.ts` 181, `src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.merge.spec.ts` 342, `src/frontend/src/services/dataAnalysis/postAnalysis/refreshABClassMetadata.spec.ts` 121. No `*.zod.ts`, Section 3 or post-analysis lifecycle file touched (`AnalysisFilterSchema`, `AveragingAnalyserInputSchema`, `ClassSummarySchema` and all metadata Zod schemas are unchanged).

**Shared helper and fixtures.** `mergeClassMetadata` is an `extend` of its single owner `metadataProjection.ts` (single owner of rolling history; now maps `ClassSummary`); canonical doc target `frontend-data-analysis-response.md` § Metadata refresh execution contracts. Reused unchanged: `getMetadataRefreshDecision`, `compareAssignmentNewestFirst`, `projectAverageScores`, `CLASSES_BULK_MUTATION_JOB_NAME` lane constant. Canonical fixtures are the verified historical-source views `small`/`class-2`, `medium`/`class-0`, `large-representative`/`class-1` from `metadataRefreshFixtures.ts` (baseline-eligible: pool 2; 2/6/4 baseline keys); null-name untouched-newest failure probes remain local boundary evidence; no generator extension or new profile.

**Docs-sync and deferred pointers.** Docs sync is running in parallel under a separate Docs agent that owns the canonical docs; the `Implementation notes` below records the pending lines. Pending reconciliation: the `frontend-data-analysis-response.md` writer-consumption bullet and §9.28 `mergeClassMetadata` helper entry, the `abclass.md` snapshot-source bullet, and `data-analysis-architecture.md` § Metadata refresh (the last two still describe the pre-Section-4 two-call writer). The Option A standing-alignment decision is recorded as `approved` in the `## Deferred and Out-of-Scope Findings` ledger; no new deferred finding was raised.

### Section checks

RED and GREEN loops both reviewed PASS (GREEN verdict PASS, no Critical/Improvement/Nitpick findings). Passed: `npm run test:frontend:coverage` (335 files / 3260 tests, 0 failed), scoped writer + post-analysis suites (12 files / 102 tests), `npm run lint:frontend:check` (0 errors / 16 pre-existing baseline warnings, none in touched files), `npm exec tsc -- -b src/frontend/tsconfig.json` and `npm run typecheck:all` (exit 0), Prettier clean on all touched files; both production files ≤ 210 lines. No E2E run (no user-visible change).

### Implementation notes / deviations / follow-up

- **Signature change:** `mergeClassMetadata(previous, classScores, target, assignmentScores, summaryUpdatedAt)` → `mergeClassMetadata(previous: ABClassMetadata, summary: ClassSummary, summaryUpdatedAt: string)`. All five metadata fields are mapped from the summary: `classAverages` (projected `allTasks.classAverages` + summary clock), `recentAssignments` (unchanged rolling rules from `summary.target`), `allTaskStandings` (non-null), `baselineAverages`/`baselineStandings` (null when baseline unavailable). `RECENT_ASSIGNMENT_LIMIT` is now exported from `metadataProjection.ts` for the writer's newest-three selection.
- **User decision (BLOCKER, Option A) implemented:** rolling history stays unchanged (fresh `metadata: null` write = 1 target entry); every projected standing's `recentAssignmentScores` is trimmed via `.slice(0, scoreCount)` where `scoreCount = persistedRecent.length`, keeping the newest-first prefix. `projectStandings(standings, scoreCount)` in `metadataProjection.ts` owns the trim; no history seeding from the summary's three assignments.
- **In-scope expectation update (test case 6):** RED phase never exercised the `backend.requests` assertion in the `it.each(PROFILES)` calculation test (short-circuited at the spy call-count check), leaving three stale null-placeholder cases. Updated that single expectation to derive the five-field values from the real returned `ClassSummary` (calling-through spy), non-vacuously, with a baseline-eligibility guard; verified all three profiles produce real baseline averages and that the 3→1 score trim is load-bearing for `medium` and `large-representative`. No other expectation weakened.
- **Docs sync outcome:** updated `docs/developer/data-shapes/frontend-data-analysis-response.md` (renamed "Planned class summary contract (Not implemented)" heading to "Class summary contract"; reconciled the two-`analyse()` writer flow to the single `analyseClassSummary()` call; removed the section-level and writer-consumption `Not implemented` markers; kept the Section 3 `updatedAt: string | null` note), `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (removed §9.28 pending preamble; marked `mergeClassMetadata` delivered with its 3-arg signature/mapping/trim/validation), and `docs/developer/data-shapes/abclass.md` (repaired one cross-link anchor to the renamed heading). No pages created; all three docs Prettier-clean; JSDoc on changed symbols verified accurate, no source edits needed. Out-of-scope observations reported, not fixed: `abclass.md` "Snapshot source — Not implemented" bullet left pending (owned by later sections/final docs); `data-analysis-architecture.md` still lacks the analyser description (already deferred); the E2E scenario helper still calls `analyse()` twice so its doc description remains accurate.
- **PASSED section regression gate (section-completion):** `.ts-regression-checker/reports/session-feat-enahncedABClassMetadata/runs/2026-11-20T12-04-48.845Z/comparison.txt`; compare mode, session `feat-enahncedABClassMetadata`, 7/8 checks passing, **0 regressions, 0 new failures**. All new code clean (frontend lint 0 errors, frontend coverage pass, typecheck, builder checks, frontend E2E pass). The single failing check is `backend-lint-check` with the 4 accepted pre-existing `max-lines` warnings in untouched test files, unchanged from baseline debt. Full log: `.opencode/scratchpad/s4-gate.log`.
- **Commit and push:** SHA `1665f6c37c54bce3e9a6afa96eba59e7965ed5f1`, message `feat: Section 4 - writer consumes ClassSummary, writes five-field snapshot`, branch `feat/enahncedABClassMetadata-impl`. `git push` succeeded (`668f823d..1665f6c3`); pre-commit hooks passed (Prettier unchanged, lint, `typecheck:all`). Tree clean after push.

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

| Finding                                                                        | Severity    | Scope rationale                                                                                                                                                                                                                                                                                                                                                                                                                  | Evidence                                                                                                                                                    | Disposition | User decision                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI display of the new metadata fields                                          | Improvement | `SPEC.md` non-goal; no production component renders metadata scores                                                                                                                                                                                                                                                                                                                                                              | `SPEC.md` § Purpose / V1 scope; Kif exploration of frontend consumers                                                                                       | noted       |                                                                                                                                                                                                                                                                                                                   |
| Persisting baseline pool IDs or baseline task keys                             | Improvement | `SPEC.md` non-goal; internal derivation only                                                                                                                                                                                                                                                                                                                                                                                     | `SPEC.md` § Purpose / V1 scope                                                                                                                              | noted       |                                                                                                                                                                                                                                                                                                                   |
| Changing the metadata freshness trigger                                        | Improvement | Explicitly unchanged contract                                                                                                                                                                                                                                                                                                                                                                                                    | `SPEC.md` § Agreed product decisions, § Prefetch policy                                                                                                     | noted       |                                                                                                                                                                                                                                                                                                                   |
| Analysis-input override for whole-class baseline keys                          | Improvement | Avoided: whole-class keys are applied by the summary analyser via shared rollup helpers, so no input schema change is needed                                                                                                                                                                                                                                                                                                     | `SPEC.md` § Core derivation model; `dataAnalysis.zod.ts` unchanged                                                                                          | disregarded |                                                                                                                                                                                                                                                                                                                   |
| Writing metadata in `postAnalysisFeedback.ts`                                  | Improvement | User confirmed the existing refresh task owns the write; the feedback hook stays warning-only                                                                                                                                                                                                                                                                                                                                    | `SPEC.md` § Planning handoff notes; question-tool confirmation                                                                                              | noted       | Confirmed by user: use the existing refresh task, not the feedback hook                                                                                                                                                                                                                                           |
| Backend accepts any subset of the three new metadata fields                    | Material    | Backend acceptance was delivered and committed in Section 1; tightening it is outside Section 2's frontend-schema surface. `SPEC.md:191` says a current input has all five fields, so the backend is more lenient than the contract, but legacy-plus-subset is not produced by any caller.                                                                                                                                       | `src/backend/Models/ABClassMetadata.js:222–227, 272–286` (`_checkRecord` treats new fields as optional); Green Review `review-section2-green.md` scope note | noted       |                                                                                                                                                                                                                                                                                                                   |
| Standing-score alignment on a fresh `metadata: null` write (Section 4 BLOCKER) | Material    | Ambiguous product decision: SPEC.md:311 aligns each standing's `recentAssignmentScores[i]` to `summary.recentAssignments[i]` (up to 3 fresh-class instances), but the persisted schema `abClassMetadata.zod.ts:321` requires the array length to equal the persisted rolling `recentAssignments.length`, which is 1 on a fresh write. Both candidate resolutions change agreed behaviour, so the plan does not authorise either. | `SPEC.md:214,311`; `src/frontend/src/services/abClass/abClassMetadata.zod.ts:317–334`; Section 4 Red agent report "Remaining risk for GREEN"                | approved    | User chose Option A (2026-11-20): keep rolling history unchanged (fresh write = target only); project the summary standings but truncate each `recentAssignmentScores` to the persisted history length, newest-first (keep the first N scores). Implement in `mergeClassMetadata()` under Section 4's Green loop. |

Nitpicks are logged in `.opencode/scratchpad/<branch-slug>-deferred-findings.md` (branch name with `/` replaced by `-`), with the two required tables: `Deferred and out-of-scope findings` and `Nitpicks`. Link that ignored working file here if nitpicks are logged during delivery; do not list individual nitpicks in this plan.
