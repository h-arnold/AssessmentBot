# Feature Delivery Plan (TDD-First)

## Scope and assumptions

### Scope

- Keep `apiHandler` transport behaviour unchanged, including backend-owned envelope `requestId`.
- Migrate the assessment start flow and long-running assessment execution flow onto `src/backend/Api`; treat existing backend `globals.js` entry points as reference-only during the transition.
- Introduce explicit assessment API methods for this migration: `startAssessmentRun` to begin a tracked run and `getAssessmentRunStatus` to poll job-scoped progress.
- Implement job-scoped tracking for long-running backend operations using a single `job` object.
- Update long-running backend entry points to accept and propagate the `job` object end-to-end.
- Align `ProgressTracker` persistence with the `requestStore` storage model by reusing or extracting the shared keyed-JSON-in-`UserProperties` mechanics instead of re-implementing them separately.
- Update `ProgressTracker` persistence to use the same single-key map pattern as `requestStore` (user-scoped JSON object keyed by `job.id`).
- Introduce an assessment-specific tracker wrapper (`AssessmentRunTracker`) so the assessment workflow uses a named, job-bound tracker rather than binding workflow semantics directly into `ProgressTracker`.
- Refactor the assessment workflow and downstream collaborators that currently capture `ProgressTracker.getInstance()` so tracked assessment runs use the injected job-bound tracker consistently.
- Add frontend non-visual service support for passing a `job` object and polling keyed progress by `job.id`.
- Add and run targeted backend/frontend tests for validation, propagation, and error handling.
- Update the relevant backend documentation alongside each stage where tracker architecture or trigger handoff semantics change.

### Out of scope

- Creating visible frontend progress UI components.
- Replacing the placeholder React assignments page with a full assessment-run UX in this phase.
- Migrating assignment-selection or definition-creation wizard UI onto React in this phase.
- Refactoring unrelated short-running endpoints to require tracking IDs.
- Replacing API admission-control request lifecycle tracking in `requestStore`.
- Preserving document-scoped progress storage or document-property trigger handoff as a long-term architecture.
- Broad architectural refactors unrelated to long-running progress scoping.

### Assumptions

1. A `job` object is required for long-running tracked operations and includes, at minimum, `id`, `name`, `type`, and `startedAt` fields.
2. The frontend must create and supply `job.id`; the backend validates it only and must reject the call if it is missing or invalid.
3. `job.startedAt` is an ISO timestamp created when the job is initiated and propagated across trigger handoff unchanged.
4. Progress data is job-scoped and stored in user-scoped durable storage (`UserProperties`), keyed by `job.id`.
5. Multiple tracked jobs per user are supported and must not overwrite each other, provided they target different `assignmentId` values.
6. Legacy AdminSheet progress polling is reference-only and not part of this implementation target.
7. Progress record lifecycle must be explicit: completed/error records are retained for a bounded period and then removed by deterministic cleanup.
8. Trigger handoff uses installable-trigger context keyed by `triggerUid`, while `job.id` remains the canonical identifier for progress records and frontend polling.
9. Concurrency requirements are user-scoped and assignment-scoped: different `assignmentId` values may run concurrently, but a second active run for the same `assignmentId` must be rejected.
10. Existing document-property-based assessment handoff is a legacy artefact from the former Google Sheets frontend and is being replaced, not preserved.
11. The assessment pipeline remains serialised within a single assignment run; this migration is about isolated concurrent runs across different assignments, not parallelising one assignment's internal stages.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API and globals wrappers thin; delegate behavioural logic to controller/utility layers.
- Treat legacy assessment globals as migration references only; new long-running assessment contracts should be defined on `src/backend/Api` and aligned with the React frontend boundary.
- Reuse `requestStore` patterns for load/save/prune/compact where they fit progress semantics.
- Prefer a small shared backend utility for keyed `UserProperties` JSON-object storage if it removes duplication cleanly; do not duplicate `requestStore` parsing/save/compaction mechanics under a second implementation.
- Keep `ProgressTracker` writes as direct backend property operations; do not call `apiHandler` for internal progress state updates.
- Fail fast for invalid or missing `job` fields (`id`, `name`, `type`, `startedAt` where required) where long-running tracking is required.
- Treat the frontend-supplied `job.id` as canonical for progress polling; the backend must validate it but must not generate, replace, or remap it.
- Treat a valid `job.id` as a canonical UUID string (36 chars, lowercase/uppercase hex plus hyphens in 8-4-4-4-12 format).
- Treat `triggerUid` as an internal routing key only; do not expose it as the frontend polling identifier or substitute it for `job.id`.
- Keep `ProgressTracker` generic and storage-focused; place assessment-flow binding and any workflow-specific helper methods in `AssessmentRunTracker`, not in the base tracker.
- Reuse only storage primitives that are genuinely shared with `requestStore` (property access, JSON parse/reset behaviour, bounded keyed-map persistence, generic prune/compact mechanics). Do not abstract request-lifecycle-specific behaviour such as `createStartedRecord`, `markSuccess`, `markError`, or `apiHandler` lock/admission flow into the tracker.
- Prevent overlapping active runs for the same `assignmentId`, while permitting isolated runs for different `assignmentId` values.
- Define exact assessment API method names and payloads up front; this phase adds backend contracts and non-visual frontend services, not the full React assessment page flow.
- Never silently swallow errors; preserve existing structured error propagation.
- Keep changes localised and consistent with backend/frontend migration patterns.
- Use British English in comments and documentation.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section’s acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Validation commands hierarchy

