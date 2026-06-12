# Frontend Structure Audit Report

**Date:** 2026-06-12
**Branch:** `feat/AssignmentWizardHappyPath`
**Scope:** `src/frontend/src/`

---

## 1. Summary

The frontend source tree has accumulated structural drift across several dimensions.
The most critical issues are:

- **Services domain grouping** is prescribed by `AGENTS.md` Section 12 but not applied to most domains.
- **Pages vs. features boundary** is violated: feature logic lives in `pages/` and pages are not thin composition roots.
- **Inconsistent subfolder conventions** in `pages/classes/` and `features/classes/bulk/` vs `features/classes/components/`.
- **Reference data management** is split across two feature folders and will be extracted into `features/referenceData/`.

This report diagnoses each problem and proposes a target folder hierarchy.

---

## 2. Current State (Annotated)

```
src/
├── App.tsx                        ✅ thin composition root (good)
├── AppShell.tsx                   ✅ shell (good)
├── AppThemeShell.tsx              ✅ shell theme (good)
├── StrictMode.tsx                 ✅ (good)
├── main.tsx                       ✅ entry point (good)
├── index.css                      ✅ (good)
│
├── components/
│   └── SelectWithAddNew.tsx       ⚠️ only shared component; mostly classes-specific
│
├── errors/                        ✅ shared error contracts (good)
│   ├── apiTransportError.ts
│   ├── blockingLoadError.ts
│   ├── map-error-to-ui.ts
│   └── normaliseUnknownError.ts
│
├── hooks/                         ✅ shared hooks (good)
│   ├── useDebounce.ts
│   └── usePageDataset.ts
│
├── logging/                       ✅ shared logger (good)
│   └── frontendLogger.ts
│
├── navigation/                    ✅ shell navigation (good)
│   └── appNavigation.tsx
│
├── query/                         ✅ shared query layer (good)
│   ├── AppQueryProvider.tsx
│   ├── queryClient.ts
│   ├── queryInvalidationHelpers.ts
│   ├── queryKeys.ts
│   └── sharedQueries.ts
│
├── services/                      🔴 Section 12 grouping not applied
│   ├── apiService.ts              ✅ (single file, no domain prefix)
│   ├── apiService.spec.ts
│   │
│   ├── assignmentAssessment/      ✅ properly grouped
│   │   ├── assignmentAssessmentService.ts
│   │   └── assignmentAssessment.zod.ts
│   │
│   ├── googleClassrooms/          ⚠️ partially grouped — 4 files inside, 4 still flat
│   │   ├── googleClassroomAssignmentsService.ts
│   │   ├── googleClassroomAssignments.zod.ts
│   │   ├── googleClassroomAssignmentsService.spec.ts
│   │   └── googleClassroomAssignments.zod.spec.ts
│   │
│   ├── assignmentDefinition.zod.ts           🔴 flat
│   ├── assignmentDefinitionService.ts        🔴 flat
│   ├── assignmentDefinitionPartials.zod.ts   🔴 flat
│   ├── assignmentDefinitionPartialsService.ts🔴 flat
│   ├── assignmentDefinitionPartialsContract.guard.spec.ts 🔴 flat
│   ├── assignmentTopics.zod.ts              🔴 flat
│   ├── assignmentTopicsService.ts           🔴 flat
│   ├── authService.ts                       🔴 flat
│   ├── authService.zod.ts                   🔴 flat
│   ├── backendConfiguration.zod.ts          🔴 flat
│   ├── backendConfigurationService.ts       🔴 flat
│   ├── backendConfigurationValidation.ts    🔴 flat
│   ├── classPartials.zod.ts                 🔴 flat (belongs in googleClassrooms/)
│   ├── classPartialsService.ts              🔴 flat (belongs in googleClassrooms/)
│   ├── googleClassrooms.zod.ts              🔴 flat (belongs in googleClassrooms/)
│   ├── googleClassroomsService.ts           🔴 flat (belongs in googleClassrooms/)
│   ├── referenceData.zod.ts                 🔴 flat
│   └── referenceDataService.ts              🔴 flat
│
├── features/
│   ├── auth/                      ✅ clean, cohesive
│   │   ├── AppAuthGate.tsx
│   │   ├── AuthStatusCard.tsx
│   │   ├── startupWarmupState.ts
│   │   └── useAuthorisationStatus.ts
│   │
│   ├── classes/                   ⚠️ well-organised internally but deep
│   │   ├── AssessTaskModal/
│   │   ├── bulk/                  ⚠️ flow files here, modals in components/
│   │   ├── components/            ⚠️ bulk modals here, flow files in bulk/
│   │   ├── hooks/
│   │   ├── management/            ⚠️ reference data modals here (overlaps with settings)
│   │   ├── table/
│   │   ├── ClassesManagementPanel.tsx
│   │   ├── classesManagementViewModel.ts
│   │   └── useClassesManagement.ts
│   │
│   └── settings/                  ⚠️ reference data here too (ManageTopicsModal)
│       ├── backend/
│       │   ├── BackendSettingsPanel.tsx
│       │   ├── backendSettingsForm.zod.ts
│       │   ├── backendSettingsFormMapper.ts
│       │   └── useBackendSettings.ts
│       ├── ManageTopicsModal.tsx          ⚠️ reference data concern
│       └── ReferenceDataSettingsPanel.tsx
│
├── pages/                         🔴 contains feature logic, not thin composition
│   ├── AssignmentDefinitionWizardModal.tsx      🔴 feature component in pages/
│   ├── AssignmentDefinitionWizardModalShell.tsx  🔴 feature component in pages/
│   ├── useAssignmentDefinitionWizard.ts         🔴 feature hook in pages/
│   ├── AssignmentsPage.tsx                      ⚠️ has inline mutation/filter logic
│   ├── ClassesPage.tsx                          ⚠️ has inline model-building logic
│   ├── SettingsPage.tsx                         ✅ thin tab composition (good)
│   ├── SettingsPageGoogleClassroomsPrefetch.tsx ⚠️ prefetch component in pages/
│   ├── DashboardPage.tsx                        ✅ thin (good)
│   ├── PageSection.tsx                          ✅ shared page chrome (good)
│   ├── pageContent.ts                           ✅ shared labels (good)
│   └── classes/                                 🔴 single-file subfolder
│       └── classesPageModel.ts                  🔴 model separated from page
│
├── test/                          ✅ shared test helpers (good)
│   ├── renderWithFrontendProviders.tsx
│   ├── googleScriptRunHarness.ts
│   ├── assignmentDefinition/
│   ├── classes/
│   └── shared/
```

