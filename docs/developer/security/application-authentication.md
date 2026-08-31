# Application-Level Authentication

This is **Layer 2** of the security approach: the application-level authentication layer
built on the platform controls of Layer 1 (see [platform-security.md](./platform-security.md)).
It verifies that the calling user is a member of a designated Google Group before any
protected request is dispatched, guards against accidental misconfiguration of the
platform layer, and lays the foundation for role-based access control in future. Where
Layer 1 asks "can this person reach the web app at all?", Layer 2 asks "is this person
allowed to use the application?" — and answers it independently on every protected call.

The layer is implemented by `AuthService` (`src/backend/Utils/AuthService.js`), a
singleton that centralises identity resolution, Google Group membership checks, role
mapping, successful-result caching and access-attempt audit logging. It is enforced at
two boundaries: the API transport gate in `ApiDispatcher.handle()`
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
- **Blank-email defence-in-depth.** If the resolved email is blank — which should not
  occur under the correct deployment mode, but is cheap to guard against — access is
  denied with a warn-level audit log (`AuthService.js`:
  `'AuthService: failed to resolve the active user email.'`). This check runs _after_ the
  unconfigured-group bootstrap branch (see below), so it only applies once a group has
  been configured; a blank identity is never authorised against a configured gate.
- The gate never falls back to `Session.getEffectiveUser()` or any other identity source,
  so the authorisation decision is always anchored to the caller's signed-in identity.

## Google Group membership authorisation

- **The configured group.** The gate reads the group email from the
  `AUTH_GROUP_EMAIL` configuration key (`'authGroupEmail'`, defined in
  `src/backend/ConfigurationManager/01_configKeysAndSchema.js`) via
  `ConfigurationManager.getAuthGroupEmail()`
  (`src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`). A blank value
  means "unconfigured" and drives the bootstrap behaviour described below.
- **Membership check.** `AuthService._isGroupMember(email, groupEmail)` performs a
  point lookup: `GroupsApp.getGroupByEmail(groupEmail)`, then
  `group.hasUser(email)` and `group.getRole(email)`. The full member list of the group
  is **never** retrieved, stored or transported — the check asks Google Groups for a
  single caller's membership only, which keeps sensitive membership data out of the
  application's own storage and logs.
- **Role mapping.** The Google Group role is mapped to an application role:

  | Google Group role                                 | Application role | Decision |
  | ------------------------------------------------- | ---------------- | -------- |
  | `OWNER`                                           | `admin`          | allowed  |
  | `MANAGER`                                         | `admin`          | allowed  |
  | `MEMBER`                                          | `user`           | allowed  |
  | `INVITED`, `PENDING`, `BANNED` or any other value | —                | denied   |

  The role value is returned alongside the decision so future iterations can restrict
  methods by role; v1 grants both roles the same surface (an accepted risk, see
  [accepted-risks.md](./accepted-risks.md) risk 6).

- **Fail-closed on error.** Any `GroupsApp` failure — group not found, permission
  problem, transient service error — is caught, logged as an error with email, group
  email and the thrown value as metadata, and treated as a denial. Membership errors
  never fail open.

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
   outside the group from exhausting the lock or the rate-limit budget as a denial
   of service against legitimate users.

- **Gate-exempt method.** `getAuthorisationStatus` skips the group check entirely
  (`if (methodName !== 'getAuthorisationStatus')`) and runs its OAuth-only handler
  (`() => new ScriptAppManager().isAuthorised()`). `ScriptAppManager.isAuthorised()`
  (`src/backend/Utils/ScriptAppManager.js`) reports whether the current user has
  authorised the script's OAuth scopes (`ScriptApp.AuthorizationStatus.REQUIRED` vs not)
  and returns a boolean. The exemption is necessary because the frontend must be able to
  distinguish _OAuth-scope denial_ from _group-membership denial_: without it, an
  unauthorised user could never learn whether the problem is missing consent or missing
  group membership, and the frontend auth gate could not render the correct message.
- **Error envelope.** `FORBIDDEN` is one of the documented transport error codes
  (see the [transport envelope](../data-shapes/transport-envelope.md)); it is produced
  directly by the gate rather than thrown by a dedicated exception type.
- **Fail-open bootstrap.** When `AUTH_GROUP_EMAIL` is unconfigured,
  `checkAccess()` returns `{ allowed: true, role: 'user' }` with a warn-level audit log
  ('Auth group email not configured — failing open.'). The API gate therefore admits any
  signed-in domain user so that the first administrator can reach the settings form and
  configure the group. Trigger execution is deliberately stricter and fails closed in the
  same state (see below). The window is an accepted risk — see
  [accepted-risks.md](./accepted-risks.md) risk 3.
