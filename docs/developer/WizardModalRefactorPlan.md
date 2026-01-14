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

### Codebase facts (confirmed)

- The wizard already fetches partial definitions via `getAllPartialDefinitions()` (global in `src/AdminSheet/y_controllers/globals.js`).
- The current wizard state already includes `assignments`, `selectedAssignmentId`, and `definitions` (see `src/AdminSheet/UI/AssessmentWizard.html`).
- Definition keys are built by `AssignmentDefinition.buildDefinitionKey()` using the format `${primaryTitle}_${primaryTopic}_${yearGroup || 'null'}` (see `src/AdminSheet/Models/AssignmentDefinition.js`).
- Partial definitions currently include `referenceDocumentId` and `templateDocumentId` in `toPartialJSON()`, but `_validatePartial()` does **not** require these IDs.
- Document type validation currently lives in `AssignmentController._detectDocumentType()` and uses Drive MIME types (Slides/Sheets only).
- The legacy start path is `saveStartAndShowProgress()` in `src/AdminSheet/AssignmentProcessor/globals.js`.

### Styling findings (to reuse)

- Do not pass an empty string as the Apps Script modal title; the dialog may fail to render in some contexts.
- Reset `html, body` margins to avoid internal scrollbars.
- Prefer BeerCSS’s field structure (`div.field.label … select then label`) so suffix elements (e.g. `progress.circle`) align correctly.

## Step 2 (current focus): definition lookup + document URLs

This section replaces all scattered notes with a single, unambiguous plan for Step 2. It is the only source of truth for this phase.

### Step 2 goal

After assignment selection, determine whether a matching Assignment Definition already exists. If it exists, proceed directly to the trigger. If it does not exist, let the user either link to an existing definition or create a new one by providing document URLs. All doc IDs are derived server-side from URLs.

### Step 2 in-scope behaviour

1. **Definition lookup immediately after selection**

- Fetch assignments and all partial Assignment Definitions to the wizard up-front (single call each).
- Build the definition key inputs from Classroom courseWork (title + topic) + ABClass yearGroup.
- Perform matching on the client using `primaryTitle`, `alternateTitles`, **and** topic/yearGroup to align with the actual definition key logic.

2. **Definition exists (fast path)**
   - Show a summary panel with partial definition details.
   - If `TaskDefinitionsChanged` is true, show a non-blocking warning banner.
   - Start the assessment trigger without re-entering doc IDs.
3. **Definition missing (user choice)**
   - Show a panel with two actions:
     - **Link existing** definition (adds alternates and continues).
     - **Create new** definition (collect URLs; server extracts IDs and validates MIME type).
4. **Document URL capture (create only)**
   - Reference and template URLs must be the same type (Slides or Sheets).
   - Client provides light inference; server performs final validation.
5. **Trigger scheduling**
   - Always persist a definition with doc IDs before scheduling the trigger.

### Step 2 out of scope

- Replacing the legacy Materialize flow (still supported).
- Adding a progress step inside the wizard.
- Any broader UI restyling outside the wizard panels.

### Step 2 state machine (wizard)

`selectAssignment` → `definitionCheck` → `definitionFound` → `starting`

`selectAssignment` → `definitionCheck` → `definitionMissing` → `linkExisting` → `starting`

`selectAssignment` → `definitionCheck` → `definitionMissing` → `createNew` → `collectDocUrls` → `starting`

### Step 2 decisions (locked)

- Terminology: use “Assignment” in all user-facing copy.
- `TaskDefinitionsChanged` is a boolean on `AssignmentDefinition` and in partial JSON.
- Stored definitions always include doc IDs (no fallbacks).
- Link list sorted by most recently updated; show last 10 by default with client-side filter.
- Create flow accepts Slides or Sheets, but reference and template must match types.
- Topic handling must remain consistent with backend: use the **topic name** (not topicId) when building definition keys.
- Assignments without a topic are **not** supported in this flow (backend requires `primaryTopic`).
- Alternate title/topic handling: normalise (trim + lowercase), de-duplicate, warn inline, do not block.
- Reuse `AssignmentController._detectDocumentType()` for MIME validation once document IDs are extracted server-side.
- Link-existing updates `alternateTopics` only when the topic differs from `primaryTopic`.
- Reuse `startProcessing()` for the wizard start path after definition persistence.

### Step 2 action plan (ordered and explicit)

1. **Wizard UI: add Step 2 panels and state machine**

- Extend wizard state and transitions.
- Add panels for: definition found, definition missing (link/create), create form, and doc URL capture.
- Disable buttons during server calls to prevent double submits.

2. **Wizard UI: add client handlers and matching**

- Fetch assignments and partial definitions on init.
- Fetch assignments and partial definitions on init.
- Add client-side matching for `primaryTitle`, `alternateTitles`, and topics/yearGroup (definition key parity).
- Keep URL parsing inline in the template for now (no shared module yet).

2a. **Assignment metadata gap (resolve before matching)**

- Extend `fetchAssignmentsForWizard()` to return `topicName` (and keep `title`/`id`).
- Derive `topicName` server-side to align with backend keys (`AssignmentDefinition` uses topic name, not ID).

3. **UI globals (wizard-facing server calls)**

- Add functions in UI globals to call controller globals and validate required params.
- No definition lookup endpoint is required; the wizard matches locally.

4. **Controller globals (existing location)**

- Extend `src/AdminSheet/y_controllers/globals.js` with facade methods that delegate to controllers with the logging contract.
- Keep `getAllPartialDefinitions()` as the wizard list endpoint.

5. **AssignmentDefinitionController**

- Add list-all, link, and create-from-URLs methods.
- Enforce reference/template IDs in partial validation (see mismatch noted above).

