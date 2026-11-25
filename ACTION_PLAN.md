# Feature Delivery Plan (TDD-First) — ProgressTracker API Polling

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

### Objective

Make the dispatcher-generated `requestId` available to `startAssessmentRun`, carry it through
trigger context into `processSelectedAssignment`, and return it in the `startAssessmentRun`
response data.

### Constraints

- `ApiDispatcher.handle()` generates the ID before the auth gate; the accessor is set immediately
  after generation and overwritten on each call. No positional handler signature change.
- `ApiRequestContext` exposes `set(requestId)`, `get()` and `resetForTests()` from
  `z_apiHandler.js`; it must not become a public GAS function. Add it to the guarded
  `module.exports` block so Node tests can reset it.
- Signature decision: `AssignmentController.startAssessmentRun({ definitionKey, assignmentId,
courseId, requestId })` destructures the new field and calls
  `startProcessing(assignmentId, definitionKey, courseId, requestId)` — a fourth positional
  argument, matching the existing positional style. The controller still returns `null`; the
  transport handler returns `{ requestId }` read from `ApiRequestContext`. Envelope shape is
  unchanged.
- `startProcessing()` stores `requestId` in `trigger:<uid>:params`.
- `processSelectedAssignment()` validates `requestId` with `Validate.validateNonEmptyString()` and
  calls `progressTracker.startTracking(requestId)`.
- `ApiRequestContext` is added to the guarded `module.exports` of `z_apiHandler.js`; tests resolve
  the same object that GAS handlers use.
- LOC: `z_apiHandler.js` 457 → ~475; `assignmentAssessment.js` 147 → ~152;
  `AssignmentController.js` 486 → ~496. All stay below the 500-line planning threshold and the
  550-line hard trigger; keep additions concise. If `AssignmentController.js` would cross 500,
  extract the completion-feedback block into `y_controllers/AssignmentController/` before
  continuing.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- @SPEC.md
- @docs/developer/backend/backend-testing.md
- @tests/api/apiHandler/shared.js
- @tests/api/apiHandler/dispatcher-core.test.js
- @tests/controllers/assignmentController.startAssessmentRun.test.js
- @tests/controllers/assignmentController/assignmentController.processSelectedAssignmentParams.test.js
- @tests/controllers/assignmentController/assignmentController.startProcessingTriggerIntegration.test.js

Implementation mandatory docs:

- @SPEC.md
- @docs/developer/backend/api-layer.md
- @docs/developer/data-shapes/assignment.md
- @docs/developer/data-shapes/trigger-context.md
- @src/backend/z_Api/z_apiHandler.js
- @src/backend/z_Api/assignmentAssessment.js
- @src/backend/y_controllers/AssignmentController.js

Code Reviewer mandatory docs:

- @SPEC.md
- @docs/developer/backend/api-layer.md

### Shared helper plan

1. Helper: `ApiRequestContext` (`set`, `get`, `resetForTests`)
   - Decision: `new`
   - Owning module/path: `src/backend/z_Api/z_apiHandler.js`
   - Call-site rationale: exposes the dispatch ID to `startAssessmentRun_` without changing every
     handler signature.
   - Canonical doc target: `docs/developer/data-shapes/progress-tracker.md`
   - Planned doc status: `Not implemented`

### Data-shape plan

- Update `docs/developer/data-shapes/assignment.md`: `startAssessmentRun` response becomes
  `{ requestId: string }`; remove its `Not implemented` marker.
- Update `docs/developer/data-shapes/trigger-context.md`: params gain `requestId`; remove marker.
- `transport-envelope.md` needs no shape change; remove the planned-endpoint marker when
  `getProgress` lands in Section 3.
- Reference: @docs/developer/data-shapes/assignment.md @docs/developer/data-shapes/trigger-context.md

### Acceptance criteria

