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

- **Layer 1 — platform security**: the `webapp` deployment block (`executeAs:
USER_ACCESSING`, `access: DOMAIN`), OAuth scope minimisation, Drive file/folder
  permissions, and the installable-trigger execution model.
- **Layer 2 — application authentication**: the `AuthService` Google Group membership
  gate that runs on every protected API call and every trigger execution; identity
  resolution, role mapping, caching policy and audit logging.
- **Layer 3 — attack-surface reduction**: the private-by-default function convention,
  the sole-transport (`apiHandler`) discipline, and envelope/error hygiene that prevents
  implementation detail from leaking to callers.
- **Layer 4 — data-handling discipline**: no durable client-side storage, minimal
  server-side persistence, and logging hygiene.

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

The deployment manifest (`src/backend/appsscript.json`) requires
`webapp.executeAs: USER_ACCESSING` and `webapp.access: DOMAIN`. Every script invocation
therefore runs with the calling user's identity and authorisation (least privilege), and
only signed-in Workspace-domain users can open the web app at all. OAuth scopes are
minimised — Classroom access uses readonly variants — and Drive operations share folders
with named individuals only. Installable triggers run as the user who created them, so
scheduled work inherits that user's identity and is re-authorised at run time by Layer 2.

See [platform-security.md](./platform-security.md).

### Layer 2 — Application-level authentication

`AuthService` (`src/backend/Utils/AuthService.js`) checks whether the calling user is a
member of a configured Google Group before any protected API call or trigger execution is
dispatched. The check resolves the active user's email, looks up the group via
`GroupsApp`, maps `OWNER`/`MANAGER` to the `admin` role and `MEMBER` to `user`, caches
only successful results for six hours, and audits every attempt. The API gate runs before
method lookup and admission, so non-members receive a uniform `FORBIDDEN` response and
cannot probe the method surface. Trigger execution is stricter than the API gate: it
bypasses the cache and fails closed if the group is unconfigured.

See [application-authentication.md](./application-authentication.md).

### Layer 3 — Attack-surface reduction

Google Apps Script exposes every top-level function that does not end in an underscore to
`google.script.run`. The backend therefore enforces a **private-by-default** convention:
the only public entrypoints are `apiHandler`, `doGet` and `triggerHandler`. A guard test
(`tests/api/apiHandler/globalExposure.test.js`) statically scans the backend and fails the
build if a new public function appears. All frontend calls funnel through `apiHandler`
and the `ALLOWLISTED_METHOD_HANDLERS` registry, and the transport envelope never exposes
raw exception details or secrets.

See [attack-surface-reduction.md](./attack-surface-reduction.md).

### Layer 4 — Data-handling discipline

The frontend never persists data to browser storage (no `localStorage`, `sessionStorage`,
`indexedDB` or cookies). React Query caches responses in memory for the session only;
data is lost on tab close and re-fetched from the backend. This is a deliberate trade-off
against performance, chosen to reduce the value of a compromised client device.
Server-side, only minimal opaque identifiers are stored in Script Properties, auth
results are cached in `CacheService`, and assessment data lives in Drive/Sheets with
restricted sharing. Logging policy forbids secrets in logs.

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
  [BackendConfig](../data-shapes/backend-config.md) and the
  [transport envelope](../data-shapes/transport-envelope.md)
- [src/backend/AGENTS.md](../../../src/backend/AGENTS.md) — sections 2.3–2.6 document the
  `AuthService` singleton, the private-by-default convention, the `webapp` deployment
  block and the trigger handler architecture
- `SPEC.md` — the planning specification for the auth service (may be superseded; treat
  as historical)
