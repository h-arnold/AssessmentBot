# Feature Delivery Plan (TDD-First): Application Authentication & Minimal Role Administration

## Read-First Context

Before writing or executing this plan:

1. Read `@SPEC.md` (Draft v1.3) — product behaviour, bootstrap state machine, contracts.
2. Read `@AUTHENTICATION_SETTINGS_LAYOUT.md` — settings tab layout, role delivery, gate states.
3. Read `@docs/developer/data-shapes/auth-users.md` (planned contract, `Not implemented`) and
   `@docs/developer/data-shapes/backend-config.md` / `@docs/developer/data-shapes/auth-cache.md`
   (planned-change blocks) — the target contracts this plan implements.
4. Treat those documents as the source of truth; do not restate or redefine settled material here.

## Scope and assumptions

### Scope

- Backend: config schema changes (`'none'` removal, `authUsers`/`authRevision`), locked
  configuration write path, `ConfigurationManager` decomposition, `AuthService` base +
  two provider subclasses, bootstrap claim, three new `z_Api` endpoints, `apiConfig`
  auth-field rejection and locked-write migration, trigger never-claim context.
- Frontend: auth-field removal from the backend settings surface, new
  `applicationAccess`/`authenticationSettings` services, `AppAuthGate` rework with role
  context and reason states, new admin-only Authentication settings tab with staged user
  list and mode-switch modal, Settings page tab gating.
- Data-shape docs: remove `Not implemented` markers as shapes land.
- Docs: `application-authentication.md`, `accepted-risks.md`, `src/backend/AGENTS.md` §2.3,
  release notes with the manual-seed procedure.

### Out of scope

- Everything listed under `SPEC.md` "Defer from v1" (group editing, bulk import, broader
  RBAC, alias normalisation).
- The dead `maybeDeserializeProperties()`/`PropertiesCloner` removal — a separate
  prerequisite workstream (see Assumption 1).
- Any change to the transport envelope structure (`transport-envelope.md`).

### Assumptions

1. The dead propertiesStore clone path (`maybeDeserializeProperties()` /
   `PropertiesCloner`) is removed in a separate workstream **before** Section 2 starts.
   This plan assumes it is gone; if it is still present, stop and escalate.
2. The `AuthUserEntry` storage, endpoint shapes, reason enum, and revision semantics are
   fixed by `@docs/developer/data-shapes/auth-users.md`; implementation conforms to it.
3. The existing Google Groups cache key format is unchanged; the Script Properties
   provider has no success cache.
4. `z_apiHandler.js` (515 lines, projected ~560–580) remains a single registry file: its
   growth is limited to allowlist/exemption/admin-required set entries, and the repo's
   `z_Api` §12 rule groups domain _files_, not the registry. This is a deliberate,
   documented exception — do not split the registry.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API/entry points thin; validation ownership per `src/backend/AGENTS.md` §1.2.
- Fail fast and loudly; no empty catches; `ABLogger` for all new backend code.
- GAS compatibility: trailing-underscore privates, guarded `module.exports` only,
  numeric-prefix load order preserved, no Node wiring in production backend files.
- Frontend: Zod-first schemas with `z.infer`, `callApi` transport only, `App.useApp()`
  context-aware message APIs, 8px spacing tokens, `.strict()` schema lockstep with
  deploy-order tolerance as documented in `backend-config.md`.
- Default values in constructors only; no speculative scope expansion.
- All configuration writes (auth and ordinary) go through the locked write path; the
  8KB blob cap is enforced on every write; no config write runs while a DB operation
  holds the script lock.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

For each delegated phase, list required documentation as `@`-prefixed worktree-relative
paths in the delegation prompt, require `Files read` evidence in the handoff, verify
every mandatory file is listed, and return the work to the same sub-agent if anything
is missing before progressing.

Per-phase baseline mandatory reads (extend per section as listed):

- All phases: `@AGENTS.md`, the component `AGENTS.md` for touched code, `@SPEC.md`,
  `@AUTHENTICATION_SETTINGS_LAYOUT.md` (frontend phases), `@ACTION_PLAN.md` (this file).
- Backend implementation/review: `@src/backend/AGENTS.md`,
  `@docs/developer/backend/backend-logging-and-error-handling.md`,
  `@docs/developer/backend/api-layer.md`, `@docs/developer/backend/singletons.md`,
  `@docs/developer/data-shapes/auth-users.md`.
- Frontend implementation/review: `@src/frontend/AGENTS.md`,
  `@docs/developer/frontend/frontend-logging-and-error-handling.md`,
  `@docs/developer/frontend/frontend-spacing-and-padding-standards.md`,
  `@docs/developer/frontend/frontend-loading-and-width-standards.md`.
- Testing Specialist: `@docs/developer/backend/backend-testing.md` or
  `@docs/developer/frontend/frontend-testing.md` as applicable.
- Playwright: `@docs/developer/frontend/frontend-playwright-e2e.md`.
- Docs phase: `@docs/developer/data-shapes/INDEX.md` and the touched contract files.

### Data-shape planning gate (mandatory per section)

Sections that change a schema, persistence model, API contract, or transport shape must
reference the relevant data-shape doc(s) with `Not implemented` planned entries and
remove those markers as the shapes land:

- Sections 1–2: `backend-config.md` (auth fields leave transport; 8KB cap) and
  `auth-users.md` (persistence block).
- Sections 3–5: `auth-users.md` (transport block), `auth-cache.md` (no scriptProperties
  cache; bypass semantics).
- Sections 7–10: `auth-users.md` (frontend Zod lockstep), `backend-config.md`
  (schema/panel field removal).

### Shared-helper planning gate (mandatory when helper changes are expected)

Helper decisions are recorded per section (decision, owning path, call-site rationale)
with planned entries in canonical docs marked `Not implemented`, reconciled in the
Documentation section.

### Validation commands hierarchy

- Backend lint: `npm run lint:backend`
- Frontend lint: `npm run lint:frontend`
- Backend tests: `npm run test:backend -- <target>`
- Frontend unit tests: `npm run test:frontend -- <target>`
- Frontend E2E (Sections 10–11): `npm run test:frontend:e2e -- <target>`

---

