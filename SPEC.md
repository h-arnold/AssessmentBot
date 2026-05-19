# Assignment Definition Creation Path Refactoring Specification

## Status

- Draft v1.9.0 (2025-05-19)
- **Architectural Decision:** Option B — Always require non-null `yearGroupKey` at model boundary; controllers accept `yearGroupKey: string | null` and resolve to non-null before model construction; deprecate and remove all `yearGroup` (numeric) usage in active code
- **Note:** v1.9.0 addresses all CRITICAL reviewer findings: resolved `yearGroupKey` nullability contradiction by adopting controller-resolution pattern; clarified validation ownership boundaries; added explicit `yearGroupLabel` resolution contract; added schema preservation test requirements; removed implementation-level details from Backend Changes Required; streamlined version history.

---

## Purpose

This document defines the refactoring to eliminate duplication, simplify the call chain, and enforce model-level value defaults in the assignment definition creation path.

The refactoring will:

- Consolidate two creation methods (`ensureDefinition` and `upsertDefinition`) into a single canonical `upsertDefinition` entry point
- Deprecate all `yearGroup` (numeric) usage in favour of `yearGroupKey` (string) as the sole year group reference
- Move all value defaulting into the model layer per `src/backend/AGENTS.md` §0.2
- Enforce fail-fast behaviour on deprecated parameters at the model boundary to surface any missed migration entries

This refactoring is **not** intended to:

- Maintain backwards compatibility for `yearGroup` in active code
- Preserve the `ensureDefinition` method
- Flatten the entire architecture into model getters/setters
- Change the public API contracts for `upsertAssignmentDefinition_`, `getAssignmentDefinitionPartials_`, `getAssignmentDefinition_`, or `deleteAssignmentDefinition_`
- Update deprecated code in `src/AdminSheet` or legacy `globals.js` files
- Preserve all existing tests unchanged — tests for removed functionality must be deleted, tests for changed functionality must be updated

---

## Core Principles

1. **Model owns defaults:** All value defaulting is the sole responsibility of the `AssignmentDefinition` model
2. **`yearGroupKey` is canonical:** Only `yearGroupKey` (string) is used for year group references in active code; `yearGroup` (numeric) is deprecated and removed from all active code
3. **Controller resolves to non-null:** Controllers that accept `yearGroupKey: string | null` must resolve to a non-null value before passing to the model; the model boundary receives non-null `yearGroupKey` only
4. **`yearGroupLabel` is controller-resolved:** `yearGroupLabel` is a display-only field resolved from authoritative year-group reference data by the controller and passed to the model; it is included in all definition serialization outputs
5. **Single creation method:** `upsertDefinition` is the only way to create or update assignment definitions
6. **No backwards compatibility:** Deprecated code may break and will not be updated
7. **Fail-fast at model boundary:** Model constructor and `fromJSON()` must throw when they receive deprecated `yearGroup` parameter to surface missed migration entries
8. **Separation of concerns:** Transport validation in API layer, domain validation in controller, data defaults and integrity in model (per `src/backend/AGENTS.md` §0.2)

---

## Agreed Product Decisions

1. **Option B — `yearGroupKey` only:** All year group references in active code use `yearGroupKey` (string). The numeric `yearGroup` field is deprecated and must be removed from all active code paths. `yearGroupLabel` remains for display purposes only and is resolved by the controller.
2. **Controller-resolution pattern:** Controllers may accept `yearGroupKey: string | null` and must resolve to a non-null value before calling model methods. The model boundary (constructor, `fromJSON()`) receives non-null `yearGroupKey` only.
3. **Single canonical creation method:** Remove `ensureDefinition` entirely; `upsertDefinition` is the sole creation/update method.
4. **Model-level defaults:** `assignmentWeighting` defaults to 1 and enforces range 0-10 in the model constructor; API and controller layers must not apply defaults.
5. **Fail-fast on deprecated `yearGroup`:** Model constructor and `fromJSON()` must throw `TypeError` when `yearGroup` is present in the input, to catch any code that has not been migrated.
6. **Definition key format change:** `buildDefinitionKey()` uses `yearGroupKey` (string) instead of `yearGroup` (numeric); old definitions with numeric-based keys will not be found by new lookups and must be re-created.
7. **No data migration:** Existing stored definitions with `yearGroup` fields will cause model operations to fail; they must be re-created through the new flow. This is acceptable as there is no legacy data to preserve.

