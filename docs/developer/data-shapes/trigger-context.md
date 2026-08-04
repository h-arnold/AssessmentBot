# Contract: TriggerContext

Internal trigger execution context store persisted via GAS Script Properties, keyed by
triggerUid. Stores the method and params for a scheduled time-based trigger so the single
public `triggerHandler()` entrypoint can validate, authorise, and dispatch on fire.

> **Status: Implemented** — delivered in `src/backend/Triggers/`
> (`TriggerController` moved from `src/backend/Utils/` + context storage
> methods, `triggerHandler.js`, `triggerMethodHandlers.js`).

Backend implementation: `src/backend/Triggers/TriggerController.js` (moved from `src/backend/Utils/TriggerController.js`)
Persistence: `PropertiesService.getScriptProperties()` via `GASPropertiesUtils` (`src/backend/Utils/00_GASPropertiesUtils.js`)
API handlers: Not directly callable — consumed internally by `triggerHandler()` in `src/backend/Triggers/triggerHandler.js`
Frontend service: None — internal backend mechanism
Frontend Zod: None

Sibling contracts:

- [Contract: RequestStore](request-store.md) — Shares the GAS PropertiesService persistence
  pattern (Script Properties vs User Properties) and is likewise an internal backend store
  with no transport.
- [Contract: AuthCache](auth-cache.md) — AuthService's in-memory group-membership cache;
  `triggerHandler()` reads it via `AuthService.checkAccess({ bypassCache: true })`.
- No other sibling contracts — TriggerContext is an internal backend mechanism with no
  frontend-facing transport and no registration in `ALLOWLISTED_METHOD_HANDLERS`.

---

## Persistence

### Store shape

The store is a pair of Script Properties keys per triggerUid. Each key embeds the
`triggerUid` — an opaque `String` returned by `Trigger.getUniqueId()` (via
`TriggerController.createTimeBasedTrigger()`), assumed to equal the GAS `event.triggerUid`
at fire time (ACTION_PLAN Assumption 2, pending staging verification) — so concurrent
triggers never collide.

| Key                    | Type     | Value                                                                                               | Notes                                                                                   |
| ---------------------- | -------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `trigger:<uid>:method` | `string` | Trigger method name (e.g. `'processSelectedAssignment'`)                                            | Written by `storeTriggerContext()`; read by `triggerHandler()` for validation and auth. |
| `trigger:<uid>:params` | `string` | JSON-serialised params object, e.g. `{"assignmentId":"...","definitionKey":"...","courseId":"..."}` | Written by `storeTriggerContext()`; passed to the registered handler on dispatch.       |

### Record lifecycle

The store is managed by three instance methods on `TriggerController`
(`src/backend/Triggers/TriggerController.js`). Lifecycle steps are orchestrated by
`triggerHandler()` in `src/backend/Triggers/triggerHandler.js`:

1. **`storeTriggerContext(triggerUid, { method, params })`** — Writes
   `trigger:<uid>:method` and `trigger:<uid>:params` to Script Properties via
   `GASPropertiesUtils`. Called by `AssignmentController.startProcessing()` at trigger
   creation time.

2. **`getTriggerContext(triggerUid)`** — Reads both keys directly from
   `GASPropertiesUtils.getScriptProperties()` (there is no single-key getter wrapper on
   `GASPropertiesUtils`) and returns `{ method, params }` (params deserialised from JSON).
   Returns `null` when the triggerUid is unknown or when both keys are missing. When only one of
   the two keys exists it returns a partial context (`{ method }` or `{ params }`, with the
   missing key set to `null`) — `triggerHandler()` treats any partial context as invalid and
   aborts. Returns `null` on malformed `params` JSON (parse failure), consistent with the
   `CacheManager.get()` graceful-degradation precedent.

3. **`clearTriggerContext(triggerUid)`** — Removes both keys for the triggerUid via
   `GASPropertiesUtils.clearProperties()`.

