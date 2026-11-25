# Feature Delivery Plan (TDD-First) — ProgressTracker API Polling

## Delivery status

- Current section: Section 2 — Keyed ProgressTracker store and active run context (complete, pending
  gate and commit).
- Current phase: Section 2 docs sync + plan compaction in parallel; RED and GREEN loops both PASSED
  review with no findings.
- Branch: `feat/progress-tracker-api-polling`.
- Regression session ID: `progresstracker-api-polling`.
- Baseline gate: PASSED — 2026-11-25T10:23:32.661Z, `baseline/baseline.txt`, Overall Status GREEN,
  8/8 checks passing, 0 regressions, 0 new failures, 0 existing failures.

## Read-First Context

Before writing or executing this plan:

1. Read `@SPEC.md` as the source of truth for product behaviour and contracts.
2. Read `@docs/developer/data-shapes/progress-tracker.md` plus the planned entries in
   `@docs/developer/data-shapes/assignment.md`, `@docs/developer/data-shapes/trigger-context.md`,
   `@docs/developer/data-shapes/transport-envelope.md` and `@docs/developer/data-shapes/INDEX.md`.
3. Treat those documents as the agreed target contracts; remove their `Not implemented` markers as
   each shape is delivered.
4. No layout spec is required: this task adds no UI surface, modal, polling hook or visible state.

## Scope and assumptions

### Scope

- Backend `requestId` plumbing from `apiHandler` into trigger context and back in the start response.
- Keyed `ProgressTracker` User Properties with an active run context and legacy fallback.
- `getProgress` backend handler and registration.
- Deferred cleanup trigger with per-user cache/marker dedupe and terminal-only deletion with re-arm.
- Frontend typed service wrapper and Zod schemas only; no polling scheduler, hook or UI.

### Out of scope

- Polling interval, `useEffect`/timer/hook implementation and any rendered progress UI.
- Changes to `ApiResponseSchema` or the `callApi` return contract.
- Replacing the legacy unkeyed record used by non-run call sites.

### Assumptions

1. A progress record represents one assessment run; the agreed transport field is `tasks`.
2. The web app keeps `USER_ACCESSING` execution, so progress records and the cleanup marker are
   per-user; the cache flag uses the user cache.
3. `ProgressTracker` remains unfrozen after `ensureInitialized()` because the active context changes
   after initialisation.

---

## Global constraints and quality gates

### Engineering constraints

- Route every frontend request through `apiHandler`; register all methods in
  `ALLOWLISTED_METHOD_HANDLERS`.
- Top-level backend functions carry a trailing underscore; handlers are anonymous closures;
  `getProgress_` needs a guarded `module.exports`.
- Trigger methods are anonymous arrows in `TRIGGER_METHOD_HANDLERS`; no new public GAS function.
- All `PropertiesService` access goes through `GASPropertiesUtils`; `CacheManager` is the cache
  wrapper and requires an explicit TTL.
- Fail loudly on invalid inputs and persistence failures; never catch-and-ignore errors.
- Use British English in comments and documentation.
- GAS concatenation order matters: `01_` and `02_` helper files sort before `ProgressTracker.js`
  and `z_apiHandler.js`; symbols are resolved at call time, not at definition time.
- Do not disable lint rules. Run the relevant `:check` gate before each section is called done.

### TDD workflow (mandatory per section)

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy with all tests still green.
4. Run section-level verification commands.
5. **Docs sync**: update relevant docs in the same section where behaviour changes; record the
   outcome or skip reason in the section's `Implementation notes`.
6. **Plan compaction**: after verification, compact the completed section to a summary retaining
   contracts and follow-ups, preserving later sections and the deferred-findings ledger.

### Validation commands hierarchy

- Backend lint: `npm run lint:backend:check`
- Frontend lint: `npm run lint:frontend:check`
- Backend tests: `npm run test:backend -- <target>`
- Frontend unit tests: `npm run test:frontend -- <target>`
- Type checks: `npm run typecheck:all`
- Full local gate: `npm run run-all-checks`

### Canonical-fixture policy note

Transient progress state is outside the analysis graph, so no canonical profile or view applies,
and the synthetic fixture system explicitly excludes trigger simulation. Focused local fixtures
using the existing in-memory `PropertiesService` mock are policy-compliant. Do not add a corpus
profile or generator, and do not relax a shared realism gate. Existing tests touched by the change
are migrated opportunistically where they already mock `ProgressTracker`.

---

## Section 1 — Request-scoped request ID and start response contract

### Outcome (compacted)

