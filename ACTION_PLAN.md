# Frontend→Backend API Wrapper and Concurrency Control Action Plan

## Objective

Introduce a single, typed frontend API wrapper and a backend API dispatcher that together:

- route all frontend backend calls through one contract (`apiHandler(method, params)`),
- track per-user execution lifecycle in Google Apps Script `UserProperties`,
- enforce a practical concurrent execution ceiling before GAS limits are exceeded,
- return structured rate-limit errors so the frontend can retry with exponential backoff,
- preserve thin API-layer delegation and fail-fast behaviour.

## Scope

### In scope

- Frontend service-layer wrapper for all `google.script.run` calls.
- Backend `apiHandler` dispatcher in `src/backend/Api`.
- User-scoped execution tracking (`started`/`success`/`error`) with UUID + timestamps.
- Stale-entry pruning for calls older than 15 minutes.
- Admission control (allow/reject before execution begins).
- Retry strategy in frontend for rate-limited responses.
- Unit tests for frontend wrapper and backend API handler behaviour.

### Out of scope

- Migrating every existing frontend call in one pass (use incremental migration).
- Deep business logic refactors in controllers/services.
- New features in deprecated areas (`src/AdminSheet`, `src/AssessmentRecordTemplate`).

## Assumptions

1. The concurrency guard is intended to be per user session context (aligned with `UserProperties`).
2. The immediate target is user-level throttling only (not global throttling), aligned to GAS per-user request constraints.
3. A conservative per-user threshold lower than hard limits is acceptable (use `ACTIVE_LIMIT = 25` active calls rather than the hard limit of 30, leaving some headroom for other script activity).
4. Lock critical sections are expected to be short enough for a 1 second acquisition timeout when scoped to state updates only.

## Design Principles Applied

- Keep API-layer functions thin and stable.
- Fail fast on unknown methods or invalid payloads.
- Never silently swallow errors.
- Keep changes localised and incremental.
- Use explicit contracts for request and response envelopes.

## Execution Rules

- Complete each numbered section in order unless a dependency forces a small deviation.
- Do not start the next section until the current section's acceptance criteria are met.
- Run the required tests for the section before moving on.
- Record any implementation deviations, compromises, or follow-up work in the section's implementation notes area.
- Commit the completed changes for each section before starting the next section.

## Target Architecture

## 1) Frontend wrapper (`src/frontend/src/services/apiService.ts`)

Create a reusable promise-based helper with this logical contract:

- `callApi<TResponse>(method: string, params?: unknown): Promise<TResponse>`

Contract definition approach:

- Define frontend request/response schemas with `zod` in the service layer.
- Use `z.infer` to derive TypeScript types from those schemas so validation and typing stay aligned.
- Keep these schemas local to the frontend API boundary rather than coupling frontend types to backend runtime files.

Responsibilities:

- Validate `google.script.run` availability.
- Send a structured request to backend `apiHandler`.
- Parse structured success/error responses.
- Retry only on explicit rate-limit responses.
- Implement bounded exponential backoff with jitter.

Recommended response envelope shape:

- Success: `{ ok: true, requestId, data, meta }`
- Failure: `{ ok: false, requestId, error: { code, message, retriable }, meta }`

Suggested frontend schema set:

- `ApiRequestSchema`
- `ApiSuccessResponseSchema`
- `ApiErrorResponseSchema`
- `ApiResponseSchema` (union)

Use this wrapper from feature-specific services (for example `authService`) so feature code remains simple. `authService` should remain a thin module and only change its transport path from direct `google.script.run.<method>` calls to `google.script.run.apiHandler(request)`.

`apiService` should stay transport-focused only. It does not need to fetch or cache auth state internally.

Actionable steps:

1. Create `apiService.ts` in the frontend service layer and define the public `callApi<TResponse>(method, params?)` entry point.
2. Add local `zod` schemas for request, success envelope, error envelope, and the response union.
3. Validate the request payload before invoking `google.script.run.apiHandler`.
4. Validate that `google.script.run` and `google.script.run.apiHandler` are available before attempting transport.
5. Wrap `google.script.run` callback-style behaviour in a promise so feature services receive a normal async interface.
6. Parse backend responses through the response schema and reject malformed envelopes immediately.
7. Keep retry orchestration out of feature services; the wrapper should own transport-level retry decisions.
8. Leave feature-specific shaping to callers so `apiService` remains generic and reusable.

Required test cases:

- Returns parsed `data` when the backend responds with a valid success envelope.
- Rejects when `google.script.run` is unavailable.
- Rejects when `apiHandler` is unavailable on `google.script.run`.
- Rejects when the request payload fails schema validation before transport.
- Rejects when the backend returns a malformed success envelope.
- Rejects when the backend returns a malformed error envelope.
- Preserves backend `requestId` and error metadata in thrown transport errors.

Acceptance criteria:

- All frontend backend calls can be routed through `callApi` without requiring direct `google.script.run.<method>` access.
- Request and response validation happens at the frontend API boundary.
- The wrapper exposes a promise-based contract that is straightforward for feature services to consume.
- Invalid transport availability or malformed envelopes fail fast with clear errors.

Constraints:

- Keep schemas local to the frontend boundary; do not import backend runtime files into the frontend bundle.
- Do not add auth-specific state, caching, or feature logic into `apiService`.
- Preserve existing frontend service conventions and avoid broad refactors.
- Use British English in new comments and user-facing text.

Implementation notes:

- Completed 2026-03-06.
- Added `src/frontend/src/services/apiService.ts` with local `zod` request/response schemas (`ApiRequestSchema`, success/error envelope schemas, and response union) and a promise-based `callApi<TResponse>(method, params?)` transport wrapper around `google.script.run.apiHandler`.
- Added `ApiTransportError` to preserve backend `requestId`, `code`, `message`, `retriable`, and `meta` when backend returns a structured failure envelope.
- Added `src/frontend/src/services/apiService.test.ts` covering all required Section 1 test cases.
- Review loop note: test typing initially conflicted with existing global `google` declarations, so tests were adjusted to use local helper casting (`setGoogle`/`clearGoogle`) instead of ambient global redeclarations.
- Deviation note: to satisfy strict response-shape validation, success envelopes now explicitly require a present `data` property via schema refinement.

Commit checkpoint:

- Commit this section after the wrapper and its required tests pass.

## 2) Backend dispatcher (`src/backend/Api/apiHandler.js`)

Add a new GAS-global function:

- `apiHandler(request)`

Implementation shape:

- Keep `apiHandler` as a thin GAS global wrapper.
- Delegate to a singleton dispatcher class (for example `ApiDispatcher extends BaseSingleton`).
- Use `ApiDispatcher.getInstance().handle(request)` from the wrapper.

Request shape:

- `{ method: string, params?: object, requestId?: string }`

Responsibilities:

- Validate request payload.
- Resolve method through an explicit allowlist map (no dynamic invocation).
- Perform admission control before dispatch.
- Track lifecycle in `UserProperties` using UUID and timestamps.
- Return structured success/failure envelope.

Rationale for singleton use:

- Keeps API dispatch state and helpers encapsulated in one runtime-local instance.
- Preserves existing project singleton conventions (`BaseSingleton` + `getInstance`).
- Avoids replacing GAS global function entry points required by `google.script.run`.

Allowlist storage:

- Store API method names and execution limits in a dedicated constants file next to the dispatcher, for example `src/backend/Api/apiConstants.js`.
- Keep the allowlist as the single source of truth for methods exposed through `apiHandler`.

Initial allowlist approach:

- `getAuthorisationStatus -> getAuthorisationStatus`
- Additional methods added incrementally as frontend migration proceeds.

Suggested constants in `apiConstants.js`:

- `API_METHODS`
- `ACTIVE_LIMIT = 25`
- `MAX_TRACKED_REQUESTS = 30`
- `STALE_REQUEST_AGE_MS = 15 * 60 * 1000`
- `USER_REQUEST_STORE_KEY`

Actionable steps:

1. Add a GAS-global `apiHandler(request)` entry point in `src/backend/Api`.
2. Implement an `ApiDispatcher` singleton that owns request validation, allowlist dispatch, lifecycle tracking, and envelope mapping.
3. Create `apiConstants.js` to hold the allowlist, limits, and storage key constants.
4. Validate that `request` is an object and that `method` is a non-empty string before dispatch.
5. Generate or normalise `requestId` at the dispatcher boundary so every response has a stable identifier.
6. Resolve handlers through an explicit allowlist map only; do not dynamically invoke globals by string.
7. Return structured success and failure envelopes from `handle(request)`.
8. Keep the GAS wrapper thin by delegating all logic to the dispatcher singleton.

Required test cases:

- Accepts a valid request and returns a success envelope for an allowlisted method.
- Rejects `null`, primitives, arrays, or malformed objects as invalid requests.
- Rejects missing or blank `method` values.
- Returns `UNKNOWN_METHOD` for a method not present in the allowlist.
- Preserves a caller-supplied `requestId` when one is provided.
- Generates a new `requestId` when one is omitted.
- Ensures the GAS-global wrapper delegates to `ApiDispatcher.getInstance().handle(request)`.

Acceptance criteria:

- `apiHandler` is the single supported backend entry point for frontend-originated API calls.
- Method dispatch is allowlist-driven and cannot invoke arbitrary backend functions.
- Every response envelope includes `ok` and `requestId`, with either `data` or `error`.
- Request validation failures are surfaced as structured failures rather than untyped runtime crashes.

Constraints:

- Keep the dispatcher thin and transport-focused; do not move business logic out of existing backend modules.
- Follow existing singleton conventions already used in `src/backend`.
- Keep constants in a dedicated API-layer file so the allowlist remains the source of truth.
- Do not add new behaviour in deprecated source trees.

Implementation notes:

Commit checkpoint:

- Commit this section after dispatcher validation, allowlist behaviour, and wrapper delegation tests pass.

## 3) Execution tracking store (backend utility in API layer)

Use `PropertiesService.getUserProperties()` to store per-user invocation records.

Each invocation record should include:

- `requestId` (UUID)
- `method`
- `status` (`started` | `success` | `error`)
- `startedAtMs`
- `finishedAtMs` (when complete)
- `errorMessage` (when failed)

Storage strategy:

- Keep one key in user properties which stores a POJO with all of the user's invocations, keyed by `requestId`. This minimises retrieval time as there's only one value to retrieve.
- Cap retained entries with `MAX_TRACKED_REQUESTS = 30`, matching the per-user concurrent GAS request ceiling.
- When compaction is needed, prefer dropping the oldest completed entries first and always preserve currently active entries.

Actionable steps:

1. Add an API-layer tracking utility responsible for loading, normalising, updating, and persisting the request store.
2. Store request records under a single `USER_REQUEST_STORE_KEY` entry in `UserProperties`.
3. Represent records as a POJO keyed by `requestId` so single-record updates remain simple.
4. Record `requestId`, `method`, `status`, `startedAtMs`, optional `finishedAtMs`, and optional `errorMessage`.
5. Normalise missing or malformed stored state to an empty POJO rather than allowing downstream mutation logic to operate on invalid data.
6. Add compaction logic that keeps active entries first and removes the oldest completed entries when the cap is exceeded.
7. Keep persistence payloads metadata-only and avoid storing request params or other sensitive values.

Required test cases:

- Creates a new `started` record with the expected fields.
- Marks a request as `success` and stores `finishedAtMs`.
- Marks a request as `error` and stores both `finishedAtMs` and `errorMessage`.
- Reads an empty store when the property is absent.
- Recovers safely when stored JSON is malformed or not an object.
- Compacts the store by removing oldest completed entries before active entries.
- Preserves active entries even when the store reaches `MAX_TRACKED_REQUESTS`.

Acceptance criteria:

- Request lifecycle metadata is persisted and retrievable through a single user property key.
- Store reads and writes are deterministic and safe against malformed persisted state.
- Compaction never drops active requests while completed requests remain removable.
- Stored data remains compact and limited to operational metadata.

Constraints:

- Use `PropertiesService.getUserProperties()` only; do not introduce a second persistence store.
- Keep the record format serialisable in plain GAS JSON storage.
- Do not store sensitive payload data or full error objects.
- Keep helper behaviour local to the API layer.

Implementation notes:

Commit checkpoint:

- Commit this section after lifecycle persistence and compaction tests pass.

## 4) Atomicity and race-condition prevention

Wrap read-modify-write tracking operations with `LockService.getUserLock()`.

Lock policy:

- Use `tryLock(1000)` (1 second timeout) for lock acquisition.
- Lock only for short state transitions; never hold lock while running business logic.
- If lock acquisition fails, return a structured rate-limit style response (`RATE_LIMITED`, `retriable: true`) so frontend retry policy can handle temporary contention.
- Keep the implementation lightweight: no extra fallback path is required for oversized histories because the store is capped to a small number of entries.

Critical sections:

- prune stale entries,
- compute active count,
- register new `started` entry,
- mark completion/failure.

Always release locks in `finally` blocks.

Execution sequence:

1. Acquire user lock, prune + count + register `started`, then release.
2. Execute requested allowlisted method with no lock held.
3. Re-acquire user lock, mark `success`/`error`, prune compactly, then release.

