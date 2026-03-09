# ABClassPartials Delivery Plan (TDD-First)

## Scope and assumptions

### Scope

Deliver a lightweight, server-synchronised class partial index that supports fast class-list retrieval while preserving existing full `ABClass` persistence behaviour.

In scope:

- backend model updates (`ABClass` and `ABClassPartials` shape responsibilities)
- controller-managed partial sync on class write paths
- API allowlist + dispatcher support for `getABClassPartials`
- frontend service wrapper for `callApi('getABClassPartials')`
- backend/frontend automated tests aligned with repository testing policy

Out of scope for this phase:

- frontend CRUD UI for class partials
- admin rebuild tooling for the partial index
- non-essential refactors outside touched modules
- broad migration of legacy `src/AdminSheet`-targeted tests (tracked separately in another branch)

### Assumptions

1. A class partial includes all class-level fields needed for list rendering, excluding `students` and `assignments`.
2. Class partial persistence is **one document per class** in `abclass_partials`, keyed by `classId`.
3. `active` is an explicit persisted boolean property on `ABClass` and must be returned via partial payloads.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API entry points thin; delegate behaviour to controllers/services.
- Fail fast on invalid inputs and persistence failures.
- Do not hide internal wiring issues behind defensive guards.
- Keep changes minimal, localised, and consistent with existing backend/frontend patterns.
- Use British English in all comments/docs/user-facing text.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section’s acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Validation commands hierarchy

- Backend lint: `npm run lint`
- Frontend lint: `npm run frontend:lint`
- Builder lint (only if touched): `npm run builder:lint`
- Backend tests: `npm test -- <target>` (or broader `npm test`)
- Frontend unit tests: `npm run frontend:test -- <target>`
- Frontend e2e (only if visible UX changes): `npm run frontend:test:e2e -- <target>`

---

## Section 1 — Define and lock class-partial data contract

### Objective

Define a single authoritative partial shape for class listing and assert it in tests before persistence and API wiring.

### Constraints

- Partial payload must exclude heavy nested arrays (`students`, `assignments`).
- Partial payload must include `active`.
- Keep serialisation deterministic.

### Acceptance criteria

- `ABClass` serialisation includes `active` in full JSON.
- `ABClass` serialisation/hydration symmetry is corrected for `classOwner` so owner data is not dropped on round-trip.
- Partial generation helper produces stable shape containing expected class-level fields only.
- Partial payload never includes `students`/`assignments`.

### Required test cases (Red first)

Backend model tests:

1. `ABClass.toJSON()` includes `active` when explicitly set.
2. `ABClass.fromJSON()` restores `active` correctly.
3. `ABClass.toJSON()` includes `classOwner` and `ABClass.fromJSON()` restores it.
4. Partial generation returns expected keys (`classId`, `className`, `cohort`, `courseLength`, `yearGroup`, `classOwner`, `teachers`, `active`).
5. Partial generation omits `students` and `assignments`.
6. Partial generation is stable when optional class fields are null.

### Section checks

- `npm test -- tests/models/<abclass-related>.test.js`

### Implementation notes / deviations / follow-up

- **Implementation notes:**
- **Deviations from plan:**
- **Follow-up implications for later sections:**

---

## Section 2 — Persist class partials as document-per-class registry

### Objective

Implement controller-owned upsert logic that writes one class partial document per `classId` in `abclass_partials`.

### Constraints

- Upsert must be idempotent by `classId`.
- Persistence must be controller-driven (no client-side sync responsibility).
- Keep `DbManager` usage aligned with existing collection patterns.

### DRY persistence approach (single write-through path)

To keep persistence in one place, introduce a single controller-owned write-through method (for example `_persistClassAndPartial(abClass, options)`) that always:

1. writes the full class document
2. upserts the class partial document by `classId`
3. saves both collections

All class-mutating flows (`saveClass`, roster refresh persistence helpers, and any future class metadata update methods) should call this method rather than writing collections directly.