Delivered the request-scoped correlation ID path end to end: `ApiDispatcher.handle()` sets
`ApiRequestContext` before the auth gate and overwrites it on every dispatch; `startAssessmentRun_`
returns `{ requestId }` sourced from that accessor while `AssignmentController.startAssessmentRun()`
still returns `null`; the ID is stored in trigger context and validated into
`progressTracker.startTracking(requestId)` by `processSelectedAssignment`. Focused section checks
passed: the backend run covering `tests/api/apiHandler`,
`assignmentController.startAssessmentRun.test.js` and `tests/controllers/assignmentController/`
(20 files / 219 tests) and `npm run lint:backend:check` clean. Contracts, decisions and outstanding
records are retained below; the authoritative evidence and deviations are in the preserved
`Implementation notes / deviations / follow-up` subsection.

### Retained for later sections

- **Controller contract:** `AssignmentController.startAssessmentRun({ definitionKey, assignmentId,
courseId, requestId })` destructures `requestId`, passes it as a fourth positional argument to
  `startProcessing(assignmentId, definitionKey, courseId, requestId)` and returns `null`. The
  transport handler — not the controller — owns the `{ requestId }` response data.
  `startProcessing()` stores `requestId` in `trigger:<uid>:params` for `processSelectedAssignment`.
- **Accessor contract:** `ApiRequestContext` (`set(requestId)`, `get()`, `resetForTests()`) is an
  object literal in `src/backend/z_Api/z_apiHandler.js` (not a public GAS function), exported from
  that module's guarded `module.exports`. `handle()` calls `set()` immediately after
  `_resolveRequestId()`, before the auth gate, and every dispatch overwrites the value; tests reset
  it between cases.
- **Explicit second argument:** the allowlist entry is
  `startAssessmentRun: (parameters) => startAssessmentRun_(parameters, ApiRequestContext.get())`.
  The value is passed explicitly because `assignmentAssessment.js` is loaded separately in Node
  tests and cannot resolve the script-scope accessor as a global. `startAssessmentRun_` validates it
  with `Validate.validateNonEmptyString('requestId', requestId)` and returns `{ requestId }`.
- **Trigger path:** trigger params for `processSelectedAssignment` include `requestId`; the method
  validates it with `Validate.validateNonEmptyString()` before calling
  `progressTracker.startTracking(requestId)`. Section 2 consumes this bound ID; Section 3 aggregates
  the resulting keyed records.
- **Transport and data shapes:** `startAssessmentRun` response `data` is `{ requestId: string }`
  equal to the envelope `requestId`; the shared envelope shape is unchanged, so
  `transport-envelope.md` needs no shape change (its planned-endpoint marker is removed when
  `getProgress` lands in Section 3). Trigger context params gain `requestId`; the planned markers in
  `assignment.md` and `trigger-context.md` are owned by this section's doc-sync slot below.
- **Legacy fallback decision:** validation and propagation are conditional on
  `requestId !== undefined`, so direct calls and legacy non-run call sites keep the unkeyed key while
  the real dispatch path always supplies and validates the ID. The conditional-on-undefined
  deviation and its rationale are recorded in the preserved `Implementation notes / deviations /
follow-up` subsection.
- **Export-key pin:** `tests/api/apiHandler/dispatcher-integration.test.js` asserts
  `Object.keys(sandbox.module.exports)` equals `['apiHandler', 'ApiDispatcher',
'ALLOWLISTED_METHOD_HANDLERS', 'ApiRequestContext']`; any new export must update that assertion.
- **Shared-helper reconciliation:** the `ApiRequestContext` helper entry (previously planned
  `Not implemented` in the Section 1 shared-helper plan) is delivered; its canonical doc target is
  `docs/developer/data-shapes/progress-tracker.md`, reconciled in the final Documentation and
  rollout notes section. Shared-helper entries for future sections remain `Not implemented` and
  unchanged.
- **`@remarks` JSDoc commitments fulfilled:** `z_apiHandler.js` documents why the accessor is an
  object literal (global-exposure guard) and that the value is overwritten per dispatch;
  `assignmentAssessment.js` documents why the dispatcher passes the accessor value explicitly (the
  module is loaded separately in Node tests) and that the controller still returns `null`.
- **Open record slots:** the preserved `Implementation notes / deviations / follow-up` subsection
  still needs its doc-sync outcome, regression gate record and commit record filled in. No new
  record is created here.

### Implementation notes / deviations / follow-up