- Backend lint: `npm run lint`
- Frontend lint: `npm run frontend:lint`
- Builder lint (if touched): `npm run builder:lint`
- Backend tests: `npm test -- <target>`
- Frontend unit tests: `npm run frontend:test -- <target>`
- Frontend e2e tests (if UX changes): `npm run frontend:test:e2e -- <target>`

---

## Section 0 — Shared keyed `UserProperties` store model

### Objective

- Define and implement the shared persistence model that `ProgressTracker` should reuse from the same family of behaviour as `Api/requestStore`.

### Constraints

- Keep the abstraction minimal and focused on storage mechanics only.
- Prefer refactoring `requestStore` to consume shared helpers if that reduces duplication without obscuring request-specific behaviour.
- Do not move `apiHandler` admission/completion logic into shared storage utilities.
- Do not create a broad repository/DAO abstraction for Apps Script properties.

### Reuse versus refactor boundary

- **Reuse/extract:** resilient `UserProperties` access, single-property JSON-object loading, malformed-value reset behaviour, keyed-object save, generic prune/compact helpers where the caller supplies the record-specific predicate/identity rules.
- **Keep requestStore-specific:** request record factories (`createStartedRecord`), request lifecycle mutators (`markSuccess`, `markError`), active-request counting, and lock-scoped admission/completion sequencing inside `apiHandler`.
- **Keep ProgressTracker-specific:** progress record shape, step/message/error semantics, retention policy for completed/error jobs, and any tracker-facing default status payloads.

### Acceptance criteria

- `requestStore` and `ProgressTracker` both persist to `UserProperties` using the same single-property keyed-object model.
- Shared storage helpers, if introduced, are generic over property key and record type and contain no request- or progress-specific field names.
- Shared storage helpers recover safely from missing, malformed, or non-object property values by resetting to an empty keyed object with contextual logging.
- Shared storage helpers preserve unrelated keyed entries across writes, prune passes, and compaction passes.
- Shared compaction/pruning helpers, if extracted, are caller-driven via predicates or selectors so `requestStore` and `ProgressTracker` can retain their different lifecycle semantics.
- `requestStore` behaviour remains unchanged after any refactor to shared helpers.
- `ProgressTracker` uses the shared storage helpers for the parts that truly overlap instead of maintaining a second bespoke parse/save implementation.
- No new abstraction forces `ProgressTracker` to depend on `apiHandler`, transport-layer constants, or request-specific terminology.

### Required test cases (Red first)

Backend utility tests:

1. Shared store loader returns an empty object when the target property is absent.
2. Shared store loader returns an empty object when the target property contains malformed JSON.
3. Shared store loader returns an empty object when the target property contains a valid non-object value.
4. Shared store saver persists a keyed object so a subsequent load returns the same data.
5. Shared prune helper removes only entries matched by the caller-supplied predicate.
6. Shared prune helper preserves unrelated entries and returns the mutated store.
7. Shared compact helper preserves entries classified as active by the caller and evicts the oldest non-active entries first when above the configured limit.
8. Shared compact helper leaves stores at or below the configured limit unchanged.
9. `requestStore` tests remain green when wired through the shared helpers, proving no behaviour regression in API admission tracking.
10. `ProgressTracker` tests exercise the same shared helper path for load/save/reset behaviour rather than duplicating persistence logic privately.

Backend code-structure checks:

1. Shared storage code does not reference request-specific fields such as `requestId`, `status: 'started'`, `markSuccess`, or `markError`.
2. Shared storage code does not reference progress-specific fields such as `step`, `message`, `completed`, or `error`.
3. `requestStore` retains ownership of request-lifecycle factories and mutators after the refactor.
4. `ProgressTracker` retains ownership of progress-record construction and status-shape decisions after the refactor.

### Section checks

- `npm test -- tests/api/<request-store-target>`
- `npm test -- tests/utils/<shared-user-properties-store-target>`

### Implementation notes / deviations / follow-up

- **Implementation notes:** Start by extracting the smallest useful shared helpers from `requestStore`, then switch `requestStore` itself to consume them before adopting them in `ProgressTracker`.
- **Deviations from plan:** Record if the shared helper surface must stay inside `src/backend/Api` temporarily before later relocation.
- **Follow-up implications for later sections:** Section 1 should build on this storage model rather than re-specifying load/save behaviour independently.

---

## Section 1 — ProgressTracker keyed persistence in UserProperties

### Objective

- Update `ProgressTracker` to persist and read progress records keyed by `job.id`.

### Constraints

- Retain `ProgressTracker` as the singleton façade.
- Do not introduce a new persistence abstraction unless blocked.
- Ensure keying strategy is deterministic and safe for Apps Script property storage.
- Reuse the Section 0 shared keyed-store helpers for generic persistence behaviour rather than re-implementing parse/save/reset logic inside `ProgressTracker`.

### Acceptance criteria

- Progress start/update/complete/error operations target a key derived from `job.id`.
- `getStatus` (or equivalent) reads by `job.id` and never cross-reads another job’s data.
- Persistence uses `PropertiesService.getUserProperties()` for keyed progress records.
- Progress persistence shape mirrors `requestStore`: one property containing a keyed object, with explicit prune/compact lifecycle rules.
- Progress updates are written directly by backend runtime code and never mediated through `apiHandler`.
- Long-running operations fail fast when the required `job` object or required `job` fields are missing/invalid.
- Progress retention and cleanup are explicit (for example TTL-based pruning for completed/error jobs).
- `ProgressTracker.complete()` side effects that currently serialise `DocumentProperties` are explicitly reviewed and either removed, adapted, or documented as intentionally retained.
- `AssessmentRunTracker(job)` wraps the base tracker for the assessment workflow and exposes the existing call pattern (`startTracking`, `updateProgress`, `logError`, `logAndThrowError`, `complete`) bound to `job.id`.
- Assessment workflow code does not call `ProgressTracker.getInstance()` directly once the wrapper is introduced; it uses the injected `AssessmentRunTracker`.
- Assessment-path classes that currently cache the singleton tracker (for example `Assignment`, `BaseRequestManager`, `LLMRequestManager`, `ImageManager`, assessors, and other workflow collaborators) are refactored to accept an injected tracker or job-bound dependency rather than re-resolving `ProgressTracker.getInstance()`.

### Required test cases (Red first)

Backend utility/singleton tests:

1. `startTracking(job)` writes a new record using `job.id` and initialises the expected default shape without removing unrelated job records.
2. `updateProgress(...)` updates only the matching keyed record and preserves unrelated job records.
3. `complete()` marks only the matching keyed record complete and preserves unrelated job records.
4. `logError()`/`logAndThrowError()` only mutate the matching keyed record and leave other jobs unchanged.
5. `getStatus(job.id=A)` never returns data from `job.id=B`.
6. `getStatus(job.id)` returns the agreed empty/default status shape when the job record does not exist.
7. Missing or invalid `job`/required job-field paths throw for tracked flows, including invalid `id`, `name`, `type`, and `startedAt` values where the tracker contract requires them.
8. Completed/error records older than the configured retention threshold are pruned while active records remain.
9. Completed/error records at or inside the retention boundary are not pruned prematurely.
10. Behaviour of `complete()` document-property serialisation branch is verified against the chosen migration decision.
11. Progress store read/write lifecycle follows the single-key map pattern and preserves unrelated job entries across updates.
12. No progress update path depends on `apiHandler` invocation.
13. `AssessmentRunTracker(job)` delegates to `ProgressTracker` using `job.id` without requiring workflow call sites to pass `job` or `job.id` on each update.
14. `AssessmentRunTracker(job)` rejects invalid/missing job payloads and does not allow construction without a valid `job.id`.
15. `AssessmentRunTracker(job)` preserves the existing workflow call surface (`startTracking`, `updateProgress`, `logError`, `logAndThrowError`, `complete`) while binding every call to the same `job.id`.
16. Rebinding or reconstructing `AssessmentRunTracker(job)` for a different job does not mutate or cross-read the original job record.
17. Assessment-path collaborator classes used during a tracked run do not bypass the injected tracker by calling `ProgressTracker.getInstance()` directly.
18. Shared backend test helpers/mocks provide isolated `UserProperties` support so keyed progress-store tests do not rely on document-property mocks.
19. Progress-store reads recover safely when the backing property is missing, malformed JSON, or a non-object value, following the same resilience rules as `requestStore`.
20. Step progression is isolated per `job.id`; updates for one job do not inherit or mutate the step counter for another job.
21. Resetting/restarting tracking for an existing `job.id` rewrites only that job record and leaves unrelated jobs untouched.
22. `ProgressTracker` compaction/pruning uses the shared keyed-store helper path for generic store manipulation while keeping progress-specific retention rules in tracker-owned predicates/selectors.

API layer tests:

1. None in this section.

Frontend tests:

1. None in this section.

### Section checks

- `npm test -- tests/singletons/<progress-tracker-target>`
- `npm test -- tests/utils/<progress-tracker-target>`

### Implementation notes / deviations / follow-up

- **Implementation notes:** Keep method names and call patterns as close as possible to existing usages by introducing a named assessment-specific wrapper rather than rewriting every progress call to pass `job.id`.
- **Deviations from plan:** Record any compatibility shims required for existing callers.
- **Follow-up implications for later sections:** API/trigger layers must consistently provide the `job` object.

---

## Section 2 — API contract and validation for long-running tracking

### Objective

- Add explicit long-running assessment API methods (`startAssessmentRun`, `getAssessmentRunStatus`) that accept `params.job`, and validate it.

### Constraints

- Preserve existing `apiHandler` transport envelope and backend-owned `requestId` semantics.
- Keep dispatcher branches thin and aligned with `API_METHODS` constants.

### Acceptance criteria

- Long-running methods require and validate `params.job`.
- `startAssessmentRun` rejects requests with missing/invalid `job.id` and does not generate or replace that identifier.
- Invalid `job.id` produces existing structured invalid-request envelopes.
- Successful responses keep existing `{ ok, requestId, data }` envelope contract.
- Non-long-running methods continue to behave unchanged.
- API validation rules for `job.id` and required `job` fields are documented and shared across backend/frontend tests.
- Keep transport concerns in `apiHandler`; progress persistence helpers must not depend on allowlisted API dispatch.
- `startAssessmentRun` returns plain response data that includes the same canonical `job.id` supplied by the client so polling can continue without consulting the transport envelope.
- `getAssessmentRunStatus` accepts `job.id` as its polling identifier and returns job-scoped progress data only.
- A duplicate active request for the same `assignmentId` returns a structured invalid request and does not start another run.

