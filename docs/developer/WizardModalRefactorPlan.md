# Wizard modal refactor plan (BeerCSS)

## Goal

Refactor the current multi-modal (Materialize) workflow into a single **wizard-style** modal using **vendored BeerCSS**, while keeping the implementation simple and readable.

## Non-goals

- No new features beyond the refactor (unless explicitly agreed).
- No broad re-styling of legacy dialogs that are not part of this flow.
- No new external UI libraries.

## Current workflow (baseline)

Today the flow is split across separate HtmlService modals (Materialize):

- Assignment selection dialog (e.g. `UI/AssignmentDropdown.html`)
- Document ID entry dialog (e.g. `UI/SlideIdsModal.html`)
- Subsequent progress / actions

Known downside: loading multiple HTML templates as separate modals can feel slow in GAS due to repeated template evaluation and modal rendering.

## Proposed workflow

A single BeerCSS-scoped wizard modal:

1. **Step 1: Select assignment**

- Wizard modal opens immediately.
- While the server fetches assignments, the UI shows a disabled select with an indeterminate spinner.
- Once assignments are returned, the spinner is removed/hidden and the select is enabled.
- The primary action button stays disabled until an assignment is selected.
- On selection, the client fetches any assignment-specific data needed for Step 2 (e.g. previously saved reference/template IDs).

**Status:** Implemented (UI + tests). See “Progress update” below.

2. **Step 2: Provide document links / IDs**

- User enters URLs or IDs for required documents (e.g. reference Slides, template Slides).
- Client provides immediate feedback (ID extracted, inferred doc type when possible).
- On submit, server validates document type (Drive MIME type) and persists settings.

3. **Start / progress**

- Wizard triggers the assessment process and either:
  - closes and shows the existing progress modal, or
  - transitions to a lightweight progress panel within the same wizard (decision deferred).

## UI layout recommendation

### Wizard structure

- One modal containing two panels (Step 1 / Step 2) and a shared footer.
- The wizard changes state client-side (show/hide panels) rather than closing/opening separate modals.

### BeerCSS scoping

- Root wrapper element for the dialog body uses the `beer` class so the vendored BeerCSS scoped build applies only inside the modal.

### Containers vs cards vs fieldsets

- Use a single main layout container.
- Use **fieldsets** to group the form inputs for each step (clean semantics, better validation grouping).
- Optional: wrap each step panel in a simple “card-like” section only if visual separation is needed; avoid nesting cards inside cards.

**Default choice:** fieldsets for inputs + simple step sections.

## Boilerplate HTML skeleton (template composition)

- Include the shared HtmlService head fragment:
  - `<?!= include('UI/partials/Head') ?>`
- Include vendored BeerCSS scoped styles:
  - `<?!= include('UI/vendor/beercss/BeerCssScoped') ?>`

### Standard BeerCSS JS (vendored)

AssessmentBot is moving to BeerCSS gradually; to avoid re-implementing common UI behaviours (field activation, data-ui triggers, textarea autosize, etc.), new BeerCSS dialogs should also include **vendored BeerCSS JavaScript**.

- Include vendored BeerCSS JS:
  - `<?!= include('UI/vendor/beercss/BeerCssJs') ?>` (new partial; name TBD)

Notes:

- The vendored BeerCSS CSS currently includes a CDN fallback for Material Symbols fonts; we will keep this fallback to avoid the complexity of vendoring font files in GAS.
- BeerCSS JS is “almost optional” upstream, but it is helpful for consistent UI behaviour and reduced bespoke dialog JS.

Keep any additional CSS minimal and scoped to the wizard wrapper.

## Client-side behaviour

### Step 1 (assignment selection) UI details

#### Loading state (assignments not yet fetched)

- Modal renders instantly.
- Assignment select is present but disabled.
- A spinner is shown in the select suffix.

Example structure (BeerCSS helpers):

```html
<div class="field suffix border">
  <select id="assignmentSelect" disabled>
    <option selected>Loading assignments…</option>
  </select>
  <progress id="assignmentLoadingSpinner" class="circle indeterminate"></progress>
</div>
```

#### Loaded state (assignments fetched)

