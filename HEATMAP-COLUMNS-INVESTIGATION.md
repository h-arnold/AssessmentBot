# Heatmap Task Columns Do Not Render — Investigation Findings

**Date:** 2026-07-10
**Component:** Frontend Task Heatmap (Sections 7 & 8 of `ACTION_PLAN.md`) + Backend `AssignmentDefinition` model round-trip
**Symptom:** Opening a heatmap from a recent assignment card renders a single column (Student Name only). No task columns appear.

---

## 1. Summary

The heatmap adapter (Section 8) sources its task columns from the warm-up
`assignmentDefinitionPartials` dataset, located by `definitionKey`. In a fresh
build the `assignment_definitions` collection **does** persist `tasks` on each
partial, so the data is present on disk. However, the backend discards that
array during rehydration, so the warm-up endpoint returns `tasks: []` and the
adapter produces an empty `taskColumns` array.

**Root cause:** `AssignmentDefinition.fromJSON` (`src/backend/Models/AssignmentDefinition.js:387-389`)
explicitly nulls out any `tasks` array, on the outdated assumption that partial
definitions never carry tasks. Section 7 changed that contract (partials now
persist `tasks` with `taskId` + `taskTitle`), but `fromJSON` was never updated.

There are two secondary, coupled spots that any fix must also address, or the
fix will regress elsewhere (see §4).

---

## 2. Data flow (why columns should render)

1. `useClassPageData` (`src/frontend/src/features/classPage/useClassPageData.ts:216-220`)
   reads the warm-up `assignmentDefinitionPartials` dataset via `usePageDataset('assignmentDefinitionPartials')`.
2. `ClassPage` → `ClassPageContent` → `TaskHeatmapPage` thread the partials down
   (gated on `assignmentDefinitionPartials !== null` at `ClassPageContent.tsx:312-317`).
3. `adaptMetricsToHeatmap` (`src/frontend/src/services/dataAnalysis/heatmapAdapter.ts:166-228`)
   locates the partial by `definitionKey` via `getAssignmentDefinitionPartial`
   and calls `buildTaskColumns(partial)` (`heatmapAdapter.ts:100-106`), which maps
   `partial.tasks` into `taskColumns`.
4. `TaskHeatmapTable` renders one grouped column per entry in `taskColumns`
   (`TaskHeatmapTable.tsx:243-266`). When `taskColumns` is empty, only the sticky
   Student Name column renders — exactly the reported symptom.

The adapter, table, wiring, and frontend unit/E2E tests are all correct and pass
against the documented fixture shape. The break is server-side: the warm-up
partial arrives with `tasks: []`.

---

## 3. Root cause — `AssignmentDefinition.fromJSON` nulls the tasks array

`src/backend/Models/AssignmentDefinition.js:387-389`:

```js
// Array tasks values are the toPartialJSON() wire format; normalise to null
// because the lightweight summaries cannot be rehydrated to TaskDefinition instances.
const tasksValue = 'tasks' in json && !Array.isArray(json.tasks) ? json.tasks : null;
```

The fresh `assignment_definitions` document stores `tasks` as an **array**:

```json
"tasks": [
  { "taskId": "t_d019fe952045", "taskWeighting": 1, "taskTitle": "Data Science findings" },
  { "taskId": "t_c3ba63f957b3", "taskWeighting": 1, "taskTitle": "Storyboard Scenes 1-3" },
  { "taskId": "t_b15bf8f7a57e", "taskWeighting": 1, "taskTitle": "Storyboard Scenes 4-6" }
]
```

For an array, `!Array.isArray(json.tasks)` evaluates to `false`, so the ternary
returns **`null`**. `tasksValue` is then passed into the constructor as
`tasks: null`.

The chain that follows:

- `getAllPartials()` (`src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionPersistence.js:56-59`)
  reads registry documents and calls `AssignmentDefinition.fromJSON(document)` on each.
- `fromJSON` sets `tasks: null` (per above).
- `getAssignmentDefinitionPartials_` (`src/backend/z_Api/assignmentDefinitionTransport.js:113-120`)
  calls `toTransportPartialRow_(definition)` → `definition.toPartialJSON()`.
- `toPartialJSON()` (`src/backend/Models/AssignmentDefinition.js:347-354`):

  ```js
  tasks:
    !this.tasks || Object.keys(this.tasks).length === 0
      ? []
      : Object.values(this.tasks).map((task) => ({
          taskId: task.id,
          taskWeighting: task.taskWeighting,
          taskTitle: task.taskTitle,
        })),
  ```

  Because `this.tasks` is `null`, it emits `tasks: []`.

Result: the warm-up `getAssignmentDefinitionPartials` response carries an empty
`tasks` array. `getAssignmentDefinitionPartial` still _finds_ the partial (by
`definitionKey`), so no `TaskTitlesUnavailableError` is thrown — but
`buildTaskColumns` maps `[]` and the heatmap renders with no task columns.

### Why this assumption is now stale

