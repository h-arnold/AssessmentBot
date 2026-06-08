# Date Transport Hardening & API Layer Refactoring — Delivery Plan (TDD-First)

## Read-First Context

Before executing this plan:

1. Read `DEBUG_SESSION_2026-06-08.md` — root cause confirmed: `Date` objects in `google.script.run` return values.
2. Read `src/frontend/AGENTS.md` — Section 4.3 documents the prohibited types rule.
3. Read `docs/developer/backend/api-layer.md` — Critical section documents the backend rules.
4. Read `src/backend/AGENTS.md` — backend conventions, trailing-underscore pattern, apiHandler rules.
5. Read `src/backend/Utils/Utils.js` and `src/backend/Utils/Validate.js` — current shared utilities.

No full SPEC is required for this work. The decisions are settled:

- Date objects are prohibited in `google.script.run` return values.
- Conversion happens at the API handler layer (not in controllers or models).
- The idiomatic pattern is `Utils.normaliseDateFields(response, ['field1', 'field2'])` applied in API handler functions.

## Scope and assumptions

### Scope

- New `DateUtils` module extracted from `Utils.js` (four date-related methods + new `normaliseDateFields`).
- Apply `normaliseDateFields` in `getAssignmentDefinition_()` and `upsertAssignmentDefinition_()` API handlers.
- Apply `normaliseDateFields` in `toTransportPartialRow_()` (replace inline `instanceof Date` checks).
- Split `assignmentDefinitionPartials.js` (918 lines) into:
  - `assignmentDefinitionValidation.js` — validation helpers (read, delete, upsert, partials).
  - `assignmentDefinitionTransport.js` — handler functions + URL-to-ID translation.
- Split `assignmentDefinitionPartials.js` into validation and transport files; keep validators mostly as-is after confirming minimal duplication with `Validate.js`.
- Update `src/backend/AGENTS.md` with the new `normaliseDateFields` pattern rule.
- Update `docs/developer/backend/api-layer.md` to reference `DateUtils` as the implementation.

### Out of scope

- `AssignmentController.js` structural refactoring (separate future workstream — file is 491 lines, lower priority).
- Data migration of existing records with `Date` objects in storage.
- Frontend changes.

### Scope (newly added)

- `AssignmentDefinitionController.js` refactoring: split 1129-line monolithic class into a folder with a facade `index.js` delegating to focused sub-classes (Sections 7–8).
- Dead code removal: `_resolveTopicName` (no callers) and `savePartialDefinition` (redundant with `_persistDefinitionWithRollback`, no production callers).

### Assumptions

1. The `DateUtils` module follows the existing `Utils` global-concatenation pattern (export via `globalThis` for GAS, `module.exports` for Node tests).
2. Existing test files for `assignmentDefinitionPartials.js` will be updated to match the new file split.
3. `Validate.js` will be extended, not replaced — backward compatibility is preserved.
4. The class-vs-function question for the API layer is settled: keep the trailing-underscore function pattern. It is consistent with all other `z_Api` files (`googleClassrooms.js`, `apiConfig.js`, `abclassMutations.js`, `assignmentAssessment.js`). A class facade would be the only class in the API layer and offers no concrete benefit over function-based organisation.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API-layer handlers thin; delegate to controller methods.
- Use `ABLogger` for all new logging; no `console.*` in new code.
- Use British English in comments and documentation.
- Preserve GAS concatenation load order; do not rename numbered files unless explicitly changing load order.
- All new helpers must be exported for Node test accessibility.

### Validation commands

- Backend lint: `npm run lint:backend`
- Backend tests: `npm test -- tests/api/assignmentDefinitionPartials.test.js`
- Builder lint: `npm run lint:builder`

---

## Section 1 — Update backend documentation

### Objective

Update `src/backend/AGENTS.md` and `docs/developer/backend/api-layer.md` to document the `DateUtils.normaliseDateFields` pattern first, so implementation agents have the rules before writing code.

