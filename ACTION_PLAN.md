# Feature Delivery Plan (TDD-First)

## Scope and assumptions

### Scope

- Introduce request-scoped long-running progress tracking using an optional `jobTrackingId` passed through API params for long-running flows.
- Keep backend `apiHandler` transport `requestId` behaviour unchanged and separate from long-running progress tracking semantics.
- Update backend progress persistence from a single global progress key to keyed progress records derived from `jobTrackingId`.
- Update backend long-running entry points (including assignment trigger setup flow) to accept and propagate `jobTrackingId` consistently.
- Add frontend service-layer support for passing `jobTrackingId` to long-running API methods and polling progress by `jobTrackingId`.
- Add targeted backend and frontend tests for validation, routing, persistence keying, trigger handoff, and progress polling contracts.

### Out of scope

- Building visible frontend UI components for progress display in this delivery.
- Reworking all short-running API methods to require progress tracking.
- Replacing existing API admission-control request lifecycle tracking in `requestStore`.
- Broad refactors of unrelated controller/service flows.

### Assumptions

1. `jobTrackingId` applies only to long-running workflows; short operations may omit it.
2. The frontend may generate `jobTrackingId` (UUID-like), but backend validation remains authoritative.
3. Progress records are user-scoped in `UserProperties`, not document-scoped in `DocumentProperties`.
4. A single user may have multiple tracked jobs, so progress persistence must be keyed by `jobTrackingId`.
5. Legacy AdminSheet modal polling remains deprecated reference behaviour and is not implementation target.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API entry points thin and delegate behaviour to existing controllers/utilities where possible.
- Fail fast on invalid or missing `jobTrackingId` when required by long-running methods.
- Never silently swallow errors; preserve existing logging and error propagation patterns.
- Keep changes minimal, localised, and aligned with current backend/frontend migration architecture.
- Use British English in comments and documentation.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section’s acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Validation commands hierarchy

- Backend lint: `npm run lint`
- Frontend lint: `npm run frontend:lint`
- Builder lint (if touched): `npm run builder:lint`
- Backend tests: `npm test -- <target>`
- Frontend unit tests: `npm run frontend:test -- <target>`
- Frontend e2e tests (if UX changes): `npm run frontend:test:e2e -- <target>`

---

## Section 1 — Backend progress contract and persistence keying

### Objective

- Add backend support for keyed progress persistence by `jobTrackingId` while retaining a singleton `ProgressTracker` façade.

### Constraints

- Do not add a separate persistence class unless implementation is blocked.
- Maintain existing `ProgressTracker` method semantics where practical.
- Ensure progress key composition is deterministic and safe for property storage.

### Acceptance criteria

- Progress writes and reads are keyed by `jobTrackingId` rather than a single global progress key.
- `ProgressTracker` supports methods that accept optional/required tracking context for long-running flows.
- Progress persistence uses `UserProperties` for request-scoped data.
- Existing behaviour for untracked short flows is explicitly defined and tested (either unsupported or mapped to a clear fallback path).

### Required test cases (Red first)

Backend utility/singleton tests:

1. Progress initialisation with `jobTrackingId` writes to the correct user property key.
2. Progress update with the same `jobTrackingId` updates the same keyed record.
3. Progress completion marks only the keyed record as completed.
4. Progress read for one `jobTrackingId` does not return another job’s record.
5. Missing/invalid `jobTrackingId` path behaves according to agreed fail-fast rules for long-running methods.

API layer tests:

1. None in this section.

Frontend tests:

1. None in this section.

### Section checks

- `npm test -- tests/singletons/<progress-tracker-target>`
- `npm test -- tests/utils/<progress-tracking-target>`

### Implementation notes / deviations / follow-up

- **Implementation notes:** Reuse existing progress and logging conventions; keep method surface changes minimal.
- **Deviations from plan:** Record any unavoidable compatibility shims.
- **Follow-up implications for later sections:** API handlers and trigger orchestration must supply `jobTrackingId` consistently.

---

