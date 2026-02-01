# React Front-end Skeleton Plan (Google Apps Script Web App)

## Purpose

This document outlines a proposed React front-end structure for AssessmentBot, aligned to the current Google Apps Script data model and the existing Sheets-based analysis flows. It includes a component map, state tree suggestions, and a draft API surface with client-side service helpers. The goal is to replace the Google Sheets UI with a structured web app while keeping data payloads small and respecting the current hydration strategy. 【F:docs/developer/DATA_SHAPES.md†L27-L56】

## Data model alignment (what the UI should assume)

- **Split persistence model**: `ABClass` records are lightweight and store assignments as partial summaries. Full assignment payloads are stored separately in `assign_full_<courseId>_<assignmentId>` collections. This maps cleanly to list views vs assignment detail views. 【F:docs/developer/DATA_SHAPES.md†L31-L42】
- **Partial assignment definitions** embed `tasks: null` as a deliberate marker, so the UI should not assume task detail unless a full definition is loaded. 【F:docs/developer/DATA_SHAPES.md†L112-L132】
- **Assessment map** uses criteria keys (completeness/accuracy/SPaG) with scores and optional reasoning; partial hydration drops reasoning. This supports list views with scores and detail views with reasoning. 【F:docs/developer/DATA_SHAPES.md†L487-L507】

## Proposed front-end views and components

### 1) Overview dashboard (overall stats)

**Goal**: Provide cross-class and cohort insights similar to the overview and cohort sheets.

Components:

- `OverviewDashboard`
  - `SummaryCards` (overall averages, participation, completion distribution)
  - `ClassLeaderboard` (highest/lowest class averages)
  - `StudentHighlights` (top/bottom students across classes)
  - `CohortTable` (year group summary table)

Data sources and logic:

- Use `ABClass` partial summaries plus class-level aggregates.
- Aggregation logic should mirror existing sheet behaviour for averages and criteria. 【F:src/AdminSheet/Sheets/OverviewSheetManager.js†L12-L35】【F:src/AdminSheet/Sheets/OverviewSheetManager.js†L154-L252】
- Cohort table can use the same shape produced in the cohort analysis sheets (numeric columns, per-student rows by class). 【F:src/AdminSheet/Sheets/CohortAnalysisSheetManager.js†L5-L109】【F:src/AdminSheet/Sheets/CohortAnalysisSheetManager.js†L171-L204】

### 2) Class view

**Goal**: Class-level performance overview with drill-down to assignments and students.

Components:

- `ClassOverview`
  - `ClassHeader` (class metadata, teacher list)
  - `CompletionMetrics` (class averages by criterion)
  - `StudentTable` (student averages and flags)
  - `AssignmentList` (assignments with summary metrics)
  - `TopBottomStudents`

Data sources and logic:

- Load `ABClass` (partial) and derive class-level stats.
- Assignment list uses partial assignment summaries (no task detail). 【F:docs/developer/DATA_SHAPES.md†L60-L67】【F:docs/developer/DATA_SHAPES.md†L112-L116】

### 3) Assessments panel (run + audit)

**Goal**: Trigger assessment runs and monitor status.

Components:

- `AssessmentRunsPanel`
  - `RunAssessmentForm` (select class/assignment/definition)
  - `ExistingRunsTable` (status, timestamps)
  - `RunProgressModal` (if monitoring ongoing runs)

Data sources and logic:

- Use a lightweight run registry endpoint with per-run metadata.
- Avoid fetching full assignment payloads unless the user opens a run.

### 4) Assignment view (drill-down)

**Goal**: Task and student-level analysis with reasoning details.

Components:

- `AssignmentDetail`
  - `AssignmentSummary` (criteria averages)
  - `TaskBreakdown` (per task, by criteria)
  - `StudentAssessmentsTable` (per student scores)
  - `AssessmentNotesDrawer` (reasoning + student response)

Data sources and logic:

- Requires `assign_full_*` (full payload with tasks and reasoning). 【F:docs/developer/DATA_SHAPES.md†L37-L42】【F:docs/developer/DATA_SHAPES.md†L487-L507】
- Structure should mirror the analysis sheet layout (tasks, criteria, averages). 【F:src/AdminSheet/Sheets/AnalysisSheetManager.js†L38-L56】【F:src/AdminSheet/Sheets/AnalysisSheetManager.js†L157-L252】

## Suggested state tree (front-end)

