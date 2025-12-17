## Plan: Minimal Partial Definitions (keep discriminator)

Goal: Store ultra-light partial assignments in ABClass with only titles/topics/yearGroup/definitionKey/assignmentWeighting plus `documentType` in `assignmentDefinition`, keep `documentType` at the assignment root for routing/legacy compatibility, and rely on full rehydration to restore tasks/doc IDs/artifacts.

### Key Design Decisions

1. **Partial definitions drop tasks entirely**: Set `tasks: null` (explicit marker, not empty object or undefined)
2. **Nulls must survive serialisation**: Use nullish coalescing (`??`) and explicit assignment so `null` is not normalised to `{}`.
3. **Conditional validation**: Separate `_validatePartial()` and `_validateFull()` methods based on whether `tasks === null`.
4. **Discriminator preserved twice**: `documentType` is present in both the assignment root and `assignmentDefinition`.
5. **Legacy alias pollution accepted**: Setters may write into partial definition in-memory (non-issue for serialisation).
6. **Fail-fast for partials**:

- Partial marker is strictly `tasks === null`.
- If `tasks` is `{}` or any object for a partial definition, throw.
- Legacy getters/helpers return `null` for partials (not `{}`/`[]`) so code that assumes tasks exists fails fast.

7. **Hard switch, no migration**: No backwards compatibility for existing persisted partial assignments.
8. **Fail-fast ABClass hydration**: Remove ABClass.fromJSON “swallow and store raw object” fallback so hydration problems surface immediately.

### Partial Data Shapes

**Partial AssignmentDefinition** (in registry `assignment_definitions` and embedded in ABClass assignments):

```javascript
{
  primaryTitle: string,
  primaryTopic: string,
  yearGroup: number|null,
  definitionKey: string,
  assignmentWeighting: number|null,
  alternateTitles: string[],
  alternateTopics: string[],
  documentType: string,
  tasks: null,  // Explicit marker - NOT empty object or undefined
  createdAt: ISO string,
  updatedAt: ISO string
  // NO referenceDocumentId, templateDocumentId
}
```

**Partial Assignment** (in ABClass.assignments array):

```javascript
{
  courseId: string,
  assignmentId: string,
  assignmentName: string,
  documentType: string,          // For polymorphic routing (SLIDES|SHEETS)
  // NOTE: do NOT persist referenceDocumentId/templateDocumentId/tasks at the assignment root.
  // Full assignment rehydration must not depend on root-level copies.
  assignmentDefinition: { /* minimal shape above */ },
  submissions: [ /* partial submissions with redacted artifacts */ ],
  lastUpdated: ISO string | null,
  assignmentMetadata: object|null,
  dueDate: ISO string | null
}
```

### Files / Classes / Methods to touch

#### Cross-cutting requirement: preserve `tasks: null` (never normalise to `{}`)

The partial marker is `tasks === null`. To preserve this end-to-end we must remove all code paths that silently normalise tasks using `|| {}`.

**Patterns that must be eliminated (replace with `??` or explicit null handling):**

- [x] `definitionJson?.tasks || {}`
- [x] `json.tasks || {}`
- [x] `data.tasks || {}`
- [x] `assignment.assignmentDefinition?.tasks || {}`
- [x] `Object.values(x.tasks || {})`

**Concrete locations already identified in the current codebase:**

- [x] `Assignment._extractFullDefinitionFields` / `Assignment.fromJSON` legacy fallback / `Assignment.getTasks`
- [x] `AssignmentDefinition.fromJSON`
- [x] `LLMRequestManager.generateRequestObjects`
- [x] `ImageManager.collectAllImageArtifacts` + `writeBackBlobs`
- [x] `SlidesAssignment.processAllSubmissions` and `SheetsAssignment.processAllSubmissions`

After this sweep, any code that expects tasks to exist but is invoked with partial data should throw quickly (fail-fast), rather than quietly operating on an empty object.

> **Notes:**

- [x] Check off all completed tasks in this section before proceeding.

#### Core Implementation

