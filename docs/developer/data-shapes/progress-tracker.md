# Contract: ProgressTracker

Keyed User Property records, the `ProgressTracker` facade, the `getProgress` transport, the deferred
cleanup coordinator and the frontend service and validation schemas are implemented.

Internal progress state for frontend-driven assessment runs. Progress records are persisted as
separate GAS User Properties keyed by the `requestId` generated for the `startAssessmentRun`
API call, and are read back through the `getProgress` endpoint. One deferred time-based trigger
per user deletes terminal records only.

Backend modules:

- `src/backend/Utils/ProgressTracker.js` — facade, active run context and public API
- `src/backend/Utils/01_ProgressTrackerStore.js` — keyed property access
- `src/backend/Utils/02_ProgressTrackerCleanup.js` — trigger scheduling and terminal-only sweep
- `src/backend/z_Api/progressTracker.js` — `getProgress_` transport helper
- `src/backend/Triggers/triggerMethodHandlers.js` — `cleanupProgress` trigger method

Sibling contracts:

- [RequestStore](request-store.md) — shares User Properties and `LockService` conventions.
- [TriggerContext](trigger-context.md) — carries the `requestId` into the trigger execution.
- [Transport Envelope](transport-envelope.md) — supplies the shared success/error envelope.

---

## Persistence

### Key scheme

| Key                          | Scope           | Notes                                                                                                          |
| ---------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------- |
| `ProgressTracker<requestId>` | User Properties | One record per API-driven assessment run. `requestId` is the dispatch ID, appended directly to the key prefix. |
| `ProgressTracker`            | User Properties | Legacy unkeyed record for call sites with no run context. Not returned by API; eligible for terminal cleanup.  |

Cleanup state is user scoped, matching the progress records:

| Key                           | Scope           | Notes                                                                  |
| ----------------------------- | --------------- | ---------------------------------------------------------------------- |
| `AB_PROGRESS_CLEANUP_TRIGGER` | User Properties | Per-user marker holding the UID of the single pending cleanup trigger. |
| `AB_PROGRESS_CLEANUP_FLAG`    | User cache      | Per-user pending flag, 600-second TTL; cleared after each cleanup run. |

### Record shape

| Field       | Type           | Required   | Notes                                                                     |
| ----------- | -------------- | ---------- | ------------------------------------------------------------------------- |
| `requestId` | `string`       | keyed only | Non-empty; matches the dispatch `requestId`. Absent on the legacy record. |
| `step`      | `number`       | yes        | Finite, monotonic within the run.                                         |
| `message`   | `string`       | yes        | User-facing progress text.                                                |
| `completed` | `boolean`      | yes        | `true` only after a successful run finishes.                              |
| `error`     | string or null | yes        | User-facing error text; `null` when absent.                               |
| `timestamp` | `string`       | yes        | ISO 8601 string from the last write. No live `Date` crosses transport.    |

Terminal records are those with `completed === true` or a non-null `error`. All other records are
treated as in flight.

### Key persistence notes

- All property access goes through `GASPropertiesUtils`. The facade supplies the User Property store
  to `ProgressTrackerStore`, which owns key derivation and serialisation.
- Writes to distinct `ProgressTracker<requestId>` keys do not contend with one another. The legacy
  unkeyed key retains its existing single-record behaviour.
- `startTracking(requestId)` binds the active run ID for the execution. Reads and writes follow that
  context; `complete()` clears it only after writing the terminal record. Call sites without an ID
  keep the legacy key.
- `logError` and `logAndThrowError` accept an optional `{ deferCleanup }` options object. Default
  error writes call `ProgressTrackerCleanup.schedule()`; `deferCleanup: true` skips it for callers
  that already own cleanup and must not schedule another pass. `captureError` passes no options and
  uses the default.
- `ProgressTrackerStore.readAll()` returns raw keyed entries. Callers parse each entry with
  `ProgressTrackerStore.parse()`, which returns null for absent or malformed values and warns on
  malformed JSON; callers keep their own field-level checks (record shape, `requestId` presence).

### Cleanup behaviour

- `startTracking()`, `updateProgress()`, `complete()` and default error writes call
  `ProgressTrackerCleanup.schedule()`. The cached flag suppresses later writes; on a cache miss the
  durable marker repopulates it. A `LockService.getUserLock()` guard rechecks both before creating
  a trigger. A failed lock acquisition logs a warning and leaves the progress write intact.
- Trigger creation passes `{ skipTooManyTriggersRecovery: true }` to `createTimeBasedTrigger()`.
  Under that option **any** creation error is logged and the method returns `null`; it never calls
  `removeTriggers()` (which would delete assessment triggers) or `logAndThrowError()` (which would
  re-arm cleanup). The coordinator leaves the marker and cache flag unset so a later progress write
  retries.
- The fired trigger dispatches `cleanupProgress` from `TRIGGER_METHOD_HANDLERS` with empty params;
  it is a registry entry, not a public GAS function. `triggerHandler` still clears the context and
  deletes the fired trigger in its own `finally` block.
- The sweep deletes terminal records under the keyed `ProgressTracker<requestId>` keys and the
  legacy `ProgressTracker` key, keeping in-flight records. It logs and skips malformed values under
  either key form and leaves them untouched.