- Spinner is removed/hidden.
- Select is enabled.
- Options are replaced with the fetched assignment list.

```html
<div class="field suffix border">
  <select id="assignmentSelect">
    <option value="" selected>Select an assignment…</option>
    <!-- options inserted dynamically -->
  </select>
  <!-- spinner removed/hidden when loaded -->
</div>
```

#### Actions (cancel / primary)

- Use a connected button group for actions:

```html
<nav class="group connected">
  <button class="button border left-round" type="button">Cancel</button>
  <button class="button border right-round" id="startAssessment" type="button" disabled>
    Start assessment
  </button>
</nav>
```

- Primary button label: prefer **“Start assessment”** over “Go” for clarity.
- Primary button remains disabled until `assignmentSelect` has a non-empty selection.

#### Implementation notes

- Fetch assignments after initial render using `google.script.run`.
- Update UI by:
  - replacing options
  - enabling/disabling controls
  - hiding/removing the spinner
- If we use field labels (BeerCSS `label` helper), BeerCSS JS will handle toggling `active` in most cases; still keep the wizard code robust by explicitly setting selected values.

### Wizard state

Represent the wizard state with a small state object, e.g.

- `step`: `'selectAssignment' | 'enterDocuments' | 'starting'`
- `assignmentId`, `assignmentName`
- `documents`: `{ reference: { raw, id, inferredType }, template: { raw, id, inferredType } }`
- `status`: `{ loading: boolean, errorMessage: string | null }`

### URL parsing (client-side)

Client-side helper parses:

- Extract a Google file ID from common URL shapes.
- Infer type only when the URL has product paths:
  - `/presentation/d/<id>` → Slides
  - `/spreadsheets/d/<id>` → Sheets
  - `/document/d/<id>` → Docs

If the URL is a Drive link (`drive.google.com/...`) or an `open?id=` link, the client should:

- extract the ID if possible
- mark type as `unknown` and rely on server validation

### Module placement

Two acceptable options:

- Inline in the wizard template (KISS if only used here)
- Separate HtmlService include (preferred if reused elsewhere), e.g. `UI/partials/GoogleUrlParsing` loaded into the wizard

Decision: start inline; extract to a partial only if/when reused.

## Server-side validation and persistence

### Type validation

Even with client inference, treat inputs as untrusted.
On submit, server should:

- Validate required parameters.
- Resolve file metadata via Drive and confirm MIME type matches expectations (e.g. Slides for reference/template slides).

### Error handling

Follow existing logging contract:

- User-facing failures: `ProgressTracker.getInstance().logError(userMessage, { devContext, err })`
- Do not duplicate the same error in both ProgressTracker and ABLogger unless required.

## File plan (initial)

### New

- A new wizard HtmlService template: `src/AdminSheet/UI/AssessmentWizard.html`.
- Vendored BeerCSS JS partial already exists: `src/AdminSheet/UI/vendor/beercss/BeerCssJs.html`.

### Update

- UI entry-point function added in `src/AdminSheet/UI/97_globals.js`: `showAssessmentWizard()`.
- Menu entry added in `src/AdminSheet/UI/98_UIManager.js` (Authorised menu → Debug → “Assessment wizard”).
- `src/AdminSheet/UI/99_BeerCssUIHandler.js` now renders the wizard via `showAssessmentWizard()`.
- Server helper added in `src/AdminSheet/GoogleClassroom/globals.js`: `fetchAssignmentsForWizard()`.

### Leave as-is (for now)

- Existing Materialize dialogs remain for backwards compatibility until the wizard is proven.

## Migration strategy

1. Add the wizard modal and a new menu/entry point (or feature flag) to test it.
2. Confirm the wizard supports the full happy path.
3. Replace the existing entry point to use the wizard by default.
4. Only then decide whether to delete or keep legacy modal templates.

## Testing strategy

### UI behaviour tests (wizard Step 1)

We already have JSDOM-based UI tests under `tests/ui/` (e.g. `slideIdsModal.test.js`) and a helper to inline HtmlService includes (`tests/helpers/htmlTemplateRenderer.js`). We should add a new UI suite for the wizard Step 1 behaviour once the wizard template exists.

Minimum behaviours to test:

