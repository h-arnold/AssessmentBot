# Task Preview Source Link Specification — Issue #19

## Status

Implemented and accepted under the user-approved reduced finish line. The source action, nullable source-ID alignment, derived editor URL and controlled keyboard-focus session are in place; the representative visual inspection, final focused review and regression validation are complete and accepted.

## Purpose

Let a teacher open the source of the student response displayed in a task preview, at its slide or sheet tab where known. Issue: https://github.com/h-arnold/AssessmentBot/issues/19.

## Agreed product decisions

1. Add the Lucide `ExternalLink` (`external-link`) icon to the top-right header of `TaskPreviewCard`, as requested in the issue illustration.
2. Support the existing `SLIDES` and `SHEETS` formats. Google Docs and sheet-range selection are out of scope.
3. Use existing stored metadata only. Do not repair extraction, refresh stored IDs, migrate records, or change backend behaviour. The user considers the deterministic IDs sufficiently reliable for this feature.
4. Open a new tab with `target="_blank"` and `rel="noopener noreferrer"`; preserve the current heatmap and preview. Use a native link, not imperative `window.open` orchestration.
5. Prefer the displayed submission artefact's usable `documentId`, then its parent submission's usable `documentId`. Never substitute a reference/template document or image-export `metadata.sourceUrl`.
6. Use the displayed submission artefact's `pageId`. Unknown task location links to the source document root. Unknown document or unsupported/unknown format means no link, not a disabled icon or blocking error.
7. The source belongs to the same submission item as the displayed content. Merged previews retain existing first-wins selection; do not choose a different submission merely to obtain a link.
8. Preserve the metric's centring relative to the entire card, not the remaining space beside an action. Preserve reasoning, response rendering, score semantics and loading/error behaviour.

## Existing system constraints

- `getAssignment` already returns document format, parent submission document ID and per-artefact document/page IDs. `buildCellPreviewLookup` currently discards the latter fields.
- `assembleTaskPreviewData` adapts the lookup into `TaskPreviewData`; both class drill-down and standalone Heatmaps use this pipeline and the same card.
- `assembleMergedPreviewData` retains entire cells with existing first-wins semantics.
- `BaseTaskArtifact` permits nullable source IDs; the full frontend `BaseTaskArtifactFields` validator currently requires strings. Align those two fields with the existing backend contract; do not add optionality or new wire fields.
- Stored locations may include the existing reference-page fallback or older values. This feature consumes them as-is, under the explicit existing-metadata decision.
- No new query, API endpoint, fetch, authentication flow, scope or backend change is needed.

## Contracts and resolution rules

### Existing transport validation alignment

In `services/assignmentAssessment/assignmentAssessment.zod.ts`, common artefact `documentId` and `pageId` become required `string | null` fields. Numeric/object IDs and absent artefact fields remain invalid. Parent submission validation remains unchanged. Types continue to derive from Zod.

### Frontend derived model

Add required `readonly sourceUrl: string | null` to both `CellPreviewData` and `TaskPreviewData`. It is derived in the lookup, carried unchanged by assembly and merge, and never persisted or added to API responses. Missing cell data yields `sourceUrl: null`.

### URL resolution

- Format is the root full assignment's `documentType` (`SLIDES` or `SHEETS`), not the artefact's content `type`. Null or any other format hides the action; do not infer a format from content or use another document.
- Usable document ID means a non-blank string. Prefer artefact ID, otherwise parent ID. Trim surrounding whitespace and encode identifiers as URL components; use a fixed HTTPS Google Docs host and editor path. Do not accept an arbitrary URL from metadata.
- Usable page ID means a non-blank string; trim and encode it as a component. The Sheets value `"0"` is valid. A missing/null/blank page ID omits the anchor.
- Slides: `https://docs.google.com/presentation/d/{documentId}/edit#slide=id.{pageId}`.
- Sheets: `https://docs.google.com/spreadsheets/d/{documentId}/edit#gid={pageId}`.
- Root fallback is the corresponding `/edit` URL with no fragment.
- Do not use definition task page IDs to fill missing student page IDs.
- Visibility depends on source availability, not the metric's computed/not-attempted/error state. Existing loading/error surfaces that do not render a ready card gain no action.

## User-facing surface and workflow

Use the existing card header and an icon-only Ant Design link-capable Button with a hover/focus Tooltip. Accessible name and tooltip: **Open source document (opens in a new tab)**. The SVG is decorative (`aria-hidden`). Keyboard focus remains visible; Enter activates native navigation. No new modal, drawer, route or confirmation.

