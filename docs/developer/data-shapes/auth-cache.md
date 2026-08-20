# Contract: AuthCache

In-memory CacheService cache entry used by `AuthService.checkAccess()` to memoise Google
Group membership results between API requests. Stored via the generic `CacheManager`
methods (extended with `get`/`put`).

> **Status: Implemented** — the generic `CacheManager` methods (ACTION_PLAN §3) and the
> `AuthService` singleton (ACTION_PLAN §4) have landed, so both the cache access and its
> sole producer/consumer exist.

Backend implementation: `src/backend/Utils/AuthService.js`
Cache access: `src/backend/RequestHandlers/CacheManager.js` → generic `get(key)`, `put(key, value, ttlSeconds)`
Persistence: `CacheService.getScriptCache()` — in-memory cache with TTL, not durable storage
API handlers: Not directly callable — consumed internally by `AuthService.checkAccess()`
Frontend service: None — internal backend mechanism
Frontend Zod: None

Sibling contracts:

- [Contract: BackendConfig](backend-config.md) — The cache key embeds the configured
  `AUTH_GROUP_EMAIL`, so changing the group invalidates cached entries by construction.
- [Contract: TriggerContext](trigger-context.md) — Both stores are consumed by
  `triggerHandler()`: AuthCache via `AuthService.checkAccess({ bypassCache: true })` and
  TriggerContext as the trigger execution context.
- No other sibling contracts — AuthCache is an internal backend cache entry with no
  frontend-facing transport.

---

## Persistence

### Cache entry shape

Each entry is a JSON-serialised string stored under a composite key. The key embeds both
the configured group email and the caller email:

| Key                         | Value (JSON string)                              | TTL     |
| --------------------------- | ------------------------------------------------ | ------- |
| `auth:<groupEmail>:<email>` | `{ "allowed": true, "role": "admin" \| "user" }` | 6 hours |

### Key persistence notes

- **Only successful authorisations are cached.** Denials are never cached, so a user who
  is subsequently added to the group is authorised on their next request without waiting
  for cache expiry.
- **A bypassed check (`bypassCache: true`) still writes the refreshed allowed result** — the
  bypass skips only the cache read; the success-path cache write is unconditional.
- The cache key includes the configured group email, so changing the group invalidates
  all cached entries by construction (no explicit cache invalidation on config change is
  required).
- Entries naturally expire after the 6-hour TTL; `AuthService` passes the TTL explicitly
  at the call site (`CacheManager.put(key, value, ttlSeconds)` has no default TTL).
- `CacheManager` handles JSON serialisation/deserialisation internally; `get()` returns
  `null` on cache miss or parse error (graceful degradation).
- `CacheManager` is a **plain instantiable class** obtained via `new CacheManager()`
  (established pattern — see `src/backend/RequestHandlers/LLMRequestManager.js`), **not** a
  singleton.
- Revocation latency is bounded by the 6-hour TTL — a previously allowed user whose
  membership is revoked remains authorised until their cached entry expires.

---

## Transport

This cache entry has no API endpoint transport. It is an internal backend mechanism
consumed exclusively by `AuthService.checkAccess()` (and via cache bypass by
`triggerHandler()`). There is no `z_Api` handler file, no `ALLOWLISTED_METHOD_HANDLERS`
registration, and no frontend service or Zod schema.

---

## Sub-entities

None — AuthCache is a single flat key-value entry with no embedded sub-entities.

---

## Validation

**Backend validation** (in `src/backend/Utils/AuthService.js`):

- `AuthService.checkAccess()` derives the cache key as `auth:<groupEmail>:<email>` and
  reads/writes via `CacheManager`.
- Values written to the cache are always the success shape `{ allowed: true, role }`;
  denials short-circuit before the cache write.

**Key domain rules:**

- The role value is one of `'admin'` or `'user'` (mapped from `OWNER`/`MANAGER` →
  `admin`, `MEMBER` → `user`; other roles are denied and never cached).
- `checkAccess({ bypassCache: true })` always calls `GroupsApp` directly, ignoring any
  cached entry (used by `triggerHandler()` to detect revoked users immediately).

### Known discrepancies

None — the contract is implemented. `AuthService.checkAccess()` derives the cache key
`auth:<groupEmail>:<email>` and reads/writes via the `CacheManager` generic methods.

---

## File Index

```
Cache access:         src/backend/RequestHandlers/CacheManager.js
  ├── get(key)                    — read + deserialise JSON; null on miss/parse error
  └── put(key, value, ttlSeconds) — serialise + write with explicit TTL
                                  (no `remove` method — entries expire via TTL)

Producer/consumer:    src/backend/Utils/AuthService.js
  ├── checkAccess(options?)       — cache read → GroupsApp check → cache write (allowed only)
  └── _isGroupMember(email, groupEmail) — private group membership + role resolution

Consumers:            src/backend/z_Api/z_apiHandler.js (auth gate, via AuthService)
                      src/backend/Triggers/triggerHandler.js (cache bypass, via AuthService)
```