- **Initial render**: select is disabled, shows a “Loading assignments…” placeholder option, spinner is visible, and primary action is disabled.
- **Server call is triggered after load**: `google.script.run.getAssignments(...)` (or the chosen backend function) is called on/after `DOMContentLoaded`.
- **Success path**: assignments options are inserted, spinner hidden/removed, select enabled.
- **Selection gating**: primary action remains disabled until a valid assignment is selected; becomes enabled once selection is non-empty.
- **Failure path**: error is surfaced (banner/snackbar/toast), spinner hidden/removed, select remains disabled (or a retry affordance is shown if we add one), and primary action stays disabled.
- **Cancel**: calls `google.script.host.close()`.

**Status:** Implemented in `tests/ui/assignmentWizardStep1.test.js`.

Implementation notes for tests:

- Stub `google.script.run` with a chainable mock supporting `withSuccessHandler` / `withFailureHandler`, mirroring existing UI tests.
- Prefer rendering the wizard template via `renderTemplateWithIncludes(...)` so BeerCSS vendor partials are inlined consistently.
- Keep assertions focused on DOM state and mock invocations (not BeerCSS internals).
- If the vendored BeerCSS JS is included in the wizard, ensure we vendor it in a form that runs as a classic script in HtmlService (no ESM `export` syntax), otherwise the UI template will not execute in Apps Script and JSDOM tests will fail similarly.

- If URL parsing logic is extracted into a pure JS module (Node-compatible), add Vitest tests covering:
  - URL shapes for Slides/Docs/Sheets
  - Drive links and unknown types
  - malformed inputs

If parsing stays inline in HtmlService only, keep it minimal and rely on manual verification.

## Open questions

- Should progress remain a separate progress modal, or become Step 3 of the wizard?
- Do we need to support both URLs and raw IDs in each field?
- Should we allow Docs/Sheets inputs anywhere in this flow, or strictly Slides?
- What is the authoritative server function for “fetch saved IDs for assignment” today, and do we need to adjust its response shape for the wizard?

## Progress update

### Completed

- Step 1 wizard UI exists in `src/AdminSheet/UI/AssessmentWizard.html`.
- The wizard fetches assignments after load using `google.script.run.withSuccessHandler/withFailureHandler`.
- A dedicated server helper `fetchAssignmentsForWizard()` returns a minimal `{ id, title }` list from the currently selected Classroom.
- Primary action gating is in place (button disabled until a non-empty assignment is selected).
- Cancel closes the dialog.
- Debug menu entry exists for testing.
- UI tests cover initial render, server call, success path, failure path, selection gating, and cancel.

### Styling findings (to reuse)

- Do not pass an empty string as the Apps Script modal title; the dialog may fail to render in some contexts.
- Reset `html, body` margins to avoid internal scrollbars.
- Prefer BeerCSS’s field structure (`div.field.label … select then label`) so suffix elements (e.g. `progress.circle`) align correctly.

## Stage 2 change: definition lookup before doc URLs/IDs

We want to move the definition existence check to immediately after assignment selection. If a matching definition exists, skip doc refresh/parsing and proceed straight to trigger creation. If none exists, present wizard choices to link to an existing definition (add alternates) or create a new one (pre-filled metadata), then continue to assessment. The first step of any new definition is collecting the document URLs (not raw IDs); the server will extract fileIds via GAS Drive helpers.

### Impacted flow and files (overview)

