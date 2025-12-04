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

## 2. Rehydrating an Assignment

When you need to access the full details of an assignment (e.g., for re-running an assessment or generating a deep report), use `rehydrateAssignment`.

```javascript
const abClassController = new ABClassController();
const abClass = abClassController.loadClass(courseId);

// At this point, abClass.assignments contains only partial summaries (content is null)

try {
  // Fetch full data and replace the partial instance in memory
  const fullAssignment = abClassController.rehydrateAssignment(abClass, assignmentId);

  // Now you can access heavy fields
  console.log(fullAssignment.submissions[0].items['task1'].artifact.content);
} catch (err) {
  console.error('Failed to rehydrate assignment:', err);
  // Handle missing data (e.g., maybe the assignment was never fully persisted?)
}
```

**Important**: Always use the returned `fullAssignment` instance or re-access it from `abClass.assignments` after the call. Old references to the partial assignment object will remain partial.

`AssignmentController.processSelectedAssignment()` automatically calls
`rehydrateAssignment` for the assignment it is about to process **if and only
if** that assignment already exists in the class record. First-time runs skip
the rehydration call, avoiding unnecessary database reads.

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

1.  **Reading**: `Assignment.fromJSON()` will fallback to creating a base `Assignment` instance if `documentType` is missing.
2.  **Writing**: When you next save/persist this assignment, ensure you are using the factory `Assignment.create(...)` or explicitly setting the type if you are manually migrating.
3.  **Recovery**: If `rehydrateAssignment` fails due to missing `documentType`, you may need to manually patch the database document or re-run the assessment to generate a fresh, valid record.

## 5. Error Handling Strategies

- **Collection Missing**: If `rehydrateAssignment` throws "Collection not found", it usually means the assignment was never successfully persisted. **Action**: Treat as a fresh run.
- **Corrupt Data**: If it throws "Corrupt data", the JSON might be truncated. **Action**: Log error and potentially archive the bad document, then treat as fresh run.

## 6. Hydration Markers

Assignments use an internal `_hydrationLevel` property (`'partial'` or `'full'`)
to indicate how much data they currently hold. Controllers set this flag when
they persist (partial) or rehydrate (full) instances. The flag is **never
persisted** to JsonDbApp; it only exists in memory to help the runtime decide
whether another rehydration call is necessary.
