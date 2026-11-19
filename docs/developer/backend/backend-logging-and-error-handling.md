# Backend Logging and Error Handling

This document defines the canonical backend logging and error-handling policy for `src/backend`.

Use this guide alongside:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `docs/developer/backend/api-layer.md`
- `docs/developer/backend/backend-testing.md`

## Purpose and scope

This policy exists to keep backend diagnostics reliable in Google Apps Script execution logs while preserving the stable frontend transport contract.

Scope:

- Active backend runtime code in `src/backend/**`

Out of scope:

- Generated build artefacts under `build/**`
- Third-party vendored code
- Deprecated reference code unless explicitly requested

## Logging primitives (mandatory)

### Developer diagnostics

- Use `ABLogger.getInstance().info/warn/error/debug(...)` for developer-facing backend logs.
- `ABLogger` is compulsory for all new backend code.

### User-facing progress/error state

- Use `ProgressTracker.getInstance().logError(...)` for user-facing progress errors.
- Keep user-facing messaging separate from developer diagnostics.

## New-code policy (mandatory)

For all new backend code in active areas:

1. Do not add direct `console.log/info/warn/error` calls.
2. Use `ABLogger` for developer diagnostics.
3. Log at meaningful boundaries (entry/exit for non-trivial workflows, and failure boundaries).
4. Include structured metadata objects, not only interpolated strings.
5. Include correlation context where available (`requestId`, method name, class or workflow context). Record the **canonical method name**: the whitespace-trimmed value that matches the allowlisted handler name. Use it at every log site for a request — entry, auth gate, audit trail and failure boundary. Normalise the method once per request and reuse that value. Logging raw input at one site and the normalised value at another fragments log correlation.

## Existing-code policy (opportunistic refactor rule)

When you touch existing backend code that contains direct `console.*` calls:

1. Opportunistically replace nearby touched direct `console.*` calls with `ABLogger` calls.
2. Prioritise replacement inside the functions or methods you are already modifying.
3. Keep refactors local and low-risk; do not expand scope into unrelated modules unless explicitly requested.
4. Do not defer replacement silently in touched code paths unless a concrete blocker exists.

## Error-boundary standards

1. Never use empty `catch` blocks.
2. Do not catch-and-return without logging.
3. For failures that are rethrown or mapped, log once at the catch boundary with useful context.
4. Avoid duplicate per-field detail spam across layers; prefer one contextual boundary log per layer.
5. Preserve raw thrown values for developer logs where practical; do not reduce to lossy `String(...)` before logging.

## `apiHandler` boundary standards

1. Keep frontend response envelopes stable and safe.
2. Preserve backend diagnostics in GAS execution logs for caught downstream failures.
3. Include `requestId` and the canonical method name in boundary failure logs; see [New-code policy](#new-code-policy-mandatory).
4. Do not expose stack traces or raw exception payloads in frontend envelopes.

## Log levels

- `info`: lifecycle milestones and successful transitions.
- `warn`: recoverable degradation, validation failures, and soft-failure states.
- `error`: failures that affect operation outcome or data integrity.
- `debug`: high-volume diagnostics gated by explicit debug controls.

## Sensitive data and payload hygiene

1. Never log secrets, credentials, tokens, or API keys.
2. Avoid logging full raw payloads when they may contain sensitive or unnecessary data.
3. Prefer selective, structured metadata fields required for diagnosis.

## Error type inventory

The following backend error types are recognised at the transport boundary by `_mapErrorToFailureEnvelope` in `z_apiHandler.js`. The type→code mapping is owned by [transport-envelope.md § Error code mapping](../data-shapes/transport-envelope.md#error-code-mapping); this inventory records each class, its file path and where it is thrown, plus any logging or transport-routing consequence not already covered by that table.

- **`ApiValidationError`** (`src/backend/Utils/ErrorTypes/ApiValidationError.js`) — transport-level input validation failure. A stable `code` (for example `DEFINITION_PARSE_FAILED`, the recovery baseline `DEFINITION_STALE`, or the authentication-settings save codes) takes precedence at the transport boundary; see the same contract for `DEFINITION_PARSE_FAILED` classification semantics.
- **`ApiRateLimitError`** (`src/backend/Utils/ErrorTypes/ApiRateLimitError.js`) — rate-limiting guard triggered; retriable.
- **`ApiDisabledError`** (`src/backend/Utils/ErrorTypes/ApiDisabledError.js`) — method or feature disabled; returned as an unknown-method failure.
- **`DefinitionStaleError`** (`src/backend/Utils/ErrorTypes/DefinitionStaleError.js`) — an `AssignmentDefinition`'s reference or template document has been modified since the definition was created. Non-retriable. Carries structured metadata: `definitionKey`, `referenceStale`, `isTemplateStale`, `referenceLastModified`, `templateLastModified`. Thrown at the API boundary in `startAssessmentRun` and at trigger-execution time in `runAssignmentPipeline`.
- **`AbortRequestError`** and **`PersistError`** — internal error types not mapped at the transport boundary; logged and surfaced as `INTERNAL_ERROR`.
- **`AssignmentNotFoundError`** (`src/backend/Utils/ErrorTypes/AssignmentNotFoundError.js`) — thrown by `ABClassAssignmentOps._loadFullAssignmentDocument` (delegated through `ABClassController._loadFullAssignmentDocument`) when the full assignment document is not found in its dedicated collection. Internal transport signal: not mapped at the transport boundary (the API handler catches it and returns `null`). Carries structured metadata: `courseId`, `assignmentId`, `collectionName`.
- **`ClassNotFoundError`** (`src/backend/Utils/ErrorTypes/ClassNotFoundError.js`) — thrown by `ABClassController.loadClass` when no persisted ABClass record exists for the given course ID. Not mapped at the transport boundary (maps to `INTERNAL_ERROR` via the dispatcher). Carries structured metadata: `courseId`.

All new error types should follow the existing pattern: extend `Error`, set `this.name`, accept domain-specific properties in the constructor, and include a guarded `module.exports` block for Node test compatibility.

## Utility class reference

- **`GASPropertiesUtils`** (`src/backend/Utils/00_GASPropertiesUtils.js`) — the entry point for all `PropertiesService` operations; callers use its static helpers instead of calling `PropertiesService` directly. It follows the static-only `ArrayUtils` pattern with guarded `module.exports`. See the `GASPropertiesUtils` JSDoc for the API.
