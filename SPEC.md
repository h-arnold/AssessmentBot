# Topics CRUD Modal and Reference Data Dropdown 'Add New' Feature Specification

## Status

- Draft v1.0

## Purpose

This document defines the intended behaviour for extending the reference data management infrastructure to include a Topics CRUD modal and adding an 'Add new' option to reference data Select dropdowns across the application.

The feature will be used to:

- Enable users to manage assignment topics through a dedicated CRUD modal interface
- Support associating topics with multiple year groups (a topic can belong to more than one year group)
- Provide a convenient way to create new reference data entities directly from selection dropdowns
- Maintain consistency with the existing cohort and year group reference data patterns

This feature is **not** intended to:

- Replace existing reference data management patterns
- Modify ABClass, Cohort, or YearGroup models (only AssignmentTopic model is affected)
- Change the existing modal hierarchy or navigation model beyond adding the Topics modal
- Add multi-select support to existing year group selectors (topics only get multi-year-group association)

## Agreed product decisions

1. The Topics CRUD modal will follow the same pattern as ManageCohortsModal and ManageYearGroupsModal, reusing the ReferenceDataManagementModalScaffold and useReferenceDataManagement hook.
2. The 'Add new' option will appear in ALL Select dropdowns that select reference data entities (cohort, year group, topic).
3. Clicking 'Add new' in a Select dropdown will open the corresponding CRUD modal directly.
4. The canonical AssignmentTopic contract is `{ key, name, yearGroupKeys }` everywhere in the system.
5. The Manage Topics modal is accessible from Settings and from topic-selection contexts via "Add new topic" flows (not from the Classes Management Panel).
6. The 'Add new' dropdown option will be implemented as a real sentinel Select option so native keyboard navigation/selection behaviour is preserved.
7. After creating a new reference data entity via the 'Add new' flow, the dropdown will refresh its options and automatically select the newly created entity via a callback mechanism (`onEntityCreated`).
8. **Topic-year group association**: AssignmentTopic entities will support an array of year group keys (`yearGroupKeys: string[]`), allowing a topic to be associated with multiple year groups. The ManageTopicsModal will include a year group multi-selector in the create/edit form.
9. **Schema consolidation**: Topic schemas and types will be added to `referenceData.zod.ts` using the existing `NonEmptyNameSchema` (which is `z.string().trim().min(1)`) for consistency with Cohort and YearGroup schemas, with the addition of `yearGroupKeys: z.array(NonEmptyNameSchema)` for the multi-year-group association. Existing topic read contracts must be migrated to the enriched `{ key, name, yearGroupKeys }` shape.
10. **Trust boundary extension**: The `ReferenceDataTrustBoundary` type will be extended from `'cohorts' | 'yearGroups'` to `'cohorts' | 'yearGroups' | 'assignmentTopics'` in **both** `manageReferenceDataHelpers.ts` (internal type) and `useReferenceDataManagement.ts` (exported type) to support the topics entity in the shared reference data management helpers.

## Existing system constraints

### Backend or API constraints already in place

- Backend ReferenceDataController already implements `listAssignmentTopics()`, `createAssignmentTopic()`, `updateAssignmentTopic()`, `deleteAssignmentTopic()` methods
- Backend z_apiHandler.js already exposes `getAssignmentTopics`, `createAssignmentTopic`, `updateAssignmentTopic`, `deleteAssignmentTopic` as allowlisted methods
- The assignment topic API entrypoints already exist, and this delivery includes the backend model/controller correction from the temporary YearGroup-backed topic shape to a dedicated AssignmentTopic shape with `yearGroupKeys`
- In-use validation prevents deletion of topics referenced by assignment definitions
- There are no existing assignment topic records in storage for this rollout.

### Current data-shape constraints

- Frontend AssignmentTopic type is defined in `src/frontend/src/services/assignmentTopics.zod.ts` as `{ key: string, name: string }`
- Frontend already has `getAssignmentTopics()` service function in `assignmentTopicsService.ts`
- Existing reference data entities (Cohort, YearGroup) follow the pattern `{ key: string, name: string, ...additionalFields }`
- The `useReferenceDataManagement` hook is generic over `T extends { key: string; name: string }`

### Frontend or consumer architecture constraints

- Frontend uses React + Ant Design + React Query
- Existing Select dropdowns for reference data:
  - `BulkCreateModal.tsx`: Cohort and Year Group Select
  - `BulkSetSelectModal.tsx`: Generic select modal for bulk operations
  - `AssignmentDefinitionWizardModalShell.tsx`: Topic and Year Group Select