```ts
state = {
  app: {
    currentUser: { email, role },
    loading: { global: false },
    errors: [],
  },
  classes: {
    byId: {
      [classId]: {
        meta: { className, cohort, yearGroup, teachers, studentsCount },
        assignments: {
          partial: [
            {
              assignmentId,
              assignmentName,
              lastUpdated,
              definitionKey,
              documentType,
              summaryStats,
            },
          ],
          fullById: {
            [assignmentId]: { assignmentId, submissions: [], tasks: {}, assessments: {} },
          },
        },
        stats: {
          averages: { completeness, accuracy, spag },
          topStudents: [],
          bottomStudents: [],
        },
      },
    },
    list: [],
    loading: { list: false, detailById: {} },
  },
  assessments: {
    runs: [{ runId, classId, assignmentId, status, startedAt, updatedAt }],
    triggerQueue: [],
  },
  ui: {
    filters: { yearGroup, classId, status, searchText },
    panels: { overview: {}, classView: {}, assignmentView: {} },
  },
};
```

Rationale:

- Keeps **partial** assignment summaries separate from **full** assignment payloads for predictable cache behaviour, reflecting the existing split storage strategy. 【F:docs/developer/DATA_SHAPES.md†L31-L42】
- Enables fast list views and lazy-load drill-downs in line with current hydration rules. 【F:docs/developer/DATA_SHAPES.md†L60-L67】【F:docs/developer/DATA_SHAPES.md†L127-L132】

## Draft API surface (Apps Script web app)

The Apps Script web app should expose a minimal JSON API with controlled hydration levels. Suggested endpoints:

### Core data

- `GET /classes?hydration=partial`
  - Returns class summaries (ABClass, partial assignments)
- `GET /classes/:classId?hydration=partial`
  - Returns a single class with partial assignments and derived class stats
- `GET /classes/:classId/assignments/:assignmentId?hydration=full`
  - Returns `assign_full_*` with tasks, submissions, assessments, and reasoning

### Assessment runs

- `POST /assessments/runs`
  - Body: `{ classId, assignmentId, definitionKey }`
  - Starts a run and returns `{ runId, status }`
- `GET /assessments/runs`
  - Returns a list of runs (recent first)
- `GET /assessments/runs/:runId`
  - Returns run status, progress, and metadata

### Cohort/overview

- `GET /overview?yearGroup=10`
  - Returns aggregated data for the overview dashboard (per class and per student)
  - Can follow the cohort sheet’s row format for ease of reuse. 【F:src/AdminSheet/Sheets/CohortAnalysisSheetManager.js†L171-L204】

## Draft API service helpers (front-end)

Below is a minimal client service layer suitable for a React app hosted in Apps Script HTML service or an external web app. It supports an auth token, request timeouts, and basic rate limiting to avoid timeouts.

```ts
// api/client.ts
const DEFAULT_TIMEOUT_MS = 20000;

export type ApiConfig = {
  baseUrl: string;
  authToken: string;
  timeoutMs?: number;
  maxInFlight?: number;
};

export class ApiClient {
  private baseUrl: string;
  private authToken: string;
  private timeoutMs: number;
  private maxInFlight: number;
  private inFlight = 0;
  private queue: Array<() => void> = [];

  constructor(config: ApiConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.authToken = config.authToken;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxInFlight = config.maxInFlight ?? 3;
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const run = () => {
        this.inFlight += 1;
        fn()
          .then(resolve, reject)
          .finally(() => {
            this.inFlight -= 1;
            const next = this.queue.shift();
            if (next) next();
          });
      };

      if (this.inFlight < this.maxInFlight) run();
      else this.queue.push(run);
    });
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    return this.enqueue(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await fetch(`${this.baseUrl}${path}`.replace(/\/\//g, '/'), {
          ...init,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': this.authToken,
            ...(init?.headers ?? {}),
          },
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`API error ${res.status}: ${errorText}`);
        }

        return (await res.json()) as T;
      } finally {
        clearTimeout(timeout);
      }
    });
  }

  getClasses() {
    return this.request('/classes?hydration=partial');
  }

  getClass(classId: string) {
    return this.request(`/classes/${classId}?hydration=partial`);
  }

  getAssignment(classId: string, assignmentId: string) {
    return this.request(`/classes/${classId}/assignments/${assignmentId}?hydration=full`);
  }

  getOverview(yearGroup?: string | number) {
    const query = yearGroup ? `?yearGroup=${encodeURIComponent(yearGroup)}` : '';
    return this.request(`/overview${query}`);
  }

  listRuns() {
    return this.request('/assessments/runs');
  }

  getRun(runId: string) {
    return this.request(`/assessments/runs/${runId}`);
  }

  startRun(payload: { classId: string; assignmentId: string; definitionKey?: string }) {
    return this.request('/assessments/runs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}
```

