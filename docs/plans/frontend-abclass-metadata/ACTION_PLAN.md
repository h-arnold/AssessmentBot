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
  **Planning-time status, resolved at execution:** the integrated checkout starts at
  HEAD `4a0a3418` (`Add validated ABClass metadata and harden class boundaries
(#336)`), which is the completed backend contract for both reads and both
  mutations. The verification evidence is recorded in the implementation
  checkpoint below.
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
4. Preserve public behaviour, GAS envelope handling, retry/backoff, method names,
   assignment redaction and constructor-owned defaults. No config/rule suppression,
   backend runtime imports into frontend, raw GAS calls or competing queues/caches.
   For frontend decomposition, import the actual owners directly; the user's
   Section 3A adjustment supersedes the original compatibility-facade proposal.
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
| `src/services/apiService.ts`                                                                            |         499 |                             570–620 | Section 3A authorised adjustment: actual transport remains in `apiService.ts` (331); queue owner is `services/api/apiQueue.ts` (172). Consumers import owners directly. No facade, barrel or `apiTransport.ts` module.                                                                         |
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
  factories and dynamic owner loaders under `src/test/api/`, retaining module-reset
  isolation. Delivered suites: transport/envelope ~460, retry/diagnostics ~240,
  queue validation/enqueue ~280, processing ~380, state ~220, retry/failure ~300
  and cancellation ~250. Do not combine the original queue blocks into a single
  oversized suite or compress assertions to fit.
- `src/test/api/apiServiceTestMocks.ts`: 39 → <=80 lines; reuse its existing scaffold.
  New `apiServiceTransportTestHelpers.ts`: ~195–260 lines. A moved dynamic loader
  imports transport from `@/services/apiService` and queue from
  `@/services/api/apiQueue`, not the old `./apiService` path.
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
@src/frontend/src/test/classes/classesPageTestHelpers.ts ,
@src/frontend/src/test/abClass/classDetailSchemaFixtures.ts .
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
@src/frontend/src/services/api/apiQueue.ts ,
@src/frontend/src/test/api/apiServiceTransportTestHelpers.ts ,
@src/frontend/src/features/classes/bulk/runQueuedBatchMutation.ts ,
@src/frontend/src/features/classes/useClassesBulkMutationQueue.ts ,
@docs/developer/frontend/frontend-logging-and-error-handling.md .

### Shared-helper and data-shape plan

- **Extend:** existing queue via `runApiQueuedTask(jobName, task)`, same pending/active
  registry and cancellation semantics, recorded in canonical helper register.
- **Separate owners:** `services/apiService.ts` retains actual transport;
  `services/api/apiQueue.ts` owns the queue and imports transport directly.
  Transport does not import the queue. No facade, barrel or `apiTransport.ts`.
  Test preamble moves to `src/test/api/apiServiceTransportTestHelpers.ts`, reusing
  the existing `apiServiceTestMocks.ts` scaffold. Dynamic owner imports use the
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
4. Transport symbols retain their original actual-owner path; queue consumers and
   mocks import the queue owner directly. JSON/envelope/retry/diagnostic behaviour
   remains unchanged; no double deserialisation or import-cycle initialisation.
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
Refactor: finish responsibility-based suite splitting and direct-owner imports.
Run new api transport/queue/cancellation suites, mutation suites and existing queued
batch tests, frontend lint/typecheck, clean review and section-end comparison.

JSDoc: per-job not global FIFO, local callback never sent to GAS, cancellation and
same-lane nested-enqueue deadlock prohibition, unchanged retry ownership.

### Ordered, independently reviewed delivery checkpoints

1. **3A — Transport/queue separation:** characterise all existing behaviours, split
   the oversized suite, then extract transport/queue owners as a green refactor.
   Verify direct-owner imports, envelope/retry/queue suites and obtain a
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

## Implementation delivery checkpoint — 19 October 2026

- Execution was explicitly authorised after planning. Starting tree: clean, detached
  HEAD `4a0a3418` (`Add validated ABClass metadata and harden class boundaries (#336)`),
  which is also the verified backend prerequisite for metadata reads and both
  mutations. Root `ACTION_PLAN.md` is absent and was not recreated.
- Backend prerequisite verification:
  `npm run test:backend -- tests/api/apiHandler/abclassMetadataReads.test.js tests/api/apiHandler/abclassMetadataWrites.test.js tests/api/apiHandler/abclassMetadataErrors.test.js tests/api/abclassMetadataApi.test.js`
  passed 4 files / 38 tests.
- Loaded the `regression-checker` skill. Confirmed the session baseline did not
  already exist before running
  `npm run regression-checker -- frontend-abclass-metadata` with a 1,200,000 ms
  timeout. This created a **new** baseline, timestamp
  `2026-10-19T09:33:28.588Z`, storage key
  `session-frontend-abclass-metadata`.
- Baseline report:
  `.ts-regression-checker/reports/session-frontend-abclass-metadata/baseline/baseline.txt`.
  Overall status **FAILING**, command exit 1. Seven checks passed: frontend lint,
  builder lint, backend test coverage, frontend test coverage, frontend E2E,
  builder test coverage and all-project type-checking. Backend lint failed with
  zero errors and six existing `max-lines` warnings. No regression or new failure
  was reported in this baseline run. These failures have not been silently waived
  or repaired as unrelated work. Reuse this baseline identity; do not create another.
- **Delegation:** the earlier nested-delegation depth blocker is resolved and no
  longer applies. The parent session orchestrates Testing Specialist,
  Implementation, Code Reviewer, Docs and Data Shapes Agent directly; no delegated
  subagent spawns another subagent.
- **Model override:** with the configured models unavailable, the user authorised
  `opencode/glm-5.3-flash-free` for specialist subagents and `GPT-6.1-Sol` for the
  Code Reviewer. No agent configuration files were changed.
- **Section 1 (shared metadata schema and backend parity) — COMPLETE.**
  - RED: the focused frontend schema and Node parity commands failed because
    `src/frontend/src/services/abClass/abClassMetadata.zod.ts` did not exist.
  - GREEN: the schema module now owns the nullable metadata schema family with
    pre-Zod raw-record/own-key/plain-prototype checks, canonical UTC timestamps,
    the numeric-or-`N`/`E`/`excluded` score union, dense zero-to-three recent
    entries, unique assignment IDs and newest-first non-increasing ordering.
    Test-only canonical selectors live in
    `src/frontend/src/test/abClass/abClassMetadataFixtures.ts`; the Node parity
    suite is `tests/synthetic-analysis/syntheticABClassMetadataFrontendParity.test.ts`.
  - Final evidence after the two test-matrix revisions:
    `npm run test:frontend --` the four split metadata suites passed **4 files / 37
    tests**; `npm run test:synthetic -- tests/synthetic-analysis/syntheticABClassMetadataFrontendParity.test.ts`
    passed **1 file / 6 tests**; `npm run typecheck:all` passed;
    `npm run lint:frontend:check` reported zero errors and the same 24 pre-existing
    `max-lines` warnings; `npm run lint:synthetic:check` passed; `git diff --check`
    passed.
  - Independent Code Reviewer verdict: **PASS**. Both outstanding test-evidence
    findings were resolved and no in-scope issues remain. Report:
    `.opencode/scratchpad/review-section1-final-two-fixes.md`.
  - LOC measured from the filesystem: schema **207** physical lines (183 non-blank);
    suites `abClassMetadata.zod.spec.ts` **62**, `.detach.spec.ts` **96**,
    `.examples.spec.ts` **128** and `.strict.spec.ts` **259** (545 total); test
    helper `abClassMetadataFixtures.ts` **34**; Node parity suite **289**. Every
    module stays inside the Section 1 budget. The earlier 182-line schema,
    160-line spec, 21-line selector and 152-line parity figures were pre-split and
    are superseded.
  - Section-end regression comparison at `2026-10-19T16:43:55.795Z` for
    `npm run regression-checker -- frontend-abclass-metadata`. Report:
    `.ts-regression-checker/reports/session-frontend-abclass-metadata/runs/2026-10-19T16-43-55.795Z/comparison.txt`.
    Seven of eight checks passed; backend lint remains failing on the same six
    pre-existing `max-lines` warnings with zero errors. **Regressions 0, new failures
    0, fixes 0.** The overall status remains the baseline **FAILING**, not a new
    failure. No Section 1 blocker remains.
