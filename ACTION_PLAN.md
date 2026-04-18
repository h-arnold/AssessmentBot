# Feature Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read `SPEC.md` in repo root.
2. Read `ASSIGNMENTS_PAGE_LAYOUT.md` in repo root.
3. Treat `SPEC.md` and `ASSIGNMENTS_PAGE_LAYOUT.md` as the source of truth for product behaviour, contracts, and visible layout rules.
4. Use this action plan only to sequence implementation and validation.

## Scope and assumptions

### Scope

- Backend transport additions for assignment-definition partial list and single delete.
- Frontend shared query/service/schema wiring for `assignmentDefinitionPartials`.
- Dataset-granular startup warm-up state changes so unrelated surfaces do not regress.
- Assignments page UI for list, filters, reset, retry, disabled placeholder create/update buttons, and single-row delete with explicit confirmation.

### Out of scope

- Functional create/update assignment-definition workflows beyond disabled placeholders.
- Bulk delete or archive workflows.
- Full-definition fetch/hydration from the Assignments page.
- Legacy data migration tooling.

### Assumptions

1. `SPEC.md` strict-fail contracts are authoritative, including required field presence and timestamp validity.
2. Unsafe keys may remain visible but undeletable in v1.
3. Assignments retry/refresh must refetch `assignmentDefinitionPartials` only.
4. `ASSIGNMENTS_PAGE_LAYOUT.md` is authoritative for page structure, visible regions, and placeholder-action treatment.

---

## Global constraints and quality gates

### Engineering constraints

- Keep `z_Api` entry methods thin and delegate behaviour to controllers.
- Fail fast on invalid transport rows and invalid delete inputs.
- Do not silently canonicalise missing transport fields.
- Keep frontend transport calls routed through `callApi(...)`.
- Keep changes minimal and localised to backend transport, shared query/warmup, and Assignments feature.

### TDD workflow (mandatory per section)

For each section:

1. **Red**: write failing tests for the section acceptance criteria.
2. **Green**: implement minimal code to pass.
3. **Refactor**: tidy with all tests still green.
4. Run section checks.

### Validation commands hierarchy

- Backend lint: `npm run lint`
- Frontend lint: `npm run frontend:lint`
- Backend tests: `npm test -- <target>`
- Frontend tests: `npm run frontend:test -- <target>`

---

## Section 1 — Backend list transport contract

### Objective

- Add `getAssignmentDefinitionPartials` transport and enforce strict row contract validation.

### Constraints

- Method must be allowlisted and dispatchable via `z_apiHandler`.
- Return partial rows only (no full tasks).
- Whole response fails if any row violates required field presence or timestamp/key contract.
- Strict malformed-row validation is confined to the new `z_Api` transport in this feature; legacy non-`z_Api` consumers are not hardened here.

### Acceptance criteria

- API constants/allowlist include `getAssignmentDefinitionPartials`.
- Dispatcher routes to handler.
- Handler returns plain partial objects on valid data.
- Handler fails when any row misses required fields or has invalid timestamp/key shape.

### Required test cases (Red first)

Backend controller/API tests:

1. Allowlist and dispatch wiring test for `getAssignmentDefinitionPartials`.
2. Valid rows pass and return expected list shape.
3. Missing required non-timestamp field fails request.
4. Missing/invalid timestamp field fails request.
5. Missing/blank/non-trimmed `definitionKey` fails request.

### Execution status (Section 1)

- [x] Red tests added — **COMPLETE**
- [x] Red review clean — **COMPLETE**
- [x] Green implementation complete — **COMPLETE**
- [x] Green review clean — **COMPLETE**
- [x] Checks passed — **COMPLETE**
- [x] Action plan updated — **COMPLETE**
- [x] Commit created — **COMPLETE**
- [x] Push completed — **COMPLETE**

### Section checks

- `npm test -- tests/api`
- `npm test -- tests/backend-api`

### Optional `@remarks` JSDoc follow-through

- None

### Implementation notes / deviations / follow-up

