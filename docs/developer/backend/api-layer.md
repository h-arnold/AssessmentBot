# Backend API Layer (`src/backend/z_Api`)

## Purpose

`src/backend/z_Api` contains the Google Apps Script global transport handlers invoked by the React frontend through `apiHandler`.

This is now the canonical backend transport path for frontend-callable methods. Legacy backend `globals.js` transport files should be treated as migration leftovers or deprecated references only.

This layer is deliberately REST-ish in structure:

- group functions by domain/resource
- keep endpoint-style naming coherent within each file
- use each `.js` file as an API surface for a specific capability area

## Canonical data-shape specifications

All API contracts — request shapes, response envelopes, transport-boundary validation rules, and
persisted data models — are documented in canonical specifications under
`docs/developer/data-shapes/`. These docs are the authoritative contract reference for the
entire codebase.

**Before changing any API method, schema, transport shape, or persistence model, you must:**

1. Read the relevant data-shape specification(s) in `docs/developer/data-shapes/` that cover the
   contract you are changing.
2. Ensure the planned change is accounted for in those docs — either as an existing entry to be
   modified or as a new `Not implemented` planned entry (per the planner workflow in `AGENTS.md`).
3. Update the specification to match the implementation as part of the change.

Do not modify API contracts based on assumptions about what the data-shape docs say. Always verify
against the current specification first.

## Shared Helper Status

- ABClass parameters-object validator
  - Status: `Implemented`
  - Location: `validateParametersObject_()` in `src/backend/z_Api/abclass/abclassValidation.js`
  - Behaviour: shared primitive for the `abclass/` domain folder; validates that the parameters argument is a plain object (not an array). Referenced via `/* global validateParametersObject_ */` from `abclassMutations.js` and `abclassRead.js`.
