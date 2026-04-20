# SLOP_REVIEW

## Summary

**Needs Improvement** — `src/frontend/src/services/apiService.ts` is doing real transport work, but the backend `z_Api` surface carries confirmed slop: the allowlist looks like a boundary while the same handlers remain directly callable as top-level GAS globals, and several backend wrapper files add only indirection.

## 🔴 Critical

### 1. The allowlist is not the real callable boundary

- **Location:** `src/backend/z_Api/z_apiHandler.js:28-47`, `src/backend/z_Api/auth.js:6-8`, `src/backend/z_Api/abclassPartials.js:10-12`, `src/backend/z_Api/referenceData.js:17-18, 28-29, 39-40, 50-51, 59-60, 70-71, 81-82, 92-93`, `src/backend/AGENTS.md:7-20`, `docs/developer/backend/api-layer.md:5-7, 43-45`
- **Evidence:** `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js` forwards to top-level functions such as `getAuthorisationStatus`, `getABClassPartials`, `createCohort`, and `deleteYearGroup`. Those functions are declared as normal global GAS functions in separate `z_Api` files. The backend docs also describe `src/backend/z_Api` as the current frontend-callable entry surface, so these wrappers are not hidden implementation details.
- **Why it matters:** the allowlist only constrains calls that already choose to go through `apiHandler`. It does **not** materially reduce the exposed callable surface, because the same transport handlers still exist as directly callable globals. That makes the allowlist security theatre: a direct `google.script.run.createCohort(...)` style call would bypass the central request envelope, request ID generation, admission/completion tracking, and boundary error mapping that `apiHandler` is supposed to own.
- **Recommended simplification:** pick one real boundary. Either:
  1. keep `apiHandler` as the only exposed global and move allowlisted handlers into private dispatcher/module scope, or
  2. accept that the wrapper globals are the boundary and remove the extra allowlist layer from `apiHandler`.

### 2. The transport method registry is maintained in triplicate

- **Location:** `src/backend/z_Api/apiConstants.js:3-43`, `src/backend/z_Api/z_apiHandler.js:28-47`, `docs/developer/backend/api-layer.md:67-72`
- **Evidence:** every method name is repeated in `API_METHODS`, repeated again in `API_ALLOWLIST` as an identity map, and repeated a third time in `ALLOWLISTED_METHOD_HANDLERS`. The canonical docs then require new transport methods to be added in all three places.
- **Why it matters:** this is pure bookkeeping rather than behaviour. It increases drift risk, review noise, and migration cost for every endpoint without buying meaningful isolation while the underlying handler globals remain directly callable.
- **Recommended simplification:** keep a single authoritative registry keyed by transport method name and derive any allowlist view from it. If the project keeps the allowlist concept, it should be derived data, not a second hand-maintained copy. If the project removes the fake boundary described above, `API_ALLOWLIST` can disappear entirely.

## 🟡 Improvement

### 1. Several backend transport files are just public pass-through constructors

- **Location:** `src/backend/z_Api/auth.js:6-8`, `src/backend/z_Api/abclassPartials.js:10-12`, `src/backend/z_Api/referenceData.js:8-10, 17-18, 28-29, 39-40, 50-51, 59-60, 70-71, 81-82, 92-93`, `tests/backend-api/abclassPartials.unit.test.js:30-42`, `tests/backend-api/referenceData.unit.test.js:44-113`
- **Evidence:** these handlers do little more than instantiate a controller and call one method. `referenceData.js` even adds a one-line `getReferenceDataController()` helper just to support more one-line wrappers. The nearby unit tests mainly assert that the indirection still exists.
- **Why it matters:** these wrappers enlarge the global callable surface, duplicate method names already present in `ALLOWLISTED_METHOD_HANDLERS`, and create tests that lock in indirection rather than behaviour. They are only doing useful work when they validate or reshape transport data; otherwise they are ceremony.
- **Recommended simplification:** if `apiHandler` becomes the sole entrypoint, inline trivial controller calls into private dispatcher closures and keep standalone transport files only where they add boundary logic (for example `googleClassrooms.js`, `assignmentDefinitionPartials.js`, and the validation-heavy parts of `abclassMutations.js`).

