# Application-Level Authentication

This is **Layer 2** of the security approach: the application-level authentication layer
built on the platform controls of Layer 1 (see [platform-security.md](./platform-security.md)).
It verifies that the calling user is authorised — either as a member of a designated Google
Group or as a named user stored in Script Properties — before any protected request is
dispatched, guards against accidental misconfiguration of the platform layer, and enforces
**role-based access control** (`admin` / `user`) today. Where Layer 1 asks "can this person
reach the web app at all?", Layer 2 asks "is this person allowed to use the application, and
with which role?" — and answers it independently on every protected call.

The layer is implemented by `AuthService` (`src/backend/Utils/AuthService.js`), a singleton
that centralises identity resolution, provider resolution, role mapping, successful-result
caching, access-attempt audit logging, the fresh-install bootstrap claim, and the
auth-management domain operations consumed by the transport endpoints. Provider-specific
membership decisions are delegated to two concrete subclasses selected by the stored
`authMode`:

- `GoogleGroupsAuthService` (`src/backend/Utils/GoogleGroupsAuthService.js`) — Google Groups
  membership provider.
- `ScriptPropertiesAuthService` (`src/backend/Utils/ScriptPropertiesAuthService.js`) — Script
  Properties user-list provider.

The gate is enforced at two boundaries: the API transport gate in `ApiDispatcher.handle()`
(`src/backend/z_Api/z_apiHandler.js`) and the trigger execution path
(`src/backend/Triggers/triggerHandler.js`).

## Identity resolution

- `AuthService.checkAccess()` resolves the caller with
  `Session.getActiveUser().getEmail()` (`src/backend/Utils/AuthService.js`). Under the
  Layer 1 deployment pairing (`webapp.executeAs: USER_ACCESSING` with
  `webapp.access: DOMAIN`, see `src/backend/appsscript.json`), the script runs _as the
  signed-in user_ and the platform has already established that this is a real
  Workspace-domain identity. Layer 2 therefore never handles credentials or
  authentication tokens; it consumes the platform's identity verdict and applies its own
  authorisation decision on top.
- **Normalisation.** The resolved email is trimmed and lowercased once, before any
  membership lookup, bootstrap claim, or audit log. Stored `AuthUserEntry` emails follow the
  same canonical form (trimmed, lowercased), so a raw identity with mixed case or surrounding
  whitespace compares correctly without special-casing.
- **Blank-email defence-in-depth.** If the resolved email is blank — which should not
  occur under the correct deployment mode, but is cheap to guard against — access is
  denied with a warn-level audit log (`AuthService.js`:
  `'AuthService: failed to resolve the active user email.'`). This check runs first, before
  any bootstrap or membership resolution, so a blank identity is never authorised, claimed,
  or cached.
- The gate never falls back to `Session.getEffectiveUser()` or any other identity source,
  so the authorisation decision is always anchored to the caller's signed-in identity.

## Provider model

The resolved `authMode` selects which provider performs the membership decision. The strict
auth-state resolver (`validateAuthStateStrict_`) validates the stored configuration first and
applies a single documented leniency; every other broken configuration denies access
fail-closed.

- **`googleGroups`.** The caller's Google Group membership is checked (see below). This is
  the appropriate choice when all application users already belong to one Workspace group.
- **`scriptProperties`.** The caller's email is matched against a stored `authUsers` list
  (see below). This choice removes the Google Groups dependency, which is useful for
  domains or cohorts that cannot be modelled as a single Workspace group.
- **Removed mode.** The `authMode` value `'none'` has been removed entirely. The strict
  resolver rejects a stored or requested `'none'` as an unrecognised mode, so the access gate
  fails closed rather than disabling authentication.
- **Single leniency.** An absent or blank `authMode` **paired with** a non-blank
  `authGroupEmail` reads as `'googleGroups'`. This preserves legacy hand-edited or cloned
  configuration blobs that stored only a group email. Every other broken configuration —
  a stored `'none'`, an unrecognised mode, a blank group with no users, a malformed user
  list, zero admins, or a missing/invalid revision — denies fail-closed and never falls back
  to Google Groups.

### Google Groups provider

- **The configured group.** The provider reads the group email from the `authGroupEmail`
  configuration key via `ConfigurationManager.getAuthGroupEmail()`
  (`src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`). A blank value in
  `scriptProperties` mode is expected (the user list carries membership instead); in
  `googleGroups` mode a blank value is broken configuration.
