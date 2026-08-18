# Data-Handling Discipline

This document is **Layer 4** of the [Security Approach overview](./README.md). It is about
where data exists in AssessmentBot and — just as importantly — where it deliberately does
not exist. The design posture is: the client is not trusted with data at rest, server-side
persistence is minimised and bounded, and logs are kept free of secrets. Layers 1–3 control
who can reach the application and what they can make it do; this layer controls how little
sensitive material is left lying around if a control fails. It complements the threat model
in the [overview](./README.md), in which a stolen or compromised client device is an
in-scope adversary and the countering layer is precisely "no persisted client storage".

## No durable client-side storage

The frontend never persists data to browser storage. A scan of `src/frontend/src`
(production source, co-located specs and test fixtures) finds no use of `localStorage`,
`sessionStorage`, `indexedDB` or `document.cookie` — this is verified, not asserted from
convention. Assessment data, configuration and reference data exist in the browser only as
React state or as React Query cache entries.

React Query caches server responses **in memory only**, for the lifetime of the page
session. `createAppQueryClient()` in `src/frontend/src/query/queryClient.ts` constructs a
plain `new QueryClient({...})` with no persist-client, no
`createSyncStoragePersister` and no storage adapter anywhere in the frontend; `gcTime:
Infinity` keeps entries alive within the session but never writes them to disk. When the
tab closes, the cache is lost with it, and the next load re-fetches from the backend
through `callApi()` (`src/frontend/src/services/apiService.ts`).

This is a deliberate trade-off, not an omission:

- **No offline cache.** The app cannot render previously seen data without a network
  round-trip.
- **No instant re-render after reload.** Every load starts cold; there is no warm cache to
  serve from.
- **In exchange, a stolen or compromised client device holds nothing.** There is no disk
  artefact — cookie jar, local storage entry, or IndexedDB store — from which assessment
  data, marks or the API key could be recovered after the browser closes. In-memory state
  is short-lived and is not exfiltratable from disk. The accepted-risks document restates
  this as a design decision ("The client is not trusted with data at rest") and the README
  threat model attributes exactly this threat — data theft from a stolen or compromised
  device — to this layer. See [accepted-risks.md](./accepted-risks.md).

## Server-side storage inventory

What the backend _does_ persist is deliberately small. Four places hold data server-side.

### GAS Script Properties (via `GASPropertiesUtils`)

All `PropertiesService` access goes through `GASPropertiesUtils`
(`src/backend/Utils/00_GASPropertiesUtils.js`) per backend convention. Two stores live here:

- **Backend configuration** — a single JSON blob under `__CONFIG_STORE_KEY__`
  (`src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`), whose contract is
  [backend-config.md](../data-shapes/backend-config.md). It includes `authGroupEmail` and
  the LLM `apiKey`. The raw API key is never transported to the frontend: the read
  transport masks it (`maskApiKey_()` emits `''`, `'****'`, or `'****'` + last 4
  characters) and the frontend only ever receives the masked value.
- **Trigger context** — per-scheduled-trigger keys `trigger:<uid>:method` and
  `trigger:<uid>:params`, written and cleared by `TriggerController`
  (`src/backend/Triggers/TriggerController.js`:
  `storeTriggerContext()`, `getTriggerContext()`, `clearTriggerContext()`). The `params`
  value is a JSON string of **opaque identifiers only** — `assignmentId`, `definitionKey`,
  `courseId` — never student content (see [trigger-context.md](../data-shapes/trigger-context.md)).

A related, bounded store: **RequestStore** (`src/backend/z_Api/requestStore.js`) tracks
API request lifecycle (method, status, timestamps, error message) in **User Properties**
under `AB_USER_REQUEST_STORE` for rate limiting and diagnostics. It is an internal
backend-only mechanism with no transport, and it is size-bounded (compaction above 30
entries; see [request-store.md](../data-shapes/request-store.md)).

### CacheService script cache (via `CacheManager`)

`CacheManager` (`src/backend/RequestHandlers/CacheManager.js`) wraps
`CacheService.getScriptCache()`, an in-memory, TTL-bounded cache — **not durable
storage**. Two kinds of entries:

- **Auth results** — only successful authorisations, shaped `{ allowed: true, role }`,
  keyed `auth:<groupEmail>:<email>` with a 6-hour TTL, written by
  `AuthService.checkAccess()` (`src/backend/Utils/AuthService.js`). Denials are never
  cached. See [auth-cache.md](../data-shapes/auth-cache.md).
- **Assessment data** — content-hash-keyed results
  (`generateCacheKey()` hashes `referenceHash::responseHash`), stored by
  `setCachedAssessment()` to avoid redundant LLM processing; `LLMRequestManager`
  (`src/backend/RequestHandlers/LLMRequestManager.js`) reads them via
  `getCachedAssessment()`.

