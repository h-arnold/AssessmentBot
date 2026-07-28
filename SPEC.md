# Read-Only Assignment Fetch Specification

## Status

- Draft v1.0

## Purpose

This document defines the intended behaviour for separating read-only assignment fetching from the roster-refreshing class-load path.

The `getAssignment_` transport handler currently calls `loadClass(courseId)`, which triggers a Google Classroom roster refresh (`_refreshRoster`) followed by a JsonDbApp database write (`_persistRoster`), serialised by the `LockService` lock at the `apiHandler` transport boundary. This adds significant latency (roughly 10–15 seconds) to every assignment fetch from the frontend — even though the frontend only needs the hydrated assignment data for display and analysis, not a fresh roster.

The feature will be used to:

- Serve the frontend's `getAssignment` endpoint without roster-refresh overhead
- Keep the assessment-run flow (`processSelectedAssignment`) using the existing `loadClass` path to guarantee roster freshness when processing student submissions
- Preserve the existing `loadClass` method unchanged for all other callers that genuinely need fresh roster data

This feature is **not** intended to:

- Change the assessment run's roster-refresh behaviour
- Remove `loadClass` or alter its contract
- Change the frontend API or data shapes
- Alter the `rehydrateAssignment` mutation semantics for callers that pass a live ABClass instance
- Optimise any other endpoint

## Agreed product decisions

1. The frontend's `getAssignment` call must use a new read-only assignment hydration path that bypasses `loadClass` entirely. It loads the assignment directly from its dedicated collection, resolving the full definition, with no class load, no roster refresh, and no database write.
2. The assessment run (`processSelectedAssignment` in `AssignmentController`) must continue to call `loadClass(courseId)`, which refreshes the roster and persists it. This guarantees that the right students are assessed against current Classroom data.
3. The new read-only path must not mutate or return an ABClass instance. It loads the assignment document, creates an `Assignment` instance, resolves the definition, and returns it directly.
4. The new path's response shape must be identical to the current `getAssignment_` response shape (serialised via `Assignment.toJSON()`, dates deep-converted to ISO strings, `progressTracker` stripped).
5. The existing `rehydrateAssignment(abClass, assignmentId)` method must continue to work for callers that need in-place cache mutation (assessment run). Where practical, it should delegate to the new read-only method for the core loading logic.
6. `getAssignment_` must continue to return `null` when no persisted assignment document exists for the given `courseId`/`assignmentId` pair (no change to the existing `AssignmentNotFoundError` handling).

## Existing system constraints

### Backend or API constraints already in place

- `getAssignment_` is registered in `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js` as `getAssignment: (parameters) => getAssignment_(parameters)`.
- The frontend calls `getAssignment` via `assignmentAssessmentService.ts` with `courseId` and `assignmentId` as string parameters; the Zod schema is `GetAssignmentRequestSchema`.
- Full assignment documents are stored in dedicated collections named by course and assignment ID, accessed via `ABClassAssignmentOps._loadFullAssignmentDocument`.
- `rehydrateAssignment` is exposed through the `ABClassController` facade (`index.js`) and delegated to `ABClassAssignmentOps`.
- All `google.script.run` responses must convert `Date` objects to ISO strings; `DateUtils.deepConvertDates` is the canonical conversion mechanism.
- `Assignment.toJSON()` omits `progressTracker` already, but `getAssignment_` strips it as defence-in-depth.
- **Canonical API contract documentation:** `docs/developer/backend/api-layer.md` (the entry titled `- getAssignment — reads a single fully-hydrated assignment…`, currently lines 403–410) documents the `getAssignment` handler end-to-end (source, transport helper, controller delegation to `loadClass` + `rehydrateAssignment`, identity-threading rationale, logging, response data, error codes including `INTERNAL_ERROR` via `loadClass`/`ClassNotFoundError`). This feature rewrites the controller-delegation chain and removes the `loadClass`-failure error path, so `api-layer.md` is in scope as a documentation update target.
- **Canonical transport contract documentation:** `docs/developer/data-shapes/assignment.md` is the registered transport-shape contract for `getAssignment` (per `docs/developer/data-shapes/INDEX.md`). Its current content is stale for this feature: (i) the `getAssignment` aspect-table row "Controller" (currently line 93) names `ABClassController.loadClass()` + `ABClassController.rehydrateAssignment()`; (ii) the contract note "The controller threads the same `abClass` instance through `loadClass` and `rehydrateAssignment`…" (currently line 128) describes behaviour the new path no longer performs; (iii) the key-domain-validation-rules entry "ABClassController.rehydrateAssignment() ensures the assignment's embedded definition is fully hydrated before `getAssignment` can succeed" (currently line 371) attributes full-hydration-before-`getAssignment` to `rehydrateAssignment`, whereas after this feature the full hydration for `getAssignment` is performed by `readRehydrateAssignment`. All three are in scope as canonical data-shape documentation update targets; the line numbers are approximate and must be re-confirmed at docs-pass time against the entry's heading text rather than the line number.
- **Pre-existing doc/code drift in `api-layer.md`:** the handler-behaviour paragraph (currently line 407) claims the handler "applies `DateUtils.normaliseDateFields(response, ['dueDate', 'updatedAt', 'createdAt'])`", but the production code at `src/backend/z_Api/assignmentAssessment.js` line 138 actually calls `DateUtils.deepConvertDates(response)`. The existing API-layer tests (`tests/api/assignmentReadApi.test.js` tests 8 and 8b) assert `deepConvertDates` behaviour, including nested submission date conversion — which `normaliseDateFields` with three fixed field names cannot produce. This drift predates this feature but must be reconciled in the same documentation pass because the same paragraph is being rewritten to describe the new `readRehydrateAssignment` delegation.