---

## 3. Issues by Severity

### 🔴 Critical: Services domain grouping (AGENTS.md Section 12)

The AGENTS.md explicitly requires files sharing a common domain prefix to be grouped
into subfolders. The example in AGENTS.md shows the desired structure, but the actual
filesystem does not match.

**Affected domains (files to move):**

| Domain prefix          | Files                                                                                                                                                                                                                                   | Target folder                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `assignmentDefinition` | `assignmentDefinition.zod.ts`, `assignmentDefinitionService.ts`, `assignmentDefinitionPartials.zod.ts`, `assignmentDefinitionPartialsService.ts`, `assignmentDefinitionPartialsContract.guard.spec.ts` (plus all `.spec.ts` companions) | `services/assignmentDefinition/`               |
| `assignmentTopics`     | `assignmentTopics.zod.ts`, `assignmentTopicsService.ts` (plus specs)                                                                                                                                                                    | `services/assignmentDefinition/` (same domain) |
| `authService`          | `authService.ts`, `authService.zod.ts` (plus specs)                                                                                                                                                                                     | `services/authService/`                        |
| `backendConfiguration` | `backendConfiguration.zod.ts`, `backendConfigurationService.ts`, `backendConfigurationValidation.ts` (plus specs)                                                                                                                       | `services/backendConfiguration/`               |
| `googleClassrooms`     | `googleClassrooms.zod.ts`, `googleClassroomsService.ts` (plus specs)                                                                                                                                                                    | `services/googleClassrooms/`                   |
| `classPartials`        | `classPartials.zod.ts`, `classPartialsService.ts` (plus specs)                                                                                                                                                                          | `services/googleClassrooms/`                   |
| `referenceData`        | `referenceData.zod.ts`, `referenceDataService.ts` (plus specs)                                                                                                                                                                          | `services/referenceData/`                      |

**Impact:** Low risk, mechanical. Every `import` path in `src/frontend/src/` that references
these files must be updated.

---

### 🔴 Critical: Feature logic in `pages/` (AGENTS.md Section 2.1)

The AGENTS.md mandates that `pages/` contain thin composition roots, not feature state
machines. The following files should move to `features/`:

| Current location                                 | Should be                    |
| ------------------------------------------------ | ---------------------------- |
| `pages/AssignmentDefinitionWizardModal.tsx`      | `features/assignmentWizard/` |
| `pages/AssignmentDefinitionWizardModalShell.tsx` | `features/assignmentWizard/` |
| `pages/useAssignmentDefinitionWizard.ts`         | `features/assignmentWizard/` |

The wizard is a self-contained feature with its own hook, modal, and shell. It does not
belong in the pages folder.

Additionally, `pages/SettingsPageGoogleClassroomsPrefetch.tsx` is settings-specific
prefetch logic and belongs in `features/settings/`.

---

### 🟠 High: `pages/classes/` — single-file subfolder with inconsistent nesting

`pages/classes/classesPageModel.ts` is the only file in `pages/classes/`. The page that
consumes it (`ClassesPage.tsx`) lives in the parent `pages/` directory. This pattern
exists nowhere else in the tree.

**Options:**

- **Flatten:** Move `classesPageModel.ts` to `pages/classesPageModel.ts` and remove the
  `pages/classes/` folder.
- **Complete:** Move `ClassesPage.tsx` (and its spec) into `pages/classes/`, making it a
  proper page subfolder with model + component co-located.

Recommendation: **Flatten** — the model is small and tightly coupled to one page.

---

### 🟡 Medium: `features/classes/` — bulk modals split from flow files

Bulk mutation flow files live in `features/classes/bulk/` (e.g. `bulkCreateFlow.ts`,
`bulkSetCohortFlow.ts`) but their corresponding modal components live in
`features/classes/components/` (e.g. `BulkCreateModal.tsx`, `BulkSetSelectModal.tsx`).

