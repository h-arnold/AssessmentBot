# Feature Delivery Plan (TDD-First)

## Scope and assumptions

### Scope

- Add React Query as the shared frontend server-state and pre-fetch mechanism for slow/shared datasets, especially `JsonDbApp`-backed reads.
- Cover provider setup, query-key conventions, startup warm-up integration, and the first shared query definitions.
- Cover the minimum auth-query refactor needed to move the existing authorisation flow behind shared React Query state and expose it through a thin auth hook/gate without duplicating auth transport calls.
- Include unit/component test coverage for query-client wiring, startup prefetch orchestration, and background error handling.
- Pin `@tanstack/react-query` to `5.90.21` rather than using a loose range.

### Out of scope

- No persistent browser cache (`localStorage`, IndexedDB, service worker).
- No backend API changes.
- No speculative pre-fetch for every endpoint; only explicitly registered slow/shared datasets.
- No direct service calls from `src/frontend/src/App.tsx`.
- No frontend mutation-driven invalidation for `ABClass` updates in this phase.
- No pre-fetch policy decisions for future features beyond the explicitly agreed initial dataset.

### Assumptions

1. Pre-fetch should run in the background by default and must not block initial render or navigation.
2. Cache lifetime is in-memory only for the current app session.
3. Failures should be visible to the consuming hook/component, while `warn`/`error` logging stays at the transport boundary and any warm-up-specific diagnostics stay `debug`-only.
4. The first datasets to register with shared query keys are `classPartials`, `cohorts`, and `yearGroups`.
5. Only `classPartials` will be prefetched on app startup in this phase.
6. Active consumers should keep stale data visible while a background refresh runs.
7. Background pre-fetch failures should attach orchestration context for tests at `debug` level only for now, while leaving room for future Ant Design notification integration.
8. `ABClass`-driven invalidation will require a later backend-supported update notification mechanism and is not implemented in this phase.
9. Startup warm-up must be safe under React `StrictMode` development remount behaviour and must avoid duplicate network work or duplicate background-error noise.
10. Startup warm-up must only run after the existing auth flow has confirmed the user is authorised; it must not run while auth is unresolved or when the user is unauthorised.
11. The frontend session must use one stable shared `QueryClient` instance so cached and in-flight query state survives provider re-renders and development remounts.
12. The existing auth status flow needs to move behind a shared React Query-backed query/hook before any startup pre-fetch work so warm-up orchestration can observe resolved authorisation state without issuing a second auth request.
13. Even when startup warm-up uses a rejecting query-client API for failure handling, the warm-up trigger itself must remain fire-and-forget from the render path and must not delay initial paint, shell composition, or navigation readiness.

---

## Global constraints and quality gates

### Engineering constraints

- Keep orchestration in frontend hooks/services, consistent with `src/frontend/AGENTS.md`.
- Keep transport calls inside existing service modules; the pre-fetch layer must not call `google.script.run` directly.
- All frontend server-state calls must continue to flow through `apiHandler` via `callApi`, preserving the existing request/response envelope handling, retry policy, and transport validation boundary.
- Route shared server-state behaviour through React Query primitives rather than a bespoke cache coordinator.
- Establish one shared query-key convention now using shared factory helpers and document it for future work.
- Keep changes minimal, typed, and localised.
- Use British English in comments/docs.
- Do not add production code purely to satisfy tests.
- Keep cache persistence explicitly out of scope and document that cached frontend data remains in memory only for the current session.
- Shared query definitions must throw transport/schema errors without adding extra logging; transport-level logging in `callApi` remains the source of truth for failures in this phase.
- Page-level query consumers outside startup warm-up should continue to surface failures through normal React Query result state and existing feature-level UI mapping; this phase does not introduce a second global logging layer for those failures.
- Shared query consumers must not re-log transport/query failures that `callApi` has already logged; they should map failures to user-safe UI state only.
- Startup warm-up may use `fetchQuery` rather than `prefetchQuery` so the orchestration boundary can observe rejected promises, but that warm-up call must still be launched in a non-blocking way from the app lifecycle.
- Startup warm-up may emit a single `debug`-level event with orchestration metadata for test visibility, but it must not add a second `warn`/`error` log for the same underlying transport failure.
- Do not add a parallel warm-up state machine or cache coordinator; React Query remains the source of truth for cached data, freshness, and in-flight query deduplication.

