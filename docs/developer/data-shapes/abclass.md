# Contract: ABClass

Root domain object for all data about a single Google Classroom course.
Contains class metadata, students, teachers, and partial assignment summaries.

Backend model: `src/backend/Models/ABClass.js`
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

---

## Persistence

ABClass uses a split persistence model: a main document stored via `ABClass.toJSON()`
and a lightweight registry stored via `ABClass.toPartialJSON()`.

### Collection: `abclass` (main document)

Stored via `ABClass.toJSON()`.

| #   | Field          | Type            | Persistence                      | Transport   | Frontend Zod                                                    | Notes                                                                                                                     |
| --- | -------------- | --------------- | -------------------------------- | ----------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | `classId`      | `string`        | included                         | unchanged   | `ClassFullSchema.classId: z.string()`                           | Google Classroom course ID. Required, never null.                                                                         |
| 2   | `className`    | `string\|null`  | included                         | unchanged   | `ClassFullSchema.className: z.string().nullable()`              | Derived from Google Classroom on write path. Null when unset.                                                             |
| 3   | `cohortKey`    | `string\|null`  | included                         | unchanged   | `ClassFullSchema.cohortKey: z.string().nullable()`              | User-managed. `null` when unset.                                                                                          |
| 4   | `courseLength` | `number`        | included                         | unchanged   | `ClassFullSchema.courseLength: z.number()`                      | Integer ≥ 1. Default 1 in constructor.                                                                                    |
| 5   | `yearGroupKey` | `string\|null`  | included                         | unchanged   | `ClassFullSchema.yearGroupKey: z.string().nullable()`           | User-managed. `null` when unset.                                                                                          |
| 6   | `classOwner`   | `Object\|null`  | included                         | unchanged   | `ClassFullSchema.classOwner: TeacherSummarySchema.nullable()`   | Teacher summary object (see [§ Sub-entities Teacher](#sub-entity-teacher)). Null when unset.                              |
| 7   | `teachers`     | `Array`         | included                         | unchanged   | `ClassFullSchema.teachers: z.array(TeacherSummarySchema)`       | Array of Teacher summary objects. Empty array when no teachers.                                                           |
| 8   | `students`     | `Array`         | included                         | unchanged   | `ClassFullSchema.students: z.array(StudentSummarySchema)`       | Array of Student objects (see [§ Sub-entities Student](#sub-entity-student)). Empty array when no students.               |
| 9   | `assignments`  | `Array`         | included                         | transformed | `ClassFullSchema.assignments: z.array(AssignmentPartialSchema)` | Array of Assignment partials (see [§ Transport getABClass](#getabclass-read)). Always [] at rest in the ABClass document. |
| 10  | `active`       | `boolean\|null` | included (`this.active ?? null`) | unchanged   | `ClassFullSchema.active: z.boolean().nullable()`                | Tri-state: `true` (active), `false` (inactive), `null` (unknown/unset).                                                   |

Key notes:

- `students` and `assignments` arrays are fully stored in this collection but are heavy,
  so the partials registry exists for list-view performance.
- `assignments` at rest in the main document always carries partial-hydration assignment
  instances (`_hydrationLevel === 'partial'`). Full hydration records live in separate
  `assign_full_*` collections.
- `progressTracker` and `_hydrationLevel` are runtime-only flags and never persisted.
- `active` default: `null` (tri-state). Only creation flows explicitly set it.

### Collection: `abclass_partials` (registry)

Stored via `ABClass.toPartialJSON()`.

| #   | Field          | Type            | Persistence                      | Transport | Frontend Zod                                                     | Notes                             |
| --- | -------------- | --------------- | -------------------------------- | --------- | ---------------------------------------------------------------- | --------------------------------- |
| 1   | `classId`      | `string`        | included                         | unchanged | `ClassPartialSchema.classId: z.string()`                         | Google Classroom course ID.       |
| 2   | `className`    | `string\|null`  | included                         | unchanged | `ClassPartialSchema.className: z.string().nullable()`            | Null when unset.                  |
| 3   | `cohortKey`    | `string\|null`  | included                         | unchanged | `ClassPartialSchema.cohortKey: z.string().nullable()`            | Null when unset.                  |
| 4   | `courseLength` | `number`        | included                         | unchanged | `ClassPartialSchema.courseLength: z.number()`                    | Integer ≥ 1.                      |
| 5   | `yearGroupKey` | `string\|null`  | included                         | unchanged | `ClassPartialSchema.yearGroupKey: z.string().nullable()`         | Null when unset.                  |
| 6   | `classOwner`   | `Object\|null`  | included                         | unchanged | `ClassPartialSchema.classOwner: TeacherSummarySchema.nullable()` | Teacher summary. Null when unset. |
| 7   | `teachers`     | `Array`         | included                         | unchanged | `ClassPartialSchema.teachers: z.array(TeacherSummarySchema)`     | Teacher summary objects.          |
| 8   | `active`       | `boolean\|null` | included (`this.active ?? null`) | unchanged | `ClassPartialSchema.active: z.boolean().nullable()`              | Tri-state.                        |

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

| Field              | Type      | Required | Notes                                        |
| ------------------ | --------- | -------- | -------------------------------------------- |
| `classId`          | `string`  | yes      |                                              |
| `fullClassDeleted` | `boolean` | yes      | Whether the main document was deleted        |
| `partialDeleted`   | `boolean` | yes      | Whether the partial registry row was deleted |

Key contract notes:

- Both persistence layers are removed: the full class collection via
  `dropCollection(classId)` and the `abclass_partials` registry row via
  `deleteOne({ classId })`.
- Repeated deletes are idempotent and still succeed with updated flag values.
- The response does not use `ClassPartialSchema`; it is a plain `{ classId, fullClassDeleted, partialDeleted }` object.

---

## Sub-entities

### Sub-entity: Teacher

Backend model: `src/backend/Models/Teacher.js`
Frontend Zod: `src/frontend/src/services/googleClassrooms/classPartials.zod.ts` → `TeacherSummarySchema`

`Teacher.toJSON()` emits:

| Field         | Type           | Backend toJSON()                                                                      | Frontend Zod                                                 | Notes                                                                                                                                      |
| ------------- | -------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `email`       | `string\|null` | Always emitted                                                                        | `z.string().nullable()`                                      | Null when email is unset on the model.                                                                                                     |
| `userId`      | `string\|null` | Always emitted                                                                        | `z.string().nullable()`                                      | Google userId. Null when unset.                                                                                                            |
| `teacherName` | `string\|null` | **Conditionally emitted:** omitted when `this.teacherName == null`; present otherwise | `z.string().nullable().optional().transform(v => v ?? null)` | The field is entirely absent from the JSON when null. Frontend Zod handles both absent and null states via `.optional()` + `.transform()`. |

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
- `courseLength` must be an integer ≥ 1 on upsertABClass.
- On updateABClass, `active` must be a boolean or null.
- `classOwner`, `teachers`, `students`, `assignments` are forbidden in updateABClass requests.
- The response mapper (`_normaliseClassPartial`) throws `TypeError` if a partial document is not a plain object or lacks an array `teachers` field.

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

5. **`deleteABClass` response shape (`{ classId, fullClassDeleted, partialDeleted }`) has no frontend Zod schema.**
   The response is consumed by generic `callApi` without `parseApiResponse` validation.
   **Classification: Aligned** — the delete flow does not require typed validation at
   the transport boundary; the caller receives raw `unknown` and destructures as needed.

---

## File Index

```
Persistence model:         src/backend/Models/ABClass.js
  └── ABClass.toJSON()          — full document shape
  └── ABClass.toPartialJSON()   — partial registry shape
  └── ABClass.serialiseOwner()  — owner serialisation helper

Teacher model:              src/backend/Models/Teacher.js
  └── Teacher.toJSON()          — teacher summary shape

Student model:              src/backend/Models/Student.js
  └── Student.toJSON()          — student shape

Controller:                 src/backend/y_controllers/ABClassController/
  ├── index.js                          — ABClassController facade
  ├── ABClassResponseMapper.js          — _toReadView(), _normaliseClassPartial(), _buildClassSummary()
  ├── ABClassPersistence.js             — _persistClassAndPartial()
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
