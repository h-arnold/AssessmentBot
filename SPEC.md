# Application Authentication & Minimal Role Administration Specification

## Status

- Draft v1.3 — planning only; no production code has been written against this document.
- v1.2 incorporated an independent planning review: bootstrap trigger ownership,
  deny-state observability, completed bootstrap state machine, settings endpoint
  shapes, cache-key simplification, candidate-configuration provider-switch checks,
  locked merge semantics, and removal of the legacy-groups seeding concept.
- v1.3 incorporates a second independent review: explicit frontend field-removal
  scope, freshness-detection ordering pinned after `ConfigurationManager`
  initialisation (dead `PropertiesCloner` clone path removed from scope), shared
  script-lock contention behaviour, claim routing through the gate-exempt access
  endpoint, legacy absent-`authMode` leniency, provider-switch revision seeding,
  trigger never-claim context, and response-shape trims.
- Confirmed assumption: the `maybeDeserializeProperties()` / `PropertiesCloner`
  propertiesStore clone path is dead code (it depends on a propertiesStore Google
  Sheet that no longer exists). Its removal is a separate workstream that must land
  before implementation of this spec; this document prescribes no behaviour for it.

## Purpose

This document defines the intended behaviour for the reworked application
authentication layer: a pluggable two-provider `AuthService`, persistent user/role
storage, and first-admin bootstrap. The feature will be used to:

- authenticate callers against either a Google Group (existing behaviour) or a
  Script Properties user list (new installs), selected by `authMode`;
- grant exactly one interactive caller admin rights on a genuinely fresh install;
- restrict the `admin` role to user management and authentication settings only;
- provide a safe, auditable migration path from `authMode: 'none'` installations.

This feature is **not** intended to provide broader role-based access control,
per-method role filtering, or directory/group membership management (see V1 scope),
nor to replace or weaken Layer 1 platform controls (`USER_ACCESSING` / `DOMAIN`).

## Agreed product decisions

1. Two auth providers exist as concrete subclasses of a shared `AuthService` base;
   `AuthService.getInstance()` remains the single entrypoint. The current class is
   refactored into base `AuthService` + `GoogleGroupsAuthService` +
   `ScriptPropertiesAuthService`; the base resolves the provider from `authMode`.
2. `scriptProperties` is the default `authMode` for new installs — applied by the
   bootstrap claim itself, which writes `authMode: 'scriptProperties'` explicitly
   (no silent getter fallback; the constructor-only defaults rule is respected).
   `authMode: 'none'` is removed completely: schema, stored values, and frontend
   options. Existing installations with an explicitly configured `googleGroups`
   provider retain it.
3. Roles `admin`/`user` enforce **only** user management and authentication settings;
   all other application access and unrelated backend settings remain equally
   editable by both roles.
4. The first **interactive** caller whose Google-resolved active-user email is
   non-blank becomes admin **only if no application configuration exists at all**
   (`__CONFIG_STORE_KEY__` absent). Existing config presence — even blank, empty, or
   malformed — never bootstraps. Missing or invalid auth configuration inside
   existing config denies access (fail closed). See the bootstrap state machine.
5. The bootstrap claim is owned by the auth service's access-resolution path,
   shared by `AuthService.checkAccess()` (invoked by `ApiDispatcher.handle()`
   before allowlist lookup and admission) and the gate-exempt `getApplicationAccess`
   endpoint. The app's natural first call — the access-status read — therefore
   performs the claim; there is no dedicated bootstrap endpoint. In the
   fresh-install state, a caller with a blank resolved email is denied without
   claiming; trigger execution never claims.
6. Triggers never bootstrap an admin. `checkAccess` gains an explicit execution
   context so the trigger path passes a never-claim flag (and keeps
   `bypassCache: true`); the defunct `requireConfigured` parameter is dropped —
   under the strict model there is no "unconfigured but allowed" state to request.
7. Removing or demoting the last admin is rejected. A provider switch must validate
   the saving admin against the **candidate** configuration (see workflows) before
   committing, using fresh lookups (never cache).
8. Existing `'none'` installations migrate by **manual Script Properties seed before
   upgrade**, documented in release notes; there is no migration bypass.
9. School deployment case: Groups scope consent succeeds but `GroupsApp` membership
   lookup fails — the `groups` OAuth scope is retained regardless of provider.