### TDD workflow (mandatory per implementation section)

1. Red: add the failing tests for the section only.
2. Green: implement the smallest change needed to pass.
3. Refactor: tidy names/types without expanding scope.
4. Run the section verification command before moving on.

### Validation commands hierarchy

- Frontend targeted unit tests: `npm run frontend:test -- <pattern>`
- Frontend full unit suite: `npm run frontend:test`
- Frontend lint: `npm run frontend:lint`
- Frontend coverage gate: `npm run frontend:test:coverage`
- Frontend E2E only if navigation/loading UX becomes visibly user-facing: `npm run frontend:test:e2e -- <pattern>`

---

## Section 1 — Establish the React Query foundation and query-key contract

### Objective

- Establish the shared React Query foundation so the rest of the implementation has a stable, explicit server-state contract.

### Constraints

- Keep the initial query list explicit and finite.
- Query functions must reference existing frontend services, not raw transport calls.
- Query functions must not bypass `callApi`; all backend access must continue through the existing `apiHandler` transport boundary.
- Set the initial React Query defaults now, while keeping them easy to adjust later.

### Acceptance criteria

- A shared `QueryClient` factory/configuration exists.
- A dedicated provider wrapper file exists and is composed from `main.tsx`.
- A shared query-key convention exists for `classPartials`, `cohorts`, and `yearGroups`, exposed through shared factory helpers.
- Default query behaviour is explicit: non-zero `staleTime`, session-memory `gcTime`, `retry` off, `refetchOnWindowFocus` off, `refetchOnReconnect` off, and `refetchOnMount` only when stale.
- The shared `QueryClient` instance is stable for the lifetime of the frontend session and is not recreated on provider re-render or React `StrictMode` development remount.
- The shared `QueryClient` instance is created once from a dedicated module-scope owner and imported where needed as the frontend singleton query client.
- The provider placement keeps `App.tsx` thin while treating React Query as a first-class application concern.
- `@tanstack/react-query` is pinned to `5.90.21`, not a floating `latest` or caret range.

### Required test cases (Red first)

Frontend tests:

1. The dedicated provider wrapper renders children inside `QueryClientProvider`.
2. `main.tsx` composes the provider wrapper while `App.tsx` stays free of provider and service orchestration.
3. Shared query-key factory helpers produce the expected keys for `classPartials`, `cohorts`, and `yearGroups`.
4. Query-client defaults match the agreed baseline behaviour.
5. The app wrapper reuses one stable module-scoped `QueryClient` instance across provider re-renders/remounts.
6. Importing the shared query-client module multiple times resolves to the same singleton instance.

### Section checks

- `npm run frontend:test -- src/main.spec.tsx`
- `npm run frontend:test -- src/**/*.query*.spec.ts*`
- `npm run frontend:lint`

### Implementation notes / deviations / follow-up

- **Implementation notes:** place the provider in its own file and compose it from `main.tsx`.
- **Implementation notes:** keep the singleton `QueryClient` in module scope rather than behind a component-level `useState` initialiser so development `StrictMode` cannot create throwaway clients during double-invocation.
- **Deviations from plan:** React Query replaces the bespoke registry/coordinator design.
- **Follow-up implications for later sections:** later sections must consume the shared query keys and query client rather than inventing parallel cache abstractions.

---

## Section 2 — Refactor authorisation into a shared auth query and hook

### Objective

- Move the existing authorisation flow behind a shared React Query-backed auth query before any startup pre-fetch work begins.
- Expose one resolved authorisation result through a shared auth hook that can be consumed by both the auth UI and later startup warm-up orchestration.

### Constraints