- **Section 2 — COMPLETE and review-clean; zero new regressions.**
  - **Checkpoint 2A (provider/suite separation) — COMPLETE and review-clean.**
    Independent Code Reviewer reports:
    `.opencode/scratchpad/review-section2a-green.md` and
    `.opencode/scratchpad/review-section2a-alias-rereview.md`. No 2A finding
    remains open.
  - Observed 2A deliverables: the class-detail Zod suite split into
    `classDetailService.zod.full.spec.ts`, `.submissions.spec.ts`,
    `.definitions.spec.ts` and `.metadataIntegration.spec.ts`, with shared wire
    fixtures in `src/frontend/src/test/abClass/classDetailSchemaFixtures.ts`;
    `classesPageModel.spec.ts` split into `.base.spec.ts`, `.sorting.spec.ts`
    and `.validation.spec.ts`, with `classesPageModelTestSupport.ts`;
    `classesPageTestHelpers.tsx` replaced by the `classesPageTestHelpers.ts`
    compatibility facade plus `classesPageTestFixtures.ts`,
    `classesPageRenderHelpers.tsx`, `classesPageModelAssertions.ts` and
    `classesPageScreenAssertions.tsx`; and `heatmapAdapter.spec.ts` split with
    `heatmapAdapter.weighting.spec.ts` plus
    `heatmapAdapterTestSetup.ts`. E2E fixture decomposition is also present in
    the working tree (`class-metadata-fixtures.ts`,
    `task-heatmap-class-fixtures.ts`, `classes-crud-mock-runtime.ts`), validated
    by the final 2B browser gate below.
  - **Checkpoint 2B (required nullable metadata adoption) — COMPLETE and review-clean.** Both
    `ClassPartialSchema` and `ClassFullSchema` now require the shared
    `ABClassMetadataSchema` (nullable as a whole), and typed/unit/E2E fixture
    providers carry metadata. Final full-suite and browser validation passed.
  - Earlier independent 2B review **FAIL**, report
    `.opencode/scratchpad/review-section2b-independent-full.md`: full browser
    collection exposed a transitive Vitest `?raw` import, two focused full-class
    builders replaced explicit null metadata, and the synthetic guide still
    claimed frontend metadata stripping. Final fixes separate runner-neutral
    direct-JSON metadata defaults from raw-profile selectors (retaining canonical
    compatibility re-exports), share constructor-owned `ClassFullFixtureDefaults`
    preserving explicit null, and reconcile the stale documentation.
  - The directly touched `ClassesPage.spec.tsx` is now five responsibility-based
    suites (base, grouping, cards, refresh and shell), each at most **374** lines.
    Independent review verified all **29** original tests and **244** nested
    expect-call expressions survive. Shared registration, typed mock setup and
    warm-up fixtures live under `src/test/classes/`; the refresh-only query
    override stays local.
  - Final independent 2B re-review: **PASS — CLEAN**, report
    `.opencode/scratchpad/review-section2b-final-clean.md`. All three previous
    findings are resolved. Fresh `npm run test:frontend:coverage` passed **267
    files / 2,563 tests**; `npm run test:frontend:e2e` passed **303 tests without
    retries**. Frontend project type-checking and `npm run typecheck:all` passed;
    verify-only frontend lint reported zero errors and **20 existing max-lines
    warnings**; `git diff --check` passed. These supersede the earlier partial
    evidence. The final AST check confirms all 29 original ClassesPage tests and
    122 direct `expect(...)` calls survive (244 nested call expressions include
    matcher calls). This checkpoint sign-off is complemented by the 2C review
    and section-end comparison below.
  - Latest specialist model override: the user authorised **GPT-6.1 Sol**; no
    agent-model configuration was edited by this documentation pass.
  - **Checkpoint 2C (read service contract checks) — COMPLETE and review-clean.** New
    `src/frontend/src/services/googleClassrooms/classReadServices.metadata.spec.ts`
    is **184 physical lines / 18 tests**. Only `callApi` is mocked: the real
    `parseApiResponse` checks full/partial metadata retention and detachment across
    all three canonical profiles, malformed-field diagnostics, unrelated stripping,
    absence distinctions and unchanged transport-error identity/correlation.
  - Independent 2C review: **PASS — CLEAN**, report
    `.opencode/scratchpad/review-section2c-clean.md`; no in-scope findings remain.
    Fresh `npm run test:frontend:coverage` passed **268 files / 2,581 tests**;
    focused frontend read checks passed **7 files / 92 tests**; the Node metadata
    parity suite passed **1 file / 6 tests**. Frontend project type-checking and
    `npm run typecheck:all` passed; verify-only frontend lint reported zero errors
    and the same **20 baseline warnings**; `git diff --check` passed.
    Production wrappers changed
    only in JSDoc: `classPartialsService.ts` is **26 lines** and
    `classDetailService.ts` is **31 lines**, with no logic change. Their remarks
    distinguish required-nullable read metadata from top-level not-found null and
    explicitly rule out frontend legacy defaults.
  - 2C is legitimate green characterisation: 2B already implemented the read
    contract, and existing wrappers already use the real response parser. No
    fabricated RED failure or unnecessary production logic was introduced.
    The testing guide now records the real-parser suite and error-identity checks;
    no new shared helper was introduced or planned helper promoted by 2C.
  - Full Section 2 regression comparison:
    `npm run regression-checker -- frontend-abclass-metadata`, timestamp
    `2026-10-19T21:47:37.642Z`. Verified persisted report:
    `.ts-regression-checker/reports/session-frontend-abclass-metadata/runs/2026-10-19T21-47-37.642Z/comparison.txt`.
    Seven of eight checks passed: frontend lint, builder lint, backend coverage,
    frontend coverage, frontend E2E, builder coverage and all-project type-checking.
    Backend lint alone remains failing on the same six baseline `max-lines`
    warnings, with zero errors. **Regressions 0, new failures 0, fixes 4** (four
    frontend lint warnings resolved). Overall status remains baseline **FAILING**;
    it is not an all-green aggregate. No Section 2 blocker remains.