10. `setBackendConfig` rejects all auth fields (`authMode`, `authGroupEmail`,
    `authUsers`, `authRevision`) for everyone, including admins — rejected as an
    `ApiValidationError` (`INVALID_REQUEST` envelope), matching the existing
    request-shape violation handling; auth is managed only through dedicated
    endpoints. The `getBackendConfig` read transport stops emitting auth fields;
    auth state is read through `getAuthenticationSettings` (admins) and
    `getApplicationAccess` (all callers). The frontend drops these fields in
    lockstep (see frontend changes).
11. Caching: the existing Google Groups key format `auth:<groupEmail>:<email>` is
    unchanged (provider and group are already embedded, so a mode flip can never
    reuse stale entries). The Script Properties provider has **no** success cache —
    users are read fresh per request. Management endpoints, provider-switch
    validation, and triggers always bypass cache reads on both providers.
12. Lost-update protection: a single protected save of auth fields requires the
    expected `authRevision`; a stale revision yields a validation error and no
    overwrite. The script lock complements but does not replace the revision guard:
    the lock serialises concurrent executions, while the revision guard still
    rejects out-of-order saves from concurrent user sessions. All configuration
    writes — auth saves and ordinary `setBackendConfig` writes alike — serialise
    through the same script-wide `LockService.getScriptLock()` already used by the
    vendored JsonDbApp `DbLockService` (GAS script locks are not reentrant). Under
    the lock the writer re-reads the blob from storage (never the per-execution
    in-memory cache), merges its change, and writes once. The lock timeout follows
    the existing JsonDbApp timeout configuration; lock contention yields a retriable
    validation error envelope, never a silent drop; and no configuration write may
    be invoked while a DB operation already holds the script lock. This replaces the
    current per-field, unlocked write loop and fixes the existing lost-update risk.
13. The app-managed user list is applicable **only** in `scriptProperties` mode. In
    `googleGroups` mode, membership stays externally managed in Google Groups; the
    settings surface shows the group email and no user editing. `authUsers`/
    `authRevision` are absent on legacy `googleGroups` installs and that is valid.

## Existing system constraints

### Backend or API constraints already in place

- `apiHandler` (`src/backend/z_Api/z_apiHandler.js`) is the sole `google.script.run`
  entrypoint with `ALLOWLISTED_METHOD_HANDLERS`; new endpoints must be registered there.
- The auth gate runs after request validation but before allowlist lookup and
  admission; `getAuthorisationStatus` is currently the only gate-exempt method
  (OAuth-only). `getApplicationAccess` joins the exempt set (see data shapes).
- `triggerHandler()` funnels all scheduled work with fail-closed authorisation and
  owns cleanup in a `finally` block.
- Backend functions are private by default (trailing `_`); the manifest must retain
  `webapp.executeAs: USER_ACCESSING` and `webapp.access: DOMAIN`.

### Current data-shape constraints

- All application configuration lives in one JSON blob under `__CONFIG_STORE_KEY__`
  in Script Properties (`ConfigurationManager`). `authMode` and `authGroupEmail`
  already live there; `authUsers` and `authRevision` join them.
- The general config parser is forgiving by design; auth fields are the exception
  (strict validation on security reads — see the state machine).
- Script Properties has a 9KB-per-value quota: the whole config blob must stay
  under a conservative **8KB cap**, and the cap check runs on **all** configuration
  writes (auth and ordinary). No secrets in logs or errors.

### Frontend or consumer architecture constraints

- All calls route through `callApi` in `services/apiService.ts`; configuration reads
  and writes go through `services/backendConfiguration/` with Zod schemas matching
  canonical data shapes.
- `AppAuthGate` is fail-closed and blocking; OAuth status and application access are
  distinct mechanisms that must remain disjoint.
- `google.script.run` prohibits `Date`/`Function`/DOM values in parameters and returns.

## Security basis (research)

