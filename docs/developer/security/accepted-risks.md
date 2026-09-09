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
