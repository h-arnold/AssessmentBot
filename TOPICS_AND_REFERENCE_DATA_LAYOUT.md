# Topics CRUD Modal and Reference Data Dropdown 'Add New' Layout Specification

## Purpose

This document defines the explicit layout, component hierarchy, workflow surfaces, and user-visible states for the Topics CRUD modal and the 'Add new' option in reference data Select dropdowns.

Use it alongside:

- `SPEC.md` for domain rules, contracts, and scope boundaries
- `ACTION_PLAN.md` for implementation sequencing
- `docs/developer/frontend/frontend-modal-patterns.md` for modal family guidance
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md` for navigation standards

This document is intentionally UI-focused. It does not replace the underlying feature spec, backend contracts, or implementation plan.

## Scope of this document

This document covers:

1. The Manage Topics modal hierarchy and visible regions
2. The Settings page tab addition for Reference Data management
3. The Select dropdown enhancement with 'Add new' option
4. The preferred UI components for each region
5. The user-visible states of the main surfaces
6. Responsive, accessibility, and motion expectations where they affect layout behaviour

This document does **not** redefine:

- Backend contracts already settled in `SPEC.md`
- Rollout or sequencing decisions already settled in `ACTION_PLAN.md`
- Shared frontend policies already defined in canonical developer docs

## Design principles

1. Keep the owning page or composition layer thin.
2. Preserve the existing Settings page tab navigation model.
3. Reuse the existing ReferenceDataManagementModalScaffold for the Topics modal to maintain consistency with Cohorts and Year Groups.
4. Use native Select option behaviour for 'Add new' actions to preserve keyboard and focus semantics.
5. Keep important status, error, and selection state visible without forcing the user into a secondary workflow.
6. Keep responsibilities clear between composition, state orchestration, and presentational regions.

## Ant Design references consulted

- [Tabs](https://ant.design/components/tabs) - for Settings page tab structure
- [Card](https://ant.design/components/card) - for panel container
- [Modal](https://ant.design/components/modal) - for CRUD modal shell
- [Select](https://ant.design/components/select) - for dropdown option structure and keyboard behaviour
- [Table](https://ant.design/components/table) - for entity listing
- [Form](https://ant.design/components/form) - for create/edit forms
- [Button](https://ant.design/components/button) - for action triggers
- [Space](https://ant.design/components/space) - for action grouping
- [Flex](https://ant.design/components/flex) - for layout arrangement
- [Alert](https://ant.design/components/alert) - for error/warning states
- [Skeleton](https://ant.design/components/skeleton) - for loading states
- [Empty](https://ant.design/components/empty) - for empty states

## Surface hierarchy

```text
Settings Page (/settings route)
└── Tabs
    ├── Classes (existing)
    ├── Backend settings (existing)
    └── Reference Data (NEW)
        └── Card (settings-tab-panel)
            └── ReferenceDataSettingsPanel (NEW)
                ├── Section: Topics
                │   └── Manage Topics button
                └── [Future: Cohorts, Year Groups sections]

ManageTopicsModal (triggered from Reference Data section)
└── ReferenceDataManagementModalScaffold
    ├── Modal header: "Manage Topics"
    ├── Modal body
    │   ├── Status/refresh message
    │   ├── Create button: "Create topic"
    │   ├── Inline alert (when present)
    │   └── Table
    │       ├── Column: Name
    │       └── Column: Actions (Edit, Delete)
    └── Modal footer
        └── Cancel button

Select dropdowns with 'Add new' option (in existing pages)
└── Ant Design Select with sentinel "Add new {entityType}" option
    ├── Existing options (from options prop)
    └── "Add new {entityType}" option
