# Assignment Definition Wizard Specification

## Status

- Draft v1.2
- Updated to consolidate write behaviour into `upsertAssignmentDefinition` and promote `assignmentTopics` into startup warm-up.

## Purpose

This document defines the intended behaviour for the active assignment definition create/update wizard.

The feature will be used to:

- create assignment definitions from user-supplied reference and template document URLs
- update existing assignment definitions, including metadata, document URLs, assignment weighting, and task weightings
- expose task parsing results early enough that users can review and edit task-level weightings before the final save

This feature is **not** intended to:

- implement the separate assessment-launch wizard flow
- settle or implement the downstream weighted assessment calculation algorithm beyond storing valid weight values

## Agreed product decisions

1. The wizard lives on the active Assignments page. Create remains a top-level page action, and update moves to a row-level action in the assignment definitions table instead of using the current disabled global update button.
2. Creating an assignment definition is a two-stage flow. Stage 1 validates and parses the supplied reference and template documents; stage 2 allows the user to review metadata and edit assignment/task weightings.
3. Because parsed `TaskDefinition` records are required before task weightings can be edited, creation persists twice: once after successful parse, and once after the final weighting save.
4. Updating an existing assignment definition starts in the main edit panel rather than the initial create-only document step.
5. `primaryTitle`, `primaryTopic`, and `yearGroup` are user-editable in the wizard.
6. `primaryTopic` and `yearGroup` are dropdown-only fields backed by the existing reference-data collections, not free-text inputs.
7. The wizard contract should allow future callers to pre-populate `primaryTitle`, `primaryTopic`, and `yearGroup`, but that pre-population caller flow is out of scope for this phase.
8. `assignmentWeighting` and each `taskWeighting` are required in the UI, default to `1`, and accept numeric values in the range `0` to `10` inclusive.
9. Weight values are stored directly; any future scoring algorithm should normalise them at calculation time rather than forcing the UI to maintain a fixed-sum rule.
10. Assignment definitions should store the selected year-group reference-data key rather than the current numeric `yearGroup` value.
11. This feature is planned against a greenfield data set. No previously persisted assignment-definition records need compatibility handling or in-place migration as part of this work.
12. When document URLs are edited in the update panel, other editable fields become temporarily unavailable until the user resolves that document change.
13. Document changes in the update panel require an explicit re-parse action. The UI must surface a focused prompt such as `Reference document changed. Do you want to re-parse?` or `Template document changed. Do you want to re-parse?`.
14. If the user cancels that re-parse prompt, the edited document URL fields revert to their previously persisted values.
15. Stage-one create persistence is a legitimate saved definition. If the user cancels after stage one, the parsed definition remains stored with defaulted weighting values and should remain visible in the Assignments table.
16. `upsertAssignmentDefinition` is the single write transport for stage-one create, final save, and document-change re-parse. The write-path behaviour varies by payload and persisted state, not by endpoint name.
17. `documentType` is derived server-side inside `upsertAssignmentDefinition` from the supplied reference/template document URLs; it is not a user-editable field.
18. `definitionKey` is a stable opaque identifier for the active wizard flow. Editing title, topic, or year group must not recompute or rename the definition key.
19. Unsaved document edits and unsaved metadata/weighting edits are mutually exclusive local states. The UI must never silently drop unsaved local edits during re-parse resolution.
20. After stage-one create succeeds, the wizard transitions to the same main edit surface used by update mode, including editable document URL fields. Any later document changes in that same session use the same explicit re-parse-or-cancel flow as update mode.
21. Both `upsertAssignmentDefinition` and `getAssignmentDefinition` must return one canonical editable full-definition response shape so the frontend does not maintain separate DTO families for create, update, save, and re-parse.
22. Duplicate business-tuple detection applies at every `upsertAssignmentDefinition` call that creates a definition or changes `(normalised primaryTitle, primaryTopicKey, yearGroupKey)`. Stage-one create must therefore reject duplicates before persisting.
23. If metadata or weighting edits are dirty, document URL fields become unavailable until the user either saves those edits or closes the modal and confirms discard. There is no separate in-modal discard/reset action in this phase.
24. Reference and template documents must resolve to the same supported document type. Mixed supported types are invalid and must fail create and re-parse validation.
25. `assignmentTopics` is part of the shared startup warm-up contract because the same reference-data set is expected to support additional modal workflows beyond this wizard.