---

## Existing System Constraints

### Backend or API Constraints Already in Place

- Frontend already resolves to `yearGroupKey` exclusively via Zod schema; backend never receives numeric `yearGroup` from frontend
- Transport layer in `assignmentDefinitionPartials.js` already strips `yearGroup` from responses via `toPlainPartialRow_` and `toCanonicalTransportDefinition_`
- Public API contracts for `upsertAssignmentDefinition_`, `getAssignmentDefinitionPartials_`, `getAssignmentDefinition_`, and `deleteAssignmentDefinition_` must remain stable

### Current Data-Shape Constraints

- Partial definitions in registry have `tasks: null`; full definitions in dedicated collections have `tasks: {...}` — this distinction must be preserved
- Definition key format currently uses numeric year group (e.g., `Math_Algebra_10`); new format will use string key (e.g., `Math_Algebra_year-group-10`)

### Validation Ownership Constraints

Per `src/backend/AGENTS.md` §0.2, validation ownership is:

- **Transport validation:** API layer (`z_Api`) — shape, safety, URL parsing
- **Domain validation:** Controller (`y_controllers`) — business rules, required-field completeness, reference data
- **Data defaults and integrity:** Model — defaults, range validation, data shape

**Clarification for this refactoring:**

- Controller owns: resolving `yearGroupKey` from null to non-null, resolving `yearGroupLabel` from reference data, validating required fields before model construction
- Model owns: rejecting deprecated `yearGroup` field, defaulting `assignmentWeighting` to 1, enforcing `assignmentWeighting` range 0-10, type validation for `yearGroupKey` (must be string)

---

## Breaking Changes

### 1. Model Contract Change: `assignmentWeighting` Default

- **Before:** `AssignmentDefinition` constructor and `fromJSON()` accepted `assignmentWeighting: null` and stored it as null
- **After:** Model constructor defaults `assignmentWeighting` to `1` when null, undefined, or not provided; stored value is **always** a number (0-10), never null; range 0-10 is enforced by model constructor with `RangeError`
- **Impact:** Stored definitions with `assignmentWeighting: null` will automatically become `1` on next construction; all downstream consumers must be audited for `assignmentWeighting === null` checks

### 2. Year Group Field Deprecation: `yearGroup` → `yearGroupKey` Only

- **Before:** Active code used both `yearGroup` (numeric) and `yearGroupKey` (string) for year group references
- **After:** Only `yearGroupKey` (string) is used in active code; `yearGroup` (numeric) is **completely removed** from all active models and method signatures
- **Controller resolution:** Controllers accept `yearGroupKey: string | null` and resolve to non-null before passing to model
- **Model boundary:** Model constructor and `fromJSON()` receive non-null `yearGroupKey` (string) only
- **Stored data:** Any stored definition JSON containing a `yearGroup` field **will cause model operations to fail**. There is no migration path; such definitions become inaccessible and must be re-created through the new flow.
- **Impact:**
  - `AssignmentDefinition` model: `yearGroup` field **completely removed** from constructor signature, properties, `toJSON()`, `toPartialJSON()`, and `fromJSON()`
  - `AssignmentDefinition.buildDefinitionKey()`: parameter renamed from `yearGroup` to `yearGroupKey`; key format uses string-based year group key
  - `AssignmentDefinitionController._assertNoDuplicateBusinessTuple`: uses only `yearGroupKey` (no `yearGroup` fallback)
  - `AssignmentDefinitionController._resolveYearGroupContextForUpsert`: returns only `{ yearGroupKey, yearGroupLabel }` (no `yearGroup` field); controller resolves `yearGroupLabel` from reference data
  - `AssignmentDefinitionController.ensureDefinition`: **REMOVED entirely**
  - `AssignmentController.ensureDefinitionFromInputs`: parameter renamed from `yearGroup: number | null` to `yearGroupKey: string | null`
  - `AssignmentController.createDefinitionFromWizardInputs`: parameter renamed from `yearGroup: number | null` to `yearGroupKey: string | null`
  - Dynamic `yearGroup` property on `ABClass` instances: deprecated; code that sets it will be removed entirely

