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

| Contract                 | File                                                   | Persistence                                                        | API Endpoints                                                                                                                                                                                                                            | Sub-entities                                                                                                                  |
| ------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **ABClass**              | [`abclass.md`](abclass.md)                             | Main doc + `abclass_partials` registry                             | `getABClassPartials`, `getABClass`, `upsertABClass`, `updateABClass`, `deleteABClass`                                                                                                                                                    | Teacher, Student                                                                                                              |
| **AssignmentDefinition** | [`assignment-definition.md`](assignment-definition.md) | `assignment_definitions` registry + `assdef_full_*` full cache     | `getAssignmentDefinitionPartials`, `getAssignmentDefinition`, `upsertAssignmentDefinition`, `deleteAssignmentDefinition`                                                                                                                 | TaskDefinition, BaseTaskArtifact                                                                                              |
| **Assignment**           | [`assignment.md`](assignment.md)                       | `assign_full_*` full records                                       | `getAssignment`, `startAssessmentRun`                                                                                                                                                                                                    | StudentSubmission, StudentSubmissionItem, Assessment, Feedback, AssignmentDefinition (embedded), BaseTaskArtifact (cross-ref) |
| **BackendConfig**        | [`backend-config.md`](backend-config.md)               | Singleton document                                                 | `getBackendConfig`, `setBackendConfig`                                                                                                                                                                                                   | —                                                                                                                             |
| **Reference Data**       | [`reference-data.md`](reference-data.md)               | Cohorts, YearGroups, AssignmentTopics collections                  | `getCohorts`, `createCohort`, `updateCohort`, `deleteCohort`, `getYearGroups`, `createYearGroup`, `updateYearGroup`, `deleteYearGroup`, `getAssignmentTopics`, `createAssignmentTopic`, `updateAssignmentTopic`, `deleteAssignmentTopic` | —                                                                                                                             |
| **RequestStore**         | [`request-store.md`](request-store.md)                 | User Properties (JSON blob)                                        | None — internal backend mechanism                                                                                                                                                                                                        | —                                                                                                                             |
| **GoogleClassrooms**     | [`google-classrooms.md`](google-classrooms.md)         | None (upstream API passthrough)                                    | `getGoogleClassrooms`, `getGoogleClassroomAssignments`                                                                                                                                                                                   | —                                                                                                                             |
| **AuthCache**            | [`auth-cache.md`](auth-cache.md)                       | CacheService (script cache, 6h TTL)                                | None — internal to `AuthService.checkAccess()`                                                                                                                                                                                           | —                                                                                                                             |
| **TriggerContext**       | [`trigger-context.md`](trigger-context.md)             | Script Properties (`trigger:<uid>:method`, `trigger:<uid>:params`) | None — internal trigger context storage                                                                                                                                                                                                  | —                                                                                                                             |

> **Status: Not implemented** — the `AuthCache` and `TriggerContext` rows above are
> planned-only entries for the Auth Service feature (ACTION_PLAN §1). Remove this marker
> once each contract file's own `Not implemented` marker is removed by its implementation
> section.

## Containment Hierarchy

- **ABClass** embeds **Teacher**, **Student**, and **Assignment** partials.
- **Assignment** embeds **StudentSubmission**, **StudentSubmissionItem** (which embeds **BaseTaskArtifact**), **Assessment**, **Feedback**, and a full/partial **AssignmentDefinition**.
- **AssignmentDefinition** embeds **TaskDefinition** (which embeds **BaseTaskArtifact**).
- **BackendConfig** is standalone — no embedded sub-entities.
- **Reference Data** (Cohorts, YearGroups, AssignmentTopics) is standalone — no embedded sub-entities.
- **RequestStore** is standalone — internal backend mechanism, no embedded sub-entities.
- **GoogleClassrooms** is an upstream API passthrough — no persistence, no embedded sub-entities.
- **AuthCache** is standalone — in-memory `CacheService` entry with a 6-hour TTL, no durable
  persistence, no embedded sub-entities.
- **TriggerContext** is standalone — internal Script Properties trigger-context store keyed
  by triggerUid, no embedded sub-entities.

### Cross-reference rules

- **BaseTaskArtifact** is shared between `AssignmentDefinition` (origin) and `Assignment` (consumer). Documented once in `assignment-definition.md`, cross-referenced from `assignment.md`.
- **AssignmentDefinition** is embedded inside `Assignment` as a full or partial definition. Documented in `assignment-definition.md`; referenced from `assignment.md`.

## Documented Contracts

All nine contracts are now fully documented in this directory. The legacy
`docs/developer/backend/DATA_SHAPES.md` has been deleted; all content has been
migrated to the individual contract files listed below.

## Transport Envelope

All API endpoints share the same transport envelope. See
[`transport-envelope.md`](transport-envelope.md) for the shared
`apiHandler` success/error shape. Contract files document the `data`
payload inside that envelope — they do not duplicate the envelope
structure.

## Agent Instructions

The process for creating and maintaining these specs is defined in
[`.opencode/agents/data-shapes-agent.md`](../../.opencode/agents/data-shapes-agent.md).
