# Contract: ABClass

Root domain object for all data about a single Google Classroom course.
Contains class configuration, assessment-summary metadata, students, teachers and embedded
assignments.

Backend model: `src/backend/Models/ABClass.js`
Metadata domain owner: `src/backend/Models/ABClassMetadata.js`
Collections: `abclass` (main document, keyed by `classId`), `abclass_partials` (registry, keyed by `classId`)
API handlers: `src/backend/z_Api/abclass/abclassRead.js`, `src/backend/z_Api/abclass/abclassMutations.js`
Response mapper: `src/backend/y_controllers/ABClassController/ABClassResponseMapper.js`
Frontend service: `src/frontend/src/services/googleClassrooms/classPartialsService.ts`, `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts`
Frontend Zod: `src/frontend/src/services/googleClassrooms/classPartials.zod.ts`, `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`

Sibling contracts:

- [Contract: AssignmentDefinition](assignment-definition.md) — Assignment definitions are embedded inside ABClass's `assignments` array (as `assignmentDefinitionKey` in transport) and referenced for resolution.
- [Contract: Assignment](assignment.md) — Assignment partials are embedded inside ABClass's `assignments` array.
- [Contract: BackendConfig](backend-config.md) — No direct relationship.
- [Contract: Reference Data](reference-data.md) — ABClass references `cohortKey` and `yearGroupKey` which resolve to Cohorts and YearGroups respectively.
- [Transport envelope](transport-envelope.md) — ABClass API payloads use the shared `apiHandler` envelope; this contract documents only the inner payload.

---

## Persistence

ABClass uses a split persistence model: a main document stored via `ABClass.toJSON()`
and a lightweight registry stored via `ABClass.toPartialJSON()`.

### Collection: `abclass` (main document)

Stored via `ABClass.toJSON()`.