- **Membership check.** `GoogleGroupsAuthService._isGroupMember(email, groupEmail)` performs
  a point lookup: `GroupsApp.getGroupByEmail(groupEmail)`, then `group.hasUser(email)` and
  `group.getRole(email)`. The full member list of the group is **never** retrieved, stored or
  transported — the check asks Google Groups for a single caller's membership only, which
  keeps sensitive membership data out of the application's own storage and logs.
- **Role mapping.** The Google Group role is mapped to an application role:

  | Google Group role                                 | Application role | Decision |
  | ------------------------------------------------- | ---------------- | -------- |
  | `OWNER`                                           | `admin`          | allowed  |
  | `MANAGER`                                         | `admin`          | allowed  |
  | `MEMBER`                                          | `user`           | allowed  |
  | `INVITED`, `PENDING`, `BANNED` or any other value | —                | denied   |

- **Fail-closed on error.** Any `GroupsApp` failure — group not found, permission
  problem, transient service error — is caught, logged as an error with email, group
  email and the thrown value as metadata, and treated as a denial. Membership errors
  never fail open.

### Script Properties provider

- **The stored list.** `ScriptPropertiesAuthService._resolveAccess` parses the validated
  `authUsers` JSON array from the resolved auth state and looks up the caller's email. A
  non-member is denied; a listed caller is allowed with their stored role.
- **Role mapping.** The stored `AuthUserEntry.role` (`'admin'` or `'user'`) maps directly to
  the application role. There is no secondary mapping step, because an administrator has
  already assigned the role explicitly.
- **No cache.** The provider never reads or writes a cache entry; the stored list is parsed
  fresh on every request. Broken stored state is rejected by the strict resolver before this
  provider is reached, which emits the error-level audit in the base.

## Bootstrap claim (fresh install)

When the configuration store is genuinely absent (`__CONFIG_STORE_KEY__` not present in raw
Script Properties), `checkAccess()` performs the atomic bootstrap claim: the first eligible
interactive caller — one whose server-resolved email is non-blank — is committed as the sole
admin in a single locked write that stores only auth fields (`authMode: 'scriptProperties'`,
the caller as the sole `admin`, `authRevision: '1'`); default seeding is deliberately skipped
so non-auth getters fall back to `DEFAULTS`. The claim re-checks freshness inside the lock, so
a concurrent writer wins and the loser retries fail-closed. A blank-identity caller or a
trigger-execution caller (`neverClaim: true`) is denied without claiming. Any existing
configuration — however empty, blank or malformed — is **not** a fresh install and never
bootstraps; invalid or present configuration denies access fail-closed. The bounded claim is
an accepted trade-off — see [accepted-risks.md](./accepted-risks.md) risk 3.

## Role delivery and access status

- `AuthService.checkAccess()` returns `{ allowed, role? }` — the access decision plus the
  application role when allowed.
- `AuthService.resolveApplicationAccess()` powers the gate-exempt `getApplicationAccess`
  endpoint and returns the richer status shape defined in
  [Contract: AuthUsers](../data-shapes/auth-users.md):

  ```text
  { allowed, role, email, reason }
  ```

  where `reason` is one of `ok`, `freshInstall`, `brokenConfig`, or `denied`. The transport
  never exposes the resolved provider or an `'unconfigured'` reason; a genuinely fresh install
  surfaces as `freshInstall` so the frontend can prompt the first caller to claim admin, and
  any broken configuration surfaces as `brokenConfig` so the frontend can show a clear,
  non-blaming recovery message.

## The API auth gate

The gate lives in `ApiDispatcher.handle()` (`src/backend/z_Api/z_apiHandler.js`). Its
placement is deliberate:

1. Request validation (`_isValidRequest`) runs first, so malformed payloads get the
   `INVALID_REQUEST` envelope regardless of the caller.
2. The auth gate runs **before** the allowlist method lookup and **before**
   `_runAdmissionPhase` (the lock + rate-limit admission phase). A non-member therefore
   receives the uniform `FORBIDDEN` response (`API_ERROR_CODE_MAP.FORBIDDEN`,
   `'Access denied.'`) and can never distinguish `UNKNOWN_METHOD` from an existing
   method — method-surface probing is impossible for outsiders because the allowlist
   lookup only executes for authorised callers.
3. Because the gate precedes admission, a denied request consumes no lock capacity and
   is not counted against the active-request rate limit. This prevents an attacker
   outside the authorised set from exhausting the lock or the rate-limit budget as a denial
   of service against legitimate users.

