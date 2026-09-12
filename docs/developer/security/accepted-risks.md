# Accepted Risks, Trade-offs and Future Direction

Security decisions are trade-offs. This document records the risks the project accepts,
the justifications for accepting them, and the direction future work will take. It is
intended to be read alongside the [Security Approach overview](./README.md).

The guiding principle is openness: a security document that records only what is
protected — and not what is deliberately unprotected, or protected only partially —
gives auditors and future maintainers a false picture. Every entry below states the
risk, why it is accepted, and what would change the decision.

## Accepted risks

### 1. Vendored `JsonDbApp` code is isolated from `google.script.run`

The builder wraps the vendored source in an IIFE and assigns only the returned namespace
object to the top-level `JsonDbApp` constant. Functions such as `loadDatabase` and
`createAndInitialiseDatabase` therefore remain local to the IIFE; they are not top-level
Apps Script functions and cannot be called directly through `google.script.run`.

The application uses `apiHandler` as its sole frontend-callable backend function. Calls to
the vendored API are made internally through the namespace object and consequently remain
behind the application auth gate.

### 2. Auth revocation latency is bounded by the six-hour cache TTL

Only successful authorisations are cached (six hours, keyed by
`auth:<groupEmail>:<email>`). A user whose group membership is revoked remains authorised
for API calls until their cached entry expires — up to six hours.

**Why accepted:** caching avoids a `GroupsApp` round-trip on every call and keeps the
frontend responsive. The impact is deliberately bounded:

- trigger execution bypasses the cache (`bypassCache: true`), so revoked users cannot
  continue scheduled work;
- denials are never cached, so a user _added_ to the group is authorised immediately.

**Change trigger:** if revocation latency becomes operationally unacceptable, the TTL can
be shortened or the cache removed.

### 3. First interactive caller claims admin on a fresh install

On a genuinely fresh install (no `__CONFIG_STORE_KEY__` blob present), the first eligible
interactive caller — one whose server-resolved email is non-blank — is committed as the
sole administrator through the Section 4 atomic bootstrap claim. The claim writes only
auth fields and cannot be performed by trigger execution (`neverClaim: true`) or by a
blank-identity caller, both of whom are denied fail-closed. Any existing configuration —
however empty, blank or malformed — is not a fresh install and never bootstraps; broken
configuration denies access fail-closed.

**Why accepted:** without a first-admin bootstrap the application could not be configured
at all on a new deployment. The claim is bounded: it fires only on a genuinely absent
store, only for an interactive caller with a verifiable non-blank identity, and re-checks
freshness inside the script lock so a concurrent writer wins and the loser retries
fail-closed. Configuration that is present but invalid or incomplete never opens a claim
window.

**Change trigger:** if the unauthenticated first-claim risk becomes unacceptable, a
pre-shared bootstrap secret could gate the claim, or the claim could require an explicit
out-of-band confirmation before granting admin.

### 4. No self-membership verification when saving the auth group email

An administrator can save an `authGroupEmail` for a group they are not themselves a
member of, locking themselves (and everyone) out of the UI. The value is compulsory once
set — it cannot be cleared through the UI or the backend write path — so the lockout is
only recoverable by hand-editing Script Properties.

**Why accepted:** the self-membership check adds complexity and the lockout is
recoverable (the recovery procedure is documented in the auth service specification's
"Admin lockout recovery" section). The compulsory-once-set rule is itself a security
feature: it prevents accidental removal of the gate by a later misconfiguration.

**Change trigger:** a deferred guard that verifies the caller's own membership before
persisting the group email would turn lockout from a recovery procedure into an
impossibility. This is tracked as a future iteration.

### 5. All API methods are accessible to both `admin` and `user` roles

The auth layer resolves a role (`admin` or `user`) but v1 does not restrict methods by
role. Every authenticated group member can call every allowlisted method.

**Why accepted:** role-based filtering is deliberately deferred so the role model can be
validated in production before method-level restrictions are layered on. The role
information is already resolved and audited, so the foundation is in place.

**Change trigger:** see "Role-based method filtering" under Future direction below.