```

State explicitly: The Manage Topics modal is accessible from Settings and from topic-selection contexts via "Add new topic". The Classes Management Panel remains out of scope as a direct entry point.

## No extra navigation layers

The Settings page should avoid nested tabs within the Reference Data tab. The Reference Data tab contains a flat panel with sections for each entity type.

Rationale:

- Maintains clarity of the navigation model
- Keeps entity management at a consistent depth
- Matches the existing flat structure of other Settings tabs

## Outer layout

## Recommended page skeleton

The Settings page Tabs component remains the top-level container. The new Reference Data tab follows the same pattern as existing tabs.

```text
Settings Page
└── Tabs (app-tabbed-page)
    └── Tab: Reference Data
        └── ReferenceDataSettingsPanel
            └── Card (settings-tab-panel)
                ├── Card body: Reference data entity sections
                └── Each section: heading + description + manage button
```

## Recommended top-level UI components

### 1. Settings Page Tabs

Use `Tabs` for:

- Top-level navigation between Settings sections
- Adding the new Reference Data tab

Reason:

- Matches existing Settings page pattern
- Provides clear tab-based navigation
- Works well with the existing PageSection wrapper

### 2. ReferenceDataSettingsPanel Card

Use `Card` with className `settings-tab-panel` for:

- Container for all reference data management content
- Consistent styling with BackendSettingsPanel

Reason:

- Matches existing Settings page tab panel pattern
- Provides consistent visual container
- Works with existing CSS

### 3. Section layout within ReferenceDataSettingsPanel

Use `Flex` vertical for:

- Stacking entity sections (Topics, future: Cohorts, Year Groups)
- Maintaining consistent spacing between sections

Reason:

- Flex provides predictable vertical stacking
- Easy to add new sections in the future
- Consistent with other list layouts in the app

### 4. Entity section components

For each entity type section (e.g., Topics):

- `Typography.Title` level 3 for section heading
- `Typography.Text` type secondary for description
- `Button` type primary for "Manage Topics" action

## Region-by-region design

## 1. Settings Page - Reference Data Tab

### Components

- `Tabs.TabPane` for the Reference Data tab
- `Card` with className `settings-tab-panel`
- `ReferenceDataSettingsPanel` component

### Content

List what belongs in this region:

- Card containing entity management sections
- Currently: Topics section only
- Future: Cohorts and Year Groups sections

### States

1. **Ready**
   - Reference Data tab visible in tab bar
   - Card renders with all entity sections
   - Manage Topics button enabled

2. **Tab not active**
   - On first visit: tab content is lazy-rendered when activated
   - After first visit: content remains mounted across tab switches

### Notes

- Tab key: `reference-data`
- Tab label: "Reference Data"
- Tab order: after "Backend settings" (last tab)
- The `SettingsPage.tsx` type `SettingsTabKey` must be extended to include `'reference-data'` alongside existing `'classes' | 'backend-settings'`

## 2. ReferenceDataSettingsPanel - Topics Section

### Components

- `Flex` vertical for section layout
- `Typography.Title` level 3: "Topics"
- `Typography.Text` type secondary: "Manage assignment topics"
- `Button` type primary: "Manage Topics"

### Recommended structure

```text
Topics Section
├── Title: "Topics"
├── Description: "Manage assignment topics"
└── Button: "Manage Topics" (opens ManageTopicsModal)
```

### States

1. **Ready**
   - All components visible and interactive
   - Button click opens ManageTopicsModal

2. **Modal open**
   - Button remains enabled
   - Modal appears over the page

### Notes

- Section should be horizontally aligned (space-between or similar)
- Button width should match other action buttons in Settings

## 3. ManageTopicsModal

### Surface type

- `Modal` via `ReferenceDataManagementModalScaffold`

### Trigger

- Button click in ReferenceDataSettingsPanel Topics section
- **NOT** from Classes Management Panel

### Components

- `ReferenceDataManagementModalScaffold<AssignmentTopic>`
- `Table<AssignmentTopic>`
- `Button` with `PlusOutlined` icon for create
- `InlineDialog` for form and delete (rendered via scaffold slots)

### Layout structure

```text
ManageTopicsModal
├── Modal header
│   └── Title: "Manage Topics"
├── Modal body (Flex vertical gap=12)
│   ├── Status message (when refreshing)
│   ├── Create button: "Create topic" with PlusOutlined icon
│   ├── Inline alert (when present)
│   └── Table
│       ├── Column: Name (dataIndex: 'name')
│       └── Column: Actions
│           ├── Button: "Edit"
│           └── Button: "Delete" (danger)
└── Modal footer
    └── Button: "Cancel"
