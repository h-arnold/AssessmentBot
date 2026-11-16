# Feature Delivery Plan (TDD-First) — LLM request cache warming (issue #309)

## Read-First Context

Before writing or executing this plan:

1. Read the current `docs/plans/issue-309/SPEC.md` (v1.11) — the source of truth for product behaviour and contracts.
2. No frontend layout spec is required or exists: the change is backend-only, with no frontend structure, workflow or visible surface changes (recorded in `docs/plans/issue-309/SPEC.md`).
3. Do not restate or redefine material settled in the spec; this plan sequences delivery and testing only.
4. The worktree is detached at `85b1199d` (current `origin/main`); two planning-time documentation edits are uncommitted and disclosed in `docs/plans/issue-309/SPEC.md` § Planning handoff notes.

## Scope and assumptions

### Scope

- Synthetic corpus regeneration (profile task counts, large-full rescale, completion bands, CLI regeneration, corpus-wide re-derivation gate, stress re-budget).
- Two-phase LLM dispatch: per-TaskDefinition seed partition, one parallel seed round, unchanged batched remainder, shared outcome consumer.
- Migration of the inventoried LLM/controller suites and the run-stop harness.
- Regression/contract hardening and same-change documentation updates.
- Recording the two planned shared-helper entries in `docs/developer/backend/api-layer.md` as `Not implemented` (completed at planning time; see § 1).

### Out of scope

- Frontend changes, E2E tests, data-shape/schema/persistence/API/transport changes, LLM-service changes, Sheets assessment path, `CacheManager` changes, new configuration or feature flags.
- Prompt-cache telemetry (`cached_tokens`) — user-authorised deferral.
- Per-task pipelined seeding (seed task t, then dispatch its remainder before task t+1) — v1 deferral.
- Relaxing any realism/type-matching gate in a shared test harness — explicitly rejected.

### Assumptions

1. Seeds are real assessments pulled forward in time; there is no duplicate dispatch and no new payload field.
2. The seed round is bounded by the assignment's task count (≤ 15 in the regenerated corpus) and deliberately bypasses the configured `backendAssessorBatchSize` throttle; the recorded revisit trigger applies if that bound stops holding.
3. The out-of-scope LLM service places the shared prefix before `studentResponse`, and the prefix is assumed identical across item `taskType` values; the cross-repo verification is a non-gating follow-up, and under divergence v1 still keeps one seed per TaskDefinition.
4. The regenerated `medium` corpus will provide numeric-healthy TEXT candidates in ≥ 2 tasks of `assignment-0-1`/`assignment-0-3`; this is a data prediction with a loud harness failure mode and must be verified during § 1, not treated as assured.
5. Regeneration costs are the measured anchors in the spec (large-full 1 task: ~246k items, ~11 s, ~800 MB RSS; ~3.25 MB / ~43 ms per 1k items); the rescaled ~900k items / ~2.9 GB / ~40 s stays within the user-approved ~3 GB budget and is re-validated empirically.

---

## Global constraints and quality gates

### Engineering constraints

- Keep `processStudentResponses()` orchestration thin; domain work lives in the partition helper and the shared outcome consumer.
- Fail fast on internal wiring faults; never swallow errors or add defensive fallbacks that hide them.
- Partition after the existing guards (empty check → `Validate.requireParams` → duplicate-UID rejection) to preserve invalid-input error precedence.
- `BaseRequestManager` is unchanged: phase 1 reuses `sendRequestsInBatches()` with `batchSize = seeds.length` (always ≥ 1 by the invocation rule).
- Post-change `LLMRequestManager.js` must be ≤ 500 lines: `eslint.config.js` sets `max-lines: ['warn', 500]` for backend JS and `lint:backend:check` runs with `--max-warnings 0` (wired into `lint:check` and `run-all-checks`). The pre-commit hook lints staged files with `--fix` and no warning budget, so it will not catch a `max-lines` breach — verify with `wc -l` at § 2's gate.
- British English in comments, docs and test names. No production code added purely to satisfy tests.

### TDD workflow (mandatory per section)

1. **Red** — write failing tests for the section's acceptance criteria.
2. **Green** — implement the smallest change that passes.
3. **Refactor** — tidy with all tests green.
4. Run section-level verification commands.
5. **Docs sync** — when documented behaviour changes, update docs before the section regression gate and record the outcome or skip reason in `Implementation notes`.
6. **Plan compaction** — after verification, compact the completed section to a summary retaining contracts, decisions, constraints and follow-ups relevant to later sections; preserve the deferred-findings ledger and the `Implementation notes / deviations / follow-up` subsection.

