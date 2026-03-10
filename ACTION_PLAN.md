# Feature Delivery Plan (TDD-First)

## Scope and assumptions

### Scope

- Implement job-scoped tracking for long-running backend operations using `jobTrackingId`.
- Keep `apiHandler` transport behaviour unchanged, including backend-owned envelope `requestId`.
- Update long-running backend entry points to accept and propagate `jobTrackingId` end-to-end.
- Update `ProgressTracker` persistence to support keyed records by `jobTrackingId` in `UserProperties`.
- Add frontend non-visual service support for passing `jobTrackingId` and polling keyed progress.
- Add and run targeted backend/frontend tests for validation, propagation, and error handling.

### Out of scope

- Creating visible frontend progress UI components.
- Refactoring unrelated short-running endpoints to require tracking IDs.
- Replacing API admission-control request lifecycle tracking in `requestStore`.
- Broad architectural refactors unrelated to long-running progress scoping.

### Assumptions

1. `jobTrackingId` is required for long-running tracked operations and optional/unused for short-running calls.
2. Frontend may generate `jobTrackingId`, but backend validates it and remains the authority.
3. Progress data is job-scoped and stored in user-scoped durable storage (`UserProperties`), keyed by `jobTrackingId`.
4. Multiple tracked jobs per user are supported and must not overwrite each other.
5. Legacy AdminSheet progress polling is reference-only and not part of this implementation target.
6. Progress record lifecycle must be explicit: completed/error records are retained for a bounded period and then removed by deterministic cleanup.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API and globals wrappers thin; delegate behavioural logic to controller/utility layers.
- Fail fast for invalid or missing `jobTrackingId` where long-running tracking is required.
- Treat a valid `jobTrackingId` as a canonical UUID string (36 chars, lowercase/uppercase hex plus hyphens in 8-4-4-4-12 format).
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

## Section 1 — ProgressTracker keyed persistence in UserProperties

### Objective

- Update `ProgressTracker` to persist and read progress records keyed by `jobTrackingId`.

### Constraints

- Retain `ProgressTracker` as the singleton façade.
- Do not introduce a new persistence abstraction unless blocked.
- Ensure keying strategy is deterministic and safe for Apps Script property storage.

### Acceptance criteria

- Progress start/update/complete/error operations target a key derived from `jobTrackingId`.
- `getStatus` (or equivalent) reads by `jobTrackingId` and never cross-reads another job’s data.
- Persistence uses `PropertiesService.getUserProperties()` for keyed progress records.
- Long-running operations fail fast when `jobTrackingId` is missing/invalid.
- Progress retention and cleanup are explicit (for example TTL-based pruning for completed/error jobs).
- `ProgressTracker.complete()` side effects that currently serialise `DocumentProperties` are explicitly reviewed and either removed, adapted, or documented as intentionally retained.

### Required test cases (Red first)

Backend utility/singleton tests:

1. `startTracking(jobTrackingId)` writes to the expected user property key.
2. `updateProgress(...)` updates only the matching keyed record.
3. `complete()` marks only the matching keyed record complete.
4. `logError()`/`logAndThrowError()` only mutate the keyed record.
5. Reading `jobTrackingId=A` never returns data from `jobTrackingId=B`.
6. Missing/invalid ID path throws for tracked flows.
7. Completed/error records older than configured retention threshold are pruned while active records remain.
8. Behaviour of `complete()` document-property serialisation branch is verified against the chosen migration decision.

API layer tests:

1. None in this section.

Frontend tests:

1. None in this section.

### Section checks

- `npm test -- tests/singletons/<progress-tracker-target>`
- `npm test -- tests/utils/<progress-tracker-target>`

### Implementation notes / deviations / follow-up

- **Implementation notes:** Keep method names and call patterns as close as possible to existing usages.
- **Deviations from plan:** Record any compatibility shims required for existing callers.
- **Follow-up implications for later sections:** API/trigger layers must consistently provide `jobTrackingId`.

---

## Section 2 — API contract and validation for long-running tracking

### Objective

- Extend long-running API methods to accept `params.jobTrackingId` and validate it.

### Constraints

- Preserve existing `apiHandler` transport envelope and backend-owned `requestId` semantics.
- Keep dispatcher branches thin and aligned with `API_METHODS` constants.

### Acceptance criteria

- Long-running methods require and validate `params.jobTrackingId`.
- Invalid `jobTrackingId` produces existing structured invalid-request envelopes.
- Successful responses keep existing `{ ok, requestId, data }` envelope contract.
- Non-long-running methods continue to behave unchanged.
- API validation rules for `jobTrackingId` are documented and shared across backend/frontend tests.

### Required test cases (Red first)

Backend API tests:

1. Dispatcher routes long-running method with valid `jobTrackingId`.
2. Missing `jobTrackingId` returns structured invalid request.
3. Malformed `jobTrackingId` returns structured invalid request.
4. Success path preserves transport `requestId` and returns method `data`.
5. Existing short-running method tests remain green.
6. Non-UUID values (wrong length/pattern) are rejected consistently.

Backend controller/global tests:

1. API layer forwards exact `jobTrackingId` into long-running backend entry points.

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

- Propagate one `jobTrackingId` across initial call, trigger setup, and trigger execution.

### Constraints

- Preserve existing locking and trigger orchestration semantics unless correctness requires changes.
- Avoid global document-context collisions for concurrent jobs.

### Acceptance criteria

