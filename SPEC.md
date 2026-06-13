# API Queueing System Specification

## Status

- Draft v1.1 — revised after planner review

## Purpose

This document defines the intended behaviour for a frontend-side API request queueing system built into `apiService.ts`.

The feature will be used to:

- serialise grouped API calls so callers can avoid race conditions that arise when multiple concurrent requests contend for shared backend state (e.g. ABClass partial updates)
- serialise low-priority background pre-fetch calls to stay under the Google Apps Script 25-concurrent-request ceiling without slowing higher-priority requests
- expose queue-position state per job name so progress-UI consumers can derive completion metrics (concrete v1 consumer: the ABClass creation progress bar)

This feature is **not** intended to:

- provide general-purpose task scheduling or prioritisation across different job names
- replace or alter the existing direct `callApi` transport — non-queued calls continue unchanged
- add backend-side queueing or rate-limiting

## Agreed product decisions

1. A new exported function `callApiQueued<TResponse>(method, parameters, jobName)` is the sole queued entry point. It returns `Promise<TResponse>` — identical contract to `callApi` — and the caller awaits their specific request's result as normal. The `parameters` argument is optional, matching the `callApi` signature exactly.
2. A new exported function `getQueueState(jobName)` returns `{ pending: number; active: boolean }`. `pending` counts queued requests not yet dispatched; `active` is `true` when a request is currently in flight for that job name. The queue does not track historical totals. The `QueueState` interface is exported alongside the function.
3. Each distinct `jobName` value creates an independent queue. Requests within the same job name execute strictly one-at-a-time in FIFO order.
4. Queues for different job names execute independently — a blocked queue does not stall other queues or direct `callApi` calls.
5. Retry/backoff logic already in `callApi` applies per-request inside the queue — a retriable `RATE_LIMITED` response triggers the existing exponential-backoff retry before the next queued request can start.
6. When a queued request exhausts all retries and ultimately rejects, that individual promise rejects with the final error. The queue continues processing the next pending request (does not stall).
7. `callApiQueued` reuses the existing `callApi` internally — it does not duplicate transport, retry, or validation logic.
8. The idle-to-active transition when starting queue processing is synchronous: the queue is marked active before the first `await callApi(...)` dispatch, preventing duplicate processing loops from near-simultaneous enqueues.

## Existing system constraints

### Backend or API constraints already in place

- `google.script.run` imposes a hard concurrent-request ceiling (approximately 25). Queueing low-priority calls is the intended mitigation.
- ABClass partial sheet updates are not atomic across concurrent writes — serialising via a queue avoids the observed race condition.
- Backend `ALLOWLISTED_METHOD_HANDLERS` and all existing API contracts are unchanged by this feature.

### Current data-shape constraints

- The `callApi` signature is `callApi<TResponse>(method: string, parameters?: unknown): Promise<TResponse>`. `callApiQueued` mirrors this exactly with the addition of a final `jobName: string` parameter.
- The `getQueueState` return type must be stable and minimal to avoid coupling future UI to internal queue internals.

### Frontend or consumer architecture constraints

- All frontend-to-backend calls must route through `callApi` per `src/frontend/AGENTS.md §4.1`. `callApiQueued` preserves this by delegating to `callApi`.
- No React, hook, or component dependency exists in the service layer today and none should be introduced — queue state is queryable imperatively.
- Per the shared-helper standards (`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`), any new queue-state query function must be justified by active call sites, not speculative. The ABClass creation flow (v1) is a concrete consumer of `getQueueState` for its progress bar; the Google Classroom pre-fetch flow is a concrete consumer of `callApiQueued` that does not need `getQueueState`. These two callers satisfy the two-caller threshold.

## Domain and contract recommendations

### Why this approach is preferable

- Keeps the existing `callApi` contract untouched — zero risk to current callers.
- Exposes minimal queue state (`pending` + `active`) that is sufficient for progress derivation without coupling consumers to internal data structures.
- Reuses `callApi` internally so retry, validation, logging, and serialisation behaviour stay centralised.
- The separate-function pattern (`callApiQueued`) makes the queuing choice explicit at every call site, improving auditability.

### Recommended data shapes

#### `callApiQueued` signature

