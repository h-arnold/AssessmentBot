# Deprecated Tests Audit for React WebApp Migration

Date: 9 March 2026

## Scope

This audit marks tests coupled to the deprecated legacy Sheets UI/update flow identified in `DEPRECATED_LEGACY_UI_AUDIT.md`.

## Summary

These deprecated AdminSheet legacy UI tests have now been removed from the repo.

Implemented in this change:

- `tests/ui/**` has been deleted.
- `tests/singletons/uiLazyProbe.test.js` has been deleted.
- Legacy wizard/UI helper files used only by those suites have been deleted.
- `tests/controllers/initController.test.js` is permanently excluded from all runs.
- `tests/controllers/createDefinitionFromWizardInputs.test.js` has been deleted (method removed).
- `tests/helpers/wizardInputsTestHelpers.js` has been deleted (method removed).
- `vitest.config.js` excludes the removed legacy test paths to prevent accidental reintroduction into the default suite.
- `package.json` keeps `npm test` and `npm run test:all` aligned on the active backend suite.

## Removed deprecated test files

### 1) Legacy UI modal/template tests

- `tests/ui/assignmentWizardStep1.test.js`
- `tests/ui/assignmentWizardStep2.test.js`
- `tests/ui/assignmentWizardStepper.test.js`
- `tests/ui/beerCssProgressModal.test.js`
- `tests/ui/beerCssUiHandler.test.js`
- `tests/ui/beercssDemoDialog.test.js`
- `tests/ui/beercssJsVendor.test.js`
- `tests/ui/configurationDialog.test.js`
- `tests/ui/globals.test.js`
- `tests/ui/slideIdsModal.test.js`
- `tests/ui/wizardStepper.test.js`

Reason: These validate legacy HtmlService dialog templates, `google.script.run` wiring, and UI globals being replaced by React WebApp.

### 2) Legacy sheet init/menu lifecycle tests

- `tests/controllers/initController.test.js`

Reason: This is coupled to `onOpen`, menu creation, authorisation menu states, and first-run/update initialisation flow.
Status: Permanently skipped and excluded from all suites.

### 2.1) Legacy wizard modal definition-creation tests

- `tests/controllers/createDefinitionFromWizardInputs.test.js`

Reason: This suite validated the legacy wizard modal definition-creation flow. The `createDefinitionFromWizardInputs` method has been removed from both `AssignmentController` and `AssignmentProcessor/globals.js`.
Status: **Deleted** — test file and helper (`tests/helpers/wizardInputsTestHelpers.js`) removed alongside the production code.

### 3) Legacy UI probe singleton test

- `tests/singletons/uiLazyProbe.test.js`

Reason: This asserts behaviour of `UIManager` UI probing in the legacy spreadsheet UI layer.

## Removed helper files

- `tests/helpers/assessmentWizardTestUtils.js`
- `tests/helpers/htmlTemplateRenderer.js`

## What still runs

`npm test` runs the active test suites: backend (`vitest run`), frontend (Vitest), and builder (Vitest). The backend suite covers models, controllers, request handlers, parsers, assignment pipeline, and configuration logic.

## Commands

- Full test suite: `npm test`
- Backend tests only: `npm run test:backend`
- Frontend tests only: `npm run test:frontend`
- Builder tests only: `npm run test:builder`

Notes:

- `vitest.config.js` explicitly excludes `tests/controllers/initController.test.js` from the backend suite by design.
- `tests/controllers/createDefinitionFromWizardInputs.test.js` was deleted and is therefore not picked up by the test runner.