- Start path accepts `jobTrackingId` and persists it in trigger context.
- Trigger-run path loads the same ID and uses it for all progress updates.
- Cleanup removes only context keys for the completed/failed job.
- Distinct IDs in overlapping runs remain isolated.
- Trigger-side cleanup keeps job-scoped progress lifecycle rules intact (no accidental deletion of active unrelated jobs).

### Required test cases (Red first)

Backend controller tests:

1. Start flow persists trigger context containing `jobTrackingId`.
2. Trigger flow reads `jobTrackingId` and uses it in progress updates.
3. Cleanup removes scoped context and keeps unrelated contexts intact.
4. Simulated concurrent runs with different IDs remain isolated.
5. Trigger completion/error path invokes or schedules lifecycle cleanup according to retention policy.

Backend utility tests:

1. Trigger helper behaviour remains correct with added context payload.

API layer tests:

1. None beyond Section 2 unless a new start method is introduced.

Frontend tests:

1. None in this section.

### Section checks

- `npm test -- tests/controllers/<assignment-controller-target>`
- `npm test -- tests/utils/<trigger-controller-target>`

### Implementation notes / deviations / follow-up

- **Implementation notes:** Keep trigger payload explicit and minimal.
- **Deviations from plan:** Record any constraints caused by existing property-key conventions.
- **Follow-up implications for later sections:** Frontend polling calls must provide `jobTrackingId`.

---

## Section 4 — Frontend non-visual service and polling contract

### Objective

- Add frontend service/hook support for passing `jobTrackingId` and fetching keyed progress without GUI assets.

### Constraints

- Use `callApi` for all backend interactions.
- Keep transport parsing/retry logic centralised in `apiService`.
- Use Zod for new validation contracts and derive types via `z.infer<typeof ...>`.

### Acceptance criteria

- Long-running start service passes `jobTrackingId` in request params.
- Progress fetch service passes `jobTrackingId` in request params.
- Non-visual polling handler/hook stops on completed/error and maps errors to safe states.
- No direct `google.script.run.<method>` calls are introduced in feature/service modules.

### Required test cases (Red first)

Frontend service tests:

1. Start service calls `callApi` with method + `jobTrackingId` params.
2. Progress service calls `callApi` with method + `jobTrackingId` params.
3. Service propagates `callApi` rejection unchanged.
4. Service rejects malformed payloads where schema parsing is required.

Frontend hook/handler tests (if introduced):

1. Polling queries by the provided `jobTrackingId`.
2. Polling stops on completed/error states.
3. Error mapping returns safe consumer-facing states.

Backend tests:

1. None in this section.

### Section checks

- `npm run frontend:test -- src/frontend/src/services/<progress-service-target>.spec.ts`
- `npm run frontend:test -- src/frontend/src/features/<progress-handler-target>.spec.ts`

### Implementation notes / deviations / follow-up

- **Implementation notes:** Keep this delivery non-visual; UI work follows later.
- **Deviations from plan:** Record any shared error-mapping utility additions.
- **Follow-up implications for later sections:** Future UI can consume these typed contracts directly.

---

## Section 5 — Regression and contract hardening

### Objective

- Validate end-to-end request-scoped progress tracking for long-running flows without transport regressions.

### Constraints

- Run focused suites first, then lint.
- Avoid unrelated refactors during hardening.

### Acceptance criteria

- New/updated backend tests for keyed progress, API validation, and trigger propagation pass.
- New/updated frontend service/handler tests pass.
- Backend and frontend lint pass for touched files (or environment limitations are documented).
- Existing short-running API method behaviour remains stable.
- Lifecycle and cleanup semantics are implemented and verified (including retention boundaries).

### Required test cases/checks

1. Run touched backend singleton/utility tests for keyed progress behaviour.
2. Run touched backend API tests for `jobTrackingId` contract behaviour.
3. Run touched backend controller tests for trigger propagation.
4. Run touched frontend service/hook tests for request wiring and polling semantics.
5. Run `npm run lint`.
6. Run `npm run frontend:lint`.
7. Run `npm run builder:lint` only if builder files were touched.
8. Manually verify method-name parity between frontend constants and backend `API_METHODS`.

### Section checks

- Run the commands listed above and ensure green results.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Summarise final contract alignment fixes.
- **Deviations from plan:** Document any unrelated failures discovered.

---

## Documentation and rollout notes

### Objective

- Keep canonical docs aligned with request-scoped long-running progress tracking.

### Constraints

- Update only relevant canonical docs.
- Keep AGENTS files as signposts.

### Acceptance criteria

- Backend docs distinguish transport `requestId` from long-running `jobTrackingId`.
- Backend docs describe user-scoped keyed progress persistence and cleanup expectations.
- Frontend docs remain aligned with `callApi` boundaries and error-handling policy.

### Required checks

1. Verify `docs/developer/backend/api-layer.md` documents `jobTrackingId` for long-running methods.
2. Verify relevant backend flow docs reflect trigger handoff and user-scoped progress keying.
3. Verify frontend docs remain aligned with non-visual service-level integration and error mapping.
4. Confirm this action plan remains accurate as implementation progresses.

### Implementation notes / deviations / follow-up

- Record documentation updates completed during implementation and any deferred updates.

---

## Suggested implementation order

1. Section 1: ProgressTracker keyed persistence in `UserProperties`
2. Section 2: API contract and validation
3. Section 3: Trigger handoff propagation
4. Section 4: Frontend non-visual service/handler wiring
5. Section 5: Regression and hardening
6. Documentation and rollout notes