## Existing system constraints

Document the constraints that materially shape the design.

### Backend or API constraints already in place

- Active frontend-to-backend transport must go through `callApi(...)` on the frontend and `apiHandler` in `src/backend/z_Api/z_apiHandler.js` on the backend.
- The active backend already exposes `upsertAssignmentDefinition` through `apiHandler` and validates transport input in `src/backend/z_Api/assignmentDefinitionPartials.js`.
- The current `AssignmentDefinitionController.upsertDefinition(...)` path parses task definitions and persists immediately; the wizard should reuse that single write-path rather than creating parallel write endpoints.
- The controller currently supports reusing existing task weightings across re-parse operations when task IDs still match.
- Reference data for assignment topics and year groups already exists in the active system and should be reused rather than duplicated.
- The active backend already exposes assignment-topic reference data; the remaining work is frontend service/query consumption plus startup warm-up integration.

### Current data-shape constraints

- Assignment definitions are persisted twice: a partial registry record in `assignment_definitions` and a full record in `assdef_full_<definitionKey>`.
- Partial assignment-definition transport currently exposes `tasks: null`; task editing therefore requires full-definition data.
- Current frontend and backend contracts still need to be standardised on `yearGroupKey` and `yearGroupLabel`; that contract change must be reflected consistently in transport, persistence, duplicate detection, and consumer code.
- Persisted full and partial assignment-definition records should store authoritative `yearGroupKey` values, with `yearGroupLabel` resolved for read contracts.
- The current backend upsert contract requires `primaryTitle`, `primaryTopicKey`, `referenceDocumentId`, and `templateDocumentId`, with optional `definitionKey`, `assignmentWeighting`, and `taskWeightings`; this feature evolves that write contract so the modal can submit URLs through the same `upsertAssignmentDefinition` entry point.
- Persisted assignment definitions store document IDs, not canonical URLs, so any URL-based edit UI must reconstruct canonical Google URLs from stored IDs before presenting them.
- Existing docs still describe older tuple-derived key semantics in places, but the active create/update wizard should standardise on stable opaque definition keys.
- The `assignmentDefinitionPartials` backend transport, frontend Zod schema, and Assignments table contract must migrate together as part of this feature; the modal work is not isolated from that list surface.

### Frontend or consumer architecture constraints

- The Assignments page already owns assignment-definition listing, filtering, delete workflow, and refresh behaviour in the active frontend.
- Active frontend code uses React Query shared query definitions and query-key factories for trusted datasets.
- Frontend services must remain thin wrappers around `callApi(...)` with request/response validation in adjacent Zod schema files.
- The surface is modal-driven and should follow the established Ant Design modal patterns rather than introducing a separate page or route.

## Domain and contract recommendations

Use this section for recommendations that should guide implementation unless later superseded by an explicit decision.

### Why this approach is preferable

- It keeps assignment-definition management inside the existing Assignments surface instead of fragmenting the workflow across new routes.
- It respects the existing GAS parsing and persistence model rather than forcing a fake preview path that the current backend does not support well.
- It allows a future assessment wizard to reuse the same modal contract with pre-populated metadata inputs.

### Recommended data shapes

#### Assignment definition wizard draft state

```ts
{
  mode: 'create' | 'update';
  definitionKey: string | null;
  primaryTitle: string;
  primaryTopicKey: string | null;
  yearGroupKey: string | null;
  referenceDocumentUrl: string;
  templateDocumentUrl: string;
  referenceDocumentId: string | null;
  templateDocumentId: string | null;
  documentType: 'SLIDES' | 'SHEETS' | null;
  assignmentWeighting: number;
  taskWeightings: Array<{
    taskId: string;
    taskTitle: string;
    taskWeighting: number;
  }>;
  parseState:
    | { status: 'idle' }
    | { status: 'parsing' }
    | { status: 'parsed'; source: 'initial-create' | 'manual-reparse' }
    | { status: 'error'; message: string };
  pendingDocumentChange:
    | null
    | {
        changedFields: Array<'referenceDocumentUrl' | 'templateDocumentUrl'>;
        previousReferenceDocumentUrl: string;
        previousTemplateDocumentUrl: string;
      };
}
```