- ABClass mutation `classId` validator
  - Status: `Implemented`
  - Location: `validateMutationClassId_(classId, methodName)` in `src/backend/z_Api/abclass/abclassMutations.js`
  - Behaviour: shared by the upsert, update and delete transport helpers. It delegates to `validateSafeTrimmedIdentifier_` (`src/backend/z_Api/assignmentDefinition/assignmentDefinitionValidation.js`), so mutations enforce the same identifier boundary as reads: string type, non-emptiness, already-trimmed shape, and rejection of path characters (`/`, `\`, `..`) and control characters, reported as `ApiValidationError`. A code comment marks the reuse as an explicit security defence-in-depth guard.
- ABClass request metadata gate
  - Status: `Implemented`
  - Location: `_validateRequestMetadata(parameters)` in `src/backend/y_controllers/ABClassController/ABClassValidation.js`
  - Behaviour: own-property request gate shared by `ABClassMutationOps.upsertABClass()` and `.updateABClass()`. Delegates all nested rules to the shared `ABClassMetadata` domain validator and tags only failures from that invocation with `inputSource: 'request'`, rethrowing the same error object and `fieldPath`.
- ABClass metadata request-error adapter
  - Status: `Implemented`
  - Location: `adaptMetadataRequestError_(methodName, parameters, operation)` in `src/backend/z_Api/abclass/abclassMutations.js`
  - Behaviour: narrow trailing-underscore transport adapter reused by `upsertABClass_()` and `updateABClass_()` only. It logs the raw thrown value with `method` and `classId` context, converts only an `ABClassMetadataValidationError` whose `inputSource` is exactly `'request'` into an `ApiValidationError` (same path-bearing `message`, `{ method }` option, no new envelope fields), and rethrows every other thrown value with unchanged identity. It does not revalidate metadata or reproduce nested domain rules, and `deleteABClass_()` is unchanged.
- Assignment-definition upsert request validator
  - Status: `Implemented`
  - Location: `validateUpsertParameters_()` in `src/backend/z_Api/assignmentDefinition/assignmentDefinitionUpsertValidation.js`
  - Behaviour: owns request-shape validation, optional update-key safety, and structural `taskWeightings` array validation for `upsertAssignmentDefinition` without duplicating controller business rules.
- Assignment-definition read request validator
  - Status: `Implemented`
  - Location: `validateReadParameters_()` in `src/backend/z_Api/assignmentDefinition/assignmentDefinitionValidation.js`
  - Behaviour: owns safe-key validation for full-definition reads by `definitionKey`.
- Assignment-definition full-definition response mapper
  - Status: `Removed`
  - Location: `toCanonicalTransportDefinition_` in `src/backend/z_Api/assignmentDefinitionTransport.js` (originally in the file that was split and renamed)
  - Note: Replaced by direct use of `controller.toCanonicalFullDefinitionResponse(definition)`.
- Assignment-definition partial row serializer
  - Status: `Removed`
  - Location: `toPlainPartialRow_` in `src/backend/z_Api/assignmentDefinitionTransport.js` (file since split: transport functions moved to `assignmentDefinitionTransport.js`, validation functions to `assignmentDefinitionValidation.js`)
  - Note: Replaced by `toTransportPartialRow_` helper.
- Assignment-definition upsert payload builder
  - Status: `Removed`
  - Location: `buildControllerUpsertPayload_` in `src/backend/z_Api/assignmentDefinitionTransport.js` (file since split)
  - Note: URL-to-ID translation inlined into `upsertAssignmentDefinition_` without `assignmentWeighting` defaulting logic.
- Assignment-definition upsert context builder
  - Status: `Removed`
  - Location: `_buildUpsertContext` in `src/backend/y_controllers/AssignmentDefinition/index.js` (original location before removal; logic inlined into `upsertDefinition` method body)
  - Note: Logic moved into `upsertDefinition` method body.
- Assignment-definition creation method
  - Status: `Removed`
  - Location: `ensureDefinition` in `src/backend/y_controllers/AssignmentDefinition/index.js` (original location before removal; `upsertDefinition` is the sole creation/update method)
  - Note: Removed per architectural decision; `upsertDefinition` is the sole creation/update method.
- AssignmentDefinition yearGroup field
  - Status: `Removed`
  - Location: `yearGroup` parameter and property in `src/backend/Models/AssignmentDefinition.js`
  - Note: Deprecated in favour of `yearGroupKey` only.
- Assignment-definition transport partial row helper
  - Status: `Implemented`
  - Location: `toTransportPartialRow_` in `src/backend/z_Api/assignmentDefinitionTransport.js`
  - Note: Transport-boundary helper that accepts a model instance or plain object, calls `definition.toPartialJSON()`, defensively strips `yearGroup`, and normalises Date fields.

## ABClass metadata helpers

> **Status: implemented — backend contract and companion documentation delivered.** The metadata
> domain owner, its typed domain error, the canonical UTC predicate and ABClass model
> construction/restoration/serialization support are implemented, including the partial-aware
> embedded-assignment projection. The ABClass mutation-owner decomposition, shared save
> validation, prepared whole/partial persistence, field-scoped roster persistence,
> response-mapper reuse, the controller request gate and the transport request-error adaptation
> are also implemented. `upsertABClass` and `updateABClass` accept an optional `metadata` field
> and report request-provenance metadata failures as `INVALID_REQUEST`. The companion deletion
> documentation reconciliation is delivered below; the deletion **code** flag fix remains
> deferred to [issue #332](https://github.com/h-arnold/AssessmentBot/issues/332).
> Cross-references:
> [abclass.md § Validation](../data-shapes/abclass.md#validation) and
> [synthetic-test-data.md § ABClass metadata generator capability](../testing/synthetic-test-data.md#abclass-metadata-generator-capability).

### Metadata domain model — `Models/ABClassMetadata.js` (`Implemented`)

- Dedicated metadata-domain owner holding the five named validation routines:
  `validateAverageScore`, `validateAverageScores`, `validateClassAverages`,
  `validateRecentAssignment` and `validateMetadata`. They live outside `Models/ABClass.js` and
  generic `Validate`; transport helpers must not duplicate the domain implementation.
- The constructor owns the nullable field's `null` default for absence: zero arguments produce
  `null`, while an explicitly supplied value (including explicit `undefined`) is validated and
  then defensively copied. `toJSON()` revalidates the owned value and returns an independent
  plain snapshot or `null`, so no shared mutable alias crosses the ownership boundary.
  Malformed supplied non-null values never become `null` silently.
- The five named validators are static routines. All record-shaped routines share one local
  exact-record/required-own-field/allowed-key check; `validateAverageScore` validates a single
  scalar score and therefore needs no record check. `validateClassAverages` validates its own
  exact five-field record, passes an extracted four-field score record to
  `validateAverageScores`, and validates its timestamp separately.
- Timestamp validation delegates to the canonical UTC predicate below. `recentAssignments`
  must hold zero to three dense entries with unique `assignmentId` values ordered by
  non-increasing `updatedAt`.
- Runtime references to `Validate` and `ABClassMetadataValidationError` resolve only inside
  method bodies, matching the concatenated GAS load model; the file performs no top-level
  dependency evaluation and no Node module wiring beyond its guarded `module.exports` block.
- **Implemented:** `ABClass` owns a plain metadata snapshot or `null`; construction and
  `fromJSON()` distinguish actual own-property absence (normalised through the domain
  constructor) from explicitly supplied values, including invalid own `undefined`.
  `setMetadata(value)` replaces the complete snapshot or clears it with `null`, and validates
  before changing model state.
- **Implemented:** `toJSON()` and `toPartialJSON()` always include metadata, revalidate mutable
  model state and return defensive copies through the domain owner. Missing/deleted model state
  is invalid at serialization, not silently defaulted.
- **Implemented:** response mapping emits validated, nullable `metadata` on registry, full-read
  and mutation-summary responses (see "Response mapper reuse" below).
- **Implemented:** `ABClassValidation._validateRequestMetadata(parameters)` gates request
  metadata through the shared domain validator before any side effect (see "Controller request
  gate" below), and the transport request-error adapter converts the tagged failure into
  `INVALID_REQUEST` (see "Transport error adaptation" below). Persistence preparation is
  delivered (see "Persistence extension" below).

### ABClass partial-aware assignment projection — `Models/ABClass.js` (`Implemented`)

- `ABClass.toJSON()` serialises each embedded assignment through the private
  `ABClass._serialiseAssignmentsForClass()` helper. A partial definition (tasks stored as an
  array) is serialised via the assignment's existing `toPartialJSON()`; a genuinely full
  assignment keeps its existing `toJSON()`. Plain objects and other supported items retain
  `ArrayUtils.serialiseArray()` behaviour.
- `AssignmentDefinition.toJSON()` remains strict and still rejects a partial definition.
  `Assignment.toJSON()` remains strict for current-format and other non-legacy assignments. Its
  only exception is the opaque legacy persistence path, where it re-emits the stored body and,
  when the embedded definition is partial, uses `definition.toPartialJSON()` instead of throwing.
  Serialisation errors from a genuine full assignment propagate unchanged.
- This is the user-approved 17 October 2026 correction recorded in `docs/plans/SPEC.md`. It is
  missing Section 3 model integration delivered in Section 5, not a new frontend feature. No
  second persistence-specific class serializer, automatic hydration or catch-and-fallback is
  added.

### Metadata error type — `Utils/ErrorTypes/ABClassMetadataValidationError.js` (`Implemented`)

- Typed domain error extending `Error` (not `ApiValidationError`), carrying `fieldPath` and
  defaulting to the non-request provenance `inputSource: 'model'`. The rendered message appends
  the field path, so callers receive an actionable location.
- Only the controller's request-validation invocation tags failures with
  `inputSource: 'request'`: `ABClassValidation._validateRequestMetadata()` rethrows the same
  `ABClassMetadataValidationError` (same object and `fieldPath`) after tagging. Model
  restoration, stored-partial validation, serialisation and projection never acquire the
  request tag; the domain layer never throws transport errors.

### Canonical-UTC predicate — `Utils/Validate.js` (`Implemented`)

- `Validate.isCanonicalUtcDateTime(value)` enforces the exact canonical UTC real-calendar form
  `YYYY-MM-DDTHH:mm:ss.sssZ`, rejecting live `Date` objects, date-only strings, timezone
  offsets and non-canonical precision. The metadata domain validator reuses it. See
  [abclass.md § Validation](../data-shapes/abclass.md#validation).
- Distinguish it from the unchanged, broader `isIsoDateTimeString_` in
  `z_Api/assignmentDefinition/assignmentDefinitionPartialRowValidation.js`, which accepts
  timezone offsets and is owned by the transport layer. Model-domain validation must not depend
  on that helper; leave it and its broader contract unchanged.

### Controller request gate (`Implemented`)

- `ABClassValidation._validateRequestMetadata(parameters)` is the request gate. It runs before
  any record read, roster refresh or write. An `Object.hasOwn` check means actual omission does
  nothing; an explicitly supplied `metadata` value (including own `undefined`) is passed to the
  shared domain validator `ABClassMetadata.validateMetadata(parameters.metadata, 'metadata')`.
  Only a caught `ABClassMetadataValidationError` from that invocation is tagged
  `inputSource: 'request'` and rethrown unchanged (same object, same `fieldPath`); every other
  exception propagates untouched. The gate lives on the existing `ABClassValidation` owner and is
  reused by both mutation methods; the nested domain rules stay in the domain validator and are
  not reimplemented here.
- `ABClassMutationOps.upsertABClass()` and `.updateABClass()` invoke the gate immediately after
  their legacy `Validate.requireParams` checks and before collection access, reads, roster
  refresh or writes, so invalid request metadata fails before any side effect or partial patch
  application.
- `abclassMutations.js` passes the original `parameters` object to the controller without
  copying or restructuring it, so a valid `metadata` request reaches and persists through the
  controller. The wrappers' only added behaviour is the request-error adaptation below; they add
  no nested domain rules.

### Transport error adaptation (`Implemented`)

- `adaptMetadataRequestError_(methodName, parameters, operation)` in `abclassMutations.js` is the
  narrow trailing-underscore adapter shared by `upsertABClass_()` and `updateABClass_()` only. It
  wraps the controller delegation and logs the raw thrown value through `ABLogger` with `method`
  and `classId` context, then converts only an `ABClassMetadataValidationError` whose
  `inputSource` is exactly `'request'` into an `ApiValidationError` built from the unchanged
  path-bearing `message` and the `{ method }` option. No `fieldName`, `details` or other envelope
  field is added; the `INVALID_REQUEST` envelope code comes from the existing dispatcher mapping.
- Every other thrown value — model-typed metadata errors, same-message but untagged errors,
  request-tagged generic or wrong-typed errors, and persistence, upstream and wiring failures — is
  rethrown with unchanged identity and type, so stored/user-data integrity failures keep returning
  `INTERNAL_ERROR`.
- The adapter does not revalidate metadata or reproduce nested domain rules, and `deleteABClass_()`
  is unchanged.
- No dispatcher, allowlist, authorisation, request-tracking or envelope-shape change is required
  or authorised; the transport layer never evaluates nested domain rules.

### Response mapper reuse (`Implemented`)

- `ABClassResponseMapper._normaliseClassPartial()` is the single stored-partial metadata gate.
  Actual own-property absence routes through `new ABClassMetadata()` to `null`; a present value is
  validated and defensively copied through the shared domain owner, so an invalid stored value
  raises a typed `ABClassMetadataValidationError` integrity failure rather than dropping the row,
  repairing it or fetching another representation. `_buildClassSummary()` reuses this same gate
  for mutation summaries, so no duplicate metadata pass is added in `getAllClassPartials()`.
- `_toReadView()` projects validated, detached `metadata` from mutable model state while
  retaining its existing assignment projection/redaction. Definition-key replacement is
  fail-fast: a missing embedded `assignmentDefinition`, or a `definitionKey` that is missing,
  non-string or empty, raises a `TypeError` instead of projecting `null` or omitting
  `assignmentDefinitionKey`, preserving the required-string response contract.
- Metadata carries canonical timestamp strings only, so no extra `DateUtils.deepConvertDates()`
  conversion is needed for the partial-list or mutation-summary responses. The existing full-read
  `DateUtils.deepConvertDates()` call for the other ABClass fields is retained.
- Request metadata acceptance and its request-provenance error adaptation are both delivered
  (see "Controller request gate" and "Transport error adaptation" above).

### Controller decomposition — `ABClassMutationOps.js` (`Implemented`)

- `ABClassMutationOps` owns the facade's upsert, update and delete orchestration. The
  no-argument `ABClassController` facade constructs it with one options object containing
  `{ dbManager, validation, persistence, roster, responseMapper }` and delegates without
  changing the existing method signatures, results or errors.
- `ABClassValidation._validateClassForSave(abClass)` owns the existing `saveClass` argument
  checks. Both facade `saveClass` and mutation-owner upsert use this shared validation; upsert
  then calls the injected persistence owner directly, without a callback through the facade.
  The facade retains its persistence delegator and `true` return value.
- Both mutations call `ABClassValidation._validateRequestMetadata(parameters)` immediately
  after their legacy required-parameter checks (see "Controller request gate" above). Upsert
  applies metadata only when the request owns the property, through the existing model setter
  `abClass.setMetadata(parameters.metadata)`; actual omission preserves the restored value (or
  the new-class constructor-`null` default). Update selects metadata through the existing
  `ABClassValidation._buildUpdatePatch(parameters)` (which copies the own `metadata` value into
  the patch) and applies it in `_applyPatchToClass()` via `abClass.setMetadata(...)`, so a mixed
  invalid patch still applies none of its fields.
- `ABClassMutationOps.updateABClass()` prepares the complete partial projection through
  `ABClassPersistence._prepareClassPartial()` before its selective full-store `$set`, then
  persists the prepared partial through `_writePreparedClassPartial()`. Its selective `$set`
  includes the supplied `metadata` as the detached model snapshot (never the caller object) and
  otherwise gains no unrelated fields; the selective editable path may leave full-store metadata
  absence while rebuilding the partial with `null`. Upsert keeps its whole-class
  `persistClassAndPartial()` path.
- The facade retains its public-method JSDoc and GAS sub-class load order. This decomposition
  adds no deletion-flag correction; request-metadata handling (Section 7) and prepared-write
  behaviour/field-scoped roster persistence are delivered separately (see "Controller request
  gate" and "Persistence extension" below).
- The conditional `ABClassPersistence.readClassPartials()` extraction is **not required**:
  the resulting facade is within the binding 500-line ceiling, so registry retrieval and
  error logging remain in `getAllClassPartials()`.

### Persistence extension — `ABClassPersistence` (`Implemented`)

- `persistClassAndPartial(abClass)` prepares independent full and partial payloads through
  `_prepareClassAndPartial()` **before** the first full-store mutation, then writes the full
  document first and the prepared partial afterwards. Retained direct method signatures and the
  full-first/partial-second order are unchanged.
- `_prepareClassAndPartial()` copies the model's full JSON (or the supported plain-object input)
  without mutating the caller, normalises the caller's metadata through the domain constructor,
  and validates any present projection metadata. `_prepareClassPartial()` builds the complete
  partial projection; `_metadataCopy()`, `_validateFullProjection()` and
  `_validatePreparedMetadata()` own the defensive copy and consistency checks. A legacy plain
  projection may omit the field; only the prepared copies gain `metadata`, with independent
  nested ownership.
- `_upsertClassPartial()` and `_writePreparedClassPartial(classId, partialData)` persist a
  prepared partial without re-projecting the model.
- Field-scoped roster persistence is implemented in `_prepareRosterPartial(existingPartial,
abClass)` and `_writePreparedRosterPartial(prepared, classId)`. `ABClassRoster._persistRoster()`
  remains the roster orchestrator: it performs the permitted existence lookup, prepares the
  operation, writes the full-store roster `$set`, and then calls the write helper.
- An existing row is patched with `$set` only `className`, `classOwner` (owner helper) and
  `teachers` (array helper), filtered by the row's stored `_id`. The vendor's `matchedCount` is
  checked: an `_id`-only filter counts a matched-but-unmodified row, so a true zero-match patch
  fails without retry, classId-query or upsert fallback. A missing row inserts a complete
  validated partial with independent metadata. The existing partial row's metadata and unrelated
  fields are never used, validated, copied or rewritten.
- The prepared full class document uses the partial-aware `ABClass.toJSON()` projection above, so
  it carries its actual non-empty partial/full assignment population alongside validated
  metadata. A true partial-save or patch failure keeps the existing logged propagation and
  non-transactional partial-success risk; no rollback or retry is added.
- See [abclass.md § Field-scoped roster persistence](../data-shapes/abclass.md#field-scoped-roster-persistence-delivered).

### Companion deletion-documentation reconciliation (`Implemented`)

- This page's `deleteABClass` idempotency note now matches the factual correction recorded in
  `docs/developer/data-shapes/abclass.md`: repeated deletes succeed, a missing registry row
  yields `hasDeletedClassPartial: false`, and the full-collection flag is currently true after
  any non-throwing `dropCollection()`, so it does not prove the collection was removed.
- That flag is true even when the vendor returns `false` for an absent collection. The
  recognised `COLLECTION_NOT_FOUND` exception guard is **not** the vendor's normal absent path
  (which returns `false` rather than throwing): every non-throwing delete currently sets the
  full flag true, and only that exception path leaves it false. No deletion code was changed.
- The full-collection flag fix remains deferred to
  [issue #332](https://github.com/h-arnold/AssessmentBot/issues/332).

## Design Rules

1. Keep API functions as thin as possible.
2. Delegate business logic to the appropriate controller class by default.
3. Only keep logic in API functions when delegation would create unnecessary verbosity with no architectural benefit.
4. Validate transport inputs and fail fast; do not hide backend wiring errors. See "Validation ownership rules" below for which layer owns which checks.
5. Keep allowlisted method names stable once used by frontend callers.

## Non-callable transport helpers (trailing-underscore private pattern)

`apiHandler` is the sole frontend-callable GAS entry point for all active `z_Api` methods.
Closures registered in `ALLOWLISTED_METHOD_HANDLERS` are not individually reachable via
`google.script.run` and need no special wrapper to prevent that.

For **trivial handlers** (a single controller delegation with no private helpers), inline the call
as an anonymous closure directly in `ALLOWLISTED_METHOD_HANDLERS`:

```js
getABClassPartials: () => new ABClassController().getAllClassPartials(),
```

For **non-trivial handlers** (requiring validation helpers, multi-step logic, or data transformation),
define trailing-underscore helper functions in the relevant `z_Api` file and call them from a thin
closure in `ALLOWLISTED_METHOD_HANDLERS`:

```js
// In googleClassrooms.js — GAS will NOT expose getGoogleClassrooms_ to google.script.run
function getGoogleClassrooms_(parameters) { … }
```

```js
// In z_apiHandler.js ALLOWLISTED_METHOD_HANDLERS
getGoogleClassrooms: (parameters) => getGoogleClassrooms_(parameters),
```

The official Apps Script specification excludes functions whose names end with an underscore from
the callable surface exposed to `google.script.run`. This makes the trailing underscore the preferred,
sufficient pattern for non-callable transport helpers — no IIFE or namespace-object wrapper is
required.

Internal helper functions within a `z_Api` file that are not themselves transport-entry functions
(e.g. `validateParametersObject_`, `throwValidationError_`, `adaptMetadataRequestError_`) also use
the trailing underscore for consistency and to prevent accidental GAS-global exposure.

The guarded `module.exports` block at the end of each file exports the trailing-underscore handler
functions so that Node unit tests can access them:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getGoogleClassrooms_ };
}
```

This pattern is currently used by `getGoogleClassrooms_`, `getGoogleClassroomAssignments_`,
`getAssignmentDefinitionPartials_`, `deleteAssignmentDefinition_`, `upsertAssignmentDefinition_`,
`getAssignmentDefinition_`, `getAssignment_`, `startAssessmentRun_`, `getBackendConfig_`, `setBackendConfig_`,
`upsertABClass_`, `updateABClass_`, `deleteABClass_`, and `getABClass_`.

## Validation ownership rules

Transport-boundary validation (shape of the incoming request, type of envelope fields, path-safety
of untrusted string identifiers, foreign-API response shape) belongs in the API layer — specifically
in the trailing-underscore helper functions of the relevant `z_Api` file.

Domain invariants (business rules about what constitutes a valid entity, required field completeness,
value range constraints) belong in the called controller, class, or manager.

Rules:

1. **Transport validation lives in API-layer trailing-underscore helpers.** Checks that guard the transport
   surface — such as `params` being a plain object, path-character safety on string identifiers, or
   shape validation of an external API response — are the responsibility of the `z_Api` helper.
2. **Domain invariants live in the controller.** Non-empty string checks, integer range checks,
   required-field completeness, and other business rules are owned by the controller that receives
   the call. Do not reimplement them in the transport layer.
3. **Do not duplicate the same rule in both layers** unless it is an explicit security
   defence-in-depth guard — in which case mark it as such in a code comment so it is not removed
   during future de-sloppification passes.
4. **All new functionality must follow this rule** from the point of introduction.
5. **Old functionality should be opportunistically refactored** towards this rule when the code is
   already being touched. Keep the scope of opportunistic refactoring local and low-risk; do not
   expand a focused change into a broad validation audit.

### Assignment-definition upsert validation split (`upsertAssignmentDefinition`)

Status: `Implemented`

`upsertAssignmentDefinition` now uses a transport validator in `src/backend/z_Api/assignmentDefinition/assignmentDefinitionUpsertValidation.js` that owns only transport-boundary checks, while `AssignmentDefinitionController.upsertDefinition()` owns the domain contract.

Transport helper ownership:

- require `params` to be a plain object
- require transport-presence of `primaryTitle`, `primaryTopicKey`, `referenceDocumentId`, and `templateDocumentId`
- accept `definitionKey` as absent/`null` for create and as an already-trimmed safe string for update
- validate the structural shape of `taskWeightings` when supplied (`Array` entries with transport-safe `taskId` and required `taskWeighting` fields)
- reject malformed container types, unsafe identifier strings, and control-character payloads before controller delegation

Controller ownership:

- reject blank `primaryTitle`, unknown `primaryTopicKey`, invalid `yearGroupKey`, identical source documents, unknown update targets, duplicate business-identity tuples, and invalid task-weighting references
- require `documentType` on create, reuse the stored `documentType` on update when omitted, generate a stable opaque `definitionKey` on create, and preserve the stored key on update
- resolve `primaryTopic` from authoritative assignment-topic reference data rather than treating copied topic strings as the source of truth
- parse or refresh tasks, apply assignment/task weighting values, and manage rollback when registry persistence fails after the full-store write

The transport layer does not derive or rotate `definitionKey` from metadata.

## Relationship to `globals.js`

Legacy backend `globals.js` files are reference-only during migration and are not the authority for new or migrated frontend transport methods.

- `src/backend/AssignmentProcessor/globals.js`
- `src/backend/y_controllers/globals.js`

Configuration transport no longer uses `src/backend/ConfigurationManager/99_globals.js`; that legacy transport file has been removed. Backend configuration reads and writes now go through `src/backend/z_Api/z_apiHandler.js`, with callable method names owned by `ALLOWLISTED_METHOD_HANDLERS` in that file and the implementation living in `src/backend/z_Api/apiConfig.js`.

Migration rule:

- when an equivalent function is implemented in `src/backend/z_Api`, remove the legacy `globals.js` variant.
- do not add new functionality to legacy `globals.js` files.

## Testing Guidance

- Test ownership for this layer is defined in [Backend Testing §6.1 API Layer Tests](backend-testing.md#61-api-layer-tests-srcbackendz_api): API-layer functions are thin boundary wrappers, and heavy business-logic tests stay at controller/service level.
- Do not call live GAS services in unit tests.

## API handler transport (`apiHandler`)

`src/backend/z_Api/z_apiHandler.js` is the canonical transport entrypoint used by frontend `callApi` requests.

### Request contract

`apiHandler` accepts a request object with:

- `method` (string, required): allowlisted method name intended for `ALLOWLISTED_METHOD_HANDLERS`
- `params` (optional): method-specific payload

If the payload is invalid, `apiHandler` returns an `INVALID_REQUEST` envelope and does not throw.

### Response envelope

All responses use the stable [transport envelope](../data-shapes/transport-envelope.md).

**`data` coercion contract:** `_success()` in `z_apiHandler.js` wraps handler return data with `data: data ?? null`, so `undefined` values (including implicit returns from void handlers) become `null`. The frontend transport layer (`apiService.ts`) therefore always receives `data: null` for void backend methods, never a missing `data` key.

### Dispatch and allowlist pattern

`ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js` is the single authoritative registry for all
frontend-callable methods. A method is reachable from the frontend if and only if it has an entry
in this object.

To add a new frontend-callable API method:

1. Add one entry to `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`, either by
   inlining a trivial controller delegation as an anonymous closure or by delegating to a
   trailing-underscore private helper in the relevant `z_Api` file.

Keep business logic in controllers or services; keep the handler closure thin.

### Runtime wiring and the Node test bootstrap

`z_apiHandler.js` is GAS runtime code. It reads its dependencies as concatenated-script globals: the
`apiConstants` values (`LOCK_TIMEOUT_MS`, `LOCK_WAIT_WARN_THRESHOLD_MS`, `ACTIVE_LIMIT`,
`STALE_REQUEST_AGE_MS`), the request-store helpers (for example `loadStore_`, `saveStore_`,
`createStartedRecord_`), the trailing-underscore transport handlers (for example `getBackendConfig_`,
`startAssessmentRun_`, `upsertABClass_`, `getABClass_`), and the error types (`ApiRateLimitError`,
`ApiValidationError`, `ApiDisabledError`, `DefinitionStaleError`). The production file performs no
Node module wiring: it contains no `require(...)` and no `globalThis.* = ...` assignments. Its only
Node-specific code is the guarded `module.exports` block at the end of the file.

Node unit tests mirror that GAS layout through `tests/setupGlobals.js`, which installs the same
constants, request-store helpers, transport handlers, and error types before the dispatcher module
loads. Keep this dependency wiring in the test bootstrap; do not reintroduce `require`/`globalThis`
wiring in production backend files. The `ALLOWLISTED_METHOD_HANDLERS` registry, the auth gate, and
the admission/completion tracking are unchanged by this boundary.

### Admission control and tracking

`apiHandler` applies per-user admission control before invoking allowlisted handlers:

- acquires `LockService.getUserLock()` with bounded timeout
- prunes stale `started` records
- enforces `ACTIVE_LIMIT`
- records started/success/error lifecycle entries in `UserProperties`

Tracking data is compacted to maintain bounded storage (`MAX_TRACKED_REQUESTS`) and is metadata-only.

### Error mapping

Error types are mapped to transport error codes by `_mapErrorToFailureEnvelope`; the canonical type→code table, including the `INTERNAL_ERROR` fallback for unmapped or malformed errors, is in [transport-envelope.md § Error code mapping](../data-shapes/transport-envelope.md#error-code-mapping).

`IN_USE` is raised when `ReferenceDataController` cannot delete a cohort, year group, or assignment topic because persisted records still reference it.

### Failure diagnostics and transport privacy

When an allowlisted handler throws, `apiHandler` preserves developer diagnostics in Google Apps Script execution logs while keeping the frontend transport envelope stable:

- emits one boundary `ABLogger.error(...)` entry with `requestId`, allowlisted `method`, and the original thrown value
- writes that boundary log before completion tracking updates the request store
- keeps downstream `ABLogger` activity from the failing handler visible; the transport boundary does not suppress those logs
- still returns the same frontend-safe envelope shape, including generic `INTERNAL_ERROR` responses for unmapped failures

This separation is intentional: execution logs remain the place for developer investigation, while the frontend transport contract avoids exposing stack traces or raw exception payloads to callers.

Request-store persistence stays compact. Failed entries record a stringified failure summary for lifecycle tracking, not the full thrown payload.

### Frontend usage pattern

Frontend code should call `callApi` from `src/frontend/src/services/apiService.ts`, not `google.script.run` directly.
Feature services should expose typed helpers per method and return parsed `data` from `callApi`.
Use the allowlisted method names exactly as implemented in `ALLOWLISTED_METHOD_HANDLERS`, for example `callApi('getGoogleClassrooms')`.

### ⚠️ Critical: prohibited types in `google.script.run` return values

`google.script.run` prohibits `Date`, `Function`, and DOM elements in both **parameters and
return values** — including inside nested objects and arrays. If any value in the response graph
is a live `Date` object (not an ISO string), GAS falls back to `Object.toString()` serialisation,
producing non-JSON output (Java `HashMap.toString()` format with `=` separators instead of `:`)
that breaks `JSON.parse()` and causes the frontend to receive `null`.

Reference: https://developers.google.com/apps-script/guides/html/reference/run
(myFunction section: prohibited types in parameters; return value note confirms same restrictions.)

**Backend rules:**

1. Convert live `Date` objects to ISO 8601 strings at the API boundary before the response
   reaches `apiHandler` / `ALLOWLISTED_METHOD_HANDLERS`. Two utilities are available in
   `DateUtils` (at `src/backend/Utils/DateUtils.js`):
   - `DateUtils.normaliseDateFields(response, ['field1', 'field2'])` — for shallow or known
     date fields. Mutates the object in-place. Use this when the date fields are at a known
     depth and you can enumerate them.
   - `DateUtils.deepConvertDates(value)` — recursively converts all `Date` objects in a
     structure to ISO strings, returning a new structure. Use this when the response contains
     deeply nested date objects (e.g. assignments with nested submissions and artifacts) where
     enumerating every field is impractical. Apply this in the specific handler rather than
     in `apiHandler` to avoid the performance cost on endpoints that do not need it.
2. Never return `Function` instances or DOM element references.
3. Ensure all array/object fields are plain JS arrays/objects, not Java-backed types that GAS
   cannot serialise (e.g. `[Ljava.lang.Object;@...` references from Drive API wrappers).
4. Test return values by inspecting `typeof` and `.constructor.name` at the transport boundary
   when diagnosing unexpected `null` responses.

### Current migrated endpoints

- `getBackendConfig` and `setBackendConfig` — canonical backend configuration transport methods.
  Source: inline closures in `src/backend/z_Api/z_apiHandler.js` delegating to `getBackendConfig_()` and `setBackendConfig_()` in `src/backend/z_Api/apiConfig.js`.
  Frontend wrapper: `src/frontend/src/services/backendConfiguration/backendConfigurationService.ts`, with request and response validation in `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`.
  Legacy note: configuration transport no longer uses `src/backend/ConfigurationManager/99_globals.js`.
  Ownership note: first-time default seeding now belongs to `ConfigurationManager.ensureDefaultConfiguration()`. `getBackendConfig()` remains a thin transport read that delegates bootstrap to the manager before shaping the public payload.

- `getBackendConfig` read data returns the public configuration payload with exactly the 12 non-auth stable fields: `backendAssessorBatchSize`, masked `apiKey`, `hasApiKey`, `backendUrl`, `revokeAuthTriggerSet`, `daysUntilAuthRevoke`, `slidesFetchBatchSize`, `jsonDbMasterIndexKey`, `jsonDbLockTimeoutMs`, `jsonDbLogLevel`, `jsonDbBackupOnInitialise`, and `jsonDbRootFolderId`. It does **not** emit `authGroupEmail` or `authMode`; auth state is read exclusively through the dedicated auth endpoints (`getApplicationAccess` / `getAuthenticationSettings`).
  Masking contract: the raw stored secret never crosses the transport boundary; the masked shapes are defined in [BackendConfig § Transport](../data-shapes/backend-config.md#transport).
  Bootstrap contract: when the persisted configuration store is completely empty, `ConfigurationManager` seeds the defaultable backend settings on first read before the payload is returned. `apiKey`, `backendUrl`, and `jsonDbRootFolderId` remain unseeded when absent.
  Response normalisation: `jsonDbRootFolderId` is returned as `''` when the stored value is blank or unset. `hasApiKey` reflects whether a raw key was present before masking.

- `setBackendConfig` accepts a partial write payload of ordinary (non-auth) fields only; only supplied fields are written.
  Writable patch fields: `backendAssessorBatchSize`, `apiKey`, `backendUrl`, `revokeAuthTriggerSet`, `daysUntilAuthRevoke`, `slidesFetchBatchSize`, `jsonDbMasterIndexKey`, `jsonDbLockTimeoutMs`, `jsonDbLogLevel`, `jsonDbBackupOnInitialise`, and `jsonDbRootFolderId`.
  Auth-field rejection: `setBackendConfig` rejects `authMode`, `authGroupEmail`, `authUsers`, and `authRevision` as a single `INVALID_REQUEST` request-shape violation for every caller, including admins — see the [BackendConfig contract](../data-shapes/backend-config.md#setbackendconfig-write).
  Ordinary-field write path: every supplied ordinary field whose value is not `undefined` is validated/normalised through `ConfigurationManager.preparePropertyValue()` and staged, then the whole patch is committed through a single `writeConfigurationLocked` call (fresh re-read, merge, one write). The existing aggregate redaction behaviour for ordinary-field failures is preserved — secrets are never echoed in the `error` string.
  Validation contract: `params` must be an object; malformed payloads are reported by the transport as `INVALID_REQUEST`.
  Save-result contract: `{ success: true } | { success: false, error: string }`.

- Dedicated transport tests for backend configuration live in `tests/api/backendConfigApi.test.js`.
  Keep broader dispatcher coverage in `tests/api/apiHandler/` (directory with multiple dispatcher test files).

- `hasScriptAuthorisation` — returns current script authorisation status.
  Source: inline closure in `src/backend/z_Api/z_apiHandler.js` delegating to `new ScriptAppManager().isAuthorised()`.
  Do not call `google.script.run.hasScriptAuthorisation` from frontend feature or service modules.

- `getABClassPartials` — returns all class partial documents from the `abclass_partials` registry.
  Source: inline closure in `src/backend/z_Api/z_apiHandler.js` delegating to `new ABClassController().getAllClassPartials()`.
  Frontend wrapper: `src/frontend/src/services/googleClassrooms/classPartialsService.ts` (`getABClassPartials()`).
  Handler behaviour: instantiates `ABClassController` inside the inline closure at call time.
  The controller normalises stored records before returning them, so transport consumers receive only the documented class-partial fields and not storage-only fields such as `_id`. Normalised rows include always-present nullable `metadata`, validated and detached from storage (see §Response mapper reuse).
  The frontend service models `classOwner` and `teachers` as explicit `TeacherSummary` objects (`userId`, `email`, `teacherName`).
  See `docs/developer/data-shapes/abclass.md` (§ABClassPartials) for the class partial shape and persistence strategy.

- `getABClass` — reads a stored class document and returns a transport-ready plain object with partial assignments (no Classroom API calls, no storage mutation).
  Source: `src/backend/z_Api/abclass/abclassRead.js`, via the `getABClass_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `ABClassController.readClass()` in `src/backend/y_controllers/ABClassController/index.js`.
  Required request field: `classId`.
  Validation: the helper validates `parameters` is a plain object via the shared `validateParametersObject_` primitive. `classId` must be a non-empty, already-trimmed string without path characters (`/`, `\`, `..`) or ASCII control characters (code points 0–31 and 127). Invalid payloads are reported as `INVALID_REQUEST` by the transport.
  Handler behaviour: calls `new ABClassController().readClass(classId)`. Returns the controller's shaped response (produced by the private `_toReadView` method) on success. Catches `ClassNotFoundError` explicitly and returns `null`. Re-throws all other errors.
  Response shape is produced by `ABClassController._toReadView()` — see `docs/developer/data-shapes/abclass.md` (§ABClass full-read) for the full shape. It includes always-present nullable `metadata` (validated, detached from model state); an absent class still returns top-level `null`.
  Definition-key integrity: `_toReadView()` throws a `TypeError` when an embedded assignment has no `assignmentDefinition`, or its `definitionKey` is missing, non-string or empty, rather than emitting `null` or omitting `assignmentDefinitionKey`. The read view therefore keeps the required-string `assignmentDefinitionKey` contract, and the dispatcher reports the failure as `INTERNAL_ERROR` without exposing the raw exception.
  Frontend wrapper: `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts` (`getABClass()`), with response validation in `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`.
  Query factory: `getABClassQueryOptions(classId)` in `src/frontend/src/query/sharedQueries.ts` (not included in startup warmup — per-class query).

- `getAssignmentDefinitionPartials` — returns assignment-definition registry rows for the Assignments page without loading task artifacts.
  Source: `src/backend/z_Api/assignmentDefinitionTransport.js`, via the `getAssignmentDefinitionPartials_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `AssignmentDefinitionController.getAllPartialDefinitions()` in `src/backend/y_controllers/AssignmentDefinition/index.js`.
  Response data: `Array<{ primaryTitle, primaryTopic, primaryTopicKey, yearGroupKey, yearGroupLabel, alternateTitles, alternateTopics, documentType, referenceDocumentId, templateDocumentId, assignmentWeighting, definitionKey, tasks: Array<{ taskId, taskWeighting, taskTitle }>, createdAt: string | null, updatedAt: string | null }>` inside the standard success envelope.
  Registry contract: rows come from the lightweight `assignment_definitions` collection and carry a `tasks` array of lightweight summaries (empty when the definition has no tasks); `primaryTopicKey` is authoritative, `primaryTopic` is the resolved label, and `referenceLastModified` / `templateLastModified` are not part of the partial transport shape.
  Validation: the helper calls `validatePartialRow_()` for every row and rejects malformed rows with `ApiValidationError` when any of the 15 required partial fields is missing, `definitionKey` or `primaryTopicKey` are blank or untrimmed, `yearGroupKey` / `yearGroupLabel` are blank or untrimmed, `createdAt` / `updatedAt` are neither `null` nor strict ISO datetime strings with timezone information, or `tasks` is not an array.
  Frontend wrapper: `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsService.ts` (`getAssignmentDefinitionPartials()`), with payload validation in `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.ts`.

- `getGoogleClassroomAssignments` — fetches Google Classroom coursework/assignments for a given class and normalises to transport format.
  Source: `src/backend/z_Api/googleClassroomAssignments.js`, via the `getGoogleClassroomAssignments_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `ClassroomApiClient.fetchCourseWork()` in `src/backend/GoogleClassroom/ClassroomApiClient.js`.
  Required request field: `classId`.
  Validation: `classId` must be a non-empty, already-trimmed string without path characters (`/`, `\`, `..`) or ASCII control characters (code points 0–31 and 127). Invalid payloads are reported as `INVALID_REQUEST` by the transport. Malformed Classroom API response rows are reported as `ApiValidationError`.
  Handler behaviour: calls `ClassroomApiClient.fetchCourseWork(classId)`, maps each course-work item to `{ assignmentId, title, creationTime, topicId, topicName }`. Topic names are resolved via a separate `ClassroomApiClient.fetchTopicName(classId, topicId)` call; when no topic is assigned, both `topicId` and `topicName` are `null`. `creationTime` is normalised to a string at the transport boundary.
  Frontend wrapper: `src/frontend/src/services/googleClassrooms/googleClassroomAssignmentsService.ts` (`getGoogleClassroomAssignments()`), with response validation in `src/frontend/src/services/googleClassrooms/googleClassroomAssignmentsService.spec.ts`.

- `deleteAssignmentDefinition` — deletes one assignment definition from both the registry and its dedicated full-definition collection.
  Source: `src/backend/z_Api/assignmentDefinitionTransport.js`, via the `deleteAssignmentDefinition_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `AssignmentDefinitionController.deleteDefinitionByKey()` in `src/backend/y_controllers/AssignmentDefinition/index.js`.
  Required request field: `definitionKey`.
  Validation: `definitionKey` must be a non-empty, already-trimmed string and must not contain `/`, `\`, `..`, or ASCII control characters. Invalid payloads are reported as `INVALID_REQUEST` by the transport.
  Delete behaviour: removes the partial row from `assignment_definitions` and drops the corresponding `assdef_full_<definitionKey>` collection when present. Missing full collections are treated as already deleted, so repeated safe-key deletes remain idempotent.
  Response data: no data payload (`void`) on success.
  Frontend wrapper: `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsService.ts` (`deleteAssignmentDefinition()`).

- `upsertAssignmentDefinition` — creates or updates a full assignment definition and synchronised registry partial.
  Source: `src/backend/z_Api/assignmentDefinitionTransport.js`, via the `upsertAssignmentDefinition_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `AssignmentDefinitionController.upsertDefinition()` in `src/backend/y_controllers/AssignmentDefinition/index.js`.
  Transport-required request fields: `primaryTitle`, `primaryTopicKey`, `referenceDocumentId`, `templateDocumentId`, and `yearGroupKey`.
  Optional request fields: `definitionKey`, `alternateTitles`, `alternateTopics`, `documentType`, `assignmentWeighting`, `taskWeightings`, `forceReparse`, and `updatedAt`.
  Validation split: the transport helper enforces request shape, recovery control-field shapes (`forceReparse` boolean; `updatedAt` a strict ISO datetime string with timezone when supplied non-null, while omission and explicit `null` mean no stale-baseline check), safe-identifier rules for `definitionKey`, `taskWeightings[].taskId`, `referenceDocumentId`, `templateDocumentId`, and URL-extracted document IDs, and structural `taskWeightings` shape; the controller owns topic membership, duplicate-tuple rejection, numeric weighting rules, document-type rules, task-ID matching, and persistence semantics.
  Request-side concurrency token: `updatedAt` carries the reviewed definition's response `updatedAt` from the latest load/reparse, and the frontend sends it only when that value is non-null. A non-null mismatch with the stored `updatedAt` returns `DEFINITION_STALE` before any writes; omission or explicit `null` means no stale-baseline check. This request token is distinct from the persisted/response `AssignmentDefinition.updatedAt` field, which is unchanged.
  Frontend validation split: the frontend Zod `UpsertAssignmentDefinitionRequestSchema` enforces a `superRefine` mutual-exclusion rule between the URL-shape (`referenceDocumentUrl` + `templateDocumentUrl`) and the ID-shape (`referenceDocumentId` + `templateDocumentId` + `documentType`). Payloads with neither shape, only partial URL fields, or only partial ID fields are rejected before the payload reaches the backend. The wizard's existing URL-shape payload continues to pass without modification; the link-to-existing-definition flow uses the ID-shape payload.
  Create behaviour: when `definitionKey` is absent or `null`, the controller requires `yearGroupKey` and `documentType` (or derives it from URLs when URL-based transport is used), parses tasks from the source documents, resolves `primaryTopic` from `assignment_topics`, generates a stable opaque `definitionKey`, and writes both the full store (`assdef_full_<definitionKey>`) and the registry partial (`assignment_definitions`). This is the stage-one create persistence path.
  Update behaviour: when `definitionKey` is present, the controller preserves the stored key, reuses the stored `documentType` when omitted, reparses only when source document IDs changed or refresh is required, and reapplies stored or supplied task weightings before persistence. Re-parse transport behaviour applies when document URLs change: existing task weightings are preserved for matching task IDs, and new tasks default to `1`.
  Final-save persistence behaviour: metadata and weighting edits are persisted through the same `upsertAssignmentDefinition` transport, with duplicate detection enforced on tuple-changing saves using the normalised `(primaryTitle, primaryTopicKey, yearGroupKey)` business identity.
  Response data: the canonical full-definition response shape, including resolved `primaryTopic`, stable `definitionKey`, full `tasks` array, `yearGroupKey`, `yearGroupLabel`, `referenceDocumentId`, `templateDocumentId`, `documentType`, `assignmentWeighting`, `createdAt`, and `updatedAt`. This same response shape is returned for stage-one create, final save, and document-change re-parse so the frontend can keep one editable entity model.

- `getAssignmentDefinition` — reads one full assignment definition by key.
  Source: `src/backend/z_Api/assignmentDefinitionTransport.js`, via the `getAssignmentDefinition_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `AssignmentDefinitionController.getDefinitionByKey()` in `src/backend/y_controllers/AssignmentDefinition/index.js`.
  Required request field: `definitionKey` (non-empty, already-trimmed string with path-character safety enforced at transport boundary).
  Validation: transport enforces `params` object shape, `definitionKey` presence, and safe-key contract using `validateReadParameters_()`; controller performs lookup and returns the stored full definition.
  Response data: the canonical full-definition response shape, identical to `upsertAssignmentDefinition` response, including resolved `primaryTopic`, `primaryTopicKey`, `yearGroupKey`, `yearGroupLabel`, full `tasks` array, and all metadata; or `null` when the definition key is not found. This ensures `upsertAssignmentDefinition` and `getAssignmentDefinition` share the same canonical editable entity contract.

- `startAssessmentRun` — starts an assessment run for an existing assignment definition.
  Source: `src/backend/z_Api/assignmentAssessment.js`, via the `startAssessmentRun_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `AssignmentController.startAssessmentRun()` in `src/backend/y_controllers/AssignmentController.js`.
  Required request fields: `definitionKey`, `assignmentId`, `courseId` (all non-empty strings).
  Validation: transport enforces `params` object shape, required field presence, and non-empty string checks using `Validate.requireParams` and `Validate.validateNonEmptyString`; controller owns per-document freshness checks via `DateUtils.isNewer`, definition lookup, and ABClass resolution.
  Controller behaviour: fetches the full definition by key, checks that neither the reference nor template document has been modified since the definition was created (throwing `DefinitionStaleError` if stale), resolves the ABClass via `loadClass(courseId)` (which throws if the class does not exist), and delegates to `startProcessing()` to create the time-based trigger with context stored in `UserProperties` via `GASPropertiesUtils`.
  Response data: `null` on success (no data payload; wrapped in standard success envelope).
  Error codes: `DEFINITION_STALE` (non-retriable, with `details` block), `INVALID_REQUEST` (transport validation failure), `INTERNAL_ERROR` (definition not found, ABClass not found, or other domain errors).

- `getAssignment` — reads a single fully-hydrated assignment by course and assignment id.
  Source: `src/backend/z_Api/assignmentAssessment.js`, via the `getAssignment_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `ABClassController.readRehydrateAssignment()` in `src/backend/y_controllers/ABClassController/index.js`.
  Required request fields: `courseId` and `assignmentId` (both non-empty, already-trimmed strings with no path/control characters).
  Validation: transport enforces `params` object shape, `courseId` and `assignmentId` presence, non-empty trimmed string, and path-character/control-character safety (using `validateSafeTrimmedIdentifier_`, which internally uses `hasControlCharacters_`, from `assignmentDefinition/assignmentDefinitionValidation.js`); the controller's `readRehydrateAssignment` method owns assignment-existence validation and throws `AssignmentNotFoundError` when no document exists.
  Handler behaviour: calls `new ABClassController().readRehydrateAssignment(courseId, assignmentId)` for a read-only load and hydration (no roster refresh, no `loadClass`, no ABClass mutation), including full-definition resolution, then serialises via `assignment.toReadJSON()`. It defensively strips `progressTracker` at the boundary and applies `DateUtils.deepConvertDates(response)` to recursively convert all `Date` objects to ISO 8601 strings (required because `google.script.run` prohibits `Date` objects in return values). On `AssignmentNotFoundError` thrown by `readRehydrateAssignment`, returns `null` (caught via `instanceof` check); all other errors from `readRehydrateAssignment` propagate.
  Logging: `info` before loading the full assignment document (`"getAssignment: loading full assignment"` with `{ courseId, assignmentId }`), `info` after successful hydration (`"getAssignment: rehydrated assignment"`), `warn` for not-found (`"getAssignment: assignment not found"` — `warn`, not `error`, because the API returns `null` gracefully), `error` for other failures (`"getAssignment failed"` with `{ courseId, assignmentId, err }`).
  Response data: the complete `Assignment.toReadJSON()` shape — `courseId`, `assignmentId`, `assignmentName`, `dueDate` (ISO string or `null`), `updatedAt` (ISO string or `null`), `documentType`, `referenceDocumentId`, `templateDocumentId`, `tasks`, `submissions` (full artifacts, assessments, feedback), `assignmentDefinition`, and `assessmentContractVersion`. Current results keep `assessmentContractVersion: 1`; a stored legacy record is projected to detached all-criteria `REASSESSMENT_REQUIRED` submissions with `assessmentContractVersion: null`, while persistence `toJSON()`/`toPartialJSON()` still emit the opaque stored body unchanged. See [Contract: Assignment §`getAssignment` (read)](../data-shapes/assignment.md#getassignment-read). Or `null` when no persisted assignment document exists.
  Error codes: `INVALID_REQUEST` (transport validation failure: non-object params, missing fields, unsafe characters). `INTERNAL_ERROR` (corrupt assignment document, partial-definition rejection, or any other `readRehydrateAssignment` failure). No new error code is introduced for not-found — the handler returns `null` for that case (catching the `AssignmentNotFoundError` typed error before it can reach the dispatcher's error envelope).

- `getGoogleClassrooms` — returns active Classroom picker rows for ABClass creation flows.
  Source: `src/backend/z_Api/googleClassrooms.js`, via the `getGoogleClassrooms_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`.
  Handler behaviour: calls `ClassroomApiClient.fetchAllActiveClassrooms()`, which pages through active Classroom courses, then maps each row to `{ classId, className }`.
  Response data: `Array<{ classId: string, className: string }>`.
  Contract boundary: the payload intentionally omits `teachers`, `students`, `classOwner`, and `enrollmentCode`.
  Validation: malformed Classroom rows raise `ApiValidationError`, so the transport envelope returns `INVALID_REQUEST`.
  Failure nuance: upstream Classroom fetch failures currently log inside `ClassroomApiClient.fetchAllActiveClassrooms()` and return `[]`, so not every upstream Classroom failure becomes a transport error envelope today.

- `upsertABClass` — creates a new ABClass or refreshes an existing one using Classroom data plus user-supplied metadata.
  Source: `src/backend/z_Api/abclassMutations.js`, via the `upsertABClass_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `ABClassController.upsertABClass()` in `src/backend/y_controllers/ABClassController/index.js`.
  Required request fields: `classId`, `cohortKey`, `yearGroupKey`, `courseLength`.
  Optional request field: `metadata` — omission preserves an existing snapshot (or initialises a new class to `null`), explicit `null` clears it, and a complete object replaces it wholly (no nested patch). Supplied metadata is validated before any collection access, roster refresh or write.
  Validation: transport enforces `params` as an object and validates `classId` through the shared `validateSafeTrimmedIdentifier_` helper, rejecting non-string, empty, untrimmed, path-character (`..`, `/`, `\`) and control-character values before delegation — the same identifier boundary used by reads. The reuse is an explicit security defence-in-depth guard, marked in a code comment. Controller validation owns required-field completeness, its own `classId` checks, `courseLength` integer/range checks, and the metadata request gate (see §Controller request gate).
  Write-path behaviour: hydrates `className`, `classOwner`, `teachers`, and `students` from Google Classroom. When the class already exists, the controller refreshes the roster and preserves existing `assignments` and any omitted metadata. A corrupt stored snapshot fails before any write; a valid replacement or `null` does not repair it.
  Response data: the partial class summary returned by `ABClass.toPartialJSON()`, not the full class document. `students` and `assignments` are not returned. The summary includes always-present nullable, validated, detached `metadata`.
  Error mapping: invalid request metadata raises a typed `ABClassMetadataValidationError` with `inputSource: 'request'`, which the `abclassMutations.js` request-error adapter converts into an `ApiValidationError`; the dispatcher therefore returns `INVALID_REQUEST`/`isRetriable: false` with the path-bearing message and no extra error fields. Stored/user-data integrity failures keep the generic `INTERNAL_ERROR` envelope.

- `updateABClass` — applies a lightweight patch to editable ABClass fields.
  Source: `src/backend/z_Api/abclassMutations.js`, via the `updateABClass_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `ABClassController.updateABClass()` in `src/backend/y_controllers/ABClassController/index.js`.
  Required request field: `classId`.
  Optional patch fields: `cohortKey`, `yearGroupKey`, `courseLength`, `active`, `metadata`. For `cohortKey` and `yearGroupKey`, omission preserves the stored value, `null` clears it, and a valid value replaces it; an explicitly supplied `undefined` is rejected as a domain `TypeError` before any write instead of being persisted as the string `"undefined"`. `metadata` is a whole-value replacement: omission preserves it, `null` clears it, and a complete object replaces it; nested partial objects are invalid, not patches.
  Forbidden request fields: `classOwner`, `teachers`, `students`, `assignments`.
  Validation: transport enforces `params` as an object, validates `classId` through the shared `validateSafeTrimmedIdentifier_` helper (rejecting non-string, empty, untrimmed, path-character and control-character values before delegation), blocks forbidden fields, and requires `active` to be boolean or `null` when supplied. The `classId` check reuses the read-path identifier boundary as an explicit security defence-in-depth guard, marked in a code comment. Controller validation owns its own `classId` checks, `courseLength` integer/range checks, the `cohortKey`/`yearGroupKey` explicit-`undefined` rejection, and the metadata request gate, which runs before any patch field is applied (see §Controller request gate).
  Existing-class behaviour: updates only the supplied patch fields, persists the partial registry row, and does not mutate the excluded fields. A supplied `metadata` is applied through the model setter; its detached snapshot is written to the selective full-store `$set` and the rebuilt partial. A rejected patch — including an explicitly `undefined` `cohortKey` or `yearGroupKey` — applies none of its fields and performs no write.
  Missing-class behaviour: throws `RangeError`; `updateABClass` is not an upsert path.
  Response data: the same partial class summary shape used by `upsertABClass()`, including always-present nullable, validated, detached `metadata`. Invalid request metadata follows the same `INVALID_REQUEST` mapping as `upsertABClass`; internal integrity failures stay `INTERNAL_ERROR`.

- `deleteABClass` — deletes the stored class record and its class-partial registry row.
  Source: `src/backend/z_Api/abclassMutations.js`, via the `deleteABClass_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `ABClassController.deleteABClass()` in `src/backend/y_controllers/ABClassController/index.js`.
  Required request field: `classId`.
  Validation: transport enforces `params` as an object and validates `classId` through the shared `validateSafeTrimmedIdentifier_` helper, rejecting non-string, empty, untrimmed, path-character (`..`, `/`, `\`) and control-character values before delegation. This matches the read-path identifier boundary; the overlap with the controller's own missing, non-string, and non-empty `classId` checks is an explicit security defence-in-depth guard, marked in a code comment.
  Controller behaviour: deletes the full-class collection with `dropCollection(classId)` and removes the matching `abclass_partials` row with `deleteOne({ classId })`.
  Response data: `{ classId, hasDeletedFullClass, hasDeletedClassPartial }`.
  Idempotency: repeated deletes succeed. A missing registry row yields `hasDeletedClassPartial: false`. The full-collection flag is currently true after any non-throwing `dropCollection()`, including the vendor's `false` return for an absent collection, so it does not prove the collection was removed; it stays false only on the recognised `COLLECTION_NOT_FOUND` exception path, which the vendor's normal absent result does not take. This quirk is documented, not fixed: the flag correction is deferred to [issue #332](https://github.com/h-arnold/AssessmentBot/issues/332).

- Cohort reference data — exposes `getCohorts`, `createCohort`, `updateCohort`, and `deleteCohort`.
  Source: inline closures in `src/backend/z_Api/z_apiHandler.js` delegating to `ReferenceDataController` CRUD helpers backed by the `cohorts` JsonDbApp collection.
  Frontend wrapper: `src/frontend/src/services/referenceData/referenceDataService.ts` (`getCohorts()`, `createCohort()`, `updateCohort()`, `deleteCohort()`).
  List, create, and update responses return plain `{ key, name, active, startYear, startMonth }` objects with storage metadata such as `_id` stripped at the controller boundary. Updates use `{ key, record }`, and duplicate detection is based on `record.name.trim().toLowerCase()` while preserving submitted display casing.
  Delete requests are key-based and succeed with no `data` payload.

- Year-group reference data — exposes `getYearGroups`, `createYearGroup`, `updateYearGroup`, and `deleteYearGroup`.
  Source: inline closures in `src/backend/z_Api/z_apiHandler.js` delegating to `ReferenceDataController` CRUD helpers backed by the `year_groups` JsonDbApp collection.
  Frontend wrapper: `src/frontend/src/services/referenceData/referenceDataService.ts` (`getYearGroups()`, `createYearGroup()`, `updateYearGroup()`, `deleteYearGroup()`).
  List, create, and update responses return plain `{ key, name }` objects with storage metadata removed. Updates use `{ key, record }`, and duplicate detection is based on `record.name.trim().toLowerCase()` while preserving submitted display casing.
  Delete requests are key-based and succeed with no `data` payload.

- Assignment-topic reference data — exposes `getAssignmentTopics`, `createAssignmentTopic`, `updateAssignmentTopic`, and `deleteAssignmentTopic`.
  Source: inline closures in `src/backend/z_Api/z_apiHandler.js` delegating to `ReferenceDataController` CRUD helpers backed by the `assignment_topics` JsonDbApp collection.
  List, create, and update responses return plain `{ key, name }` objects with storage metadata removed. Updates use `{ key, record }`, and duplicate detection is based on `record.name.trim().toLowerCase()` while preserving submitted display casing.
  Delete requests are key-based and succeed with no `data` payload when unused.
  Delete-blocked contract: when one or more assignment definitions still reference the topic via `assignment_definitions.primaryTopicKey`, `ReferenceDataController` throws a plain error with `reason === 'IN_USE'`, and `apiHandler` maps that to the standard `{ ok: false, error: { code: 'IN_USE', ... } }` envelope.