### Delegation mandatory reads (mandatory for sub-agent execution)

Every delegated handoff in every section must list its mandatory files as `@`-prefixed paths in the prompt; the `at-mention-inject` plugin attaches the contents. No read-evidence report is required.

Common mandatory reads for all delegated phases in this plan:

- `@docs/plans/issue-309/SPEC.md`
- `@docs/plans/issue-309/ACTION_PLAN.md`
- `@docs/developer/backend/backend-testing.md`
- `@docs/developer/testing/synthetic-test-data.md`

Do not attach `AGENTS.md` files to delegation prompts — sub-agents receive component rules by automatic injection.

Additional per-phase and per-section reads are listed in each section.

### Shared-helper planning gate

- The canonical entries for both planned helpers were added to `docs/developer/backend/api-layer.md` § Shared helpers with status `Not implemented` at planning time (before implementation starts), naming the owning layer `src/backend/RequestHandlers/`.
- Each section records its helper decision (reuse / extend / new / keep local); the documentation section reconciles the entries to implemented status or keeps `Not implemented` where still pending.

### Validation commands hierarchy

- Focused backend tests: `npm run test:backend -- <target>`
- Synthetic projects: `npm run test:synthetic`, `npm run test:synthetic:stress`
- Backend lint: `npm run lint:backend:check` (verify only)
- Full gate: `npm run run-all-checks` (lint, type checks, coverage, build)
- Frontend/E2E commands are not needed for the feature's behaviour change; the single exception is the corpus-consuming E2E verification subset in § 1 (`npm run test:frontend:e2e -- <specs>`), required by the regeneration's blast radius.

---

## Section 1 — Synthetic corpus regeneration and corpus-wide regression gate

### Objective

- Regenerate the canonical corpus so a single assignment carries ≥ 2 TEXT-typed tasks with dispatch-eligible numeric candidates, rescale the large-full profile to a realistic school shape, re-pinned committed fixtures, and prove the whole repository is green before any LLM migration begins.

### Constraints

- Per-profile tasks per definition: `small` 4, `medium` 6, `large-representative` 10, `large-full` 15; keep the `ARTEFACT_BODY_TYPES` cycle unchanged.
- `large-full`: 8 year groups (YG 7–14), 48 classes (6 per year group), 50 assignments per class; stays uncommitted/on-demand.
- Submission bands at 50 indices: `[0,3)` / `[3,8)` / `[8,43)` / `[43,50)` → 3/5/35/7 assignments per class (shares 6/10/70/14); `LARGE_FULL_COMPLETION_BANDS`, `sharePercent` and `assertCompletionBands` derivation must move together — the validator currently equates counts with `sharePercent` directly, which only works at 100 assignments.
- Committed profiles regenerated through `npm run fixtures:synthetic` only; never hand-edit JSON; `syntheticCommittedFixtureRegeneration.test.ts` re-pins committed bytes.
- Re-budget the stress project `testTimeout` from 30,000 ms to ≥ 120,000 ms and update the stale `vitest.config.js` "3,000-student / 10,000-assignment" comment; record any heap flag or machine-RAM requirement in `synthetic-test-data.md`.
- LOC / file separation: `profileDefinitions.js` 102, `generateAssignmentDefinitions.js` 238, `resolveSubmissionCount.js` 67, `validateProfileInvariants.js` 146, `generateSyntheticAnalysisFixtures.js` 258 — all far below 500 and projected to gain only a handful of lines each; no file separation required.
- This section is the canonical-fixture capability work for the whole feature: no competing realistic builder, no new profile or view, no gate relaxation.
- The uncommitted `synthetic-test-data.md` edits disclosed in the spec must land in this section's doc update (the artefact-type formulas, per-student variation, per-count TEXT guarantee, regeneration-as-intended-response paragraph and rescale-preferred extension path).

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `@docs/plans/issue-309/SPEC.md`, `@docs/developer/backend/backend-testing.md`, `@docs/developer/testing/synthetic-test-data.md`
- `@tests/synthetic-analysis/syntheticCommittedFixtureRegeneration.test.ts`, `@tests/helpers/llmRunStopHarness.js`

Implementation mandatory docs:

- `@docs/plans/issue-309/SPEC.md`, `@docs/developer/testing/synthetic-test-data.md`
- `@scripts/synthetic-test-data/profileDefinitions.js`, `@scripts/synthetic-test-data/generateAssignmentDefinitions.js`
- `@scripts/synthetic-test-data/resolveSubmissionCount.js`, `@scripts/synthetic-test-data/validateProfileInvariants.js`
- `@scripts/synthetic-test-data/generateSyntheticAnalysisFixtures.js`, `@vitest.config.js`

