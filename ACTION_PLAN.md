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
2. A conservative app-level threshold lower than GAS hard limits is acceptable (for example 20 active calls rather than 30).

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

Responsibilities:

- Validate `google.script.run` availability.
- Send a structured request to backend `apiHandler`.
- Parse structured success/error responses.
- Retry only on explicit rate-limit responses.
- Implement bounded exponential backoff with jitter.

Recommended response envelope shape:

- Success: `{ ok: true, requestId, data, meta }`
- Failure: `{ ok: false, requestId, error: { code, message, retriable }, meta }`

Use this wrapper from feature-specific services (for example `authService`) so feature code remains simple.

## 2) Backend dispatcher (`src/backend/Api/apiHandler.js`)

Add a new GAS-global function:

- `apiHandler(request)`

Request shape:

- `{ method: string, params?: object, requestId?: string }`

Responsibilities:

- Validate request payload.
- Resolve method through an explicit allowlist map (no dynamic invocation).
- Perform admission control before dispatch.
- Track lifecycle in `UserProperties` using UUID and timestamps.
- Return structured success/failure envelope.

Allowlist example approach:

- `getAuthorisationStatus -> getAuthorisationStatus`
- Additional methods added incrementally as frontend migration proceeds.

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

- Keep one index key (for example list of active/recent IDs) plus per-request keys, or a single JSON blob if size remains safe.
- Keep payload minimal to avoid property size pressure.

## 4) Atomicity and race-condition prevention

Wrap read-modify-write tracking operations with `LockService.getUserLock()`.

Critical sections:

- prune stale entries,
- compute active count,
- register new `started` entry,
- mark completion/failure.

Always release locks in `finally` blocks.

## 5) Stale-entry pruning and admission control

Before counting active executions:

- remove entries with `startedAtMs` older than 15 minutes,
- treat unresolved `started` entries older than threshold as abandoned.

Admission decision:

- if `activeCount >= ACTIVE_LIMIT`, return rate-limit envelope immediately,
- include `retriable: true` and `retryAfterMs` hint.

## 6) Error model and frontend retry policy

Backend should emit clear error codes, e.g.:

- `RATE_LIMITED`
- `UNKNOWN_METHOD`
- `INVALID_REQUEST`
- `INTERNAL_ERROR`

Frontend retry policy:

- retry only when `error.code === 'RATE_LIMITED'` and `retriable === true`,
- exponential backoff with jitter,
- fixed max attempts (for example 4-6),
- fail with final surfaced error after exhaustion.

## Phased Delivery Plan

## Phase 1 — Contracts and thin infrastructure

Deliverables:

- Define request/response envelope types in frontend service layer.
- Implement backend `apiHandler` with allowlist and structured responses.
- Add tracking utility with UUID + timestamps.

Validation:

- Backend unit tests for request validation and allowlist behaviour.
- Frontend unit tests for wrapper success/error translation.

## Phase 2 — Concurrency control and stale pruning

Deliverables:

- Add lock-protected tracking updates.
- Add stale-entry pruning (>15 minutes).
- Add admission control and rate-limit response metadata.

Validation:

- Backend tests covering active-count calculation and pruning behaviour.
- Backend tests for rate-limit responses and error propagation.

## Phase 3 — Frontend retries and first migration

Deliverables:

- Add retry/backoff logic in frontend wrapper.
- Migrate `getAuthorisationStatus` to use `apiHandler` path.
- Keep feature-facing service API stable.

Validation:

- Frontend tests for retry success and retry exhaustion.
- Existing auth feature tests still passing.

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

## Risks and Mitigations

1. Race conditions in counters
   - Mitigation: user lock for all tracking mutations.
2. Property bloat over time
   - Mitigation: prune stale and completed records regularly; cap retained history.
3. Method drift between frontend and allowlist
   - Mitigation: central method constants and tests for unknown methods.
4. Over-retrying under sustained load
   - Mitigation: bounded attempts + jitter + clear UI error on exhaustion.

## Definition of Done

- Frontend calls can be made through one wrapper contract.
- Backend `apiHandler` tracks lifecycle with UUID/timestamps in `UserProperties`.
- Active execution admission control works with stale pruning.
- Rate-limit errors are structured and retriable by frontend policy.
- `getAuthorisationStatus` is migrated as the first concrete endpoint.
- Relevant backend/frontend tests and lint checks pass.
