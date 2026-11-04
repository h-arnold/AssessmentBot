# Security Approach — Overview

This document describes how AssessmentBot protects the data it processes and stores.
AssessmentBot handles data about **minors** (student work, assessment records, marks), so
security is a first-class design concern rather than an afterthought.

The security posture is **defence in depth**. The primary control is the Google Apps
Script (GAS) platform itself — deployment mode, OAuth scopes and Google Drive/Workspace
permissions. The application-level authentication layer (the `AuthService` Google Group
gate) supplements that platform security, guarding against accidental misconfiguration
and laying the foundation for finer-grained roles in future. A data-handling discipline
completes the picture by minimising where sensitive data can exist.

This document set is developer-facing. Each detailed layer document is
grounded in the actual code; file paths and behaviour are cited rather than paraphrased.

## Layering model

| Layer | Title                                | Detail document                                                  |
| ----- | ------------------------------------ | ---------------------------------------------------------------- |
| 1     | Google Apps Script platform security | [platform-security.md](./platform-security.md)                   |
| 2     | Application-level authentication     | [application-authentication.md](./application-authentication.md) |
| 3     | Attack-surface reduction             | [attack-surface-reduction.md](./attack-surface-reduction.md)     |
| 4     | Data-handling discipline             | [data-handling.md](./data-handling.md)                           |

The layers are complementary. Layer 1 is the primary control and is sufficient on its
own when configured correctly. Layers 2–4 exist because misconfiguration happens, because
the deployed surface is larger than the UI, and because data should not exist where it
does not have to.

## Threat model

### Actors

- **Authorised users (teachers and staff)** — legitimate group members. They are trusted,
  but not assumed infallible: an authorised user can misconfigure the application, share
  Drive items too broadly, or fall victim to malware on their device.
- **Workspace-domain users outside the group** — colleagues in the same Google Workspace
  organisation who can reach the web app (because `access: DOMAIN` allows any signed-in
  domain user to open it) but are denied by the application auth gate.
- **Curious and prodigious computer science students** — the tool's own end-user
  population. A technically capable student is a realistic and in-scope adversary: they
  can open browser developer tools, inspect network traffic, invoke `google.script.run`
  methods directly from the console, probe API method names, tamper with client-side UI
  state, and attempt to access other students' Drive files by guessing or observing file
  and folder IDs. The design assumes the client is not trustworthy.
- **Anonymous visitors** — anyone without a signed-in Workspace identity. Blocked at the
  deployment level by `access: DOMAIN`.
- **External attackers** — parties outside the Workspace organisation. They cannot reach
  the web app, but they could target the separately-deployed LLM service or attempt
  social engineering. The LLM service is a separate repository and out of scope here.

### Assets

- Student work (Google Slides files) and anything derived from it.
- Assessment records, marks and class data (Google Sheets/Drive).
- Backend configuration, including the LLM API key (GAS Script Properties).
- Access to the LLM service (billed usage and student work transmitted to it).

### Trust boundaries

- **Browser ↔ GAS web app** — every call crosses `google.script.run`; the auth gate lives
  on this boundary.
- **GAS web app ↔ Google Workspace APIs** (Drive, Classroom, Groups) — governed by OAuth
  scopes and the executing user's identity.
- **GAS web app ↔ LLM service** — an external network call authenticated with the API key.
- **Client device** — by design, no durable storage of assessment data on the client.

### Threats and the layers that counter them

| Threat                                                            | Countering layer                       |
| ----------------------------------------------------------------- | -------------------------------------- |
| Unauthorised access to the app                                    | 1 (DOMAIN access) + 2 (group gate)     |
| Direct invocation of exposed GAS functions, bypassing the UI      | 3 (private-by-default, sole transport) |
| Probing which API methods exist                                   | 2 (gate before allowlist lookup)       |
| Data theft from a stolen/compromised client device                | 4 (no persisted client storage)        |
| Accidental misconfiguration (deployment mode, over-broad sharing) | 1 + 2 (defence-in-depth)               |
| A revoked user continuing to run scheduled work                   | 2 (trigger auth bypasses the cache)    |

## Layer summaries

### Layer 1 — Google Apps Script platform security

The deployment manifest pins the web app to run as the accessing user, inside the
Workspace domain, so every invocation carries the caller's own identity and authority and
anonymous visitors cannot reach it at all. OAuth scopes are minimised and Drive sharing is
restricted to named individuals, which makes the platform itself the primary control.

See [platform-security.md](./platform-security.md).

### Layer 2 — Application-level authentication

The `AuthService` gate checks that the caller is an authorised user — and resolves their
role — before any protected API call or trigger execution is dispatched. It supplements
Layer 1 by catching deployment misconfiguration, denies non-members uniformly so the
method surface cannot be probed, and audits every attempt.

See [application-authentication.md](./application-authentication.md).

### Layer 3 — Attack-surface reduction

Google Apps Script exposes every top-level function whose name does not end in an
underscore, so the backend reduces its callable surface to three intended entrypoints and
funnels frontend and trigger traffic through one dispatch path each. Keeping the transport
envelope free of exception detail and secrets means probing the surface reveals nothing
about the implementation behind it.

See [attack-surface-reduction.md](./attack-surface-reduction.md).

### Layer 4 — Data-handling discipline

The frontend keeps no durable client-side storage, so a stolen or compromised device holds
nothing worth recovering; server-side persistence is deliberately minimal and bounded.
Logging policy forbids secrets in logs.

See [data-handling.md](./data-handling.md).

## Accepted risks and trade-offs

Security decisions involve trade-offs. The project records them openly — including the
vendored-code exposure in the deployed bundle, the bounded revocation latency of the auth
cache, the deliberate bootstrap fail-open window, and the deferred role-based method
filtering — with the justification for each in
[accepted-risks.md](./accepted-risks.md).

## Related documentation

- [OAuth scopes](../backend/oauth-scopes.md) — managing scopes in `appsscript.json`
- [Backend API layer](../backend/api-layer.md) — transport handlers and validation ownership
- [Backend logging and error handling](../backend/backend-logging-and-error-handling.md) — logging policy and hygiene rules
- [Data shapes INDEX](../data-shapes/INDEX.md) — canonical contracts, including
  [AuthCache](../data-shapes/auth-cache.md), [TriggerContext](../data-shapes/trigger-context.md),
  [AuthUsers](../data-shapes/auth-users.md), [BackendConfig](../data-shapes/backend-config.md) and the
  [transport envelope](../data-shapes/transport-envelope.md)
- [src/backend/AGENTS.md](../../../src/backend/AGENTS.md) — §2 documents the private-by-default
  convention, and §7 the `AuthService` singleton and the `webapp` deployment block