- **Gate-exempt methods.** Two methods skip the group/user check entirely:
  - `getAuthorisationStatus` runs its OAuth-only handler
    (`() => new ScriptAppManager().isAuthorised()`) because the frontend must distinguish
    _OAuth-scope denial_ from _membership denial_.
  - `getApplicationAccess` skips the deny gate and instead runs the shared access-resolution
    path, so the Section 4 bootstrap claim fires on a fresh install and the same call returns
    `reason: 'ok'` with the claimed admin role for the first claimable caller.
- **Admin-required methods.** `getAuthenticationSettings` and `setAuthenticationSettings` are
  admitted only for an `admin` role, resolved in the dispatcher admission phase from a fresh
  `getApplicationAccess` call. A non-admin caller receives `FORBIDDEN` before the handler
  runs. The management-endpoint cache bypass lives in the dispatcher, not in the transport
  handler.
- **Error envelope.** `FORBIDDEN` is one of the documented transport error codes
  (see the [transport envelope](../data-shapes/transport-envelope.md)); it is produced
  directly by the gate rather than thrown by a dedicated exception type.
- **Thrown auth errors are not denials.** If `checkAccess()` throws (for example a
  `ConfigurationManager` persistence failure when reading configuration), the gate logs
  the error once at the transport boundary and maps it through
  `_mapErrorToFailureEnvelope`, producing the `INTERNAL_ERROR` envelope — never
  `FORBIDDEN`. This keeps the two failure classes distinct in the audit trail: a denied
  user is a security event, an internal error is an operational fault.

## Management endpoints

Three transport endpoints manage and report authentication state. They are registered in
`ALLOWLISTED_METHOD_HANDLERS` inside `z_apiHandler.js`; the thin transport handlers live in
`src/backend/z_Api/apiAuth.js` and delegate every domain invariant to `AuthService` /
`AuthSettingsDomain`. Exact request and response shapes are specified in
[Contract: AuthUsers](../data-shapes/auth-users.md).

- **`getApplicationAccess`** (gate-exempt) — resolves and shapes the caller's own access
  status. It performs the fresh-install bootstrap claim and returns the `reason` enum
  described above. The frontend auth gate (`AppAuthGate`) consumes this `reason` to admit the
  caller and render the application; the startup warm-up is a post-admission prefetch that does
  not gate admission.
- **`getAuthenticationSettings`** (admin-only) — returns `authMode`, `authGroupEmail`,
  `authUsers` and `authRevision`. In `scriptProperties` mode the stored user list and revision
  are returned; in `googleGroups` mode `authUsers` is `[]` and `authRevision` is `null`
  (the group carries membership).
- **`setAuthenticationSettings`** (admin-only) — commits a complete settings save atomically,
  or not at all. `AuthSettingsDomain` enforces every invariant: candidate validity, the
  revision guard, provider-switch saving-admin checks, mode-shape rules, and the 8 KB blob
  cap. The transport handler rejects a non-object payload; the atomic, revision-guarded save
  and the auth-field rejection below are both transport defence-in-depth.

**Transport defence-in-depth.** The ordinary backend-configuration write transport
(`setBackendConfig` in `src/backend/z_Api/apiConfig.js`) rejects the auth-managed fields
(`authMode`, `authGroupEmail`, `authUsers`, `authRevision`) for **every** caller, including
admins. Authentication state is therefore managed only through the dedicated endpoints above
and can never reach an ordinary config write. See
[Contract: BackendConfig](../data-shapes/backend-config.md).

## Trigger auth

`triggerHandler()` (`src/backend/Triggers/triggerHandler.js`) is the single public
trigger execution entrypoint, and it applies the same auth layer with stricter
parameters:

- **Validate-then-dispatch.** The handler rejects malformed events (missing event or
  `triggerUid`), unknown triggerUids, incomplete stored contexts, and unknown or
  unregistered trigger methods with fail-loud `ABLogger` errors and no dispatch. Only a
  fully resolved, registered trigger proceeds to authorisation.
- **The auth call.** Authorisation runs as
  `AuthService.checkAccess({ bypassCache: true, neverClaim: true, method: context.method })`.
