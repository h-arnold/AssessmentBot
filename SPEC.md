# Frontend Loading-State and Panel-Width Standards Specification

## Status

- Draft v1.0
- Created to define repository-level frontend standards for loading presentation and panel sizing before a consistency sweep.
- Revised after planner-review feedback to clarify scope, state composition, width-token ownership, degraded-ready handling, and accessibility expectations.
- Revised again after follow-up clarification to scope refresh affordances to affected subregions by default, treat degraded required data as blocking for the affected region, and define a table-surface baseline for non-modal mutations.

## Purpose

This document defines the intended behaviour for frontend loading states and panel widths across the active frontend surface.

The feature will be used to:

- standardise how loading states are presented before a panel or comparable UI element becomes ready
- standardise short-running write-action loading behaviour so users see consistent feedback across modals and non-modal surfaces
- standardise panel width ownership so frontend surfaces share the same default sizing rules and named exceptions
- apply those rules across all active frontend surfaces rather than limiting the first sweep to current known inconsistencies only

This feature is **not** intended to:

- redesign long-running write workflows or job-style progress tracking
- prescribe implementation sequencing, file-by-file changes, or speculative new UI features beyond the agreed standards

## Agreed product decisions

1. When a surface has no usable data yet and cannot render meaningful content, it must show a skeleton in place of the eventual UI rather than a generic spinner or placeholder sentence.
2. Initial-load skeletons should resemble the structure of the content they are standing in for, such as cards, tables, form rows, or summary blocks.
3. Once a surface has usable data on screen, background refreshes must keep that data visible and use a lighter in-place busy affordance rather than replacing the surface with a skeleton.
4. A lighter in-place busy affordance means the visible content remains on screen while a localised busy indicator appears in the relevant surface chrome, such as a card header, toolbar, section header, or comparable in-place status area.
5. Short-running write actions in modal workflows must continue to use the existing Ant Design confirm-loading pattern: the primary action shows a spinner and competing actions are disabled while the mutation is in flight.
6. Short-running write actions outside modals must follow the same behavioural rule by default: the triggering primary action shows loading and competing actions on the same surface are disabled until the mutation settles.
7. All panels must use a shared default width token unless they are using an explicitly named exception width.
8. Width exceptions must stay small in number, must be named by intent rather than by feature, and must be centralised so width literals are not duplicated across frontend code.
9. Outer page or tab surfaces and inner panel widths are separate concerns. The owning page or tab controls the outer frame width, while the panel controls its own panel-width token inside that frame.
10. The Settings page must keep a stable outer width across tabs. The backend settings tab should use the master Settings page width, with the backend settings form rendered inside it as a centred default-width panel rather than narrowing the entire tab surface.
11. This standards sweep applies to all active frontend surfaces in `src/frontend`, not only the currently known inconsistent settings and panel-like areas.
12. The loading and mutation vocabulary in this document is conceptual and composable. A surface may be ready while also refreshing, mutation-pending, or degraded-ready, and implementation does not need to collapse those conditions into one exclusive enum.
13. App-level width tokens for custom page and panel layout should use shared CSS custom properties as the authoritative source of truth. Ant Design theme or component tokens should only be used when a width belongs to a documented Ant token contract.
14. For short-running non-modal mutations, the default rule is to disable conflicting write triggers on the same owned surface while leaving purely read-only interactions available unless that would be unsafe or misleading. This boundary remains an explicit refinement point for future feature planning on more complex surfaces.
15. By default, if required data for an owned UI region is known-invalid, known-incomplete, failed in a way that invalidates the visible content, or otherwise untrustworthy, that region must fail closed: its normal content should not render and the affected region should show its blocking-state treatment instead. Visible degraded-ready content is not the default standard and would require an explicit future feature decision.
16. On composite surfaces, refresh affordances should be scoped to the affected owned subregion by default and should only bubble up to whole-panel chrome when the panel's primary content region is refreshing or when the refresh invalidates the whole panel context.
17. For table-heavy surfaces during short-running non-modal mutations, sort and filter controls may remain available by default, but selection should freeze once the mutation target rows have been snapped.
18. Initial-loading and background-refresh treatments must include explicit accessible busy signalling in addition to any visual affordance.
19. A query-library stale flag on its own does not make visible data degraded or trigger fail-closed behaviour.

## Existing system constraints

Documented constraints below materially shape the standard.

### Frontend or consumer architecture constraints

