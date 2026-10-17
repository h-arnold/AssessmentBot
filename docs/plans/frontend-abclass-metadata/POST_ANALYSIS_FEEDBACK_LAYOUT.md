# Post-Analysis Metadata Feedback Layout Specification

Status: independently reviewed and clean, 17 October 2026. Planning only.

## Purpose and scope

Use with [SPEC.md](SPEC.md) and [ACTION_PLAN.md](ACTION_PLAN.md). This compact
layout document is required because a new visible, dismissible warning state is
introduced. It does not redesign the Class page or standalone Heatmaps surface.

Covers notification hierarchy, failure feedback, focus and responsiveness. Domain
freshness, persistence and queue contracts remain in the specification.

## Ant Design references consulted

Official references consulted on 17 October 2026:

- [Notification](https://ant.design/components/notification): warning, unique key,
  title/description, `duration: 0`, dismiss button and `role`.
- [App](https://ant.design/components/app): `App.useApp().notification` supplies
  context-aware feedback under the existing application wrapper/ConfigProvider.

The user explicitly chose a persistent non-blocking warning notification over
diagnostics-only feedback. No additional layout trade-off remains unresolved.

## Surface hierarchy

```text
Existing Ant Design App / ConfigProvider (unchanged)
├── Existing Class-page or standalone Heatmaps content (unchanged)
│   └── shared usePostAnalysisTasks completion lifecycle
└── Existing context-aware Notification host
    └── keyed warning when a post-analysis metadata task fails
```

No new route, inner tab, modal, drawer, panel, toolbar, table column or navigation
entry. No separate notification host or static `notification.warning` calls.

## States and content

| State                                                 | Feedback                                | Analysis content                             |
| ----------------------------------------------------- | --------------------------------------- | -------------------------------------------- |
| Analysis loading/failed/not run                       | No metadata notification                | Existing behaviour                           |
| Post-analysis task pending                            | No blocking spinner or progress surface | Remains usable                               |
| Metadata unchanged/no assignments/stale source        | No notification                         | Unchanged                                    |
| Metadata saved/refreshed                              | No success notification                 | Existing normal refresh behaviour            |
| Task failed before confirmed persistence              | Warning below                           | Preserve usable analysis                     |
| Persistence confirmed but active-query refresh failed | Distinct warning below                  | Existing query trust/error rules still apply |

### Save failure

- Title: **Class summary not saved**.
- Description: **Analysis is ready, but the class summary could not be saved.
  Reload the page to try again.**

### Post-save refresh failure

- Title: **Class summary refresh failed**.
- Description: **The class summary was saved, but refreshed data could not be
  loaded. Reload the page to refresh it.**

Both warnings use Ant Design's warning icon, `duration: 0`, `closable: true`,
`role: 'status'` and the existing host placement. Use a stable key derived from
task/class/source version so replay cannot stack duplicate warnings. Descriptions
are plain user-safe text; no raw exceptions, backend payloads, student data or
developer diagnostics. No action button, new retry control or confirmation modal.

## Interaction and lifecycle

- Do not move keyboard focus to a background notification. The current analysis
  interaction retains focus; the built-in close control remains keyboard reachable.
- Closing dismisses feedback only; it does not mark metadata saved or rerun work.
- Rerender/refetch/StrictMode does not reopen the same warning after dismissal.
- A genuinely new source version can produce a distinct warning. Reload/remount
  allows another attempt through the existing page lifecycle.
- On owner navigation/unmount, destroy its owned notification and suppress late
  feedback/state updates. Active queued work may still complete; do not claim abort.
- Existing fail-closed query trust rules are not weakened by preserving valid
  calculated results after a metadata task failure.

## Responsive, accessibility and motion behaviour

- Keep the existing page/panel widths, notification placement, spacing and theme
  tokens. Use stock Notification wrapping/viewport containment, not custom sizing.
- Verify at 1440×900 and 390×844 with the current light/dark theme support: readable
  text, reachable close control, no new horizontal overflow or obscured navigation.
- Use the polite `status` semantics for this non-blocking warning. Do not add a
  focus trap, timed dismissal, custom animation or reduced-motion override.

## Browser acceptance

Playwright must cover save failure on each analysis surface, persistence-success
then refresh-failure copy, analysis remaining usable, close-by-keyboard behaviour,
no duplicate/reopened warning on unchanged rerender and notification containment
at narrow width. Keep timestamp/queue/scoring matrices in Vitest rather than
duplicating them in browser tests.
