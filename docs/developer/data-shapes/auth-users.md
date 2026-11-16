# Contract: AuthUsers

Application authentication state and the managed user list: two-provider membership
resolution (`googleGroups` | `scriptProperties`), the persistent authorised-user list
with roles, and the auth management/access endpoints.

> Auth state is owned by this contract. `BackendConfig` does not transport `authMode` or
> `authGroupEmail`; authentication is configured on the Authentication settings surface through
> the auth endpoints below. See [Known discrepancies](#known-discrepancies) for reconciliation
> notes.

Backend implementation: `src/backend/Utils/AuthService.js` (base) +
`GoogleGroupsAuthService` + `ScriptPropertiesAuthService` subclasses;
`AuthService._attemptBootstrapClaim()` fresh-install claim;
`src/backend/z_Api/apiAuth.js` (transport file)
Persistence: inside the existing single JSON blob in `PropertiesService.getScriptProperties()` under key `__CONFIG_STORE_KEY__` (see [Contract: BackendConfig](backend-config.md))
API handlers: `getApplicationAccess`, `getAuthenticationSettings`, `setAuthenticationSettings` (registered in `ALLOWLISTED_METHOD_HANDLERS`)
Response mapper: None — handlers shape data from `AuthService`/`ConfigurationManager` methods
Frontend service: `src/frontend/src/services/authService/authService.ts` — `getApplicationAccess()`, `getAuthenticationSettings()`, `setAuthenticationSettings()` (all via `callApi`)
Frontend Zod: `src/frontend/src/services/authService/authService.zod.ts` — `ApplicationAccessSchema`, `AuthenticationSettingsSchema`, `AuthUserEntrySchema`, `SetAuthenticationSettingsRequestSchema`, `SetAuthenticationSettingsResultSchema` (all `.strict()`)

Sibling contracts:

- [Contract: BackendConfig](backend-config.md) — shares the `__CONFIG_STORE_KEY__`
  blob; auth fields leave the BackendConfig transport in favour of this contract.
- [Contract: AuthCache](auth-cache.md) — Google Groups membership memoisation;
  the Script Properties provider uses no success cache.
- [Contract: TransportEnvelope](transport-envelope.md) — all endpoints share the
  standard envelope.

---

## Persistence

Auth fields live inside the existing `__CONFIG_STORE_KEY__` JSON blob. All stored
values are strings, consistent with the BackendConfig blob conventions.

| Field            | Stored type             | Mode applicability       | Notes                                                                                                                                                                                                                                                                                 |
| ---------------- | ----------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authMode`       | `string`                | Always (after bootstrap) | `googleGroups` \| `scriptProperties`. `'none'` is removed entirely. Absent `authMode` with a non-blank `authGroupEmail` reads as `googleGroups` (single documented leniency, reachable only via hand-edited/cloned blobs). Absent `authMode` without a group is a broken-config deny. |
| `authGroupEmail` | `string`                | `googleGroups` mode      | Required non-blank in groups mode. Compulsory-once-set rule retained regardless of mode.                                                                                                                                                                                              |
| `authUsers`      | `string` (JSON array)   | `scriptProperties` mode  | JSON string array of `AuthUserEntry`. Absent/blank/malformed or zero admins in scriptProperties mode is a broken-config deny. Absent on legacy groups installs is valid. In groups mode a stored list is retained but unused for access and not editable.                             |
| `authRevision`   | `string` (positive int) | `scriptProperties` mode  | Lost-update guard; seeded `'1'` by the bootstrap claim or the first provider switch.                                                                                                                                                                                                  |

### AuthUserEntry (element of the parsed `authUsers` array)

```ts
{
  email: string,  // trimmed, lowercased; no Gmail alias/dot/plus rewriting
  role: 'admin' | 'user',
}
```

- Reject duplicates, unknown roles, and unknown keys (no extra properties).
- At least one `admin` must exist whenever the list is stored.

### Validation rules

- **Security reads are strict**: missing/blank/malformed auth fields for the active
  mode, stored `'none'`, or any unrecognised mode produce a broken-config deny (fail
  closed, loud audit log, no secrets in output). Deny decisions are made in the
  access-resolution path, not by making the forgiving transport getter throw.
- The whole config blob stays under a conservative **8KB cap**, enforced on all
  configuration writes (auth and ordinary) — see [Contract: BackendConfig](backend-config.md).
- All configuration writes serialise through the script-wide
  `LockService.getScriptLock()` shared with `DbLockService` (non-reentrant): under
  the lock the writer re-reads the blob from storage, merges, and writes once.
  Contention yields a retriable validation error envelope, never a silent drop; no
  config write may run while a DB operation holds the script lock.

### Bootstrap (fresh install)

**Preconditions (all three required for a claim):**

- Raw store fresh/absent: `ConfigurationManager.isFreshInstall()` returns true —
  `__CONFIG_STORE_KEY__` is absent from raw Script Properties (never the forgiving
  config cache). `AuthService` must not read configuration getters before this method
  runs (deterministic regardless of execution order).
- Interactive caller: resolution options carry `neverClaim: false` (default). Trigger
  execution passes `neverClaim: true` and never claims.
- Non-blank server-resolved identity: `Session.getActiveUser().getEmail()` is non-blank;
  `checkAccess` normalises it to trimmed/lowercase so the stored canonical email matches
  later membership resolution. A blank resolved email denies without claiming.

**Successful same-resolution result:** `{ allowed: true, role: 'admin' }` returned
within the same access-resolution call (no client invalidation step). The single atomic
locked write commits exactly the auth-only blob:

| Field          | Persisted value                             | Notes                                                             |
| -------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| `authMode`     | `'scriptProperties'`                        | Written by the claim; no silent getter fallback.                  |
| `authUsers`    | JSON string of `[{ email, role: 'admin' }]` | Canonical sole-admin entry; `email` normalised trimmed/lowercase. |
| `authRevision` | `'1'`                                       | Seeded by the claim.                                              |

No default/non-auth seeding: the claim writes only those three auth fields;
`ensureDefaultConfiguration()` is deliberately not invoked, so non-auth getters fall
back to `DEFAULTS` (intended behaviour).

**Freshness re-check and atomicity:**

- The claim re-checks freshness before entering the shared locked write
  (`ConfigurationManager.writeConfigurationLocked`) and again
  **inside** the lock; the in-lock probe re-reads the RAW blob, so a blob that appears
  between the pre-lock probe and the lock aborts the claim rather than overwriting it.
- Exactly **one** atomic write: a single `LockService.getScriptLock()` acquisition, raw
  re-read, merge, and one `setProperty` of `__CONFIG_STORE_KEY__`.
- When a blob appears after the probe, the claim is skipped and the existing blob is
  preserved byte-for-byte — no overwrite.

**Failure handling:** lock contention (`CONFIG_LOCK_CONTENTION`), blob-cap excess
(`CONFIG_BLOB_TOO_LARGE`), or any persistence/write failure denies fail-closed
(`{ allowed: false }`) with a safe audit that never echoes the serialised admin list or
the `authRevision` value; no partial auth state is written and a later request may retry.

**Never-claim contexts:** blank-email callers and trigger execution (`neverClaim: true`)
are denied without claiming or writing; the next eligible caller retries the claim.

---

## Transport

> The `apiAuth.js` endpoints below conform to this contract. The frontend
> `authService.zod.ts` / `authService.ts` consume them (see the [Validation](#validation)
> frontend block).

### `getApplicationAccess` (gate-exempt, all callers)

Joins `hasScriptAuthorisation` in the gate-exempt set, but routes through the same
access-resolution path as `checkAccess`, so the bootstrap claim fires here on a
fresh install. Reveals only the caller's own access state (no method-surface
probing); ordinary protected-method denial remains the uniform `FORBIDDEN`
envelope.

**Request:** No parameters.

**Response:**

| Field     | Type                        | Notes                                                         |
| --------- | --------------------------- | ------------------------------------------------------------- |
| `allowed` | `boolean`                   |                                                               |
| `role`    | `'admin' \| 'user' \| null` | `null` when not allowed or not yet claimed.                   |
| `email`   | `string`                    | Server-resolved; `''` when blank.                             |
| `reason`  | `string` enum               | `'ok'` \| `'freshInstall'` \| `'brokenConfig'` \| `'denied'`. |

- Pre-claim fresh install returns `reason: 'freshInstall'`; a claimable caller's
  same call returns `reason: 'ok'` with the claimed admin role (no client
  invalidation step).

### `getAuthenticationSettings` (admin-only)

**Request:** No parameters.

**Response:**

| Field            | Type                                   | Notes                                                                                        |
| ---------------- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `authMode`       | `'googleGroups' \| 'scriptProperties'` |                                                                                              |
| `authGroupEmail` | `string`                               |                                                                                              |
| `authUsers`      | `AuthUserEntry[]`                      | Always `[]` in `googleGroups` mode; a retained legacy stored list is not parsed or returned. |
| `authRevision`   | `string \| null`                       | `null` when not applicable (groups mode).                                                    |

- The handler returns the raw `getAuthMode()` value, typed as `'googleGroups' | 'scriptProperties' | null`.
  The dispatcher's admin-admission gate (see the admin-enforcement mechanism below) resolves access
  fresh and denies a broken configuration with the `FORBIDDEN` envelope before the handler runs, so
  in practice `authMode` is always one of the two valid modes.

### `setAuthenticationSettings` (admin-only)

**Request:**

| Field                  | Type                                   | Notes                                                                                                                                           |
| ---------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `authMode`             | `'googleGroups' \| 'scriptProperties'` | Candidate mode.                                                                                                                                 |
| `authGroupEmail`       | `string`                               | Required non-blank when mode is `googleGroups`.                                                                                                 |
| `authUsers`            | `AuthUserEntry[]`                      | Required full candidate list when mode is `scriptProperties`; must be omitted in groups mode (not editable).                                    |
| `expectedAuthRevision` | `string`                               | Required only when a stored `authRevision` exists; omitted on the first switch from groups/legacy (seeds `'1'`); not applicable in groups mode. |

**Response:** `{ success: true, authRevision }` on commit, or a validation failure
envelope (stale revision, last-admin violation, invalid entry, candidate-check
failure, quota cap). Stored config is unchanged on any failure — no partial writes.
`authRevision` is the new positive-integer-string revision in `scriptProperties` mode
and `null` in `googleGroups` mode (no revision is maintained there).

The following save failures carry a stable, safe `error.code` (owned by
`AUTH_SETTINGS_ERROR_CODES` in `AuthSettingsDomain` and emitted via
`ApiValidationError.code`; see
[Transport Envelope](transport-envelope.md#stable-authentication-settings-save-codes)):
`AUTH_SETTINGS_STALE_REVISION`, `AUTH_SETTINGS_REVISION_REQUIRED`,
`AUTH_SETTINGS_LAST_ADMIN`, `AUTH_SETTINGS_INVALID_CANDIDATE`, or
`AUTH_SETTINGS_SAVING_ADMIN_DENIED`. A candidate Google Group lookup that fails at
the external Groups service — and configuration-lock contention — is instead a
retriable `RATE_LIMITED` envelope, distinguishing a transient service failure from
a genuine saving-admin role denial. Save-failure paths outside that list — a broken
stored configuration, `authUsers` supplied in `googleGroups` mode, an invalid/blank
candidate group email, an over-cap blob, and the transport-level request-shape
rejections (non-object payload or unknown field) — still map to the generic
non-retriable `INVALID_REQUEST` code.

- Provider-switch validation checks the saving admin against the **candidate**
  configuration with fresh lookups (never cache): target `scriptProperties` requires
  the admin in the candidate list with role `admin`; target `googleGroups` requires
  a fresh `GroupsApp` lookup yielding `OWNER`/`MANAGER` against the candidate group.
- Removing or demoting the last admin is rejected.
- Saves are revision-guarded and atomic (lock + fresh re-read + single write +
  revision increment).

**Admin enforcement mechanism:** non-admin calls to the settings pair are rejected in
the dispatcher admission phase — a declarative admin-required method set in
`z_apiHandler.js` is checked against access state resolved fresh (cache bypassed) —
reusing the existing `FORBIDDEN` gate envelope. No new error type or envelope case is
introduced; handler-level guards are not duplicated.

---

## Sub-entities

None — `AuthUserEntry` is embedded in the `authUsers` JSON array; no separate
registry.

---

## Validation

**Backend:**

- `src/backend/ConfigurationManager/01_configKeysAndSchema.js` — `authMode` enum accepts only `googleGroups`/`scriptProperties` (`'none'` removed);
  `authUsers` validator (`validateAuthUsersJson_`, a thin canonical-JSON wrapper over
  `parseAuthUsersJson_`) accepts only a JSON string array of `{ email, role }` entries
  with trimmed, lowercased, unique emails, roles limited to `admin`|`user`, no unknown
  keys per entry, at least one entry and at least one admin; normalisation is not applied
  (unnormalised input is rejected) and the canonical JSON string is returned; the
  zero-admin violation is tagged `error.reason === 'ZERO_ADMINS'` so callers can
  distinguish a last-admin conflict from any other invalid candidate; `authRevision`
  validator (`validateAuthRevision_`) accepts only positive-integer strings (`'1'`,
  `'42'`) and rejects `'0'`, `'abc'`, `''`, negatives, fractions, and non-string types;
  the strict security read (`validateAuthStateStrict_`) applies the single
  absent/blank-`authMode`-with-non-blank-group leniency and throws on every other
  broken auth state; the resolved `scriptProperties` state additionally carries
  `authUsersParsed` — the entry array produced by the single `parseAuthUsersJson_` pass —
  alongside the canonical `authUsers` JSON string, so downstream consumers reuse the
  parsed list instead of re-parsing the same bytes (the `googleGroups` state returns the
  raw stored `authUsers`/`authRevision` unchanged, which may be `undefined` on legacy
  installs); the forgiving transport getter (`getAuthMode()`) never throws,
  resolves absent/blank+group to `googleGroups`, and resolves to `null` otherwise;
  the 8KB blob cap constant (`MAX_CONFIG_BLOB_BYTES`, 8192) is exported for the
  locked write path.
- `src/backend/Utils/AuthService.js` — provider
  resolution runs the state machine (`freshInstall` → `legacyGroups` leniency →
  `configured` provider → `broken` deny) via `AuthService.getInstance()`; identity
  resolution denies a blank server-resolved email (no claim, no cache write); strict
  deny paths fail closed with an error-level audit; the single legacy leniency
  (absent/blank `authMode` + non-blank `authGroupEmail` → `googleGroups`) is the only
  fallback and every other broken state denies; the removed `'none'` bypass is gone
  (stored `'none'` is an unrecognised mode → deny); cache policy is provider-split and owned
  by [Contract: AuthCache](auth-cache.md); `bypassCache: true` forces a fresh `GroupsApp`
  lookup, while `ScriptPropertiesAuthService` has no success cache and reads the list fresh
  per request; the trigger execution
  context passes `neverClaim: true` and `bypassCache: true` (the defunct `requireConfigured` option is not accepted). `checkAccess()` is a thin
  caller-facing wrapper over the single shared `_resolveAccessDecision()` pipeline
  (identity normalisation → fresh-install claim → strict state resolution → provider
  membership); `getApplicationAccess` consumes that same pipeline through
  `AuthSettingsDomain.resolveApplicationAccess()`, with `fallThroughOnClaimFailure: true` as
  the only endpoint-specific branch (the protected path denies fail-closed when a competing
  writer wins the bootstrap race; the gate-exempt path classifies the newly committed state).
  The fresh-install bootstrap claim (`AuthService._attemptBootstrapClaim()`)
  re-checks freshness before and inside the `writeConfigurationLocked` lock,
  commits exactly the auth-only blob (`authMode: 'scriptProperties'`, the caller as sole
  admin in `authUsers`, `authRevision: '1'`), performs one atomic locked write, skips or
  aborts without overwrite when a blob appears, denies fail-closed with a safe audit on
  contention/cap/write failure (allowing a retry), and never claims for blank-email or
  trigger (`neverClaim: true`) callers.
- `src/backend/Utils/GoogleGroupsAuthService.js` — `_isGroupMember()` remains
  the access-path guard and collapses an external GroupsApp failure into a denial
  (fail-closed, logged at error level); `_resolveGroupRole()` performs the fresh role lookup
  and `_mapGroupDecision()` owns the `OWNER`/`MANAGER → admin` / `MEMBER → user` mapping;
  `_resolveCandidateAdmin()` is the provider-switch saving-admin check and deliberately lets
  an external GroupsApp failure propagate so the save path can return a retriable
  `RATE_LIMITED` envelope, while a genuine non-owner/manager resolves to `false` and becomes
  a non-retriable `AUTH_SETTINGS_SAVING_ADMIN_DENIED`.
- `src/backend/Utils/ScriptPropertiesAuthService.js` — reads
  `authState.authUsersParsed` directly (the strict resolver validates first), so the stored
  list is parsed exactly once per resolution; there is no defensive `JSON.parse` failure catch
  and no success cache.
- `src/backend/z_Api/apiConfig.js`: `setBackendConfig_`
  rejects all auth fields as `ApiValidationError` (`INVALID_REQUEST`) for every caller, including
  admins (see [Contract: BackendConfig](backend-config.md) for the transport contract).

**Frontend Zod** (`src/frontend/src/services/authService/authService.zod.ts`):

- `ApplicationAccessSchema` — validates the `getApplicationAccess` response:
  `allowed: z.boolean()`, `role: z.enum(['admin','user']).nullable()`,
  `email: z.string()`, `reason: z.enum(['ok','freshInstall','brokenConfig','denied'])`; `.strict()`.
- `AuthenticationSettingsSchema` — validates the `getAuthenticationSettings` response:
  `authMode: z.enum(['googleGroups','scriptProperties'])`, `authGroupEmail: z.string()`,
  `authUsers: z.array(AuthUserEntrySchema)`, `authRevision: z.string().nullable()`; `.strict()`.
- `AuthUserEntrySchema` — validates one `authUsers` element: `email: z.string()`,
  `role: z.enum(['admin','user'])`; `.strict()` (no extra keys, only the two roles).
- `SetAuthenticationSettingsRequestSchema` — `z.discriminatedUnion('authMode', ...)`:
  - `ScriptPropertiesSaveRequestSchema`: `authMode: z.literal('scriptProperties')`,
    `authUsers: ScriptPropertiesCandidateUsersSchema` (an `AuthUserEntrySchema[]` refined to
    require at least one `admin`, mirroring the backend last-admin invariant),
    `expectedAuthRevision: z.string().optional()`; `.strict()` (omits `authGroupEmail`).
  - `GoogleGroupsSaveRequestSchema`: `authMode: z.literal('googleGroups')`,
    `authGroupEmail: z.string().trim().min(1)`; `.strict()` (omits `authUsers`/`expectedAuthRevision`).
  - The `googleGroups` variant must omit `authUsers`/`expectedAuthRevision` entirely; the
    `scriptProperties` variant carries the full candidate list and supplies `expectedAuthRevision`
    only when a stored revision exists (omitted on the first switch, which seeds `'1'`).
- `SetAuthenticationSettingsResultSchema` — validates the commit result:
  `success: z.literal(true)`, `authRevision: z.string().nullable()`; `.strict()` (new revision in
  `scriptProperties` mode, `null` in `googleGroups` mode).

**Frontend service** (`src/frontend/src/services/authService/authService.ts`):

- `getApplicationAccess()` — `callApi('getApplicationAccess')`, parsed with `ApplicationAccessSchema`.
- `getAuthenticationSettings()` — `callApi('getAuthenticationSettings')`, parsed with `AuthenticationSettingsSchema`.
- `setAuthenticationSettings(request)` — validates the raw request against
  `SetAuthenticationSettingsRequestSchema` before `callApi('setAuthenticationSettings', parsedRequest)`,
  then parses the result with `SetAuthenticationSettingsResultSchema`.
- `hasScriptAuthorisation()` — `callApi('hasScriptAuthorisation')` (ScriptApp OAuth scope gate; not application membership or admin role).
- All method names match `ALLOWLISTED_METHOD_HANDLERS` in the backend `z_apiHandler.js`.

**Key domain validation rules (frontend):**

- `.strict()` lockstep: every schema rejects an undeclared key, so the backend must never emit a
  field absent from the schema (and vice versa). This matches the BackendConfig `.strict()`
  deploy-order tolerance convention.
- The `setAuthenticationSettings` request is validated client-side before transport, so an invalid
  per-mode field set (e.g. supplying `authUsers` in groups mode, or `authGroupEmail` in
  scriptProperties mode) is rejected before `callApi` is called. The `scriptProperties` candidate
  list must also contain at least one `admin`, so the backend `AUTH_SETTINGS_LAST_ADMIN` rejection
  is a defence-in-depth fallback rather than the primary guard.
- Auth surface is sourced exclusively from these endpoints; `BackendSettingsPanel` does not
  transport `authMode`/`authGroupEmail` (see `backend-config.md`).

### Known discrepancies

- `checkAccess()` wraps the shared `_resolveAccessDecision()` pipeline (identity normalisation →
  fresh-install claim → strict state resolution → provider membership).
  `getApplicationAccess` uses the same pipeline through
  `AuthSettingsDomain.resolveApplicationAccess()`, with `fallThroughOnClaimFailure: true` as the
  only endpoint-specific branch: the protected path denies fail-closed when a competing writer
  wins the bootstrap race, while the gate-exempt path classifies the newly committed state.
- Provider resolution, strict deny, blank-identity deny, the single legacy leniency
  (absent/blank `authMode` + non-blank `authGroupEmail` → `googleGroups`), the removed `'none'`
  bypass, the Groups/Script Properties cache split, and the `neverClaim`/`bypassCache` trigger
  context match the shapes above.
- `getApplicationAccess` is gate-exempt (it joins `hasScriptAuthorisation` in
  `GATE_EXEMPT_METHOD_NAMES`). It performs the bootstrap claim and returns the four-value
  `reason` enum with no `'unconfigured'` and no `provider` field.
  `getAuthenticationSettings` and `setAuthenticationSettings` are admin-only via the dispatcher's
  `ADMIN_REQUIRED_METHOD_NAMES`, which resolves access fresh with `bypassCache: true` and rejects
  non-admins with the standard `FORBIDDEN` envelope.
- `setAuthenticationSettings` enforces the revision guard: it seeds `'1'` on the first switch,
  requires `expectedAuthRevision` when a stored revision exists, increments on commit, and returns
  `authRevision: null` in groups mode. Lock contention maps to a retriable `RATE_LIMITED`
  envelope; an over-cap blob maps to `INVALID_REQUEST`.
- `ScriptPropertiesCandidateUsersSchema` refines the candidate `authUsers` array to require at
  least one `admin` entry (`'At least one administrator is required.'`), so a zero-admin candidate
  is rejected before `callApi` rather than relying on the backend `AUTH_SETTINGS_LAST_ADMIN`
  rejection. This agrees with the backend invariant.
- `mapAuthenticationSettingsSaveError()` in
  `src/frontend/src/features/settings/authentication/useAuthenticationSettings.helpers.ts` selects
  user-safe copy from `ApiTransportError.code` via `authSettingsSaveErrorMappings`. Raw backend
  `error.message` is never rendered.
  `AUTH_SETTINGS_SAVING_ADMIN_DENIED` resolves through
  `resolveSavingAdminDeniedMapping(targetMode)`, selecting
  `googleGroupsSavingAdminDeniedMessage` for `googleGroups` and
  `scriptPropertiesSavingAdminDeniedMessage` for `scriptProperties`, mirroring the two backend
  emitters in `AuthSettingsDomain.verifySavingAdminForSwitch()`. A local request-schema `ZodError`
  carries no transport code, so the two locally authored candidate-field messages
  (`authGroupEmail`, `authUsers`) are resolved from the Zod issue before generic copy.

---

## File Index

```
Persistence:                 src/backend/ConfigurationManager/
  ├── 01_configKeysAndSchema.js     — CONFIG_KEYS/CONFIG_SCHEMA
  └── 98_ConfigurationManagerClass.js  — freshness detection method; locked write path

Auth services:               src/backend/Utils/
  ├── AuthService.js                — base: resolution, identity, audit, claim
  ├── GoogleGroupsAuthService.js    — GroupsApp membership + role mapping
  └── ScriptPropertiesAuthService.js — user-list membership, no cache

API handlers:                src/backend/z_Api/
  ├── apiAuth.js                    — getApplicationAccess, get/setAuthenticationSettings
  └── z_apiHandler.js               — ALLOWLISTED_METHOD_HANDLERS registration; gate exemption

Frontend:                    src/frontend/src/services/authService/
  ├── authService.zod.ts            — ApplicationAccessSchema, AuthenticationSettingsSchema, AuthUserEntrySchema, SetAuthenticationSettingsRequestSchema, SetAuthenticationSettingsResultSchema
  └── authService.ts                — getApplicationAccess(), getAuthenticationSettings(), setAuthenticationSettings(), hasScriptAuthorisation()

Feature:                     src/frontend/src/features/settings/authentication/
  ├── useAuthenticationSettings.helpers.ts — save-error code→copy mapping (mode-aware) + failure logging
  └── useAuthenticationSettings.ts         — orchestration; threads the staged authMode to the mapper
```