These are tightly coupled pairs and should be co-located.

**Recommendation:** Move bulk modal components into `features/classes/bulk/` alongside
their flow files, or document the current split as intentional if there's a rationale.

---

### 🟡 Medium: Reference data management is split across two feature folders

Reference data objects (year groups, cohorts, topics) are managed from:

- `features/settings/ManageTopicsModal.tsx`
- `features/settings/ReferenceDataSettingsPanel.tsx`
- `features/classes/management/ManageYearGroupsModal.tsx`
- `features/classes/management/ManageCohortsModal.tsx`
- `features/classes/management/manageReferenceDataDialogs.tsx`
- `features/classes/management/manageReferenceDataHelpers.ts`

These are conceptually one domain ("Reference Data Management") but spread across
`features/settings/` and `features/classes/management/`.

**Options:**

- **Extract:** Create `features/referenceData/` housing all reference-data modals and
  helpers. Both `ClassesManagementPanel` and `SettingsPage` would import from it.
- ~~Accept: Keep the current split and document that reference data modals are
  co-located with their primary consumer (classes management).~~

**Decision: Extract.** The modals are called from multiple places in the interface
(`SettingsPage` and `ClassesManagementPanel`), so they are genuinely cross-cutting.
A dedicated `features/referenceData/` folder eliminates the settings/classes coupling
and gives reference data management a clear home.

---

### 🟡 Medium: No `features/assignments/` folder

The assignments domain has no `features/assignments/` folder even though `features/auth/`,
`features/classes/`, and `features/settings/` all exist. Assignment-related logic is
fragmented across `pages/AssignmentsPage.tsx` (which has inline table, mutation, and
filter logic) and the wizard files currently in `pages/`.

Once the wizard moves to `features/assignmentWizard/`, consider extracting non-trivial
logic from `AssignmentsPage.tsx` into feature hooks or components.

---

### 🟢 Minor: `SelectWithAddNew.integration.spec.tsx` in wrong location

`features/classes/components/SelectWithAddNew.integration.spec.tsx` tests the shared
`components/SelectWithAddNew.tsx` component. It should be co-located with the component
it tests in `components/`.

---

## 4. Proposed Target Hierarchy