### Required test cases (Red first)

Backend API tests:

1. Dispatcher routes `startAssessmentRun` and `getAssessmentRunStatus` with valid payloads.
2. Missing `job` returns a structured invalid request.
3. Missing required `job` fields (`id`, `name`, `type`, `startedAt`) returns a structured invalid request.
4. Malformed `job.id` returns a structured invalid request.
5. Invalid `startedAt` values return a structured invalid request.
6. Malformed `job` payloads (for example non-string `name`/`type`) return a structured invalid request.
7. Invalid payloads do not invoke the allowlisted handler.
8. Success path preserves the transport `requestId` and returns method `data`.
9. Existing short-running method tests remain green.
10. Non-UUID `job.id` values and invalid `startedAt` timestamps are rejected consistently.
11. Backend-owned envelope `requestId` remains transport-scoped and is not derived from or replaced by `job.id`.
12. Client-supplied envelope/request metadata cannot override the backend-generated transport `requestId`.
13. `startAssessmentRun` success data echoes the submitted canonical `job.id` without backend replacement.
14. A duplicate active start for the same `assignmentId` returns the agreed structured invalid-request envelope and does not invoke trigger setup.
15. `getAssessmentRunStatus` rejects missing or malformed polling identifiers using the same structured invalid-request contract.
16. `getAssessmentRunStatus` returns the agreed empty/default progress status when the `job.id` does not exist rather than cross-reading another job record.
17. `API_METHODS` and `API_ALLOWLIST` expose `startAssessmentRun` and `getAssessmentRunStatus` with names that match the frontend service constants.

Backend controller/global tests:

1. API layer forwards exact `params.job` into long-running backend entry points.
2. API layer forwards `assignmentId` and duplicate-run admission inputs unchanged into the long-running backend entry points.
3. Long-running API start paths operate without requiring legacy globals or document-property transport helpers.
4. Long-running API start/status paths use the migrated API entry points rather than delegating back through legacy `globals.js` wrappers.
5. Start-path controller logic does not create triggers or progress records when API validation fails at the boundary.

Frontend tests:

1. None in this section.

### Section checks

- `npm test -- tests/api/<long-running-api-target>`
- `npm test -- tests/backend-api/<long-running-handler-target>`

### Implementation notes / deviations / follow-up

- **Implementation notes:** Keep API wrappers as boundary-only units.
- **Deviations from plan:** Note any method-name alignment changes.
- **Follow-up implications for later sections:** Trigger setup must persist the same ID for continuation.

---

## Section 3 — Trigger handoff for cross-call continuity

### Objective

- Propagate one `job` object across initial call, trigger setup, and trigger execution.

### Constraints

- Preserve existing locking and trigger orchestration semantics unless correctness requires changes.
- Replace document-wide run admission with assignment-scoped admission: allow concurrent runs for different `assignmentId` values while rejecting a second active run for the same `assignmentId`.
- Recreate `AssessmentRunTracker(job)` at each execution boundary from the persisted `job` payload; do not rely on in-memory tracker state surviving between frontend-start and trigger execution.
- Move assessment trigger handoff off `DocumentProperties` and onto user-scoped trigger-context storage as part of this migration.
- Update installable-trigger entry points to accept the Apps Script event object and require `triggerUid` for trigger-context lookup.

### Acceptance criteria

