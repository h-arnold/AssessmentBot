# Large Code Files Report

Files with ≥550 lines across the codebase, grouped by module.
Generated 2026-06-03 by `find | xargs wc -l` excluding `node_modules/`, `dist/`, `.vite/`.

---

## `src/frontend/src/pages/` — Page Components & Page Tests

| File                                       | Lines | Suggested Split                                                                                                                                                      |
| ------------------------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ClassesPage.spec.tsx`                     | 1,261 | → shared setup file (~200), `loading-states.spec.tsx` (~240), `collapse-behaviour.spec.tsx` (~180), `card-rendering.spec.tsx` (~250), `refresh-a11y.spec.tsx` (~180) |
| `useAssignmentDefinitionWizard.ts`         | 1,257 | → `useAssignmentDefinitionWizard.types.ts` (~80), `.helpers.ts` (~350), `.formInit.ts` (~250), `useAssignmentDefinitionWizard.ts` (reduced ~550)                     |
| `AssignmentDefinitionWizardModal.spec.tsx` | 1,007 | → shared setup file (~200), `create-mode.spec.tsx` (~250), `update-mode.spec.tsx` (~280)                                                                             |
| `AssignmentsPage.tsx`                      | 935   | → `AssignmentsPage.types.ts` (~100), `.helpers.ts` (~200), `.subcomponents.tsx` (~350), `AssignmentsPage.tsx` (reduced ~250)                                         |
| `AssignmentsPage.spec.tsx`                 | 931   | → shared setup file (~200), `rendering.spec.tsx` (~250), `wizard-modal.spec.tsx` (~280), `filter-assertions.spec.ts` (~150)                                          |
| `classes/classesPageModel.spec.ts`         | 591   | → shared helpers file (~200), spec file (reduced ~350)                                                                                                               |

**6 files — total: 5,982 lines → ~20 files, none exceeding ~550 lines**

---

## `src/frontend/src/features/` — Feature Components & Tests

| File                                          | Lines | Suggested Split                                                                                                                                                             |
| --------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `settings/ManageTopicsModal.spec.tsx`         | 1,005 | → shared setup file (~200), helpers file (~240), `modal-crud.spec.tsx` (~280), `modal-edge-cases.spec.tsx` (~230)                                                           |
| `classes/ClassesManagementPanel.tsx`          | 966   | → `ClassesManagementPanel.types.ts` (~100), `.resolution.ts` (~250), `.failureMessages.ts` (~200), `.subcomponents.tsx` (~200), `ClassesManagementPanel.tsx` (reduced ~250) |
| `settings/backend/useBackendSettings.spec.ts` | 712   | → shared fixtures file (~130), helpers file (~130), spec (reduced ~450)                                                                                                     |
| `classes/manageCohorts.spec.tsx`              | 653   | → shared setup file (~250), spec (reduced ~400)                                                                                                                             |
| `classes/hooks/useReferenceDataManagement.ts` | 582   | → `useReferenceDataManagement.types.ts` (~200), hook (reduced ~380)                                                                                                         |

**5 files — total: 3,918 lines → ~15 files, none exceeding ~450 lines**

---

## `src/frontend/src/test/` — Test Helpers

| File                                                  | Lines | Suggested Split                                                                                                   |
| ----------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------- |
| `assignmentDefinition/wizardModalTestHelpers.tsx`     | 780   | → `.types.ts` (~70), `.render.tsx` (~220), `.elementQueries.tsx` (~120), `.assertions.tsx` (~300)                 |
| `classes/classesPageTestHelpers.tsx`                  | 703   | → `.fixtures.ts` (~240), `.render.tsx` (~100), `.model.ts` (~60), `.assertions.tsx` (~180)                        |
| `assignmentDefinition/wizardTestHelpers.tsx`          | 595   | → `.formInteractions.tsx` (~150), `.warmupState.ts` (~260), `.testSetup.tsx` (~150)                               |
| `assignmentDefinition/assignmentsPageTestHelpers.tsx` | 530   | → `.setup.tsx` (~180), `.table.tsx` (~80), `.modal.tsx` (~100), `.formFields.tsx` (~100), `.assertions.tsx` (~80) |

**4 files — total: 2,608 lines → ~15 files, none exceeding ~300 lines**

---

## `src/frontend/src/` — Other Frontend Source

| File                                                | Lines | Suggested Split                                                                                                                                                                     |
| --------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App.spec.tsx`                                      | 863   | → `test/app/appTestHelpers.ts` (~110), `App.navigation.spec.tsx` (~160), `App.theme.spec.tsx` (~80), `App.auth.spec.tsx` (~180), `App.warmup.spec.tsx` (~120)                       |
| `services/assignmentDefinitionPartials.zod.spec.ts` | 557   | → `test/assignmentDefinition/assignmentDefinitionPartialsTestFixtures.ts` (~40), `...zod.schema.spec.ts` (~140), `...zod.timestamps.spec.ts` (~140), `...zod.fields.spec.ts` (~140) |
| `services/apiService.spec.ts`                       | 528   | → `test/services/apiServiceTestHelpers.ts` (~90), `apiService.callApi.spec.ts` (~170), `apiService.retry.spec.ts` (~150)                                                            |

