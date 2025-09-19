# AssessmentBot Long-Term Singleton & Lazy Initialisation Refactor (Option B)

This document is a structured, multi-phase implementation plan to migrate from eager global singleton instantiation to a fully lazy, test‑verified architecture. It prioritises test scaffolding first so regressions and performance wins can be measured confidently.

---

## Guiding Principles

- **No eager side-effects at file load** (except truly constant definitions).
- **Deterministic, idempotent `getInstance()`** methods for all singletons.
- **Separation of construction vs. heavy initialisation** (`ensureInitialized()` / `ensure<Class>()`).
- **Avoid hidden circular dependencies** by deferring cross‑singleton access to call sites.
- **Backward compatible transition**: replace direct global identifiers before removing the old shim.
- **Tests prove both: (a) no work until needed; (b) exactly-once initialization when needed.**

---

## Phase 0: Test & Measurement Foundation ✅

### ✅ Goals

- Capture current behaviour (baseline) and enable asserting laziness once refactor proceeds.
- Provide utilities to spy / stub heavy calls (e.g. DriveApp / PropertiesService) inside tests.

### Tasks

- [x] Add lightweight _instrumentation helpers_ (test-only) to count constructor runs & heavy init calls.
- [x] Create a `__mocks__/` (or inline mocks) layer for Apps Script globals used in singleton constructors: `PropertiesService`, `SpreadsheetApp`, `DriveApp`, `HtmlService` (only minimal methods).
- [x] Add a `SingletonTestHarness` utility to:
  - [x] Reset static `_instance` fields (e.g. `ConfigurationManager._instance = null`).
  - [x] Provide `withFreshSingleton(Class, fn)` wrapper to run code in a clean state.
- [x] Write baseline tests (they will initially FAIL once we enforce laziness; mark with `.skip` until refactor lands):
  - [x] `configurationManager does not touch PropertiesService until first getter is called`.
  - [x] `InitController does not instantiate UIManager until UI method invoked`.
  - [x] `UIManager does not create GoogleClassroomManager until a classroom-related method is called`.
  - [x] `ProgressTracker remains already-lazy (control test)`.
- [x] Add performance smoke test (non‑assertive): measure timestamps around first access vs. second access (log only for now).
- [x] Document how to run only singleton tests (e.g. `npm test -- singleton`).

---

## Phase 1: Introduce/Normalise getInstance() Patterns

### ✅ Goals

Make every singleton class expose a canonical `static getInstance()` without side effects, and ensure constructors become _lightweight_.

### Tasks

- [ ] `ConfigurationManager`:
  - [ ] Add / confirm `static getInstance()` returning `_instance`.
  - [ ] Remove heavy work from constructor (move deserialisation call out).
  - [ ] Introduce `_initialized = false` + `ensureInitialized()`.
  - [ ] Ensure all getters/setters call `ensureInitialized()` at start (or only those that need persisted properties—decide and document).
- [ ] `InitController`:
  - [ ] Add `static getInstance()`.
  - [ ] Remove eager UI construction.
  - [ ] Add `getUiManager()` lazy wrapper.
- [ ] `UIManager`:
  - [ ] Ensure `static getInstance()` pattern symmetrical.
  - [ ] Move `GoogleClassroomManager` creation to `ensureClassroomManager()`.
  - [ ] Optionally defer UI availability probe until first UI op (`probeUiIfNeeded()`).
- [ ] Confirm `ProgressTracker` already conforms—add minor internal consistency comments.
- [ ] Add `resetForTests()` static method to each singleton (used by harness).
- [ ] Update ESLint globals if needed (remove now-unused global singleton variable names later in Phase 3).

### Tests

- [ ] Update previously skipped tests to active; ensure they now pass for adjusted classes.
- [ ] Add new tests for multi-call idempotency: calling `getInstance()` 10x returns same object & constructor only once.

---

## Phase 2: Extract Heavy Initialisation

### ✅ Goals

Anything that performs I/O, property deserialisation, Drive or Classroom interaction should be behind an explicit lazy boundary.

### Tasks

- [ ] `ConfigurationManager.maybeDeserializeProperties()` is only called inside `ensureInitialized()`.
- [ ] Guard any Drive access in `ConfigurationManager` (e.g. `isValidGoogleSheetId`) so they are only invoked when those specific validators run (normal usage unaffected).
- [ ] In `UIManager`, wrap Classroom operations:
  - [ ] Replace direct `this.classroomManager` usages with `const cm = this.ensureClassroomManager();`.
  - [ ] Ensure non-classroom UI calls (like showing generic modal) don’t instantiate classroom manager.
- [ ] For `InitController`, ensure methods that don’t need UI (maybe later) skip UI instantiation (e.g. pure config logic).
- [ ] Optional: Add a feature flag environment var (test-only) to assert when heavy paths are crossed (e.g. `global.__TRACE_SINGLETON__ = true`).

### Tests

- [ ] Assert that calling a config setter that touches only script properties triggers initialisation (if by design) or does not (if selectively lazy—document expected behaviour explicitly in test name).
- [ ] Assert `showAssignmentDropdown()` creates classroom manager (exactly once) and subsequent calls don’t recreate it.

---

## Phase 3: Remove Global Eager Singleton Exports (`z_singletons.js`)

### ✅ Goals

Eliminate `const configurationManager = new ConfigurationManager();` etc. Replace with explicit `Class.getInstance()` across codebase.

### Tasks

- [ ] Search & replace references:
  - [ ] `configurationManager.` → `ConfigurationManager.getInstance().`
  - [ ] `initController.` → `InitController.getInstance().`
  - [ ] Any direct `new ConfigurationManager()` (keep only inside tests where intentionally verifying constructor behaviour; otherwise swap).
