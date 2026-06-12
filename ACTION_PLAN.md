# ACTION_PLAN.md — Frontend Structural Reorganisation

**Source:** `FRONTEND_STRUCTURE_AUDIT.md`
**Branch:** `refactor/GroupDomainsBetter`
**Created:** 2026-06-12
**Completed:** 2026-06-12
**Status:** ✅ All sections complete

---

## Scope

Reorganise `src/frontend/src/` to align with AGENTS.md Sections 2.1 and 12:

- Group flat service files into domain subfolders
- Extract feature logic from `pages/` into `features/`
- Flatten `pages/classes/` subfolder
- Move bulk modals into `features/classes/bulk/`
- Extract cross-cutting reference data management into `features/referenceData/`

**Constraint:** Only paths change. No behavioural code changes. Use CLI tools (`mv`, `mkdir`, `rmdir`) for all file operations; never manually recreate files.

---

## Global Acceptance Criteria

1. `npm run lint:frontend` passes clean
2. `npm run test:frontend` passes (all 91 test files, all tests)
3. No regressions from baseline
4. All imports resolve correctly
5. No behavioural changes

---

## Sections

### Section 1 — Batch 1: Services Domain Grouping

**Objective:** Group all flat service files into domain subfolders per AGENTS.md Section 12.

**Files to move (flat → subfolder):**

| Domain                 | Files                                                                                                                                                                                                  | Target                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `assignmentDefinition` | `assignmentDefinition.zod.ts`, `assignmentDefinitionService.ts`, `assignmentDefinitionPartials.zod.ts`, `assignmentDefinitionPartialsService.ts`, `assignmentDefinitionPartialsContract.guard.spec.ts` | `services/assignmentDefinition/` |
| `assignmentTopics`     | `assignmentTopics.zod.ts`, `assignmentTopicsService.ts`                                                                                                                                                | `services/assignmentDefinition/` |
| `authService`          | `authService.ts`, `authService.zod.ts`                                                                                                                                                                 | `services/authService/`          |
| `backendConfiguration` | `backendConfiguration.zod.ts`, `backendConfigurationService.ts`, `backendConfigurationValidation.ts`                                                                                                   | `services/backendConfiguration/` |
| `googleClassrooms`     | `googleClassrooms.zod.ts`, `googleClassroomsService.ts`                                                                                                                                                | `services/googleClassrooms/`     |
| `classPartials`        | `classPartials.zod.ts`, `classPartialsService.ts`                                                                                                                                                      | `services/googleClassrooms/`     |
| `referenceData`        | `referenceData.zod.ts`, `referenceDataService.ts`                                                                                                                                                      | `services/referenceData/`        |

Move all `.spec.ts` companions alongside their source files.

**Import updates required (non-exhaustive):**

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

Also update all `vi.mock('…services/…')` paths in `.spec.ts`/`.spec.tsx` files.

**Section Checks:**

- `npm run lint:frontend` passes
- `npm run test:frontend` passes (all 91 files)

---

### Section 2 — Batch 2: Pages Cleanup + Classes Internals (parallel)

Four independent sub-tasks operating on disjoint file sets.

#### Section 2A: Extract `features/assignmentWizard/`

**Move files:**

- `pages/AssignmentDefinitionWizardModal.tsx` → `features/assignmentWizard/AssignmentDefinitionWizardModal.tsx`
- `pages/AssignmentDefinitionWizardModal.spec.tsx` → `features/assignmentWizard/AssignmentDefinitionWizardModal.spec.tsx`
- `pages/AssignmentDefinitionWizardModalShell.tsx` → `features/assignmentWizard/AssignmentDefinitionWizardModalShell.tsx`
- `pages/AssignmentDefinitionWizardModalShell.spec.tsx` → `features/assignmentWizard/AssignmentDefinitionWizardModalShell.spec.tsx`
- `pages/useAssignmentDefinitionWizard.ts` → `features/assignmentWizard/useAssignmentDefinitionWizard.ts`
- `pages/useAssignmentDefinitionWizard.spec.ts` → `features/assignmentWizard/useAssignmentDefinitionWizard.spec.ts`

**Update imports in:**

- `pages/AssignmentsPage.tsx` — change `./AssignmentDefinitionWizardModal` → `../features/assignmentWizard/AssignmentDefinitionWizardModal`
- `test/assignmentDefinition/wizardModalTestHelpers.tsx` — change `../../pages/AssignmentDefinitionWizardModal` → `../../features/assignmentWizard/AssignmentDefinitionWizardModal`

#### Section 2B: Flatten `pages/classes/`

**Move files:**

- `pages/classes/classesPageModel.ts` → `pages/classesPageModel.ts`
- `pages/classes/classesPageModel.spec.ts` → `pages/classesPageModel.spec.ts`