## Section 1 — Config schema and storage foundations

### Objective

- Extend the configuration schema: remove `'none'`, add `authUsers` (JSON string array)
  and `authRevision` (positive integer string) with strict security-read validation, the
  single absent-`authMode`-with-group leniency, and the 8KB blob cap constant.

### Constraints

- Strict deny decisions belong to the access-resolution path (Section 3), not the
  forgiving transport getter; the getter stays best-effort and must not throw.
- The leniency (absent `authMode` + non-blank `authGroupEmail` → `googleGroups`) applies
  to existing blobs only and is documented in `auth-users.md`.
- Preserve `01_`/`02_` load-order numbering; keep validators in `CONFIG_SCHEMA` using
  the existing `(value, instance)` validator precedent.

### Delegation mandatory reads

- Implementation: `@SPEC.md`, `@src/backend/AGENTS.md`, `@docs/developer/data-shapes/auth-users.md`,
  `@docs/developer/data-shapes/backend-config.md`, `@src/backend/ConfigurationManager/01_configKeysAndSchema.js`,
  `@src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`.
- Testing Specialist: `@docs/developer/backend/backend-testing.md`, `@SPEC.md`,
  `@docs/developer/data-shapes/auth-users.md`.

### Data-shape plan

- Record implemented `authUsers`/`authRevision` validator rules against the
  `auth-users.md` persistence block; leave the `Not implemented` marker until Section 5
  lands the transport.

### Shared helper plan

1. Helper: `validateAuthUsersJson` / `validateAuthRevision` (CONFIG_SCHEMA validators)
   - Decision: `keep local` to `01_configKeysAndSchema.js` unless `Validate.js` already
     offers a reusable integer-string validator — prefer `extend` in that case.
   - Owning path: `src/backend/ConfigurationManager/01_configKeysAndSchema.js`
   - Call-site rationale: domain-specific storage validation; generic pieces reuse `Validate`.
   - Relevant canonical doc target: `docs/developer/data-shapes/auth-users.md` (validation block).

### Acceptance criteria

- `'none'` is rejected by the `authMode` schema validator; stored `'none'` values fail
  the strict security read but do not throw in the forgiving getter.
- `authUsers` accepts only a JSON string array of `{ email, role }` entries with
  trimmed/lowercased unique emails, known roles, no unknown keys, ≥1 admin.
- `authRevision` accepts only positive-integer strings.
- The 8KB cap constant exists and is exported for the write path (Section 2 consumes it).

### Required test cases (Red first)

Backend config schema tests:

1. `authMode` schema rejects `'none'` and any unrecognised mode; accepts the two valid modes.
2. Strict security read: stored `'none'`, absent mode without group → invalid; absent mode
   with non-blank group → reads as `googleGroups`.
3. `authUsers` rejects: malformed JSON, non-array, duplicates, unknown roles, unknown keys,
   blank/unnormalised emails, zero admins; accepts a valid list.
4. `authRevision` rejects `'0'`, `'abc'`, `''`; accepts `'1'`.
5. 8KB cap constant exported and correct.

### Section checks

- `npm run test:backend -- <config schema tests>`
- `npm run lint:backend`
- Data-shape gate: `auth-users.md` validation block matches implementation.
- Mandatory-read evidence gate passed for all delegated handoffs.

### Optional `@remarks` JSDoc follow-through

- `@remarks` on the strict-vs-forgiving read distinction (why the getter must not throw)
  and on the single leniency (why it exists and its reachability).

### Implementation notes / deviations / follow-up

- **Completed (commit `69069d6`, pushed to `feat/ScriptPropertiesAuthService`):**
  schema validators, strict security read, forgiving getter, and 8KB cap constant
  landed with 2,017 backend tests passing and a clean Code Reviewer re-review.
- The Section 1 regression check identified a transient warning delta because
  `98_ConfigurationManagerClass.js` grew from 647 to 668 lines. This was resolved by
  the mandatory Section 2 decomposition; no `ConfigurationManager` max-lines warning
  remains.
- Shared-helper decision: the auth validators remain local to
  `01_configKeysAndSchema.js`; no existing generic helper covered positive-integer
  strings without weakening the domain contract.

---

## Section 2 — ConfigurationManager decomposition, locked write path, freshness detection

### Objective

- Decompose the oversized `ConfigurationManager` implementation (§11 facade pattern),
  then add the script-wide locked write path and the freshness-detection method.

### Constraints — file separation by LOC (mandatory)

- `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`: **current 697
  lines**; the section's additions push the _aggregate_ concern to **~850 projected**.
  It already exceeds the 550-line §11 threshold, so decompose **before** adding new
  concerns. Because the class already lives in its own domain folder
  (`src/backend/ConfigurationManager/`), the §11 facade pattern is realised as
  **sibling files in that folder** (no nested same-name subfolder):
  - Replace `98_ConfigurationManagerClass.js` with a small **facade** file that preserves
    the public `ConfigurationManager` API and `getInstance()` exactly and delegates to
    sub-classes injected via a single options object (per §11).
  - Extract sub-classes as numbered sibling files that load **before** the facade, e.g.
    `96_ConfigurationManagerStorage.js` (blob read/serialise/parse),
    `97_ConfigurationManagerDefaults.js` (`ensureDefaultConfiguration()` seeding), and
    `97_ConfigurationManagerLockedWrite.js` (the new locked write path + freshness
    method, built in this section).
  - Verify `scripts/builder` concatenation order guarantees sub-classes evaluate before
    the facade (numeric prefixes preserve the existing load-order signposts).
  - Keep all existing method names/signatures; update `tests/setupGlobals.js` and test
    imports to the new paths.
  - LOC guard applies per file: facade ~150; each sub-class well under 550.
- Locked write path behaviour (from `SPEC.md` decision 12): same
  `LockService.getScriptLock()` as `DbLockService`; under the lock, re-read the blob
  from storage (never the execution cache), merge, write once; enforce the 8KB cap on
  every write; contention yields a retriable validation error envelope, never a silent
  drop; never invoked while a DB operation holds the script lock.
- Freshness detection is a `ConfigurationManager` method: let initialisation run, then
  read raw Script Properties for `__CONFIG_STORE_KEY__` absence (never the cache).