- Existing modals ManageCohortsModal and ManageYearGroupsModal use the shared ReferenceDataManagementModalScaffold
- The Settings page does not currently have a Reference Data management section

## Domain and contract recommendations

### Why this approach is preferable

- **Consistency**: Reusing the existing ReferenceDataManagementModalScaffold and useReferenceDataManagement hook ensures consistent UX and reduces implementation risk
- **Minimal changes**: Backend API entrypoints already exist, and this delivery adds the required backend model/persistence fix plus frontend wiring
- **Testability**: Following the existing pattern means tests can mirror cohort/year group test structures
- **Maintainability**: Adding the 'Add new' option as a shared Select wrapper component prevents duplication across each dropdown

### Recommended data shapes

#### Topic (AssignmentTopic)

```ts
{
  key: string;              // Non-empty string (after trimming)
  name: string;             // Non-empty string (after trimming)
  yearGroupKeys: string[];  // Array of year group keys this topic applies to
}
```

The `yearGroupKeys` field allows a topic to be associated with multiple year groups. This matches the user requirement that "a topic could have more than one year group". The `yearGroupKeys` array will contain keys from the YearGroup reference data collection.

This extends the existing pattern in `referenceData.zod.ts` where `NonEmptyNameSchema = z.string().trim().min(1)` is used for both Cohort and YearGroup. The Topic schemas will use the same `NonEmptyNameSchema` for consistency, with the addition of the `yearGroupKeys` array field.

### Recommended service additions

To follow the existing pattern in `referenceDataService.ts` (where service function names match backend method names: `createCohort` calls `createCohort`, `createYearGroup` calls `createYearGroup`), the topic service functions will use the same naming convention. Note that these functions accept `yearGroupKeys` as part of the record:

- `createAssignmentTopic` in `referenceDataService.ts` - accepts `{ record: { name: string, yearGroupKeys: string[] } }`
- `updateAssignmentTopic` in `referenceDataService.ts` - accepts `{ key: string, record: { name: string, yearGroupKeys: string[] } }`
- `deleteAssignmentTopic` in `referenceDataService.ts` - accepts `{ key: string }`
- Backend API methods remain: `createAssignmentTopic`, `updateAssignmentTopic`, `deleteAssignmentTopic` (unchanged)
- `getAssignmentTopicsQueryOptions` and topic service contracts in `sharedQueries.ts` and `assignmentTopicsService.ts` are migrated to return the canonical enriched shape with `yearGroupKeys`

### Naming recommendation

Prefer:

- `ManageTopicsModal` for the modal component (matches ManageCohortsModal, ManageYearGroupsModal)
- `topicOptions` for Select options array
- `onCreateTopic` / `onEditTopic` / `onDeleteTopic` for action handlers
- `SelectWithAddNew` or similar for a wrapper component that adds the 'Add new' option

Avoid:

- Generic names like `ReferenceDataModal` that don't specify the entity type
- Inconsistent casing or naming conventions

### Validation recommendation

#### Frontend

- Topic name: required, trimmed, non-empty string (matching existing cohort/year group validation)
- Duplicate name check: prevent creating topics with names that match existing topics (case-insensitive)

#### Backend

- Backend already validates these constraints in ReferenceDataController.\_createRecord and \_updateRecord

### Display-resolution recommendation

- Topic dropdowns should display the `name` field as the label
- Topic CRUD modal table should show `name` as the primary column
- No additional display transformation needed

## Feature architecture

### Placement

- New backend model: `src/backend/Models/AssignmentTopic.js` (new file, separate from YearGroup)
- Backend controller updates: `src/backend/y_controllers/ReferenceDataController.js` (update to use AssignmentTopic model)
- New frontend component: `src/frontend/src/features/settings/ManageTopicsModal.tsx`
- Shared wrapper: `src/frontend/src/components/SelectWithAddNew.tsx`
- Service additions: `src/frontend/src/services/referenceDataService.ts` (extend existing)
- Schema additions: `src/frontend/src/services/referenceData.zod.ts` (extend existing with yearGroupKeys)
- Settings page integration: `src/frontend/src/features/settings/ReferenceDataSettingsPanel.tsx` (new)

Canonical entry points:

- Manage Topics modal: opened from Settings page and from topic-selection "Add new topic" flows
- 'Add new' in dropdowns: opened inline from any Select that uses reference data