Reuse `components/icons/LucideIcon.tsx` with `ExternalLink` from `lucide-react`, rather than a parallel icon integration. The wrapper's contract is its source and co-located spec: it explicitly overrides Ant Design SVG width/height/fill and provides decorative semantics. `docs/developer/frontend/metric-icon-display.md` describes a historical sizing concern for metric labels; reconcile that account if browser review establishes it is outdated, without changing unrelated metric rendering. Keep the action outside the metric's `role="status"` live region.

Keep source-URL derivation local to `buildCellPreviewLookup.ts`. The wizard's private `buildCanonicalUrl` was inspected: it assumes a selected supported format and handles reference/template form URLs, not nullable per-student task locations. Do not widen or move it for this issue. Record this deliberate local ownership and the extension of existing lookup/assembly helpers in the canonical helper doc. The derived `sourceUrl` means an editor link; it is distinct from, and never copied from, image-export `artifact.metadata.sourceUrl`.

Both the embedded class-assignment heatmap and standalone/merged Heatmaps must offer identical behaviour. Moving the pointer from the cell to the card action must keep the popover available long enough to use it. The user explicitly approved focused keyboard handling: Enter/Space on a metric cell opens its preview and focuses its source link when rendered; pointer opening never moves focus. With loading/error/no-link content, keep focus on the trigger. If loading becomes ready while the same keyboard-opened preview is still open and the trigger retains focus, focus its link once; never steal focus after the user moves elsewhere. Escape from trigger or preview closes it and returns focus to its cell. No focus trap; ordinary Tab navigation remains possible. Returning from the new tab preserves the app view. This requires a feature-local popover interaction component, not a global portal policy change.

## Accessibility, responsive behaviour and authorised visual tuning

The starting proposal is a 16px icon inside a 24px header action, vertically aligned with the metric and positioned at the right header inset. The user explicitly authorised, via the question tool, final dimensions and spacing to be tuned by evidence-based Playwright visual review when the proposal looks wrong or inconsistent with the app. This is the only deliberate deferral.

Top-right placement, whole-card metric centring, no overlap/clipping, keyboard access and correct navigation are fixed requirements. Use one representative visual check across desktop and narrow viewports in light and dark themes; the exhaustive viewport/zoom capture matrix and the separate 200% browser-zoom walkthrough are waived under the user-approved reduced finish line. Record final dimensions, rationale, measured geometry and screenshots; reconcile layout and test expectations before sign-off.

## Non-goals

- Backend metadata corrections, bulk migration, document existence checks or a live Workspace testing dependency.
- Google Docs support, Sheets range selection, multiple-source picker or changes to merged winner semantics.
- Wizard link refactoring, generic shared navigation components or unrelated fixture/test migration.

## Planning handoff constraints

- Decompose every oversized in-scope module before functionality implementation. Recount all materially changed files; use the 500-line projected planning trigger and coherent separation, not formatting compression.
- The 877-line preview-lookup test and 659-line assignment-schema test need behaviour-preserving decomposition first. The 476-line column module is projected above 500 after keyboard handling; extract its metric-cell popover/content responsibility before adding that behaviour. Keep feature work blocked until decomposition's existing tests and review pass.
- Use canonical synthetic `small` transport views for supported realistic journeys; local invalid/boundary variants remain local. Record generator-extension requirements for unsupported realistic content rather than inventing another corpus.
- A dedicated layout specification is required because header action placement and visual alignment are central acceptance requirements.

## Testing expectations

- Zod: nullable IDs accepted across artefact variants; omission and wrong types rejected; existing full assignment transport remains valid.
- Lookup/assembly: Slides and Sheets anchors, parent fallback, root fallback, `"0"`, blank/null/unknown IDs or format, identifier encoding, no reference/template/export URL substitution, missing cells and merged first-wins source/content correspondence.
- Card: conditional native link, label, tooltip, target/rel, decorative icon, unchanged metric/body/status rendering.
- Playwright: walk through both heatmap entry points; pointer and keyboard navigation; exact outgoing URL/new tab with external navigation intercepted; source action absent during loading/error/unknown-source cases; geometry and screenshot review for scale, alignment, clipping and theme consistency. Do not treat href assertions alone as visual verification.

## Documentation and rollout

Record planned-only schema decisions in `docs/developer/data-shapes/assignment.md` and the derived preview shapes (`CellPreviewData` and `TaskPreviewData`) in `docs/developer/data-shapes/frontend-data-analysis-response.md`, marked `Not implemented`, before finalising the action plan. The backend contract in `assignment-definition.md` already permits nullable IDs and requires no contract change. Reconcile the assignment document's existing parent `documentId` optionality description with the unchanged `.nullable().optional()` schema. Record helper decisions in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, including `LucideIcon` reuse. Reconcile entries during implementation. No migration or feature flag: deploy the normal frontend bundle after tests and visual-review sign-off. No unresolved product questions; only the expressly authorised visual tuning above remains for execution.
