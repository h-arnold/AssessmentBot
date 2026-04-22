# Assignment Definition Upsert Specification

## Status

- Draft v1.0
- Created to define the backend contract for creating and updating reusable `AssignmentDefinition` records through `apiHandler`, including supporting topic reference data.

## Purpose

This document defines the intended behaviour for the backend assignment-definition upsert surface.

The feature will be used to:

- create reusable `AssignmentDefinition` records without requiring an `ABClass`, Google Classroom assignment, or assessment-wizard flow
- update existing `AssignmentDefinition` records, including metadata, document IDs, assignment weighting, and task weightings
- persist full parsed definitions immediately so later workflows can reuse them across classes without reparsing unless the source documents change

This feature is **not** intended to:

- deliver the assignments-page create/edit UI in this phase
- redesign the assessment wizard or couple assignment-definition creation to Classroom assignment lookup in this phase

## Agreed product decisions

1. The backend surface will expose one upsert-style mutation method rather than separate create and update methods.
2. Assignment-definition creation in this surface is independent from `Assignment` instances and `ABClass` records.
3. The upsert flow uses reusable metadata entered outside the assessment wizard rather than Classroom-derived title/topic data.
4. `primaryTopicKey` is required and must reference an existing authoritative assignment-topic record.
5. `definitionKey` becomes a stable opaque UUID-like identifier generated on create and preserved on update.
6. Updates do not rotate `definitionKey` when title, topic, or year-group metadata changes.
7. Duplicate business identities must still be rejected loudly: the backend should prevent two different definitions from sharing the same canonical uniqueness tuple.
8. Upsert persists immediately to the registry and full-definition store in the same request; this phase does not add a preview-only parse endpoint.
9. Upsert must support changes to metadata, reference/template document IDs, `assignmentWeighting`, and per-task `taskWeighting`.
10. The mutation response should return the full persisted `AssignmentDefinition` payload needed by later UI work, including parsed tasks and resolved topic information.
11. Changing document IDs should trigger reparsing; unchanged documents should continue to use the existing refresh rules based on Drive modification timestamps.
12. Assignment topics follow the same keyed reference-data pattern already used by cohorts and year groups, with frontend dropdown/modal consumption deferred to a later phase.
13. Because assignment topics are authoritative in this phase, topic deletion should be blocked when one or more definitions still reference the topic key.

## Existing system constraints

Documented below are the constraints that materially shape the design.

### Backend or API constraints already in place

- `src/backend/z_Api/z_apiHandler.js` is the sole frontend-callable backend transport entrypoint.
- Non-trivial transport methods must use trailing-underscore helpers in `src/backend/z_Api` and be allowlisted in `ALLOWLISTED_METHOD_HANDLERS`.
- Transport-boundary validation belongs in `z_Api`; domain invariants belong in controllers and models.
- `AssignmentDefinitionController` already owns dual-store persistence:
  - registry collection: `assignment_definitions`
  - full collection: `assdef_full_<definitionKey>`
- `AssignmentDefinitionController.ensureDefinition(...)` already parses and persists definitions when missing or stale.
- `SlidesParser.extractTaskDefinitions(...)` and `SheetsParser.extractTaskDefinitions(...)` already return ordered `TaskDefinition` instances suitable for persistence.
- `ReferenceDataController` already implements the canonical keyed CRUD pattern for cohorts and year groups.

### Current data-shape constraints

- `AssignmentDefinition` currently persists `primaryTopic` as a canonical string and derives `definitionKey` from business metadata.
- The current model therefore needs to evolve so `definitionKey` becomes an opaque stable identifier and topic authority moves to a keyed reference-data relationship.
- Partial registry rows intentionally store `tasks: null`.
- Full definitions persist `tasks` keyed by task ID.
- `TaskDefinition` already has a persisted `taskWeighting` field, but current active backend flows do not expose a dedicated transport for editing it.
- `AssignmentDefinition` already has a persisted `assignmentWeighting` field.
- Existing runtime consumers may still hold older `definitionKey` values in persisted assignments and queued trigger properties.

### Frontend or consumer architecture constraints

- The current assignments page has read/delete flows only; create/update UI is not implemented yet.
- Startup warm-up currently prefetches `classPartials`, `assignmentDefinitionPartials`, `cohorts`, and `yearGroups`.
- The future UI requirement is for `primaryTopicKey` to be selected from a preloaded reference-data dataset with a create-new modal rather than free-text entry.

## Domain and contract recommendations

### Why this approach is preferable

- It reuses the existing parser and persistence seams instead of creating a parallel assignment-definition creation path.
- It preserves assignment-definition independence from classes and Classroom assignments.
- It keeps the transport surface small while still returning the fully parsed persisted payload needed for later UI work.

### Recommended data shapes

#### Canonical uniqueness tuple

Recommendation: define duplicate identity using:

```ts
{
  primaryTitle: normalisedPrimaryTitle;
  primaryTopicKey: string;
  yearGroup: number | null;
}
```

Normalisation rules:

- `primaryTitle` is trimmed before comparison.
- `primaryTitle` duplicate checks are case-insensitive.
- `primaryTopicKey` compares by exact key equality.
- `yearGroup` compares by exact integer equality, with `null` treated as its own distinct value.
- `documentType`, `referenceDocumentId`, and `templateDocumentId` are intentionally excluded from the duplicate-identity rule.

#### Upsert request payload

Recommendation: use one payload shape with optional `definitionKey`.

- When `definitionKey` is absent or `null`, the request is treated as a create.
- When `definitionKey` is present, the request is treated as an update of that existing definition.

```ts
{
  definitionKey?: string | null;
  primaryTitle: string;
  primaryTopicKey: string;
  yearGroup: number | null;
  alternateTitles?: string[];
  referenceDocumentId: string;
  templateDocumentId: string;
  assignmentWeighting: number | null;
  taskWeightings?: Array<{
    taskId: string;
    taskWeighting: number | null;
  }>;
}
```

Notes:

- `primaryTopicKey` is authoritative in the upsert contract for this phase.
- The later UI should source that key from the assignment-topics reference-data dataset rather than free text.
- `taskWeightings` is optional because first-time create flows may not yet know task IDs before the initial parse.
- `alternateTopics` is deliberately not part of the new upsert contract in this phase.

#### Upsert response payload

Recommendation: return the full persisted `AssignmentDefinition` JSON payload directly as the `data` field inside the standard `apiHandler` envelope.

```ts
{
  primaryTitle: string;
  primaryTopicKey: string;
  primaryTopic: string;
  yearGroup: number | null;
  alternateTitles: string[];
  documentType: 'SLIDES' | 'SHEETS';
  referenceDocumentId: string;
  templateDocumentId: string;
  referenceLastModified: string | null;
  templateLastModified: string | null;
  assignmentWeighting: number | null;
  definitionKey: string;
  tasks: Record<string, {
    id: string;
    taskTitle: string;
    pageId: string | null;
    taskNotes: string | null;
    taskMetadata: Record<string, unknown>;
    taskWeighting: number | null;
    index: number | null;
    artifacts: {
      reference: unknown[];
      template: unknown[];
    };
  }>;
  createdAt: string | null;
  updatedAt: string | null;
}
```

#### Assignment-topic reference-data payloads

Recommendation: mirror the year-group keyed CRUD pattern.

```ts
type AssignmentTopicRecord = {
  key: string;
  name: string;
};
```

Transport additions:

- `getAssignmentTopics(): AssignmentTopicRecord[]`
- `createAssignmentTopic({ record: { name } }): AssignmentTopicRecord`
- `updateAssignmentTopic({ key, record: { name } }): AssignmentTopicRecord`
- `deleteAssignmentTopic({ key }): void`

Semantics for this phase:

- The topic dataset is authoritative for `AssignmentDefinition` topic selection in this backend phase.
- Upsert rejects unknown `primaryTopicKey` values.
- `AssignmentDefinition` should persist the topic key as the source of truth and expose a resolved topic label for transport and display.
- Topic renames should not require rewriting definition foreign keys; display labels should resolve through the topic dataset.
- Topic deletion should be blocked when one or more definitions still reference the topic key.

### Naming recommendation

Prefer:

- `upsertAssignmentDefinition`
- `assignment_topics`
- `primaryTopicKey`
- `taskWeightings`

Avoid:

- `createDefinitionFromWizardInputs`
- `AssignmentDefintions` in new code or docs
- continuing to treat `primaryTopic` as the authoritative persisted field once the topic dataset becomes keyed and authoritative

Explain any naming rule that prevents future ambiguity:

- Wizard-specific names should not own this reusable backend surface because the feature is intentionally independent from the assessment wizard.

### Validation recommendation

#### Frontend

- Future UI should submit a selected `primaryTopicKey` from the assignment-topics dataset rather than free text.
- Future create/edit UI should not offer task-weight editing before the backend has returned parsed task IDs for the target definition.

#### Backend

- Transport validation should ensure the request payload is a plain object with the expected fields and safe `definitionKey` handling for update calls.
- Domain validation should reject blank `primaryTitle`, unknown `primaryTopicKey`, invalid `yearGroup`, identical reference/template documents, mismatched document types, unknown update targets, duplicate business-identity tuples, and invalid task-weighting references.
- Upsert should reject `taskWeightings` entries whose `taskId` does not exist in the parsed or persisted task set for the target definition.

### Display-resolution recommendation

- `AssignmentDefinition` should persist the authoritative topic key and expose a resolved topic label for transport.
- Display should resolve topic labels through the assignment-topics dataset or an equivalent controller join rather than treating copied strings as the source of truth.

### Persistence and failure policy recommendation

