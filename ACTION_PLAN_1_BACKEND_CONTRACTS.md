# Workstream 1: Backend Contracts

## Scope

- Stable-key cohort and year-group contract
- `ABClass` key migration
- Partial-response shape refresh
- Mutation validation hardening

## Touched code

- `src/backend/Models/Cohort.js`
- `src/backend/Models/YearGroup.js`
- `src/backend/Models/ABClass.js`
- `src/backend/y_controllers/ReferenceDataController.js`
- `src/backend/y_controllers/ABClassController.js`
- `src/backend/z_Api/referenceData.js`
- `src/backend/z_Api/abclassPartials.js`
- `src/backend/z_Api/abclassMutations.js`

## Current status note

- The live backend and test surface now use object-form `ABClass` construction only across the active implementation and tests.
- `src/backend/z_Api/abclassMutations.js` no longer carries the misleading delete-only validator name.
- `src/backend/z_Api/abclassPartials.js` no longer repeats duplicate header comments, and `tests/api/apiHandler.test.js` no longer carries stale keyed-contract routing fixtures.
- The exploration findings below are historical planning notes, not the current code state.

## Historical exploration findings to account for

- `referenceData.js` dereferences payloads before validating shape.
- `abclassPartials.js` is load-order fragile because controller resolution happens at module load.
- `abclassMutations.js` sanitises delete `classId` differently from create/update flows.
- Existing tests still encode old name-based payloads and create-on-missing update behaviour.

## Work packages

### 1.1 Reference-data key contract

Objective:

- Replace name-addressed cohort and year-group contracts with keyed contracts.

Acceptance:

- Cohort shape is `{ key, name, active, startYear, startMonth }`.
- Year-group shape is `{ key, name }`.
- Create/update/delete payloads identify records by `key`, not mutable names.
- UUID keys are generated on create and preserved on rename.
- Cohort defaults preserve the agreed academic-year rule:
  - `startMonth` defaults to `9` for September.
  - `startYear` defaults to the current English and Welsh academic year start.
  - The academic year starts on 1 September.
  - For dates from 1 September through 31 December, default `startYear` is the current calendar year.
  - For dates from 1 January through 31 August, default `startYear` is the previous calendar year.
- This workstream is a strict cutover from name-based reference data to key-based reference data.
- Under no circumstances should compatibility paths, fallback reads, dual-write logic, or legacy name-based handling be introduced in production code.

Tests:

- `tests/models/cohortYearGroup.test.js`
- `tests/controllers/referenceDataController.test.js`
- `tests/backend-api/referenceData.unit.test.js`

### 1.2 `ABClass` contract and partial refresh

Objective:

- Move persisted metadata to `cohortKey` and `yearGroupKey`.

Acceptance:

- `ABClass.toJSON()` emits key-based metadata.
- `ABClass.toPartialJSON()` emits keys plus resolved labels.
- `getABClassPartials` returns the new partial transport shape without storage metadata.
- `abclassPartials.js` remains GAS-native in production: instantiate `ABClassController` at call time and keep only the guarded export block at end of file for Node tests.
- Persisted `ABClass` metadata uses `cohortKey` and `yearGroupKey` only.
- Under no circumstances should production code read, derive from, or fall back to legacy name-based `ABClass` metadata once this slice lands.

Tests:

- `tests/models/abclass.test.js`
- `tests/models/abclass.partial.test.js`
- `tests/controllers/abclass-partials-read.test.js`
- `tests/controllers/abclass-controller-partials.test.js`
- `tests/backend-api/abclassPartials.unit.test.js`
- `tests/api/abclassPartials.test.js`

### 1.3 Mutation validation hardening

Objective:

- Make backend lifecycle rules authoritative before the frontend bulk flows exist.

Acceptance:

- `upsertABClass` validates reference-data keys and defaults new classes to `active=true`.
- `updateABClass` rejects `active` updates for missing classes.
- `deleteCohort` and `deleteYearGroup` reject in-use deletes.
- Invalid request shapes stay inside the API envelope.
- `classId` sanitisation is consistent across create, update, and delete.
- `deleteCohort` and `deleteYearGroup` return a machine-readable failure reason for in-use deletes so the frontend can distinguish blocked deletes deterministically.
- Backend writes reject assigning inactive cohorts in new or updated metadata.
- Existing `ABClass` records that already reference inactive cohorts remain readable; this does not permit new assignments to inactive cohorts.

Tests:

- `tests/controllers/abclass-upsert-update.test.js`
- `tests/controllers/abclass-delete.test.js`
- `tests/controllers/referenceDataController.test.js`
- `tests/api/abclassMutations.test.js`
- `tests/backend-api/referenceData.unit.test.js`

## Sequencing notes

- Fix transport-shape validation before changing models so bad payloads do not leak raw `TypeError`s.
- Land delete guards before building delete-blocked modal UX.
- Treat load-order assumptions as part of the contract and keep them covered explicitly.
- Keep tests and implementation aligned to the strict-cutover rule; remove old name-based expectations instead of preserving them behind fallback behaviour.

## Section checks

- `npm test -- tests/models/cohortYearGroup.test.js tests/models/abclass.test.js tests/models/abclass.partial.test.js`
- `npm test -- tests/controllers/referenceDataController.test.js tests/controllers/abclass-partials-read.test.js tests/controllers/abclass-controller-partials.test.js tests/controllers/abclass-upsert-update.test.js tests/controllers/abclass-delete.test.js`
- `npm test -- tests/backend-api/referenceData.unit.test.js tests/backend-api/abclassPartials.unit.test.js tests/api/abclassPartials.test.js tests/api/abclassMutations.test.js`
- `npm run lint`
