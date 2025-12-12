# Assignment Definition Hydration Action Plan

## Implementation Status

### ✅ Completed Stages

#### 1. **Model dual-hydration support** — COMPLETE

**Current State:**

- `AssignmentDefinition` provides `toJSON()` for full serialization (includes all artifact content and hashes)
- `AssignmentDefinition` provides `toPartialJSON()` for lightweight serialization (redacts artifact `content` and `contentHash` to null)
- No runtime hydration state tracking; serialization form determined purely by which method is called
- `_redactArtifact()` and `_redactTask()` static helpers strip heavy payload from artifacts
- Constructor validates required fields (primaryTitle, primaryTopic, documentType, doc IDs) and throws on missing data
- All tests passing in `tests/models/assignmentDefinition.test.js`

**Files:** src/AdminSheet/Models/AssignmentDefinition.js, tests/models/assignmentDefinition.test.js

#### 2. **Definition persistence split (registry + full store)** — COMPLETE

**Current State:**

- `AssignmentDefinitionController` implements dual-store pattern:
  - **Partial registry:** `assignment_definitions` collection stores lightweight definitions for fast lookup and embedding
  - **Full store:** `assdef_full_<definitionKey>` dedicated collections store complete definitions with all artifacts
- `getDefinitionByKey(definitionKey, { form })` fetches from full store by default (`form: 'full'`), optional `form: 'partial'` for registry
- `saveDefinition(definition)` synchronously upserts both full collection and partial registry
- `savePartialDefinition(definition)` upserts only the registry (used when full already persisted)
- `ensureDefinition()` orchestrates:
  - Topic name resolution (via ClassroomApiClient or fails fast if missing)
  - Drive timestamp fetching for staleness detection
  - Single DB query (fetches full definition only)
  - Refresh logic when Drive files newer than stored timestamps
  - Task parsing via SlidesParser/SheetsParser when refresh needed
  - Synchronous dual-store persistence
- Naming helpers: `_getFullCollectionName(definitionKey)`, `_getFullCollection(definitionKey)`
- All tests passing in `tests/controllers/assignmentDefinitionController.test.js`

**Files:** src/AdminSheet/y_controllers/AssignmentDefinitionController.js, tests/controllers/assignmentDefinitionController.test.js

### 🔲 Pending Stages

3. **Assignment load/save alignment**
   - Ensure Assignment.toJSON/toPartialJSON use the appropriate definition form (full when present in-memory, partial for summaries) and never downgrade a hydrated definition to redacted when persisting the full assignment.
   - Confirm Assignment.fromJSON reconstructs with a full definition when available and flags hydration level correctly.
   - Files: src/AdminSheet/AssignmentProcessor/Assignment.js, subclass files (SlidesAssignment.js, SheetsAssignment.js), tests/assignment/\*.test.js.

4. **Run orchestration uses full definitions**
   - In AssignmentController.processSelectedAssignment/runAssignmentPipeline, fetch the full definition from assdef*full*<definitionKey> before staleness checks, then refresh/parse as needed and persist both stores. Ensure startProcessing/saveStartAndShowProgress only store the definitionKey (no doc IDs).
   - Files: src/AdminSheet/y_controllers/AssignmentController.js, related globals/menus wrappers in src/AdminSheet/AssignmentProcessor/globals.js and src/AssessmentRecordTemplate/menus/_.js, tests/controllers/assignmentController_.test.js.

5. **ABClass persistence hooks**
   - Keep ABClass partial assignments embedding partial definitions; when rehydrating, pull the full definition from its dedicated collection so downstream runs always have content.
   - Files: src/AdminSheet/y_controllers/ABClassController.js, tests/controllers/abclassController\*.test.js.

6. **UI path relies on definition keys**
   - Update SlideIdsModal and AssignmentDropdown flows to stop passing/storing raw document IDs; route through controller endpoints that return the definitionKey, and persist only that key in properties.
   - Files: src/AdminSheet/UI/SlideIdsModal.html, src/AdminSheet/UI/AssignmentDropdown.html, any UIManager plumbing that bridges to saveStartAndShowProgress/openReferenceSlideModal, tests/ui/\*.test.js (if present).

7. **Drive timestamp + parsing flow**
   - Ensure DriveManager.getFileModifiedTime continues to feed staleness checks; add tests around definition refresh using the split stores to prove the full definition is persisted when parsed.
   - Files: src/AdminSheet/GoogleDriveManager/DriveManager.js, tests/googleDriveManager/driveManager\*.test.js.

8. **Docs and testing coverage**
   - Keep DATA_SHAPES and ASSIGNMENT_METADATA_SPEC aligned with the new dual-store pattern; add regression tests to confirm full definitions are written/read and partial embeddings stay redacted.
   - Files: docs/developer/DATA_SHAPES.md, ASSIGNMENT_METADATA_SPEC.md, relevant Vitest suites under tests/.

9. **Tests to Add / Update / Remove**
   - Update: `tests/controllers/assignmentDefinitionController.test.js` — Adjust for dual-store writes (partial registry + `assdef_full_<definitionKey>`), ensure `ensureDefinition` reads full store for runs and writes both stores on refresh.
   - Update: `tests/models/assignmentDefinition.test.js` — Add assertions for `toJSON` vs `toPartialJSON` (full contains artifacts, partial redacts); add helper to assert full vs partial hydration behaviours.
   - Update: `tests/assignment/assignmentFactory.test.js` — Ensure factory/fromJSON uses embedded partial definitions for ABClass, and assignment runs fetch full definition from `assdef_full_*` when present.
   - Update: `tests/controllers/abclassController.persistAssignment.test.js` — Verify ABClass persists partial definitions while full definitions remain in dedicated full-definition collections; check rehydrate uses full store.
   - Update: `tests/controllers/abclassController.rehydrateAssignment.test.js` — Confirm rehydrate pulls full definition from `assdef_full_<definitionKey>`.
   - Update: `tests/ui/slideIdsModal.test.js` and any UI tests — Expect saveStartAndShowProgress call to use returned `definitionKey`, not raw document ids; update mocks accordingly.
   - Add: `tests/controllers/assignmentDefinitionController.fullStore.test.js` — Assure named full-definition collection write/read semantics and that parsing persists full payload.
   - Add: `tests/controllers/assignmentController.hydration.test.js` — Confirm `processSelectedAssignment` fetches full definition synchronously and uses it for parsing/processing.
   - Add: `tests/googleDriveManager/driveManager.definitionRefresh.test.js` — Integration between `DriveManager.getFileModifiedTime` and definition refresh logic.
   - No tests currently require removal: existing suites should be updated to reflect the new dual-store behaviour rather than deleted.