| #   | Field          | Type              | Persistence                      | Transport   | Frontend Zod                                                    | Notes                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------- | ----------------- | -------------------------------- | ----------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `classId`      | `string`          | included                         | unchanged   | `ClassFullSchema.classId: z.string()`                           | Google Classroom course ID. Required, never null.                                                                                                                                                                                                                                                                                         |
| 2   | `className`    | `string\|null`    | included                         | unchanged   | `ClassFullSchema.className: z.string().nullable()`              | Derived from Google Classroom on write path. Null when unset.                                                                                                                                                                                                                                                                             |
| 3   | `cohortKey`    | `string\|null`    | included                         | unchanged   | `ClassFullSchema.cohortKey: z.string().nullable()`              | User-managed. `null` when unset.                                                                                                                                                                                                                                                                                                          |
| 4   | `courseLength` | `number`          | included                         | unchanged   | `ClassFullSchema.courseLength: z.number()`                      | Integer ≥ 1. Default 1 in constructor.                                                                                                                                                                                                                                                                                                    |
| 5   | `yearGroupKey` | `string\|null`    | included                         | unchanged   | `ClassFullSchema.yearGroupKey: z.string().nullable()`           | User-managed. `null` when unset.                                                                                                                                                                                                                                                                                                          |
| 6   | `classOwner`   | `Object\|null`    | included                         | unchanged   | `ClassFullSchema.classOwner: TeacherSummarySchema.nullable()`   | Teacher summary object (see [§ Sub-entities Teacher](#sub-entity-teacher)). Null when unset.                                                                                                                                                                                                                                              |
| 7   | `teachers`     | `Array`           | included                         | unchanged   | `ClassFullSchema.teachers: z.array(TeacherSummarySchema)`       | Array of Teacher summary objects. Empty array when no teachers.                                                                                                                                                                                                                                                                           |
| 8   | `students`     | `Array`           | included                         | unchanged   | `ClassFullSchema.students: z.array(StudentSummarySchema)`       | Array of Student objects (see [§ Sub-entities Student](#sub-entity-student)). Empty array when no students.                                                                                                                                                                                                                               |
| 9   | `assignments`  | `Array`           | included                         | transformed | `ClassFullSchema.assignments: z.array(AssignmentPartialSchema)` | Embedded assignments (see [§ Transport getABClass](#getabclass-read)). `toJSON()` serialises each by its existing definition representation: a partial definition (task-summary array) serialises via `toPartialJSON()`, a genuine full definition keeps full `toJSON()`. Non-empty in normal persisted classes; not a fixed empty array. |
| 10  | `active`       | `boolean\|null`   | included (`this.active ?? null`) | unchanged   | `ClassFullSchema.active: z.boolean().nullable()`                | Tri-state: `true` (active), `false` (inactive), `null` (unknown/unset).                                                                                                                                                                                                                                                                   |
| 11  | `metadata`     | `ABClassMetadata` | included by `toJSON()`           | omitted     | —                                                               | Whole-class and selective editable persistence prepare detached copies before writing (Section 5). API requests do not yet accept it and response mappers still omit it.                                                                                                                                                                  |

Key notes:

- `students` and `assignments` arrays are fully stored in this collection but are heavy,
  so the partials registry exists for list-view performance.
- `assignments` serialisation is representation-aware
  (`ABClass._serialiseAssignmentsForClass()`): an embedded assignment whose definition carries a
  task-summary array (partial definition) keeps its redacted `toPartialJSON()` output, while a
  genuine full assignment keeps full `toJSON()` output and its serializer errors propagate
  unchanged. Standalone `Assignment`/`AssignmentDefinition.toJSON()` remains strict (partial
  definitions still throw). The class serializer performs no fetch, definition fabrication or
  assignment removal, adds no second serializer and uses no catch-and-fallback.
- Class-embedded assignments are normally partial-hydration instances; fully hydrated records live
  in separate `assign_full_*` collections. Whatever representation the model currently holds is
  what `toJSON()` writes.
- `progressTracker` and `_hydrationLevel` are runtime-only flags and never persisted.
- `active` default: `null` (tri-state). Only creation flows explicitly set it.

### Collection: `abclass_partials` (registry)

Stored via `ABClass.toPartialJSON()`.

| #   | Field          | Type              | Persistence                      | Transport | Frontend Zod                                                     | Notes                                                                                                                                                                                                                           |
| --- | -------------- | ----------------- | -------------------------------- | --------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `classId`      | `string`          | included                         | unchanged | `ClassPartialSchema.classId: z.string()`                         | Google Classroom course ID.                                                                                                                                                                                                     |
| 2   | `className`    | `string\|null`    | included                         | unchanged | `ClassPartialSchema.className: z.string().nullable()`            | Null when unset.                                                                                                                                                                                                                |
| 3   | `cohortKey`    | `string\|null`    | included                         | unchanged | `ClassPartialSchema.cohortKey: z.string().nullable()`            | Null when unset.                                                                                                                                                                                                                |
| 4   | `courseLength` | `number`          | included                         | unchanged | `ClassPartialSchema.courseLength: z.number()`                    | Integer ≥ 1.                                                                                                                                                                                                                    |
| 5   | `yearGroupKey` | `string\|null`    | included                         | unchanged | `ClassPartialSchema.yearGroupKey: z.string().nullable()`         | Null when unset.                                                                                                                                                                                                                |
| 6   | `classOwner`   | `Object\|null`    | included                         | unchanged | `ClassPartialSchema.classOwner: TeacherSummarySchema.nullable()` | Teacher summary. Null when unset.                                                                                                                                                                                               |
| 7   | `teachers`     | `Array`           | included                         | unchanged | `ClassPartialSchema.teachers: z.array(TeacherSummarySchema)`     | Teacher summary objects.                                                                                                                                                                                                        |
| 8   | `active`       | `boolean\|null`   | included (`this.active ?? null`) | unchanged | `ClassPartialSchema.active: z.boolean().nullable()`              | Tri-state.                                                                                                                                                                                                                      |
| 9   | `metadata`     | `ABClassMetadata` | included by `toPartialJSON()`    | omitted   | —                                                                | Whole-class writes prepare a detached partial copy before the full-store mutation; a field-scoped roster patch never touches stored metadata (Section 5). API requests do not yet accept it and response mappers still omit it. |

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

| Field          | Type                   | Required | Notes                            |
| -------------- | ---------------------- | -------- | -------------------------------- |
| `classId`      | `string`               | yes      |                                  |
| `className`    | `string\|null`         | yes      | `null` when unset                |
| `cohortKey`    | `string\|null`         | yes      | `null` when unset                |
| `courseLength` | `number`               | yes      | Integer ≥ 1                      |
| `yearGroupKey` | `string\|null`         | yes      | `null` when unset                |
| `classOwner`   | `TeacherSummary\|null` | yes      | Teacher summary object or `null` |
| `teachers`     | `TeacherSummary[]`     | yes      | May be empty array               |
| `active`       | `boolean\|null`        | yes      | Tri-state                        |

Key contract notes:

- The response is built by calling `_buildClassSummary()` which calls
  `abClass.toPartialJSON()` then passes through `_normaliseClassPartial()`.
- `_normaliseClassPartial()` is the normalisation gate: it strips any storage-only
  fields (e.g. `_id`) and ensures `className`, `cohortKey`, `yearGroupKey`,
  `classOwner`, and `active` use `?? null` defaulting.
- Returns an empty array when no partial documents exist.
- This endpoint does **not** pass through `DateUtils.deepConvertDates()` because
  `ABClass.toPartialJSON()` does not contain Date objects (timestamps are not
  part of the partial shape).

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

| Field     | Type     | Required | Notes                                               |
| --------- | -------- | -------- | --------------------------------------------------- |
| `classId` | `string` | yes      | Must be non-empty, already trimmed, no unsafe chars |

**Response:** `ClassFullSchema` or `null`

| Field          | Type                   | Required | Notes                                                             |
| -------------- | ---------------------- | -------- | ----------------------------------------------------------------- |
| `classId`      | `string`               | yes      |                                                                   |
| `className`    | `string\|null`         | yes      |                                                                   |
| `cohortKey`    | `string\|null`         | yes      |                                                                   |
| `courseLength` | `number`               | yes      |                                                                   |
| `yearGroupKey` | `string\|null`         | yes      |                                                                   |
| `classOwner`   | `TeacherSummary\|null` | yes      |                                                                   |
| `teachers`     | `TeacherSummary[]`     | yes      |                                                                   |
| `students`     | `StudentSummary[]`     | yes      | Plain objects: `{ name, email, id }`                              |
| `assignments`  | `AssignmentPartial[]`  | yes      | Array of partial assignment summaries (see assignment view below) |
| `active`       | `boolean\|null`        | yes      | Tri-state                                                         |

**`assignments[]` entry (AssignmentPartial shape):**

| Field                     | Type                         | Required                                | Notes                                                                                                                                           |
| ------------------------- | ---------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `courseId`                | `string`                     | yes (backend) / stripped (frontend Zod) | Present in wire format but stripped by `ClassFullSchema` (Zod `.strip()` default).                                                              |
| `assignmentId`            | `string`                     | yes                                     |                                                                                                                                                 |
| `assignmentName`          | `string`                     | yes (backend) / stripped (frontend Zod) | Present in wire format but stripped by `ClassFullSchema`.                                                                                       |
| `dueDate`                 | `string\|null`               | no (optional)                           | ISO 8601 string or `null`. Zod: `.nullable().optional()`                                                                                        |
| `updatedAt`               | `string\|null`               | yes                                     | ISO 8601 string or `null`.                                                                                                                      |
| `createdAt`               | `string`                     | yes                                     | ISO 8601 string.                                                                                                                                |
| `documentType`            | `string\|null`               | yes                                     | `'SLIDES'` \| `'SHEETS'` or `null`.                                                                                                             |
| `submissions`             | `StudentSubmissionPartial[]` | yes                                     | Array of partial submission objects (see [Contract: Assignment](assignment.md) for full shape).                                                 |
| `assignmentDefinitionKey` | `string`                     | yes                                     | Replaces embedded `assignmentDefinition` object. The frontend resolves definition details from its own `AssignmentDefinitionPartials` registry. |

Key contract notes:

- The response is built by `ABClassResponseMapper._toReadView()`, which:
  1. Calls `assignment.toPartialJSON()` on each assignment to get the lightweight shape.
  2. Strips `_hydrationLevel` and `progressTracker` as defence-in-depth.
  3. Replaces the embedded `assignmentDefinition` object with `assignmentDefinitionKey`
     (extracted from `definitionKey` of the stored definition). This prevents serialisation
     failures when the stored definition is partial (tasks stored as an array).
- All assignments in the response carry partial-hydration data (artifact `content` is `null`,
  assessment `reasoning` is stripped).
- `DateUtils.deepConvertDates()` is called on the entire response before returning from
  the handler. This is required because `google.script.run` prohibits `Date` objects in
  return values (including nested objects).
- Returns `null` when no persisted class document exists for the given `classId`
  (`ClassNotFoundError` caught at the transport boundary).

### `upsertABClass` (write)

Creates a new class or updates an existing one. Always refreshes Google-derived roster data.

| Aspect           | Detail                                                               |
| ---------------- | -------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/abclass/abclassMutations.js` → `upsertABClass_()` |
| Controller       | `ABClassController.upsertABClass()`                                  |
| Response mapper  | `ABClassResponseMapper._buildClassSummary()`                         |
| Frontend Zod     | `ClassPartialSchema` (response validated via class partials flow)    |
| Frontend service | (Called via generic `callApi` in class management flows)             |

**Request:**

| Field          | Type     | Required | Notes                                       |
| -------------- | -------- | -------- | ------------------------------------------- |
| `classId`      | `string` | yes      | No unsafe path characters (`..`, `/`, `\\`) |
| `cohortKey`    | `string` | yes      |                                             |
| `yearGroupKey` | `string` | yes      |                                             |
| `courseLength` | `number` | yes      | Must be integer ≥ 1                         |

**Response:** `ClassPartialSchema` (partial class summary — no students or assignments)

Key contract notes:

- The controller hydrates `classOwner`, `teachers`, and `students` from Google Classroom
  before persisting. `students` is persisted in the main document only (not returned).
- When the class already exists, the controller preserves existing `assignments` while
  refreshing roster data.
- New-class upsert paths set `active` to `true`.
- The response is the partial class summary (no `students` or `assignments`).

### `updateABClass` (write)

Patches editable fields on an existing class. Does **not** refresh Google-derived roster data.

| Aspect           | Detail                                                               |
| ---------------- | -------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/abclass/abclassMutations.js` → `updateABClass_()` |
| Controller       | `ABClassController.updateABClass()`                                  |
| Response mapper  | `ABClassResponseMapper._buildClassSummary()`                         |
| Frontend Zod     | `ClassPartialSchema`                                                 |
| Frontend service | (Called via generic `callApi` in class management flows)             |

**Request:**

| Field          | Type            | Required | Notes                                              |
| -------------- | --------------- | -------- | -------------------------------------------------- |
| `classId`      | `string`        | yes      | No unsafe path characters                          |
| `cohortKey`    | `string`        | no       | Optional patch field                               |
| `yearGroupKey` | `string`        | no       | Optional patch field                               |
| `courseLength` | `number`        | no       | Must be integer ≥ 1 if supplied                    |
| `active`       | `boolean\|null` | no       | Optional patch field. `null` is an explicit value. |

**Forbidden request fields:** `classOwner`, `teachers`, `students`, `assignments` —
all cause `ApiValidationError` with `INVALID_REQUEST`.

**Response:** `ClassPartialSchema`

Key contract notes:

- Only supplied patch fields are updated. Omitted fields retain their stored values.
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

| Field     | Type     | Required | Notes                     |
| --------- | -------- | -------- | ------------------------- |
| `classId` | `string` | yes      | No unsafe path characters |

**Error states:**

| Error              | Code                                                 | Notes                        |
| ------------------ | ---------------------------------------------------- | ---------------------------- |
| Class not found    | `IN_USE`? — actually `RangeError` → `INTERNAL_ERROR` |                              |
| Parameters invalid | `INVALID_REQUEST`                                    | Missing/wrong type `classId` |

**Response:**

| Field                    | Type      | Required | Notes                                                         |
| ------------------------ | --------- | -------- | ------------------------------------------------------------- |
| `classId`                | `string`  | yes      |                                                               |
| `hasDeletedFullClass`    | `boolean` | yes      | `true` when this delete removed the main document collection. |
| `hasDeletedClassPartial` | `boolean` | yes      | `true` when this delete removed the partial registry row.     |

Key contract notes:

- Both persistence layers are removed: the full class collection via
  `dropCollection(classId)` and the `abclass_partials` registry row via
  `deleteOne({ classId })`.
- Repeated deletes are idempotent and still succeed with updated flag values.
- The response does not use `ClassPartialSchema`; it is a plain `{ classId, hasDeletedFullClass, hasDeletedClassPartial }` object.

---

## Sub-entities

### Sub-entity: Teacher

Backend model: `src/backend/Models/Teacher.js`
Frontend Zod: `src/frontend/src/services/googleClassrooms/classPartials.zod.ts` → `TeacherSummarySchema`

`Teacher.toJSON()` emits:

| Field         | Type           | Backend toJSON()                                                                      | Frontend Zod                                                          | Notes                                                                                                                                      |
| ------------- | -------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `email`       | `string\|null` | Always emitted                                                                        | `z.string().nullable()`                                               | Null when email is unset on the model.                                                                                                     |
| `userId`      | `string\|null` | Always emitted                                                                        | `z.string().nullable()`                                               | Google userId. Null when unset.                                                                                                            |
| `teacherName` | `string\|null` | **Conditionally emitted:** omitted when `this.teacherName == null`; present otherwise | `z.string().nullable().optional().transform((value = null) => value)` | The field is entirely absent from the JSON when null. Frontend Zod handles both absent and null states via `.optional()` + `.transform()`. |

Key notes:

- The conditional emission of `teacherName` (absent vs `null`) is a deliberate
  serialisation choice. The frontend Zod schema accommodates both states.
- `Teacher.fromJSON()` detects the presence of `teacherName` in the JSON via
  `'teacherName' in json` and only sets it when present.

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
  - `ClassPartialSchema` — validates the `getABClassPartials` response array entries.
  - `ClassPartialsResponseSchema` — `z.array(ClassPartialSchema)`.
  - `TeacherSummarySchema` — validates teacher summary objects (classOwner, teachers entries).
- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`:
  - `ClassFullSchema` — validates the `getABClass` response.
  - `ClassFullResponseSchema` — `ClassFullSchema.nullable()` (handles null for not-found).
  - `StudentSummarySchema` — validates student objects.
  - `AssignmentPartialSchema` — validates each assignment entry.
  - `TeacherSummarySchema` — duplicated from `classPartials.zod.ts` for self-contained validation.
  - **Cross-reference:** `ClassFullSchema` is consumed by
    `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts` (`AveragingAnalyserInputSchema`)
    where pre-fetched full class documents serve as the primary data source for analysis.

**Backend transport validation:**

- `src/backend/z_Api/abclass/abclassRead.js`:
  - `validateParametersObject_(parameters, 'getABClass')` — validates parameters is a plain object.
  - `validateIdentifier_(classId, 'classId')` — validates classId is a non-empty string, already trimmed, and contains no unsafe characters.
- `src/backend/z_Api/abclass/abclassValidation.js`:
  - `validateParametersObject_()` — shared primitive for all abclass endpoints.
- `src/backend/z_Api/abclass/abclassMutations.js`:
  - `validateMutationClassId_(classId, methodName)` — checks for unsafe path characters (`..`, `/`, `\\`).
  - `validateUpsertABClassParameters_()` — validates parameters object and classId.
  - `validateUpdateABClassParameters_()` — validates parameters object, classId, and forbids protected fields (`classOwner`, `teachers`, `students`, `assignments`).
  - `validateDeleteABClassParameters_()` — validates parameters object and classId.

**Key domain validation rules:**

- `cohortKey` and `yearGroupKey` must be present on upsertABClass requests.
- `courseLength` must be a positive safe integer on validated upsertABClass and updateABClass writes (`1` through `Number.MAX_SAFE_INTEGER`). Unsafe numeric values are rejected rather than accepted after precision has been lost.
- Constructor and `fromJSON` normalisation retain the existing course-length fallback of `1`; roster initialisation retains its existing current-value fallback. `_parseNullableInt` checks both numeric input magnitudes and parsed results for safety. Existing prefix parsing of safe values is unchanged (for example, `'3years'` becomes `3` and the string `'1e21'` becomes `1`); an unsafe numeric `1e21` takes the fallback before parsing.
- On updateABClass, `active` must be a boolean or null.
- `classOwner`, `teachers`, `students`, `assignments` are forbidden in updateABClass requests.
- The response mapper (`_normaliseClassPartial`) throws `TypeError` if a partial document is not a plain object or lacks an array `teachers` field.
- ABClass model construction, restoration, explicit metadata replacement and both serializers enforce the shared strict metadata-domain contract. Controller request validation and response projection are still pending; do not infer API acceptance or response exposure from the model shape.

### Known discrepancies

1. **`Teacher.toJSON()` conditionally omits `teacherName` when null.**
   Frontend `TeacherSummarySchema` tolerates this via `.nullable().optional().transform(...)`.
   **Classification: Fragile** — the optional marker and transform handle both the absent
   and null cases for now, but this is a fragile pattern. If a consumer expects the field
   to always be present, the conditional omission will cause issues. The recommended fix
   would be to make backend always emit `teacherName: null` for consistency, but this has
   not been implemented.

2. **`getABClass` transport includes `courseId` and `assignmentName` on each assignment.**
   Frontend `AssignmentPartialSchema` does not include these fields (Zod `.strip()` mode
   silently removes them). The frontend resolves assignment context (courseId, name)
   from other sources.
   **Classification: Aligned** — Zod's default `.strip()` behaviour means extra fields
   are tolerated, and the stripped data is unused by the frontend. No risk of breakage.

3. **`ClassFullResponseSchema` is `ClassFullSchema.nullable()`**
   The backend returns `null` when the class document does not exist. The frontend
   schema expects this and handles it.
   **Classification: Aligned** — documented contract.

4. **`ClassPartialSchema` and `ClassFullSchema` both redundantly declare `TeacherSummarySchema`.**
   The schema is duplicated in both `classPartials.zod.ts` and `classDetailService.zod.ts`.
   **Classification: Aligned** — intentional to keep each Zod file self-contained and
   avoid cross-file import coupling for a simple schema.

5. **`deleteABClass` response shape (`{ classId, hasDeletedFullClass, hasDeletedClassPartial }`) has no frontend Zod schema.**
   The response is consumed by generic `callApi` without `parseApiResponse` validation.
   **Classification: Aligned** — the delete flow does not require typed validation at
   the transport boundary; the caller receives raw `unknown` and destructures as needed.

6. **ABClass metadata is persisted by whole/editable writes but is not yet accepted or returned by the API.**
   `ABClass.toJSON()` and `toPartialJSON()` emit validated defensive `metadata` snapshots, and the
   Section 5 prepared writes persist equal, detached full/partial copies while the field-scoped
   roster patch leaves stored metadata untouched. However, mutation requests still do not validate
   or accept `metadata`, the response mapper omits it from partial and full class views, and both
   frontend class schemas strip unknown keys (their default Zod object behaviour).
   **Classification: Misaligned** — storage preparation preserves the field today, but the API
   request and response contracts do not yet expose it. Request acceptance/replacement semantics
   land in Section 7 and response exposure in Sections 6/8; no delivered behaviour reconstructs
   metadata from a request.

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

Metadata domain owner:      src/backend/Models/ABClassMetadata.js   (delivered; used by ABClass model boundaries)
  └── new ABClassMetadata()/toJSON()  — constructor-owned null default + defensive plain-snapshot boundary
  └── validateMetadata()              — top-level shape, dense 0–3 array, unique IDs, newest-first order
  └── validateClassAverages()         — five-field class summary (four scores + updatedAt)
  └── validateRecentAssignment()      — complete recent entry
  └── validateAverageScores()         — four metric fields
  └── validateAverageScore()          — single 0–5 score or exact N/E/excluded marker

Metadata error type:        src/backend/Utils/ErrorTypes/ABClassMetadataValidationError.js
  └── fieldPath + default inputSource 'model' (extends Error, not ApiValidationError)

Canonical UTC predicate:    src/backend/Utils/Validate.js
  └── Validate.isCanonicalUtcDateTime()  — exact YYYY-MM-DDTHH:mm:ss.sssZ real-calendar predicate

Controller:                 src/backend/y_controllers/ABClassController/
  ├── index.js                          — ABClassController facade
  ├── ABClassResponseMapper.js          — _toReadView(), _normaliseClassPartial(), _buildClassSummary()
  ├── ABClassPersistence.js             — persistClassAndPartial() prepared full/partial writes + field-scoped roster helpers
  ├── ABClassRoster.js                  — roster refresh and _persistRoster() field-scoped registry patch
  ├── ABClassMutationOps.js             — upsert/update/delete orchestration; prepared selective editable partial
  └── ABClassAssignmentOps.js           — assignment mutation operations

API handlers:               src/backend/z_Api/abclass/
  ├── abclassRead.js                    — getABClass_()
  ├── abclassMutations.js               — upsertABClass_(), updateABClass_(), deleteABClass_()
  └── abclassValidation.js              — validateParametersObject_()

Transport envelope:         src/backend/z_Api/z_apiHandler.js
  └── apiHandler(), ApiDispatcher, ALLOWLISTED_METHOD_HANDLERS

Frontend:
  ├── src/frontend/src/services/googleClassrooms/classPartials.zod.ts
  │     → TeacherSummarySchema, ClassPartialSchema, ClassPartialsResponseSchema
  ├── src/frontend/src/services/googleClassrooms/classPartialsService.ts
  │     → getABClassPartials()
  ├── src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts
  │     → TeacherSummarySchema, StudentSummarySchema, AssignmentPartialSchema,
  │       StudentSubmissionPartialSchema, StudentSubmissionItemPartialSchema,
  │       BaseTaskArtifactPartialSchema, PartialAssessmentEntrySchema, ClassFullSchema,
  │       ClassFullResponseSchema
  └── src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts
        → getABClass()
```

---

## ABClass `metadata` contract — domain, model and prepared persistence delivered; request/transport pending

> **Status: partially delivered.** Section 1 delivered the metadata **domain validation
> capability**, Section 2 the **test-only canonical fixture capability**, Section 3 the model
> boundary, and Section 5 the **prepared whole-class/editable writes, the field-scoped roster
> patch and the approved partial-aware `ABClass.toJSON()` correction**. The controller request
> gate and the transport/response integration are not delivered.
>
> - `src/backend/Models/ABClassMetadata.js` — the dedicated metadata-domain owner, holding the
>   five static validation routines, the constructor/`toJSON()` snapshot boundary and its
>   defensive-copy helpers.
> - `src/backend/Utils/ErrorTypes/ABClassMetadataValidationError.js` — the typed domain error
>   carrying `fieldPath` and a default non-request `inputSource` (`'model'`).
> - `Validate.isCanonicalUtcDateTime()` in `src/backend/Utils/Validate.js` — the exact
>   canonical-UTC timestamp predicate.
> - `scripts/synthetic-test-data/generateClassMetadata.js`,
>   `scripts/synthetic-test-data/validateClassMetadata.js` and the test-only
>   `scripts/synthetic-test-data/toBackendModelInputs.js` adapter — generated raw supplied
>   snapshots, generator-owned raw integrity checks and backend model-input adaptation,
>   exercised by focused synthetic suites (see
>   [§Delivered test-only synthetic capability](#delivered-test-only-synthetic-capability-implemented)
>   below). This capability remains test-only.
>
> **Delivered: model boundaries and prepared store writes. Pending: controller request
> validation, response mapping and API transport.** `ABClass` owns a plain metadata snapshot or
> `null`, normalises actual absence through the metadata constructor, rejects explicitly supplied
> `undefined` or invalid values, and validates/copies metadata during `toJSON()` and
> `toPartialJSON()`. Whole-class and selective editable writes prepare detached, equal
> full/partial metadata copies before the first full-store mutation; an existing registry roster
> row is patched with three serialised fields only and never reads or rewrites its stored
> metadata. These are storage-preparation and model-shape contracts only: no endpoint currently
> accepts or returns `metadata`, and the response mappers and frontend class schemas still omit it.

| Boundary                                             | Status      | Delivered behaviour                                                                                                                                                                   |
| ---------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ABClass model construction/restoration               | Implemented | Actual omission normalises to `null`; explicitly present `undefined` and invalid values fail validation.                                                                              |
| Explicit replacement                                 | Implemented | `setMetadata(value)` validates/copies the complete value before replacing; `null` clears and `undefined` is invalid.                                                                  |
| Model serialisation                                  | Implemented | `toJSON()` and `toPartialJSON()` always emit independently copied, revalidated `metadata`.                                                                                            |
| Whole-class and selective editable write preparation | Implemented | Payloads are prepared before the first full-store mutation; the partial projection is validated against the caller snapshot and rejects with zero writes on invalid/differing values. |
| Field-scoped roster persistence                      | Implemented | An existing registry row is patched with exactly `className`, `classOwner`, `teachers` (stored `_id` filter); its stored metadata is never read, validated, copied or rewritten.      |
| Controller request validation                        | Pending     | API callers are not yet accepted/rejected according to the metadata domain contract.                                                                                                  |
| Response mapping and frontend response validation    | Pending     | Mappers omit the field and frontend class schemas strip unknown fields.                                                                                                               |

The delivered contract adds one compact assessment-summary field, `metadata`, to both the full
ABClass document and the `abclass_partials` registry. The ABClass model's full and partial
serialisers emit it, and Section 5's prepared writes persist equal, detached copies of the
caller's snapshot. It is a
**supplied snapshot**: the backend does not calculate averages, refresh it after assessments,
backfill it, reconcile it between stores beyond an explicit write, or repair corrupt stored
values. Where the
implemented prose above calls `cohortKey`, `yearGroupKey` and `courseLength` "metadata",
delivery must recast those as class-configuration/reference fields so they are not confused
with this literal `metadata` property, and must distinguish this class-level assessment
summary from the unrelated task-artifact `metadata`.

### Sub-entity: ABClassMetadata — delivered domain, model boundary and prepared writes

Backend model: `src/backend/Models/ABClassMetadata.js` (the dedicated metadata-domain owner,
delivered in Section 1; deliberately **not** part of `Models/ABClass.js` or the generic
`Validate`). The shape rules below are enforced by that owner and are wired into the ABClass
model boundary and the Section 5 prepared writes. Both `ABClass.toJSON()` and
`ABClass.toPartialJSON()` include the field; whole-class/editable writes persist detached,
equal copies, and the field-scoped roster patch leaves stored metadata untouched. The response
mapper and API handlers do not yet expose it.

Target notation (contract notation only, not a backend TypeScript requirement):

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

| Field                                                  | Type                 | Shape rules (enforced by `ABClassMetadata`)                                                                                | Notes                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `metadata`                                             | `object\|null`       | Optional on write; nullable as a whole on read                                                                             | Constructor-owned null normalisation via `new ABClassMetadata()`; an **own** `undefined` is invalid (only true omission triggers preserve/new-class-null). `new ABClassMetadata(value)` validates/copies; `toJSON()` returns an independently owned plain snapshot/`null`. |
| `metadata.classAverages`                               | `object`             | Required and complete when `metadata` is non-null; never `null`                                                            | Five own fields: four scores plus `updatedAt`.                                                                                                                                                                                                                             |
| `metadata.classAverages.completeness`                  | `AverageScore`       | Finite number in the inclusive range 0–5, or exactly `'N'`, `'E'`, `'excluded'`                                            | Independent field; no cross-metric inference.                                                                                                                                                                                                                              |
| `metadata.classAverages.accuracy`                      | `AverageScore`       | As above                                                                                                                   |                                                                                                                                                                                                                                                                            |
| `metadata.classAverages.spag`                          | `AverageScore`       | As above                                                                                                                   |                                                                                                                                                                                                                                                                            |
| `metadata.classAverages.overall`                       | `AverageScore`       | As above                                                                                                                   | Retains existing weighted-scoring meaning; **not** a separate arithmetic mean.                                                                                                                                                                                             |
| `metadata.classAverages.updatedAt`                     | `string`             | Exact canonical UTC datetime (see Planned validation); never `null`                                                        | Records when the supplied class summary was updated.                                                                                                                                                                                                                       |
| `metadata.recentAssignments`                           | `RecentAssignment[]` | Dense array of zero to three complete entries; sparse slots, `undefined` entries and incomplete entries are invalid        | Ordered by non-increasing `updatedAt`; equal timestamps keep caller order.                                                                                                                                                                                                 |
| `metadata.recentAssignments[].assignmentId`            | `string`             | Non-empty, already-trimmed, unique within the list; opaque (no numeric coercion, no UUID-only or fixed-length restriction) | Identifies a distinct Google Classroom assignment.                                                                                                                                                                                                                         |
| `metadata.recentAssignments[].assignmentDefinitionKey` | `string`             | Non-empty, already-trimmed; need **not** be unique within the list (definitions are reusable)                              |                                                                                                                                                                                                                                                                            |
| `metadata.recentAssignments[].averages`                | `AverageScores`      | Required and complete; the four score fields exactly, with no nesting and no timestamp                                     | A nested partial object is invalid, not a patch.                                                                                                                                                                                                                           |
| `metadata.recentAssignments[].updatedAt`               | `string`             | Exact canonical UTC datetime; supplied as the corresponding Assignment's existing `updatedAt`, not independently generated | Not compared by the API against the stored Assignment timestamp.                                                                                                                                                                                                           |

`excluded` is stored as the literal string `'excluded'`. This is a compact supplied-snapshot
value and is **not** the frontend `MetricResult` union (which represents exclusion as
`state: 'excluded'` with `value: null`); future consumers must map explicitly between the two
representations. The marker values `N`, `E` and `excluded` are exact, case-sensitive strings
that stay distinct and are never converted to zero (any other spelling, including lower case,
is rejected).

### Model construction, restoration, replacement and serialisation (delivered)

- `new ABClass(options)` distinguishes an absent own `metadata` property from a present value. Absence is normalised by `new ABClassMetadata()` to `null`; present values, including own `undefined`, are passed explicitly to the domain constructor and validated.
- `ABClass.fromJSON(json)` applies the same own-property distinction despite using `Object.create()` for restoration. Legacy full or partial JSON without an own `metadata` field therefore restores as an own `metadata: null`; explicitly present invalid data is rejected, not repaired.
- `ABClass.setMetadata(value)` replaces the whole snapshot or clears it with `null`. Its argument is always explicit, so `undefined` is invalid. Validation/copying completes before assignment, leaving existing state intact on failure.
- `toJSON()` and `toPartialJSON()` always emit `metadata`; each revalidates mutable model state through `ABClassMetadata` and returns an independently owned plain snapshot (or `null`). Input, full output, partial output and model state do not share nested metadata objects or arrays.
- A caller that deletes `model.metadata` or assigns `undefined` has corrupted model state; serialisation rejects it rather than invoking the absence default. Unrelated legacy-field restoration and serialization behaviour remains unchanged.
- These model serialization contracts are complemented by the delivered prepared writes below: whole-class and selective editable writes prepare equal, detached metadata payloads before the first full-store mutation, and the field-scoped roster patch leaves an existing row's stored metadata untouched. Actual I/O failures still retain the existing partial-success risk (full store persisted, partial store not), with no rollback or retry.

### Persistence-operation and lifecycle contract

> **Delivered (Section 5):** prepared whole-class and selective editable writes, the field-scoped
> roster patch, and the approved partial-aware `ABClass.toJSON()` correction for embedded
> assignments. **Pending:** request-level metadata replacement (`upsertABClass` / `updateABClass`
> accepting `metadata`, Section 7) and response mapping/transport (Sections 6/8).

Supplied-snapshot semantics:

- Both `ABClass.toJSON()` and the partial registry projection `ABClass.toPartialJSON()` include
  `metadata`; whole-class and selective editable writes persist equal, independently owned
  copies of the caller's snapshot.
- There is no separate `ABClassPartials` JavaScript model; `ABClass.toPartialJSON()` owns the
  partial representation.
- Assessment runs do not calculate, refresh or clear metadata, so a previously supplied
  snapshot may become stale. The contract does not claim otherwise. Assignment persistence
  preserves the class's existing snapshot.

Delivered prepared writes (`ABClassPersistence`, Section 5):

- `persistClassAndPartial(abClass)` prepares the full and partial payloads **before** the first
  full-store mutation, so a validation failure cannot cause a split-store write. The full payload
  is `abClass.toJSON()` when that method is present, otherwise the supported plain-object input;
  the caller object is never mutated. A complete partial is derived from
  `abClass.toPartialJSON()`.
- Authoritative metadata comes from the caller's own `metadata` property: actual own-property
  absence normalises through `new ABClassMetadata()` to `null`, while a present `undefined` or an
  invalid value is rejected. When the full or partial projection emits `metadata`, that value
  must validate and equal the caller snapshot; an invalid or differing projection rejects with
  **zero** insert/update/save operations. A legacy projection that omits the field is accepted,
  and only the prepared copies gain the equal, independently owned snapshot.
- `ABClassMutationOps.updateABClass()` prepares its complete partial projection before the
  selective full-store `collection.updateOne()`/`save()`, then persists that prepared partial
  afterwards. Its full `$set` stays selective (only the supplied editable fields); it is not a
  whole-class rewrite. A legacy full document may keep metadata absence while the rebuilt partial
  carries `metadata: null`.
- A metadata-bearing legacy record is projected as `null` with no read-time write. A whole-class
  save includes the field; a selective editable-field patch may leave absence in the full
  document while rebuilding the partial with `null`; a field-scoped roster patch changes neither
  store's metadata. Absence and `null` stay semantically equivalent until the next explicit
  metadata or whole-class write.
- Full-store persistence precedes partial-registry persistence. Actual I/O failures retain the
  existing partial-success risk: a full-store failure prevents the partial write, while a
  partial-store failure propagates after the full store has been written. The contract adds no
  transaction emulation, rollback, automatic retry, backfill or concurrent-write recovery.
- Constructor-owned `null` normalisation: the metadata-domain constructor owns the nullable
  field's `null` default. ABClass construction, restoration and legacy partial projection route
  actual absence through it (the `Object.create` restoration path does not inherit constructor
  defaults automatically). Present values are validated at these boundaries, not defaulted, and
  malformed supplied non-null values never become `null` silently.

Pending request-level semantics (Section 7) — no endpoint currently accepts `metadata`:

| Request metadata        | New class                  | Existing class                |
| ----------------------- | -------------------------- | ----------------------------- |
| Omitted                 | Initialise `null`          | Preserve existing metadata    |
| Explicit `null`         | Store `null`               | Clear metadata                |
| Complete valid object   | Store supplied snapshot    | Replace entire metadata value |
| Invalid / own undefined | Reject before side effects | Reject before side effects    |

#### Field-scoped roster persistence (delivered)

The roster refresh keeps its full refresh responsibilities (class name, owner, teachers and
students); it is not narrowed to students-only behaviour. `ABClassRoster._persistRoster()`
patches only the fields it owns in each store:

| Store                 | Delivered existing-document update                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full class collection | `$set` only `className`, `classOwner`, `teachers` and `students`, in the existing forms.                                                                             |
| `abclass_partials`    | `$set` only `className`, `classOwner` and `teachers`. Never includes `students`, `assignments`, `metadata`, `cohortKey`, `yearGroupKey`, `courseLength` or `active`. |

- Registry patch values match the serialised forms produced by `ABClass.toPartialJSON()`:
  `classOwner` through `ABClass.serialiseOwner()` and each teacher through
  `ArrayUtils.serialiseArray()`, retaining the class-name/`null` representation. Only these
  roster fields are built; the metadata-bearing partial projection is not called merely to
  obtain them. The full-store roster payload retains its existing forms and behaviour.
- An existing partial keeps its own metadata exactly as stored, including `null` or field
  absence, and it is never read, validated, copied or rewritten by this patch even when it
  differs from the loaded full class's metadata. Other unrelated fields are also unchanged. The
  permitted `findOne({ classId })` existence lookup is used only to establish existence and the
  row's stored `_id`.
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
- Existing roster-only patches no longer call the whole-row partial upsert path. Whole-class
  saves and explicit metadata writes retain that path and its identical full/partial metadata
  contract. Direct controller operations used by the facade retain their signatures; no separate
  public roster API and no change to upsert/read workflows is introduced beyond this persistence
  boundary.

### Pending transport integration

> **Pending:** no endpoint accepts or returns `metadata`. The response mapper does not project
> it, API handlers do not validate it, and frontend class Zod schemas strip unknown keys. The
> notes below describe target behaviour only.

Metadata contains timestamp **strings** only, so it requires no additional
`DateUtils.deepConvertDates()` conversion in the partial-list or mutation-summary responses.
The existing full-read date-conversion behaviour for the other ABClass fields is preserved.

#### `getABClassPartials` (`Not implemented`)

- Return `metadata` on every row, including explicit `null` for legacy absence.
- Preserve the registry-only read path and the existing empty-list behaviour: metadata must
  not introduce full-class reads, assignment hydration, definition lookups or upstream API
  calls on this path.
- Invalid stored metadata fails the request; do not drop the row or fall back to a full-class
  fetch.
- `ABClassResponseMapper._normaliseClassPartial()` is the single stored-partial metadata
  normalisation/validation gate: it routes legacy absence through the metadata-domain
  constructor and rejects present invalid metadata as an integrity failure. Its existing
  reuse by `_buildClassSummary()` covers mutation summaries; no duplicate metadata pass is
  added in `getAllClassPartials()`.
- On reconciliation, replace the current key-note rationale that "timestamps are not part of
  the partial shape": metadata introduces timestamps, but they are validated strings rather
  than live `Date` objects, so no additional `DateUtils.deepConvertDates()` call is needed.

#### `getABClass` (`Not implemented`)

- Return `metadata` in the full read view using the same shape and validation.
- An absent class still returns top-level `null`, which is distinct from an existing class
  with `metadata: null`.
- Existing assignment redaction and definition-key projection are preserved.

#### `upsertABClass` (`Not implemented`)

- Existing required fields and roster-refresh behaviour remain unchanged.
- The returned partial summary contains `metadata`.
- Existing assignment and active-state preservation rules remain unchanged.

#### `updateABClass` (`Not implemented`)

- Metadata is an additional optional editable field. Omission preserves it; explicit `null`
  clears it; a complete object replaces it. Partial nested objects are invalid, not patches.
- A rejected mixed patch must not apply any of its other fields.
- No roster refresh is introduced. The returned partial summary contains `metadata`.
- Existing missing-class and protected-field behaviour remains unchanged.

#### `deleteABClass` (`Not implemented`)

- The existing deletion flags and removal of both stores remain unchanged. No metadata field
  is added to this response and no metadata-specific endpoint is introduced.

#### Optional write versus always-nullable read (`Not implemented`)

- On write, `metadata` is optional: true omission of the own property invokes
  preserve/new-class-null behaviour, while supplying the property with value `undefined`
  (or any other invalid value) is rejected.
- On read, `metadata` is always emitted by `getABClassPartials` and `getABClass`, and is
  nullable as a whole. Legacy absence is normalised to explicit `null`; no other field in the
  metadata shape may be `null`.

### Validation — domain and model boundaries delivered; request/transport integration pending

> **Status: partially delivered.** The five routines below exist today as static methods on
> `src/backend/Models/ABClassMetadata.js` and are exercised directly by focused backend tests.
> ABClass model construction, restoration, explicit replacement and both serializers now use
> the domain boundary; controller request validation and transport adaptation remain pending.

One shared domain implementation owns the metadata rules:

| Routine                                    | Delivered behaviour (static on `ABClassMetadata`)                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `validateAverageScore(value, context)`     | Enforce the exact finite 0–5 / `'N'` / `'E'` / `'excluded'` union.                                                           |
| `validateAverageScores(scores, context)`   | Require all four own metric fields and validate each; reject unexpected fields.                                              |
| `validateClassAverages(value, context)`    | Require exactly the four scores plus valid `updatedAt`; reuse score validation without rejecting the permitted timestamp.    |
| `validateRecentAssignment(value, context)` | Require exactly both identifiers, complete `averages` and valid `updatedAt`.                                                 |
| `validateMetadata(value, context)`         | Accept `null`; otherwise enforce complete shape, dense zero-to-three array, unique assignment IDs and newest-first ordering. |

Ownership and strictness rules:

- **Owner:** `src/backend/Models/ABClassMetadata.js`, shared by the ABClass model and intended
  for controller/response-mapper use. The five routines are kept out of the
  existing ABClass model and out of the generic `Validate`; the domain implementation must not
  be duplicated in transport helpers.
- `validateClassAverages` checks its own exact five-field record, passes an extracted
  four-field score record to `validateAverageScores`, and validates its timestamp separately.
- All metadata routines reuse one local domain record/required-field/allowed-key check rather
  than duplicating those checks per shape. Reuse `Validate` primitives where suitable.
- **Delivered boundary API:** `new ABClassMetadata()` owns the absent-value `null` default;
  `new ABClassMetadata(value)` validates/copies explicit input and rejects explicit
  `undefined`. `toJSON()` revalidates its owned value and returns an independently owned plain
  snapshot/`null`; the five named validators are static routines. Internal checks are
  centralised in the private `_checkRecord`, `_validateScoreFields`, `_validateTimestamp` and
  `_copyMetadata` helpers.
- **Delivered:** ABClass construction/restoration, `setMetadata(value)`, `toJSON()` and
  `toPartialJSON()` use the domain boundary as described under Model construction, restoration,
  replacement and serialisation.
- **Pending:** controller request validation and response-mapper boundaries. They must
  distinguish actual own-property absence before invoking the constructor default.

The following strictness rules are enforced by the delivered domain owner:

- Every listed property of a non-null metadata object is required and must be an **own**
  property. Only the top-level `metadata` value may be `null`; no metric, `classAverages`,
  entry, `averages`, identifier or timestamp may be `null`.
- Nested objects must be ordinary data records (`Object.prototype` or a null prototype
  accepted); arrays, `Date` objects, class instances and values requiring coercion are
  rejected.
- Unexpected own fields in metadata or its nested objects are rejected, including
  misspellings and `lastAssessedAt`. This does **not** introduce an unrelated blanket
  unknown-key rule for existing ABClass requests.
- The recent array is dense: sparse slots, `undefined` entries and incomplete entries are
  invalid.
- Scores: numeric zero and fractions are valid; no coercion, truncation, rounding or
  percentage conversion is performed. Each field is validated independently; this cycle does
  not derive `overall`, inspect weightings or infer cross-metric relationships.
- Ordering: entries must be ordered by non-increasing `updatedAt`. Equal timestamps are valid
  and retain caller-supplied order; no additional tie-break or sorting is imposed.
  `assignmentId` is unique within the list; `assignmentDefinitionKey` need not be. Both
  identifiers are non-empty strings already trimmed and opaque. There is no enforced
  relationship between the class-summary timestamp and the entry timestamps.

#### Canonical timestamp predicate — delivered (`Validate.isCanonicalUtcDateTime`)

- **Owner (delivered):** the generic predicate `isCanonicalUtcDateTime(value)` in
  `src/backend/Utils/Validate.js`, reused by the metadata-domain validator through its private
  `ABClassMetadata._validateTimestamp(value, context)` helper.
- **Exact contract:** a metadata timestamp must be an exact canonical UTC ISO datetime of
  the form `YYYY-MM-DDTHH:mm:ss.sssZ`, with a real calendar date (Gregorian leap-year rules,
  including the century/non-quadricentennial exceptions, are enforced) and valid time
  components. Live `Date` objects, date-only strings, timezone offsets, non-canonical precision
  and counter-suffixed submission timestamps are rejected.
- **Distinction from the existing helper:** `isIsoDateTimeString_` in
  `src/backend/z_Api/assignmentDefinition/assignmentDefinitionPartialRowValidation.js`
  is **not** the target contract. It accepts timezone offsets and is owned by the later
  transport layer, which model-domain validation must not depend on. Leave that existing
  helper and its broader contract unchanged; record this distinction and cross-reference the
  new predicate in the `api-layer.md` helper entry.

#### Provenance and error rules — error type delivered; request tagging/transport adaptation pending

- **Delivered:** the domain validator reports failures through
  `ABClassMetadataValidationError`
  (`src/backend/Utils/ErrorTypes/ABClassMetadataValidationError.js`), which carries a
  `fieldPath`, appends it to the message as `"<message> (<fieldPath>)"`, and defaults to
  non-request provenance via `inputSource = 'model'`. It extends `Error` and does **not**
  inherit from `ApiValidationError` (and never throws one). Model restoration, stored-partial
  validation, serialisation and projection therefore never acquire the request tag; only an
  explicit request-time tagging step would set `inputSource: 'request'`.
- **`Not implemented`:** supplied request metadata is fully validated **before the first
  mutation side effect**, including roster refresh or any database write.
- **`Not implemented`:** `ABClassValidation._validateRequestMetadata(parameters)` invokes the
  shared domain validator for explicitly supplied metadata at the start of each controller
  mutation, before any record read, roster refresh or write, and is the only caller that tags
  failures with `inputSource: 'request'`.
- **`Not implemented`:** mutation transport helpers translate only this error type, with request
  provenance, into `ApiValidationError`; all other exceptions propagate unchanged.
- Invalid caller-supplied metadata returns the existing `INVALID_REQUEST` envelope, with an
  actionable field path included in `error.message`. No new `fieldName`, `details` payload or
  other envelope-shape change is authorised. Invalid persisted/model metadata is an internal
  integrity failure and returns the existing `INTERNAL_ERROR` treatment, not
  `INVALID_REQUEST`.
- Exceptions from persistence, upstream services and internal wiring are not caught and
  reclassified as caller validation errors. The domain layer never throws transport errors
  and the transport layer never evaluates nested domain rules; no exception to the canonical
  validation-ownership policy or dispatcher change is needed.

#### Validation scope limits — domain/model and prepared writes delivered; request/transport boundaries pending

> **Status: partially delivered.** The domain owner and ABClass model enforce structural
> validation and defensive copying at construction, restoration, replacement and
> serialization, and the Section 5 prepared writes validate/copy metadata before the first
> full-store mutation. Request and mapper boundaries remain pending.

- Validation must not repair metadata, silently remove entries, reorder it, calculate scores,
  stamp dates or fetch referenced entities.
- This is **structural** contract validation only. The API does not verify identifier
  existence, class membership, equality to a stored Assignment timestamp, mathematical
  consistency, or that the entries are the actual three most recently assessed assignments.
  Supplied snapshot accuracy remains the writer's responsibility.
- Neither the model nor its outputs retain shared mutable aliases that let caller, request or
  returned-object mutation change another representation; values are preserved by defensive
  copying at ownership boundaries.
- Invalid metadata fails ABClass restoration even if later code intends to replace it; no
  restoration bypass is provided. Request replacement ordering and API repair behaviour remain
  pending with controller integration.
- Constructors/restoration, explicit metadata replacement and metadata-bearing serialization
  use the same authoritative rules; mutable metadata cannot bypass validation at those model
  boundaries. Whole-object write preparation is delivered (Section 5); response mapping remains
  pending.
- A field-scoped roster patch of an existing partial is **not** a metadata-bearing write. It
  must not use, validate, copy or rewrite the stored metadata value; the existence lookup
  required by the missing-partial path is unaffected.

### Planned frontend position (`Not implemented`)

- This cycle is backend-only, including its test infrastructure. No frontend source, schema
  or test changes are planned, and no frontend reporting/layout work is authorised.
- The existing frontend Zod schemas (`ClassFullSchema`, `ClassPartialSchema`) use Zod's
  default `.strip()` behaviour, so they silently strip the new `metadata` field from
  responses. Existing frontend synthetic consumers therefore continue to work with the extra
  field, and parse success is not sufficient evidence of metadata correctness (see the
  synthetic fixture capability in `docs/developer/testing/synthetic-test-data.md`).

### Planned exclusions (`Not implemented`)

- No calculation of averages or automatic refresh of metadata after assessments.
- No eager migration, backfill or repair job for absent or corrupt stored metadata.
- No new metadata-specific endpoint; `deleteABClass` gains no metadata field.
- No transaction emulation, rollback, automatic retry or concurrent-write recovery.
- No layout specification: no frontend surface or workflow changes.

### Delivered test-only synthetic capability (Implemented)

> **Status: `Implemented`, test-only** (Section 2). The canonical corpus generates and
> validates raw class `metadata` supplied snapshots and adapts canonical views into backend
> model inputs. This is generator/test infrastructure only: it does **not** make production
> metadata accepted by API requests or exposed through API responses. Section 3 subsequently
> wired the domain into ABClass model construction/restoration and serialization; Section 5
> delivered prepared whole-class/editable writes and the field-scoped roster patch. API request
> acceptance and response mapping remain pending. Corpus policy, profile matrix and commands live in
> [Synthetic Test Data](../testing/synthetic-test-data.md); this subsection records only the
> capability's contribution to this contract and must not duplicate that guide.

Supplied snapshots (no calculation):

- `generateClassMetadata.js` runs once in `generateSyntheticAnalysisGraph()` after assignment
  generation and before transport projection, assigning `metadata` in place on each
  persistence class. It reads no clock and consumes no Faker values, so seeds, entity counts,
  assignment timestamps and byte reproducibility are unchanged.
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

Raw views, parity and independent validation:

- `projectClassTransportViews.toClassPartial()` adds an independently cloned `metadata` value
  to both `transport.classPartials` and `transport.classesById` whenever the persistence class
  owns the field, so pre-metadata stage compositions never acquire an own
  `metadata: undefined`.
- `validateClassMetadata.js` checks raw shape, exact keys and score union, canonical timestamp,
  dense zero-to-three entries, unique assignment IDs, newest-first ordering,
  assignment/class/definition linkage, exact source timestamps and three-way
  persistence/partial/full parity, and is invoked by `validateSyntheticAnalysisGraph()`.
- The focused synthetic suites validate every raw snapshot view through the real
  `ABClassMetadata.validateMetadata` domain owner, because frontend schema parsing strips
  `metadata`. This is structural contract validation only: no identifier existence, class
  membership, stored-Assignment timestamp equality or "three most recent" claim is verified
  live.

Test-only backend model-input adapter:

- `loadBackendModelInputs(profileName)` clones the committed views (including the fifth
  `assignmentDefinitionPartials` view) and adapts them to backend model JSON. It retains all
  partial-only assignments and definitions, resolves class-embedded definitions to partial
  summaries, and leaves standalone full definitions with their keyed tasks and freshness
  fields intact; class-embedded submissions stay redacted. Raw `metadata` is independently
  cloned, and no returned representation shares mutable nodes.
- The adapter is test-only: production `src/backend` source never imports it.

### File index additions — delivered domain primitives vs planned integration

Delivered in Section 1 (domain validation capability; subsequently wired into ABClass model
construction/restoration and serialization in Section 3):

```
Metadata domain owner (delivered): src/backend/Models/ABClassMetadata.js       — five static validators, constructor/`toJSON()` snapshot boundary, _checkRecord/_copyMetadata helpers, constructor-owned null default
Error type (delivered):            src/backend/Utils/ErrorTypes/ABClassMetadataValidationError.js — fieldPath + default inputSource 'model'; extends Error, not ApiValidationError
Utility (delivered):               src/backend/Utils/Validate.js               — isCanonicalUtcDateTime()
```

Delivered in Section 2 (test-only synthetic capability; generated fixtures and a test-only
adapter, not production storage or transport):

```
Generator stage (delivered):   scripts/synthetic-test-data/generateClassMetadata.js — index/template supplied-snapshot stage; no clock or Faker
Integrity helper (delivered):  scripts/synthetic-test-data/validateClassMetadata.js — raw shape/linkage/parity checks; invoked by validateSyntheticAnalysisGraph.js
Stage integration (delivered): scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js, projectClassTransportViews.js, validateSyntheticAnalysisGraph.js — thin composition/projection/validation wiring
Test-only adapter (delivered): scripts/synthetic-test-data/toBackendModelInputs.js — loadBackendModelInputs(profileName); canonical views → backend model inputs
Focused suites (delivered):    tests/synthetic-analysis/syntheticClassMetadata{Views,Validation,DomainAcceptance,Preservation}.test.ts, tests/synthetic-analysis/syntheticBackendModelInputs.test.ts, tests/synthetic-analysis/backendModelInputAssertions.js, tests/syntheticModelInputs.node.test.js, tests/synthetic-analysis-stress/syntheticClassMetadataFullLarge.test.ts
```

Delivered in Section 5 (prepared writes, field-scoped roster patch and the approved
partial-aware class serialisation; production storage behaviour, not transport):

```
Whole-write preparation (delivered):  src/backend/y_controllers/ABClassController/ABClassPersistence.js — persistClassAndPartial(); _prepareClassAndPartial(), _prepareClassPartial(), _metadataCopy(), _validatePreparedMetadata(), _writePreparedClassPartial(), _prepareRosterPartial(), _writePreparedRosterPartial()
Selective editable write (delivered): src/backend/y_controllers/ABClassController/ABClassMutationOps.js — updateABClass() prepares the complete partial before the selective full $set/save
Roster orchestration (delivered):      src/backend/y_controllers/ABClassController/ABClassRoster.js — _persistRoster() prepares the registry operation before the full roster write
Embedded assignment serialisation (delivered): src/backend/Models/ABClass.js — _serialiseAssignmentsForClass(): partial definitions via toPartialJSON(), genuine full assignments via toJSON()
Focused suites (delivered):    tests/models/abclassEmbeddedAssignmentSerialisation.test.js, tests/controllers/abclassEmbeddedAssignmentPersistence.test.js, tests/controllers/abclassMetadataPersistence.test.js, tests/controllers/abclassMetadataEditablePersistence.test.js, tests/controllers/abclassRosterPersistence.test.js
```

Still pending (controller request validation and transport/response integration):

```
Controller request gate (planned): src/backend/y_controllers/ABClassController/ABClassValidation.js — _validateRequestMetadata(parameters)
Response mapper (planned):         src/backend/y_controllers/ABClassController/ABClassResponseMapper.js — metadata projection in _normaliseClassPartial()/_toReadView()
Transport adaptation (planned):    src/backend/z_Api/abclass/abclassMutations.js — request-provenance error adaptation
```

---

## Planned companion cleanup — Teacher serialisation and documentation corrections (`Not implemented`)

> **Status: `Not implemented`.** This is a separate, bounded companion cleanup approved
> during action planning (see `docs/plans/SPEC.md` → "Agreed companion cleanup — Teacher
> serialisation and documentation"). It is independent of the planned ABClass `metadata`
> contract above. The Teacher output correction is not implemented; the two documentation
> corrections describe existing source behaviour. Existing implemented sections and the
> separate planned-metadata entries are retained until reconciliation; those planned
> entries remain `Not implemented`. This section makes no claim that the new Teacher
> serialisation behaviour is live.

### Planned `Teacher.toJSON()` always emits `teacherName` (`Not implemented`)

Target change: `Teacher.toJSON()` (`src/backend/Models/Teacher.js`, currently 111 lines) always
emits its own `teacherName` property, preserving a supplied name and emitting the constructor's
existing `null` value when no name is set.

| Field         | Type           | Implemented toJSON()                         | Planned toJSON() (`Not implemented`) | Frontend Zod                                                          | Notes                                              |
| ------------- | -------------- | -------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------- |
| `email`       | `string\|null` | Always emitted                               | Unchanged                            | `z.string().nullable()`                                               | Null when unset.                                   |
| `userId`      | `string\|null` | Always emitted                               | Unchanged                            | `z.string().nullable()`                                               | Null when unset.                                   |
| `teacherName` | `string\|null` | **Conditionally emitted:** omitted when null | Always emitted; `null` when unset    | `z.string().nullable().optional().transform((value = null) => value)` | Own-property output replaces conditional omission. |

Scope constraints (`Not implemented`):

- The correction applies everywhere the shared Teacher serialiser is used — every
  `Teacher.toJSON()` consumer, including ABClass `classOwner` and `teachers` serialisation and
  any other call site — not only in ABClass.
- The always-present property guarantee attaches to `Teacher` instances. Legacy plain-object
  `teachers[]` entries restored by ABClass remain plain and pass through existing array
  serialisation unchanged until replaced by direct construction or roster refresh. Do not
  introduce broader teacher-array hydration or migration for this correction.
- Normal writes/roster refreshes serialise nameless Teacher instances with explicit
  `teacherName: null`. This is expected write-through behaviour, not permission for
  eager rewriting; existing raw entries acquire the property only when actually
  replaced/re-serialised through the shared Teacher helper.
- `Teacher.fromJSON()`, the constructor and the setters remain unchanged. Legacy input with no
  `teacherName` still restores with the constructor-owned `null` value and then serialises with
  an explicit `teacherName: null`.
- No second default is added in the serialiser; existing raw stored registry teachers are not
  rewritten; stored teachers are not eagerly migrated; accepted legacy input is not tightened.
- Existing frontend optional/nullable Teacher schemas (`TeacherSummarySchema` in both
  `classPartials.zod.ts` and `classDetailService.zod.ts`) remain unchanged and continue to accept
  both legacy absence and the new explicit `null` output.
- Red-first backend tests are planned for own-property null output, unchanged named output,
  legacy missing-name restoration and null/named round trips, plus ABClass owner and
  teacher-array serialisation through the real model helpers. `tests/models/teacher.test.js`
  (180 lines) is the existing suite. Named Teacher unit cases call
  `loadSyntheticAnalysisProfile('small', 'classPartials')` (a frozen array); the class
  source view is `loadSyntheticAnalysisProfile('small', 'classesById')` (a frozen
  object keyed by classId). Clone before mutation; neither call returns a `transport`
  wrapper. ABClass owner/teacher-array cases use `loadBackendModelInputs('small')`
  from `scripts/synthetic-test-data/toBackendModelInputs.js`, selecting its adapted
  `classesById[classId]` roster JSON. Explicitly materialise canonical teacher
  inputs with `Teacher.fromJSON()` when composing array cases that exercise the shared
  Teacher serialiser; ABClass restoration itself does not hydrate those plain entries.
  Null/legacy cases are local clones of the canonical inputs.
- Update the existing omission-based assertions in that suite (nameless round-trip
  equality and explicit omission test) and in
  `tests/models/teacherStudentSubmissionCoverage.test.js` (281 lines; nameless
  serialisation equality) to require own `teacherName: null` in the red phase.
- On reconciliation, known discrepancy 1 above (`Teacher.toJSON()` conditionally omits
  `teacherName` when null) is resolved by this change. Update the implemented Teacher
  field-table row and conditional-emission key notes as well as that discrepancy, and
  document the always-present/null contract in `Teacher.toJSON()` JSDoc. Remove the
  resolved fragile entry and renumber the four remaining intentional entries without
  changing their contracts.

### Planned factual ABClass documentation corrections (`Not implemented`)

Two factual documentation corrections are recorded here for later reconciliation. They change no
behaviour; the inaccurate statements identified below must be corrected to match the source.

1. **Full class storage collection name.** The implemented prose states that full class
   documents live in a fixed `abclass` collection (see [Persistence](#persistence)). The correct
   statement is that full class storage uses per-class collections named by `classId`;
   `abclass_partials` remains the fixed single registry name. Correct every implemented
   occurrence, including the `Collections:` header and main-collection section heading.
2. **`deleteABClass` not-found claim.** The `deleteABClass` section above claims deletion of an
   absent record fails. That claim is incorrect: deletion of absent stores succeeds with the
   existing flag object. A missing registry row yields `hasDeletedClassPartial: false`.
   The current controller sets `hasDeletedFullClass: true` after any non-throwing drop,
   including the vendor's `false` return for an absent collection; only the recognised
   missing-collection exception leaves that flag false. The vendor's ordinary absent
   path returns false rather than throwing, so a repeated delete reports the full flag
   true. The exception guard is not taken by that normal absent result; every
   non-throwing delete currently sets the full flag true. Correct every affected
   implemented statement: the error row, flag table
   and key notes, plus the matching `deleteABClass` idempotency statement in
   `docs/developer/backend/api-layer.md`, to describe this actual quirk without changing
   deletion behaviour or conflating it with `updateABClass`'s missing-class error.

The user explicitly authorised deferring the full-collection flag correction to a separate
implementation round via the question tool. [Issue #332](https://github.com/h-arnold/AssessmentBot/issues/332)
contains the evidence, reproduction, suggested boolean-return fix and red-first tests.
The current metadata/Teacher cycle documents, but must not fix, that flag.

### Known discrepancies intentionally unchanged

The remaining four known discrepancies above are intentional contracts, not implementation
deferrals, and are left unchanged:

- extra assignment wire fields (`courseId`, `assignmentName`) stripped by the frontend schemas;
- nullable full-class not-found responses (`ClassFullResponseSchema`);
- intentionally duplicated `TeacherSummarySchema` across the two frontend Zod files;
- unparsed/unused frontend `deleteABClass` deletion flags.
