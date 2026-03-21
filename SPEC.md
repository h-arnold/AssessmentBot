# Classes CRUD Specification

## Status

Draft v1.2 — refined after the second review pass.

## Purpose

This document defines the intended behaviour for the Classes CRUD surface.

The top-level Classes page will be used to:

- list active Google Classrooms alongside persisted `ABClass` records
- show which Google Classrooms do and do not yet have corresponding `ABClass` records
- create, update, activate, inactivate, and delete `ABClass` records
- manage cohort and year-group reference data through secondary modals

This page is **not** intended to host class analysis or assessment-run controls in the first implementation slice.

## Agreed product decisions

1. The top-level **Classes** page is the correct home for this feature.
2. This page is for **CRUD operations on `ABClass` entities only**.
3. Orphaned `ABClass` records should remain visible on the same page and should support **deletion only**.
4. The page should use a **single table** with status as a visible column.
5. Rows should be sorted to show **active**, then **inactive**, then **not created**, then **orphaned**.
   Assumption: rows with no `ABClass` yet (`not created`) are treated as a distinct status that sorts after inactive and before orphaned unless later directed otherwise.
6. The Google Classroom list should refresh on page load only; no manual refresh control is needed for now.
7. Cohort and year-group management should use **secondary modals** for create, edit, and delete flows.
8. Bulk editing should remain **modal-driven**, not inline.
9. `courseLength` must be part of the create flow, with `1` accepted as the default.
10. Active/inactive updates must **not** create missing `ABClass` records; frontend and backend validation must enforce this.
11. Delete messaging should make clear that both the full and partial `ABClass` records are deleted.
12. Bulk-action partial failures should keep failed rows selected and show a summary alert.
13. Deleting cohorts or year groups that are still in use must be prevented.
14. Cohort selection should:
    - allow only active cohorts in create/edit selectors for new class flows
    - keep inactive cohorts visible in existing class data
    - keep inactive cohorts understandable when already assigned
15. `cohorts` and `yearGroups` should be startup-prefetched alongside `classPartials` because they will become shared lookup data for querying and filtering across the frontend.
16. Any create, edit, or delete operation affecting cohorts or year groups should invalidate the corresponding shared query and force a refresh.

## Existing system constraints

### Backend/API surfaces already available

The current transport layer already exposes:

- `getABClassPartials`
- `getGoogleClassrooms`
- `upsertABClass`
- `updateABClass`
- `deleteABClass`
- `getCohorts`, `createCohort`, `updateCohort`, `deleteCohort`
- `getYearGroups`, `createYearGroup`, `updateYearGroup`, `deleteYearGroup`

### Current data-shape constraints

- `getGoogleClassrooms` returns only `classId` and `className` for active Google Classrooms.
- `getABClassPartials` returns only persisted `ABClass` partials.
- First-run behaviour must therefore be driven by a merged view model, because there may be zero persisted partials while active Google Classrooms still exist.
- Current reference-data transport is name-based, which makes renaming cohorts and year groups harder once they are already assigned to `ABClass` records.

### Frontend architecture constraints

- Async orchestration should live in feature hooks, not page composition components.
- Shared server state should use React Query query-key helpers rather than ad-hoc keys.
- Frontend/backend calls must remain routed through `callApi(...)` and service wrappers.
- User-visible failures should surface through Ant Design `Alert` components by default.

## Recommendation: use stable keys for cohorts and year groups

I think adding stable keys for both cohorts and year groups is the better long-term model.

### Why this is preferable

If `ABClass` stores the display name directly:

- renaming a cohort or year group becomes a bulk rewrite problem
- edit flows become more fragile
- joins between `ABClass` records and reference data depend on mutable display values

If `ABClass` stores a stable key instead:

- cohort and year-group labels can be edited without rewriting every `ABClass`
- display names remain a presentation concern
- backend validation becomes clearer and less brittle
- future support for richer labels becomes easier

## Recommended reference-data shapes

### Cohort

```ts
{
  key: string;
  name: string;
  active: boolean;
}
```

### Year group

```ts
{
  key: string;
  name: string;
}
```

## Recommended `ABClass` metadata shape

Use explicit key fields rather than overloading the current display-name fields.

```ts
{
  cohortKey: string | null;
  yearGroupKey: string | null;
}
```

### Naming recommendation

Prefer explicit property names such as:

- `cohortKey`
- `yearGroupKey`

rather than continuing to use `cohort` and `yearGroup` for key values.

That keeps the contract readable and avoids future ambiguity between stored keys and display names.

## Validation recommendation

### Frontend