### 2. `authService.ts` is mostly a string alias, not a real frontend boundary module

- **Location:** `src/frontend/src/services/authService.ts:1-12`, `src/frontend/src/services/authService.spec.ts:14-21`, `src/frontend/AGENTS.md:49-53`
- **Evidence:** `getAuthorisationStatus()` just returns `callApi<boolean>('getAuthorisationStatus')`. Unlike the other frontend service wrappers in scope (`backendConfigurationService.ts`, `classPartialsService.ts`, `referenceDataService.ts`, `googleClassroomsService.ts`, `assignmentDefinitionPartialsService.ts`), it owns no response parsing or request validation. Its test only asserts that it passes a string through to `callApi`.
- **Why it matters:** this file adds another method-name alias and another test without carrying the main value that the frontend service layer is supposed to provide.
- **Recommended simplification:** either parse the response with `z.boolean()` so the service owns an actual transport contract, or fold this one-off wrapper into the query module that consumes it. As written, it is closer to ceremony than boundary logic.
- **Violated policy doc and rule:** `src/frontend/AGENTS.md:51-53` — frontend service wrappers should own request/response validation around `callApi(...)`.
- **Impact:** low; the runtime behaviour is simple and likely correct, but the wrapper is not pulling its weight.
- **Required correction:** add explicit response validation or inline the wrapper into a more meaningful boundary.
- **Blocker status:** no

## ⚪ Nitpick

### 1. The shared frontend transport itself does not read as slop

- **Location:** `src/frontend/src/services/apiService.ts:5-184`, `src/frontend/src/services/apiService.spec.ts:132-528`
- **Evidence:** `apiService.ts` centralises request validation, envelope validation, transport-error creation, missing-runtime failures, and retriable backoff logic, and the tests exercise those behaviours directly.
- **Why it matters:** this is the part of the stack that is actually earning its abstraction cost. The backend duplication around it is the problem, not the existence of a shared frontend transport boundary.
- **Recommended simplification:** none required here for slop reasons.

## Cleanup performed

- Added this review file only. No production code was changed.

## Validation commands run

- `git --no-pager diff --check -- SLOP_REVIEW.md` — passed.

## Areas not fully verified

- I did not execute a live deployed GAS web interface to prove direct invocation at runtime. The conclusion that the handlers remain exposed is based on the repository's documented GAS runtime model and the top-level function declarations in `src/backend/z_Api/**`.

## Files read

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `src/frontend/AGENTS.md`
- `docs/developer/backend/backend-logging-and-error-handling.md`
- `docs/developer/frontend/frontend-logging-and-error-handling.md`
- `docs/developer/backend/api-layer.md`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/z_Api/apiConstants.js`
- `src/backend/z_Api/auth.js`
- `src/backend/z_Api/abclassPartials.js`
- `src/backend/z_Api/googleClassrooms.js`
- `src/backend/z_Api/abclassMutations.js`
- `src/backend/z_Api/referenceData.js`
- `src/backend/z_Api/assignmentDefinitionPartials.js`
- `src/frontend/src/services/apiService.ts`
- `src/frontend/src/services/apiService.spec.ts`
- `src/frontend/src/services/authService.ts`
- `src/frontend/src/services/authService.spec.ts`
- `src/frontend/src/services/backendConfigurationService.ts`
- `src/frontend/src/services/backendConfiguration.zod.ts`
- `src/frontend/src/services/classPartialsService.ts`
- `src/frontend/src/services/googleClassroomsService.ts`
- `src/frontend/src/services/assignmentDefinitionPartialsService.ts`
- `src/frontend/src/services/referenceDataService.ts`
- `src/frontend/src/services/referenceData.zod.ts`
- `src/frontend/src/App.tsx`
- `tests/api/apiHandler.test.js`
- `tests/backend-api/abclassPartials.unit.test.js`
- `tests/backend-api/referenceData.unit.test.js`
