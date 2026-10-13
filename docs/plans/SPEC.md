# ABClass Metadata Contract Support Specification

## Status

Specification for independent planning sign-off. Backend contract support only; no production implementation has started. Canonical planned-only entries are recorded and marked `Not implemented` in the documentation listed below.

## Purpose

Store compact assessment summaries in both the full ABClass document and its lightweight partial registry. Future reporting consumers can obtain these summaries without loading the full class or its assignment collections.

This cycle provides model, validation, persistence, existing API and canonical synthetic-fixture support. It does **not** calculate averages or refresh metadata after assessments.

## Agreed product decisions

1. The field is named `metadata`, is optional on write requests, and is nullable as a whole.
2. Both full and partial class representations expose the same metadata shape. There is no separate backend `ABClassPartials` JavaScript model: `ABClass.toPartialJSON()` owns that representation.
3. Non-null metadata requires complete `classAverages` and a `recentAssignments` array containing zero to three complete entries.
4. The required metric names are `completeness`, `accuracy`, `spag` and `overall`. `overall` retains the existing weighted scoring meaning, not a separate arithmetic mean.
5. Every metric is a finite number in the inclusive range 0–5, or exactly `N`, `E` or `excluded`. These markers remain distinct; no marker is converted to zero.
6. Recent entries represent distinct Google Classroom assignments, identified by `assignmentId`. Entries may share an `assignmentDefinitionKey` because definitions are reusable.
7. All timestamps use the existing lower-camel-case name `updatedAt`. No `lastAssessedAt` or `UpdatedAt` field is introduced.
8. The recent-entry timestamp represents its source Assignment's existing `updatedAt`. Assignment's current assessment flow calls `touchUpdated()` after assessment and before persistence; it remains formally a modification timestamp.
9. The existing `upsertABClass` and `updateABClass` APIs accept metadata. Omission preserves an existing value, explicit null clears it, and a complete object replaces it. Nested patching is unsupported.
10. Legacy full/partial records with no metadata read as null. Responses always emit `metadata`. Reads do not eagerly backfill either store.
11. This cycle is backend-only, including its test infrastructure. Frontend reporting, service/schema changes and layout work are excluded.
12. The roster-only persistence path (`loadClass` / `_persistRoster`) keeps its existing refresh responsibilities but patches only the fields it owns in each store. Its update of an existing partial registry row must not rebuild or replace that row, use or copy its metadata value, or overwrite metadata with a snapshot from a previously loaded class. A lookup to determine whether the row exists is permitted. Whole-class saves following roster refresh, including upsert, retain complete partial writes from the same loaded class record.

## Existing system constraints

- `apiHandler` remains the sole frontend transport entrypoint. Endpoint names, authorisation, request tracking and envelope structure remain unchanged.
- Full ABClass documents live in collections named by `classId`; the list registry is `abclass_partials`.
- The model, full-read mapper and partial mapper each currently enumerate their fields explicitly. All must support metadata; adding a model property alone is insufficient.
- `fromJSON()` currently bypasses the constructor. New metadata normalisation must respect the rule that defaults originate in constructors, without broad changes to unrelated legacy fields.
- Full class persistence precedes partial-registry persistence. These stores are not transactional; existing failure propagation and write order must remain explicit.
- Currently, roster and editable-field patches regenerate a complete partial registry row. This cycle changes the roster path to a field-scoped partial patch; general editable-field writes still regenerate their normal complete partial summary.
- `getABClassPartials` reads only the registry. Metadata must not introduce full-class reads, assignment hydration, definition lookups or upstream API calls on this path.
- GAS runtime code remains plain JavaScript and may not import synthetic generator code or Node dependencies.
- Synthetic fixtures are deterministic, test-only data. Their full/partial transport views must carry raw metadata independently of frontend schemas, which currently strip this new field.

## Data contract

The following is contract notation, not a backend TypeScript requirement:

```ts
type AverageScore = number | 'N' | 'E' | 'excluded';

type AverageScores = {
  completeness: AverageScore;
  accuracy: AverageScore;
  spag: AverageScore;
  overall: AverageScore;
};

type ClassAverages = AverageScores & { updatedAt: string };

type RecentAssignment = {
  assignmentId: string;
  assignmentDefinitionKey: string;
  averages: AverageScores;
  updatedAt: string;
};

type ABClassMetadata = {
  classAverages: ClassAverages;
  recentAssignments: RecentAssignment[];
} | null;
```