### Delegation mandatory reads

- Implementation: `@SPEC.md`, `@src/backend/AGENTS.md` (§11 especially),
  `@docs/developer/data-shapes/auth-users.md`, `@src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`,
  `@src/backend/ConfigurationManager/01_configKeysAndSchema.js`,
  `@scripts/builder/vendor/jsondbapp/src/03_services/DbLockService.js` (lock interplay).
- Testing Specialist: `@docs/developer/backend/backend-testing.md`, `@SPEC.md`,
  `@src/backend/AGENTS.md`.

### Data-shape plan

- Update `backend-config.md` planned block: the locked-write behaviour and cap are now
  implemented (remove those markers when green).

### Shared helper plan

1. Helper: locked write path (`writeConfigurationLocked(mutator)` style)
   - Decision: `new`, owned by `ConfigurationManagerLockedWrite.js`, consumed by
     `ConfigurationManager` facade and later by `apiConfig.js` (Section 6).
   - Call-site rationale: single serialisation point for ALL configuration writes.
   - Relevant canonical doc target: `backend-config.md` planned block.

### Acceptance criteria

- All existing `ConfigurationManager` tests pass unchanged after decomposition (public
  API identical); no file in the folder exceeds 550 lines.
- A write under the lock re-reads storage; a concurrent mocked writer's change is not
  clobbered.
- Lock contention produces a retriable validation error envelope; the blob is unchanged.
- Writes exceeding the 8KB cap are rejected with the blob unchanged.
- Freshness method returns true only when `__CONFIG_STORE_KEY__` is absent from raw
  storage after initialisation.

### Required test cases (Red first)

Backend tests:

1. Facade preservation: every public method exists with identical signature (regression
   suite green post-split).
2. Locked merge: simulate an out-of-band storage mutation between read and write; merged
   result contains both changes.
3. Contention: lock unavailable → retriable validation error envelope, no write.
4. Cap: blob over 8KB → rejected, no partial write.
5. Freshness: absent key → true; present (even `{}`) → false; returns false after the
   propertiesStore area is consulted (post-initialisation ordering).
6. No config write path bypasses the lock (all setters route through it).

### Section checks

- `npm run test:backend -- <configuration manager tests>`
- `npm run lint:backend`
- LOC check: facade and every sub-class file ≤ 550 lines (aggregate concern ~850 is
  spread across the sibling files, not concentrated in one).
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- `@remarks` on the facade explaining the §11 decomposition and the lock-sharing
  relationship with `DbLockService` (non-reentrancy).

### Implementation notes / deviations / follow-up

- **Completed and pushed.** Implementation commit `d6101a8`
  (`refactor(config): serialize configuration writes`) on branch
  `feat/ScriptPropertiesAuthService`; push to `origin` confirmed on 2026-09-08.
- Added `96_ConfigurationManagerStorage.js` (81 lines),
  `97_ConfigurationManagerDefaults.js` (57 lines), and
  `97_ConfigurationManagerLockedWrite.js` (118 lines). The facade remains at the
  import-compatible `98_ConfigurationManagerClass.js` path and is 424 lines; this is
  above the approximate 150-line target because it preserves and delegates the full
  existing public method surface, but is below both the 500-line lint threshold and
  the mandatory 550-line section limit.
- Builder ordering was verified from the locale-sorted backend-copy step: `96_` and
  both `97_` siblings evaluate before the `98_` facade.
- The first Green review found that real setters merged from stale `configCache`.
  A failing real-setter concurrency test was added, then `setProperty` was corrected
  to merge from the locked callback's fresh `current` snapshot. Re-review: **CLEAN**.
- Section checks before the regression gate: focused suite 11/11; ConfigurationManager
  suites 168/168; full backend suite 2,028/2,028; backend lint has zero errors and only
  12 accepted unrelated max-lines warnings. The Section 1 `ConfigurationManager`
  max-lines warning is cleared.
- Data-shape gate complete: `backend-config.md` marks locked persistence and the 8KB
  cap implemented while retaining planned markers for transport/frontend work.
- Regression gate passed against the original branch baseline on 2026-09-08:
  **0 regressions, 0 new failures, 1 fix**. All eight checks are unchanged or
  improved; `backend-lint-check` retains 12 accepted pre-existing unrelated
  max-lines warnings, and the `ConfigurationManager` warning is removed.
- Shared-helper decision implemented as planned: `writeConfigurationLocked(mutator)`
  is owned by `ConfigurationManagerLockedWrite` and exposed through the facade as the
  single serialisation point for persistent configuration setters.

---

## Section 3 — AuthService refactor: base + two provider subclasses

### Objective

- Refactor `AuthService` into base + `GoogleGroupsAuthService` + `ScriptPropertiesAuthService`
  with provider resolution, strict deny paths, cache policy, and the trigger execution
  context (never-claim flag; `requireConfigured` dropped).

### Constraints

- `AuthService.getInstance()` remains the sole entrypoint; callers never construct providers.
- Base owns: provider resolution (with the single leniency), identity resolution, audit
  logging, cache policy, bootstrap detection/claim wiring (Section 4).
- Google Groups provider: unchanged key format `auth:<groupEmail>:<email>`, 6-hour TTL,
  `OWNER`/`MANAGER` → `admin`, `MEMBER` → `user`.
- Script Properties provider: no success cache; fresh read per request; strict validation
  denials per the state machine.
- Trigger context: `bypassCache: true` retained; new explicit never-claim flag replaces
  `requireConfigured`; `triggerHandler.js` updated accordingly.
- File separation: base + subclasses as separate files under `src/backend/Utils/`,
  preserving GAS load order (base loads before subclasses or resolves them lazily via
  `getInstance()` at call time — choose the order-safe option and document it).

### Delegation mandatory reads

- Implementation: `@SPEC.md`, `@src/backend/AGENTS.md` (§2.3, §2.2),
  `@docs/developer/data-shapes/auth-users.md`, `@docs/developer/data-shapes/auth-cache.md`,
  `@src/backend/Utils/AuthService.js`, `@src/backend/Triggers/triggerHandler.js`.
