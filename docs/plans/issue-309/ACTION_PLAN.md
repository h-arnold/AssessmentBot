# Feature Delivery Plan (TDD-First) — LLM request cache warming (issue #309)

## Delivery State (orchestrator bookkeeping)

- **Branch:** `feat/issue-309-cache-seeding`; starting HEAD `9157a556` (plan's `85b1199d` is stale text; `85b1199d` is an ancestor and current `origin/main` is `9157a556`).
- **Deferred-findings log:** `.opencode/scratchpad/feat-issue-309-cache-seeding-deferred-findings.md` (plan's `detached-head-85b1199d-…` path adapted to the actual branch; link updated in the deferred section below).
- **Planning-time edits:** the spec describes two "uncommitted" edits, but they are already committed in `47729c48` and present in the tree (verified: `synthetic-test-data.md` artefact/allocation text, `planner.md` bullets, `api-layer.md` helper entries). § 1 must verify their presence and must not re-apply or duplicate them.
- **Baseline gate (passed with documented debt):** session ID `feat-issue-309-cache-seeding`; report `.ts-regression-checker/reports/session-feat-issue-309-cache-seeding/baseline/baseline.txt`; overall FAILING with 7/8 checks passing; **0 regressions, 0 new failures**. The sole failing check is `backend-lint-check` with 4 pre-existing `max-lines` warnings (each an unrelated 501-line test file last touched by `4a0a3418`): `tests/backend-api/assignmentDefinitionPartials.unit.test.js`, `tests/dbManager/dbManager.test.js`, `tests/googleClassroom/classroomApiClient.test.js`, `tests/utils/batchUpdateUtility.test.js`. These are **accepted technical debt** for this plan: out of scope, untouched by the plan, and must not be "fixed" opportunistically. All other checks (frontend/builder lint, backend/frontend/builder coverage, E2E, typecheck) pass. Every section regression gate must show these same 4 warnings and no new failures.
- **Gate command (user direction, 2026-11-18):** the regression checker is the authoritative gate and runs **only once at the end of each section**; `npm run run-all-checks` is not used as a gate because it is slow and stops on the accepted baseline lint debt. Between phases use focused/section-scoped tests and lints only. (The §1 acceptance-criterion wording "run-all-checks passes" is read through this direction: the equivalent section evidence is targeted green tests/lints plus a clean section regression-gate comparison.)
- **§2+§3 combined delivery (user decision, 2026-11-18):** the plan requires §§2 and 3 to land as one green unit (§2 leaves deliberately expected-red suites that §3 migrates). Keep separate RED/GREEN loops and separate plan-section records, but run **one authoritative regression gate and one combined commit after §3**. §2 records its expected-red inventory in Implementation notes and has no standalone clean gate. Do not push an interim commit that claims feature completion before §3 lands.

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

### Outcome (compacted)

- Regenerated the canonical synthetic corpus, re-pinned committed fixtures and re-derived every consuming expectation, then proved the repository green before LLM migration. All §1 checks pass and the final regression gate re-run is clean: 0 regressions, 0 new failures, 7/8 checks (the only failing check is the 4 accepted baseline `max-lines` warnings). The first gate run's 10 stale frontend corpus pins were reworked into corpus-regeneration-independent tests rather than re-pinned; gate reports and remediation detail are in **Implementation notes / deviations / follow-up**.

### Retained for later sections

- **Corpus shape (assumed by §§2–4):** tasks per definition `small` 4 / `medium` 6 / `large-representative` 10 / `large-full` 15, `ARTEFACT_BODY_TYPES` cycle unchanged (≥2 TEXT tasks only at 6/10/15). `large-full` on demand/uncommitted: 8 year groups (YG 7–14), 48 classes (6 per YG), 50 assignments/class, 30 students/class (~1.08M items). Bands over 50 indices `[0,3)/[3,8)/[8,43)/[43,50)` → 3/5/35/7 per class (shares 6/10/70/14); `LARGE_FULL_COMPLETION_BANDS` sharePercent, the `assertCompletionBands` count derivation and the band docs move as one.
- **Commands and paths:** regenerate committed profiles only with `npm run fixtures:synthetic` (never hand-edit JSON); `syntheticCommittedFixtureRegeneration.test.ts` re-pins committed bytes. Validate with `npm run test:synthetic` and `npm run test:synthetic:stress`. Generators: `profileDefinitions.js`, `generateAssignmentDefinitions.js`, `resolveSubmissionCount.js`, `validateProfileInvariants.js`, `generateSyntheticAnalysisFixtures.js`, `fixtureWriter.js` (stream/chunk fallback). No file separation needed (all well under 500 lines); `vitest.config.js` stress `testTimeout` is 120,000 ms with the stale comment updated.
- **Stress requirement:** `NODE_OPTIONS="--max-old-space-size=8192 --expose-gc"` (~8 GB heap plus GC; Node's default heap is too low), 120 s timeout, and the `fixtureWriter.js` streaming fallback for the ~1.2 GB `assignmentsByKey.json`; recorded in `synthetic-test-data.md` and the `test:synthetic:stress` script.
- **Harness interface (§3 consumes):** `tests/helpers/llmRunStopHarness.js` exports `createRunStopAssignment(profile, numericCount, { selectionMode })` (single-task default) and `createMultiTaskRunStopAssignment(profile, numericCount)` (opt-in multi-task); the TEXT/numeric realism gate is intact. Decision: `extend` (test helper, no production canonical-helper entry), generator internals local. Multi-task hosts are `assignment-0-1` / `assignment-0-3`; the capability probe passes.
- **Re-derived pins for later sections:** `assignment-0-4` mixed-E row = 30 items / 12 E / 18 non-E (§3 reuses the 12/18 pin); §3 consumes the harness selector and the probe result.
- **Corpus-fixture rule (full text in Implementation notes and `docs/developer/testing/synthetic-test-data.md`):** new and newly touched tests draw fixtures from the shared corpus (`@synthetic/*` raw imports, canonical loaders/harnesses), never inline literals; expectations derive from the data shape, never pinned to corpus-derived literals. Two exceptions: realism gap (local realistic fixture plus a generator/corpus plan) and algorithmic boundary (minimal local input plus inline justification).
- **Frontend spec rewrite pattern:** derive expected keys from the composed input (Pattern A) or use an independent oracle over the raw committed corpus view (Pattern B, `deriveCorpusBaseline()` with the `isAttemptItem` predicate); never pinned task-key lists or counts; fixture preconditions use a structural guard, not exact regenerated keys.
- **Data shapes / scope:** none added or changed — no schema, persistence, API or transport change, no new profile or view, no realism-gate relaxation.
- **Outstanding @remarks:** §1 band-validator share-to-count derivation note if non-obvious from code (otherwise `None`); §§2–5 @remarks items remain in their own sections.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - RED phase complete and reviewed clean after three rounds (`review-s1-red-issue-309.md`, `-r2.md`, `-r3.md`): 5 required cases encoded; 3 in-scope Nitpicks fixed (harness default parameter, `editableDefinitions.json` byte-for-byte pin, import route).
  - GREEN milestone 1 delivered: profile/generator/band/validator changes, stress timeout 30,000→120,000 ms and stale comment, harness opt-in multi-task selector, and CLI regeneration of 13 committed JSON paths. `npm run fixtures:synthetic`, `npm run test:synthetic` (56 files / 778 tests), the harness capability + mixed-E backend tests (2 files / 13 tests), synthetic/builder lint all PASS; backend lint shows only the 4 accepted baseline warnings.
  - **Stress blocker (in-scope surface expansion):** the mandated rescale (48×50×30×15 = 1.08M items) makes `assignmentsByKey.json` ~1.2 GB; `fixtureWriter.js::serialiseView` builds one `JSON.stringify` string and exceeds V8's max string length (`RangeError: Invalid string length`). 2 of 17 stress tests fail; without heap flags a worker also SIGABRTs. `fixtureWriter.js` was NOT in the plan's named file list, but this is a defect introduced by this section's own diff and blocks the acceptance criterion "stress project passes" — scope test criterion 1 and 2 both apply. The §1 GREEN authorised surface is expanded to include `scripts/synthetic-test-data/fixtureWriter.js` (stream/chunk serialisation, preserve committed bytes and staged-write safety) and `package.json` (record the stress heap requirement in the `test:synthetic:stress` script). Excluding the write-safety pair or revisiting the rescale was rejected as gate relaxation / a user-approved product change.
  - **Heap/RAM observations for docs:** Node v24.22.3 default heap 2,240 MB is too low; `NODE_OPTIONS="--max-old-space-size=8192 --expose-gc"` makes the generation-heavy stress files pass (`syntheticFullLargeProfile.test.ts` 12/12 in ~114 s, `syntheticClassMetadataFullLarge.test.ts` 3/3 in ~54 s), full parallel stress 15/17 in ~162 s. Machine 15 GiB total / ~10 GiB available. Docs agent must record the 8 GB / `--expose-gc` requirement in `synthetic-test-data.md`.
- **Deviations from plan:**
  - `tests/synthetic-analysis/syntheticGraphValidation.test.ts`: `UNIT_BANDS` `sharePercent` 1→25 for a 4-assignment class, encoding the mandated share-to-count derivation (1 of 4 = 25%). Test not in the original RED inventory but required by the section's validator contract change.
  - `tests/helpers/llmRunStopHarness.js`: beyond the stub replacement, added a shared distinct-student collector (the regenerated corpus gives each student 2 TEXT items, so first-N traversal tripped the existing duplicate-student guard in both modes) and exposed `getType()` as a non-enumerable `type` field on restored fixture artefacts for the RED probe's `.type` assertions. Realism gates, default single-task mode and serialisation unchanged. Needs Code Reviewer confirmation.
- **Follow-up implications for later sections:** § 2 assumes the regenerated corpus and the harness capability probe result; the probe now passes and the multi-task hosts are `assignment-0-1`/`assignment-0-3`. § 3 consumes the harness selector and the re-derived `assignment-0-4` 12/18 pin.
  - **Docs sync outcome:** `docs/developer/testing/synthetic-test-data.md` reconciled with the regenerated corpus (profile table/bands/year groups/large-full numbers, stress timeout and 8 GB `--expose-gc` requirement, streaming-fallback note); planning-time edits verified present and not duplicated. `docs/developer/backend/backend-testing.md` gained the multi-task harness API note and the re-derived 12-E/36-criteria count. No new pages; no data-shape doc changed.
  - **Both recorded deviations accepted** by the GREEN review (`review-s1-green-issue-309.md`); the "Needs Code Reviewer confirmation" wording above is satisfied.
  - **Plan compaction:** § 1 was compacted from 91 to 47 lines before the first gate; the body was restored verbatim for the § 2.6 gate-failure rework and re-compacted after the passing gate to 40 lines from 99 (fresh pre-compaction backup retained at `feat-issue-309-cache-seeding-section-1-pre-compaction.md`). Retained detail and the authoritative Implementation notes were verified intact.
  - **Section regression gate — FAILED (first run):** report `.ts-regression-checker/reports/session-feat-issue-309-cache-seeding/runs/2026-11-18T18-41-56.663Z/comparison.txt`; overall FAILING, 6/8 checks, 0 fixes. `backend-lint-check` shows only the 4 accepted baseline `max-lines` warnings. `frontend-test-coverage-check` has 10 regressions / 10 new failures — all stale corpus-pinned expectations from the regeneration (task-key lists 2→4, baseline counts 7→19 / 9→25, outside-baseline pairs 2→6). Evidence in `.opencode/scratchpad/s1-frontend-failures.txt`. These are in-scope (criterion 2) and must be made corpus-independent before § 1 closes; no assertion may be weakened or skipped.
  - **Frontend test rework (gate-failure remediation):** the 10 failing specs were made corpus-regeneration-independent rather than re-pinned. Files 1–3 derive expected task keys from the composed input; `classDetailService.spec.ts` uses a destructure-and-falsy structural guard (a literal `2` would trip `no-magic-numbers`); `dataAnalysis.mediumBaselineRoundTrip.spec.ts` replaces all pinned counts/key lists with `deriveCorpusBaseline()`, an independent oracle over the raw committed view using the unchanged `isAttemptItem` predicate. No assertion weakened, no production code changed. Targeted 5 specs 55/55, full frontend project 330 files / 3212 tests, lint/typed gates clean. The one leftover count pin found by review (`EXPECTED_ERROR_ROSTER_PARTICIPATION = 5`) was replaced with `toBeGreaterThan(0)` invariants; final Code Reviewer re-review PASS (`review-s1-testrework-rereview-issue-309.md`, full coverage 330 files / 3212 tests, 95.84% stmts, exit 0).
  - **User-directed rule (2026-11-18), added to this section's change surface:** (a) New tests, and any newly touched test, must draw fixture data from the shared synthetic corpus (`@synthetic/*` raw imports, canonical loaders or harnesses) rather than hard-coding fixture literals inline — the corpus is the single source of truth for data shapes, so corpus-backed tests stay current on regeneration and fail only when production needs to handle a new shape. Existing hard-coded fixtures are tolerated only until their test is touched, then ported in the same change. A genuine boundary case the corpus cannot express may use a minimal local input with an inline justification. (b) Expectations must be derived from the data shape (expected keys from the composed input, or an independent oracle over the raw corpus view), never pinned to corpus-derived literals (task-key lists, counts, exact-key fixture preconditions), because such pins break on every regeneration without signalling a production defect. A derived expectation must be independent of the production path under test, or the test becomes self-fulfilling. The Docs agent codifies this in the Testing Specialist instructions, the testing docs and a single enforcement checklist item in the Code Reviewer instructions, and adds a reusable inventory of corpus-derived assertion helpers plus two copyable patterns (derive-from-composed-input; independent raw-corpus oracle) to `docs/developer/testing/synthetic-test-data.md`; this is a user-authorised expansion beyond the original § 1 file list. Two distinct exceptions are retained and documented: a realism gap (local realistic fixture plus a generator/corpus plan) and an algorithmic boundary (minimal local input plus inline justification).
  - **Rule-codification docs outcome:** the user-directed rule was written into `.opencode/agents/testing-specialist.md`, `.opencode/agents/code-reviewer.md` (one enforcement checklist item), `docs/developer/testing/synthetic-test-data.md` (full rule + verified helper inventory + two patterns + two-exception distinction), `docs/developer/frontend/frontend-testing.md` and `docs/developer/backend/backend-testing.md` (brief pointers). All Prettier-clean; no new pages; ACTION_PLAN.md and spec/test files untouched by the Docs agent. The unrelated pre-existing typo "documenation" in `code-reviewer.md` line 331 was recorded as a disregarded nitpick in the deferred log, not fixed.
  - **Section regression gate — RE-RUN PASSED (supersedes the failed first run):** report `.ts-regression-checker/reports/session-feat-issue-309-cache-seeding/runs/2026-11-18T19-58-45.530Z/comparison.txt`; overall FAILING **only** because of the 4 accepted baseline `max-lines` warnings in the same unrelated test files. **Regressions Count: 0, New Failures Count: 0, Fixes Count: 0**; 7/8 checks pass, including `frontend-test-coverage-check`, `frontend-e2e-check` and `typescript-compile-check`. §1 is clean for progression.

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

Nitpicks are logged separately in `.opencode/scratchpad/feat-issue-309-cache-seeding-deferred-findings.md` (link for traceability; path adapted from the plan's stale `detached-head-85b1199d-…` name to the actual branch). No nitpicks were logged at planning time; the orchestrating agent creates the file before recording the first row. The 4 pre-existing `max-lines` baseline warnings are recorded there as accepted technical debt (see Delivery State above).
