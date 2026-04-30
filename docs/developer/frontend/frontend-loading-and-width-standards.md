# Frontend Loading and Width Standards

This is the canonical long-lived standards document for frontend loading presentation, short-running mutation feedback, and page and panel width ownership in `src/frontend`.

Use it alongside:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `docs/developer/frontend/frontend-logging-and-error-handling.md`
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md`

## 1. Scope

- Applies to all active frontend surfaces in `src/frontend`, including pages, tab contents, panels, card-like surfaces, table cards, dialogs, and comparable owned regions.
- Applies to initial blocking load, background refresh, required-data degradation, and short-running mutations.
- Does not redesign long-running write workflows or background-job progress tracking.

## 2. Owned-surface terminology

### 2.1 Owned surface

- The owned surface is the smallest UI region that owns its own readiness, refresh feedback, mutation boundary, and width choice.
- An owned subregion may follow these rules independently while the wider panel remains ready.

### 2.2 Blocking-state treatment

- The blocking-state treatment is the standard fail-closed UI for the affected owned region.
- By default, reuse the standard blocking-error primitive for that region.
- Unless a stronger documented UX case exists, that primitive should be an Ant Design `Alert` rendered in the affected owned region.

### 2.3 Outer frame and inner panel

- Outer page and tab surfaces own outer-frame width.
- Inner panels, cards, and comparable containers own panel-width choice inside that frame.
- Page-width ownership and panel-width ownership are separate concerns and must stay separate in implementation.

## 3. Initial blocking load rules

- If an owned surface has no usable data yet and cannot render meaningful content, render a shape-matched skeleton in the exact region where the content will appear.
- Do not swap that state for a generic spinner or placeholder sentence when a meaningful skeleton shape exists.
- Hide ready-state content and controls that depend on unavailable data until the data becomes usable.
- If data was prefetched and is already usable, enter the ready state instead of forcing a skeleton for visual symmetry.

## 4. Background-refresh rules

- Once usable data is visible, keep it visible during refresh.
- Show a localised busy affordance in the relevant surface chrome, such as a card header, toolbar, or section heading.
- Scope refresh feedback to the smallest affected owned surface or owned subregion by default.
- Bubble refresh feedback up to whole-panel chrome only when the panel primary content region is refreshing or the refresh invalidates the whole panel context.
- Do not fall back to a full skeleton or whole-surface replacement spinner unless the surface becomes non-usable.
- Do not reset selection, filters, or other user context unless the refreshed data invalidates that context.

## 5. Fail-closed degraded-data rules

- If required data for an owned region is known-invalid, known-incomplete, refresh-invalidated, or otherwise untrustworthy, suppress the normal content for that region by default.
- Show the blocking-state treatment for that region instead of visible degraded-ready content.
- Keep wider surrounding regions visible only when they remain independently usable and trustworthy.
- Query-library staleness or ordinary refetch eligibility alone does not make data degraded and does not trigger fail-closed behaviour.

## 6. Short-running mutation rules

### 6.1 Modal mutations

- Keep the existing modal confirm-loading pattern.
- The primary action shows loading while the mutation is in flight.
- Disable cancel or competing actions when retrying would be confusing or could duplicate writes.

### 6.2 Non-modal mutations

- The primary triggering action shows loading while the mutation is in flight.
- Disable conflicting write triggers on the same owned surface until the mutation settles.
- Keep read-only interactions available by default unless leaving them enabled would be unsafe, misleading, or technically unstable.
- For table-heavy surfaces, freeze row selection once the mutation target snapshot is taken.
- Sort and filter controls may remain available by default.
- Treat unrelated write launchers elsewhere on the page as outside the default conflict boundary unless they operate on the same owned dataset workflow.
- Re-enable controls promptly when the mutation settles.

## 7. Width-token ownership rules

- Shared CSS custom properties in the frontend styling layer are the authoritative source of truth for app-specific page and panel widths.
- The baseline shared width-token set is:
  - `--app-page-width-default`
  - `--app-page-width-wide-data`
  - `--app-panel-width-default`
  - `--app-panel-width-wide-data`
- The approved shared modal-width exception token set is:
  - `--app-modal-width-wide-data`
- Page and tab containers consume page-width tokens for outer-frame sizing.
- Inner panels, standalone cards, and comparable owned containers consume panel-width tokens inside that frame.
- Modal surfaces should keep default component width behaviour unless a workflow has a clear wide-data requirement that uses the approved shared modal-width exception token.
- Named exceptions must stay centralised, be few in number, and be named by intent rather than by feature.
- Prefer the default panel width unless there is a clear data-density or workflow reason to use an approved exception width.
- Do not duplicate raw width literals across feature code or CSS.
- Do not move app-specific page or panel widths into `ConfigProvider.theme` unless the width belongs to a documented Ant Design token contract.
- The Settings page keeps a stable outer width across tabs; narrower inner panels may sit centred inside that stable frame.

## 8. Accessibility semantics

- Initial blocking load must expose accessible loading semantics, such as a labelled `role="status"` region while the skeleton is present.
- Background refresh must mark the affected region busy, for example with `aria-busy="true"`, and pair that with visible refresh feedback that includes accessible text.
- Mutation loading and disabled states must remain programmatically exposed through the relevant control semantics.
- Visual affordances alone are not sufficient.

## 9. Related docs

- React Query cache, freshness, and prefetch policy: `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- Frontend logging, blocking errors, and user-safe failure handling: `docs/developer/frontend/frontend-logging-and-error-handling.md`
- Shell layout, navigation, and motion conventions: `docs/developer/frontend/frontend-shell-navigation-and-motion.md`