### Current data-shape constraints

- The `Assignment.toJSON()` output shape is the canonical serialised form returned by `getAssignment_`.
- The frontend consumes this through `AssignmentFullResponseSchema` (in `assignmentAssessment.zod.ts`), which accepts the full assignment object or `null`.
- No change to the response shape is planned; the data shape contract between frontend and backend is preserved.

### Frontend or consumer architecture constraints

- The frontend has no knowledge of `refreshRoster` and does not call it.
- The frontend treats `getAssignment` as a pure read operation; the backend speed improvement is transparent to the frontend.

## Domain and contract recommendations

### Why this approach is preferable

- Mirrors the existing `readClass`/`loadClass` separation: pure read vs read-with-refresh, both expressed as distinct controller methods.
- The assignment document lives in its own dedicated collection indexed by `courseId + assignmentId`; loading it does not require the class at all.
- `rehydrateAssignment`'s ABClass mutation (`_replaceAssignmentInClass`) is only needed for maintaining an in-memory cache across multiple operations in the same request; it serves no purpose in a single-shot read like `getAssignment_`.
- Keeps `loadClass` contract intact for all existing callers (assessment run, class management).
- Minimal change to the codebase: a new focused method on `ABClassAssignmentOps`, a thin delegation on the facade, and a transport-handler adjustment.

### Recommended data shapes

No new data shapes. The response shape is unchanged:

```ts
// Response: AssignmentFullResponseSchema (already defined)
// Shape: Assignment.toJSON() with deep-converted ISO date strings, progressTracker stripped
// Returns: the full object or null
```

### Naming recommendation

Prefer:

- `readRehydrateAssignment(courseId, assignmentId)` — consistent with `readClass` prefix for read-only operations; the facade method on `ABClassController` uses the same name, matching the existing `rehydrateAssignment` delegation pattern

Avoid:

- `getAssignment` — already used in the transport layer and would conflate the transport entry point with the controller method
- introducing a different facade name for the same underlying method — the facade method name must match the `ABClassAssignmentOps` method name, mirroring the existing `rehydrateAssignment` delegation pattern (`index.js:470–472`).

Explain any naming rule that prevents future ambiguity: the `read` prefix signals "no roster refresh, no database write", matching `readClass`; the `Rehydrate` suffix signals "loads the full assignment document with definition resolution", matching `rehydrateAssignment`.

### Validation recommendation

#### Backend

- The new `readRehydrateAssignment` method must validate that `courseId` and `assignmentId` are non-empty strings, following the same structural pattern as the existing `rehydrateAssignment` (a `Validate.requireParams` presence guard plus per-field non-empty-string `TypeError` guards). The exact error-message strings differ from `rehydrateAssignment`'s because the parameter name differs (`courseId` vs `abClass.classId`); see §"Core behavioural model" §`readRehydrateAssignment` step 1 for the exact messages.
- Transport-boundary validation in `getAssignment_` (identifier shape and character checks) remains unchanged.