- Create and edit flows should use `Select` components backed by fetched reference-data options.
- Submitted cohort and year-group values should be validated as non-empty keys chosen from the fetched option lists.
- Free-text entry should not be allowed for class metadata assignment.

### Backend

Backend validation should be authoritative.

For `upsertABClass` and `updateABClass`:

- accept `cohortKey` and `yearGroupKey` as `string | null`
- reject non-string non-null values
- when non-null, verify the key exists in the corresponding reference-data collection

### Display resolution

The UI table should resolve keys to human-readable names by joining:

- `ABClass.cohortKey` -> cohort option `name`
- `ABClass.yearGroupKey` -> year-group option `name`

## Page architecture

The top-level `ClassesPage` should become the composition root for this feature.

Proposed high-level tree:

```text
ClassesPage
└── ClassesManagementPage
    ├── PageHeader / summary
    ├── Alert region (load, partial-load, mutation summary)
    ├── ClassesToolbar
    │   ├── Bulk actions trigger
    │   ├── Secondary modal launchers
    │   │   ├── Manage cohorts
    │   │   └── Manage year groups
    │   └── Selection summary
    └── ClassesTable
```

### Out of scope for this page

The first implementation slice must not add:

- class analysis tools
- assessment-run controls
- assignment workflows

## Data loading and prefetch strategy

## Required datasets

The Classes page depends on four shared datasets:

- `classPartials`
- `googleClassrooms`
- `cohorts`
- `yearGroups`

## Prefetch policy

### Startup

Startup warm-up should prefetch:

- `classPartials`
- `cohorts`
- `yearGroups`

These datasets should be treated as shared lookup data because they will be reused for joins, filters, and query composition beyond the Classes page.

### Classes-page entry

When the Classes page is opened, prefetch:

- `googleClassrooms`

This should be treated as **view-entry prefetch**, while the shared lookup datasets above are warmed at startup.

### Manual refresh

No dedicated manual refresh control is required in v1.

## Query additions

Add a shared query key and query options for Google Classrooms:

- `queryKeys.googleClassrooms()`
- `getGoogleClassroomsQueryOptions()`

Add a dedicated frontend service and adjacent Zod schema for `getGoogleClassrooms`.

## Core merged view model

The main table must not render directly from `ABClassPartials` alone.

It should render from a merged row model keyed by `classId`.

Suggested view-model shape:

```ts
{
  classId: string;
  googleClassroomName: string | null;
  abClass: ClassPartial | null;
  status: 'active' | 'inactive' | 'notCreated' | 'orphaned';
  className: string | null;
  cohortKey: string | null;
  cohortName: string | null;
  courseLength: number | null;
  yearGroupKey: string | null;
  yearGroupName: string | null;
  classOwner: TeacherSummary | null;
  teachers: TeacherSummary[];
  active: boolean | null;
}
```

## Merge rules

### Active

- active Google Classroom exists
- matching `ABClass` partial exists
- `ABClass.active === true`

### Inactive

- active Google Classroom exists
- matching `ABClass` partial exists
- `ABClass.active !== true`

### Not created

- active Google Classroom exists
- no matching `ABClass` partial exists

This is the first-run case.

### Orphaned

- persisted `ABClass` partial exists
- class is not present in the active Google Classroom list

## Sort order

Default table sort order should be:

1. active
2. inactive
3. not created
4. orphaned

This preserves the agreed priority order while still keeping unmanaged rows visible.

## Main table specification

## Ant Design components

Recommended Ant Design components:

- `Table` for the main grid and built-in `rowSelection`
- `Badge` for status display
- `Tooltip` for orphan warnings and constrained actions
- `Dropdown` or split-button for bulk actions
- `Modal` + `Form` for bulk action input and reference-data management
- `Popconfirm` for destructive actions
- `Select` for cohort/year-group choices
- `InputNumber` for `courseLength`
- `Alert` for blocking and summary feedback
- `Empty` for empty states
- `Skeleton` or table `loading` state for initial loads

## Main table columns

1. checkbox selection column
2. status column
3. `className`
4. `classId`
5. cohort
6. `courseLength`
7. year group
8. `classOwner`
9. `teachers`
10. `active`

## Rendering rules

### Not-created rows

For rows without persisted `ABClass` data, unavailable fields should render as `—`:

- cohort
- course length
- year group
- class owner
- teachers
- active

### Active and inactive rows

Display stored `ABClass` metadata resolved through the reference-data lookups where relevant.

### Orphaned rows

- show a warning icon in the status cell
- attach a tooltip explaining that the `ABClass` record exists but the Google Classroom is no longer in the active Classroom list
- allow deletion only