- Because the backend uses separate registry and full-definition writes with no transactional store support, the implementation should target best-effort atomicity with explicit rollback attempts and loud failure on incomplete cleanup.
- A mutation must not return success unless all required writes for the target state have succeeded.
- If a later write step fails after an earlier write step has succeeded, the controller must attempt to restore the previous authoritative state or remove newly written records before throwing.
- If rollback or cleanup also fails, the controller must throw, preserve execution-log diagnostics, and treat the result as a repair-required failure rather than claiming the mutation succeeded.
- The implementation plan must include failure-path tests for registry-write failure, full-store-write failure, and post-write cleanup failure.
- New definitions should receive a generated stable opaque `definitionKey` at create time.
- Updates should preserve the stored `definitionKey` regardless of metadata changes.

## Feature architecture

### Placement

- Canonical backend transport ownership: `src/backend/z_Api`
- Canonical domain ownership: `src/backend/y_controllers/AssignmentDefinitionController.js`
- Canonical parser ownership: `src/backend/DocumentParsers/SlidesParser.js` and `src/backend/DocumentParsers/SheetsParser.js`
- Canonical reference-data ownership for assignment topics: `ReferenceDataController` or a tightly aligned keyed-reference-data abstraction in the backend

### Out of scope for this surface

- Assignments-page modal, dropdown, or form delivery
- Startup warm-up frontend implementation for assignment topics
- Assessment-wizard integration
- Broad cleanup of `alternateTopics` modelling is deferred.

## Data loading and orchestration

### Required datasets or dependencies

- `AssignmentDefinitionController`
- `AssignmentDefinition`
- `TaskDefinition`
- `SlidesParser`
- `SheetsParser`
- `DriveManager`
- assignment-topics reference-data store

### Query or transport additions

- `upsertAssignmentDefinition`
- assignment-topic reference-data CRUD methods matching the existing reference-data transport style

## Workflow specification

## Create assignment definition

### Eligible inputs or preconditions

- `primaryTitle` is present.
- `primaryTopicKey` is present.
- `referenceDocumentId` and `templateDocumentId` are present and resolve to different Google Drive files.
- Both source documents resolve to the same supported document type.

### Behaviour

- The backend normalises the document identifiers.
- The backend detects document type from the source files.
- The backend parses tasks from the reference/template pair.
- The backend applies any supplied assignment weighting and task-weighting patches that match parsed task IDs.
- The backend generates a stable opaque `definitionKey`.
- The backend rejects the mutation if another definition already exists with the same canonical uniqueness tuple.
- On success, the backend persists both the full definition and the partial registry entry, then returns the full persisted definition payload.

Recommended write sequence:

1. Validate the final target key before any write.
2. Write the target full-definition record.
3. Write the target registry/partial record.
4. Return success only after both writes complete.
5. If step 3 fails, attempt to remove or restore the target full-definition write before throwing.
6. If step 2 fails, throw immediately without attempting registry writes.

## Update assignment definition

### Eligible inputs or preconditions

- `definitionKey` is present and identifies an existing definition.
- The updated payload satisfies the same validation rules as create.

### Behaviour

- The backend loads the existing definition by the supplied `definitionKey`.
- The backend preserves the existing stored `definitionKey`.
- The backend validates that the updated metadata does not collide with another definition’s canonical uniqueness tuple.
- If document IDs change, the backend reparses tasks from the new documents.
- If document IDs do not change, the backend should continue to honour the current refresh rules based on stored and Drive modification timestamps.
- The backend reapplies persisted or supplied task-weighting values to the final task set.

Recommended write sequence for same-key updates:

1. Snapshot the current full and partial persisted records in memory.
2. Write the updated full-definition record for the same key.
3. Write the updated partial registry row for the same key.
4. If step 3 fails, attempt to restore the previous full record before throwing.
5. If rollback also fails, throw and surface the outcome as a repair-required failure.

## Apply task and assignment weightings

### Eligible inputs or preconditions

- `assignmentWeighting` may be `null` or a valid numeric weighting.
- `taskWeightings` entries must reference valid task IDs in the target parsed/persisted definition.

### Behaviour

- Assignment weighting is persisted on the `AssignmentDefinition`.
- Task weighting is persisted on each addressed `TaskDefinition`.
- Omitted task-weighting entries leave untouched task weights unchanged on update.
- First-create flows may legitimately omit task weights until the parsed task IDs are known.
- On update, omitted `alternateTitles` preserve the stored array; when supplied, the array replaces the stored value.

## Manage assignment topics

### Eligible inputs or preconditions

- Topic names are non-empty, trimmed strings.

### Behaviour

- Topic CRUD follows the same duplicate-name and keyed-record rules used by cohorts and year groups.
- Topic list responses should expose transport-safe `{ key, name }` records only.
- Topic records are authoritative for `AssignmentDefinition.primaryTopicKey`.
- Topic delete should be blocked when one or more definitions still reference the topic key.
- The backend phase should make the dataset available for later startup-prefetch integration, but that frontend prefetch work is deferred.

## Open questions and assumptions

1. Assumption: first-time create flows may not provide per-task weightings until after the initial parse has produced task IDs; the backend should therefore accept creates with no `taskWeightings`.
2. Deliberate deferral: whether a later UX should add a preview/parse-only step before final save is out of scope for this backend phase.