### Proposed high-level tree

```text
src/backend/
├── Models/
│   └── AssignmentTopic.js (NEW - with key, name, yearGroupKeys)
└── y_controllers/
    └── ReferenceDataController.js (UPDATE - use AssignmentTopic model)

src/frontend/src/
├── features/
│   ├── classes/
│   │   ├── BulkCreateModal.tsx (add 'Add new' to Select)
│   │   ├── BulkSetSelectModal.tsx (add 'Add new' to Select)
│   │   └── ...
│   └── settings/
│       ├── BackendSettingsPanel.tsx (existing)
│       ├── ReferenceDataSettingsPanel.tsx (NEW)
│       │   └── ManageTopicsModal.tsx (NEW - with yearGroupKeys multi-select)
├── components/
│   └── SelectWithAddNew.tsx (NEW)
├── pages/
│   └── AssignmentDefinitionWizardModalShell.tsx (add 'Add new' to Select)
└── services/
    ├── referenceDataService.ts (extend with createTopic, updateTopic, deleteTopic)
    └── referenceData.zod.ts (extend with AssignmentTopicSchema including yearGroupKeys)
```

### Out of scope for this surface

- Changes to ABClass, Cohort, or YearGroup models (only AssignmentTopic is affected)
- Changes to existing cohort or year group management behaviour
- New reference data entity types beyond topics
- Modifications to the modal hierarchy or navigation model beyond adding the Topics modal
- Multi-select support for existing year group selectors (only the Topics modal gets year group multi-select)

## Data loading and orchestration

### Required datasets or dependencies

- `assignmentTopics` query for ManageTopicsModal
- Existing `cohorts` and `yearGroups` queries remain unchanged
- Query invalidation after create/update/delete operations

### Prefetch or initialisation policy

#### Startup

- Assignment topics are already part of the startup warm-up queries in `sharedQueries.ts`
- No changes needed to startup warm-up

#### Feature entry

- ManageTopicsModal will fetch topics on-demand when opened (lazy loading)
- 'Add new' flow will use the existing cached query and refetch after mutation

#### Manual refresh

- The scaffold already supports refresh with explicit status messaging
- No additional refresh controls needed

### Query or transport additions

Required additions to `src/frontend/src/services/referenceDataService.ts`:

```ts
// Topic CRUD operations
export async function createAssignmentTopic(
  input: CreateAssignmentTopicInput
): Promise<CreateAssignmentTopicResponse>;
export async function updateAssignmentTopic(
  input: UpdateAssignmentTopicInput
): Promise<UpdateAssignmentTopicResponse>;
export async function deleteAssignmentTopic(
  input: DeleteAssignmentTopicInput
): Promise<DeleteAssignmentTopicResponse>;
```

Required additions to `src/frontend/src/services/referenceData.zod.ts`:

Note: We use `NonEmptyNameSchema` (which is `z.string().trim().min(1)`) for consistency with existing Cohort and YearGroup schemas in the same file. The Topic schema extends this with a `yearGroupKeys` array field for multi-year-group association.

```ts
// Topic schemas matching the pattern used for Cohort and YearGroup, with yearGroupKeys array (to be added to referenceData.zod.ts)
export const AssignmentTopicSchema = z.object({
  key: NonEmptyNameSchema,
  name: NonEmptyNameSchema,
  yearGroupKeys: z.array(NonEmptyNameSchema),
});
export type AssignmentTopic = z.infer<typeof AssignmentTopicSchema>;
export const AssignmentTopicListResponseSchema = z.array(AssignmentTopicSchema);
export type AssignmentTopicListResponse = z.infer<typeof AssignmentTopicListResponseSchema>;
// Input schemas for mutations (matching Cohort/YearGroup input pattern, with yearGroupKeys for create/update)
export const CreateAssignmentTopicInputSchema = z.object({
  record: z.object({
    name: NonEmptyNameSchema,
    yearGroupKeys: z.array(NonEmptyNameSchema),
  }),
});
export type CreateAssignmentTopicInput = z.infer<typeof CreateAssignmentTopicInputSchema>;
export const UpdateAssignmentTopicInputSchema = z.object({
  key: NonEmptyNameSchema,
  record: z.object({
    name: NonEmptyNameSchema,
    yearGroupKeys: z.array(NonEmptyNameSchema),
  }),
});
export type UpdateAssignmentTopicInput = z.infer<typeof UpdateAssignmentTopicInputSchema>;
export const DeleteAssignmentTopicInputSchema = z.object({ key: NonEmptyNameSchema });
export type DeleteAssignmentTopicInput = z.infer<typeof DeleteAssignmentTopicInputSchema>;
```