- Frontend data loading is query-driven through React Query hooks and shared query option factories.
- Shared page composition currently flows through `PageSection` and `TabbedPageSection`, which already own page-level content width classes.
- Ant Design is the UI baseline and already provides built-in behaviours for `Skeleton`, `Button.loading`, `Modal.confirmLoading`, `Table.loading`, `Alert`, `Card`, `Space`, and `Flex`.
- The frontend already uses shared CSS and at least one root-level CSS custom property for app shell layout, while Ant Design `ConfigProvider` theme tokens are currently used narrowly for Ant theming rather than app-specific layout sizing.
- Current page and panel widths are partly defined through shared CSS classes and partly duplicated as raw values in feature-specific classes.
- Active frontend surfaces also include standalone card-like layouts that currently duplicate the same fixed-width literals used by page and panel surfaces.
- Existing surfaces already use a mix of blocking load states, inline alerts, and mutation loading props, so the standard must tighten those patterns without introducing a parallel component system.
- Some current frontend surfaces keep partial or degraded content visible. Those surfaces are existing implementation debt, not precedent for the standard defined here.

### Current data-shape and state constraints

- Some frontend surfaces distinguish between initial blocking load and ready state explicitly, while others currently collapse all loading into a single branch.
- Background refreshes can happen after writes or query invalidation, and those refreshes may need to preserve already visible data.
- Some write workflows currently assume short-running mutation behaviour and do not yet model long-running asynchronous job progress.

## Domain and contract recommendations

Use this section as the repository rule set for future frontend implementation unless superseded by a later explicit decision.

### Why this approach is preferable

- It keeps loading feedback aligned with the amount of usable information available to the user.
- It reduces visual instability by avoiding unnecessary skeleton re-entry after a surface has already rendered meaningful content.
- It gives users a consistent short-running mutation model across modals and non-modal surfaces.
- It removes width drift caused by duplicated literals and feature-local sizing decisions.

### Recommended behavioural model

#### Surface presentation model

```ts
type SurfacePresentationModel = {
  loadPhase: 'initial-loading' | 'ready' | 'blocking-error';
  refreshState: 'idle' | 'refreshing';
  mutationState: 'idle' | 'pending';
  dataIntegrityState: 'complete' | 'blocking-degraded';
};
```

This model is conceptual vocabulary for planning and implementation decisions. It does not require one shared runtime object or one centralised state machine.

### Naming recommendation

Prefer:

- `defaultPanelWidth`
- `wideDataPanelWidth`
- `surfacePresentationModel`
- `isInitialLoading`
- `isRefreshing`
- `isMutating`
- `hasBlockingDataGap`
- `selectionSnapshot`

Prefer shared CSS custom property names such as:

- `--app-page-width-default`
- `--app-page-width-wide-data`
- `--app-panel-width-default`
- `--app-panel-width-wide-data`

Avoid:

- feature-specific width names that encode one screen only
- duplicated raw width literals embedded in unrelated components or CSS selectors
- generic `isLoading` flags when the implementation needs to distinguish initial blocking load from background refresh
- inventing app-only width values inside `ConfigProvider.theme` when the values are not part of a documented Ant token contract

### Validation recommendation

#### Frontend

- Each data-heavy or panel-like surface should classify its loading behaviour explicitly enough to distinguish initial blocking load from background refresh when both states exist.
- A surface must not show both a full skeleton replacement and the ready-state region for the same owned content at the same time.
- If required data for an owned region is degraded, partial, or untrustworthy, that region should suppress its normal content by default and use its blocking-state treatment.
- A short-running mutation should not leave conflicting write actions interactive on the same owned surface while the mutation is pending unless a later feature spec explicitly defines an exception.
- Busy treatments must provide accessible signalling, not only visual indicators.

## Feature architecture

This standards feature lives as frontend repository policy plus the implementation changes needed to bring existing surfaces into compliance.

### Placement

- Shared frontend layout ownership remains with shared page wrappers and shared frontend styling/configuration.
- Feature panels, cards, and dialogs remain responsible for rendering the correct loading and mutation affordances inside their owned surface.
- Shared CSS custom properties in the frontend styling layer are the authoritative store for app-level page and panel width tokens.
- No parallel width system should be added at individual feature level.

### Out of scope for this surface

- Long-running non-modal write workflows that need richer progress, cancellation, or background-job tracking
- Reworking unrelated navigation or information architecture beyond what is required to enforce these standards

## Data loading and orchestration

### Required behavioural distinctions