Actionable steps:

1. Introduce lock-scoped helpers for the admission phase and completion phase.
2. Acquire `LockService.getUserLock()` with `tryLock(1000)` before any tracking store mutation.
3. Measure lock wait duration and state update duration around each critical section.
4. Ensure the admission phase performs prune, active-count calculation, and `started` registration within one lock window.
5. Release the lock before invoking the allowlisted backend method.
6. Re-acquire the lock after execution to mark `success` or `error`, then compact and persist.
7. Use `finally` blocks for every lock-held code path so locks are always released.
8. Convert lock acquisition failure into a structured rate-limit style response path.

Required test cases:

- Admission updates occur atomically within a single lock-protected path.
- Completion updates occur atomically within a second lock-protected path.
- The requested backend method executes outside the lock-held section.
- Lock release occurs when method execution succeeds.
- Lock release occurs when method execution throws.
- Lock acquisition failure produces the expected rate-limit style error.
- Completion-phase errors do not leave the lock held.

Acceptance criteria:

- Request tracking mutations are protected from read-modify-write races.
- Business logic is never executed while the user lock is held.
- Lock failures degrade into structured retriable responses rather than silent contention.
- Lock lifecycle handling is explicit, bounded, and observable.

Constraints:

- Use `LockService.getUserLock()` only for short state transitions.
- Do not hold locks across network calls, controller execution, or any other business logic.
- Keep the timeout at 1 second unless the action plan is explicitly amended.
- Avoid adding fallback storage paths or alternate lock strategies in this phase.

Implementation notes:

Commit checkpoint:

- Commit this section after lock lifecycle, release, and timeout tests pass.

## 5) Stale-entry pruning and admission control

Before counting active executions:

- remove entries with `startedAtMs` older than 15 minutes,
- treat unresolved `started` entries older than threshold as abandoned,
- delete abandoned entries immediately and log the pruning event via `ABLogger`.

Admission decision:

- if `activeCount >= ACTIVE_LIMIT`, return rate-limit envelope immediately,
- include `retriable: true`.

Actionable steps:

1. Add a stale-pruning helper that evaluates every persisted request against `STALE_REQUEST_AGE_MS`.
2. Remove unresolved `started` entries older than the stale threshold before calculating active count.
3. Log each stale-pruning event through `ABLogger` with request metadata only.
4. Calculate `activeCount` from the remaining unresolved `started` entries.
5. Reject new execution when `activeCount >= ACTIVE_LIMIT`.
6. Return a structured failure envelope that marks the response as retriable when admission is denied.
7. Ensure pruning runs during admission and again during completion compaction so the store stays small.

Required test cases:

- Removes `started` entries older than 15 minutes before counting active requests.
- Leaves recent `started` entries untouched.
- Leaves completed entries untouched unless compaction rules remove them.
- Logs stale-pruning events when abandoned requests are removed.
- Returns `RATE_LIMITED` when active count equals the configured limit.
- Returns `RATE_LIMITED` when active count exceeds the configured limit.
- Returns a retriable failure envelope without invoking the target method when admission is denied.

Acceptance criteria:

- Active-count calculations ignore abandoned requests older than the stale threshold.
- New requests are rejected before dispatch when the per-user active limit is reached.
- Rate-limited responses carry enough metadata for the frontend retry policy to act safely.
- Pruning keeps the request store operationally bounded over time.

Constraints:

- Use the configured stale threshold of 15 minutes.
- Keep admission control strictly per-user; do not introduce global throttling.
- Keep pruning logs concise and free of sensitive request payload data.
- Do not invoke the allowlisted method when admission has already failed.

Implementation notes:

Commit checkpoint:

- Commit this section after stale-pruning and admission-control tests pass.

## 6) Error model and frontend retry policy

Backend should emit clear error codes, e.g.:

- `RATE_LIMITED`
- `UNKNOWN_METHOD`
- `INVALID_REQUEST`
- `INTERNAL_ERROR`

Error type analysis and design:

Existing error types in `src/backend/Utils/ErrorTypes`:

- `AbortRequestError` (HTTP-specific) — statusCode, url, responseText. **Not reusable**: too specific to HTTP failure scenarios.
- `PersistError` (persistence-specific) — message, cause, key. **Not reusable**: specific to property-write failures.

New API-layer error types needed (`src/backend/Utils/ErrorTypes/`):

