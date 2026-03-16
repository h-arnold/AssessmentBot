# Feature Delivery Plan (TDD-First)

## Scope and assumptions

### Scope

- Add React Query as the shared frontend server-state and pre-fetch mechanism for slow/shared datasets, especially `JsonDbApp`-backed reads.
- Cover provider setup, query-key conventions, startup warm-up integration, and the first shared query definitions.
- Cover the minimum auth-boundary refactor needed to expose resolved authorisation state to app-level warm-up orchestration without duplicating auth transport calls.
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
3. Failures should be visible to the consuming hook/component and logged through existing frontend logging policy.
4. The first datasets to register with shared query keys are `classPartials`, `cohorts`, and `yearGroups`.
5. Only `classPartials` will be prefetched on app startup in this phase.
6. Active consumers should keep stale data visible while a background refresh runs.
7. Background pre-fetch failures should be logged only for now, while leaving room for future Ant Design notification integration.
8. `ABClass`-driven invalidation will require a later backend-supported update notification mechanism and is not implemented in this phase.
9. Startup warm-up must be safe under React `StrictMode` development remount behaviour and must avoid duplicate network work or duplicate background-error noise.
10. Startup warm-up must only run after the existing auth flow has confirmed the user is authorised; it must not run while auth is unresolved or when the user is unauthorised.
11. The frontend session must use one stable shared `QueryClient` instance so cached and in-flight query state survives provider re-renders and development remounts.
12. The existing auth status flow may need to move behind a shared app-level boundary so warm-up orchestration can observe resolved authorisation state without issuing a second auth request.
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
- Shared query definitions must throw transport/schema errors without logging them; background startup warm-up owns one-time logging for its own failures.
- Page-level query consumers outside startup warm-up should continue to surface failures through normal React Query result state and existing feature-level UI mapping; this phase does not introduce a second global logging layer for those failures.
- Startup warm-up may use `fetchQuery` rather than `prefetchQuery` so the orchestration boundary can observe rejected promises, but that warm-up call must still be launched in a non-blocking way from the app lifecycle.

### TDD workflow (mandatory per section)

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
- A dedicated provider wrapper file exists and is imported by `App.tsx`.
- A shared query-key convention exists for `classPartials`, `cohorts`, and `yearGroups`, exposed through shared factory helpers.
- Default query behaviour is explicit: non-zero `staleTime`, session-memory `gcTime`, `retry` off, `refetchOnWindowFocus` off, `refetchOnReconnect` off, and `refetchOnMount` only when stale.
- The shared `QueryClient` instance is stable for the lifetime of the frontend session and is not recreated on provider re-render or React `StrictMode` development remount.
- The shared `QueryClient` instance is created once from a dedicated top-level owner such as module scope or a single `useState` initialiser in the provider wrapper.
- The provider placement keeps `App.tsx` thin while treating React Query as a first-class application concern.
- `@tanstack/react-query` is pinned to `5.90.21`, not a floating `latest` or caret range.

### Required test cases (Red first)

Frontend tests:

1. The dedicated provider wrapper renders children inside `QueryClientProvider`.
2. `App.tsx` composes the provider wrapper without taking on service orchestration.
3. Shared query-key factory helpers produce the expected keys for `classPartials`, `cohorts`, and `yearGroups`.
4. Query-client defaults match the agreed baseline behaviour.
5. The app wrapper reuses one stable `QueryClient` instance across provider re-renders/remounts.
6. The shared `QueryClient` owner is not recreated when the provider wrapper re-renders.

### Section checks

- `npm run frontend:test -- src/App.spec.tsx`
- `npm run frontend:test -- src/**/*.query*.spec.ts*`
- `npm run frontend:lint`

### Implementation notes / deviations / follow-up

- **Implementation notes:** place the provider in its own file and import it through `App.tsx`.
- **Deviations from plan:** React Query replaces the bespoke registry/coordinator design.
- **Follow-up implications for later sections:** later sections must consume the shared query keys and query client rather than inventing parallel cache abstractions.

---

## Section 2 — Define the initial shared queries and startup pre-fetch policy

### Objective