- `ApiDispatcher.handle()` exposes the generated ID before dispatch and overwrites it on each call.
- `startAssessmentRun` response `data` is `{ requestId }` and equals the envelope `requestId`.
- Trigger context params include a non-empty `requestId`.
- `processSelectedAssignment` rejects an empty `requestId` with `Validate.validateNonEmptyString()`
  and passes a valid one to `startTracking(requestId)`.
- `AssignmentController.startAssessmentRun()` still returns `null`; only the transport response
  data becomes `{ requestId }`. Exact-argument assertions for `startProcessing()` (three positional
  args) and exact trigger `params` assertions (three fields) are updated to include `requestId`.

### Required test cases (Red first)

Backend dispatcher tests:

1. `ApiRequestContext.get()` returns the generated ID during a successful handler call.
2. A second `handle()` call replaces the stored ID; `resetForTests()` clears it.
3. `startAssessmentRun` response data contains the correlation ID equal to the envelope ID.

Backend controller tests:

1. `startProcessing()` stores `requestId` in trigger context params.
2. `processSelectedAssignment()` throws on empty `requestId` via `validateNonEmptyString`.
3. A valid `requestId` reaches `progressTracker.startTracking(requestId)`.
4. The existing exact-argument assertion for `startProcessing()` is updated to four arguments.
5. The existing exact trigger `params` assertion includes `requestId`.

### Section checks

- `npm run test:backend -- tests/api/apiHandler tests/controllers/assignmentController.startAssessmentRun.test.js tests/controllers/assignmentController/`
- `npm run lint:backend:check`
- Mandatory-read evidence gate passed for all delegated handoffs.
- Planned helper entry added with `Not implemented` before implementation.
- Docs sync outcome recorded in `Implementation notes`.
- Completed section compacted into **Retained for later sections** below.

### Docs delegation reads (when sub-agents are used)

- @docs/developer/data-shapes/assignment.md
- @docs/developer/data-shapes/trigger-context.md

### Retained for later sections

- `AssignmentController.startAssessmentRun()` returns `null`; the transport handler owns the
  `{ requestId }` response.
- `ApiRequestContext` is exported from `z_apiHandler.js` for Node tests.
- Trigger params for `processSelectedAssignment` now include a validated `requestId`.

### Optional `@remarks` JSDoc follow-through

- Document why the accessor is request-scoped and why handler signatures were not changed.

### Implementation notes / deviations / follow-up

- **Implementation notes:** ...
- **Deviations from plan:** ...
- **Follow-up implications for later sections:** ...

---

## Section 2 — Keyed ProgressTracker store and active run context

### Objective

Replace the single progress property with per-run keyed records, add an active run context so
existing call sites need no signature changes, and split the facade so keyed persistence and cleanup
scheduling have distinct owners and test surfaces. The split is a cohesion decision, not a line-count
obligation.

### Constraints

- `startTracking(requestId?)` binds the active context; no argument selects the legacy key.
- `complete()` writes the terminal record through the bound context and only then clears it; clearing first would strand a non-terminal keyed record.
- With an active context, `getCurrentProgress()`, `getStatus()` and `getStepAsNumber()` read the
  keyed record; with none they read the legacy record.
- Preserve `getInstance()`, `resetForTests()` (which also clears the active context),
  `getCurrentProgress()`, `getStatus()`, `getStepAsNumber()` and the lazy `ensureInitialized()`
  boundary.
- Extend `logError()` and `logAndThrowError()` with an optional options object carrying
  `deferCleanup`; when true, the error write must not invoke the cleanup scheduler. Default
  behaviour stays unchanged for existing callers. `captureError()` is unchanged.
- Use `GASPropertiesUtils` for property access; do not set `FREEZE_AFTER_INIT`.
- LOC: `ProgressTracker.js` 339 → ~330 after extraction; new `01_ProgressTrackerStore.js` ~120;
  `tests/utils/progressTracker.test.js` 216 → ~350. All below 500.