- `initial-loading`: no usable content is available yet, so the owned UI region renders a shape-matched skeleton instead of its eventual content.
- `ready`: the surface has usable content and no blocking failure prevents normal use.
- `background-refresh`: usable content remains visible while a localised in-place busy affordance communicates refresh activity.
- `mutation-pending`: the owned write control shows loading and conflicting write triggers on the same surface are disabled until the mutation settles.
- `blocking-degraded`: required data for the owned region is partial, stale, incomplete, or otherwise degraded enough that the region should suppress its normal content and use its blocking-state treatment.
- `blocking-degraded`: required data for the owned region is known-invalid, known-incomplete, refresh-invalidated, or otherwise degraded enough that the region should suppress its normal content and use its blocking-state treatment.
- `blocking-error`: the surface shows the standard blocking failure treatment rather than a skeleton or stale interactive content.

These distinctions may overlap. A surface may be `ready` and `background-refresh` simultaneously, or `ready` and `mutation-pending`. A subregion may also be `blocking-degraded` while the wider panel remains `ready`.

A query-library stale flag or ordinary refetch eligibility alone does not create a `blocking-degraded` state.

### Prefetch or initialisation policy

#### Feature entry

- Skeletons are for feature-entry or region-entry states where the user would otherwise see empty or misleading content.
- If a feature was prefetched and already has usable data, it should enter the ready state instead of forcing a skeleton for visual symmetry alone.

#### Manual refresh or invalidation

- Refresh or invalidation after a ready state should preserve visible data wherever the surface still has trustworthy content to display.
- Background refresh indicators should be local to the surface being refreshed and should not replace the entire page unless the whole page truly becomes non-usable.
- On composite surfaces that merge multiple datasets or subregions, a refresh affordance should attach to the smallest owned region whose currently visible usable data is being refreshed.
- Whole-panel refresh treatment should be reserved for cases where the primary visible panel content is refreshing or where the refresh invalidates the whole panel context.

#### Degraded-data default

- When required data for an owned region is known-invalid, known-incomplete, refresh-invalidated, or otherwise untrustworthy, the default behaviour is to suppress that region's normal content.
- The affected region should show its blocking-state treatment instead of a visible degraded-ready content state.
- Any future exception that keeps degraded content visible must be explicitly approved in a later feature spec rather than inferred from current implementation.
- Query-library staleness or routine background refetch eligibility alone must not be treated as degraded data.

## Core view model or behavioural model

### Derivation rules

#### Initial blocking load

- Use a shape-matched skeleton for the panel, card, table, form, or comparable owned UI region.
- Hide interactive ready-state controls that depend on unavailable data.
- Expose accessible loading semantics through a labelled announced status region, such as `role="status"`, while the skeleton is present.

#### Background refresh

- Keep the last usable data visible.
- Show a localised busy indicator in surface chrome, such as a toolbar, card header, or section header.
- Avoid resetting selection, filters, or user context unless the refreshed data itself invalidates that context.
- Mark the affected region as busy, for example with `aria-busy="true"`, and pair that with visible refresh feedback that has accessible text.

#### Blocking degraded data

- Suppress the affected region's normal content.
- Reuse the region's standard blocking-error primitive as the blocking-state treatment. By default, this should be an Ant Design `Alert` in the affected owned region unless a stronger documented UX case exists.
- Treat any current implementation that leaves degraded content visible as non-compliant with the baseline standard unless a later feature spec explicitly allows it.

#### Short-running mutation pending

- Show loading on the primary triggering control.
- Disable conflicting write triggers on the same owned surface for the duration of the mutation.
- Preserve currently visible data unless the mutation result makes that data unsafe or misleading.
- Treat the exact disablement boundary as a future refinement point for complex surfaces, but default to the narrowest safe boundary rather than freezing every control in the panel.
- For data-table surfaces, treat the owned mutation surface as the relevant toolbar, row selection state, and row-level write launchers tied to the same dataset. Freeze row selection once the mutation target rows have been snapped, disable conflicting write launchers in that owned workflow region, and keep unrelated write launchers elsewhere on the page outside that boundary by default.
- Keep sort and filter controls available by default unless the feature surface has a specific reason to lock them.

### Width ownership rules