### Security and rate-limiting considerations

- **Authenticated access**: the web app should require a token tied to the executing user (for example, a signed token stored in Script Properties or passed via a one-time bootstrap flow). Only the current user’s token should authorise access.
- **User identity**: the server should validate that the token maps to the active user and reject requests otherwise.
- **Rate limiting**: throttle per-user requests server-side and queue client-side (as above) to avoid Apps Script timeouts.
- **Hydration control**: default list views to `hydration=partial` to keep payloads small and avoid heavy Drive calls. 【F:docs/developer/DATA_SHAPES.md†L31-L42】

## Hosting options for the React front end

Below is a balanced comparison of hosting the UI within Apps Script HTML service versus hosting it externally (e.g., static hosting). This is intended to help decide the deployment approach and the trade-offs you highlighted around supply chain risk, ease of updates, and IP control.

### Option A: Host inside Apps Script (HTML service)

**Pros**

- **Reduced supply chain surface**: the HTML/JS is packaged inside the Apps Script project, so you are not fetching front-end code at runtime from third-party hosts. This matches your security instinct around tampering risk.
- **Simpler auth handshake**: the UI and API live together, so you can bootstrap the auth token via server-rendered HTML without exposing extra endpoints.
- **Single deployment target**: versioning and rollbacks are tied to script versions and deployments.

**Cons**

- **Slower iteration**: redeploying the Apps Script project is heavier than pushing a static build, which slows rapid UI changes.
- **Tooling limits**: Apps Script HTML service imposes constraints (bundling, asset sizes, CSP quirks) and can be awkward for modern React tooling without a build step.
- **Performance**: Apps Script web apps are not optimised as a CDN, so assets may load slower for users on different networks.

### Option B: Host externally (static site + Apps Script API)

**Pros**

- **Fast UI updates**: you can deploy a new build quickly without updating the Apps Script deployment.
- **Better front-end tooling**: easier to use modern bundlers, code splitting, and performance optimisations.
- **IP control**: you can obfuscate/minify the front-end build and keep the source repo separate from the Apps Script project.

**Cons**

- **Supply chain risk**: external hosting adds a dependency surface (hosting provider, CI/CD pipeline, DNS). This can be mitigated but not eliminated.
- **Auth complexity**: you need a secure bootstrap for user-specific tokens and to prevent token leakage (e.g., short-lived tokens, domain allowlists, strict CORS).
- **More moving parts**: two deployments and separate monitoring/logging paths.

### Recommendation (balanced)

Given your security posture and concern about supply chain risk, a pragmatic default is **hosting inside Apps Script for early releases**, then consider external hosting if the UI needs rapid iteration or heavier assets. If you do go external, keep risk down by:

- Using a locked-down hosting provider with signed artefact deployments.
- Issuing short-lived, per-user tokens from the Apps Script backend.
- Limiting CORS to known origins and auditing token usage.

### External CDN authentication and integrity notes

If you host the React app externally (e.g., a CDN or static site) and keep Apps Script as the API backend, authentication and integrity become the main design concerns.

#### How authentication typically works

- **Front end**: the externally hosted app does _not_ hold any long-lived secret. It requests a short‑lived session token from Apps Script after the user proves identity. Tokens are then used on each API call (e.g., `X-Auth-Token` header).
- **Backend**: Apps Script validates the token, confirms the active user matches the token owner, and enforces per-user rate limits before servicing the request.

#### Integrity of the downloaded UI

If you are concerned about tampering of the external UI itself, there are two common mitigations:

- **Signed artefact delivery**: CI signs the build artefacts; the hosting platform only serves signed files. This prevents arbitrary code replacement in the CDN.
- **Subresource Integrity (SRI)**: if you use a minimal bootstrap HTML hosted in Apps Script (or another trusted source), you can include SRI hashes for the external JS bundles. The browser will refuse to load files that do not match the expected hash.

In practice, SRI is most effective when the HTML that references the bundle is itself trusted and version‑locked, otherwise the hash can be altered alongside the file. That is why an Apps Script‑hosted “bootstrap shell” (tiny HTML) is a reasonable compromise: the shell is trusted, but the heavy assets are fetched externally with SRI.