### Changes

**`src/backend/AGENTS.md`:** Add a new subsection under "Non-callable transport helpers" or a dedicated "Date handling at transport boundary" section:

```markdown
### Date handling at the transport boundary

`google.script.run` prohibits `Date` objects in return values (see `src/frontend/AGENTS.md` §4.3
for the full rules). All API handler functions must convert live `Date` objects to ISO strings
before returning data.

- Use `DateUtils.normaliseDateFields(response, ['field1', 'field2'])` in API handler functions
  that return data carrying date fields.
- Apply the call after the controller returns and before the handler returns to `apiHandler`.
- This is the canonical pattern; do not inline `instanceof Date` checks or push conversion into
  controllers or models.
- `DateUtils` lives at `src/backend/Utils/DateUtils.js` and exports `normaliseDateFields`,
  `isNewer`, `definitionNeedsRefresh`, `getFormattedDate`, and `getFutureDate`.
```

**`docs/developer/backend/api-layer.md`:** Update the existing "Critical: prohibited types" subsection to reference `DateUtils.normaliseDateFields` as the implementation.

### Acceptance criteria

- AGENTS.md correctly references `DateUtils` and the pattern.
- api-layer.md references the implementation location.
- No other documentation regressions.

### Section checks

- [ ] Documentation passes review.

---

## Section 2 — Extract `DateUtils` from `Utils.js`

### Objective

Move all date-related utilities out of `Utils.js` into a dedicated `src/backend/Utils/DateUtils.js` module, and add the new `normaliseDateFields` method.

### Constraints

- Must preserve `globalThis` export pattern for GAS runtime concat order.
- Must preserve `module.exports` pattern for Node tests.
- Backward compatible: all call sites (`Utils.isNewer`, `Utils.definitionNeedsRefresh`, `Utils.getDate`, `Utils.getFutureDate`) must work unchanged.
- The new `normaliseDateFields(obj, fields)` signature accepts a plain object and an array of field names; converts `Date` instances to ISO strings in-place.

### Functions to extract

| Current location                 | Method                    | New location                                 |
| -------------------------------- | ------------------------- | -------------------------------------------- |
| `Utils.getDate()`                | Formatted date string     | `DateUtils.getFormattedDate()`               |
| `Utils.getFutureDate(days)`      | Future `Date` object      | `DateUtils.getFutureDate(days)`              |
| `Utils.definitionNeedsRefresh()` | Staleness check           | `DateUtils.definitionNeedsRefresh()`         |
| `Utils.isNewer()`                | Date comparison           | `DateUtils.isNewer()`                        |
| _(new)_                          | Convert Date → ISO string | `DateUtils.normaliseDateFields(obj, fields)` |

### Call-site updates

- `src/backend/Utils/Utils.js` — remove four methods, re-export from `DateUtils` for backward compat.
- `src/backend/y_controllers/AssignmentController.js` — uses `Utils.isNewer` via global `Utils.isNewer` → change to `DateUtils.isNewer`.
- `src/backend/y_controllers/AssignmentDefinitionController.js` — uses `Utils.isNewer` or `Utils.definitionNeedsRefresh` → change.
- Any other callers of the four extracted methods.

### Shared-helper decisions

| Decision | Path                             | Rationale                                                                          |
| -------- | -------------------------------- | ---------------------------------------------------------------------------------- |
| `new`    | `src/backend/Utils/DateUtils.js` | New module for date-related utilities                                              |
| `extend` | `src/backend/Utils/Utils.js`     | Re-export DateUtils members for backward compatibility; deprecate in-place methods |

### Acceptance criteria

- All existing tests pass with call sites updated.
- New `normaliseDateFields` unit tests pass:
  - Converts `Date` objects in specified fields to ISO strings.
  - Leaves ISO strings unchanged.
  - Leaves `null`/`undefined` values unchanged.
  - Leaves non-date values unchanged.
  - Handles empty field array (no-op).
  - Does not mutate the original object in a way that breaks callers (returns same object reference).