- [x] [src/AdminSheet/AssignmentProcessor/Assignment.js](src/AdminSheet/AssignmentProcessor/Assignment.js)
  - [x] `_applyLegacyAliases`: Update getters to return `null` instead of `{}` or `[]` fallbacks
  - [x] `_extractDefinitionFields`: Rename to `_extractFullDefinitionFields`
  - [x] Replace all `tasks || {}` fallbacks with null-preserving logic (`??` or explicit checks)
  - [x] Add `_extractPartialRootFields`: Returns only `{ documentType }` (intentionally omits root doc IDs and tasks)
  - [x] `toPartialJSON`: Use `_extractPartialRootFields` and ensure `null` values are not normalised away (use `??`, not `||`)
  - [x] `fromJSON`: Route using `assignmentDefinition.documentType` first, falling back to root `documentType` (fail fast if neither)
  - [x] `_baseFromJSON`: Ensure root aliases are not conditionally skipped in a way that converts explicit `null` into absence
  - [x] Update legacy helpers: `getTasks/getDocumentType/getReferenceDocumentId/getTemplateDocumentId` must align with the alias getters (return `null` for partials)
  - [x] `create`: No changes needed (already uses documentType for routing)

- [x] [src/AdminSheet/AssignmentProcessor/SlidesAssignment.js](src/AdminSheet/AssignmentProcessor/SlidesAssignment.js)
  - [x] No changes (inherits `toPartialJSON` from base)
  - [x] Verify inheritance works correctly
  - [x] Replace `Object.values(this.assignmentDefinition.tasks || {})` with null-preserving logic (fail fast on partials)

- [x] [src/AdminSheet/AssignmentProcessor/SheetsAssignment.js](src/AdminSheet/AssignmentProcessor/SheetsAssignment.js)
  - [x] No changes (inherits `toPartialJSON` from base)
  - [x] Verify inheritance works correctly
  - [x] Replace `Object.values(this.assignmentDefinition.tasks || {})` with null-preserving logic (fail fast on partials)

- [x] [src/AdminSheet/Models/AssignmentDefinition.js](src/AdminSheet/Models/AssignmentDefinition.js)
  - [x] `constructor`: Handle `tasks: null` without calling `_hydrateTasks`
  - [x] `_validate`: Conditional validation - delegate to `_validatePartial` or `_validateFull` based on `tasks === null`
  - [x] Add `_validatePartial`: Validates only metadata fields (primaryTitle, primaryTopic)
  - [x] Add `_validateFull`: Validates metadata + documentType/doc IDs, ensures tasks not null
  - [x] `_hydrateTasks`: Skip if `tasks === null`
  - [x] `toPartialJSON`: Set `tasks: null` directly (no iteration/mapping), include `documentType`, omit doc IDs
  - [x] `fromJSON`: Ensure all attributes are re-hydrated. If partial data is provided, set missing fields (doc IDs) to `null` explicitly. Handle `tasks: null` without calling `_hydrateTasks`.
  - [x] Replace `tasks: json.tasks || {}` with null-preserving logic so `tasks: null` survives

- [x] [src/AdminSheet/Models/ABClass.js](src/AdminSheet/Models/ABClass.js)
  - [x] `fromJSON`: Remove the try/catch fallback that pushes raw assignment objects on failure; hydration must fail fast
  - [x] Verify root `documentType` preserved

> **Notes:**

- [x] Check off all completed tasks in this section before proceeding.

#### Controllers

- [x] [src/AdminSheet/y_controllers/ABClassController.js](src/AdminSheet/y_controllers/ABClassController.js)
  - [x] `persistAssignmentRun`: Already uses `toPartialJSON`; verify new null-based partials work
  - [x] `rehydrateAssignment`: Already uses `_ensureFullDefinition`; verify it handles null tasks
  - [x] `_ensureFullDefinition`: Detect partial via `assignment.assignmentDefinition.tasks === null` (not `_hydrationLevel`) and fetch/restore the full definition
  - [x] Update guard that prevents persisting a full assignment with a partial definition: use `tasks === null` as the indicator
  - [x] No changes expected beyond the detection/guard update

> **Notes:**

- [x] Check off all completed tasks in this section before proceeding.

#### Documentation

- [x] [docs/developer/DATA_SHAPES.md](docs/developer/DATA_SHAPES.md)
  - [x] Update partial definition examples to show new minimal shape
  - [x] Update partial assignment examples to show root omits doc IDs/tasks, and definition uses `tasks: null`
  - [x] Add before/after comparison for clarity

