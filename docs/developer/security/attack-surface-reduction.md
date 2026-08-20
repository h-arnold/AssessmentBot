# Attack-Surface Reduction

This is Layer 3 of the security approach described in the
[security overview](./README.md). The deployed surface of a GAS web app is larger than
the UI: anything exposed to `google.script.run` can be invoked directly from the browser
console, or by any script that has the web app URL — with no reference to the React
frontend at all. Layer 3 shrinks that surface to a small, auditable set of entrypoints and
keeps the transport boundary hygienic so that probing the surface reveals nothing about
the implementation behind it.

Layers 1 and 2 gate _who_ may call the app (platform deployment mode, then the
`AuthService` group gate). This layer assumes an authorised caller is already present and
asks a different question: _what_ can be called, and _what_ leaks when it fails.

## The GAS function-exposure model

In Google Apps Script, every top-level function whose name does **not** end in an
underscore is automatically exposed to `google.script.run`. The official specification
excludes trailing-underscore functions from the callable surface (see
`src/backend/AGENTS.md` §1.1), which makes the underscore the platform's only
built-in privacy switch. A developer who forgets the underscore ships a public endpoint
that bypasses every application-level check — including the auth gate — because the gate
lives _inside_ `apiHandler`, not in front of the deployment.

This default is the mechanism that makes the private-by-default convention below
necessary rather than merely stylistic.

## Private-by-default convention

The backend convention is documented in `src/backend/AGENTS.md` §2.4: **every top-level
backend function must have a trailing underscore**. The only public entrypoints are:

| Entrypoint       | File                                     | Purpose                                     |
| ---------------- | ---------------------------------------- | ------------------------------------------- |
| `apiHandler`     | `src/backend/z_Api/z_apiHandler.js`      | Sole frontend transport entrypoint          |
| `doGet`          | `src/backend/z_Api/WebApp.js`            | Serves the built React HtmlService template |
| `triggerHandler` | `src/backend/Triggers/triggerHandler.js` | Sole scheduled-trigger execution entrypoint |

No other top-level `function` declaration may exist in the backend without a trailing
underscore.

This convention was established by a security audit (commit `e35f318`, "Section 7" of the
auth-service plan), which removed every accidental public function then present:

- **Six dead wrapper functions deleted** across three legacy source files that were then
  removed: `src/backend/AssignmentProcessor/globals.js` (four wrappers, including
  `startProcessing` and `triggerProcessSelectedAssignment`),
  `src/backend/y_controllers/globals.js` (one), and `src/backend/Utils/logError.js` (one).
  These were old global transport helpers that predated the `z_Api` layer and were no
  longer called by any active code path.
- **Twenty internal functions renamed** with trailing underscores. By category:
  - request-store lifecycle helpers in `src/backend/z_Api/requestStore.js` —
    `loadStore_`, `saveStore_`, `createStartedRecord_`, `markSuccess_`, `markError_`,
    `pruneStaleEntries_`, `compactStore_`;
  - configuration validators in `src/backend/ConfigurationManager/03_validators.js`
    (`validateLogLevel_`, `validateApiKey_`) and
    `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`
    (`safeGetPropertyKeys_`, `safeParseConfigObject_`);
  - error-shaped-value detection `isErrorLike_` in `src/backend/Utils/ABLogger.js`;
  - reference-data key generation `generateStableKey_` in
    `src/backend/y_controllers/ReferenceDataController.js`.

The API allowlist methods need no special treatment because they are already private: they
are registered in `ALLOWLISTED_METHOD_HANDLERS` (`src/backend/z_Api/z_apiHandler.js`) as
keys of a frozen `const` object whose values are anonymous closures, or closures that
delegate to trailing-underscore helpers such as `getBackendConfig_` or `getABClass_`.
Anonymous closures in a `const` object are not globals, so they are not exposed to
`google.script.run` (see `src/backend/AGENTS.md` §1.1).

## The guard test

The convention is enforced mechanically by `tests/api/apiHandler/globalExposure.test.js`,
a static source scan that fails the build if it regresses.

- The scan walks every `**/*.js` file under `src/backend` and flags any top-level
  `function <name>(…)` whose name does not end in `_` and is not in the explicit
  allowlist `ALLOWED_PUBLIC_FUNCTIONS` — exactly `['apiHandler', 'doGet',
'triggerHandler']`.
- **Scan precision:** matches are anchored to line starts (`/^function\s+(…)/`), so
  indented nested declarations inside classes or functions are not false-flagged. The test
  includes a fixture asserting that an indented `safeSet` inside `apiConfig.js` is _not_
  flagged while a top-level `accidentallyExposedHelper` is.
- **Vendored code is excluded by construction.** The glob root is `src/backend`, and the
  helper additionally skips any path containing a `node_modules` or `vendor` segment, so
  vendored assets are never scanned. The vendored `JsonDbApp` code in
  `scripts/builder/vendor/jsondbapp/src/**` does contain top-level non-underscore function
  declarations (for example `loadDatabase` and `createAndInitialiseDatabase` in
  `04_core/99_PublicAPI.js`) and is therefore exposed to `google.script.run` in the
  deployed bundle; this is an accepted risk — see
  [accepted-risks.md](./accepted-risks.md).

Because the test runs in the normal test suite, adding a new public function to the
backend without an explicit justification breaks the build immediately, rather than
silently widening the surface.

## Sole-transport discipline

The private-by-default convention reduces the surface to three entrypoints. Two of them
then funnel every meaningful operation through exactly one dispatch path each:

