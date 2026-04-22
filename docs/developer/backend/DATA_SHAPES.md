# Assignment Data Shapes

> **Note:** Partial hydration outputs retain the `assessments` map but only carries the non-`reasoning` fields (typically just `score`), keeping the payload aligned with list-view needs. Full hydration records continue to store the full `reasoning` text.

- [Assignment Data Shapes](#assignment-data-shapes)
  - [Persistence Strategy \& Rationale](#persistence-strategy--rationale)
  - [ABClass (root) and JsonDbApp partial hydration](#abclass-root-and-jsondbapp-partial-hydration)
  - [ABClassPartials — class list index](#abclasspartials--class-list-index)
    - [Purpose](#purpose)
    - [Persistence strategy](#persistence-strategy)
    - [Shape](#shape)
  - [Google Classroom Picker and ABClass Mutation Transport Shapes](#google-classroom-picker-and-abclass-mutation-transport-shapes)
  - [Backend Configuration Transport Shapes](#backend-configuration-transport-shapes)
    - [`getBackendConfig` response data](#getbackendconfig-response-data)
    - [`setBackendConfig` request data](#setbackendconfig-request-data)
    - [`setBackendConfig` response data](#setbackendconfig-response-data)
    - [`getGoogleClassrooms` response data](#getgoogleclassrooms-response-data)
    - [ABClass write-boundary ownership](#abclass-write-boundary-ownership)
    - [`upsertABClass` request and response data](#upsertabclass-request-and-response-data)
    - [`updateABClass` request and response data](#updateabclass-request-and-response-data)
    - [`deleteABClass` response data](#deleteabclass-response-data)
  - [Assignment Definition](#assignment-definition)
    - [Full Assignment Definition Record (dedicated collection)](#full-assignment-definition-record-dedicated-collection)
  - [Partial Hydration (summary-level)](#partial-hydration-summary-level)
  - [Full Hydration (complete payload)](#full-hydration-complete-payload)
  - [Feedback Structure](#feedback-structure)
    - [Cell Reference Feedback (Sheets)](#cell-reference-feedback-sheets)
  - [Full Hydration Example with Assessments and Feedback](#full-hydration-example-with-assessments-and-feedback)
    - [Hydration Guidelines](#hydration-guidelines)

This document captures the serialized structures produced by the models shared in this repository. Every field shown is emitted today by the existing `toJSON()` implementations in:

- `Assignment`
- `AssignmentDefinition`
- `TaskDefinition`
- `StudentSubmission`
- `StudentSubmissionItem`
- `BaseTaskArtifact`

## Planned Helper Entries (Not Implemented)

- Assignment-definition task-weighting application helper
  - Status: `Not implemented`
  - Planning purpose: apply validated task-weighting patches to parsed or persisted `TaskDefinition` records before final save.
- Assignment-definition transport response normaliser
  - Status: `Not implemented`
  - Planning purpose: keep the full-definition upsert response contract explicit when the backend transport surface is added.
- Assignment-topics keyed resource config
  - Status: `Not implemented`
  - Planning purpose: extend the keyed reference-data pattern to assignment topics so topic authority matches cohorts and year groups.

## Persistence Strategy & Rationale

To balance performance with data fidelity in the Google Apps Script environment, we use a **Split Persistence Model**:

1. **Lightweight Class Record (`ABClass`)**:
   - **Purpose**: Fast loading for cohort analysis, averages, and list views.
   - **Storage**: The main `ABClass` document.
   - **Content**: Contains `assignments` as **Partial Summaries**. Heavy fields (artifacts, content) are stripped.
   - **Size Target**: < 1MB.

2. **Full Assignment Record (`assign_full_<courseId>_<assignmentId>`)**:
   - **Purpose**: Deep processing, re-running assessments, and lazy-loading.
   - **Storage**: A dedicated collection per assignment.
   - **Content**: **Full Fidelity**. Includes all artifacts, cached content, and hashes.
   - **Size Target**: < 20MB (GAS execution limit safe).
   - **Lazy Loading**: This record acts as a cache. During a run, we compare its `updatedAt` against Drive file modification times to skip fetching unchanged student work.

3. **Assignment Definition Registry (`assignment_definitions`)**:

- **Purpose**: Lightweight index of definitions shared across classes/years.
- **Storage**: Single collection keyed by `${primaryTitle}_${primaryTopic}_${yearGroup}`; when `yearGroup` is absent the canonical key uses the literal `null` sentinel (for example `${primaryTitle}_${primaryTopic}_null`).
- **Content**: **Partial** definition with `tasks: null` (no artifacts); includes metadata (titles, topics, yearGroup, weighting), `documentType` for routing, and doc IDs (`referenceDocumentId`, `templateDocumentId`) for reference.
- **Relationship**: Embedded into `Assignment` instances (Copy-on-Construct) and stored alongside partial assignments in `ABClass`.

1. **Full Assignment Definition Record (`assdef_full_<definitionKey>`)**:

- **Purpose**: Full-fidelity definition cache (all artifacts and hashes) for parsing and reuse without re-reading Drive when unchanged.
- **Storage**: Dedicated collection per definition key (mirrors the `assign_full_*` pattern for assignments).
- **Content**: Full artifacts, cached content, hashes, and timestamps.
- **Lazy Loading**: On run start, the controller fetches the full record synchronously and re-parses only when Drive timestamps are newer.

## ABClass (root) and JsonDbApp partial hydration

`ABClass` is the root object for serialized classroom data. When stored in or
rehydrated from a lightweight JSON-backed store such as JsonDbApp, the
container (`ABClass`) itself is usually fully populated with its direct
properties (for example: `classId`, `className`, `cohortKey`, `teachers`, and
`students`). Nested domain objects may be partially hydrated to keep reads
fast and payloads small. In our common pattern the `assignments` array is
frequently stored with a "partial" (summary-level) representation so that
list and overview flows avoid rehydrating heavy artifacts until required.

Example: `ABClass` rehydrated from JsonDbApp where contained `assignments`
are partially hydrated (note the embedded `assignmentDefinition` has `tasks: null` while retaining doc IDs for reference):

```json
{
  "classId": "C123",
  "className": "Year 10 English",
  "cohortKey": "2025",
  "courseLength": 1,
  "yearGroupKey": "10",
  "teachers": [{ "email": "teacher@school.com", "userId": "T1", "teacherName": "Ms Smith" }],
  "students": [{ "name": "Ada Lovelace", "email": "ada@school.com", "id": "S001" }],
  "assignments": [
    {
      "courseId": "C123",
      "assignmentId": "A1",
      "assignmentName": "Essay 1",
      "dueDate": null,
      "lastUpdated": "2025-09-10T12:34:56Z",
      "documentType": "SLIDES",
      "assignmentDefinition": {
        "primaryTitle": "Essay 1",
        "primaryTopic": "English",
        "yearGroup": 10,
        "alternateTitles": [],
        "alternateTopics": [],
        "documentType": "SLIDES",
        "referenceDocumentId": "DriveRef123",
        "templateDocumentId": "DriveTemplate123",
        "assignmentWeighting": null,
        "definitionKey": "Essay 1_English_10",
        "tasks": null,
        "createdAt": "2025-09-01T10:00:00Z",
        "updatedAt": "2025-09-01T10:00:00Z"
      },
      "submissions": []
    }
  ]
}
```

Key notes:

- The `ABClass` top-level fields are present and usable immediately.
- **Partial Assignment Definitions**: The embedded `assignmentDefinition` has `tasks: null` (explicit marker) to minimize payload size while retaining `referenceDocumentId` and `templateDocumentId` for reference.
- **Root `documentType`**: Preserved at assignment root for polymorphic routing (allows `Assignment.fromJSON` to instantiate correct subclass).
- **Fail-Fast Design**: Code expecting tasks will throw immediately on `null` rather than silently operating on empty objects.
- **Assignment Definition Embedding**: The `assignmentDefinition` object is embedded directly. For partial assignments in ABClass, the definition has `tasks: null` but includes doc IDs. Full assignments contain complete definitions with all tasks and artifacts. The assignment root includes `documentType` for polymorphic routing.
- This approach keeps server/drive calls minimal while maintaining a stable
  schema across hydration levels.
- During assessment runs it is acceptable for an `Assignment` instance to carry a
  transient `students` array that mirrors the roster pulled from `ABClass`. This
  field exists purely for in-flight processing and **must never be persisted** in
  JsonDbApp or other serialized stores; doing so will duplicate roster entries
  each time an assessment is rehydrated.

**Partial Definition Detection**: Code detects partial definitions via `assignmentDefinition.tasks === null` (not `undefined` or `{}`). This explicit marker enables fail-fast behavior when tasks are accessed without proper rehydration.

Hydration markers (`_hydrationLevel`) are runtime-only flags set to `'full'` or
`'partial'` so controllers know whether an `Assignment` holds the entire payload
or a lightweight summary. They are never serialized in either the ABClass record
or the dedicated `assign_full_*` collections.

The same schema is used for every hydration level. Partial definitions use `tasks: null` as an explicit marker rather than redacted artifacts with null content.

## ABClassPartials — class list index

`abclass_partials` is a flat registry (one document per class) designed for fast class-list retrieval without loading the full `ABClass` records (which include heavy `students` and `assignments` arrays).

### Purpose

- Supports frontend class listing without loading all full `ABClass` records.
- Maintained in sync on every class write path by `ABClassController._upsertClassPartial()`.
- Retrieved via the `getABClassPartials` API method.
- Read responses are normalised by `ABClassController.getAllClassPartials()` before leaving the backend transport boundary.

### Persistence strategy

- **Collection name**: `abclass_partials`
- **One document per class**, keyed by `classId`.
- Written by `ABClassController._persistClassAndPartial()` (on `saveClass`) and `ABClassController._persistRoster()` (on roster refresh).
- Produced by `ABClass.toPartialJSON()` — the canonical source of truth for the partial shape.

### Shape

```json
{
  "classId": "C123",
  "className": "Year 10 English",
  "cohortKey": "2025",
  "courseLength": 1,
  "yearGroupKey": "10",
  "classOwner": { "userId": "T0", "email": "owner@school.com", "teacherName": "Ms Owner" },
  "teachers": [{ "email": "teacher@school.com", "userId": "T1", "teacherName": "Ms Smith" }],
  "active": true
}
```

Key notes:

- `students` and `assignments` are **intentionally excluded** to keep the document lightweight.
- `active` is an explicit boolean (or `null` when unknown) persisted on `ABClass` and always included in the partial.
- `classOwner` is serialised in partial transport via `ABClass.toPartialJSON()` (includes serialisation delegation for `Teacher` instances).
- `classOwner` and every entry in `teachers` are teacher summary objects with `userId`, `email`, and `teacherName` fields only.
- Derived display fields such as `cohortLabel` and `yearGroupLabel` are intentionally excluded from backend transport; frontend view-models derive them from reference-data maps.
- `getABClassPartials` returns the documented shape above, not the raw stored document. Storage-only fields such as `_id` and any accidental extras in the collection are stripped during normalisation.

## Google Classroom Picker and ABClass Mutation Transport Shapes

These shapes describe the `data` payload inside the stable `apiHandler` transport envelope:

- Success: `{ ok: true, requestId, data }`
- Error: `{ ok: false, requestId, error: { code, message, retriable } }`

Frontend callers should use `callApi(...)` with the exact allowlisted backend method names.

## Backend Configuration Transport Shapes

Backend configuration transport now uses the `src/backend/z_Api` API layer only. The legacy `src/backend/ConfigurationManager/99_globals.js` transport file has been removed and should not be treated as an active contract source.

These shapes describe the `data` payload inside the stable `apiHandler` transport envelope:

- Success: `{ ok: true, requestId, data }`
- Error: `{ ok: false, requestId, error: { code, message, retriable } }`

Frontend callers should use `src/frontend/src/services/backendConfigurationService.ts`, which validates payloads with the Zod schemas in `src/frontend/src/services/backendConfiguration.zod.ts`.

### `getBackendConfig` response data

```json
{
  "backendAssessorBatchSize": 30,
  "apiKey": "****7890",
  "hasApiKey": true,
  "backendUrl": "https://backend.example.test",
  "revokeAuthTriggerSet": true,
  "daysUntilAuthRevoke": 45,
  "slidesFetchBatchSize": 20,
  "jsonDbMasterIndexKey": "MASTER_INDEX",
  "jsonDbLockTimeoutMs": 5000,
  "jsonDbLogLevel": "INFO",
  "jsonDbBackupOnInitialise": false,
  "jsonDbRootFolderId": "folder-123"
}
```

Key notes:

- `apiKey` is a masked display value, never the raw stored secret.
- Masking contract: the value is `''`, `'****'`, or `'****'` plus the visible four-character suffix.
- `hasApiKey` indicates whether a raw key exists in storage before masking.
- When the stored configuration object is completely empty, `ConfigurationManager.ensureDefaultConfiguration()` persists the defaultable backend settings before this payload is returned.
- `apiKey`, `backendUrl`, and `jsonDbRootFolderId` are not seeded during that first-time bootstrap when they are absent.
- `jsonDbRootFolderId` is normalised to `''` in the response when the stored value is blank or unset.
- The remaining fields are the public configuration values exposed to the frontend configuration UI.

### `setBackendConfig` request data

`setBackendConfig` accepts a partial patch object. Only supplied fields are written.

```json
{
  "backendAssessorBatchSize": 42,
  "apiKey": "new-secret-key",
  "backendUrl": "https://backend.example.test",
  "revokeAuthTriggerSet": true,
  "daysUntilAuthRevoke": 21,
  "slidesFetchBatchSize": 25,
  "jsonDbMasterIndexKey": "MASTER_INDEX",
  "jsonDbLockTimeoutMs": 5000,
  "jsonDbLogLevel": "INFO",
  "jsonDbBackupOnInitialise": false,
  "jsonDbRootFolderId": "folder-123"
}
```

Writable patch fields:

- `backendAssessorBatchSize`
- `apiKey`
- `backendUrl`
- `revokeAuthTriggerSet`
- `daysUntilAuthRevoke`
- `slidesFetchBatchSize`
- `jsonDbMasterIndexKey`
- `jsonDbLockTimeoutMs`
- `jsonDbLogLevel`
- `jsonDbBackupOnInitialise`
- `jsonDbRootFolderId`

Key notes:

- Omitted fields are not written.
- An explicit empty-string `apiKey` clears the stored key.
- `params` must be an object; malformed payloads are rejected at the API boundary.

### `setBackendConfig` response data

```json
{ "success": true }
```

or

```json
{ "success": false, "error": "Failed to save some configuration values: backendUrl: REDACTED" }
```

Key notes:

- Save-result contract: `{ success: true } | { success: false, error: string }`.
- The result reports aggregate write failure without exposing raw secret values.

### `getGoogleClassrooms` response data

`getGoogleClassrooms` is a picker endpoint backed by `src/backend/z_Api/googleClassrooms.js`. It calls `ClassroomApiClient.fetchAllActiveClassrooms()` and maps each active course row to the narrow transport shape below.

```json
[
  {
    "classId": "1234567890",
    "className": "Year 10 English"
  }
]
```

Key notes:

- Only `classId` and `className` are returned.
- `teachers`, `students`, `classOwner`, and `enrollmentCode` are intentionally excluded.
- If the client returns a malformed row missing `id` or `name`, the handler throws `ApiValidationError` and the transport envelope reports `INVALID_REQUEST`.
- If the upstream Classroom fetch itself fails, the current Classroom client logs the failure and returns `[]`, so the transport payload remains an empty list rather than an error envelope.

### ABClass write-boundary ownership

The ABClass write endpoints in `src/backend/z_Api/abclassMutations.js` split ownership of fields as follows:

- User-managed inputs: `cohortKey`, `yearGroupKey`, `courseLength`, `active`
- Google-derived write-path fields: `className`, `classOwner`, `teachers`, `students`
- Out of scope for these endpoints: `assignments` payload mutation

`upsertABClass` refreshes Google-derived roster data on write paths. `updateABClass` does not allow direct patching of Google-derived roster fields or assignments.

### `upsertABClass` request and response data

Request data:

```json
{
  "classId": "1234567890",
  "cohortKey": "2025",
  "yearGroupKey": "10",
  "courseLength": 2
}
```

Response data:

```json
{
  "classId": "1234567890",
  "className": "Year 10 English",
  "cohortKey": "2025",
  "courseLength": 2,
  "yearGroupKey": "10",
  "classOwner": { "userId": "T0", "email": "owner@school.com", "teacherName": "Ms Owner" },
  "teachers": [{ "userId": "T1", "email": "teacher@school.com", "teacherName": "Ms Smith" }],
  "active": true
}
```

Key notes:

- Required request fields: `classId`, `cohortKey`, `yearGroupKey`, `courseLength`.
- `courseLength` must be an integer greater than or equal to `1`.
- The controller hydrates `classOwner`, `teachers`, and `students` from Google Classroom before persisting.
- When the class already exists, the controller preserves existing `assignments` while refreshing roster data.
- The response is the partial class summary from `ABClass.toPartialJSON()`, so `students` and `assignments` are not returned.
- New-class upsert paths set `active` to `true`; update paths only change `active` when explicitly patched.

### `updateABClass` request and response data

Request data:

```json
{
  "classId": "1234567890",
  "active": false,
  "courseLength": 2
}
```

Response data uses the same partial class summary shape as `upsertABClass`.

Key notes:

- Required request field: `classId`.
- Optional patch fields: `cohortKey`, `yearGroupKey`, `courseLength`, `active`.
- Forbidden transport fields: `classOwner`, `teachers`, `students`, `assignments`.
- For an existing class, only supplied patch fields are updated. Excluded fields remain untouched.
- If the class is missing, the controller throws `RangeError`; `updateABClass` is not an upsert path.
- For existing classes, omitted fields retain their stored values; the `ABClass` constructor defaults apply only on create paths such as `upsertABClass`.

### `deleteABClass` response data

`deleteABClass` removes both persistence layers:

- the full class collection via `dropCollection(classId)`
- the `abclass_partials` registry row via `deleteOne({ classId })`

Response data:

```json
{
  "classId": "1234567890",
  "fullClassDeleted": true,
  "partialDeleted": true
}
```

Key notes:

- The booleans report what was deleted in that call only.
- Repeated deletes are idempotent and still succeed with updated flags.

## Assignment Definition

The `AssignmentDefinition` model encapsulates reusable lesson properties. It is persisted twice: a partial copy in `assignment_definitions` (for embedding) and a full copy in `assdef_full_<definitionKey>` (for reuse without re-parsing). Assignments embed the partial copy.

```json
{
  "primaryTitle": "Essay 1",
  "primaryTopic": "English",
  "yearGroup": 10,
  "alternateTitles": [],
  "alternateTopics": [],
  "documentType": "SLIDES",
  "referenceDocumentId": "DriveRef123",
  "templateDocumentId": "DriveTemplate123",
  "referenceLastModified": "2025-09-01T10:00:00Z",
  "templateLastModified": "2025-09-01T10:00:00Z",
  "assignmentWeighting": null,
  "definitionKey": "Essay 1_English_10",
  "tasks": {
    "t_ab12": {
      "id": "t_ab12",
      "taskTitle": "Introduction",
      "pageId": "p-1",
      "taskNotes": null,
      "taskMetadata": {},
      "taskWeighting": null,
      "index": 0,
      "artifacts": {
        "reference": [],
        "template": []
      }
    }
  },
  "createdAt": "2025-09-01T10:00:00Z",
  "updatedAt": "2025-09-01T10:00:00Z"
}
```

### Full Assignment Definition Record (dedicated collection)

Stored under `assdef_full_<definitionKey>`, containing full artifact content/hashes for reuse.

```json
{
  "primaryTitle": "Essay 1",
  "primaryTopic": "English",
  "yearGroup": 10,
  "alternateTitles": [],
  "alternateTopics": [],
  "documentType": "SLIDES",
  "referenceDocumentId": "DriveRef123",
  "templateDocumentId": "DriveTemplate123",
  "referenceLastModified": "2025-09-01T10:00:00Z",
  "templateLastModified": "2025-09-01T10:00:00Z",
  "assignmentWeighting": null,
  "definitionKey": "Essay 1_English_10",
  "tasks": {
    "t_ab12": {
      "id": "t_ab12",
      "taskTitle": "Introduction",
      "pageId": "p-1",
      "taskNotes": null,
      "taskMetadata": {},
      "taskWeighting": null,
      "index": 0,
      "artifacts": {
        "reference": [
          {
            "taskId": "t_ab12",
            "role": "reference",
            "pageId": "p-1",
            "documentId": "DriveRef123",
            "content": "<base64 encoded reference slide>, string or array depending on type",
            "contentHash": "9f6a...",
            "metadata": {},
            "uid": "t_ab12-0-reference-p-1-0",
            "type": "TEXT"
          }
        ],
        "template": [
          {
            "taskId": "t_ab12",
            "role": "template",
            "pageId": "p-1",
            "documentId": "DriveTemplate123",
            "content": "<base64 encoded template slide>, string or array depending on type",
            "contentHash": "8e5b...",
            "metadata": {},
            "uid": "t_ab12-0-template-p-1-0",
            "type": "TEXT"
          }
        ]
      }
    }
  },
  "createdAt": "2025-09-01T10:00:00Z",
  "updatedAt": "2025-09-01T10:00:00Z"
}

### Controller API 🔧

- **getAllPartialDefinitions()** — `AssignmentDefinitionController.getAllPartialDefinitions()` returns an array of rehydrated `AssignmentDefinition` model instances loaded from the registry collection (`assignment_definitions`).
  - Uses `DbManager.readAll('assignment_definitions')` to obtain a snapshot of documents and `AssignmentDefinition.fromJSON()` to rehydrate each document.
  - Preserves *partial* hydration semantics (i.e., `tasks === null`) — callers should rehydrate to full definitions via the controller when they require task artifacts.
  - Returns an empty array when the registry collection is empty.

Tests: `tests/controllers/assignmentDefinitionController.test.js` (covers populated and empty-registry cases).
```

## Partial Hydration (summary-level)

Used when we want a lightweight snapshot for list views or quick comparisons. The embedded `assignmentDefinition` has `tasks: null` to reduce payload size while retaining `referenceDocumentId` and `templateDocumentId` for reference. Submission artifacts are redacted (no `content` payload).

```json
{
  "courseId": "C123",
  "assignmentId": "A1",
  "assignmentName": "Essay 1",
  "dueDate": null,
  "lastUpdated": "2025-09-10T12:34:56Z",
  "documentType": "SLIDES",
  "assignmentDefinition": {
    "primaryTitle": "Essay 1",
    "primaryTopic": "English",
    "yearGroup": 10,
    "alternateTitles": [],
    "alternateTopics": [],
    "documentType": "SLIDES",
    "referenceDocumentId": "DriveRef123",
    "templateDocumentId": "DriveTemplate123",
    "assignmentWeighting": null,
    "definitionKey": "Essay 1_English_10",
    "tasks": null,
    "createdAt": "2025-09-01T10:00:00Z",
    "updatedAt": "2025-09-01T10:00:00Z"
  },
  "submissions": [
    {
      "studentId": "S001",
      "studentName": "Ada Lovelace",
      "assignmentId": "A1",
      "documentId": "DriveFile123",
      "items": {
        "t_ab12": {
          "id": "ssi_abc123",
          "taskId": "t_ab12",
          "artifact": {
            "taskId": "t_ab12",
            "role": "submission",
            "pageId": "p-1",
            "documentId": "DriveFile123",
            "content": null,
            "contentHash": null,
            "metadata": {},
            "uid": "t_ab12-S001-p-1-0",
            "type": "TEXT"
          },
          "assessments": {
            "completeness": {
              "score": 4
            },
            "accuracy": {
              "score": 3
            },
            "spag": {
              "score": 5
            }
          },
          "feedback": {
            "cellReference": {
              "type": "cellReference",
              "createdAt": "2025-09-10T12:00:00Z",
              "items": [
                {
                  "location": "A1",
                  "status": "correct"
                },
                {
                  "location": "B3",
                  "status": "incorrect"
                }
              ]
            }
          }
        }
      },
      "createdAt": "2025-09-10T10:00:00Z",
      "updatedAt": "2025-09-10T12:30:00Z"
    }
  ]
}
```

## Full Hydration (complete payload)

For grading, auditing, or export flows we rehydrate every artifact exactly as stored.

The **high-level shape stays consistent** (assignment identity + embedded `assignmentDefinition` + `submissions`), but **partial and full payloads are not field-identical**:

- Partial payloads omit root-level `tasks`/doc IDs and use `assignmentDefinition.tasks: null` as an explicit marker.
- Full payloads include the complete `tasks` map and document IDs.

Partial JSONs also redact artifact `content`/`contentHash` and drop the `reasoning` entries from assessments so scores remain accessible while the payload stays lightweight; feedback objects remain intact in both partial and full forms.

```json
{
  "courseId": "C123",
  "assignmentId": "A1",
  "assignmentName": "Essay 1",
  "dueDate": null,
  "lastUpdated": "2025-09-10T12:34:56Z",
  "documentType": "SLIDES",
  "referenceDocumentId": "DriveRef123",
  "templateDocumentId": "DriveTemplate123",
  "tasks": {
    "t_ab12": {
      "id": "t_ab12",
      "taskTitle": "Introduction",
      "pageId": "p-1",
      "taskNotes": null,
      "taskMetadata": {},
      "taskWeighting": null,
      "index": 0,
      "artifacts": {
        "reference": [
          {
            "taskId": "t_ab12",
            "role": "reference",
            "pageId": "p-1",
            "documentId": "DriveRef123",
            "content": "<base64 encoded reference slide>, string or array depending on type",
            "contentHash": "9f6a...",
            "metadata": {},
            "uid": "t_ab12-0-reference-p-1-0",
            "type": "TEXT"
          }
        ],
        "template": [
          {
            "taskId": "t_ab12",
            "role": "template",
            "pageId": "p-1",
            "documentId": "DriveTemplate123",
            "content": "<base64 encoded template slide>, string or array depending on type",
            "contentHash": "8e5b...",
            "metadata": {},
            "uid": "t_ab12-0-template-p-1-0",
            "type": "TEXT"
          }
        ]
      }
    }
  },
  "assignmentDefinition": {
    "primaryTitle": "Essay 1",
    "primaryTopic": "English",
    "yearGroup": 10,
    "alternateTitles": [],
    "alternateTopics": [],
    "documentType": "SLIDES",
    "referenceDocumentId": "DriveRef123",
    "templateDocumentId": "DriveTemplate123",
    "referenceLastModified": "2025-09-01T10:00:00Z",
    "templateLastModified": "2025-09-01T10:00:00Z",
    "assignmentWeighting": null,
    "definitionKey": "Essay 1_English_10",
    "tasks": {
      "t_ab12": {
        "id": "t_ab12",
        "taskTitle": "Introduction",
        "pageId": "p-1",
        "taskNotes": null,
        "taskMetadata": {},
        "taskWeighting": null,
        "index": 0,
        "artifacts": {
          "reference": [
            {
              "taskId": "t_ab12",
              "role": "reference",
              "pageId": "p-1",
              "documentId": "DriveRef123",
              "content": "<base64 encoded reference slide>, string or array depending on type",
              "contentHash": "9f6a...",
              "metadata": {},
              "uid": "t_ab12-0-reference-p-1-0",
              "type": "TEXT"
            }
          ],
          "template": [
            {
              "taskId": "t_ab12",
              "role": "template",
              "pageId": "p-1",
              "documentId": "DriveTemplate123",
              "content": "<base64 encoded template slide>, string or array depending on type",
              "contentHash": "8e5b...",
              "metadata": {},
              "uid": "t_ab12-0-template-p-1-0",
              "type": "TEXT"
            }
          ]
        }
      }
    },
    "createdAt": "2025-09-01T10:00:00Z",
    "updatedAt": "2025-09-01T10:00:00Z"
  },
  "submissions": [
    {
      "studentId": "S001",
      "studentName": "Ada Lovelace",
      "assignmentId": "A1",
      "documentId": "DriveFile123",
      "items": {
        "t_ab12": {
          "id": "ssi_abc123",
          "taskId": "t_ab12",
          "artifact": {
            "taskId": "t_ab12",
            "role": "submission",
            "pageId": "p-1",
            "documentId": "DriveFile123",
            "content": "<extracted student response>",
            "contentHash": "ab12...",
            "metadata": {
              "detectedLanguage": "en"
            },
            "uid": "t_ab12-S001-p-1-0",
            "type": "TEXT"
          },
          "assessments": {
            "completeness": {
              "score": 5,
              "reasoning": "All parts present."
            }
          },
          "feedback": {
            "cellReference": {
              "type": "cellReference",
              "createdAt": "2025-09-10T12:00:00Z",
              "items": [
                {
                  "location": "A1",
                  "status": "correct"
                },
                {
                  "location": "B2",
                  "status": "correct"
                }
              ]
            }
          }
        }
      },
      "createdAt": "2025-09-10T10:00:00Z",
      "updatedAt": "2025-09-10T12:30:00Z#2"
    }
  ]
}
```

Assessments are stored as a map keyed by assessment criterion (e.g., `'completeness'`, `'accuracy'`, `'spag'`). Each assessment contains a score and reasoning provided by the LLM.

```json
{
  "completeness": {
    "score": 4,
    "reasoning": "The student attempted 8 out of 10 required tasks. Missing responses to questions 3 and 7."
  },
  "accuracy": {
    "score": 3,
    "reasoning": "Multiple calculation errors identified. Correct method shown but arithmetic mistakes in 3 sections."
  },
  "spag": {
    "score": 5,
    "reasoning": "Excellent spelling, punctuation, and grammar throughout. No errors detected."
  }
}
```

Partial hydration uses the same assessment map but drops every `reasoning` field so list views still have the numeric scores without the verbose explanations.

**Score values**:

- `0–5`: Numeric score (0 = fail, 5 = excellent)
- `"N"`: Not attempted / not applicable (used for criteria that don't apply to a task type)

**Fields**:

- `score`: Number or string; the assessment grade.
- `reasoning`: String; the LLM's explanation of why this score was given.

## Feedback Structure

Feedback is stored as a map keyed by feedback type. Currently, only cell reference feedback is implemented for Sheets tasks.

### Cell Reference Feedback (Sheets)

For spreadsheet tasks, tracks cell-level correctness:

```json
{
  "cellReference": {
    "type": "cellReference",
    "createdAt": "2025-09-10T12:00:00Z",
    "items": [
      {
        "location": "A1",
        "status": "correct"
      },
      {
        "location": "B3",
        "status": "incorrect"
      },
      {
        "location": "C5",
        "status": "notAttempted"
      }
    ]
  }
}
```

**Cell status values**:

- `"correct"`: Formula or cell content matches expected value
- `"incorrect"`: Formula or cell content does not match
- `"notAttempted"`: Cell was left blank or not provided

**Fields**:

- `type`: String; identifies feedback class (`'cellReference'`)
- `createdAt`: ISO string timestamp of when feedback was generated
- `items`: Array of cell feedback objects, each with `location` and `status`

## Full Hydration Example with Assessments and Feedback

When assessments and feedback data exists, both partial and full hydration include the complete records:

```json
{
  "courseId": "C123",
  "assignmentId": "A1",
  "assignmentName": "Essay 1",
  "dueDate": null,
  "lastUpdated": "2025-09-10T12:34:56Z",
  "documentType": "SLIDES",
  "submissions": [
    {
      "studentId": "S001",
      "studentName": "Ada Lovelace",
      "assignmentId": "A1",
      "documentId": "DriveFile123",
      "items": {
        "t_ab12": {
          "id": "ssi_abc123",
          "taskId": "t_ab12",
          "artifact": {
            "taskId": "t_ab12",
            "role": "submission",
            "pageId": "p-1",
            "documentId": "DriveFile123",
            "content": "<extracted student response>",
            "contentHash": "ab12...",
            "metadata": {},
            "uid": "t_ab12-S001-p-1-0",
            "type": "TEXT"
          },
          "assessments": {
            "completeness": {
              "score": 4,
              "reasoning": "Student addressed 8 of 10 key points. Structure is clear."
            },
            "accuracy": {
              "score": 3,
              "reasoning": "Main arguments are sound but one factual error noted in paragraph 2."
            },
            "spag": {
              "score": 5,
              "reasoning": "No spelling, punctuation, or grammar errors identified."
            }
          },
          "feedback": {
            "cellReference": {
              "type": "cellReference",
              "createdAt": "2025-09-10T12:00:00Z",
              "items": [
                {
                  "location": "A1",
                  "status": "correct"
                },
                {
                  "location": "B2",
                  "status": "correct"
                },
                {
                  "location": "C3",
                  "status": "incorrect"
                }
              ]
            }
          }
        }
      },
      "createdAt": "2025-09-10T10:00:00Z",
      "updatedAt": "2025-09-10T12:30:00Z#2"
    }
  ]
}
```

### Hydration Guidelines

- **Same keys, different payload weight**: Partial and full documents are interchangeable because they share the identical key structure. Downstream code can detect missing payloads (for example, `content === null`) to decide when to rehydrate.
- **Artifacts drive rehydration**: `BaseTaskArtifact.uid` plus `taskId` uniquely identifies any heavy resource to fetch later.
- **Artifact type vs external Drive type**: The `type` field on artifacts refers to the artifact class/type produced by the system (for example: `"TEXT"`, `"TABLE"`, `"SPREADSHEET"`, `"IMAGE"`, or the generic `"base"`). It is not a Google Drive MIME type. If a Drive MIME/type is required, include it in `metadata` or `documentId`.
- **Timestamps in feedback**: `Feedback.toJSON()` now emits `createdAt` as an ISO string (e.g. `"2025-09-10T12:00:00Z"`) to match other timestamps in this document.
- **StudentSubmission updatedAt format**: The `updatedAt` field uses a monotonic counter suffix (e.g., `"2025-09-10T12:30:00Z#2"`) to ensure strictly increasing timestamps even when multiple updates occur within the same millisecond. The counter is incremented by `touchUpdated()` on each modification.
- **Assessments and feedback**: The `assessments` map keeps the same keys in both partial and full hydration so scores remain available, but partial documents omit each `reasoning` property to keep the summary lightweight. Feedback objects continue to be fully preserved in both payloads.

By constraining the document to the fields emitted today, we minimize Drive calls without introducing new schema variants or migration overhead.