Example, using the existing 40/40/20 weighting solely to illustrate values:

```json
{
  "metadata": {
    "classAverages": {
      "completeness": 4.2,
      "accuracy": 3.8,
      "spag": 4.0,
      "overall": 4.0,
      "updatedAt": "2026-10-12T10:30:00.000Z"
    },
    "recentAssignments": [
      {
        "assignmentId": "classroom-assignment-123",
        "assignmentDefinitionKey": "definition-key-1",
        "averages": {
          "completeness": 4.0,
          "accuracy": 3.5,
          "spag": "N",
          "overall": 3.75
        },
        "updatedAt": "2026-10-12T10:25:00.000Z"
      }
    ]
  }
}
```

### Presence and strictness

- Every listed property of a non-null metadata object is required and is an own property.
- Only the top-level `metadata` value may be null. Neither a metric, `classAverages`, an entry, `averages`, an identifier nor a timestamp may be null.
- Nested objects must be ordinary data records, not arrays, Dates or class instances. Objects with `Object.prototype` or a null prototype are accepted; values requiring coercion are not.
- Unexpected own fields in metadata or its nested objects are rejected, including misspellings and `lastAssessedAt`. This does not introduce an unrelated blanket unknown-key rule for existing ABClass requests.
- The recent array is dense: sparse slots, undefined entries and incomplete entries are invalid.
- Metadata supplied as an own request property with value `undefined` is invalid. Only actual omission invokes preserve/new-class-null behaviour.
- The dedicated metadata-domain constructor owns the nullable field's null default. ABClass construction, restoration and legacy partial projection explicitly route absent metadata through that constructor-owned normalisation; the existing `Object.create` restoration path does not inherit constructor defaults automatically. Present metadata values are validated at these same boundaries, not defaulted or accepted unchecked. Do not add a separate restoration-only default. Malformed supplied non-null values never become null silently.

### Score semantics

- Numeric zero and fractions are valid. No coercion, truncation, rounding or percentage conversion is performed.
- `N` denotes not attempted/not applicable; `E` denotes no usable result; `excluded` denotes assessed evidence that made no contribution to the average.
- These are compact supplied-snapshot values, not the existing frontend `MetricResult` union. In particular, the frontend represents exclusion as `state: 'excluded'` with `value: null`; this contract instead stores the literal string `excluded`. Future consumers must explicitly map between the representations.
- Each field is validated independently. This cycle does not derive `overall`, inspect weightings or infer cross-metric relationships.

### Timestamps and ordering

- A metadata timestamp must be an exact canonical UTC ISO datetime in the form `YYYY-MM-DDTHH:mm:ss.sssZ`, with a real calendar date and valid time components. Live Dates, date-only strings, timezone offsets, non-canonical precision and counter-suffixed submission timestamps are rejected.
- `classAverages.updatedAt` records when that supplied class summary was updated.
- `recentAssignments[].updatedAt` is supplied as the corresponding Assignment timestamp, not independently generated by the API.
- Entries must be ordered by non-increasing `updatedAt`. Equal timestamps are valid and retain caller-supplied order; no additional tie-break or sorting is imposed.
- `assignmentId` is unique within the list. `assignmentDefinitionKey` need not be unique.
- Both identifiers are non-empty strings already trimmed. Identifiers are opaque; no numeric coercion, UUID-only or fixed-length restriction is added.
- There is no enforced relationship between the class-summary timestamp and the entry timestamps.

## Validation and ownership

One shared domain implementation defines these routines:

| Routine | Required behaviour |
| --- | --- |
| `validateAverageScore(value, context)` | Enforce the exact finite 0–5 / `N` / `E` / `excluded` union. |
| `validateAverageScores(scores, context)` | Require all four own metric fields and validate each; reject unexpected fields. |
| `validateClassAverages(value, context)` | Require exactly the four scores plus valid `updatedAt`; reuse score validation without rejecting the permitted timestamp. |
| `validateRecentAssignment(value, context)` | Require exactly both identifiers, complete `averages` and valid `updatedAt`. |
| `validateMetadata(value, context)` | Accept null, otherwise enforce complete shape, dense zero-to-three array, unique assignment IDs and newest-first ordering. |

