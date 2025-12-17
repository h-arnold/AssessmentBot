# Assignment Data Shapes

> **Note:** Partial hydration outputs retain the `assessments` map but only carries the non-`reasoning` fields (typically just `score`), keeping the payload aligned with list-view needs. Full hydration records continue to store the full `reasoning` text.

- [Assignment Data Shapes](#assignment-data-shapes)
  - [Persistence Strategy \& Rationale](#persistence-strategy--rationale)
  - [ABClass (root) and JsonDbApp partial hydration](#abclass-root-and-jsondbapp-partial-hydration)
  - [Assignment Definition](#assignment-definition)
    - [Full Assignment Definition Record (dedicated collection)](#full-assignment-definition-record-dedicated-collection)
  - [Partial Hydration (summary-level)](#partial-hydration-summary-level)
  - [Feedback Structure](#feedback-structure)
    - [Generic Feedback](#generic-feedback)
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

## Persistence Strategy & Rationale

To balance performance with data fidelity in the Google Apps Script environment, we use a **Split Persistence Model**:

1.  **Lightweight Class Record (`ABClass`)**:
    - **Purpose**: Fast loading for cohort analysis, averages, and list views.
    - **Storage**: The main `ABClass` document.
    - **Content**: Contains `assignments` as **Partial Summaries**. Heavy fields (artifacts, content) are stripped.
    - **Size Target**: < 1MB.

2.  **Full Assignment Record (`assign_full_<courseId>_<assignmentId>`)**:
    - **Purpose**: Deep processing, re-running assessments, and lazy-loading.
    - **Storage**: A dedicated collection per assignment.
    - **Content**: **Full Fidelity**. Includes all artifacts, cached content, and hashes.
    - **Size Target**: < 20MB (GAS execution limit safe).
    - **Lazy Loading**: This record acts as a cache. During a run, we compare its `updatedAt` against Drive file modification times to skip fetching unchanged student work.

3.  **Assignment Definition Registry (`assignment_definitions`)**:

- **Purpose**: Lightweight index of definitions shared across classes/years.
- **Storage**: Single collection keyed by `${primaryTitle}_${primaryTopic}_${yearGroup}`.
- **Content**: **Ultra-minimal Partial** definition with `tasks: null` (no artifacts, no doc IDs); includes only metadata (titles, topics, yearGroup, weighting) plus `documentType` for routing.
- **Relationship**: Embedded into `Assignment` instances (Copy-on-Construct) and stored alongside partial assignments in `ABClass`.

4.  **Full Assignment Definition Record (`assdef_full_<definitionKey>`)**:

- **Purpose**: Full-fidelity definition cache (all artifacts and hashes) for parsing and reuse without re-reading Drive when unchanged.
- **Storage**: Dedicated collection per definition key (mirrors the `assign_full_*` pattern for assignments).
- **Content**: Full artifacts, cached content, hashes, and timestamps.
- **Lazy Loading**: On run start, the controller fetches the full record synchronously and re-parses only when Drive timestamps are newer.

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
are partially hydrated (note the embedded `assignmentDefinition` has `tasks: null` and omits doc IDs):

```json
{
  "classId": "C123",
  "className": "Year 10 English",
  "cohort": "2025",
  "courseLength": 1,
  "yearGroup": 10,
  "teachers": [{ "email": "teacher@school.com", "userId": "T1", "teacherName": "Ms Smith" }],
  "students": [{ "name": "Ada Lovelace", "email": "ada@school.com", "id": "S001" }],
  "assignments": [
    {
      "courseId": "C123",
      "assignmentId": "A1",
      "assignmentName": "Essay 1",
      "documentType": "SLIDES",
      "lastUpdated": "2025-09-10T12:34:56Z",
      "assignmentDefinition": {
        "primaryTitle": "Essay 1",
        "primaryTopic": "English",
        "yearGroup": 10,
        "alternateTitles": [],
        "alternateTopics": [],
        "documentType": "SLIDES",
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
- **Partial Assignment Definitions**: The embedded `assignmentDefinition` has `tasks: null` (explicit marker), omits `referenceDocumentId` and `templateDocumentId` to minimize payload size.
- **Root `documentType`**: Preserved at assignment root for polymorphic routing (allows `Assignment.fromJSON` to instantiate correct subclass).
- **Fail-Fast Design**: Code expecting tasks will throw immediately on `null` rather than silently operating on empty objects.
- **Assignment Definition Embedding**: The `assignmentDefinition` object is embedded directly. For partial assignments in ABClass, the definition has `tasks: null` and omits doc IDs. Full assignments contain complete definitions with all tasks and artifacts. The assignment root includes `documentType` for polymorphic routing.
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
```

## Partial Hydration (summary-level)

Used when we want a lightweight snapshot for list views or quick comparisons. The embedded `assignmentDefinition` has `tasks: null` and omits document IDs. Submission artifacts are redacted (no `content` payload).

**Before (old partial format - artifacts with null content):**

```json
{
  "assignmentDefinition": {
    "tasks": {
      "t_ab12": {
        "artifacts": {
          "reference": [{ "content": null, "contentHash": null }],
          "template": [{ "content": null, "contentHash": null }]
        }
      }
    }
  }
}
```

**After (new partial format - tasks: null):**

```json
{
  "courseId": "C123",
  "assignmentId": "A1",
  "assignmentName": "Essay 1",
  "documentType": "SLIDES",
  "assignmentMetadata": null,
  "dueDate": null,
  "lastUpdated": "2025-09-10T12:34:56Z",
  "assignmentDefinition": {
    "primaryTitle": "Essay 1",
    "primaryTopic": "English",
    "yearGroup": 10,
    "alternateTitles": [],
    "alternateTopics": [],
    "documentType": "SLIDES",
    "assignmentWeighting": null,
    "definitionKey": "Essay 1_English_10",
    "tasks": null,
    "createdAt": "2025-09-01T10:00:00Z",
    "updatedAt": "2025-09-01T10:00:00Z"
  },
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
            "general": {
              "type": "general",
              "createdAt": "2025-09-10T12:00:00Z",
              "text": "Good work overall. Consider revising the conclusion."
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

**Key Differences:**

- Assignment definition has `tasks: null` (not an object with redacted artifacts)
- Doc IDs (`referenceDocumentId`, `templateDocumentId`) omitted from partial definition
- Root `documentType` preserved for routing
- Submission artifacts still have `content: null` (unchanged from previous partial format)

````

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
  "assignmentMetadata": null,
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
            "general": {
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
````

Partial hydration uses the same assessment map but drops every `reasoning` field so list views still have the numeric scores without the verbose explanations.

**Score values**:

- `0–5`: Numeric score (0 = fail, 5 = excellent)
- `"N"`: Not attempted / not applicable (used for criteria that don't apply to a task type)

**Fields**:

- `score`: Number or string; the assessment grade.
- `reasoning`: String; the LLM's explanation of why this score was given.

## Feedback Structure

Feedback is stored as a map keyed by feedback type. Different feedback types track different concerns (e.g., cell reference feedback for Sheets tasks).

### Generic Feedback

For text-based or general comments:

```json

```

```
    "type": "general",
    "createdAt": "2025-09-10T12:00:00Z",
    "text": "Great effort on the introduction. Consider expanding the evidence section in the next draft."
  }
}
```

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

- `type`: String; identifies feedback class (`'general'`, `'cellReference'`, etc.)
- `createdAt`: ISO string timestamp of when feedback was generated
- `items` (cellReference only): Array of cell feedback objects, each with `location` and `status`

## Full Hydration Example with Assessments and Feedback

When assessments and feedback data exists, both partial and full hydration include the complete records:

```json
{
  "courseId": "C123",
  "assignmentId": "A1",
  "assignmentName": "Essay 1",
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
            "general": {
              "type": "general",
              "createdAt": "2025-09-10T12:00:00Z",
              "text": "Excellent introduction. Consider adding a counterargument in your next draft."
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
- **Assessments and feedback**: The `assessments` map keeps the same keys in both partial and full hydration so scores remain available, but partial documents omit each `reasoning` property to keep the summary lightweight. Feedback objects continue to be fully preserved in both payloads.

By constraining the document to the fields emitted today, we minimize Drive calls without introducing new schema variants or migration overhead.
