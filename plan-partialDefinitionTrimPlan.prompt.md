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

- [ ] `definitionJson?.tasks || {}`
- [ ] `json.tasks || {}`
- [ ] `data.tasks || {}`
- [ ] `assignment.assignmentDefinition?.tasks || {}`
- [ ] `Object.values(x.tasks || {})`

**Concrete locations already identified in the current codebase:**

- [ ] `Assignment._extractFullDefinitionFields` / `Assignment.fromJSON` legacy fallback / `Assignment.getTasks`
- [ ] `AssignmentDefinition.fromJSON`
- [ ] `LLMRequestManager.generateRequestObjects`
- [ ] `ImageManager.collectAllImageArtifacts` + `writeBackBlobs`
- [ ] `SlidesAssignment.processAllSubmissions` and `SheetsAssignment.processAllSubmissions`

After this sweep, any code that expects tasks to exist but is invoked with partial data should throw quickly (fail-fast), rather than quietly operating on an empty object.

> **Notes:**

- [ ] Check off all completed tasks in this section before proceeding.

#### Core Implementation

- [ ] [src/AdminSheet/AssignmentProcessor/Assignment.js](src/AdminSheet/AssignmentProcessor/Assignment.js)
  - [ ] `_applyLegacyAliases`: Update getters to return `null` instead of `{}` or `[]` fallbacks
  - [ ] `_extractDefinitionFields`: Rename to `_extractFullDefinitionFields`
  - [ ] Replace all `tasks || {}` fallbacks with null-preserving logic (`??` or explicit checks)
  - [ ] Add `_extractPartialRootFields`: Returns only `{ documentType }` (intentionally omits root doc IDs and tasks)
  - [ ] `toPartialJSON`: Use `_extractPartialRootFields` and ensure `null` values are not normalised away (use `??`, not `||`)
  - [ ] `fromJSON`: Route using `assignmentDefinition.documentType` first, falling back to root `documentType` (fail fast if neither)
  - [ ] `_baseFromJSON`: Ensure root aliases are not conditionally skipped in a way that converts explicit `null` into absence
  - [ ] Update legacy helpers: `getTasks/getDocumentType/getReferenceDocumentId/getTemplateDocumentId` must align with the alias getters (return `null` for partials)
  - [ ] `create`: No changes needed (already uses documentType for routing)

- [ ] [src/AdminSheet/AssignmentProcessor/SlidesAssignment.js](src/AdminSheet/AssignmentProcessor/SlidesAssignment.js)
  - [ ] No changes (inherits `toPartialJSON` from base)
  - [ ] Verify inheritance works correctly
  - [ ] Replace `Object.values(this.assignmentDefinition.tasks || {})` with null-preserving logic (fail fast on partials)

- [ ] [src/AdminSheet/AssignmentProcessor/SheetsAssignment.js](src/AdminSheet/AssignmentProcessor/SheetsAssignment.js)
  - [ ] No changes (inherits `toPartialJSON` from base)
  - [ ] Verify inheritance works correctly
  - [ ] Replace `Object.values(this.assignmentDefinition.tasks || {})` with null-preserving logic (fail fast on partials)

- [ ] [src/AdminSheet/Models/AssignmentDefinition.js](src/AdminSheet/Models/AssignmentDefinition.js)
  - [ ] `constructor`: Handle `tasks: null` without calling `_hydrateTasks`
  - [ ] `_validate`: Conditional validation - delegate to `_validatePartial` or `_validateFull` based on `tasks === null`
  - [ ] Add `_validatePartial`: Validates only metadata fields (primaryTitle, primaryTopic)
  - [ ] Add `_validateFull`: Validates metadata + documentType/doc IDs, ensures tasks not null
  - [ ] `_hydrateTasks`: Skip if `tasks === null`
  - [ ] `toPartialJSON`: Set `tasks: null` directly (no iteration/mapping), include `documentType`, omit doc IDs
  - [ ] `fromJSON`: Ensure all attributes are re-hydrated. If partial data is provided, set missing fields (doc IDs) to `null` explicitly. Handle `tasks: null` without calling `_hydrateTasks`.
  - [ ] Replace `tasks: json.tasks || {}` with null-preserving logic so `tasks: null` survives