Query options:

- Migrate `getAssignmentTopicsQueryOptions` to return `{ key, name, yearGroupKeys }`.
- Update all consumers and tests that currently assume `{ key, name }`.

## Core view model or behavioural model

### Suggested shape

The SelectWithAddNew wrapper component will manage:

```ts
{
  options: SelectOption[];
  onAddNew?: () => void;
  addNewLabel?: string;
}
```

### Derivation or merge rules

#### 'Add new' option visibility

- Show 'Add new' option only when `onAddNew` is provided
- Position at the bottom of the dropdown list as a sentinel option
- Label defaults to 'Add new {entityType}' where entityType is derived from context
- 'Add new' option MUST be disabled when the Select component is disabled, matching Ant Design's native behavior

#### Post-creation selection

- After creating a new entity via 'Add new', the modal calls `onEntityCreated` on the orchestration owner
- The orchestration owner (for example `ClassesManagementPanel` or `useAssignmentDefinitionWizard`/`AssignmentDefinitionWizardModal`) performs query invalidation/refetch and sets the selected value
- SelectWithAddNew stays presentational: it renders the affordance and triggers `onAddNew`; it does not own created-entity callbacks, query invalidation, or field selection state

#### Entity type determination

- The `addNewLabel` prop should be provided explicitly for each entity type:
  - Cohort selects: `addNewLabel="Add new cohort"`
  - Year group selects: `addNewLabel="Add new year group"`
  - Topic selects: `addNewLabel="Add new topic"`

## Main user-facing surface specification

### Recommended components or primitives

- Ant Design `Select` with a sentinel 'Add new {entity}' option
- Ant Design `Modal` via ReferenceDataManagementModalScaffold for CRUD interface
- Ant Design `Table` for listing topics in the modal
- Ant Design `Button`, `Form`, `Input` for create/edit/delete workflows

### Fields, columns, or visible sections

#### ManageTopicsModal

1. Modal title: 'Manage Topics'
2. Create button: 'Create topic'
3. Table columns:
   - Name
   - Actions (Edit, Delete)
4. Inline form dialog for create/edit
5. Inline delete confirmation dialog

#### Select dropdowns with 'Add new'

1. Standard Select options for existing entities
2. 'Add new {entity}' sentinel option (e.g., 'Add new topic', 'Add new cohort')

### Sorting, filtering, or navigation rules

- Topics sorted alphabetically by name (matching existing cohort/year group behaviour)
- No filtering in the modal table (matching existing behaviour)
- No additional navigation layers

### Rendering rules

#### ManageTopicsModal states

- **Initial loading**: Show skeleton loader
- **Ready with data**: Show table with create button
- **Ready with no data**: Show empty state with create button
- **Refreshing**: Show inline status message
- **Blocking failure**: Show error alert, hide table

#### Select with 'Add new' states

- **Normal**: Show all options including 'Add new' at bottom
- **Disabled**: 'Add new' option also disabled
- **Loading**: Options list may show loading state

## Workflow specification

### Manage Topics workflow

#### Eligible inputs or preconditions

- User must be authenticated
- Settings page must be accessible

#### Inputs, fields, or confirmation copy

- Create/Edit form: Name field (required) and Year groups multi-select (`yearGroupKeys`)
- Delete confirmation: 'Are you sure you want to delete this topic?'

#### Behaviour

- **Execution**: Create/update/delete calls backend via referenceDataService
- **Success**: Refetch topics query, show success state briefly
- **Failure**: Show inline error in modal, keep modal open for retry

### 'Add new' from Select workflow

#### Eligible inputs or preconditions

- Select must be in a ready state (not loading, not disabled)
- `onAddNew` callback must be provided

#### Inputs, fields, or confirmation copy

- Dropdown shows 'Add new {entity}' option

#### Behaviour

- **Execution**: Clicking 'Add new' triggers the callback
- **Success**: Modal opens, user creates entity, modal closes, dropdown refreshes and selects new entity
- **Cancellation**: Modal closes, dropdown state unchanged

## Error, loading, and empty-state rules

### Blocking failure

- ManageTopicsModal: Show Ant Design Alert with error message, hide table
- Select with 'Add new': If options fail to load, show Select's built-in empty/loading state