- Testing Specialist: `@docs/developer/backend/backend-testing.md`, `@SPEC.md`.

### Data-shape plan

- Update `auth-cache.md` planned block markers as the cache policy lands, and reconcile
  the doc's top-level `Status: Implemented` header with the planned block (the header
  must not contradict the not-yet-landed provider/cache changes).
- `auth-users.md` provider-resolution rules must match implementation.

### Shared helper plan

1. Helper: strict auth-state resolver (state machine evaluation: fresh / legacy groups /
   configured / broken)
   - Decision: `new`, owned by the base `AuthService` (private method), shared by
     `checkAccess` and `getApplicationAccess` (Section 5).
   - Call-site rationale: single source of the deny matrix.
   - Relevant canonical doc target: `auth-users.md` (validation block).

### Acceptance criteria

- Provider resolution matches the state machine exactly, including the leniency row and
  every broken-config row.
- Google Groups behaviour is byte-for-byte compatible with today for legacy installs.
- Script Properties provider reads fresh; never writes a cache entry.
- Trigger path never claims and bypasses cache on both providers.
- No lenient default-to-`googleGroups` fallback remains beyond the documented leniency.

### Required test cases (Red first)

Backend tests:

1. Provider resolution per state-machine row (fresh, legacy groups, configured ×2,
   broken ×4+, leniency).
2. Blank resolved email → denied, no claim, no cache write.
3. Groups cache: key format unchanged; denial never cached; `bypassCache` reads fresh.
4. Script Properties: malformed users / zero admins / missing revision → deny with
   error-level audit log (assert log call, no secrets in message).
5. Trigger context: never-claim flag present; `requireConfigured` gone; bypassCache set.
6. `'none'` stored → deny (regression guard for the removed bypass).

### Section checks

- `npm run test:backend -- <auth service tests>`
- `npm run lint:backend`
- `src/backend/AGENTS.md` §2.3 text is now stale — flagged for the Docs section.
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- `@remarks` on the base class: provider-resolution order (freshness → mode → provider)
  and why the leniency exists.

### Implementation notes / deviations / follow-up

- **Completed and pushed.** Implementation commit `97bb52a`
  (`feat(auth): split providers and enforce strict access state`) on branch
  `feat/ScriptPropertiesAuthService`; push to `origin` confirmed on 2026-09-09.
- Section 3 implementation splits `AuthService` into the base service plus
  `GoogleGroupsAuthService` and `ScriptPropertiesAuthService`, preserving
  `AuthService.getInstance()` as the sole entrypoint. Provider resolution now
  follows the strict state machine: the sole legacy leniency is absent/blank mode
  with a non-blank group; stored `'none'` and all other broken states fail closed.
- Groups cache behaviour remains compatible (`auth:<groupEmail>:<email>`, 21600-second
  TTL, role mapping, no denial caching, and `bypassCache` freshness). Script Properties
  reads fresh per request and does not cache successful decisions. Trigger execution
  now passes `bypassCache: true` and `neverClaim: true`; the Section 4 claim remains
  an explicit no-mutation wiring point.
- Data-shape and documentation gates are complete. The Section 3 review found and
  the Docs agent corrected stale `requireConfigured`/`'none'` current-behaviour
  references; Section 4 bootstrap and Section 5 transport remain marked planned.
- Pre-commit validation before the final regression gate: focused auth/trigger/
  dispatcher tests 85 passed; full backend 2,058 passed; backend lint has zero
  errors and only the 12 accepted baseline max-lines warnings; GAS bundle build
  passed all steps. The final regression gate reported **0 regressions, 0 new
  failures, and 1 fix** against the original branch baseline; all eight checks
  passed or improved, with only the 12 accepted unrelated max-lines warnings
  remaining in the backend lint check.

---

## Section 4 — Bootstrap claim

### Objective

- Implement the fresh-install bootstrap claim inside the shared access-resolution path.

### Constraints

- Claim precondition: freshness true (Section 2 method), interactive caller, non-blank
  server-resolved email.
- Atomic single write commits `authMode: 'scriptProperties'`, caller as sole admin,
  `authRevision: '1'`, under the script lock with a freshness re-check inside the lock.
- Blank-email callers and trigger execution never claim; denied fail-closed.
- Claim writes only auth fields; default seeding is then skipped and non-auth getters
  fall back to `DEFAULTS` (intended behaviour — do not "fix").

### Delegation mandatory reads

- Implementation: `@SPEC.md` (state machine + workflow), `@src/backend/AGENTS.md`,
  `@docs/developer/data-shapes/auth-users.md`, `@src/backend/Utils/AuthService.js`.
- Testing Specialist: `@docs/developer/backend/backend-testing.md`, `@SPEC.md`.

### Data-shape plan

- `auth-users.md` bootstrap block must match implementation; remove its marker here.

### Shared helper plan

- None beyond Section 3's resolver; the claim reuses the locked write path (Section 2)
  and the strict auth-state resolver (Section 3). Decision: `reuse`.

### Acceptance criteria

- First claimable caller becomes sole admin; subsequent callers resolve normally.
- Existing config — however empty or malformed — never bootstraps.
- Concurrent first requests produce exactly one claim (lock + in-lock freshness re-check).
- Claim failure (contention/write error) denies the request; next caller retries.

### Required test cases (Red first)

Backend tests:

1. Fresh install + claimable caller → admin state returned in the same resolution.
2. Existing config (`{}`, malformed, groups-legacy) → no claim, deny where applicable.
3. Blank email → deny, no claim; trigger context → deny, no claim.
4. Race: two concurrent resolutions → exactly one claim write (assert single storage
   mutation sequence under the lock).
5. In-lock freshness re-check: blob appears between check and lock → no claim, deny.

### Section checks