#### Assignment definition partial row recommendation

```ts
{
  definitionKey: string;
  primaryTitle: string;
  primaryTopicKey: string;
  primaryTopic: string;
  yearGroupKey: string;
  yearGroupLabel: string;
  alternateTitles: string[];
  alternateTopics: string[];
  documentType: 'SLIDES' | 'SHEETS';
  referenceDocumentId: string;
  templateDocumentId: string;
  assignmentWeighting: number;
  tasks: null;
  createdAt: string | null;
  updatedAt: string | null;
}
```

#### Full assignment definition recommendation

```ts
{
  definitionKey: string;
  primaryTitle: string;
  primaryTopicKey: string;
  primaryTopic: string;
  yearGroupKey: string;
  yearGroupLabel: string;
  alternateTitles: string[];
  alternateTopics: string[];
  documentType: 'SLIDES' | 'SHEETS';
  referenceDocumentId: string;
  templateDocumentId: string;
  assignmentWeighting: number;
  tasks: Array<{
    taskId: string;
    taskTitle: string;
    taskWeighting: number;
  }>;
  createdAt: string | null;
  updatedAt: string | null;
}
```

#### Upsert request payload recommendation

```ts
{
  definitionKey?: string;
  primaryTitle: string;
  primaryTopicKey: string;
  yearGroupKey: string;
  referenceDocumentUrl: string;
  templateDocumentUrl: string;
  assignmentWeighting?: number;
  taskWeightings?: Array<{
    taskId: string;
    taskWeighting: number;
  }>;
}
```

#### Upsert response recommendation

- Response shape: exactly the canonical full assignment definition entity defined in `Full assignment definition recommendation` above.
- The same response shape is returned for stage-one create, final save, and document-change re-parse so the frontend can keep one editable entity model.

#### Full-definition read request recommendation

```ts
{
  definitionKey: string;
}
```

#### Full-definition read response recommendation

- Response shape: exactly the canonical full assignment definition entity defined in `Full assignment definition recommendation` above.
- This is a direct transport payload, not a wrapper envelope beyond the standard `callApi` success envelope.

### Naming recommendation

Prefer:

- `primaryTopicKey`
- `yearGroupKey`
- `yearGroupLabel` for resolved display text
- `referenceDocumentUrl` and `templateDocumentUrl` in UI state, with backend persistence using extracted document IDs derived inside `upsertAssignmentDefinition`
- `taskWeightings` for write payloads and `taskWeighting` per task row

Avoid:

- free-text `primaryTopic` inputs in the active frontend
- continuing the numeric `yearGroup` field name once the contract moves to a reference-data UID
- mixing raw pasted URLs and extracted document IDs under the same field name

Explain any naming rule that prevents future ambiguity.

### Validation recommendation

#### Frontend

- Topic and year group must be selected from loaded reference-data options before the user can advance or save.
- The reference and template inputs must accept pasted Google document URLs, extract the underlying document IDs, and reject invalid or unsupported URLs.
- The reference and template documents must resolve to different document IDs.
- The reference and template documents must resolve to the same supported document type.
- Weighting inputs must default to `1` and reject values outside `0` to `10` inclusive.
- When document URLs are changed on the update panel, all other editable controls should be disabled until the user either re-parses or cancels the change.
- Update mode should reconstruct canonical editable Google URLs from stored document IDs rather than exposing raw IDs directly.
- New creates and all successful saves require a selected non-null `yearGroupKey`.
- If the user has unsaved metadata or weighting edits, document URL fields should be unavailable until those edits are saved or discarded by closing the modal and confirming discard.
- If the user edits a document URL first, metadata and weighting fields should become unavailable until re-parse or cancel resolves that document change.

#### Backend