Code Reviewer mandatory docs:

- `@docs/plans/issue-309/SPEC.md`, `@docs/developer/testing/synthetic-test-data.md`, `@docs/developer/backend/backend-testing.md`

Docs mandatory docs (if used):

- `@docs/developer/testing/synthetic-test-data.md`, `@docs/plans/issue-309/SPEC.md`

### Shared helper plan

- No production shared helpers; the run-stop harness gains its opt-in multi-task selector here (corpus-verification capability), because § 1's capability probe depends on it. Helper decision: `extend` on `tests/helpers/llmRunStopHarness.js` (test helper; no canonical production-helper entry). Generator internals stay local.

### Acceptance criteria

- Every committed profile regenerates deterministically at its new task count; `syntheticCommittedFixtureRegeneration.test.ts` passes against the new committed bytes.
- `large-full` generates on demand with the rescaled entity counts and band shares; the stress project passes within the re-budgeted timeout and recorded RAM/heap settings.
- Verification at regeneration time confirms numeric-healthy TEXT candidates spanning ≥ 2 tasks in the regenerated `medium` `assignment-0-1` and `assignment-0-3` (or records a loud harness failure and the plan adjusts the host assignments).
- Canonical-pinned expectations across all consuming suites are re-derived (loader importers, direct `@synthetic` raw-import fixtures and `readSyntheticFixture` consumers), including the confirmed mixed-E row (`assignment-0-4`, `expect(countItems(stored, true)).toBe(4)` / `expect(countItems(stored, false)).toBe(6)`) updated for the new 30-item shape. Any E2E fixture drift found by the § 1 E2E subset is triaged as signal, not papered over.
- `npm run run-all-checks` passes after this section and before § 2 begins; the corpus-consuming E2E subset is run once (if the environment cannot run it, record the residual risk explicitly in `Implementation notes`).

### Required test cases (Red first)

Synthetic generator/validation tests:

1. A failing test asserting the new per-profile tasks-per-definition constants and the TEXT counts they imply (4 → only `definitionIndex % 3 === 0` definitions have two; 6 → exactly two per full definition; 10 → three to four; 15 → exactly five).
2. A failing stress assertion for 48 classes / 8 year groups / 50 assignments and the 3/5/35/7 band counts derived from the new shares.
3. A failing committed-fixture comparison until the CLI regeneration lands; then re-run `syntheticCommittedFixtureRegeneration.test.ts` against the new bytes.
4. A failing harness capability probe that collects ≥ 2 TEXT-typed numeric-healthy candidates across tasks of one regenerated `medium` assignment — single-task mode remains the harness default; the opt-in multi-task selector is added to `llmRunStopHarness.js` in this section, so the probe is executable here and § 3 only consumes it.

Backend regressions:

5. Re-derive the mixed-E row's pinned counts and add a boundary probe proving the failed/non-E split for `assignment-0-4` after regeneration.
6. Add a corpus-wide sweep task: re-run the 63 files importing `loadBackendModelInputs` / `loadSyntheticAnalysisProfile` (50 outside the synthetic projects), the direct `@synthetic` raw-import fixtures (`previewFixtures.ts`, `abClassMetadataFixtures.ts`, `abClassMetadataSharedFixtures.ts`, `metadataRefreshFixtures.ts`, `abClassMutationFixtures.ts`, `legacyAssessmentParityOracle.ts`, `AssessTaskModal.recovery-helpers.ts`), and the 21 frontend unit specs raw-importing committed views (for example `dataAnalysis.mediumBaselineRoundTrip.spec.ts`, `heatmapsPreviewQueries.spec.ts`, `assignmentReadNormalisation.*.spec.ts`, and the taskHeatmap/assignmentWizard/classDetailService specs — these are netted by the § 1 `run-all-checks` gate but must be triaged as signal, not silently re-anchored). The E2E subset is the transitive closure of `readSyntheticFixture` consumers: the seven named callers, including `task-preview-source-link-fixtures.ts` (three task-preview-source-link specs) and `issue-320-layout.spec.ts`, plus the task-heatmap, assessment-error-preview, class-metadata, post-analysis-metadata and stale-recovery consumers. Run it with `npm run test:frontend:e2e -- <specs>` once after regeneration, or record the residual risk. Triage each failure as signal; no blanket expectation edits.

### Section checks