- [ ] Remove lazy accessor or constant definitions in `z_singletons.js`.
- [ ] Replace file contents with a comment explaining deprecated role or delete file if safe.
- [ ] Update any HTML Service templates that might refer to globals (ensure front-end calls server-side functions that internally call `getInstance()`).
- [ ] Run full test suite.

### Tests

- [ ] Add regression test ensuring that no forbidden global identifiers remain (simple regex scan in a test or lint rule).
- [ ] Optional ESLint custom rule or config update to disallow banned identifiers.

---

## Phase 4: Documentation & Developer Experience

### ✅ Goals

Ensure future contributors follow the lazy pattern and do not reintroduce eager side effects.

### Tasks

- [ ] Add `docs/howTos/singletons.md` with: pattern, anti-pattern examples, test conventions.
- [ ] Update `README.md` (short note linking to the detailed doc).
- [ ] Add a PR checklist item: “No eager heavy work in top-level scope”.
- [ ] Add ESLint rule (custom or config comment) forbidding `new <Singleton>` outside its defining module or tests.

### Tests / Tooling

- [ ] Optional: Add a lint script that greps for `new ConfigurationManager(` outside definition & test directories.

---

## Phase 5: Performance Verification & Telemetry (Optional but Recommended)

### ✅ Goals

Quantify improvement and guard against future regressions.

### Tasks

- [ ] Add a diagnostic script (GAS function) `logSingletonColdStart()` capturing timestamps pre/post first UI/modal call.
- [ ] Manual measurement before & after (record in `docs/perf/` log file).
- [ ] (Optional) Introduce lightweight timing utility to log when `ensureInitialized()` crosses heavy boundary (only when a `DEBUG_LAZY_INIT` flag is set).

### Tests

- [ ] Non-blocking smoke test that runs a sequence of calls and asserts heavy path counts remain within expected bounds.

---

## Phase 6: Cleanup & Hardening

### ✅ Goals

Remove transitional code, enforce invariants.

### Tasks

- [ ] Delete any deprecated helpers introduced early (if replaced by final harness approach).
- [ ] Ensure all singletons have JSDoc stating: “Use Class.getInstance(); do not call constructor directly.”
- [ ] Freeze singleton instances optionally (`Object.freeze(instance)`) if mutation not required.
- [ ] Verify no accidental global leakage (`Object.keys(this)` in a GAS context test harness if feasible).

### Tests

- [ ] Add a test ensuring that calling constructor directly returns same instance but does not duplicate side effects.
- [ ] Add test ensuring `Object.is(UIManager.getInstance(), UIManager.getInstance())` is true.

---

## Phase 7: Future Enhancements (Backlog)

- [ ] Introduce a lightweight **Service Registry** for dependency overrides in tests.
- [ ] Move from ad-hoc singletons to a DI-friendly factory pattern for possible future multi-context execution.
- [ ] Add metrics export (counts of how many times heavy initialisation occurred) for runtime monitoring.
- [ ] Consider a build-time transform (or lint) that blocks direct top-level invocation of disallowed APIs.

---

## Acceptance Criteria Summary

- [ ] No heavy initialisation (Drive / Properties / Classroom) before an explicit method requiring it is called.
- [ ] All singleton classes use `static getInstance()` and guard heavy work with `ensure*` functions.
- [ ] All production code uses `ClassName.getInstance()` and not global variables or `new` calls.
- [ ] Tests cover: laziness, idempotency, one-time heavy init, regression on accidental eager code.
- [ ] Documentation updated and enforced via lint / PR checklist.

---

## Risk Mitigations

| Risk                                       | Mitigation                                        |
| ------------------------------------------ | ------------------------------------------------- |
| Hidden dependency order assumptions        | Add tests resetting & reordering loads (simulate) |
| Missed replacement of a global singleton   | Regex scan + ESLint rule                          |
| Future contributor reintroduces eager work | Doc + PR checklist + lint rule                    |
| Subtle performance regression              | Optional telemetry counters + perf log            |
| Circular dependency after refactor         | Defer cross-calls to inside methods only          |

---

## Implementation Notes & Conventions

- Singleton static field naming: `ClassName._instance` (private-ish convention) + `getInstance()`.
- Use `ensureInitialized()` naming for “one-time heavy setup”, `ensure<Class>()` for ancillary component instantiation.
- In tests, prefer black-box behaviour verification (call public API) over reaching into private flags unless necessary.
- If adding timing logs, gate behind `if (globalThis.DEBUG_LAZY_INIT)` to avoid production noise.

---

## Quick Reference (Cheat Sheet)

| Pattern              | Snippet                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------- | --- | -------------------------------------------------------- |
| Standard getInstance | `static getInstance(){ return this.\_instance                                                   |     | (this.\_instance=new ThisClass(true)); }`                |
| Guard init           | `ensureInitialized(){ if(this._initialized) return; /* heavy work */ this._initialized=true; }` |
| Lazy sub-component   | `ensureClassroomManager(){ return this.classroomManager                                         |     | (this.classroomManager=new GoogleClassroomManager()); }` |
| Test reset           | `static resetForTests(){ this._instance=null; }`                                                |

---

## Tracking Progress

(Use these master checkboxes as you move through phases.)

- [x] Phase 0 – Test scaffolding
- [ ] Phase 1 – Standardise getInstance
- [ ] Phase 2 – Extract heavy init
- [ ] Phase 3 – Remove global singletons
- [ ] Phase 4 – Documentation & DX
- [ ] Phase 5 – Performance verification
- [ ] Phase 6 – Cleanup & hardening
- [ ] Phase 7 – (Optional backlog items)

---

Happy refactoring. This roadmap is intentionally granular so you can pause safely between phases while keeping the codebase stable.
