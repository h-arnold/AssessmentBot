# Deprecated Code Audit for React WebApp Migration

Date: 2 March 2026

## Scope and assumptions

1. This audit targets code tied to the current container-bound Sheets UI (menus, modals, `google.script.run` entry points).
2. Core assessment pipeline logic (parsing, assessment, persistence, models, request managers) is not marked deprecated unless it is only used for legacy UI/update flows.

## Summary

The codebase contains four legacy areas that should be treated as deprecated references for the React migration:

1. Legacy GAS modal/menu UI layer.
2. Global UI bridge functions used only by that UI layer.
3. Admin update and Assessment Record provisioning/cloning flow.
4. Standalone `AssessmentRecordTemplate` script project.

## Deprecated files (full-file deprecation)

These files are legacy UI/update surfaces and can be marked deprecated now (retain for reference only).

### 1) Legacy GAS UI assets and UI managers

- `src/AdminSheet/UI/97_globals.js`
- `src/AdminSheet/UI/98_UIManager.js`
- `src/AdminSheet/UI/99_BeerCssUIHandler.js`
- `src/AdminSheet/UI/AssessmentWizard.html`
- `src/AdminSheet/UI/AssignmentDropdown.html`
- `src/AdminSheet/UI/SlideIdsModal.html`
- `src/AdminSheet/UI/ClassroomDropdown.html`
- `src/AdminSheet/UI/ConfigurationDialog.html`
- `src/AdminSheet/UI/ProgressModal.html`
- `src/AdminSheet/UI/BeerCssProgressModal.html`
- `src/AdminSheet/UI/VersionSelectorModal.html`
- `src/AdminSheet/UI/UpdateDialog.html`
- `src/AdminSheet/UI/BeerCssDemoDialog.html`
- `src/AdminSheet/UI/BeerCssPlayground.html`
- `src/AdminSheet/UI/partials/Head.html`
- `src/AdminSheet/UI/partials/Stepper.html`
- `src/AdminSheet/UI/partials/StepperJS.html`
- `src/AdminSheet/UI/partials/WizardStepper.js`
- `src/AdminSheet/UI/partials/BeerCssOverrides.html`
- `src/AdminSheet/UI/vendor/beercss/BeerCssScoped.html`
- `src/AdminSheet/UI/vendor/beercss/BeerCssJs.html`
- `src/AdminSheet/UI/vendor/beercss/LICENCE_BeerCSS.txt`

Why: These files exist to render spreadsheet modal dialogs and drive menu-based UX. React WebApp replaces this entire surface.

### 2) Legacy update and Assessment Record setup/update wizard

- `src/AdminSheet/UpdateAndInitManager/globals.js`
- `src/AdminSheet/UpdateAndInitManager/BaseUpdateAndInitManager.js`
- `src/AdminSheet/UpdateAndInitManager/UpdateManager.js`
- `src/AdminSheet/UpdateAndInitManager/FirstRunManager.js`
- `src/AdminSheet/UpdateAndInitManager/SheetCloner.js`
- `src/AdminSheet/UpdateAndInitManager/PropertiesCloner.js`
- `src/AdminSheet/UpdateAndInitManager/UpdateWizard.html`
- `src/AdminSheet/UpdateAndInitManager/assessmentBotVersions.json`
- `src/AdminSheet/y_controllers/UpdateController.js`

Why: This flow is specifically for copying templates, cloning admin/assessment spreadsheets, and library-based update wizards, which you have said are no longer needed.

### 3) Legacy Assessment Record template project

- `src/AssessmentRecordTemplate/appsscript.json`
- `src/AssessmentRecordTemplate/menus.js`
- `src/AssessmentRecordTemplate/menus/init.js`
- `src/AssessmentRecordTemplate/menus/assignment.js`
- `src/AssessmentRecordTemplate/menus/classroom.js`
- `src/AssessmentRecordTemplate/menus/configuration.js`

Why: This entire project exists to run menu-driven functionality inside copied Assessment Record sheets.

## Deprecated functions/methods (within shared files)

These are in files that also contain active logic, so deprecate at function/method level.

### A) Global functions in `src/AdminSheet/zz_main.js`

- `createAssessmentRecordMenu`
- `createUnauthorisedMenu`
- `isScriptAuthorised`
- `handleAssessmentRecordAuth`
- `showBeerCssDemoDialog`
- `showBeerCssPlaygroundDialog`
- `onOpen`
- `handleScriptInit`
- `clearAllCacheKeys` (debug helper tied to modal-era operation)