### Acceptance criteria

- Saving a class uses a single write-through persistence method for both full and partial records.
- Saving a class upserts the corresponding partial document in `abclass_partials`.
- Existing partial document is replaced for the same `classId`.
- New partial document is inserted when no existing document matches.
- Persistence errors surface loudly.

### Required test cases (Red first)

Backend controller tests:

1. `saveClass()` inserts partial doc when missing.
2. `saveClass()` replaces partial doc when existing `classId` is found.
3. Upsert filter is `classId` (not index/order dependent).
4. Partial registry write failure throws and is logged per contract.
5. Full class save still persists successfully when partial upsert succeeds.
6. `saveClass()` and other class write paths call the same internal write-through helper (no duplicated persistence logic).

### Section checks

- `npm test -- tests/controllers/abclass-controller-partials.test.js`

### Implementation notes / deviations / follow-up

- **Implementation notes:**
- **Deviations from plan:**
- **Follow-up implications for later sections:**

---

## Section 3 — Synchronise all relevant class write paths

### Objective

Guarantee partial-index consistency by invoking partial upsert from every class mutation path that persists class data.

### Constraints

- Cover both explicit class saves and roster/metadata persistence helpers.
- Avoid duplicate sync logic by centralising helper calls.
- Reuse the same write-through helper introduced in Section 2.
- No silent skip paths.

### Acceptance criteria

- All class persistence paths that alter class-level list data keep `abclass_partials` in sync.
- No stale partials after roster refresh persistence.
- Behaviour remains deterministic under repeated writes.

### Required test cases (Red first)

Backend controller tests:

1. Roster persistence helper triggers partial upsert.
2. Repeated saves do not create duplicate partial docs for same `classId`.
3. Partial reflects changed class metadata after refresh/save cycle.
4. If roster persistence fails, method throws and does not report success.

### Section checks

- `npm test -- tests/controllers/abclass-roster-sync.test.js`

### Implementation notes / deviations / follow-up

- **Implementation notes:**
- **Deviations from plan:**
- **Follow-up implications for later sections:**

---

## Section 4 — Implement read path for all class partials

### Objective

Expose a controller read method that returns all partial documents for API use.

### Constraints

- Read path should return serialisable plain objects suitable for transport.
- Empty registry returns an empty array (not null/undefined).
- Preserve stable ordering only if explicitly required by existing consumers; otherwise keep minimal behaviour.

### Acceptance criteria

- `getAllClassPartials()` reads from `abclass_partials` and returns all docs.
- Empty collection returns `[]`.
- Read errors propagate clearly.

### Required test cases (Red first)

Backend controller tests:

1. Returns all stored partial docs.
2. Returns empty array when registry has no docs.
3. Throws on collection read failure.

### Section checks

- `npm test -- tests/controllers/abclass-partials-read.test.js`

### Implementation notes / deviations / follow-up

- **Implementation notes:**
- **Deviations from plan:**
- **Follow-up implications for later sections:**

---

## Section 5 — API allowlist and dispatcher wiring

### Objective

Expose `getABClassPartials` via `apiHandler` using allowlist and thin dispatch rules.

### Constraints

- Add method to `API_METHODS` and `API_ALLOWLIST`.
- Keep `apiHandler` envelope contract unchanged.
- Dispatcher branch should delegate only; no business logic in handler.

### Acceptance criteria

- `API_METHODS` and `API_ALLOWLIST` contain `getABClassPartials`.
- `apiHandler` accepts `method: 'getABClassPartials'` and returns success envelope with partial data.
- Unknown methods remain rejected.
- Controller/API errors are mapped by existing transport error rules.

### Required test cases (Red first)

API-layer tests:

1. `API_METHODS` exposes `getABClassPartials`.
2. `API_ALLOWLIST` maps `getABClassPartials` correctly.
3. Allowlisted method dispatches to `getABClassPartials` handler.
4. Success envelope contains returned data.
5. Unknown method still returns `UNKNOWN_METHOD`.
6. Controller-thrown error maps to expected failure envelope.