- **Section 3A — COMPLETE and independently review-clean.** Report:
  `.opencode/scratchpad/review-section3a-independent-clean.md`, verdict
  **PASS — CLEAN 3A**, no outstanding in-scope findings. Fresh review validation:
  frontend coverage **274 files / 2,581 tests passed**, browser suite **303 passed**,
  frontend project type-check passed, verify-only frontend lint **zero errors / 19
  existing warnings**, and `git diff --check` passed. Section 3 is now complete
  following the 3C sign-off and section-end comparison recorded below. Section 4
  is complete and independently review-clean with zero new regressions. Checkpoints
  5A–5C are independently review-clean; 5D and Sections 6–7 remain pending.
  - **Authorised plan adjustment:** the user explicitly rejected frontend facade
    decomposition and the unnecessary barrel. This supersedes the original
    499-line transport split proposal, not any past backend delivery decision.
    `apiService.ts` remains the actual 331-line transport owner of `callApi`,
    `parseApiResponse` and `ApiRequestSchema`; `api/apiQueue.ts` is the 172-line
    queue owner. The temporary `apiTransport.ts` was removed. Production queue
    consumers import the queue owner directly; no all-symbol old-path re-export
    promise remains for this split.
  - The queue uses native `Set` insertion order for pending FIFO entries, avoiding
    a new lint disable or exemption. Per-job ordering, synchronous active marking,
    parallel independent jobs and pending-only cancellation remain unchanged.
    These are the 3A separation guarantees; 3B adds local tasks and 3C adds
    mutation wrappers below.
  - Seven API suites are co-located under `services/api/`, each at most **392**
    physical lines. Shared `apiServiceTransportTestHelpers.ts` is **236** lines;
    the reused `apiServiceTestMocks.ts` scaffold is **76**. Dynamic transport and
    queue loaders import their actual owners after module reset.
  - Supplied AST preservation evidence records **47 original tests / 173 direct
    `expect(...)` calls**. The earlier **176** assertion claim is discrepant and
    is superseded by this actual direct-call count, not silently repeated.
  - Supplied focused validation: **62 tests passed**, all-project type-checking
    passed, frontend lint **zero errors / 19 baseline warnings**. These are
    focused implementation results, not a clean reviewer verdict or a Section 3
    regression comparison. The independent clean review above supersedes the
    earlier pending-review status. The full section regression comparison ran
    after clean 3B/3C review, as recorded below.
- **Section 3B — COMPLETE and independently review-clean.** The later Section 3
  completion and section-end comparison are recorded below.
  - RED evidence supplied by the implementation handoff: **10 tests failed** on
    the missing `runApiQueuedTask` API while the **47 existing API tests passed**.
    GREEN focused queue/transport/batch validation passed **10 files / 72 tests**;
    `npm run typecheck:all` passed; verify-only frontend lint reported **zero
    errors / 19 baseline warnings**. These are implementation results, not an
    independent 3B review verdict. Independent review subsequently returned
    **PASS — CLEAN 3B**, report
    `.opencode/scratchpad/review-section3b-independent-clean.md`, with no
    outstanding in-scope findings. Fresh reviewer checks passed frontend coverage
    **275 files / 2,591 tests**, frontend project type-checking, verify-only
    frontend lint (**zero errors / 19 existing warnings**) and `git diff --check`.
    No new visible interaction required another browser run; the section-end
    regression comparison still follows 3C.
  - `src/frontend/src/services/api/apiQueue.ts` now exports
    `runApiQueuedTask(jobName, task)` from the actual queue owner. Ordinary calls
    delegate to the same Map/Set registry, reserving one per-job lane across the
    full callback operation. Pending cancellation never invokes the callback;
    active work continues. Throws/rejections preserve failure identity and release
    the lane. Different jobs remain parallel. Callbacks stay local, network work
    uses `callApi`, and awaiting same-lane nested enqueue is prohibited to avoid
    deadlock. Transport retry/envelope behaviour is unchanged; no facade or barrel
    was introduced.
  - Actual physical LOC: `src/frontend/src/services/api/apiQueue.ts` **192**;
    `src/frontend/src/services/api/apiQueue.tasks.spec.ts` **273**;
    `src/frontend/src/services/apiService.ts` **331**;
    `src/frontend/src/test/api/apiServiceTransportTestHelpers.ts` **236**;
    `src/frontend/src/test/api/apiServiceTestMocks.ts` **76**. The seven original
    split API suites remain **123–392** lines each.
  - Helper discovery/register and the testing guide now document the implemented
    queue extension. Mutation schemas/wrappers are now implemented in 3C below;
    post-analysis helpers were still **Not implemented** at 3B (the Section 4
    delivery below supersedes that status). Local callback execution
    is not a wire contract and needs no canonical data-shape entry; reconcile actual request/context data
    during 3C/4 and the later lifecycle delivery. No data-shape files were edited
    by this pass.
- **Section 3C — COMPLETE and independently review-clean.**
  - `abClassMutations.zod.ts` (**99 physical lines**) owns strict upsert/update
    request schemas and inferred types. Required upsert cohort/year-group keys
    are non-null strings, matching backend `Validate.requireParams`, which rejects
    null required parameters. Update keeps optional nullable cohort/year-group
    keys and optional editable fields unchanged.
    Own undefined, unknown/protected fields and invalid mixed patches reject
    before enqueue. Shared metadata validation preserves omission/null/whole
    replacement and detaches snapshots; nested patches reject.
  - `abClassMutationService.ts` (**45 lines**) validates before enqueue onto the
    actual `classesBulkMutation` lane and uses the real partial-response parser.
    Transport error identity/retry ownership and direct-owner imports remain
    unchanged; no facade or second queue exists. JSDoc matches these boundaries.
    Do not await either queued wrapper inside an active same-lane reservation:
    Section 4 must call `callApi` directly inside its reserved slot, reusing the
    shared request schemas and response parser.
  - Audit correction supersedes the earlier nullable-upsert description and
    **12 files / 184 tests** evidence. Corrective RED: **4 failures (2 schema,
    2 service)** proved null upsert cohort/year-group keys were incorrectly
    accepted. Supplied GREEN evidence: **116 mutation tests passed** and
    **13 focused files / 191 tests passed**. All-project type-checking passed;
    frontend lint reported **zero errors / 19 baseline warnings**. These are
    implementation results, not an independent 3C review or regression verdict.
    These results are supplied audit-fix evidence, not checks rerun by this
    documentation pass. The subsequent independent sign-off and Section 3
    regression comparison below complete this gate.
  - Measured suites after the audit fix: `abClassMutations.zod.spec.ts` **155 lines**;
    `abClassMutationService.spec.ts` **231**; shared canonical
    `abClassMutationFixtures.ts` **42**. Upsert fixtures independently select
    canonical `small` class-0 with both configuration keys non-null; response
    fixtures remain independently selected and may retain nullable configuration
    keys. Whole metadata remains optional and nullable for both mutations.
    Helper register/test guide reflect these owners and real-parser/actual-queue
    coverage. The writer/task entry are subsequently implemented in Section 4
    below; generic runner and hook remain **Not implemented**. Data-shape
    reconciliation was separately owned and included in independent 3C review.
- **Section 3 — COMPLETE; zero new regressions.**
  - Independent 3C verdict: **PASS — CLEAN 3C**, no outstanding in-scope findings.
    Report: `.opencode/scratchpad/review-section3c-independent-clean.md`.
    Fresh reviewer validation passed frontend coverage **277 files / 2,707 tests**,
    focused mutation/API queue/bulk checks **13 files / 191 tests**, frontend
    project type-checking and `git diff --check`. Frontend lint reported **zero
    errors / 19 baseline max-lines warnings**. No browser interaction was activated.
  - Verified actual persisted section-end comparison at
    `2026-10-20T06:21:48.763Z` for
    `npm run regression-checker -- frontend-abclass-metadata`:
    `.ts-regression-checker/reports/session-frontend-abclass-metadata/runs/2026-10-20T06-21-48.763Z/comparison.txt`.
    **Regressions 0, new failures 0, fixes 5.** Seven of eight checks passed;
    backend lint alone remains failing on the same six baseline max-lines
    warnings, with zero errors. Overall status remains baseline **FAILING**,
    not an all-green aggregate. No Section 3 blocker remains.