- `npm run fixtures:synthetic` then `npm run test:synthetic`; `npm run test:synthetic:stress` with the new timeout/heap configuration.
- `npm run run-all-checks` green, recorded before § 2 starts; E2E subset run once or residual risk recorded (see acceptance criteria).
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Docs sync outcome recorded (profile table, bands, year groups, large-full numbers, stress note, artefact-type description, vitest comment, stress budget).
- Completed section compacted; future-relevant detail retained in **Retained for later sections** (regenerated fixture IDs and harness capability result).

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to the band validator only if the new share-to-count derivation is non-obvious from the code; otherwise `None`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** none yet.
- **Deviations from plan:** none yet.
- **Follow-up implications for later sections:** § 2 assumes the regenerated corpus and the harness capability probe result; if the probe fails loudly, resolve the fixture selection with the harness owner before starting § 3.

---

## Section 2 — Seed partition helper and two-phase dispatch

### Objective

- Implement the per-TaskDefinition seed partition and orchestrate the two sender calls with one shared outcome consumer, preserving every behavioural rule in the spec.

### Constraints

- Partition runs after the existing guards; fail-fast faults: duplicate UID, missing `uidIndex` route entry, missing `taskDefinition` — messages name the offending UID.
- Seeds: first eligible request per `TaskDefinition.getId()` in generation order, one parallel `fetchAll` round with `batchSize = seeds.length`, skipped when empty; deliberately not throttled by `getBackendAssessorBatchSize()`.
- Remainder: existing `batchSize = getBackendAssessorBatchSize()`, dispatched only when non-empty; skipped entirely after a phase-1 stop.
- Shared `runStopped` across phases; never reset between them; stop semantics and terminalisation unchanged; seed non-stop failure is best-effort and phase 2 proceeds.
- Progress base message captured deliberately across both sender calls so message composition is intentional; derive per-row progress expectations from the two-phase call sequence (non-stopped total `1 + ceil(remainder/batchSize)` vs pre-change `ceil(total/batchSize)`).
- Info-level seed-round size log only; never log payloads.
- File separation: `LLMRequestManager.js` is 494 lines today; 534–574 is the pre-move projection and exceeds the 500-line gate. The partition helper moves to `src/backend/RequestHandlers/LLMSeedPhase.js`; extract the ~35-line outcome consumer into the same sibling module unless a measured post-move projection for `LLMRequestManager.js` is ≤ 500. Verify with `wc -l`; `BaseRequestManager` (334 lines) stays unchanged.
- Test-bootstrap wiring: the new sibling module is concatenated as a GAS global, so Node suites driving `processStudentResponses()` must load it through `tests/helpers/llmRequestManagerHarness.js` (exactly **500 lines** today — zero headroom under the backend `max-lines` gate) or `tests/setupGlobals.js` (449 lines). Prefer `setupGlobals.js` for the global; if the harness must change, extract a companion helper instead of growing it. Verify with `wc -l` at this section's gate.
- GAS load order: the new sibling file is concatenated by filename order — confirm no new numeric-prefix or load-order dependency is introduced (production backend uses no Node aliases).

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `@docs/plans/issue-309/SPEC.md`, `@docs/developer/backend/backend-testing.md`
- `@tests/helpers/llmRequestManagerHarness.js`, `@tests/helpers/llmRunStopHarness.js`
- `@src/backend/RequestHandlers/LLMRequestManager.js`, `@src/backend/RequestHandlers/BaseRequestManager.js`

Implementation mandatory docs:

- `@docs/plans/issue-309/SPEC.md`, `@docs/developer/backend/AssessmentFlow.md`, `@docs/developer/backend/backend-file-organisation.md`
- `@docs/developer/backend/api-layer.md`
- `@src/backend/RequestHandlers/LLMRequestManager.js`, `@src/backend/RequestHandlers/BaseRequestManager.js`

Code Reviewer mandatory docs:

- `@docs/plans/issue-309/SPEC.md`, `@docs/developer/backend/backend-testing.md`
- `@src/backend/RequestHandlers/LLMRequestManager.js`, `@src/backend/RequestHandlers/BaseRequestManager.js`

### Shared helper plan

1. Helper: seed partition (`{ seeds, remainder }`, fail-fast faults)
   - Decision: `new`
   - Owning module/path: `src/backend/RequestHandlers/LLMSeedPhase.js`
   - Call-site rationale: called once from `processStudentResponses()` after existing guards; keeps `LLMRequestManager.js` under the 500-line gate.
   - Relevant canonical doc target: `docs/developer/backend/api-layer.md` § Shared helpers; planned status `Not implemented` (entry already recorded).