5a. **URL → ID extraction (server)**

- There is no shared URL parsing helper yet. Add a small utility (or controller-local helper) to extract a Drive file ID from:
  - `/presentation/d/<id>` (Slides)
  - `/spreadsheets/d/<id>` (Sheets)
  - `/document/d/<id>` (Docs)
  - `open?id=<id>` and `drive.google.com` variants
- Use `ConfigurationManager.DRIVE_ID_PATTERN` or `DriveManager.isValidGoogleDriveFileId()` for format validation.
- After extraction, reuse `AssignmentController._detectDocumentType()` for MIME validation and matching reference/template types.

6. **AssignmentDefinition model**

- Add `TaskDefinitionsChanged` to serialisation and partials.

7. **AssignmentController / trigger path**

- Add wizard fast-path start, ensuring definition key + doc IDs are persisted first.

8. **Docs and data shapes**

- Update DATA_SHAPES for `TaskDefinitionsChanged` in partials.

9. **Testing (delegated)**

- UI tests under `tests/ui/` and controller tests under `tests/` (delegated to Testing Specialist).

### Step 2 detailed change list (files, classes, methods)

#### UI template and client handlers

- [src/AdminSheet/UI/AssessmentWizard.html](src/AdminSheet/UI/AssessmentWizard.html)
  - **New/updated sections**: Step 2 panels and shared status area.
  - **New/updated client functions**:
    - `fetchAssignments()`
    - `fetchPartialDefinitions()`
    - `matchDefinitionForAssignment(assignment, definitions)`
    - `handleDefinitionFound(payload)`
    - `handleDefinitionMissing(payload)`
    - `renderDefinitionList(definitions)`
    - `filterDefinitions(query)`
    - `handleLinkSubmit(selection)`
    - `handleCreateSubmit(formState)`
    - `validateDocUrls(referenceUrl, templateUrl)`
    - `showStaleBanner()`
    - `handleStartTrigger(definitionKey)`
  - **Data requirements**:
    - Partial definition payload must include reference/template IDs and `TaskDefinitionsChanged`.
  - **UI rules**:
    - Disable primary action while requests are in flight.
    - Keep warnings non-blocking for duplicate alternates.

#### UI entry wiring

- [src/AdminSheet/UI/99_BeerCssUIHandler.js](src/AdminSheet/UI/99_BeerCssUIHandler.js)
  - `showAssessmentWizard()` remains the entry point; adjust dialog size if needed.

- [src/AdminSheet/UI/97_globals.js](src/AdminSheet/UI/97_globals.js)
  - **New global functions (Validate.requireParams)**:
    - `listAllDefinitionsForWizard()`
    - `linkAssignmentToDefinition(payload)`
    - `createDefinitionFromUrls(payload)`
    - `startAssessmentFromWizard(assignmentId, definitionKey)`

#### Controller globals (per-class facade)

- [src/AdminSheet/y_controllers/globals.js](src/AdminSheet/y_controllers/globals.js)
  - **New facade methods** mirroring the UI globals above and delegating to controllers.
  - Ensure ProgressTracker usage for user-facing failures.
  - Keep existing `getAllPartialDefinitions()` in place for wizard data loading.

#### Assignment processing globals (existing trigger path)

- [src/AdminSheet/AssignmentProcessor/globals.js](src/AdminSheet/AssignmentProcessor/globals.js)
  - Retain `saveStartAndShowProgress()` for the legacy modal flow.
  - Add a wizard-specific entry only if we cannot reuse the existing `startProcessing()` + definition persistence flow.

#### Controllers

- [src/AdminSheet/y_controllers/AssignmentDefinitionController.js](src/AdminSheet/y_controllers/AssignmentDefinitionController.js)
  - **New methods**:
    - `listAllPartialDefinitions()`
    - `linkAssignmentToDefinition({ definitionKey, alternateTitle, alternateTopic })`
    - `createDefinitionFromUrls({ assignmentId, courseId, primaryTitle, primaryTopic, yearGroup, documentType, referenceUrl, templateUrl })`
  - **Updated behaviour**:
    - Enforce partials must include reference/template IDs.
    - Include `TaskDefinitionsChanged` in partial output.

- [src/AdminSheet/y_controllers/AssignmentController.js](src/AdminSheet/y_controllers/AssignmentController.js)
  - **New method**:
    - `startAssessmentFromWizard({ assignmentId, definitionKey })`
  - **New helper**:
    - `createDefinitionAndStart({ assignmentId, courseId, urlsPayload })`
  - Legacy paths remain unchanged.

#### Models

- [src/AdminSheet/Models/AssignmentDefinition.js](src/AdminSheet/Models/AssignmentDefinition.js)
  - Add `TaskDefinitionsChanged` to constructor, `toJSON`, `fromJSON`, and `toPartialJSON`.

#### Optional globals for trigger path

- [src/AdminSheet/AssignmentProcessor/globals.js](src/AdminSheet/AssignmentProcessor/globals.js)
  - If needed, add `startProcessingFromWizard(assignmentId, definitionKey)` delegating to `AssignmentController.startProcessing`.

#### Utilities / Drive helpers

- Drive helper module (existing location to reuse if present)
  - Add or extend helper to extract fileId and validate MIME type from URLs.
  - Used only by `createDefinitionFromUrls`.

#### Documentation updates

- [docs/developer/DATA_SHAPES.md](docs/developer/DATA_SHAPES.md)
  - Add `TaskDefinitionsChanged` to AssignmentDefinition and partial definition shape.

#### Testing (delegated)

- UI: new wizard Step 2 tests in tests/ui.
- Controllers: new tests under tests/ for the new controller methods.
- URL parsing tests only if parsing is extracted into a shared JS module.