- **Section 4 — COMPLETE and independently review-clean; zero new regressions.**
  - Production owners measured at **147 / 38 / 92 physical lines**:
    `services/dataAnalysis/postAnalysis/metadataProjection.ts`,
    `refreshABClassMetadata.ts` and `services/abClass/abClassMetadataService.ts`.
    Pure helpers validate source times, select the newest target, apply timestamp
    gates, project exact aggregate scores/markers and merge stable rolling history.
    Task entry skips cheap no-ops; the writer reserves the actual bulk lane,
    freshly reads the full class, rechecks/reselects, requires definition coverage,
    recalculates full standard-weight scope and one isolated instance, then sends
    only classId/complete metadata and parses the real partial response. Failures
    propagate; no nested enqueue, second queue, upsert, rollback or task retry.
  - Supplied focused GREEN evidence: **61 new cases / 7 suites**; combined
    focused checks **19 files / 249 tests passed** (log:
    `.opencode/scratchpad/section4-fixture-all-tests.txt`). All-project
    type-checking passed; frontend lint **zero errors / 19 baseline warnings**.
    These are implementation results, not independent review or Section 4
    regression sign-off. RED details are not independently verified by this
    documentation pass; no fabricated missing-behaviour result is claimed.
  - **Evidence limitation:** all **11** compact canonical classes have a null
    submission studentName in their newest assignment, rejected by existing
    isolated analysis. Successful probes explicitly model a historical-source
    boundary clone omitting only the final assignment, without modifying names
    or scores: `small` class-2 → assignment-2-2, `medium` class-0 →
    assignment-0-4, `large-representative` class-1 → assignment-1-3.
    Three untouched canonical failure probes retain the newest input and prove
    no write, no clock access and lane release. This is an honest success-evidence
    limitation, not an unimplemented metadata product function. No generator
    change, regeneration or production repair is authorised or performed.
  - `metadataEvidenceOracle.ts` derives independent numeric expectations from
    raw assessments/live weights, never supplied metadata. Supplied history
    remains retention evidence only. Fixture/transport support lives under
    `src/test/abClass/`; no generic mock transport or production fixture import.
  - Helper discovery/register, analysis architecture, frontend testing and
    synthetic guide now reconcile these delivered owners. JSDoc was inspected
    against implementation: pure source-time/rolling semantics, standard scope,
    clock ownership, session-local reservation and error propagation are accurate;
    no source edits were needed. Timestamp-only caching deliberately misses
    score/definition/weight/roster changes without a new source version. Same-lane
    owners re-read prior writes within this session; no cross-session lock exists.
  - Generic context schema, registry/runner, shared hook, UI consumer activation,
    invalidation and feedback are still **Not implemented** (Section 5). Section 4
    has passed independent clean review and its section-end regression comparison
    below; no later delivery gate is claimed here.
  - Independent final verdict: **PASS — CLEAN Section 4**, report
    `.opencode/scratchpad/review-section4-final-docs-clean.md`. Both documentation
    nits from `.opencode/scratchpad/review-section4-independent.md` are resolved:
    Section 3 completion status and the singular `failure` suite path. No
    outstanding in-scope finding remains. Retained reviewer validation passed
    frontend coverage **284 files / 2,768 tests**, including all coverage thresholds,
    frontend project and all-project type-checking, and verify-only frontend lint
    (**zero errors / 19 baseline warnings**). Reviewer focused checks passed
    **17 files / 228 tests**; this does not replace the earlier distinct focused
    selection. No UI consumer was activated by Section 4.
  - Verified persisted section-end comparison for
    `npm run regression-checker -- frontend-abclass-metadata`, timestamp
    `2026-10-20T07:26:18.292Z`:
    `.ts-regression-checker/reports/session-frontend-abclass-metadata/runs/2026-10-20T07-26-18.292Z/comparison.txt`.
    **Regressions 0, new failures 0, fixes 5.** Seven of eight checks passed;
    backend lint alone remains failing on the same six baseline `max-lines`
    warnings, with zero errors. Overall status remains baseline **FAILING**,
    not an all-green aggregate. No Section 4 blocker remains.
  - **Canonical status follow-up:** route current Section 4 pending-review/regression
    statements in `docs/developer/data-shapes/abclass.md` and
    `docs/developer/data-shapes/frontend-data-analysis-response.md` to the Data
    Shapes Agent using the clean review and persisted comparison above. These
    files were not edited by this pass. The synthetic guide's introductory
    Section 4 status was subsequently reconciled during 5A documentation; its
    accurate historical fixture limitation is unchanged. Generic lifecycle, registry/runner, hook,
    invalidation, feedback and UI activation remain pending Section 5 delivery.
  - Documentation-only verification: Prettier `--check` passed for all five
    reconciled Markdown files; `git diff --check` passed. No source/JSDoc, tests,
    data-shapes, generator, agent configuration or navigation files were edited
    by this pass. Existing page purposes and paths are unchanged; no new page
    requires a navigation or documentation-landscape entry.
- **Checkpoint 5A — COMPLETE and independently review-clean.** Report:
  `.opencode/scratchpad/review-section5a-independent-clean.md`, verdict
  **PASS — CLEAN 5A**, no outstanding in-scope findings. Checkpoints **5B–5C** are
  independently review-clean; **5D** and Sections **6–7** remain pending. Neither
  feature consumer is active.
  - Implemented as an exact green extraction, not a new behaviour requiring a
    fabricated RED failure. Actual physical LOC: Class-page prefetch owner
    `useClassPageAssignmentPrefetch.ts` **74**, remaining `useClassPageData.ts`
    **447**; Heatmaps preview support `heatmapsPreviewQueries.ts` **100**,
    remaining `useHeatmapsPageData.ts` **385**.
  - Supplied before/after evidence: both hook families passed **7 files / 51
    tests**, with all **151 direct expect calls** preserved unchanged.
    `npm run typecheck:all` passed; verify-only frontend lint retained **zero
    errors / 19 baseline warnings**. These are supplied implementation results,
    not checks rerun by this documentation pass or independent review sign-off.
  - The prefetch owner retains ready-only dispatch, once-per-class guard,
    sorting, keyed query calls and `useClassPageData.prefetch` logging (historical;
    the log context was later renamed to `useClassPageAssignmentPrefetch` during
    review remediation). Preview
    support owns disabled options, input conversion, stable empty lookup and
    combined-state types; query callbacks, memo dependencies, live-definition
    pipeline and diagnostic contexts remain with their existing owners.
    Module-load analysis service/mock lifecycle is unchanged.
  - Helper discovery and the prefetch guide now name the actual feature-local
    owners; no generic/global helper promotion or policy change was made. The
    synthetic guide's stale Section 4 pending status is corrected without
    changing its historical-source evidence limitation. Generic context,
    registry/runner, hook, feedback, invalidation and consumers remain **Not
    implemented** at the 5A checkpoint; 5B delivery below supersedes only generic
    lifecycle status. Fresh independent 5A checks passed coverage **284 files /
    2,768 tests**, browser suite **303 tests**, frontend and all-project type checks,
    frontend lint (**zero errors / 19 existing warnings**) and `git diff --check`.
    No full Section 5 regression comparison is claimed before remaining checkpoints
    complete.
  - Documentation validation: Prettier `--check` passed for the four Markdown
    files updated by this 5A pass; `git diff --check` passed. No code, tests,
    data-shapes, configuration or navigation changed. Existing page purposes
    and paths are unchanged; no documentation-landscape update is required.