- `npm run test:backend -- <bootstrap tests>`
- `npm run lint:backend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- `@remarks` on the claim method: the in-lock re-check and the skip-seeding consequence.

### Implementation notes / deviations / follow-up

- To be completed during implementation.

---

## Section 5 — Auth endpoints (`z_Api/apiAuth.js`) and gate wiring

### Objective

- Add `getApplicationAccess` (gate-exempt), `getAuthenticationSettings` and
  `setAuthenticationSettings` (admin-only) with full domain validation, and wire the
  allowlist/exemption sets in `z_apiHandler.js`.

### Constraints

- New transport file `src/backend/z_Api/apiAuth.js` with trailing-underscore helpers and
  guarded `module.exports` (§1.1); thin closures in `ALLOWLISTED_METHOD_HANDLERS`.
- **Admin enforcement mechanism (settled):** the admin-only rejection for
  `getAuthenticationSettings`/`setAuthenticationSettings` is enforced in the **dispatcher
  admission phase**, reusing the existing `FORBIDDEN` gate path in `z_apiHandler.js` —
  a declarative admin-required method set is checked against the access state resolved
  fresh (cache bypassed) for those methods; the fresh resolution exposes `role`, which
  the admin-required check consumes (consistent with the access-resolution contract).
  The dispatcher's gate-exemption condition (the `methodName !== 'getAuthorisationStatus'`
  check at `z_apiHandler.js` line ~149) must be extended to also exempt
  `getApplicationAccess`. No new error type and no
  `_mapErrorToFailureEnvelope` case is introduced; handler-level guards are not
  duplicated (any handler-side check would be defence-in-depth only and must be
  commented as such per §1.2). `auth-users.md`'s FORBIDDEN wording is updated to name
  this mechanism.
- `getApplicationAccess` routes through the shared access-resolution path (performs the
  claim); it only _resolves and shapes_ access state — the management-endpoint cache
  bypass is a dispatcher/admission-phase responsibility, not logic inside the endpoint.
- `setAuthenticationSettings`: transport validation in `apiAuth_` helpers; domain
  invariants (last-admin, candidate-list validity, revision guard, candidate provider
  check, seeding on first switch) in `AuthService`/`ConfigurationManager`.
- Groups mode: `authUsers` must be omitted; `expectedAuthRevision` not applicable;
  admin enforcement via fresh `GroupsApp` role lookup.
- `z_apiHandler.js` stays the single registry (Assumption 4): changes limited to
  three allowlist entries, the exemption set, and the admin-required set
  (~560–580 projected).

### Delegation mandatory reads

- Implementation: `@SPEC.md`, `@src/backend/AGENTS.md` (§1, §2.4),
  `@docs/developer/backend/api-layer.md`, `@docs/developer/data-shapes/auth-users.md`,
  `@src/backend/z_Api/z_apiHandler.js`, `@src/backend/z_Api/apiConfig.js`,
  `@src/backend/Utils/AuthService.js`.
- Testing Specialist: `@docs/developer/backend/backend-testing.md`, `@SPEC.md`,
  `@docs/developer/data-shapes/auth-users.md`.

### Data-shape plan

- Implement the exact `auth-users.md` transport block; remove the contract's
  `Not implemented` marker when green (including `backend-config.md`/`auth-cache.md`
  planned blocks).

### Shared helper plan

1. Helper: `resolveApplicationAccess_` (transport shaping of the access-resolution result)
   - Decision: `keep local` to `apiAuth.js` (transport shaping only).
   - Call-site rationale: keeps envelope/data shaping out of `AuthService`.
   - Relevant canonical doc target: `auth-users.md` (transport block).

### Acceptance criteria

- All three endpoints registered; `getApplicationAccess` is gate-exempt and performs the
  claim; the other two are admin-only (groups-mode admins via fresh group role).
- `setAuthenticationSettings` commits atomically or not at all; increments revision;
  seeds `'1'` on first switch; rejects stale revision, last-admin removal/demotion,
  invalid candidates, failed candidate provider check, and quota excess with a
  validation failure envelope and unchanged storage.
- Response shapes match `auth-users.md` exactly (reason enum without `'unconfigured'`;
  no `provider` field).

### Required test cases (Red first)

Backend API tests:

1. Allowlist registration + gate exemption for `getApplicationAccess`; non-exempt
   behaviour for the settings pair.
2. `getApplicationAccess` response shape per reason (`ok` post-claim, `freshInstall`
   pre-claim for non-claimable callers, `brokenConfig`, `denied`).
3. Admin enforcement: user role → settings pair rejected with the `FORBIDDEN` envelope
   from the dispatcher admission phase (fresh access resolution asserted, cache bypassed
   for management methods); groups-mode admin via fresh lookup (cache bypass asserted).
4. Happy-path save: atomic commit, revision increment, response `{ success: true, authRevision }`.
5. Stale revision → validation failure envelope, storage unchanged.
6. Last-admin removal / demotion → rejected.
7. First switch from groups/legacy → no `expectedAuthRevision` required, seeds `'1'`.
8. Candidate provider check failure → rejected (fresh GroupsApp lookup asserted).
9. Groups-mode save with `authUsers` supplied → rejected.
10. Quota cap violation → rejected, no partial write.

### Section checks

- `npm run test:backend -- <api auth tests>`
- `npm run lint:backend`
- `z_apiHandler.js` LOC within projection (~560); registry not split.
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- `@remarks` on `apiAuth.js` explaining the gate-exemption precedent and why the access
  endpoint performs the claim.

### Implementation notes / deviations / follow-up

- To be completed during implementation.

---

## Section 6 — `apiConfig.js`: auth-field rejection and locked-write migration

### Objective

- `setBackendConfig` rejects every auth field (`ApiValidationError` / `INVALID_REQUEST`);
  `getBackendConfig` stops emitting auth fields; the per-field write loop moves onto the
  locked write path.

### Constraints

- Rejection is a request-shape violation (`ApiValidationError`), not an aggregate
  per-field failure — matching `backend-config.md`'s planned block.
- All ordinary config writes serialise through the Section 2 locked path (fixes the
  existing lost-update risk); the redacted aggregate error behaviour for ordinary fields
  is preserved.
- Frontend `.strict()` deploy-order note: backend must stop emitting the fields only in
  the same release as the frontend schema drop (Sections 6+7 ship together).

### Delegation mandatory reads

- Implementation: `@SPEC.md`, `@src/backend/AGENTS.md`,
  `@docs/developer/data-shapes/backend-config.md`, `@src/backend/z_Api/apiConfig.js`,
  `@src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`,
  `@src/backend/ConfigurationManager/97_ConfigurationManagerLockedWrite.js`.
- Testing Specialist: `@docs/developer/backend/backend-testing.md`,
  `@docs/developer/data-shapes/backend-config.md`.

### Data-shape plan

- `backend-config.md`: remove the planned-block markers for read emission and write
  rejection when green, and reconcile the doc to the authoritative **12 non-auth field**
  shape: the persistence table's `authGroupEmail`/`authMode` rows, the read/write
  transport tables, the `.strict()` discrepancy notes #6/#7/#8, and the related key
  notes are updated or removed so the doc matches `SPEC.md` rather than the pre-feature
  14-field contract.

### Shared helper plan

- Reuse the Section 2 locked write path. Decision: `reuse`.

### Acceptance criteria

- Any `setBackendConfig` payload containing `authMode`, `authGroupEmail`, `authUsers`,
  or `authRevision` (any caller, including admins) → `ApiValidationError`/`INVALID_REQUEST`.
- `getBackendConfig` response contains exactly the 12 non-auth fields (which include the
  derived `hasApiKey`).
- Ordinary writes remain functional and are now lock-serialised with no-clobber
  semantics; existing aggregate error/redaction behaviour unchanged.

### Required test cases (Red first)

Backend transport tests (dedicated suite per `src/frontend/AGENTS.md` §8:
`tests/api/backendConfigApi.test.js`):

1. Each auth field in the write payload → `INVALID_REQUEST`.
2. Read response no longer contains `authGroupEmail`/`authMode`.
3. Ordinary multi-field save under simulated concurrent writer → no clobber.
4. Existing aggregate-failure redaction behaviour regression-verified.

### Section checks

- `npm run test:backend -- tests/api/backendConfigApi.test.js`
- `npm run lint:backend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- `@remarks` on `setBackendConfig_` documenting the auth-field rejection intent
  (defence-in-depth vs the dedicated endpoints).

