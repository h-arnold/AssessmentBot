# API Handler GAS Logging Preservation Specification

## Status

- Draft v1.0
- Created on 14 April 2026 to plan a backend-only change that preserves developer diagnostics in Google Apps Script execution logs without changing the frontend transport contract

## Purpose

This document defines the intended behaviour for preserving backend logging visibility across `apiHandler` downstream execution paths.

The feature will be used to:

- preserve faithful developer diagnostics in Google Apps Script execution logs when allowlisted backend handlers fail
- keep the frontend transport envelope stable and safe while backend debugging improves
- add regression protection so future `apiHandler` changes cannot quietly degrade log visibility

This feature is **not** intended to:

- expose backend stack traces, raw exceptions, or internal diagnostic payloads to the frontend
- redesign downstream service/controller logging conventions beyond the `apiHandler` transport boundary

## Agreed product decisions

1. The frontend transport contract remains unchanged: successful responses stay `{ ok: true, requestId, data }` and failures stay `{ ok: false, requestId, error: { code, message, retriable } }`.
2. `apiHandler` remains the top-level transport boundary and may continue catching downstream exceptions, but caught failures must still be written to Google Apps Script execution logs with the original diagnostic fidelity available at the boundary.
3. For any downstream handler failure, `apiHandler` must emit one concise developer-facing boundary error log that includes the backend-owned `requestId`, the allowlisted method name, and the original thrown value or error object without first collapsing it to a lossy `String(...)`.
4. For thrown `Error` values, acceptance must be proven at the Google Apps Script execution-log seam by asserting the `console.error` payload produced by the current `ABLogger` serialisation preserves the top-level `name`, `message`, and `stack`.
5. Existing downstream `ABLogger` output must remain observable in execution logs. The transport boundary must not widen the frontend payload or attempt to mirror backend diagnostics into the frontend envelope.
6. Boundary logging must stay concise and contextual. It must not add a second transport-generated series of per-field detail logs when downstream code has already emitted detailed diagnostics; the single boundary error log is the only transport-added diagnostic entry.
7. Error-code mapping remains unchanged: known backend failures may still map to `RATE_LIMITED`, `INVALID_REQUEST`, `UNKNOWN_METHOD`, or `IN_USE`, and all other failures may still map to `INTERNAL_ERROR` with the existing generic frontend message.

## Existing system constraints

### Backend or API constraints already in place

- `src/backend/z_Api/apiHandler.js` is the canonical frontend transport entrypoint and always returns an envelope rather than throwing to the frontend caller.
- Admission and completion tracking in `apiHandler` must stay intact for all allowlisted methods, including failure paths.
- `ABLogger` is the backend developer-logging abstraction and serialises `Error` objects to console-friendly payloads including `name`, `message`, and `stack`.
- `ProgressTracker.logError(...)` is for user-facing progress state and also writes developer diagnostics through `ABLogger`.

### Current data-shape constraints

- The request-store helpers in `src/backend/z_Api/requestStore.js` currently persist compact request metadata and a bounded `errorMessage` string for failed requests.
- The request store is not the canonical source of full diagnostic detail and should remain compact enough for Apps Script user-properties storage.
- Some thrown values may be non-`Error` values; the transport boundary still needs a deterministic logging and mapping outcome for those cases.
- Current `ABLogger` serialisation preserves top-level `name`, `message`, and `stack` for `Error` objects but does not recursively serialise deep cause chains.

### Frontend or consumer architecture constraints

- Frontend callers consume only the stable transport envelope documented in `docs/developer/backend/api-layer.md`.
- Frontend code must not receive backend stacks, raw exception objects, or internal logging metadata.
- Existing frontend handling of `INTERNAL_ERROR` depends on the generic `"Internal API error."` message remaining stable.

## Domain and contract recommendations

### Why this approach is preferable

- It restores developer observability where the failure is actually caught, which is the point currently hiding stack-rich diagnostics from the Google Apps Script execution log.
- It preserves the current frontend safety boundary and avoids coupling UI behaviour to backend diagnostic detail.
- It keeps the change local to the transport/error-boundary path and its tests rather than spreading logging policy across unrelated controllers.

### Recommended data shapes

#### Boundary failure log context

```js
{
  phase: 'handler',
  requestId: 'uuid',
  method: 'allowlistedMethodName'
}
```

The contextual metadata should accompany the original thrown value or error object in the developer log entry.
The transport boundary must rely on the existing single-entry `ABLogger.error(...)` serialisation rather than emitting separate stack, message, or name log lines of its own.

#### Failed request tracking record

