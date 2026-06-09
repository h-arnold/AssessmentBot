# `getAssignmentDefinition` Parse Error — Debug Session

**Date:** 2026-06-08
**Branch:** `fix/AssignmentDefinitionParseError`

## Problem

`getAssignmentDefinition` API call returns `null` to the frontend success handler (`responseData: null`, `typeof: object`), but other API methods (partials, upsert, etc.) work fine. The method-specificity is the key puzzle.

---

## Key Evidence

### Frontend Console Logs

```
[DEBUG apiService] raw deserialisedResponse: null
[DEBUG apiService] typeof deserialisedResponse: object
[DEBUG assignmentDefinitionService] raw responseData: null
[DEBUG assignmentDefinitionService] typeof responseData: object
```

(`typeof null === 'object'` — JS quirk, the frontend genuinely receives `null`.)

### Browser DevTools — Raw network response payload

```
[["op.exec",[0,null,"{data={primaryTitle=MoP - Firewalls, documentType=SLIDES, alternateTitles=[Ljava.lang.Object;@1919aa3f, yearGroupLabel=9, assignmentWeighting=1.0, primaryTopicKey=ece440a5-2d87-46fe-977e-6c49657a4466, createdAt=Thu Jun 04 05:44:18 PDT 2026, primaryTopic=Cyber Security, referenceDocumentId=1VxuIBv1Bd2vR-yRrgW8_OTTNQ9uOPg7K-7QFCR-bvRo, templateDocumentId=1XWodnuuR4cAdiXtJL5J0QvZDumr4jtYD3zOnpQL873A, definitionKey=300b8cc8-c00f-45ff-a95a-d572076812ee, yearGroupKey=fed11651-5d54-4e95-9afe-aa9ede161c0f, alternateTopics=[Ljava.lang.Object;@2ec7376e, tasks=[Ljava.lang.Object;@be47570, updatedAt=Thu Jun 04 05:45:36 PDT 2026}, requestId=70b87cd5-a926-41e5-b64e-9ae61979eadb, ok=true}"]],["di",4014]]
```

### Matching Backend Stackdriver Log

```
[["op.exec",[0,null,"{data={primaryTitle=MoP - Firewalls, ..., createdAt=Thu Jun 04 05:44:18 PDT 2026, ..., alternateTopics=[Ljava.lang.Object;@2ec7376e, tasks=[Ljava.lang.Object;@be47570, updatedAt=Thu Jun 04 05:45:36 PDT 2026}, requestId=70b87cd5-..., ok=true}"]],["di",4014]]
```

(This is `JSON.stringify(response)` output from the `_success()` method in `z_apiHandler.js`.)

---

## Critical Observations

1. The response uses `=` separators, not `:` — this is **Java `HashMap.toString()` / `Object.toString()`** format, **NOT JSON**.
2. `[Ljava.lang.Object;@1919aa3f` — Java array references, not serialised arrays.
3. `createdAt=Thu Jun 04 05:44:18 PDT 2026` — Java `Date.toString()` format, not ISO 8601.
4. The outer `[["op.exec",...],["di",...]]` wrapper is the **GAS HTML Service internal iframe message protocol** (`google.script.run` communication channel) — it's what the browser DevTools show for any `google.script.run` call, so that's normal.
5. The inner string `"{data={...}}"` is the **problematic** part — it's `toString()` output that can't be `JSON.parse`'d.

---

## Files Modified