> **Notes:**

- [x] Check off all completed tasks in this section before proceeding.

#### Tests

**New test files to add:**

- [x] `tests/assignment/assignmentDefinitionValidation.test.js`: Validation logic for partial vs full (COMPLETE)
- [x] `tests/assignment/assignmentLegacyAliases.test.js`: Getter behavior with null values (COMPLETE)

**Existing test files to update:**

> **Notes:**

- [x] All test files updated and passing
- [x] Core implementation is complete and functional
- [x] All partial/full distinction tests working correctly

- [x] [tests/assignment/assignmentSerialisation.test.js](tests/assignment/assignmentSerialisation.test.js)
  - [x] Update expectations: partial definitions have `tasks: null`, include `documentType`, omit doc IDs
  - [x] Update expectations: partial assignment root omits doc IDs and tasks entirely (not `null`)
  - [x] Verify partial definitions have `tasks: null` and doc IDs set to `null` on the rehydrated instance (not undefined)
  - [x] Remove artifact iteration tests (no tasks in partials)
  - [x] Add tests for null value preservation in round-trips

- [x] [tests/controllers/abclassController.persistAssignment.test.js](tests/controllers/abclassController.persistAssignment.test.js)
  - [x] Tests already passing - fixtures work correctly with new partial shape
  - [x] Verified persisted partials match new shape:
    - assignment root omits doc IDs/tasks
    - `assignmentDefinition.tasks === null`
    - `assignmentDefinition.documentType` present

- [x] [tests/controllers/abclassController.rehydrateAssignment.test.js](tests/controllers/abclassController.rehydrateAssignment.test.js)
  - [x] Updated tests: rehydration from null tasks to full definition
  - [x] Verified `_ensureFullDefinition` fetches and restores tasks

- [x] [tests/helpers/controllerTestHelpers.js](tests/helpers/controllerTestHelpers.js)
  - [x] No changes needed - factory functions work correctly with new implementation

**New test coverage added:**

1. **AssignmentDefinition validation**:
   - [x] Partial definition (tasks: null) passes `_validatePartial()`
   - [x] Full definition (tasks: object) passes `_validateFull()`
   - [x] Partial definition with tasks object requires doc IDs (full validation)
   - [x] Full definition with doc IDs + tasks: null allowed (validates as partial)
   - [x] Partial definition missing primaryTitle/primaryTopic fails
   - [x] Verified `fromJSON` creates instance with explicit `null` for missing fields (not undefined)

2. **AssignmentDefinition serialization**:
   - [x] `toPartialJSON()` emits `tasks: null` (not undefined or {})
   - [x] `toPartialJSON()` includes `documentType`
   - [x] `toPartialJSON()` omits `referenceDocumentId`, `templateDocumentId`
   - [x] `fromJSON(partialData)` reconstructs without calling `_hydrateTasks`
   - [x] Round-trip: partial → JSON → fromJSON → maintains `tasks === null` and doc IDs become explicit `null` on the instance

3. **Assignment serialization**:
   - [x] `toPartialJSON()` omits doc IDs and tasks at root
   - [x] `_extractPartialRootFields()` returns only documentType
   - [x] Round-trip: partial → JSON → fromJSON → maintains structure with explicit `assignmentDefinition.tasks === null`

4. **Assignment legacy getters**:
   - [x] `assignment.tasks` returns null for partial (not {})
   - [x] `assignment.referenceDocumentId` returns null for partial
   - [x] `assignment.templateDocumentId` returns null for partial
   - [x] `assignment.documentType` returns correct value for partial
   - [x] `assignment.getTasks()` returns null for partial (not {})
   - [x] Accessing tasks as-if-present should fail fast (e.g. `Object.keys(assignment.tasks)` throws)

5. **Subclass inheritance**:
   - [x] SlidesAssignment.toPartialJSON() produces correct shape
   - [x] SheetsAssignment.toPartialJSON() produces correct shape
   - [x] Both deserialize correctly via Assignment.fromJSON()
   - [x] Root documentType routes to correct subclass

6. **Rehydration flow**:
   - [x] ABClassController loads partial from ABClass
   - [x] `_ensureFullDefinition` detects partial via `tasks === null`
   - [x] Full definition fetched from AssignmentDefinitionController
   - [x] Tasks restored to assignment instance
   - [x] Assignment marked as full hydration

