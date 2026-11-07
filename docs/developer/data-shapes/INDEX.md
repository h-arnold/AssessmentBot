# Data Shapes — Index

This folder contains the authoritative data-shape specifications for every
contract that crosses a persistence, transport, or validation boundary in
AssessmentBot. Each contract file is the single source of truth for what
that shape _should_ be — code must conform to the spec, not the other way
around.

**Workflow:** When changing code that affects a data shape (persistence
serialisation, API transport, or frontend validation), update the relevant
contract file in this folder _before_ or _concurrently with_ the code
change. If a discrepancy is found between code and spec, fix whichever is
wrong. The spec is not documentation of legacy drift — it is the canonical
reference.

## Contract Registry

| Contract                            | File                                                                       | Persistence                                                        | API Endpoints                                                                                                                                                                                                                            | Sub-entities                                                                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **ABClass**                         | [`abclass.md`](abclass.md)                                                 | Main doc + `abclass_partials` registry                             | `getABClassPartials`, `getABClass`, `upsertABClass`, `updateABClass`, `deleteABClass`                                                                                                                                                    | Teacher, Student, ABClassMetadata (embedded, nullable snapshot), AssignmentPartial (embedded transport)                       |
| **AssignmentDefinition**            | [`assignment-definition.md`](assignment-definition.md)                     | `assignment_definitions` registry + `assdef_full_*` full cache     | `getAssignmentDefinitionPartials`, `getAssignmentDefinition`, `upsertAssignmentDefinition`, `deleteAssignmentDefinition`                                                                                                                 | TaskDefinition, BaseTaskArtifact                                                                                              |
| **Assignment**                      | [`assignment.md`](assignment.md)                                           | `assign_full_*` full records                                       | `getAssignment`, `startAssessmentRun`                                                                                                                                                                                                    | StudentSubmission, StudentSubmissionItem, Assessment, Feedback, AssignmentDefinition (embedded), BaseTaskArtifact (cross-ref) |
| **BackendConfig**                   | [`backend-config.md`](backend-config.md)                                   | Singleton document                                                 | `getBackendConfig`, `setBackendConfig`                                                                                                                                                                                                   | —                                                                                                                             |
| **Reference Data**                  | [`reference-data.md`](reference-data.md)                                   | Cohorts, YearGroups, AssignmentTopics collections                  | `getCohorts`, `createCohort`, `updateCohort`, `deleteCohort`, `getYearGroups`, `createYearGroup`, `updateYearGroup`, `deleteYearGroup`, `getAssignmentTopics`, `createAssignmentTopic`, `updateAssignmentTopic`, `deleteAssignmentTopic` | —                                                                                                                             |
| **RequestStore**                    | [`request-store.md`](request-store.md)                                     | User Properties (JSON blob)                                        | None — internal backend mechanism                                                                                                                                                                                                        | —                                                                                                                             |
| **GoogleClassrooms**                | [`google-classrooms.md`](google-classrooms.md)                             | None (upstream API passthrough)                                    | `getGoogleClassrooms`, `getGoogleClassroomAssignments`                                                                                                                                                                                   | —                                                                                                                             |
| **AuthCache**                       | [`auth-cache.md`](auth-cache.md)                                           | CacheService (script cache, 6h TTL)                                | None — internal to `AuthService.checkAccess()`                                                                                                                                                                                           | —                                                                                                                             |
| **TriggerContext**                  | [`trigger-context.md`](trigger-context.md)                                 | Script Properties (`trigger:<uid>:method`, `trigger:<uid>:params`) | None — internal trigger context storage                                                                                                                                                                                                  | —                                                                                                                             |
| **AuthUsers**                       | [`auth-users.md`](auth-users.md)                                           | Auth fields inside the `__CONFIG_STORE_KEY__` blob                 | `getApplicationAccess`, `getAuthenticationSettings`, `setAuthenticationSettings`                                                                                                                                                         | AuthUserEntry (embedded)                                                                                                      |
| **Frontend Data Analysis Response** | [`frontend-data-analysis-response.md`](frontend-data-analysis-response.md) | None — derived frontend validation contract                        | None — in-memory `DataAnalysisService` output                                                                                                                                                                                            | AverageContribution, MetricResult, ClassPageDisplayMetric (adapter-local), CellPreviewData, TaskPreviewData                   |

