# Backend API Layer (`src/backend/Api`)

## Purpose

`src/backend/Api` is the destination for Google Apps Script global functions invoked by the React frontend via `google.script.run`.

This is an active migration area. During migration, some entry points still exist in legacy backend `globals.js` files.

This layer is deliberately REST-ish in structure:

- group functions by domain/resource
- keep endpoint-style naming coherent within each file
- use each `.js` file as an API surface for a specific capability area

## Design Rules

1. Keep API functions as thin as possible.
2. Delegate business logic to the appropriate controller class by default.
3. Only keep logic in API functions when delegation would create unnecessary verbosity with no architectural benefit.
4. Validate direct inputs and fail fast; do not hide backend wiring errors.
5. Keep function names stable once used by frontend callers (`google.script.run.<name>`).

## Relationship to `globals.js`

Legacy backend `globals.js` files are currently retained for reference only during migration.

- `src/backend/AssignmentProcessor/globals.js`
- `src/backend/ConfigurationManager/globals.js`
- `src/backend/y_controllers/globals.js`

Migration rule:

- when an equivalent function is implemented in `src/backend/Api`, remove the legacy `globals.js` variant.
- do not add new functionality to legacy `globals.js` files.

## Testing Guidance

- Test API-layer functions as boundary wrappers: parameter handling, controller delegation, and error propagation.
- Keep heavy business-logic tests at controller/service level.
- Do not call live GAS services in unit tests.