```
src/
├── App.tsx
├── App.spec.tsx
├── AppShell.tsx
├── AppThemeShell.tsx
├── AppThemeShell.spec.tsx
├── StrictMode.tsx
├── main.tsx
├── main.spec.tsx
├── index.css
├── index.css.spec.ts
│
├── components/                          # shared UI components
│   ├── SelectWithAddNew.tsx
│   └── SelectWithAddNew.spec.tsx
│
├── errors/                              # shared error contracts
│   ├── apiTransportError.ts
│   ├── blockingLoadError.ts
│   ├── map-error-to-ui.ts
│   ├── map-error-to-ui.spec.ts
│   ├── normaliseUnknownError.ts
│   └── normaliseUnknownError.spec.ts
│
├── hooks/                               # shared hooks
│   ├── useDebounce.ts
│   ├── useDebounce.spec.ts
│   ├── usePageDataset.ts
│   └── usePageDataset.spec.ts
│
├── logging/                             # shared logger
│   ├── frontendLogger.ts
│   └── frontendLogger.spec.ts
│
├── navigation/                          # shell navigation
│   ├── appNavigation.tsx
│   └── appNavigation.spec.tsx
│
├── query/                               # shared React Query layer
│   ├── AppQueryProvider.tsx
│   ├── queryClient.ts
│   ├── queryInvalidationHelpers.ts
│   ├── queryInvalidationHelpers.spec.ts
│   ├── queryKeys.ts
│   ├── sharedQueries.ts
│   ├── sharedQueries.query.spec.tsx
│   ├── sharedQueries.startupWarmupQueryKey.spec.ts
│   ├── sharedQueries.startupWarmupQueryOptions.spec.ts
│   ├── assignmentDefinitionWizard.query.spec.ts
│   ├── reactQueryFoundation.query.spec.tsx
│   └── queryClient.spec.ts
│
├── services/                            # API transport and validation
│   ├── apiService.ts
│   ├── apiService.spec.ts
│   │
│   ├── assignmentAssessment/            # ✅ already grouped
│   │   ├── assignmentAssessmentService.ts
│   │   ├── assignmentAssessmentService.spec.ts
│   │   ├── assignmentAssessment.zod.ts
│   │   └── assignmentAssessment.zod.spec.ts
│   │
│   ├── assignmentDefinition/            # 🔧 new group
│   │   ├── assignmentDefinitionService.ts
│   │   ├── assignmentDefinitionService.spec.ts
│   │   ├── assignmentDefinition.zod.ts
│   │   ├── assignmentDefinition.zod.spec.ts
│   │   ├── assignmentDefinitionPartialsService.ts
│   │   ├── assignmentDefinitionPartialsService.spec.ts
│   │   ├── assignmentDefinitionPartials.zod.ts
│   │   ├── assignmentDefinitionPartials.zod.spec.ts
│   │   ├── assignmentDefinitionPartialsContract.guard.spec.ts
│   │   ├── assignmentTopicsService.ts
│   │   ├── assignmentTopicsService.spec.ts
│   │   ├── assignmentTopics.zod.ts
│   │   └── assignmentTopics.zod.spec.ts
│   │
│   ├── authService/                     # 🔧 new group
│   │   ├── authService.ts
│   │   ├── authService.spec.ts
│   │   └── authService.zod.ts
│   │
│   ├── backendConfiguration/            # 🔧 new group
│   │   ├── backendConfigurationService.ts
│   │   ├── backendConfigurationService.spec.ts
│   │   ├── backendConfiguration.zod.ts
│   │   └── backendConfigurationValidation.ts
│   │
│   ├── googleClassrooms/                # 🔧 complete group
│   │   ├── googleClassroomsService.ts
│   │   ├── googleClassroomsService.spec.ts
│   │   ├── googleClassrooms.zod.ts
│   │   ├── googleClassrooms.zod.spec.ts
│   │   ├── googleClassroomAssignmentsService.ts
│   │   ├── googleClassroomAssignmentsService.spec.ts
│   │   ├── googleClassroomAssignments.zod.ts
│   │   ├── googleClassroomAssignments.zod.spec.ts
│   │   ├── classPartialsService.ts
│   │   ├── classPartialsService.spec.ts
│   │   ├── classPartials.zod.ts
│   │   └── classPartials.zod.spec.ts
│   │
│   └── referenceData/                   # 🔧 new group
│       ├── referenceDataService.ts
│       ├── referenceDataService.spec.ts
│       ├── referenceData.zod.ts
│       └── referenceData.zod.spec.ts
│
├── features/
│   ├── auth/                            # ✅ clean (no changes needed)
│   │   ├── AppAuthGate.tsx
│   │   ├── AppAuthGate.auth.spec.tsx
│   │   ├── AuthStatusCard.tsx
│   │   ├── AuthStatusCard.spec.tsx
│   │   ├── startupWarmupState.ts
│   │   ├── startupWarmupState.spec.tsx
│   │   ├── useAuthorisationStatus.ts
│   │   └── useAuthorisationStatus.spec.tsx
│   │
│   ├── assignmentWizard/                # 🆕 extracted from pages/
│   │   ├── AssignmentDefinitionWizardModal.tsx
│   │   ├── AssignmentDefinitionWizardModal.spec.tsx
│   │   ├── AssignmentDefinitionWizardModalShell.tsx
│   │   ├── AssignmentDefinitionWizardModalShell.spec.tsx
│   │   ├── useAssignmentDefinitionWizard.ts
│   │   └── useAssignmentDefinitionWizard.spec.ts
│   │
│   ├── classes/                         # ⚠️ bulk modals moved into bulk/
│   │   ├── AssessTaskModal/
│   │   │   ├── AssessTaskModal.tsx
│   │   │   ├── AssessTaskModal.spec.tsx
│   │   │   ├── matchDefinitionForAssignment.ts
│   │   │   └── matchDefinitionForAssignment.spec.ts
│   │   ├── bulk/
│   │   │   ├── BatchMutationEngine.spec.ts
│   │   │   ├── batchMutationEngine.ts
│   │   │   ├── bulkActiveState.spec.tsx
│   │   │   ├── bulkActiveStateFlow.ts
│   │   │   ├── BulkCreateModal.tsx          # 🆕 moved from components/
│   │   │   ├── bulkCreate.spec.tsx          # 🆕 moved from components/
│   │   │   ├── bulkCreateFlow.ts
│   │   │   ├── BulkDeleteModal.tsx          # 🆕 moved from components/
│   │   │   ├── bulkDelete.spec.tsx          # 🆕 moved from components/
│   │   │   ├── BulkFormModalScaffold.tsx     # 🆕 moved from components/
│   │   │   ├── bulkEditValidation.zod.ts
│   │   │   ├── bulkMetadataUpdateFlow.ts
│   │   │   ├── bulkMutationOrchestration.spec.ts
│   │   │   ├── bulkMutationOrchestration.ts
│   │   │   ├── BulkSetCohortModal (or BulkSetSelectModal).tsx  # 🆕 from components/
│   │   │   ├── bulkSetCohort.spec.tsx       # 🆕 from components/
│   │   │   ├── bulkSetCohortFlow.ts
│   │   │   ├── BulkSetCourseLengthModal.tsx  # 🆕 from components/
│   │   │   ├── bulkSetCourseLength.spec.tsx  # 🆕 from components/
│   │   │   ├── bulkSetCourseLengthFlow.ts
│   │   │   ├── bulkSetYearGroupFlow.ts
│   │   │   ├── mutationSummary.spec.tsx
│   │   │   ├── queryInvalidation.spec.ts
│   │   │   ├── queryInvalidation.ts
│   │   │   ├── queryInvalidation.zod.ts
│   │   │   ├── selectionState.spec.ts
│   │   │   └── selectionState.ts
│   │   ├── components/
│   │   │   ├── ClassesAlertStack.tsx
│   │   │   ├── ClassesAlertStack.spec.tsx
│   │   │   ├── ClassesEmptyStates.tsx
│   │   │   ├── ClassesEmptyStates.spec.tsx
│   │   │   ├── ClassesSummaryCard.tsx
│   │   │   ├── ClassesSummaryCard.spec.tsx
│   │   │   ├── InlineDialog.tsx
│   │   │   └── ReferenceDataInitialLoadingState.tsx
│   │   ├── hooks/
│   │   │   └── useReferenceDataManagement.ts
│   │   ├── management/                    # 🆕 moving to features/referenceData/
│   │   │   ├── ManageCohortsModal.tsx
│   │   │   ├── ManageYearGroupsModal.tsx
│   │   │   ├── ReferenceDataManagementModalScaffold.tsx
│   │   │   ├── ReferenceDataManagementModalScaffold.spec.tsx
│   │   │   ├── manageCohortDelete.spec.tsx
│   │   │   ├── manageCohorts.spec.tsx
│   │   │   ├── manageReferenceDataDialogs.spec.tsx
│   │   │   ├── manageReferenceDataDialogs.tsx
│   │   │   ├── manageReferenceDataHelpers.ts
│   │   │   ├── manageYearGroupDelete.spec.tsx
│   │   │   ├── manageYearGroups.spec.tsx
│   │   │   └── refetchFailureState.spec.tsx
│   │   ├── table/
│   │   │   ├── ClassesTable.tsx
│   │   │   ├── ClassesTable.spec.tsx
│   │   │   ├── ClassesTable.helpers.ts
│   │   │   ├── ClassesTable.helpers.spec.ts
│   │   │   ├── ClassesTable.sorting.ts
│   │   │   ├── ClassesTableColumns.tsx
│   │   │   ├── ClassesTableColumns.spec.tsx
│   │   │   ├── ClassesToolbar.tsx
│   │   │   └── ClassesToolbar.spec.tsx
│   │   ├── ClassesManagementPanel.tsx
│   │   ├── ClassesManagementPanel.spec.tsx
│   │   ├── ClassesManagementPanel.bulkMetadataFailure.spec.tsx
│   │   ├── classesManagementViewModel.ts
│   │   ├── classesManagementViewModel.spec.ts
│   │   ├── useClassesManagement.ts
│   │   └── useClassesManagement.spec.ts
│   │
│   ├── referenceData/                    # 🆕 extracted from classes/management + settings/
│   │   ├── ManageTopicsModal.tsx
│   │   ├── ManageTopicsModal.spec.tsx
│   │   ├── ReferenceDataSettingsPanel.tsx
│   │   ├── ReferenceDataSettingsPanel.spec.tsx
│   │   ├── ManageCohortsModal.tsx        # moved from classes/management/
│   │   ├── ManageYearGroupsModal.tsx      # moved from classes/management/
│   │   ├── ReferenceDataManagementModalScaffold.tsx    # moved from classes/management/
│   │   ├── manageReferenceDataDialogs.tsx              # moved from classes/management/
│   │   └── manageReferenceDataHelpers.ts               # moved from classes/management/
│   │
│   └── settings/
│       ├── backend/
│       │   ├── BackendSettingsPanel.tsx
│       │   ├── BackendSettingsPanel.spec.tsx
│       │   ├── backendSettingsForm.zod.ts
│       │   ├── backendSettingsForm.zod.spec.ts
│       │   ├── backendSettingsFormMapper.ts
│       │   ├── backendSettingsFormMapper.spec.ts
│       │   ├── useBackendSettings.ts
│       │   └── useBackendSettings.spec.ts
│       ├── SettingsPageGoogleClassroomsPrefetch.tsx     # 🆕 moved from pages/
│       └── SettingsPageGoogleClassroomsPrefetch.spec.tsx
│
├── pages/                               # thin composition roots only
│   ├── PageSection.tsx                  # shared page chrome
│   ├── PageSection.spec.tsx
│   ├── pageContent.ts                   # shared labels
│   ├── pages.spec.tsx
│   ├── DashboardPage.tsx
│   ├── AssignmentsPage.tsx              # thin after wizard extraction
│   ├── AssignmentsPage.spec.tsx
│   ├── ClassesPage.tsx
│   ├── ClassesPage.spec.tsx
│   ├── classesPageModel.ts              # 🔧 flattened from pages/classes/
│   ├── classesPageModel.spec.ts
│   ├── SettingsPage.tsx
│   └── SettingsPage.spec.tsx
│
└── test/                                # shared test utilities (no changes)
    ├── appStylesRaw.ts
    ├── googleScriptRunHarness.ts
    ├── google-script-run-harness-factory.d.ts
    ├── google-script-run-harness-factory.js
    ├── renderWithFrontendProviders.tsx
    ├── setup.ts
    ├── assignmentDefinition/
    │   ├── assignmentDefinitionTestFixtures.ts
    │   ├── assignmentsPageTestHelpers.tsx
    │   ├── sharedTestFixtures.ts
    │   ├── wizardModalTestHelpers.tsx
    │   └── wizardTestHelpers.tsx
    ├── classes/
    │   ├── AssessTaskModal.test-utilities.tsx
    │   ├── classesPageTestHelpers.tsx
    │   ├── classesTestHelpers.ts
    │   └── modalTestHelpers.tsx
    └── shared/
        ├── sharedQueriesTestHelpers.ts
        └── testDeferredPromise.ts
```

