# Contract: Reference Data

Authoritative keyed reference datasets that support class and assignment-definition
metadata. Three independent sub-entities — Cohort, YearGroup, AssignmentTopic — each
stored in their own collection with full CRUD via shared controller helpers.

Backend model: `src/backend/Models/Cohort.js`, `src/backend/Models/YearGroup.js`, `src/backend/Models/AssignmentTopic.js`
Collections: `cohorts`, `year_groups`, `assignment_topics`
API handlers: Registered as inline closures in `src/backend/z_Api/z_apiHandler.js` — `ALLOWLISTED_METHOD_HANDLERS`
Response mapper: None (controller returns model.toJSON() results directly)
Frontend service: `src/frontend/src/services/referenceData/referenceDataService.ts`
Frontend Zod: `src/frontend/src/services/referenceData/referenceData.zod.ts`

Sibling contracts:

- [Contract: ABClass](abclass.md) — ABClass embeds `cohortKey` and `yearGroupKey` referencing Cohorts and YearGroups respectively.
- [Contract: AssignmentDefinition](assignment-definition.md) — AssignmentDefinition embeds `primaryTopicKey` referencing AssignmentTopics.
- [Contract: Assignment](assignment.md) — No direct reference-data relationship.
- [Contract: BackendConfig](backend-config.md) — No direct reference-data relationship.

---

## Persistence

Each sub-entity has its own dedicated JsonDbApp collection. Records are serialised
via `Model.toJSON()` and deserialised via `Model.fromJSON()`. The controller's
`_toPlainObject()` strips storage-only `_id` fields before returning.

All three entities share the same persistence pattern: the controller calls
`_buildRecord(config, record)` which runs the record through `Model.fromJSON()`
then `Model.toJSON()` for canonical serialisation.

### Collection: `cohorts`

Stored via `Cohort.toJSON()`.

| #   | Field        | Type      | Persistence | Transport | Frontend Zod                                               | Notes                                                                           |
| --- | ------------ | --------- | ----------- | --------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | `key`        | `string`  | included    | same      | `CohortSchema.key: z.string().trim().min(1)`               | Stable opaque UUID key generated during creation. Never empty, already trimmed. |
| 2   | `name`       | `string`  | included    | same      | `CohortSchema.name: z.string().trim().min(1)`              | Display name. Must be non-empty after trim.                                     |
| 3   | `active`     | `boolean` | included    | same      | `CohortSchema.active: z.boolean()`                         | Whether the cohort is actively in use. Defaults to `true` in the constructor.   |
| 4   | `startYear`  | `number`  | included    | same      | `CohortSchema.startYear: z.number().int()`                 | Academic year start. Defaults to current academic year.                         |
| 5   | `startMonth` | `number`  | included    | same      | `CohortSchema.startMonth: z.number().int().min(1).max(12)` | Academic year start month (1–12). Defaults to 9 (September).                    |

Key notes:

- `active` is always a boolean in `toJSON()` — there is no tri-state null like ABClass.
- `startYear` is an integer year (e.g. 2025), not a full date.
- `startMonth` is an integer (1–12). Defaults to 9 (September) via the module constant `ACADEMIC_YEAR_START_MONTH`.
- Constructor defaults: `active: true`, `startYear: getCurrentAcademicYearStart()`, `startMonth: 9`.
- `fromJSON()` uses `Object.hasOwn()` fallback checks for `active`, `startMonth`, and `startYear` so legacy records missing these fields still deserialise correctly.

### Collection: `year_groups`

Stored via `YearGroup.toJSON()`.

| #   | Field  | Type     | Persistence | Transport | Frontend Zod                                     | Notes                                                        |
| --- | ------ | -------- | ----------- | --------- | ------------------------------------------------ | ------------------------------------------------------------ |
| 1   | `key`  | `string` | included    | same      | `YearGroupSchema.key: z.string().trim().min(1)`  | Stable opaque UUID key. Never empty, already trimmed.        |
| 2   | `name` | `string` | included    | same      | `YearGroupSchema.name: z.string().trim().min(1)` | Display name (e.g. "Year 10"). Must be non-empty after trim. |

