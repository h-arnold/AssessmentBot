# Contract: GoogleClassrooms

Upstream Google Classroom API passthroughs for listing active courses and their
coursework. There is no backend persistence — data is fetched live from the
Google Classroom API and normalised for the transport boundary.

Backend handler: `src/backend/z_Api/googleClassrooms.js`, `src/backend/z_Api/googleClassroomAssignments.js`
API handlers: Registered in `ALLOWLISTED_METHOD_HANDLERS` within `src/backend/z_Api/z_apiHandler.js`
Response mapper: None (handlers return plain objects directly)
Frontend Zod: `src/frontend/src/services/googleClassrooms/googleClassrooms.zod.ts`,
`src/frontend/src/services/googleClassrooms/googleClassroomAssignments.zod.ts`
Frontend service: `src/frontend/src/services/googleClassrooms/googleClassroomsService.ts`,
`src/frontend/src/services/googleClassrooms/googleClassroomAssignmentsService.ts`

Sibling contracts:

- [Contract: ABClass](abclass.md) — Google Classroom data feeds into ABClass upsert flows.
- [Contract: Assignment](assignment.md) — Assignment data is carried as partials inside ABClass.
- [Contract: AssignmentDefinition](assignment-definition.md) — No direct relationship.
- [Contract: BackendConfig](backend-config.md) — No direct relationship.
- [Contract: Reference Data](reference-data.md) — No direct relationship.

---

## Transport

This contract has **no persistence layer** — both endpoints fetch data live from the
Google Classroom API and normalise it for the frontend. The transport envelope is
documented in [`transport-envelope.md`](transport-envelope.md). This section documents
the `data` payload only.

### `getGoogleClassrooms` (read)

| Aspect           | Detail                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/googleClassrooms.js` → `getGoogleClassrooms_()`                                                               |
| Controller       | None (handler calls `ClassroomApiClient` directly)                                                                               |
| Response mapper  | None                                                                                                                             |
| Frontend Zod     | `src/frontend/src/services/googleClassrooms/googleClassrooms.zod.ts` → `GoogleClassroomSchema`, `GoogleClassroomsResponseSchema` |
| Frontend service | `src/frontend/src/services/googleClassrooms/googleClassroomsService.ts` → `getGoogleClassrooms()`                                |

**Request:** No parameters.

**Response:** `GoogleClassroomSchema[]` — array of active Google Classroom course summaries.
Empty array when no classrooms exist.

| Field       | Type     | Required | Notes                                      |
| ----------- | -------- | -------- | ------------------------------------------ |
| `classId`   | `string` | yes      | Google Classroom course ID. Never empty.   |
| `className` | `string` | yes      | Google Classroom course name. Never empty. |

Key contract notes:

- Backend calls `ClassroomApiClient.fetchAllActiveClassrooms()` which paginates through
  all active courses and maps each to `{ id, name, enrollmentCode }`. The `enrollmentCode`
  field is discarded — only `id` and `name` are kept in the transport response.
- Each row is validated: must be a non-null object with truthy `id` and `name` fields.
- Backend maps Google Classroom `id` → `classId`, `name` → `className`.
- No Date conversion needed — the returned fields are string IDs and names; there are no
  `Date` objects in the response.
- If `ClassroomApiClient.fetchAllActiveClassrooms()` encounters an error, it logs the
  error and returns an empty array (the transport handler receives `[]`).
- The frontend `GoogleClassroomSchema` does **not** use `.strict()` — unexpected fields
  (e.g. `enrollmentCode`) are silently tolerated.

### `getGoogleClassroomAssignments` (read)

| Aspect           | Detail                                                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/googleClassroomAssignments.js` → `getGoogleClassroomAssignments_()`                                                                         |
| Controller       | None (handler calls `ClassroomApiClient` directly)                                                                                                             |
| Response mapper  | None                                                                                                                                                           |
| Frontend Zod     | `src/frontend/src/services/googleClassrooms/googleClassroomAssignments.zod.ts` → `GoogleClassroomAssignmentSchema`, `GoogleClassroomAssignmentsResponseSchema` |
| Frontend service | `src/frontend/src/services/googleClassrooms/googleClassroomAssignmentsService.ts` → `getGoogleClassroomAssignments()`                                          |

**Request:**