### 3. Method Removal: `ensureDefinition`

- **Removed:** `AssignmentDefinitionController.ensureDefinition()` is deleted entirely with no replacement
- **Impact:** All direct callers must migrate to `upsertDefinition` or be removed

### 4. Definition Key Format Change

- **Before:** `buildDefinitionKey()` used `yearGroup` (numeric) in the key: format `${primaryTitle}_${primaryTopic}_${yr}` where `yr` is the numeric year group or 'null'
- **After:** `buildDefinitionKey({ primaryTitle, primaryTopic, yearGroupKey })` uses `yearGroupKey` (string) in the key: format `${primaryTitle}_${primaryTopic}_${yearGroupKey}` where `yearGroupKey` is the string key
- **Requirements:** `primaryTitle` and `primaryTopic` must be non-empty strings; `yearGroupKey` must be a string (can be any string value including the literal string 'null', but not the null value)
- **No parameter validation:** The method does not validate its parameters; validation is the caller's responsibility
- **Impact:** Breaking change for existing stored definitions; old keys (e.g., `Math_Algebra_10`) will not be found by new lookup logic; existing definitions will be orphaned

### Combined Effect: Existing Definitions Become Inaccessible

The combined effect of the above breaking changes is that **any stored definition containing a `yearGroup` field will fail to load after refactoring**:

- The fail-fast validation in model `fromJSON()` throws when `yearGroup` is present in the input JSON
- The definition key format change means old keys cannot be found by new lookups
- The removal of `yearGroup` from the model means no code path can process it

**Result:** Existing stored definitions with `yearGroup` fields **cannot be loaded** after refactoring. They must be re-created through the new `upsertDefinition` flow using `yearGroupKey`.

**Important:** At the model boundary, `yearGroupKey` **must be a non-null string** for all definitions. Controllers that receive `yearGroupKey: string | null` must resolve to non-null before calling model methods. Legacy definitions with null or missing `yearGroupKey` are considered invalid and must be re-created through the new flow.

---

## Backend Changes Required to Support Agreed Behaviour

List only the **behavioural requirements** for backend changes. Implementation details belong in ACTION_PLAN.md.

### Model Layer — `src/backend/Models/AssignmentDefinition.js`

- Must reject any input containing a `yearGroup` field: constructor and `fromJSON()` throw `TypeError` when `yearGroup` property is present
- Must accept non-null `yearGroupKey` (string) at model boundary: constructor and `fromJSON()` receive `yearGroupKey` as a non-null string
- Must validate `yearGroupKey` type: constructor throws `TypeError` when `yearGroupKey` is not a string (null/undefined check is controller responsibility)
- Must not store `yearGroup`: no `this.yearGroup` property on model instances
- Must exclude `yearGroup` from all serialization: `toJSON()` and `toPartialJSON()` must not include `yearGroup` field
- Must include `yearGroupKey` and `yearGroupLabel` in serialization: both `toJSON()` and `toPartialJSON()` include these fields when present
- Must accept `yearGroupLabel` as optional parameter: model does not resolve it; controller provides it
- Must default `assignmentWeighting` to 1: constructor defaults when null, undefined, or missing; stored value is always a number
- Must enforce `assignmentWeighting` range: constructor throws `RangeError` for values outside 0-10
- Must rename `buildDefinitionKey` parameter: accepts `yearGroupKey` (string) instead of `yearGroup` (numeric)

### Controller Layer — `src/backend/y_controllers/AssignmentDefinitionController.js`