Status: all eleven contracts are implemented and conform to their documented contracts.
`frontend-data-analysis-response.md` carries an outstanding planned change (the attempt-baseline
analysis mode). Legacy `submissions` preservation on restoration and ordinary save is implemented
(see [assignment.md § Legacy `submissions` preservation](assignment.md#legacy-submissions-preservation)).
The read marker union is `1 | 'legacy'` on both read paths, and legacy reads are prepared by
`AssignmentRehydration.prepareLegacyReadSubmissions()` (see
[assessment.md § Legacy read preparation](assessment.md#legacy-read-preparation)); the former
`1 | null` read marker and the all-results reassessment projection are retired.

## Component Shapes

Three shapes are embedded by more than one contract and are large enough to warrant
their own files. They have no independent persistence collection, no standalone
endpoint and no root frontend schema; they are documented once here and cross-referenced
from every contract that embeds them.

| Component shape        | File                                             | Documented as                            | Embedded by                                                                                                   |
| ---------------------- | ------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **BaseTaskArtifact**   | [`base-task-artifact.md`](base-task-artifact.md) | Artifact payload                         | `AssignmentDefinition` (`TaskDefinition.artifacts` — origin), `Assignment` (`StudentSubmissionItem.artifact`) |
| **Student Submission** | [`student-submission.md`](student-submission.md) | Submission + item                        | `Assignment` (`submissions[]`), `ABClass` (partial submissions inside class-embedded assignment partials)     |
| **Assessment**         | [`assessment.md`](assessment.md)                 | Criterion result + assessment discipline | `Assignment` (`StudentSubmissionItem.assessments`), `ABClass` (partial assessment entries)                    |

Containment links:

- `AssignmentDefinition` → `TaskDefinition` → **BaseTaskArtifact**
- `Assignment` → **Student Submission** → **StudentSubmissionItem** → **BaseTaskArtifact**
- `Assignment` → **Student Submission** → **StudentSubmissionItem** → **Assessment**
- `Assignment` → **Assessment** (write gate, marker, legacy read preparation, marker-1 restoration)
- `ABClass` → `Assignment` partial → **Student Submission** (partial) → **Assessment** (partial)

## Containment Hierarchy

- **ABClass** embeds **Teacher**, **Student**, **Assignment** partials, and the nullable **ABClassMetadata** assessment-summary snapshot.
- **Assignment** embeds **StudentSubmission**, **StudentSubmissionItem** (which embeds **BaseTaskArtifact**), **Assessment**, **Feedback**, and a full/partial **AssignmentDefinition**. The submission, item, assessment and artifact shapes are documented in the component-shape files above.
- **AssignmentDefinition** embeds **TaskDefinition** (which embeds **BaseTaskArtifact**).
- **BackendConfig** is standalone — no embedded sub-entities.
- **Reference Data** (Cohorts, YearGroups, AssignmentTopics) is standalone — no embedded sub-entities.
- **RequestStore** is standalone — internal backend mechanism, no embedded sub-entities.
- **GoogleClassrooms** is an upstream API passthrough — no persistence, no embedded sub-entities.
- **AuthCache** is standalone — in-memory `CacheService` entry with a 6-hour TTL, no durable
  persistence, no embedded sub-entities.
- **TriggerContext** is standalone — internal Script Properties trigger-context store keyed
  by triggerUid, no embedded sub-entities.
- **AuthUsers** is standalone — auth fields embedded in the shared `__CONFIG_STORE_KEY__`
  blob with `AuthUserEntry` as an embedded sub-entity of the `authUsers` JSON array.
- **Frontend Data Analysis Response** is derived in memory from ABClass data and live
  AssignmentDefinition partials; it has no persistence or transport boundary.

### Cross-reference rules

- **BaseTaskArtifact** is shared between `AssignmentDefinition` (origin) and `Assignment` (consumer). Documented once in `base-task-artifact.md`, cross-referenced from `assignment-definition.md`, `assignment.md` and `student-submission.md`.
- **Student Submission** and **Assessment** are embedded by `Assignment` and transported inside class-embedded assignment partials. Documented in `student-submission.md` and `assessment.md`, cross-referenced from `assignment.md` and `abclass.md`.
- **AssignmentDefinition** is embedded inside `Assignment` as a full or partial definition. Documented in `assignment-definition.md`; referenced from `assignment.md`.
- **ABClassMetadata** is owned by `ABClass` and documented inline in `abclass.md` under Sub-entities; the frontend metadata writer/projection contracts live in `frontend-data-analysis-response.md`.

## Documented Contracts

All eleven contracts and three component shapes are documented in this directory. The legacy
`docs/developer/backend/DATA_SHAPES.md` has been deleted; all content has been migrated to the
individual contract and component-shape files listed above.

## Transport Envelope

All API endpoints share the same transport envelope. See
[`transport-envelope.md`](transport-envelope.md) for the shared
`apiHandler` success/error shape. Contract files document the `data`
payload inside that envelope — they do not duplicate the envelope
structure.

## Agent Instructions

The process for creating and maintaining these specs is defined in
[`.opencode/agents/data-shapes-agent.md`](../../../.opencode/agents/data-shapes-agent.md).
