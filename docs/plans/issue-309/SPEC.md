# LLM request cache warming (seed phase) Specification

## Status

- v1.3 — revised after Planner Reviewer pass 4: corpus-regeneration blast radius recorded (corpus-wide re-derivation and an `npm run run-all-checks` gate after regeneration, before the LLM migrations); generator-arithmetic claims corrected (compact definitions carry at most one TEXT task today; the ≥ 2 TEXT guarantee holds only at 6/10/15 tasks); `assertCompletionBands` derivation stated explicitly; seed-round throttle assumption recorded; partition-helper placement aligned with the file-separation decision; the eligibility unknown-UID row reclassified; harness selection pinned per row group; `transportCallerPolicy` row count corrected.
- v1.4 — revised after Planner Reviewer pass 5: v1 scope includes the corpus-regeneration workstream; `synthetic-test-data.md` sweep widened to task-count-dependent statements; `BaseRequestManager` recorded as definitively unchanged; wording nits (run-stop batch-pattern phrasing, mixed-E assertion rendering, consuming-suite count, Placement parenthetical) resolved.
- v1.5 — revised after Planner Reviewer pass 6: the 500-line backend `max-lines` zero-warning lint gate recorded as the binding file-separation constraint (550 facade ceiling; 534–574 is the pre-move projection; consumer move is the lever); the prompt-structure assumption extended to item-`taskType` divergence; mixed-E second assertion flag corrected to `stored, false` in both cross-references; `synthetic-test-data.md` sweep parenthetical corrected to the document's current state.
- v1.6 — re-grounded after pulling `origin/main` (85b1199d): the shared-helper `Not implemented` entries now target `docs/developer/backend/api-layer.md` § Shared helpers, since `AssessmentFlow.md` no longer carries a Shared Helper Status section. Re-checked that `LLMRequestManager.js` is still 494 lines and that the named harnesses, suites and doc paths still exist on main.
- v1.7 — revised after Planner Reviewer pass 7: worktree-provenance of the uncommitted `synthetic-test-data.md` and `planner.md` edits disclosed, and the doc sweep restated against main's actual content; pre-commit hook correctly recorded as having no warning budget; cross-repo prompt verification recorded as a non-gating follow-up; shared-helper entries name the owning layer; harness-selection tense corrected; 550-line parenthetical simplified.
- v1.8 — revised after Planner Reviewer pass 8: progress composition now states the seed round always adds exactly one batch-completion increment, with the total matching pre-change only when the remainder drops below a batch boundary; per-row expectations derive from the two-phase call sequence.
- v1.9 — revised after Planner Reviewer pass 9: progress-composition gloss corrected to the verified arithmetic (`1 + ceil(remainder/batchSize)` vs `ceil(total/batchSize)`, including the at-or-below-boundary match case and the small-test-batch case where the total falls below pre-change).
- v1.10 — revised after Planner Reviewer pass 10: "extra" removed from the seed round's own step increment; the total formula scoped to non-stopped runs.
- v1.11 — final wording fix after Planner Reviewer pass 11: the batch-boundary-bridging difference characterisation was falsifiable inside the feature's own test parameter space and was removed; the two verified formulae and the derive-from-the-call-sequence instruction stand.

## Purpose