- `validateClassAverages` checks its own exact five-field record, passes an extracted four-field score record to `validateAverageScores`, and validates its timestamp separately. All metadata routines reuse one local domain record/required-field/allowed-key check rather than duplicating those checks per shape.
- Reuse `Validate` primitives where suitable. The dedicated model-domain owner is `src/backend/Models/ABClassMetadata.js`, shared by the ABClass model, controllers and response mappers. Keep its five routines out of the existing ABClass model and generic `Validate`; do not duplicate the domain implementation in transport helpers.
- Put the new generic canonical-UTC timestamp predicate `isCanonicalUtcDateTime(value)` in `src/backend/Utils/Validate.js` and reuse it from the domain validator. Record its planned-only entry, owner and exact contract in the validation section of `docs/developer/data-shapes/abclass.md`, marked `Not implemented`. The existing `isIsoDateTimeString_` in `z_Api/assignmentDefinition/assignmentDefinitionPartialRowValidation.js` is not the target contract: it accepts timezone offsets and is owned by the later transport layer, which model-domain validation must not depend on. Leave that existing helper and its broader contract unchanged; record this distinction and cross-reference the new predicate in the planned `api-layer.md` helper entry.
- Constructors/restoration, explicit metadata replacement, metadata-bearing serialisation, whole-object writes and response mapping use the same authoritative rules. Mutable metadata must not bypass validation at those boundaries. A field-scoped roster patch of an existing partial is not a metadata-bearing write and must not use, validate, copy or rewrite the stored metadata value; the existence lookup required by the missing-partial path is unaffected.
- Supplied request metadata is fully validated before the first mutation side effect, including roster refresh or any database write.
- API-layer helpers own request structure and error-envelope adaptation. They must not reproduce the nested domain rules.
- Invalid caller-supplied metadata returns the existing `INVALID_REQUEST` envelope, with an actionable field path included in `error.message`. No new `fieldName`, `details` payload or other envelope-shape change is authorised. Invalid persisted/model metadata is an internal integrity failure and returns the existing `INTERNAL_ERROR` treatment, not `INVALID_REQUEST`.
- Concretely, `ABClassValidation._validateRequestMetadata(parameters)` invokes the shared domain validator for explicitly supplied metadata at the start of each controller mutation, before any record read/roster refresh/write. The domain validator reports failures through `ABClassMetadataValidationError`, owned by `src/backend/Utils/ErrorTypes/ABClassMetadataValidationError.js`, with a field path and default non-request provenance. Only failures of that controller request-validation invocation are tagged with `inputSource: 'request'`; model restoration, stored partial validation, serialisation and projection do not acquire that tag. Mutation transport helpers translate only this error type with request provenance into `ApiValidationError`; all other exceptions propagate unchanged. The domain layer never throws transport errors, the transport layer never evaluates nested domain rules, and no exception to the canonical validation-ownership policy or dispatcher change is needed.
- Exceptions from persistence, upstream services and internal wiring are not caught and reclassified as caller validation errors.
- Validation must not repair metadata, silently remove entries, reorder it, calculate scores, stamp dates or fetch referenced entities.
- This is structural contract validation. The API does not verify identifier existence, class membership, equality to a stored Assignment timestamp, mathematical consistency or that the entries are the actual three most recently assessed assignments. Supplied snapshot accuracy remains the writer's responsibility.
- Neither the model nor outputs should retain shared mutable aliases that let caller/request/returned-object mutation change another representation. Preserve values by defensive copying at ownership boundaries.
- Invalid stored metadata fails restoration even when the request supplies a valid replacement or null. This cycle does not introduce an API repair path that bypasses stored-data integrity checks.

## API behaviour

### `getABClassPartials`

Return `metadata` on every row, including explicit null for legacy absence. Preserve the registry-only read path and existing empty-list behaviour. Invalid stored metadata fails the request; do not drop the row or fall back to a full-class fetch.

