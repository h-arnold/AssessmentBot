# SLOP_REVIEW

## Scope

- `src/frontend/src/pages/**` and the page-layer helpers they call
- `src/frontend/src/features/classes/ClassesManagementPanel.tsx` and its immediate helper graph
- `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx` and `useBackendSettings.ts`

## Summary

**Needs Improvement** — the frontend is still small enough to clean up cheaply, but there are already a few clear “AI completion” patterns: duplicated orchestration, single-use abstraction layers, and helper extraction that hides repetition instead of removing it.

## 🔴 Critical

### 1. `AssignmentsPage` duplicates the same filter plumbing in three different forms

- **Location:** `src/frontend/src/pages/AssignmentsPage.tsx:179-204`, `357-384`, `594-717`
- **Evidence:** `getNextFilters(...)` is a five-way switch that only copies one property; there are five near-identical `handleSelect...Filter` callbacks; each filterable column repeats the same `filterDropdown`, `filterIcon`, `filteredValue`, and `onHeaderCell` wiring; and `createFilterIconRenderer(...)` / `createFilterDropdownRenderer(...)` are thin closure factories that only exist to support that repetition.
- **Why it matters:** every new filter or label change touches multiple synced sections in an already large file.
- **Recommended simplification:** use one typed filter setter and one small column-filter config array, then derive the repeated table props from that config.

### 2. Navigation/page routing is encoded twice in production and again in tests

- **Location:** `src/frontend/src/navigation/appNavigation.tsx:13-26`, `98-115`; `src/frontend/src/AppShell.tsx:170-185`; `src/frontend/src/navigation/appNavigation.spec.tsx:22-50`
- **Evidence:** `pageRendererMap` already maps keys to pages, `AppShell.renderSelectedPage(...)` switches over the same keys again, and `pageRenderers` is wrapped in a `Proxy` purely to throw on invalid property access even though runtime navigation already narrows through `AppNavigationKey` and `isAppNavigationKey(...)`.
- **Why it matters:** this is extra machinery around a three-page app, and it sets a precedent for preserving defensive layers because tests cover them rather than because the runtime needs them.
- **Recommended simplification:** keep either a plain map or a plain switch, not both. Remove the `Proxy` and keep the fail-fast check at the actual input boundary.

### 3. `SettingsPage` is over-abstracted for two fixed tabs

- **Location:** `src/frontend/src/pages/SettingsPage.tsx:16-60`, `71-100`; `src/frontend/src/pages/TabbedPageSection.tsx:1-42`
- **Evidence:** two static tabs flow through `settingsTabDefinitions` -> `getSettingsTabChild(...)` -> `getSettingsTabs(...)` -> `TabbedPageSection`, but `TabbedPageSection` has one production caller.
- **Why it matters:** the extra file and helper chain increase scan cost without reducing real duplication.
- **Recommended simplification:** inline the tab item construction in `SettingsPage` and keep only the real special-case behaviour: remounting the Classes tab when leaving it.

### 4. `ClassesManagementPanel` duplicates the bulk-action pattern across the panel and the flow helpers

- **Location:** `src/frontend/src/features/classes/ClassesManagementPanel.tsx:137-383`, `561-730`; `src/frontend/src/features/classes/bulkSetCohortFlow.ts:13-51`; `src/frontend/src/features/classes/bulkSetYearGroupFlow.ts:13-49`; `src/frontend/src/features/classes/bulkSetCourseLengthFlow.ts:15-54`; `src/frontend/src/features/classes/bulkActiveStateFlow.ts:21-31`; `src/frontend/src/features/classes/bulkCreateFlow.ts:30-57`
- **Evidence:** `buildTopLevelBulkMutationResolution(...)` and `buildMetadataBulkMutationResolution(...)` share the same first-half logic; the five `createBulk...FailureMessage(...)` helpers are template clones with changed verbs; the seven action handlers all repeat the same orchestration skeleton; and the three `bulkSet*Flow.ts` files repeat the same “filter active/inactive rows -> validate one value -> run `updateABClass` batch” structure.
- **Why it matters:** the next bulk action will almost certainly be implemented by copying an existing block, which is exactly the precedent to avoid while the codebase is still small.
- **Recommended simplification:** keep `runBulkMutationOrchestration(...)`, but drive action-specific copy and mutate behaviour from a small descriptor object; introduce one shared “editable existing rows” filter helper; and collapse the three metadata update flows into one generic helper if no second materially different caller appears.

### 5. `ClassesManagementPanel` hides a single component behind a giant one-caller render helper

- **Location:** `src/frontend/src/features/classes/ClassesManagementPanel.tsx:733-949`
- **Evidence:** `renderClassesManagementPanelContent(...)` is called exactly once and receives a very large prop bag containing booleans, derived values, handlers, modal state, submit state, options, and the entire hook state.
- **Why it matters:** this is not reuse; it is one component split into two filescope functions with a large hand-off surface.
- **Recommended simplification:** inline the render helper back into `ClassesManagementPanel`, then extract only real subcomponents if they own a coherent slice such as “bulk feedback”, “workflow chrome”, or “modal stack”.