- **Why `bypassCache: true`.** A revoked user's scheduled triggers must stop
  _immediately_ on the next fire, not after the cache TTL. For the Google Groups provider,
  bypassing the read forces a fresh `GroupsApp` lookup on every trigger execution, closing
  the revocation window for background work (an accepted risk, see
  [accepted-risks.md](./accepted-risks.md) risk 2). The Script Properties provider reads the
  list fresh on every call regardless, so no cache bypass is needed for it. The refreshed
  allowed result is still written back to the Google Groups cache, so a trigger execution
  refreshes the user's authorisation for subsequent API calls.
- **Why `neverClaim: true`.** Triggers are stricter than the interactive API surface: they pass an explicit never-claim flag so a scheduled run never bootstraps a first admin. First-admin claiming is the responsibility of the bootstrap claim, not of trigger execution; trigger execution therefore fails closed whenever a claim would otherwise be required — a scheduled run with no configuration simply does not execute. This keeps the bootstrap claim restricted to interactive callers.
- **Cleanup ownership.** `triggerHandler` owns all cleanup — clearing the stored trigger
  context and deleting the fired trigger via `TriggerController` — in a `finally` block
  and on every resolved, known `triggerUid` path, including auth denial and auth
  throw. A denied or errored trigger is released so failed authorisations do not
  accumulate scheduled work; malformed input that never resolves a triggerUid is logged
  and left alone.
- **Trigger context contents.** The stored context
  (`trigger:<uid>:method` and `trigger:<uid>:params` in Script Properties, keyed by the
  opaque `triggerUid`) carries only the dispatch method and opaque identifiers
  (for example an assignment ID) — never student content — see
  [Contract: TriggerContext](../data-shapes/trigger-context.md).

## Caching policy

Authorisation results for the **Google Groups provider** are cached through the generic
`CacheManager` (`src/backend/RequestHandlers/CacheManager.js`) to avoid a `GroupsApp`
round-trip on every call:

- **Key.** `auth:<groupEmail>:<email>` (`GoogleGroupsAuthService.js`) — a composite key
  embedding both the configured group and the caller.
- **Only successes are cached.** The cached value is always the success shape
  `{ allowed: true, role }` with the 6-hour TTL supplied explicitly as
  `CacheManager.CACHE_EXPIRY_SECONDS` (6 hours, defined in `CacheManager.js`). Denials
  short-circuit before the write. A user _added_ to the group is therefore authorised on
  their very next request, with no wait for expiry.
- **Bypass semantics.** `bypassCache: true` skips the cache _read_ but still writes the
  refreshed allowed result, so a trigger-execution grant refreshes the API-call grant.
- **Group change invalidation by construction.** Because the key embeds the group email,
  changing `authGroupEmail` changes every future key; stale entries under the old key
  simply expire and are never consulted. No explicit invalidation on config change is
  needed.
- **Revocation latency.** A user whose membership is revoked remains authorised for API
  calls until their cached entry expires — bounded by the 6-hour TTL and recorded as an
  accepted risk (see [accepted-risks.md](./accepted-risks.md) risk 2).
- **Storage mechanics.** `CacheManager.get()` degrades to a miss on malformed JSON or
  cache-service read failure, and `put()` is best-effort: write failures are logged
  through `ABLogger` and do not fail the calling workflow. Both behaviours are relevant
  to the gate because they mean the cache can never be a new denial-of-service vector —
  a failed read simply re-runs the `GroupsApp` check. See
  [Contract: AuthCache](../data-shapes/auth-cache.md) for the full entry contract.

The **Script Properties provider does not cache**: the configured user list is parsed fresh
on every request, so membership and role changes take effect on the very next call with no
TTL latency.

## Audit logging

Every access attempt is audited through `ABLogger` with structured metadata — the caller
email, the requested method (when supplied) and the group email:

| Event                                        | Level | Log message (`AuthService.js`)                                                       |
| -------------------------------------------- | ----- | ------------------------------------------------------------------------------------ |
| Grant from cache                             | info  | `'AuthService: access granted (cached).'`                                            |
| Fresh grant                                  | info  | `'AuthService: access granted.'`                                                     |
| Denial (non-member / unlisted / denied role) | warn  | `'AuthService: access denied.'`                                                      |
| Blank identity                               | warn  | `'AuthService: failed to resolve the active user email.'`                            |
| Fresh-install claim (interactive)            | info  | `'AuthService: fresh install claimed; caller granted admin.'`                        |
| Fresh-install, no claim (trigger/blank)      | info  | `'AuthService: fresh install detected but trigger execution never claims an admin.'` |
| Broken configuration                         | error | `'AuthService: broken authentication configuration denies access.'`                  |
| Group lookup failure                         | error | `'AuthService: group lookup failed.'`                                                |