- Start path accepts `job`, and persists it in trigger context.
- Start path rejects a duplicate active run for the same `assignmentId` before creating a new trigger.
- Trigger context persistence uses a dedicated user-scoped store keyed by installable-trigger `triggerUid`.
- Trigger context records include the minimum execution payload required to resume the job (at least `job`, `assignmentId`, `definitionKey`, and trigger metadata needed for cleanup/diagnostics).
- Trigger-run path loads the same `job` object and uses `job.id` for all progress updates.
- Trigger-run path resolves context from the event object's `triggerUid`; `job.id` is not used as the trigger-context lookup key.
- Cleanup removes only context keys for the completed/failed job.
- Distinct IDs in overlapping runs remain isolated.
- Trigger-side cleanup keeps job-scoped progress lifecycle rules intact (no accidental deletion of active unrelated jobs).
- Frontend polling and progress lookups continue to use `job.id` only and do not depend on `triggerUid`.
- Each execution boundary constructs a fresh `AssessmentRunTracker(job)` from the resolved `job` payload, ensuring trigger continuations bind to the same `job.id` without relying on singleton execution state.
- Trigger quota-recovery and error-cleanup paths no longer remove all pending `triggerProcessSelectedAssignment` triggers; cleanup is targeted to the specific trigger/context being rolled back.
- Trigger globals/controller signatures are updated so `triggerProcessSelectedAssignment(event)` forwards the installable-trigger event into `processSelectedAssignment(event)`.

### Required test cases (Red first)

Backend controller tests:

1. Start flow persists trigger context containing the full `job` object.
2. Start flow persists trigger context in a user-scoped store keyed by the created trigger's `triggerUid`.
3. Trigger-context records are not written when trigger creation fails.
4. If trigger-context persistence fails after trigger creation, the created trigger is cleaned up so no orphaned trigger remains.
5. Trigger flow reads `triggerUid` from the event object, resolves the matching context record, and uses the embedded `job.id` for progress updates, with `name`, `type`, and `startedAt` available for downstream observability/extensions.
6. Cleanup removes scoped trigger-context records and keeps unrelated contexts intact.
7. Simulated concurrent runs with different trigger IDs and job IDs remain isolated.
8. Trigger completion/error path invokes or schedules lifecycle cleanup according to retention policy.
9. Missing or unknown `triggerUid` fails fast with explicit cleanup/logging behaviour.
10. Trigger execution reconstructs `AssessmentRunTracker(job)` from persisted context and does not depend on a pre-bound in-memory tracker instance.
11. Assessment trigger paths no longer depend on `DocumentProperties` for handoff or cleanup.
12. Trigger cleanup deletes only the launching trigger and does not remove unrelated pending assessment triggers.
13. Missing event objects, or event objects without `triggerUid`, fail fast with the same explicit cleanup/logging behaviour as unknown trigger IDs.
14. A second start attempt for the same `assignmentId` is rejected without creating or deleting any unrelated trigger.
15. Different `assignmentId` runs for the same user can coexist without trigger-context collisions.
16. The installable-trigger global wrapper forwards the raw event object unchanged to the controller entry point.
17. Trigger-context cleanup after successful completion removes trigger-routing state without deleting the completed job's progress record before its retention policy expires.

Backend utility tests:

1. Trigger helper behaviour remains correct with added context payload.
2. Trigger-context store preserves unrelated trigger records across writes and cleanup.
3. Overflow/retry paths do not remove unrelated trigger-context records or unrelated pending assessment triggers.
4. Trigger-context cleanup correctly removes stale/orphaned records according to the chosen retention policy, if such cleanup is implemented in the utility layer.

API layer tests:

1. None beyond Section 2 unless a new start method is introduced.

Frontend tests:

1. None in this section.

### Section checks

- `npm test -- tests/controllers/<assignment-controller-target>`
- `npm test -- tests/utils/<trigger-controller-target>`

### Implementation notes / deviations / follow-up

- **Implementation notes:** Keep trigger payload explicit and minimal, with `triggerUid` used only for trigger-context routing and `job.id` kept as the public job identifier.
- **Deviations from plan:** Record any constraints caused by existing property-key conventions.
- **Follow-up implications for later sections:** Frontend polling calls must provide `job.id` (or full `job` where required by endpoint contract).

---

## Section 4 — Frontend non-visual service and polling contract

### Objective

- Add frontend service/hook support for passing `job` and fetching keyed progress without GUI assets.
- Update assessment-workflow backend documentation at the same time to reflect the `AssessmentRunTracker(job)` wrapper, `job.id` progress identity, and `triggerUid` trigger-context routing model.

### Constraints