- [ ] [src/AdminSheet/Models/ABClass.js](src/AdminSheet/Models/ABClass.js)
  - [ ] `fromJSON`: Remove the try/catch fallback that pushes raw assignment objects on failure; hydration must fail fast
  - [ ] Verify root `documentType` preserved

> **Notes:**

- [ ] Check off all completed tasks in this section before proceeding.

#### Controllers

- [ ] [src/AdminSheet/y_controllers/ABClassController.js](src/AdminSheet/y_controllers/ABClassController.js)
  - [ ] `persistAssignmentRun`: Already uses `toPartialJSON`; verify new null-based partials work
  - [ ] `rehydrateAssignment`: Already uses `_ensureFullDefinition`; verify it handles null tasks
  - [ ] `_ensureFullDefinition`: Detect partial via `assignment.assignmentDefinition.tasks === null` (not `_hydrationLevel`) and fetch/restore the full definition
  - [ ] Update guard that prevents persisting a full assignment with a partial definition: use `tasks === null` as the indicator
  - [ ] No changes expected beyond the detection/guard update

> **Notes:**

- [ ] Check off all completed tasks in this section before proceeding.

#### Documentation

- [ ] [docs/developer/DATA_SHAPES.md](docs/developer/DATA_SHAPES.md)
  - [ ] Update partial definition examples to show new minimal shape
  - [ ] Update partial assignment examples to show root omits doc IDs/tasks, and definition uses `tasks: null`
  - [ ] Add before/after comparison for clarity

> **Notes:**

- [ ] Check off all completed tasks in this section before proceeding.

#### Tests

**New test files to add:**

- [ ] `tests/assignment/assignmentDefinitionValidation.test.js`: Validation logic for partial vs full
- [ ] `tests/assignment/assignmentLegacyAliases.test.js`: Getter behavior with null values

**Existing test files to update:**

- [ ] [tests/assignment/assignmentSerialisation.test.js](tests/assignment/assignmentSerialisation.test.js)
  - [ ] Update expectations: partial definitions have `tasks: null`, include `documentType`, omit doc IDs
  - [ ] Update expectations: partial assignment root omits doc IDs and tasks entirely (not `null`)
  - [ ] Verify partial definitions have `tasks: null` and doc IDs set to `null` on the rehydrated instance (not undefined)
  - [ ] Remove artifact iteration tests (no tasks in partials)
  - [ ] Add tests for null value preservation in round-trips

- [ ] [tests/controllers/abclassController.persistAssignment.test.js](tests/controllers/abclassController.persistAssignment.test.js)
  - [ ] Update fixtures: partial assignments have null tasks
  - [ ] Verify persisted partials match new shape:
    - assignment root omits doc IDs/tasks
    - `assignmentDefinition.tasks === null`
    - `assignmentDefinition.documentType` present

- [ ] [tests/controllers/abclassController.rehydrateAssignment.test.js](tests/controllers/abclassController.rehydrateAssignment.test.js)
  - [ ] Add tests: rehydration from null tasks to full definition
  - [ ] Verify `_ensureFullDefinition` fetches and restores tasks

- [ ] [tests/helpers/controllerTestHelpers.js](tests/helpers/controllerTestHelpers.js)
  - [ ] Update factory functions to create partials with null tasks

**New test coverage to add:**

1. **AssignmentDefinition validation**:
   - [ ] Partial definition (tasks: null) passes `_validatePartial()`
   - [ ] Full definition (tasks: object) passes `_validateFull()`
   - [ ] Partial definition with tasks object fails validation
   - [ ] Full definition with null tasks fails validation
   - [ ] Partial definition missing primaryTitle/primaryTopic fails
   - [ ] Verify `fromJSON` creates instance with explicit `null` for missing fields (not undefined)