The audit trail is the primary operational signal for the threat model's
"Workspace-domain users outside the authorised set" actor: repeated warn-level denials from a
specific email are visible in the script's execution logs. Logging policy forbids
secrets in log output and mandates `ABLogger` for all backend code — see
[backend-logging-and-error-handling.md](../backend/backend-logging-and-error-handling.md).

## Configuration protection

- **Auth fields are endpoint-managed only.** `authMode`, `authGroupEmail`, `authUsers` and
  `authRevision` are read and written exclusively through the dedicated authentication
  endpoints (and, for recovery, by hand-editing Script Properties). The ordinary backend
  configuration transport rejects these fields for every caller, including admins.
- **Blank-tolerant write, compulsory once set (Google Groups).** The `authGroupEmail` write
  path accepts blank (normalised to `''`) but the `CONFIG_SCHEMA` validator
  (`src/backend/ConfigurationManager/01_configKeysAndSchema.js`) rejects any attempt to
  clear a stored value: blank input while a non-blank value is already stored throws
  `'Auth Group Email cannot be cleared once set.'` and the stored value is preserved.
  Changing to a _different_ non-blank email remains allowed.
- **Frontend mirror.** The compulsory-once-set rule is enforced in the Authentication tab's
  `useAuthenticationSettings` hook
  (`src/frontend/src/features/settings/authentication/useAuthenticationSettings.ts`), which
  refuses to clear a previously configured group email at the UX layer; the backend rule is
  defence-in-depth, not the primary UX path. See
  [Contract: BackendConfig](../data-shapes/backend-config.md).
- **Auth shape ownership.** The ordinary backend-configuration read transport
  (`getBackendConfig`) no longer emits any auth field — `authMode` and `authGroupEmail` left that
  transport in favour of the dedicated Authentication settings surface. The auth shape is owned by
  the `getAuthenticationSettings` endpoint (admin-only), which returns `authMode`, `authGroupEmail`,
  `authUsers` and `authRevision` (or `[]` / `null` where a mode does not use them). On a genuinely
  fresh install the first-admin claim resolves the state, so an unconfigured group email is only
  observable before the first eligible interactive caller claims the install.
- **Admin lockout recovery.** Because there is no self-membership verification on save,
  an administrator can save a group they are not themselves a member of, locking everyone
  out of the UI. Because the value is compulsory once set, the recovery path is
  hand-editing the script's Script Properties to correct or remove `authGroupEmail`
  (summarised in [accepted-risks.md](./accepted-risks.md) risk 4 and
  [Contract: BackendConfig](../data-shapes/backend-config.md)); a deferred self-membership
  guard is tracked as future work. The same hand-edit path can seed or repair the
  `scriptProperties` provider when the UI is unreachable — see the release notes for the
  exact literal values and the double-serialisation warning.

> **Recommended operational practice:** on a genuinely fresh install the first interactive
> caller with a resolvable identity becomes administrator automatically. Configure the
> application promptly after deployment so an unintended first caller cannot claim admin.

> **Recommended operational practice:** before saving an `authGroupEmail`, verify that
> the group is the intended one and that the saving administrator is a member of it
> (for example in the Google Groups admin console). The application does not verify this
> and will not warn on lockout.

## Frontend auth surfaces

- **`AppAuthGate`** (`src/frontend/src/features/auth/AppAuthGate.tsx`) is a blocking,
  fail-closed gate that resolves access in two ordered stages before rendering its protected
  children (the dashboard, including `AuthStatusCard`):

  1. **OAuth admission first.** `useAuthorisationStatus` runs the gate-exempt
     `getAuthorisationStatus` OAuth-only check. While it resolves, the gate paints an
     accessible "Loading authorisation status" surface. An OAuth transport error renders a
     retryable `Result`, and an unresolved OAuth scope (`isAuthorised === false`) renders the
     "Permissions required" result. The dashboard is never revealed solely because the OAuth
     scope check resolved authorised.
  2. **Application-access admission.** Only once OAuth is authorised does the gate call
     `getApplicationAccess` (via `useApplicationAccess`). While that query is pending the gate
     shows a "Verifying access" surface. A transport error renders a retryable `Result`; a
     resolved `reason` of `freshInstall`, `brokenConfig`, or `denied` renders a clear,
     non-blaming blocking `Result`, and only `reason: 'ok'` admits the caller. Admission is
     driven solely by the `getApplicationAccess` `reason` — not by warm-up.
  3. **Post-admission warm-up prefetch.** After admission, the gate mounts
     `ApplicationAccessContext.Provider` (delivering `{ allowed, role, email, reason }` to
     descendants such as `SettingsPage`) and wraps the children in `StartupWarmupStateProvider`.
     The startup warm-up then prefetches the shared lookup datasets in the background. A warm-up
     failure is logged and its status published to the provider, but it does **not** fail the
     shell closed or block admission — the protected children render regardless.

  The first-admin bootstrap claim (a fresh install with no stored configuration) fires through
  the gate-exempt `getApplicationAccess` path, and is distinct from the OAuth-only
  `getAuthorisationStatus` check.