- The sweep clears the cache flag and marker in a `finally` block on every path. After a successful
  sweep that observed an in-flight record, it re-arms one trigger and rewrites both for the new
  trigger UID. A sweep failure rethrows after cleanup without re-arming; the next progress write
  retries. `triggerHandler` logs such failures with
  `logAndThrowError(message, error, { deferCleanup: true })` so the `logError` write path cannot
  re-arm the trigger that just failed.

---

## Transport

### `getProgress` (read)

| Aspect           | Detail                                                                          |
| ---------------- | ------------------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/progressTracker.js` → `getProgress_()`                       |
| Registration     | `getProgress` in `ALLOWLISTED_METHOD_HANDLERS`                                  |
| Parameters       | none                                                                            |
| Response `data`  | `{ tasks: ProgressRecord[] }`                                                   |
| Frontend service | `src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts` |
| Frontend Zod     | `GetProgressResponseSchema` in `assignmentAssessment.zod.ts`                    |

The response uses the shared success envelope unchanged (`ok`, `requestId`, `data`). Only keyed
records are returned; the legacy unkeyed `ProgressTracker` record has no `requestId` for the
frontend to correlate and is excluded. `getProgress_` reads through
`ProgressTrackerStore.readAll()`, logs and skips malformed keyed values, and propagates a
property-store read failure to the `apiHandler` error boundary. Records are sorted by `timestamp`
ascending with `requestId` ascending as tie-break. An empty set of keyed records returns
`{ tasks: [] }`.

The frontend wrapper `getProgress()` lives in the `assignmentAssessment` service domain and takes no
parameters.

### `startAssessmentRun` response change

`data` is `{ requestId: string }`, carrying the same value as the envelope `requestId`. See
[assignment.md § `startAssessmentRun`](assignment.md#startassessmentrun-write).

---

## Sub-entities

None. Each progress record is a flat object.

---

## Validation

`getProgress_` checks only the keyed record's `requestId` (non-empty string); it does not validate
the other record fields at the transport boundary. Domain invariants stay in `ProgressTracker` and
`AssignmentController`.

The frontend validates responses at the service boundary. `ProgressRecordSchema` requires a non-empty
`requestId`, a finite `step`, a string `message`, a boolean `completed`, a nullable string `error` and
a `z.iso.datetime()` timestamp in canonical UTC `Z` form (the non-deprecated Zod 4 API).
`GetProgressResponseSchema` requires `{ tasks: ProgressRecord[] }` and accepts an empty array.
`StartAssessmentRunResponseSchema` is non-nullable and requires `{ requestId: z.string().min(1) }`;
see [assignment.md § `startAssessmentRun`](assignment.md#startassessmentrun-write).

---

## Shared helpers

| Helper                                                                          | Decision | Owning path                                      | Rationale                                                                    | Status         |
| ------------------------------------------------------------------------------- | -------- | ------------------------------------------------ | ---------------------------------------------------------------------------- | -------------- |
| Keyed property access (`readAll`, `write`, `delete`, `parse`)                   | `new`    | `src/backend/Utils/01_ProgressTrackerStore.js`   | Isolates key derivation, parsing and legacy fallback filtering.              | `Implemented`  |
| Cleanup coordinator (`schedule`, `sweep`, `rearm`)                              | `new`    | `src/backend/Utils/02_ProgressTrackerCleanup.js` | Owns cache/marker dedupe and terminal-only deletion.                         | `Implemented`  |
| `ApiRequestContext` (`set`, `get`, `resetForTests`)                             | `new`    | `src/backend/z_Api/z_apiHandler.js`              | Exposes the dispatch ID to handlers without changing all handler signatures. | `Implemented`  |
| `CacheManager` with supplied cache + `remove(key)`                              | `extend` | `src/backend/RequestHandlers/CacheManager.js`    | Supports user cache and clears the pending-cleanup flag after each run.      | `Implemented`  |
| `GASPropertiesUtils`                                                            | `reuse`  | `src/backend/Utils/00_GASPropertiesUtils.js`     | Canonical PropertiesService entry point.                                     | Already exists |
| `LockService.getUserLock()`                                                     | `reuse`  | GAS service                                      | Same dedupe pattern as `requestStore.js`.                                    | Already exists |
| `TriggerController.createTimeBasedTrigger()` with `skipTooManyTriggersRecovery` | `extend` | `src/backend/Triggers/TriggerController.js`      | Prevents quota recovery from deleting assessment triggers.                   | `Implemented`  |
| `TriggerController.storeTriggerContext()`                                       | `reuse`  | `src/backend/Triggers/TriggerController.js`      | Stores cleanup trigger context like assessment triggers.                     | Already exists |

---

## File index

Implemented:

```text
src/backend/Utils/01_ProgressTrackerStore.js
src/backend/Utils/02_ProgressTrackerCleanup.js
src/backend/Utils/ProgressTracker.js
src/backend/Triggers/triggerMethodHandlers.js (cleanupProgress)
src/backend/z_Api/progressTracker.js
src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts
src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts
```