- **Checkpoint 5B — COMPLETE and independently review-clean.** Final report:
  `.opencode/scratchpad/review-section5b-final-clean.md`, verdict **PASS — CLEAN 5B**.
  All **47** lifecycle cases passed; key-generation failure isolation and stale
  synthetic-guide status findings are resolved. Fresh reviewer coverage passed
  **290 files / 2,815 tests**, frontend/all-project type checks passed, frontend
  lint reported **zero errors / 19 baseline warnings**, and diff checks passed.
  Earlier pending-review statements below describe historical evidence, superseded
  by this sign-off. No full Section 5 regression gate is claimed.
  - Actual physical LOC: `postAnalysis.zod.ts` **46**, `runPostAnalysisTasks.ts`
    **71**, `postAnalysisTasks.ts` **55**, `hooks/usePostAnalysisTasks.ts` **131**.
    Context/outcome schemas, unique ordered descriptors, failure-isolated runner,
    metadata-only registry and shared post-commit lifecycle are present. Registry
    clock configuration is constructor-owned; construction does not read the clock.
  - Initial supplied implementation evidence: **43 new tests**; combined focused checks
    **25 files / 292 tests passed**, all-project type-checking passed, frontend
    lint **zero errors / 19 baseline warnings**. These are handoff results, not
    checks rerun by this documentation pass or independent review evidence. No
    independently verified RED result is claimed here.
  - Corrective result-narrowing evidence supersedes the initial lifecycle count:
    **45 lifecycle tests** after two RED probes for returned `pending`/`failed`
    results were fixed. Task results now accept only `succeeded`/`skipped`, separate
    from broader lifecycle outcomes. The schema is **46** physical lines; the
    runner remains **71**. These counts precede the concurrently owned
    key-generation failure-isolation regression test; no later count is inferred.
  - Initial independent 5B review returned **FAIL**, report
    `.opencode/scratchpad/review-section5b-independent.md`: missing key-generation
    failure-isolation coverage and stale synthetic-guide delivery status. This
    documentation correction resolves the latter while preserving the canonical
    null-name corpus limitation. Coverage correction and independent re-review
    remain separately owned; no clean 5B verdict is claimed.
  - Attempts are task-local, retained per mount even after failure and across class
    navigation. Metadata source keys exclude cache metadata; unkeyed future tasks
    use successful context identity. StrictMode replay reattaches pending work;
    cleanup suppresses stale publication without aborting work. Technical Errors
    remain local, later independent tasks continue, and confirmed saves retain
    confirmation without yet invalidating queries.
  - Canonical helper discovery/register, analysis architecture and testing guide
    now describe delivered owners and an illustrative future-task registration.
    JSDoc was read against actual schema/runner/registry/hook behaviour; no source
    edit was needed. No fake future task, frontend facade or barrel was introduced.
    Both consumers must later call this shared extension point directly (5D).
    Feedback/invalidation remain **Not implemented** (5C); consumers are inactive
    (5D); Sections 6–7 remain pending. Data-shape reconciliation is separately owned.
  - Documentation validation: Prettier `--check` passed for these four Markdown
    files and `git diff --check` passed. No source, tests, data-shapes or
    configuration changed in this pass. Existing page purposes/paths are unchanged;
    no navigation or documentation-landscape update is required. User-owned reviewer
    configuration was intentionally left untouched.
- **Checkpoint 5C — COMPLETE and independently review-clean.** Report:
  `.opencode/scratchpad/review-section5c-independent.md`, verdict
  **PASS — CLEAN 5C**, no outstanding Critical, Improvement or Nitpick findings
  in scope. Fresh reviewer validation passed frontend coverage **294 files /
  2,840 tests** with all thresholds met, `npm run typecheck:all`, verify-only
  frontend lint (**zero errors / 19 baseline `max-lines` warnings**) and
  `git diff --check`. Review scope covered the hook extension, feedback,
  invalidation, diagnostics, failed-outcome schema, the four 5C suites and the
  real-App-host test support. No full Section 5 regression comparison or browser
  acceptance verdict is claimed; both remain gated on 5D consumer activation.
  - **5D browser prerequisite partially satisfied.** Playwright has registered
    `upsertABClass` and `updateABClass` in `RuntimeScenario`
    (`runtimeMockTypes.ts`) and in the `allMethods` dispatch inventory
    (`endToEndRuntimeMocks.ts`). Supplied prerequisite evidence records the **9**
    existing `task-heatmap-summary.spec.ts` journeys passing. Scenario response
    sequences are **not yet** adjusted for the queued read/update/invalidation
    calls, because those calls cannot occur until both production consumers are
    wired. Response compatibility therefore remains pending after consumer
    wiring; no 5D or browser acceptance completion is claimed.
  - Actual filesystem physical LOC: hook **180**, feedback **90**, invalidation
    **43**, context/result/outcome schema **50**, runner **63**, diagnostics **40**.
    `postAnalysisTasks.ts` remains **55**. The shared hook now completes confirmed
    saves with both detail/list invalidations inside the cached attempt, collecting
    both settlements with `throwOnError: true`. Inactive queries only become stale;
    no imperative fetch or unrelated invalidation is added. Failed refresh retains
    save confirmation separately from its local Error and permits later tasks.
  - Feedback uses the existing App host, exact distinct save/refresh warning copy,
    persistent dismissible polite status semantics and owner/task/class/source keys.
    Mount-owned dismissal memory survives same-source reattachment; new versions
    can notify again. Navigation/unmount destroys only owned notices and suppresses
    late publication without aborting active work. Task-owned logs contain bounded
    identifiers and available request correlation, not raw metadata/submissions.
  - Supplied focused GREEN evidence: **25 additional cases / 72 lifecycle cases
    total**; combined **32 files / 336 tests passed**; all-project type-checking
    passed; frontend lint **zero errors / 19 baseline warnings**. These remain
    supplied implementation results, superseded as a sign-off by the independent
    clean review above; no independently verified RED claim is made.
  - Tests render the real App host and real query observers. The HappyDOM-only
    helper waits for an actual leave-active class, dispatches `animationend` inside
    `act` and asserts DOM removal; no production motion workaround is introduced.
  - Canonical helper, analysis, testing, query, logging and synthetic guides were
    reconciled to distinguish clean 5B, then-pending 5C and inactive 5D consumers.
    JSDoc was reviewed against actual owners; no source/JSDoc edit was needed.
    Existing loading/width/spacing policy is unchanged: stock feedback introduces
    no new layout, busy surface or motion rule. Unrelated planned attempt-baseline
    helpers remain **Not implemented**. Data-shapes remain separately owned.
  - **5D and Sections 6–7 remain pending.** Current pages do not yet trigger this
    shared post-run lifecycle. Browser keyboard, geometry/theme and full queued
    write/refresh acceptance remain unproved by these unit checks. No section-end
    regression comparison is claimed before consumer wiring and review complete.
- **User-owned model configuration:** the user has updated agent model
  configuration under `.opencode/agents/`; `code-reviewer.md`,
  `implementation.md` and `testing-specialist.md` carry working-tree
  modifications. This documentation pass did not inspect, summarise or modify
  those files, and no contents are inferred here.
- This documentation reconciliation updated the frontend helper register,
  frontend testing guide, Playwright E2E guide, synthetic test-data guide,
  frontend architecture file tree, one stale backend-testing path reference and
  this delivery log. The
  earlier Section 1 completion update changed this plan only. Canonical
  `abclass.md` and `frontend-data-analysis-response.md` are owned by the Data
  Shapes Agent concurrently and were not edited. No production code, tests,
  corpus, configuration, `docs/plans/SPEC.md` or `.opencode/agents/*` were
  changed; no commit, push, deployment, lint suppression or generator
  regeneration occurred.