- **Thrown auth errors are not denials.** If `checkAccess()` throws (for example a
  `ConfigurationManager` persistence failure when reading configuration), the gate logs
  the error once at the transport boundary and maps it through
  `_mapErrorToFailureEnvelope`, producing the `INTERNAL_ERROR` envelope — never
  `FORBIDDEN`. This keeps the two failure classes distinct in the audit trail: a denied
  user is a security event, an internal error is an operational fault.

## Trigger auth

`triggerHandler()` (`src/backend/Triggers/triggerHandler.js`) is the single public
trigger execution entrypoint, and it applies the same auth layer with stricter
parameters:

- **Validate-then-dispatch.** The handler rejects malformed events (missing event or
  `triggerUid`), unknown triggerUids, incomplete stored contexts, and unknown or
  unregistered trigger methods with fail-loud `ABLogger` errors and no dispatch. Only a
  fully resolved, registered trigger proceeds to authorisation.
- **The auth call.** Authorisation runs as
  `AuthService.checkAccess({ bypassCache: true, requireConfigured: true, method: context.method })`.
- **Why `bypassCache: true`.** A revoked user's scheduled triggers must stop
  _immediately_ on the next fire, not after the cache TTL. Bypassing the read forces a
  fresh `GroupsApp` lookup on every trigger execution, closing the revocation window for
  background work even though API calls remain bounded by the cache (an accepted risk,
  see [accepted-risks.md](./accepted-risks.md) risk 2). The refreshed allowed result is
  still written back to the cache, so a trigger execution refreshes the user's
  authorisation for subsequent API calls.
- **Why `requireConfigured: true`.** Triggers are stricter than the API gate: when the
  group is unconfigured they fail closed rather than open, because there is no settings
  form to bootstrap through — a scheduled run with no group configured should simply not
  execute. This means the bootstrap fail-open window applies only to the interactive API
  surface.
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

Authorisation results are cached through the generic `CacheManager`
(`src/backend/RequestHandlers/CacheManager.js`) to avoid a `GroupsApp` round-trip on
every call:

- **Key.** `auth:<groupEmail>:<email>` (`AuthService.js`) — a composite key embedding
  both the configured group and the caller.
- **Only successes are cached.** The cached value is always the success shape
  `{ allowed: true, role }` with the 6-hour TTL supplied explicitly as
  `CacheManager.CACHE_EXPIRY_SECONDS` (6 hours, defined in `CacheManager.js`). Denials
  short-circuit before the write. A user _added_ to the group is therefore authorised on
  their very next request, with no wait for expiry.
- **Bypass semantics.** `bypassCache: true` skips the cache _read_ but still writes the
  refreshed allowed result, so a trigger-execution grant refreshes the API-call grant.
- **Group change invalidation by construction.** Because the key embeds the group email,
  changing `AUTH_GROUP_EMAIL` changes every future key; stale entries under the old key
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

## Audit logging

Every access attempt is audited through `ABLogger` with structured metadata — the caller
email, the requested method (when supplied) and the group email:

| Event                             | Level | Log message (`AuthService.js`)                            |
| --------------------------------- | ----- | --------------------------------------------------------- |
| Grant from cache                  | info  | `'AuthService: access granted (cached).'`                 |
| Fresh grant                       | info  | `'AuthService: access granted.'`                          |
| Denial (non-member / denied role) | warn  | `'AuthService: access denied.'`                           |
| Blank identity                    | warn  | `'AuthService: failed to resolve the active user email.'` |
| Fail-open bootstrap               | warn  | `'Auth group email not configured — failing open.'`       |
| Fail-closed bootstrap (triggers)  | error | `'AuthService: auth group email is not configured.'`      |
| Group lookup failure              | error | `'AuthService: group lookup failed.'`                     |

The audit trail is the primary operational signal for the threat model's
"Workspace-domain users outside the group" actor: repeated warn-level denials from a
specific email are visible in the script's execution logs. Logging policy forbids
secrets in log output and mandates `ABLogger` for all backend code — see
[backend-logging-and-error-handling.md](../backend/backend-logging-and-error-handling.md).

## Configuration protection

- **Blank-tolerant write, compulsory once set.** The `authGroupEmail` write path accepts
  blank (normalised to `''`) but the `CONFIG_SCHEMA` validator
  (`src/backend/ConfigurationManager/01_configKeysAndSchema.js`) rejects any attempt to
  clear a stored value: blank input while a non-blank value is already stored throws
  `'Auth Group Email cannot be cleared once set.'` and the stored value is preserved.
  Changing to a _different_ non-blank email remains allowed.