- New store helper loads before the facade via its `01_` prefix.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- @SPEC.md
- @docs/developer/backend/backend-testing.md
- @tests/utils/progressTracker.test.js
- @tests/setupGlobals.js

Implementation mandatory docs:

- @SPEC.md
- @docs/developer/backend/singletons.md
- @docs/developer/backend/backend-logging-and-error-handling.md
- @src/backend/Utils/ProgressTracker.js
- @src/backend/00_BaseSingleton.js
- @src/backend/Utils/00_GASPropertiesUtils.js

Code Reviewer mandatory docs:

- @SPEC.md
- @docs/developer/backend/singletons.md

### Shared helper plan

1. Helper: keyed property access (`readAll`, `write`, `delete`, key derivation)
   - Decision: `new`
   - Owning module/path: `src/backend/Utils/01_ProgressTrackerStore.js`
   - Call-site rationale: isolates key derivation, parsing and legacy filtering from the facade.
   - Canonical doc target: `docs/developer/data-shapes/progress-tracker.md`
   - Planned doc status: `Not implemented`
2. Helper: `GASPropertiesUtils`
   - Decision: `reuse`
   - Owning module/path: `src/backend/Utils/00_GASPropertiesUtils.js`
   - Call-site rationale: canonical PropertiesService entry point.

### Data-shape plan

- Create/confirm the planned record shape in `docs/developer/data-shapes/progress-tracker.md`;
  remove its persistence and record-shape `Not implemented` markers once verified.
- Reference: @docs/developer/data-shapes/progress-tracker.md

### Acceptance criteria

- Two runs with different `requestId` values produce two independent User Property records.
- A write after `startTracking(id)` updates only `ProgressTracker<id>`.
- `getCurrentProgress()` and `getStatus()` read the bound record while a context is active and the
  legacy record otherwise.
- `resetForTests()` clears the active context and singleton cache.
- Malformed-record handling belongs to the `getProgress_` aggregation in Section 3 and the cleanup
  sweep in Section 4, not to the keyed store.

### Required test cases (Red first)

Backend model tests:

1. `startTracking('req-a')` writes `ProgressTrackerreq-a` with step 0 and the initial message.
2. `startTracking()` with no ID writes the legacy `ProgressTracker` key.
3. `updateProgress()` after binding does not modify another run's record.
4. `getCurrentProgress()` after binding returns the keyed record; after `complete()` or
   `resetForTests()` it returns the legacy record or null.
5. `captureError()` and `logAndThrowError()` write to the bound record.
6. `complete()` writes `completed: true` to the keyed record before clearing the context; the legacy key stays untouched.
7. `resetForTests()` removes singleton and active-context state.
8. `logError(message, details, { deferCleanup: true })` writes the error record without calling the
   cleanup scheduler; the default call still schedules.

### Section checks

- `npm run test:backend -- tests/utils/progressTracker.test.js tests/singletons`
- `npm run lint:backend:check`
- Mandatory-read evidence gate passed.
- Planned helper entry added with `Not implemented` before implementation.
- Canonical-fixture note: local in-memory property mock; no corpus change.
- Docs sync outcome recorded.
- Completed section compacted into **Retained for later sections** below.

### Docs delegation reads (when sub-agents are used)

- @docs/developer/data-shapes/progress-tracker.md

### Retained for later sections

- Keyed writes go through `01_ProgressTrackerStore.js`; the facade owns the active context.
- `complete()` writes through the bound context before clearing it.
- Section 4 must re-open `startTracking`, `updateProgress`, `logError` and `complete` in
  `ProgressTracker.js` to invoke the cleanup coordinator; those write methods are the handoff point.

### Optional `@remarks` JSDoc follow-through

- Document why the active context is per execution and why the facade must stay unfrozen.

### Implementation notes / deviations / follow-up

- **Implementation notes:** ...
- **Deviations from plan:** ...
- **Follow-up implications for later sections:** cleanup coordinator consumes the store helper and
  is wired into the four write methods listed above.

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
