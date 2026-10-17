# Frontend ABClass Metadata — Delivery Plan (TDD-First)

## Status and read-first context

Planning complete, 17 October 2026. Specification, feedback/layout and this action
plan have independent clean reviews. Ready for implementation orchestration only
after the stated backend integration prerequisite is satisfied. This plan is not
implementation authority. Preserve root `ACTION_PLAN.md` and `docs/plans/SPEC.md`,
which belong to backend delivery.

Read before execution:

- @docs/plans/frontend-abclass-metadata/SPEC.md
- @docs/plans/frontend-abclass-metadata/POST_ANALYSIS_FEEDBACK_LAYOUT.md
- @docs/developer/data-shapes/abclass.md
- @docs/developer/data-shapes/frontend-data-analysis-response.md
- @docs/developer/frontend/frontend-architecture.md
- @docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md
- @docs/developer/frontend/data-analysis-architecture.md
- @docs/developer/frontend/frontend-testing.md
- @docs/developer/testing/synthetic-test-data.md

## Scope, prerequisites and assumptions

- Deliver strict shared metadata Zod schemas, existing class-read support, queued
  upsert/update wrappers, timestamp-gated rolling metadata persistence, a shared
  extensible post-analysis hook on both averaging surfaces, and warning feedback.
- Required backend metadata request/response support is still unfinished in this
  checkout. Before integration/execution, bring in the completed, reviewed backend
  contract from its worktree using the user's normal integration workflow. Verify
  both reads and both mutations against that implementation. Do not implement
  missing backend functionality or relax frontend schemas to bypass this dependency.
- User chose analysis-triggered refresh as the interim behaviour, newest assignment
  partial as target, timestamp-only freshness, and session-local queued protection.
  No polling, ProgressTracker redesign, cross-session locking, backfill, score-rule
  changes, new endpoints, deletion changes, deployment, commits or pushes.
- Current working-tree baseline: `d7e5c47`, with unrelated user-owned modification
  `.opencode/agents/code-reviewer.md`. Never modify/revert it. Recheck status before
  every edit; update size counts after backend integration without changing scope.
- Canonical frontend contract/helper entries already exist as `Not implemented` in
  `abclass.md`, `frontend-data-analysis-response.md`, frontend helper/analysis docs
  and `synthetic-test-data.md`. They are prerequisites, not postponed documentation.
- No unresolved product decisions or authorised deliberate deferrals.

## Global engineering and delivery gates

1. Delegate red-first Vitest work to Testing Specialist, production implementation
   to Implementation, and browser work to Playwright. Each section follows **Red →
   Green → Refactor** with focused evidence; do not introduce production code solely
   to make a test pass.
2. Give Testing Specialist, Implementation and Code Reviewer the common reads above
   plus each section's exact mandatory paths below. Every prompt has a Mandatory
   Reading block of `@`-prefixed paths. Docs receives changed ownership/docs; Data
   Shapes Agent receives changed schemas/contracts before code-review sign-off.
3. Run the mandatory Implementation → Code Reviewer → fixes → re-review loop until
   clean for each non-trivial section. Docs reconciles canonical prose and Data
   Shapes Agent reconciles validation/transport contracts in the same section.
4. Preserve public entrypoints, GAS envelope handling, retry/backoff, method names,
   assignment redaction and constructor-owned defaults. No config/rule suppression,
   backend runtime imports into frontend, raw GAS calls or competing queues/caches.
5. Use verify-only `npm run lint:frontend:check`, focused
   `npm run test:frontend -- <src-relative-path>`, and `npm run typecheck:all`.
   Focused synthetic checks use `npm run test:synthetic -- <test-path>`.
6. Establish a **new** regression-checker baseline before delivery with
   `npm run regression-checker -- frontend-abclass-metadata`, shell timeout
   1,200,000 ms. Retain this identity and compare once after each completed section,
   never between Red/Green/Refactor. Load the regression-checker skill at execution.
   Record actual report paths, pre-existing failures and zero new regressions.
7. Kif's planning-time frontend lint result was zero errors and 24 existing
   max-lines warnings. Do not pretend this is a green global lint gate. Changed
   files must have no new diagnostics and satisfy sizing; leave unrelated debt
   alone and report baseline failures honestly. Do not bypass commit hooks.
8. Every added/changed realistic fixture selects canonical views. Invalid, legacy,
   equal-time, stale-version and boundary probes are local clones. Migrate only
   touched existing suites opportunistically. Existing metadata samples are supplied
   snapshots, not the oracle for newly calculated averages.

## Checked module-sizing and separation budget

Counts are physical lines from Kif's read-only inventory. Recheck after integration.
Every materially changed module projected over 500 has an explicit split below;
any touched frontend module already over 550 must actually be decomposed in this
change. Preserve JSDoc and behaviour; never compress formatting to evade limits.
Follow frontend domain-folder grouping. Backend facade/load-order splitting rules
were consulted but no production backend file is in this frontend scope.

Paths below are relative to `src/frontend/` unless prefixed otherwise.