Reason: Legacy menu/auth/container UI initialisation entry points.

### B) Global functions in `src/AdminSheet/UI/97_globals.js`

Deprecate all functions in this file, especially:

- `include`
- `openReferenceSlideModal`
- `showProgressModal`
- `showConfigurationDialog`
- `showAssignmentDropdown`
- `showAssessmentWizard`
- `showClassroomDropdown`
- `startAssessmentFromWizard`
- `saveDocumentIdsForAssignment`
- `showVersionSelector`
- `getClassroomData` (dead wrapper)
- `saveClassroomData` (dead wrapper)
- `showClassroomEditorModal` (dead wrapper)

Reason: Bridge layer for `google.script.run` + modal/dialog UI.

### C) Init/menu lifecycle in `src/AdminSheet/y_controllers/InitController.js`

- `onOpen`
- `handleScriptInit`
- `adminScriptInit`
- `assessmentRecordScriptInit`
- `doFirstRunInit`
- `finishUpdate`
- `setDefaultAssessmentRecordTemplateId`
- `setupAuthRevokeTimer`
- `createAssessmentRecordMenu`
- `createUnauthorisedMenu`
- `getUiManager`
- `_withUI`

Reason: All of these exist to maintain spreadsheet menu/auth/update lifecycle.

### D) Assessment Record creation/update methods in Google Classroom modules

`src/AdminSheet/GoogleClassroom/globals.js`:

- `createAssessmentRecords`
- `handleFetchGoogleClassrooms` (if classroom sheet population is no longer part of new workflow)
- `handleCreateGoogleClassrooms` (same condition)

`src/AdminSheet/y_controllers/GoogleClassroomController.js`:

- `createAssessmentRecords`
- `fetchGoogleClassrooms` (same condition)
- `createGoogleClassrooms` (same condition)
- `updateGoogleClassrooms` (already effectively dormant)

`src/AdminSheet/GoogleClassroom/GoogleClassroomManager.js`:

- `fetchGoogleClassrooms` (sheet-population path)
- `createGoogleClassrooms`
- `createAssessmentRecords`
- `validateAssessmentRecordsSetup`
- `ensureRequiredColumns`
- `processAssessmentRecordRows`
- `updateSheetWithRecords`
- `shareWithTeachers`

Reason: These methods are specifically for classroom sheet management and Assessment Record spreadsheet provisioning.

### E) Trigger methods not tied to assessment execution

`src/AdminSheet/Utils/TriggerController.js`:

- `removeOnOpenTriggers`
- `createOnOpenTrigger`

Reason: These support menu/auth initialisation. Keep `createTimeBasedTrigger`, `removeTriggers`, and `deleteTriggerById` for assessment execution unless that execution model is also replaced.

## Likely dead or obsolete wrappers already

- `handleAssessmentRecordAuth` in `zz_main.js` appears to call a missing `InitController.handleAssessmentRecordAuth` method.
- `createAssignmentDropdownHtml` and `createReferenceSlideModalHtml` in `src/AssessmentRecordTemplate/menus/assignment.js` proxy functions that are not present in current AdminSheet globals.

These can be tagged as deprecated immediately.

## Keep (not deprecated in this pass)

Keep these for now because they are still part of the core assessment pipeline and can be reused behind React API endpoints:

- `src/AdminSheet/AssignmentProcessor/*`
- `src/AdminSheet/DocumentParsers/*`
- `src/AdminSheet/RequestHandlers/*`
- `src/AdminSheet/Assessors/*`
- `src/AdminSheet/Models/*`
- `src/AdminSheet/DbManager/*`
- `src/AdminSheet/y_controllers/AssignmentController.js`
- `src/AdminSheet/y_controllers/AssignmentDefinitionController.js`
- `src/AdminSheet/y_controllers/ABClassController.js`
- `src/AdminSheet/y_controllers/CohortAnalysisController.js`
- `src/AdminSheet/y_controllers/globals.js` (`getAllPartialDefinitions` remains useful as API surface)
- `src/AdminSheet/GoogleClassroom/globals.js` functions used by wizard-like assignment retrieval/saving (`fetchAssignmentsForWizard`, `saveClassroom`, `getClassrooms`) unless superseded by new API routes.

## Suggested next step

Create a follow-up migration map that tags each deprecated item with one of:

- `Remove` (no replacement needed)
- `Replace with React endpoint`
- `Retain temporarily for backwards compatibility`

This will let you safely phase deletions after the React WebApp is live.