- **Frontend transport:** `apiHandler` is the sole transport entrypoint for frontend
  calls (backend AGENTS §1.1). On the frontend side the hard rule is that _all_
  frontend-to-backend calls must route through `callApi` in
  `src/frontend/src/services/apiService.ts` — never `google.script.run` directly from
  feature code (frontend AGENTS §5.1). The two halves meet at the allowlisted method name:
  the frontend passes a method string and `apiHandler` looks it up in
  `ALLOWLISTED_METHOD_HANDLERS`.
- **Sole transport registry:** `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js` is the
  single authoritative registry for frontend-callable methods. Backend AGENTS §1.1
  explicitly forbids parallel method-name registries. A method is reachable from the
  frontend if and only if it has an entry in this object.
- **Trigger equivalent:** scheduled work funnels through the single `triggerHandler`
  entrypoint and the `TRIGGER_METHOD_HANDLERS` registry. This is covered in detail by
  [Layer 2 — application authentication](./application-authentication.md); this document
  only notes that the same one-registry-per-transport pattern applies.

The value of sole-transport discipline is that security controls have one choke point.
The auth gate (`AuthService.checkAccess`), admission control (lock acquisition, stale
pruning, `ACTIVE_LIMIT`) and error mapping all live inside `apiHandler`'s dispatch path
in `z_apiHandler.js`; there is no second path a caller can use to skip them.

## Envelope and error hygiene

When a call does reach `apiHandler` and fails, the response must reveal as little as
possible about the backend:

- **Stable envelope, no internals.** Every response uses the transport envelope documented
  in [transport-envelope.md](../data-shapes/transport-envelope.md): a success shape
  (`ok: true`, `requestId`, `data`) or an error shape (`ok: false`, `requestId`, `error: {
code, message, retriable, details? }`). `_mapErrorToFailureEnvelope` in
  `z_apiHandler.js` maps recognised error types (`ApiRateLimitError`, `ApiValidationError`,
  `ApiDisabledError`, `DefinitionStaleError`, `reason === 'IN_USE'`) to fixed codes and
  falls back to `INTERNAL_ERROR` with the generic message "Internal API error." for
  anything else. Raw exception details, stack traces and internal error payloads are never
  sent to callers; the full thrown value is preserved in GAS execution logs via one
  boundary `ABLogger.error(...)` call (see `backend-logging-and-error-handling.md` §6).
- **Secrets never echo in config errors.** The configuration write handler aggregates
  per-field failures as `"${name}: REDACTED"` (the `safeSet` helper in
  `src/backend/z_Api/apiConfig.js`) and returns
  `{ success: false, error: "Failed to save some configuration values: …" }`. A failed
  `apiKey` or `backendUrl` save therefore surfaces as `apiKey: REDACTED`, never as the
  offending value. See [backend-config.md](../data-shapes/backend-config.md).
- **API keys are masked at the transport boundary.** `getBackendConfig_` emits
  `apiKey: maskApiKey_(rawApiKey)` and `hasApiKey: !!rawApiKey`; `maskApiKey_()`
  (`src/backend/z_Api/apiConfig.js`) returns `''` when no key is stored, `'****'` for
  keys of four characters or fewer, and `'****'` plus the last four characters otherwise.
  The raw key never crosses the transport boundary, and the frontend
  `isMaskedBackendApiKeyValue` validator enforces that the returned value matches exactly
  those shapes.
- **Prohibited types are converted at the boundary.** `google.script.run` prohibits
  `Date`, `Function` and DOM elements in return values; a live `Date` degrades GAS
  serialisation to non-JSON output that the frontend parses as `null`. Handlers therefore
  convert live `Date` objects to ISO 8601 strings before returning, via
  `DateUtils.normaliseDateFields` or `DateUtils.deepConvertDates` (backend AGENTS §9,
  frontend AGENTS §5.3, and `docs/developer/backend/api-layer.md`). This keeps the
  transport boundary JSON-clean.
- **Logging hygiene.** `ABLogger` is the mandatory logging primitive for backend code,
  and the policy forbids logging secrets, credentials, tokens or API keys
  (`backend-logging-and-error-handling.md` §8). The masking and redaction above keep
  secrets out of **error envelopes and transport payloads**. One caveat applies to logs:
  the dispatcher's ungated debug log stringifies incoming request params, which for
  `setBackendConfig` can include a newly-entered API key — a known, unresolved tension
  against the never-log-secrets policy, documented honestly in
  [Layer 4 — data handling](./data-handling.md).

## Related documentation

- [Security approach overview](./README.md) — layering model and threat model
- [Layer 2 — application authentication](./application-authentication.md) — the auth gate
  and trigger authorisation (including `TRIGGER_METHOD_HANDLERS`)
- [Accepted risks and trade-offs](./accepted-risks.md) — including the vendored
  `JsonDbApp` exposure
- [Backend API layer](../backend/api-layer.md) — transport handlers, allowlist pattern and
  validation ownership
- [Backend logging and error handling](../backend/backend-logging-and-error-handling.md) —
  `apiHandler` boundary standards and secret hygiene
- [Transport envelope](../data-shapes/transport-envelope.md) — the stable success/error
  envelope contract
- [BackendConfig contract](../data-shapes/backend-config.md) — API key masking and
  `REDACTED` error aggregation
- [`src/backend/AGENTS.md`](../../../src/backend/AGENTS.md) — §1.1 (sole-transport pattern)
  and §2.4 (private-by-default convention and security audit)
