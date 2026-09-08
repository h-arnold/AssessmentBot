# Contract: AuthUsers

Application authentication state and the managed user list: two-provider membership
resolution (`googleGroups` | `scriptProperties`), the persistent authorised-user list
with roles, and the auth management/access endpoints.

> **Status: Not implemented** — planned contract recorded from
> `SPEC.md` v1.3 (Application Authentication & Minimal Role Administration) before
> implementation starts. Shapes below are the target contract; code must conform to
> this spec as it lands. Remove this marker when the contract is delivered.

Planned backend implementation: `src/backend/Utils/AuthService.js` (base) +
`GoogleGroupsAuthService` + `ScriptPropertiesAuthService` subclasses; `src/backend/z_Api/apiAuth.js` (new transport file)
Persistence: inside the existing single JSON blob in `PropertiesService.getScriptProperties()` under key `__CONFIG_STORE_KEY__` (see [Contract: BackendConfig](backend-config.md))
API handlers: `getApplicationAccess`, `getAuthenticationSettings`, `setAuthenticationSettings` (registered in `ALLOWLISTED_METHOD_HANDLERS`)
Response mapper: None — handlers shape data from `AuthService`/`ConfigurationManager` methods
Frontend service: `src/frontend/src/services/authService/` (planned typed access)
Frontend Zod: planned schemas matching the shapes below (`.strict()` lockstep)

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
  configuration writes (auth and ordinary) — see BackendConfig planned notes.
- All configuration writes serialise through the script-wide
  `LockService.getScriptLock()` shared with `DbLockService` (non-reentrant): under
  the lock the writer re-reads the blob from storage, merges, and writes once.
  Contention yields a retriable validation error envelope, never a silent drop; no
  config write may run while a DB operation holds the script lock.

### Bootstrap (fresh install)

- Freshness detection is a `ConfigurationManager` method: run `ConfigurationManager`
  initialisation first, then read raw Script Properties for `__CONFIG_STORE_KEY__`
  absence (never the forgiving config cache). `AuthService` must not read
  configuration getters before it.
- The first interactive caller with a non-blank server-resolved email atomically
  becomes admin through the shared access-resolution path (single write commits
  `authMode: 'scriptProperties'`, caller as sole admin, `authRevision: '1'`).
  Existing config — however empty or malformed — never bootstraps; blank-email
  callers and trigger execution never claim.
- The claim writes a blob containing only auth fields; default seeding is then
  skipped and non-auth getters fall back to `DEFAULTS` (intended behaviour).

---

## Transport

### `getApplicationAccess` (gate-exempt, all callers)

Joins `getAuthorisationStatus` in the gate-exempt set, but routes through the same
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

| Field            | Type                                   | Notes                                                 |
| ---------------- | -------------------------------------- | ----------------------------------------------------- |
| `authMode`       | `'googleGroups' \| 'scriptProperties'` |                                                       |
| `authGroupEmail` | `string`                               |                                                       |
| `authUsers`      | `AuthUserEntry[]`                      | Parsed stored list; `[]` when absent (groups/legacy). |
| `authRevision`   | `string \| null`                       | `null` when not applicable (groups mode).             |

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

**Backend (planned):**

- `src/backend/ConfigurationManager/01_configKeysAndSchema.js` — `authMode` enum
  loses `'none'`; `authUsers`/`authRevision` validators added with strict
  security-read semantics distinct from the forgiving general parser.
- `src/backend/Utils/AuthService.js` — provider resolution, bootstrap claim, strict
  deny paths, never-claim trigger execution context (`requireConfigured` dropped,
  `bypassCache` retained).
- `src/backend/z_Api/apiConfig.js` — `setBackendConfig_` rejects all auth fields as
  `ApiValidationError` (`INVALID_REQUEST`).

**Frontend (planned):**

- Zod schemas mirroring the three response/request shapes (`.strict()` lockstep,
  respecting the deploy-order tolerance conventions used by BackendConfig).
- Auth surface sourced exclusively from these endpoints; `BackendSettingsPanel`
  no longer transports `authMode`/`authGroupEmail`.

### Known discrepancies

None yet — contract not implemented. Add discrepancies as the implementation lands.

---

## File Index

```
Persistence:                 src/backend/ConfigurationManager/
  ├── 01_configKeysAndSchema.js     — CONFIG_KEYS/CONFIG_SCHEMA additions + 'none' removal
  └── 98_ConfigurationManagerClass.js  — freshness detection method; locked write path

Auth services:               src/backend/Utils/
  ├── AuthService.js                — base: resolution, identity, audit, claim
  ├── GoogleGroupsAuthService.js    — (planned) GroupsApp membership + role mapping
  └── ScriptPropertiesAuthService.js — (planned) user-list membership, no cache

API handlers:                src/backend/z_Api/
  ├── apiAuth.js                    — (planned) getApplicationAccess, get/get-setAuthenticationSettings
  └── z_apiHandler.js               — ALLOWLISTED_METHOD_HANDLERS registration; gate exemption

Frontend:                    src/frontend/src/services/authService/ (planned)
  ├── authService.zod.ts            — response/request schemas
  └── authService.ts                — typed endpoint access
```
