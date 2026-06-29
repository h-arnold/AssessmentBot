# Deprecated Code Audit for React WebApp Migration (Historical)

Date: 2 March 2026 — superseded by repo cleanup; `src/AdminSheet` and `src/AssessmentRecordTemplate` have been fully removed.

## Scope and assumptions

1. This audit targets code tied to the current container-bound Sheets UI (menus, modals, `google.script.run` entry points).
2. Core assessment pipeline logic (parsing, assessment, persistence, models, request managers) is not marked deprecated unless it is only used for legacy UI/update flows.

## Summary

The codebase contained four legacy areas that were treated as deprecated references for the React migration:

1. Legacy GAS modal/menu UI layer.
2. Global UI bridge functions used only by that UI layer.
3. Admin update and Assessment Record provisioning/cloning flow.
4. Standalone `AssessmentRecordTemplate` script project.

**All four areas have since been removed from the repository.** This document is retained as a historical record of what was deprecated and why.

## What was removed

### 1) Legacy GAS UI assets and UI managers

The entire `src/AdminSheet/UI/` directory has been removed, including:

- UI globals (`97_globals.js`)
- UI managers (`98_UIManager.js`, `99_BeerCssUIHandler.js`)
- HTML dialogs (`AssessmentWizard.html`, `AssignmentDropdown.html`, `SlideIdsModal.html`, `ClassroomDropdown.html`, `ConfigurationDialog.html`, `ProgressModal.html`, `BeerCssProgressModal.html`, `VersionSelectorModal.html`, `UpdateDialog.html`, `BeerCssDemoDialog.html`, `BeerCssPlayground.html`)
- Partials (`Head.html`, `Stepper.html`, `StepperJS.html`, `WizardStepper.js`, `BeerCssOverrides.html`)
- Vendored BeerCSS assets (`BeerCssScoped.html`, `BeerCssJs.html`, `LICENCE_BeerCSS.txt`)

Reason: React WebApp replaced this entire surface.

### 2) Legacy update and Assessment Record setup/update wizard

The entire `src/AdminSheet/UpdateAndInitManager/` directory and `src/AdminSheet/y_controllers/UpdateController.js` have been removed.

Reason: These supported copying templates, cloning admin/assessment spreadsheets, and library-based update wizards — no longer needed.

### 3) Legacy Assessment Record template project

The entire `src/AssessmentRecordTemplate/` directory has been removed.

Reason: This project ran menu-driven functionality inside copied Assessment Record sheets, which is superseded by the React WebApp.

### 4) Deprecated functions/methods within shared files

All shared files that once lived under `src/AdminSheet/` have been removed as part of the full directory deletion. This includes:

- Global functions in `src/AdminSheet/zz_main.js`
- Global functions in `src/AdminSheet/UI/97_globals.js`
- Init/menu lifecycle in `src/AdminSheet/y_controllers/InitController.js`
- Assessment Record creation/update methods in `src/AdminSheet/GoogleClassroom/` modules
- Trigger methods in `src/AdminSheet/Utils/TriggerController.js` not tied to assessment execution

### Core pipeline code (moved, not removed)

Files that were previously under `src/AdminSheet/` but contain active assessment pipeline logic were migrated to `src/backend/`:

- `AssignmentProcessor/*` → active in `src/backend/AssignmentProcessor/`
- `DocumentParsers/*` → active in `src/backend/DocumentParsers/`
- `RequestHandlers/*` → active in `src/backend/RequestHandlers/`
- `Assessors/*` → active in `src/backend/Assessors/`
- `Models/*` → active in `src/backend/Models/`
- `DbManager/*` → active in `src/backend/DbManager/`
- `y_controllers/AssignmentController.js` → active in `src/backend/y_controllers/`
- `y_controllers/ABClassController.js` → decomposed into `src/backend/y_controllers/ABClassController/`
- `GoogleClassroom/globals.js` (wizard-like assignment retrieval/saving functions) → active in `src/backend/GoogleClassroom/`
- Controllers such as `AssignmentDefinitionController`, `CohortAnalysisController`, and `ReferenceDataController` → active in `src/backend/y_controllers/`