- **Frontend mirror.** The frontend settings form enforces the same compulsory-once-set
  rule at the UX layer (`BackendSettingsPanel.handleFinish`), so a user is guided before
  submission; the backend rule is defence-in-depth, not the primary UX path. See
  [Contract: BackendConfig](../data-shapes/backend-config.md).
- **Transport always emits the field.** The read transport always emits `authGroupEmail`
  (`getAuthGroupEmail() || ''`), so the frontend can always distinguish "unconfigured"
  (`''`) from "configured", and the fail-open bootstrap state is observable.
- **Admin lockout recovery.** Because there is no self-membership verification on save,
  an administrator can save a group they are not themselves a member of, locking everyone
  out of the UI. Because the value is compulsory once set, the recovery path is
  hand-editing the script's Script Properties to correct or remove `authGroupEmail`
  (summarised in [accepted-risks.md](./accepted-risks.md) risk 4 and
  [Contract: BackendConfig](../data-shapes/backend-config.md)); a deferred self-membership
  guard is tracked as future work.

> **Recommended operational practice:** configure the auth group immediately after
> deployment so the bootstrap fail-open window is as narrow as possible — while the
> window is open, any signed-in domain user can reach the application.

> **Recommended operational practice:** before saving an `authGroupEmail`, verify that
> the group is the intended one and that the saving administrator is a member of it
> (for example in the Google Groups admin console). The application does not verify this
> and will not warn on lockout.

## Frontend auth surfaces

- **`AppAuthGate`** (`src/frontend/src/features/auth/AppAuthGate.tsx`) is a truly
  blocking, fail-closed gate: it renders its protected children (the dashboard, including
  `AuthStatusCard`) only once the startup warm-up confirms Google Group membership. It no
  longer reveals the dashboard merely because OAuth resolved authorised. The possible
  blocking states are, in order of precedence:
  1. a `FORBIDDEN` access-denied result, detected by scanning the startup warm-up query
     errors for the `FORBIDDEN` error code (`getWarmupForbiddenMessage`);
  2. a transport error result with a Retry button that invalidates and re-runs the
     authorisation query;
  3. a loading state while the authorisation query is pending;
  4. a `'Permissions required'` result when the OAuth scope check resolves to false;
  5. a fail-closed warm-up `failed` (non-`FORBIDDEN`) error `Result` with a user-safe
     mapped message and a `Reload` button — the `QueryClient` uses `retry: false` and the
     warm-up cycle registry is per-client, so a full page reload is the recovery path;
  6. a warm-up `loading` "Verifying access" surface (accessible `output`, implicit status
     role) with no children — the dashboard is withheld until warm-up resolves.

  The bootstrap fail-open path (unconfigured `AUTH_GROUP_EMAIL`) and the gate-exempt
  `getAuthorisationStatus` OAuth-only check are unaffected: warm-up runs only after
  `useAuthorisationStatus` reports authorised.

- **`useAuthorisationStatus`** (`src/frontend/src/features/auth/useAuthorisationStatus.ts`)
  returns `{ isAuthorised, isLoading, error }`. It resolves OAuth scope status through
  the gate-exempt `getAuthorisationStatus` method (query definition in
  `src/frontend/src/query/sharedQueries.ts`, service call in
  `src/frontend/src/services/authService/authService.ts`) and deliberately does **not**
  observe `FORBIDDEN` — the group-denial case is owned by the warm-up gate, so the two
  mechanisms stay disjoint.
- **`FORBIDDEN` message mapping.** `FORBIDDEN` is registered in
  `src/frontend/src/errors/map-error-to-ui.ts` with the user-safe message
  "You do not have permission to access this application. Please contact your
  administrator."
- **Two distinct mechanisms.** OAuth denial ("Permissions required") comes from the
  gate-exempt scope check and reflects missing script authorisation; group denial comes
  from the `FORBIDDEN` error code returned by the gate on protected methods and reflects
  membership. The frontend distinguishes them so users see an accurate remediation path.

## Related documentation

- [Security approach overview](./README.md) — the layering model and threat model this
  layer sits within
- [Layer 1 — platform security](./platform-security.md) — the deployment-mode and
  identity controls this layer builds on
- [Accepted risks, trade-offs and future direction](./accepted-risks.md) — revocation
  latency, bootstrap fail-open, self-membership verification, role-based filtering
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