1. **`ApiRateLimitError`** (extends Error)
   - Used when: user's active execution count reaches `ACTIVE_LIMIT` during admission control.
   - Fields: `requestId`, `method`, `activeCount`, `limit`.
   - Maps to response code: `RATE_LIMITED`.
   - Frontend behaviour: retriable with exponential backoff.

2. **`ApiValidationError`** (extends Error)
   - Used when: request payload fails schema validation (missing required fields, invalid types).
   - Fields: `requestId`, `method`, `fieldName` (optional), `details`.
   - Maps to response code: `INVALID_REQUEST`.
   - Frontend behaviour: not retriable (fix request payload and retry manually).

3. **`ApiDisabledError`** (extends Error)
   - Used when: method name is not in the allowlist.
   - Fields: `requestId`, `method` (the invalid method name).
   - Maps to response code: `UNKNOWN_METHOD`.
   - Frontend behaviour: not retriable (method is not available).

4. **Standard `Error`** for catch-all internal failures
   - Used when: method execution throws an unexpected error.
   - Maps to response code: `INTERNAL_ERROR`.
   - Frontend behaviour: not retriable; surfaced to user as unrecoverable.
   - Keep original error details in `cause` chain for dev logging via `ABLogger`.

Custom error compatibility note:

- Do not rely on the runtime automatically wiring `Error.cause`.
- For custom API-layer errors, accept an optional `cause` argument and assign `this.cause = cause || null` explicitly in the constructor so behaviour is consistent in GAS and tests.

Dispatcher boundary (error mapping):

- Wrap all error creation using a centralised error-to-envelope mapper in `ApiDispatcher.handle()`.
- This ensures consistent error code → serialised response mapping in one place.
- The mapper translates caught errors to structured response envelopes without exposing internal error objects to frontend.

Keep serialisation lightweight:

- Error envelopes should expose only the fields the frontend needs: `code`, `message`, and `retriable`.
- Do not serialise stack traces or nested error objects across the frontend boundary.
- Keep richer diagnostics in backend logging only.

Example mapper logic:

```javascript
const errorCodeMap = {
  ApiRateLimitError: 'RATE_LIMITED',
  ApiValidationError: 'INVALID_REQUEST',
  ApiDisabledError: 'UNKNOWN_METHOD',
  Error: 'INTERNAL_ERROR', // catch-all for unexpected errors
};
```

Frontend retry policy:

- retry only when `error.code === 'RATE_LIMITED'` and `retriable === true`,
- exponential backoff with jitter,
- fixed max attempts (for example 4-6),
- fail with final surfaced error after exhaustion.

Actionable steps:

1. Add `ApiRateLimitError`, `ApiValidationError`, and `ApiDisabledError` to `src/backend/Utils/ErrorTypes/`.
2. Ensure each custom error explicitly assigns `this.cause = cause || null` for GAS compatibility.
3. Centralise error-to-envelope mapping inside `ApiDispatcher.handle()`.
4. Map allowlist failures to `UNKNOWN_METHOD`, validation failures to `INVALID_REQUEST`, rate limits to `RATE_LIMITED`, and unexpected failures to `INTERNAL_ERROR`.
5. Keep serialised frontend error payloads limited to `code`, `message`, and `retriable`.
6. Add bounded exponential backoff with jitter in the frontend wrapper.
7. Retry only when the backend explicitly marks the response as retriable rate limiting.
8. Surface the final backend or transport error cleanly once retry attempts are exhausted.

Required test cases:

- `ApiRateLimitError` maps to a `RATE_LIMITED` error envelope.
- `ApiValidationError` maps to an `INVALID_REQUEST` error envelope.
- `ApiDisabledError` maps to an `UNKNOWN_METHOD` error envelope.
- Unexpected errors map to an `INTERNAL_ERROR` error envelope.
- Custom errors preserve an explicit `cause` property.
- Frontend retries rate-limited responses until success within the max attempt budget.
- Frontend stops retrying when `retriable` is false.
- Frontend stops retrying when the error code is not `RATE_LIMITED`.
- Frontend surfaces the final error after retry exhaustion.

Acceptance criteria:

- Backend errors are translated into a stable, minimal envelope contract.
- Frontend retry behaviour is driven entirely by backend error metadata.
- Non-retriable or unknown failures fail fast without repeated backend calls.
- Error diagnostics remain rich in backend logging while serialisation across the frontend boundary stays minimal.

Constraints:

- Do not serialise stack traces, raw causes, or nested backend error objects to the frontend.
- Do not retry validation, disabled-method, or internal-error responses.
- Keep retry attempts bounded and jittered to avoid amplifying load.
- Preserve existing fail-fast behaviour for malformed responses and unexpected transport failures.