- **Documentation status reconciliation (5C sign-off) — 20 October 2026.**
  - Updated the frontend helper register, data-analysis architecture, frontend
    testing guide, synthetic test-data guide, frontend logging/error-handling
    and React Query/prefetch guides, the Playwright E2E guide and this delivery
    log to replace current "implemented pending 5C review" statements with the
    independent **PASS — CLEAN 5C** verdict and report
    `.opencode/scratchpad/review-section5c-independent.md`. Historical
    checkpoint evidence remains as recorded; only current status statements were
    reconciled.
  - Recorded the partial 5D browser prerequisite: `upsertABClass` and
    `updateABClass` are registered in Playwright runtime types and dispatch
    inventory, and supplied evidence records the 9 existing Heatmaps summary
    journeys passing. Scenario response-sequence compatibility remains pending
    after consumer wiring. No 5D, Section 5 completion, section-end regression or
    browser acceptance verdict is claimed.
  - No source, tests, configuration, corpus, data-shapes, delegation or
    `.opencode/agents/*` files were edited. `git diff --check` passed for this
    docs-only pass. Data-shape status statements remain owned by the Data Shapes
    Agent.
- **Checkpoint 5D — production consumer binding implemented; independent review and Section 5 regression pending.**
  - Both averaging surfaces now call `usePostAnalysisTasks` directly:
    `features/classPage/useClassPageData.ts` and
    `features/taskHeatmap/useHeatmapsPageData.ts`. Each builds the post-analysis
    context only from a `ready` surface with the complete unsliced `classFull`,
    live `assignmentDefinitionPartials` and the successful `averagingResult`;
    otherwise it passes `null`. The Heatmaps selection narrows display analysis
    only: metadata calculation always uses the full class. No descriptive summary
    result is written.
  - The production registry is constructed once per mount and its task list is
    stable. Each consumer memoises the context on its inputs so ordinary rerenders
    keep the same object identity. This is the production loop guard; shared
    metadata freshness is not a global eligibility gate for future tasks.
  - Supplied RED/GREEN evidence: the initial **11** consumer binding tests failed
    without the binding and passed after wiring. A browser run then exposed an
    infinite attach/publish loop caused by a fresh context object per render;
    **2** corrective RED identity tests failed, then passed once the context was
    memoised. Consumer binding totals **13** tests. Existing hook-family unit
    suites retained **51** tests under the new mock boundary; broader combined
    coverage remains with the parent session.
  - Actual filesystem physical LOC: `useClassPageData.ts` **487**;
    `useHeatmapsPageData.ts` **425**. The Class page exceeds its original 480-line
    target by 7 but stays below the 500-line `max-lines` warning threshold, so no
    new diagnostic is introduced. The actual figure is recorded rather than
    compressing formatting to meet the target.
  - Playwright compatibility is wired: `upsertABClass` and `updateABClass` remain
    registered in `RuntimeScenario` and the strict `allMethods` dispatch inventory.
    `createHeatmapScenario` gives each fixture an explicit canonical metadata
    snapshot pinned to its newest assignment's equal version, so the background
    task takes its documented no-op path. Supplied metrics remain fixture evidence,
    not an analysis oracle. The first of the **9** `task-heatmap-summary.spec.ts`
    journeys also asserts that `updateABClass` is never called.
  - Supplied focused evidence: **9** existing summary E2E journeys passed with
    `--retries=0`; `npm run typecheck:all` passed; verify-only frontend lint
    reported **zero errors / 19 baseline `max-lines` warnings**.
  - **Full browser evidence — narrow keyboard seam diagnosed, fixed and green.**
    The initial full **303**-test run passed **301** with two failures, both at
    the narrow 390×844 standalone Heatmaps keyboard active-option assertion
    (`.opencode/scratchpad/section5d-full-e2e.log`). A full rerun with
    `--retries=0` then passed **303/303** before any code change
    (`.opencode/scratchpad/review5d-e2e-full.txt`), and a reviewer run passed
    **302** with one (`.opencode/scratchpad/review5d-e2e.txt`). The earlier
    "cause not established" statement is superseded: failure context showed the
    assignment search text entering the Class combobox while the assignment
    control was disabled awaiting the class query. `Locator.focus()` is a no-op
    on a disabled control, so `page.keyboard.type` wrote into the previously
    focused Class input. `e2e-tests/helpers/task-preview-source-link-helpers.ts`
    (**443** physical lines, below 500) now asserts the control is enabled,
    focuses it, asserts focus, then performs the original keyboard type and
    active-option assertion. No sleeps, retries, timeout changes or weakened
    assertions were added. Six narrow repeated runs and the parent full
    **303**-test run passed with `--retries=0`
    (`.opencode/scratchpad/section5d-keyboard-fixed-full-e2e.log`, 8.4 minutes).
    Other Playwright attempts failed with server connection refused
    infrastructure errors and are recorded as non-passes. All-project
    type-checking passed and verify-only frontend lint reported **zero errors /
    19** baseline warnings.
  - **Independent 5D review remains PENDING — not clean.** Fresh reviewer
    evidence: **296** frontend test files / **2,853** tests passed
    (`.opencode/scratchpad/review5d-coverage.txt`; coverage thresholds met),
    `npm run typecheck:all` passed
    (`.opencode/scratchpad/review5d-typecheck.txt`), verify-only frontend lint
    reported **zero errors / 19** baseline `max-lines` warnings
    (`.opencode/scratchpad/review5d-lint-frontend.txt`), and diff check passed.
    The focused 5D selection passed **9 files / 54 tests**, including the **13**
    consumer-binding cases (**6** Class page + **7** Heatmaps). The review verdict
    and the Section 5 regression comparison are still outstanding.
  - **Pending, not claimed:** independent 5D review and the Section 5 regression
    comparison remain pending. Changed-write browser acceptance, warning dismissal
    in a real browser and theme/geometry containment remain Section 6 work. The
    existing Heatmaps summary probes use an explicit equal-version NOOP boundary,
    which proves no write occurs; they do not exercise a changed write or a
    failure journey. No Section 5 completion is claimed yet.
  - This documentation reconciliation updated the canonical frontend helper
    register, data-analysis architecture, React Query/prefetch, testing,
    Playwright E2E, logging/error-handling and synthetic test-data guides plus
    this log. Earlier passes replaced the "full browser run pending" statements
    with the completed 303-test rerun; this pass superseded the unresolved-flake
    wording above with the diagnosis and fixed-helper evidence. It changed no
    production code, tests, configuration, corpus, delegation,
    `.opencode/agents/*` or data-shapes files; `git diff --check` passed for this
    pass.
