# Frontend Logging and Error Handling

This document defines practical standards for frontend debugging, production logging, and user-facing error handling in `src/frontend`.

Use this guide alongside:

- `src/frontend/AGENTS.md`
- `docs/developer/backend/api-layer.md`
- `docs/developer/frontend/frontend-testing.md`

## 1. Goals and boundaries

We are setting standards early so logs remain useful as features grow.

### Goals

1. Give developers enough context to diagnose failures quickly.
2. Keep user-facing copy clear and non-technical.
3. Avoid leaking implementation details in production UI.
4. Keep logging and error flows deterministic and testable.

### Boundary split

- **Developer diagnostics**: structured logs and technical context for debugging.
- **Operational outcome**: user-safe messages for UI rendering.

Do not combine these concerns in a single string.

## 2. Error flow contract (frontend + backend boundary)

Use the backend API envelope as the frontend transport contract:

- Success: `{ ok: true, requestId, data, meta? }`
- Error: `{ ok: false, requestId, error: { code, message, retriable? }, meta? }`

`callApi` is the only transport boundary for frontend feature code. Keep backend method wiring and envelope parsing there.

Recommended flow:

1. `callApi` validates request and response envelopes.
2. `callApi` throws typed transport errors with request metadata (`requestId`, `code`, `retriable`, `meta`).
3. Feature hooks/services map transport errors into UI-safe view models.
4. Components render only mapped user-safe copy.

## 3. Logging policy by environment

Use one logger abstraction for all frontend code. Direct `console.*` calls are not permitted anywhere in frontend source.

### Development logging (local + dev builder mode)

Allowed and encouraged:

- `debug` logs for state transitions and side-effect lifecycle.
- `info` logs for expected successful transitions.
- `warn` logs for degraded but recoverable behaviour.
- `error` logs for failures.

Include at minimum:

- `context` (feature/hook/service name)
- `errorMessage` (normalised, non-empty)
- `stack` (when an Error stack is available)
- `requestId` (if available)
- `errorCode` (if available)
- serialisable metadata

### Production logging

Default production frontend behaviour should be conservative and operationally idiomatic:

- keep `debug` and noisy `info` disabled by default
- keep `warn` and `error` enabled
- include concise diagnostic fields (`context`, `errorMessage`, `errorCode`, `requestId`)
- avoid stack traces by default unless explicitly enabled for incident triage
- never log secrets, tokens, full payloads, or PII

If richer telemetry is needed later, route structured logs to an explicit external sink instead of ad-hoc browser console output.

### Sanitisation and correlation requirements

To keep logs both useful and safe, apply these baseline rules in all environments:

- always include correlation identifiers when available (`requestId`, operation or task ids)
- treat all metadata as untrusted and redact sensitive keys before logging
- maintain a deny-list for obvious secrets and personal data fields (`token`, `secret`, `password`, `authorisation`, `authorization`, `email`)
- cap or truncate oversized metadata payloads so logs stay readable and deterministic

Keep redaction and normalisation in shared logger utilities (for example `src/frontend/src/logging/`) rather than duplicating checks in each feature.

For test code, prefer exported logger helpers (`getFrontendLogBuffer()`, `clearFrontendLogBuffer()`) instead of directly reading internal global buffer keys.

## 4. User feedback policy (Ant Design)

Ant Design guidance referenced for this section:

- App (context-aware feedback APIs): https://ant.design/components/app
- Message (transient operation feedback): https://ant.design/components/message
- Notification (richer asynchronous feedback): https://ant.design/components/notification
- Alert (persistent inline messaging): https://ant.design/components/alert
- Result (structured outcome states): https://ant.design/components/result

Use Ant Design feedback components according to UI persistence and user intent:

- `Result`: large state outcomes (for example terminal auth outcome screens).
- `Alert`: persistent inline guidance within current layout.
- `message`: brief transient confirmation/failure after direct user action.
- `notification`: richer asynchronous or background feedback requiring more context.

Use context-aware APIs (`App.useApp`, `message.useMessage`, `notification.useNotification`) rather than static methods, so ConfigProvider tokens and context are respected.

## 5. Mapping rules (developer detail vs user-safe copy)

Treat backend `error.code` as the source for user-safe messaging logic. Avoid showing raw thrown messages directly in production UI.

Suggested mapping baseline:

- `RATE_LIMITED`: user-safe retry guidance (warning tone).
- `INVALID_REQUEST`: user-safe request failure guidance; include next action where possible.
- `UNKNOWN_METHOD`, `INTERNAL_ERROR`, malformed responses, runtime failures: generic failure copy with a recovery action.

Keep raw technical details in logs only.

Current auth status UI behaviour follows this by mapping failures to user-safe copy rather than displaying raw transport error messages.

## 6. Location and shape of custom frontend error types

For consistency, keep custom frontend error types in a dedicated error module tree:

- shared error contracts and base helpers: `src/frontend/src/errors/`
- feature-specific mappings or wrappers: `src/frontend/src/features/<feature>/errors/`

Recommended file split:

1. `src/frontend/src/errors/error-codes.ts` for shared frontend/domain error code unions.
2. `src/frontend/src/errors/app-error.ts` for a small base error type (if needed).
3. `src/frontend/src/errors/map-error-to-ui.ts` for transport/domain-to-UI mapping.

Keep transport concerns (`ApiTransportError`) near the API boundary service, but map them to UI-safe contracts in the frontend error modules before rendering.

Idiomatic React + TypeScript guidance:

- prefer typed error objects/discriminated unions over raw strings
- keep user-facing copy outside thrown error constructors where practical
- keep mapping pure and easily unit-testable
- avoid class-heavy hierarchies unless there is a clear behavioural need

## 7. Builder mode implications for frontend logging

The builder supports production and dev frontend modes (`npm run build` vs `npm run build:dev`).

Treat builder mode as an operational control, not as permission to blur boundaries:

- **Dev build mode**:
  - allow additional developer diagnostics (debug/info verbosity)
  - keep user-facing copy unchanged and user-safe
- **Production build mode**:
  - reduce client log verbosity by default
  - preserve stable error mapping and UI behaviour

In short: build mode changes diagnostic depth, not the user contract.

## 8. React patterns for resilient error handling

Use idiomatic React patterns to keep error paths predictable:

1. Keep side effects in hooks, not in presentation components.
2. Model state explicitly (`loading`, `success`, `error`) with typed data.
3. Add an app-level error boundary for render/lifecycle crashes.
4. Keep asynchronous service failures in hook/service logic.
5. Avoid catch-and-ignore patterns; either rethrow or map explicitly.

## 9. Testing expectations

Testing remains aligned with `docs/developer/frontend/frontend-testing.md`:

- unit test logger utilities (level gating, payload shape, and redaction behaviour)
- unit test error mapping from transport errors to UI-safe messages
- component test inline error states and fallback rendering
- unit test stack-trace inclusion rules (included in development, suppressed by default in production)
- e2e smoke tests for representative failures (backend envelope error, transport failure, rate limit retry path)

Coverage expectations still apply.