Implementation notes:

Commit checkpoint:

- Commit this section after backend error-mapping and frontend retry-policy tests pass.

## 7) Lock timing observability and logging

Use existing `ABLogger` infrastructure for lightweight instrumentation rather than introducing a new logging framework.

Track and log for each lock-protected phase:

- `phase` (`admission` | `completion`)
- `requestId`
- `method`
- `lockWaitMs` (time spent waiting for lock acquisition)
- `stateUpdateMs` (time spent inside critical section)
- `totalPhaseMs`

Logging behaviour:

- Use `ABLogger.getInstance().info(...)` for normal lock timing diagnostics.
- Use `ABLogger.getInstance().warn(...)` when lock wait exceeds an operational threshold (for example 300ms).
- Keep logs concise and metadata-focused (no sensitive payload data).
- Implement timing with simple timestamp capture around the lock acquisition and state update code paths; no logger API expansion is required.

Operational purpose:

- Validate whether 1 second lock timeout remains appropriate over time.
- Detect contention hotspots early before user-visible failures increase.

Actionable steps:

1. Capture timestamps immediately before lock acquisition, after lock acquisition, and after state mutation completion.
2. Compute `lockWaitMs`, `stateUpdateMs`, and `totalPhaseMs` for both `admission` and `completion` phases.
3. Log normal timing information through `ABLogger.getInstance().info(...)`.
4. Emit `warn` logs when lock wait exceeds the chosen operational threshold.
5. Include `phase`, `requestId`, and `method` in timing logs.
6. Reuse existing `ABLogger` APIs without expanding the logging interface.
7. Keep log payloads metadata-only and consistent across both lock-protected phases.

Required test cases:

- Records timing metadata for the admission phase.
- Records timing metadata for the completion phase.
- Uses `info` logging for normal lock timing events.
- Uses `warn` logging when lock wait exceeds the operational threshold.
- Omits sensitive request params from emitted logs.
- Continues to log timing data when the completion phase marks an error result.

Acceptance criteria:

- Lock timing metrics are emitted for both critical sections.
- High-wait contention is distinguishable from normal lock timing in logs.
- Logging remains lightweight and does not require new framework infrastructure.
- Timing logs provide enough metadata to tune the lock timeout later if needed.

Constraints:

- Use existing `ABLogger` capabilities only.
- Keep logging concise to avoid noise and payload bloat.
- Do not log request params, auth data, or other sensitive values.
- Keep the warn threshold configurable in code if introduced, but do not over-engineer observability in this phase.

Implementation notes:

Commit checkpoint:

- Commit this section after lock timing instrumentation and logging tests pass.

## Phased Delivery Plan

## Phase 1 — Contracts and thin infrastructure

Deliverables:

- Define request/response envelope schemas and inferred types in the frontend service layer using `zod` and `z.infer`.
- Implement backend `apiHandler` wrapper plus singleton dispatcher with allowlist/constants stored in `src/backend/Api/apiConstants.js` and structured responses.
- Add tracking utility with UUID + timestamps.
- Define API-layer error type mapping strategy based on `Utils/ErrorTypes`.

Validation:

- Backend unit tests for request validation and allowlist behaviour.
- Frontend unit tests for wrapper success/error translation.

Actionable steps:

1. Complete Section 1 and Section 2 in the smallest viable slice.
2. Add the first request/response envelope tests in both frontend and backend suites.
3. Create the API constants file and the initial single-method allowlist.
4. Verify the wrapper and dispatcher work end-to-end for one allowlisted method.

Required test cases:

- Frontend wrapper success and error-envelope parsing.
- Backend request validation and unknown-method handling.
- End-to-end request/response flow for `getAuthorisationStatus` through the new wrapper path, if feasible at unit level.

Acceptance criteria:

- The typed wrapper and dispatcher exist and can process one supported method.
- Both sides of the contract are validated by automated tests.

Constraints:

- Keep scope to the thinnest viable infrastructure.
- Do not migrate multiple feature services in this phase.

Implementation notes:

Commit checkpoint:

- Commit Phase 1 once the initial contract and infrastructure slice is stable.

## Phase 2 — Concurrency control and stale pruning

Deliverables:

- Add lock-protected tracking updates.
- Add stale-entry pruning (>15 minutes).
- Add admission control and rate-limit response metadata.
- Add lock timing instrumentation via `ABLogger` (`lockWaitMs`, `stateUpdateMs`, `totalPhaseMs`).