2. **AssignmentDefinition serialization**:
   - [ ] `toPartialJSON()` emits `tasks: null` (not undefined or {})
   - [ ] `toPartialJSON()` includes `documentType`
   - [ ] `toPartialJSON()` omits `referenceDocumentId`, `templateDocumentId`
   - [ ] `fromJSON(partialData)` reconstructs without calling `_hydrateTasks`

- [ ] Round-trip: partial → JSON → fromJSON → maintains `tasks === null` and doc IDs become explicit `null` on the instance

3. **Assignment serialization**:

- [ ] `toPartialJSON()` omits doc IDs and tasks at root
- [ ] `_extractPartialRootFields()` returns only documentType
- [ ] Round-trip: partial → JSON → fromJSON → maintains structure with explicit `assignmentDefinition.tasks === null`

4. **Assignment legacy getters**:
   - [ ] `assignment.tasks` returns null for partial (not {})
   - [ ] `assignment.referenceDocumentId` returns null for partial
   - [ ] `assignment.templateDocumentId` returns null for partial
   - [ ] `assignment.documentType` returns correct value for partial
   - [ ] `assignment.getTasks()` returns null for partial (not {})
   - [ ] Accessing tasks as-if-present should fail fast (e.g. `Object.keys(assignment.tasks)` throws)

5. **Subclass inheritance**:
   - [ ] SlidesAssignment.toPartialJSON() produces correct shape
   - [ ] SheetsAssignment.toPartialJSON() produces correct shape
   - [ ] Both deserialize correctly via Assignment.fromJSON()
   - [ ] Root documentType routes to correct subclass

6. **Rehydration flow**:
   - [ ] ABClassController loads partial from ABClass
   - [ ] `_ensureFullDefinition` detects partial via `tasks === null`
   - [ ] Full definition fetched from AssignmentDefinitionController
   - [ ] Tasks restored to assignment instance
   - [ ] Assignment marked as full hydration

7. **ABClass round-trip**:
   - [ ] ABClass with partial assignments serializes correctly
   - [ ] ABClass.fromJSON preserves partial structure
   - [ ] Root documentType preserved across serialization

> **Notes:**

- [ ] Check off all completed tasks in this section before proceeding.

### Implementation Sequence

1. **AssignmentDefinition validation refactor**:
   - [ ] Split `_validate()` into conditional + helper methods
   - [ ] Update constructor to handle `tasks: null`
   - [ ] Update `_hydrateTasks()` to skip if null

2. **AssignmentDefinition serialization**:

- [ ] Update `toPartialJSON()` to set `tasks: null`, include `documentType`, omit doc IDs
- [ ] Update `fromJSON()` to handle null tasks

3. **Assignment legacy aliases**:
   - [ ] Update getters in `_applyLegacyAliases` to return null

4. **Assignment serialization**:
   - [ ] Rename `_extractDefinitionFields` → `_extractFullDefinitionFields`
   - [ ] Add `_extractPartialRootFields`
   - [ ] Update `toPartialJSON()` to use partial extractor

5. **Fail-fast ABClass hydration**:

- [ ] Remove ABClass.fromJSON raw-object fallback on Assignment.fromJSON errors
- [ ] Ensure failures surface immediately (tests updated accordingly)

6. **Tests**:
   - [ ] Add new validation tests
   - [ ] Add new getter tests
   - [ ] Update existing serialization tests
   - [ ] Add subclass tests
   - [ ] Update controller tests

7. **Documentation**:
   - [ ] Update DATA_SHAPES.md with new partial shapes
   - [ ] Add migration notes (hard switch, no backwards compat)

> **Notes:**

- [ ] Check off all completed tasks in this section before proceeding.

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