### 6. The Script Properties provider relies on manual seeding

In `scriptProperties` mode the authorised user list lives entirely in Script Properties
(`authUsers`, a JSON-encoded array) with no discovery mechanism such as a Google Group
directory. The first admin is established either by the fresh-install bootstrap claim (risk 3)
or by an administrator persisting a valid `authUsers` list through `setAuthenticationSettings`;
when the UI is unreachable, the list can only be seeded or repaired by hand-editing Script
Properties. A malformed seed — invalid JSON, a list that parses but contains zero admins, or a
missing/invalid `authRevision` — is rejected by the strict resolver
(`validateAuthStateStrict_`) and surfaces as a `brokenConfig` denial (an error-level audit),
not as a partially granted access.

**Why accepted:** removing the Google Groups dependency is the whole point of the provider; it
supports domains and cohorts that cannot be modelled as a single Workspace group and avoids a
`GroupsApp` round-trip on every call. The strict resolver is the safety net: a half-written or
corrupt seed can never grant access, and the recovery path (correct the Script Properties value
or clear the config blob to re-bootstrap) is well defined.

**Change trigger:** a guided admin-recovery UI (for example a verified out-of-band token or a
script-property repair wizard) would remove the need to hand-edit Script Properties.

### 7. The apiAuth transport and the dispatcher admission phase ship as one locked contract

The `apiAuth.js` request/response shapes (ACTION_PLAN Section 5) and the dispatcher's admin-status
admission payload — which resolves access fresh from a `getApplicationAccess` call (also Section 5)
— form one locked contract: the transport handlers shape the response exactly as the frontend Zod
schemas expect, and the admin-required gate consumes the fresh role. A partial deploy that updates
one without the other breaks the transport contract — clients would send or receive mismatched
shapes and the auth gate could admit or deny incorrectly.

The backend-configuration `.strict()` lockstep is a separate, later deploy-order dependency:
Section 6 drops the auth fields from the `getBackendConfig` read transport and Section 7 drops
them from the frontend `BackendConfig` Zod schemas. Because both schemas use `.strict()`, the
backend must never emit a field the frontend schema does not yet accept, so those two surfaces must
ship together in the same release.

**Why accepted:** the builder ships the whole backend bundle (and the frontend alongside it)
through a single `clasp` push, so the auth transport, the dispatcher admission phase, and the
backend-configuration transport are always deployed atomically with their matching frontend
schemas. There is no staged or canary backend rollout path that could split them.

**Change trigger:** if the backend or frontend ever gains a staged or canary deploy path, the
contract should be versioned (for example a negotiated schema version) so a half-deployed surface
fails safe rather than silently mismatching.

## Design decisions worth restating

- **Defence in depth, not replacement.** The application auth gate supplements the
  platform controls; it is not a substitute for correct deployment mode, minimal OAuth
  scopes, or restricted Drive sharing. If the platform layer is misconfigured, the gate
  is the second line of defence, not the first.
- **The client is not trusted with data at rest.** The frontend deliberately avoids
  durable client-side storage (see [data-handling.md](./data-handling.md)). This costs
  performance (no offline cache, re-fetch on reload) in exchange for reducing the value
  of a compromised device.
- **Fail closed by default; bootstrap is a bounded claim, not a fail-open window.**
  Errors in identity resolution, group lookup, role mapping and broken configuration deny
  access. The only deviation from pure fail-closed is the Section 4 first-admin claim,
  which fires solely on a genuinely absent configuration store for an interactive caller
  with a non-blank identity — it grants, rather than failing open to all users.

## Future direction

- **Role-based method filtering (v2+).** Methods in `ALLOWLISTED_METHOD_HANDLERS` will
  declare which roles may call them, using an allow-list approach: a method is closed to
  all roles unless explicitly granted. Denials reuse the `FORBIDDEN` error code.
- **Self-membership verification guard.** Prevent the admin-lockout scenario in risk 4
  by verifying the caller's own membership before persisting `authGroupEmail`.
- **Admin UI for group membership.** Group membership management currently lives in the
  Google Groups admin console; a frontend management surface is possible once role-based
  filtering lands.