- This section must complete before any startup pre-fetch integration work starts.
- Keep `App.tsx` as a thin composition root.
- Reuse the existing `authService` transport path; do not add a second auth transport request.
- Preserve the current user-facing auth-state contract while moving state ownership behind shared query-backed app state.
- Keep auth failure mapping user-safe and deterministic.
- Avoid introducing startup pre-fetch logic in this section.
- Do not introduce a second auth-specific provider if the shared query client and hook are sufficient.

### Acceptance criteria

- A shared auth query definition exists for the existing authorisation status request.
- A shared auth hook exposes resolved auth state to consumers.
- The auth UI consumes the shared auth result rather than issuing its own isolated effect-driven request.
- The refactor does not introduce a second auth transport call.
- Auth failures continue to map to the existing user-safe copy.
- `App.tsx` remains free of auth orchestration details.
- This section leaves a clear extension point for a later auth gate without introducing a dedicated auth provider.

### Required test cases (Red first)

Frontend tests:

1. The shared auth query delegates to the existing auth service loader.
2. The shared auth hook exposes one resolved authorisation result to consumers.
3. The auth UI consumes shared auth state without triggering a second auth transport call.
4. Authorised, unauthorised, and failure states preserve the existing user-facing behaviour.
5. `App.tsx` remains a thin composition root after the refactor.

### Section checks

- `npm run frontend:test -- src/App.spec.tsx`
- `npm run frontend:test -- src/main.spec.tsx`
- `npm run frontend:test -- src/**/*auth*.spec.ts*`
- `npm run frontend:lint`

### Progress tracking

- [x] RED: tests added for the shared auth query, shared auth hook, auth consumer flow, `App.tsx` composition root, and main-entry query-provider wiring.
- [x] RED: review clean.
- [x] GREEN: implementation complete; production auth composition now satisfies the Section 2 boundary without introducing startup pre-fetch logic.
- [x] GREEN: review clean.
- [x] Checks passed.
- [x] Action plan updated.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Section 2 is complete; treat authorisation as the first shared query-backed app-state concern before adding any pre-fetch orchestration.
- **Implementation notes:** keep the existing auth error mapping contract, but move auth request ownership out of the component-local effect path.
- **Implementation notes:** keep query ownership in the shared auth hook; do not add a separate auth context unless a later requirement cannot be met through the query layer alone.
- **Validation deviation:** the planned glob `src/**/*auth*.spec.ts*` did not match the current file names, so validation used the concrete auth spec `src/features/auth/useAuthorisationStatus.spec.tsx`.
- **Follow-up implications for later sections:** startup warm-up must consume this shared resolved auth state rather than issuing or shadowing another auth request.

---

## Section 3 — Add a thin auth gate for app-level warm-up orchestration

### Objective

- Introduce a thin auth gate that reads the shared auth hook from Section 2 and gives app-level warm-up code access to resolved authorisation state.
- Keep this boundary light-weight and avoid introducing a second app-state layer on top of React Query.

### Constraints

- Reuse the shared auth query/hook from Section 2; do not issue another auth request.
- Keep `App.tsx` as a thin composition root.
- Do not introduce startup pre-fetch logic in this section.
- Do not introduce an auth-specific provider if a component or hook boundary is sufficient.

### Acceptance criteria

- A thin auth gate or boundary exists outside `App.tsx`.
- The auth UI and later warm-up orchestration can both read the same resolved auth result through the shared auth query/hook.
- The gate does not introduce a second auth transport call.
- `App.tsx` remains free of auth orchestration details.
- This section leaves a clear auth-gated extension point for later startup warm-up work.

### Required test cases (Red first)

Frontend tests:

1. The auth gate consumes the shared auth hook/query rather than issuing a second auth request.
2. The auth UI and gate can observe the same resolved authorisation result.
3. The gate preserves the existing authorised, unauthorised, and failure behaviour.
4. `App.tsx` remains a thin composition root after the gate is introduced.

### Section checks

- `npm run frontend:test -- src/App.spec.tsx`
- `npm run frontend:test -- src/main.spec.tsx`
- `npm run frontend:test -- src/**/*auth*.spec.ts*`
- `npm run frontend:lint`