- **Section 5 — COMPLETE and independently review-clean; zero new regressions.** (Section 6 was still pending at this checkpoint; its completion is recorded below.)
  - Final independent 5D verdict: **PASS — CLEAN 5D**, no outstanding in-scope
    findings. Report: `.opencode/scratchpad/review-section5d-independent.md`.
    This fresh final reviewer session supersedes the earlier 5D report at the
    same path, which predated the full keyboard-fixed browser run and
    mischaracterised the narrow failure as an unresolved load-sensitive flake.
    The reviewer verified the root cause and the helper fix against the actual
    working tree: `Locator.focus()` is a no-op on a disabled control, so the
    helper now asserts the assignment control is enabled, focuses it, asserts
    focus, then performs the original keyboard type and active-option assertion.
    No sleeps, retries, timeout changes or weakened assertions were added.
  - Fresh reviewer validation: **296** frontend test files / **2,853** tests
    passed with all coverage thresholds met; `npm run typecheck:all` passed;
    verify-only frontend lint reported **zero errors / 19** baseline `max-lines`
    warnings; `git diff --check` passed; the focused 5D selection passed
    **9 files / 54 tests**, including the **13** consumer-binding cases (**6**
    Class page + **7** Heatmaps). Browser evidence after the helper fix: full
    Playwright suite **303 passed** with `--retries=0`
    (`.opencode/scratchpad/section5d-keyboard-fixed-full-e2e.log`, 8.4 minutes).
    Other attempts failed on server-connection-refused infrastructure errors and
    remain recorded as non-passes.
  - **Verified persisted section-end comparison** for
    `npm run regression-checker -- frontend-abclass-metadata`, timestamp
    `2026-10-20T22:50:54.007Z`:
    `.ts-regression-checker/reports/session-frontend-abclass-metadata/runs/2026-10-20T22-50-54.007Z/comparison.txt`
    (the `comparison.json` and `manifest.json` siblings are present in the same
    persisted run directory; the scratchpad logs are not the record).
    **Regressions 0, new failures 0, fixes 5.** Seven of eight checks passed:
    frontend lint, builder lint, backend coverage, frontend coverage, frontend
    E2E, builder coverage and all-project type-checking. Backend lint alone
    remains failing on the same six baseline `max-lines` warnings, with zero
    errors. Overall status remains the baseline **FAILING**, not an all-green
    aggregate. Section 5 is complete with no remaining gate.
  - **Section 6 — COMPLETE and independently review-clean; zero new regressions.**
    - **Node dispatcher integration.** `scripts/synthetic-test-data/apiHandlerRoundTripBridge.js`
      is now **127** physical lines (from **93**). It deep-clones the frozen
      `classesById` and `classPartials` loader views before mutation, serves class
      partial reads through the existing test-only `ABClassController` seam
      (`abClassControllerBehaviour.getAllClassPartials`), and supplies
      `upsertABClass_`/`updateABClass_` transport seams that replace metadata on
      the bridge's isolated records. `tests/helpers/apiHandlerTestUtils.js`
      (**369** lines) forwards that controller-behaviour option. Every seam is
      still installed and restored per call.
    - New suite `tests/synthetic-analysis/syntheticABClassMetadataRoundTrip.test.ts`
      is **188** physical lines / **5** tests. It composes the real `apiHandler`
      and dispatcher envelopes with the frontend `callApi`, service schemas and
      queued mutation wrappers. Coverage: full/partial read retention; queued
      update/upsert omission, null clear and whole replacement; own-undefined
      rejection before dispatch; `INVALID_REQUEST` for malformed dispatch input
      and `INTERNAL_ERROR` for a throwing class seam; two-bridge state isolation
      and seam restoration after success and failure, with caller-owned spies
      preserved.
    - **Scope honesty:** this is test-only composition of the existing controller
      and transport helper seams. It does not prove real controller/DbManager
      persistence, full controller integrity, auth or envelope changes. The
      existing real-dispatcher, envelope and auth suites remain the evidence for
      those contracts and were not replaced.
    - **Browser coverage.** `src/frontend/e2e-tests/helpers/post-analysis-metadata-scenarios.ts`
      is **297** lines and builds canonical `small` class-2 historical-source
      scenarios (omitting only the final assignment), a changed-write journey for
      both surfaces and a newer-version manual-refresh journey.
      `post-analysis-metadata.persistence.spec.ts` is **128** lines / **3** tests:
      Class page one write plus fresh read; standalone Heatmaps one write with no
      loop on the same source; newer assignment version writes once after manual
      refresh (six reads and two writes). `post-analysis-metadata.feedback.spec.ts`
      is **231** lines / **7** tests: persistent safe save-failure copy on both
      surfaces, the distinct confirmed-save/refresh-failure copy, keyboard
      dismissal, no reopen on the same source, navigation cleanup, and four
      containment/theme checks at 1440×900 and 390×844 in light and dark.
    - Supplied evidence: the **10** new browser tests are green; verify-only
      frontend lint reported **zero errors / 19** baseline `max-lines` warnings;
      `npm run typecheck:all` passed after repairs. Independent review
      (`.opencode/scratchpad/review-section6-independent.md`) recorded its own
      full **313**-test browser run passing with `--retries=0` (8.8 minutes,
      `.opencode/scratchpad/review6-full-e2e.log`), the full synthetic project at
      **34 files / 384 tests** (`.opencode/scratchpad/review6-synthetic-full.log`),
      the focused Node round-trip suite at **1 file / 5 tests**, zero frontend
      lint errors and passing all-project type-checking. Screenshots are in
      `.opencode/scratchpad/metadata-feedback-{light,dark}-{narrow,desktop}.png`;
      narrow light/dark screenshots showed the notice copy wrapping and the close
      control contained, with the expanded narrow sidebar compressing the
      analysis area as a pre-existing layout behaviour, not a new feedback
      layout.
    - No generator, profile, view or schema weakening and no backend production
      change. Existing supplied metadata snapshot fixtures are unchanged. Future
      task registration documentation and guarantees are unchanged.
    - **Section 6 regression comparison verified at**
      `.ts-regression-checker/reports/session-frontend-abclass-metadata/runs/2026-10-21T00-43-04.269Z/comparison.txt`:
      **regressions 0, new failures 0, fixes 5**, seven of eight checks passing.
      Backend lint alone remains failing on the same six baseline `max-lines`
      warnings, with zero errors. Overall status remains the baseline **FAILING**,
      not an all-green aggregate. Section 6 has no remaining gate.
  - The shared same-lane queue contract (a task holds `classesBulkMutation`
    across the full awaited read/merge/write operation) and the two warning
    copies were already documented in the helper, query and logging guides, so
    this pass needed no change there. Stale current-status statements saying
    "independent review and the Section 5 regression comparison remain pending"
    were replaced in the helper register, data-analysis architecture, React
    Query/prefetch, testing, Playwright E2E, logging/error-handling and synthetic
    test-data guides. Historical pending notes in this log and in `abclass.md`
    remain as recorded history.
  - Docs-only pass: no production code, tests, configuration, corpus,
    delegation, `.opencode/agents/*` or data-shape files were edited, and no
    commit, push or deployment was made. The user-owned
    `.opencode/agents/code-reviewer.md` working-tree modification was left
    untouched; it is also not a documentation-list change, so no synchronisation
    was required. **Follow-up:** `docs/developer/data-shapes/abclass.md` and
    `frontend-data-analysis-response.md` still carry pending 5D/Section 5 status
    statements and remain owned by the Data Shapes Agent.
  - **Section 6 documentation reconciliation — docs-only.** Updated the synthetic
    test-data guide, backend testing, frontend testing, Playwright E2E,
    shared-helper register, data-analysis architecture, logging/error-handling and
    React Query/prefetch guides to describe the implemented test-only Node/browser
    artefacts and the evidence above. Section 6 is recorded as implemented pending
    independent review and section-end regression, not accepted. No production
    code, tests, configuration, corpus, data-shape, delegation or
    `.opencode/agents/*` files were edited. `git diff --check` passed.