- Use `callApi` for all backend interactions.
- Keep transport parsing/retry logic centralised in `apiService`.
- Use Zod for new validation contracts and derive types via `z.infer<typeof ...>`.
- Update canonical backend docs in the same stage when tracker-construction or workflow injection patterns change; do not defer those tracker-architecture docs to final tidy-up.
- Treat React/frontend-driven API calls as the target consumer for assessment start and progress polling; legacy menu- and modal-driven flows remain reference material only.
- Treat the current React assignments page as out of scope for this phase; service contracts land now so later UI work has a stable backend boundary.

### Acceptance criteria

- Long-running start service passes the full start payload required by the backend contract, including `job` and `assignmentId`.
- Progress fetch service passes `job.id` in request params (or `job` if endpoint standardises on full-object payloads).
- Non-visual polling handler/hook stops on completed/error and maps errors to safe states.
- Frontend polling does not require or expose `triggerUid`.
- No direct `google.script.run.<method>` calls are introduced in feature/service modules.
- Backend docs explicitly describe `AssessmentRunTracker(job)` as the assessment workflow's injected tracker wrapper around `ProgressTracker`.
- Frontend service contracts treat transport `requestId` as an `apiService` concern; assessment services operate on typed `data` payloads and preserve the canonical `job.id` returned by the backend payload.

### Required test cases (Red first)

Frontend service tests:

1. Start service validates/parses the full start payload, including `job` and `assignmentId`, and calls `callApi` with the complete start params.
2. Progress service validates/parses the input and calls `callApi` with method + `job.id` params (or `job` if endpoint standardises on full-object payloads).
3. Services do not require, send, or expose `triggerUid`.
4. Services propagate `callApi` rejection unchanged.
5. Services reject malformed `job` payloads before `callApi` is invoked where schema parsing is required.
6. Services reject malformed backend payloads where schema parsing is required.
7. Service-level response parsing verifies that backend `data` preserves the canonical `job.id`; transport `requestId` handling remains covered by `apiService` tests and is not re-exposed by the assessment services.
8. Start-service response parsing verifies the backend payload returns the same canonical `job.id` that the caller supplied.
9. Progress-service parsing verifies terminal-state payloads (`completed` / `error`) match the polling contract consumed by the non-visual handler.

Frontend hook/handler tests (if introduced):

1. Polling queries by the provided `job.id`.
2. Polling stops on completed states.
3. Polling stops on error states.
4. Terminal states are not re-polled after completion/error is observed.
5. Error mapping returns safe consumer-facing states.
6. Polling cleanup cancels further polling when the consumer unmounts or otherwise disposes the handler, if a hook/handler abstraction is introduced.
7. Polling never surfaces or depends on `triggerUid`, even when backend progress responses include trigger-related diagnostics internally.
8. Polling ignores stale in-flight responses after disposal or after a terminal state has already been observed.

Backend tests:

1. None in this section.

Documentation checks:

1. Update `docs/developer/backend/AssessmentFlow.md` to describe the assessment workflow using `AssessmentRunTracker(job)` instead of an implicitly shared singleton tracker.
2. Update `docs/developer/backend/AssessmentFlow.md` to separate trigger-context routing (`triggerUid`) from progress identity (`job.id`).
3. Update `docs/developer/backend/api-layer.md` if the stage changes the documented tracker or polling contract.

### Section checks

- `npm run frontend:test -- src/frontend/src/services/<progress-service-target>.spec.ts`
- `npm run frontend:test -- src/frontend/src/features/<progress-handler-target>.spec.ts`

### Implementation notes / deviations / follow-up

- **Implementation notes:** Keep this delivery non-visual; UI work follows later.
- **Deviations from plan:** Record any shared error-mapping utility additions and any temporary compatibility shims required while migrating from direct `ProgressTracker.getInstance()` calls to `AssessmentRunTracker`.
- **Follow-up implications for later sections:** Future UI can consume these typed contracts directly.

---

## Section 5 — Regression and contract hardening

### Objective

- Validate end-to-end job-scoped progress tracking for long-running flows without transport regressions.

### Constraints

- Run focused suites first, then lint.
- Avoid unrelated refactors during hardening.