---

## 5. Implementation Order (Reference)

| Step | Task                                                                       | Risk   | Effort |
| ---- | -------------------------------------------------------------------------- | ------ | ------ |
| 1    | Group flat services into domain subfolders (Section 12)                    | Low    | Medium |
| 2    | Extract `features/assignmentWizard/` from `pages/`                         | Low    | Small  |
| 3    | Flatten `pages/classes/classesPageModel.ts` to `pages/classesPageModel.ts` | Low    | Tiny   |
| 4    | Move `SettingsPageGoogleClassroomsPrefetch.tsx` into `features/settings/`  | Low    | Tiny   |
| 5    | Move bulk modals into `features/classes/bulk/`                             | Low    | Small  |
| 6    | Move `SelectWithAddNew.integration.spec.tsx` to `components/`              | Low    | Tiny   |
| 7    | Extract `features/referenceData/` from `classes/management/` + `settings/` | Medium | Medium |

---

## 6. Batched Work Plan for Parallel Subagent Execution

This section defines discrete work batches designed so that subagents can operate
in parallel without editing the same files. Batches are strictly sequential; within
a batch, all agents run in parallel against disjoint file sets.

### Conflict Analysis

The primary constraint is file-level isolation: no two agents may edit the same file
in the same batch. The analysis below traces every edit.