`ABClassResponseMapper._normaliseClassPartial()` is the single stored-partial
metadata normalisation/validation gate: it routes legacy absence through the
metadata-domain constructor and rejects present invalid metadata as an integrity
failure. Its existing reuse by `_buildClassSummary()` covers mutation summaries;
do not add a duplicate metadata pass in `getAllClassPartials()`.

Metadata contains timestamp strings only. It requires no additional `DateUtils` conversion in partial-list or mutation-summary responses; preserve the existing full-read date-conversion behaviour for its other fields.

### `getABClass`

Return metadata in the full read view using the same shape and validation. An absent class still returns top-level null, distinct from an existing class with `metadata: null`. Preserve existing assignment redaction and definition-key projection.

### `upsertABClass`

Existing required fields and roster-refresh behaviour remain unchanged.

| Request metadata | New class | Existing class |
| --- | --- | --- |
| Omitted | Initialise null | Preserve existing metadata |
| Null | Store null | Clear metadata |
| Complete valid object | Store supplied snapshot | Replace entire metadata value |
| Invalid / own undefined | Reject before side effects | Reject before side effects |

The returned partial summary contains metadata. Existing assignment and active-state preservation rules remain unchanged.

### `updateABClass`

Metadata is an additional optional editable field. Omission preserves it; null clears it; a complete object replaces it. Partial nested objects are invalid, not patches. A rejected mixed patch must not apply any of its other fields. No roster refresh is introduced.

The returned partial summary contains metadata. Existing missing-class and protected-field behaviour remains unchanged.

### `deleteABClass`

The existing deletion flags and removal of both stores remain unchanged. No metadata field is added to this response and no metadata-specific endpoint is introduced.

## Persistence and lifecycle behaviour

- Full/partial serialisation carries identical metadata values. Successful class metadata writes update both stores.
- Ordinary upserts, editable-field updates, roster refreshes and assignment persistence preserve an existing snapshot unless metadata is explicitly replaced or cleared.
- Assessment runs do not calculate, refresh or clear metadata. A previously supplied snapshot may therefore become stale. The contract does not claim otherwise.
- A no-metadata legacy record is projected as null without read-time writes. Whole-class saves include the field; a selective editable-field patch may leave absence in the full document while rebuilding the partial with null. A field-scoped roster patch leaves existing metadata absence unchanged in both stores. Absence and null remain semantically equivalent until the next explicit metadata/whole-class write.
- Existing full-first/partial-second write ordering and failure propagation remain. Do not add transaction emulation, rollback, automatic retry or a backfill job.
- On metadata-bearing/whole-class writes, validate metadata and prepare the partial projection before the first full-store mutation so invalid metadata cannot cause an avoidable split-store write. For a roster patch with a missing partial, prepare its new partial before the first full-store mutation; an existing partial needs no metadata projection. Actual I/O failures retain the existing partial-success risk.

### Field-scoped roster persistence

The existing roster refresh continues to fetch and update the class name, owner, teachers and students. It is not narrowed to students-only behaviour.

| Store | Existing document update |
| --- | --- |
| Full class collection | `$set` only `className`, `classOwner`, `teachers` and `students`, as today. |
| `abclass_partials` registry | `$set` only `className`, `classOwner` and `teachers`. Never include `students`, `assignments`, `metadata`, `cohortKey`, `yearGroupKey`, `courseLength` or `active` in this roster patch. |

- Registry patch values must match the serialised forms produced by `ABClass.toPartialJSON()`: serialise `classOwner` through the existing owner helper and each teacher through the existing array-serialisation helper, retaining the class-name/null representation. Build only these roster fields; do not call the complete metadata-bearing partial projection just to obtain them. The full-store roster payload retains its existing forms and behaviour.
- Use the existing class identity to locate each record. Save the full collection before saving the partial registry, preserving write order and logged failure propagation.
- An existing partial keeps its own metadata exactly as stored, including null or field absence. Do not replace it with the loaded full class's metadata, even if the two values differ. Other unrelated fields also remain unchanged.
- If the partial row is missing, insert a complete normal partial from the already loaded ABClass, including validated metadata/null. Do not create a roster-only fragment or silently lose class configuration. This is normal write-through creation, not a general repair or backfill mechanism.
- Identify whether creation is needed and validate/prepare the creation payload before writing the full store. If an existing-row patch unexpectedly cannot match its row, fail rather than silently completing with an unsynchronised roster; no retry or concurrent-write recovery mechanism is introduced.
- Existing roster-only patches may no longer call the whole-row partial upsert path. Whole-class saves and explicit metadata writes retain that path and its identical full/partial metadata contract.
- Direct controller operations used by the facade retain their signatures. Do not introduce a separate public roster API or change upsert/read workflows beyond this persistence boundary.