### Implementation notes / deviations / follow-up

- To be completed during implementation.

---

## Section 7 — Frontend services and Zod contracts

### Objective

- Add typed services + Zod schemas for `getApplicationAccess`,
  `getAuthenticationSettings`, `setAuthenticationSettings` per `auth-users.md`; drop
  auth fields from the backend-configuration schemas.

### Constraints

- Services live in the existing `src/frontend/src/services/authService/` domain folder;
  schemas co-located as `*.zod.ts`; all calls via `callApi`; `z.infer` types only.
- `.strict()` schemas with the deploy-order tolerance conventions from
  `backend-config.md`; response schemas include the `reason` enum exactly
  (no `'unconfigured'`, no `provider`).
- `backendConfiguration.zod.ts`: `BackendConfigSchema` and
  `BackendConfigWriteInputSchema` drop `authMode`/`authGroupEmail`.

### Delegation mandatory reads

- Implementation: `@SPEC.md`, `@src/frontend/AGENTS.md` (§5, §9, §14),
  `@docs/developer/data-shapes/auth-users.md`, `@docs/developer/data-shapes/backend-config.md`,
  `@src/frontend/src/services/authService/authService.ts`,
  `@src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`.
- Testing Specialist: `@docs/developer/frontend/frontend-testing.md`, `@docs/developer/data-shapes/auth-users.md`.

### Data-shape plan

- `auth-users.md` frontend-validation block must match the landed schemas.

### Shared helper plan

1. Helper: shared query-key factory entries for the three new queries
   - Decision: `extend` the existing shared query-key factory helpers (per
     `frontend-react-query-and-prefetch.md`), not ad-hoc arrays.
   - Owning path: existing query-key factory module.
   - Relevant canonical doc target: `auth-users.md` (transport block).

### Acceptance criteria

- Schemas validate the canonical fixtures (including every `reason` value and the
  settings request/response variants, first-switch omission included).
- Services call `callApi` with method names matching `ALLOWLISTED_METHOD_HANDLERS`.
- Backend configuration schemas no longer accept or require auth fields.

### Required test cases (Red first)

Frontend tests:

1. Zod: `getApplicationAccess` response — all four reasons, `role` nullability, blank email.
2. Zod: settings read/write shapes — groups vs scriptProperties variants; omission of
   `authUsers`/`expectedAuthRevision` in groups mode; first-switch omission accepted.
3. Service: typed calls route through `callApi` (mock-verified), envelope errors surfaced.
4. `BackendConfigSchema` rejects a payload containing auth fields (strict lockstep);
   write input schema rejects them too.

### Section checks

- `npm run test:frontend -- <service/schema tests>`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- None expected beyond schema-level comments; record `None` if so.

### Implementation notes / deviations / follow-up

- To be completed during implementation.

---

## Section 8 — Backend settings panel slimming

### Objective

- Remove auth fields from `BackendSettingsPanel`, the form schema, the mapper, and the
  `handleFinish` guard; extract the field descriptors to keep the panel under 500 lines.

### Constraints — file separation by LOC (mandatory)

- `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`: **current 541
  lines**; field removal brings it to **~510 projected**, still above 500. Extract the
  field-descriptor table and validator helpers into
  `backendSettingsFieldDescriptors.ts` (~130 lines), leaving the panel at **~390**.
- Keep the presentational/declarative pattern intact; no behaviour change beyond auth
  removal.

### Delegation mandatory reads

- Implementation: `@AUTHENTICATION_SETTINGS_LAYOUT.md`, `@src/frontend/AGENTS.md`,
  `@docs/developer/data-shapes/backend-config.md`,
  `@src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`,
  `@src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts`,
  `@src/frontend/src/features/settings/backend/backendSettingsFormMapper.ts`,
  `@src/frontend/src/features/settings/backend/useBackendSettings.ts`.
- Testing Specialist: `@docs/developer/frontend/frontend-testing.md`.

### Data-shape plan

- `backend-config.md` frontend-lockstep block markers removed when green.

### Shared helper plan

- Descriptor extraction is a `keep local` move (no new abstraction); validator helper
  moves with it. Record in the section during implementation.

### Acceptance criteria

- No auth fields in the form schema, mapper output, panel fields, or the write payload;
  the `'none'` option and its security comment are gone.