- Wizard UI: needs post-selection actions and new panels in [src/AdminSheet/UI/AssessmentWizard.html](src/AdminSheet/UI/AssessmentWizard.html).
- Wizard entry wiring: [src/AdminSheet/UI/99_BeerCssUIHandler.js](src/AdminSheet/UI/99_BeerCssUIHandler.js) and [src/AdminSheet/UI/97_globals.js](src/AdminSheet/UI/97_globals.js) must route Start to the new lookup flow.
- Server lookups: need a lightweight “definition by assignment” endpoint (no doc IDs) in [src/AdminSheet/y_controllers/AssignmentDefinitionController.js](src/AdminSheet/y_controllers/AssignmentDefinitionController.js) surfaced via the assignment globals file [src/AdminSheet/Assignment/globals.js](src/AdminSheet/Assignment/globals.js) (per-class globals pattern). Wizard-facing calls should return the full partial definition field set.
- Trigger path: ensure `triggerProcessSelectedAssignment` still receives a persisted definition key and doc IDs before execution. Relevant pieces live in [src/AdminSheet/y_controllers/AssignmentController.js](src/AdminSheet/y_controllers/AssignmentController.js) and [src/AdminSheet/AssignmentProcessor/globals.js](src/AdminSheet/AssignmentProcessor/globals.js).
- Legacy doc-ID modal: keep compatibility in [src/AdminSheet/UI/SlideIdsModal.html](src/AdminSheet/UI/SlideIdsModal.html) and its handlers until wizard fully replaces it.
- Tests: expand UI tests in tests/ui (e.g. new wizard panels) and controller tests for new lookup/link/create behaviours.

### Behavioural changes to design

- After assignment selection:
  - Compute definition key inputs (title/topic/yearGroup) using Classroom courseWork + ABClass, without requiring doc IDs.
  - Call new “check definition” endpoint; do not invoke `ensureDefinition` here because it requires doc IDs and runs Drive parsing.
- If definition exists:
  - Skip refresh parsing; proceed to scheduling the time-based trigger. Doc freshness will be validated post-`triggerProcessSelectedAssignment` as today.
  - Bypass doc-ID entry unless needed for the trigger payload; definitions are guaranteed to include doc IDs (validated elsewhere).
- If definition is missing:
  - Show a new wizard panel explaining no matching definition exists (copy: “This Assignment has changed recently. Please review the changes before proceeding.” when stale flag applies).
  - Offer two options:
    - **Link to existing definition**: select from existing definitions (full partial field set), append to `alternateTitles` / `alternateTopics`, then continue.
    - **Create new definition**: open a form with `primaryTitle`, `primaryTopic`, `yearGroup` pre-filled from the selected assignment; collect reference/template URLs (not raw IDs), extract IDs via Drive helpers, validate MIME, then continue to assessment setup.

### Likely implementation tasks

- Add wizard state machine to handle steps: `selectAssignment` → `definitionCheck` → `definitionFound` (fast path to trigger) or `definitionMissing` (link/create panel) → doc URL capture → trigger start.
- Extend wizard HTML with new panels/fieldsets for:
  - Missing-definition notice and actions (link vs create) plus stale flag banner when `TaskDefinitionsChanged`.
  - Link flow: client-side filter + list of definitions (last 10 shown by default), showing the full partial definition fields.
  - Create flow: form for title/topic/yearGroup (pre-populated, editable) and reference/template URL inputs; client-side URL parsing and type check; server-side ID extraction and MIME validation.
- Wire Start/Continue buttons to new server calls (Apps Script run) and handle success/failure states with clear messages; disable to prevent double clicks.
- Add a server endpoint to fetch definition presence and summary data (safe to call without doc IDs) and return the full partial definition field set.
- Add a server endpoint to link an assignment to an existing definition by updating `alternateTitles`/`alternateTopics` and persisting.
- Add a server endpoint to create a new definition (metadata + doc URLs → server extracts IDs, validates MIME, persists); doc IDs are mandatory, no fallbacks.
- Ensure trigger scheduling still writes necessary properties (definitionKey, doc IDs) before invoking `triggerProcessSelectedAssignment`.
- Maintain backward compatibility with Materialize flow until flag/rollout decision.

### Risks and watchpoints

- `ensureDefinition` today requires doc IDs and Drive access; calling it early will throw. New lookup must avoid Drive/Classroom fetch of doc contents.
- Doc ID persistence: trigger run expects a saved definition with doc IDs; collect and persist from URLs before scheduling; stored definitions must always contain doc IDs.
- Definition freshness: skipping `definitionNeedsRefresh` until after trigger may delay task re-parse; use stale flag (`TaskDefinitionsChanged`) to warn users inline.
- Topic/yearGroup resolution relies on Classroom courseWork and ABClass; ensure these are available in the selection step to build keys.
- UI complexity: multiple new panels increase JS surface; keep state simple and testable (mocked `google.script.run`).
- Concurrency/race: avoid double-click races on Start/Continue; disable buttons during requests.
- Naming: choose a user-friendly label for “assignment definition” in the UI.