### 6. `BackendSettingsPanel` repeats field wiring and also stores validation errors twice

- **Location:** `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx:159-218`, `287-382`, `431-636`
- **Evidence:** each validated field repeats the same `help={...}`, `validateStatus={...}`, and `rules={[{ validator: ... }]}` shape; `handleFinish(...)` and `handleFinishFailed(...)` both flatten issues into `{ fieldName, message }` tuples; and `setBackendSettingsFieldErrors(...)` / `clearBackendSettingsFieldErrors(...)` write both Ant Design form meta and a separate `Map<fieldName, message>` state.
- **Why it matters:** every validation rule or field addition has to stay in sync across repeated field markup and duplicated error bookkeeping.
- **Recommended simplification:** collapse the repeated field markup behind a small schema-aware field descriptor or `SchemaValidatedFormItem` helper, and choose one validation-error source of truth instead of mirroring the same errors into a separate `Map`.

## 🟡 Improvement

### 1. `ClassesManagementPanel` and `ClassesToolbar` both derive the same selected-row subset

- **Location:** `src/frontend/src/features/classes/ClassesManagementPanel.tsx:486-488`; `src/frontend/src/features/classes/ClassesToolbar.tsx:146-153`
- **Evidence:** the parent computes `selectedRows`, then `ClassesToolbar` recomputes the same subset from `rows` and `selectedRowKeys`.
- **Why it matters:** duplicated derivation is a small maintenance smell and makes it less obvious where selection semantics live.
- **Recommended simplification:** pass `selectedRows` into `ClassesToolbar` directly.

### 2. The classes bulk modals are already drifting into copy-paste modal shells

- **Location:** `src/frontend/src/features/classes/BulkSetSelectModal.tsx:30-113`; `src/frontend/src/features/classes/BulkCreateModal.tsx:36-178`
- **Evidence:** both components repeat the same modal-form shell: local `submissionError`, `handleCancel`, `handleOk`, async `handleFinish`, `destroyOnHidden`, disabled cancel button, and inline error `Alert`.
- **Why it matters:** this is exactly the stage where either a shared modal-form shell should emerge or the duplication should be consciously kept local.
- **Recommended simplification:** if another modal of this shape appears, extract the common modal submit shell; otherwise keep the current pair but avoid further copy-paste growth.

### 3. `pageExpectations` duplicates the real page copy source of truth

- **Location:** `src/frontend/src/test/pageExpectations.ts:3-34`; `src/frontend/src/pages/pageContent.ts:5-19`
- **Evidence:** headings and summaries are hard-coded in both places, then `dashboardPageSummaryText` derives from the duplicate table instead of the production source.
- **Why it matters:** copy changes require manual sync.
- **Recommended simplification:** import `pageContent` in tests where strict test-data independence is not needed.

## ⚪ Nitpick

### 1. There are still generated-comment and pass-through traces in the page layer

- **Location:** `src/frontend/src/pages/DashboardPage.tsx:5-10`; `src/frontend/src/pages/PageSection.tsx:6-11`; `src/frontend/src/pages/AssignmentsPage.tsx:756-823`
- **Evidence:** duplicate doc blocks remain in `DashboardPage` and `PageSection`, and `handleConfirmDeleteClick()` is a pure pass-through wrapper around `handleConfirmDelete()`.
- **Why it matters:** the files are noisier than they need to be.
- **Recommended simplification:** delete duplicate comments and inline trivial wrappers unless JSX genuinely needs them.

### 2. Some classes helper files still read like generated scaffolding rather than hand-shaped modules

- **Location:** `src/frontend/src/features/classes/bulkCreateFlow.ts:1-57`; `src/frontend/src/features/classes/BulkDeleteModal.tsx:1-63`
- **Evidence:** both files carry comment volume and tone that exceed the complexity of the code they contain.
- **Why it matters:** this is low-risk noise now, but it tends to normalise over-commented glue code as the codebase grows.
- **Recommended simplification:** trim comments to the non-obvious behaviour only.

## Helpers worth keeping as precedent

1. `src/frontend/src/features/classes/queryInvalidation.ts` + `bulkMutationOrchestration.ts` — they own a real cross-action contract and remove meaningful duplication.
2. `src/frontend/src/features/classes/ClassesTable.helpers.ts` + `ClassesTableColumns.tsx` — this is a better precedent for table filter/sort reuse than the ad hoc filter code in `AssignmentsPage`.
3. `src/frontend/src/features/classes/manageReferenceDataDialogs.tsx` — real shared markup extracted from two modal workflows.
4. `src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts` + `backendSettingsFormMapper.ts` — schema-first form contracts and API/form mapping are useful, stable boundaries.

The pattern to avoid standardising is **single-use wrapper extraction**: helpers that add another name and another file but do not actually remove duplication or own a reusable contract.

## Completion