**Step 1** edits `query/sharedQueries.ts`, the universal import hub that fans out
to every feature. It also edits every file that imports from the moved services
(pages, features, hooks, specs). No other step can share a batch with Step 1.

**Steps 2, 3, and 4** each edit a different page file (`AssignmentsPage.tsx`,
`ClassesPage.tsx`, `SettingsPage.tsx`) and move files between disjoint directories.
They can run in parallel.

**Steps 5+6** edit `features/classes/ClassesManagementPanel.tsx` (bulk modal
import paths) and touch `features/classes/components/`. They do not touch any
page file or the `features/settings/` directory. They can run in parallel with
Steps 2, 3, and 4.

**Step 7** edits `features/classes/ClassesManagementPanel.tsx` (reference-data
modal import paths), `features/assignmentWizard/AssignmentDefinitionWizardModal.tsx`
(created by Step 2), and `pages/SettingsPage.tsx` (also edited by Step 4).
It **cannot** run in parallel with Steps 4, 5, or 6.

**Conclusion:** Steps 5+6 can be promoted into Batch 2 (with Steps 2, 3, 4).
Step 7 must be its own sequential batch after Batch 2 completes.

---

### Batch 1 — Services Domain Grouping (1 agent, sequential)

**Agent 1A: Group all flat service files into domain subfolders.**

| Domain                 | Files to move                                                                                                                                                                                          | Target                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `assignmentDefinition` | `assignmentDefinition.zod.ts`, `assignmentDefinitionService.ts`, `assignmentDefinitionPartials.zod.ts`, `assignmentDefinitionPartialsService.ts`, `assignmentDefinitionPartialsContract.guard.spec.ts` | `services/assignmentDefinition/` |
| `assignmentTopics`     | `assignmentTopics.zod.ts`, `assignmentTopicsService.ts`                                                                                                                                                | `services/assignmentDefinition/` |
| `authService`          | `authService.ts`, `authService.zod.ts`                                                                                                                                                                 | `services/authService/`          |
| `backendConfiguration` | `backendConfiguration.zod.ts`, `backendConfigurationService.ts`, `backendConfigurationValidation.ts`                                                                                                   | `services/backendConfiguration/` |
| `googleClassrooms`     | `googleClassrooms.zod.ts`, `googleClassroomsService.ts`                                                                                                                                                | `services/googleClassrooms/`     |
| `classPartials`        | `classPartials.zod.ts`, `classPartialsService.ts`                                                                                                                                                      | `services/googleClassrooms/`     |
| `referenceData`        | `referenceData.zod.ts`, `referenceDataService.ts`                                                                                                                                                      | `services/referenceData/`        |

Move all `.spec.ts` companions alongside their source files.

**Import updates required (production files, non-exhaustive):**

| File                                     | Old import                                        | New import                                                             |
| ---------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| `query/sharedQueries.ts`                 | `../services/assignmentDefinitionService`         | `../services/assignmentDefinition/assignmentDefinitionService`         |
| `query/sharedQueries.ts`                 | `../services/assignmentDefinitionPartialsService` | `../services/assignmentDefinition/assignmentDefinitionPartialsService` |
| `query/sharedQueries.ts`                 | `../services/assignmentTopicsService`             | `../services/assignmentDefinition/assignmentTopicsService`             |
| `query/sharedQueries.ts`                 | `../services/authService`                         | `../services/authService/authService`                                  |
| `query/sharedQueries.ts`                 | `../services/backendConfigurationService`         | `../services/backendConfiguration/backendConfigurationService`         |
| `query/sharedQueries.ts`                 | `../services/classPartialsService`                | `../services/googleClassrooms/classPartialsService`                    |
| `query/sharedQueries.ts`                 | `../services/googleClassroomsService`             | `../services/googleClassrooms/googleClassroomsService`                 |
| `query/sharedQueries.ts`                 | `../services/referenceDataService`                | `../services/referenceData/referenceDataService`                       |
| `query/sharedQueries.ts`                 | `../services/referenceData.zod`                   | `../services/referenceData/referenceData.zod`                          |
| `pages/useAssignmentDefinitionWizard.ts` | `../services/assignmentDefinitionService`         | `../services/assignmentDefinition/assignmentDefinitionService`         |
| `pages/AssignmentsPage.tsx`              | `../services/assignmentDefinitionPartialsService` | `../services/assignmentDefinition/assignmentDefinitionPartialsService` |
| `pages/ClassesPage.tsx`                  | `../services/classPartials.zod`                   | `../services/googleClassrooms/classPartials.zod`                       |
| `pages/ClassesPage.tsx`                  | `../services/referenceData.zod`                   | `../services/referenceData/referenceData.zod`                          |
| `pages/classes/classesPageModel.ts`      | `../../services/classPartials.zod`                | `../../services/googleClassrooms/classPartials.zod`                    |
| `pages/classes/classesPageModel.ts`      | `../../services/referenceData.zod`                | `../../services/referenceData/referenceData.zod`                       |