### Acceptance criteria

- New/updated backend tests for keyed progress, API validation, and trigger propagation pass.
- New/updated frontend service/handler tests pass.
- Backend and frontend lint pass for touched files (or environment limitations are documented).
- Existing short-running API method behaviour remains stable.
- Lifecycle and cleanup semantics are implemented and verified (including retention boundaries).
- Assessment workflow docs have been updated in-step with the tracker architecture change rather than left as end-only follow-up.
- Same-`assignmentId` duplicate-run rejection is implemented and verified, while different-`assignmentId` runs remain isolated.

### Required test cases/checks

1. Run touched backend singleton/utility tests for keyed progress behaviour.
2. Run touched backend API tests for `job` contract behaviour.
3. Run touched backend controller tests for trigger propagation.
4. Run touched frontend service/hook tests for request wiring and polling semantics.
5. Run `npm run lint`.
6. Run `npm run frontend:lint`.
7. Run `npm exec tsc -- -b src/frontend/tsconfig.json` if frontend TypeScript files were touched.
8. Run `npm run builder:lint` only if builder files were touched.
9. Manually verify method-name parity between frontend constants and backend `API_METHODS`.
10. Verify tracker-architecture documentation changes landed alongside the implementation stage that introduced `AssessmentRunTracker`.
11. Verify the assessment workflow no longer uses direct `ProgressTracker.getInstance()` lookups once `AssessmentRunTracker` injection is in place.
12. Verify assessment-flow request batching no longer depends on reading current tracker state merely to append progress text.
13. Verify the migrated trigger path no longer bulk-deletes pending assessment triggers during quota recovery or missing-context cleanup.

### Section checks

- Run the commands listed above and ensure green results.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Summarise final contract alignment fixes.
- **Deviations from plan:** Document any unrelated failures discovered.

---

## Documentation and rollout notes

### Objective

- Keep canonical docs aligned with job-scoped long-running progress tracking, while recognising that major tracker-architecture documentation must be updated during the relevant implementation stages rather than deferred to the end.

### Constraints

- Update only relevant canonical docs.
- Keep AGENTS files as signposts.

### Acceptance criteria

- Backend docs distinguish transport `requestId` from long-running `job.id` within the `job` object.
- Backend docs describe user-scoped keyed progress persistence and cleanup expectations.
- Backend docs describe trigger-context routing separately from progress identity: `triggerUid` is internal trigger-handoff state, while `job.id` is the canonical job identifier for progress and polling.
- Backend docs describe `AssessmentRunTracker(job)` as the assessment-flow wrapper responsible for binding `job.id` to the generic `ProgressTracker` service.
- Frontend docs remain aligned with `callApi` boundaries and error-handling policy.

### Required checks

1. Verify `docs/developer/backend/api-layer.md` documents the `job` object contract (`id`, `name`, `type`, `startedAt`) for long-running methods.
2. Verify relevant backend flow docs reflect trigger handoff keyed by `triggerUid` and progress keying by `job.id`.
3. Verify relevant backend flow docs reflect `AssessmentRunTracker(job)` injection points across the assessment workflow.
4. Verify relevant backend flow docs reflect trigger handoff, user-scoped progress keying, and single-key map storage semantics.
5. Verify frontend docs remain aligned with non-visual service-level integration, `job.id` polling, transport-envelope handling in `apiService`, and error mapping.
6. Confirm this action plan remains accurate as implementation progresses.

### Implementation notes / deviations / follow-up

- Record documentation updates completed during implementation and any deferred updates.

---

## Suggested implementation order

1. Section 0: Shared keyed `UserProperties` store model
2. Section 1: ProgressTracker keyed persistence in `UserProperties`, `AssessmentRunTracker(job)` introduction, and downstream tracker-injection refactor foundation
3. Section 2: API contract and validation
4. Section 3: Trigger handoff propagation and assignment-scoped duplicate-run admission
5. Section 4: Frontend non-visual service/handler wiring and in-step documentation updates
6. Section 5: Regression and hardening
7. Documentation and rollout notes