### Decisions from clarifications

- Terminology: Use “Assignment” throughout the wizard (including missing-definition notice and link/create panels).
- Stale definitions: Add boolean `TaskDefinitionsChanged` on AssignmentDefinition (and partial JSON) when refresh changes a TaskDefinition key; user copy: “This Assignment has changed recently. Please review the changes before proceeding.”
- Fast path doc IDs: Stored definitions always include doc IDs (validated elsewhere). No fallbacks to missing IDs.
- Link existing list: Sort by most recently updated; show the last 10 updated definitions by default with a search/filter. Fetch all definitions once from the backend (JsonDbApp is slow) and filter on the client.
- Create flow and doc types: Allow Slides or Sheets; reference and template must match. Front-end checks URL patterns; server extracts fileIds from URLs using GAS Drive APIs and validates MIME.
- Rollout: Keep wizard as separate menu during testing; remove legacy Materialize flow once stable (no legacy fallback needed afterward).
- Editing topic/yearGroup: Editable; changes are stored as alternates on the existing AssignmentDefinition rather than overwriting definitions.
- Alternates handling: Normalise (trim, lowercase), de-duplicate, warn inline if duplicates/conflicts; do not block. No ABLogger call for these warnings.

### Additional implementation notes from decisions

- Validation hardening: Extend partial definition validation to enforce presence of reference/template IDs; add a wizard fallback to doc capture only if validation ever fails in production.
- Stale flag plumbing: Add a boolean to AssignmentDefinition and its partial shape; persist it; notify users in the wizard when set. Update docs/developer/DATA_SHAPES.md accordingly.
- Lookup/search UX: Implement most-recent-first ordering with default “last 10” view plus client-side search. If BeerCSS lacks a search-with-dropdown widget, build a simple filter input + list.
- URL/fileId helpers: Add GoogleDrive helpers to derive fileId (and optionally mime inference) from URLs via GAS Drive APIs to support doc-type validation.
- Doc-type gating: Wizard should confirm reference/template are the same type (Slides or Sheets); block mismatched types client-side and re-validate server-side during parsing.
- User messaging: When stale-flag is true, surface a clear inline banner before proceeding; do not block runs.

### Detailed change list (files, methods, parameters)

- [src/AdminSheet/UI/AssessmentWizard.html](src/AdminSheet/UI/AssessmentWizard.html)
  - Extend wizard to multi-step state machine: `selectAssignment` → `definitionCheck` → `definitionFound` (fast trigger) or `definitionMissing` (link/create) → `collectDocUrls` → `starting`.
  - Add new panels/fieldsets:
    - Definition found fast-path summary (shows partial definition fields, stale banner when `TaskDefinitionsChanged`).
    - Definition missing panel with actions: “Link existing” (list + filter) and “Create new” (prefilled form + doc URL inputs).
  - Client handlers (new functions): `startDefinitionCheck()`, `handleDefinitionFound(payload)`, `handleDefinitionMissing()`, `renderDefinitionList(defs)`, `filterDefinitions(query)`, `handleLinkSubmit(selection)`, `handleCreateSubmit(formState)`, `showStaleBanner()`, `showDocUrlErrors()`, `handleStartTrigger(definitionKey)`.
  - Inputs: reference/template URL fields; client URL parsing (extract ID if possible, infer type), doc-type match check; inline warnings for duplicate alternates; disable buttons during requests; single `status` output reused for errors.
  - Data returned from server for definition check and list must include full partial definition field set (see DATA_SHAPES) plus `TaskDefinitionsChanged`.

- [src/AdminSheet/UI/99_BeerCssUIHandler.js](src/AdminSheet/UI/99_BeerCssUIHandler.js)
  - Keep `showAssessmentWizard` but adjust dialog size if needed; ensure it renders updated template (no new params expected yet).