Validation:

- Backend tests covering active-count calculation and pruning behaviour.
- Backend tests for rate-limit responses and error propagation.
- Backend tests for lock timeout handling and error code mapping.

Actionable steps:

1. Complete Section 3, Section 4, and Section 5 in backend order.
2. Wire request tracking into the dispatcher admission and completion flow.
3. Add stale pruning, admission rejection, and lock timeout handling.
4. Confirm the dispatcher still returns stable envelopes under contention and rate limiting.

Required test cases:

- Store lifecycle updates.
- Stale-entry pruning.
- Active-count admission denial.
- Lock acquisition timeout handling.
- Error mapping for rate-limited responses.

Acceptance criteria:

- Backend concurrency control is functional, bounded, and covered by tests.
- Rate-limited and lock-contention paths return structured retriable responses.

Constraints:

- Keep this phase backend-focused.
- Avoid frontend retry work until rate-limit responses are stable.

Implementation notes:

Commit checkpoint:

- Commit Phase 2 after concurrency-control behaviour is stable and test-covered.

## Phase 3 — Frontend retries and first migration

Deliverables:

- Add retry/backoff logic in frontend wrapper.
- Migrate `getAuthorisationStatus` to use `apiHandler` path.
- Keep `authService` as a thin module; only change the transport call so the feature-facing API remains stable.

Validation:

- Frontend tests for retry success and retry exhaustion.
- Existing auth feature tests still passing after updating their runtime mocks from direct `getAuthorisationStatus` calls to `apiHandler` request handling.

Actionable steps:

1. Complete the frontend retry portion of Section 6.
2. Update `authService` to call `apiHandler` through `apiService` rather than direct backend methods.
3. Update frontend runtime mocks and tests to reflect the new transport contract.
4. Verify that auth-facing service behaviour remains unchanged apart from the transport path.

Required test cases:

- Retry succeeds when a later attempt receives a success envelope.
- Retry stops after the configured maximum attempts.
- Retry does not run for non-retriable responses.
- Auth service tests pass using `apiHandler(request)` mocks.

Acceptance criteria:

- The frontend can recover from temporary rate limiting within the configured retry budget.
- `getAuthorisationStatus` is migrated without changing feature-facing behaviour.

Constraints:

- Keep `authService` thin.
- Do not widen the migration beyond the first concrete endpoint.

Implementation notes:

Commit checkpoint:

- Commit Phase 3 once retry behaviour and the first endpoint migration are complete.

## Phase 4 — Incremental endpoint migration

Deliverables:

- Migrate additional frontend calls to wrapper one-by-one.
- Extend backend allowlist accordingly.

Validation:

- Per-endpoint regression checks.
- No direct new `google.script.run.<method>` usages introduced outside wrapper.

Actionable steps:

1. Identify the next direct frontend backend call to migrate.
2. Add the method to the backend allowlist and confirm the request/response contract.
3. Route the feature service through `apiService`.
4. Update or add focused tests for the migrated endpoint.
5. Repeat the same slice per endpoint rather than batching many migrations together.

Required test cases:

- Regression coverage for each migrated endpoint.
- Allowlist coverage for each newly exposed backend method.
- Search-based or lint-backed verification that no new direct `google.script.run.<method>` usage was introduced.

Acceptance criteria:

- Each migrated endpoint uses the shared API wrapper end to end.
- The allowlist remains the single source of truth for exposed API methods.
- No new direct transport bypasses are added outside the wrapper.

Constraints:

- Keep migrations incremental and reviewable.
- Do not refactor unrelated controllers or services while migrating endpoints.

Implementation notes:

Commit checkpoint:

- Commit each endpoint migration as its own focused change set where practical.

## Testing Strategy

Follow existing project test standards:

- Backend: Vitest tests for API-layer wrappers and error propagation.
- Frontend: Vitest + Testing Library for service behaviour and feature integration.

Test setup changes required:

- Extend shared test mocks to include `Utilities.getUuid()`.
- Extend shared test mocks to include `PropertiesService.getUserProperties()`.
- Extend shared test mocks to include `LockService.getUserLock()`.
- Update frontend `google.script.run` mocks so `authService` tests exercise `apiHandler(request)` rather than direct backend method calls.

Suggested command sequence from repo root:

1. `npm test`
2. `npm run frontend:test`
3. `npm run lint`
4. `npm run frontend:lint`

If builder files are touched in implementation, also run:

