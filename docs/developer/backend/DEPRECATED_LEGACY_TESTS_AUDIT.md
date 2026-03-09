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
- `tests/controllers/createDefinitionFromWizardInputs.test.js` is permanently excluded from all runs.
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

Reason: This suite validates the legacy wizard modal definition-creation flow that is being replaced by the React frontend.
Status: Permanently skipped and excluded from all suites.

### 3) Legacy UI probe singleton test

- `tests/singletons/uiLazyProbe.test.js`

Reason: This asserts behaviour of `UIManager` UI probing in the legacy spreadsheet UI layer.

## Removed helper files

- `tests/helpers/assessmentWizardTestUtils.js`
- `tests/helpers/htmlTemplateRenderer.js`

## What still runs

`npm test` and `npm run test:all` now run the active backend logic tests (models, request handlers, parsers, assignment pipeline, configuration logic, etc.).

## Commands

- Active backend suite: `npm test`
- Active backend suite alias: `npm run test:all`

Notes:

- `npm test` still excludes `tests/controllers/initController.test.js` by design.
- `npm test` also excludes `tests/controllers/createDefinitionFromWizardInputs.test.js` by design.