## Bulk-action specification

Bulk actions are modal-driven only.

## Bulk create `ABClass` records

### Eligible rows

- `notCreated` rows only

### Modal fields

- `cohortKey` (select from active cohorts)
- `yearGroupKey` (select from year-group options)
- `courseLength` (`InputNumber`, default `1`, min `1`)

### Behaviour

- submit one `upsertABClass` call per selected row
- failed rows remain selected
- successful rows are deselected
- show a summary alert after completion

## Bulk delete `ABClass` records

### Eligible rows

- active rows
- inactive rows
- orphaned rows

### Confirmation copy

The confirmation should make clear that this deletes:

- the full stored `ABClass` record
- the partial stored `ABClass` summary/index row

### Behaviour

- failed rows remain selected
- successful rows are deselected
- show summary alert

## Bulk set active / inactive

### Eligible rows

- active rows
- inactive rows

Rows in `notCreated` or `orphaned` status are not eligible.

### Frontend validation

The action must be disabled or blocked when the selection contains any ineligible row.

### Backend validation

The backend must reject attempts to set `active` on a class that does not already exist.

This avoids accidental creation-through-update.

## Bulk set cohort

### Eligible rows

- active rows
- inactive rows

Rows in `notCreated` or `orphaned` status are not eligible in v1.

### Modal fields

- `cohortKey` select
- only active cohorts should be available in the selector

## Bulk set year group

### Eligible rows

- active rows
- inactive rows

Rows in `notCreated` or `orphaned` status are not eligible in v1.

### Modal fields

- `yearGroupKey` select

## Partial-success handling

For all bulk actions:

- keep failed rows selected
- deselect successful rows
- show a persistent summary `Alert`
- include counts for attempted, succeeded, and failed rows

## Reference-data management specification

Reference-data management should be launched from secondary modals on the Classes page.

## Cohort management modal

### Capabilities

- list cohorts
- create cohort
- edit cohort
- delete cohort
- show active/inactive state

### Delete safeguard

Deletion must be prevented when any persisted `ABClass` still references that cohort key.

This safeguard should exist in both:

- backend authoritative validation
- frontend affordance or disabled state where feasible

## Year-group management modal

### Capabilities

- list year groups
- create year group
- edit year group
- delete year group

### Delete safeguard

Deletion must be prevented when any persisted `ABClass` still references that year-group key.

As with cohorts, backend validation is authoritative.

## Backend changes required to support agreed behaviour

## 1. Add stable keys to reference data

Update the cohort and year-group models and transport contracts so they expose stable keys.

## 2. Update `ABClass` metadata to store keys

Update the `ABClass` domain model and transport contracts to use:

- `cohortKey`
- `yearGroupKey`

rather than mutable display names.

## 3. Strengthen `updateABClass` validation for `active`

Current behaviour allows create-on-missing for `updateABClass`.

Required refinement:

- if the payload includes `active`
- and the class does not already exist
- reject the request rather than initialising a new `ABClass`

This preserves explicit-creation semantics.

## 4. Reference-data delete guards

Add backend validation so:

- `deleteCohort` fails if any persisted `ABClass` uses that cohort key
- `deleteYearGroup` fails if any persisted `ABClass` uses that year-group key

## 5. Partial-response shaping

Decide whether `getABClassPartials` should:

1. return keys only and let the frontend resolve names, or
2. return keys plus resolved display names for convenience

The preferred initial approach is to keep storage and transport explicit by returning keys and resolving names in the frontend view model.

## Frontend feature structure recommendation

Suggested new feature area:

```text
src/frontend/src/features/classes/
  ClassesManagementPage.tsx
  ClassesManagementPage.spec.tsx
  useClassesManagement.ts
  useClassesManagement.spec.ts
  classesManagementViewModel.ts
  classesManagementViewModel.spec.ts
  bulkActions/
  referenceData/
```

Suggested new or updated service and query files:

```text
src/frontend/src/services/
  googleClassroomsService.ts
  googleClassrooms.zod.ts

src/frontend/src/query/
  queryKeys.ts
  sharedQueries.ts
```

## Broad implementation-plan task set

The implementation plan should be organised around the following broad workstreams.

## 1. Contract design

- confirm the final blank-slate transport contract for `cohortKey` and `yearGroupKey`
- ensure later sections can rely on the key-based contract without compatibility fallbacks
- identify every backend and frontend consumer that must adopt the new key-based contract

## 2. Reference-data model and API updates

- add stable keys to cohort and year-group records
- update create, edit, list, and delete handlers to expose keys
- preserve existing active-state behaviour for cohorts
- add delete guards for in-use cohort and year-group keys