**3 files — total: 1,948 lines → ~12 files, none exceeding ~180 lines**

---

## `src/frontend/e2e-tests/` — End-to-End Tests

| File                             | Lines | Suggested Split                                                                                                                                                               |
| -------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/endToEndRuntimeMocks.ts` | 733   | → `endToEndRuntimeTypes.ts` (~25), `endToEndRuntimeMockInstall.ts` (~160), `assignmentsScenarioFactories.ts` (~210), `e2eFilterTableHelpers.ts` (~80), barrel re-export (~15) |
| `classes-page.spec.ts`           | 727   | → `classes-page-navigation.spec.ts` (~160), `classes-page-panels-and-cards.spec.ts` (~320), `classes-page-layout.spec.ts` (~120)                                              |
| `classes-crud-bulk-core.spec.ts` | 558   | → shared fixtures file (~130), `table.spec.ts` (~80), `flows.spec.ts` (~300)                                                                                                  |
| `settings-backend.spec.ts`       | 522   | → shared fixtures file (~180), spec (reduced ~300)                                                                                                                            |

**4 files — total: 2,540 lines → ~11 files, none exceeding ~320 lines**

---

## `src/backend/` — Backend (Google Apps Script / Node.js)

| File                                                   | Lines | Suggested Split                                                                                                                                                                                    |
| ------------------------------------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `y_controllers/AssignmentDefinitionController.js`      | 1,129 | → `AssignmentDefinitionController.js` (orchestration ~300), `_assignmentDefinitionValidation.js` (~300), `_assignmentDefinitionPersistence.js` (~250), `_assignmentDefinitionTaskParser.js` (~280) |
| `y_controllers/ABClassController.js`                   | 1,003 | → `ABClassController.js` (CRUD API ~250), `_abClassRoster.js` (~250), `_abClassAssignmentOps.js` (~280), `_abClassUtils.js` (~200)                                                                 |
| `z_Api/assignmentDefinitionPartials.js`                | 918   | → `assignmentDefinitionPartials.js` (handlers ~150), `_assignmentDefinitionPartialsValidation.js` (~250), `_assignmentDefinitionPartialsUtils.js` (~200)                                           |
| `GoogleDriveManager/DriveManager.js`                   | 661   | → `DriveManager.js` (public API ~200), `_driveFolderOps.js` (~200), `_driveFileIdUtils.js` (~200)                                                                                                  |
| `ConfigurationManager/98_ConfigurationManagerClass.js` | 654   | → `98_ConfigurationManagerClass.js` (class + core ~300), `_assessorConfigGetters.js` (~180), `_dbConfigGetters.js` (~180)                                                                          |
| `AssignmentProcessor/Assignment.js`                    | 624   | → `Assignment.js` (public API ~200), `_assignmentSerialization.js` (~200), `_assignmentFactory.js` (~220), `_assignmentSubmissionOps.js` (~100)                                                    |
| `y_controllers/AssignmentController.js`                | 580   | → `AssignmentController.js` (public API ~200), `_assignmentPipeline.js` (~200), `_assignmentDefinitionHelpers.js` (~200)                                                                           |
| `DocumentParsers/SlidesParser.js`                      | 580   | → `SlidesParser.js` (main class ~180), `_slidesTaskExtractor.js` (~200), `_slidesSubmissionExtractor.js` (~200)                                                                                    |

**8 files → ~31 files, none exceeding ~300 lines. Wiring: files prepended with `_` concatenate first; controllers instantiate helpers in constructor; `module.exports` re-exports for Node tests.**

---

## `src/AdminSheet/` — Deprecated Admin Sheet

| File                                                               | Lines |
| ------------------------------------------------------------------ | ----- |
| `src/AdminSheet/UI/AssessmentWizard.html`                          | 1,225 |
| `src/AdminSheet/ConfigurationManager/ConfigurationManagerClass.js` | 741   |
| `src/AdminSheet/GoogleDriveManager/DriveManager.js`                | 628   |
| `src/AdminSheet/AssignmentProcessor/Assignment.js`                 | 606   |
| `src/AdminSheet/y_controllers/ABClassController.js`                | 570   |
| `src/AdminSheet/Sheets/AnalysisSheetManager.js`                    | 566   |
| `src/AdminSheet/y_controllers/AssignmentController.js`             | 557   |
| `src/AdminSheet/UI/ConfigurationDialog.html`                       | 554   |
| `src/AdminSheet/UI/98_UIManager.js`                                | 516   |

**9 files — total: 5,963 lines**

---

## `scripts/builder/src/regression-checker/` — Builder: Regression Checker

| File                                                      | Lines | Suggested Split                                                                                                                                                |
| --------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cli/report-writer-and-cli-orchestration.spec.ts`         | 1,714 | → shared `test-fixtures.ts` (~150), `cli-orchestration.spec.ts` (~500), `report-renderer.spec.ts` (~500), `run-checks-and-artefact-persistence.spec.ts` (~500) |
| `cli/index.ts`                                            | 1,479 | → `report-renderer.ts` (~250), `report-renderer-rich-details.ts` (~150), `artefact-processor.ts` (~200), `index.ts` (remainder ~400)                           |
| `compare/index.ts`                                        | 1,129 | → `comparison-engine.ts` (~350), `summary-derivation.ts` (~500), `index.ts` (barrel re-export ~50)                                                             |
| `config/validate-regression-config.ts`                    | 992   | → `path-safety.ts` (~100), `npm-script-resolver.ts` (~500), `validators.ts` (~50), `validate-regression-config.ts` (remainder ~200)                            |
| `section1-cli-contract.spec.ts`                           | 951   | → shared `test-fixtures.ts` (~100), `session-resolution.spec.ts` (~100), `config-validation.spec.ts` (~600)                                                    |
| `compare/derived-summaries-and-comparison-engine.spec.ts` | 739   | → `comparison-engine.spec.ts` (~400), `summary-derivation-edge-cases.spec.ts` (~150), `unsupported-and-error-paths.spec.ts` (~100)                             |
| `storage/storage-layout-and-manifest.spec.ts`             | 601   | → `storage-layout.spec.ts` (~350), `baseline-compatibility.spec.ts` (~250)                                                                                     |
| `runners/tool-runners-and-bounded-scheduling.spec.ts`     | 503   | → `runner-invocation.spec.ts` (~250), `bounded-scheduling.spec.ts` (~300)                                                                                      |