| Module / owner                                                                                          | Current LOC |                  Unsplit projection | Explicit separation / delivered budget                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------- | ----------: | ----------------------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/apiService.ts`                                                                            |         499 |                             570–620 | Section 3: compatibility facade <50; `services/api/apiTransport.ts` ~330–370 and `apiQueue.ts` ~220–280. Transport owns schemas/dispatch/retries/parseApiResponse; queue imports it directly, avoiding an import cycle. Re-export every existing public symbol.                                |
| `src/services/apiService.spec.ts`                                                                       |       1,763 |                         1,950–2,100 | Section 3: split transport/envelope, retry/diagnostics, queue and cancellation suites, each <=500, shared test setup under `src/test/api/`; add deferred-task cases to queue suites.                                                                                                           |
| `src/services/googleClassrooms/classPartials.zod.ts`                                                    |          40 |                               45–55 | Section 2: import required shared schema; no split.                                                                                                                                                                                                                                            |
| `src/services/googleClassrooms/classDetail/classDetailService.zod.ts`                                   |         155 |                             160–175 | Section 2: import required shared schema; no split.                                                                                                                                                                                                                                            |
| `src/services/googleClassrooms/classDetail/classDetailService.zod.spec.ts`                              |         518 |                             560–620 | Section 2: full/assignment/teacher, submission/artifact and definition schema suites; new metadata integration suite separately; shared canonical selectors under `src/test/abClass/`. Each <=350.                                                                                             |
| `src/services/googleClassrooms/classPartialsService.spec.ts` / `classDetail/classDetailService.spec.ts` |   174 / 138 |                           210 / 180 | Section 2: metadata response assertions, no split. Read wrappers (22/28) may need JSDoc only, projected <40 each.                                                                                                                                                                              |
| `src/features/classPage/useClassPageData.ts`                                                            |         498 |                             520–540 | Section 5: extract existing prefetch effect/ref/constant to `useClassPageAssignmentPrefetch.ts` (~70–100); main hook <=480. Preserve once-per-class prefetch semantics.                                                                                                                        |
| `src/features/taskHeatmap/useHeatmapsPageData.ts`                                                       |         475 |                             500–520 | Section 5: extract preview query option/input/combined-state helpers to `heatmapsPreviewQueries.ts` (~90–130); hook <=450. No feature dependency reversal.                                                                                                                                     |
| `src/test/classes/classesPageTestHelpers.tsx`                                                           |         561 |                             570–590 | Section 2: extract `classesPageTestFixtures.ts`, `classesPageRenderHelpers.tsx`, `classesPageModelAssertions.ts` and `classesPageScreenAssertions.tsx`; keep compatibility re-exports where useful; each <=300. Move coherent fixture/render/assertion responsibilities, not just extra lines. |
| `src/pages/classesPageModel.spec.ts`                                                                    |         582 |                             590–620 | Section 2: split merge/base, sorting/grouping and validation suites; canonical factory under `src/test/classes/`; each <=350.                                                                                                                                                                  |
| `src/test/dataAnalysis/fixtures.ts`                                                                     |         467 |                             475–495 | Section 2: required metadata field only; keep <500, new cross-feature selectors in `src/test/abClass/`, not this near-full file.                                                                                                                                                               |
| `src/services/dataAnalysis/heatmapAdapter.spec.ts`                                                      |         497 |                             500–525 | Section 2: extract coherent assignment-weighting/contribution cases into `heatmapAdapter.weighting.spec.ts`; shared canonical fixture setup under `src/test/dataAnalysis/`; both <=400.                                                                                                        |
| `e2e-tests/helpers/classes-page-end-to-end-helpers.ts`                                                  |         657 |                             665–690 | Section 2/6 if explicit payload projection needs editing: extract runtime fixture/scenario construction, navigation and browser assertions into named companion helpers; preserve existing imports via a thin facade; each <=350.                                                              |
| Other required-field fixture providers                                                                  |      99–438 |                          +1–20 each | Section 2: inventory below; keep <=500 and do not edit unrelated oversized consumer suites merely because they import a corrected factory.                                                                                                                                                     |
| `src/test/taskHeatmap/previewFixtures.ts` / E2E source-link fixtures                                    |   287 / 436 |                       <=300 / <=450 | Already parse canonical metadata-bearing views; change only if assertions need updating, no generator regeneration.                                                                                                                                                                            |
| `src/services/dataAnalysis/dataAnalysisService.ts` / `dataAnalysis.zod.ts`                              |    89 / 316 |                           unchanged | Preserve service and analyser public output. Add post-analysis context schema in its own domain folder.                                                                                                                                                                                        |
| `src/query/sharedQueries.ts` / `queryKeys.ts`                                                           |    353 / 18 |                           unchanged | Reuse existing query options/keys; do not add new cache datasets.                                                                                                                                                                                                                              |
| New metadata schema / mutation schemas / mutation service                                               |           0 |          180–300 / 100–180 / 80–150 | Section 1/3: separate owners under `services/abClass/`; each <500.                                                                                                                                                                                                                             |
| New task schema / runner / freshness+projection / persistence                                           |           0 | 80–150 / 80–140 / 150–250 / 120–220 | Section 4: separate coherent modules under `services/dataAnalysis/postAnalysis/`, no giant hook or service.                                                                                                                                                                                    |
| New shared hook / feedback helper / co-located suites                                                   |           0 |     160–260 / 60–110 / 200–450 each | Section 5: lifecycle and feedback separate; split suites by lifecycle/failure/extension contracts before any exceeds 500.                                                                                                                                                                      |
| `tests/synthetic-analysis/syntheticApiRoundTripBridge.test.ts` (root)                                   |         353 |                               <=400 | Section 6: modest metadata assertions; add separate Node parity/integration suite instead of growing this past 500.                                                                                                                                                                            |

### Supplemental checked test/runtime budgets

- `apiService.spec.ts` preamble is 195 lines. Extract its reusable harness/envelope
  factories and dynamic facade loaders under `src/test/api/`, retaining module-reset
  isolation. Delivered suites: transport/envelope ~460, retry/diagnostics ~240,
  queue validation/enqueue ~280, processing ~380, state ~220, retry/failure ~300
  and cancellation ~250. Do not combine the original queue blocks into a single
  oversized suite or compress assertions to fit.
- `src/test/api/apiServiceTestMocks.ts`: 39 → <=80 lines; reuse its existing scaffold.
  New `apiServiceTransportTestHelpers.ts`: ~195–260 lines. A moved dynamic loader
  imports the facade using the supported alias, not the old `./apiService` path.
- `e2e-tests/shared/endToEndRuntimeMocks.ts`: 378 → <=400;
  `runtimeMockTypes.ts`: 30 → <=40. Register existing upsert/update methods in
  Section 5D; preserve strict dispatch/queue-exhaustion checks, no split required.
- `e2e-tests/shared/runtimeMockScenarios.ts`: 478 → 485–500 for required metadata
  and base response compatibility only. New post-analysis scenarios belong in
  `helpers/post-analysis-metadata-scenarios.ts` (<300). If compatibility itself
  crosses 500, extract class read/mutation scenarios to
  `shared/classRuntimeMockScenarios.ts` (<250), preserving re-exports.
- Existing Class-page hook suites: 120–284 → +20–40 each; Heatmaps hook suites:
  391/442 → <=480. Keep lifecycle matrices in new shared-hook suites; split preview
  versus consumer-integration responsibilities if any would exceed 500.
- Root `scripts/synthetic-test-data/apiHandlerRoundTripBridge.js`: 93 → 120–160;
  test-only seams/restoration, no production backend change or split required.

### Required-field fixture ripple inventory (Section 2)

Update canonical-backed builders and explicit projections, not every consumer:

- `src/test/classPage/useClassPageDataTestFixtures.ts` (287),
  `classPageAdapterTestFixtures.ts` (260), `classPageFixtures.ts` (99).
- `src/test/dataAnalysis/heatmapFixtures.ts` (117),
  `src/test/heatmapsPageDataFixtures.ts` (206), `src/test/dataAnalysis/fixtures.ts` (467).
- Local factories in `heatmapsPipeline.spec.ts` (419),
  `HeatmapSelectionBar.spec.tsx` (181), `heatmapAdapter.merged.spec.ts` (372),
  `ClassPageHeatmapView.spec.tsx` (414), `buildCellPreviewLookup.parity.spec.ts` (403),
  and `classesManagementViewModel.spec.ts` (267).
- `dataAnalysis.zod.spec.ts` (372) minimal-class probe: intentionally supply null
  metadata or assert missing-field rejection; do not weaken the new read contract.
- E2E `helpers/task-heatmap-fixtures.ts` (431), class-partial/full scenario builders
  and explicit `toPlainClassPartials` projection: carry metadata, do not silently
  omit it. Follow the >500 separation rule for every fixture/provider actually edited.
- Existing large consumer suites (`ClassesPage.spec.tsx`, `AssessTaskModal.spec.tsx`,
  `App.spec.tsx`) are not automatically in scope if fixing their shared provider
  suffices. If a direct typed/wire literal really must be changed there, decompose
  that suite by its existing behaviour describes, each <=500; do not use a cast to
  hide the contract failure or leave a touched >550 suite intact.

## Section 1 — Shared metadata schema and backend parity

### Objective and constraints

Create the strict reusable metadata domain schema without yet changing class
consumers. Keep validation out of generic transport; no production backend import.
Use raw-value record checks before Zod copying can conceal prototype/own-key errors.

### Delegation mandatory reads

Testing Specialist / Implementation / Code Reviewer: common reads plus
@src/backend/Models/ABClassMetadata.js and
@src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts .
Data Shapes Agent: both canonical shape docs; Docs: helper register and test guide.

### Shared-helper and data-shape plan

- **New:** `services/abClass/abClassMetadata.zod.ts`, the schema family named in
  `abclass.md` §Frontend metadata counterpart (`Not implemented`).
- **New, test-only:** `src/test/abClass/abClassMetadataFixtures.ts`; reuse existing
  canonical freeze/record primitives rather than inventing a fixture generator.
- **Keep local:** metadata raw-record/canonical-date predicates belong to this
  schema domain; leave broader existing ISO contracts alone.

### Acceptance criteria and required Red tests

1. Canonical null/complete snapshots retain metadata and infer the exact score union.
2. Numeric zero/fractions/5 and N/E/excluded survive unchanged; negative/>5,
   NaN/infinities, coercible strings, metric null and unknown markers reject.
3. Own required fields and exact keys at every nesting level; reject Dates,
   non-plain instances, inherited fields, symbol/extra keys and nested undefined.
4. Dense arrays 0–3, duplicate IDs rejected, repeated definition keys accepted,
   ordering/equal timestamps, extra array properties and sparse entries covered.
5. Real canonical UTC dates accept; invalid calendar/time, offsets, date-only,
   alternate precision and submission counter suffixes reject. No repair/sorting.
6. Parsed metadata is detached from mutable caller input.
7. A Node-only suite compares acceptance/value preservation through frontend Zod
   and real backend domain validation, with globals from the existing test harness.
   Place it at `tests/synthetic-analysis/syntheticABClassMetadataFrontendParity.test.ts`;
   follow `syntheticDefinitionBackendValidation.test.ts` for test-local backend
   imports/globals, never import backend code from frontend production modules.

### Canonical-fixture note

Use all three compact profiles' `classPartials`/`classesById` views for the existing
variant matrix. Clone for invalid/boundary cases. No generator extension required.

### Red → Green → Refactor and section checks

Red: add focused schema/parity tests; verify failures are missing behaviour.
Green: implement only shared Zod schemas and test selectors. Refactor: consolidate
local record checks and verify exact backend parity without shared runtime code.
Run targeted frontend schema suites, focused Node synthetic parity suite,
`npm run lint:frontend:check`, applicable synthetic lint, `npm run typecheck:all`;
then clean review and section-end regression comparison.

JSDoc `@remarks`: nullable whole field, strict raw-record validation, backend parity
and the broader existing ISO schema distinction. Record actual commands/reviews/LOC
in the implementation delivery log, not by rewriting product decisions.

## Section 2 — Full/partial reads and fixture contract adoption

### Objective and constraints

Require shared nullable metadata in both class schemas. Preserve unrelated `.strip`
behaviour, optional Teacher names and full-class top-level not-found null. Apply the
checked fixture/suite splits in this section; no permissive metadata optional/default.

### Delegation mandatory reads

Testing Specialist / Implementation / Code Reviewer: common reads plus
@src/frontend/src/services/googleClassrooms/classPartials.zod.ts ,
@src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts ,
@src/frontend/src/test/classes/classesPageTestHelpers.tsx .
Playwright (fixture/runtime adjustments):
@docs/developer/frontend/frontend-playwright-e2e.md .

### Shared-helper and data-shape plan

- **Reuse:** Section 1 schemas/selectors and existing class service wrappers;
  `abclass.md` frontend planned read contract changes to implemented only on delivery.
- **Extend/extract:** canonical class builders and explicit partial serialisation
  helpers from the ripple inventory; preserve compatibility exports after splitting.
- Shared fixture extraction decisions follow the helper register/test guide; do
  not relocate shared fixtures into production service folders.

### Acceptance criteria and required Red tests

1. Both reads preserve identical metadata/null, including mutation-compatible
   partial shape; missing or malformed metadata fails through `parseApiResponse`.
2. Missing class stays top-level null and is never analysed. Empty list remains [].
3. Unknown unrelated wire fields still strip as before; metadata unknown fields reject.
4. Service tests use the real response schema rather than an always-successful
   parseApiResponse mock that could hide field loss.
5. Class analysis accepts valid metadata-bearing inputs without altering its scores.
6. All touched realistic builders use canonical inputs; full/partial explicit
   projections carry metadata, and all dependent unit/E2E fixtures remain valid.
7. Characterise existing schema/provider behaviour before moving descriptions and
   helpers; all original assertions survive each responsibility-based split.

### Canonical-fixture note

Use compact canonical class/partial/definition views; local null/missing/corrupt
clones cover boundaries. Opportunistic migration is limited to listed providers and
directly touched suites. Corpus regeneration is not necessary or authorised to hide failures.

### Red → Green → Refactor and section checks

Red: add read retention/missing-field tests and affected fixture contract tests.
Green: import schema in both class owners and correct provider payloads. Refactor:
complete required splits, preserve public fixture imports and migrate touched data.
Run class schema/service suites, analysis/hook consumers, frontend full unit suite,
typecheck and lint; Playwright runs affected existing runtime scenarios. Clean
review plus section-end comparison required before advancing.

JSDoc: required nullable read versus optional replacement request, no frontend
legacy default, no confusion with task-artifact metadata. Log actual touched
providers, splits and LOC during implementation.

### Ordered, independently reviewed delivery checkpoints

1. **2A — Provider/suite separation:** characterise existing fixture/schema behaviour
   and perform the inventory's required extractions as green refactors. Run each
   extracted suite and its direct importers; obtain a clean Code Reviewer pass
   before changing schema requirements. No invented failing test for a pure move.
2. **2B — Atomic required-field adoption:** Red metadata-retention/missing-field
   tests → Green both schemas plus all necessary provider/projection updates →
   Refactor canonical fixture selection. Keep this step atomic to avoid knowingly
   broken typed consumers. Run full frontend tests/typecheck and affected browser
   fixture checks, then obtain clean review.
3. **2C — Read service contract checks:** Red real response-parser assertions →
   Green any necessary service/docs adjustments → Refactor. Focused service/Node
   checks and clean review precede the full section-end regression comparison.

Each checkpoint records focused evidence and review independently; only the full
section completion runs the expensive regression checker.

## Section 3 — Existing FIFO extension and validated mutation services

### Objective and constraints

Reserve a deferred local task in the existing FIFO, then add queued typed wrappers
for existing upsert/update methods. Decompose transport/queue/suites per inventory.
No duplicate queue, new backend method, retry loop or envelope change.

### Delegation mandatory reads

Testing Specialist / Implementation / Code Reviewer: common reads plus
@src/frontend/src/services/apiService.ts ,
@src/frontend/src/services/apiService.spec.ts ,
@src/frontend/src/features/classes/bulk/runQueuedBatchMutation.ts ,
@src/frontend/src/features/classes/useClassesBulkMutationQueue.ts ,
@docs/developer/frontend/frontend-logging-and-error-handling.md .

### Shared-helper and data-shape plan

- **Extend:** existing queue via `runApiQueuedTask(jobName, task)`, same pending/active
  registry and cancellation semantics, recorded in canonical helper register.
- **Extract:** `services/api/apiTransport.ts` and `apiQueue.ts`; original apiService
  remains re-export facade. Queue calls transport, transport does not import queue.
  Test preamble moves to `src/test/api/apiServiceTransportTestHelpers.ts`, reusing
  the existing `apiServiceTestMocks.ts` scaffold. Dynamic facade imports use the
  supported alias from the helper's new location, not stale `./apiService` paths.
- **New:** `services/abClass/abClassMutations.zod.ts` and
  `abClassMutationService.ts`, planned in `abclass.md`. `upsertABClass` and
  `updateABClass` wrappers validate before enqueue and parse partial responses.
- Reuse `classesBulkMutation` job string so all these ABClass writes share the
  existing lane. A task's inner validated API execution calls callApi directly
  inside its reserved slot, never re-enqueues onto itself.
- Deferred task handles are local TypeScript execution contracts, never API data.

### Acceptance criteria and required Red tests

1. Existing FIFO ordering, synchronous active marking, same-job serial/different-job
   parallel behaviour, cancellation object and active-not-aborted behaviour persist.
2. A task holds its slot across read/await/merge/write; later same-lane calls cannot
   interleave. Rejected/synchronously thrown tasks release the lane for later work.
3. Pending tasks cancel without executing; ordinary queued calls interoperate with
   deferred tasks and getQueueState pending/active snapshots remain accurate.
4. Existing facade imports and transport JSON/envelope/retry/diagnostic behaviour
   remain unchanged after extraction; no double deserialisation or import-cycle init.
5. Upsert required fields and update optional editable fields validate; protected
   roster/assignment request fields reject rather than being silently stripped.
6. Metadata omission/null/complete replacement preserved exactly; own undefined and
   invalid mixed patches fail before enqueue/network. Metadata nested patch rejects.
7. Mutation responses preserve metadata via real partial parser; malformed success,
   INVALID_REQUEST and INTERNAL_ERROR propagate without reclassification.

### Canonical-fixture note

Queue mechanics use local scalar probes, not invented realistic classes. Mutation
payloads/responses derive from compact canonical partials/metadata. Invalid and
cancellation/transport probes stay local. Migrate only touched API suite data.

### Red → Green → Refactor and section checks

Red: characterise old queue/transport, add deferred-operation and mutation tests.
Green: implement queue extension and wrappers with minimal transport extraction.
Refactor: finish responsibility-based suite splitting and compatibility re-exports.
Run new api transport/queue/cancellation suites, mutation suites and existing queued
batch tests, frontend lint/typecheck, clean review and section-end comparison.

JSDoc: per-job not global FIFO, local callback never sent to GAS, cancellation and
same-lane nested-enqueue deadlock prohibition, unchanged retry ownership.

### Ordered, independently reviewed delivery checkpoints

1. **3A — Transport/queue separation:** characterise all existing behaviours, split
   the oversized suite, then extract transport/queue owners as a green refactor.
   Verify compatibility facade imports, envelope/retry/queue suites and obtain a
   clean review before changing FIFO capability.
2. **3B — Deferred FIFO operations:** Red slot-reservation/interoperation/cancellation
   cases → Green shared queue extension → Refactor. Run queue/batch suites and
   typecheck; obtain independent clean review.
3. **3C — Mutation schemas/wrappers:** Red presence semantics/protected fields and
   real response parsing → Green validated queued wrappers → Refactor reuse. Run
   mutation and queue suites, reconcile data-shape docs and obtain clean review.
4. Run the full section-end regression comparison only after all checkpoints pass.

## Section 4 — Timestamp-gated metadata task and rolling writer

### Objective and constraints

Implement the first shared task's pure freshness/projection and queued persistence.
Keep calculation out of React and storage out of pure analysers. No UI integration yet.

### Delegation mandatory reads

Testing Specialist / Implementation / Code Reviewer: common reads plus
@src/frontend/src/services/dataAnalysis/dataAnalysisService.ts ,
@src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.ts ,
@src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.filters.ts ,
@src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts ,
@src/frontend/src/query/queryKeys.ts .

### Shared-helper and data-shape plan

- **New:** `services/dataAnalysis/postAnalysis/metadataProjection.ts` owns pure
  timestamp eligibility, metric mapping and stable rolling merge; no network/clock
  inside pure helpers (timestamp supplied by the effect-owned task).
- **New:** `refreshABClassMetadata.ts` owns first-task orchestration;
  `services/abClass/abClassMetadataService.ts` owns fresh validated read/update inside
  `runApiQueuedTask('classesBulkMutation', ...)`. Reuse mutation request schemas and
  parseApiResponse; never duplicate nested metadata validation.
- **Reuse:** synchronous DataAnalysisService for full and isolated assignment
  results. Its API/output does not change. Contracts: planned writer/projection
  entries in `abclass.md`; execution task context in the frontend response doc.

### Acceptance criteria and required Red tests

1. Empty complete class skips. Initial null metadata stores complete class metrics
   plus exactly one newest assignment. Never calculate a backfill list.
2. Equal target ID/timestamp skips **before calculation or network**; score/weighting
   differences alone do not trigger work. Older-than-stored input skips as stale.
3. A changed target timestamp refreshes even if scores are identical. Canonical
   null/invalid assignment times fail task validation; never use current time as source.
4. Fresh read occurs after queue entry becomes active. Re-evaluate target and gate
   from that document; not-found fails, already-updated duplicate task skips, newer
   fresh assignment replaces the originally cached target without stale overwrite.
5. All class assignments contribute; display selections/filters cannot narrow class
   averages. Missing definitions fail before write instead of silently dropping work.
6. Instance-isolate target before analysis, including repeated definition keys.
   Preserve weighted overall and all number/N/E/excluded projections without rounding.
7. Append 1→2→3 entries, fourth evicts oldest; reassessment replaces duplicate ID;
   stable equal-time order and definition reuse match spec. Copy, do not mutate inputs.
8. Update contains only classId/complete metadata. Source timestamp is exact;
   class-summary clock is invoked only when a changed write is actually prepared.
9. Same-lane simultaneous owners cannot lose prior recent entries; second fresh
   read sees prior write. Failure propagates without rollback/per-feature retry.

### Canonical-fixture note

Use `small` classes/definition partials for initial full+instance calculation;
`medium`/`large-representative` for two/three-entry retention and marker snapshots.
Run calculations against actual canonical evidence, not pre-supplied metadata scores.
Local clones cover changed timestamps, duplicate definitions, ordering and missing data.

### Red → Green → Refactor and section checks

Red: pure and queued writer suites with spies proving no-op cost/order. Green:
implement projection and minimal queued task, no hook recursion or generic framework.
Refactor: consolidate reuse of score mapping and schemas into their owners. Run
projection/writer/mutation/queue suites, lint/typecheck, contract reconciliation,
clean review and section-end comparison.

JSDoc: assignment-version cache limitation; fixed standard weights/full scope;
source timestamps versus modification/completion signals; supplied synthetic scores
are not calculation oracles. Document session-local persistence boundary.

## Section 5 — Shared extensible hook, two owners and failure feedback

### Objective and constraints

Connect ordered shared post-analysis work after commit on both current averaging
surfaces, retaining synchronous analysis and non-blocking failure feedback. Apply
the Class-page prefetch and Heatmaps preview-helper separations before adding wiring.

### Delegation mandatory reads

Testing Specialist / Implementation / Code Reviewer: common reads plus
@src/frontend/src/features/classPage/useClassPageData.ts ,
@src/frontend/src/features/classPage/useClassPagePipelineDiagnostics.ts ,
@src/frontend/src/features/taskHeatmap/useHeatmapsPageData.ts ,
@src/frontend/src/features/taskHeatmap/heatmapsPipeline.ts ,
@docs/developer/frontend/frontend-react-query-and-prefetch.md ,
@docs/developer/frontend/frontend-logging-and-error-handling.md .
Playwright additionally reads @docs/developer/frontend/frontend-playwright-e2e.md .
For browser compatibility in this section, Playwright also receives
@src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts ,
@src/frontend/e2e-tests/shared/runtimeMockTypes.ts and
@src/frontend/e2e-tests/shared/runtimeMockScenarios.ts .

### Shared-helper and data-shape plan

- **New:** `postAnalysis.zod.ts` for validated context/outcome data;
  `runPostAnalysisTasks.ts` and `postAnalysisTasks.ts` for ordered descriptors/list.
  Function/Error handles stay local inferred/typed execution data, not wire values.
- **New shared hook:** `hooks/usePostAnalysisTasks.ts`, used by both owners.
  Feedback formatting/lifecycle can live in `hooks/postAnalysisFeedback.ts`.
  Ownership/extension contract already recorded as `Not implemented` in helper and
  analysis docs; task shapes in frontend-data-analysis-response.md.
- **Reuse:** existing logger/error normaliser, App.useApp notification host, query
  keys and normal invalidateQueries policy. Do not use disabled-query force-refetch
  helper, invent a second host or put I/O into DataAnalysisService.
- **Keep feature-local:** extracted prefetch and preview-query helpers. Preserve
  original module-load service/mock lifecycle and existing feature dependency rules.

### Acceptance criteria and required Red tests

1. Hook effects begin after committed successful averaging, receive unsliced class
   data, and do not run on failed/skipped analysis. Descriptive summaries stay read-only.
2. Ordered unique task IDs, duplicate rejection, individually reported outcomes and
   later independent tasks continuing after failure are tested with two local task
   descriptors; metadata is the only shipped task, not the hook's global gate.
3. Metadata per-version attempts dedupe StrictMode replay/rerenders/cache-only
   changes, no retry after failure merely from setting task state. New source version
   or remount permits work; multiple owners recheck via Section 4's queue.
4. Saving succeeds before one invalidation each for class detail/list. Both use
   `throwOnError: true` and both settlements are observed. Inactive queries are stale
   only, no imperative refetch. Refreshed identical timestamps never loop-write.
5. Write failure keeps analysis intact and yields correct persistent warning and
   diagnostics. Confirmed write followed by refetch failure uses the distinct saved
   but refresh-failed warning, never claims data was not saved.
6. Dismissed feedback stays dismissed for the same source/task; unmount/navigation
   destroys owned notices and prevents stale state/late notices without abort claims.
7. Prefetch and preview extracts preserve once-per-class guard, sorting, live
   definition use, memoisation and query callback semantics.
8. Both feature consumers call the shared hook directly; no duplicated persistence
   effects, taskHeatmap→classPage imports, or future-task eligibility tied to metadata.
9. Before consumer activation and this section's regression gate, Playwright adds
   missing existing backend methods (`updateABClass`/`upsertABClass`) to the runtime
   mock types/dispatch inventory and adjusts affected existing response sequences
   for fresh getABClass, queued update and invalidation refetch. Preserve strict
   rejection of unknown methods/exhausted queues; never add fallback successes.

### Canonical-fixture note

Use shared Section 1 selectors and existing provider render helpers. Hook-only
task ordering/cancellation/error probes remain local. Migrate the touched Class-page
and Heatmaps hook fixture providers only; do not redesign unrelated surface tests.

### Red → Green → Refactor and section checks

Red: runner/lifecycle/invalidation/notification suites, then consumer wiring tests.
Green: implement shared lifecycle, first descriptor and both call sites. Refactor:
separate feedback and feature prefetch/preview responsibilities while green. Run
both hook families, task suites, full frontend unit coverage, lint and typecheck;
clean contract/docs review and section-end comparison.

JSDoc `@remarks`: this hook is the canonical shared extension point; exact steps
to add a task, task-local freshness, post-commit side effects, failure isolation,
metadata-only refetch-loop prevention and cleanup versus active network cancellation.

### Ordered, independently reviewed delivery checkpoints

1. **5A — Feature responsibility extracts:** characterise existing prefetch and
   preview behaviour; perform the two required extractions as green refactors. Run
   their hook families/typecheck and obtain clean review before adding lifecycle.
2. **5B — Shared lifecycle:** Red runner ordering, failure isolation, task-local
   freshness and effect replay → Green schema/runner/hook without active consumers →
   Refactor. Focused task/hook checks, data-shape reconciliation and clean review.
3. **5C — Feedback and invalidation:** Red warning/dismissal/cleanup and observable
   refresh-error cases → Green shared feedback/invalidation wiring → Refactor.
   Unit checks plus independent clean review; no visible consumer activation yet.
4. **5D — Browser-compatible consumer wiring:** delegate runtime method registration
   and existing scenario-sequence updates to Playwright **before enabling** both
   production consumers. Add Red consumer/browser compatibility checks → Green
   shared hook call sites and faithful scenarios → Refactor. Run affected existing
   Playwright journeys, both hook families and full frontend/type/lint checks, then
   obtain clean review. Include any required runtime-helper decomposition here.
5. Run the full section-end regression comparison only after all checkpoints pass.

Section 6 adds deeper browser acceptance/hardening; it does not own prerequisites
needed to keep Section 5's existing browser regression gate passing.

## Section 6 — Browser, dispatcher and regression hardening

### Objective and constraints

Prove visible warnings and transport/schema integration; preserve existing browser
journeys after new background reads/writes. Do not deploy or replace real dispatcher
tests with handcrafted envelopes. No generator changes unless an actual unsupported
realistic requirement is discovered and planned with the user before expansion.

### Delegation mandatory reads

Playwright: common spec/layout plus
@docs/developer/frontend/frontend-playwright-e2e.md ,
@src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts ,
@src/frontend/e2e-tests/shared/runtimeMockTypes.ts ,
@src/frontend/e2e-tests/shared/runtimeMockScenarios.ts .
Testing Specialist / Implementation / Code Reviewer: common reads plus
@tests/synthetic-analysis/syntheticApiRoundTripBridge.test.ts and
@scripts/synthetic-test-data/apiHandlerRoundTripBridge.js .

### Shared-helper and data-shape plan

- **Reuse/extend test-only:** existing runtime response queues and synthetic
  dispatcher bridge, no new mock transport. Add class partial/mutation seams only
  where needed for the exact backend methods, with mandatory per-call restoration.
  Runtime method registration and existing sequence compatibility already land in
  Section 5D, before the first regression gate with active consumers.
- **New test-only feature scenario:** post-analysis metadata E2E helpers under
  existing `e2e-tests/helpers/`, canonical JSON imported without `?raw`.
- No new production shape: harden Sections 1–5 canonical contracts; reconcile
  synthetic-test-data.md frontend consumer notes on delivery.

### Acceptance criteria and required Red tests

1. Real apiHandler read/mutation success data survives frontend services and shared
   schemas, omitted/null/replacement requests and request-versus-integrity errors.
   Existing auth/tracking/envelope behaviour is unchanged.
2. Browser ordinary analysis triggers at most one metadata write for a changed
   version; successful refresh then same timestamp produces no loop. New assignment
   source version produces one later write; no assessment-completion polling exists.
3. Save failure on Class page and standalone Heatmaps shows persistent warning,
   keeps analysis usable, supports keyboard close and does not reopen on rerender.
4. Confirmed persistence plus refresh failure uses the correct different copy;
   existing trust failures still fail closed where required.
5. Narrow/desktop containment, light/dark themes, polite status semantics, focus
   retention and owner navigation cleanup match the layout document.
6. Update existing browser scenarios to include required metadata and the actual
   new queued read/update/invalidation call sequence. Do not add permissive runtime
   fallbacks that hide unexpected calls or return success for malformed payloads.

### Canonical-fixture note

Use `small`/`medium` class/partial/definition views for Node and browser scenarios.
Local stale/null/failed API envelopes remain boundary probes. Existing profiles
cover realistic required data; no generator extension or regeneration is needed.

### Red → Green → Refactor and section checks

Red: delegate browser/Node integration acceptance tests to their specialist owners.
Green: adjust only necessary test seams/response sequences and close genuine defects
through Implementation. Refactor: share scenario setup, keeping oracle expectations
independent of production projection helpers. Run focused browser journeys and
`npm run test:frontend:e2e`, `npm run test:synthetic`, frontend coverage, typecheck,
lint; independent clean review and section-end comparison.

Final regression gate: `npm run run-all-checks`, plus explicit synthetic tests/lint
and production build if a recorded baseline failure short-circuits the aggregate.
Report actual non-zero baseline failures; zero new regressions required. Do not
claim a skipped downstream check passed. Opt-in stress generation is unnecessary:
this work changes no corpus generator or backend averaging runtime.

## Section 7 — Canonical documentation and rollout handoff

### Objective and constraints

Finish documentation already reconciled incrementally, verify backend dependency
and hand over reviewed implementation evidence. Planning/delivery artefacts remain
separate from canonical implemented contracts.

### Delegation mandatory reads

Docs / Data Shapes Agent / Code Reviewer: the spec/layout, changed code and the
five canonical docs modified by planning, plus
@docs/developer/frontend/frontend-architecture.md and
@docs/developer/frontend/frontend-react-query-and-prefetch.md .

### Shared-helper, data-shape and fixture plan

Reconcile each `Not implemented` entry only for delivered owners. Promote the
shared hook/runner to canonical helper discovery map, document registration example
and future-task rules, actual domain paths, fixed-weight/full-class scope, timestamp
gate staleness limitation, queue lane guarantees and backend prerequisites. Keep
the backend workstream history intact. No fixture generator/profile/view changes.

### Acceptance criteria and Red → Green → Refactor checks

- **Red:** audit for stale claims that frontend strips metadata, that current
  analysis has no post-run consumer, or that API queues are globally serial.
  Identify absent shared-hook extension documentation and missing review evidence.
- **Green:** Docs/Data Shapes Agent reconcile relevant implemented prose/field
  tables/service inventory and planned entries; add JSDoc remarks identified above.
  Distinguish generic existing transport diagnostics from new task-owned logs.
- **Refactor:** remove duplicate policy explanations in favour of canonical links;
  retain useful independent workstream history and no unsupported implementation claims.
- Verify links, formatting and `git diff --check`; confirm no accidental production
  changes outside approved scope or unrelated reviewer-configuration modification.
- Mandatory clean final Code Reviewer pass. Run a final regression comparison if
  cleanup changed files, as required by the skill; blockers cannot be waived by
  relabelling them baseline debt. No commit, push or deployment without authority.

### Implementation delivery record (fill during execution, for every section)

Record Red failure, Green/focused commands, Refactor changes, actual LOC/splits,
canonical contract/helper reconciliation, independent review outcome, regression
report path/status and any non-contract deviation. An unforeseen material product
choice requires user clarification; this plan carries none into implementation.

## Suggested implementation order

Backend dependency verification → Sections 1–2 → Section 3 → Section 4 → Section 5
→ Section 6 → Section 7. Canonical documentation/review reconciliation occurs within
each section, not only at the end. All sections require independently observable
acceptance and the common Red/Green/Refactor/review gates.
