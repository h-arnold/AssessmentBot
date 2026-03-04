# Assignment Rehydration Strategy

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
| `ABClassController`    | Owns persistence access (JsonDbApp collections) and provides a `rehydrateAssignment` method.                 |
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
const assignment = Assignment.create(
  'SLIDES', // documentType
  courseId,
  assignmentId,
  refDocId,
  templateDocId
);
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

1. **AssignmentDefinitionController.ensureDefinition()**

- Validates inputs, resolves topic, and checks staleness.
- Parses tasks via `_parseSlidesTasks`/`_parseSheetsTasks`, which now always rehydrate into `TaskDefinition` instances (`TaskDefinition.fromJSON(td.toJSON())`).
- Persists both forms: `saveDefinition` → full collection (`toJSON()`), `savePartialDefinition` → registry (`toPartialJSON()`).

2. **ABClassController.persistAssignmentRun()**

- Persists full assignment to `assign_full_<courseId>_<assignmentId>` using `Assignment.toJSON()` (includes fully hydrated `AssignmentDefinition`, `TaskDefinition`, and `BaseTaskArtifact` subclasses with content).
- Builds and stores partial summary via `Assignment.toPartialJSON()` (submissions/artifacts redacted) back into the owning `ABClass` document.

3. **ABClassController.loadClass()** (not changed)

- Returns the lightweight `ABClass` with only partial assignments (heavy fields already stripped).

4. **AssignmentController.processSelectedAssignment()**

- For the selected assignment, calls `ABClassController.rehydrateAssignment()` when a full run is needed.

5. **ABClassController.rehydrateAssignment()**

- Reads the full document from `assign_full_...`.
- Reconstructs the typed instance via `Assignment.fromJSON()`; this cascades into `AssignmentDefinition.fromJSON()`, which in turn strictly hydrates tasks (`_hydrateTasks` requires `taskTitle` and instantiates `TaskDefinition`, whose artifacts are materialised via `ArtifactFactory.fromJSON`).
- Marks `_hydrationLevel = 'full'` and immutably replaces the partial assignment inside `ABClass.assignments`.

6. **Assignment runtime**

- Processing pipelines operate on the full instance; transient fields (`students`, `_hydrationLevel`) remain runtime-only and must never be persisted.

### Strictness notes

- Task payloads must include `taskTitle`; `_hydrateTasks` now fails fast via `ProgressTracker.logAndThrowError` if a task is missing it.
- Parser outputs are normalised back into `TaskDefinition` instances before persistence to guarantee `toPartialJSON()` is available and consistent.
- Artifact redaction now relies on artifact classes’ `toPartialJSON()`; legacy plain-object fallbacks have been removed.

## Rehydration Algorithm (Immutable Replace)

We use an **Immutable Replace** pattern to rehydrate assignments. This avoids deep mutation and ensures consistency.

```javascript
rehydrateAssignment(abClass, assignmentId) {
  // 1. Read full document
  const fullDoc = fetchFullAssignment(abClass.classId, assignmentId);

  // 2. Reconstruct typed instance
  const fullInstance = Assignment.fromJSON(fullDoc);
  fullInstance._hydrationLevel = 'full';

  // 3. Find index in ABClass
  const idx = abClass.findAssignmentIndex(a => a.assignmentId === assignmentId);
  if (idx === -1) throw new Error(...);

  // 4. Replace in array
  abClass.assignments[idx] = fullInstance;

  return fullInstance;
}
```

## Error Handling

| Situation                                       | Action                                           |
| ----------------------------------------------- | ------------------------------------------------ |
| Full collection missing                         | Throw `Error` (message includes collection name) |
| Empty collection                                | Throw (treated same as missing)                  |
| Corrupt doc (missing `assignmentId` / mismatch) | Throw                                            |
| Assignment absent in `ABClass.assignments`      | Throw before attempting hydration                |

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

## Controller Integration Notes

- `AssignmentController.processSelectedAssignment()` now rehydrates the target
  assignment **only if** that assignment already exists inside the loaded
  `ABClass`. This ensures we skip the full read on first run (no full record yet)
  while guaranteeing that reruns work with hydrated data.
- Other assignments remain partially hydrated inside `abClass.assignments`, so
  list and cohort views stay light even while one assignment is being processed.