Key notes:

- YearGroup is the simplest entity: just `key` and `name`. No active flag, no academic-year metadata.
- Constructor requires both `key` and `name`; there are no optional fields.

### Collection: `assignment_topics`

Stored via `AssignmentTopic.toJSON()`.

| #   | Field           | Type       | Persistence | Transport | Frontend Zod                                                             | Notes                                                                                                 |
| --- | --------------- | ---------- | ----------- | --------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| 1   | `key`           | `string`   | included    | same      | `AssignmentTopicSchema.key: z.string().trim().min(1)`                    | Stable opaque UUID key. Never empty, already trimmed.                                                 |
| 2   | `name`          | `string`   | included    | same      | `AssignmentTopicSchema.name: z.string().trim().min(1)`                   | Display name. Must be non-empty after trim.                                                           |
| 3   | `yearGroupKeys` | `string[]` | included    | same      | `AssignmentTopicSchema.yearGroupKeys: z.array(z.string().trim().min(1))` | Zero or more year-group keys this topic applies to. Always an array; empty array when no year groups. |

Key notes:

- `yearGroupKeys` is always an array in `toJSON()`. The constructor requires it; an empty array is valid.
- Backend `AssignmentTopic.toJSON()` always emits all three fields. There is no partial variant.
- **IMPORTANT:** There is a second `AssignmentTopicSchema` in `src/frontend/src/services/assignmentDefinition/assignmentTopics.zod.ts` that defines only `{ key, name }` without `yearGroupKeys` — if used for response validation it would reject valid backend responses (see [Known discrepancies](#known-discrepancies-between-backend-and-frontend)).
- The controller's `_getConfig('assignmentTopic')` configures `partialsReferenceField` as `'primaryTopicKey'` and `inUseCollectionName` as `'assignment_definitions'` (different from cohorts/yearGroups which use `'abclass_partials'` and their key field).

---

## Transport

All reference data endpoints use inline closures in `ALLOWLISTED_METHOD_HANDLERS` and
delegate directly to `ReferenceDataController`. There is **no response mapper** — the
controller returns plain objects produced by `Model.toJSON()` (with `_id` stripped).

The transport envelope is documented in [`transport-envelope.md`](transport-envelope.md).
This section documents the `data` payload only.

All list (`get*`) endpoints return records sorted by name (case-insensitive localeCompare
via `_sortRecordsByName`). All delete endpoints return `null` (via the controller's `void`
return being coerced by `apiHandler._success()` `data: data ?? null`).

### Cohort CRUD

| Aspect           | Detail                                                                                                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend handlers | Inline closures in `ALLOWLISTED_METHOD_HANDLERS` within `z_apiHandler.js`                                                                                                                             |
| Controller       | `ReferenceDataController.listCohorts()`, `.createCohort()`, `.updateCohort()`, `.deleteCohort()`                                                                                                      |
| Response mapper  | None (returns `_toPlainObject()` results directly)                                                                                                                                                    |
| Frontend Zod     | `src/frontend/src/services/referenceData/referenceData.zod.ts` → `CohortSchema`, `CohortListResponseSchema`, `CreateCohortResponseSchema`, `UpdateCohortResponseSchema`, `DeleteCohortResponseSchema` |
| Frontend service | `src/frontend/src/services/referenceData/referenceDataService.ts` → `getCohorts()`, `createCohort()`, `updateCohort()`, `deleteCohort()`                                                              |

#### `getCohorts` (read)

**Request:** No parameters.

**Response:** `CohortSchema[]` — array of all cohort records sorted by name. Empty array when no cohorts exist.

| Field        | Type      | Required | Notes               |
| ------------ | --------- | -------- | ------------------- |
| `key`        | `string`  | yes      | Stable UUID key     |
| `name`       | `string`  | yes      | Display name        |
| `active`     | `boolean` | yes      | Active status       |
| `startYear`  | `number`  | yes      | Academic year start |
| `startMonth` | `number`  | yes      | Start month (1–12)  |

#### `createCohort` (write)

**Request:**

| Field               | Type      | Required | Notes                                                                         |
| ------------------- | --------- | -------- | ----------------------------------------------------------------------------- |
| `record`            | `object`  | yes      | Wrapper object for cohort data                                                |
| `record.name`       | `string`  | yes      | Display name. Controller enforces duplicate detection via `_normaliseName()`. |
| `record.active`     | `boolean` | no       | Defaults to `true` in the constructor                                         |
| `record.startYear`  | `number`  | no       | Defaults to current academic year                                             |
| `record.startMonth` | `number`  | no       | Defaults to 9 (September)                                                     |

**Response:** `CohortSchema` — the persisted record including the generated UUID key.

Key contract notes:

- The `key` is generated server-side via `generateStableKey()` (uses `Utilities.getUuid()` in GAS, falls back to timestamp+counter in tests).
- Duplicate detection: `_normaliseName()` trims and lowercases the name, then checks against all stored records. If a match is found, throws `Error` (mapped to `INTERNAL_ERROR` envelope).

#### `updateCohort` (write)

**Request:**

| Field               | Type      | Required | Notes                                                 |
| ------------------- | --------- | -------- | ----------------------------------------------------- |
| `key`               | `string`  | yes      | Key of the cohort to update                           |
| `record`            | `object`  | yes      | Wrapper object with updated fields                    |
| `record.name`       | `string`  | yes      | Updated display name                                  |
| `record.active`     | `boolean` | yes      | Updated active status (note: required, unlike create) |
| `record.startYear`  | `number`  | no       | Updated academic year start                           |
| `record.startMonth` | `number`  | no       | Updated start month                                   |

**Response:** `CohortSchema` — the updated record.

Key contract notes:

- The frontend `UpdateCohortRecordInputSchema` requires `active: z.boolean()` (not optional), unlike the create schema where `active` is optional.
- Update uses `_findByKey(records, trimmedKey)` to verify the record exists before updating.
- Duplicate name detection: the controller checks that the new normalised name does not conflict with a _different_ existing record (same-key renames are allowed).

#### `deleteCohort` (write)

**Request:**

| Field | Type     | Required | Notes                       |
| ----- | -------- | -------- | --------------------------- |
| `key` | `string` | yes      | Key of the cohort to delete |

**Response:** `null` — backend method returns void, coerced to null by `apiHandler`.

Key contract notes:

- **In-use protection:** Before deletion, the controller checks all records in `abclass_partials` for `cohortKey === trimmedKey`. If any partial references this cohort, an error with `reason: 'IN_USE'` is thrown, mapped to `IN_USE` error code in the transport envelope.
- If the cohort key is not found, throws `Error` (mapped to `INTERNAL_ERROR`).

### YearGroup CRUD

| Aspect           | Detail                                                                                                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend handlers | Inline closures in `ALLOWLISTED_METHOD_HANDLERS` within `z_apiHandler.js`                                                                                                                                            |
| Controller       | `ReferenceDataController.listYearGroups()`, `.createYearGroup()`, `.updateYearGroup()`, `.deleteYearGroup()`                                                                                                         |
| Response mapper  | None (returns `_toPlainObject()` results directly)                                                                                                                                                                   |
| Frontend Zod     | `src/frontend/src/services/referenceData/referenceData.zod.ts` → `YearGroupSchema`, `YearGroupListResponseSchema`, `CreateYearGroupResponseSchema`, `UpdateYearGroupResponseSchema`, `DeleteYearGroupResponseSchema` |
| Frontend service | `src/frontend/src/services/referenceData/referenceDataService.ts` → `getYearGroups()`, `createYearGroup()`, `updateYearGroup()`, `deleteYearGroup()`                                                                 |

#### `getYearGroups` (read)

**Request:** No parameters.

**Response:** `YearGroupSchema[]` — array of all year-group records sorted by name. Empty array when none exist.

| Field  | Type     | Required | Notes           |
| ------ | -------- | -------- | --------------- |
| `key`  | `string` | yes      | Stable UUID key |
| `name` | `string` | yes      | Display name    |

#### `createYearGroup` (write)

**Request:**

| Field         | Type     | Required | Notes                                      |
| ------------- | -------- | -------- | ------------------------------------------ |
| `record`      | `object` | yes      | Wrapper object                             |
| `record.name` | `string` | yes      | Display name. Duplicate detection applies. |

**Response:** `YearGroupSchema` — including the generated UUID key.

#### `updateYearGroup` (write)

**Request:**

| Field         | Type     | Required | Notes                           |
| ------------- | -------- | -------- | ------------------------------- |
| `key`         | `string` | yes      | Key of the year group to update |
| `record`      | `object` | yes      | Wrapper object                  |
| `record.name` | `string` | yes      | Updated display name            |

**Response:** `YearGroupSchema` — the updated record.

#### `deleteYearGroup` (write)

**Request:**

| Field | Type     | Required | Notes                           |
| ----- | -------- | -------- | ------------------------------- |
| `key` | `string` | yes      | Key of the year group to delete |

**Response:** `null`

Key contract notes:

- **In-use protection:** Before deletion, the controller checks all records in `abclass_partials` for `yearGroupKey === trimmedKey`. If referenced, throws `Error` with `reason: 'IN_USE'` (mapped to `IN_USE` error code).

### AssignmentTopic CRUD

| Aspect                   | Detail                                                                                                                                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend handlers         | Inline closures in `ALLOWLISTED_METHOD_HANDLERS` within `z_apiHandler.js`                                                                                                                                                                                                               |
| Controller               | `ReferenceDataController.listAssignmentTopics()`, `.createAssignmentTopic()`, `.updateAssignmentTopic()`, `.deleteAssignmentTopic()`                                                                                                                                                    |
| Response mapper          | None (returns `_toPlainObject()` results directly)                                                                                                                                                                                                                                      |
| Frontend Zod (primary)   | `src/frontend/src/services/referenceData/referenceData.zod.ts` → `AssignmentTopicSchema` (3 fields: key, name, yearGroupKeys), `AssignmentTopicListResponseSchema`, `CreateAssignmentTopicResponseSchema`, `UpdateAssignmentTopicResponseSchema`, `DeleteAssignmentTopicResponseSchema` |
| Frontend Zod (secondary) | `src/frontend/src/services/assignmentDefinition/assignmentTopics.zod.ts` → `AssignmentTopicSchema` (2 fields: key, name — **without yearGroupKeys**)                                                                                                                                    |
| Frontend service         | `src/frontend/src/services/referenceData/referenceDataService.ts` → `createAssignmentTopic()`, `updateAssignmentTopic()`, `deleteAssignmentTopic()`; `src/frontend/src/services/assignmentDefinition/assignmentTopicsService.ts` → `getAssignmentTopics()`                              |

#### `getAssignmentTopics` (read)

**Request:** No parameters.

**Response:** `AssignmentTopicSchema[]` — array of all assignment-topic records sorted by name. Empty array when none exist.

| Field           | Type       | Required | Notes                                   |
| --------------- | ---------- | -------- | --------------------------------------- |
| `key`           | `string`   | yes      | Stable UUID key                         |
| `name`          | `string`   | yes      | Display name                            |
| `yearGroupKeys` | `string[]` | yes      | Array of year-group keys. May be empty. |

Key contract notes:

- This endpoint is consumed by `assignmentTopicsService.ts` which validates the response against `AssignmentTopicListResponseSchema` from `referenceData.zod.ts` (3-field schema with `yearGroupKeys`).
- The secondary `assignmentTopics.zod.ts` schema (2-field, no `yearGroupKeys`) is **not used** by any production service (see [Known discrepancies](#known-discrepancies-between-backend-and-frontend)).

#### `createAssignmentTopic` (write)

**Request:**

| Field                  | Type       | Required | Notes                                               |
| ---------------------- | ---------- | -------- | --------------------------------------------------- |
| `record`               | `object`   | yes      | Wrapper object                                      |
| `record.name`          | `string`   | yes      | Display name. Duplicate detection applies.          |
| `record.yearGroupKeys` | `string[]` | yes      | Zero or more year-group keys. Empty array is valid. |

**Response:** `AssignmentTopicSchema` (3-field shape with `yearGroupKeys`).

#### `updateAssignmentTopic` (write)

**Request:**

| Field                  | Type       | Required | Notes                                 |
| ---------------------- | ---------- | -------- | ------------------------------------- |
| `key`                  | `string`   | yes      | Key of the assignment topic to update |
| `record`               | `object`   | yes      | Wrapper object                        |
| `record.name`          | `string`   | yes      | Updated display name                  |
| `record.yearGroupKeys` | `string[]` | yes      | Updated year-group keys               |

**Response:** `AssignmentTopicSchema` (3-field shape with `yearGroupKeys`).

#### `deleteAssignmentTopic` (write)

**Request:**

| Field | Type     | Required | Notes                                 |
| ----- | -------- | -------- | ------------------------------------- |
| `key` | `string` | yes      | Key of the assignment topic to delete |

**Response:** `null`

Key contract notes:

- **In-use protection:** Unlike cohorts and year groups which check `abclass_partials`, assignment topics check `assignment_definitions` for `primaryTopicKey === trimmedKey`. This is configured via `_getConfig('assignmentTopic')` with `partialsReferenceField: 'primaryTopicKey'` and `inUseCollectionName: 'assignment_definitions'`.
- If an assignment definition references this topic key, deletion is blocked with `reason: 'IN_USE'`.

---

## Sub-entities

All three sub-entities are documented inline here. They have equal standing — none
is nested inside another.

### Sub-entity: Cohort

Backend model: `src/backend/Models/Cohort.js`
Frontend Zod: `src/frontend/src/services/referenceData/referenceData.zod.ts` → `CohortSchema`

`Cohort.toJSON()` emits:

| Field        | Type      | Backend toJSON() | Frontend Zod                      | Notes                                             |
| ------------ | --------- | ---------------- | --------------------------------- | ------------------------------------------------- |
| `key`        | `string`  | Always emitted   | `z.string().trim().min(1)`        | Stable UUID. Never empty.                         |
| `name`       | `string`  | Always emitted   | `z.string().trim().min(1)`        | Display name. Never empty after construction.     |
| `active`     | `boolean` | Always emitted   | `z.boolean()`                     | `true` by default. Always a boolean — never null. |
| `startYear`  | `number`  | Always emitted   | `z.number().int()`                | Integer. Defaults to current academic year start. |
| `startMonth` | `number`  | Always emitted   | `z.number().int().min(1).max(12)` | Integer 1–12. Defaults to 9 (September).          |

### Sub-entity: YearGroup

Backend model: `src/backend/Models/YearGroup.js`
Frontend Zod: `src/frontend/src/services/referenceData/referenceData.zod.ts` → `YearGroupSchema`

`YearGroup.toJSON()` emits:

| Field  | Type     | Backend toJSON() | Frontend Zod               | Notes                                         |
| ------ | -------- | ---------------- | -------------------------- | --------------------------------------------- |
| `key`  | `string` | Always emitted   | `z.string().trim().min(1)` | Stable UUID. Never empty.                     |
| `name` | `string` | Always emitted   | `z.string().trim().min(1)` | Display name. Never empty after construction. |

### Sub-entity: AssignmentTopic

Backend model: `src/backend/Models/AssignmentTopic.js`
Frontend Zod (primary): `src/frontend/src/services/referenceData/referenceData.zod.ts` → `AssignmentTopicSchema` (3 fields)
Frontend Zod (secondary/unused): `src/frontend/src/services/assignmentDefinition/assignmentTopics.zod.ts` → `AssignmentTopicSchema` (2 fields: key, name — **without** `yearGroupKeys`; see [Known discrepancies](#known-discrepancies-between-backend-and-frontend))

`AssignmentTopic.toJSON()` emits:

| Field           | Type       | Backend toJSON() | Frontend Zod (primary)              | Notes                                                                                                     |
| --------------- | ---------- | ---------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `key`           | `string`   | Always emitted   | `z.string().trim().min(1)`          | Stable UUID. Never empty.                                                                                 |
| `name`          | `string`   | Always emitted   | `z.string().trim().min(1)`          | Display name. Never empty after construction.                                                             |
| `yearGroupKeys` | `string[]` | Always emitted   | `z.array(z.string().trim().min(1))` | Array of year-group keys. Always present; may be empty. Each entry validated as non-empty trimmed string. |

---

## Validation

**Frontend Zod (primary — `referenceData.zod.ts`):**

- `CohortSchema` — validates `getCohorts` response entries and create/update response payloads.
- `CohortListResponseSchema` — `z.array(CohortSchema)` for list response.
- `CreateCohortInputSchema` — validates create request input (`{ record: { name, active?, startYear?, startMonth? } }`). `active` is optional.
- `UpdateCohortInputSchema` — validates update request input (`{ key, record: { name, active, startYear?, startMonth? } }`). `active` is **required** (unlike create).
- `DeleteCohortInputSchema` — validates delete request input (`{ key }`).
- `DeleteCohortResponseSchema` — `z.void().nullable()` (handles null from backend envelope).
- `YearGroupSchema` — validates get/update/response for year groups.
- `YearGroupListResponseSchema` — `z.array(YearGroupSchema)`.
- `CreateYearGroupInputSchema` / `UpdateYearGroupInputSchema` / `DeleteYearGroupInputSchema` — validate their respective request inputs.
- `DeleteYearGroupResponseSchema` — `z.void().nullable()`.
- `AssignmentTopicSchema` (3 fields) — validates get/update/response for assignment topics (with yearGroupKeys).
- `AssignmentTopicListResponseSchema` — `z.array(AssignmentTopicSchema)`.
- `CreateAssignmentTopicInputSchema` / `UpdateAssignmentTopicInputSchema` / `DeleteAssignmentTopicInputSchema` — validate their respective request inputs (all require yearGroupKeys).
- `DeleteAssignmentTopicResponseSchema` — `z.void().nullable()`.

**Frontend Zod (secondary — `assignmentTopics.zod.ts`):**

- `AssignmentTopicSchema` (2 fields: key, name — **without** `yearGroupKeys` — in `assignmentTopics.zod.ts`; not used in production)
- `AssignmentTopicsResponseSchema` — `z.array(AssignmentTopicSchema)`
- This schema is **not imported** by any production service. The production `getAssignmentTopics()` in `assignmentTopicsService.ts` imports from `referenceData.zod.ts` instead.

**Backend transport validation:**

- No dedicated `z_Api` validation files — reference data handlers are inline closures that delegate directly to `ReferenceDataController`.
- The controller performs:
  - `Validate.requireParams({ record }, ...)` — ensures required wrapper parameters exist.
  - `_trimKey(key)` — validates key is a string and trims it (throws `TypeError` for non-strings).
  - `_normaliseName(name)` — validates name is a string (throws `TypeError` otherwise).
  - `_buildRecord(config, record)` — runs record through `Model.fromJSON()` which invokes the model's own parameter validation.

**Key domain validation rules (controller-level business logic):**

- **Duplicate name detection:** On create, `_createRecord()` checks all stored records for a normalised (lowercased, trimmed) name match. Throws `Error` if duplicate found.
- **Duplicate name detection on update:** `_updateRecord()` checks that the new normalised name does not conflict with a _different_ existing record. Same-key renames are allowed.
- **Record existence check on update/delete:** `_updateRecord()` and `_deleteRecord()` throw `Error` if the key is not found.
- **In-use protection on delete:** Before deleting, the controller checks the `inUseCollectionName` for any record whose `partialsReferenceField` matches the key.
  - Cohorts and YearGroups: checked against `abclass_partials` (field: `cohortKey` / `yearGroupKey`).
  - AssignmentTopics: checked against `assignment_definitions` (field: `primaryTopicKey`).
  - If referenced, throws `Error` with `reason: 'IN_USE'`, mapped to `IN_USE` error code in the transport envelope.

### Known discrepancies between backend and frontend

1. **Two `AssignmentTopicSchema` definitions exist — one without `yearGroupKeys`.**
   - Backend `AssignmentTopic.toJSON()` always emits `{ key, name, yearGroupKeys }`.
   - The primary frontend schema in `referenceData.zod.ts` (`AssignmentTopicSchema`) includes all three fields and is used by the production service.
   - The secondary frontend schema in `assignmentTopics.zod.ts` (`AssignmentTopicSchema`) defines only `{ key, name }` (no `yearGroupKeys`, uses `.strict()`).
   - **Classification: Fragile** — The secondary schema is unused by any production service (not imported by any `.ts` file except its own `.spec.ts`). If a future change started using it for response validation, it would reject valid backend responses that include `yearGroupKeys`. The secondary schema also uses `.strict()`, which means extra fields would be rejected, creating an additional mismatch. The `assignmentTopics.zod.ts` file appears to be dead code or a leftover from an earlier implementation.

2. **`CohortRecordInputSchema.active` is optional on create but `UpdateCohortRecordInputSchema.active` is required.**
   - Backend `Cohort` constructor defaults `active` to `true` when not provided.
   - Frontend `CohortRecordInputSchema` correctly defines `active` as `z.boolean().optional()`.
   - Frontend `UpdateCohortRecordInputSchema` defines `active` as `z.boolean()` (required).
   - **Classification: Aligned** — On update, the controller does not apply defaults; it merges the update record with the existing stored record via `_buildRecord()`. Requiring `active` on update ensures explicit intent. On create, the constructor default handles it.

3. **Delete endpoints return `null` (via `void` → `null` coercion).**
   - Backend delete methods return `undefined` (JavaScript implicit return). The `apiHandler._success()` method coerces `undefined` to `null` via `data ?? null`.
   - Frontend `Delete*ResponseSchema` all use `z.void().nullable()`.
   - **Classification: Aligned** — Both sides handle the null/void boundary consistently.

4. **Frontend `UpdateCohortInputSchema` wraps key and record in an object; backend handler destructures `parameters` directly.**
   - Backend handler: `updateCohort: (parameters) => new ReferenceDataController().updateCohort(parameters)` — passes the whole `parameters` object as the `payload` argument.
   - Frontend `UpdateCohortInputSchema`: `z.object({ key: ..., record: ... })` — validates `{ key, record }` shape.
   - **Classification: Aligned** — The controller's `updateCohort(payload)` destructures `{ key, record } = payload`. The frontend sends `{ key, record }` wrapped in `params` by `callApi`. The backend receives `params: { key, record }` and the inline closure passes `parameters` (which is `request.params`) directly to the controller.

5. **Duplicate name errors are mapped to `INTERNAL_ERROR` rather than `INVALID_REQUEST`.**
   - The controller throws a plain `Error` for duplicate names or not-found records. The error does not have a `name` matching `ApiValidationError`, so `_mapErrorToFailureEnvelope` maps it to `INTERNAL_ERROR`.
   - **Classification: Aligned** — The controller does not use `ApiValidationError` for these domain checks. The frontend receives `INTERNAL_ERROR` and treats it as an unexpected failure. This is intentional for the current implementation.

---

## File Index

```
Persistence models:
  ├── src/backend/Models/Cohort.js
  │     └── Cohort.toJSON()          — { key, name, active, startYear, startMonth }
  ├── src/backend/Models/YearGroup.js
  │     └── YearGroup.toJSON()       — { key, name }
  └── src/backend/Models/AssignmentTopic.js
        └── AssignmentTopic.toJSON() — { key, name, yearGroupKeys }

Controller:                 src/backend/y_controllers/ReferenceDataController.js
  ├── listCohorts() / createCohort() / updateCohort() / deleteCohort()
  ├── listYearGroups() / createYearGroup() / updateYearGroup() / deleteYearGroup()
  ├── listAssignmentTopics() / createAssignmentTopic() / updateAssignmentTopic() / deleteAssignmentTopic()
  ├── _getConfig(resourceType)       — returns per-resource config
  ├── _listRecords(config)           — shared list with name sorting
  ├── _createRecord(config, record)  — shared create with duplicate detection
  ├── _updateRecord(config, key, record) — shared update
  ├── _deleteRecord(config, key)      — shared delete with in-use protection
  ├── _buildRecord(config, record)    — canonical model round-trip (fromJSON → toJSON)
  ├── _trimKey(key)                  — key trimming and validation
  ├── _normaliseName(name)           — name normalisation for duplicate checks
  ├── _findByKey(records, key)       — key lookup
  ├── _findByNormalisedName(records, normalisedName) — normalised-name lookup
  ├── _toPlainObject(record)         — strips _id
  └── _sortRecordsByName(records)    — merge sort by name

API handlers:               src/backend/z_Api/z_apiHandler.js
  └── ALLOWLISTED_METHOD_HANDLERS    — inline closures:
        ├── getCohorts
        ├── createCohort
        ├── updateCohort
        ├── deleteCohort
        ├── getYearGroups
        ├── createYearGroup
        ├── updateYearGroup
        ├── deleteYearGroup
        ├── getAssignmentTopics
        ├── createAssignmentTopic
        ├── updateAssignmentTopic
        └── deleteAssignmentTopic

Transport envelope:         src/backend/z_Api/z_apiHandler.js
  └── apiHandler(), ApiDispatcher, ALLOWLISTED_METHOD_HANDLERS

Frontend:
  ├── src/frontend/src/services/referenceData/referenceData.zod.ts
  │     → CohortSchema, CohortListResponseSchema, CreateCohortResponseSchema,
  │       UpdateCohortResponseSchema, DeleteCohortResponseSchema,
  │       YearGroupSchema, YearGroupListResponseSchema, CreateYearGroupResponseSchema,
  │       UpdateYearGroupResponseSchema, DeleteYearGroupResponseSchema,
  │       AssignmentTopicSchema (3 fields), AssignmentTopicListResponseSchema,
  │       CreateAssignmentTopicResponseSchema, UpdateAssignmentTopicResponseSchema,
  │       DeleteAssignmentTopicResponseSchema,
  │       Create*InputSchema, Update*InputSchema, Delete*InputSchema
  ├── src/frontend/src/services/referenceData/referenceDataService.ts
  │     → getCohorts(), createCohort(), updateCohort(), deleteCohort(),
  │       getYearGroups(), createYearGroup(), updateYearGroup(), deleteYearGroup(),
  │       createAssignmentTopic(), updateAssignmentTopic(), deleteAssignmentTopic()
  ├── src/frontend/src/services/assignmentDefinition/assignmentTopics.zod.ts
  │     → AssignmentTopicSchema (2 fields: key, name — .strict(), no yearGroupKeys) — not used in production
  └── src/frontend/src/services/assignmentDefinition/assignmentTopicsService.ts
        → getAssignmentTopics() — validates against referenceData.zod.ts schemas
```