```

### States

1. **Closed**
   - Modal not visible

2. **Open and initial loading**
   - Skeleton loader visible in body
   - Create button hidden
   - Table hidden
   - Footer Cancel button enabled

3. **Open and ready with data**
   - Status message hidden
   - Create button visible and enabled
   - Table visible with data
   - Footer Cancel button enabled
   - Inline dialog hidden

4. **Open and ready with no data**
   - Status message hidden
   - Create button visible and enabled
   - Table visible with empty text: "No topics"
   - Footer Cancel button enabled

5. **Open and refreshing**
   - Status message visible: "Refreshing topics..."
   - Create button visible but may be disabled during refresh
   - Table visible with current data
   - Footer Cancel button enabled

6. **Open with blocking failure**
   - Alert visible with error message
   - Create button hidden
   - Table hidden
   - Footer Cancel button enabled

7. **Open with inline form dialog**
   - Modal body partially obscured by inline dialog
   - Create button disabled
   - Table visible but interactions may be limited
   - Footer Cancel button enabled

8. **Open with inline delete dialog**
   - Modal body partially obscured by inline dialog
   - Create button disabled
   - Table visible but interactions may be limited
   - Footer Cancel button enabled

### Notes

- Modal width: 700px (matches ManageYearGroupsModal, accommodates year group multi-select with same field complexity)
- Modal className: `manage-topics-modal`
- Table aria-label: "topics"
- Empty table copy: "No topics"
- Refresh status copy: "Refreshing topics..."
- Load failure copy: "Unable to load topics right now."
- Form validation message: "Please enter a topic name."
- Delete dialog title: "Delete topic"
- **Year group selection**: The create/edit form includes a multi-select for year groups, allowing a topic to be associated with multiple year groups

## 4. Select Dropdowns with 'Add new' Option

### Components

- Ant Design `Select` with sentinel option value for add-new action

### Recommended structure

```text
Select with options
├── Option 1 (from options prop)
├── Option 2 (from options prop)
├── ...
└── Option: "Add new {entityType}" (sentinel, triggers onAddNew)
```

### States

1. **Normal (ready)**
   - All options visible
   - 'Add new' option visible at bottom
   - All options interactive

2. **Disabled**
   - All options disabled
   - 'Add new' option disabled
   - Visual state shows disabled styling

3. **Loading (options loading)**
   - Select shows loading indicator
   - 'Add new' option may still be visible but disabled

4. **Open dropdown**
   - All options visible in popup
   - 'Add new' sentinel option appears at the bottom
   - Keyboard navigation works through all options including 'Add new'

5. **No existing options**
   - Only 'Add new' sentinel option visible
   - Select placeholder still shown when closed

### Notes

- Entity type labels:
  - For cohort selects: "Add new cohort"
  - For year group selects: "Add new year group"
  - For topic selects: "Add new topic"
- The `addNewLabel` prop should be provided explicitly for each entity type
- The 'Add new' option must be a real Select option item (sentinel value), not injected custom popup content
- **Icon**: Use Ant Design `PlusOutlined` icon alongside the 'Add new' text
- The 'Add new' option should have proper ARIA role and be keyboard accessible
- **Disabled state**: The 'Add new' option MUST be disabled when the Select component is disabled, matching Ant Design's native behavior

### Affected Select instances

The following existing Select components need the 'Add new' enhancement:

1. **BulkCreateModal.tsx**
   - Cohort Select: label "Cohort", add "Add new cohort", opens ManageCohortsModal
   - Year Group Select: label "Year group", add "Add new year group", opens ManageYearGroupsModal

2. **BulkSetSelectModal.tsx**
   - Generic Select: entity type passed as prop or derived from fieldLabel
   - For cohort: "Add new cohort", opens ManageCohortsModal
   - For year group: "Add new year group", opens ManageYearGroupsModal

3. **AssignmentDefinitionWizardModalShell.tsx**
   - Topic Select: label "Select topic", add "Add new topic", opens ManageTopicsModal
   - Year Group Select: label "Select year group", add "Add new year group", opens ManageYearGroupsModal

## Data-heavy regions

### ManageTopicsModal Table

#### Recommended components

- Ant Design `Table`
- Ant Design `Button` for row actions
- Ant Design `Space` for action grouping

#### Core features to use

- `rowKey="key"` for stable row identity
- `pagination={false}` (matches existing modals)
- `locale={{ emptyText: 'No topics' }}`
- `aria-label="topics"`

#### Recommended columns

1. **Name**
   - `title: 'Name'`
   - `dataIndex: 'name'`
   - `key: 'name'`
   - No custom render needed

2. **Year Groups**
   - `title: 'Year Groups'`
   - `dataIndex: 'yearGroupKeys'`
   - `key: 'yearGroupKeys'`
   - `render`: (keys) => Comma-separated list of year group names (requires lookup from yearGroups query)

3. **Actions**
   - `title: 'Actions'`
   - `key: 'actions'`
   - `render`: (value, record) => Edit and Delete buttons in Space

#### States

1. **Initial load in progress**
   - Skeleton or loading state in body (handled by scaffold)

2. **Ready with data**
   - Table shows all topics sorted alphabetically

3. **Ready with no data**
   - Table shows empty text
   - Create button still visible

4. **Partial-load warning**
   - Not applicable (full dataset always loaded)

5. **Blocking failure**
   - Alert shown, table hidden

#### Notes

- No sorting controls needed (backend returns sorted data)
- No pagination needed (assumed small dataset)
- Row actions: Edit triggers inline form, Delete triggers inline delete confirmation

## Workflow surfaces

### ManageTopicsModal Workflow

#### Surface type

- Modal (outer) with inline dialogs (inner)

#### Trigger

- Click "Manage Topics" button in ReferenceDataSettingsPanel

#### Components

- ReferenceDataManagementModalScaffold
- ReferenceDataFormDialog (inline, for create/edit)
- ReferenceDataDeleteDialog (inline, for delete)

#### Layout structure

```text
ManageTopicsModal
├── Outer Modal (Scaffold)
│   ├── Header: "Manage Topics"
│   ├── Body: Table + Create button + Status
│   └── Footer: Cancel button
└── Inline Dialog (when active)
    ├── Form (create/edit) OR Confirmation (delete)
    └── Actions: Cancel + Submit/Delete