- **Implementation notes:** Added `getAssignmentDefinitionPartials` to the API constants allowlist and `z_apiHandler` dispatcher, then added a thin `getAssignmentDefinitionPartials` handler with strict required-field/key/timestamp/tasks validation and plain-object output.
- **Evidence:** Commit `c6e42db3f8e7fabc869ce6e6f3f4792d9cf93118` on branch `feat/assignments-management-v1`; push succeeded to `origin/feat/assignments-management-v1`.
- **Deviations from plan:** None.
- **Follow-up implications for later sections:** Review-driven fix now enforces strict timestamp validation that rejects canonicalised invalid dates (for example `2026-02-30`); Section 2 should reuse the same strict key-validation policy for the delete endpoint.

---

## Section 2 — Backend delete transport contract

### Objective

- Add `deleteAssignmentDefinition` with strict input safety and idempotent safe-key delete behaviour.

### Constraints

- Input key must be non-empty and already trimmed.
- Reject keys containing `/`, `\\`, `..`, or control chars.
- Use original validated key for both registry and full-store delete targets.
- No permissive legacy fallback.

### Acceptance criteria

- API constants/allowlist include `deleteAssignmentDefinition`.
- Dispatcher routes to handler.
- Safe key delete succeeds and is idempotent.
- Invalid key shapes fail with validation error.

### Required test cases (Red first)

Backend API tests:

1. Allowlist and dispatch wiring test for `deleteAssignmentDefinition`.
2. Reject empty and whitespace-padded keys.
3. Reject keys containing `/`, `\\`, `..`, or control characters.
4. Safe key delete removes registry/full targets.
5. Safe key delete remains idempotent when targets already absent.

### Execution status (Section 2)

- [x] Red tests added — **COMPLETE**
- [x] Red review clean — **COMPLETE**
- [x] Green implementation complete — **COMPLETE**
- [x] Green review clean — **COMPLETE**
- [x] Checks passed — **COMPLETE**
- [x] Action plan updated — **COMPLETE**
- [x] Commit created — **COMPLETE**
- [x] Push completed — **COMPLETE**

### Section checks

- `npm test -- tests/api`
- `npm test -- tests/controllers`

### Optional `@remarks` JSDoc follow-through

- None

### Implementation notes / deviations / follow-up

- **Implementation notes:** Added `deleteAssignmentDefinition` to API constants/allowlist and `z_apiHandler` dispatch, then implemented strict delete-key validation in `z_Api/assignmentDefinitionPartials.js` and delegated safe-key delete to `AssignmentDefinitionController.deleteDefinitionByKey(...)` using the original validated key for both registry and full-store targets. Reviewer follow-up fix: `deleteDefinitionByKey(...)` now removes the registry row and drops the dedicated `assdef_full_<key>` collection directly (idempotent when missing) instead of opening/saving the full collection.
- **Evidence:** commit SHA `e07c74d209d49ae1e534b38519c59cb34af4d58a`; commit message `feat(section-2): add deleteAssignmentDefinition transport contract`; commit SHA `955f125c2e1d2976410322131e09780e5caefa59`; commit message `docs(action-plan): record section 2 delivery evidence`; branch `feat/assignments-management-v1`; push confirmation `push to origin succeeded`.
- **Deviations from plan:** None.
- **Follow-up implications for later sections:** Frontend delete wiring can rely on backend fail-closed key validation and idempotent delete semantics for safe keys.

---

## Section 3 — Frontend schemas, services, and query wiring

### Objective

- Add frontend service contracts and query key/options for assignment-definition partials and delete.

### Constraints

- All transport via `callApi(...)`.
- Zod schemas must enforce strict required field presence.
- Timestamp contract: ISO string or explicit `null`; missing fields fail.

### Acceptance criteria

- Query key `assignmentDefinitionPartials` exists.
- Shared query option exists for list method.
- Services and schemas exist for list/delete methods.
- Validation fails on missing fields and invalid timestamp/key rules.

### Required test cases (Red first)

Frontend service/query tests:

1. Service delegates to correct backend method names.
2. Schema accepts valid rows.
3. Schema rejects missing required non-timestamp fields.
4. Schema rejects invalid/missing timestamp fields.
5. Schema rejects missing/blank/non-trimmed `definitionKey`.