## Synthetic fixture capability and policy

Extend `scripts/synthetic-test-data/` and its existing profiles/views. No new production data source, frontend adapter or competing realistic fixture system is authorised.

- Populate logical persistence class records after assignments are generated, then project identical metadata into `transport.classPartials` and `transport.classesById`.
- Across committed `small`, `medium` and `large-representative` samples, cover null metadata; zero, one, two and three recent entries; numeric/fractional scores; complete four-metric collections with all four fields set to `N`, all four set to `E`, or all four set to `excluded`; and mixed numeric/marker collections.
- Non-null samples always include complete class averages. Recent identifiers/definition keys refer to real generated assignments of that class, and timestamps exactly match their generated `updatedAt`.
- Scores are deliberately generated supplied snapshots for contract testing, not evidence of a newly implemented backend averaging engine. Examples use coherent synthetic values but are not asserted to recompute from every generated submission.
- Select coverage cases deterministically by profile and class/assignment indices, using fixed synthetic score templates/index arithmetic. Derive timestamps from the existing generated assignment timestamps, never the current clock. This avoids consuming or changing the existing Faker sequence.
- Preserve existing seeds, entity counts, assignment timestamp conventions and byte reproducibility. Do not use the current clock or consume the existing Faker stream for metadata values.
- Cover all supported profiles, including an on-demand large-full graph, through the same stage; do not commit full-stress output.
- Independently validate metadata in raw generated views using the backend domain validator in tests and generator-owned contract/integrity checks. Existing frontend parse success is not sufficient because its schemas strip metadata.
- Regenerate affected committed views via the existing CLI, never hand-edit JSON.
- New/changed tests requiring realistic class, roster, assignment, definition or metadata data use canonical generated data wherever supported. Migrate touched existing suites opportunistically, without a wholesale migration of untouched tests.
- Invalid, legacy-missing, boundary and narrowly targeted probes remain local, normally as clones of canonical data. Retain local external-service mocks; the corpus does not simulate Classroom, authentication or database failures.
- Equal-timestamp ordering acceptance is a local boundary probe cloned from canonical metadata: generated source assignments have distinct timestamps, and their canonical exact-timestamp linkage must not be weakened to manufacture that case.
- Test-only adaptation from transport assignments to backend persistence/model inputs must resolve the matching canonical definition and preserve IDs, timestamps and redaction/hydration semantics. Do not pass frontend assignment partials directly to backend `Assignment.fromJSON()`.

## Testing expectations

- Red-first coverage for each validator, all allowed values, missing/unknown keys, null placement, strict timestamps, duplicate assignment IDs, repeated definition keys, order, equal timestamps, oversized/sparse arrays and mutable alias isolation.
- Model/full/partial restoration, legacy absence, round trips and validation on serialisation.
- Real controller and transport tests for omitted/null/replacement metadata, no-side-effect rejection, preservation through unrelated patches/roster/assignment writes, unchanged not-found/deletion semantics and identical full/partial outputs.
- Roster-specific tests assert exact `$set` payloads for both stores; no existing-row replacement or metadata copying; unchanged unrelated fields; preservation of registry metadata even when different from the loaded class; correct missing-partial creation; no writes when its creation payload is invalid; and full-first ordering/error propagation on save failures. Corrupt persisted metadata remains an integrity failure even when a request supplies a valid replacement.
- Real dispatcher coverage for metadata in successful read/write envelopes, caller validation errors versus stored integrity failures, unchanged auth/tracking and JSON-safe values.
- Synthetic raw-view shape, relational linkage, exact source timestamps, cross-view parity, variant coverage, deterministic generation and committed-fixture regeneration tests.
- Existing frontend synthetic consumers continue to work with extra metadata fields; no frontend source or test changes are planned.

## Documentation and rollout