### Progress tracking

- [x] RED: tests added for the thin auth gate boundary, shared auth-result observation, `App.tsx` composition, and main-entry auth-gate composition.
- [x] RED: intended failure captured against current production composition in `main.tsx`.
- [x] GREEN: implementation complete; `main.tsx` now composes `AppAuthGate` outside `App.tsx` while preserving the shared auth boundary.
- [x] GREEN: review clean.
- [x] Checks passed.
- [x] Action plan updated.

### Implementation notes / deviations / follow-up

- **Implementation notes:** prefer a thin component or hook boundary over a dedicated auth provider.
- **Implementation notes:** keep this section focused on composition and shared auth-state access only; startup warm-up begins in the next section.
- **Follow-up implications for later sections:** startup warm-up must read auth state from this gate/query path rather than introducing a parallel auth check.

---

## Section 4 — Define the initial shared data queries and startup warm-up helper contract

### Objective

- Define the first shared data-query options and the startup warm-up helper contract for the agreed dataset.
- This section defines shared query contracts and warm-up helpers only; app-start orchestration belongs to Section 5.
- Keep the startup warm-up entrypoint callable from later app lifecycle code without triggering it here.

### Constraints

- Keep the initial query set explicit.
- Only `classPartials` is prefetched on startup in this phase.
- Query functions must continue to delegate to existing frontend service modules.
- Shared query definitions and prefetch helpers must not call backend transport directly; they must go through service modules that already use `callApi`/`apiHandler`.
- Add runtime validation for `classPartials` before its data is cached and shared across consumers.
- Reuse the existing validated `referenceDataService` loaders for `cohorts` and `yearGroups`; do not add duplicate schema layers for those datasets.
- Put `classPartials` validation at the service boundary using a dedicated adjacent Zod schema file, then have React Query consume the validated service output.
- The startup warm-up helper must use `fetchQuery` so rejected promises reach the later orchestration boundary for controlled handling.
- The startup warm-up helper must be side-effect free apart from the query-client interaction; this section must not wire it into app lifecycle code.
- Do not add a parallel warm-up state machine; reuse React Query cache and in-flight deduplication directly.

### Acceptance criteria

- Shared query definitions exist for `classPartials`, `cohorts`, and `yearGroups`.
- The `classPartials` query delegates to the existing class-partials service loader.
- `classPartials` response data is validated through a dedicated Zod schema before being cached.
- The `cohorts` and `yearGroups` shared queries delegate to the existing `referenceDataService` loaders and reuse their current validated response contracts.
- All shared queries preserve the existing `callApi`/`apiHandler` transport path and its envelope parsing and validation behaviour.
- A shared startup warm-up helper exists for `classPartials` only in this phase.
- The startup warm-up helper uses `fetchQuery` so Section 5 can both reuse React Query caching/deduplication and handle startup failures at the orchestration boundary.
- The startup warm-up helper returns a promise to its caller and is not itself responsible for app lifecycle scheduling.
- Repeated startup/view access to the same query reuses React Query caching and in-flight deduplication.
- Shared query definitions and warm-up helpers do not log failures directly.

### Required test cases (Red first)

Frontend tests:

1. The shared `classPartials` query function delegates to the expected service loader.
2. The shared `classPartials` query path rejects malformed backend payloads via the dedicated schema.
3. The shared `cohorts` and `yearGroups` query definitions delegate to the existing `referenceDataService` loaders.
4. The `classPartials` startup warm-up helper requests the shared `classPartials` query key through the shared helper contract.
5. Shared query definitions propagate failures without direct logging.
6. The startup warm-up helper propagates failures to its caller so Section 5 can own orchestration behaviour.
7. The startup warm-up helper reuses the shared query client and query definition rather than creating a parallel fetch path.
8. Repeated startup warm-up calls reuse the same query client and existing in-flight work instead of introducing a second deduplication layer.

### Section checks

- `npm run frontend:test -- src/**/*query*.spec.ts*`
- `npm run frontend:lint`

