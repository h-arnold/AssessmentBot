# How-To: Assignment Persistence & Rehydration

This guide explains how to use the `ABClassController` to persist and rehydrate assignments using the split persistence model.

## 1. Persisting an Assignment Run

When an assessment run completes, you must persist the results. Use `persistAssignmentRun` to save both the full detailed record and the lightweight summary.

```javascript
const abClassController = new ABClassController();

// ... processing logic ...
assignment.touchUpdated(); // Update timestamp

// Persist:
// 1. Writes full JSON to 'assign_full_<courseId>_<assignmentId>'
// 2. Updates 'ABClass' with partial summary
abClassController.persistAssignmentRun(abClass, assignment);
```

**Why?**

- Ensures `ABClass` stays small (<1MB) for fast loading.
- Preserves full fidelity data (artifacts, content) in a separate collection (<20MB).

### Full hydration chain for assessment objects (on persist)

1. `Assignment.toJSON()` emits the **full** payload, including assessment reasoning text and full artifacts. This is written to `assign_full_<courseId>_<assignmentId>`.
2. `Assignment.toPartialJSON()` regenerates a **redacted** copy for `ABClass.assignments`:

- Artifacts: `content`/`contentHash` set to `null` via `toPartialJSON()` on artifacts and task definitions.
- Assessments: `StudentSubmissionItem.toPartialJSON()` removes the `reasoning` field but keeps `score` so list views stay lightweight.
- Feedback and identifiers remain intact.

3. `persistAssignmentRun` replaces/creates the partial assignment inside the ABClass record and saves the full payload separately.

## 2. Rehydrating an Assignment (Read-Only Path)

When you need to access the full details of an assignment (e.g., for re-running an assessment or generating a deep report), use `readRehydrateAssignment`. This is a read-only operation that does not require an ABClass instance and does not mutate any class record.

```javascript
const abClassController = new ABClassController();

try {
  // Fetch full assignment data (read-only, no roster refresh)
  const fullAssignment = abClassController.readRehydrateAssignment(courseId, assignmentId);

  // Now you can access heavy fields
  console.log(fullAssignment.submissions[0].items['task1'].artifact.content);
} catch (err) {
  console.error('Failed to rehydrate assignment:', err);
  // Handle missing data (e.g., maybe the assignment was never fully persisted?)
}
```

The returned assignment is fully hydrated in memory. No ABClass mutation or persistence write occurs.

### Full hydration chain for assessment objects (on rehydrate)

1. `readRehydrateAssignment` reads the full document from `assign_full_<courseId>_<assignmentId>`.
2. `Assignment.fromJSON` rebuilds the object graph; `StudentSubmission.fromJSON` and `StudentSubmissionItem.fromJSON` restore assessments **with** reasoning and artifacts **with** content.
3. `_ensureFullDefinition` swaps in a full `AssignmentDefinition` (from `AssignmentDefinitionController`) if the embedded copy was only partial.
4. The hydrated assignment is returned as a full instance with `_hydrationLevel = 'full'` for subsequent pipeline steps.

## 3. When to Rehydrate?

| Scenario                   | Rehydrate? | Why?                                                                 |
| :------------------------- | :--------- | :------------------------------------------------------------------- |
| **Listing Assignments**    | ❌ No      | Partial summary has name, ID, dates, and scores.                     |
| **Cohort Analysis**        | ❌ No      | Scores and feedback summaries are present in partial.                |
| **Re-running Assessment**  | ✅ Yes     | Need previous `contentHash` and `updatedAt` to skip unchanged files. |
| **Exporting Student Work** | ✅ Yes     | Need actual artifact content (text/images).                          |
| **Auditing / Debugging**   | ✅ Yes     | Need full trace of what was assessed.                                |

## 4. Migration & Legacy Data

If you have existing data created before the `documentType` field was introduced:

1.  **Reading**: `Assignment.fromJSON()` handles legacy data in two ways:
    - If `assignmentDefinition` is missing but a root-level `documentType` field exists, a new `AssignmentDefinition` is constructed from the legacy root fields and deserialisation proceeds normally.
    - If both `assignmentDefinition` and `documentType` are missing, deserialisation fails with an error. You may need to manually patch the database document or re-run the assessment to generate a fresh, valid record.
2.  **Writing**: When you next save/persist this assignment, ensure you are using the factory `Assignment.create(...)` or explicitly setting the type if you are manually migrating.

## 5. Error Handling Strategies

- **Collection Missing**: If `readRehydrateAssignment` throws `AssignmentNotFoundError`, it usually means the assignment was never successfully persisted. **Action**: Treat as a fresh run.
- **Corrupt Data**: If it throws "Corrupt data", the JSON might be truncated. **Action**: Log error and potentially archive the bad document, then treat as fresh run.

## 6. Hydration Markers

Assignments use an internal `_hydrationLevel` property (`'partial'` or `'full'`)
to indicate how much data they currently hold. Controllers set this flag when
they persist (partial) or rehydrate (full) instances. The flag is **never
persisted** to JsonDbApp; it only exists in memory to help the runtime decide
whether another rehydration call is necessary.