- [Apps Script web-app permissions](https://developers.google.com/apps-script/guides/web#permissions):
  with `USER_ACCESSING`, the script executes as the signed-in caller — the platform
  establishes the caller identity before any application code runs.
- [`Session.getActiveUser()`](<https://developers.google.com/apps-script/reference/base/session#getActiveUser()>):
  returns the server-resolved active user email, which can be blank under certain
  policies — hence the non-blank requirement for bootstrap and access.
- [Apps Script Properties](https://developers.google.com/apps-script/guides/properties):
  a script-wide key/value store shared by all users — the correct home for the
  shared user list and revision counter.

Consequences treated as contract:

- The browser can tamper with request payloads but not with server-side `Session`
  identity; caller identity is **never** accepted from payload data.
- Editors of the script are trusted; account compromise or email reassignment is an
  accepted residual risk. Drive ACLs operate outside this auth gate.
- Trigger identity is server-derived only (no caller-supplied path); live deployment
  behaviour remains unverified and flagged for validation.
- The citations support the reasoning model; they are not security certifications.

## Recommended data shapes

Canonical entries; final shape registration belongs to the Data Shapes Agent.

### Auth user entry (stored, one element of `authUsers`)

```ts
{
  email: string,  // trimmed, lowercased; no Gmail alias/dot/plus rewriting
  role: 'admin' | 'user',
}
```

- Stored as a JSON string array inside the config blob. Reject duplicates, unknown
  roles, and unknown keys (no extra properties per entry).

### Auth configuration state (inside `__CONFIG_STORE_KEY__` blob)

```ts
{
  authMode: 'googleGroups' | 'scriptProperties',
  authGroupEmail: string,        // required non-blank when mode is googleGroups
  authUsers: string,             // JSON string of AuthUserEntry[]; scriptProperties mode only
  authRevision: string,          // positive integer string; scriptProperties mode only
}
```

- `authUsers`/`authRevision` are absent on legacy `googleGroups` installs and that is
  valid (decision 13). Any other combination of missing or invalid auth fields is a
  broken-config deny state.

### `getApplicationAccess` response (gate-exempt)

```ts
{
  allowed: boolean,
  role: 'admin' | 'user' | null,
  email: string,        // server-resolved; '' when blank
  reason: 'ok' | 'freshInstall' | 'brokenConfig' | 'denied',
}
```

- Gate-exempt, joining the precedent set by `getAuthorisationStatus`, so the frontend
  can observe and distinguish deny states (broken config vs ordinary denial) that the
  uniform `FORBIDDEN` envelope on protected methods deliberately does not carry.
  This does not enable method-surface probing: the endpoint reveals only the caller's
  own access state, never the allowlist or method surface. Ordinary protected-method
  denial remains the uniform `FORBIDDEN` envelope.
- Although gate-exempt, the endpoint routes through the same access-resolution path
  as `checkAccess`, so the bootstrap claim fires here on a fresh install — the app's
  natural first call. The caller's own role is sufficient for settings composition;
  provider details come from the admin-only `getAuthenticationSettings` when needed.
- Distinct from the OAuth boolean `getAuthorisationStatus`; the frontend auth gate
  consumes this for role-aware settings composition.

### `getAuthenticationSettings` response (admin-only)

```ts
{
  authMode: 'googleGroups' | 'scriptProperties',
  authGroupEmail: string,
  authUsers: AuthUserEntry[],   // parsed stored list; [] when absent (groups/legacy)
  authRevision: string | null,  // null when not applicable (groups mode)
}
```

### `setAuthenticationSettings` request (admin-only)

```ts
{
  authMode: 'googleGroups' | 'scriptProperties',
  authGroupEmail: string,       // required non-blank when mode is googleGroups
  authUsers: AuthUserEntry[],   // required full candidate list when mode is scriptProperties;
                                // must be omitted in groups mode (list not editable there)
  expectedAuthRevision: string, // required only when a stored authRevision exists
                                // (scriptProperties mode); omitted on the first switch
                                // from groups/legacy mode, which seeds authRevision '1';
                                // not applicable in groups mode
}
```

- Response: `{ success: true, authRevision }` on commit, or a validation failure
  envelope (stale revision, last-admin violation, invalid entry, candidate-check
  failure, quota cap). The stored config is unchanged on any failure — no partial
  writes.

## Feature architecture

- `src/backend/Utils/AuthService.js` becomes the base class: provider resolution,
  identity resolution, audit logging, caching policy, bootstrap detection/claim, and
  the `getInstance()` entrypoint. `GoogleGroupsAuthService` and
  `ScriptPropertiesAuthService` subclasses in the same area own provider-specific
  membership checks; the base reads `authMode`, delegates membership decisions, and
  no caller constructs providers directly.
- New transport file `src/backend/z_Api/apiAuth.js` owns the three new endpoints;
  `apiConfig.js` keeps only non-auth configuration transport, gains rejection of
  auth fields, and moves its per-field write loop onto the locked write path. This
  mirrors the existing `z_Api` domain-file pattern.
- `ConfigurationManager` gains the locked write path (script-wide lock, fresh
  re-read, merge, single write, size-cap check) used by all configuration writers.
- Frontend: `services/authService/` gains typed access to the new endpoints;
  `features/auth/` composes role-aware settings from `getApplicationAccess`.

### Bootstrap state machine

| State                | Condition                                                                                                                                                                                                                                                            | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh install        | `__CONFIG_STORE_KEY__` absent from raw Script Properties                                                                                                                                                                                                             | First interactive caller with non-blank resolved email atomically becomes admin through the shared access-resolution path (`checkAccess` or the gate-exempt `getApplicationAccess`, whichever executes first; single write commits `authMode: 'scriptProperties'`, caller as sole admin, `authRevision: '1'`); the request then proceeds under the new provider. Blank-email callers and trigger execution are denied without claiming; the next eligible caller retries the claim. |
| Legacy groups        | Existing config, `authMode: 'googleGroups'` (or `authMode` absent with a non-blank `authGroupEmail` — the single documented leniency, matching the legacy getter and reachable only via hand-edited or cloned blobs), non-blank group, no `authUsers`/`authRevision` | Behaves as today (six-hour cache; Group role → app role; `OWNER`/`MANAGER` → admin). Management endpoints use fresh lookups. The user list is not applicable and not editable.                                                                                                                                                                                                                                                                                                      |
| Configured providers | Existing config with valid auth fields for the mode (groups: non-blank group; scriptProperties: parseable `authUsers` with ≥1 admin and positive-integer `authRevision`)                                                                                             | Normal operation; strict validation on security reads. In groups mode a stored (legacy) `authUsers`/`authRevision`, if present, is retained but not used for access and not editable.                                                                                                                                                                                                                                                                                               |
| Broken config        | Existing config otherwise: `authMode: 'none'` or unrecognised mode, or `authMode` absent without a non-blank `authGroupEmail`; groups mode with blank group; scriptProperties mode with missing/blank/malformed `authUsers` or `authRevision`, or zero admins        | Deny access, fail closed, loud audit log (no secrets in output). The old fail-open bootstrap window (groups mode with blank group) is removed; recovery is script-editor repair.                                                                                                                                                                                                                                                                                                    |
| Never bootstraps     | Any existing config, however empty or malformed                                                                                                                                                                                                                      | No admin claim. `'none'` no longer exists; such installs are handled by the manual seed migration.                                                                                                                                                                                                                                                                                                                                                                                  |

Fresh-install detection is a `ConfigurationManager` method: it lets
`ConfigurationManager` initialisation run first, then reads raw Script Properties
for `__CONFIG_STORE_KEY__` absence directly (not the forgiving config cache).
`AuthService` must not read configuration getters before this method runs, making
the freshness decision deterministic regardless of execution order. The
`maybeDeserializeProperties()` propertiesStore clone path is dead code and is being
removed in a separate workstream prior to implementation (see the status note);
this spec prescribes no behaviour for it. The gate precedes all handler execution,
so no handler write can precede the claim.

## Workflow specification

### Bootstrap claim (fresh install)

- Precondition: `__CONFIG_STORE_KEY__` absent from raw Script Properties; caller is
  interactive (not a trigger); `Session.getActiveUser().getEmail()` is non-blank.
- Behaviour: within a script-wide lock, re-check config absence, then commit a single
  write containing `authMode: 'scriptProperties'`, the caller as sole admin in
  `authUsers`, and `authRevision: '1'`. Lock contention or write failure denies the
  request (fail closed); the next caller retries the claim. The claim is performed
  inside the shared access-resolution path before provider resolution (decision 5),
  so it fires on the first protected call or the first `getApplicationAccess` call.
  The claim writes a blob containing only auth fields; default seeding
  (`ensureDefaultConfiguration`) is then skipped for that install and non-auth
  getters fall back to `DEFAULTS` — this is the intended behaviour, to be reconciled
  explicitly in the action plan rather than "fixed".

### User add / remove / role change (scriptProperties mode only)

- Precondition: caller is admin; `setAuthenticationSettings` receives the complete
  candidate users list, mode, group, and the expected `authRevision`.
- Behaviour: validate the candidate list (trimmed/lowercased emails, known roles
  only, no duplicates, no unknown keys); reject removal/demotion that would leave
  zero admins; inside the lock, reject a stale `authRevision` with a validation
  error; on success write all auth fields atomically and increment `authRevision`.
  Stale revision, last-admin violation, invalid entry, or quota failure produces
  no partial writes.

### Provider switch

- Precondition: caller is admin; candidate config names a different `authMode`.
- Behaviour: before committing, validate the saving admin against the **candidate**
  configuration with fresh lookups (never cache): for target `scriptProperties`, the
  admin's email must appear in the candidate users list with role `admin`; for
  target `googleGroups`, a fresh `GroupsApp` lookup against the candidate group must
  yield `OWNER` or `MANAGER`. Abort with a validation error if the check fails;
  otherwise commit atomically with a revision bump. On the first switch to
  `scriptProperties` no stored `authRevision` exists, so no expected revision is
  supplied and the commit seeds `authRevision: '1'`; subsequent saves require the
  stored revision as usual.

### Manual migration seed (`'none'` → `scriptProperties`)

- Operator, before upgrading: seeds `authUsers` (at least one admin) and
  `authRevision` into the existing config blob **and** changes `authMode` to
  `'scriptProperties'` via Script Properties, following release-note instructions.
- Release notes must include an exact literal escaped JSON example: `authUsers` and
  `authRevision` are JSON strings nested inside the blob JSON (double serialisation),
  and hand-editing is error-prone — a malformed seed lands the install in the
  broken-config deny state, recoverable only by script-editor repair.
- There is no migration bypass; a `'none'`-mode install without a seed falls into
  the broken-config deny state after upgrade (stored `'none'` is an unrecognised
  mode once removed). Legacy blobs that stored `authGroupEmail` without `authMode`
  need no seed: they are read as `googleGroups` (see the state machine leniency).

## Error, loading, and empty-state rules

- Broken-config deny is a blocking failure; the frontend distinguishes it from
  ordinary denial through the gate-exempt `getApplicationAccess` `reason` field.
  The audit trail records the malformed state at error level (no secrets in output).
- Stale `authRevision` and last-admin violations are validation errors surfaced in
  the settings form; the stored config is unchanged.
- Fresh installs: `getApplicationAccess` returns `reason: 'freshInstall'`
  pre-claim; because the endpoint itself routes through the claim path, the same
  call returns `reason: 'ok'` with the claimed admin role when a claimable caller
  invokes it — no client invalidation step is required. Callers who cannot claim
  (blank resolved email) keep seeing `freshInstall` and are denied on protected
  calls. In groups mode the user management surface is not applicable and is
  presented accordingly.

## Backend changes required to support agreed behaviour

1. Refactor `AuthService` into base + `GoogleGroupsAuthService` +
   `ScriptPropertiesAuthService`; base owns provider resolution, identity, audit
   logging, cache policy (existing groups key format; no success cache for the
   Script Properties provider), bootstrap detection/claim via the shared
   access-resolution path, and the `getInstance()` entrypoint.
2. Extend the config schema: remove `'none'` (unrecognised modes and absent-mode-
   without-group are denied in the security read — the access-resolution path —
   while the forgiving transport getter stays best-effort and must not throw; the
   lenient default-to-`googleGroups` fallback is removed, with the single
   documented exception that an existing blob lacking `authMode` but holding a
   non-blank `authGroupEmail` reads as `googleGroups`); add `authUsers`
   (JSON string array) and `authRevision` (positive integer string) with strict
   security-read validation distinct from the forgiving general parser; enforce the
   8KB size cap on all config writes.
3. Locked write path in `ConfigurationManager` (script-wide lock, fresh re-read,
   merge, single write, size cap); `apiConfig.js`'s per-field write loop moves onto
   it. `setBackendConfig` rejects every auth field for all callers (as
   `ApiValidationError` / `INVALID_REQUEST`); `getBackendConfig` stops emitting
   auth fields.
4. New `z_Api/apiAuth.js` endpoints in `ALLOWLISTED_METHOD_HANDLERS`:
   `getApplicationAccess` (gate-exempt, all callers, routed through the shared
   access-resolution path so it performs the bootstrap claim), and
   `getAuthenticationSettings` / `setAuthenticationSettings` (admin-only; atomic
   save with expected revision). Admin enforcement in groups mode derives from a
   fresh group-role lookup.
5. Bootstrap claim state machine as specified, including the explicit trigger
   execution context (never-claim flag, `bypassCache` retained, `requireConfigured`
   dropped) and never-claim semantics.
6. Retain the `groups` OAuth scope in `appsscript.json` regardless of provider.

## Frontend changes required to support agreed behaviour

1. Remove auth fields from the settings transport: drop `authMode` and
   `authGroupEmail` from `BackendSettingsPanel.tsx` (whose options include `'none'`
   today), `backendSettingsForm.zod.ts`, `backendSettingsFormMapper.ts` (including
   the `handleFinish` compulsory-once-set clearing guard), and from
   `BackendConfigSchema` / `BackendConfigWriteInputSchema` in the backend
   configuration Zod schemas.
2. Source the auth surface exclusively from the new endpoints:
   `getApplicationAccess` for role-aware composition of the auth gate and settings
   surfaces, `getAuthenticationSettings` / `setAuthenticationSettings` for the
   admin-only auth settings form (user editing applies to `scriptProperties` mode
   only).
3. Render deny states from the `getApplicationAccess` `reason` field (broken
   config vs ordinary denial vs fresh install).

## Planning handoff notes

- TDD: provider resolution, the bootstrap state machine, revision conflict, and
  last-admin rejection are the highest-risk edges; write failing tests first.
- Data-shape docs to update before code-review sign-off: `docs/developer/data-shapes/`
  contracts for `BackendConfig` (auth fields removed from read/write transport), a
  new auth-user/auth-config contract, the `getApplicationAccess` response, the
  settings read/write contract, and `auth-cache.md` (no success cache for the
  Script Properties provider). Planned entries must be recorded in these docs with
  status `Not implemented` before implementation starts, and the markers removed as
  each shape lands.
- Prerequisite workstream: removal of the dead `maybeDeserializeProperties()` /
  `PropertiesCloner` propertiesStore clone path is planned separately and must land
  before implementation; this spec assumes it is gone.
- The `AppAuthGate` consumption of `getApplicationAccess` (deny-state rendering,
  fresh-install handling) is specified in the layout spec, not here.
- The action plan must sequence: locked write path + schema → base/subclass refactor
  → endpoints → frontend consumption → docs, because the endpoints depend on the new
  provider/storage layer.
- Canonical docs to update afterwards: `application-authentication.md`,
  `accepted-risks.md`, `src/backend/AGENTS.md` §2.3 (the `'none'` bypass text).

## Testing expectations

- Backend unit coverage: provider resolution per mode (including the absent-
  `authMode`-with-group leniency); bootstrap claim (fresh, existing-config-no-
  bootstrap, blank-email, trigger-no-claim, claim via `getApplicationAccess`);
  strict validation denials (blank group, malformed users, stored `'none'`, absent
  `authMode` without group); revision conflict; first-switch revision seeding;
  last-admin guard; provider-switch candidate checks; locked merge no-clobber;
  lock contention envelope; quota cap on writes; `setBackendConfig` auth-field
  rejection; groups-mode list inapplicability.
- Frontend unit coverage: `getApplicationAccess` service/Zod contract including
  `reason`; deny-state rendering; role-aware settings composition; admin-only
  surface gating; removal of auth fields from the settings form transport.
- Backend transport tests: `setBackendConfig` auth-field rejection; new endpoint
  allowlisting and envelope behaviour. E2E (Playwright) where user-visible: auth
  gate with roles and settings surfaces. Live deployment validation remains flagged
  (identity, consent, Groups lookup).

## V1 scope

### Include in v1

- Base + two provider subclasses with `authMode` resolution; `'none'` removal.
- Persistent `authUsers`/`authRevision` with strict validation, revision-guarded
  atomic saves, and the locked configuration write path.
- Bootstrap claim through the shared access-resolution path (protected calls and
  the gate-exempt access endpoint), legacy-groups compatibility, manual migration
  path.
- The three new endpoints and role enforcement on exactly two admin surfaces.
- Gate-exempt `getApplicationAccess` with deny-state `reason`.

### Defer from v1

- Group membership editing/import, directory lookups, bulk user import, CSV, invites.
- Broader RBAC or per-method role filtering beyond the two admin surfaces.
- Gmail alias/dot/plus normalisation beyond trim/lowercase.

## Open questions

None; live deployment behaviour (identity resolution and Groups lookup under school
tenancy) is flagged for post-implementation validation rather than open questions.