Also update every `vi.mock('…services/…')` path in all `.spec.ts` and `.spec.tsx` files
that reference the moved service modules. Use project-wide find-and-replace for
consistency, then verify with `npm run lint:frontend && npm run test:frontend`.

**Files touched by this agent (no other agent touches these):**
`services/*` (all moved files), `query/sharedQueries.ts`, `pages/useAssignmentDefinitionWizard.ts`,
`pages/AssignmentsPage.tsx`, `pages/ClassesPage.tsx`, `pages/classes/classesPageModel.ts`,
and all `.spec.*` files with `vi.mock` paths to the moved services.

---

### Batch 2 — Pages Cleanup + Classes Internals (4 agents, parallel)

All four agents operate on **disjoint file sets** and can run simultaneously after
Batch 1 completes.

#### Agent 2A: Extract `features/assignmentWizard/` (Step 2)

**Move these files:**

- `pages/AssignmentDefinitionWizardModal.tsx` → `features/assignmentWizard/AssignmentDefinitionWizardModal.tsx`
- `pages/AssignmentDefinitionWizardModal.spec.tsx` → `features/assignmentWizard/AssignmentDefinitionWizardModal.spec.tsx`
- `pages/AssignmentDefinitionWizardModalShell.tsx` → `features/assignmentWizard/AssignmentDefinitionWizardModalShell.tsx`
- `pages/AssignmentDefinitionWizardModalShell.spec.tsx` → `features/assignmentWizard/AssignmentDefinitionWizardModalShell.spec.tsx`
- `pages/useAssignmentDefinitionWizard.ts` → `features/assignmentWizard/useAssignmentDefinitionWizard.ts`
- `pages/useAssignmentDefinitionWizard.spec.ts` → `features/assignmentWizard/useAssignmentDefinitionWizard.spec.ts`

**Update imports in:**

- `pages/AssignmentsPage.tsx` — change `./AssignmentDefinitionWizardModal` → `../features/assignmentWizard/AssignmentDefinitionWizardModal`
- `test/assignmentDefinition/wizardModalTestHelpers.tsx` — change `../../pages/AssignmentDefinitionWizardModal` → `../../features/assignmentWizard/AssignmentDefinitionWizardModal`

**Update internal imports within the moved files** (they go from `./` siblings to `./` siblings, so most stay the same; verify).

#### Agent 2B: Flatten `pages/classes/` (Step 3)

**Move these files:**

- `pages/classes/classesPageModel.ts` → `pages/classesPageModel.ts`
- `pages/classes/classesPageModel.spec.ts` → `pages/classesPageModel.spec.ts`

**Update imports in:**

- `pages/ClassesPage.tsx` — change `./classes/classesPageModel` → `./classesPageModel`
- `pages/ClassesPage.spec.tsx` — change `./classes/classesPageModel` → `./classesPageModel`

**Update internal imports in the moved file:**

- `classesPageModel.ts` — change `../../services/…` → `../services/…` (one directory level shallower)

Remove the now-empty `pages/classes/` directory.

#### Agent 2C: Move `SettingsPageGoogleClassroomsPrefetch` into `features/settings/` (Step 4)

**Move these files:**

- `pages/SettingsPageGoogleClassroomsPrefetch.tsx` → `features/settings/SettingsPageGoogleClassroomsPrefetch.tsx`
- `pages/SettingsPageGoogleClassroomsPrefetch.spec.tsx` → `features/settings/SettingsPageGoogleClassroomsPrefetch.spec.tsx`

**Update imports in:**

- `pages/SettingsPage.tsx` — change `./SettingsPageGoogleClassroomsPrefetch` → `../features/settings/SettingsPageGoogleClassroomsPrefetch`

**Update internal logging context strings** in the moved file:

- Change `'pages/SettingsPageGoogleClassroomsPrefetch…'` → `'features/settings/SettingsPageGoogleClassroomsPrefetch…'`

#### Agent 2D: Move bulk modals into `features/classes/bulk/` + move integration spec (Steps 5+6)

**Move bulk modal files from `features/classes/components/` to `features/classes/bulk/`:**