#### OAuth constraints in restricted institutions

If OAuth approvals for external apps are heavily restricted, the viability of external hosting depends on whether you can still **use Apps Script as the authority**:

- **Best case**: use Apps Script’s built‑in user context (i.e., the executing user) to mint short‑lived session tokens and do not require external OAuth at all. The user opens the app via the Apps Script web app URL, the script verifies the user, then redirects or bootstraps the external UI with a token.
- **If external OAuth is blocked**: avoid third‑party identity providers. Use Apps Script’s own identity context or a whitelisted internal IdP if one exists.

#### Username/password authentication viability

Username/password can be used, but it is generally **less desirable** and comes with additional operational risk:

- **Security risk**: you must store password hashes and implement password reset, lockout, and MFA policies. This is non‑trivial and often banned by institutional policy.
- **Support burden**: account lifecycle management becomes your responsibility (provisioning, forgotten passwords, access revocation).
- **Compliance risk**: some institutions explicitly disallow bespoke password systems for staff data tools.

If OAuth is unavailable, a safer alternative is often **institution-managed login** (SSO or directory) or **Apps Script user context** with token‑based sessions, which avoid storing passwords entirely.

#### Paywalling with short-lived tokens

If you want to restrict usage to paid subscribers (or account holders), you can still use short‑lived tokens, but the backend must **link each token to a user identity and subscription status**.

Recommended pattern:

- **Token minting step**: when the user signs in (or the Apps Script web app confirms the executing user), the backend creates a token that includes:
  - `userId` (or email),
  - `issuedAt`, `expiresAt`,
  - a token `id` (nonce),
  - and optional `plan`/`entitlement` claims.
- **Token store**: keep a lightweight token registry (e.g., Script Properties or JsonDbApp) mapping `tokenId -> userId` with expiry.
- **Subscription check**: on every request, validate:
  1. token signature and expiry,
  2. token registry lookup for `tokenId`,
  3. user entitlements (subscription state) before returning data.

This ensures each token is tied to a specific user. The backend identifies the user via the token’s `userId` claim or the registry lookup, then verifies subscription status (e.g., `active`, `trial`, `expired`) before serving requests.

**Important:** the `userId` is **never** accepted from the client. It is derived from the authenticated server context (e.g., the Apps Script executing user) and embedded into a **server-signed** token. A user cannot simply claim another user’s ID because they cannot forge the signature or register a token for that user in the backend token registry.

If you later move to a payment provider, the same model works: the subscription state can be pulled from your billing system and cached in Apps Script/JsonDbApp, but the access gate remains the token‑to‑user mapping plus entitlement check.

### CDN hosting options: self-hosted vs commercial

If you decide to host the UI externally, you can either self‑host (e.g., a small container on Google Cloud) or use a commercial static hosting/CDN platform.

#### Self-hosted (e.g., Google Cloud Run + Cloud CDN or a VM)

**Pros**

- Full control over the runtime and deployment pipeline.
- Easier to keep everything within your institutional cloud boundary.
- Can integrate directly with existing network policies (IP allowlists, VPCs).

**Cons**

- You own patching, scaling, TLS, and incident response.
- Typically slower to set up a safe deployment pipeline (signing, rollbacks, observability).
- You still need a CDN layer if you care about global performance.

#### Commercial static hosting/CDN (e.g., managed static hosting)

**Pros**

- Fast, reliable global CDN delivery with minimal ops overhead.
- Straightforward deployment pipelines and rollbacks.
- Often supports artefact signing and integrity controls out of the box.

**Cons**

- Additional supply‑chain surface (provider + CI/CD).
- Harder to fit into strict institutional network policies if external providers are restricted.
- Vendor lock‑in concerns if you lean on provider‑specific features.

#### Recommendation (pragmatic)

If your institution is cautious about external services, **self‑hosting inside your cloud boundary** (e.g., Cloud Run + Cloud CDN) is usually the safer starting point. If you need rapid iteration and low ops burden, a managed static host can be a good fit _provided_ it passes your institution’s supplier checks and you enforce signed artefacts + strict CORS.

## Next steps

- Define the final API contract in Apps Script (`doGet`, `doPost`) and align it to the endpoint list above.
- Decide whether the React app is hosted inside Apps Script HTML service or externally (affects auth handoff and deployment).
- Confirm the required overview aggregates and whether they are computed on demand or cached.