## Section 2 — Backend API method contract for long-running tracking

### Objective

- Extend backend API methods involved in long-running flows to accept and propagate `jobTrackingId` through transport and controller boundaries.

### Constraints

- Keep `apiHandler` transport `requestId` generation and envelope contract unchanged.
- Validate `jobTrackingId` at the API boundary for methods that require long-running tracking.
- Keep dispatcher and allowlist method names aligned across constants, handler routing, and frontend callers.

### Acceptance criteria

- Long-running API method(s) accept `params.jobTrackingId` and pass it through to controller/global entry points.
- `apiHandler` continues returning backend-owned transport `requestId` unchanged.
- Validation failures for malformed `jobTrackingId` return existing structured error envelopes.
- API docs/method constants remain consistent with implemented method names.

### Required test cases (Red first)

Backend API tests:

1. Dispatcher routes long-running method with valid `jobTrackingId` to the correct handler.
2. Missing `jobTrackingId` for required long-running method returns structured invalid-request failure.
3. Malformed `jobTrackingId` returns structured invalid-request failure.
4. Successful call retains normal envelope structure with transport `requestId` and method-specific `data`.
5. Existing non-long-running methods remain unaffected.

Backend controller/global tests:

1. Long-running entry point receives `jobTrackingId` from API layer unchanged.

Frontend tests:

1. None in this section.

### Section checks

- `npm test -- tests/api/<long-running-api-target>`
- `npm test -- tests/backend-api/<long-running-handler-target>`

### Implementation notes / deviations / follow-up

- **Implementation notes:** Keep API wrappers thin; avoid embedding workflow logic in dispatch branches.
- **Deviations from plan:** Note any method naming adjustments required for consistency.
- **Follow-up implications for later sections:** Trigger context must include the same `jobTrackingId`.

---

## Section 3 — Trigger handoff and assignment flow propagation

### Objective

- Ensure long-running assignment execution paths propagate a single `jobTrackingId` across initial API call, trigger setup, and trigger-run processing.

### Constraints

- Preserve existing trigger orchestration and lock behaviour unless changes are required for correctness.
- Avoid document-global context keys that can collide across concurrent tracked jobs.
- Keep cleanup deterministic and scoped to the tracked job context.

### Acceptance criteria

- `saveStartAndShowProgress` (or equivalent long-running start path) accepts and stores `jobTrackingId` in trigger context.
- Trigger execution path loads the same `jobTrackingId` and uses it for all progress updates.
- Trigger cleanup removes only relevant tracking context keys.
- Concurrent starts with different `jobTrackingId` do not overwrite each other’s progress records.

### Required test cases (Red first)

Backend controller tests:

1. Start path persists trigger context containing `jobTrackingId`.
2. Trigger path reads persisted `jobTrackingId` and passes it to progress updates.
3. Cleanup path removes the scoped trigger context for completed/failed runs.
4. Two simulated runs with distinct tracking IDs keep progress isolated.

Backend utility tests:

1. Trigger helper interactions continue functioning with added context payload fields.

API layer tests:

1. None beyond Section 2 unless new API start method is introduced.

Frontend tests:

1. None in this section.

### Section checks

- `npm test -- tests/controllers/<assignment-controller-target>`
- `npm test -- tests/utils/<trigger-controller-target>`

### Implementation notes / deviations / follow-up

- **Implementation notes:** Keep trigger handoff payload explicit and minimal.
- **Deviations from plan:** Record any constraints due to existing property storage patterns.
- **Follow-up implications for later sections:** Frontend polling service must query by `jobTrackingId`.

---

## Section 4 — Frontend service and non-visual progress handler contract

### Objective

- Add frontend transport/service support for passing `jobTrackingId` and retrieving keyed progress without introducing visible UI assets.

### Constraints

- Route all backend calls through `callApi`.
- Keep transport parsing and retry behaviour centralised in `apiService`.
- Use Zod for any new validation contracts and derive TypeScript types via `z.infer<typeof ...>`.

### Acceptance criteria