### Implementation notes / deviations / follow-up

- **Implementation notes:** use React Query query options/helpers instead of module-local cache maps.
- **Implementation notes:** add a dedicated `classPartials` Zod schema file beside the service module and derive its TypeScript types from the schema where practical.
- **Implementation notes:** keep `cohorts` and `yearGroups` as thin React Query wrappers over the existing validated reference-data services.
- **Deviations from plan:** React Query handles caching and in-flight deduplication, so bespoke coordinator APIs are no longer required.
- **Follow-up implications for later sections:** future feature hooks should consume React Query hooks or shared query wrappers rather than custom effect-based loaders.

---

## Section 5 — Add the app-level startup pre-fetch integration

### Objective

- Trigger agreed startup warm-up from a dedicated app-level boundary without bloating `App.tsx`.
- This section owns app-start orchestration for warm-up; auth state is already shared from Sections 2 and 3 and data-query helpers are already defined in Section 4.

### Constraints

- `App.tsx` remains a thin composition root.
- React Query infrastructure should live in dedicated wrapper/hook files, not in `App.tsx` itself.
- Startup warm-up must remain background-only.
- Startup warm-up must remain non-blocking even though it uses `fetchQuery` for error visibility.
- Startup warm-up must be idempotent under React `StrictMode` development remounts.
- Startup warm-up must only run after the shared auth query confirms the user is authorised.
- The warm-up boundary must reuse the shared stable `QueryClient` instance rather than creating its own client state.
- Background warm-up may emit `debug`-level orchestration context for tests, but must not add a second `warn`/`error` log for an already-logged transport failure.
- The warm-up boundary must consume the resolved shared auth result from Sections 2 and 3 without duplicating the existing auth transport request.
- Do not add a parallel warm-up state machine; if StrictMode-specific duplicate `debug` noise needs suppression, use the smallest possible module-scope guard for logging/orchestration only.

### Acceptance criteria

- A dedicated startup warm-up component or hook exists outside `App.tsx`.
- `main.tsx` owns provider/wrapper composition while `App.tsx` remains a thin shell.
- Startup warm-up does not run while auth is unresolved and does not run when the user is unauthorised.
- The shared auth flow from Sections 2 and 3 is reused so app-level warm-up can observe resolved authorisation state without introducing a duplicate auth request.
- `classPartials` warm-up is implemented in a way that remains safe under React `StrictMode` development remount behaviour.
- Startup warm-up is scheduled in a fire-and-forget manner and does not block initial render, shell paint, or navigation readiness.
- Startup warm-up attaches `debug`-level orchestration context for tests without turning failures into uncaught render failures or adding duplicate higher-severity logs.
- Warm-up remains compatible with later page-level consumers of the same query.
- Repeated lifecycle triggers during one frontend session reuse the shared query client and existing query deduplication so they do not create duplicate startup requests, and any duplicate `debug` logs are suppressed with a minimal orchestration guard only if needed.

### Required test cases (Red first)

Frontend tests:

1. The startup warm-up boundary calls the shared React Query startup warm-up path for `classPartials`.
2. Startup warm-up does not run before auth success and does not run for unauthorised sessions.
3. The shared auth query/hook and auth gate expose one resolved authorisation result that can be consumed by both the auth UI and the startup warm-up gate without a second auth transport call.
4. Warm-up remains idempotent under development-style remounting and does not create duplicate network work or duplicate background-error logging.
5. Startup warm-up does not block initial render or navigation even though the helper uses `fetchQuery`.
6. A startup warm-up failure emits one `debug`-level orchestration event for test visibility and does not surface as an uncaught render failure.
7. A later consumer of the same query can reuse the prefetched or in-flight result.
8. Repeated effect triggers in the same session reuse the shared query client and in-flight query work rather than scheduling duplicate warm-up work.

### Section checks

- `npm run frontend:test -- src/App.spec.tsx`
- `npm run frontend:test -- src/main.spec.tsx`
- `npm run frontend:test -- src/**/*query*.spec.ts*`
- `npm run frontend:lint`

