# Contract: ProgressTracker

Keyed User Property records and the `ProgressTracker` facade are implemented. The `getProgress`
transport, cleanup coordinator and frontend validation remain planned and are marked
`Not implemented` below.

Internal progress state for frontend-driven assessment runs. Progress records are persisted as
separate GAS User Properties keyed by the `requestId` generated for the `startAssessmentRun`
API call, and are read back through the planned `getProgress` endpoint. Cleanup is planned as one
deferred time-based trigger per user which deletes terminal records only.

Backend modules:

- `src/backend/Utils/ProgressTracker.js` — facade, active run context and public API (implemented)
- `src/backend/Utils/01_ProgressTrackerStore.js` — keyed property access (implemented)

Planned modules:

- `src/backend/Utils/02_ProgressTrackerCleanup.js` — trigger scheduling and sweep
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

Planned cleanup state (`Not implemented`):

| Key                           | Scope           | Notes                                                                          |
| ----------------------------- | --------------- | ------------------------------------------------------------------------------ |
| `AB_PROGRESS_CLEANUP_TRIGGER` | User Properties | Per-user marker holding the UID of that user's single pending cleanup trigger. |
| progress cleanup cache key    | User cache      | Per-user cached pending flag, 600-second TTL; cleared after each cleanup run.  |

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
- `ProgressTrackerStore.readAll()` returns raw keyed entries only. Callers own parsing and
  malformed-record handling.

### Planned cleanup behaviour (Not implemented)

- The cleanup trigger check is cached in the user cache with a 600-second TTL; the durable
  per-user User Property marker covers cache misses. A `LockService.getUserLock()` guard prevents
  two callers from both creating a cleanup trigger.
- Cleanup clears the cache flag and marker in a `finally` block on every run. If a non-terminal
  record remains, it re-arms exactly one trigger and rewrites the marker and cache flag for the new
  trigger UID before returning, so later writes still see a pending trigger.
- A sweep failure clears the marker and cache flag in `finally` and does not re-arm; the next
  progress write re-arms. Re-arming occurs only after a successful sweep that observed a
  non-terminal record. `triggerHandler` logs such failures with
  `logAndThrowError(message, error, { deferCleanup: true })` so the `logError` write path cannot
  re-arm the trigger that just failed.
- Trigger creation passes `{ skipTooManyTriggersRecovery: true }` to `createTimeBasedTrigger()`.
  Under that option **any** creation error is logged and the method returns `null`; it never calls
  `removeTriggers()` (which would delete assessment triggers) or `logAndThrowError()` (which would
  re-arm cleanup). The coordinator leaves the marker and cache flag unset so a later progress write
  retries.
- Malformed keyed records are logged and skipped by the status read; cleanup does not rewrite them.

---

## Transport (Not implemented)

### `getProgress` (read)

| Aspect           | Detail                                                                          |
| ---------------- | ------------------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/progressTracker.js` → `getProgress_()`                       |
| Registration     | `getProgress` in `ALLOWLISTED_METHOD_HANDLERS`                                  |
| Parameters       | none                                                                            |
| Response `data`  | `{ tasks: ProgressRecord[] }`                                                   |
| Frontend service | `src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts` |
| Frontend Zod     | `GetProgressResponseSchema` in `assignmentAssessment.zod.ts`                    |

The response uses the shared success envelope unchanged (`ok`, `requestId`, `data`). Records are
sorted by `timestamp` ascending with `requestId` ascending as tie-break. The legacy unkeyed record
is excluded. An empty store returns `{ tasks: [] }`.

### `startAssessmentRun` response change

`data` is `{ requestId: string }`, carrying the same value as the envelope `requestId`. See
[assignment.md § `startAssessmentRun`](assignment.md#startassessmentrun-write).

---

## Sub-entities

None. Each progress record is a flat object.

---

## Validation (Not implemented)

Frontend schemas require non-empty `requestId`, finite `step`, string `message`, boolean
`completed`, nullable `error` and ISO 8601 `timestamp`. Backend transport validation stays in
`getProgress_`; domain invariants stay in `ProgressTracker` and `AssignmentController`.

---

## Shared helpers

| Helper                                                                          | Decision | Owning path                                      | Rationale                                                                    | Status            |
| ------------------------------------------------------------------------------- | -------- | ------------------------------------------------ | ---------------------------------------------------------------------------- | ----------------- |
| Keyed property access (`readAll`, `write`, `delete`)                            | `new`    | `src/backend/Utils/01_ProgressTrackerStore.js`   | Isolates key derivation, parsing and legacy fallback filtering.              | `Implemented`     |
| Cleanup coordinator (`schedule`, `sweep`, `rearm`)                              | `new`    | `src/backend/Utils/02_ProgressTrackerCleanup.js` | Owns cache/marker dedupe and terminal-only deletion.                         | `Not implemented` |
| `ApiRequestContext` (`set`, `get`, `resetForTests`)                             | `new`    | `src/backend/z_Api/z_apiHandler.js`              | Exposes the dispatch ID to handlers without changing all handler signatures. | `Implemented`     |
| `CacheManager` with supplied cache + `remove(key)`                              | `extend` | `src/backend/RequestHandlers/CacheManager.js`    | Supports user cache and clears the pending-cleanup flag after each run.      | `Not implemented` |
| `GASPropertiesUtils`                                                            | `reuse`  | `src/backend/Utils/00_GASPropertiesUtils.js`     | Canonical PropertiesService entry point.                                     | Already exists    |
| `LockService.getUserLock()`                                                     | `reuse`  | GAS service                                      | Same dedupe pattern as `requestStore.js`.                                    | Already exists    |
| `TriggerController.createTimeBasedTrigger()` with `skipTooManyTriggersRecovery` | `extend` | `src/backend/Triggers/TriggerController.js`      | Prevents quota recovery from deleting assessment triggers.                   | `Not implemented` |
| `TriggerController.storeTriggerContext()`                                       | `reuse`  | `src/backend/Triggers/TriggerController.js`      | Stores cleanup trigger context like assessment triggers.                     | Already exists    |

---

## File index

Implemented:

```text
src/backend/Utils/01_ProgressTrackerStore.js
src/backend/Utils/ProgressTracker.js
```

Planned:

```text
src/backend/Utils/02_ProgressTrackerCleanup.js
src/backend/z_Api/progressTracker.js
src/backend/Triggers/triggerMethodHandlers.js (cleanupProgress)
src/frontend/src/services/assignmentAssessment/*
```