This document defines the intended behaviour for eliminating the LLM provider KV-cache stampede observed during assessment runs (GitHub issue #309).

The feature will be used to:

- Ensure the shared prompt prefix (`reference` + `template`) for every task being assessed is present in the LLM provider's prompt cache before the large parallel batch of student submissions is dispatched.
- Improve the effective prompt-cache hit rate of the default Mistral model (currently around 50%), reducing input-token cost and prefill latency for the uncached suffix (`studentResponse`).
- Keep the existing assessment throughput (parallel dispatch in batches) while removing the first-request race.

This feature is **not** intended to:

- Change which submissions are assessed, what prompts contain, or how responses are validated and written back.
- Add any user-visible configuration or setting.
- Change the Google Apps Script `CacheManager` (six-hour result cache) in any way.
- Implement prompt-cache telemetry (for example surfacing `cached_tokens` from the LLM service). That is a separate-repository follow-up and is explicitly deferred with the user's approval; it is out of scope.
- Change the LLM provider, model, or request payload shape.

Explicit assumption (recorded per review): the prompt structure inside the out-of-scope `AssessmentBot-LLM-Service` places the shared prefix (system prompt, `reference`, `template`) ahead of the variable `studentResponse`, so provider prefix caching can reuse blocks 64+ tokens. If that ordering is wrong, this change yields no cache benefit regardless of client-side batching; verification lives in that repository. In addition, the shared prefix is assumed identical across items of one task regardless of the item's `taskType`: TEXT and IMAGE items of the same task are both LLM-eligible with different `taskType` payload fields, and if the service varies its prompt preamble by `taskType`, strict-prefix caching would reuse nothing after the type-induced divergence — a seed would then warm only same-type items of that task. The cross-repo verification is expected to confirm which case holds. That verification is a follow-up in the other repository and does not gate v1: if divergence is confirmed, v1 still keeps decision 2 (one seed per TaskDefinition), and per-(task, `taskType`) seeding would be a separate, user-approved design change with a different seed-round bound.

## Agreed product decisions

1. The dispatch pipeline for LLM requests gains a two-phase structure inside a single assessment run: a **seed phase** followed by the existing **remainder phase**.
2. The seed phase dispatches exactly one seed request per TaskDefinition that has at least one to-send (non-cached, non-not-attempted, non-terminalised) request in this run.
3. The seed request for a task is the first eligible request for that task in the existing generation order (submission-major, then item, as produced by `LLMRequestManager.generateRequestObjects()`). No content-based seed selection is applied.
4. All seed requests are dispatched together in a single parallel round (`UrlFetchApp.fetchAll`), because seeds for different tasks share no prefix with each other. Sequential seeding is explicitly rejected. The seed round's size is the number of distinct TaskDefinitions with to-send requests in one run — bounded by the assignment's task count (≤ 15 in the regenerated corpus, the school-typical large-assignment ceiling) — and is deliberately dispatched as one round without consulting the configured `backendAssessorBatchSize` throttle (default 120, valid range 1–500, whose purpose is avoiding bandwidth-exceeded errors, not a fairness constraint). This priority of the single parallel round over the throttle in the pathological case of a very small configured batch size is a recorded, deliberate assumption; if that assumption ever stops holding (a run carrying far more tasks than the throttle), the seed round revisits it rather than dispatching unboundedly.
5. Phase 2 dispatches the remaining requests through the existing, unchanged batching path (`sendRequestsInBatches` with `backendAssessorBatchSize`).
6. Seed outcomes are processed exactly like any batch outcome: the same assigned/cached writeback, the same error mapping, the same stop-status behaviour, and the same result-cache `put`. Seeds are real assessments pulled forward in time; there is no duplicate dispatch of any UID.
7. Seed failure is best-effort: a seed that fails or errors means only that its prefix is not warm for phase 2 — phase 2 proceeds unchanged. Only a stop-status response (401, 403, 404) in the seed phase halts the run, consistent with existing stop semantics (no phase 2 dispatch; never-dispatched items are terminalised as `LLM_RUN_STOPPED`).
8. Cache seeding is always on. There is no configuration key, schema, frontend setting, or feature flag. It is a reordering of dispatches already made, not new behaviour.
9. A TaskDefinition with zero to-send requests in this run (for example every submission hit the result cache, was not attempted, or was skipped) receives no seed.
10. The remainder phase preserves the existing relative order of requests. Seeds are removed from the remainder; every eligible UID is dispatched exactly once across the two phases.
11. `runStopped` state is shared across both phases: a stop in the seed phase prevents the remainder phase from dispatching; cache checks and not-attempted handling are unaffected (they never produce requests).
12. No data shapes, validation schemas, persistence models, API contracts or transport shapes change. The LLM request payload is unchanged.

## Existing system constraints

### Backend constraints already in place

- LLM dispatch: `LLMRequestManager.generateRequestObjects()` builds the flat request array; `processStudentResponses()` hands it to `BaseRequestManager.sendRequestsInBatches()` with `batchSize = getBackendAssessorBatchSize()` (default 120), accepted statuses `[200, 201]`, stop statuses `[401, 403, 404]`.
- Batches are sequential; requests inside a batch are fully parallel via `UrlFetchApp.fetchAll` (`BaseRequestManager._dispatchBatch()`).
- Retries live in the transport layer (`DEFAULT_MAX_ATTEMPTS = 3`, backoff `5000 * 1.5^(n-1)` ms, retryable = 429/5xx/network) and are never re-batched.
- The run executes inside a time-based trigger (`processSelectedAssignment`); added latency must stay within the Apps Script execution limit. The seed phase adds one LLM round-trip.
- The route map (`uidIndex`) already carries `taskDefinition` per UID, so per-task partitioning requires no new data.
- `assessResponses()` early-exits on zero generated requests and `processStudentResponses()` early-returns on an empty request array; seeding must not change those paths.
- Sheets assignments do not use the LLM path (`SheetsAssessor`); they are unaffected.

### Current data-shape constraints

- Request object shape dispatched to `UrlFetchApp.fetchAll`: `{ uid, url, method, contentType, payload, headers, muteHttpExceptions }` with payload `{ taskType, reference, template, studentResponse }`. Unchanged.
- Task identity derives from `TaskDefinition.getId()` (`'t_' + hash(title+pageId)`). Seed grouping keys off this identity.
- The request UID is the student artefact's UID, derived as `taskId-taskIndex-role-pageId-artifactIndex`. Cross-student uniqueness comes from per-student page IDs; the manager enforces uniqueness loudly with a duplicate-UID throw at generation time. Unchanged.

### Frontend or consumer architecture constraints

- None. There is no frontend surface for this change.

## Domain and contract recommendations

### Why this approach is preferable

- Fixes the root cause (first request per prefix hasn't finished prefill when the parallel batch starts) rather than mitigating it (smaller batches, serialisation, or ordering alone cannot help a single `fetchAll` round).
- Adds no new wire format, configuration, or user-visible behaviour; it is an internal re-ordering of existing dispatches.
- Reuses the existing dispatch, retry, outcome-processing and writeback machinery for seeds, so stop semantics, caching and error mapping stay consistent between phases.
- A pure per-task pipeline (seed task t, then dispatch task t's remainder before task t+1) was considered and rejected: it serialises phases for a marginal benefit over one parallel seed round and complicates the existing batch loop.

### Recommended data shapes

No shape changes. The only new internal concept is the **seed partition**: a split of the generated request array into `seeds` (first eligible request per task identity) and `remainder` (everything else), derived deterministically from the existing array and `uidIndex`. It is an ephemeral local structure, never persisted or transported.

### Naming recommendation

Prefer:

- `seedRequests` / `seed` / `seedPhase` for the cache-populating subset and phase
- `remainderRequests` / `remainderPhase` for the rest

Avoid:

- `warmUp`, `preflight`, `priming` — the doc term elsewhere is "cache warming / seed"; keep one vocabulary ("seed") to match the issue.

### Validation recommendation

#### Frontend

None.

#### Backend

- The seed partition must fail loudly on internal wiring faults (duplicate UID, missing route-map entry, missing TaskDefinition), consistent with existing fail-fast behaviour; it must not silently degrade seeding into a plain single-phase dispatch.
- No new input validation is needed at any boundary; this change adds no external inputs.

### Display-resolution recommendation

None.

## Feature architecture

### Placement

- All changes live in the backend request-handler layer: `src/backend/RequestHandlers/LLMRequestManager.js` (partitioning call sites, phase orchestration; shared outcome handling — final placement per Planning handoff notes) and a dedicated sibling module in the same folder that owns the seed partition helper (see Planning handoff notes). `BaseRequestManager` is unchanged: phase 1 reuses `sendRequestsInBatches` with `batchSize = seeds.length` (always ≥ 1 by the phase-1 invocation rule).
- `AssignmentController`, triggers, z_Api, frontend and configuration are untouched.

### Proposed high-level tree

```text
LLMRequestManager.processStudentResponses(requests, assignment)
├── existing guards (empty check, requireParams, duplicate-UID rejection) — unchanged, partition runs after them
├── partition(requests)                  # seeds | remainder, keyed off uidIndex[].taskDefinition
├── phase 1: sendRequestsInBatches(seeds, …)   # one parallel round, batchSize = seeds.length; skipped when seeds empty
│   └── shared outcome consumer (same as today)
├── phase 2: sendRequestsInBatches(remainder, …)   # skipped when remainder empty or after a phase 1 stop
│   └── shared outcome consumer (same as today)
└── runStopped shared across phases; existing terminalise path covers both
```

The partition runs after the existing input guards, preserving today's invalid-input error precedence (an invalid caller never reaches partition).

### Out of scope for this surface

- Image (`ImageManager`) dispatch ordering and batching.
- Cross-run or cross-trigger seed coordination.
- Any change to the LLM service repository.
- Result-cache (`CacheManager`) behaviour, TTL, or key format.

## Data loading and orchestration

### Required datasets or dependencies

- The generated request array and the `uidIndex` route map from `generateRequestObjects()`.

### Prefetch or initialisation policy

Not applicable; this is an execution-ordering concern inside a single run.

### Query or transport additions

- No new endpoints, keys or transport changes. Phase 1 uses the same `/v1/assessor` endpoint, auth, and headers.

## Core behavioural model

### Suggested shape

```js
{
  seeds: Object[],            // first eligible request per taskDefinition id, generation order
  remainder: Object[],        // all other eligible requests, original relative order
}
```

### Derivation rules

#### Partition rule

- Iterate the generated requests in order; for each, look up `uidIndex[request.uid].taskDefinition`. The first request seen per `taskDefinition.getId()` goes to `seeds`; all others go to `remainder`.
- Both arrays preserve generation order.

#### Dispatch rule

- If `seeds` is non-empty, dispatch them before any remainder request, as one `sendRequestsInBatches` call with `batchSize = seeds.length` (a single parallel round). The seed round is not subject to the configured `backendAssessorBatchSize` throttle by design (see Agreed product decisions, item 4); seeds are bounded by the assignment's task count.
- Dispatch the remainder with the existing `batchSize = getBackendAssessorBatchSize()`, in a `sendRequestsInBatches` call made only when `remainder` is non-empty; an empty remainder invokes the sender zero times.
- Phase 2 is skipped entirely after a stop-status outcome in phase 1.

Symmetry rule: phase 1 is invoked only when `seeds` is non-empty; phase 2 is invoked only when `remainder` is non-empty. A perfectly uniform run (every to-send task has exactly one request) performs exactly one sender call, like today, with identical request contents.

#### Outcome-processing rule

- Seed outcomes feed the identical consumer used for remainder batch outcomes (sort accepted-first, assign/cache/terminalise, progress update, stop-status detection, `runStopped`).
- The consumer is implemented once and shared; it is not duplicated between phases.

### Sort order or priority rules

1. Seeds, in generation order.
2. Remainder, in generation order.
3. UIDs appear exactly once across both phases (enforced by construction; duplicates across phases are an internal wiring fault).

## Workflow specification

## Assessment run with cache seeding

### Eligible inputs or preconditions

- An assessment run reached `Assignment.assessResponses()` and `generateRequestObjects()` returned at least one request.
- Ineligible items (SPREADSHEET tasks, missing reference/template, terminal prior error, not-attempted, result-cache hit) never appear in either phase.

### Behaviour

- Phase 1 dispatches seeds in a single parallel round and waits for outcomes.
- Outcomes are processed: validated numeric results are assigned to items and written to the result cache; stop statuses set `runStopped` and prevent phase 2; transient failures follow existing retry-then-terminalise rules.
- Phase 2 dispatches the remainder in existing batches. Outcomes are processed identically.
- If a seed fails without a stop-status: the run continues; the remainder for that task simply dispatches without a warm prefix (identical to the pre-change behaviour).
- If zero requests were generated (all cache hits / not attempted): no phase 1 call is made; behaviour identical to today.
- Never-dispatched eligible items after a stop in either phase are terminalised `LLM_RUN_STOPPED` exactly as today.

### Success rule

- Every dispatched UID routes to exactly one outcome, which is assigned and (when valid and numeric) cached, identical to the pre-change pipeline. The only observable differences are dispatch order and the added round-trip latency.

### Failure rule

- Seed-phase stop-status → no phase 2; shared terminalise path as today.
- Seed-phase transient/permanent non-stop failure → that outcome terminalises per existing rules; the rest of the run proceeds.
- Internal wiring fault (duplicate UID, unknown outcome UID, missing route entry) → throws, as today.

## Error, loading, and empty-state rules

### Blocking failure

- A stop-status response in either phase blocks phase 2 only (seed phase is by definition first). The user sees the existing run-stop behaviour; no new user-facing state is introduced.

### Partial-load or partial-success failure

- Individual seed or remainder failures are recorded per item per the existing error model (`LLM_HTTP_FAILED`, `LLM_UNAVAILABLE`); the run continues for unaffected items/tasks.

### Empty states

#### No seeds (zero eligible requests)

- Phase 1 is not dispatched; behaviour identical to the current cache-hit/not-attempted early exit.

#### Remainder empty

- Phase 2 is not invoked; the run ends after phase 1 outcome processing. (Single-task, single-request runs are exactly this shape.)

## Accessibility and usability notes

None; no frontend surface changes.

## Backend changes required to support agreed behaviour

1. Partition the generated request array by task identity before dispatch (new helper in a dedicated sibling module under `src/backend/RequestHandlers/`, keyed off `uidIndex[].taskDefinition.getId()`; `LLMRequestManager.js` calls it).
2. Refactor the `onBatchComplete` outcome consumer in `processStudentResponses()` into a single shared unit used by both phases; keep the existing accepted-first sort, stop detection, `runStopped` handling and exactly-once UID routing checks.
3. Orchestrate two `sendRequestsInBatches` calls: seeds with `batchSize = seeds.length` (deliberately not throttled by `getBackendAssessorBatchSize()`; see Agreed product decisions, item 4), remainder with `batchSize = getBackendAssessorBatchSize()`; share `runStopped` across both; skip phase 2 after a phase 1 stop.
4. Logging: at info level, report the seed-round size (for example `Seeded N task prefixes before dispatching M requests`); do not log payload contents.

## Planning handoff notes

- Ordering or dependency rule that comes directly from the agreed contract: phase 1 must complete (dispatch + outcome processing) before phase 2 dispatches; outcome processing is shared, run termination state spans both phases.
- The `runStopped` flag must not be reset between phases.
- Phase 2 is invoked only when the remainder is non-empty; an empty remainder means a single sender call total.
- File separation is planned, not conditional, and the binding constraint is the zero-warning backend lint gate: `eslint.config.js` sets `max-lines` at 500 for `src/backend/**/*.js`, and `lint:backend:check` runs with `--max-warnings 0` wired into `lint:check` and `run-all-checks` (the pre-commit hook lints staged files with `--fix` and enforces no warning budget, so it does not catch a `max-lines` breach) — so the post-change `LLMRequestManager.js` must land at or under **500 lines**. (The 550-line facade-folder decomposition trigger in `docs/developer/backend/backend-file-organisation.md` is not the target here.) `LLMRequestManager.js` is 494 lines today; the projection of roughly 534–574 is the pre-move estimate, with the seed partition helper extracted to a dedicated sibling module (for example `LLMSeedPhase.js`). The helper move — plus, if needed, extracting the ~35-line shared outcome consumer — are the levers that satisfy the gate. The action plan states the final placement of the shared outcome consumer (same sibling module, or retained locally in `LLMRequestManager.js` only if the recorded post-move projection lands at or under 500) with the current and projected LOC counts.
- Shared-helper planning gate: the action plan must record the partition helper and the shared outcome consumer as planned `Not implemented` entries in `docs/developer/backend/api-layer.md`'s "Shared helpers" section (the backend canonical helper map on current main; `AssessmentFlow.md` no longer carries a Shared Helper Status section), naming the owning layer (`src/backend/RequestHandlers/`) explicitly because that section is otherwise z_Api-scoped, and reconciling the entries during the documentation pass.
- Progress composition across phases: `sendRequestsInBatches()` captures `progressTracker.getCurrentProgress().message` at call time and appends "Sending batch X of Y"; the shared LLM callback calls `updateProgress('Double-checking all assessments.', true)` per completed batch, which replaces the message and increments the step counter. With two sequential sender calls, phase 2 composes onto the phase-1 exit message. The seed round itself contributes exactly one batch-completion callback and one `updateProgress(..., true)` step increment. In a non-stopped run, the two-phase total is `1 + ceil(remainder/batchSize)` against the pre-change `ceil(total/batchSize)`; no further difference characterisation is recorded, because the relation depends on both the seed count and the remainder's alignment, so do not shortcut the derivation. Per-row progress expectations must be derived from the two-phase call sequence rather than copied from pre-change batch counts. The action plan must handle this deliberately (for example capture the base message once across both phases) rather than letting it compose accidentally.
- Planning-time worktree edits (uncommitted, disclosed for the action plan): during this feature's planning the user explicitly authorised, via the question tool, two edits that are not yet committed. `docs/developer/testing/synthetic-test-data.md` (14 added lines) adds the artefact-type allocation formulas and per-count TEXT guarantee, the "regeneration is the intended response" policy paragraph, and the rescale/measurement-anchored/user-cost extension path; this file is already in this feature's same-change doc update, so those edits ride with that update. `.opencode/agents/planner.md` (two bullets) broadens item 12 and the §6 handoff note from a "generator-extension plan" to a generator-or-corpus plan (rescale preferred, no realism-gate relaxation, measurement-anchoring, user sign-off on committed-byte churn); this is a user-authorised planner-instruction policy change to be committed separately from the feature, alongside the planning artefacts. `planner-reviewer.md` has been restored to main's model config and is clean. The action plan must not treat these worktree edits as part of main's baseline: verify that the `synthetic-test-data.md` edits land in this feature's doc update, and neither discard nor duplicate them.
- No data-shape doc changes are required; there is no schema, persistence, API-contract or transport-shape change. `docs/developer/backend/AssessmentFlow.md` must be updated in the same change to describe the two-phase dispatch. `docs/developer/security/data-handling.md` should be reviewed for any statement that becomes stale (single parallel `fetchAll` batching description). `docs/developer/testing/synthetic-test-data.md` must be regenerated/updated in the same change to match the corpus regeneration — profile table, completion bands, year-group coverage, on-demand large-full numbers, the stress-suite note, and the artefact-body-type description (which on main only says the builders cycle TEXT/IMAGE/SPREADSHEET using "their existing deterministic index arithmetic": the two allocation formulae, the per-student item-type variation and the task-count-dependent TEXT guarantee must be **added** here, not merely re-swept) — and is treated as a sweep of count- and task-count-dependent statements generally, not as an exhaustive enumeration. The synthetic-analysis stress project timeout must be re-budgeted empirically during implementation; if the re-budget exceeds ~120,000 ms or requires a heap flag, that requirement and rationale are recorded in `synthetic-test-data.md`.
- No frontend layout spec is required: no frontend structure, workflow or visible surface changes.

## Testing expectations

Fail-fast is mandatory: the seed partition throws on internal wiring faults (duplicate UID, missing route-map entry, missing TaskDefinition). Existing tests that hand-build route entries without `taskDefinition` bypass generation and must be migrated to supply one (or use real generation); they cannot remain unchanged. The honest migration inventory:

- **Pass unchanged:** `llmRequestManager.outcomes/.failures/.cache/.cacheValidation/.provenance.test.js`, `baseRequestManager.*` (direct `BaseRequestManager` suites; no LLM generation), `tests/controllers/assignmentRunCompletion.llmOutcomes.test.js` (single request per dispatch), and `llmRequestManager.eligibility.test.js` except the one row noted below.
- **Coincidentally passing, expected to need review:** `llmRequestManager.runStop.test.js` rows with batch size 1 and the batch-size-1 row of `tests/controllers/assignmentRunCompletion.test.js`. These rows rely on a 1-seed split and must be migrated to pin **single-task** harness selection explicitly (rather than relying on traversal order): the `medium`-profile run-stop fixture then yields seeds 1 + remainder 2. The cached-stop warm-phase row (`runCachedStopControl`, batchSize 1, asserting a single-member first `fetchAll`) likewise pins single-task selection so the phase-1 round stays a single-member call post-regeneration. `llmRequestManager.eligibility.test.js`'s "fails processing loudly for a request UID absent from the generated route map" row: under the fail-fast partition this fault throws **before** dispatch — `fetchAll` is never invoked and the message is the partition's (whose wording is unspecified today and must name the offending UID when pinned in the action plan), not the consumer's unknown-outcome-UID guard. Re-express it as a pre-dispatch partition fault asserting no dispatch occurs. The consumer's unknown-UID guard becomes defensive-only under two-phase dispatch; it remains directly exercised by `assignmentRunIntegration.test.js`'s mocked-sender rows.
- **Require migration:**
  - `llmRequestManager.runStop.test.js` rows with batch size ≥ 2 (batch pattern changes from e.g. `[2,1]` to `[1,2]`; the stop-at-index-0 rows' single batch shrinks from two members to one, and the same-batch sibling becomes never-dispatched). These rows pin **single-task** harness selection explicitly. The migrated rows continue to use the `medium` canonical synthetic profile.
  - `tests/controllers/assignmentRunCompletion.test.js` (batch-size-2 "same-batch connected stop" row): under two-phase dispatch the seed is alone in phase 1 and the healthy same-batch survivor becomes never-dispatched `LLM_RUN_STOPPED`. Re-expressing the same-batch-survivor scenario requires a multi-task arrangement (≥ 2 seeds in the seed round); the run-stop harness selection is extended (opt-in multi-task mode; single-task mode retained) to pick candidates across ≥ 2 tasks. The regenerated committed medium corpus will contain multi-task eligible graphs (for example `assignment-0-1` and `assignment-0-3`), so no generator extension beyond the regeneration plan is needed. Multi-task rows follow one rule — seeds = one first-eligible request per task present in the fixture; remainder = remaining candidates in the existing batching (empty remainder ⇒ the run is a single phase-1 round) — and the action plan pins the exact batch patterns per row from the harness's deterministic selection (for example, a two-task fixture with one extra candidate at batch size 3 splits as seeds 2 + remainder 1). The exact patterns must be derived once the harness API is fixed, not asserted speculatively here. The cancelled-retryable and permanent-sibling rows can remain single-task with the stop moved into the remainder. The mixed-E row of this same file (`assignment-0-4`) pins `expect(countItems(stored, true)).toBe(4)` and `expect(countItems(stored, false)).toBe(6)` and must be re-derived post-regeneration (see the regeneration-consequence note below); it is not a run-stop row.
  - `llmRequestManager.transportCallerPolicy.test.js` — three distinct groups: (a) the hand-built-request rows (delegation `batchSize: 37`, consumes-native-responses batching, consumer-fault) migrate by supplying route entries with `taskDefinition` or by asserting against the two-phase call sequence; (b) the 6 real-generation stop rows (2 modes × 3 statuses = 6 rows; the 12-row stop matrix lives in `runStop.test.js`) — 4 distinct tasks × 1 item each, all seeds with an empty remainder, so phase 1 is a single 4-member round and the asserted `[3,1]` layouts and 3-response mock never match; these rows need scenario re-authoring — for example multiple items per task so a remainder exists, or re-authored seed-round expectations; (c) the 'validates missing public LLM assignment' row passes unchanged (`requireParams` precedes the partition). These rows are heavier to re-author than the (a) group — recorded so the action plan can schedule them accordingly.
  - `llmRequestManager.assignmentRunIntegration.test.js` (two tests hand-build route entries without `taskDefinition` and assert a single sender call) migrate to real generation or supplied route entries and a two-phase call assertion.

New and changed tests follow `docs/developer/backend/backend-testing.md`: a canonical synthetic fixture is used where the corpus covers the scenario. The required multi-task coverage (≥ 2 TEXT-typed tasks in one definition, with dispatch-eligible numeric candidates in each) does not exist in the committed corpus today — every full definition in every profile carries at most one TEXT-typed task (compact definitions carry two tasks, one of which can be TEXT; large-full definitions carry one task), and the run-stop corpus is single-task. Rather than relax the run-stop harness's TEXT type-matching realism gate, the corpus is regenerated with scaled task counts. The corpus regeneration plan this feature adopts:

- Task count per definition, per profile (via the definition stage's `tasksPerDefinition` resolution): `small` 4, `medium` 6, `large-representative` 10, `large-full` 15. The `ARTEFACT_BODY_TYPES` cycle is unchanged. The ≥ 2 TEXT-typed task guarantee holds deterministically only at task counts 6, 10 and 15: at 6 tasks every full definition carries exactly 2 TEXT tasks; at 10, three to four; at 15, exactly five. At 4 tasks only definitions with `definitionIndex % 3 === 0` carry two TEXT-typed tasks, so `small` does not generally provide multi-task TEXT pairing and is not a run-stop fixture host. (For reference: at 10 tasks the cycle also multiplies the other types; nothing else depends on the counts.) `COMPACT_TASKS_PER_DEFINITION` becomes a per-profile mapping; `LARGE_FULL_TASKS_PER_DEFINITION` becomes 15.
- `large-full` rescale (measurement-anchored: today's profile at 1 task generates 246k items in ~11 s at ~800 MB RSS; ~3.25 MB and ~43 ms per 1k items): `LARGE_FULL_CLASS_COUNT` 100 → 48 (6 classes per year group), `LARGE_FULL_ASSIGNMENTS_PER_CLASS` 100 → 50, `LARGE_FULL_YEAR_GROUP_COUNT` 24 → 8 (the school-typical maximum; YG 7–14). Expected footprint at 15 tasks ≈ 900k items, ~2.9 GB RSS, ~40 s generation — in line with the user-approved ~3 GB budget. `large-full` remains uncommitted and generated on demand.
- `LARGE_FULL_SUBMISSION_BANDS` rescaled from 100 to 50 assignment indices preserving the per-class 5/10/70/15 completion shares as closely as integer rounding permits: boundaries `[0,3)` / `[3,8)` / `[8,43)` / `[43,50)` — 3, 5, 35 and 7 assignments per class (shares 6/10/70/14; the exact 5/10/70/15 split is not divisible at 50 assignments). `LARGE_FULL_COMPLETION_BANDS` sharePercent values become 6/10/70/14, and `assertCompletionBands` changes from equating per-band assignment counts with the sharePercent values directly — an equality that holds only at 100 assignments per class — to deriving expected per-band counts from the shares and the per-class assignment count (6%/10%/70%/14% of 50 = 3/5/35/7). The min/max completed-percent ranges (20–49/50–79/80–95/96–100) are unchanged. The `resolveSubmissionCount` and band documentation, plus `synthetic-test-data.md`, are updated in the same change.
- All three committed profiles are regenerated via the CLI; committed manifests/views change deterministically and `syntheticCommittedFixtureRegeneration.test.ts` re-validates them. `small` grows to 4 tasks per definition (its hydrated items scale ~2×), `medium` to 6 (~3×), `large-representative` to 10.
- The run-stop harness (`tests/helpers/llmRunStopHarness.js`) is extended with an **opt-in multi-task selection mode** (all TEXT-typed tasks in one assignment, numeric marks) rather than replacing the existing selection; the single-task mode is retained and pinned for the rows that rely on 1-seed splits, and the multi-task mode is used for the same-batch-survivor scenarios in both suites. No generator extension is needed beyond the task-count and band changes above.
- The new corpus gives `medium` `assignment-0-3` and `assignment-0-1` (and their counterparts) two-plus TEXT tasks, unlocking the multi-task seed arrangement directly. Whether both TEXT tasks in an assignment also carry numeric-healthy candidates is a data prediction that follows from the seeded generator arithmetic (the harness's numeric-healthy check); it is not separately guaranteed, so the action plan must verify it at regeneration time rather than treat the IDs as assured — the failure mode is loud (the harness throws at candidate collection).
- The synthetic-analysis stress project's 30,000 ms `testTimeout` does not cover single-generation work at the new scale at all (projected generation ≈ 40 s); re-budget the stress project to at least 120,000 ms in the same change and re-validate the on-demand `large-full` profile under it. Any heap flag or machine-RAM requirement observed during validation is recorded in the stress project's config and docs. The `vitest.config.js` stress-project comment ("full 3,000-student / 10,000-assignment large graph") becomes stale with the rescale and is updated in the same change.
- The migration inventory above is scoped to the suites this feature changes; the corpus regeneration itself has a wider blast radius that must be owned explicitly. Over 50 test files import `loadBackendModelInputs` / `loadSyntheticAnalysisProfile` (roughly 40 outside the synthetic project's own suites); most select by criteria and survive regeneration, but any canonical-pinned expectation can break:
  - Confirmed concrete breakage: `tests/controllers/assignmentRunCompletion.test.js`'s medium mixed-E row pins `expect(countItems(stored, true)).toBe(4)` and `expect(countItems(stored, false)).toBe(6)` for `assignment-0-4` (five submitters × two tasks = ten items today). At 6 tasks per definition the same record holds thirty items (twelve E / eighteen non-E), so those pinned counts fail. This row is not a run-stop row and is not otherwise accounted for in the inventory.
  - Committed views grow (~2×/~3×/~5× hydrated items across small/medium/large-representative); test-load memory and runtime across the consuming suites shift accordingly, and the committed JSON byte growth lands in the same diff.
  - The action plan must therefore sequence the regeneration section first, include a corpus-wide re-derivation pass over the consuming suites (not only the inventoried LLM suites), and require `npm run run-all-checks` to pass after the regeneration section and before the LLM migration sections begin. The corpus regeneration is a precondition for the run-stop and controller-completion migrations and for that gate.

- Backend unit tests (Testing Specialist): partition helper (grouping, first-in-order seed selection, order preservation, duplicate-UID fault, missing route-map entry fault, missing `TaskDefinition` fault), two-phase orchestration (phase 2 skipped on phase 1 stop; phase 2 skipped when remainder is empty; shared `runStopped`; seeds/remainder dispatched exactly once each), seed failure non-stop → phase 2 proceeds, zero-request early exit unchanged, existing retry/terminal behaviour through both phases.
- Regression coverage against the migrated `llmRequestManager.*`, `baseRequestManager.*` and `tests/controllers/assignmentRunCompletion.*` suites; `llmRequestManager.assignmentRunIntegration.test.js` is updated for the two-phase shape rather than expected to pass unchanged.
- No frontend tests (no frontend change).
- No E2E tests (no user-visible change).

## Documentation and rollout notes

- Canonical doc updates in the same change: `docs/developer/backend/AssessmentFlow.md` (two-phase dispatch, seed semantics, latency note). Review `docs/developer/security/data-handling.md` for the `fetchAll` batching description.
- No rollout dependency, migration, config or reset note; always-on behaviour for new runs. Runs already in flight during deploy complete with the old ordering.
- Deferred follow-up (not in scope): surfacing `cached_tokens` from the LLM service to measure cache-hit-rate improvement; requires a change in `AssessmentBot-LLM-Service`.
- GitHub issue #309 should be referenced in the commit/PR that lands this.

## V1 scope recommendation

### Include in v1

- Seed partition helper and two-phase dispatch in `processStudentResponses()`.
- Shared outcome consumer refactor.
- Synthetic corpus regeneration workstream (a hard precondition for the LLM-migration tests): per-profile task counts (`small` 4, `medium` 6, `large-representative` 10, `large-full` 15), the large-full rescale (8 year groups / 48 classes / 50 assignments per class), the 50-assignment completion bands and the `assertCompletionBands` derivation, CLI regeneration of the committed profiles with re-pinning, a corpus-wide re-derivation pass over the consuming suites behind an `npm run run-all-checks` gate, the `llmRunStopHarness.js` opt-in multi-task mode, the stress-project timeout re-budget (≥ 120,000 ms) with re-validation, and the `synthetic-test-data.md` same-change update.
- Info-level seed-round logging.
- Backend unit and integration regression coverage.
- `AssessmentFlow.md` documentation update.

### Defer from v1

- `cached_tokens` measurement/telemetry (LLM service repository).
- Per-task pipelined seeding (seed task t → dispatch its remainder immediately).
- Any configuration toggle for seeding.
- Sheets-assignment path (not applicable).