2. Helper: shared batch-outcome consumer
   - Decision: `extend` (extract the existing `onBatchComplete` callback into one shared unit)
   - Owning module/path: `LLMSeedPhase.js` (preferred) or retained in `LLMRequestManager.js` only if the post-move LOC projection is ≤ 500
   - Call-site rationale: identical outcome pipeline for both phases; avoids duplicated stop/writeback logic.
   - Relevant canonical doc target: `docs/developer/backend/api-layer.md` § Shared helpers; planned status `Not implemented` (entry already recorded).

### Acceptance criteria

- All seed fault cases throw before dispatch with messages naming the offending UID.
- Phase 1 is a single `fetchAll` round of `seeds.length` requests; phase 2 uses the configured batch size and is skipped when remainder is empty or phase 1 stopped.
- Every UID is dispatched exactly once across both phases, in the preserved order; outcome handling is identical in both phases; `runStopped` is shared.
- Seed failure without a stop does not prevent phase 2; a phase-1 stop terminalises never-dispatched items exactly as today.
- Zero-request early exits and Sheets assignments are unchanged.
- An info-level log reports the seed-round size; no payload content is logged.
- `LLMRequestManager.js` is ≤ 500 lines after the helper/extraction work, and `llmRequestManagerHarness.js` stays ≤ 500 after test-bootstrap wiring.

### Required test cases (Red first)

Backend unit tests (new suite `tests/requestHandlers/llmRequestManager.seedPhase.test.js`, following the concern-split convention):

1. Partition groups by `taskDefinition.getId()`; seed is first eligible request in generation order; both arrays preserve order.
2. Partition throws on duplicate UID, missing route-map entry and missing `taskDefinition`, naming the UID in each message; no dispatch occurs on a partition fault.
3. Two sender calls in order with the expected `batchSize` values; phase 2 skipped when remainder empty; phase 2 skipped after a phase-1 stop; no phase-1 call when seeds are empty.
4. Shared `runStopped`: a seed stop prevents phase 2 and terminalises never-dispatched eligible items; a seed transient/permanent failure still allows phase 2.
5. Outcomes from both phases go through the same consumer (sort, writeback, result-cache `put`, progress, stop detection, exactly-once UID routing).
6. Progress-step counts derived from the two-phase call sequence; no accidental message composition across phases (capture base message once).
7. Zero-request early exit unchanged; Sheets path untouched.
8. The info-level seed log asserts the seed-round size fields and that no payload content appears in log output.

### Section checks