```ts
function callApiQueued<TResponse>(
  method: string,
  parameters?: unknown,
  jobName: string
): Promise<TResponse>;
```

The `parameters` argument is optional, matching the existing `callApi` signature.

#### `QueueState` and `getQueueState`

```ts
export interface QueueState {
  pending: number;
  active: boolean;
}

export function getQueueState(jobName: string): QueueState;
```

Both the interface and function are exported.

### Naming recommendation

Prefer:

- `callApiQueued` — explicit, matches existing `callApi` naming
- `getQueueState` — reads as a snapshot query
- `jobName` — matches the user's original wording and avoids ambiguity with "queue name"
- `parameters` in the function signature — matches the existing `callApi` parameter name

Avoid:

- `enqueueApiCall` — overly verbose, breaks symmetry with `callApi`
- `queueLength` / `queuePosition` — implies individual-position tracking that the agreed contract does not expose
- `queueId` / `queueKey` — less descriptive than `jobName`

### Validation recommendation

#### Frontend

- `method` and `jobName` must be non-empty strings (Zod-validated at the call boundary by `callApiQueued`).
- `getQueueState` also validates `jobName` as non-empty and throws synchronously on violation, matching `callApiQueued`'s validation style.
- `callApiQueued` validates `method` before enqueueing. When the request is later dispatched, `callApi` independently validates `method` again through `ApiRequestSchema`. This is intentional defence-in-depth: the early validation catches bad inputs at the call site (before entering the queue), and the dispatch-time validation ensures the payload reaching the transport layer is always well-formed regardless of how it was enqueued.
- `jobName` values are caller-defined; no central registry or enum is enforced in v1.
- `parameters` is passed through to `callApi` unchanged — any validation occurs inside `callApi` per existing behaviour.

#### Backend

- No backend changes are required.

## Feature architecture

### Placement

- `src/frontend/src/services/apiService.ts` — the queue logic, `callApiQueued`, and `getQueueState` live in the existing transport service module.
- No new files or directories are required unless the queue logic grows beyond a handful of functions, at which point extraction into `src/frontend/src/services/apiService/queue.ts` (alongside `apiService.ts` moved into an `apiService/` subfolder) should be considered per the service-domain grouping rules in `src/frontend/AGENTS.md §12`.

### Proposed high-level tree

```text
src/frontend/src/services/
└── apiService.ts (or apiService/ subfolder if extracted)
    ├── callApi (existing, unchanged)
    ├── callApiQueued (new, exported)
    ├── QueueState (new, exported interface)
    ├── getQueueState (new, exported)
    └── internal queue map and dequeue loop
```

### Out of scope for this surface

- Priority-based queueing or inter-queue ordering
- Queue persistence across page reloads
- Cancellation or removal of queued requests
- Per-request progress callbacks — consumers derive progress from `getQueueState`
- A React hook wrapping `getQueueState` — the ABClass creation flow can call `getQueueState` directly from its feature hook without a dedicated abstraction

## Core view model or behavioural model

### Queue lifecycle

1. On first `callApiQueued(method, parameters, 'myJob')`, a new queue is created keyed by `'myJob'`.
2. The request payload (`{ method, parameters }`) is pushed onto the queue's pending array.
3. If no request is currently active for this queue, processing starts by **synchronously** marking the queue as active, then dispatching the first pending request.
4. The dequeue loop pops the next pending request, dispatches it via `callApi`, and awaits resolution or final rejection.
5. On completion (resolve or reject), the active flag is cleared. If pending requests remain, the loop repeats (step 3–4). Otherwise the queue becomes idle.
6. The queue object remains allocated so future enqueues reuse it.

### Queue state derivation

```
active  = Boolean(queue is currently processing a request — set synchronously before dispatch, cleared after settle)
pending = queue.pending.length (requests waiting, excluding the active one)
```

`getQueueState` returns a snapshot at call time. It does not subscribe to changes.

## Workflow specification

### Direct call (existing, unchanged)

Trigger: any existing `callApi(method, parameters)` call site.

- Request is dispatched immediately.
- Retry/backoff applies as configured.
- Resolves or rejects independently of any queue.

### Queued call

Trigger: `callApiQueued(method, parameters, jobName)`.