- **Implementation notes:** RED review PASSED after one in-scope header correction; GREEN review
  PASSED with no in-scope findings. Focused section tests: 20 files / 219 tests passing;
  `lint:backend:check` clean. Out-of-scope nitpick (bare `delete globalThis.*` in
  `assignmentController.startAssessmentRun.test.js:119-129`) logged as `disregarded` in
  `.opencode/scratchpad/progresstrackerrefactor-deferred-findings.md`. Docs sync updated
  `docs/developer/data-shapes/assignment.md`, `trigger-context.md`, `progress-tracker.md`,
  `docs/developer/backend/api-layer.md` and `AssessmentFlow.md`; no new pages created. It removed
  Section-1-owned markers, left later-section markers intact, and reported pre-existing drift
  (validation descriptions in `assignment.md:399` / `api-layer.md:596`; `progress-tracker.md`
  absent from `mkdocs.yml` nav and `docs/README.md`) — logged as minor out-of-scope nitpicks in
  the deferred-findings log. No code files changed in docs sync, so no extra lint/type run needed.
  User-directed changes: the graphify commit `b814ab1d` ("chore(graphify): add self-contained
  offline graph viewer") is already on this branch and pushed to origin; it is part of this
  section's commit history. `.opencode/agents/action-plan-implementer.md` was updated per the
  user's request to run `graphify update .` at the end of every section before context compaction,
  with regenerated graph outputs committed and pushed with the section (new §2.75, exit criteria,
  quick reference).
- **Section regression gate:** PASSED — 2026-11-25T11:12:15.204Z,
  `.ts-regression-checker/reports/session-progresstracker-api-polling/runs/2026-11-25T11-12-15.204Z/comparison.txt`,
  Overall Status GREEN, 8/8 checks passing, 0 regressions, 0 new failures, 0 fixes; no pre-existing
  failures (baseline was fully green).
- **Graphify refresh (§2.75):** `graphify update .` ran after the gate; it rebuilt 11,885 nodes /
  29,634 edges and rewrote the tracked `graphify-out/` artifacts (`graph.json`, `graph.html`,
  `GRAPH_REPORT.md`, `manifest.json`, `.graphify_labels.json`). Local build caches and the dated
  backup directory remain untracked; they are not committed.
- **Commit record:** `32a81015` — `feat(backend): add request-scoped correlation ID to assessment
runs` — on branch `feat/progress-tracker-api-polling`, pushed successfully to
  `origin/feat/progress-tracker-api-polling` (`b814ab1d..32a81015`). Earlier branch commit
  `b814ab1d` (graphify viewer) was already pushed by the user and is retained in history.
  Pre-commit hooks (Prettier, backend lint, `typecheck:all`) passed.
- **Deviations from plan:** Validation and propagation are conditional on `requestId !== undefined`
  so untouched direct-call tests and legacy non-run call sites keep working with the unkeyed key.
  On the real dispatch path the value is always supplied and validated. GREEN reviewer classified
  this as acceptable; SPEC's literal "missing fails loudly" wording conflicts with its legacy
  fallback decision — recorded as a follow-up, not a behaviour change. Line counts: 483 / 159 / 498.
- **Follow-up implications for later sections:** Section 2 starts tracking with the validated ID;
  Section 3 aggregates keyed records. Docs sync and regression gate records to be added here.

---

## Section 2 — Keyed ProgressTracker store and active run context

### Outcome (compacted)

Delivered per-run keyed progress records with an active run context so existing callers need no
signature changes, plus a store facade split that gives keyed persistence and cleanup scheduling
distinct owners and test surfaces. The key scheme is `ProgressTracker<requestId>` with no separator;
a missing ID selects the legacy `ProgressTracker` key. Section checks passed: focused backend run
(`npm run test:backend -- tests/utils/progressTracker.test.js tests/singletons`) 7 files / 53 tests,
`npm run lint:backend:check` clean, full backend suite 288 files / 3807 tests, Prettier clean.
Mandatory-read evidence gate passed, the planned helper entry carried `Not implemented` before
implementation, and the canonical-fixture note was honoured with an in-memory property mock and no
corpus change. Contracts and follow-ups are retained below; authoritative evidence and deviations
are in the preserved `Implementation notes / deviations / follow-up` subsection.

### Retained for later sections

- **Key scheme and record shape:** keyed User Property key is `ProgressTracker<requestId>` with the
  ID appended directly (no separator); the legacy unkeyed record remains at `ProgressTracker`.
  Keyed fields are `requestId`, `step`, `message`, `completed`, `error` (`string | null`) and
  `timestamp` (ISO 8601 string from `toISOString()`). Section 3 exposes only keyed records; Section 4
  deletes terminal records under both key forms.
- **Store helper (`src/backend/Utils/01_ProgressTrackerStore.js`):** owns `keyFor`, `read`, `write`,
  `delete` and `readAll`. `readAll(properties)` returns raw `{ key, value }` entries for keyed keys
  only (legacy key excluded) and deliberately does no decoding or malformed-record parsing — Section 3
  aggregation and Section 4 cleanup own that. `write` injects `requestId` into keyed records; a missing
  ID targets the legacy key. The facade supplies the `GASPropertiesUtils`-sourced property store; all
  property access goes through `GASPropertiesUtils`.
- **Facade (`src/backend/Utils/ProgressTracker.js`):** owns `activeRequestId`. `startTracking(id?)`
  binds the context, with no argument selecting legacy; `complete()` writes the terminal record
  through the still-bound context before clearing it (clearing first would strand a non-terminal
  keyed record); `resetForTests()` clears the context and the singleton cache. `getCurrentProgress()`,
  `getStatus()` and `getStepAsNumber()` read the bound record when a context is active and the legacy
  record otherwise. `FREEZE_AFTER_INIT` is not set because the context is mutated after
  `ensureInitialized()`. `propertyKey` was removed, and the facade is 375 lines against the ~330 plan
  guidance — both judged acceptable in GREEN review.
- **Error-write seam:** `logError()` and `logAndThrowError()` accept an optional
  `{ deferCleanup?: boolean }`; the default calls `globalThis.ProgressTrackerCleanup.schedule()` while
  `deferCleanup: true` skips it. `captureError()` is unchanged. Section 4 supplies the real cleanup
  coordinator and re-wires `startTracking`, `updateProgress`, `logError` and `complete` to invoke
  `schedule()`; its `toHaveBeenCalledTimes(1)` spy count may need adjusting once the other write
  methods gain a `schedule()` call.
- **Test bootstrap (`tests/setupGlobals.js`):** provides a default no-op `ProgressTrackerCleanup`
  seam (focused suites replace it with a spy) and loads `ProgressTrackerStore` before the facade in
  GAS concatenation order. Section 4 must replace the no-op seam with the real cleanup module. Section 3
  needs `getProperties()` on the in-memory `PropertiesService` mock for `readAll()`.
- **Shared-helper reconciliation:** the keyed property access helper (planned `Not implemented` in the
  Section 2 shared-helper plan) is delivered by `01_ProgressTrackerStore.js` and reconciled in
  `docs/developer/data-shapes/progress-tracker.md`; `GASPropertiesUtils` is reused unchanged. Helpers
  planned for later sections (Section 4 cleanup coordinator, `CacheManager` extension and
  `TriggerController` extension) remain `Not implemented`.
- **`@remarks` JSDoc commitment:** the per-execution active context and the unfrozen facade are
  documented in the `ProgressTracker.js` class JSDoc and remain on the final `@remarks` review.
- **Open record slots:** docs-sync outcome, regression gate, graphify refresh and commit record are
  still `...` in the notes below and are to be filled by the orchestrator. No new record is created
  here.

### Implementation notes / deviations / follow-up

- **Implementation notes:** RED review PASSED with no findings (9 intentional `AssertionError`
  failures, all six singleton files passing, lint clean, no scope drift). GREEN review PASSED with
  zero findings; the 375-line facade and removal of `propertyKey` were explicitly judged acceptable
  (below the 500-line checklist and 550-line hard trigger, and key derivation now owned by the
  store). Focused checks after GREEN: 7 files / 53 tests passing, `lint:backend:check` clean, full
  backend suite 288 files / 3807 tests passing, Prettier clean. Docs sync updated
  `docs/developer/data-shapes/progress-tracker.md`, `data-shapes/INDEX.md`,
  `backend/AssessmentFlow.md`, `backend/singletons.md` and added the ProgressTracker contract to the
  Data Shapes list in `.opencode/agents/code-reviewer.md`; no new pages created. It removed the
  Section-2-owned `Not implemented` markers (whole-document status, persistence, sub-entities,
  shared helpers, file index, keyed-store helper) and left later-section markers intact (cleanup,
  transport/getProgress, validation, `CacheManager`, `createTimeBasedTrigger`). Post-docs-sync
  JSDoc edits in `ProgressTracker.js` were comments only; scoped `lint:backend:check` and the focused
  53-test run were re-run and remain green. Four out-of-scope doc findings were logged as
  `disregarded` nitpicks in `.opencode/scratchpad/progresstrackerrefactor-deferred-findings.md`.
- **Deviations from plan:** facade is 375 lines against the ~330 guidance (judged acceptable in GREEN
  review); the store helper is 80 lines against the ~120 guidance. The cleanup-scheduling seam is
  established in Section 2 as a global call site with a no-op harness stub; the real coordinator is
  Section 4 work.
- **Follow-up implications for later sections:** cleanup coordinator consumes the store helper and
  is wired into the four write methods listed above. Section 4 must replace the `setupGlobals.js`
  no-op `ProgressTrackerCleanup` with the real `02_ProgressTrackerCleanup.js` module; its
  `toHaveBeenCalledTimes(1)` spy count may need adjusting once the other write methods gain
  `schedule()`. Section 3 needs `getProperties()` on the in-memory `PropertiesService` mock for
  `readAll()` and must remove the remaining transport/validation markers.
- **Section regression gate:** PASSED — 2026-11-25T12:09:34.185Z,
  `.ts-regression-checker/reports/session-progresstracker-api-polling/runs/2026-11-25T12-09-34.185Z/comparison.txt`,
  Overall Status GREEN, 8/8 checks passing, 0 regressions, 0 new failures, 0 fixes; no pre-existing
  failures (baseline fully green).
- **Graphify refresh (§2.75):** `graphify update .` ran after the gate; it rebuilt 11,889 nodes /
  29,637 edges / 612 communities and rewrote the tracked `graphify-out/` artifacts (`graph.json`,
  `graph.html`, `GRAPH_REPORT.md`, `manifest.json`, `.graphify_labels.json`). Local build caches and
  the dated backup directory remain untracked; they are not committed.

---

## Section 3 — `getProgress` transport handler and registration

### Objective

Expose all keyed progress records to the frontend through a single allowlisted `apiHandler` method.

### Constraints

- `getProgress_` is a trailing-underscore function in a single `z_Api` module with a guarded
  `module.exports`.
- No request parameters; no new envelope fields.
- Filter to keyed records only, sort by `timestamp` ascending then `requestId` ascending.
- Return `{ tasks: [] }` when no keyed records exist.
- LOC: new `z_Api/progressTracker.js` ~70; `z_apiHandler.js` ~480 after registration.
- The `registry.test.js` count changes from 31 to 32 allowed methods.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- @SPEC.md
- @tests/api/apiHandler/registry.test.js
- @tests/api/apiHandler/dispatcher-core.test.js
- @tests/helpers/apiHandlerTestUtils.js

Implementation mandatory docs:

- @SPEC.md
- @docs/developer/backend/api-layer.md
- @docs/developer/data-shapes/transport-envelope.md
- @src/backend/z_Api/z_apiHandler.js

Code Reviewer mandatory docs:

- @SPEC.md
- @docs/developer/backend/api-layer.md

### Shared helper plan

- Helper: keyed store `readAll()` from Section 2
  - Decision: `reuse`
  - Owning module/path: `src/backend/Utils/01_ProgressTrackerStore.js`
  - Canonical doc target: `docs/developer/data-shapes/progress-tracker.md`

### Data-shape plan

- Add the `getProgress` endpoint details to `docs/developer/data-shapes/progress-tracker.md` and
  remove the planned endpoint marker; remove the planned-endpoint note from `transport-envelope.md`.
- Reference: @docs/developer/data-shapes/transport-envelope.md @docs/developer/data-shapes/progress-tracker.md

### Acceptance criteria

- `getProgress` is registered and returns a success envelope with `data.tasks`.
- Records are sorted deterministically and the legacy unkeyed record is excluded.
- Malformed keyed records are logged and skipped without failing the request.
- The global-exposure guard test remains green.

### Required test cases (Red first)

API layer tests:

1. `getProgress_` returns `{ tasks: [] }` when only the legacy key exists.
2. `getProgress_` returns two keyed records in timestamp/requestId order.
3. A malformed keyed record is skipped and logged.
4. `getProgress` is present in `ALLOWLISTED_METHOD_HANDLERS` and passes the exposure guard.

### Section checks

- `npm run test:backend -- tests/api/apiHandler`
- `npm run lint:backend:check`
- Mandatory-read evidence gate passed.
- Canonical-fixture note: local property fixtures; no corpus change.
- Docs sync outcome recorded.
- Completed section compacted into **Retained for later sections** below.

### Docs delegation reads (when sub-agents are used)

- @docs/developer/data-shapes/progress-tracker.md
- @docs/developer/data-shapes/transport-envelope.md

### Retained for later sections

- `readAll()` returns keyed records only; malformed ones are skipped in `getProgress_`.
- The allowlist now has 32 methods; `getProgress` is registered with no parameters.

### Optional `@remarks` JSDoc follow-through

- Document why the legacy key is excluded from the transport payload.

### Implementation notes / deviations / follow-up

- **Implementation notes:** ...
- **Deviations from plan:** ...
- **Follow-up implications for later sections:** none.

---

## Section 4 — Deferred cleanup trigger

### Objective

Schedule one cleanup trigger per user, dedupe it with a per-user cache flag and durable marker, and
delete terminal progress records only, re-arming when non-terminal records remain.

### Constraints

- Cache flag TTL is 600 seconds, passed explicitly to `CacheManager.put()`.
- The marker is a per-user User Property; the cache is `CacheService.getUserCache()`. `CacheManager`
  accepts an optional cache instance in its constructor, retaining `CacheService.getScriptCache()`
  as the constructor-owned default. `tests/setupGlobals.js` must expose a `getUserCache()` mock.
- Section 4 re-opens `ProgressTracker.js` from Section 2 and wires `schedule()` into `startTracking`,
  `updateProgress`, `logError` and `complete`, so every progress write checks the dedupe state.
- `TriggerController.createTimeBasedTrigger('triggerHandler', new Date(now + 10 minutes), {
skipTooManyTriggersRecovery: true })` is used. With that option **any** creation error is logged
  via `ABLogger` and the method returns `null`; it never calls `removeTriggers()` (which would delete
  assessment triggers) or `logAndThrowError()` (which would re-arm cleanup). The coordinator leaves
  the marker and cache flag unset so a later progress write retries.
- Marker and cache flag are cleared in a `finally` on every sweep. Re-arming occurs only after a
  successful sweep that observed a non-terminal record, and rewrites both for the new trigger UID.
  On a sweep failure the marker is cleared but no re-arm occurs; the next progress write re-arms.
- `cleanupProgress` is an anonymous arrow in `TRIGGER_METHOD_HANDLERS`.
- `triggerHandler`'s catch passes `{ deferCleanup: true }` to `logAndThrowError`, so a failed sweep
  cannot re-arm cleanup through the error-logging path. An integration test must prove this.
- LOC: new `02_ProgressTrackerCleanup.js` ~180; `CacheManager.js` 74 → ~100;
  `TriggerController.js` 178 → ~195; `triggerMethodHandlers.js` 24 → ~30. All below 500.
- `02_` helper loads before the facade and `z_apiHandler.js`.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- @SPEC.md
- @docs/developer/backend/backend-testing.md
- @tests/triggers/triggerHandler.test.js
- @tests/triggers/triggerMethodHandlers.test.js
- @tests/requestHandlers/CacheManager.test.js
- @tests/setupGlobals.js

Implementation mandatory docs:

- @SPEC.md
- @src/backend/Triggers/TriggerController.js
- @src/backend/Triggers/triggerHandler.js
- @src/backend/Triggers/triggerMethodHandlers.js
- @src/backend/RequestHandlers/CacheManager.js
- @docs/developer/data-shapes/trigger-context.md

Code Reviewer mandatory docs:

- @SPEC.md
- @docs/developer/backend/backend-file-organisation.md

### Shared helper plan

1. Helper: cleanup coordinator (`schedule`, `sweep`, `rearm`)
   - Decision: `new`
   - Owning module/path: `src/backend/Utils/02_ProgressTrackerCleanup.js`
   - Canonical doc target: `docs/developer/data-shapes/progress-tracker.md`
   - Planned doc status: `Not implemented`
2. Helper: `CacheManager` supplied cache and `remove(key)`
   - Decision: `extend`
   - Owning module/path: `src/backend/RequestHandlers/CacheManager.js`
   - Canonical doc target: `docs/developer/data-shapes/progress-tracker.md`
   - Planned doc status: `Not implemented`
3. Helper: `TriggerController.createTimeBasedTrigger` with `skipTooManyTriggersRecovery`
   - Decision: `extend`
   - Owning module/path: `src/backend/Triggers/TriggerController.js`
   - Canonical doc target: `docs/developer/data-shapes/progress-tracker.md`
   - Planned doc status: `Not implemented`
4. Helper: `TriggerController.storeTriggerContext` and `clearTriggerContext`
   - Decision: `reuse`
   - Owning module/path: `src/backend/Triggers/TriggerController.js`

### Data-shape plan

- Update `docs/developer/data-shapes/progress-tracker.md` cleanup key scheme and lifecycle notes;
  remove their `Not implemented` markers.
- Reference: @docs/developer/data-shapes/progress-tracker.md @docs/developer/data-shapes/trigger-context.md

### Acceptance criteria

- Only one cleanup trigger is scheduled while the cache flag or marker is present.
- A sweep deletes terminal keyed records and a terminal legacy `ProgressTracker` record, leaving
  non-terminal records intact.
- Re-arming follows only a successful sweep that observed a non-terminal record, and rewrites the
  marker and cache flag for the new trigger UID.
- A sweep failure clears the marker in `finally` without re-arming; the next progress write re-arms.
- A full trigger quota leaves no marker and deletes no assessment triggers.
- A failed `getUserLock().tryLock()` logs a warning, creates no trigger, and the originating progress
  write still succeeds. A concurrent write cannot create a second trigger because the marker is
  rechecked under the lock.
- A malformed keyed value is logged and skipped by the sweep; valid records in the same sweep are
  still processed and the sweep completes.
- `triggerHandler` still owns deletion of the fired trigger and its context.

### Required test cases (Red first)

Backend model/trigger tests:

1. First progress write schedules a trigger; subsequent writes do not.
2. Cache miss with a valid marker repopulates the cache and does not create a trigger.
3. Sweep deletes completed and errored records only, including a terminal legacy record, and keeps
   a non-terminal legacy record.
4. Sweep with a non-terminal record re-arms one trigger and rewrites marker and cache flag.
5. Sweep failure clears the marker and cache flag before rethrowing and does not re-arm.
6. `TriggerController.createTimeBasedTrigger` with `skipTooManyTriggersRecovery` logs and returns
   `null` for both a full quota and a non-quota creation error; no `triggerHandler` trigger is
   deleted, no `logAndThrowError()` or `schedule()` re-arm occurs, and no 5-second retry occurs.
7. Trigger creation failure leaves no marker so a later write retries.
8. `ProgressTracker.startTracking`, `updateProgress`, `logError` and `complete` each invoke
   `schedule()`; a second write does not create a second trigger.
9. `CacheManager` accepts a supplied cache and its `remove(key)` deletes the flag; the default
   constructor still uses the script cache exactly once.
10. `cleanupProgress` is dispatched through `triggerHandler` and is not a public GAS function.
11. A failing sweep dispatched through `triggerHandler` logs via `logAndThrowError(..., { deferCleanup: true })` and creates no new cleanup trigger.
12. A failed lock acquisition logs a warning, schedules no trigger, and does not make the progress write throw.
13. A sweep containing one malformed keyed value logs and skips it while still deleting valid terminal records.

### Section checks

- `npm run test:backend -- tests/utils/progressTrackerCleanup.test.js tests/utils/progressTracker.test.js tests/triggers/triggerHandler.test.js tests/triggers/triggerMethodHandlers.test.js tests/requestHandlers/CacheManager.test.js`
- `npm run lint:backend:check`
- Mandatory-read evidence gate passed.
- Planned helper entries added with `Not implemented` before implementation.
- Canonical-fixture note: local property/cache mocks; no corpus change.
- Docs sync outcome recorded.
- Completed section compacted into **Retained for later sections** below.

### Docs delegation reads (when sub-agents are used)

- @docs/developer/data-shapes/progress-tracker.md
- @docs/developer/data-shapes/trigger-context.md

### Retained for later sections

- Cleanup scheduling is invoked from four `ProgressTracker` write methods; marker/cache state is
  per user and deduped under `LockService.getUserLock()`.
- `createTimeBasedTrigger` now accepts `skipTooManyTriggersRecovery`; default behaviour is unchanged
  for assessment scheduling.

### Optional `@remarks` JSDoc follow-through

- Document why the marker is user-scoped, why `removeTriggers()` must not be used, and why re-arming
  follows only a successful sweep.

### Implementation notes / deviations / follow-up

- **Implementation notes:** ...
- **Deviations from plan:** ...
- **Follow-up implications for later sections:** none.

---

## Section 5 — Frontend API surface

### Objective

Add typed frontend wrappers for `getProgress` and update `startAssessmentRun` to expose the
correlation ID. No polling hook or UI is added.

### Constraints

- All calls go through `callApi`; no direct `google.script.run`.
- `StartAssessmentRunResponseSchema` is a non-nullable object with `requestId: z.string().min(1)`.
- `startAssessmentRun()` signature becomes `Promise<StartAssessmentRunResponse>` with no `as null`
  cast.
- `getProgress()` needs a response schema only; it takes no parameters.
- `ProgressRecordSchema.timestamp` uses `z.iso.datetime()` (the non-deprecated Zod 4 API).
- LOC: `assignmentAssessment.zod.ts` 211 → ~245; `assignmentAssessmentService.ts` 58 → ~80.
  Both below 500. If either crosses 500, split schemas into a dedicated `progressTracker.zod.ts`
  in the same `assignmentAssessment` folder.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- @SPEC.md
- @docs/developer/frontend/frontend-testing.md
- @src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.spec.ts

Implementation mandatory docs:

- @SPEC.md
- @docs/developer/frontend/frontend-architecture.md
- @docs/developer/data-shapes/progress-tracker.md
- @src/frontend/src/services/apiService.ts
- @src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts
- @src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts

Code Reviewer mandatory docs:

- @SPEC.md
- @docs/developer/frontend/frontend-architecture.md

### Shared helper plan

- Helper: `callApi` and `parseApiResponse`
  - Decision: `reuse`
  - Owning module/path: `src/frontend/src/services/apiService.ts`
  - Rationale: sole transport and envelope choke point.

### Data-shape plan

- Confirm frontend schemas match `docs/developer/data-shapes/progress-tracker.md` and the updated
  `startAssessmentRun` shape in `assignment.md`; remove remaining markers owned by this section.
- Reference: @docs/developer/data-shapes/progress-tracker.md @docs/developer/data-shapes/assignment.md

### Acceptance criteria

- `startAssessmentRun()` resolves to `{ requestId }` with no cast.
- `getProgress()` resolves to `{ tasks }`, including the empty-array case.
- Invalid record shapes fail Zod validation at the service boundary.
- No polling loop, hook or UI component is introduced.

### Required test cases (Red first)

Frontend tests:

1. `getProgress()` returns parsed tasks and accepts an empty array.
2. A record with a malformed timestamp is rejected by `ProgressRecordSchema`.
3. `startAssessmentRun()` returns the request ID from response data.
4. Existing specs asserting `null` are updated.

### Section checks

- `npm run test:frontend -- assignmentAssessmentService.spec.ts`
- `npm run lint:frontend:check`
- `npm run typecheck:all`
- Mandatory-read evidence gate passed.
- Canonical-fixture note: local typed fixtures; no corpus change.
- Docs sync outcome recorded.
- Completed section compacted into **Retained for later sections** below.

### Docs delegation reads (when sub-agents are used)

- @docs/developer/data-shapes/progress-tracker.md
- @docs/developer/data-shapes/assignment.md

### Retained for later sections

- `startAssessmentRun()` returns `Promise<StartAssessmentRunResponse>` with no `as null` cast.
- `getProgress()` is a parameterless service call returning `{ tasks }`.

### Optional `@remarks` JSDoc follow-through

- Document why the start response now carries the correlation ID despite the envelope already
  having one.

### Implementation notes / deviations / follow-up

- **Implementation notes:** ...
- **Deviations from plan:** ...
- **Follow-up implications for later sections:** later UI work can poll using the returned ID.

---

## Regression and contract hardening

### Objective

Verify backend, frontend and transport contracts after all sections land.

### Constraints

- Prefer focused suites before the full gate.
- Do not relax lint, type or fixture gates.

### Acceptance criteria

- Backend, frontend, API and trigger suites pass.
- Lint and type checks pass.
- No `Not implemented` marker remains for delivered shapes.

### Required test cases/checks

1. `npm run test:backend -- tests/utils/progressTracker.test.js tests/api/apiHandler tests/triggers`
2. `npm run test:frontend -- assignmentAssessmentService.spec.ts`
3. `npm run lint:check`
4. `npm run typecheck:all`
5. `npm run build:production` (compiles the builder first, then builds the GAS bundle)

### Section checks

- All commands green; deviations recorded.

### Implementation notes / deviations / follow-up

- **Implementation notes:** ...
- **Deviations from plan:** ...

---

## Documentation and rollout notes

### Objective

Align canonical docs with the delivered code and remove planned-only markers.

### Constraints

- Only modify docs relevant to touched areas.
- Keep AGENTS references brief; detailed policy stays in the owning docs.

### Required checks

1. `docs/developer/data-shapes/progress-tracker.md`, `assignment.md`, `trigger-context.md`,
   `transport-envelope.md` and `INDEX.md` match delivered shapes with no `Not implemented` marker.
2. `docs/developer/backend/AssessmentFlow.md` describes keyed records rather than a single key.
3. `docs/developer/backend/api-layer.md` lists `getProgress`.
4. Planned shared-helper entries are reconciled.

### Docs delegation reads (when sub-agents are used)

- @docs/developer/data-shapes/progress-tracker.md
- @docs/developer/data-shapes/assignment.md
- @docs/developer/data-shapes/trigger-context.md
- @docs/developer/data-shapes/transport-envelope.md
- @docs/developer/data-shapes/INDEX.md
- @docs/developer/backend/AssessmentFlow.md
- @docs/developer/backend/api-layer.md

### Optional `@remarks` JSDoc review

- Confirm the active-context, unfrozen-singleton and cleanup dedupe decisions are captured in code
  JSDoc; otherwise record `None`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** ...
- **Deviations from plan:** ...

---

## Suggested implementation order

1. Section 1 — request context and start response contract.
2. Section 2 — keyed store and active run context.
3. Section 3 — `getProgress` transport handler.
4. Section 4 — deferred cleanup trigger.
5. Section 5 — frontend API surface.
6. Regression and contract hardening.
7. Documentation and rollout notes.

No teacher tutorials or explainers section is required: the change adds no teacher-facing journey or
UI concept.

---

## Deferred and Out-of-Scope Findings

| Finding                                   | Severity | Scope rationale                                      | Evidence                                                   | Disposition | User decision                         |
| ----------------------------------------- | -------- | ---------------------------------------------------- | ---------------------------------------------------------- | ----------- | ------------------------------------- |
| Frontend polling scheduler and hook       | Material | Explicitly excluded from this task; API surface only | User decision (frontend scope = API surface only)          | `noted`     | API surface only; polling deferred    |
| Replacing the legacy unkeyed record       | Material | Many non-run call sites have no request context      | 100+ `ProgressTracker` references across backend and tests | `noted`     | Retain legacy key                     |
| Envelope exposes requestId to all callers | Minor    | Would change the shared transport contract           | `callApi` resolves data only                               | `noted`     | Start response carries the ID instead |
| UI progress display                       | Material | No UI elements in this task                          | User request                                               | `noted`     | Deferred to a UI task                 |

Open nitpicks are logged in `.opencode/scratchpad/progresstrackerrefactor-deferred-findings.md` if
needed.