- **Section 7 — Documentation audit and canonical reconciliation: COMPLETE and independently review-clean; final aggregate gate evidence recorded (not green, pre-existing baseline). The final comparison is parent-owned after this documentation-only closure.**
  - **Closure.** The final independent Code Reviewer pass returned **CLEAN**
    with no Critical, Improvement or Nitpick findings in the reviewed
    Section 7 docs/comments scope:
    `.opencode/scratchpad/review-final-frontend-abclass-metadata.md`. It
    refreshed frontend coverage **296 files / 2,853 tests** with all thresholds
    met, `npm run typecheck:all`, verify-only frontend lint (**zero errors / 19
    baseline warnings**), Prettier and `git diff --check`, all passing.
    Sections 1–7 are complete and review-clean; the aggregate gate remains not
    green on the unchanged baseline.
  - **Audit result (RED).** Audited every current `Not implemented`,
    metadata-stripping, post-run-consumer, queue-serialisation and facade/import
    claim in the canonical frontend/testing docs and this plan. Delivered owners
    already read `Implemented`; no remaining claim says the frontend strips
    metadata, that current analysis has no post-run consumer, that queues are
    globally serial, or that consumers must import an old facade path. The only
    retained `Not implemented` entries are unrelated: the planned attempt-baseline
    mode in the helper register §9.27 and the issue #305 planned response
    additions in `frontend-data-analysis-response.md`. `docs/plans/SPEC.md`, the
    planning sections and historical checkpoint bullets are preserved; root
    `ACTION_PLAN.md` is absent and was not recreated.
  - **Repair (GREEN).** Reconciled Section 6 from "implemented, pending
    review/regression" to complete, independently review-clean and zero new
    regressions in `docs/developer/frontend/data-analysis-architecture.md`,
    `frontend-shared-helpers-and-abstraction-standards.md`,
    `frontend-testing.md`, `frontend-playwright-e2e.md`,
    `frontend-react-query-and-prefetch.md`,
    `frontend-logging-and-error-handling.md`,
    `docs/developer/testing/synthetic-test-data.md` and this plan. Added the
    actual `services/abClass/` and `services/dataAnalysis/postAnalysis/` owners to
    the `frontend-architecture.md` illustrative services tree. Annotated the
    planning-time backend prerequisite as resolved by the integrated checkout at
    HEAD `4a0a3418`, while preserving the original planning statement as history.
  - **Refactor and single-source policy.** Kept policy in its canonical owners:
    helper discovery in the helper register, lifecycle/extension and cache
    limitations in `data-analysis-architecture.md`, invalidation in the React
    Query guide, and feedback/logging in the logging guide. Other docs link to
    those sections rather than restating them. No new page, command or
    `mkdocs.yml` navigation entry is required.
  - **JSDoc verification.** Read the JSDoc/`@remarks` of `usePostAnalysisTasks.ts`,
    `runPostAnalysisTasks.ts`, `postAnalysisTasks.ts`,
    `refreshABClassMetadata.ts`, `metadataProjection.ts`,
    `abClassMetadataService.ts`, `abClassMutationService.ts`, `apiQueue.ts`,
    `postAnalysisFeedback.ts` and `postAnalysisInvalidation.ts` against actual
    behaviour. Statements for task-local source keys, optional
    `{ id, run, getAttemptKey }` registration, post-commit execution, fixed
    standard weights and full unsliced scope, timestamp-only cache limitation,
    session-local (not cross-session) reservation, no nested same-lane enqueue,
    unchanged transport retry ownership, separate save/refresh outcomes and
    bounded task logs are accurate. Those owner remarks required no edit. The
    Section 7 JSDoc correction is confined to the class-read schemas: the
    `metadata` remarks in `classPartials.zod.ts` (`ClassPartialSchema`) and
    `classDetailService.zod.ts` (`ClassFullSchema.metadata`) no longer describe
    metadata as planned or validation as optional. They now state
    required-nullable on successful reads, optional by omission on mutation
    requests, and strict when present. No code behaviour changed.
  - **Verification.** `npx prettier --check` passed for every changed Markdown
    file and `git diff --check` passed. A relative-link/anchor scan found no new
    broken link; one pre-existing unrelated link to the absent
    `TASK_HEATMAP_ZERO_WEIGHT_LAYOUT.md` remains in
    `data-analysis-architecture.md` and was not altered. Docs-only: no production
    code, tests, configuration, corpus, data-shape, delegation or
    `.opencode/agents/*` files were edited, and no commit, push or deployment was
    made. The user-owned `.opencode/agents/code-reviewer.md` modification was
    left untouched.
  - **Final aggregate gate evidence (recorded 21 October 2026; pre-existing
    baseline, not an all-green claim).** The parent's final commands have finished. The
    aggregate gate is **not green**, and the failures are pre-existing baseline
    conditions rather than new regressions:
    - `npm run run-all-checks` exited non-zero at `lint:check`. Backend lint
      reported **zero errors and the same six pre-existing `max-lines`
      warnings** in test files, so the `&&` chain never reached the coverage,
      type-check or build scopes. Log:
      `.opencode/scratchpad/final-run-all-checks.log`.
    - The explicit `npm run test:coverage` then failed only at the backend
      branch-coverage gate: **209 files / 2,888 tests passed**, statements
      90.77% (5,087/5,604), branches **84.35% (3,165/3,752) against the 85%
      gate**, functions 89.89% (996/1,108) and lines 91.43% (4,892/5,350).
      Log: `.opencode/scratchpad/final-full-coverage.log`.
    - **Baseline proven.** A pristine `git archive` snapshot of HEAD
      `4a0a3418` at `.opencode/scratchpad/backend-coverage-head` (a
      `node_modules` link only; no tracked-file edits) ran
      `npm run test:backend:coverage` and produced the **same 209 files /
      2,888 tests and identical statement, branch, function and line totals**.
      Log: `.opencode/scratchpad/backend-coverage-head.log`. The branch
      shortfall is therefore not a new regression, and the threshold is not
      waived or suppressed; the aggregate baseline is simply not green.
    - Because the aggregate stopped, each remaining coverage scope was run
      explicitly and passed: frontend **296 files / 2,853 tests**, statements
      95.39%, branches 91.06%
      (`.opencode/scratchpad/final-frontend-coverage.log`); builder **23 / 245**,
      statements 93.82%, branches 86.81%
      (`final-builder-coverage.log`); synthetic **34 / 384**, statements
      94.99%, branches 88.28% (`final-synthetic-coverage.log`); OpenCode
      plugins **2 / 33**, statements 98.36%, branches 100%
      (`final-plugins-coverage.log`). An initial parallel coverage invocation
      failed to acquire the shared coverage report directory; the sequential
      rerun produced the passing results above. Treat that lock failure as
      infrastructure, not a coverage or code defect.
    - Production build passed; log:
      `.opencode/scratchpad/final-production-build.log`. All-project
      type-checking passed
      (`.opencode/scratchpad/review6-typecheck.txt`), and the independent
      Section 6 reviewer's fresh full
      browser run passed **313 tests with `--retries=0`** in 8.8 minutes
      (`.opencode/scratchpad/review6-full-e2e.log`). The Section 6 comparison
      at `2026-10-21T00:43:04.269Z` records **0 regressions, 0 new failures
      and 5 fixes**, with backend lint as the only failing check.
    - **Regression-checker measurement gap.** The persisted checker
      configuration (read unchanged) defines `backend-test-coverage-check` as
      `npm run test:backend`, **without coverage**. The comparison therefore
      reports that check as passing while the aggregate `npm run test:coverage`
      has the additional backend branch-coverage blocker above. Do not change
      the checker configuration to add coverage and do not suppress or lower
      the threshold; report both measurements honestly.
    - **Final regression comparison.** Because this documentation-only closure
      changed files, the final comparison runs after it using the retained
      `frontend-abclass-metadata` identity. Its persisted latest run and result
      are recorded in the execution handoff; no outcome is claimed here before
      that run exists. The last **actual** comparison remains Section 6 at
      `2026-10-21T00:43:04.269Z`
      (`.ts-regression-checker/reports/session-frontend-abclass-metadata/runs/2026-10-21T00-43-04.269Z/comparison.txt`):
      zero regressions, zero new failures and five fixes, with backend lint as
      the only failing check. The next run is expected under the same
      `session-frontend-abclass-metadata/runs/<timestamp>/comparison.txt`
      folder. Canonical data-shape status statements in
      `docs/developer/data-shapes/abclass.md` and
      `frontend-data-analysis-response.md` remain owned by the Data Shapes
      Agent.