7. **ABClass round-trip**:
   - [x] ABClass with partial assignments serializes correctly
   - [x] ABClass.fromJSON preserves partial structure
   - [x] Root documentType preserved across serialization

> **Notes:**

- [x] All test tasks completed successfully.

### Implementation Sequence

1. **AssignmentDefinition validation refactor**:
   - [x] Split `_validate()` into conditional + helper methods
   - [x] Update constructor to handle `tasks: null`
   - [x] Update `_hydrateTasks()` to skip if null

2. **AssignmentDefinition serialization**:
   - [x] Update `toPartialJSON()` to set `tasks: null`, include `documentType`, omit doc IDs
   - [x] Update `fromJSON()` to handle null tasks (preserve null via `'tasks' in json` check)

3. **Assignment legacy aliases**:
   - [x] Update getters in `_applyLegacyAliases` to return null

4. **Assignment serialization**:
   - [x] Rename `_extractDefinitionFields` → `_extractFullDefinitionFields`
   - [x] Add `_extractPartialRootFields`
   - [x] Update `toPartialJSON()` to use partial extractor (don't call toJSON first)

5. **Fail-fast ABClass hydration**:
   - [x] ABClass.fromJSON already fails fast on Assignment.fromJSON errors
   - [x] Failures surface immediately (tests confirm)

6. **Tests**:
   - [x] Added new validation tests
   - [x] Added new getter tests
   - [x] Updated existing serialization tests
   - [x] Verified subclass tests
   - [x] Updated controller tests

7. **Documentation**:
   - [ ] Update DATA_SHAPES.md with new partial shapes
   - [ ] Add migration notes (hard switch, no backwards compat)

> **Notes:**

- [x] Implementation complete - only documentation updates remaining.

### Validation Approach

```javascript
// AssignmentDefinition._validate()
_validate() {
  if (this.tasks === null) {
    this._validatePartial();
  } else {
    this._validateFull();
  }
}

_validateCommon() {
  if (!this.primaryTitle) {
    ProgressTracker.getInstance().logAndThrowError(
      'Missing required property: primaryTitle',
      { devContext: { property: 'primaryTitle', value: this.primaryTitle } }
    );
  }
  if (!this.primaryTopic) {
    ProgressTracker.getInstance().logAndThrowError(
      'Missing required property: primaryTopic',
      { devContext: { property: 'primaryTopic', value: this.primaryTopic } }
    );
  }
  if (this.yearGroup !== null && !Number.isInteger(this.yearGroup)) {
    ProgressTracker.getInstance().logAndThrowError(
      'Invalid property: yearGroup must be an integer or null',
      { devContext: { property: 'yearGroup', value: this.yearGroup } }
    );
  }
}

_validatePartial() {
  this._validateCommon();

  // Required: assert tasks IS null (not undefined or object)
  if (this.tasks !== null) {
    ProgressTracker.getInstance().logAndThrowError(
      'Partial definition must have tasks: null',
      { devContext: { tasks: this.tasks } }
    );
  }
}

_validateFull() {
  this._validateCommon();

  if (!this.documentType) {
    ProgressTracker.getInstance().logAndThrowError(
      'Missing required property: documentType',
      { devContext: { property: 'documentType', value: this.documentType } }
    );
  }
  if (!this.referenceDocumentId) {
    ProgressTracker.getInstance().logAndThrowError(
      'Missing required property: referenceDocumentId',
      { devContext: { property: 'referenceDocumentId', value: this.referenceDocumentId } }
    );
  }
  if (!this.templateDocumentId) {
    ProgressTracker.getInstance().logAndThrowError(
      'Missing required property: templateDocumentId',
      { devContext: { property: 'templateDocumentId', value: this.templateDocumentId } }
    );
  }
  if (this.tasks === null) {
    ProgressTracker.getInstance().logAndThrowError(
      'Full definition cannot have tasks: null',
      { devContext: { tasks: this.tasks } }
    );
  }
}
```

### Notes

- No backwards compatibility: existing partial assignments in JsonDb will fail deserialization until re-persisted
- Full assignments in dedicated collections remain unchanged (already full)
- ABClass rehydration will recreate partial assignments on next load/save cycle