- Define the first shared query options and wire startup prefetch for the agreed dataset.
- This section defines shared query contracts and prefetch helpers only; app-start orchestration belongs to Section 3.
- Keep the startup warm-up entrypoint abstract enough that Section 3 can use the React Query API that best fits the agreed background error-handling contract.

### Constraints

- Keep the initial query set explicit.
- Only `classPartials` is prefetched on startup in this phase.
- Query functions must continue to delegate to existing frontend service modules.
- Shared query definitions and prefetch helpers must not call backend transport directly; they must go through service modules that already use `callApi`/`apiHandler`.
- Add runtime validation for `classPartials` before its data is cached and shared across consumers.
- Reuse the existing validated `referenceDataService` loaders for `cohorts` and `yearGroups`; do not add duplicate schema layers for those datasets.
- The startup warm-up helper must use `fetchQuery` so rejected promises reach the app-level orchestration boundary for one-time startup failure logging.
- The startup warm-up helper must remain non-blocking: callers may observe completion for logging/tests, but the app render path must not await it.

### Acceptance criteria

- Shared query definitions exist for `classPartials`, `cohorts`, and `yearGroups`.
- The `classPartials` query delegates to the existing class-partials service loader.
- `classPartials` response data is validated through a dedicated Zod schema before being cached.
- The `cohorts` and `yearGroups` shared queries delegate to the existing `referenceDataService` loaders and reuse their current validated response contracts.
- All shared queries preserve the existing `callApi`/`apiHandler` transport path and its envelope parsing and validation behaviour.
- A shared startup warm-up helper exists for `classPartials` only in this phase.
- The startup warm-up helper uses `fetchQuery` so Section 3 can both reuse React Query caching/deduplication and handle startup failures at the orchestration boundary.
- The startup warm-up helper is triggered in a fire-and-forget manner from the app lifecycle so startup remains non-blocking even though failures still reject to the orchestration boundary.
- Repeated startup/view access to the same query reuses React Query caching and in-flight deduplication.
- Shared query definitions do not log failures directly.

### Required test cases (Red first)

Frontend tests:

1. The shared `classPartials` query function delegates to the expected service loader.
2. The shared `classPartials` query path rejects malformed backend payloads via the dedicated schema.
3. The shared `cohorts` and `yearGroups` query definitions delegate to the existing `referenceDataService` loaders.
4. The `classPartials` startup warm-up helper requests the shared `classPartials` query key through the shared helper contract.
5. Shared query definitions propagate failures without direct logging.
6. The startup warm-up helper propagates failures to its caller so Section 3 can own background failure logging.
7. The startup warm-up helper can be invoked without awaiting it and does not force the caller to block render or navigation.

### Section checks

- `npm run frontend:test -- src/**/*query*.spec.ts*`
- `npm run frontend:lint`

### Implementation notes / deviations / follow-up

- **Implementation notes:** use React Query query options/helpers instead of module-local cache maps.
- **Implementation notes:** add a dedicated `classPartials` Zod schema file and derive its TypeScript types from the schema where practical.
- **Implementation notes:** keep `cohorts` and `yearGroups` as thin React Query wrappers over the existing validated reference-data services.
- **Deviations from plan:** React Query handles caching and in-flight deduplication, so bespoke coordinator APIs are no longer required.
- **Follow-up implications for later sections:** future feature hooks should consume React Query hooks or shared query wrappers rather than custom effect-based loaders.

---

## Section 3 — Add the app-level startup pre-fetch integration

### Objective

- Trigger agreed startup warm-up from a dedicated app-level boundary without bloating `App.tsx`.
- This section owns app-start orchestration for warm-up; query definitions and prefetch helpers are already defined in Section 2.

### Constraints

- `App.tsx` remains a thin composition root.
- React Query infrastructure should live in dedicated wrapper/hook files, not in `App.tsx` itself.
- Startup warm-up must remain background-only.
- Startup warm-up must remain non-blocking even though it uses `fetchQuery` for error visibility.
- Startup warm-up must be idempotent under React `StrictMode` development remounts.
- Startup warm-up must only run after the existing auth flow confirms the user is authorised.
- The warm-up boundary must reuse the shared stable `QueryClient` instance rather than creating its own client state.
- Background warm-up is the only place in this phase that logs startup prefetch failures.
- The app-level auth boundary must expose resolved authorisation state to warm-up orchestration without duplicating the existing auth transport request.