### Section checks

- [ ] Backend lint passes.
- [ ] All existing `Utils.*` tests pass.
- [ ] New `DateUtils` unit tests pass.
- [ ] No other `npm test` suite regressions.

---

## Section 3 — Apply `normaliseDateFields` to `getAssignmentDefinition_` and `upsertAssignmentDefinition_`

### Objective

Fix the root cause reported in `DEBUG_SESSION_2026-06-08.md`: convert `Date` objects to ISO strings at the API handler boundary for the two full-definition transport methods.

### Changes

**`getAssignmentDefinition_()` in `assignmentDefinitionPartials.js`:**

Before:

```js
return controller.toCanonicalFullDefinitionResponse(definition);
```

After:

```js
const response = controller.toCanonicalFullDefinitionResponse(definition);
return DateUtils.normaliseDateFields(response, ['createdAt', 'updatedAt']);
```

> **Note for implementer:** `toCanonicalFullDefinitionResponse` will be renamed to `getFullAssignmentDefinition` in Section 9.

**`upsertAssignmentDefinition_()` in `assignmentDefinitionPartials.js`:**

Before:

```js
const definition = controller.upsertDefinition(payload);
return controller.toCanonicalFullDefinitionResponse(definition);
```

After:

```js
const definition = controller.upsertDefinition(payload);
const response = controller.toCanonicalFullDefinitionResponse(definition);
return DateUtils.normaliseDateFields(response, ['createdAt', 'updatedAt']);
```

> **Note for implementer:** Same — `toCanonicalFullDefinitionResponse` will be renamed in Section 9.

### Acceptance criteria

- `getAssignmentDefinition` API calls return `createdAt` and `updatedAt` as ISO strings (not `null`).
- `upsertAssignmentDefinition` API calls return `createdAt` and `updatedAt` as ISO strings.
- Existing tests for both handlers pass.

### Section checks

- [ ] Backend lint passes.
- [ ] Backend tests pass (`npm test -- tests/api/assignmentDefinitionPartials.test.js`).

---

## Section 4 — Update `toTransportPartialRow_` to use `normaliseDateFields`

### Objective

Replace the inline `instanceof Date` checks in `toTransportPartialRow_` with the shared `DateUtils.normaliseDateFields` call, establishing it as the consistent idiom.

### Changes

**`toTransportPartialRow_()` in `assignmentDefinitionPartials.js`:**

Before:

```js
return {
  ...rest,
  createdAt: rest.createdAt instanceof Date ? rest.createdAt.toISOString() : rest.createdAt,
  updatedAt: rest.updatedAt instanceof Date ? rest.updatedAt.toISOString() : rest.updatedAt,
};
```

After:

```js
return DateUtils.normaliseDateFields(rest, ['createdAt', 'updatedAt']);
```

(Note: `rest` already has `yearGroup` stripped, so the spread is unnecessary.)

### Acceptance criteria

- Partial row transport continues to return ISO date strings.
- Existing partials tests pass.

### Section checks

- [ ] Backend lint passes.
- [ ] Backend tests pass.

---

## Section 5 — Split `assignmentDefinitionPartials.js`

### Objective

Split the 918-line `assignmentDefinitionPartials.js` into two focused files, making each easier to read, test, and maintain. Simplify validation helpers where they duplicate `Validate.js` functionality.

### Proposed split

| New file                            | Contents                                                                                                                                                                                                                            | Approx. lines |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `assignmentDefinitionValidation.js` | All validation helpers + URL extraction + ISO timestamp check                                                                                                                                                                       | ~600          |
| `assignmentDefinitionTransport.js`  | Handler functions (`getAssignmentDefinitionPartials_`, `getAssignmentDefinition_`, `deleteAssignmentDefinition_`, `upsertAssignmentDefinition_`) + `toTransportPartialRow_` + `extractSupportedDocumentDescriptor_` URL translation | ~300          |