- Compulsory-once-set guard removed from this panel (behaviour moves to the new
  Authentication tab in Section 10).
- Existing non-auth settings behaviour regression-green (schema validation, helper text,
  save flow, loading/error states).

### Required test cases (Red first)

Frontend tests:

1. Form schema rejects `authMode`/`authGroupEmail` keys (strict).
2. Mapper output contains no auth fields for any input.
3. Panel renders without the auth fields; Save payload excludes them.
4. Regression: existing panel tests updated and green (no auth assumptions).

### Section checks

- `npm run test:frontend -- <settings backend tests>`
- `npm run lint:frontend`
- LOC check: `BackendSettingsPanel.tsx` ≤ 500 after extraction.
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- None; record `None`.

### Implementation notes / deviations / follow-up

- To be completed during implementation.

---

## Section 9 — Auth gate rework (`AppAuthGate`, role delivery)

### Objective

- Add `useApplicationAccess` (React Query) and `ApplicationAccessContext`; render the
  `reason`-driven gate states; keep OAuth gating first and the data-prefetch warm-up.

### Constraints

- `AppAuthGate` owns the query and mounts the provider around its children subtree;
  `SettingsPage` consumes context only (no second query).
- Full-page blocking states keep the established `Result` treatment
  (`freshInstall` non-claimable, `brokenConfig`, `denied`); panel-level tab errors use
  `Alert` (Section 10).
- **Dual-gate removal (mandatory):** the warm-up-driven membership gate is _removed_ —
  `getWarmupForbiddenMessage` and its early-return rendering, and the
  _"Verifying access"_ withhold tied to warm-up loading. Child rendering is gated solely
  on `getApplicationAccess` `reason === 'ok'`; the data-prefetch warm-up becomes a
  post-admission prefetch (no admission authority). The former `'none'`-mode behaviour
  of that gate is moot: the mode is removed entirely (SPEC decision 2).
- OAuth gating is **retained unchanged**: `getAuthorisationStatus`
  (`useAuthorisationStatus`) stays gate-exempt and runs first as today; it is _not_
  subsumed by `getApplicationAccess` — the two mechanisms remain disjoint per SPEC.
- File separation: `AppAuthGate.tsx` is **currently 388 lines, projected ~500** with the
  context + reason states added. Extract the blocking-state `Result` variants into
  `features/auth/AuthGateStates.tsx` (~100 lines), keeping `AppAuthGate.tsx` at
  **~360–380** (section gate below).

### Delegation mandatory reads

- Implementation: `@AUTHENTICATION_SETTINGS_LAYOUT.md`, `@SPEC.md`,
  `@src/frontend/AGENTS.md`, `@docs/developer/frontend/frontend-react-query-and-prefetch.md`,
  `@docs/developer/frontend/frontend-loading-and-width-standards.md`,
  `@src/frontend/src/features/auth/AppAuthGate.tsx`,
  `@src/frontend/src/features/auth/useAuthorisationStatus.ts`.
- Testing Specialist: `@docs/developer/frontend/frontend-testing.md`.

### Data-shape plan

- Frontend consumption matches `auth-users.md` transport block (reason enum).

### Shared helper plan

1. Helper: `useApplicationAccess` hook + `ApplicationAccessContext`
   - Decision: `new`, owned by `src/frontend/src/features/auth/`.
   - Call-site rationale: single query owner (the gate) per the layout spec's Role
     delivery section.
   - Relevant canonical doc target: `auth-users.md` (frontend block).

### Acceptance criteria

- Gate consumes `getApplicationAccess`; `role` reaches descendants via context.
- `reason: 'ok'` renders normally; non-claimable `freshInstall`, `brokenConfig`, and
  `denied` render the specified blocking `Result` states; claimable callers pass through.
- No duplicate `getApplicationAccess` requests (single query instance).
- OAuth gate and warm-up behaviour regression-green.

### Required test cases (Red first)

Frontend tests:

1. Hook: query key/factory integration; single fetch on mount (no duplicate calls).
2. Context: consumer receives `{ role, reason }`; provider wraps children.
3. Gate states: each reason renders its specified treatment; claimable freshInstall
   passes through with claimed role.
4. Dual-gate removal: warm-up `FORBIDDEN` no longer blocks rendering; the
   _"Verifying access"_ withhold is gone; rendering gates solely on `reason === 'ok'`.
5. Warm-up prefetch still fires post-admission (data presence asserted, no gating role).
6. Regression: OAuth gate (`useAuthorisationStatus`) behaviour unchanged and runs first.

### Section checks

- `npm run test:frontend -- <auth feature tests>`
- `npm run lint:frontend`
- LOC check: `AppAuthGate.tsx` ≤ 380 after extraction.
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- `@remarks` on the gate: OAuth-first + access-layering and the warm-up split
  (gating superseded, prefetch retained).

### Implementation notes / deviations / follow-up

- To be completed during implementation.

---

## Section 10 — Authentication settings tab

### Objective

- Build the admin-only Authentication tab: provider configuration card, staged user
  table, add-row, mode-switch modal, single Save with revision-guard UX; gate tab
  visibility on the context role.

### Constraints

- Layout per `@AUTHENTICATION_SETTINGS_LAYOUT.md` exactly: single Form wrapping the
  provider card and Save `Form.Item`; status stack outside the Form; staged list +
  atomic Save; mode-switch `Modal` (focus on Cancel, focus return to the Select);
  `Popconfirm` row removal; `App.useApp()` message instance for success feedback.
- Groups mode: mode Select + group email (compulsory-once-set guard) + membership note;
  no user region. Script Properties mode: user region only.
- New feature files under `src/frontend/src/features/settings/authentication/`; keep
  each file under 500 lines (panel ~300, hook ~250, user table region ~150 projected).
- Tab hidden for non-admin roles; only entry point (no deep links).

### Delegation mandatory reads

- Implementation: `@AUTHENTICATION_SETTINGS_LAYOUT.md`, `@SPEC.md`,
  `@src/frontend/AGENTS.md`, `@docs/developer/frontend/frontend-modal-patterns.md`,
  `@docs/developer/frontend/frontend-spacing-and-padding-standards.md`,
  `@src/frontend/src/pages/SettingsPage.tsx`,
  `@src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx` (pattern reference).