Writes are **best-effort**: `put()` catches and logs cache-service failures via `ABLogger`
and does not throw, so a cache outage degrades performance (re-processing) rather than
breaking the assessment workflow. Entries expire on their TTL; nothing in the cache
survives as an authoritative record.

### Google Drive / Sheets

Assessment records, class data and student work live in Drive/Sheets, protected by the
Layer 1 sharing controls (restricted folder sharing with named individuals). This is where
the data actually resides long-term; the layers above keep it from leaking elsewhere.

### LLM service (trust boundary)

Student work is transmitted to the separately-deployed LLM service during assessment.
`LLMRequestManager.generateRequestObjects()` builds payloads containing the student's
response (`studentResponse`), the task reference and template content, and sends them via
`UrlFetchApp.fetchAll()` to `${backendUrl}/v1/assessor` with `Authorization: Bearer
${apiKey}`. This is an **external network call — the data leaves the Google Workspace
domain**. It is a documented trust boundary in the [overview](./README.md); the API key
protecting that boundary is itself a stored asset (Script Properties above), so key
hygiene is not optional.

## Logging hygiene

### Policy

The backend policy in
[backend-logging-and-error-handling.md](../backend/backend-logging-and-error-handling.md)
(section 8) forbids logging secrets, credentials, tokens or API keys, prefers selective
structured metadata over raw payloads, and asks for correlation context (`requestId`,
method) where available. All backend developer diagnostics must go through `ABLogger`
(`src/backend/Utils/ABLogger.js`).

### Frontend

`frontendLogger.ts` (`src/frontend/src/logging/frontendLogger.ts`) gates levels by runtime:
`isLevelEnabled()` keeps only `warn` and `error` in production and drops `debug` and
`info` entirely. It also sanitises metadata before emission: `redactValue()` recursively
replaces values under the keys `token`, `secret`, `password`, `authorisation`,
`authorization` and `email` with `[REDACTED]`.

There is a known **development-only** exposure: in development mode all levels are
enabled, and `callApi()` (`src/frontend/src/services/apiService.ts`) debug-logs
`metadata: { attempt, params: requestPayload.params, method }` on every dispatch attempt.
For `setBackendConfig`, `params` contains the raw, newly-entered API key
(`BackendApiKeyWriteSchema` in
`src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`), and the
nested key name `apiKey` is not in the redaction set — so the raw key appears in the
browser console in development. This is a development-only exposure: in production the
debug call is dropped by `isLevelEnabled()` before it reaches the console.

### Backend — known tension, not yet resolved

We state this honestly because it is a real gap against the never-log-secrets policy:
`ApiDispatcher.handle()` in `src/backend/z_Api/z_apiHandler.js` debug-logs the full
incoming request via the **ungated** `ABLogger.debug()` method:

```javascript
ABLogger.getInstance().debug('API request received.', {
  requestId,
  method: request.method,
  params: JSON.stringify(request.params),
});
```

`ABLogger.debug()` (`src/backend/Utils/ABLogger.js`) has no level gate or debug flag — it
always forwards to `console.log`, so this statement runs on every request in every
deployment. Because the params are stringified verbatim, a `setBackendConfig` call that
sets a new API key can place that raw key in the GAS execution logs at debug level. The
same dispatcher also debug-logs the response envelope (which for config endpoints carries
only masked or redacted values); the risk is concentrated in the request-params log. This
is a candidate for future redaction at the transport boundary — it is tracked as a known
consideration, **not** claimed as fixed.

### Recommended operational practice

- Treat GAS execution logs as **sensitive**: they are observable to anyone with edit or
  view access to the Apps Script project.
- Restrict access to the Apps Script project to the smallest set of administrators.
- Do not leave debug logging enabled in production; run with production log levels and
  rely on `warn`/`error` for diagnostics.
- Avoid performing API-key rotation or initial configuration while verbose log capture is
  switched on.

## Related documentation

- [Security approach overview](./README.md) — the layering model, threat model and trust boundaries
- [Layer 1 — platform security](./platform-security.md) — deployment mode, OAuth scopes, Drive sharing controls
- [Layer 2 — application authentication](./application-authentication.md) — the group gate that protects every API call
- [Layer 3 — attack-surface reduction](./attack-surface-reduction.md) — private-by-default functions and the sole-transport discipline
- [Accepted risks and trade-offs](./accepted-risks.md) — the client-not-trusted design decision and revocation latency
- [Backend logging and error handling](../backend/backend-logging-and-error-handling.md) — canonical logging and payload-hygiene policy
- Data-shape contracts: [BackendConfig](../data-shapes/backend-config.md), [TriggerContext](../data-shapes/trigger-context.md), [AuthCache](../data-shapes/auth-cache.md), [RequestStore](../data-shapes/request-store.md), and the [INDEX](../data-shapes/INDEX.md)