- [src/AdminSheet/UI/97_globals.js](src/AdminSheet/UI/97_globals.js)
  - Expose new wizard-facing globals using `Validate.requireParams`:
    - `checkDefinitionForAssignment(assignmentId)` → calls assignment globals facade; returns `{ exists, definition: partialDefinition, assignmentMeta }`.
    - `listAllDefinitionsForWizard()` → fetches all partial definitions (client filters/shows last 10 most recent).
    - `linkAssignmentToDefinition(payload)` where payload includes `definitionKey`, `alternateTitle`, `alternateTopic` (normalised server-side).
    - `createDefinitionFromUrls(payload)` where payload includes `assignmentId`, `primaryTitle`, `primaryTopic`, `yearGroup`, `documentType`, `referenceUrl`, `templateUrl`.
    - `startAssessmentFromWizard(assignmentId, definitionKey)` → fast path to trigger creation.

- [src/AdminSheet/Assignment/globals.js](src/AdminSheet/Assignment/globals.js) (per-class globals surface)
  - Implement the same functions above, delegating to controllers. Ensure logging contract (ProgressTracker for user-facing errors, ABLogger for dev as needed).

- [src/AdminSheet/y_controllers/AssignmentDefinitionController.js](src/AdminSheet/y_controllers/AssignmentDefinitionController.js)
  - Add `checkDefinitionByAssignment({ courseId, assignmentId })` → builds key from coursework + ABClass yearGroup, returns partial definition (full field set) with `TaskDefinitionsChanged` if present.
  - Add `listAllPartialDefinitions()` → returns every partial definition sorted most-recent-first (use existing JsonDb collection; fetch once, sorting server-side or in controller). Client will filter and show last 10 by `updatedAt`.
  - Add `linkAssignmentToDefinition({ definitionKey, alternateTitle, alternateTopic })` → normalise (trim/lowercase), de-duplicate alternates, persist via `saveDefinition`.
  - Add `createDefinitionFromUrls({ assignmentId, courseId, primaryTitle, primaryTopic, yearGroup, documentType, referenceUrl, templateUrl })` → extract fileIds via Drive helpers, validate MIME match, invoke `ensureDefinition` to create/persist.
  - Ensure partial validation enforces presence of reference/template IDs (no fallbacks) and includes `TaskDefinitionsChanged` when set.

- [src/AdminSheet/Models/AssignmentDefinition.js](src/AdminSheet/Models/AssignmentDefinition.js)
  - Add boolean `TaskDefinitionsChanged` to constructor, `toJSON`, `toPartialJSON`, `fromJSON`.
  - Retain tasks:null invariant for partials; validation already requires doc IDs—keep strict.

- [src/AdminSheet/y_controllers/AssignmentController.js](src/AdminSheet/y_controllers/AssignmentController.js)
  - Add wizard fast path `startAssessmentFromWizard({ assignmentId, definitionKey })` delegating to `startProcessing` without doc re-entry.
  - Add helper `createDefinitionAndStart({ assignmentId, courseId, urlsPayload })` that calls `createDefinitionFromUrls` (controller above), then `startProcessing` with returned definitionKey.
  - Keep legacy `saveStartAndShowProgress` for Materialize modal; do not regress existing behaviour.

- [src/AdminSheet/AssignmentProcessor/globals.js](src/AdminSheet/AssignmentProcessor/globals.js)
  - Optionally expose `startProcessingFromWizard(assignmentId, definitionKey)` if needed by UI, delegating to `AssignmentController.startProcessing`.

- [src/AdminSheet/UI/SlideIdsModal.html](src/AdminSheet/UI/SlideIdsModal.html)
  - No functional change; ensure coexistence until legacy flow is removed.

- Drive helpers (existing module to re-use; add only if missing)
  - Utility to extract fileId and MIME from URL using GAS Drive APIs; used by `createDefinitionFromUrls` to enforce type match.

- Tests
  - UI: extend/add suites under `tests/ui/` for definition found/missing flows, link/create panels, stale banner, doc URL validation, double-click disable, and error paths.
  - Controllers: add tests for `checkDefinitionByAssignment`, `listAllPartialDefinitions`, `linkAssignmentToDefinition`, `createDefinitionFromUrls`, and `startAssessmentFromWizard` fast path.
  - If URL parsing helper is factored into pure JS, add unit tests for Slides/Sheets/Docs shapes, drive links, malformed inputs.