### Validation simplification opportunities

Looking at the current validation helpers vs `Validate.js`:

| Current validator                       | Duplicates                                               | Simplify to                                                                                                                                                                                            |
| --------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `validateSafeTrimmedIdentifier_()`      | String type + non-empty + pre-trimmed + no control chars | Keep — the throw-error pattern with `ApiValidationError` is specific to the domain. `Validate.isNonEmptyString` only does boolean checks; the domain validator needs typed error throwing per context. |
| `validateRequiredFields_()`             | Object type + field presence check                       | Keep — `Validate.requireParams` only checks null/undefined, not missing keys.                                                                                                                          |
| `hasControlCharacters_()`               | No duplication in Validate                               | Keep as-is.                                                                                                                                                                                            |
| `isIsoDateTimeString_()`                | No duplication in Validate                               | Keep as-is.                                                                                                                                                                                            |
| `extractSupportedDocumentDescriptor_()` | Already uses `Validate.isValidUrl`                       | Keep as-is.                                                                                                                                                                                            |

**Finding:** `Validate.js` has primitive type checks but no domain-aware throwing pattern. The `assignmentDefinitionPartials.js` validators already serve a different layer (transport validation with structured `ApiValidationError`). The genuine duplication is minimal — mostly the `typeof value !== 'string'` pattern repeated in each validator, but each one throws a different error code. This is expected for transport-boundary validation.

**Recommendation:** Keep the validators mostly as-is when splitting. The file is large mainly because of the number of validators, not because they duplicate logic. The split into `validation` and `transport` files alone makes it more navigable.

### Module export changes

`z_apiHandler.js` currently loads `assignmentDefinitionPartials.js` via `require` for Node tests and expects `getAssignmentDefinitionPartials_`, `getAssignmentDefinition_`, `deleteAssignmentDefinition_`, and `upsertAssignmentDefinition_` as globals in GAS runtime.

- In GAS: both new files are concatenated; functions remain global via trailing-underscore.
- In Node: update `z_apiHandler.js` to `require` both files.

### Test files to update

The current file exports 21 symbols for testing. After splitting, these test files need import path updates:

| Test file                                                         | What needs updating                                                                                                                                                           |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/backend-api/assignmentDefinitionPartials.unit.test.js`     | Import path: `assignmentDefinitionPartials` → `assignmentDefinitionTransport` + `assignmentDefinitionValidation`; `expectPatternInSource` strings reference the old file name |
| `tests/api/assignmentDefinitionReadApi.test.js`                   | Import path: mocked `AssignmentDefinitionController` imports via `assignmentDefinitionPartials` → update to new transport file                                                |
| `tests/api/assignmentDefinitionUpsertApi.test.js`                 | Same as read API — import path update                                                                                                                                         |
| `tests/controllers/assignmentDefinitionController.upsert.test.js` | References `toCanonicalFullDefinitionResponse` on controller — rename in Section 9 covers this                                                                                |

Additionally, `z_apiHandler.js` needs its `require` block updated to pull from both new files.

### Acceptance criteria

- All existing `assignmentDefinitionPartials` tests pass with updated file structure.
- `npm test -- tests/api/assignmentDefinitionPartials.test.js` passes.
- File structure is cleaner: validation logic separated from transport logic.
- No regressions in type-checking or linting.

### Section checks

- [ ] Backend lint passes.
- [ ] All backend tests pass.
- [ ] `clasp push` produces working GAS deployment.

---

## Section 6 — Regression hardening

### Objective

Ensure no regressions across all backend test suites after Sections 1–5 complete.
Sections 7–9 carry their own section-level checks; re-run the full suite after Section 9.

### Checks

- Full backend test suite: `npm test`
- Backend lint: `npm run lint:backend`
- Builder lint (if GAS concat order changes): `npm run lint:builder`
- Verify production deployment via `clasp push`

### Section checks

- [ ] All backend tests green.
- [ ] All lint commands green.
- [ ] `clasp push` succeeds.
- [ ] Manual smoke test: call `getAssignmentDefinition` via frontend and verify `createdAt`/`updatedAt` are ISO strings (not `null`).

---

## Section 7 — Remove dead code from `AssignmentDefinitionController`

### Objective

Remove three unused methods identified in the caller audit before refactoring the class.

### Dead code findings

| Method                    | Lines   | Reason                                                                                                                                                      | Action                    |
| ------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `_resolveTopicName()`     | 506–530 | Never called in active code; no tests reference it. Only used in deprecated `AdminSheet` copy.                                                              | Remove                    |
| `savePartialDefinition()` | 386–408 | No production callers in active backend. `_persistDefinitionWithRollback` handles partial persistence internally. Only called from deprecated `AdminSheet`. | Remove method + its tests |
| `saveDefinition()`        | 366–382 | Only called from deprecated `AdminSheet`. The active upsert path uses `_persistDefinitionWithRollback` directly. No test references outside AdminSheet.     | Remove method             |

### Changes

1. Delete `_resolveTopicName` method and its JSDoc block from `AssignmentDefinitionController.js`.
2. Delete `savePartialDefinition` method and its JSDoc block from `AssignmentDefinitionController.js`.
3. Delete `saveDefinition` method and its JSDoc block from `AssignmentDefinitionController.js` (only called from deprecated `AdminSheet`).
4. Remove `savePartialDefinition` test cases from `tests/controllers/assignmentDefinitionController.fullStore.test.js`.
5. Remove `saveDefinition` test cases from `tests/controllers/assignmentDefinitionController.fullStore.test.js` (the entire `saveDefinition - dual-store writes` describe block, lines 98–224).
6. Remove `saveDefinition` mock from `tests/helpers/mockFactories.js` (line 370).
7. Remove `saveDefinition` mock from `tests/controllers/assignmentController.hydration.test.js` (line 212).
8. Remove `saveDefinition` mock from `tests/controllers/assignmentController/assignmentController.runAssignmentPipeline.test.js` (lines 123, 332).
9. Remove `saveDefinition` mock from `tests/controllers/assignmentController/assignmentController.userPropertiesMigration.test.js` (line 204).
10. Update `docs/developer/backend/rehydration.md` line 106: replace reference to `saveDefinition`/`savePartialDefinition` with `_persistDefinitionWithRollback` (the surviving method that handles dual-store writes).

### Acceptance criteria

- No remaining callers of `_resolveTopicName`, `savePartialDefinition`, or `saveDefinition` in active code.
- All remaining tests pass.
- Backend lint passes.

### Section checks

- [ ] Backend lint passes.
- [ ] `npm test -- tests/controllers/assignmentDefinitionController.fullStore.test.js` passes with updated tests.

---

## Section 8 — Refactor `AssignmentDefinitionController` into folder-based facade pattern

### Objective

Split the 1129-line monolithic `AssignmentDefinitionController.js` into a folder with a thin facade `index.js` delegating to focused sub-classes.

### Proposed folder structure

```
src/backend/y_controllers/AssignmentDefinition/
  index.js                              ← Facade class (same public API, ~40 lines)
  AssignmentDefinitionPersistence.js    ← Persistence concern (~200 lines)
  AssignmentDefinitionUpsertOrchestrator.js ← Upsert concern (~240 lines)
  AssignmentDefinitionTaskWeighting.js  ← Task weighting concern (~90 lines)
  AssignmentDefinitionReferenceData.js  ← Reference data resolution (~60 lines)
  AssignmentDefinitionResponseMapper.js ← Response mapping (~80 lines)
  AssignmentDefinitionTaskParser.js     ← Task parsing concern (~80 lines)
  AssignmentDefinitionValidation.js     ← Shared validation helpers (~70 lines)