- Record the target contract under `docs/developer/data-shapes/abclass.md` as `Not implemented` before implementation; preserve existing implemented contracts until reconciliation.
- Record planned metadata-domain/error/transport helper decisions in `docs/developer/backend/api-layer.md`; test-side canonical adaptation/helper decisions in `docs/developer/backend/backend-testing.md`; and generator-stage/projection/integrity-helper decisions in `docs/developer/testing/synthetic-test-data.md`. Mark these planned-only entries `Not implemented` before implementation.
- During delivery, reconcile `docs/developer/data-shapes/abclass.md`, `docs/developer/backend/api-layer.md`, `docs/developer/backend/backend-testing.md` and `docs/developer/testing/synthetic-test-data.md`, plus JSDoc on the touched model/controller/API methods. Explain optional-write versus always-present nullable-read semantics, field-scoped roster persistence and snapshot staleness; remove planned-only markers only as the corresponding behaviour is implemented.
- In the `getABClassPartials` key notes of `docs/developer/data-shapes/abclass.md`, replace the existing rationale that timestamps are absent from the partial shape: metadata introduces timestamps, but they are validated strings rather than live Dates, so no additional `DateUtils.deepConvertDates()` call is needed. Preserve that distinction during reconciliation.
- Where touched prose currently calls `cohortKey`, `yearGroupKey` and `courseLength` “metadata”, describe them as class configuration/reference fields so they are not confused with the new literal `metadata` property. Also distinguish this class-level assessment summary from unrelated task-artifact `metadata`. Document the compact `excluded` representation and the absence of an API repair path for corrupt stored metadata.
- No eager migration, live deployment, commits or frontend work is authorised by this planning request.
- A layout spec is not required: no frontend surface or workflow changes.

## Planning handoff notes

- Work exclusively in `/home/developer/AssessmentBot-metadata-planning`; the original worktree has unrelated concurrent changes.
- Later delivery must be TDD-first with explicit canonical profile/view choices and the mandatory implementation/review loop.
- Planned-only contract/helper entries must exist in `docs/developer/data-shapes/abclass.md`, `docs/developer/backend/api-layer.md`, `docs/developer/backend/backend-testing.md` and `docs/developer/testing/synthetic-test-data.md` before the action plan is finalised and before any implementation. Those entries are now recorded as `Not implemented`; the action plan must reference them as prerequisites, not postpone their creation to rollout.
- Assess module size before implementation, including the model and dedicated validator owner, not just the controller facade. Current physical line counts and planning estimates are: `Models/ABClass.js` 370, projected approximately 430–470 with metadata integration; new `Models/ABClassMetadata.js` 0, projected approximately 250–350; `Utils/Validate.js` 299, projected approximately 330–350; `ABClassController/index.js` 581, projected above 600 without separation. The Planner workflow requires the action plan to record checked counts, projected increases and an explicit domain-separation plan for every materially changed file projected above 500 lines. Separately, backend instructions make actual decomposition mandatory when a touched non-API file exceeds 550 lines; the facade already crosses that hard trigger. The 500-line planning obligation must not be used to waive or delay the 550-line implementation rule, nor treated as permission for unrelated pre-emptive refactors.
- The facade must be decomposed within its existing `ABClassController/` domain folder when touched, preserving its public methods, injected sub-classes and GAS load order. Keep the metadata domain routines in their dedicated model-domain module instead of growing `ABClass.js` with the five validators. Any additional splitting must follow the existing folder/facade conventions, not condense documentation to evade size limits.
- The action plan must check GAS load order for the new metadata model and error class plus the extended `Validate` utility. ABClass references to the later metadata model, and metadata-model references to later `Validate`/error definitions, must stay inside runtime constructor/method bodies; there must be no premature top-level evaluation of those dependencies. In `tests/setupGlobals.js`, retain the existing `Validate` installation and add the new error and `ABClassMetadata` globals before tests load any ABClass-dependent module, including suites that directly require `Models/ABClass.js`. Do not add production Node imports or change stable numeric prefixes merely to support tests.
- Calculation, automatic refresh and frontend reporting are excluded scope, not unresolved decisions or authorised implementation deferrals.
- No core product questions remain for this contract-support cycle.