**8 files → ~25 files, none exceeding ~500 lines (and only 1 above ~400). Splits preserve exports via barrel files or re-exports from the original module path.**

---

## `scripts/builder/vendor/jsondbapp/` — Builder: Vendor (jsondbapp)

| File                                    | Lines | Suggested Split                                                                                                                                                                                | Replaceable?                              |
| --------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `01_utils/ErrorHandler.js`              | 711   | → `01_ErrorTypes.js` (~210), `02_ErrorHandler.js` (~200) — 80% repetitive subclass boilerplate                                                                                                 | **YES** — ~250 lines with factory pattern |
| `04_core/MasterIndex/99_MasterIndex.js` | 605   | → `03_MasterIndexPersistence.js` (~160), `03_MasterIndexCollectionOps.js` (~120), `03_MasterIndexMetadataOps.js` (~100), reduced `99_MasterIndex.js` (~130) — already delegates to 3 sub-files | Partially — mostly orchestration          |
| `02_components/DocumentOperations.js`   | 544   | → `01_DocumentCrud.js` (~210), `02_DocumentQueryOperations.js` (~80), `03_DocumentUpdateOperators.js` (~120), `04_DocumentValidation.js` (~60), barrel aggregator (~50)                        | Partially — read-only core ~200 lines     |
| `04_core/DatabaseConfig.js`             | 522   | → `DatabaseConfigDefaults.js` (~160), `DatabaseConfigValidation.js` (~100), reduced `DatabaseConfig.js` (~200) — 11 static getters duplicate constants (130 lines)                             | **YES** — ~200 lines                      |

**4 files → ~10 files, none exceeding ~210 lines after split. Wiring: concatenation order preserved via prefix numbering.**

---

## Summary

| Module                                    | Current Files | Total Lines | Largest File                                          | Split Target                                    |
| ----------------------------------------- | ------------- | ----------- | ----------------------------------------------------- | ----------------------------------------------- |
| `scripts/builder/src/regression-checker/` | 8             | 8,108       | `report-writer-and-cli-orchestration.spec.ts` (1,714) | ~25 files, none >500                            |
| `src/frontend/src/pages/`                 | 6             | 5,982       | `ClassesPage.spec.tsx` (1,261)                        | ~20 files, none >550                            |
| `src/AdminSheet/` (deprecated)            | 9             | 5,963       | `AssessmentWizard.html` (1,225)                       | not analysed                                    |
| `src/backend/`                            | 8             | 6,149       | `AssignmentDefinitionController.js` (1,129)           | ~31 files, none >300                            |
| `src/frontend/src/features/`              | 5             | 3,918       | `ManageTopicsModal.spec.tsx` (1,005)                  | ~15 files, none >450                            |
| `src/frontend/src/test/`                  | 4             | 2,608       | `wizardModalTestHelpers.tsx` (780)                    | ~15 files, none >300                            |
| `src/frontend/e2e-tests/`                 | 4             | 2,540       | `endToEndRuntimeMocks.ts` (733)                       | ~11 files, none >320                            |
| `scripts/builder/vendor/jsondbapp/`       | 4             | 2,382       | `ErrorHandler.js` (711)                               | ~10 files, none >210                            |
| `src/frontend/src/` (other)               | 3             | 1,948       | `App.spec.tsx` (863)                                  | ~12 files, none >180                            |
| **Total**                                 | **51**        | **39,598**  |                                                       | **8 modules analysed, ~139 split target files** |
