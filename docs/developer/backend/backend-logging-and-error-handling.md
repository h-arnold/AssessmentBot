# Backend Logging and Error Handling

This document defines the canonical backend logging and error-handling policy for `src/backend`.

Use this guide alongside:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `docs/developer/backend/api-layer.md`
- `docs/developer/backend/backend-testing.md`

## 1. Purpose and scope

This policy exists to keep backend diagnostics reliable in Google Apps Script execution logs while preserving the stable frontend transport contract.

Scope:

- Active backend runtime code in `src/backend/**`

Out of scope:

- Generated build artefacts under `build/**`
- Third-party vendored code
- Deprecated reference code unless explicitly requested

## 2. Logging primitives (mandatory)

### Developer diagnostics

- Use `ABLogger.getInstance().info/warn/error/debug(...)` for developer-facing backend logs.
- `ABLogger` is compulsory for all new backend code.

### User-facing progress/error state

- Use `ProgressTracker.getInstance().logError(...)` for user-facing progress errors.
- Keep user-facing messaging separate from developer diagnostics.

## 3. New-code policy (mandatory)

For all new backend code in active areas:

1. Do not add direct `console.log/info/warn/error` calls.
2. Use `ABLogger` for developer diagnostics.
3. Log at meaningful boundaries (entry/exit for non-trivial workflows, and failure boundaries).
4. Include structured metadata objects, not only interpolated strings.
5. Include correlation context where available (`requestId`, method name, class or workflow context).

## 4. Existing-code policy (opportunistic refactor rule)

When you touch existing backend code that contains direct `console.*` calls:

1. Opportunistically replace nearby touched direct `console.*` calls with `ABLogger` calls.
2. Prioritise replacement inside the functions or methods you are already modifying.
3. Keep refactors local and low-risk; do not expand scope into unrelated modules unless explicitly requested.
4. Do not defer replacement silently in touched code paths unless a concrete blocker exists.

## 5. Error-boundary standards

1. Never use empty `catch` blocks.
2. Do not catch-and-return without logging.
3. For failures that are rethrown or mapped, log once at the catch boundary with useful context.
4. Avoid duplicate per-field detail spam across layers; prefer one contextual boundary log per layer.
5. Preserve raw thrown values for developer logs where practical; do not reduce to lossy `String(...)` before logging.

## 6. `apiHandler` boundary standards

1. Keep frontend response envelopes stable and safe.
2. Preserve backend diagnostics in GAS execution logs for caught downstream failures.
3. Include `requestId` and allowlisted method context in boundary failure logs.
4. Do not expose stack traces or raw exception payloads in frontend envelopes.

## 7. Log levels

- `info`: lifecycle milestones and successful transitions.
- `warn`: recoverable degradation, validation failures, and soft-failure states.
- `error`: failures that affect operation outcome or data integrity.
- `debug`: high-volume diagnostics gated by explicit debug controls.

## 8. Sensitive data and payload hygiene

1. Never log secrets, credentials, tokens, or API keys.
2. Avoid logging full raw payloads when they may contain sensitive or unnecessary data.
3. Prefer selective, structured metadata fields required for diagnosis.

## 9. Error type inventory

The following backend error types are recognised at the transport boundary by `_mapErrorToFailureEnvelope` in `z_apiHandler.js`:

- **`ApiValidationError`** (`src/backend/Utils/ErrorTypes/ApiValidationError.js`) — transport-level input validation failure. Mapped to `INVALID_REQUEST`.
- **`ApiRateLimitError`** (`src/backend/Utils/ErrorTypes/ApiRateLimitError.js`) — rate-limiting guard triggered. Mapped to `RATE_LIMITED`; retriable.
- **`ApiDisabledError`** (`src/backend/Utils/ErrorTypes/ApiDisabledError.js`) — method or feature disabled. Mapped to `UNKNOWN_METHOD`.
- **`DefinitionStaleError`** (`src/backend/Utils/ErrorTypes/DefinitionStaleError.js`) — an `AssignmentDefinition`'s reference or template document has been modified since the definition was created. Mapped to `DEFINITION_STALE`; non-retriable. Carries structured metadata: `definitionKey`, `referenceStale`, `templateStale`, `referenceLastModified`, `templateLastModified`. Thrown at the API boundary in `startAssessmentRun` and at trigger-execution time in `runAssignmentPipeline`.
- **`AbortRequestError`** and **`PersistError`** — internal error types not mapped at the transport boundary; logged and surfaced as `INTERNAL_ERROR`.
- **`AssignmentNotFoundError`** (`src/backend/Utils/ErrorTypes/AssignmentNotFoundError.js`) — **Planned: `Not implemented`**. Will be thrown by `ABClassController._loadFullAssignmentDocument` when the full assignment document is not found in its dedicated collection. Internal transport signal: not mapped at the transport boundary (the API handler catches it and returns `null`). Carries structured metadata: `courseId`, `assignmentId`, `collectionName`.

All new error types should follow the existing pattern: extend `Error`, set `this.name`, accept domain-specific properties in the constructor, and include a guarded `module.exports` block for Node test compatibility.

## 10. Utility class reference

- **`GASPropertiesUtils`** (`src/backend/Utils/00_GASPropertiesUtils.js`) — canonical entry point for all `PropertiesService` operations. Static-only utility class providing `getScriptProperties()`, `getUserProperties()`, `applyProperties(properties, propertyMap)`, and `clearProperties(properties, keys)`. Replaces direct `PropertiesService.getScriptProperties()` and `PropertiesService.getUserProperties()` calls in `ConfigurationManager`, `AssignmentController`, and future callers. Follows the `ArrayUtils` static-only pattern with guarded `module.exports`.