- Must remove `ensureDefinition` method entirely with no replacement
- Must remove `yearGroup` from all method signatures and internal logic
- Must resolve `yearGroupKey` to non-null: methods accepting `yearGroupKey: string | null` must resolve to non-null before calling model
- Must resolve `yearGroupLabel`: `_resolveYearGroupContextForUpsert` returns `{ yearGroupKey, yearGroupLabel }` with label resolved from reference data
- Must use only `yearGroupKey` for duplicate detection: `_assertNoDuplicateBusinessTuple` uses only `yearGroupKey` (no `yearGroup` fallback)
- Must not apply defaults for `assignmentWeighting`: `_resolveAssignmentWeightingForUpsert` returns raw payload value (may be null/undefined) for model to handle
- Must preserve validation logic: all validation from `_buildUpsertContext` must be preserved within `upsertDefinition`; `_buildUpsertContext` is removed

### Controller Layer — `src/backend/y_controllers/AssignmentController.js`

- Must accept `yearGroupKey: string | null` instead of `yearGroup: number | null` in `ensureDefinitionFromInputs` and `createDefinitionFromWizardInputs`
- Must resolve `yearGroupKey` to non-null: `ensureDefinitionFromInputs` resolves from input or `abClass.yearGroupKey`, throws when both are null
- Must resolve `primaryTopicKey`: `ensureDefinitionFromInputs` resolves from `topicId` + `courseId` via Classroom API
- Must delegate to `controller.upsertDefinition`: `ensureDefinitionFromInputs` calls `controller.upsertDefinition` (not `controller.ensureDefinition`) with resolved non-null `yearGroupKey` and `primaryTopicKey`
- Must not set `abClass.yearGroup`: remove code that dynamically sets this property

### Legacy Code — `src/backend/AssignmentProcessor/globals.js`

- Must accept `yearGroupKey: string | null` instead of `yearGroup: number | null` in `createDefinitionFromWizardInputs`
- Must call controller with `yearGroupKey` parameter

### API Layer — `src/backend/z_Api/assignmentDefinitionPartials.js`

- Must remove `toCanonicalTransportDefinition_` helper; callers use `controller.toCanonicalFullDefinitionResponse(definition)` directly
- Must remove `buildControllerUpsertPayload_` helper; inline URL-to-ID translation into caller **without** `assignmentWeighting` defaulting logic
- Must remove `toPlainPartialRow_` helper; replace with transport-boundary helper
- Must add new `toTransportPartialRow_` helper: accepts model instance, calls `definition.toPartialJSON()`, defensively strips `yearGroup` field, normalises Date fields to ISO strings
- Must update `getAssignmentDefinitionPartials_` to use `toTransportPartialRow_`
- Must preserve transport validation helpers unchanged: `validateRequiredYearGroupKey_`, `validateUpsertParameters_`, `validateReadParameters_`, `validateDeleteParameters_`

---

## Contract Stability

### Public API Contracts

- **Unchanged:** `upsertAssignmentDefinition_`, `getAssignmentDefinition_`, `deleteAssignmentDefinition_` — signatures and return shapes unchanged
- **Changed:** `getAssignmentDefinitionPartials_` — signature unchanged, but returned objects will **no longer include** the `yearGroup` field; Date fields will be string-normalised via transport-boundary overlay

### Internal Contracts (Breaking)

- **`AssignmentDefinition` constructor** — `yearGroup` parameter **removed**; accepts non-null `yearGroupKey` (string); `assignmentWeighting` defaults to 1 and enforces range 0-10; stored value is never null
- **`AssignmentDefinition.fromJSON()`** — `yearGroup` field **not extracted**; throws `TypeError` if `yearGroup` is present; accepts non-null `yearGroupKey` (string); `assignmentWeighting` defaults to 1
- **`AssignmentDefinition.toJSON()` / `toPartialJSON()`** — `yearGroup` field **removed from output**; both include `yearGroupKey` and `yearGroupLabel`
- **`AssignmentDefinition.buildDefinitionKey()`** — parameter **renamed** from `yearGroup` to `yearGroupKey`; key format uses string-based year group key; no parameter validation
- **`controller.ensureDefinition`** — **REMOVED**
- **`controller._resolveYearGroupContextForUpsert`** — return type changed to `{ yearGroupKey, yearGroupLabel }` (no `yearGroup`)
- **`controller._assertNoDuplicateBusinessTuple`** — uses only `yearGroupKey` (no `yearGroup` fallback)
- **`controller.upsertDefinition(payload)`** — signature unchanged; still requires resolved non-null `yearGroupKey: string`
- **`AssignmentController.ensureDefinitionFromInputs`** — signature changed: `yearGroup: number | null` → `yearGroupKey: string | null`; resolves to non-null before model call
- **`AssignmentController.createDefinitionFromWizardInputs`** — signature changed: `yearGroup: number | null` → `yearGroupKey: string | null`