```

#### States

1. **Closed**
   - Modal not visible
   - All state reset

2. **Open and ready**
   - Table visible with data
   - Create button enabled

3. **Submitting (form or delete)**
   - Inline dialog shows loading state on primary action
   - Form fields disabled during submission
   - Cancel button still enabled

4. **Validation failure (form)**
   - Error alert visible above form
   - Form fields remain populated
   - User can retry

5. **Completed (create/edit/delete)**
   - Modal remains open
   - Table refreshes
   - Inline dialog closes
   - Success state not explicitly shown (matches existing pattern)

#### Notes

- Modal hierarchy: outer Modal is the only portal; inline dialogs are rendered in the body
- Destructive action copy: "Delete topic" with confirmation
- Focus return: not applicable (inline dialogs, not nested modals)
- **Form fields**: The create/edit form includes:
  - Name (required text input)
  - Year Groups (multi-select with all available year groups, optional but recommended)

### 'Add new' from Select Workflow

#### Surface type

- Popover (Ant Design Select dropdown)

#### Trigger

- Select is clicked and dropdown opens
- User navigates to 'Add new' option

#### Components

- Ant Design Select dropdown popup
- Sentinel Select option at bottom

#### Layout structure

```text
Select Dropdown
├── Existing options (scrollable)
└── Add new sentinel option (last option)
```

#### States

1. **Closed**
   - Select shows selected value or placeholder
   - 'Add new' not visible

2. **Open and ready**
   - All options visible
   - 'Add new' at bottom
   - All options keyboard-navigable

3. **'Add new' clicked**
   - Dropdown closes
   - Corresponding modal opens
   - Select value unchanged

4. **After creation**
   - Modal closes
   - Select options refresh
   - Newly created entity automatically selected

#### Notes

- Modal hierarchy: new modal opens over the page, Select dropdown closes
- Focus management: modal gets focus when opened
- The 'Add new' option should not close the dropdown on hover, only on click

## Global state rules

### Blocking error state

- **ManageTopicsModal**: Shows Ant Design Alert at top of body, hides table and create button
- **Required data contract**: both topics query and yearGroups query are blocking-required for ready-body rendering
- **Select with 'Add new'**: If options fail to load, Select shows its built-in error/empty state; 'Add new' may still be visible if not dependent on options data

### Partial-load state

- **ManageTopicsModal**: Follows fail-closed behaviour; if topics or yearGroups required data fails/loads incompletely, blocking alert is shown and ready-body content is hidden
- **Select**: Maintains existing options, 'Add new' still functional

### Empty state

- **ManageTopicsModal with no topics**: Table shows "No topics", create button visible and enabled (only after both required datasets are ready)
- **Select with no existing options**: Shows placeholder when closed, 'Add new' option visible when open

### Success and mutation feedback

- **ManageTopicsModal**: No explicit success message; table refreshes to show changes
- **Select 'Add new' flow**: No explicit success message; new option appears in list and is selected

## Responsive behaviour

- **ManageTopicsModal**: Modal width fixed at 700px, scrolls internally on small screens
- **Select dropdowns**: Standard Ant Design responsive behaviour
- **ReferenceDataSettingsPanel**: Flex vertical layout wraps naturally on narrow screens
- **Stacking**: On narrow widths, entity sections in ReferenceDataSettingsPanel stack vertically

## Accessibility and motion

- **Focus management**:
  - 'Add new' sentinel option in Select is keyboard accessible via native arrow-key option navigation
  - Modal opening must trap focus correctly
  - Modal closing must return focus to trigger element (if still mounted)

- **Keyboard interaction**:
  - 'Add new' option must be selectable with Enter/Space
  - Tab navigation must work through all interactive elements
  - Select dropdown must close with Escape

- **Tooltip-only information**: 'Add new' option label is sufficient; no additional tooltip needed

- **Reduced-motion rule**: Follow existing Ant Design patterns; no custom animations

- **Screen-reader labelling**:
  - 'Add new' option must have clear accessible name (e.g., "Add new topic")
  - Modal must have proper aria-label or aria-labelledby
  - Table must have proper column headers

## Implementation guardrails

- Do not introduce alternative entry points for ManageTopicsModal unless the core spec explicitly requires them
- Do not duplicate domain rules here that belong in `SPEC.md`
- Do not add bespoke layout abstractions when existing Ant Design primitives are sufficient
- Do not hide important error, warning, or destructive-operation outcomes inside transient surfaces only
- Keep layout decisions aligned with existing frontend shell and navigation guidance
- The 'Add new' option must not be a separate Select component; it must integrate with existing Select instances
- **Component location**: `SelectWithAddNew` will be placed in `src/frontend/src/components/` as it is a cross-feature reusable wrapper per the shared helpers abstraction standards ("Feature-scoped helpers should stay feature-scoped unless there is proven cross-feature reuse")
- **Modal width rationale**: ManageTopicsModal width is 700px, matching ManageYearGroupsModal, as topics have name field plus year group multi-select. Cohorts have additional fields (active, startYear, startMonth) which is why ManageCohortsModal uses 800px, while ManageYearGroupsModal and ManageTopicsModal use 700px as they have comparable field complexity.

## Open questions

1. Should there be a visual indicator (icon) alongside the 'Add new' text in the dropdown? (e.g., PlusOutlined)
2. Should any non-default icon styling be applied beyond standard `PlusOutlined` + label text?

**Resolved**: The 'Add new' option MUST be disabled when the Select component is disabled, matching Ant Design's native behavior.