```

### Concern ownership

| Sub-class            | Public methods                                                                                                                        | Private helpers                                                                                                                                                                                                                                       | Dependencies injected                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `Persistence`        | `getByKey`, `getAllPartials`, `delete`                                                                                                | `_getRegistryCollection`, `_getFullCollection`, `_getFullCollectionName`, `_getStoredFullDocument`, `_persistDefinitionWithRollback`, `_rollbackFullStoreWrite`, `_isMissingCollectionError`                                                          | `dbManager`, `cache` (Map)                                                               |
| `UpsertOrchestrator` | `upsert`                                                                                                                              | `_resolveAlternateTitles`, `_resolveAssignmentWeighting`, `_resolveYearGroupContext`, `_resolveTaskState`, `_applyTaskWeightingsIfProvided`, `_hasDocumentIdChanges`, `_resolveDocumentType`, `_generateStableKey`, `_assertNoDuplicateBusinessTuple` | `dbManager`, `persistence`, `taskParser`, `taskWeighting`, `referenceData`, `validation` |
| `TaskWeighting`      | _(none — used internally)_                                                                                                            | `_applyStoredWeightings`, `_defaultTaskWeightings`, `_applyTaskWeightings`, `_findTaskById`                                                                                                                                                           | `validation`                                                                             |
| `ReferenceData`      | _(none — used internally)_                                                                                                            | `_requireExistingAssignmentTopic`, `_listAssignmentTopics`, `_requireExistingYearGroupRecord`, `_listYearGroups`                                                                                                                                      | _(none — creates `ReferenceDataController` as needed)_                                   |
| `ResponseMapper`     | `getFull` (was `toCanonicalFullDefinitionResponse`)                                                                                   | `_getFullAssignmentDefinition`                                                                                                                                                                                                                        | `referenceData`, `validation`                                                            |
| `TaskParser`         | _(none — used internally)_                                                                                                            | `_parseTasks`, `_parseSlidesTasks`, `_parseSheetsTasks`                                                                                                                                                                                               | `progressTracker`                                                                        |
| `Validation`         | `isNonEmptyString`, `requireTrimmedString`, `normaliseTitleForDuplicate`, `normaliseAlternateTitles`, `requireNumericOrNullWeighting` | _(none)_                                                                                                                                                                                                                                              | _(none)_                                                                                 |

### Facade contract (`index.js`)

```js
class AssignmentDefinitionController {
  constructor() {
    const dbManager = DbManager.getInstance();
    const progressTracker = ProgressTracker.getInstance();
    const cache = new Map();

    this._validation = new AssignmentDefinitionValidation();
    this._referenceData = new AssignmentDefinitionReferenceData();
    this._taskParser = new AssignmentDefinitionTaskParser({ progressTracker });
    this._taskWeighting = new AssignmentDefinitionTaskWeighting({ validation: this._validation });
    this._persistence = new AssignmentDefinitionPersistence({
      dbManager,
      cache,
      validation: this._validation,
    });
    this._upsertOrchestrator = new AssignmentDefinitionUpsertOrchestrator({
      dbManager,
      persistence: this._persistence,
      taskParser: this._taskParser,
      taskWeighting: this._taskWeighting,
      referenceData: this._referenceData,
      validation: this._validation,
    });
    this._responseMapper = new AssignmentDefinitionResponseMapper({
      referenceData: this._referenceData,
      validation: this._validation,
    });
  }

  upsertDefinition(payload)              { return this._upsertOrchestrator.upsert(payload); }
  getDefinitionByKey(key, opts)          { return this._persistence.getByKey(key, opts); }
  getAllPartialDefinitions()             { return this._persistence.getAllPartials(); }
  deleteDefinitionByKey(key)             { return this._persistence.delete(key); }
  toCanonicalFullDefinitionResponse(def) { return this._responseMapper.getFull(def); }
}