### Section checks

- `npm test -- tests/requestHandlers/<api-handler>.test.js`

### Implementation notes / deviations / follow-up

- **Implementation notes:**
- **Deviations from plan:**
- **Follow-up implications for later sections:**

---

## Section 6 — Frontend service integration

### Objective

Provide a typed frontend service wrapper for retrieving class partials through `callApi`.

### Constraints

- Frontend must call transport through `callApi`, not direct `google.script.run` usage.
- Keep service thin and deterministic.
- No UI behavioural changes unless explicitly required.

### Acceptance criteria

- Service calls `callApi('getABClassPartials')` with expected method name.
- Service returns typed payload.
- API errors propagate to caller without suppression.

### Required test cases (Red first)

Frontend unit tests:

1. Service delegates to `callApi` with `getABClassPartials`.
2. Service resolves with backend payload.
3. Service rejects when `callApi` rejects.

### Section checks

- `npm run frontend:test -- src/services/<class-partials-service>.spec.ts`

### Implementation notes / deviations / follow-up

- **Implementation notes:**
- **Deviations from plan:**
- **Follow-up implications for later sections:**

---

## Deferred work (separate branch)

- Migrate/add broader backend tests away from `src/AdminSheet/**` references to `src/backend/**` for full coverage parity.
- This is intentionally excluded from this branch to keep ABClassPartials delivery scope focused.

---

## Section 7 — Regression and contract hardening

### Objective

Run targeted regressions across touched backend and frontend areas and ensure no contract drift.

### Constraints

- Prefer focused test runs first, then broaden where needed.
- Keep assertions at behaviour level (contract/inputs/outputs).

### Acceptance criteria

- Touched model/controller/API/frontend tests pass.
- No regressions in existing ABClass assignment hydration flows.
- Lint passes for touched runtimes.

### Required test cases/checks

1. Run touched backend model/controller/API suites.
2. Run touched frontend service suite.
3. Run backend lint + frontend lint.
4. If any visible frontend change occurred, run targeted e2e.

### Section checks

- `npm run lint`
- `npm run frontend:lint`
- `npm test -- tests/models/`
- `npm test -- tests/controllers/`
- `npm test -- tests/requestHandlers/`
- `npm run frontend:test -- src/services/`

### Implementation notes / deviations / follow-up

- **Implementation notes:**
- **Deviations from plan:**
- **Follow-up implications for later sections:**

---

## Section 8 — Final documentation and rollout readiness

### Objective

Ensure developer-facing documentation accurately reflects the implemented persistence and API behaviour.

### Constraints

- Update only relevant docs.
- Keep docs concise and aligned with source-of-truth backend/frontend guidance.

### Acceptance criteria

- Data-shape and API docs reflect class-partial contract and `active` behaviour.
- Any implementation deviations are captured in this file’s section notes.
- Rollout caveats and maintenance hooks are documented if needed.

### Required checks

1. Verify docs reference the document-per-class registry strategy.
2. Verify docs reference `getABClassPartials` transport pattern.
3. Confirm notes/deviations fields are completed during implementation.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
- **Deviations from plan:**
- **Follow-up implications for later sections:**

---

## Stage exit criteria (all must pass)

- Class partial contract implemented and tested.
- Partial registry persisted as one doc per `classId` and synchronised on class write paths.
- API allowlist + dispatcher path for `getABClassPartials` implemented and tested.
- Frontend service wrapper implemented and tested.
- Relevant lint and tests pass.
- Section notes populated with decisions/deviations to support future work.

---

## Suggested implementation order

1. Section 1 (data contract)
2. Section 2 (persistence upsert)
3. Section 3 (sync all write paths)
4. Section 4 (read path)
5. Section 5 (API transport)
6. Section 6 (frontend service)
7. Section 7 (regression gates)
8. Section 8 (docs and rollout notes)