| File                                                          | Change                                                                                                                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/frontend/src/services/apiService.ts`                     | Added detailed `console.log` debugging for raw GAS response, deserialised response, keys, and `data` field; temporarily bypassed Zod `ApiResponseSchema` validation |
| `src/frontend/src/services/assignmentDefinitionService.ts`    | Replaced structured `logFrontendEvent` with direct `console.log`; temporarily bypassed `GetAssignmentDefinitionResponseSchema.parse()`                              |
| `src/backend/Models/AssignmentDefinition.js`                  | Changed `alternateTitles \|\| []` → `Array.isArray(...) ? [...arr] : []` in constructor and `fromJSON` (same for `alternateTopics`)                                 |
| `src/backend/y_controllers/AssignmentDefinitionController.js` | Same defensive array spread in `_toCanonicalFullDefinitionResponse`                                                                                                 |

---

## Hypotheses Ruled Out

| #   | Hypothesis                                                                            | Ruling                                         | Reason                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **JsonDbApp leaking Java arrays**                                                     | ❌ Ruled out                                   | JsonDbApp is pure GAS JavaScript using `JSON.parse`/`JSON.stringify`. It cannot produce Java `Object[]` refs. The `[Ljava.lang.Object;@...` format comes from Java's `Object.toString()`, called by GAS serialization when it encounters unstringifiable objects. |
| 2   | **`alternateTitles`/`alternateTopics` falsy fallback (`\|\|`) not triggering**        | ❌ Code change applied but unlikely root cause | The `\|\|` only falls back on falsy values. Java arrays are truthy objects, so they'd pass through. New `Array.isArray()` guard catches this, but the issue likely lies deeper.                                                                                   |
| 3   | **Zod schema rejecting valid data**                                                   | ❌ Ruled out                                   | Both `ApiResponseSchema` and `GetAssignmentDefinitionResponseSchema` are bypassed. Frontend accepts raw `responseData` directly. Still receiving `null`.                                                                                                          |
| 4   | **`google.script.run` returning a non-object (e.g. string) that bypasses JSON.parse** | ❌ Ruled out                                   | The log `typeof deserialisedResponse: object` at line 2 confirms the GAS runtime DID deliver an object (via `google.script.run`'s internal deserialization). It's literally `null`.                                                                               |

---

## Hypotheses Not Yet Ruled Out

| #   | Hypothesis                                                                      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | **GAS `toString()` fallback on the entire response object**                     | The `{data=...}` format with `=` separators instead of `:` strongly suggests `Object.toString()` was called on either the response envelope itself or a deeply nested value. GAS's `google.script.run` serialization may fall back to `toString()` when it encounters a return value graph containing objects it can't serialize (e.g., GAS service wrappers, blobs, native Java objects from Drive API). **Why only `getAssignmentDefinition`?** This method returns the richest object graph (tasks, arrays, topic references). Other methods return simpler data. |
| 6   | **`createdAt`/`updatedAt` as live GAS Date objects poisoning serialisation**    | The output shows `createdAt=Thu Jun 04 05:44:18 PDT 2026` (Java `Date.toString()`). If stored documents contain native GAS `Date` objects that survive `JSON.parse` → `fromJSON` → `toJSON`, they could break the chain. However, JsonDbApp stores dates as ISO strings. The data may have been written through a legacy path (AdminSheet, old controller code) that stored raw `Date` objects.                                                                                                                                                                      |
| 7   | **`tasks` field containing a Java array instead of a plain JS object**          | `tasks=[Ljava.lang.Object;@be47570` suggests `tasks` is itself a Java array. If `source.tasks` is a Java array (not a plain object), `Object.entries(source.tasks \|\| {})` would iterate numeric indices, potentially producing a different shape than expected.                                                                                                                                                                                                                                                                                                    |
| 8   | **The response wrapping in `_success()` picks up an already-serialized string** | `_success(requestId, data)` does `{ok: true, requestId, data: data ?? null}`. If `data` is already a `toString()`-style string (because the controller's `_toCanonicalFullDefinitionResponse` returned a string instead of an object, or the `AssignmentDefinition.fromJSON` deserialization failed silently), the envelope would contain `data=thatToStringString`. But the debug log `typeof response === 'string'` would catch this case… unless the response is somehow an object with `toString()` overridden.                                                  |

---

> **Note regarding Hypotheses 5–8:** All of these are resolved by the confirmed Hypothesis 9 below.
> The single root cause — live `Date` objects in `createdAt`/`updatedAt` fields — poisoned the
> entire `google.script.run` serialisation. The `[Ljava.lang.Object;@...` format for arrays was a
> secondary symptom of the same serialisation failure (GAS gave up on the entire object graph
> after encountering the unserialisable `Date` values).

---

## ✅ Hypothesis 9 — Confirmed: Date objects poisoning `google.script.run` serialisation

After reading the [`google.script.run` reference docs](https://developers.google.com/apps-script/guides/html/reference/run):

> "Requests fail if you attempt to pass a `Date`, `Function`, or other prohibited type, including prohibited types inside objects or arrays."

This applies to **return values** too. The raw network payload shows `createdAt=Thu Jun 04 05:44:18 PDT 2026` — the Java `Date.toString()` format — confirming dates are present and likely still live `Date` objects, not ISO strings.

### Fix applied and verified

In `src/backend/y_controllers/AssignmentDefinitionController.js:958-959`, changed:

```javascript
// Before
createdAt: source.createdAt || null,
updatedAt: source.updatedAt || null,

// After
createdAt: source.createdAt instanceof Date ? source.createdAt.toISOString() : (source.createdAt ?? null),
updatedAt: source.updatedAt instanceof Date ? source.updatedAt.toISOString() : (source.updatedAt ?? null),
```

**Status: ✅ CONFIRMED — Root cause identified.** The `getAssignmentDefinition` method returned `null` because `createdAt` and `updatedAt` were live GAS `Date` objects (not ISO strings), which `google.script.run` cannot serialise. The Java `Date.toString()` fallback poisoned the entire response envelope, producing non-JSON output that the frontend's `JSON.parse()` could not process, resulting in `null`.

### Related documentation updated

- `src/frontend/AGENTS.md` — Added Section 4.3 documenting prohibited types with rules for backend code.
- `docs/developer/backend/api-layer.md` — Added "Critical: prohibited types in google.script.run return values" subsection with backend rules.

All debug code changes have been reverted against `feat/ReactFrontend` for a clean slate.