### Execution status (Section 3)

- [x] Red tests added — **COMPLETE**
- [x] Red review clean — **COMPLETE** (after one review loop)
- [x] Green implementation complete — **COMPLETE**
- [x] Green review clean — **COMPLETE** (after multiple review loops)
- [x] Checks passed — **COMPLETE** (using executable frontend package targets for `src/services` and `src/query` due root path filter mismatch)
- [x] Action plan updated — **COMPLETE**
- [x] Commit created — **COMPLETE**
- [ ] Push completed — **PENDING**

### Section checks

- `npm run frontend:test -- src/frontend/src/services`
- `npm run frontend:test -- src/frontend/src/query`

### Optional `@remarks` JSDoc follow-through

- None

### Implementation notes / deviations / follow-up

- **Implementation notes:** Added frontend query wiring for `assignmentDefinitionPartials` (query key plus shared query option), plus new assignment-definition partials service methods and Zod schemas covering list and delete contracts.
- **Evidence:** Commit `1e63e1446ad9d0427a3ce6d075481ebf51a1e17e`; commit message `feat(section-3): add frontend assignment-definition list/delete contracts`; branch `feat/assignments-management-v1`; push remains pending.
- **Deviations from plan:** Section checks used executable package targets (`src/services`, `src/query`) instead of repository-root-prefixed paths because of a root path filter mismatch; approved equivalent commands were used.
- **Follow-up implications for later sections:** Red/green review loops resolved test typing and coverage gaps, aligned timestamp/key schema expectations, allowed nullable `yearGroup`/`assignmentWeighting` where required, and tightened timestamp parsing to reject impossible calendar dates.

---

## Section 4 — Dataset-granular startup warm-up

### Objective

- Convert startup warm-up state from single shared failure bit to dataset-granular status.

### Constraints

- Keep existing startup datasets and add `assignmentDefinitionPartials`.
- Classes/Settings must not fail due to assignment dataset failure.
- Assignments must block on assignment dataset trust/readiness only.

### Acceptance criteria

- Warm-up tracks per-dataset readiness/failure.
- `assignmentDefinitionPartials` participates in startup warm-up.
- Classes and Settings behaviour remains unchanged for unrelated dataset failures.
- Assignments uses assignment dataset state to decide loading/blocking.
- Shared warm-up contract consumed by hooks is explicit and test-covered:
  - `snapshot.datasets[datasetKey].status`
  - `snapshot.datasets[datasetKey].isTrustworthy`
  - `isDatasetReady(datasetKey)`
  - `isDatasetFailed(datasetKey)`
- `errorCode` and `requestId` are treated as logging metadata, not required hook-consumer fields.

### Required test cases (Red first)

Frontend auth/warmup tests:

1. Warm-up stores per-dataset state.
2. Assignment dataset failure does not flip classes dataset to failed.
3. Classes feature no longer blocks on unrelated warm-up failures.
4. Assignments blocks when assignment dataset is failed/untrustworthy.

### Section checks