- Testing Specialist: `@docs/developer/frontend/frontend-testing.md`.
- Playwright (E2E): `@docs/developer/frontend/frontend-playwright-e2e.md`.

### Data-shape plan

- Consumption matches `auth-users.md`; stale-revision conflict maps to the warning
  treatment in the layout spec.

### Shared helper plan

1. Helper: staged user-list reducer/validation (add/normalise/duplicate/role checks)
   - Decision: `new` but `keep local` to the feature folder (feature-specific rules,
     mirrors backend validation shape); promote to a shared helper only if a second
     consumer appears.
   - Owning path: `src/frontend/src/features/settings/authentication/`
   - Relevant canonical doc target: `auth-users.md` (AuthUserEntry rules).

### Acceptance criteria

- Tab visible only for `role: 'admin'`; mode-dependent regions swap exactly as specified.
- Staged list: add (trim/lowercase, duplicate guard), role change, remove with
  Popconfirm; empty-list state explains the ≥1-admin rule.
- Save: single atomic call with `expectedAuthRevision`; success rebases list + revision
  with context-aware success message; stale revision shows the persistent warning and
  keeps the staged list; last-admin and candidate-check failures surface in the status
  stack with unchanged storage.
- Mode switch: modal copy per target mode; confirm stages the swap and seeds the
  candidate list; cancel reverts the Select.
- Loading (skeleton), load-error (Card + Alert), and refresh states per the layout spec.

### Required test cases (Red first)

Frontend component tests:

1. Tab gating: `role: 'user'` → no tab; `role: 'admin'` → tab present.
2. Mode regions: groups mode hides the user region and shows email + note;
   scriptProperties mode hides email.
3. Staging: add normalises email; duplicate add blocked; role change stages; remove
   stages; staged state survives re-render.
4. Mode switch: modal opens on baseline-differing change; cancel reverts; confirm swaps
   regions and seeds the candidate list.
5. Save success: atomic payload shape, rebase, success message (context-aware instance).
6. Stale revision: warning rendered, staged list preserved, storage untouched.
7. Last-admin / candidate-check failures: status-stack errors, form remains usable.
8. Load error: Card + Alert blocking treatment.

E2E (Playwright):

1. Admin opens the Authentication tab, adds a user, saves, sees the persisted row.
2. Stale-revision conflict path renders the warning (mocked second save).

### Section checks

- `npm run test:frontend -- <authentication settings tests>`
- `npm run test:frontend:e2e -- <auth settings e2e>`
- `npm run lint:frontend`
- LOC check: no new feature file exceeds 500 lines.
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- `@remarks` on the hook: staging model and the deliberate non-instant-save choice
  (revision-guard economics).

### Implementation notes / deviations / follow-up

- To be completed during implementation.

---

## Regression and contract hardening

### Objective

- Prove the whole feature against the full suites and the canonical contracts.

### Constraints

- Prefer focused runs first, then broad suites; no skipped tests.

### Acceptance criteria

- All touched backend suites, frontend suites, and E2E specs green.
- `npm run lint:backend && npm run lint:frontend` clean.
- No regressions in existing auth-gate, settings, and configuration behaviour.

### Required test cases/checks

1. Full backend suite (`npm run test:backend`).
2. Full frontend unit suite (`npm run test:frontend`).
3. Full E2E suite for the settings/auth surfaces (`npm run test:frontend:e2e`).
4. Lint hierarchy commands (both runtimes).
5. Mandatory-read evidence (`Files read`) complete for every delegated regression handoff.

### Section checks

- All commands green; deviations recorded below.

### Implementation notes / deviations / follow-up

- To be completed during implementation.

---

## Documentation and rollout notes

### Objective

- Align canonical docs with the delivered feature and produce the migration release notes.

### Constraints

- Only modify documents relevant to the touched areas; policy docs are updated ahead of
  AGENTS signposts.

### Acceptance criteria

- `docs/developer/security/application-authentication.md` reflects the two-provider
  model, bootstrap claim, deny states, and management endpoints.
- `docs/developer/security/accepted-risks.md` records the accepted residual risks.
- `src/backend/AGENTS.md` §2.3 rewritten: `'none'` bypass text removed; new provider,
  leniency, and never-claim trigger context documented.
- Release notes: manual-seed procedure with an exact literal escaped JSON example
  (double-serialisation warning; malformed seed → broken-config deny), and the
  deploy-order note that Sections 6+7 ship together (`.strict()` lockstep).
- Data-shape docs: all `Not implemented` markers reconciled (removed where delivered);
  INDEX status updated.
- Shared-helper and data-shape planning entries reconciled against actual implementation.

### Required checks

1. Docs mention persistence/transport strategies for every new shape.
2. API docs list the three new endpoints/methods.
3. Notes/deviations fields in all sections are filled.
4. Mandatory-read evidence (`Files read`) complete for delegated docs/review handoffs.
5. `@remarks` follow-through: confirm planned `@remarks` exist in code (Sections 1–5, 9–10).

### Implementation notes / deviations / follow-up

- To be completed during implementation.

---

## Suggested implementation order

1. **Prerequisite gate** — confirm the dead propertiesStore clone path removal has landed
   (Assumption 1); escalate if not.
2. Section 1 — config schema and storage foundations.
3. Section 2 — `ConfigurationManager` decomposition (pure refactor first), then locked
   write path + freshness detection.
4. Section 3 — `AuthService` base + provider subclasses + trigger context.
5. Section 4 — bootstrap claim.
6. Section 5 — `apiAuth.js` endpoints + gate wiring (transport lands with contracts).
7. Section 6 — `apiConfig.js` rejection + locked-write migration.
8. Section 7 — frontend services + Zod contracts.
9. Section 8 — backend settings panel slimming (ships with Section 7's schema drop).
10. Section 9 — auth gate rework and role delivery.
11. Section 10 — Authentication settings tab (+ E2E).
12. Regression and contract hardening.
13. Documentation and rollout notes.

Sections 1–6 are backend-only and independently testable; Sections 7–10 depend on the
contracts from Sections 5–6 but not on each other's internals beyond the stated order.
