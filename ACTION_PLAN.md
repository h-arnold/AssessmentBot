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

## 5) Stale-entry pruning and admission control

Before counting active executions:

- remove entries with `startedAtMs` older than 15 minutes,
- treat unresolved `started` entries older than threshold as abandoned,
- delete abandoned entries immediately and log the pruning event via `ABLogger`.

Admission decision:

- if `activeCount >= ACTIVE_LIMIT`, return rate-limit envelope immediately,
- include `retriable: true`.

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

## Phase 3 — Frontend retries and first migration

Deliverables:

- Add retry/backoff logic in frontend wrapper.
- Migrate `getAuthorisationStatus` to use `apiHandler` path.
- Keep `authService` as a thin module; only change the transport call so the feature-facing API remains stable.

Validation:

- Frontend tests for retry success and retry exhaustion.
- Existing auth feature tests still passing after updating their runtime mocks from direct `getAuthorisationStatus` calls to `apiHandler` request handling.

## Phase 4 — Incremental endpoint migration

Deliverables:

- Migrate additional frontend calls to wrapper one-by-one.
- Extend backend allowlist accordingly.

Validation:

- Per-endpoint regression checks.
- No direct new `google.script.run.<method>` usages introduced outside wrapper.

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

## Operational and Data Considerations

- `UserProperties` quotas are limited: keep stored records compact and prune aggressively.
- Generate UUIDs with GAS utilities (`Utilities.getUuid()`).
- Avoid storing sensitive payload data in properties; store metadata only.
- Keep error messages useful but concise.
- Keep lock timeout at 1 second initially and tune using observed lock timing logs.
- Keep this implementation strictly per-user throttling for now; defer any global admission control to a separate decision.
- Keep error serialisation intentionally minimal across the frontend boundary.

## Risks and Mitigations

1. Race conditions in counters
   - Mitigation: user lock for all tracking mutations.
2. Property bloat over time
   - Mitigation: prune stale and completed records regularly; cap retained history at `MAX_TRACKED_REQUESTS = 30`.
3. Method drift between frontend and allowlist
   - Mitigation: central allowlist/constants file in `src/backend/Api/apiConstants.js` and tests for unknown methods.
4. Over-retrying under sustained load
   - Mitigation: bounded attempts + jitter + clear UI error on exhaustion.

## Definition of Done

- Frontend calls can be made through one wrapper contract.
- Backend `apiHandler` tracks lifecycle with UUID/timestamps in `UserProperties`.
- Active execution admission control works with stale pruning.
- Rate-limit errors are structured and retriable by frontend policy.
- `getAuthorisationStatus` is migrated as the first concrete endpoint.
- Relevant backend/frontend tests and lint checks pass.
