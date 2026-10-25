# Assessment Error Preview Layout

## Status and purpose

Reviewed for action-plan preparation; not implemented. Companion to `SPEC.md`;
defines the small preview-state change for
explicit Assessment E outcomes. The user confirmed retaining the existing card,
Reasoning section and valid source content, with a local Alert for unavailable source.
This companion replaces the removed `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md` reference
for retained preview header/source-link/focus behaviour. Repoint the stale comments
in `TaskPreviewCard.tsx` and `TaskMetricPreviewCell.module.css` when those files are
touched during implementation, and any touched co-located specs referencing it
(including the source-link/focus/focus-session suites). No code/test comment is
changed during planning.

No new page, modal, drawer, navigation layer, toolbar or retry button is introduced.
This document does not redefine persistence, errors, retry policy or score aggregation.

## Official Ant Design references consulted

- [Component index](https://ant.design/llms.txt).
- [Card](https://ant.design/components/card): retain `size="small"`, the existing
  title and `extra` source action; no nested cards/tabs.
- [Alert](https://ant.design/components/alert): persistent inline error feedback
  with `title`, `description`, `type="error"` and `showIcon`; not `Alert.ErrorBoundary`.
- [Popover](https://ant.design/components/popover): retain the existing controlled
  interaction/focus owner, placement and overflow handling. A Popover supports the
  existing source link; no tooltip-only error explanation is introduced.
- [Skeleton](https://ant.design/components/skeleton): retain the whole-preview
  placeholder and use a self-contained source-region skeleton while known E
  reasoning remains visible. Expose it through a labelled
  `<output aria-busy="true">`; do not add redundant `role="status"` to output.

Current owners inspected: `TaskMetricPreviewCell`, `TaskMetricPreviewContent`,
`TaskPreviewCard`, `assembleTaskPreviewData`, `buildCellPreviewLookup`, and the
embedded/merged heatmap query composition. There is no surviving root preview-layout
document to amend; existing source and canonical shared-helper guidance define the
source-link/focus behaviour to preserve.

## Surface hierarchy

```text
Existing heatmap metric button
└── Existing controlled Popover
    ├── Whole-preview skeleton, only when no known result can yet be shown
    ├── Existing dataset/query blocking Alert, when no trustworthy preview exists
    └── Existing TaskPreviewCard
        ├── Header: criterion label + existing MetricPill (E when applicable)
        ├── Header extra: existing safe source-document link, when available
        └── Scrollable body
            ├── Reasoning: teacher-readable Assessment.reasoning
            ├── Existing Divider
            └── Student Response
                ├── Existing image/Markdown/table renderer, or
                ├── Local source skeleton, or
                └── Inline source-unavailable Alert
```

Keep existing header centring, icon geometry, source URL derivation, card width,
body scrolling, theme tokens and spacing. Do not introduce new width constants,
custom error colours or whole-page replacement for an item-level failure.

## Visible states

| Situation                                                                           | Header / Reasoning                            | Student Response region                                                                 |
| ----------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| Normal ready numeric/N result                                                       | Existing presentation                         | Existing renderer/legitimate no-submission placeholder                                  |
| No known result; full fetch pending                                                 | Existing shape-matched whole-preview skeleton | Included in skeleton                                                                    |
| Known class-partial E; full fetch pending                                           | Immediately show E and its reasoning          | Source-region skeleton only                                                             |
| LLM/assessment E with trustworthy content                                           | E and its recorded reasoning                  | Render valid response normally                                                          |
| Acquisition/extraction E, source unavailable                                        | E and its recorded reasoning                  | Inline error Alert; no renderer call                                                    |
| Known E; full fetch fails or returns null                                           | Keep E and its known reasoning                | Inline source-unavailable Alert; do not replace known reasoning with generic fetch copy |
| Full-read-only record corruption                                                    | Preview header E and corruption reasoning     | Inline Alert including scores-unchanged notice                                          |
| Legacy assignment                                                                   | E; `Reassessment required`                    | Inline Alert; historical content is not required to render                              |
| Root/shared-definition or unidentifiable dataset failure, no trustworthy E fallback | Existing owned-region blocking feedback       | Do not manufacture task reasoning/identity                                              |

The card header's E is a preview result. Under the user's explicit preview-only
choice, a full-read corruption may coexist with an unchanged numeric table cell.
Do not alter table scores, summaries, averages, filters or saved metadata from
this discovery. Explain the distinction inside the affected preview.

`sourceState: 'loading'` is reserved for the pending full-fetch window. Once that
fetch terminally fails or returns null/not found, the known-E fallback resolves to
`sourceState: 'unavailable'`, replaces the source skeleton with the inline Alert,
and keeps the known reasoning visible.
Confirmed no-submission without a known E uses `sourceState: 'available'` for the
ready N placeholder. This represents a ready normal region, not an existing source
document, and must not show a source-error Alert.

## Copy and status treatment

- Show Assessment error reasoning as plain text in the existing **Reasoning**
  section, not raw exception messages, stacks, HTTP bodies or credentials.
- For unavailable content, the source-region Alert title is **Source unavailable**.
  Ordinary description: **The response cannot be shown. Reassess the assignment
  to try again.** The specific failure remains in Reasoning above it.
- For full-read-only corruption, use the exact description from `SPEC.md`:
  **Source preview unavailable. Displayed scores are unchanged; reassess the
  assignment to refresh them.**
- For legacy results, source-region description: **Reassess this assignment to
  create results in the current format.**
- Structured stage/code is for validation/diagnostics; no new developer-details
  panel, code badge, disclosure or tooltip is added.
- Alerts are not dismissible: hiding an unresolved source error must not expose
  the normal renderer. No toast is required merely because a preview opens.
- No duplicate generic Alert above a valid response for an assessment-only E;
  the E metric and recorded Reasoning already explain the marking failure.

## Source action and interaction

- Retain the source link whenever the existing safe resolver can derive it from
  validated source identifiers, even if extraction or assessment failed.
- If no safe link is derivable, omit the action and its balancing space as today.
  Never substitute the reference/template document or image-export URL.
- Keep the existing new-tab disclosure, `noopener noreferrer`, focusable native
  trigger, click/hover behaviour, Escape dismissal and focus return.
- Known E is usable card data. If its safe source action is ready, the existing
  one-session keyboard-focus transfer can occur without waiting for source content.
  Later content arrival must not steal focus a second time.
- Keep Tab/Shift+Tab untrapped. Error arrival does not force focus onto the Alert.

## Precedence and merged views

- Use the exact error/result precedence in `SPEC.md`. Never coerce known E to N
  because a full-content lookup entry is absent.
- Class-partial E fallback is associated with the actual assignment, student,
  task and criterion. Preserve existing deterministic merged-source selection;
  do not attach another assignment instance's reasoning because its definition
  key/task key happens to match.
- Healthy sibling previews remain independently usable. An isolated item error
  is not an assignment-wide query error after successful normalisation.
- Refresh follows current query ownership. A confirmed refreshed result replaces
  the affected preview state; do not keep an old numeric preview visible when
  refreshed evidence explicitly marks its source invalid. Ordinary refetch
  eligibility alone does not invalidate usable content.

## Responsive behaviour, accessibility and motion

- Retain current viewport containment and card-body scroll treatment. Long safe
  reasoning and Alert descriptions wrap; they must not expand the popover off-screen.
- Preserve existing narrow-viewport arrow handling; no new breakpoint or layout mode.
- Use the existing accessible MetricPill/score status. E is identifiable as error,
  not solely by colour. The source Alert is an accessible error region.
- Source-only loading uses a labelled status/skeleton and marks that region busy;
  it does not announce the entire known-E card as unavailable.
- Preserve theme contrast and reduced-motion behaviour; no new animated state change.

## Acceptance and testing

Cover the state table in component tests, and embedded plus standalone/merged
browser journeys for E with valid content, E without content, pending/failed full
fetch with known reasoning, preview-only corruption notice, source-action keyboard
behaviour and healthy sibling preservation. Include narrow-screen wrapping and
refresh from E to success. Do not add an app error boundary to make null content safe.
Name a merged journey with two assignment instances sharing one definition: only
the first selected instance has a known partial E, and its preview must never use
the second instance's reasoning/content. Also cover a legacy-reassessment preview
journey, including its safe copy and unaffected current-version sibling assignment.

No layout questions remain. Reuse existing controls and surface geometry; the
separate action plan must sequence implementation and red-first tests.
