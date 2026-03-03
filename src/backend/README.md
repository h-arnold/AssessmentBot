# AssessmentBot backend (GAS runtime)

This folder contains the active, non-UI Google Apps Script backend modules used by the React WebApp migration.

## Included

- Assessment pipeline logic (assignment processing, parsers, assessors, request handlers).
- Core models, controllers and utilities required for runtime execution.
- GAS-compatible V8 JavaScript modules.

## Excluded as deprecated for React migration

- Legacy spreadsheet UI and menu lifecycle code.
- Legacy sheet rendering/management modules used to display analysis in Google Sheets.
- Legacy update and provisioning wizard flows.

See `docs/developer/DEPRECATED_LEGACY_UI_AUDIT.md` for the deprecation map.