- API-layer transport validation should continue to validate the incoming shape and identifier safety.
- Controller-level validation remains authoritative for duplicate business-tuple detection, topic existence, same-document rejection, supported-type pairing, parsing, and task-weighting application.
- New or updated backend contracts must validate `yearGroupKey` against existing year-group reference data rather than trusting a client-provided display label.
- Backend validation must enforce the same `0` to `10` inclusive weighting range used by the wizard for both assignment and task weightings.
- `upsertAssignmentDefinition` must derive `documentType` on the backend from the supplied documents before persisting any parsed result.
- `upsertAssignmentDefinition` must reject reference/template pairs that resolve to different supported document types.
- Duplicate detection should use `(normalised primaryTitle, primaryTopicKey, yearGroupKey)` for all create or tuple-changing saves.
- Stage-one create must reject duplicates before persisting because the persisted result is immediately visible and legitimate in the Assignments table.

### Display-resolution recommendation

- The Assignments page list should continue to show human-readable topic and year-group labels, even if persisted records store topic and year-group reference keys.
- The modal should resolve dropdown labels from the cached reference-data datasets rather than embedding ad hoc copies of those labels in local state.
- Update mode should render persisted task titles from the parsed task set and keep those titles aligned with any successful re-parse result.
- Reads and writes should use `yearGroupKey` and `yearGroupLabel` directly as the active contract for this feature.

## Feature architecture

Describe where this feature lives and which composition boundaries must be preserved.

### Placement

- The canonical entry surface is the active Assignments page in the frontend.
- Create opens from the Assignments page top-level action area.
- Update opens only from a row-level action in the assignment definitions table.
- The current disabled top-level update button is removed rather than re-enabled.
- No new page, route, or deprecated AdminSheet UI entry point should be introduced for this feature.

### Proposed high-level tree

```text
AssignmentsPage
└── AssignmentDefinitionWizardModal
    ├── Create parse stage or update edit stage
    ├── Metadata and document section
    ├── Weighting section
    └── Re-parse prompt region
```

### Out of scope for this surface

- launching assessments from this modal
- implementing the future caller that pre-populates metadata from Google Classroom
- introducing task-level editing beyond weight values in this phase
- defining the downstream weighted scoring algorithm

## Data loading and orchestration

### Required datasets or dependencies

- `assignmentDefinitionPartials`
- full assignment-definition record for update mode
- `assignmentTopics`
- `yearGroups`

### Prefetch or initialisation policy

#### Startup

- `assignmentDefinitionPartials`, `yearGroups`, and `assignmentTopics` belong to the startup warm-up surface.
- No per-definition full-definition query belongs in startup warm-up.

#### Feature entry

- Opening create mode uses the startup-owned reference-data sets; the modal should fail closed locally if those datasets are unavailable or untrustworthy.
- Opening update mode must load the selected full assignment definition before task weightings become editable.
- The initial create parse submit is the point where tasks become available for editing.
- Active frontend data ownership should be:
  - `assignmentDefinitionPartials`: page-level shared query
  - `assignmentTopics`: shared startup-owned reference-data query
  - `yearGroups`: shared reference-data query
  - full definition by key: modal-entry query scoped to the selected definition key

#### Manual refresh

- The existing Assignments page refresh action should remain available.
- Successful create, update, and manual re-parse flows must refresh or invalidate the assignment-definition query data so the table remains trustworthy.
- Stage-one create success must also refresh or invalidate the assignment-definition query data because the persisted definition is immediately legitimate and should appear in the table.
- Final save and manual re-parse should also refresh the selected full-definition query so the open modal reflects the persisted source of truth.

### Query or transport additions

- Add a frontend service wrapper and Zod contract for `upsertAssignmentDefinition` covering stage-one create, final save, and document-change re-parse behaviour.
- Add a backend `getAssignmentDefinition` transport method and a matching frontend service/query contract that returns the full definition for update mode.
- Reuse the existing backend assignment-topic method through new frontend service/query wrappers rather than introducing another backend endpoint.
- Add a shared query key, query-definition entry, and startup warm-up integration for `assignmentTopics`.
- Add a scoped query key for full-definition reads by `definitionKey`.
- `upsertAssignmentDefinition` and `getAssignmentDefinition` should share the canonical full-definition response shape so React Query and local form state can use one editable entity model.
- The transport contract should be explicit as follows:

#### `getAssignmentDefinition`

- Request: definition key.
- Backend responsibilities: load the full definition, resolve topic/year-group labels, and return task data needed for edit mode.