| Field     | Type     | Required | Notes                                                                                                                                       |
| --------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `classId` | `string` | yes      | Google Classroom course ID. Must be non-empty, already trimmed, no path-traversal characters (`/`, `\`, `..`), no ASCII control characters. |

**Response:** `GoogleClassroomAssignmentSchema[]` — array of coursework items for the given
course. Empty array when no coursework exists.

| Field          | Type           | Required | Notes                                                                                     |
| -------------- | -------------- | -------- | ----------------------------------------------------------------------------------------- |
| `assignmentId` | `string`       | yes      | Google Classroom coursework ID. Never empty.                                              |
| `title`        | `string`       | yes      | Coursework title. Never empty.                                                            |
| `creationTime` | `string\|null` | yes      | ISO 8601 string or `null`. Normalised via `DateUtils.normaliseDateFields()`.              |
| `topicId`      | `string\|null` | yes      | Google Classroom topic ID or `null` when coursework has no topic.                         |
| `topicName`    | `string\|null` | yes      | Resolved topic display name or `null`. Fetched via `ClassroomApiClient.fetchTopicName()`. |

Key contract notes:

- The backend validates `parameters` is a plain object (not null, not array, not primitive).
- `classId` is validated defensively: must be a non-empty string, already trimmed, with no
  path-traversal characters (`/`, `\`, `..`), and no ASCII control characters (delegated to
  the shared `hasControlCharacters_()` helper from `assignmentDefinitionValidation.js`).
  The handler reuses the same error code (`INVALID_REQUEST`) via `ApiValidationError` for
  all validation failures.
- Each coursework row is validated: `cw.id` and `cw.title` must be truthy (non-null,
  non-empty). Malformed rows throw `ApiValidationError`.
- `topicName` is resolved per-row by calling `ClassroomApiClient.fetchTopicName(classId, topicId)`.
  If the topic ID is null, no request is made and `topicName` is set to `null`. If the API
  call fails, the client throws an error (propagated to the transport envelope).
- `creationTime` is passed through `DateUtils.normaliseDateFields(row, ['creationTime'])`
  after the row is constructed. This ensures the value is an ISO 8601 string if present,
  or `null` if absent. The coercion `cw.creationTime || null` means falsy values (empty
  string, `undefined`, `null`) all become `null`.
- The `updateTime` field is fetched by `ClassroomApiClient` for sorting but is **not included**
  in the transport response.
- The `ClassroomApiClient.fetchCourseWork()` method sorts results by `updateTime` descending
  (most recently updated first) before returning.
- The frontend `GoogleClassroomAssignmentSchema` uses `.strict()` — any unexpected fields
  in the response cause a Zod validation error. Conversely, the schema uses `.default(null)`
  on `creationTime`, `topicId`, and `topicName` so that if the backend inadvertently omits
  one of these nullable fields, the frontend defaults to `null` instead of failing.

---

## Sub-entities

None. Both `GoogleClassroom` and `GoogleClassroomAssignment` are simple flat objects
with no embedded sub-entities.

---

## Validation

**Frontend Zod (`googleClassrooms.zod.ts`):**

- `NonEmptyStringSchema` — `z.string().trim().min(1)` (shared-internal constant, not exported).
- `GoogleClassroomSchema` — `z.object({ classId, className })` — no `.strict()` — tolerates
  extra fields (e.g. `enrollmentCode` from the raw upstream response if it leaked through).
  Both fields use `NonEmptyStringSchema` (trimmed, non-empty).
- `GoogleClassroomsResponseSchema` — `z.array(GoogleClassroomSchema)`.

**Frontend Zod (`googleClassroomAssignments.zod.ts`):**

- `GoogleClassroomAssignmentSchema` — `z.object({...}).strict()` — **rejects** extra fields.
  - `assignmentId: z.string().min(1)` — note: no `.trim()`, unlike the classrooms schema.
  - `title: z.string().min(1)` — note: no `.trim()`.
  - `creationTime: z.string().nullable().default(null)` — accepts ISO string or `null`.
  - `topicId: z.string().nullable().default(null)`.
  - `topicName: z.string().nullable().default(null)`.
- `GoogleClassroomAssignmentsResponseSchema` — `z.array(GoogleClassroomAssignmentSchema)`.

**Backend transport validation:**

- `getGoogleClassrooms_()`:
  - Row validation: each classroom must be a non-null, non-array object with truthy `id` and `name`.
  - No parameter validation — parameters are unused but the handler signature accepts them.
  - No Date conversion needed.

- `getGoogleClassroomAssignments_()`:
  - Parameters: must be a plain object (not null, not array).
  - `classId`: must be a `string`, non-empty after trim, already trimmed (no leading/trailing whitespace), no path-traversal characters (`/`, `\`, `..`), no ASCII control characters (via shared `hasControlCharacters_()`).
  - Row validation: each coursework item must be a truthy object with truthy `id` and `title`.
  - Date normalisation: `DateUtils.normaliseDateFields(row, ['creationTime'])` ensures `creationTime` is an ISO string or `null`.

**Key domain validation rules:**

- Row-level validation throws `ApiValidationError` with field-specific metadata (`method`, `fieldName`), mapped to `INVALID_REQUEST` in the transport envelope.
- The `GoogleClassroomSchema` (no `.strict()`) vs `GoogleClassroomAssignmentSchema` (`.strict()`) difference is intentional — classrooms may receive extra upstream fields not relevant to the frontend, while assignments should be strictly controlled.

### Known discrepancies between backend and frontend

1. **`GoogleClassroomSchema` does not use `.strict()`; `GoogleClassroomAssignmentSchema` uses `.strict()`.**
   - `GoogleClassroomSchema` tolerates extra fields (no `.strict()`).
   - `GoogleClassroomAssignmentSchema` rejects extra fields (`.strict()`).
   - **Classification: Aligned** — The classrooms endpoint may pass through upstream fields
     that the frontend does not consume. The assignments endpoint deliberately rejects unknown
     fields to catch accidental data leaks (like `updateTime` which is fetched but not
     included in the transport response).

2. **`updateTime` is fetched for sorting but entirely discarded.**
   - `ClassroomApiClient.fetchCourseWork()` returns `{ id, title, updateTime, creationTime, topicId }`
     and sorts by `updateTime` descending.
   - The transport handler maps to `{ assignmentId, title, creationTime, topicId, topicName }` —
     `updateTime` is deliberately excluded after sorting.
   - **Classification: Aligned** — `updateTime` is needed only for server-side sorting and
     has no meaning for the frontend. No discrepancy exists.

3. **`NonEmptyStringSchema` vs bare `z.string().min(1)` — inconsistent trimming.**
   - The classrooms schema uses `NonEmptyStringSchema` which applies `.trim().min(1)`.
   - The assignments schema uses bare `z.string().min(1)` without `.trim()`.
   - Backend ensures `classId` is already trimmed before it reaches validation, so this
     is not a runtime issue for `classId` — but `assignmentId` and `title` are not trimmed
     in the Zod schema, meaning leading/trailing whitespace would pass frontend validation
     even though the backend does not expect it.
   - **Classification: Fragile** — If a future upstream change introduces whitespace in
     `assignmentId` or `title`, the assignments Zod schema would accept it while the classrooms
     schema would not. Consider adding `.trim()` to the assignments schema for consistency.

4. **Backend validation uses `!classroom.id` (truthy check); frontend uses `NonEmptyStringSchema` (`.trim().min(1)`).**
   - Backend `getGoogleClassrooms_()` treats `id` as a truthiness check (`!classroom.id`).
   - Frontend validates `classId` via `z.string().trim().min(1)` — a string of only whitespace
     would fail the frontend but pass the backend.
   - **Classification: Aligned** — The backend calls `classroom.id` from the GAS `Classroom`
     API which always returns a non-whitespace string when present. The frontend's stricter
     validation provides defence-in-depth.

---

## File Index

```
Backend handlers:         src/backend/z_Api/
  ├── googleClassrooms.js
  │     └── getGoogleClassrooms_()          — lists active Google Classroom courses
  └── googleClassroomAssignments.js
        └── getGoogleClassroomAssignments_() — lists coursework for a given course

Transport envelope:       src/backend/z_Api/z_apiHandler.js
  └── ALLOWLISTED_METHOD_HANDLERS entries:
        ├── getGoogleClassrooms
        └── getGoogleClassroomAssignments

Upstream API client:      src/backend/GoogleClassroom/ClassroomApiClient.js
  ├── fetchAllActiveClassrooms()            — paginated fetch of active courses
  ├── fetchCourseWork(courseId)             — paginated fetch of coursework, sorted by updateTime desc
  └── fetchTopicName(courseId, topicId)     — resolves topic display name

Shared validation helper:
  └── src/backend/z_Api/assignmentDefinitionValidation.js
        └── hasControlCharacters_()         — ASCII control character check

Frontend:
  ├── src/frontend/src/services/googleClassrooms/googleClassrooms.zod.ts
  │     → GoogleClassroomSchema, GoogleClassroomsResponseSchema
  ├── src/frontend/src/services/googleClassrooms/googleClassroomsService.ts
  │     → getGoogleClassrooms()
  ├── src/frontend/src/services/googleClassrooms/googleClassroomAssignments.zod.ts
  │     → GoogleClassroomAssignmentSchema (.strict()), GoogleClassroomAssignmentsResponseSchema
  └── src/frontend/src/services/googleClassrooms/googleClassroomAssignmentsService.ts
        → getGoogleClassroomAssignments(classId)
```