## Feature architecture

### Placement

- New method in `ABClassAssignmentOps.js`: `readRehydrateAssignment(courseId, assignmentId)`
- Delegation method in `ABClassController/index.js` facade: delegating to `ABClassAssignmentOps`
- Updated handler in `z_Api/assignmentAssessment.js`: `getAssignment_` uses the new read-only method

### Proposed high-level tree

```text
getAssignment_ (transport handler)
└── ABClassController.readRehydrateAssignment(courseId, assignmentId)  [new facade method]
    └── ABClassAssignmentOps.readRehydrateAssignment(courseId, assignmentId)  [new core method]
        ├── _loadFullAssignmentDocument(courseId, assignmentId)  [existing]
        ├── _validateAssignmentDocument(document)                 [existing]
        ├── Assignment.fromJSON(document)                         [existing]
        ├── _ensureFullDefinition(assignment)                     [existing]
        └── return assignment
```

The existing `rehydrateAssignment` (used by assessment run) is refactored to delegate the core loading to `readRehydrateAssignment`, then adds `_replaceAssignmentInClass` for in-place mutation:

```text
rehydrateAssignment(abClass, assignmentId)  [existing, refactored]
├── validates abClass.classId and assignmentId
├── readRehydrateAssignment(abClass.classId, assignmentId)  [new]
└── _replaceAssignmentInClass(abClass, assignmentId, result)  [existing mutation, sibling step]
```

### Out of scope for this surface

- Changing `loadClass` or its roster-refresh behaviour
- Changing the assessment run's use of `loadClass`
- Adding a `refreshRoster` parameter to `loadClass`
- Changing `readClass` or any other class-read endpoint
- Adding new frontend query keys, schemas, or transport patterns

## Planned data-shape changes

The response shape of `getAssignment` is **unchanged** by this feature — the data contract between the backend and frontend is preserved (see §"Current data-shape constraints"). No new schema, persistence model, API contract field, or transport envelope change is introduced.

The only canonical data-shape document affected is `docs/developer/data-shapes/assignment.md`, and the change is documentation text only (no contract change). The following entry was completed during the docs pass and is now **implemented**.

1. **Entry:** `getAssignment` (read) — `docs/developer/data-shapes/assignment.md`
   - Decision: `update canonical doc text` (no contract change)
   - Owning path: `docs/developer/data-shapes/assignment.md`
   - Fields to update (text only):
     - The aspect-table "Controller" row (currently line ~93): replace `ABClassController.loadClass()` + `ABClassController.rehydrateAssignment()` with `ABClassController.readRehydrateAssignment()` (no `loadClass`).
     - The key-contract note about identity-threading (currently line ~128): delete — the new path does not mutate an `ABClass` instance, so the threading rationale no longer applies.
     - The key-domain-validation entry (currently line ~371): rewrite to state that `ABClassController.readRehydrateAssignment()` performs the full-definition hydration for `getAssignment`; `rehydrateAssignment` continues to perform it for the assessment-run flow.
   - Relevant canonical doc target: `docs/developer/data-shapes/assignment.md`

- Planned doc status: `implemented`
- Note: this entry was completed during the docs pass; all three sub-items in the canonical data-shape doc have been applied.

## Data loading and orchestration

### Required datasets or dependencies

- `DbManager` (already injected into `ABClassAssignmentOps`)
- `AssignmentDefinitionController` (already used by `_ensureFullDefinition`)

### Query or transport additions

No new transport methods. The existing `getAssignment` handler is updated internally.

## Core behavioural model

### `readRehydrateAssignment(courseId, assignmentId)`

1. Validate:
   - `Validate.requireParams({ courseId, assignmentId }, 'readRehydrateAssignment')` — throws `Error` for null/undefined inputs, mirroring the existing `requireParams` usage in `rehydrateAssignment` and `persistAssignmentRun`.
   - `courseId` non-empty string guard — throws `TypeError` with the exact message `readRehydrateAssignment: expected courseId to be a non-empty string`.
   - `assignmentId` non-empty string guard — throws `TypeError` with the exact message `readRehydrateAssignment: expected assignmentId to be a non-empty string`.
     The message format follows the precedent set by `persistAssignmentRun` (`ABClassAssignmentOps.js:60–71`) and by `rehydrateAssignment` (`ABClassAssignmentOps.js:163, 167`): `<methodName>: expected <paramName> to be a non-empty string`. The exact strings above are the contract — implementation must use them verbatim and tests must assert them verbatim (not via substring match).
