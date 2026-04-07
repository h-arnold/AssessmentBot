# Classes Tab Layout and Modals

## Purpose

This document defines the explicit layout, component hierarchy, modal flows, and user-visible states for the **Classes** tab inside `SettingsPage`.

Use it alongside:

- `SPEC.md`
- `ACTION_PLAN.md`
- `SETTINGS_PAGE_LAYOUT.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md`

This document is intentionally UI-focused. It does not replace the data-contract decisions in the spec or the implementation sequencing in the action plan.

## Scope of this document

This document covers:

1. the tab hierarchy inside `SettingsPage`
2. the major screen regions inside the Classes tab
3. the Ant Design components to use for each region and modal
4. the user-visible states of the tab
5. the user-visible states of each modal workflow
6. the preferred hierarchy for secondary and tertiary modal flows

This document does **not** redefine backend contracts, data shapes, or rollout assumptions already covered in `SPEC.md` and `ACTION_PLAN.md`.

## Design principles

1. Keep `SettingsPage.tsx` as a composition layer only.
2. Keep the Classes feature inside the existing **Settings** -> **Classes** tab; do not add or restore a parallel top-level Classes route, page, or navigation entry.
3. Use one visible CRUD table rather than nested inner tabs.
4. Use modal-driven workflows for create, bulk-edit, and reference-data management; the same bulk modals are also the single-row edit path in v1.
5. Use top-level `Alert` components for blocking and partial-load failures.
6. Prefer built-in Ant Design behaviours before creating bespoke interaction patterns.
7. Keep the tab readable in reduced-motion mode and avoid decorative motion that obscures status changes.
8. Keep the most important statuses visible without forcing the user to open a modal.

## Ant Design references consulted

The component choices below are aligned to the official Ant Design documentation for:

- [Tabs](https://ant.design/components/tabs)
- [Table](https://ant.design/components/table)
- [Modal](https://ant.design/components/modal)
- [Form](https://ant.design/components/form)
- [Select](https://ant.design/components/select)
- [InputNumber](https://ant.design/components/input-number)
- [Empty](https://ant.design/components/empty)
- [Tooltip](https://ant.design/components/tooltip)

## Tab hierarchy

```text
SettingsPage
└── TabbedPageSection
    ├── Classes tab
    │   └── ClassesManagementPanel
    │       ├── ClassesAlertStack
    │       ├── ClassesSummaryCard
    │       ├── ClassesToolbarCard
    │       │   ├── BulkActionsDropdown
    │       │   ├── ManageCohortsButton
    │       │   ├── ManageYearGroupsButton
    │       │   └── SelectionSummary
    │       └── ClassesTableCard
    │           └── ClassesTable
    └── Backend settings tab
        └── BackendSettingsPanel
```

The Settings-page Classes tab is the only supported entrypoint for this feature. Do not duplicate it with a standalone `ClassesPage` or a separate top-level menu item.

## No nested tabs inside the Classes tab

The Classes tab should **not** introduce another Ant Design `Tabs` layer inside the tab content.

Rationale:

- the Settings page already provides the primary tab switcher
- the feature is centred on one table and a toolbar
- nested tabs would hide bulk-action context and selection state
- modals are a better fit for secondary workflows such as cohort and year-group management

## Classes tab outer layout

## Recommended page skeleton

```text
ClassesManagementPanel
└── Flex / Space (vertical)
    ├── Alert stack
    ├── Summary card
    ├── Toolbar card
    └── Table card
```

## Recommended top-level Ant Design components

### 1. `Card`

Use `Card` for the main visible regions:

- summary card
- toolbar card
- table card

Reason:

- gives clear visual separation without extra tab layers
- aligns with the existing Settings page design language
- keeps error and empty states contained and readable

### 2. `Flex` or `Space`

Use a vertical `Flex` or `Space` layout for the main stacking of cards and alerts.

Reason:

- simple, declarative spacing
- avoids ad-hoc margin stacking
- keeps the tab responsive without inventing a bespoke layout system

### 3. `Alert`

Use a dedicated alert stack at the top of the tab for:

- blocking startup-prefetch failures
- Google Classroom load failure on tab entry
- partial-load warnings
- mutation summary feedback

Reason:

- the spec and frontend error-handling rules already favour top-level `Alert`
- makes failure states visible before the user reaches the table

## Classes tab region-by-region design

## 1. Alert stack

### Components

- `Alert`
- `Space` or `Flex` for vertical stacking

### States

1. **No alerts**
   - render nothing in this region
2. **Blocking startup-prefetch failure**
   - show one error `Alert`
   - table and toolbar should not present an interactive ready state
3. **Blocking Google Classroom fetch failure**
   - show one error `Alert`
   - keep any already-cached shared lookup data out of view unless the page has a deliberate degraded mode
4. **Partial-load warning**
   - show one warning `Alert`
   - keep usable table data visible
5. **Mutation summary**
   - show success or warning `Alert`
   - partial success remains visible until the user dismisses it or the next mutation replaces it

### Notes

- The alert stack should preserve order by severity: blocking errors first, warnings second, mutation summaries last.
- Do not bury destructive-operation feedback inside a modal after the modal closes; surface the result here.

## 2. Summary card

### Components

- `Card`
- `Statistic` for compact counts
- `Flex` for responsive layout
- `Badge` or `Tag` only if a textual status cue is needed beside a statistic

### Content

Show compact, glanceable counts such as:

- total visible rows
- active rows
- inactive rows
- not-created rows
- orphaned rows
- selected rows

### States

1. **Initial loading**
   - render `Skeleton` blocks inside the summary card
2. **Ready with data**
   - render statistics
3. **Ready with no active classrooms**
   - render zero-value statistics rather than hiding the card entirely
4. **Blocking failure**
   - optional: suppress the card if the whole tab is blocked

## 3. Toolbar card

### Components

- `Card`
- `Flex` for row layout and wrapping
- `Dropdown` for bulk actions
- `Button` for modal launchers
- `Badge` or plain text for selection count
- `Tooltip` for disabled action explanations

### Recommended structure

```text
Toolbar card
├── Left cluster
│   ├── Bulk actions button/dropdown
│   ├── Manage cohorts button
│   └── Manage year groups button
└── Right cluster
    └── Selection summary text/badge
```

### Bulk actions menu

Use `Dropdown` plus a primary `Button` or split-button trigger.

Menu items:

- Create selected classes
- Delete selected classes
- Set selected classes active
- Set selected classes inactive
- Set cohort
- Set year group
- Set course length

### States

1. **No selection**
   - bulk action trigger disabled
   - tooltip explains that at least one eligible row must be selected
2. **Mixed eligible/ineligible selection**
   - openable trigger allowed only if the chosen action can still be validated pre-open
   - ineligible actions disabled with tooltip explanation
3. **Mutation in progress**
   - disable bulk trigger and modal launchers
4. **Ready state**
   - all launchers available subject to row-selection rules
5. **Selection reset**
   - after delete or tab re-entry, reset selection rather than trying to preserve invisible rows
   - implement reset via controlled `selectedRowKeys` updates in the feature shell and explicit Settings-tab lifecycle handling; do not rely on Ant Design tab panes unmounting by default
   - keep `preserveSelectedRowKeys` disabled so removed/invisible rows are not retained implicitly

## 4. Table card

### Components

- `Card`
- `Table`
- `Badge` for row status
- `Tooltip` for warnings and disabled actions
- `Empty` for empty states
- `Skeleton` or table `loading`

### Core `Table` features to use

- `rowKey="classId"`
- `rowSelection`
- controlled `rowSelection.selectedRowKeys`
- explicit `columns`
- column-level `sorter` and `filters` for user-facing data columns
- `pagination` with sensible defaults for the expected row count
- `locale.emptyText` for custom empty-state content
- `scroll.x` if column width demands it

### Recommended columns

1. selection checkbox
2. status
3. class name
4. cohort
5. course length
6. year group
7. active flag

There are no separate row-level class-edit actions in v1; selecting one row uses the same bulk modal workflow.

`classId` should remain the `rowKey` and an internal identifier for actions, but it does not need a visible column. `class owner` and `teachers` should stay out of the table because they are backend-managed Google Classroom metadata and are only populated after the stored `ABClass` exists.

### Status presentation

Use `Badge` for the four row statuses:

- active
- inactive
- not created
- orphaned

Use `Tooltip` for the orphaned explanation and any disabled state explanation.

### Table states

1. **Initial load in progress**
   - render table `loading`
   - keep columns visible if practical
2. **No active Google Classrooms**
   - render `Empty` with explanatory description
   - keep toolbar visible but non-destructive actions disabled
3. **First run**
   - render all active classrooms as `notCreated`
4. **Ready with mixed statuses**
   - render the merged table normally
5. **Partial-load warning**
   - keep table visible
   - show warning `Alert` above the card
   - if the failed refresh is required to trust current table state (for example mutation succeeded but required refresh failed), suppress stale table rows and show refresh-needed guidance
6. **Blocking failure**
   - do not present the table as an interactive ready state

## Modal hierarchy

```text
Classes tab
├── BulkCreateClassesModal
├── BulkDeleteClassesConfirmModal
├── BulkSetActiveStateConfirmModal
├── BulkSetCohortModal
├── BulkSetYearGroupModal
├── BulkSetCourseLengthModal
├── ManageCohortsModal
│   ├── CreateOrEditCohortModal
│   └── DeleteCohortConfirmModal
└── ManageYearGroupsModal
    ├── CreateOrEditYearGroupModal
    └── DeleteYearGroupConfirmModal
```

## General modal rules

1. Use Ant Design `Modal` for all form-driven workflows.
2. Use `Modal.confirm` only for simple destructive confirmation where no extra fields are required.
3. Keep one primary modal open at a time unless a secondary create/edit/delete modal is explicitly nested from a management modal.
4. When a secondary modal closes successfully, return focus to the invoking button inside the parent modal.
5. Use `destroyOnHidden` only when resetting state is desirable; otherwise keep parent modal state stable during child modal flows. In the current Ant Design Modal docs this is the supported prop, while `destroyOnClose` is shown as deprecated.
6. For bulk partial-success flows, keep the modal open briefly with inline feedback, then close and surface the persistent summary in the top-level alert stack.
7. If a successful mutation is followed by a required re-fetch failure, hide stale table data and surface an alert explaining that the update succeeded but the user must refresh the page to see changes.

## Modal state vocabulary

Each modal should explicitly support these states where relevant:

- **closed**
- **opening**
- **ready**
- **validation error**
- **submitting**
- **success-close**
- **submission failure**
- **partial success** (bulk flows only)
- **blocked** (delete or edit disallowed)

## Bulk create classes modal

### Purpose

Create missing `ABClass` records for selected `notCreated` rows.

### Components

- `Modal`
- `Form`
- `Select` for cohort
- `Select` for year group
- `InputNumber` for course length
- `Alert` for validation or bulk-result warnings inside the modal only while it remains open

### Fields

- cohort
- year group
- course length

### States

1. **opening**
   - selected-row count known
   - reference-data options may still be resolving
2. **ready**
   - form enabled
   - cohort options limited to active cohorts
3. **validation error**
   - use `Form.Item` help/status, not a bespoke error renderer
4. **submitting**
   - OK button loading
   - form disabled
   - dispatch one request per selected row in parallel
5. **partial success**
   - continue attempting every selected row even if some fail
   - show inline warning feedback briefly
   - failed rows remain selected after close if those rows still exist
6. **success-close**
   - newly created classes default to `active=true`
   - close modal
   - update top-level summary alert

## Bulk delete classes confirmation modal

### Purpose

Delete active, inactive, or orphaned `ABClass` rows.

### Components

- `Modal.confirm` or standard `Modal`
- `Alert` inside the body only if there is a destructive-operation warning that must not be missed
- optional `List` for selected class names if the selection is small enough to be readable

### Required copy

Must state that the action deletes:

- the full stored `ABClass` record
- the partial stored class-summary/index row

### States

1. **ready**
   - confirmation copy visible
2. **submitting**
   - confirm button loading/disabled
3. **partial success**
   - show inline warning briefly
   - close modal and show summary `Alert` in the tab
4. **submission failure**
   - keep modal open only if the error is actionable in-place; otherwise close and show the alert stack result

## Bulk set active/inactive confirmation modal

### Purpose

Apply a status change to eligible existing rows.

### Components

- `Modal.confirm` for simple confirmation
- optional `Alert` if the current selection contains rows that were filtered out before open

### States

1. **blocked before open**
   - do not open modal if the current selection includes ineligible rows
   - explain via `Tooltip`
2. **ready**
   - confirmation text includes target state and affected count
3. **submitting**
   - confirm button loading
   - dispatch one request per selected row in parallel
4. **partial success**
   - show inline warning briefly
   - close modal and surface summary at tab level

## Bulk set cohort modal

### Purpose

Apply one cohort to multiple eligible existing rows.

### Components

- `Modal`
- `Form`
- `Select`
- `Alert` for blocked or warning copy where needed

### States

1. **ready**
   - active cohorts only in `Select`
2. **validation error**
   - missing selection or stale option
3. **submitting**
   - form disabled, OK button loading
   - dispatch one request per selected row in parallel
4. **partial success**
   - show inline warning briefly
   - same summary pattern as other bulk workflows

## Bulk set year group modal

### Purpose

Apply one year group to multiple eligible existing rows.

### Components

- `Modal`
- `Form`
- `Select`

### States

1. **ready**
   - all selected rows eligible
2. **validation error**
   - missing selection or stale option
3. **submitting**
   - form disabled, OK button loading
   - dispatch one request per selected row in parallel
4. **partial success**
   - show inline warning briefly
   - same summary pattern as other bulk workflows

## Bulk set course length modal

### Purpose

Apply one `courseLength` value to one or more existing `ABClass` rows.

This is the supported edit workflow for `courseLength` in v1, including the single-row case.

### Components

- `Modal`
- `Form`
- `InputNumber`

### States

1. **ready**
   - all selected rows eligible
2. **validation error**
   - missing or invalid integer input
3. **submitting**
   - form disabled, OK button loading
   - dispatch one request per selected row in parallel
4. **partial success**
   - show inline warning briefly
   - same summary pattern as other bulk workflows

## Manage cohorts modal

### Purpose

Provide CRUD management for cohort reference data without leaving the Classes tab.

### Components

- `Modal`
- inner `Table` for cohort records
- `Button` for create
- row action buttons for edit/delete
- `Switch` or status `Badge` for active state visibility
- `Empty` when no cohorts exist
- `Alert` for blocked delete or stale-data warnings

### Recommended columns

- name
- start year
- start month
- active
- actions

### States

1. **opening/list loading**
   - show `Skeleton` or table `loading`
2. **empty**
   - show `Empty` plus a primary create button
3. **ready**
   - render table of cohorts
4. **mutation in progress**
   - disable conflicting row actions
5. **list reload warning**
   - show warning `Alert` inside modal while keeping current rows visible

### Child modal flows

#### Create/Edit cohort modal

Components:

- `Modal`
- `Form`
- `Input` for name
- `InputNumber` or `Select` for start month
- `InputNumber` for start year
- `Switch` for active

States:

- opening
- ready
- validation error
- submitting
- success-close
- submission failure

#### Delete cohort confirmation modal

Components:

- `Modal.confirm` or standard `Modal`
- `Alert` when delete is blocked because the cohort is in use

Behaviour:

- render a disabled delete button when the cohort is blocked
- show explanatory warning state inside the modal
- keep the modal open with inline feedback until the user closes it

States:

- ready
- blocked (in use, disabled destructive action)
- submitting
- success-close
- submission failure

## Manage year groups modal

### Purpose

Provide CRUD management for year-group reference data without leaving the Classes tab.

### Components

- `Modal`
- inner `Table`
- `Button` for create
- row action buttons for edit/delete
- `Empty`
- `Alert` for blocked delete or reload warnings

### Recommended columns

- name
- actions

### States

1. **opening/list loading**
2. **empty**
3. **ready**
4. **mutation in progress**
5. **list reload warning**

### Child modal flows

#### Create/Edit year group modal

Components:

- `Modal`
- `Form`
- `Input` for name

States:

- opening
- ready
- validation error
- submitting
- success-close
- submission failure

#### Delete year group confirmation modal

Components:

- `Modal.confirm` or standard `Modal`
- `Alert` when delete is blocked because the year group is in use

Behaviour:

- render a disabled delete button when the year group is blocked
- show explanatory warning state inside the modal
- keep the modal open with inline feedback until the user closes it

States:

- ready
- blocked (in use, disabled destructive action)
- submitting
- success-close
- submission failure

## Preferred tab-state matrix

| State                            | Visible UI                        | Primary components                                 | Interaction rule                                   |
| -------------------------------- | --------------------------------- | -------------------------------------------------- | -------------------------------------------------- |
| Startup prefetch loading         | summary skeleton + disabled shell | `Skeleton`, disabled `Button`, empty `Card` shells | do not allow bulk actions                          |
| Startup prefetch failure         | blocking error                    | `Alert`                                            | fail fast and block normal interaction             |
| Google Classroom entry load      | table loading                     | `Table.loading`                                    | keep shell stable while tab-entry fetch runs       |
| Google Classroom entry failure   | blocking error                    | `Alert`                                            | hide stale table; do not masquerade as empty state |
| No active classrooms             | empty state                       | `Empty`                                            | keep management launchers visible                  |
| Ready, no selection              | normal table                      | `Table`, `Dropdown`, `Button`                      | bulk trigger disabled                              |
| Ready, with selection            | normal table + selection summary  | `Badge`/text summary                               | enable only eligible actions                       |
| Mutation in progress             | ready state with disabled actions | loading `Button` / `Modal` buttons                 | prevent double-submit                              |
| Mutation summary success         | summary feedback                  | success `Alert`                                    | keep table visible                                 |
| Mutation summary partial failure | warning feedback                  | warning `Alert`                                    | failed rows remain selected                        |
| Mutation success + refresh fail  | mixed success/warning             | warning `Alert`                                    | hide stale table and instruct page refresh         |

## Accessibility and usability requirements

1. Every modal must have a specific title describing the action, not a generic “Manage” label.
2. Disabled bulk actions should expose the reason through `Tooltip` text where practical.
3. Orphaned warnings must not rely on icon-only communication.
4. The first actionable field in each form modal should receive focus on open.
5. Destructive confirmations must name the record count or the specific record where practical.
6. Row selection changes should remain visible after partial failures.
7. Selection should reset on tab re-entry rather than preserving invisible rows.
8. The tab must remain readable without animation when reduced motion is enabled.

## Testing implications

Per `docs/developer/frontend/frontend-testing.md`, every new user-visible interaction here will require Playwright coverage in addition to suitable Vitest coverage.

### Required Vitest coverage by state group

Vitest should cover the invisible behaviour that drives every explicit state in this document:

- alert-stack ordering and mapping for no-alert, blocking failure, warning, and mutation-summary states
- summary-card derivation for loading, ready-with-data, ready-with-zero-values, and blocked suppression states
- toolbar action-eligibility logic for no-selection, mixed-selection, ready, and mutation-in-progress states
- table-column configuration, row-status derivation, selection rules, and empty-state mapping
- table-column sort and filter configuration, plus reset-to-default ordering behaviour
- modal state transitions for opening, ready, validation error, submitting, success-close, submission failure, partial success, and blocked flows
- bulk course-length modal validation and submission behaviour
- selection reset behaviour on delete and tab re-entry
- reference-data management modal list-state mapping for loading, empty, ready, mutation-in-progress, and reload-warning states
- summary and error mapping that keeps failed rows selected after partial-success batch operations

### Required Playwright journeys by visible state group

Playwright should cover the visible browser flows that correspond to those same states:

1. open the Settings page, switch to the Classes tab, and confirm the default ready state
2. observe startup-prefetch failure, Google Classroom entry failure, partial-load warning, and no-active-classrooms empty states
3. verify no-selection, mixed-selection, and ready-with-selection toolbar states, including tooltip-backed disabled actions
4. verify table rendering for active, inactive, `notCreated`, and orphaned rows
5. verify table column sorting and filtering interactions, including clearing controls back to default ordering
6. open and complete Bulk create, Bulk delete, and Bulk set active/inactive flows, including partial-failure feedback where applicable
7. open and complete Bulk set cohort, Bulk set year-group, and Bulk set course-length flows
8. open Manage cohorts and Manage year groups, then exercise create, edit, delete, active-state, and blocked-delete flows
9. verify mutation-summary success and partial-failure alerts persist at tab level after modal close
10. verify a successful mutation followed by failed refresh hides stale table data and instructs the user to refresh the page

### Suggested spec organisation

Keep the frontend suites split by testing responsibility:

- Vitest: feature hook, view-model, table, toolbar, alert-stack, and modal component or helper specs under `src/frontend/src/features/classes/**`
- Playwright: visible Classes-tab journeys split into focused specs such as table, bulk core actions, cohort/year-group metadata actions, management modals, load states, and mutation-summary flows

## Open decisions intentionally left to implementation

1. whether the management modals use inner `Table` components or `List` for very small datasets
2. whether the destructive bulk-confirm flows use standard `Modal` or `Modal.confirm`

These may be refined during implementation, but the overall hierarchy and state model above should remain stable.