- `BulkCreateModal.tsx`, `BulkCreateModal.spec.tsx`
- `BulkDeleteModal.tsx`, `bulkDelete.spec.tsx`
- `BulkFormModalScaffold.tsx`
- `BulkSetSelectModal.tsx`, `BulkSetSelectModal.spec.tsx`
- `BulkSetCourseLengthModal.tsx`, `BulkSetCourseLengthModal.spec.tsx`

**Move integration spec:**

- `features/classes/components/SelectWithAddNew.integration.spec.tsx` → `components/SelectWithAddNew.integration.spec.tsx`

**Update imports in:**

- `features/classes/ClassesManagementPanel.tsx` — change `./components/BulkCreateModal` → `./bulk/BulkCreateModal`, etc.
- `features/classes/components/SelectWithAddNew.integration.spec.tsx` — update `./BulkCreateModal` → `../features/classes/bulk/BulkCreateModal` (after move to `components/`)
- Any other files within `features/classes/` that import the moved bulk modals

**Files touched by Agent 2D:** `features/classes/components/` (bulk files only), `features/classes/bulk/`, `components/`, `features/classes/ClassesManagementPanel.tsx`.

**Files touched by the other agents (for cross-check):**

- 2A: `pages/AssignmentDefinitionWizard*`, `pages/useAssignmentDefinitionWizard*`, `pages/AssignmentsPage.tsx`, `test/assignmentDefinition/wizardModalTestHelpers.tsx`
- 2B: `pages/classes/*`, `pages/ClassesPage.tsx`, `pages/ClassesPage.spec.tsx`
- 2C: `pages/SettingsPageGoogleClassroomsPrefetch*`, `pages/SettingsPage.tsx`

✅ **No file overlaps between any pair of agents in Batch 2.**

---

### Batch 3 — Reference Data Extraction (1 agent, sequential after Batch 2)

**Agent 3A: Extract `features/referenceData/` (Step 7)**

This agent must run **after Batch 2** because it edits `pages/SettingsPage.tsx`
(also edited by Agent 2C) and `features/classes/ClassesManagementPanel.tsx`
(also edited by Agent 2D), and because it edits `features/assignmentWizard/…`
(created by Agent 2A).

**Create `features/referenceData/` and move these files into it:**

From `features/settings/`:

- `ManageTopicsModal.tsx`, `ManageTopicsModal.spec.tsx`
- `ReferenceDataSettingsPanel.tsx`, `ReferenceDataSettingsPanel.spec.tsx`

From `features/classes/management/`:

- `ManageCohortsModal.tsx`
- `ManageYearGroupsModal.tsx`
- `ReferenceDataManagementModalScaffold.tsx`, `ReferenceDataManagementModalScaffold.spec.tsx`
- `manageReferenceDataDialogs.tsx`, `manageReferenceDataDialogs.spec.tsx`
- `manageReferenceDataHelpers.ts`
- `manageCohortDelete.spec.tsx`, `manageCohorts.spec.tsx`
- `manageYearGroupDelete.spec.tsx`, `manageYearGroups.spec.tsx`
- `refetchFailureState.spec.tsx`

**Update imports in consumers:**

| File                                                            | Change                                                                                                     |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `features/classes/ClassesManagementPanel.tsx`                   | `./management/ManageCohortsModal` → `../referenceData/ManageCohortsModal`                                  |
| `features/classes/ClassesManagementPanel.tsx`                   | `./management/ManageYearGroupsModal` → `../referenceData/ManageYearGroupsModal`                            |
| `features/classes/hooks/useReferenceDataManagement.ts`          | `../management/manageReferenceDataDialogs` → `../../referenceData/manageReferenceDataDialogs`              |
| `features/classes/hooks/useReferenceDataManagement.ts`          | `../management/manageReferenceDataHelpers` → `../../referenceData/manageReferenceDataHelpers`              |
| `features/settings/ManageTopicsModal.tsx`                       | `../classes/management/manageReferenceDataHelpers` → `../referenceData/manageReferenceDataHelpers`         |
| `features/assignmentWizard/AssignmentDefinitionWizardModal.tsx` | `../features/settings/ManageTopicsModal` → `../referenceData/ManageTopicsModal`                            |
| `features/assignmentWizard/AssignmentDefinitionWizardModal.tsx` | `../features/classes/management/ManageYearGroupsModal` → `../referenceData/ManageYearGroupsModal`          |
| `pages/SettingsPage.tsx`                                        | `../features/settings/ReferenceDataSettingsPanel` → `../features/referenceData/ReferenceDataSettingsPanel` |

Also update all corresponding `vi.mock()` paths in spec files.

Remove the now-redundant files from `features/classes/management/` (the directory
may still contain other files — verify before deleting the directory itself).

---

## 7. Principles Reaffirmed

This reorganisation aligns with the following AGENTS.md mandates:

- **Section 2.1** — Pages are thin composition roots; feature state machines live in `features/`.
- **Section 12** — Service files with a common domain prefix are grouped into subfolders.
- **Section 2.2** — Async orchestration and side effects belong in feature hooks, not page components.
- **Core Principle 6** — Reuse existing modules before creating new abstractions.
- **Core Principle 11** — Keep changes minimal, localised, and consistent with existing patterns.
- **Core Principle 11** — Keep changes minimal, localised, and consistent with existing patterns.
