# Contract: AuthUsers

Application authentication state and the managed user list: two-provider membership
resolution (`googleGroups` | `scriptProperties`), the persistent authorised-user list
with roles, and the auth management/access endpoints.

> **Status: Partially implemented** — recorded from `SPEC.md` v1.3 (Application
> Authentication & Minimal Role Administration). The persistence/validation layer
> (Section 1 config schema) and the AuthService provider resolution, strict deny
> paths, Groups/Script Properties cache policy, and never-claim trigger execution
> context (Section 3) have landed. The bootstrap claim (Section 4) and the transport
> endpoints in `apiAuth.js` (Section 5) remain `Not implemented`. Remove this marker
> only when Sections 4–5 are delivered.

Backend implementation: `src/backend/Utils/AuthService.js` (base) +
`GoogleGroupsAuthService` + `ScriptPropertiesAuthService` subclasses (landed,
ACTION_PLAN §3); `src/backend/z_Api/apiAuth.js` (new transport file, **Not
implemented**, ACTION_PLAN §5)
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

> **Status: Not implemented** (ACTION_PLAN §4) — the bootstrap claim is not yet landed;
> `AuthService._attemptBootstrapClaim()` currently denies a fresh install without mutation.

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

> **Status: Not implemented** (ACTION_PLAN §5) — the `apiAuth.js` endpoints below are the
> target transport contract; code must conform to this spec as it lands.

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

**Backend:**

- `src/backend/ConfigurationManager/01_configKeysAndSchema.js` — **implemented**:
  `authMode` enum accepts only `googleGroups`/`scriptProperties` (`'none'` removed);
  `authUsers` validator (`validateAuthUsersJson_`) accepts only a JSON string array
  of `{ email, role }` entries with trimmed, lowercased, unique emails, roles limited
  to `admin`|`user`, no unknown keys per entry, at least one entry and at least one
  admin; normalisation is not applied (unnormalised input is rejected) and the
  canonical JSON string is returned; `authRevision` validator
  (`validateAuthRevision_`) accepts only positive-integer strings (`'1'`, `'42'`)
  and rejects `'0'`, `'abc'`, `''`, negatives, fractions, and non-string types; the
  strict security read (`validateAuthStateStrict_`) applies the single
  absent/blank-`authMode`-with-non-blank-group leniency and throws on every other
  broken auth state; the forgiving transport getter (`getAuthMode()`) never throws,
  resolves absent/blank+group to `googleGroups`, and resolves to `null` otherwise;
  the 8KB blob cap constant (`MAX_CONFIG_BLOB_BYTES`, 8192) is exported for the
  locked write path.
- `src/backend/Utils/AuthService.js` — **implemented (ACTION_PLAN §3)**: provider
  resolution runs the state machine (`freshInstall` → `legacyGroups` leniency →
  `configured` provider → `broken` deny) via `AuthService.getInstance()`; identity
  resolution denies a blank server-resolved email (no claim, no cache write); strict
  deny paths fail closed with an error-level audit; the single legacy leniency
  (absent/blank `authMode` + non-blank `authGroupEmail` → `googleGroups`) is the only
  fallback and every other broken state denies; the removed `'none'` bypass is gone
  (stored `'none'` is an unrecognised mode → deny); cache policy splits by provider —
  `GoogleGroupsAuthService` uses the `auth:<groupEmail>:<email>` key with a 21600-second
  TTL, `OWNER`/`MANAGER` → `admin`, `MEMBER` → `user`, denials never cached,
  `bypassCache: true` forces a fresh `GroupsApp` lookup, while `ScriptPropertiesAuthService`
  has no success cache and reads the list fresh per request; the trigger execution
  context passes `neverClaim: true` and `bypassCache: true` (the defunct
  `requireConfigured` option is dropped). The bootstrap claim itself is **Not
  implemented** and belongs to ACTION_PLAN §4.
- `src/backend/z_Api/apiConfig.js` — **planned**: `setBackendConfig_` rejects all
  auth fields as `ApiValidationError` (`INVALID_REQUEST`).

**Frontend (planned):**

- Zod schemas mirroring the three response/request shapes (`.strict()` lockstep,
  respecting the deploy-order tolerance conventions used by BackendConfig).
- Auth surface sourced exclusively from these endpoints; `BackendSettingsPanel`
  no longer transports `authMode`/`authGroupEmail`.

### Known discrepancies

- Section 3 (AuthService provider/cache/trigger context) has landed with no drift against
  this contract: provider resolution, strict deny, blank-identity deny, the single legacy
  leniency, the removed `'none'` bypass, the Groups/Script Properties cache split, and the
  `neverClaim`/`bypassCache` trigger context all match the shapes above.
- Sections 4 (bootstrap claim) and 5 (transport endpoints) are still `Not implemented`;
  their planned markers are retained and no discrepancies are asserted for unbuilt code.

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