### Partial-load or partial-success failure

- ManageTopicsModal: follow fail-closed behaviour; show blocking error alert and hide ready-body content
- Select: Maintain existing options, show warning if applicable

### Empty states

- **ManageTopicsModal with no topics**: Show 'No topics' empty text in table, create button still visible
- **Select with no existing options**: Show 'Add new' option only

## Accessibility and usability notes

- 'Add new' option must be keyboard accessible via arrow keys
- 'Add new' option must have proper ARIA label
- Modal must maintain proper focus trap and return focus on close
- Screen readers must announce the 'Add new' option clearly

## Backend changes required to support agreed behaviour

### Backend Model Changes

A new `AssignmentTopic` model must be created to properly support the `yearGroupKeys` array field:

1. **New file**: `src/backend/Models/AssignmentTopic.js`
   - Fields: `key`, `name`, `yearGroupKeys` (array of strings)
   - Validation: `key` and `name` are required trimmed non-empty strings, `yearGroupKeys` is an array of trimmed non-empty strings
   - Serialization methods: `toJSON()`, `fromJSON()`

2. **Update**: `src/backend/y_controllers/ReferenceDataController.js`
   - Update `_getConfig('assignmentTopic')` to use `AssignmentTopic` model class instead of `YearGroup`
   - Keep existing shared CRUD flow (`_createRecord`, `_updateRecord`, `_buildRecord`) and rely on the AssignmentTopic model/config update so persisted records carry `yearGroupKeys`
   - The in-use validation for topics should check against `assignment_definitions` using `primaryTopicKey` (existing)

### Backend API Methods

The existing API methods in `z_apiHandler.js` remain unchanged but will now use the correct model:

1. `getAssignmentTopics` - retrieves all topics with their `yearGroupKeys`
2. `createAssignmentTopic` - creates a new topic with `yearGroupKeys`
3. `updateAssignmentTopic` - updates an existing topic including `yearGroupKeys`
4. `deleteAssignmentTopic` - deletes a topic

**Previous backend model bug**: The `ReferenceDataController` currently uses the `YearGroup` model class for `assignmentTopic` entities (line 147 in `_getConfig`). This feature will fix that bug by creating a proper `AssignmentTopic` model with the `yearGroupKeys` field.

**Assumption**: The backend validation will properly handle the `yearGroupKeys` array field with the new AssignmentTopic model.

## Planning handoff notes

- The 'Add new' Select wrapper must be designed to work with the existing Select usage patterns
- The ManageTopicsModal must follow the exact same pattern as ManageCohortsModal and ManageYearGroupsModal
- Query invalidation must be wired correctly for the topics query
- The Settings page needs a new section for Reference Data management
- The `ReferenceDataTrustBoundary` type must be extended to include `'assignmentTopics'` before ManageTopicsModal can use the shared helpers
- The `onEntityCreated` callback mechanism must be implemented to coordinate post-creation selection between modals and Select dropdowns
- All reference data schema and service additions should be consolidated into `referenceData.zod.ts` and `referenceDataService.ts` respectively

## Testing expectations

- Backend: add model/controller tests for AssignmentTopic and ReferenceDataController topic behaviour
- Frontend unit tests:
  - ManageTopicsModal component tests
  - SelectWithAddNew wrapper component tests
  - Service function tests for topic CRUD
  - Hook tests for useReferenceDataManagement with topics
- Browser/e2e tests:
  - 'Add new' workflow from Select dropdowns
  - ManageTopicsModal CRUD operations

## Documentation and rollout notes

- Update `docs/developer/frontend/frontend-modal-patterns.md` to include the topics modal family
- Update any relevant AGENTS.md files if new patterns are established

## V1 scope recommendation

### Include in v1

- ManageTopicsModal component
- Service functions for topic CRUD in referenceDataService.ts
- Schema additions in referenceData.zod.ts
- SelectWithAddNew wrapper component
- Integration of 'Add new' option in all existing reference data Select dropdowns
- Settings page Reference Data section with ManageTopicsModal entry

### Defer from v1

- Additional reference data entity types
- Enhanced filtering or search in the topics modal

## Open questions

1. Should there be a rate limit or debounce on both the modal open (prevent rapid repeated clicks on 'Add new') and the create action (prevent rapid repeated creation attempts)?

**Resolved questions:**

- **Icon**: Use standard PlusOutlined icon alongside 'Add new' text
