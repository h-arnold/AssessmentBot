# Deprecated Tests Audit for React WebApp Migration

Date: 2 March 2026

## Scope

This audit marks tests coupled to the deprecated legacy Sheets UI/update flow identified in `DEPRECATED_LEGACY_UI_AUDIT.md`.

## Summary

Yes, it is possible to keep these tests in the repo and skip them by default.

Implemented in this change:

- `vitest.config.js` now skips legacy UI-linked tests unless `INCLUDE_LEGACY_UI_TESTS=true`.
- `tests/controllers/initController.test.js` is permanently excluded from all runs.
- `package.json` adds:
  - `npm run test:all` to run all tests including legacy UI tests.
  - `npm run test:legacy-ui` to run only legacy UI tests.

## Deprecated test files (skip by default)

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

### 3) Legacy UI probe singleton test

- `tests/singletons/uiLazyProbe.test.js`

Reason: This asserts behaviour of `UIManager` UI probing in the legacy spreadsheet UI layer.

## Related helper files to treat as legacy test support

These are not skipped directly, but primarily support deprecated tests:

- `tests/helpers/assessmentWizardTestUtils.js`
- `tests/helpers/htmlTemplateRenderer.js`
- `tests/helpers/singletonTestSetup.js` (partially shared)

## What still runs by default

`npm test` now runs non-legacy logic tests by default (models, request handlers, parsers, assignment pipeline, configuration logic, etc.).

## Commands

- Default non-legacy suite: `npm test`
- Legacy UI tests only: `npm run test:legacy-ui`
- Full suite including legacy UI tests: `npm run test:all`

Notes:

- `npm run test:all` still excludes `tests/controllers/initController.test.js` by design.