## 3. `ABClass` domain and API updates

- update the `ABClass` model to store `cohortKey` and `yearGroupKey`
- update serialisation, deserialisation, and partial-response shapes
- update `upsertABClass` and `updateABClass` validation for key-based metadata
- prevent `active` updates from creating missing classes

## 4. Backend query and lookup support

- add any controller helpers needed to resolve reference-data keys efficiently
- ensure reference-data existence checks are shared rather than duplicated
- review whether partial responses should expose keys only or keys plus resolved labels

## 5. Frontend service and schema work

- add or update Zod schemas for key-based cohort and year-group payloads
- add the frontend `googleClassrooms` service wrapper
- update service contracts for any changed `ABClass`, cohort, or year-group payloads
- keep all transport calls routed through `callApi(...)`

## 6. React Query and prefetch orchestration

- add `googleClassrooms` shared query definitions and keys
- update startup warm-up to include `cohorts` and `yearGroups` alongside `classPartials`
- add invalidation and forced refresh behaviour for cohort and year-group mutations
- update any canonical React Query documentation that changes as a result

## 7. Classes-page feature implementation

- replace the current placeholder `ClassesPage` with a real feature entry component
- build the merged row view model for active, inactive, not-created, and orphaned rows
- implement default status sorting and row selection
- render the main Ant Design table and status affordances

## 8. Bulk-action workflows

- implement bulk create, delete, set active or inactive, set cohort, and set year group flows
- add modal forms, validation, confirmation steps, and partial-success summaries
- ensure failed rows remain selected after batch operations

## 9. Reference-data management modals

- implement cohort management modal flows for create, edit, delete, and active-state handling
- implement year-group management modal flows for create, edit, and delete
- surface delete-blocked states clearly when reference data is still in use

## 10. Error handling and empty states

- implement blocking and partial-load `Alert` states
- add empty states for no active Google Classrooms and first-run no-`ABClass` cases
- ensure orphaned-state tooltip and destructive-action copy are clear

## 11. Automated testing

- add backend unit and API-layer coverage for the new contracts and guards
- add frontend Vitest coverage for services, view-model mapping, hooks, and component logic
- add Playwright coverage for user-visible interactions such as tab/page entry, row selection, modals, and bulk actions
- keep test coverage aligned with the repo testing split and shared mock-helper rules

## 12. Documentation and rollout follow-through

- update canonical docs that are affected by the final design, especially React Query/prefetch guidance and any API/data-shape docs
- capture rollout notes and any deferred follow-up tasks
- record any follow-on tasks that are intentionally deferred from v1

## Error, loading, and empty-state rules

## Blocking load failure

If the Classes page cannot load essential datasets, show a top-level `Alert`.

## Partial-load failure

If one dataset fails but others succeed:

- keep usable data visible where practical
- show a warning `Alert`
- do not hide already-loaded table data unnecessarily

## Empty states

### No active Google Classrooms

Show `Empty` state for the table.

### First run: no `ABClass` records yet

Still show all active Google Classrooms as `notCreated` rows.

### No orphaned classes

No separate orphaned panel is needed; simply omit orphaned rows from the current filtered result if there are none.

## Mutation refresh rules

After successful mutations, refresh the relevant queries:

- class create, update, delete -> refresh `classPartials`
- cohort create, edit, delete -> invalidate `cohorts` and force a refresh for active consumers
- year-group create, edit, delete -> invalidate `yearGroups` and force a refresh for active consumers
- Google Classrooms refreshes on page entry only in v1

## Accessibility and usability notes

- bulk-action controls should expose disabled reasons where practical via tooltip text
- orphaned state should be understandable by icon plus text or tooltip, not icon alone
- modal forms should focus the first actionable field on open
- destructive actions should require explicit confirmation
- table selection state should remain predictable after partial failures

## V1 scope recommendation

Include in v1:

- Classes-page ownership for this feature
- a single CRUD-focused table
- status column with default sort order
- merged active, inactive, not-created, and orphaned rows
- modal-driven bulk actions
- secondary modals for cohort and year-group management
- create flow with default `courseLength` of `1`
- stable keys for cohorts and year groups
- `ABClass` storage of cohort and year-group keys
- backend validation to prevent `active` updates creating missing classes
- backend validation to prevent deleting in-use cohorts and year groups
- Google Classrooms view-entry prefetch on Classes-page entry

Defer from v1:

- inline editing
- dedicated backend bulk endpoints
- manual refresh controls
- class analysis features on this page
- assessment-run controls on this page
- broader assignment workflows