---

## Validation Ownership Violations (Must Be Fixed)

Current code violates the validation ownership rules per `src/backend/AGENTS.md` §0.2. These violations **must** be corrected as part of this refactoring.

The rule: **Transport validation in API layer, domain invariants in controller, data defaults and integrity in model.**

### Violations and Required Corrections

1. **API layer applying model defaults:** `buildControllerUpsertPayload_` (assignmentDefinitionPartials.js) applies `assignmentWeighting: 1` default for missing/null values — **Required:** Remove defaulting logic when inlining; API layer must not apply model defaults

2. **Controller applying model defaults:** `_resolveAssignmentWeightingForUpsert` (AssignmentDefinitionController.js) returns `value === null ? 1 : value` (defaulting) — **Required:** Controller must return raw payload value (undefined when missing) allowing model to apply default

3. **Model accepting deprecated field:** `AssignmentDefinition` constructor accepts `yearGroup` parameter; stores `this.yearGroup`; `fromJSON()` extracts and passes `yearGroup`; `toJSON()` and `toPartialJSON()` include `yearGroup` — **Required:** Remove `yearGroup` field entirely from model per Option B

4. **Controller propagating deprecated field:** `_resolveYearGroupContextForUpsert` extracts `yearGroup` from reference data; `_assertNoDuplicateBusinessTuple` uses `row.yearGroup` fallback — **Required:** Controller must not extract or propagate `yearGroup`; must use only `yearGroupKey` from reference data

---

## Testing Expectations

- Backend unit tests must verify `AssignmentDefinition` constructor defaults `assignmentWeighting` to 1 and enforces range 0-10
- Backend unit tests must verify `AssignmentDefinition` constructor throws `TypeError` when `yearGroup` is present in params
- Backend unit tests must verify `AssignmentDefinition.fromJSON()` throws `TypeError` when `yearGroup` is present in input JSON
- Backend unit tests must verify `AssignmentDefinition.toJSON()` and `toPartialJSON()` do not include `yearGroup` field
- Backend unit tests must verify `AssignmentDefinition.toJSON()` and `toPartialJSON()` include `yearGroupKey` and `yearGroupLabel` fields
- Backend unit tests must verify `AssignmentDefinition.buildDefinitionKey()` uses `yearGroupKey` parameter and produces correct format
- Backend unit tests must verify **partial/full schema preservation**: `toPartialJSON()` returns `tasks: null` for partial definitions; `toJSON()` returns `tasks: {...}` for full definitions
- Controller tests must verify `upsertDefinition` with API-facing pattern and non-null `yearGroupKey` requirement
- Controller tests must verify `_assertNoDuplicateBusinessTuple` uses only `yearGroupKey` (no `yearGroup` fallback)
- Controller tests must verify `_resolveYearGroupContextForUpsert` returns only `yearGroupKey` and `yearGroupLabel` (no `yearGroup` field)
- Controller tests must verify `_resolveYearGroupContextForUpsert` resolves `yearGroupLabel` from reference data
- Controller tests must verify `_resolveAssignmentWeightingForUpsert` is validation-only (no defaulting, returns raw payload value)
- Controller tests must verify that methods accepting `yearGroupKey: string | null` resolve to non-null before model calls
- API layer tests must verify URL-to-ID translation still works correctly after inlining
- API layer tests must verify inlined code does NOT add `assignmentWeighting: 1` default when missing from payload