### Acceptance criteria

- A dedicated startup warm-up component or hook exists outside `App.tsx`.
- `App.tsx` imports the provider/wrapper composition only.
- Startup warm-up does not run while auth is unresolved and does not run when the user is unauthorised.
- The existing auth flow is refactored, if needed, so app-level warm-up can observe resolved authorisation state without introducing a duplicate auth request.
- `classPartials` warm-up is implemented in a way that remains safe under React `StrictMode` development remount behaviour.
- Startup warm-up is scheduled in a fire-and-forget manner and does not block initial render, shell paint, or navigation readiness.
- Startup warm-up logs its own background prefetch failures once through the existing frontend logger and does not turn them into uncaught render failures.
- Warm-up remains compatible with later page-level consumers of the same query.

### Required test cases (Red first)

Frontend tests:

1. The startup warm-up boundary calls the shared React Query startup warm-up path for `classPartials`.
2. Startup warm-up does not run before auth success and does not run for unauthorised sessions.
3. The app-level auth boundary exposes one resolved authorisation result that can be consumed by both the auth UI and the startup warm-up gate without a second auth transport call.
4. Warm-up remains idempotent under development-style remounting and does not create duplicate network work or duplicate background-error logging.
5. Startup warm-up does not block initial render or navigation even though the helper uses `fetchQuery`.
6. A startup warm-up failure is logged through the existing frontend logger and does not surface as an uncaught render failure.
7. A later consumer of the same query can reuse the prefetched or in-flight result.

### Section checks

- `npm run frontend:test -- src/App.spec.tsx`
- `npm run frontend:test -- src/**/*query*.spec.ts*`
- `npm run frontend:lint`

### Implementation notes / deviations / follow-up

- **Implementation notes:** keep startup warm-up implementation close to the new React Query app wrapper.
- **Implementation notes:** extend the shared app transport mock helpers so app-level tests can support both the existing auth request and startup prefetch requests without brittle per-test rewiring.
- **Implementation notes:** introduce the smallest shared auth boundary needed so both the auth UI and startup warm-up can consume one resolved authorisation result.
- **Implementation notes:** auth-gate warm-up through that shared frontend auth state rather than duplicating auth transport calls.
- **Implementation notes:** keep logging at the warm-up orchestration boundary rather than inside the shared query definitions.
- **Implementation notes:** use `fetchQuery` for startup warm-up so the orchestration boundary can catch and log failures explicitly.
- **Implementation notes:** launch startup warm-up from an effect or equivalent non-blocking lifecycle boundary; do not await it during render or shell composition.
- **Deviations from plan:** this section no longer introduces a bespoke consumer hook because React Query becomes the consumer contract.
- **Follow-up implications for later sections:** when real screens adopt shared server-state, use query hooks rather than new hand-rolled loading hooks.

---

## Section 4 — Prepare the invalidation and freshness contract for later feature migration

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

### Required test cases (Red first)

Frontend tests:

1. Query-key factory helpers remain stable for future invalidation use.
2. Any shared query wrapper documents or encodes stale-while-refresh behaviour without forcing eager refetch on mount/focus/reconnect.

### Section checks

- `npm run frontend:test -- src/**/*query*.spec.ts*`
- `npm run frontend:lint`

### Implementation notes / deviations / follow-up

- **Implementation notes:** record the invalidation matrix even where implementation is deferred.
- **Deviations from plan:** future invalidation work depends on later UI migration and backend support for `ABClass` update signals.
- **Follow-up implications for later sections:** view-level prefetch and invalidation should be decided per feature as new screens are built.

---

## Section 5 — Investigate immediate migration needs and leave the extension points ready

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

## Section 6 — Documentation and rollout notes

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
2. Section 2: initial shared query definitions and `classPartials` startup prefetch policy.
3. Section 3: app-level startup warm-up integration.
4. Section 4: freshness and invalidation contract for later feature migration.
5. Section 5: investigate immediate migration needs and leave extension points ready.
6. Section 6: documentation and rollout notes.
7. Regression and contract hardening.