> **Note:** `toCanonicalFullDefinitionResponse` will be renamed to `getFullAssignmentDefinition` in Section 9. The facade will be updated during that rename pass.
```

### Constraints

- Public API contract preserved — no callers break.
- Each sub-class follows the existing class pattern (constructor injection, `module.exports`).
- `_persistDefinitionWithRollback` stays private on `Persistence` (called by `UpsertOrchestrator`). No public `save`/`savePartial` methods — these were only used by deprecated `AdminSheet` and are fully removed in Section 7.
- Test files updated to import the facade class from the new path.
- GAS concatenation load order: sub-class files load before `index.js` (files without numeric prefixes load alphabetically; `AssignmentDefinition/` creates a folder, GAS concatenates inner files first, then the `index.js` re-export). Verify with `clasp push` during Section 8's own checks and again in Section 6 final regression.

### Acceptance criteria

- All 7 sub-class files + 1 facade file exist under `src/backend/y_controllers/AssignmentDefinition/`.
- All existing controller tests pass with updated imports.
- Public API: `new AssignmentDefinitionController()` works identically to before.
- Each sub-class is independently testable.
- Backend lint passes.
- `clasp push` produces working GAS deployment.

### Section checks

- [ ] Backend lint passes.
- [ ] Full backend test suite passes.
- [ ] `clasp push` succeeds.
- [ ] Manual smoke test: create, read, update, and delete an assignment definition via frontend.

---

## Section 9 — Rename `toCanonicalFullDefinitionResponse` → `getFullAssignmentDefinition`

### Objective

Replace the verbose method name `toCanonicalFullDefinitionResponse` with the clearer `getFullAssignmentDefinition` across all source and test files.

### Motivation

- The current name `toCanonicalFullDefinitionResponse` is inconsistent with nearby method naming (`getDefinitionByKey`, `getAllPartialDefinitions`).
- The `get` prefix signals a read operation more clearly than `to`. It aligns with the Domain-Driven Language pattern used elsewhere (`getBackendConfig`, `getABClassPartials`, `getCohorts`, etc.).
- The `AssignmentDefinition` suffix is implied by the owning class (`AssignmentDefinitionController`).

### Files to update

| File                                                              | Change                                                                                                                                                                                   |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/backend/y_controllers/AssignmentDefinitionController.js`     | Public wrapper `toCanonicalFullDefinitionResponse` → `getFullAssignmentDefinition`; private `_toCanonicalFullDefinitionResponse` → `_getFullAssignmentDefinition`                        |
| `src/backend/z_Api/assignmentDefinitionPartials.js`               | Two call sites + JSDoc comment (line 832). **Note:** Sections 2 and 3 add additional `toCanonicalFullDefinitionResponse` call sites to this file — all must be renamed during this pass. |
| `tests/api/assignmentDefinitionReadApi.test.js`                   | Mock setup (lines 13, 16, 21)                                                                                                                                                            |
| `tests/api/assignmentDefinitionUpsertApi.test.js`                 | Mock setup (lines 108, 111, 116)                                                                                                                                                         |
| `tests/backend-api/assignmentDefinitionPartials.unit.test.js`     | All mock references and `expectPatternInSource` assertions                                                                                                                               |
| `tests/controllers/assignmentDefinitionController.upsert.test.js` | Call sites (lines 756, 757, 801)                                                                                                                                                         |

### Acceptance criteria

- All occurrences of `toCanonicalFullDefinitionResponse` and `_toCanonicalFullDefinitionResponse` replaced.
- All existing tests pass.
- Backend lint passes.

### Section checks

- [ ] Backend lint passes.
- [ ] Full backend test suite passes.
- [ ] `grep -rn "toCanonicalFull" src/ tests/` returns zero results.
