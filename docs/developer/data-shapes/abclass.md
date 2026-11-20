# Contract: ABClass

Root domain object for all data about a single Google Classroom course.
Contains class configuration, assessment-summary metadata, students, teachers and embedded
assignments.

Backend model: `src/backend/Models/ABClass.js`
Metadata domain owner: `src/backend/Models/ABClassMetadata.js` (facade); nested baseline/standings
validators: `src/backend/Models/ABClassMetadataStandings.js`
Collections: per-class collections named by `classId` (main documents), `abclass_partials` (fixed registry, keyed by `classId`)
API handlers: `src/backend/z_Api/abclass/abclassRead.js`, `src/backend/z_Api/abclass/abclassMutations.js`
Response mapper: `src/backend/y_controllers/ABClassController/ABClassResponseMapper.js`
Frontend service: `src/frontend/src/services/googleClassrooms/classPartialsService.ts`, `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts`, `src/frontend/src/services/abClass/abClassMutationService.ts` (validated queued upsert/update), `src/frontend/src/services/abClass/abClassMetadataService.ts` (reserved-slot metadata writer)
Frontend Zod: `src/frontend/src/services/googleClassrooms/classPartials.zod.ts`, `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`, `src/frontend/src/services/abClass/abClassMetadata.zod.ts`, `src/frontend/src/services/abClass/abClassMutations.zod.ts`

Sibling contracts:

