# Assignment Data Shapes

This document captures the serialized structures produced by the models shared in this repository. Every field shown is emitted today by the existing `toJSON()` implementations in:

- `Assignment`
- `TaskDefinition`
- `StudentSubmission`
- `StudentSubmissionItem`
- `BaseTaskArtifact`

## ABClass (root) and JsonDbApp partial hydration

`ABClass` is the root object for serialized classroom data. When stored in or
rehydrated from a lightweight JSON-backed store such as JsonDbApp, the
container (`ABClass`) itself is usually fully populated with its direct
properties (for example: `classId`, `className`, `cohort`, `teachers`, and
`students`). Nested domain objects may be partially hydrated to keep reads
fast and payloads small. In our common pattern the `assignments` array is
frequently stored with a "partial" (summary-level) representation so that
list and overview flows avoid rehydrating heavy artifacts until required.

Example: `ABClass` rehydrated from JsonDbApp where contained `assignments`
are partially hydrated (note `tasks` contain artifacts with `content: null`):

```json
{
  "classId": "C123",
  "className": "Year 10 English",
  "cohort": "2025",
  "courseLength": 1,
  "yearGroup": 10,
  "teachers": [{ "id": "T1", "name": "Ms Smith" }],
  "students": [{ "id": "S001", "name": "Ada Lovelace" }],
  "assignments": [
    {
      "assignmentId": "A1",
      "assignmentName": "Essay 1",
      "lastUpdated": "2025-09-10T12:34:56Z",
      "tasks": {
        "t_ab12": {
          "id": "t_ab12",
          "taskTitle": "Introduction",
          "pageId": "p-1",
          "taskNotes": "Focus on thesis clarity",
          "taskMetadata": {},
          "taskWeighting": 1,
          "index": 0,
          "artifacts": {
            "reference": [
              {
                "taskId": "t_ab12",
                "role": "reference",
                "pageId": "p-1",
                "documentId": "DriveRef123",
                "content": null,
                "contentHash": null,
                "metadata": {},
                "uid": "t_ab12-0-reference-p-1-0",
                "type": "TEXT"
              }
            ],
            "template": []
          }
        }
      },
      "submissions": []
    }
  ]
}
```

Key notes:

- The `ABClass` top-level fields are present and usable immediately.
- Assignment-level payloads keep the same key structure as fully-hydrated
  documents but elide heavy fields (for example: `artifact.content` is
  `null`). Downstream code can detect these stubs and rehydrate on demand
  using the `uid`/`taskId` identifiers.
- This approach keeps server/drive calls minimal while maintaining a stable
  schema across hydration levels.
- During assessment runs it is acceptable for an `Assignment` instance to carry a
  transient `students` array that mirrors the roster pulled from `ABClass`. This
  field exists purely for in-flight processing and **must never be persisted** in
  JsonDbApp or other serialized stores; doing so will duplicate roster entries
  each time an assessment is rehydrated.

The same schema is used for every hydration level. Lower hydration simply elides heavy payloads while keeping enough identifiers to rehydrate on demand.

## Partial Hydration (summary-level)

Used when we want a lightweight snapshot for list views or quick comparisons. Artifacts are kept as stubs (no `content` payload) and submission details retain only inexpensive maps.

```json
{
  "courseId": "C123",
  "assignmentId": "A1",
  "assignmentName": "Essay 1",
  "assignmentWeighting": null,
  "assignmentMetadata": null,
  "dueDate": null,
  "lastUpdated": "2025-09-10T12:34:56Z",
  "tasks": {
    "t_ab12": {
      "id": "t_ab12",
      "taskTitle": "Introduction",
      "pageId": "p-1",
      "taskNotes": "Focus on thesis clarity",
      "taskMetadata": {},
      "taskWeighting": 1,
      "index": 0,
      "artifacts": {
        "reference": [
          {
            "taskId": "t_ab12",
            "role": "reference",
            "pageId": "p-1",
            "documentId": "DriveRef123",
            "content": null,
            "contentHash": null,
            "metadata": {},
            "uid": "t_ab12-0-reference-p-1-0",
            "type": "TEXT"
          }
        ],
        "template": []
      }
    }
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
          "assessments": {},
          "feedback": {}
        }
      },
      "createdAt": "2025-09-10T10:00:00Z",
      "updatedAt": "2025-09-10T12:30:00Z#2"
    }
  ]
}
```

## Full Hydration (complete payload)

For grading, auditing, or export flows we rehydrate every artifact exactly as stored. The schema stays identical; heavier fields are simply populated.

```json
{
  "courseId": "C123",
  "assignmentId": "A1",
  "assignmentName": "Essay 1",
  "assignmentWeighting": null,
  "assignmentMetadata": null,
  "dueDate": null,
  "lastUpdated": "2025-09-10T12:34:56Z",
  "tasks": {
    "t_ab12": {
      "id": "t_ab12",
      "taskTitle": "Introduction",
      "pageId": "p-1",
      "taskNotes": "Focus on thesis clarity",
      "taskMetadata": {},
      "taskWeighting": 1,
      "index": 0,
      "artifacts": {
        "reference": [
          {
            "taskId": "t_ab12",
            "role": "reference",
            "pageId": "p-1",
            "documentId": "DriveRef123",
            "content": "<base64 encoded slides>",
            "contentHash": "9f6a...",
            "metadata": {
              "pageCount": 5
            },
            "uid": "t_ab12-0-reference-p-1-0",
            "type": "TEXT"
          }
        ],
        "template": []
      }
    }
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
            "overall": {
              "score": 20,
              "band": "A"
            }
          },
          "feedback": {
            "summary": {
              "text": "Strong thesis and supporting detail."
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
- **Assessments and feedback**: These maps stay in place even at lower hydration so scoring summaries do not require rehydration. Populate them only when the data exists.

By constraining the document to the fields emitted today, we minimize Drive calls without introducing new schema variants or migration overhead.