The comment claims "partial definitions have `tasks: null`" and "lightweight
summaries cannot be rehydrated to TaskDefinition instances". This was true before
Section 7. Section 7 (`ACTION_PLAN.md` §7, commit `2b3fab0`) added `taskTitle` to
`TaskPartial` and made `toPartialJSON()` emit the full
`{ taskId, taskWeighting, taskTitle }` summary per task, and the partial
persistence now stores that array. `fromJSON` was never updated to carry the
array through, so it is still discarded.

---

## 4. Coupled spots a fix must address

A minimal change that only stops `fromJSON` nulling the array will still fail,
because the model conflates "array tasks" with "full definition":

1. **Constructor branch + validation** — `src/backend/Models/AssignmentDefinition.js:112`
   and `_validate` (`:135-142`) route any non-empty `tasks` to `_validateFull()`,
   which **requires `referenceDocumentId` and `templateDocumentId`**. Partials do
   not carry those IDs, so construction would throw. The "partial with a tasks
   array" shape must be recognised as valid for a partial, not forced down the
   full-definition path.
2. **`_hydrateTasks`** — `src/backend/Models/AssignmentDefinition.js:230-245`
   expects `tasks` to be a **keyed object** (`Object.entries(tasks)`), not an
   array. Passing the array would key by `"0"/"1"/"2"` and attempt
   `TaskDefinition.fromJSON` on elements that have `taskId` (not `id`), breaking
   hydration.
3. **`toPartialJSON` field name** — `src/backend/Models/AssignmentDefinition.js:351`
   emits `taskId: task.id`. The partial array elements use `taskId`, so even with
   `this.tasks` populated as an array it would emit `taskId: undefined`. The
   emit must read `task.taskId` (or `task.taskId ?? task.id`) for the lightweight
   partial shape.

---

## 5. Recommended fix direction

Make the partial round-trip preserve the lightweight `tasks` array verbatim:

- In `fromJSON`, recognise an array `tasks` as a valid partial shape and store it
  on the instance without forcing `null` or attempting `TaskDefinition` hydration.
- Ensure the constructor / `_validate` treats an array `tasks` as a legal partial
  (not a full definition requiring doc IDs).
- In `toPartialJSON`, re-emit the lightweight summary directly when `this.tasks`
  is an array (reading `task.taskId`/`task.taskWeighting`/`task.taskTitle`), while
  keeping the existing keyed-object/TaskDefinition behaviour for full definitions.

Add a backend test asserting `getAssignmentDefinitionPartials` round-trips a
stored partial's `tasks` array (e.g. the fixture shape in §3) so this regression
cannot silently return.

**Do not** revert Section 8 to source columns from the embedded
`assignment.assignmentDefinition` — that path is also valid (it carries full
tasks with `taskTitle`), but the warm-up partial is the intended Section 8 source
and is the correct fix location; reverting would discard the `TaskTitlesUnavailableError`
guarantee and contradict the documented plan.

---

## 6. Evidence index

| Location                                                                                  | Role                                                                                   |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/backend/Models/AssignmentDefinition.js:387-389`                                      | **Root cause** — `fromJSON` nulls array `tasks`                                        |
| `src/backend/Models/AssignmentDefinition.js:347-354`                                      | `toPartialJSON` emits `tasks: []` when `this.tasks` is null                            |
| `src/backend/Models/AssignmentDefinition.js:112`                                          | Constructor forces `this.tasks = null` for `null`/empty-array tasks                    |
| `src/backend/Models/AssignmentDefinition.js:135-142`                                      | `_validate` routes non-empty array tasks to full-definition validation (needs doc IDs) |
| `src/backend/Models/AssignmentDefinition.js:230-245`                                      | `_hydrateTasks` expects a keyed object, not an array                                   |
| `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionPersistence.js:56-59` | `getAllPartials` rehydrates registry docs via `fromJSON`                               |
| `src/backend/z_Api/assignmentDefinitionTransport.js:113-120`                              | `getAssignmentDefinitionPartials_` serialises partials via `toPartialJSON`             |
| `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts:100-106`                        | `buildTaskColumns` maps `partial.tasks` (empty → no columns)                           |
| `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts:182-188`                        | Adapter sources columns from warm-up partial                                           |
| `src/frontend/src/features/classPage/ClassPageContent.tsx:312-317`                        | Ready gate requires `assignmentDefinitionPartials !== null`                            |

---

## 7. Verification performed

- Frontend unit tests for the heatmap adapter pass against the documented fixture
  shape (`heatmapAdapter.spec.ts` — 10/10). This confirms the frontend code is
  correct and the defect is in the live data shape produced by the backend, not
  in the adapter or table.
- The fresh `assignment_definitions` collection document provided by the user
  confirms the persisted partial **does** contain the `tasks` array with
  `taskId`/`taskWeighting`/`taskTitle`, ruling out "partials lack tasks" as the
  cause and isolating the break to the rehydration/serialisation step.