2. Load the full assignment document from the dedicated collection via `_loadFullAssignmentDocument(courseId, assignmentId)`.
3. Validate the document shape via `_validateAssignmentDocument(document)`.
4. Create an `Assignment` instance via `Assignment.fromJSON(document)`.
5. Resolve the full definition via `_ensureFullDefinition(assignment)`.
6. Set `_hydrationLevel = 'full'` on the assignment.
7. Return the `Assignment` instance.

### `rehydrateAssignment(abClass, assignmentId)` — refactored

1. Validate parameters exactly as before, mirroring `ABClassAssignmentOps.js:160–168`:
   - `Validate.requireParams({ abClass, assignmentId }, 'rehydrateAssignment')` — throws `Error` for null/undefined inputs with the current "is required for rehydrateAssignment" message.
   - `abClass.classId` non-empty string guard — throws `TypeError` with the exact current message `rehydrateAssignment: expected abClass.classId to be a non-empty string` (unchanged; this method's parameter is `abClass`, so its message references `abClass.classId`).
   - `assignmentId` non-empty string guard — throws `TypeError` with the exact current message `rehydrateAssignment: expected assignmentId to be a non-empty string` (unchanged).
     All three guards are retained so the **public error contract of `rehydrateAssignment` itself** remains byte-for-byte identical to the current implementation. This is distinct from `readRehydrateAssignment`'s contract (see above), which uses its own `courseId`-prefixed messages because the parameter name differs; the two methods do not share a `TypeError` message contract.
2. Extract `courseId` from `abClass.classId`.
3. Call `readRehydrateAssignment(courseId, assignmentId)` for the core loading (authoritative validation, load, hydrate). Note: when called from `rehydrateAssignment`, the `readRehydrateAssignment` `TypeError` messages are unreachable because `rehydrateAssignment`'s own guards (step 1) reject invalid `classId`/`assignmentId` first; the only error path that reaches `readRehydrateAssignment` from `rehydrateAssignment` is the load/hydrate path. The retained guards therefore preserve `rehydrateAssignment`'s error contract without `readRehydrateAssignment`'s messages leaking through.
4. Call `_replaceAssignmentInClass(abClass, assignmentId, result)` to mutate the class in-place.
5. Return the assignment.

Behaviour must be identical to the current implementation; this is an internal refactoring that preserves the public contract.

### `getAssignment_` — updated

Replace the current:

```javascript
const abClass = abClassController.loadClass(courseId);
const assignment = abClassController.rehydrateAssignment(abClass, assignmentId);
```

with:

```javascript
const assignment = abClassController.readRehydrateAssignment(courseId, assignmentId);
```

All validation, date conversion, `progressTracker` stripping, and error handling remain unchanged.

## Error, loading, and empty-state rules

**Note:** After this change, `getAssignment_` no longer calls `loadClass`, so it can no longer throw `ClassNotFoundError`. The only not-found semantic is "assignment document missing → `AssignmentNotFoundError` → `null`".

- **Assignment not found:** `null` is returned (existing `AssignmentNotFoundError` handling).
- **Corrupt document or internal loading failure:** errors propagate as before, surfaced to the frontend through the existing error-handling path.
- **Invalid parameters:** `ApiValidationError` thrown as before (transport validation unchanged).

## Backend changes required to support agreed behaviour

1. New method in `ABClassAssignmentOps.js`:
   - `readRehydrateAssignment(courseId, assignmentId)` — loads and hydrates an assignment without needing an ABClass instance
   - Returns an `Assignment` instance
   - Throws `TypeError` for invalid parameters, with the exact messages defined in §"Core behavioural model" §`readRehydrateAssignment` step 1 (`readRehydrateAssignment: expected courseId to be a non-empty string` and `readRehydrateAssignment: expected assignmentId to be a non-empty string`); tests must assert these verbatim
   - Throws `AssignmentNotFoundError` when no document exists

2. New delegation method in `ABClassController/index.js`:
   - `readRehydrateAssignment(courseId, assignmentId)` — thin facade method delegating to `ABClassAssignmentOps.readRehydrateAssignment`
   - Follows the same pattern as the existing `rehydrateAssignment` facade method (`index.js:470–472`): the facade method name matches the sub-class method name

3. Refactoring of existing `rehydrateAssignment` in `ABClassAssignmentOps.js`:
   - Delegate core loading to the new `readRehydrateAssignment`
   - Keep the `_replaceAssignmentInClass` mutation step
   - Preserve identical behaviour and error handling

4. Updated handler in `z_Api/assignmentAssessment.js`:
   - `getAssignment_` calls `abClassController.readRehydrateAssignment(courseId, assignmentId)` instead of `loadClass` + `rehydrateAssignment`
   - Removes the now-unnecessary `ABClassController` dual-usage pattern (loadClass, then rehydrateAssignment on the same instance)
   - All transport-boundary logic (parameter validation, date conversion, `progressTracker` stripping, null-on-not-found) remains unchanged

5. Node test compatibility:
   - New methods must be exported via the guarded `module.exports` block in their respective files for Node/Vitest access
   - Update test imports if paths change (no new files expected)

## Planning handoff notes

- The action plan must sequence the `readRehydrateAssignment` implementation before the `rehydrateAssignment` refactoring and the `getAssignment_` update.
- The `loadClass` method must not be modified.
- All three callers of `loadClass` (`getAssignment_`, `processSelectedAssignment`, `ensureDefinitionFromInputs`) must be verified: `getAssignment_` is changed; the other two (`processSelectedAssignment` at `src/backend/y_controllers/AssignmentController.js:139` and `ensureDefinitionFromInputs` at `src/backend/y_controllers/AssignmentController.js:428`) remain unchanged. The action plan must include an explicit verification step in the regression phase confirming by file inspection that these two call sites still call `loadClass(courseId)`; they are out of scope for behavioural change.
- Backend tests for the new method and the refactored method are required.
- **Existing test update required:** `tests/api/assignmentReadApi.test.js`'s `installABClassControllerStub` helper must gain a `readRehydrateAssignment` spy. Tests 7–11 must be rewritten to assert the new delegation path; test 12 must be removed or converted (its `loadClass`-error premise disappears). This must be included as a dedicated section in the action plan.

## Testing expectations

- Backend unit tests for `readRehydrateAssignment` covering: valid inputs, missing document, corrupt document, parameter validation.
- Backend unit tests confirming the refactored `rehydrateAssignment` behaves identically to the current implementation.
- **Existing API-layer tests must be updated:** `tests/api/assignmentReadApi.test.js`'s shared stub helper `installABClassControllerStub` (lines 41–50) currently exposes only `loadClass` and `rehydrateAssignment` spies. It must gain a `readRehydrateAssignment` spy, and the following tests must be updated:
  - **Test 7:** rewrite the delegation assertion to assert `readRehydrateAssignment(courseId, assignmentId)` instead of `loadClass` + `rehydrateAssignment(abClass, …)`.
  - **Tests 8, 8b, 9, 10, 11:** swap the stub wiring from `loadClass`/`rehydrateAssignment` to `readRehydrateAssignment`; their existing assertions (date normalisation, progressTracker stripping, null-on-not-found, error propagation) remain valid.
  - **Test 12** (`propagates errors from loadClass`, lines 443–464): this test asserts a `loadClass` error path that no longer exists because the handler stops calling `loadClass`. It must be **removed or converted** into a `readRehydrateAssignment` error-propagation assertion.
  - **File header and helper JSDoc comments** in `assignmentReadApi.test.js` currently reference the old `loadClass`/`rehydrateAssignment` delegation and must be updated to reflect `readRehydrateAssignment`.
- API-layer tests confirming `getAssignment_` returns the same response shape with the new delegation path.
- No frontend test changes required (the transport contract is preserved).
- No E2E test changes required.

## Documentation and rollout notes

- Update JSDoc on `getAssignment_` to reflect the new internal flow:
  - **Remove** the `@remarks` paragraph about threading the same `abClass` instance from `loadClass` through to `rehydrateAssignment` — this instance-threading no longer occurs. Leave in place the unrelated `@remarks` bullet about `AssignmentNotFoundError` detection, which remains accurate because `_loadFullAssignmentDocument` (still called transitively by `readRehydrateAssignment`) continues to throw the typed error.
  - **Correct** the `@throws` clause to drop the `loadClass`-failure case (class not found), keeping the corrupt-document and `readRehydrateAssignment`-error cases.
- Add JSDoc on `readRehydrateAssignment` (both the `ABClassAssignmentOps` method and the `ABClassController` facade method) documenting their read-only semantics.
- Update the canonical API contract document `docs/developer/backend/api-layer.md` lines 403–410 so the `getAssignment` entry reflects the new behaviour:
  - **Rewrite the source line** to reference `ABClassController.readRehydrateAssignment()` (no `loadClass`).
  - **Rewrite the handler-behaviour paragraph** to remove the `loadClass` / identity-threading description and the `abClass` parameter; describe the single call to `readRehydrateAssignment(courseId, assignmentId)`.
  - **Correct the date-conversion drift** in the same paragraph: replace the `DateUtils.normaliseDateFields(response, ['dueDate', 'updatedAt', 'createdAt'])` claim with `DateUtils.deepConvertDates(response)`, matching production code and the existing API-layer test assertions (tests 8 and 8b).
  - **Update the Error-codes line**: drop the `INTERNAL_ERROR`-via-`loadClass`/`ClassNotFoundError` enumeration. The post-change `INTERNAL_ERROR` enumeration is scoped to corrupt assignment document, partial-definition rejection, assignment-not-in-class (no longer reachable from `getAssignment_` but retained for `rehydrateAssignment`), or any other `readRehydrateAssignment` failure. The `AssignmentNotFoundError` → `null` case remains.
- Update `tests/api/assignmentReadApi.test.js` file header (lines 1–16) and helper JSDoc (lines 35–39) comments that reference the old `loadClass`/`rehydrateAssignment` delegation. (This test-file documentation update is detailed in the action plan's test-update section.)
- Update `docs/developer/data-shapes/assignment.md` `getAssignment` (read) entry to reflect the new controller path (see §"Planned data-shape changes" for the three text-only updates — Controller row, identity-threading contract note, and key-domain-validation-rules entry). This is a documentation-only change; no transport contract field changes.
- **Shared helper log-wording decision (I1):** `_loadFullAssignmentDocument` currently logs `logger.info('rehydrateAssignment: loading full assignment', …)` (verified at `src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js`). After this feature, this shared private helper is called transitively by both `rehydrateAssignment` and the new `readRehydrateAssignment`. The misleading-prefix wording is **accepted as-is** in scope v1. The two ways to neutralise it were considered and both rejected: (a) **renaming the helper** is rejected because the helper's name is referenced by the existing regression suite (`tests/controllers/abclassController.rehydrateAssignment.test.js`, which asserts against `_loadFullAssignmentDocument`'s name hooks) and by the canonical data-shape contract's File Index (`docs/developer/data-shapes/assignment.md` line 453); renaming would break no production behaviour but would invalidate those name-coupled references, expanding the scope of the feature beyond v1. (b) **Threading a caller-context parameter** into the helper is the only viable option but is larger than v1 warrants, and at odds with AGENTS.md "Keep changes minimal, localised". The string remains descriptive of the helper's own action ("loading the full assignment document"), so the misleading prefix is a stale-but-descriptive log message rather than an incorrect one. The action plan's Section 1 test cases must not assert against the helper's inner log wording, only that `ABLogger.info` was called. This decision is recorded so future reviewers do not raise the stale prefix as a defect without explicit further scope.
- No migration, reset, or rollout dependency.

## V1 scope recommendation

### Include in v1

- `readRehydrateAssignment` implementation in `ABClassAssignmentOps`
- `readRehydrateAssignment` delegation in `ABClassController` facade
- Refactoring of `rehydrateAssignment` to delegate to `readRehydrateAssignment`
- Update `getAssignment_` to use the new read-only path
- Backend tests for the new and refactored methods
- Lint and test verification on all changed files
- Update `docs/developer/backend/api-layer.md` `getAssignment` entry (including reconciling the pre-existing `normaliseDateFields` → `deepConvertDates` drift) and JSDoc per "Documentation and rollout notes"
- Update `docs/developer/data-shapes/assignment.md` `getAssignment` (read) entry per §"Planned data-shape changes"; flip the planned-only entry from `Not implemented` to implemented at docs-pass time

### Defer from v1

- Any other endpoint optimisation
- Removing `loadClass` or changing its contract
- Frontend changes (none needed)

## Open questions

None.