1. Shared CSS custom properties in the frontend styling layer must define the default page and panel widths plus the approved named exception widths.
2. The initial token set should include a default page width, a wide-data page width, a default panel width, and a wide-data panel width unless later planning proves a token unnecessary.
3. Page-level or tab-level containers must consume those shared tokens for outer frame sizing.
4. Inner panels, standalone card-like surfaces, and comparable owned containers must consume those same shared tokens rather than introducing feature-local width literals.
5. Ant Design theme or component tokens may only own width values when the width is part of a documented Ant token contract that should also affect Ant component styling.
6. App-specific page and panel widths must not be duplicated inside `ConfigProvider.theme`.
7. Named exception widths should be reserved for surfaces whose information density genuinely exceeds the default panel width, such as dense data tables.
8. A feature should prefer the default panel width unless there is a clear data-density or workflow reason to use an approved exception width.

## Main user-facing surface specification

### Recommended components or primitives

- `Skeleton` for initial blocking load states with no usable content yet
- `Button.loading` and `Modal.confirmLoading` for short-running write feedback
- localised card-header, toolbar, or section-header busy treatment for background refresh states
- shared page and panel width tokens consumed by shared layout wrappers and owned panels

### Rendering rules

#### Initial load with no usable content

- Render a skeleton in the exact region where the eventual surface will appear.
- Match the skeleton to the expected content shape as closely as is practical without over-engineering.
- Do not replace the region with generic copy such as “feature is loading” unless no meaningful skeleton shape exists.

#### Ready with background refresh

- Keep the current content visible.
- Add an in-place busy indicator near the surface heading, toolbar, card title, or comparable chrome.
- Avoid whole-surface replacement spinners or skeletons once usable content is already visible.
- Add region-scoped accessible busy signalling, such as `aria-busy="true"`, not only a visual spinner or text badge.

#### Blocking degraded data

- Suppress the affected region's normal content by default.
- Show the blocking-state treatment for the affected region, reusing the standard blocking-error primitive for that surface. By default this should be an Ant Design `Alert` in the owned region unless a stronger documented UX case exists.
- Do not treat visible degraded content as the default UX pattern for this standards sweep.

#### Short-running modal mutation

- Use the modal confirm-loading pattern.
- Disable cancel or competing actions when retrying would create confusion or duplicate writes.

#### Short-running non-modal mutation

- Use loading on the primary action that initiated the write.
- Disable conflicting write actions on the same owned surface until completion.
- Keep read-only interactions available by default unless the surface would become unsafe, misleading, or technically unstable.
- On data-table surfaces, freeze selection after the mutation target snapshot is taken while allowing sort and filter controls to remain available by default.
- Treat unrelated write launchers elsewhere on the page as outside the default conflict boundary unless they operate on the same owned dataset workflow.
- Re-enable controls promptly when the mutation settles.
- Treat the exact boundary between conflicting and non-conflicting controls as an explicit refinement point for future feature planning on more complex surfaces.

#### Width and composition

- The visual frame for a page or tab must stay stable unless a deliberate named exception is in effect.
- Narrower inner panels may sit centred inside a wider page or tab frame when that preserves consistency.
- Settings-page tabs should not cause the whole page frame to jump between unrelated widths when switching tabs.

## Workflow specification

## Panel first render

### Eligible inputs or preconditions

- The panel or owned region has started loading required data.
- The panel has no usable prior data to display.

### Rendering contract

- Render a shape-matched skeleton in the owned region.
- Do not show the ready-state panel contents until the required data becomes usable.

## Panel refresh after ready state

### Eligible inputs or preconditions

- The panel already has usable data on screen.
- A query refetch, invalidation, or comparable refresh is in progress.

### Rendering contract

- Keep the currently visible data on screen.
- Show a localised in-place busy affordance in the relevant surface chrome.
- Do not fall back to a full skeleton unless the surface has become non-usable.

## Panel degraded-ready state

### Eligible inputs or preconditions

- Required data for the panel or owned subregion is known-invalid, known-incomplete, refresh-invalidated, or otherwise degraded.

### Rendering contract

- Suppress the affected region's normal content.
- Show the affected region's blocking-state treatment, reusing the standard blocking-error primitive for that surface. By default this should be an Ant Design `Alert` in the affected owned region unless a stronger documented UX case exists.
- Keep wider surrounding regions visible only when they remain independently usable and trustworthy.

## Short-running write action

### Eligible inputs or preconditions

- The user has triggered a short-running mutation from a modal or from a non-modal surface.

### Rendering contract

- Show loading on the primary action that initiated the write.
- Disable competing actions on the same surface while the mutation is pending.
- Restore the normal control state when the mutation finishes or fails.

## Open questions

- The exact disablement boundary for non-modal mutations on complex surfaces remains a deliberate refinement point for future feature planning and implementation reviews.