- Focused check is limited to the new suite: `npm run test:backend -- tests/requestHandlers/llmRequestManager.seedPhase.test.js`, then `npm run lint:backend:check`. Do **not** run the whole `llmRequestManager.*` glob as this section's gate: the existing suites below are expected red until § 3 migrates them.
- Expected-red inventory at the end of § 2 (recorded in `Implementation notes`): `runStop.test.js` pins `[2, 1]` call lengths; `transportCallerPolicy.test.js` has six real-generation stop rows plus three hand-built rows with no route map (partition fault now precedes dispatch); `assignmentRunIntegration.test.js` hand-builds `uidIndex` entries without `taskDefinition` and asserts single sender calls; `tests/controllers/assignmentRunCompletion.test.js`'s batch-size-2 same-batch row (`createConnectedStopRun(2)`) pins `expectedBatches = [2]` and a persisted healthy survivor, so it goes red (`[1]` and `LLM_RUN_STOPPED`). The `eligibility.test.js` unknown-UID row is **green but vacuous** post-§ 2: its dispatch proof lives inside the mock implementation, which is skipped when the partition faults before dispatch, while the outer error assertions still pass; § 3's re-expression is mandatory regardless of test colour. These outcomes are not regressions of § 2's implementation.
- §§ 2 and 3 must land as **one green unit**: after § 3, re-run the full `npm run test:backend -- tests/requestHandlers tests/controllers` before the § 4 gate and before any push or interim commit that claims feature completion.
- `wc -l src/backend/RequestHandlers/LLMRequestManager.js` ≤ 500 and `wc -l tests/helpers/llmRequestManagerHarness.js` ≤ 500; if either is exceeded, apply the extraction rules above and rerun.
- Mandatory-read evidence gate passed; docs sync outcome recorded (AssessmentFlow two-phase description, the `llmRequestManager.seedPhase.test.js` addition to `backend-testing.md`'s suite-split enumeration, api-layer helper entries still `Not implemented` until § 5); section compacted with the final helper placement and expected-red inventory retained for § 3.

### Optional `@remarks` JSDoc follow-through

- Record `@remarks` on the partition helper (why partition follows the guards, why seeds ignore the configured throttle) and on the orchestration entry (shared `runStopped` and deliberate progress-message capture). Do not add payload contents to logs or comments.

### Implementation notes / deviations / follow-up

- **Implementation notes:** none yet.
- **Deviations from plan:** none yet.
- **Follow-up implications for later sections:** § 3 pins per-row expectations from the actual two-phase sequence; § 5 reconciles both planned helper entries in `api-layer.md`.

---

## Section 3 — Test-suite migrations and harness multi-task mode

### Objective

- Migrate every inventoried suite to two-phase expectations using the regenerated corpus, with the harness supporting opt-in multi-task selection while remaining single-task by default.

### Constraints

- No realism-gate relaxation: `isRunStopTextPair` stays intact; the harness's opt-in multi-task selector is built in § 1 and consumed here only by same-batch-survivor scenarios.
- Single-task mode is pinned explicitly for 1-seed rows (batch-size-1 run-stop rows, batch-size-1 controller row, cached-stop warm-phase row).
- Exact batch patterns are derived from each row's two-phase call sequence; do not pre-pin speculative bracket patterns.
- The eligibility unknown-UID row becomes a pre-dispatch partition fault asserting no dispatch; the consumer's unknown-UID guard remains covered by `assignmentRunIntegration.test.js` mocked-sender rows.
- LOC / file separation for touched suites (all currently near or below 500): `llmRequestManager.runStop.test.js` 487, `transportCallerPolicy.test.js` 494, `assignmentRunIntegration.test.js` 495, `eligibility.test.js` 455, `assignmentRunCompletion.test.js` 399, `llmRunStopHarness.js` 329 (grown in § 1, so re-measure before migrations), and `llmRequestManagerHarness.js` 500 (zero headroom from § 2's global wiring). Migrations must stay ≤ 500 lines per file; if a suite or harness would cross 500, extract a companion suite/helper (for example `llmRequestManager.runStop.multiTask.test.js` or `llmRequestManager.transportCallerPolicy.scenarios.test.js`) rather than growing the original. Record measured post-change counts in `Implementation notes`.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `@docs/plans/issue-309/SPEC.md`, `@docs/developer/backend/backend-testing.md`
- `@tests/helpers/llmRunStopHarness.js`, `@tests/helpers/llmRequestManagerHarness.js`
- All inventoried suites listed in the spec's Testing expectations

Implementation/Code Reviewer mandatory docs:

- `@docs/plans/issue-309/SPEC.md`, `@docs/developer/backend/backend-testing.md`
- `@src/backend/RequestHandlers/LLMRequestManager.js`, `@src/backend/RequestHandlers/BaseRequestManager.js`
- All inventoried suites listed in the spec's Testing expectations

### Shared helper plan

- Harness decision: `reuse` — consume the opt-in multi-task selector added to `tests/helpers/llmRunStopHarness.js` in § 1; keep the default traversal-order selector for single-task rows. No new harness capability here; no canonical production-helper entry needed.
- No production helper changes in this section.

### Acceptance criteria

- The 12-row stop matrix, cached-stop warm phase, batch-size-1/≥2 controller rows, six real-generation `transportCallerPolicy` stop rows, hand-built route rows, `assignmentRunIntegration` mocked-sender rows and the eligibility fault row all pass with two-phase expectations.
- The same-batch-survivor scenario is re-expressed multi-task in both `runStop.test.js` and `assignmentRunCompletion.test.js`; cancelled-retryable and permanent-sibling rows stay single-task with the stop in the remainder.
- No touched test file exceeds 500 lines; companion suites are used where needed.
- All canonical fixtures used are from the regenerated corpus; no local realistic builder is introduced.
- The expected-red inventory recorded at § 2's boundary is fully cleared, so §§ 2–3 together are green.

### Required test cases (Red first)

1. `llmRequestManager.runStop.test.js`: batch-size ≥ 2 rows migrated (for example `[2,1]` → `[1,2]`); stop-at-index-0 rows now a single one-member batch with the same-batch sibling never dispatched; multi-task same-batch-survivor row with derived seed/remainder patterns.
2. `assignmentRunCompletion.test.js`: batch-size-2 same-batch row re-expressed with multi-task candidates; mixed-E counts re-derived (from § 1); cancelled-retryable/permanent-sibling rows retain single-task selection with the stop in phase 2.
3. `transportCallerPolicy.test.js`: hand-built rows supply `taskDefinition` or assert two-phase call sequence; six real-generation stop rows re-authored for a remainder (or re-authored seed-round expectations); `validates missing public LLM assignment` row verified unchanged.
4. `assignmentRunIntegration.test.js`: two hand-built-route tests supply `taskDefinition` and assert the two-phase call sequence; mocked-sender unknown-UID guard coverage retained.
5. `llmRequestManager.eligibility.test.js`: unknown-UID row re-expressed as a pre-dispatch partition fault asserting no `fetchAll`.
6. Harness: explicit single-task mode and opt-in multi-task mode tests; loud failure when candidate selection cannot find the required TEXT/numeric pairs.

### Section checks

- `npm run test:backend -- tests/requestHandlers tests/controllers` restores the full § 2 expected-red inventory to green; `npm run lint:backend:check`. This is the green-unit gate for §§ 2–3 before § 4 and before any push.
- Record post-change LOC for every touched test file and confirm ≤ 500.
- Mandatory-read evidence gate passed; docs sync outcome recorded (test-helper API note in `backend-testing.md` only if changed); section compacted with derived batch patterns retained for § 4.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to the harness's multi-task selector explaining the per-student artefact-type allocation and why the TEXT gate cannot be relaxed.

### Implementation notes / deviations / follow-up

- **Implementation notes:** none yet.
- **Deviations from plan:** none yet.
- **Follow-up implications for later sections:** § 4 runs the full gate with all migrations in place; § 5 reconciles helper entries and docs.

---

## Section 4 — Regression and contract hardening

### Objective

- Prove the complete change green under the repository's full gate and confirm no contract or shape drift.

### Constraints

- No data-shape changes were identified: no schema, persistence, API-contract or transport-shape edits; the seed partition is ephemeral. Do not add planned data-shape entries to `docs/developer/data-shapes/`.
- Do not waive, suppress or lower lint or coverage thresholds.
- Prefer focused runs before the full gate; use the documented commands only.

### Delegation mandatory reads (when sub-agents are used)

- `@docs/plans/issue-309/SPEC.md`, `@docs/developer/backend/backend-testing.md`, `@docs/developer/testing/synthetic-test-data.md`

### Shared helper plan

- No new helper decisions; reconcile any helper entries still marked `Not implemented` only after implementation is confirmed in § 5.

### Acceptance criteria

- Focused suites from §§ 1–3 pass; `npm run lint:check` and `npm run run-all-checks` pass with the regenerated corpus committed.
- Coverage thresholds remain met; no new flaky or skipped tests.
- `wc -l` confirms `LLMRequestManager.js` ≤ 500 and no touched test file > 500.
- No production payload logging, no configuration key/flag introduced, no LLM-service change.

### Required test cases/checks

1. Re-run `npm run test:backend`, `npm run test:synthetic` and (with the new budget) `npm run test:synthetic:stress`.
2. Run `npm run lint:check` and `npm run run-all-checks`; record actual outputs, including any skipped-scope reruns (`test:synthetic:coverage`) if an earlier scope fails.
3. Verify no `docs/developer/data-shapes/` file changed and no frontend file changed (`git diff --name-only`).
4. Verify the two planned helper entries in `api-layer.md` are either reconciled in § 5 or explicitly retained as `Not implemented`.

### Section checks

- All commands green; mandatory-read evidence gate passed if delegated; docs sync outcome recorded; section compacted with residual risks (data predictions, deferrals) retained for handoff.

### Optional `@remarks` JSDoc follow-through

- Confirm the `@remarks` entries planned in §§ 1–2 exist; otherwise `None`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** none yet.
- **Deviations from plan:** none yet.
- **Follow-up implications for later sections:** § 5 completes documentation and the handoff statement.

---

## Section 5 — Documentation, helper reconciliation and rollout notes

### Objective

- Bring canonical docs into line with the implemented behaviour and reconcile planned helper entries.

### Constraints

- Update only documents relevant to touched areas; same-change documentation obligation applies.
- `docs/developer/testing/synthetic-test-data.md` needs two kinds of change: the regenerated profile/band/year-group/stress data, and the planning-time edits already in the worktree (artefact formulas, per-student variation, per-count TEXT guarantee, regeneration-as-intended-response paragraph, rescale-preferred extension path). Ownership is set once: § 1's doc update carries and commits them; § 5 only verifies their presence and consistency with the regenerated data. Do not re-apply or duplicate them here.
- `.opencode/agents/planner.md` carries the separately user-authorised instruction edits; commit them with the planning artefacts, not as part of the feature's doc update.

### Delegation mandatory reads (when sub-agents are used)

- `@docs/plans/issue-309/SPEC.md`, `@docs/developer/backend/AssessmentFlow.md`, `@docs/developer/backend/api-layer.md`
- `@docs/developer/security/data-handling.md`, `@docs/developer/testing/synthetic-test-data.md`
- `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (style reference only; no frontend change)

### Shared helper plan

- Reconcile the two `Not implemented` entries in `docs/developer/backend/api-layer.md` § Shared helpers against the delivered partition helper and outcome consumer: update status/details for implemented entries; keep `Not implemented` for any still pending, with a reason in `Implementation notes`.

### Acceptance criteria

- `AssessmentFlow.md` describes the two-phase dispatch, seed semantics and added round-trip latency.
- `data-handling.md` is reviewed for a stale single-`fetchAll` batching description and updated if needed.
- `synthetic-test-data.md` reflects the regenerated corpus and includes the planning-time policy/fact edits; `vitest.config.js` comment and stress timeout are consistent with the docs.
- `api-layer.md` helper entries are reconciled; no data-shape doc changed; issue #309 is referenced in the commit/PR.
- No rollout, migration, config or reset note is needed: behaviour is always on for new runs; in-flight runs finish with the old ordering.

### Required checks

1. Verify docs mention the actual persistence/transport boundaries (unchanged) without inventing new ones.
2. Verify no new API method or endpoint is documented (none exists).
3. Confirm every section's `Implementation notes / deviations / follow-up` field is filled or explicitly marked `None`.
4. Reconcile planned shared-helper entries as described above.

### Section checks

- Docs sync outcome recorded; mandatory-read evidence gate passed if delegated; deferred-findings ledger reviewed and mirrored into `.opencode/scratchpad/detached-head-85b1199d-deferred-findings.md` before plan deletion.

### Optional `@remarks` JSDoc review

- Confirm all planned `@remarks` are present; otherwise record `None`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** none yet.
- **Deviations from plan:** none yet.
- **Follow-up implications for later sections:** handoff to the user with the deferrals listed below.

---

## Suggested implementation order

1. Section 1 — corpus regeneration and the `run-all-checks` gate (precondition; must be green before § 2).
2. Section 2 — partition helper and two-phase dispatch (helper entries already recorded as `Not implemented` in `api-layer.md`).
3. Section 3 — test-suite migrations and harness multi-task mode.
4. Section 4 — regression and contract hardening.
5. Section 5 — documentation, helper reconciliation and rollout notes.

---

## Deferred and Out-of-Scope Findings

| Finding                                                                                   | Severity    | Scope rationale                                                                                | Evidence                                                                   | Disposition | User decision                                                          |
| ----------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| Surface `cached_tokens` prompt-cache telemetry                                            | Enhancement | Requires a change in `AssessmentBot-LLM-Service`; separate repository                          | `docs/plans/issue-309/SPEC.md` Purpose and Documentation and rollout notes | approved    | User explicitly approved deferral during planning (2026-11-05)         |
| Cross-repo verification that the shared prompt prefix is invariant across item `taskType` | Assumption  | Out-of-repo follow-up; does not gate v1; under divergence v1 keeps one seed per TaskDefinition | `docs/plans/issue-309/SPEC.md` explicit assumption                         | approved    | User-approved recorded assumption; non-gating follow-up (2026-11-05)   |
| Per-task pipelined seeding (seed task t, dispatch its remainder immediately)              | Enhancement | Different product decision with a different seed-round bound                                   | `docs/plans/issue-309/SPEC.md` V1 scope recommendation                     | approved    | Deferred from v1 in the agreed spec (2026-11-05)                       |
| Configuration toggle / feature flag for seeding                                           | Scope       | Explicitly excluded — always-on reordering of existing dispatches                              | `docs/plans/issue-309/SPEC.md` Purpose, decision 8                         | approved    | User chose always-on, no configuration (2026-11-05)                    |
| Planning-time policy edits to `planner.md` and `synthetic-test-data.md`                   | Planning    | Not production behaviour; user-authorised during planning                                      | `docs/plans/issue-309/SPEC.md` worktree-provenance disclosure              | approved    | User approved edits A1–A3 and B1+B2 via the question tool (2026-11-05) |

Nitpicks are logged separately in `.opencode/scratchpad/detached-head-85b1199d-deferred-findings.md` (link for traceability). No nitpicks were logged at planning time; the orchestrating agent creates the file before recording the first row.