```js
{
  requestId: 'uuid',
  method: 'allowlistedMethodName',
  status: 'error',
  startedAtMs: 0,
  finishedAtMs: 0,
  errorMessage: 'compact diagnostic summary'
}
```

The request-store record may keep a compact summary for internal tracking, but it must not be treated as a substitute for execution-log diagnostics.

### Naming recommendation

Prefer:

- `boundary failure log`
- `execution-log diagnostics`
- `transport error envelope`

Avoid:

- `frontend error details`
- `swallowed error fix`

Explain changes in terms of preserved diagnostics at the transport boundary rather than in terms of exposing more data to the UI.

### Validation recommendation

#### Frontend

- No frontend validation or transport-shape change is required for this feature.
- Existing frontend error handling should continue to rely only on `code`, `message`, and `retriable`.

#### Backend

- Preserve current envelope mapping behaviour for mapped and unmapped failures while adding execution-log assertions for the same paths.
- Treat both `Error` and non-`Error` thrown values as testable transport-boundary cases.
- Prove `Error` fidelity at the `console.error` seam rather than only at an `ABLogger` spy seam.
- Verify that completion tracking still records failed requests after the logging-preservation change.

### Display-resolution recommendation

- Developer diagnostics belong in Google Apps Script execution logs, not in the frontend envelope or progress UI.
- The frontend should continue resolving only the safe transport message presented by `apiHandler`.

## Feature architecture

### Placement

- Canonical ownership remains in `src/backend/z_Api/apiHandler.js` with supporting request-store and test-helper updates only if required by the logging contract.
- No parallel frontend transport path, alternate logger path, or deprecated `globals.js` transport should be introduced.

### Proposed high-level tree

```text
apiHandler transport boundary
├── admission tracking
├── allowlisted handler invocation
├── boundary failure logging for caught downstream errors
├── completion tracking
└── frontend envelope mapping
```

### Out of scope for this surface

- Controller or service refactors unrelated to `apiHandler` failure visibility
- Broad migration of older `console.*` calls outside the explicit `apiHandler` logging-preservation scope

## Data loading and orchestration

### Required datasets or dependencies

- `ABLogger`
- `ProgressTracker`
- request-store helpers used by `apiHandler`

### Prefetch or initialisation policy

#### Startup

- No new startup work is required.
- Singleton initialisation behaviour should remain unchanged.

#### Feature entry

- The behaviour applies only when `apiHandler` executes an allowlisted backend method.
- No new background or eager logging workflow should be introduced.

#### Manual refresh

- No manual refresh control is relevant to this backend-only feature.

### Query or transport additions

- No new API methods or frontend transport fields are introduced.
- Existing error mapping and request lifecycle sequencing remain the same apart from preserved execution-log diagnostics.

## Core view model or behavioural model

### Suggested shape

```js
{
  requestId: 'uuid',
  method: 'allowlistedMethodName',
  handlerOutcome: 'success' | 'mapped_failure' | 'unexpected_failure',
  frontendEnvelope: 'unchanged',
  executionLogDiagnostics: 'preserved'
}
```

### Derivation or merge rules

#### Success

- A successful downstream call keeps the current success envelope and timing logs.
- No new failure logging is emitted.

#### Mapped failure

- A downstream error that maps to an existing transport code still returns the current mapped envelope.
- The boundary must still preserve developer diagnostics in execution logs before returning the mapped envelope.
- The planned default is that mapped and expected downstream handler failures also receive the single boundary error-level log so execution-log behaviour stays uniform across failure paths.

#### Unexpected failure

- A downstream error that does not map to a known transport code still returns `INTERNAL_ERROR` with the current generic frontend message.
- The boundary must preserve the original thrown diagnostics in execution logs before returning the failure envelope.

### Sort order or priority rules

1. Preserve frontend contract stability.
2. Preserve execution-log diagnostic fidelity.
3. Preserve request lifecycle tracking and timing observability.

- When both downstream logs and boundary logs exist, tests should assert presence and ordering only where the implementation makes that ordering deterministic.

## Explicit assumptions

1. Fidelity preservation is limited to the top-level thrown value seen by `apiHandler`. This work does not expand `ABLogger` serialisation depth beyond the current top-level `name`, `message`, `stack`, and shallow `cause` behaviour.
2. The default planning assumption is that all caught downstream handler failures, including mapped or expected failures, receive one boundary error-level log entry. If implementation review finds the resulting log volume unacceptable, that trade-off should be revisited explicitly rather than changed implicitly.
3. Downstream-log regression coverage will be worded and implemented as non-suppression of controlled downstream logging stubs unless a section explicitly says to load a real class with shims.

## Main user-facing surface specification

### Recommended components or primitives

- None. This is a backend-only change, so no dedicated frontend layout spec is required.