#### `upsertAssignmentDefinition`

- Request: optional definition key, editable metadata, reference URL, template URL, assignment weighting, and task-weighting patches.
- Backend responsibilities: validate URLs, extract document IDs, ensure the documents differ, derive `documentType`, enforce duplicate business-tuple rules when applicable, parse tasks when the write creates a definition or changes documents, preserve compatible existing task weightings where task IDs still match, persist the resulting definition state, and return the same canonical full assignment definition shape used by `getAssignmentDefinition`.

## Core view model or behavioural model

Use this section when the feature depends on a merged or derived model rather than rendering directly from one raw payload.

### Suggested shape

```ts
{
  mode: 'create' | 'update';
  canEditMetadata: boolean;
  canEditWeightings: boolean;
  hasPendingDocumentChange: boolean;
  hasParsedTasks: boolean;
  stageOnePersistenceCompleted: boolean;
  hasUnsavedMetadataOrWeightingEdits: boolean;
  visibleTaskRows: Array<{
    taskId: string;
    taskTitle: string;
    taskWeighting: number;
  }>;
  reparsePrompt:
    | null
    | {
        message: string;
        changedFields: Array<'reference' | 'template'>;
      };
}
```

### Derivation or merge rules

#### Create mode

- Before the first successful parse, metadata and document inputs are editable, but task-weighting controls are unavailable.
- After the first successful parse, the wizard uses the persisted parsed definition as the source of truth for the shared edit surface, including document URLs, metadata, and task rows.
- After the first successful parse, document URL fields remain visible and editable, but any subsequent document change enters the same explicit re-parse resolution flow used by update mode.
- The final save updates metadata and weightings against that persisted definition.
- If the user cancels after stage one, the modal closes without rollback and the persisted stage-one definition remains available in the table.
- Closing the modal with unsaved stage-two metadata or weighting edits requires explicit discard confirmation; choosing discard closes the modal and abandons those unsaved local edits while leaving the persisted stage-one definition intact.

#### Update mode

- Existing persisted metadata and task rows populate the edit panel.
- If neither document URL changes, the user can edit metadata and weightings normally.
- If metadata or weighting edits are dirty, document URL fields become unavailable until the user saves or discards those edits by closing the modal and confirming discard.
- If either document URL changes, metadata and weighting controls become unavailable until the user resolves the document change through the explicit re-parse prompt.
- Cancelling the re-parse prompt restores the persisted document URLs and re-enables the other controls.
- A successful re-parse updates the task set, preserves compatible stored task weightings where task IDs still match, and returns the user to the normal edit state.
- Newly introduced tasks after re-parse default to `1`; matching tasks keep their previously persisted weighting; removed tasks disappear with the superseded parsed result.

#### Year-group contract

- Writes persist `yearGroupKey` as the authoritative field.
- Duplicate detection uses the tuple `(normalised primaryTitle, primaryTopicKey, yearGroupKey)`.
- Partial rows and full-definition responses expose `yearGroupKey` and `yearGroupLabel` as the active frontend contract.

### Sort order or priority rules

1. Blocking load or parse failure state
2. Pending document-change / re-parse required state
3. Ready editable state
4. Background refresh state

Also define any deterministic tie-break rules needed for testing.

## Main user-facing surface specification

### Recommended components or primitives

- modal wizard or modal edit panel owned by the Assignments page
- Ant Design form controls for metadata and weighting inputs
- explicit alert or inline status region for parse failures and re-parse prompts
- data table or structured list for task-weighting rows

### Fields, columns, or visible sections

1. Assignment metadata: title, topic, year group
2. Document inputs: reference URL and template URL
3. Assignment weighting
4. Task-weighting list sourced from parsed tasks
5. Local status region for parse success, parse failure, and re-parse-required states

### Sorting, filtering, or navigation rules

- The main Assignments table keeps its existing filtering and sort-reset behaviour.
- Update entry must be a row-level action in the table.
- Create entry must replace the disabled top-level create action on the page.
- The current disabled top-level update button must be removed from the page action area.
- The wizard should preserve user progress within the open modal until the user explicitly cancels or completes the flow.

### Rendering rules

#### Before tasks are available