### Progress tracking

- [x] GREEN: startup warm-up remains owned by the dedicated auth-gate boundary outside `App.tsx`, with `main.tsx` composing the provider and gate wrappers.
- [x] GREEN: targeted startup warm-up, auth-gate, and shared-query checks passed.
- [x] Action plan updated.

### Implementation notes / deviations / follow-up

- **Implementation notes:** keep startup warm-up implementation close to the new React Query app wrapper.
- **Implementation notes:** extend the shared app transport mock helpers so app-level tests can support the auth request and startup prefetch requests without brittle per-test rewiring.
- **Implementation notes:** auth-gate warm-up through the shared auth state introduced in Sections 2 and 3 rather than duplicating auth transport calls.
- **Implementation notes:** keep higher-severity logging at the transport boundary; add only test-oriented `debug` context at the warm-up orchestration boundary.
- **Implementation notes:** use `fetchQuery` for startup warm-up so the orchestration boundary can catch failures explicitly and attach `debug` context for tests.
- **Implementation notes:** launch startup warm-up from an effect or equivalent non-blocking lifecycle boundary; do not await it during render or shell composition.
- **Implementation notes:** let React Query own request deduplication; add a tiny module-scope guard only if needed to suppress duplicate `debug`-level warm-up diagnostics under development `StrictMode`.
- **Deviations from plan:** this section no longer introduces a bespoke consumer hook because React Query becomes the consumer contract.
- **Follow-up implications for later sections:** when real screens adopt shared server-state, use query hooks rather than new hand-rolled loading hooks.

---

## Section 6 — Prepare the invalidation and freshness contract for later feature migration

### Objective

- Define how freshness and invalidation should behave as real feature screens migrate to React Query.

### Constraints

- Do not implement `ABClass` invalidation in this phase.
- Keep the future invalidation contract explicit and discoverable.
- Preserve current service contracts while documenting how later query-based consumers should behave.

### Acceptance criteria

- The plan documents that active screens should show stale data while background refresh runs.
- The plan documents that cohort and year-group mutations will invalidate their matching queries once those flows are migrated.
- The plan records that `ABClass` updates need a future backend-supported notifier/update signal before `classPartials` invalidation can be implemented properly.
- The plan documents that startup-prefetch logging belongs to the warm-up orchestration boundary, while shared query definitions remain log-free.
- No speculative invalidation logic is added in this phase.
- No `ABClass` invalidation wiring is introduced in the first pass.

### Required checks

Frontend tests:

1. Query-key factory helpers remain stable for future invalidation use.
2. Any shared query wrapper documents or encodes stale-while-refresh behaviour without forcing eager refetch on mount/focus/reconnect.

### Section checks

- `npm run frontend:lint`

### Implementation notes / deviations / follow-up

- **Implementation notes:** record the invalidation matrix even where implementation is deferred.
- **Deviations from plan:** future invalidation work depends on later UI migration and backend support for `ABClass` update signals.
- **Follow-up implications for later sections:** view-level prefetch and invalidation should be decided per feature as new screens are built.

---

## Section 7 — Investigate immediate migration needs and leave the extension points ready

### Objective

- Confirm whether any existing frontend feature should migrate to React Query immediately and leave the extension points ready if not.

### Constraints

- Do not migrate features speculatively.
- Keep the current shell/navigation implementation simple unless a real consumer needs shared query state now.
- Document where future feature-level prefetch policy decisions should be recorded.

### Acceptance criteria

- Existing frontend features are reviewed for immediate migration need.
- If no current feature benefits materially, no placeholder migration is added just to exercise React Query.
- The plan records that future frontend work must decide per feature whether data should prefetch on startup, on view entry, or on demand.
- The plan records that startup prefetch remains intentionally limited to slow, shared datasets where the latency trade-off is justified.
- No new navigation-side fetching behaviour is introduced in the first pass.

### Required test cases (Red first)

Frontend tests:

