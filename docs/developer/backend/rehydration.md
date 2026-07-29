# Assignment Rehydration Strategy

> **See also:** Canonical shape definitions for partial and full assignment records
> live in [`docs/developer/data-shapes/`](../data-shapes/INDEX.md).
> This doc describes the _process_ of hydration; the data-shape docs define the
> _structure_ at each hydration level.

This document describes how _full_ assignment hydration works when starting from the
lightweight (partially hydrated) assignment objects embedded inside an `ABClass`
instance that was loaded from JsonDbApp.

## Goals

- Keep `ABClassController.loadClass()` fast (only summary / partial assignments)
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

| Component              | Responsibility                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ABClassController`    | Owns persistence access (JsonDbApp collections) and provides a `readRehydrateAssignment` read-only method.   |
| Assignment Model       | Pure data + business logic. It does **not** know how to talk to storage.                                     |
| `AssignmentController` | Rehydrates only the assignment currently being processed so the rest of the class payload stays lightweight. |

### Transient runtime fields

Assignments may expose a `students` array while an assessment run is active so
controllers can reuse the hydrated class roster without re-fetching it. Treat
this property as ephemeral: it exists only during processing and **must not be
persisted** back into JsonDbApp. Persisting it would append duplicate roster
entries every time an assignment is rehydrated.

Similarly, `_hydrationLevel` is a transient marker (`'partial'` or `'full'`) that
controllers use to understand whether an assignment instance represents a full
payload. It is never persisted; callers set it when they rehydrate or when they
store partial summaries.

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

## Factory Pattern & Polymorphism

We use a **Factory Pattern** to handle polymorphic assignment types (`SlidesAssignment`, `SheetsAssignment`) during creation and rehydration.

### Creation

Use `Assignment.create()` instead of `new Assignment()`:

```javascript
const definition = new AssignmentDefinition({
  documentType: 'SLIDES',
  referenceDocumentId: refDocId,
  templateDocumentId: templateDocId,
  primaryTitle: 'Essay 1',
  primaryTopic: 'English',
  yearGroupKey: '10',
});
const assignment = Assignment.create(definition, courseId, assignmentId);
```

### Rehydration / Deserialization

Use `Assignment.fromJSON()` which routes to the correct subclass based on the `documentType` field:

```javascript
const assignment = Assignment.fromJSON(jsonPayload);
// Returns instance of SlidesAssignment or SheetsAssignment
```

**Note**: The factory pattern centralizes type discrimination but does not eliminate all conditionals. Controllers may still need to branch logic based on type (e.g., different processing pipelines for Slides vs Sheets), but the _instantiation_ and _deserialization_ logic is encapsulated.

## Persistence Workflow

We use a **Split Persistence Model**:

1.  **Full Persistence**: The complete assignment object (with all artifacts and content) is serialized via `toJSON()` and written to the dedicated `assign_full_...` collection.
2.  **Partial Summary**: A lightweight summary is generated via `toPartialJSON()` and stored in the `ABClass.assignments` array.

This ensures `ABClass` remains small and fast to load, while the full data is preserved safely in a separate document.

### End-to-end hydration/dehydration sequence (strict model)

Classes and primary methods (in call order):

1. **AssignmentDefinitionController.upsertDefinition()**

- Validates inputs, resolves topic, and checks staleness.
- Parses tasks via `_parseSlidesTasks`/`_parseSheetsTasks`, which now always rehydrate into `TaskDefinition` instances (`TaskDefinition.fromJSON(td.toJSON())`).
- Persists both forms: `_persistDefinitionWithRollback` → full collection (`toJSON()`), partial registry (`toPartialJSON()`).

2. **ABClassController.persistAssignmentRun()**

- Persists full assignment to `assign_full_<courseId>_<assignmentId>` using `Assignment.toJSON()` (includes fully hydrated `AssignmentDefinition`, `TaskDefinition`, and `BaseTaskArtifact` subclasses with content).
- Builds and stores partial summary via `Assignment.toPartialJSON()` (submissions/artifacts redacted) back into the owning `ABClass` document.

3. **ABClassController.loadClass()** (not changed)

- Returns the lightweight `ABClass` with only partial assignments (heavy fields already stripped).

4. **AssignmentController.processSelectedAssignment()**

- Creates a fresh `Assignment` instance from the definition, runs the assessment pipeline, then persists via `ABClassController.persistAssignmentRun()`. Does not rehydrate from the full collection — the full document is written anew on each run.

5. **ABClassController.readRehydrateAssignment(courseId, assignmentId)**

- Read-only operation: loads the full document from `assign_full_<courseId>_<assignmentId>` without refreshing roster data or mutating ABClass.
- Reconstructs the typed instance via `Assignment.fromJSON()`; this cascades into `AssignmentDefinition.fromJSON()`, which in turn strictly hydrates tasks (`_hydrateTasks` requires `taskTitle` and instantiates `TaskDefinition`, whose artifacts are materialised via `ArtifactFactory.fromJSON`).
- Resolves partial definitions via `AssignmentDefinitionController.getDefinitionByKey(definitionKey, { form: 'full' })`.
- Marks `_hydrationLevel = 'full'` on the returned instance.

6. **Assignment runtime**

- Processing pipelines operate on the full instance; transient fields (`students`, `_hydrationLevel`) remain runtime-only and must never be persisted.

### Strictness notes

- Task payloads must include `taskTitle`; `_hydrateTasks` now fails fast via `ProgressTracker.logAndThrowError` if a task is missing it.
- Parser outputs are normalised back into `TaskDefinition` instances before persistence to guarantee `toPartialJSON()` is available and consistent.
- Artifact redaction now relies on artifact classes’ `toPartialJSON()`; legacy plain-object fallbacks have been removed.

## Rehydration Algorithm (Read-Only)

The read-only rehydration path uses `readRehydrateAssignment` which loads and hydrates an assignment without requiring an ABClass instance or triggering a roster refresh.

```javascript
readRehydrateAssignment(courseId, assignmentId) {
  // 1. Validate inputs
  if (typeof courseId !== 'string' || !courseId.trim()) throw new TypeError(...);
  if (typeof assignmentId !== 'string' || !assignmentId.trim()) throw new TypeError(...);

  // 2. Read full document from dedicated collection
  const document = this._loadFullAssignmentDocument(courseId, assignmentId);

  // 3. Validate document structure
  this._validateAssignmentDocument(document);

  // 4. Reconstruct typed instance
  const hydratedAssignment = Assignment.fromJSON(document);

  // 5. Resolve partial definition if needed
  this._ensureFullDefinition(hydratedAssignment);

  // 6. Mark as full
  hydratedAssignment._hydrationLevel = 'full';

  return hydratedAssignment;
}
```

### Fallback submission reconstruction (`_rehydrateSubmission`)

When `StudentSubmission.fromJSON()` throws (e.g. for a corrupt or unexpected artifact payload), `_rehydrateSubmission` logs a warning and falls back to constructing a `StudentSubmission` directly from the stored `subObject` fields:

```javascript
const submission = new StudentSubmission(
  identifier || null,
  inst.assignmentId,
  subObject.documentId || null,
  subObject.studentName || subObject.name || null
);
if (subObject.createdAt) {
  submission.createdAt =
    subObject.createdAt instanceof Date ? subObject.createdAt.toISOString() : subObject.createdAt;
}
if (subObject.updatedAt) {
  submission.updatedAt =
    subObject.updatedAt instanceof Date ? subObject.updatedAt.toISOString() : subObject.updatedAt;
}
const items = subObject.items || {};
Object.entries(items).forEach(([taskId, itemJson]) => {
  try {
    submission.items[taskId] = StudentSubmissionItem.fromJSON(itemJson);
  } catch (itemError) {
    ABLogger.getInstance().warn(
      'rehydrateAssignment: dropped corrupt submission item during resilient reconstruction',
      { studentId: identifier, taskId, err: itemError }
    );
  }
});
inst.submissions.push(submission);
```

Key points:

- `createdAt` / `updatedAt` are converted to ISO strings via `toISOString()` when they are `Date` instances, preserving the `string` transport contract (GAS `google.script.run` prohibits `Date` return values). Non-`Date` values (already ISO strings) are stored as-is.
- `items` are reconstructed individually through `StudentSubmissionItem.fromJSON`; a single corrupt item is dropped with a warning rather than failing the whole submission.
- The reconstructor never returns a raw object: if even the fallback throws, the submission is omitted (logged at `error` level) so the model's serialisation contract is preserved and the transport boundary is not handed a plain-object payload.
- `documentId` is defaulted to `null` by the `StudentSubmission` constructor when the stored partial omits it, preserving the `string | null` contract at the transport boundary.

## Error Handling

| Situation                                         | Action                                           |
| ------------------------------------------------- | ------------------------------------------------ |
| Full collection missing                           | Throw `Error` (message includes collection name) |
| Empty collection                                  | Throw (treated same as missing)                  |
| Corrupt doc (missing `assignmentId` / mismatch)   | Throw                                            |
| Assignment absent in `assign_full_...` collection | Throw `AssignmentNotFoundError`                  |

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
- Staleness comparison using `updatedAt` revision suffix
- Metrics: count hydration events / average ms

## Controller Integration Notes

- `readRehydrateAssignment()` is a read-only path used by the `getAssignment_()` API
  handler. It loads and hydrates an assignment from its dedicated collection
  without an ABClass instance, roster refresh, or persistence write.
- `processSelectedAssignment()` (the write path) creates a new `Assignment` instance
  from the definition and persists via `persistAssignmentRun()`. It does not call
  `readRehydrateAssignment()` — the full document is written from scratch on each run.
- Other assignments remain partially hydrated inside `abClass.assignments`, so
  list and cohort views stay light even while one assignment is being processed.
