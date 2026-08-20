# Accepted Risks, Trade-offs and Future Direction

Security decisions are trade-offs. This document records the risks the project accepts,
the justifications for accepting them, and the direction future work will take. It is
intended to be read alongside the [Security Approach overview](./README.md).

The guiding principle is openness: a security document that records only what is
protected — and not what is deliberately unprotected, or protected only partially —
gives auditors and future maintainers a false picture. Every entry below states the
risk, why it is accepted, and what would change the decision.

## Accepted risks

### 1. Vendored `JsonDbApp` code is exposed to `google.script.run`

The vendored code in `scripts/builder/vendor/jsondbapp/src/**` contains ten top-level
non-underscore function declarations (including `loadDatabase` and
`createAndInitialiseDatabase`). In the deployed bundle these are exposed to
`google.script.run` and bypass the auth gate, exactly like any other accidentally public
backend function.

**Why accepted:** the code is third-party and inlined into the deployed bundle as a
vendored asset; refactoring it to the private-by-default convention is not feasible in
the current scope. The backend global-exposure guard test excludes vendored paths by
construction (see [attack-surface-reduction.md](./attack-surface-reduction.md)), so the
exposure will not spread, but the existing surface remains.

**Change trigger:** a GitHub issue tracks remediation. If the vendored dependency is
updated or replaced, the replacement should be checked against the same convention.

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

### 3. Bootstrap fail-open window before the auth group is configured

When `AUTH_GROUP_EMAIL` is unconfigured, the API gate fails open: any signed-in domain
user is allowed in with a warning logged per request. The intent is that an administrator
can reach the settings form and configure the group. Trigger execution is deliberately
stricter — it fails closed even in bootstrap (`requireConfigured: true`).

**Why accepted:** without the fail-open window the first administrator could not configure
the application at all. The window is loud (a warning is logged on every request) and
narrow (only until configuration is saved). The rollout sequence documented in the auth
service specification says the group email should be set immediately after deployment.

**Change trigger:** the window exists only while the group is unconfigured; once set, the
gate is fail-closed permanently. A future iteration could gate the settings form itself
on a pre-shared bootstrap secret, removing the window entirely.

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

### 5. `maybeDeserializeProperties` interacts awkwardly with trigger context keys

`ConfigurationManager.maybeDeserializeProperties()` early-returns when **any** Script
Property key exists. Writing `trigger:<uid>:*` keys can therefore suppress legacy config
deserialisation on a store that has trigger context but no config blob. The data-shape
contract classifies this as **Fragile / accepted risk**.

**Why accepted:** the method is likely dead code from a Sheets-based era; removing it is a
separate scope item and the interaction only manifests in a store state that should not
occur in normal operation.

**Change trigger:** removal of `maybeDeserializeProperties()` (tracked separately) would
eliminate the interaction.

### 6. All API methods are accessible to both `admin` and `user` roles

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
- **Fail closed, except where bootstrap requires otherwise.** Errors in identity
  resolution, group lookup and role mapping deny access. The only deliberate fail-open
  path is the unconfigured-group bootstrap window described above.

## Future direction

- **Role-based method filtering (v2+).** Methods in `ALLOWLISTED_METHOD_HANDLERS` will
  declare which roles may call them, using an allow-list approach: a method is closed to
  all roles unless explicitly granted. Denials reuse the `FORBIDDEN` error code.
- **Self-membership verification guard.** Prevent the admin-lockout scenario in risk 4
  by verifying the caller's own membership before persisting `authGroupEmail`.
- **Vendored exposure remediation.** Address risk 1 (tracked in a GitHub issue).
- **Admin UI for group membership.** Group membership management currently lives in the
  Google Groups admin console; a frontend management surface is possible once role-based
  filtering lands.
- **Removal of `maybeDeserializeProperties()`.** Eliminates risk 5 and related dead code.