1. App and navigation tests remain green after provider and startup warm-up integration.
2. Navigation interactions still do not trigger class-partials warm-up outside the dedicated startup/auth-gated boundary.

### Section checks

- `npm run frontend:test -- src/App.spec.tsx`
- `npm run frontend:test -- src/navigation/appNavigation.spec.tsx`
- `npm run frontend:lint`

### Implementation notes / deviations / follow-up

- **Implementation notes:** treat the lack of an immediate migration as an explicit outcome, not unfinished work.
- **Deviations from plan:** view-entry warm-up is deferred until a real feature view needs it.
- **Follow-up implications for later sections:** when new UI is built for cohorts/year groups or other shared datasets, document the chosen prefetch policy alongside the feature.

---

## Section 8 — Documentation and rollout notes

### Objective

- Update frontend documentation so future work uses React Query and pre-fetch policy decisions consistently.

### Constraints

- Only touch relevant docs.
- Keep AGENTS as a signpost; detailed behaviour belongs in canonical docs if needed.
- Record deferred invalidation and prefetch-policy decisions explicitly.

### Acceptance criteria

- Documentation explains the adopted React Query baseline and shared query-key convention.
- Documentation records that `classPartials` is the only startup-prefetched dataset in this phase.
- Documentation explains that future frontend features must explicitly choose startup prefetch, view-entry prefetch, or on-demand loading.
- Documentation records deferred invalidation expectations for cohort/year-group mutations and the unresolved `ABClass` notifier requirement.
- Documentation records that frontend cache persistence is intentionally not enabled and that cached data remains session-memory only for now because of sensitive student data considerations.

### Required test cases (Red first)

Checks:

1. Update the relevant frontend developer doc if the new pattern becomes a standard.
2. Verify any inline comments use British English.
3. Record deferred enhancements such as notifier-based `ABClass` invalidation and future notification UI integration.

### Section checks

- `npm run frontend:lint`

### Implementation notes / deviations / follow-up

- Likely doc targets: frontend architecture guidance or a new focused React Query usage note if no canonical location exists yet.
- If no canonical doc exists yet, add concise code-level documentation now and defer broader architecture documentation as a follow-up item.
- Record the pinned React Query version (`5.90.21`) and the date/source used to select it (npm registry lookup on 2026-03-16 UTC).

---

## Regression and contract hardening

### Objective

- Confirm the new pre-fetch flow is reliable, typed, and non-regressive across the touched frontend areas.

### Constraints

- Prefer focused runs first, then broader validation.
- Add E2E only if the implementation introduces visible UX states worth browser-level verification.

### Acceptance criteria

- All touched provider, startup warm-up, service, and navigation tests pass.
- Frontend lint passes.
- Frontend coverage remains at or above 85%.
- No duplicate request regressions appear in integration-level unit tests.

### Required test cases/checks

1. Run all new/changed React Query provider, key, and startup warm-up specs.
2. Run touched app/navigation/component specs.
3. Run `npm run frontend:test`.
4. Run `npm run frontend:lint`.
5. Run `npm run frontend:test:coverage`.
6. Run targeted Playwright coverage only if visible loading or navigation behaviour changed.

### Section checks

- `npm run frontend:test`
- `npm run frontend:lint`
- `npm run frontend:test:coverage`

### Implementation notes / deviations / follow-up

- **Implementation notes:** record final query defaults, dataset list, invalidation rules, and deferred enhancements.
- **Deviations from plan:** note any places where React Query integration had to move because of existing app structure.

---

## Suggested implementation order

1. Section 1: React Query foundation, provider wrapper, and query-key contract.
2. Section 2: shared auth-query and hook refactor.
3. Section 3: thin auth gate for later warm-up orchestration.
4. Section 4: initial shared data-query definitions and `classPartials` startup warm-up helper contract.
5. Section 5: app-level startup warm-up integration.
6. Section 6: freshness and invalidation contract for later feature migration.
7. Section 7: investigate immediate migration needs and leave the extension points ready.
8. Section 8: documentation and rollout notes.
9. Regression and contract hardening.