- Frontend service for long-running start method includes `jobTrackingId` in request params.
- Frontend service for progress fetch includes `jobTrackingId` in request params.
- Any non-visual hook/handler maps transport errors to UI-safe states/messages per policy.
- No direct `google.script.run.<method>` calls are introduced in feature/service code.

### Required test cases (Red first)

Frontend service tests:

1. Start service calls `callApi` with correct method and params including `jobTrackingId`.
2. Progress service calls `callApi` with correct method and params including `jobTrackingId`.
3. Service propagates `callApi` rejections unchanged.
4. Service rejects malformed payloads via schema parsing when applicable.

Frontend hook/handler tests (if introduced):

1. Handler requests progress for the provided `jobTrackingId`.
2. Handler stops polling on completed/error states.
3. Handler maps transport errors to safe consumer-facing state.

Backend tests:

1. None in this section.

### Section checks

- `npm run frontend:test -- src/frontend/src/services/<progress-service-target>.spec.ts`
- `npm run frontend:test -- src/frontend/src/features/<progress-handler-target>.spec.ts`

### Implementation notes / deviations / follow-up

- **Implementation notes:** Keep this layer non-visual for now; defer GUI work.
- **Deviations from plan:** Record if additional shared error-mapping helpers are required.
- **Follow-up implications for later sections:** Future UI components should consume these typed service contracts directly.

---

## Section 5 — Regression and contract hardening

### Objective

- Validate that request-scoped progress tracking works end-to-end for long-running tasks without regressing current API transport behaviour.

### Constraints

- Prefer focused tests first, then lint.
- Avoid broad unrelated refactors during regression fixes.
- Record unrelated failures explicitly rather than masking them.

### Acceptance criteria

- All newly added/updated backend tests for progress keying, API validation, and trigger propagation pass.
- All newly added/updated frontend service/handler tests pass.
- Backend lint passes for touched files.
- Frontend lint passes for touched files.
- Existing short-running API method behaviour remains stable.

### Required test cases/checks

1. Run touched backend singleton/utility tests for keyed progress behaviour.
2. Run touched backend API tests for long-running method contract validation.
3. Run touched backend controller tests for trigger context propagation.
4. Run touched frontend service/hook tests for `jobTrackingId` request wiring and polling semantics.
5. Run `npm run lint`.
6. Run `npm run frontend:lint`.
7. Run `npm run builder:lint` only if builder files are touched.
8. Manually verify method-name parity between frontend service constants and backend `API_METHODS`.

### Section checks

- Run the commands listed above and ensure green results.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Summarise any final fixes made to align API/trigger/frontend contracts.
- **Deviations from plan:** Note any unrelated test or lint failures discovered.

---

## Documentation and rollout notes

### Objective

- Keep implementation docs aligned with the new request-scoped long-running progress contract.

### Constraints

- Update only relevant canonical docs.
- Keep AGENTS files as signposts; do not duplicate policy detail there.

### Acceptance criteria

- Backend API docs clearly distinguish transport `requestId` from long-running `jobTrackingId`.
- Backend data/persistence notes describe user-scoped keyed progress storage and any retention/cleanup behaviour.
- Frontend integration notes document required params and error-mapping expectations for non-visual progress handling.

### Required checks

1. Verify `docs/developer/backend/api-layer.md` documents `jobTrackingId` usage for long-running methods.
2. Verify progress-related backend docs reflect user-scoped persistence and trigger handoff assumptions.
3. Verify frontend docs remain aligned with `callApi` boundary and error-handling policy.
4. Confirm this plan remains accurate as implementation progresses.

### Implementation notes / deviations / follow-up

- Record documentation updates made during implementation and any deferred doc follow-up.

---

## Suggested implementation order

1. Section 1: backend progress keying by `jobTrackingId`
2. Section 2: backend API method contract and validation
3. Section 3: trigger handoff propagation through assignment flow
4. Section 4: frontend service/non-visual handler wiring
5. Section 5: regression and contract hardening
6. Documentation and rollout notes