- [Contract: AssignmentDefinition](assignment-definition.md) — Assignment definitions are embedded inside ABClass's `assignments` array (as `assignmentDefinitionKey` in transport) and referenced for resolution.
- [Contract: Assignment](assignment.md) — Assignment partials are embedded inside ABClass's `assignments` array.
- [Contract: BackendConfig](backend-config.md) — No direct relationship.
- [Contract: Reference Data](reference-data.md) — ABClass references `cohortKey` and `yearGroupKey` which resolve to Cohorts and YearGroups respectively.
- [Transport envelope](transport-envelope.md) — ABClass API payloads use the shared `apiHandler` envelope, which leaves the backend as a JSON string; this contract documents only the inner payload.
- [Contract: Frontend Data Analysis Response](frontend-data-analysis-response.md#metadata-refresh-execution-contracts) — supplies weighted aggregates and documents the shared `PostAnalysisContext` plus the local metadata-refresh decision/outcome types; these are not wire values.

---

## Persistence

ABClass uses a split persistence model: a main document stored in a per-class collection
named by `classId` and written via `ABClass.toJSON()`, plus a lightweight fixed registry
`abclass_partials` written via `ABClass.toPartialJSON()`.

### Collection: per-class, named by `classId` (main document)

Stored via `ABClass.toJSON()`.

| #   | Field          | Type              | Persistence                      | Transport   | Frontend Zod                                                    | Notes                                                                                                                                                                               |
| --- | -------------- | ----------------- | -------------------------------- | ----------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `classId`      | `string`          | included                         | unchanged   | `ClassFullSchema.classId: z.string()`                           | Google Classroom course ID. Required, never null.                                                                                                                                   |
| 2   | `className`    | `string\|null`    | included                         | unchanged   | `ClassFullSchema.className: z.string().nullable()`              | Derived from Google Classroom on write path. Null when unset.                                                                                                                       |
| 3   | `cohortKey`    | `string\|null`    | included                         | unchanged   | `ClassFullSchema.cohortKey: z.string().nullable()`              | User-managed. `null` when unset.                                                                                                                                                    |
| 4   | `courseLength` | `number`          | included                         | unchanged   | `ClassFullSchema.courseLength: z.number()`                      | Integer ≥ 1. Default 1 in constructor.                                                                                                                                              |
| 5   | `yearGroupKey` | `string\|null`    | included                         | unchanged   | `ClassFullSchema.yearGroupKey: z.string().nullable()`           | User-managed. `null` when unset.                                                                                                                                                    |
| 6   | `classOwner`   | `Object\|null`    | included                         | unchanged   | `ClassFullSchema.classOwner: TeacherSummarySchema.nullable()`   | Teacher summary object (see [§ Sub-entity Teacher](#sub-entity-teacher)). Null when unset.                                                                                          |
| 7   | `teachers`     | `Array`           | included                         | unchanged   | `ClassFullSchema.teachers: z.array(TeacherSummarySchema)`       | Array of Teacher summary objects. Empty array when no teachers.                                                                                                                     |
| 8   | `students`     | `Array`           | included                         | unchanged   | `ClassFullSchema.students: z.array(StudentSummarySchema)`       | Array of Student objects (see [§ Sub-entity Student](#sub-entity-student)). Empty array when no students.                                                                           |
| 9   | `assignments`  | `Array`           | included                         | transformed | `ClassFullSchema.assignments: z.array(AssignmentPartialSchema)` | Embedded assignments, serialised representation-aware (partial definitions via `toPartialJSON()`, full definitions via `toJSON()`); see [§ Transport getABClass](#getabclass-read). |
| 10  | `active`       | `boolean\|null`   | included (`this.active ?? null`) | unchanged   | `ClassFullSchema.active: z.boolean().nullable()`                | Tri-state: `true` (active), `false` (inactive), `null` (unknown/unset).                                                                                                             |
| 11  | `metadata`     | `ABClassMetadata` | included by `toJSON()`           | included    | `ClassFullSchema.metadata: ABClassMetadataSchema`               | Supplied assessment-summary snapshot, emitted and replaced as a whole value; see [§ Sub-entity: ABClassMetadata](#sub-entity-abclassmetadata).                                      |

Key notes:

- `students` and `assignments` arrays are fully stored in this collection but are heavy,
  so the partials registry exists for list-view performance.
- `assignments` serialisation is representation-aware
  (`ABClass._serialiseAssignmentsForClass()`): an embedded assignment whose definition carries a
  task-summary array (partial definition) keeps its redacted `toPartialJSON()` output, while a
  genuine full assignment keeps full `toJSON()` output and its serialiser errors propagate
  unchanged. `AssignmentDefinition.toJSON()` remains strict and still rejects a partial
  definition. `Assignment.toJSON()` gates its definition branch solely on
  `Array.isArray(definition.tasks)`: a restored partial definition (tasks as an array) is emitted
  through `definition.toPartialJSON()` on every path, not only on the legacy persistence path.
  Because marker-1 restoration admits the partial summary-array form (see
  [Component Shape: Assessment § Marker-1 CURRENT restoration](assessment.md#marker-1-current-restoration)),
  a restored marker-1 assignment with a partial definition is a model-admissible state on which
  `toJSON()` emits the partial definition instead of throwing; legacy records likewise re-emit the
  stored body from ordinary instance state. Production write/read flows never reach the
  partial-definition state: `persistAssignmentRun()` rejects a partial definition before any
  write, `_ensureFullDefinition()` replaces one before read serialisation, and the class
  serialiser routes partial-definition assignments through `toPartialJSON()`.
- Class-embedded assignments are normally partial-hydration instances; fully hydrated records live
  in separate `assign_full_*` collections. Whatever representation the model currently holds is
  what `toJSON()` writes.
- `progressTracker` and `_hydrationLevel` are runtime-only flags and never persisted.
- `active` default: `null` (tri-state). Only creation flows explicitly set it.
- `metadata` is emitted by this serialiser and validated on the backend. The full class read
  schema requires the shared nullable `ABClassMetadataSchema`, so legacy backend absence arrives
  as explicit `null` and a missing or malformed response field fails parsing rather than being
  stripped.

### Collection: `abclass_partials` (registry)

Stored via `ABClass.toPartialJSON()`.

| #   | Field          | Type              | Persistence                      | Transport | Frontend Zod                                                     | Notes                                                                                                                                                                                                                                                                                  |
| --- | -------------- | ----------------- | -------------------------------- | --------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `classId`      | `string`          | included                         | unchanged | `ClassPartialSchema.classId: z.string()`                         | Google Classroom course ID.                                                                                                                                                                                                                                                            |
| 2   | `className`    | `string\|null`    | included                         | unchanged | `ClassPartialSchema.className: z.string().nullable()`            | Null when unset.                                                                                                                                                                                                                                                                       |
| 3   | `cohortKey`    | `string\|null`    | included                         | unchanged | `ClassPartialSchema.cohortKey: z.string().nullable()`            | Null when unset.                                                                                                                                                                                                                                                                       |
| 4   | `courseLength` | `number`          | included                         | unchanged | `ClassPartialSchema.courseLength: z.number()`                    | Integer ≥ 1.                                                                                                                                                                                                                                                                           |
| 5   | `yearGroupKey` | `string\|null`    | included                         | unchanged | `ClassPartialSchema.yearGroupKey: z.string().nullable()`         | Null when unset.                                                                                                                                                                                                                                                                       |
| 6   | `classOwner`   | `Object\|null`    | included                         | unchanged | `ClassPartialSchema.classOwner: TeacherSummarySchema.nullable()` | Teacher summary. Null when unset.                                                                                                                                                                                                                                                      |
| 7   | `teachers`     | `Array`           | included                         | unchanged | `ClassPartialSchema.teachers: z.array(TeacherSummarySchema)`     | Teacher summary objects.                                                                                                                                                                                                                                                               |
| 8   | `active`       | `boolean\|null`   | included (`this.active ?? null`) | unchanged | `ClassPartialSchema.active: z.boolean().nullable()`              | Tri-state.                                                                                                                                                                                                                                                                             |
| 9   | `metadata`     | `ABClassMetadata` | included by `toPartialJSON()`    | included  | `ClassPartialSchema.metadata: ABClassMetadataSchema`             | Whole-class writes prepare a detached partial copy before the full-store mutation; a field-scoped roster patch never touches stored metadata. Reads emit it; upsert/update requests replace it wholly, with request-provenance failures adapted to `INVALID_REQUEST` at the transport. |

Key notes:

- `students` and `assignments` are **intentionally excluded** from the partial shape.
  This is the defining difference between the main document and the registry.
- Derived display fields such as `cohortLabel` and `yearGroupLabel` are intentionally
  excluded from backend transport; frontend view-models derive them from reference-data
  maps.
- `active` preserves tri-state semantics: `true` (active), `false` (inactive), `null`
  (unknown/unset).
- Storage-only fields (such as `_id` from the database) are stripped by the response
  mapper during normalisation.
- `metadata` is emitted by this serialiser and validated on the backend. The partial read schema
  requires the shared nullable `ABClassMetadataSchema`, so legacy backend absence arrives as
  explicit `null` and a missing or malformed response field fails parsing rather than being
  stripped.

### Scope boundaries

Ordinary class saves preserve raw legacy bodies and original version values, including non-array
submissions roots.

---

## Transport

### `getABClassPartials` (read)

Returns the array of normalised class partials for the class-list UI.

| Aspect           | Detail                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/abclass/abclassRead.js`                                                                                        |
| Controller       | `ABClassController.getAllClassPartials()`                                                                                         |
| Response mapper  | `ABClassResponseMapper._normaliseClassPartial()` (per-row), `_buildClassSummary()`                                                |
| Frontend Zod     | `src/frontend/src/services/googleClassrooms/classPartials.zod.ts` → `ClassPartialsResponseSchema` (`z.array(ClassPartialSchema)`) |
| Frontend service | `src/frontend/src/services/googleClassrooms/classPartialsService.ts` → `getABClassPartials()`                                     |

**Request:** No parameters.

**Response:** `ClassPartialSchema[]`

| Field          | Type                    | Required | Notes                            |
| -------------- | ----------------------- | -------- | -------------------------------- |
| `classId`      | `string`                | yes      |                                  |
| `className`    | `string\|null`          | yes      | `null` when unset                |
| `cohortKey`    | `string\|null`          | yes      | `null` when unset                |
| `courseLength` | `number`                | yes      | Integer ≥ 1                      |
| `yearGroupKey` | `string\|null`          | yes      | `null` when unset                |
| `classOwner`   | `TeacherSummary\|null`  | yes      | Teacher summary object or `null` |
| `teachers`     | `TeacherSummary[]`      | yes      | May be empty array               |
| `active`       | `boolean\|null`         | yes      | Tri-state                        |
| `metadata`     | `ABClassMetadata\|null` | yes      | Validated; `null` when absent    |

Key contract notes:

- The response is built by `ABClassController.getAllClassPartials()`, which reads only
  `abclass_partials` and normalises each stored row through `_normaliseClassPartial()`.
- `_normaliseClassPartial()` is the normalisation gate: it strips any storage-only
  fields (e.g. `_id`) and ensures `className`, `cohortKey`, `yearGroupKey`,
  `classOwner`, and `active` use `?? null` defaulting.
- `_normaliseClassPartial()` is also the single stored-partial metadata gate. It
  distinguishes actual `metadata` absence (normalised to `null` through
  `ABClassMetadata`) from a present value, which it validates and defensively copies.
  Present invalid metadata fails the request as an integrity error rather than dropping
  the row or falling back to a full-class read. Its reuse by `_buildClassSummary()`
  covers mutation summaries.
- JsonDbApp revives stored ISO date strings as live `Date` objects on read, and
  `ABClassMetadata` accepts only canonical UTC strings. The stored-partial gate therefore
  passes a present stored `metadata` value through `DateUtils.deepConvertDates()` before
  `new ABClassMetadata(...)`; actual absence still routes through the constructor's `null`
  default. Request and in-memory metadata paths are unaffected because `Date` is not
  expected there.
- The backend emits `metadata` on every row, and `ClassPartialSchema` requires the shared
  nullable schema, so legacy absence must arrive as explicit `null`; a missing or malformed field
  fails parsing.
- The registry-only read path reads only `abclass_partials` and returns an empty array when no
  partial documents exist.
- This endpoint does **not** pass through `DateUtils.deepConvertDates()` on its response.
  The response stays `Date`-free because `_normaliseClassPartial()` projects only scalar
  fields, teacher summaries and `metadata` — and the stored-partial metadata gate already
  normalises revived `Date` values inside `metadata` to canonical strings. It is not because
  the serialiser emits no `Date` objects: restored model state can hold revived `Date` values
  (a definition restored through `AssignmentDefinition.fromJSON()` keeps them unchanged), so
  no projection field other than `metadata` can carry one and no additional conversion is
  required.
- Reads never write and never backfill; a legacy row without the field is projected as
  explicit `null`. Invalid stored metadata fails the request; the row is not dropped and there is
  no fallback to a full-class fetch.

### `getABClass` (read)

Returns the full class document with assignments as partial summaries.

| Aspect           | Detail                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/abclass/abclassRead.js` → `getABClass_()`                                                                                  |
| Controller       | `ABClassController.readClass()`                                                                                                               |
| Response mapper  | `ABClassResponseMapper._toReadView()`                                                                                                         |
| Frontend Zod     | `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts` → `ClassFullResponseSchema` (`ClassFullSchema.nullable()`) |
| Frontend service | `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts` → `getABClass()`                                               |

**Request:**

| Field     | Type     | Required | Notes                                                                                       |
| --------- | -------- | -------- | ------------------------------------------------------------------------------------------- |
| `classId` | `string` | yes      | Safe identifier: non-empty string, already trimmed, no `/`, `\`, `..` or control characters |

**Response:** `ClassFullSchema` or `null`

| Field          | Type                    | Required | Notes                                                             |
| -------------- | ----------------------- | -------- | ----------------------------------------------------------------- |
| `classId`      | `string`                | yes      |                                                                   |
| `className`    | `string\|null`          | yes      |                                                                   |
| `cohortKey`    | `string\|null`          | yes      |                                                                   |
| `courseLength` | `number`                | yes      |                                                                   |
| `yearGroupKey` | `string\|null`          | yes      |                                                                   |
| `classOwner`   | `TeacherSummary\|null`  | yes      |                                                                   |
| `teachers`     | `TeacherSummary[]`      | yes      |                                                                   |
| `students`     | `StudentSummary[]`      | yes      | Plain objects: `{ name, email, id }`                              |
| `assignments`  | `AssignmentPartial[]`   | yes      | Array of partial assignment summaries (see assignment view below) |
| `active`       | `boolean\|null`         | yes      | Tri-state                                                         |
| `metadata`     | `ABClassMetadata\|null` | yes      | Validated; `null` when absent                                     |

**`assignments[]` entry (AssignmentPartial shape):**

| Field                       | Type                         | Required                                | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------- | ---------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `courseId`                  | `string`                     | yes (backend) / stripped (frontend Zod) | Present in wire format but stripped by `ClassFullSchema` (Zod `.strip()` default).                                                                                                                                                                                                                                                                                                                                                                    |
| `assignmentId`              | `string`                     | yes                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `assignmentName`            | `string`                     | yes (backend) / stripped (frontend Zod) | Present in wire format but stripped by `ClassFullSchema`.                                                                                                                                                                                                                                                                                                                                                                                             |
| `dueDate`                   | `string\|null`               | no (optional)                           | ISO 8601 string or `null`. Zod: `.nullable().optional()`                                                                                                                                                                                                                                                                                                                                                                                              |
| `updatedAt`                 | `string\|null`               | yes                                     | ISO 8601 string or `null`.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `createdAt`                 | `string`                     | yes                                     | ISO 8601 string.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `documentType`              | `string\|null`               | yes                                     | `'SLIDES'` \| `'SHEETS'` or `null`.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `submissions`               | `StudentSubmissionPartial[]` | yes                                     | Array of partial submission objects (see [Contract: Assignment](assignment.md) for full shape).                                                                                                                                                                                                                                                                                                                                                       |
| `assignmentDefinitionKey`   | `string`                     | yes                                     | Produced only from the stored embedded definition's `definitionKey` when that value is a non-empty string; the embedded `assignmentDefinition` object is then removed. A missing embedded definition, or a missing/empty/non-string `definitionKey`, fails the whole read as a stored-integrity error rather than emitting `null` or omitting the key. The frontend resolves definition details from its own `AssignmentDefinitionPartials` registry. |
| `assessmentContractVersion` | `1\|'legacy'`                | yes                                     | Backend emits `1` for a current result and `'legacy'` for every other stored marker, set on the read output only. `AssignmentPartialSchema` requires `assessmentContractVersion: z.union([z.literal(1), z.literal('legacy')])`, and `getABClass()` parses only a root/envelope stub (`assignments: []`) and then `normaliseClassRead()` performs the single per-item validation pass.                                                                 |

Key contract notes:

- The response is built by `ABClassResponseMapper._toReadView()`, which:
  1. Calls `assignment.toPartialJSON()` on each assignment to get the lightweight shape.
  2. Strips `_hydrationLevel` and `progressTracker` as defence-in-depth.
  3. For a legacy assignment (`assessmentContractVersion !== 1`), replaces `submissions` with the
     prepared partial read submissions from
     `AssignmentRehydration.prepareLegacyReadSubmissions(assignment, 'partial')`
     (owner `02_AssignmentLegacyRead.js`) and sets
     `assessmentContractVersion: 'legacy'` on the wire entry only. Current results keep
     `assessmentContractVersion: 1`. A present non-array `submissions` root returns `null`
     from the facade, so the read throws a contextual error naming the assignment instead
     of serving a payload.
  4. Requires each assignment's stored embedded `assignmentDefinition` to carry a
     `definitionKey` that is a non-empty string, then replaces the object with
     `assignmentDefinitionKey`. Consuming the partial shape (`toPartialJSON()`) keeps
     partial-definition assignments (tasks stored as an array) transport-safe. A missing
     embedded definition, or a missing/empty/non-string `definitionKey`, throws a
     `TypeError` for that assignment instead of emitting `null` or an absent key: the
     assignment is not silently dropped, and the whole read fails as a stored-integrity
     error (generic `INTERNAL_ERROR` through `apiHandler`), not as a request validation
     failure. The frontend `AssignmentPartialSchema` continues to require a plain
     `z.string()`; neither side is widened to nullable/optional.
- `_toReadView()` includes `metadata` by revalidating and defensively copying the mutable
  model state through `ABClassMetadata`. Model metadata restored by `ABClass.fromJSON()` has
  already had revived `Date` values converted to canonical strings (see
  [§ Model construction, restoration, replacement and serialisation](#model-construction-restoration-replacement-and-serialisation)).
  Present invalid stored metadata fails the read as an integrity error — it is not dropped,
  repaired or replaced — while absent or legacy `null` metadata becomes explicit `null`. Reads
  perform no writes. An absent class still returns top-level `null`, which is distinct from an
  existing class with `metadata: null`.
- `ClassFullSchema` requires the emitted field: legacy backend absence must arrive as explicit
  `null`, and a missing or malformed field fails parsing instead of being stripped.
- All assignments in the response carry partial-hydration data (artifact `content` is `null`;
  numeric and `'N'` assessment `reasoning` values are stripped; `'E'` entries retain `reasoning`
  and `error`). Each entry carries `assessmentContractVersion: 1` for a current result or
  `'legacy'` for every other stored marker after read preparation.
- `DateUtils.deepConvertDates()` is called on the entire response before returning from
  the handler. This is required because `google.script.run` prohibits `Date` objects in
  return values (including nested objects). `metadata` timestamps are already canonical
  strings, so this conversion only affects the other ABClass fields. The whole response is
  then serialised to a JSON string by `apiHandler()`; see
  [Transport envelope](transport-envelope.md#key-contract-notes).
- Returns `null` when no persisted class document exists for the given `classId`
  (`ClassNotFoundError` caught at the transport boundary).

#### Class-read marker, `E` projections and coverage

The marker and `E` projections ride inside the embedded assignment partials and their
submission items.

| Field                                  | Where                              | Type                       | Frontend Zod                                                  | Notes                                                                                                                                                        |
| -------------------------------------- | ---------------------------------- | -------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `assessmentContractVersion`            | Each `assignments[]` partial entry | `1 \| 'legacy'`            | `z.union([z.literal(1), z.literal('legacy')])`                | `1` for a current result, `'legacy'` for every other stored marker; the class read view is the sole marker owner. See [§ getABClass read](#getabclass-read). |
| `submissions[].items[].assessments[*]` | Embedded partial submission items  | `Assessment` partial union | Score-only numeric/`N`, or `{ score: 'E', reasoning, error }` | Numeric/`N` entries stay score-only; `'E'` keeps `reasoning`/`error` via the shared `partialAssessmentResultSchema` alias.                                   |
| `assignmentDefinitionKey`              | Each `assignments[]` partial entry | `string`                   | `z.string()`                                                  | Read-boundary integrity rule (see the transport notes above).                                                                                                |

Class-read behaviour:

- `getABClass` continues to serialise embedded assignments via `toPartialJSON()` and to replace
  the embedded definition with `assignmentDefinitionKey`. Current-result markers and `E` entries
  are carried by that same partial projection; legacy read preparation supplies
  `assessmentContractVersion: 'legacy'` and the prepared submissions.
- Legacy persistence is unchanged by read. `Assignment.toJSON()`/`toPartialJSON()` re-emit the
  stored submission body and the original marker presence/value from ordinary instance state;
  they never emit prepared read submissions or `'legacy'`. `_toReadView()` substitutes the
  prepared values for the class wire entry only. Class save/preparation never receives those
  read values.
- For a legacy class-embedded assignment (marker absent, `null` or unsupported),
  `ABClassResponseMapper._toReadView()` invokes
  `AssignmentRehydration.prepareLegacyReadSubmissions(assignment, 'partial')` **before**
  replacing the definition with `assignmentDefinitionKey`, so the saved embedded task
  summaries are still available. The owner is `02_AssignmentLegacyRead.js`; it reuses
  `AssignmentCurrentRestoration` item validation and is not a second validator. The wire
  therefore includes prepared partial submissions and `assessmentContractVersion: 'legacy'`.
- Preparation follows
  [Component Shape: Assessment § Legacy read preparation](assessment.md#legacy-read-preparation):
  valid scores, reasoning, feedback, artefact type and source identities are retained;
  malformed items, criterion maps, artefacts or contradictory source state become all-three
  validation `CORRUPT_RECORD` `E` for that task, preserving healthy siblings; null/missing/array
  or non-record item maps yield one `E` per saved task. Timestamps follow the current-format
  rules rather than the wall clock. The class read redacts artefact content/hash as usual.
- The direct full read has a different invocation point: `getAssignment_()` calls
  `Assignment.toReadJSON()`, which delegates to `AssignmentSerialisation.toReadJSON()`. That
  read path invokes the same operation on the instance returned by
  `readRehydrateAssignment` (after its `_ensureFullDefinition` step), and uses the full stored
  submission body when present; the existing partial-definition fallback may resolve the
  registry's full definition. This class path keeps its stored task summaries, so abnormal legacy
  partial-definition records can validate against different task lists between the two reads.
  Neither read repairs storage nor guesses historical task associations or causes. See
  [Component Shape: Assessment § Legacy read preparation](assessment.md#legacy-read-preparation).
- The backend is authoritative for completed-item coverage on both read paths. For marker-1
  CURRENT records, `AssignmentRehydration` materialises a missing known task as a
  `CORRUPT_RECORD` `E` during one-pass full **and** partial restoration, using the assignment's
  embedded task list. Legacy reads run the same current-format coverage and item validation
  through `AssignmentRehydration.prepareLegacyReadSubmissions()`: missing known tasks and
  malformed item maps become `CORRUPT_RECORD` `E` per saved task, while valid stored marks are
  retained. The browser
  normaliser implements the equivalent provided-entry isolation and is invoked by the read
  service. On this class read path those prepared entries are therefore already present in
  the class-partial output before the embedded definition is replaced by
  `assignmentDefinitionKey`. The browser's partial-read normaliser validates only the entries it
  receives and never infers extra coverage errors from the separately loaded, potentially newer
  definition registry. Only if a full wire payload nonetheless lacks an expected task does the
  browser full-read normaliser defensively produce a `CORRUPT_RECORD` `E` using that same full
  payload's definition; that mandatory fallback is a post-backend-validation corruption defence,
  never the normal full coverage owner, and it never overwrites backend-materialised `E`. On
  marker-1 CURRENT reads, a known dictionary task key paired with a mismatched item `taskId`
  becomes a `CORRUPT_RECORD` `E` for that key; a stored item referencing no task in the embedded
  definition fails the owned assignment dataset rather than guessing a target. A version-1 item
  with an incomplete or extra-key criterion map is an isolated all-three `CORRUPT_RECORD` `E` on
  both full and partial reads; see [Component Shape: Assessment § Persistence](assessment.md#persistence).
  A truncated item map is never silently converted to `N`, and no full-assignment fetch is
  performed to classify outcomes.
- A confirmed no-submission uses parent `documentId: null` and an empty item map. It contributes
  no observed item to the analyser, keeps its existing no-data `N` display, and does not insert
  raw `N` observations that would change average denominators. Missing students whose identity
  is not present in the class roster are not invented.
- A non-empty item map under a null parent `documentId` is not confirmed no-submission and may
  contain only complete all-three acquisition or validation `E` results. This null-parent
  isolation applies to marker-1 CURRENT records on both full and partial restoration, and to
  legacy records through the same current-format validation in read preparation. The browser
  normaliser implements the same null-parent isolation and is invoked by the read service.
  On the class-partial path, each identifiable item carrying numeric/`N` marks or an
  assessment/extraction-stage `E` is isolated to all three validation `CORRUPT_RECORD` `E`
  entries; healthy siblings and valid acquisition/validation `E` are preserved. The offending
  item is not silently dropped and the whole owned dataset is not failed for an identifiable
  contradiction. See
  [Component Shape: Student Submission § Completed submission coverage](student-submission.md#completed-submission-coverage).
- The read remains read-only. A normal class save must preserve the legacy marker and must not
  treat an old result as current. Successful reassessment replaces the full
  result and the embedded partial with version `1`.
- A missing lookup entry must never be reinterpreted as `N` when an explicit `E` is available
  from class-summary data. A failed/unavailable full query cannot hide known `E` reasoning.
- A full-read-only corruption affects the opened preview only. It does not recompute the class
  heatmap, class averages or ABClass metadata, and it is not persisted as a repair.
- Full and class-embedded partial reads use the shared frontend result schemas and
  read-normalisation owners documented in
  [Component Shape: Student Submission § Full and partial item isolation](student-submission.md#full-and-partial-item-isolation-with-trustworthy-identities);
  ABClass adds no second domain-validator hierarchy. `PartialAssessmentEntrySchema` aliases the
  shared partial result schema and `AssignmentPartialSchema` requires
  `assessmentContractVersion: 1 | 'legacy'`; the class-detail service parses only a
  root/envelope stub (`assignments: []`) and then runs the normaliser as the single
  per-item validation pass. The frontend validates the backend-prepared entries against the
  required marker and per-item shapes. It does not generate a second legacy graph, query a
  roster, infer historical outcomes or infer coverage from the definition registry. A class-read
  wire payload that omits `assessmentContractVersion` or carries an unsupported value is an
  invalid root, not a legacy-result signal; the backend `_toReadView()` read preparation is the sole
  legacy owner and always emits the required `1 | 'legacy'` field.
- The marker is produced by the embedded `Assignment` partial serialiser.

### `upsertABClass` (write)

Creates a new class or updates an existing one. Always refreshes Google-derived roster data.

| Aspect           | Detail                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/abclass/abclassMutations.js` → `upsertABClass_()`                                                                                          |
| Controller       | `ABClassController.upsertABClass()`                                                                                                                           |
| Response mapper  | `ABClassResponseMapper._buildClassSummary()`                                                                                                                  |
| Frontend Zod     | `services/abClass/abClassMutations.zod.ts` → `UpsertABClassRequestSchema`; `services/googleClassrooms/classPartials.zod.ts` → `ClassPartialSchema` (response) |
| Frontend service | `src/frontend/src/services/abClass/abClassMutationService.ts` → `upsertABClass()`                                                                             |

**Request:**

| Field          | Type                    | Required | Notes                                                                                                                                                                                                                                                     |
| -------------- | ----------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `classId`      | `string`                | yes      | Safe identifier: non-empty string, already trimmed, no `/`, `\`, `..` or control characters                                                                                                                                                               |
| `cohortKey`    | `string`                | yes      | Required non-null string in the frontend wrapper; backend rejects null/undefined and stringifies admitted non-null values (see [Known discrepancies](#known-discrepancies): frontend coercion/extra-field rejection and null configuration-key rejection) |
| `yearGroupKey` | `string`                | yes      | Same non-null upsert contract as `cohortKey`; read/response and update keys are nullable                                                                                                                                                                  |
| `courseLength` | `number`                | yes      | Positive safe integer (`1` through `Number.MAX_SAFE_INTEGER`), without coercion                                                                                                                                                                           |
| `metadata`     | `ABClassMetadata\|null` | no       | Optional whole-snapshot replacement                                                                                                                                                                                                                       |

**Response:** `ClassPartialSchema` (partial class summary — no students or assignments)

Frontend request validation and queue/response semantics are specified under
[§ Mutation schemas and queued services](#mutation-schemas-and-queued-services).

Key contract notes:

- The controller hydrates `classOwner`, `teachers`, and `students` from Google Classroom
  before persisting. `students` is persisted in the main document only (not returned).
- The transport validator `validateMutationClassId_` admits `classId` under the shared
  safe-trimmed identifier contract (string type, non-empty, already trimmed, no `/`, `\`,
  `..` or control characters) before controller delegation. Every failure is a
  non-retriable `INVALID_REQUEST` envelope with `fieldName: 'classId'`. The controller's own
  domain classId checks (for example `_validateClassId`, `_validateClassForSave`,
  `_validateDeleteClassId`) remain in force behind it.
- When the class already exists, the controller preserves existing `assignments` and `active`
  while refreshing roster data.
- New-class upsert paths set `active` to `true`.
- The response is the partial class summary (no `students` or `assignments`). It includes
  validated, detached `metadata` from `_buildClassSummary()`.
- `metadata` is an optional whole-value replacement: true omission preserves an existing
  snapshot (and initialises `null` for a new class), explicit `null` clears it, and a
  complete object replaces it entirely. A supplied own `undefined` or any invalid value is
  rejected before any record read, roster refresh or write. Nested partial objects are
  invalid, not patches. See [§ Sub-entity: ABClassMetadata](#sub-entity-abclassmetadata).
- Only a request-provenance metadata failure adapts to a non-retriable `INVALID_REQUEST`
  envelope with the field path in `error.message`; no `fieldName`/`details` field is added.
  Stored/model corruption and unrelated exceptions stay generic `INTERNAL_ERROR`.
- `abclassMutations.js` forwards the original parameters unchanged and adapts only a
  request-provenance typed metadata failure into `ApiValidationError`, which the dispatcher
  reports as a non-retriable `INVALID_REQUEST`.

### `updateABClass` (write)

Patches editable fields on an existing class. Does **not** refresh Google-derived roster data.

| Aspect           | Detail                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/abclass/abclassMutations.js` → `updateABClass_()`                                                                                          |
| Controller       | `ABClassController.updateABClass()`                                                                                                                           |
| Response mapper  | `ABClassResponseMapper._buildClassSummary()`                                                                                                                  |
| Frontend Zod     | `services/abClass/abClassMutations.zod.ts` → `UpdateABClassRequestSchema`; `services/googleClassrooms/classPartials.zod.ts` → `ClassPartialSchema` (response) |
| Frontend service | `src/frontend/src/services/abClass/abClassMutationService.ts` → `updateABClass()`                                                                             |

**Request:**

| Field          | Type                    | Required | Notes                                                                                                                                                    |
| -------------- | ----------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `classId`      | `string`                | yes      | Safe identifier: non-empty string, already trimmed, no `/`, `\`, `..` or control characters                                                              |
| `cohortKey`    | `string\|null`          | no       | Optional patch field: omitted preserves the stored key, `null` clears it, a non-null value is stored via `String(value)`; an own `undefined` is rejected |
| `yearGroupKey` | `string\|null`          | no       | As `cohortKey`                                                                                                                                           |
| `courseLength` | `number`                | no       | Positive safe integer (`1` through `Number.MAX_SAFE_INTEGER`) if supplied                                                                                |
| `active`       | `boolean\|null`         | no       | Optional patch field. `null` is an explicit value.                                                                                                       |
| `metadata`     | `ABClassMetadata\|null` | no       | Optional whole-snapshot replacement; `null` clears                                                                                                       |

**Forbidden request fields:** `classOwner`, `teachers`, `students`, `assignments` —
the backend rejects supplied non-undefined values with `ApiValidationError` / `INVALID_REQUEST`.
The frontend wrapper rejects every own protected or unknown key, including own undefined,
before enqueue (see [§Known discrepancies](#known-discrepancies)).

**Error states:**

| Error                                                     | Code              | Notes                                                                                                                                                                                                                                                         |
| --------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid `classId`                                         | `INVALID_REQUEST` | Missing, non-string, empty, untrimmed, or unsafe (`/`, `\`, `..`, control characters) per the shared safe-trimmed identifier check.                                                                                                                           |
| Forbidden field supplied                                  | `INVALID_REQUEST` | `classOwner`, `teachers`, `students`, `assignments`.                                                                                                                                                                                                          |
| `active` invalid                                          | `INVALID_REQUEST` | Not a boolean or `null`.                                                                                                                                                                                                                                      |
| Invalid supplied `metadata`                               | `INVALID_REQUEST` | Request-provenance typed metadata failure only.                                                                                                                                                                                                               |
| Own `undefined` `cohortKey` or `yearGroupKey`             | `INTERNAL_ERROR`  | `ABClassValidation._buildUpdatePatch()` throws a domain `TypeError` before any record read or write. This is **not** a metadata request-provenance failure, so the transport adapter rethrows it unchanged and `apiHandler` reports generic `INTERNAL_ERROR`. |
| Class does not exist                                      | `INTERNAL_ERROR`  | Controller `RangeError`; this is **not** an upsert path.                                                                                                                                                                                                      |
| Stored/model corruption or persistence/projection failure | `INTERNAL_ERROR`  | Invalid stored metadata or other integrity failures; never reclassified as `INVALID_REQUEST`.                                                                                                                                                                 |

**Response:** `ClassPartialSchema`

The validated frontend wrapper's narrower request acceptance, presence semantics and shared
queue lane are documented under [§ Mutation schemas and queued services](#mutation-schemas-and-queued-services).

Key contract notes:

- Only supplied patch fields are updated. Omitted fields retain their stored values.
- Reference keys follow the patch contract: an omitted `cohortKey`/`yearGroupKey` retains the
  stored value, `null` clears it, and a non-null value is stored as `String(value)`. An own
  `undefined` for either key is rejected by `ABClassValidation._buildUpdatePatch()` with a
  `TypeError` before any collection is read or any store is written (and before the returned
  summary is built). That `TypeError` is a domain failure, **not** the metadata
  request-provenance error, so `adaptMetadataRequestError_` rethrows it unchanged and the
  envelope is generic `INTERNAL_ERROR` — it is never adapted to `INVALID_REQUEST`.
- `validateMutationClassId_` admits `classId` under the shared safe-trimmed identifier
  contract before controller delegation (see the `upsertABClass` notes); failures are
  `INVALID_REQUEST`.
- `metadata` is an additional optional editable field: true omission preserves the stored
  snapshot, explicit `null` clears it, and a complete object replaces it entirely. Nested
  partial objects are invalid, not patches. An invalid mixed patch is rejected before any
  field is applied, and the request-origin failure adapts to the same non-retriable
  `INVALID_REQUEST` envelope as `upsertABClass`.
- The returned summary includes validated, detached `metadata`.
- Throws `RangeError` (maps to `INTERNAL_ERROR`) when the class does not exist — this
  is **not** an upsert path.

### `deleteABClass` (write)

Removes both the main class document and the partial registry entry.

| Aspect           | Detail                                                               |
| ---------------- | -------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/abclass/abclassMutations.js` → `deleteABClass_()` |
| Controller       | `ABClassController.deleteABClass()`                                  |
| Response mapper  | — (controller returns plain object)                                  |
| Frontend Zod     | —                                                                    |
| Frontend service | (Called via generic `callApi`)                                       |

**Request:**

| Field     | Type     | Required | Notes                                                                                       |
| --------- | -------- | -------- | ------------------------------------------------------------------------------------------- |
| `classId` | `string` | yes      | Safe identifier: non-empty string, already trimmed, no `/`, `\`, `..` or control characters |

**Error states:**

| Error              | Code              | Notes                                                                                                                                         |
| ------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Absent stores      | — (success)       | Deleting a class whose full collection and/or registry row are already absent still succeeds; it is not an error.                             |
| Parameters invalid | `INVALID_REQUEST` | Missing, non-string, empty, untrimmed or unsafe `classId` (`/`, `\`, `..`, control characters), per the shared safe-trimmed identifier check. |

**Response:**

| Field                    | Type      | Required | Notes                                                                                                                                                           |
| ------------------------ | --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `classId`                | `string`  | yes      |                                                                                                                                                                 |
| `hasDeletedFullClass`    | `boolean` | yes      | Mirrors the `dropCollection(classId)` return value: `true` only when this call removed the collection; `false` when it was absent, including a repeated delete. |
| `hasDeletedClassPartial` | `boolean` | yes      | `true` only when a registry row existed and was removed; `false` when it was already absent.                                                                    |

Key contract notes:

- Both persistence layers are removed: the per-class full collection via `dropCollection(classId)`
  and the `abclass_partials` registry row via `deleteOne({ classId })`.
- Repeated deletes are idempotent and always succeed. Deleting stores that do not exist never
  produces a class-not-found error; there is no absent-record failure path.
- A missing registry row yields `hasDeletedClassPartial: false`.
- `hasDeletedFullClass` mirrors the `dropCollection(classId)` return value, so it indicates
  whether this call actually removed the full collection. A missing collection — including on a
  repeated idempotent delete — yields `false` via the vendor's non-throwing absent path, and the
  recognised `COLLECTION_NOT_FOUND` exception also yields `false`. Idempotent deletes still succeed;
  unrelated persistence failures still throw.
- The response is a plain `{ classId, hasDeletedFullClass, hasDeletedClassPartial }` object.

---

## Sub-entities

### Sub-entity: Teacher

Backend model: `src/backend/Models/Teacher.js`
Frontend Zod: `src/frontend/src/services/googleClassrooms/classPartials.zod.ts` → `TeacherSummarySchema`

`Teacher.toJSON()` emits:

| Field         | Type           | Backend toJSON()              | Frontend Zod                                                          | Notes                                                                                                                                                                                             |
| ------------- | -------------- | ----------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email`       | `string\|null` | Always emitted                | `z.string().nullable()`                                               | Null when email is unset on the model.                                                                                                                                                            |
| `userId`      | `string\|null` | Always emitted                | `z.string().nullable()`                                               | Google userId. Null when unset.                                                                                                                                                                   |
| `teacherName` | `string\|null` | Always emitted (own property) | `z.string().nullable().optional().transform((value = null) => value)` | Always present, including explicit `null` when unset; uses the constructor-owned `null` state. The frontend schema remains `.optional()`/nullable and also accepts legacy rows that omit the key. |

Key notes:

- `Teacher.toJSON()` always emits its own `teacherName` property (`teacherName: this.teacherName`);
  an unset name uses the constructor-owned `null` value, never a serialiser-time default. This
  applies to every `Teacher` instance serialised through this helper, including ABClass
  `classOwner`, `teachers[]` entries and roster refreshes.
- The always-present guarantee attaches to `Teacher` instances. Legacy plain-object `teachers[]`
  entries are neither hydrated nor migrated: they pass through `ABClass.serialiseOwner()` /
  `ArrayUtils.serialiseArray()` unchanged until actually replaced by a `Teacher` instance, so a raw
  legacy row may still omit the key.
- `Teacher.fromJSON()` detects `teacherName` in
  the JSON via `'teacherName' in json` and only sets it when present, so legacy input with no
  `teacherName` restores with the constructor-owned `null` value and then serialises with an
  explicit `teacherName: null`.
- `TeacherSummarySchema` is `.nullable().optional().transform(...)`, so it accepts both
  legacy absence and the explicit `null`.

### Sub-entity: Student

Backend model: `src/backend/Models/Student.js`
Frontend Zod: `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts` → `StudentSummarySchema`

`Student.toJSON()` emits:

| Field   | Type     | Backend toJSON() | Frontend Zod | Notes                                      |
| ------- | -------- | ---------------- | ------------ | ------------------------------------------ |
| `name`  | `string` | Always emitted   | `z.string()` | Student's full name.                       |
| `email` | `string` | Always emitted   | `z.string()` | Student's email address.                   |
| `id`    | `string` | Always emitted   | `z.string()` | Student's unique ID from Google Classroom. |

Key notes:

- Student fields are all required and never null. The constructor does not accept null
  values for any field.

### Sub-entity: ABClassMetadata

Backend model: `src/backend/Models/ABClassMetadata.js` (the dedicated metadata-domain owner and
facade; deliberately **not** part of `Models/ABClass.js` or the generic `Validate`). Nested
baseline-average and standings validation and copying are delegated to the sibling
`src/backend/Models/ABClassMetadataStandings.js`; both modules resolve their dependencies inside
method bodies to respect GAS concatenation order.
Frontend Zod: `src/frontend/src/services/abClass/abClassMetadata.zod.ts` → `ABClassMetadataSchema`,
`NonNullableABClassMetadataSchema`, `CanonicalMetadataTimestampSchema`, `AverageScoreSchema`,
`AverageScoresSchema`, `ClassAveragesSchema`, `RecentAssignmentSchema`

A compact **supplied snapshot** of assessment-summary averages. Both `ABClass.toJSON()` and
`ABClass.toPartialJSON()` include the field; whole-class/editable writes persist detached, equal
copies, and the field-scoped roster patch leaves stored metadata untouched. The response mappers
expose it on partial-list, summary and full reads, and the controller gate validates and replaces
explicitly supplied request values before any read/roster/write; the transport adapter maps only a
request-provenance typed failure to `INVALID_REQUEST`. The backend never calculates, refreshes,
migrates or backfills it, so a previously supplied snapshot may become stale. In this contract,
`cohortKey`, `yearGroupKey` and `courseLength` are class configuration/reference fields, distinct
from this assessment-summary property, which is in turn distinct from the unrelated task-artifact
`metadata`.

Contract notation (not a backend TypeScript requirement):

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

type BaselineAverages = AverageScores & { updatedAt: string };

type StudentStanding = {
  studentId: string;
  studentName: string;
  scores: AverageScores;
  recentAssignmentScores: AverageScores[]; // one per recent assignment, zero to three
};

type StudentStandings = { top: StudentStanding[]; bottom: StudentStanding[] };

type ABClassMetadata = {
  classAverages: ClassAverages;
  recentAssignments: RecentAssignment[];
  baselineAverages: BaselineAverages | null;
  allTaskStandings: StudentStandings | null;
  baselineStandings: StudentStandings | null;
} | null;
```

Legacy two-field snapshots (`classAverages` and `recentAssignments` only) are accepted on read.
`ABClassMetadata.validateMetadata()` validates either shape and `toJSON()` emits the five-field
shape with `null` for every absent new field. `ABClass.toJSON()` and `ABClass.toPartialJSON()`
use the same owner, so full and partial snapshots are identical. Reads never write, repair or
backfill stored bytes.

| Field                                                  | Type                     | Persistence / shape rules (enforced by `ABClassMetadata`)                                                                  | Frontend Zod                                                                      | Notes                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `metadata`                                             | `object\|null`           | Optional on write; nullable as a whole on read                                                                             | `ABClassMetadataSchema` (`z.union([z.null(), NonNullableABClassMetadataSchema])`) | Constructor-owned null normalisation via `new ABClassMetadata()`; an **own** `undefined` is invalid (only true omission triggers preserve/new-class-null). `new ABClassMetadata(value)` validates/copies; `toJSON()` returns an independently owned plain snapshot/`null`. |
| `metadata.classAverages`                               | `object`                 | Required and complete when `metadata` is non-null; never `null`                                                            | `ClassAveragesSchema`                                                             | Five own fields: four scores plus `updatedAt`.                                                                                                                                                                                                                             |
| `metadata.classAverages.completeness`                  | `AverageScore`           | Finite number in the inclusive range 0–5, or exactly `'N'`, `'E'`, `'excluded'`                                            | `AverageScoreSchema`                                                              | Independent field; no cross-metric inference.                                                                                                                                                                                                                              |
| `metadata.classAverages.accuracy`                      | `AverageScore`           | As above                                                                                                                   | `AverageScoreSchema`                                                              |                                                                                                                                                                                                                                                                            |
| `metadata.classAverages.spag`                          | `AverageScore`           | As above                                                                                                                   | `AverageScoreSchema`                                                              |                                                                                                                                                                                                                                                                            |
| `metadata.classAverages.overall`                       | `AverageScore`           | As above                                                                                                                   | `AverageScoreSchema`                                                              | Retains existing weighted-scoring meaning; **not** a separate arithmetic mean.                                                                                                                                                                                             |
| `metadata.classAverages.updatedAt`                     | `string`                 | Exact canonical UTC datetime (see below); never `null`                                                                     | `CanonicalMetadataTimestampSchema`                                                | Records when the supplied class summary was updated.                                                                                                                                                                                                                       |
| `metadata.recentAssignments`                           | `RecentAssignment[]`     | Dense array of zero to three complete entries; sparse slots, `undefined` entries and incomplete entries are invalid        | `z.array(RecentAssignmentSchema)`                                                 | Ordered by non-increasing `updatedAt`; equal timestamps keep caller order.                                                                                                                                                                                                 |
| `metadata.recentAssignments[].assignmentId`            | `string`                 | Non-empty, already-trimmed, unique within the list; opaque (no numeric coercion, no UUID-only or fixed-length restriction) | `z.string()` (plus raw-record pre-check)                                          | Identifies a distinct Google Classroom assignment.                                                                                                                                                                                                                         |
| `metadata.recentAssignments[].assignmentDefinitionKey` | `string`                 | Non-empty, already-trimmed; need **not** be unique within the list (definitions are reusable)                              | `z.string()` (plus raw-record pre-check)                                          |                                                                                                                                                                                                                                                                            |
| `metadata.recentAssignments[].averages`                | `AverageScores`          | Required and complete; the four score fields exactly, with no nesting and no timestamp                                     | `AverageScoresSchema`                                                             | A nested partial object is invalid, not a patch.                                                                                                                                                                                                                           |
| `metadata.recentAssignments[].updatedAt`               | `string`                 | Exact canonical UTC datetime; supplied as the corresponding Assignment's existing `updatedAt`, not independently generated | `CanonicalMetadataTimestampSchema`                                                | Not compared by the API against the stored Assignment timestamp.                                                                                                                                                                                                           |
| `metadata.baselineAverages`                            | `BaselineAverages\|null` | Omitted on legacy input and emitted as `null`; when present, four scores plus a canonical `updatedAt`                      | `BaselineAveragesSchema.nullable()`                                               | Validated by `ABClassMetadataStandings.validateBaselineAverages()`. A present `undefined` is invalid.                                                                                                                                                                      |
| `metadata.allTaskStandings`                            | `StudentStandings\|null` | Omitted on legacy input and emitted as `null`; when present, exactly `top` and `bottom`, each a dense 0–3 list             | `StudentStandingsSchema.nullable()`                                               | Validated by `ABClassMetadataStandings.validateStandings()`. Each entry's `recentAssignmentScores` has one score set per `recentAssignments` entry.                                                                                                                        |
| `metadata.baselineStandings`                           | `StudentStandings\|null` | As `allTaskStandings`                                                                                                      | `StudentStandingsSchema.nullable()`                                               | Same validator as `allTaskStandings`; the two bases are independent.                                                                                                                                                                                                       |

`excluded` is stored as the literal string `'excluded'`. This is a compact supplied-snapshot
value and is **not** the frontend `MetricResult` union (which represents exclusion as
`state: 'excluded'` with `value: null`); the frontend `projectAverageScores()` maps explicitly
between the two representations. The marker values `N`, `E` and `excluded` are exact,
case-sensitive strings that stay distinct and are never converted to zero (any other spelling,
including lower case, is rejected).

**Domain validation rules** (facade `ABClassMetadata`, with nested new-field rules delegated to
`ABClassMetadataStandings`; the facade stays the single validation and copy owner):

| Routine                                    | Behaviour                                                                                                                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `validateAverageScore(value, context)`     | Enforce the exact finite 0–5 / `'N'` / `'E'` / `'excluded'` union.                                                                                                                                                                   |
| `validateAverageScores(scores, context)`   | Require all four own metric fields and validate each; reject unexpected fields.                                                                                                                                                      |
| `validateClassAverages(value, context)`    | Require exactly the four scores plus valid `updatedAt`; reuse score validation without rejecting the permitted timestamp.                                                                                                            |
| `validateRecentAssignment(value, context)` | Require exactly both identifiers, complete `averages` and valid `updatedAt`.                                                                                                                                                         |
| `validateMetadata(value, context)`         | Accept `null`; otherwise validate the legacy two-field or current five-field shape, dense zero-to-three recent array, unique assignment IDs, newest-first ordering, and delegate the three new fields to `ABClassMetadataStandings`. |

The nested baseline-average and standings validators, and their copy helpers, live in
`ABClassMetadataStandings` and reuse the facade's record, score, array and timestamp rules.

- On current-shape input every listed property is required and must be an **own** property. The
  three new fields may be omitted (legacy shape) or `null`; when present they must be valid.
  Apart from those three fields and the whole `metadata` value, no metric, `classAverages`,
  entry, `averages`, identifier or timestamp may be `null`. Every emitted snapshot carries all
  five fields, with `null` where a new field was absent.
- The metric names are not declared here. `ABClassMetadata._metrics()` derives them at call
  time as `[...Assessment.CRITERIA, 'overall']`, so `Assessment.CRITERIA` remains the single
  owner of the three criterion identities and this file adds only the weighted `overall`
  metric. The derivation is lazy because `Models/ABClassMetadata.js` sorts before
  `Models/Assessment.js` in the concatenated script.
- Nested objects must be ordinary data records (`Object.prototype` or a null prototype
  accepted); arrays, `Date` objects, class instances and values requiring coercion are
  rejected.
- Unexpected own fields in metadata or its nested objects are rejected, including
  misspellings and `lastAssessedAt`.
- The recent array is dense: sparse slots, `undefined` entries and incomplete entries are
  invalid.
- Scores: numeric zero and fractions are valid; no coercion, truncation, rounding or
  percentage conversion is performed. Each field is validated independently; `overall` is not
  derived, weightings are not inspected and no cross-metric relationship is inferred.
- Ordering: entries must be ordered by non-increasing `updatedAt`. Equal timestamps are valid
  and retain caller-supplied order; no additional tie-break or sorting is imposed.
  `assignmentId` is unique within the list; `assignmentDefinitionKey` need not be. Both
  identifiers are non-empty strings already trimmed and opaque. There is no enforced
  relationship between the class-summary timestamp and the entry timestamps.
- Validation must not repair metadata, silently remove entries, reorder it, calculate scores,
  stamp dates or fetch referenced entities. This is **structural** contract validation only:
  the API does not verify identifier existence, class membership, equality to a stored
  Assignment timestamp, mathematical consistency, or that the entries are the actual three most
  recently assessed assignments. Supplied snapshot accuracy remains the writer's responsibility.
- Neither the model nor its outputs retain shared mutable aliases that let caller, request or
  returned-object mutation change another representation; values are preserved by defensive
  copying at ownership boundaries.

**Canonical timestamp predicate** — `Validate.isCanonicalUtcDateTime(value)` in
`src/backend/Utils/Validate.js`, reused by the metadata-domain validator through its private
`ABClassMetadata._validateTimestamp(value, context)` helper. A metadata timestamp must be an
exact canonical UTC ISO datetime of the form `YYYY-MM-DDTHH:mm:ss.sssZ`, with a real calendar
date (Gregorian leap-year rules, including the century/non-quadricentennial exceptions, are
enforced) and valid time components. Live `Date` objects, date-only strings, timezone offsets,
non-canonical precision and counter-suffixed submission timestamps are rejected.
`isIsoDateTimeString_` in
`src/backend/z_Api/assignmentDefinition/assignmentDefinitionPartialRowValidation.js` is **not**
this contract: it accepts timezone offsets and is owned by the later transport layer, which
model-domain validation must not depend on.

**Error provenance.** The domain validator reports failures through
`ABClassMetadataValidationError`
(`src/backend/Utils/ErrorTypes/ABClassMetadataValidationError.js`), which carries a `fieldPath`,
appends it to the message as `"<message> (<fieldPath>)"`, and defaults to non-request provenance
via `inputSource = 'model'`. It extends `Error` and does **not** inherit from
`ApiValidationError` (and never throws one). Model restoration, stored-partial validation,
serialisation and projection therefore never acquire the request tag; only the explicit
request-time tagging step sets `inputSource: 'request'`.

#### Model construction, restoration, replacement and serialisation

- `new ABClass(options)` distinguishes an absent own `metadata` property from a present value. Absence is normalised by `new ABClassMetadata()` to `null`; present values, including own `undefined`, are passed explicitly to the domain constructor and validated.
- `ABClass.fromJSON(json)` applies the same own-property distinction despite using `Object.create()` for restoration. Legacy full or partial JSON without an own `metadata` field therefore restores as an own `metadata: null`; explicitly present invalid data is rejected, not repaired. A present stored `metadata` value is passed through `DateUtils.deepConvertDates()` before validation, because JsonDbApp revives stored ISO timestamp strings as live `Date` objects and `ABClassMetadata` accepts only canonical UTC strings. The constructor and `setMetadata` take request or in-memory input, where `Date` is not expected, and apply no such conversion.
- `ABClass.setMetadata(value)` replaces the whole snapshot or clears it with `null`. Its argument is always explicit, so `undefined` is invalid. Validation/copying completes before assignment, leaving existing state intact on failure.
- `toJSON()` and `toPartialJSON()` always emit `metadata`; each revalidates mutable model state through `ABClassMetadata` and returns an independently owned plain snapshot (or `null`). Both emit the same five-field shape, inserting `null` for new fields absent from a legacy snapshot. Input, full output, partial output and model state do not share nested metadata objects or arrays.
- A caller that deletes `model.metadata` or assigns `undefined` has corrupted model state; serialisation rejects it rather than invoking the absence default.
- Invalid metadata fails ABClass restoration even if later code intends to replace it; no restoration bypass is provided. Constructors/restoration, explicit metadata replacement and metadata-bearing serialisation use the same authoritative rules, so mutable metadata cannot bypass validation at those model boundaries.

#### Persistence operations and lifecycle

- Both `ABClass.toJSON()` and the partial registry projection `ABClass.toPartialJSON()` include
  `metadata`; whole-class and selective editable writes persist equal, independently owned
  copies of the caller's snapshot. There is no separate `ABClassPartials` JavaScript model;
  `ABClass.toPartialJSON()` owns the partial representation.
- Assessment runs do not calculate, refresh or clear metadata, so a previously supplied
  snapshot may become stale. Assignment persistence preserves the class's existing snapshot.
- `persistClassAndPartial(abClass)` prepares the full and partial payloads **before** the first
  full-store mutation, so a validation failure cannot cause a split-store write. The full payload
  is `abClass.toJSON()` when that method is present, otherwise the supported plain-object input;
  the caller object is never mutated. A complete partial is derived from
  `abClass.toPartialJSON()`.
- Authoritative metadata comes from the caller's own `metadata` property: actual own-property
  absence normalises through `new ABClassMetadata()` to `null`, while a present `undefined` or an
  invalid value is rejected. When the full or partial projection emits `metadata`, that value
  must validate and equal the caller snapshot; an invalid or differing projection rejects with
  **zero** insert/update/save operations. A legacy stored partial that omits `metadata` is accepted,
  and only the prepared copies gain the equal, independently owned snapshot.
- `ABClassMutationOps.updateABClass()` prepares its complete partial projection before the
  selective full-store `collection.updateOne()`/`save()`, then persists that prepared partial
  afterwards. Its full `$set` stays selective (only the supplied editable fields); it is not a
  whole-class rewrite. A legacy full document may keep metadata absence while the rebuilt partial
  carries `metadata: null`. When `metadata` is supplied, the full `$set` value must be an
  independently owned copy of the validated replacement, equal to the prepared partial payload's
  metadata; the request, model state and both write payloads never share nested metadata objects.
- A metadata-absent legacy record is projected as `null` with no read-time write. A whole-class
  save includes the field; a selective editable-field patch may leave absence in the full
  document while rebuilding the partial with `null`; a field-scoped roster patch changes neither
  store's metadata. Absence and `null` stay semantically equivalent until the next explicit
  metadata or whole-class write.
- Full-store persistence precedes partial-registry persistence. A full-store failure prevents the
  partial write; a partial-store failure propagates after the full store has been written.
- Constructor-owned `null` normalisation: the metadata-domain constructor owns the nullable
  field's `null` default. ABClass construction, restoration and legacy partial projection route
  actual absence through it (the `Object.create` restoration path does not inherit constructor
  defaults automatically). Present values are validated at these boundaries, not defaulted, and
  malformed supplied non-null values never become `null` silently.

#### Controller request replacement semantics

`ABClassValidation._validateRequestMetadata(parameters)`:

| Request metadata        | New class                  | Existing class                |
| ----------------------- | -------------------------- | ----------------------------- |
| Omitted                 | Initialise `null`          | Preserve existing metadata    |
| Explicit `null`         | Store `null`               | Clear metadata                |
| Complete valid object   | Store supplied snapshot    | Replace entire metadata value |
| Invalid / own undefined | Reject before side effects | Reject before side effects    |

- The gate is invoked by both mutations immediately after the legacy required-parameter checks
  and **before any record read, roster refresh, patch application or write**. It tests own-property
  presence (`Object.hasOwn(parameters, 'metadata')`), so true omission is distinct from an
  explicitly supplied value. A supplied own `undefined` or any invalid value is rejected.
- Only explicit presence invokes the shared domain validator. The gate catches only a typed
  `ABClassMetadataValidationError` and tags **that same object** with `inputSource: 'request'`; all
  other exceptions propagate unchanged. Model restoration, stored-value validation, serialisation
  and projection never acquire the request tag.
- Upsert new-class omission uses the constructor-owned `null` default; existing-class omission
  preserves the stored snapshot. Explicit `null` clears; a complete object replaces the whole
  value. Update mirrors this through `setMetadata`; nested partial objects are invalid, not patches.
- Existing records are restored and validated **before** any replacement is applied. Corruption in
  stored metadata therefore fails as a non-request integrity error even when the request supplies a
  valid replacement or `null`; there is no API repair path that bypasses stored-data integrity.
- An invalid mixed update applies none of its other fields: rejection precedes every read, roster
  call, in-memory patch and store write, so no partial configuration change is observed.
- Upsert preserves existing assignments and `active` with its whole-class save and roster refresh;
  update applies only editable fields. Metadata is a supplied snapshot that remains stale until an
  explicit replacement or whole-class write.

**Transport error adaptation.** `adaptMetadataRequestError_()` in `abclassMutations.js` adapts only
request-provenance metadata failures to `ApiValidationError`/`INVALID_REQUEST`; all other failures
rethrow unchanged. See [§ Backend transport validation](#validation). Invalid caller-supplied
metadata returns `INVALID_REQUEST` with the field path in `error.message`; stored/model corruption
stays generic `INTERNAL_ERROR`.

#### Field-scoped roster persistence

The roster refresh keeps its full refresh responsibilities (class name, owner, teachers and
students); it is not narrowed to students-only behaviour. `ABClassRoster._persistRoster()`
compares the refreshed roster with both stored records and returns without writing when nothing
changed. When a write is required, it patches only the fields it owns in each store:

| Store                 | Existing-document update                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full class collection | `$set` only `className`, `classOwner`, `teachers` and `students`, in the existing forms.                                                                             |
| `abclass_partials`    | `$set` only `className`, `classOwner` and `teachers`. Never includes `students`, `assignments`, `metadata`, `cohortKey`, `yearGroupKey`, `courseLength` or `active`. |

- The unchanged-roster skip requires all of the following: the stored full document's
  `className`, `classOwner`, `teachers` and `students` equal the refreshed values; a registry row
  is present and its stored `_id` is neither `null` nor `undefined`; and that row's `className`,
  `classOwner` and `teachers` equal the refreshed values (the row stores no `students`). Values
  are compared key-order-insensitively; array order remains significant. A skip emits one
  `_persistRoster: roster unchanged; skipping persistence` info log carrying the `classId`,
  performs no `updateOne`, `insertOne`, `replaceOne` or `save` on either collection, and calls
  neither roster-partial preparation nor write helper. A missing registry row, a stale registry
  row, a stale full document or a row without a stored `_id` all continue to the write path
  below, so the registry is still repaired and a corrupt row still fails loudly.
- Registry patch values match the serialised forms produced by `ABClass.toPartialJSON()`:
  `classOwner` through `ABClass.serialiseOwner()` and each teacher through
  `ArrayUtils.serialiseArray()`, retaining the class-name/`null` representation. Only these
  roster fields are built; the metadata-bearing partial projection is not called merely to
  obtain them. The full-store roster payload retains its existing forms and behaviour.
- An existing partial keeps its own metadata exactly as stored, including `null` or field
  absence, and it is never read, validated, copied or rewritten by this patch even when it
  differs from the loaded full class's metadata. Other unrelated fields are also unchanged; a
  skipped write leaves both stores untouched. The permitted
  `findOne({ classId })` lookup supplies the existence check and the row's stored `_id` for the
  write path, and it also supplies the stored roster values used by the skip comparison.
- When the partial row is missing, a complete normal partial is prepared from the already loaded
  ABClass, including validated metadata/`null`, and inserted after the full store is saved. No
  roster-only fragment is written. This is write-through creation, not a general repair or
  backfill mechanism.
- Whether creation is needed, and the creation payload, are determined and prepared before the
  full store is written, preserving write order and logged failure propagation. If an existing
  row cannot match, the write fails rather than silently completing with an unsynchronised
  roster; no retry or concurrent-write recovery is introduced.
- An existing registry row is patched using its stored `_id` as the sole filter, obtained from
  the permitted lookup. A stored row without an `_id` fails loudly rather than falling back to a
  classId filter. The vendor's `matchedCount` is checked: an `_id`-only operator update
  correctly reports a matched-but-unmodified row (`matchedCount === 1` is accepted), unlike the
  vendor's query-filter no-op result. A zero-match result fails loudly; there is no classId-query
  or upsert fallback.
- Roster-only patches update the two stored fields directly; whole-class saves and explicit
  metadata writes use the whole-row partial upsert path. Direct controller operations used by the
  facade keep their signatures.
- A field-scoped roster patch of an existing partial is **not** a metadata-bearing write. It
  must not use, validate, copy or rewrite the stored metadata value; the existence lookup
  required by the missing-partial path is unaffected.
- The comparison changes only whether a redundant write is issued. Neither stored shape,
  validation schema nor transport payload changes; only `_persistRoster()`'s decision to write
  is affected.

### Sub-entity: AssignmentPartial (embedded via transport)

The ABClass transport embeds partial assignment objects (see `AssignmentPartialSchema`
in the [getABClass transport](#getabclass-read) section above). The full contract
for Assignment is documented in [Contract: Assignment](assignment.md).

### Sub-entity: StudentSubmissionPartial (embedded via transport)

Partial submission objects appear inside `assignments[].submissions`. The full
contract for StudentSubmission is documented in [Contract: Assignment](assignment.md).

---

## Validation

**Frontend Zod:**

- `src/frontend/src/services/googleClassrooms/classPartials.zod.ts`:
  - `ClassPartialSchema` — validates the `getABClassPartials` response array entries and requires `metadata: ABClassMetadataSchema`.
  - `ClassPartialsResponseSchema` — `z.array(ClassPartialSchema)`.
  - `TeacherSummarySchema` — validates teacher summary objects (classOwner, teachers entries).
- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`:
  - `GetABClassRequestSchema` (`.strict()`) — validates `getABClass` request parameters (required string `classId`) before `callApi`.
  - `ClassFullSchema` — validates the `getABClass` response and requires `metadata: ABClassMetadataSchema`.
  - `ClassFullResponseSchema` — `ClassFullSchema.nullable()` (handles null for not-found).
  - `StudentSummarySchema` — validates student objects.
  - `AssignmentPartialSchema` — validates each assignment entry, including the required `assessmentContractVersion: 1 | 'legacy'`.
  - `TeacherSummarySchema` — duplicated from `classPartials.zod.ts` for self-contained validation.
- `src/frontend/src/services/abClass/abClassMetadata.zod.ts` (shared by both class read schemas):
  - `CanonicalMetadataTimestampSchema` — exact canonical UTC metadata timestamp.
  - `AverageScoreSchema`, `AverageScoresSchema`, `ClassAveragesSchema`, `BaselineAveragesSchema`,
    `RecentAssignmentSchema`, `StudentStandingSchema`, `StudentStandingsSchema` — strict nested
    metadata records. The two public snapshot schemas emit the current five-field shape from legacy
    input; see [§ Baseline averages and student standings](#baseline-averages-and-student-standings).
  - `NonNullableABClassMetadataSchema` — complete non-null snapshot; raw exact-record pre-check
    plus the strict metadata shape. Merge/write path input; parsing with this inner schema
    narrows the result without a nullable-union branch.
  - `ABClassMetadataSchema` — nullable whole metadata snapshot with unique identifiers and
    newest-first ordering; the wire read/request union wrapped around
    `NonNullableABClassMetadataSchema`.
  - Inferred types: `AverageScore`, `AverageScores`, `ClassAverages`, `RecentAssignment`,
    `ABClassMetadata`.
  - Both class read schemas require this schema, so successful parsing rejects missing or
    malformed metadata and retains legacy backend `null`.
  - Enforced rules: required fields must be own properties on ordinary or null-prototype
    records; dates, class instances, inherited-only fields, symbol keys and unexpected own keys
    are rejected at every nesting level. The exact-record pre-check rejects null/non-objects,
    arrays and non-plain prototypes; its own-key count plus required-own-key check already force
    the exact key set. This strictness is confined to metadata and does not tighten unrelated
    class fields. `recentAssignments` is a dense array of zero to three complete entries with no
    unexpected own array properties; `assignmentId` is unique; ordering is non-increasing
    `updatedAt`, and equal timestamps retain supplied order. The schema never sorts or repairs
    input. Parsing returns detached snapshots. Numeric bounds reject negative values, values
    above 5, `NaN` and both infinities; string scores reject coercion attempts, `null`,
    lower-case markers and unknown markers.
- `src/frontend/src/services/abClass/abClassMutations.zod.ts`:
  - `UpsertABClassRequestSchema`, `UpdateABClassRequestSchema` — raw own-key/plain-record
    validation followed by strict request objects. Their inferred request types, optional
    whole metadata replacement and exact field expressions are documented under
    [§ Mutation schemas and queued services](#mutation-schemas-and-queued-services).
- **Cross-reference:** `ClassFullSchema` is consumed by
  `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts` (`AveragingAnalyserInputSchema`)
  where pre-fetched full class documents serve as the primary data source for analysis. That
  input therefore requires the same nullable metadata field without any analyser change: the
  analyser does not read metadata, and successful analysis inputs must carry it.

**Backend transport validation:**

- `src/backend/z_Api/abclass/abclassRead.js`:
  - `validateParametersObject_(parameters, 'getABClass')` — validates parameters is a plain object.
  - `validateIdentifier_(classId, 'classId')` — validates classId is a string, non-empty, already trimmed, and free of unsafe characters (`/`, `\`, `..`, control characters).
- `src/backend/z_Api/abclass/abclassValidation.js`:
  - `validateParametersObject_()` — shared primitive for all abclass endpoints.
- `src/backend/z_Api/abclass/abclassMutations.js`:
  - `validateMutationClassId_(classId, methodName)` — delegates to the shared
    `validateSafeTrimmedIdentifier_` helper (the same helper the read path's
    `validateIdentifier_` uses), enforcing a string type, non-emptiness, an already-trimmed
    value, and the absence of `/`, `\`, `..` and control characters. Failures throw
    `ApiValidationError` with `method` and `fieldName: 'classId'`, mapping to non-retriable
    `INVALID_REQUEST`. The guard runs before controller delegation, so a whitespace-padded or
    control-character `classId` cannot pass mutation admission while being rejected on reads.
    The controller still performs its own domain classId checks behind it.
  - `validateUpsertABClassParameters_()` — validates parameters object and classId.
  - `validateUpdateABClassParameters_()` — validates parameters object, classId, and forbids protected fields (`classOwner`, `teachers`, `students`, `assignments`).
  - `validateDeleteABClassParameters_()` — validates parameters object and classId.
  - `adaptMetadataRequestError_()` — request-provenance-only adaptation to `ApiValidationError`/`INVALID_REQUEST`; logs `method`/`classId` and rethrows every other failure unchanged.
- Shared identifier helper: `validateSafeTrimmedIdentifier_` (with `hasControlCharacters_`) is
  defined in `src/backend/z_Api/assignmentDefinition/assignmentDefinitionValidation.js` and is
  consumed by both `abclassRead.js` and `abclassMutations.js`.

**Key domain validation rules:**

- `cohortKey` and `yearGroupKey` must be present and non-null on upsertABClass requests.
  The frontend requires strings without coercion; backend `Validate.requireParams` rejects
  null/undefined before metadata validation or side effects. Read and update keys remain nullable.
- On updateABClass, `cohortKey` and `yearGroupKey` are patch fields: true omission preserves
  the stored key, explicit `null` clears it, and a non-null value is stored via
  `String(value)`. An own `undefined` for either key is rejected by
  `ABClassValidation._buildUpdatePatch()` with a `TypeError` before any record read, patch
  application or store write. Because it is a domain failure rather than the metadata
  request-provenance error, `adaptMetadataRequestError_` rethrows it unchanged and the
  envelope stays generic `INTERNAL_ERROR`; it is not adapted to `INVALID_REQUEST`.
- The read-view projection requires each stored assignment's embedded
  `assignmentDefinition.definitionKey` to be a non-empty string. A missing embedded
  definition, or an absent/empty/non-string key, throws a `TypeError` so `getABClass` fails
  as a stored-integrity error (generic `INTERNAL_ERROR`) instead of emitting `null` or an
  absent `assignmentDefinitionKey`. There is no null/absent read fallback.
- `courseLength` must be a positive safe integer on validated upsertABClass and updateABClass writes (`1` through `Number.MAX_SAFE_INTEGER`). Unsafe numeric values are rejected rather than accepted after precision has been lost.
- Constructor and `fromJSON` normalisation retain the existing course-length fallback of `1`; roster initialisation retains its existing current-value fallback. `_parseNullableInt` checks both numeric input magnitudes and parsed results for safety. Prefix parsing of safe values uses the leading numeric prefix (for example, `'3years'` becomes `3` and the string `'1e21'` becomes `1`); an unsafe numeric `1e21` takes the fallback before parsing.
- On updateABClass, `active` must be a boolean or null.
- `classOwner`, `teachers`, `students`, `assignments` are forbidden in updateABClass requests.
- The response mapper (`_normaliseClassPartial`) throws `TypeError` in two cases: a falsy or
  non-object partial document, or a `teachers` field that is not an array. It enforces no plain
  prototype, so an array document is not rejected on that basis (it still needs an array
  `teachers` field); nullable fields are then null-defaulted as described above.
- All model, read, write and transport boundaries apply the shared metadata-domain contract described in [§ Sub-entity: ABClassMetadata](#sub-entity-abclassmetadata) and [§ Validation](#validation).

### Mutation schemas and queued services

Request owner: `src/frontend/src/services/abClass/abClassMutations.zod.ts`.
Service owner: `src/frontend/src/services/abClass/abClassMutationService.ts`.
`UpsertABClassRequest` and `UpdateABClassRequest` derive from their schemas with `z.infer`.

| Field          | Upsert frontend Zod                        | Update frontend Zod                 | Notes                                                                                                                                      |
| -------------- | ------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `classId`      | `ClassIdSchema`                            | `ClassIdSchema`                     | Required own string; `z.string().min(1).refine(isSafeClassId)`: already trimmed, no `/`, `\`, `..`, ASCII 0–31 or 127. No repair/coercion. |
| `cohortKey`    | `configurationShape.cohortKey.unwrap()`    | `z.string().nullable().optional()`  | Upsert requires non-null `z.string()`; update omission preserves, null clears. Empty strings remain accepted.                              |
| `yearGroupKey` | `configurationShape.yearGroupKey.unwrap()` | `z.string().nullable().optional()`  | Same presence/null semantics as `cohortKey`; response/read keys remain nullable.                                                           |
| `courseLength` | `CourseLengthSchema`                       | `CourseLengthSchema.optional()`     | `z.number().int().min(1).max(Number.MAX_SAFE_INTEGER)`; required on upsert, no default/coercion.                                           |
| `active`       | —                                          | `z.boolean().nullable().optional()` | Update-only; omission preserves, null is explicit. Upsert rejects this unknown field.                                                      |
| `metadata`     | `ABClassMetadataSchema.optional()`         | `ABClassMetadataSchema.optional()`  | Shared strict complete snapshot; omission preserves (new-class omission yields backend null), null clears, object replaces whole.          |

- Both schemas pre-check the raw value with `isMutationRecord` before piping to a strict Zod
  object. Only ordinary or null-prototype records are accepted. Every own key must be an allowed
  string key with a non-undefined value; symbols, unknown keys and protected roster/assignment
  fields reject, rather than stripping. The `.optional()` fields do **not** permit own undefined
  at runtime. Required upsert configuration cannot be omitted; upsert reference keys cannot be
  null, unlike nullable read/response and update fields. Nested metadata patches reject
  through the shared schema; successful parsing detaches supplied metadata before it waits.
- Both wrappers finish request parsing **before** calling
  `callApiQueued(method, request, CLASSES_BULK_MUTATION_JOB_NAME)`. That constant is exported
  once by `abClassMutationService.ts` and imported by the reserved-slot metadata writer, so both
  parties enqueue on the same lane symbol rather than duplicated literals; no import cycle
  exists. Omitted properties remain absent, not serialised as null/undefined. This is the
  existing per-job FIFO, shared with class bulk mutations, not a global queue.
- Queue consumers import `services/api/apiQueue.ts` directly; transport and `parseApiResponse`
  live in `services/apiService.ts`.
- Successful inner payloads use `parseApiResponse(ClassPartialSchema, method, data)` and return
  `Promise<ClassPartial>`: metadata is required and nullable, malformed/missing metadata fails,
  parsed metadata is detached, and unrelated response keys strip. Transport failures (including
  `INVALID_REQUEST` and `INTERNAL_ERROR`) propagate; retries are transport-owned.
- Never await these queued wrappers from an active task on
  `CLASSES_BULK_MUTATION_JOB_NAME`: nested same-lane enqueue deadlocks. A reserved-slot owner
  must call `callApi` directly with the shared request schema and response parser.
  `runApiQueuedTask` callbacks are local execution handles, never GAS payloads; they introduce
  no wire schema. Queue/helper ownership is tracked in
  [Frontend shared helpers](../frontend/frontend-shared-helpers-and-abstraction-standards.md#310-abclass-metadata-schema).

### Metadata writer, projection and task

Actual owners (import directly; no facade/barrel):

- `services/dataAnalysis/postAnalysis/metadataProjection.ts` — pure
  `getMetadataRefreshDecision`, shared `compareAssignmentNewestFirst`, `projectAverageScores`
  and `mergeClassMetadata`.
- `services/dataAnalysis/postAnalysis/refreshABClassMetadata.ts` — task entrypoint
  `refreshABClassMetadata(context, now)` and the cheap cached-class gate.
- `services/abClass/abClassMetadataService.ts` —
  `refreshABClassMetadataInQueue(input, now)` and the complete reserved-slot operation.

The shared lifecycle context, decision and outcome shapes are documented once in
[Frontend Data Analysis Response](frontend-data-analysis-response.md#metadata-refresh-execution-contracts).
`refreshABClassMetadata(context: PostAnalysisContext, now)` consumes that shared
`PostAnalysisContext` directly and declares no task-local context type. Its cheap gate reads
only `classFull`; `assignmentDefinitionPartials` is forwarded to the reserved-slot writer, which
re-reads and recomputes from the complete unsliced class. `averagingResult` authorises the run
but is never reparsed or persisted as display scores.

Freshness and calculation:

1. Empty assignment arrays skip with `noAssignments`. Otherwise validate **all** partial
   `updatedAt` values through `CanonicalMetadataTimestampSchema`, select timestamp descending
   and assignment ID ascending (`localeCompare`) for target ties. Never use a display selection.
2. The matching stored assignment ID/timestamp being equal skips as `unchanged` before stale
   checks. Otherwise an older timestamp than its matching entry or any stored recent entry
   skips as `staleSource`. Equal times for different IDs remain eligible. Scores, definition
   changes, roster changes and class-summary timestamps do not manufacture freshness. The three
   task-owned reasons (`noAssignments`, `unchanged`, `staleSource`) are compile-time pinned in
   `postAnalysis.zod.ts` through
   `SKIPPED_REASONS satisfies readonly MetadataRefreshSkipped['reason'][]`, so reason drift
   fails compilation rather than turning a legitimate no-op into a lifecycle parse failure.
3. Only `changed` enters `runApiQueuedTask(CLASSES_BULK_MUTATION_JOB_NAME, ...)`. Once active,
   freshly read through validated `getABClass`, bypassing the query cache, then choose the
   target and gate again from that complete document. Missing class fails; there is no
   recreation/upsert.
4. Before calculation require a live definition partial for **every** fresh class assignment,
   preventing the analyser's missing-definition filter from silently narrowing full scope.
   Build the existing `AveragingAnalyserInput` from the fresh read with only the class-ID
   filter, then make one synchronous `analyseClassSummary()` call, passing the target and
   newest three fresh-class assignments as `{ target, recentAssignments }` options. Standard
   constructor criterion weights are 0.4/0.4/0.2; no display, date, topic, definition or
   custom-weight filters are supplied. Reused definition keys never identify assignment
   instances.
5. Project the existing weighted `perClass` metrics, including weighted `overall`: computed
   retains its number; notAttempted → `N`; error → `E`; excluded → literal `excluded`.
   No rounding, coercion, task-display averaging or averaging of assignment averages occurs.

Replacement and persistence:

- Null metadata yields class averages and exactly one target entry, never history backfill.
  Preserve other recent entries; replace an existing ID at its position or append a new ID,
  stable-sort timestamps descending and keep at most three. Equal-time history retains
  supplied order, not the target-selection ID tie-break. Inputs remain unmodified; the merge
  validates through `NonNullableABClassMetadataSchema` and returns `NonNullable<ABClassMetadata>`,
  so the write path has no nullable-union branch.
- The recent entry copies the target partial's exact canonical `updatedAt`. The injected
  `now: () => string` is invoked only after changed calculations, when preparing a write;
  its value becomes `classAverages.updatedAt` and must satisfy the shared canonical schema.
  It is not an assessment-completion signal and is never a source-timestamp substitute.
- Validate exactly `{ classId, metadata }` with `UpdateABClassRequestSchema`, then call
  `callApi('updateABClass', request)` inside the reserved slot. Do **not** enqueue the
  mutation wrapper onto its own lane. The real
  `parseApiResponse(ClassPartialSchema, 'updateABClass', data)` validates the returned partial;
  only then return `saved` with `confirmedPersistence: true` and `classPartial`.
- The shared `CLASSES_BULK_MUTATION_JOB_NAME` lane covers
  read/recheck/calculation/merge/write/response parsing, preventing same-lane owners from
  interleaving and losing prior recent entries within this session. Failures propagate; transport
  alone owns retries.
- No React Query access, invalidation, manual refetch or UI activation exists in these owners.
  A malformed response may reject after a backend write; a rejected call does not prove that
  nothing persisted.

### Shared lifecycle and feedback (frontend consumers)

`postAnalysis.zod.ts` validates complete class/live definitions/successful averaging context
with matching class identities and serialisable pending/succeeded/skipped/failed outcome data.
`runPostAnalysisTasks.ts` owns ordered unique descriptors and isolated normalised failures;
`postAnalysisTasks.ts` exposes the descriptor factory `createPostAnalysisTaskDescriptors(now)`
returning only the metadata descriptor, with an injected clock, the canonical
`REFRESH_AB_CLASS_METADATA_TASK_ID` and task-owned class/source-version identity through the
shared `sourceVersionSignature()` helper. `hooks/usePostAnalysisTasks.ts` owns post-commit,
mount-local attempt promises, StrictMode reattachment and stale-publication cleanup, not
network cancellation. Its page-level companion `hooks/usePagePostAnalysisTasks.ts` owns the
ready-only eligibility gate and the once-per-mount descriptor list used by both averaging
surfaces. `usePostAnalysisTasks`'s required third argument, `selectedClassId`, tracks class
ownership separately from analysis readiness. Unkeyed tasks use input-context identity
independently of metadata.

ABClass metadata refresh feeds a shared post-analysis lifecycle. Strict succeeded/skipped task
results validate before the descriptor-owned `taskId` is added and outcome data is built;
pending/failed returns become isolated failed outcomes with non-null local Errors. Field tables
and the local, non-wire descriptor/function/Error handles are owned by
[Frontend Data Analysis Response — shared lifecycle](frontend-data-analysis-response.md#shared-post-analysis-lifecycle).

Failed lifecycle outcome data permits `confirmedPersistence: z.literal(true).optional()`
(false/null reject); task returns stay strictly succeeded/skipped. After a parsed confirmed
metadata save, the cached hook attempt includes both class-detail/list invalidations with
`throwOnError: true` and observes both settlements. A refresh failure keeps save confirmation
with a local normalised Error and saved-but-refresh-failed warning copy, and logs the bounded
scalar `confirmedPersistence: true` with the task/class/target identifiers. Persistent warnings
are mount/selected-class/task/source-owned, dismissible, duration zero and cleaned up without
aborting queued writes; a same-class readiness-null context preserves a visible warning and the
pending attempt until navigation or unmount. The notification host is the
`App.useApp().notification` context. Settlement, copy, dismissal and bounded diagnostic contracts
are owned by the linked lifecycle section.

`DataAnalysisService` is synchronous and I/O-free. Helper discovery/status is owned by
[Frontend shared helpers](../frontend/frontend-shared-helpers-and-abstraction-standards.md#928-frontend-abclass-metadata-and-post-analysis).

### Invariants

- Metadata is a frontend-supplied snapshot: the backend does not calculate averages or refresh it
  after assessments; the frontend task is registered with the shared lifecycle and both averaging
  surfaces activate it.
- Absent or corrupt stored metadata has no migration, backfill or repair job. Legacy two-field
  stored snapshots are accepted on read and emitted with three `null` placeholders in memory;
  no read writes stored bytes.
- `deleteABClass` has no metadata field and there is no metadata-specific endpoint.
- Persistence has no transaction emulation, rollback, automatic retry or concurrent-write recovery.
- Frontend warning ownership and copy live in the linked local lifecycle contract.

### Test-only synthetic capability

Corpus policy, profile matrix and commands live in
[Synthetic Test Data](../testing/synthetic-test-data.md); this subsection records only the
capability's contribution to this contract and must not duplicate that guide. This is
generator/test infrastructure only: it does **not** make production metadata accepted by write
requests. Generated non-null snapshots also carry the three new fields as supplied values; see
[Synthetic Test Data § ABClass metadata generator capability](../testing/synthetic-test-data.md#abclass-metadata-generator-capability)
for the five-field generator and raw validator.

Supplied snapshots (no calculation):

- `generateClassMetadata.js` runs once in `generateSyntheticAnalysisGraph()` after assignment
  generation and before transport projection, assigning `metadata` in place on each
  persistence class. It reads no clock and consumes no Faker values, preserving seeds, entity counts,
  assignment timestamps and byte reproducibility.
- Compact profiles use a fixed per-class-index matrix of profile, template and entry count:
  `small` is `null`, numeric/0 entries, `N`/1 entry; `medium` is `E`/2, `excluded`/3,
  `mixed`/1 and numeric/0; and `large-representative` is `null`, numeric/3, `mixed`/2 and
  numeric/1. Every entry's `averages` copies the same fixed four-field template as its
  `classAverages`, drawn from the numeric, all-`N`, all-`E`, all-`excluded` and mixed
  templates.
- `large-full` uses a modulo-five index cycle: `index % 5 === 0` is `null`, otherwise the
  recent count is `(index % 5) - 1` and the template index is `Math.floor(index / 5) % 5`.
- Every non-null snapshot sets `classAverages.updatedAt` to the class's newest generated
  assignment `updatedAt`, including zero-entry variants. Recent entries take their
  `assignmentId`, `assignmentDefinitionKey` and `updatedAt` exactly from real generated
  assignments of that class, newest first. These are supplied snapshot values: no averaging
  is performed and no cross-metric relationship is derived.

Raw views and validation:

- `projectClassTransportViews.toClassPartial()` adds an independently cloned `metadata` value
  to both `transport.classPartials` and `transport.classesById` whenever the persistence class
  owns the field, so pre-metadata stage compositions hold an own `metadata` value.
- `validateClassMetadata.js` checks raw shape, exact keys and score union, canonical timestamp,
  dense zero-to-three entries, unique assignment IDs, newest-first ordering,
  assignment/class/definition linkage, exact source timestamps and three-way
  persistence/partial/full parity, and is invoked by `validateSyntheticAnalysisGraph()`.
- Synthetic snapshots are validated through the `ABClassMetadata.validateMetadata` domain owner;
  both class read schemas require metadata, so class-response parsing retains it.
- `loadBackendModelInputs(profileName)` clones the committed views (including the fifth
  `assignmentDefinitionPartials` view) and adapts them to backend model JSON, retaining partial-only
  assignments and definitions, resolving class-embedded definitions to partial summaries and
  keeping class-embedded submissions redacted. Raw `metadata` is independently cloned. The adapter
  is test-only.

The synthetic corpus protects these contract facts: full/partial read metadata retention;
omission, `null` and whole-replacement across queued update and upsert with own-`undefined`
rejection; `INVALID_REQUEST` versus `INTERNAL_ERROR` error provenance; the canonical `small`
class-2 historical-source boundary; changed writes on both averaging surfaces with a full fresh
read producing no repeat write; and save/refresh feedback with viewport/theme containment and
readiness-null contexts. Test paths are listed in the [File Index](#file-index).

### Known discrepancies

1. **`getABClass` transport includes `courseId` and `assignmentName` on each assignment.**
   Frontend `AssignmentPartialSchema` does not include these fields (Zod `.strip()` mode
   silently removes them). The frontend resolves assignment context (courseId, name)
   from other sources. Zod's default `.strip()` behaviour means extra fields are tolerated, and
   the stripped data is unused by the frontend.

2. **The canonical-UTC timestamp predicate is implemented independently on each side.**
   Backend `Validate.isCanonicalUtcDateTime()` uses a regex plus explicit calendar/leap-year
   checks; frontend `CanonicalMetadataTimestampSchema` uses the same regex plus
   `Date.parse`/`toISOString()` round-trip equality. The current accepted sets agree on the
   tested matrix (invalid calendar/time, offsets, date-only, alternate precision and counter
   suffixes), but they are two implementations of one contract.
   **Risk:** they could diverge on an untested edge year or engine date
   behaviour. The Node parity suite is the guard; do not replace it with a shared runtime import
   from backend code.

3. **Frontend mutation requests deliberately reject backend coercion and extra fields.**
   Frontend upsert accepts reference keys only as non-null strings; update accepts strings or
   null. Backend upsert and update stringify admitted non-null reference values. Backend upsert
   has no blanket unknown/protected-key rejection; update rejects the four protected keys only
   when their values are not undefined and otherwise ignores unknown keys. Frontend raw-record
   checks reject all unexpected own keys (including symbols), non-plain records and every own
   undefined value before queue admission. They require an own `classId`; no coercion or
   defaulting is applied. Both sides accept positive safe-integer numeric `courseLength` and
   safe already-trimmed string `classId`. The typed frontend request boundary is narrower than
   backend admission. The backend own-undefined reference-key `INTERNAL_ERROR` behaviour is
   [documented in Validation](#validation); the wrappers reject that input locally.

4. **Frontend upsert rejects null configuration keys, matching backend required-parameter checks.**
   `UpsertABClassRequestSchema` uses `configurationShape.cohortKey.unwrap()` and
   `configurationShape.yearGroupKey.unwrap()` (both `z.string()`), so explicit null for either
   required key fails schema/service validation before queue admission. Backend
   `ABClassMutationOps.upsertABClass()` rejects null/undefined through `Validate.requireParams`
   before metadata validation or any side effect; its plain `Error` maps to generic
   `INTERNAL_ERROR`, not `INVALID_REQUEST`. Later null-handling assignment branches do not
   bypass it. Read/response keys are nullable, update supports omission/null clearing, and whole
   `metadata` replacement is optional and nullable.

5. **Metadata refresh requires stricter assignment timestamps than the class-read schema.**
   `AssignmentPartialSchema.updatedAt` remains `z.string().nullable()`. The metadata refresh
   decision (`getMetadataRefreshDecision()`) instead parses every assignment's timestamp with
   `CanonicalMetadataTimestampSchema` before choosing a target, even assignments that would
   not win selection. Null, malformed and non-canonical values fail rather than receiving
   clock/default substitution. The stricter parsing is confined to the task boundary so
   timestamp-only freshness comparisons are trustworthy.

6. **Confirmed persistence is distinct from successful frontend refresh.**
   Failed local lifecycle data permits optional literal `confirmedPersistence: true` when either
   required post-save query invalidation rejects; task returns stay succeeded/skipped. The local
   Error is kept separately from safe saved-but-refresh-failed warning copy. The same bounded
   scalar is logged on refresh-failure diagnostics, and feedback ownership is tied to the
   committed selected class rather than analysis readiness; a required third `selectedClassId`
   argument distinguishes same-class readiness-null from genuine navigation. This is a frontend
   execution-state extension; see
   [Frontend Data Analysis Response — settlement](frontend-data-analysis-response.md#confirmed-persistence-and-refresh-settlement).

---

## Baseline averages and student standings

All entries below are delivered. The shape, validation and read normalisation are also described
in [§ Sub-entity: ABClassMetadata](#sub-entity-abclassmetadata); the calculation owner is recorded
in [Frontend Data Analysis Response — class summary contract](frontend-data-analysis-response.md#class-summary-contract).

- **Extended metadata shape**: a non-null `ABClassMetadata` carries three additional nullable
  fields: `baselineAverages` (four scores plus `updatedAt`), `allTaskStandings` and
  `baselineStandings` (each `{ top: StudentStanding[]; bottom: StudentStanding[] }`, where a
  `StudentStanding` carries `studentId`, `studentName`, `scores: AverageScores` and
  `recentAssignmentScores: AverageScores[]` with one score set per newest fresh-class assignment,
  aligned positionally to `ClassSummary.recentAssignments`). Only the whole `metadata` and these
  three new fields may be `null`; no nested score or list entry becomes `null`. Lists are dense
  with zero to three entries. The validator allows the same student in both `top` and `bottom`;
  disjointness is a producer rule.
- **Legacy shape tolerance and null normalisation**: `ABClassMetadata` accepts both the existing
  two-field shape and the extended five-field shape. Validation and defensive copying emit the
  five-field shape, inserting `null` for absent new fields. Reads (`getABClass`,
  `getABClassPartials`, mutation summaries) normalise in memory and never write, repair or
  backfill stored bytes. A present `undefined` for a new field remains invalid; present invalid
  values remain integrity failures. Request provenance and `INVALID_REQUEST` adaptation are
  unchanged.
- **Validator module separation**: nested validation and copying for the three new fields live in
  `src/backend/Models/ABClassMetadataStandings.js`, keeping `ABClassMetadata.js` at or under the
  500-line backend lint gate. `ABClassMetadata` remains the single owner and facade, resolving the
  sibling module inside method bodies for GAS concatenation order.
- **Frontend parity**: `ABClassMetadataSchema` and `NonNullableABClassMetadataSchema` accept both
  the legacy two-field and the current five-field input and emit the five-field shape with three
  plain enumerable `null` placeholders, matching backend read normalisation. `ClassFullSchema`,
  `ClassPartialSchema` and the mutation schemas keep referencing the one schema owner. Standing
  lists are dense zero-to-three arrays, each entry's `recentAssignmentScores.length` matches
  `recentAssignments.length`, and the schema adds no top/bottom disjointness rule, so acceptance
  stays aligned with the backend validator.
- **Snapshot source**: the values are supplied by the frontend `ClassSummary` analyser and written
  by the metadata-refresh task; the backend only validates and stores them and never calculates or
  refreshes them. See
  [Frontend Data Analysis Response — class summary contract](frontend-data-analysis-response.md#class-summary-contract).

---

## File Index

```
Persistence model:         src/backend/Models/ABClass.js
  └── ABClass.toJSON()          — full document shape; representation-aware embedded assignments
  └── ABClass.toPartialJSON()   — partial registry shape
  └── ABClass.serialiseOwner()  — owner serialisation helper
  └── ABClass._serialiseAssignmentsForClass() — partial defs via toPartialJSON(), full assignments via toJSON()

Teacher model:              src/backend/Models/Teacher.js
  └── Teacher.toJSON()          — teacher summary shape

Student model:              src/backend/Models/Student.js
  └── Student.toJSON()          — student shape

Metadata domain owner:      src/backend/Models/ABClassMetadata.js
  └── new ABClassMetadata()/toJSON()  — constructor-owned null default + defensive five-field snapshot
  └── validateMetadata()              — legacy/current top-level shape, dense 0–3 array, unique IDs, newest-first order, new-field delegation
  └── validateClassAverages()         — five-field class summary (four scores + updatedAt)
  └── validateRecentAssignment()      — complete recent entry
  └── validateAverageScores()         — four metric fields
  └── validateAverageScore()          — single 0–5 score or exact N/E/excluded marker
  └── private _checkRecord/_checkArrayKeys/_assertDenseIndex/_validateScoreFields/_validateTimestamp/_copyMetadata helpers

Nested validator module:    src/backend/Models/ABClassMetadataStandings.js
  └── validateBaselineAverages(), validateStandings(), validateStandingList(),
      validateStandingEntry(), validateRecentAssignmentScores()
  └── copyBaselineAverages(), copyStandings(), copyStandingEntry(), copyScoreSet()
  └── reuses facade record/score/array/timestamp rules; resolved inside method bodies

Metadata error type:        src/backend/Utils/ErrorTypes/ABClassMetadataValidationError.js
  └── fieldPath + default inputSource 'model' (extends Error, not ApiValidationError)

Canonical UTC predicate:    src/backend/Utils/Validate.js
  └── Validate.isCanonicalUtcDateTime()  — exact YYYY-MM-DDTHH:mm:ss.sssZ real-calendar predicate

Controller:                 src/backend/y_controllers/ABClassController/
  ├── index.js                          — ABClassController facade
  ├── ABClassValidation.js              — classId/courseLength domain checks; _buildUpdatePatch() (own-undefined reference-key rejection)/_applyPatchToClass(); _validateRequestMetadata() request gate
  ├── ABClassResponseMapper.js          — _toReadView() (legacy read preparation, assignment-definition-key integrity check + metadata projection), _normaliseClassPartial(), _buildClassSummary()
  ├── ABClassPersistence.js             — persistClassAndPartial() prepared full/partial writes + field-scoped roster helpers
  ├── ABClassRoster.js                  — roster refresh; _persistRoster() unchanged-roster skip and field-scoped registry patch
  ├── ABClassMutationOps.js             — upsert/update/delete orchestration; request metadata gate; prepared selective editable partial
  └── ABClassAssignmentOps.js           — assignment mutation operations

API handlers:               src/backend/z_Api/abclass/
  ├── abclassRead.js                    — getABClass_()
  ├── abclassMutations.js               — upsertABClass_(), updateABClass_(), deleteABClass_(), adaptMetadataRequestError_(), validateMutationClassId_()
  └── abclassValidation.js              — validateParametersObject_()

Transport envelope:         src/backend/z_Api/z_apiHandler.js
  └── apiHandler(), ApiDispatcher, ALLOWLISTED_METHOD_HANDLERS

Frontend:
  ├── src/frontend/src/services/googleClassrooms/classPartials.zod.ts
  │     → TeacherSummarySchema, ClassPartialSchema (requires ABClassMetadataSchema),
  │       ClassPartialsResponseSchema
  ├── src/frontend/src/services/googleClassrooms/classPartialsService.ts
  │     → getABClassPartials()
  ├── src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts
  │     → GetABClassRequestSchema, TeacherSummarySchema, StudentSummarySchema,
  │       AssignmentPartialSchema, StudentSubmissionPartialSchema,
  │       StudentSubmissionItemPartialSchema, BaseTaskArtifactPartialSchema,
  │       PartialAssessmentEntrySchema (aliases the shared partialAssessmentResultSchema),
  │       ClassFullSchema (requires ABClassMetadataSchema), ClassFullResponseSchema
  ├── src/frontend/src/services/assignmentAssessment/assignmentReadNormalisation.ts
  │     → normaliseAssignmentRead(), normaliseClassRead() (pure full/partial
  │       read normaliser; each read service performs a root/envelope-only fail-fast
  │       parse and then invokes the normaliser for the single per-item validation pass)
  ├── src/frontend/src/services/assignmentAssessment/assignmentReadItemValidation.ts
  │     → validateFullItem(), validatePartialItem(), corruptItem(), itemErrorPath() (adjacent
  │       pure item/source validation and canonical corruption construction)
  ├── src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts
  │     → getABClass()
  ├── src/frontend/src/services/abClass/abClassMetadata.zod.ts   (shared by both class read schemas)
  │     → CanonicalMetadataTimestampSchema, AverageScoreSchema, AverageScoresSchema,
  │       ClassAveragesSchema, RecentAssignmentSchema, NonNullableABClassMetadataSchema,
  │       ABClassMetadataSchema and inferred types
  ├── src/frontend/src/services/abClass/abClassMutations.zod.ts
  │     → UpsertABClassRequestSchema, UpdateABClassRequestSchema and inferred request types
  ├── src/frontend/src/services/abClass/abClassMutationService.ts
  │     → CLASSES_BULK_MUTATION_JOB_NAME, upsertABClass(), updateABClass(); validate before
  │       the shared lane's enqueue, parseApiResponse(ClassPartialSchema, method, data)
  ├── src/frontend/src/services/abClass/abClassMetadataService.ts
  │     → refreshABClassMetadataInQueue(), MetadataRefreshInput, RefreshOutcome; reserves
  │       the imported CLASSES_BULK_MUTATION_JOB_NAME lane
  ├── src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.ts
  │     → getMetadataRefreshDecision(), compareAssignmentNewestFirst(), projectAverageScores(),
  │       mergeClassMetadata(), MetadataRefreshSkipped, MetadataRefreshDecision
  ├── src/frontend/src/services/dataAnalysis/postAnalysis/refreshABClassMetadata.ts
  │     → refreshABClassMetadata(context: PostAnalysisContext, now); consumes the shared
  │       lifecycle context directly; the reserved-slot writer recomputes from a fresh
  │       complete-class read
  ├── src/frontend/src/services/dataAnalysis/postAnalysis/postAnalysis.zod.ts
  │     → PostAnalysisContextSchema, PostAnalysisTaskResultSchema, PostAnalysisTaskOutcomeDataSchema
  ├── src/frontend/src/services/dataAnalysis/postAnalysis/runPostAnalysisTasks.ts
  │     → ordered runner and local descriptor/result/outcome handles (never wire data)
  ├── src/frontend/src/services/dataAnalysis/postAnalysis/postAnalysisTasks.ts
  │     → REFRESH_AB_CLASS_METADATA_TASK_ID, createPostAnalysisTaskDescriptors(now),
  │       sourceVersionSignature(); metadata-only descriptor factory with task-owned source key
  ├── src/frontend/src/hooks/usePostAnalysisTasks.ts
  │     → mount-owned post-commit attempts/state, required selected-class ownership and post-save refresh settlement
  ├── src/frontend/src/hooks/usePagePostAnalysisTasks.ts
  │     → shared ready-only page eligibility/context wrapper; memoised context and once-per-mount
  │       descriptor list, called directly by both averaging surfaces
  ├── src/frontend/src/hooks/postAnalysisInvalidation.ts
  │     → both required query invalidations; refresh failures log bounded confirmedPersistence: true and return a confirmed-persistence failed outcome
  ├── src/frontend/src/hooks/postAnalysisFeedback.ts
  │     → mount/selected-class/task/source-owned persistent warnings with required App host, dismissal memory and cleanup
  ├── src/frontend/src/services/dataAnalysis/postAnalysis/postAnalysisDiagnostics.ts
  │     → bounded task/class/assignment identifiers, available request correlation and optional confirmedPersistence
  ├── src/frontend/src/services/apiService.ts                 (actual transport owner)
  │     → callApi(), parseApiResponse(); unchanged envelope/retry boundary
  ├── src/frontend/src/services/api/apiQueue.ts               (actual queue owner)
  │     → callApiQueued(), runApiQueuedTask(); callbacks stay local, never wire data
  ├── src/frontend/src/services/abClass/abClassMetadata.zod.spec.ts
  │     → co-located schema suites (plus .detach, .examples and .strict variants)
  ├── src/frontend/src/test/abClass/abClassMetadataFixtures.ts   (test-only)
  │     → canonical metadata profile selectors and clone helper
  └── tests/synthetic-analysis/syntheticABClassMetadataFrontendParity.test.ts   (test-only)
        → frontend Zod ↔ backend domain acceptance/value parity

Synthetic test-only support:
  ├── scripts/synthetic-test-data/generateClassMetadata.js — index/template supplied-snapshot stage; no clock or Faker
  ├── scripts/synthetic-test-data/validateClassMetadata.js — raw shape/linkage/parity checks; invoked by validateSyntheticAnalysisGraph.js
  ├── scripts/synthetic-test-data/toBackendModelInputs.js  — loadBackendModelInputs(profileName); canonical views → backend model inputs
  ├── scripts/synthetic-test-data/apiHandlerRoundTripBridge.js — isolated real-dispatcher dispatch with exact seam restoration
  └── tests/synthetic-analysis/syntheticClassMetadata{Views,Validation,DomainAcceptance,Preservation}.test.ts,
      syntheticBackendModelInputs.test.ts, syntheticABClassMetadataRoundTrip.test.ts

Regression suites:
  ├── tests/api/abclassMutationClassIdRegression.test.js                — mutation classId safe-trimmed admission
  ├── tests/controllers/abclassMutationReferenceKeysRegression.test.js   — own-undefined reference-key rejection and zero writes
  ├── tests/controllers/abclassAssignmentDefinitionKeyReadRegression.test.js — read-boundary definition-key integrity
  ├── tests/api/abclassMetadataApi.test.js                              — wrapper forwarding/adaptation
  └── tests/api/apiHandler/abclassMetadata{Reads,Writes,Errors}.test.js — real read/write/error envelopes
```