Preconditions: `method` and `jobName` are non-empty strings.

Behaviour:

1. Validate inputs via Zod (non-empty `method`, non-empty `jobName`).
2. Locate or create the queue for `jobName`.
3. Push `{ method, parameters, resolve, reject }` onto the queue's pending array.
4. If the queue is idle, synchronously mark it active and begin processing via `callApi`.
5. When this request's turn arrives, dispatch via `callApi`.
6. Resolve or reject the returned promise with the outcome.

Success: the individual promise resolves with typed `TResponse` data (identical to `callApi`).

Failure: the individual promise rejects with the final error after all retries are exhausted (identical to `callApi` rejection behaviour).

Post-failure: the queue automatically processes the next pending request.

### Query queue state

Trigger: `getQueueState(jobName)`.

Preconditions: `jobName` is a non-empty string.

Behaviour:

1. Validate `jobName` is a non-empty string — throw synchronously on violation.
2. If no queue exists for `jobName`, return `{ pending: 0, active: false }`.
3. Otherwise, return a snapshot of the queue's current `pending` length and `active` flag.

## Error, loading, and empty-state rules

- **Method/jobName validation failure**: `callApiQueued` throws synchronously before enqueueing (Zod validation). This matches existing `callApi` behaviour where schema violations throw before transport.
- **`getQueueState` validation failure**: invalid or empty `jobName` throws synchronously (Zod validation), matching `callApiQueued`'s validation style.
- **Queue processing error**: if `callApi` itself throws synchronously (e.g. `google.script.run` unavailable), that error propagates to the dequeued request's promise. The queue continues with the next request.
- **No active queue**: `getQueueState` for an unknown but valid `jobName` returns a zero-state, not an error. This allows consumers to poll before any calls have been enqueued.
- **Logging**: the queue itself does not add new log events. `callApi`'s existing `logFrontendEvent` (retry warnings) and `logFrontendError` (terminal failures) logging is sufficient for diagnosing queued-request failures. Adding queue-level logging is deferred until a demonstrated need arises.

## Backend changes required to support agreed behaviour

None. This is a frontend-only transport-layer change.

## Planning handoff notes

- The action plan must sequence contract definition (`callApiQueued`, `getQueueState`, and `QueueState` signatures) before implementation of the queue loop.
- The existing `callApi` must not be modified — only extended with new exports.
- The test file `apiService.spec.ts` must gain queue-specific test coverage while preserving all existing tests.
- Queue retry tests must account for the interaction between `vi.useFakeTimers()` and the sequential queue loop — timer advancement must be coordinated with queue processing to avoid race conditions between retry delays and the dequeue loop. The existing retry-policy test pattern in `apiService.spec.ts` (lines 389–457) demonstrates the required coordination.

## Testing expectations

- Frontend unit tests (Vitest): new `describe` blocks for `callApiQueued` and `getQueueState`, covering:
  - successful sequential execution within a job name
  - parallel independence of different job names
  - queue state snapshot correctness during and after processing
  - retriable failure and queue continuation
  - non-retriable failure and queue continuation
  - input validation — empty method, empty jobName (both for `callApiQueued` and `getQueueState`)
  - `getQueueState` for unknown job names returns zero-state
  - concurrent enqueues across multiple callers do not race
- No backend or E2E tests required for this layer.

## Documentation and rollout notes

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`: add planned entry for `callApiQueued`, `getQueueState`, and `QueueState` as new shared-service exports (status `Not implemented` until delivered).
- No migration required — existing `callApi` callers are unaffected.

## V1 scope recommendation

### Include in v1

- `callApiQueued` with per-jobName FIFO sequential execution
- `getQueueState` returning `{ pending, active }` (consumed by ABClass creation progress bar)
- `QueueState` exported interface
- Input validation for `method` and `jobName` (both functions)
- Unit test coverage for queueing behaviour
- Planned helper entries in canonical docs

### Defer from v1

- React hook wrapping `getQueueState` for reactive progress UI (not needed — the ABClass creation flow calls `getQueueState` imperatively)
- Queue cancellation or request removal
- Queue persistence across navigation
- Priority or dependency-based ordering
- Queue-level logging events

## Open questions

None remaining — all material design decisions are settled.