---

## Documentation and Rollout Notes

- Update `docs/developer/backend/api-layer.md` 'Shared Helper Status' to reflect removed helpers (see Planning Handoff Notes)
- This is architectural cleanup with breaking changes and should be done as a focused refactoring effort
- After refactoring, run full backend test suite and verify no regressions in assignment definition creation, update, list, read, and delete operations
- Verify `AssignmentController` workflows (start processing, wizard flows) continue to function correctly

---

## Planning Handoff Notes

Use this section only for constraints that the later action plan must respect.

- **Documentation requirement:** `docs/developer/backend/api-layer.md` 'Shared Helper Status' must be updated before implementation starts. Update the existing 'Assignment-definition full-definition response mapper' entry to Status: `Removed`. Add entries for:
  - Assignment-definition partial row serializer: `Removed` — `toPlainPartialRow_` in `src/backend/z_Api/assignmentDefinitionPartials.js`
  - Assignment-definition upsert payload builder: `Removed` — `buildControllerUpsertPayload_` in `src/backend/z_Api/assignmentDefinitionPartials.js`
  - Assignment-definition upsert context builder: `Removed` — `_buildUpsertContext` in `src/backend/y_controllers/AssignmentDefinitionController.js`
  - Assignment-definition creation method: `Removed` — `ensureDefinition` in `src/backend/y_controllers/AssignmentDefinitionController.js`
  - AssignmentDefinition yearGroup field: `Removed` — `yearGroup` parameter and property in `src/backend/Models/AssignmentDefinition.js`
  - Assignment-definition transport partial row helper: `Not implemented` — `toTransportPartialRow_` in `src/backend/z_Api/assignmentDefinitionPartials.js`
- **Shared-helper planning gate compliance:** Planned helper entries for removed/refactored helpers must be marked with correct status in canonical docs before implementation starts
- **Test removal guidance:** Tests for removed methods and helpers must be removed or updated in ACTION*PLAN.md: `ensureDefinition`, `toCanonicalTransportDefinition*`, `buildControllerUpsertPayload*`, `toPlainPartialRow*`, `\_buildUpsertContext`
- **Verification requirement:** ACTION_PLAN.md must include verification that no code in active paths passes `yearGroup` to any model method
- **Deprecated code:** Callers in `src/AdminSheet` and legacy `globals.js` may break; this is acceptable per "no backwards compatibility"
- **Explicit null handling for `assignmentWeighting`:** The model constructor must handle `assignmentWeighting` values of null, undefined, or missing by defaulting to 1; the controller must not apply defaults and must pass the raw payload value as-is to the model
- **Controller-resolution pattern:** Methods that accept `yearGroupKey: string | null` must resolve to a non-null string before passing to model methods; the model boundary receives non-null `yearGroupKey` only
- **`yearGroupLabel` resolution:** Controller must resolve `yearGroupLabel` from authoritative year-group reference data and pass it to the model; model does not perform this resolution

---

## Open Questions

1. **Validation ownership for `yearGroupKey` null check:** Should the model validate that `yearGroupKey` is non-null (data integrity check), or should the controller guarantee non-null before model construction (domain validation)? Current resolution in this spec adopts the latter (controller guarantees non-null), but confirmation is needed.

2. **Scope of fail-fast beyond model boundary:** Should fail-fast validation for deprecated `yearGroup` parameter extend beyond the model constructor and `fromJSON()` to all active code paths, or is model-boundary validation sufficient? Current spec requires model-boundary only; broader application is recommended but not required.

3. **`buildDefinitionKey` null handling:** Should `buildDefinitionKey` validate its parameters (particularly `yearGroupKey`), or is validation the caller's responsibility? Current spec adopts the latter (no validation in method), but confirmation is needed.

---

_This specification implements the architectural decision to use `yearGroupKey` only (Option B) with controller-resolution pattern and a single `upsertDefinition` method. Version v1.9.0 addresses all CRITICAL reviewer findings by resolving contradictions, clarifying ownership boundaries, adding explicit contracts, and removing implementation-level details from the specification._
