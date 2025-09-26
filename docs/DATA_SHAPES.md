# Assignment Data Shapes

This document captures the serialized structures produced by the models shared in this repository. Every field shown is emitted today by the existing `toJSON()` implementations in:

- `Assignment`
- `TaskDefinition`
- `StudentSubmission`
- `StudentSubmissionItem`
- `BaseTaskArtifact`

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