- `npm run frontend:test -- src/frontend/src/features/auth`
- `npm run frontend:test -- src/frontend/src/features/classes`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` where dataset-granular warm-up semantics are non-obvious.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Populate during execution.
- **Deviations from plan:** Populate if needed.
- **Follow-up implications for later sections:** Populate if needed.

---

## Section 5 — Assignments page workflow and UX

### Objective

- Implement the Assignments page surface defined in `ASSIGNMENTS_PAGE_LAYOUT.md` with deterministic sort/filter/reset, manual retry, disabled placeholder create/update buttons, and confirmed single-row delete flow.

### Constraints

- Follow frontend loading/width standards for owned surface behaviour.
- Follow the visible-region, modal, and responsive structure defined in `ASSIGNMENTS_PAGE_LAYOUT.md`.
- Delete must use explicit confirmation modal.
- Retry must refetch assignment dataset only.

### Acceptance criteria

- Assignments page renders loading, ready, empty, and blocking states correctly.
- Page summary copy matches assignment-definition management rather than marking tasks.
- Status/actions card renders retry plus disabled placeholder `Create assignment` and `Update assignment` buttons.
- Visible columns: title, topic, year group, document type, last updated, delete.
- Filters available on all displayed columns and reset restores defaults.
- Filter semantics are pinned and tested:
  - string columns use exact option-value matching against raw row values
  - `yearGroup` uses stringified values with `null` mapped to `—`
  - `updatedAt` uses displayed `DD/MM/YYYY` labels with `null` mapped to `—`
- Manual retry control exists in blocking and ready states and refetches `assignmentDefinitionPartials` only.
- Unsafe-key rows have delete disabled.
- Delete opens confirmation modal with clear permanent-delete copy and confirm-loading.
- Success closes modal, refreshes query, and shows local success feedback.
- Failure keeps row and shows local error feedback.

### Required test cases (Red first)

Frontend page/component tests:

1. State coverage: loading/ready/empty/blocking.
2. Summary copy and status/actions card layout match `ASSIGNMENTS_PAGE_LAYOUT.md`.
3. Disabled placeholder create/update buttons render with helper copy and do not launch a workflow.
4. Filter and reset behaviour across all displayed columns.
5. Retry control triggers only assignment dataset refetch.
6. Unsafe keys disable delete.
7. Delete confirmation modal opens with required copy.
8. Confirm-loading + conflict disabling during mutation.
9. Success flow: refetch + row removed + success feedback.
10. Failure flow: row remains + error feedback.
11. Post-delete refetch failure drives blocking state.

### Section checks

- `npm run frontend:test -- src/frontend/src/pages`
- `npm run frontend:test -- src/frontend/src/features`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` on delete confirmation and fail-closed retry behaviour if non-obvious.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Populate during execution.
- **Deviations from plan:** Populate if needed.
- **Follow-up implications for later sections:** Populate if needed.

---

## Regression and contract hardening

### Objective

- Confirm no regressions in backend transport, startup warm-up, and Classes/Settings behaviour.

### Constraints

- Prefer targeted suites first, then broader lint/test commands.

### Acceptance criteria

- All touched backend and frontend tests pass.
- Classes/Settings unaffected by assignment dataset failures.
- Assignments contract enforcement is consistent backend-to-frontend.

### Required test cases/checks

1. Run touched backend API/controller suites.
2. Run touched frontend service/query/auth/classes/assignments suites.
3. Run backend and frontend lint commands.

### Section checks

- `npm run lint`
- `npm run frontend:lint`
- `npm test -- tests/api tests/controllers`
- `npm run frontend:test -- src/frontend/src/services src/frontend/src/query src/frontend/src/features src/frontend/src/pages`

### Implementation notes / deviations / follow-up

- **Implementation notes:** Populate during execution.
- **Deviations from plan:** Populate if needed.

---

## Documentation and rollout notes

### Objective

- Keep user-facing copy and developer docs aligned with shipped behaviour.

### Constraints

- Update only docs and copy relevant to touched surfaces.

### Acceptance criteria

- Assignments page summary copy matches definition-management purpose.
- `SPEC.md`, `ASSIGNMENTS_PAGE_LAYOUT.md`, and `ACTION_PLAN.md` remain aligned with implementation.
- Any deviations are documented before plan closure.

### Required checks

1. Verify Assignments summary text no longer references marking tasks.
2. Verify page structure and visible states still match `ASSIGNMENTS_PAGE_LAYOUT.md`.
3. Verify new API methods and contracts are reflected in docs/comments.
4. Confirm implementation notes/deviations fields updated before closing delivery.

### Optional `@remarks` JSDoc review

- Confirm whether dataset-granular warm-up or strict validation logic needs persistent `@remarks`.

### Implementation notes / deviations / follow-up

- Populate during execution.

---

## Suggested implementation order

1. Section 1 — Backend list transport contract
2. Section 2 — Backend delete transport contract
3. Section 3 — Frontend schemas/services/query wiring
4. Section 4 — Dataset-granular startup warm-up
5. Section 5 — Assignments page workflow and UX
6. Regression and contract hardening
7. Documentation and rollout notes