5. `npm run builder:lint`

Actionable steps:

1. Extend shared backend mocks before introducing API-layer persistence or locking tests.
2. Update frontend transport mocks before migrating `authService`.
3. Run the smallest relevant test set during each section, then run the broader command sequence before merge.
4. Add regression tests whenever a new allowlisted endpoint is migrated.

Required test cases:

- Shared mocks support `Utilities.getUuid()`, `PropertiesService.getUserProperties()`, and `LockService.getUserLock()`.
- Frontend mocks support `google.script.run.apiHandler(request)`.
- Section-level tests pass before section commits.
- Full relevant test and lint command sequence passes before the work is considered complete.

Acceptance criteria:

- The test harness fully supports the new transport, persistence, and locking behaviours.
- Validation happens at both section level and integrated plan level.

Constraints:

- Prefer targeted tests during implementation to keep iteration fast.
- Still run the broader validation sequence before final completion.

Implementation notes:

Commit checkpoint:

- Commit test harness updates with the section they enable, not as an isolated unrelated change.

## Operational and Data Considerations

- `UserProperties` quotas are limited: keep stored records compact and prune aggressively.
- Generate UUIDs with GAS utilities (`Utilities.getUuid()`).
- Avoid storing sensitive payload data in properties; store metadata only.
- Keep error messages useful but concise.
- Keep lock timeout at 1 second initially and tune using observed lock timing logs.
- Keep this implementation strictly per-user throttling for now; defer any global admission control to a separate decision.
- Keep error serialisation intentionally minimal across the frontend boundary.

Actionable steps:

1. Review each implementation section against these operational limits before merging.
2. Confirm stored data remains compact and metadata-only.
3. Confirm logging and error serialisation stay minimal.
4. Capture any operational trade-offs in the relevant implementation notes areas.

Required test cases:

- Store payload size remains bounded through compaction behaviour.
- Serialised error payloads do not include stacks or nested error objects.
- Logging tests confirm sensitive payload data is omitted.

Acceptance criteria:

- The implementation respects GAS quota and payload constraints.
- Operational observability is useful without leaking sensitive or unnecessary data.

Constraints:

- No global throttling in this plan.
- No payload persistence beyond metadata.

Implementation notes:

Commit checkpoint:

- Commit any operationally driven adjustments with the section that required them.

## Risks and Mitigations

1. Race conditions in counters
   - Mitigation: user lock for all tracking mutations.
2. Property bloat over time
   - Mitigation: prune stale and completed records regularly; cap retained history at `MAX_TRACKED_REQUESTS = 30`.
3. Method drift between frontend and allowlist
   - Mitigation: central allowlist/constants file in `src/backend/Api/apiConstants.js` and tests for unknown methods.
4. Over-retrying under sustained load
   - Mitigation: bounded attempts + jitter + clear UI error on exhaustion.

Actionable steps:

1. Review these risks at the end of each section before committing.
2. Add or adjust tests when a risk becomes more likely during implementation.
3. Record any new risks discovered during implementation in the relevant notes area.

Required test cases:

- Targeted tests exist for each listed mitigation path.
- Any newly identified implementation risk has either a test, a documented follow-up, or both.

Acceptance criteria:

- The main implementation risks are actively mitigated rather than only documented.
- Section commits include the tests or notes needed to support the stated mitigations.

Constraints:

- Keep mitigations proportionate to the requested scope.
- Do not add speculative architecture work solely to address hypothetical future risks.

Implementation notes:

Commit checkpoint:

- Commit risk-related adjustments with the section that introduced or resolved the risk.

## Definition of Done

- Frontend calls can be made through one wrapper contract.
- Backend `apiHandler` tracks lifecycle with UUID/timestamps in `UserProperties`.
- Active execution admission control works with stale pruning.
- Rate-limit errors are structured and retriable by frontend policy.
- `getAuthorisationStatus` is migrated as the first concrete endpoint.
- Relevant backend/frontend tests and lint checks pass.

Final acceptance checklist:

1. The frontend API wrapper, backend dispatcher, tracking store, admission control, and retry behaviour are implemented according to the section criteria.
2. `getAuthorisationStatus` is migrated through the wrapper path.
3. Section-level commits exist for completed slices or the final history clearly preserves section boundaries.
4. Required tests and lint commands have passed for the touched areas.
5. Any deviations from this plan are captured in the relevant implementation notes sections.

Implementation notes:

Commit checkpoint:

- Make a final commit only after the entire definition-of-done checklist is satisfied.
