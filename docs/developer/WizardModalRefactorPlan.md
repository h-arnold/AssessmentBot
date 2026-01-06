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

- A new wizard HtmlService template, e.g. `src/AdminSheet/UI/AssessWizard.html` (name TBD).
- A vendored BeerCSS JS partial, e.g. `src/AdminSheet/UI/vendor/beercss/BeerCssJs.html` (name TBD).

### Update

- A UI entry-point function (likely in `src/AdminSheet/UI/97_globals.js`) to open the wizard instead of opening separate modals.
- Potentially `src/AdminSheet/UI/98_UIManager.js` if it owns modal plumbing for the flow.

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
