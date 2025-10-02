# Assignment Rehydration Strategy

This document describes how _full_ assignment hydration works when starting from the
lightweight (partially hydrated) assignment objects embedded inside an `ABClass`
instance that was loaded from JsonDbApp.

## Goals

- Keep `ABClassManager.loadClass()` fast (only summary / partial assignments)
- Hydrate **only when explicitly requested** (e.g. re‑running an assessment, export, audit)
- Avoid subtle stale-reference bugs in JavaScript
- Maintain a single, stable schema (partial vs full differ only in payload weight)
- Fail loudly (throw) if the authoritative full assignment collection is missing or corrupt

## Terminology

| Term               | Meaning                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Partial Assignment | Assignment object inside `ABClass.assignments[]` with heavy fields elided (e.g. `artifact.content === null`).               |
| Full Assignment    | Same shape, but every field populated (artifacts contain `content`, metadata complete, feedback/assessments fully present). |
| Hydration          | Replacing a partial assignment with its authoritative full version.                                                         |

## Responsibilities

| Component        | Responsibility                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `ABClassManager` | Owns persistence access (JsonDbApp collections) and provides a `rehydrateAssignment` method. |
| Assignment Model | Pure data + business logic. It does **not** know how to talk to storage.                     |

## Collection Naming Convention

Full (authoritative) assignment documents are stored in a per-assignment collection distinct from the class collection. Recommended pattern:

```
assign_full_<courseId>_<assignmentId>
```

Rationale:

- Clear prefix (`assign_full_`) avoids collisions
- Easy to grep/debug
- Stable and deterministic

(If your environment already enforces namespacing, adapt the prefix accordingly.)

## Hydration Triggers

Hydration is **explicit**. Callers invoke rehydration before operations that require full payloads, for example:

- Running or re-running an automated assessment
- Generating a detailed export/report
- Deep analysis / NLP passes over artifact contents

All other UI / list / overview paths should rely on the partial object.

## Detecting Hydration State

Instead of scanning artifacts each time, we set an internal transient flag after hydration:

```js
assignment._hydrationLevel = 'full'; // or 'partial'
```

Provide a helper (optional):

```js
function isHydrated(assignment) {
  return assignment?._hydrationLevel === 'full';
}
```

This flag is _not_ persisted—its absence implies partial unless contents say otherwise.

## Full Replace vs In-Place Mutation

Two common patterns for updating the assignment in memory:

### Option A: Immutable Replace (Recommended for Simplicity)

1. Fetch full document from its collection.
2. Construct (or deserialize) a new assignment object.
3. Replace the element in `abClass.assignments` **by index**.
4. Return the new instance.

Pros:

- Straightforward; no deep merge logic
- Guarantees internal consistency (full object was serialized coherently)

Cons:

- Any external references to the old partial object will remain stale unless callers adopt the returned reference

Mitigation: Document that callers **must** use the returned hydrated instance.

## Rehydration Algorithm (Immutable Replace)

Pseudocode:

```js
rehydrateAssignment(abClass, assignmentId) {
  const idx = abClass.assignments.findIndex(a => a.assignmentId === assignmentId);
  if (idx === -1) throw new Error(`Assignment ${assignmentId} not found in class ${abClass.classId}`);

  const full = fetchFullAssignment(abClass.classId, assignmentId); // throws on missing/corrupt
  full._hydrationLevel = 'full';

  // Replace in array
  abClass.assignments[idx] = full;
  return full;
}
```

`fetchFullAssignment()`:

```js
function fetchFullAssignment(classId, assignmentId) {
  const colName = `assign_full_${classId}_${assignmentId}`;
  const col = dbManager.getCollection(colName);
  const docs = col.readAll ? col.readAll() : col.find ? col.find({}) : [];
  if (!docs || !docs.length) throw new Error(`Full assignment collection missing: ${colName}`);
  const doc = docs[0];
  if (!doc || doc.assignmentId !== assignmentId) {
    throw new Error(`Corrupt full assignment document in ${colName}`);
  }
  return doc; // Or transform via Assignment.fromJSON if available
}
```

## Error Handling

| Situation                                       | Action                                           |
| ----------------------------------------------- | ------------------------------------------------ |
| Full collection missing                         | Throw `Error` (message includes collection name) |
| Empty collection                                | Throw (treated same as missing)                  |
| Corrupt doc (missing `assignmentId` / mismatch) | Throw                                            |
| Assignment absent in `ABClass.assignments`      | Throw before attempting hydration                |

Future enhancement: catch these errors and trigger a reconstruction or assessment cycle.

## Testing Guidelines (Vitest)

| Test                                  | Purpose                                            |
| ------------------------------------- | -------------------------------------------------- |
| Hydrates successfully                 | Replaces partial with full; sets `_hydrationLevel` |
| Throws on missing full collection     | Ensures error path                                 |
| Throws when assignment not in ABClass | Guard condition                                    |
| Replacement returns new instance      | Ensures immutability contract                      |
| Old reference remains partial         | Validates caller must adopt new reference          |

## Future Extensions (Deferred)

- Artifact-level selective hydration (per `artifact.uid`)
- Background prefetch queue (hydrate last opened N assignments)
- Staleness comparison using `lastUpdated` revision suffix
- Metrics: count hydration events / average ms

## Summary

Hydration is an explicit, authoritative full replace using a dedicated per-assignment collection. We keep the model layer storage-agnostic by centralizing logic in `ABClassManager`. The immutable replace pattern minimizes subtle JS reference bugs, at the cost of requiring callers to adopt the returned instance.

---

_Document version: initial draft_