### Key persistence notes

- All property access must go through `GASPropertiesUtils`, not raw `PropertiesService`
  (backend convention).
- The `triggerUid` is the only key namespace — each scheduled trigger owns an isolated
  context, so concurrent triggers do not collide.
- `triggerHandler()` owns cleanup: it clears the context and deletes the fired trigger in
  a `finally` block, and only for a resolved, known triggerUid (malformed input does not
  trigger cleanup).
- The `params` value is a JSON string because Script Properties only stores strings.
- The previous model stored task context in User Properties and dispatched directly to
  `triggerProcessSelectedAssignment`; the ScriptProperties-keyed-by-triggerUid model replaces
  it, and existing triggers must be drained before deployment.

---

## Transport

This store has no API endpoint transport. It is an internal backend mechanism consumed
exclusively by `triggerHandler()` and `AssignmentController.startProcessing()`. There is
no `z_Api` handler file, no `ALLOWLISTED_METHOD_HANDLERS` registration, and no frontend
service or Zod schema for this store.

---

## Sub-entities

None — TriggerContext is a pair of flat key-value properties with no embedded sub-entities.

---

## Validation

**Backend validation** (in `src/backend/Triggers/TriggerController.js`):

- `storeTriggerContext()` validates `triggerUid`, `method`, and `params` via
  `Validate.requireParams`, then writes the method name string and the JSON-serialised
  params.
- `getTriggerContext()` validates `triggerUid` via `Validate.requireParams`; returns
  `{ method, params }` or `null` for unknown triggerUids.
- `clearTriggerContext()` validates `triggerUid` via `Validate.requireParams`; removes both
  keys.
- `triggerHandler()` validates the resolved context before dispatch: unknown method → log
  error via `ABLogger` and abort; missing context → log error and abort.

**Key domain rules:**

- The method name read from `trigger:<uid>:method` is resolved during input validation in
  `triggerHandler()`, so it is available for the audit log and the fail-closed auth check
  (`AuthService.checkAccess({ bypassCache: true, requireConfigured: true })`).
- Malformed input (missing event, unknown triggerUid, unknown method) surfaces via
  fail-loud logging only — GAS discards trigger return values, so no error envelope is
  produced.

### Known discrepancies

1. **Script Properties collision with `ConfigurationManager.maybeDeserializeProperties()`.**
   `maybeDeserializeProperties()` early-returns when **any** Script Property key exists
   (`98_ConfigurationManagerClass.js` — `safeGetPropertyKeys(...).length > 0`). Writing
   `trigger:<uid>:*` keys therefore suppresses the legacy `propertiesStore` deserialisation
   on a store that has trigger context but no config blob (SPEC v1.7 change-log I5; removal
   of `maybeDeserializeProperties()` is out of scope — SPEC §Out of scope for v1).
   **Classification: Fragile / accepted risk.**

---

## File Index

```
Implementation:       src/backend/Triggers/TriggerController.js
  ├── storeTriggerContext(triggerUid, { method, params })  — write method + params via GASPropertiesUtils
  ├── getTriggerContext(triggerUid)                        — read { method, params }
  └── clearTriggerContext(triggerUid)                      — remove both keys

Writer:               src/backend/y_controllers/AssignmentController.js
  └── startProcessing()          — storeTriggerContext() after createTimeBasedTrigger()

Consumer:             src/backend/Triggers/triggerHandler.js
  ├── resolve triggerUid from event
  ├── getTriggerContext(triggerUid)
  ├── AuthService.checkAccess({ bypassCache: true, requireConfigured: true })
  ├── TRIGGER_METHOD_HANDLERS[method](params)
  └── finally: clearTriggerContext(triggerUid) + deleteTriggerById(triggerUid)

Registry:             src/backend/Triggers/triggerMethodHandlers.js
  └── TRIGGER_METHOD_HANDLERS
```