**Update imports in:**

- `pages/ClassesPage.tsx` — change `./classes/classesPageModel` → `./classesPageModel`
- `pages/ClassesPage.spec.tsx` — change `./classes/classesPageModel` → `./classesPageModel`
- `classesPageModel.ts` — update `../../services/…` → `../services/…` (one level shallower)

Remove empty `pages/classes/` directory.

#### Section 2C: Move `SettingsPageGoogleClassroomsPrefetch` into `features/settings/`

**Move files:**

- `pages/SettingsPageGoogleClassroomsPrefetch.tsx` → `features/settings/SettingsPageGoogleClassroomsPrefetch.tsx`
- `pages/SettingsPageGoogleClassroomsPrefetch.spec.tsx` → `features/settings/SettingsPageGoogleClassroomsPrefetch.spec.tsx`

**Update imports in:**

- `pages/SettingsPage.tsx` — change `./SettingsPageGoogleClassroomsPrefetch` → `../features/settings/SettingsPageGoogleClassroomsPrefetch`

**Update logging context strings** in moved file: `'pages/SettingsPageGoogleClassroomsPrefetch…'` → `'features/settings/SettingsPageGoogleClassroomsPrefetch…'`

#### Section 2D: Move bulk modals into `features/classes/bulk/` + integration spec

**Move bulk modal files from `features/classes/components/` → `features/classes/bulk/`:**

- `BulkCreateModal.tsx`, `BulkCreateModal.spec.tsx`
- `BulkDeleteModal.tsx`, `bulkDelete.spec.tsx`
- `BulkFormModalScaffold.tsx`
- `BulkSetSelectModal.tsx`, `BulkSetSelectModal.spec.tsx`
- `BulkSetCourseLengthModal.tsx`, `BulkSetCourseLengthModal.spec.tsx`

**Move integration spec:**

- `features/classes/components/SelectWithAddNew.integration.spec.tsx` → `components/SelectWithAddNew.integration.spec.tsx`

**Update imports in:**

- `features/classes/ClassesManagementPanel.tsx` — update bulk modal imports
- Any other files importing moved bulk modals

**Section Checks:**

- `npm run lint:frontend` passes
- `npm run test:frontend` passes (all files)

---

### Section 3 — Batch 3: Reference Data Extraction

**Objective:** Extract `features/referenceData/` from `classes/management/` + `settings/`.

**Create `features/referenceData/` and move files:**

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

- `features/classes/ClassesManagementPanel.tsx` — update reference data modal imports
- `features/classes/hooks/useReferenceDataManagement.ts` — update imports
- `features/settings/ManageTopicsModal.tsx` — update helper imports
- `features/assignmentWizard/AssignmentDefinitionWizardModal.tsx` — update modal imports
- `pages/SettingsPage.tsx` — update panel import

**Section Checks:**

- `npm run lint:frontend` passes
- `npm run test:frontend` passes (all files)

---

## Implementation Order

1. **Batch 1** — Services Domain Grouping (1 agent)
2. **Batch 2** — Pages Cleanup + Classes Internals (4 agents, parallel after Batch 1)
3. **Batch 3** — Reference Data Extraction (1 agent, sequential after Batch 2)

---

## Completion Summary

| Batch   | Commit    | Description                                                       | Status |
| ------- | --------- | ----------------------------------------------------------------- | ------ |
| 1       | `205150c` | Services domain grouping — 36 files into 5 subfolders             | ✅     |
| 2       | `d1a75ee` | Pages cleanup + classes internals (4 parallel agents)             | ✅     |
| 3       | `6d8f16d` | Reference data extraction — 16 files into features/referenceData/ | ✅     |
| Cleanup | `74ae3f1` | De-sloppification fixes + docs updates                            | ✅     |

**Final state:**

- `npm run lint:frontend` — clean (0 errors, 0 warnings)
- `npm run test:frontend` — 91/91 test files pass, 894 tests
- No behavioural changes — only file paths and import paths updated
- All AGENTS.md Section 12 and 2.1 mandates satisfied

**Known deferred items (de-sloppification findings, not in original scope):**

- C1: 3 files (`InlineDialog.tsx`, `ReferenceDataInitialLoadingState.tsx`, `useReferenceDataManagement.ts`) remain in `features/classes/` but are exclusively consumed from `features/referenceData/`. Moving them would complete the extraction but was not in the audit scope.

---

## Relevant Documentation

- `FRONTEND_STRUCTURE_AUDIT.md` — full audit and target hierarchy
- `src/frontend/AGENTS.md` — Section 12 (service domain grouping), Section 2.1 (pages as thin composition roots), Section 2.3 (feature directory layout)