- **`useAuthorisationStatus`** (`src/frontend/src/features/auth/useAuthorisationStatus.ts`)
  returns `{ isAuthorised, isLoading, error }`. It resolves OAuth scope status through
  the gate-exempt `getAuthorisationStatus` method (query definition in
  `src/frontend/src/query/sharedQueries.ts`, service call in
  `src/frontend/src/services/authService/authService.ts`) and deliberately does **not**
  observe `FORBIDDEN` — the group/user-denial case is owned by the application-access gate, so
  the two mechanisms stay disjoint.
- **Role delivery.** `getApplicationAccess` returns the caller's `role`. `AppAuthGate` lifts
  it into an `ApplicationAccessContext` (`src/frontend/src/features/auth/AppAuthGate.tsx`)
  so descendants — most notably `SettingsPage` — can gate admin-only surfaces on `role:
'admin'`. `SettingsPage` renders the **Authentication tab** only for admins.
- **`AuthenticationSettingsTab`**
  (`src/frontend/src/features/settings/authentication/AuthenticationSettingsTab.tsx`) is the
  admin-only management UI. It shows a provider card (mode `Select` plus, for Google Groups,
  the compulsory-once-set group email and a membership note) and, for the Script Properties
  provider, a staged user table with add/remove and role changes. A single atomic Save carries
  `expectedAuthRevision` so a stale-revision conflict is surfaced without losing the staged
  edits. See `AUTHENTICATION_SETTINGS_LAYOUT.md` for the full layout contract.
- **`FORBIDDEN` message mapping.** `FORBIDDEN` is registered in
  `src/frontend/src/errors/map-error-to-ui.ts` with the user-safe message
  "You do not have permission to access this application. Please contact your
  administrator."
- **Two distinct mechanisms.** OAuth denial ("Permissions required") comes from the
  gate-exempt scope check and reflects missing script authorisation; application-access denial
  comes from the `FORBIDDEN` error code (or a non-`ok` `reason`) returned by the gate on
  protected methods and reflects membership/role. The frontend distinguishes them so users see
  an accurate remediation path.

## Related documentation

- [Security approach overview](./README.md) — the layering model and threat model this
  layer sits within
- [Layer 1 — platform security](./platform-security.md) — the deployment-mode and
  identity controls this layer builds on
- [Accepted risks, trade-offs and future direction](./accepted-risks.md) — revocation
  latency, first-admin bootstrap claim, self-membership verification, provider choice
- [Contract: AuthUsers](../data-shapes/auth-users.md) — the management-endpoint and
  access-status shapes
- [Contract: AuthCache](../data-shapes/auth-cache.md) — the cached authorisation entry
- [Contract: TriggerContext](../data-shapes/trigger-context.md) — the stored trigger
  execution context
- [Contract: BackendConfig](../data-shapes/backend-config.md) — `authGroupEmail`
  persistence, transport and validation contract
- [Transport envelope](../data-shapes/transport-envelope.md) — the `FORBIDDEN` error
  code and envelope contract
- [OAuth scopes](../backend/oauth-scopes.md) — the `groups` and `userinfo.email` scopes
  the auth service depends on
- [Backend logging and error handling](../backend/backend-logging-and-error-handling.md) —
  logging policy that governs the audit trail
- [src/backend/AGENTS.md](../../../src/backend/AGENTS.md) section 2.3 — the `AuthService`
  singleton contract for backend development
- [AUTHENTICATION_SETTINGS_LAYOUT.md](../../../AUTHENTICATION_SETTINGS_LAYOUT.md) — the
  admin Authentication tab layout contract