- The task-weighting section should not pretend that editable task data exists.
- The UI should clearly communicate that parsing is required before task weightings can be edited.

#### Parse failure

- The modal stays open and shows a blocking local error.
- Weighting controls remain unavailable until parsing succeeds.

#### Pending document change in update mode

- Metadata and weighting inputs are disabled.
- A focused prompt appears above the changed document fields identifying which document changed and offering `Re-parse` and `Cancel` actions.
- `Cancel` restores the previous persisted document URLs.

#### Ready state

- All normal editable controls are available.
- Weighting controls show required numeric values with defaults already populated.

## Workflow specification

Create one subsection for each important user or system workflow.

## Create assignment definition

### Eligible inputs or preconditions

- The Assignments page is available.
- Required reference data for topics and year groups is loaded through startup warm-up.
- The user can supply valid, different reference and template document URLs.

### Inputs, fields, or confirmation copy

- title input
- topic dropdown
- year-group dropdown
- reference document URL input
- template document URL input
- primary create-step action that validates, parses, and persists the initial definition so task rows exist for stage two

### Behaviour

- The user opens create mode from the Assignments page action area.
- The user completes metadata and document inputs.
- On the first submit, the system validates the inputs, parses tasks, and persists the initial definition.
- On success, the wizard advances to the shared edit surface using the canonical full-definition stage-one response, including the persisted definition key and extracted document IDs, as the source of truth.
- Assignment weighting and each task weighting are prefilled to `1` when no explicit stored value exists.
- After stage-one success, document URL fields remain editable inside the same modal session, but any further document change requires the same `Re-parse` or `Cancel` resolution flow used in update mode.
- The Assignments table becomes eligible to show the newly created definition immediately after stage-one success.
- On final save, the system persists the completed metadata and weightings and refreshes the Assignments page data.
- If the user cancels after stage one, the modal closes and the stage-one persisted definition remains stored.
- If the user closes the modal with unsaved stage-two metadata or weighting edits, the modal must require explicit discard confirmation before closing.

### Failure handling

- Validation failures stay local to the modal and do not close it.
- Parse or persistence failures stay local to the modal and do not expose partial success as complete.
- Mixed document-type pairs fail validation locally and do not persist.

## Update assignment definition

### Eligible inputs or preconditions

- The selected definition exists in the Assignments table.
- The modal can load the full persisted definition, including tasks.

### Inputs, fields, or confirmation copy

- row-level `Update` action from the Assignments table
- editable metadata and document URL fields
- assignment-weighting input
- task-weighting inputs
- re-parse prompt with explicit `Re-parse` and `Cancel` actions when document URLs change

### Behaviour

- The user opens update mode from a row action.
- The modal loads the current persisted definition and task list.
- If the user edits only metadata or weightings, a normal save persists those changes.
- If the user edits either document URL, the UI disables other fields and requires the explicit re-parse decision before further edits continue.
- If the user confirms re-parse, the system validates the changed URLs, parses the tasks again, persists the refreshed definition, and then re-enables editing.
- If the user cancels re-parse, the system restores the previous persisted URLs and returns to the editable state without changing the stored definition.
- Update mode should present document fields as canonical Google URLs reconstructed from stored document IDs.
- The UI must not allow a document change to coexist with dirty metadata or weighting edits; one unsaved path must be resolved before the other begins.

### Failure handling

- Re-parse failures remain local to the modal and keep the user in the document-change resolution state.
- Save failures leave the modal open with the current unsaved local state intact where safe to do so.

## Refresh and list consistency

### Eligible inputs or preconditions

- The user has created, updated, or deleted assignment definitions.

### Behaviour

- Successful create, update, delete, and re-parse flows must invalidate or refetch assignment-definition query data.
- The Assignments page table should reflect newly created definitions, updated metadata, and changed task-derived timestamps without requiring a full app reload.

## Open questions

- None at the product-contract level for the current phase.

## Non-goals and deliberate deferrals

- No attempt is made in this phase to design the final weighted assessment calculation formula.
- No attempt is made in this phase to merge the separate assessment-launch wizard into this surface.
- No attempt is made in this phase to support editing task content, notes, or artifacts beyond task weightings.
- No attempt is made in this phase to support draft records that never persist until the final stage.
