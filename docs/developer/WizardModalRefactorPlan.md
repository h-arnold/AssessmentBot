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

**Status:** Not yet implemented. See "Step 2 Implementation Plan" below.

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
- Removed the Step 2 "Definition found" panel and implemented an **auto-start fast-path**: when a matching partial definition with both doc IDs is found, the wizard starts the assessment immediately, opens the progress modal, and closes. New UI tests were added to assert matching + auto-start behaviour and that warnings (`TaskDefinitionsChanged`) do not block the fast-path.

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

## Step 2 Implementation Plan

### Overview

Step 2 allows users to provide Google Drive document links or IDs for reference and template documents. The wizard validates inputs client-side, extracts IDs from URLs, infers document types where possible, and delegates to the server for final validation and persistence.

### UI Components

#### New HTML Template

- **File**: `src/AdminSheet/UI/AssessmentWizard.html` (extend existing template)
- **Structure**: Add Step 2 panel alongside existing Step 1 panel
- **Form Fields**:
  - Reference document input (text field accepting URLs or IDs)
  - Template document input (text field accepting URLs or IDs)
  - Real-time feedback area showing extracted IDs and inferred types
  - Validation error display
- **Navigation**: "Back" button returns to Step 1, "Next"/"Submit" button triggers server validation
- **State Management**: Wizard state object extended with `documents` property

#### Client-Side Behaviour

**URL Parsing Logic** (inline in wizard template initially):

```javascript
function parseGoogleUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) return { id: null, inferredType: null };

  // Pattern 1: /presentation/d/<id> → Slides
  const slidesMatch = trimmed.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (slidesMatch) return { id: slidesMatch[1], inferredType: 'SLIDES' };

  // Pattern 2: /spreadsheets/d/<id> → Sheets
  const sheetsMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheetsMatch) return { id: sheetsMatch[1], inferredType: 'SHEETS' };

  // Pattern 3: /document/d/<id> → Docs (not supported yet)
  const docsMatch = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docsMatch) return { id: docsMatch[1], inferredType: 'DOCS' };

  // Pattern 4: drive.google.com or open?id= → unknown type
  const driveMatch = trimmed.match(/(?:drive\.google\.com|open\?id=).*?([a-zA-Z0-9_-]{25,})/);
  if (driveMatch) return { id: driveMatch[1], inferredType: 'unknown' };

  // Pattern 5: Raw ID (alphanumeric, underscores, hyphens, min length)
  if (/^[a-zA-Z0-9_-]{25,}$/.test(trimmed)) {
    return { id: trimmed, inferredType: 'unknown' };
  }

  return { id: null, inferredType: null };
}
```

**Real-Time Feedback**:

- As user types, parse input and display extracted ID
- Show inferred type (or "Unknown - will validate on server")
- Show error if ID cannot be extracted from input
- Disable submit button until both fields have extracted IDs

**Validation Rules**:

- Both reference and template IDs required
- IDs must be different (same client-side check as legacy `SlideIdsModal`)
- If types are inferred and differ, show warning (server will reject)

#### Wizard State Extension

Add to existing wizard state object:

```javascript
state: {
  step: 'selectAssignment' | 'enterDocuments' | 'starting',
  assignments: [],
  selectedAssignmentId: '',
  selectedAssignmentName: '', // NEW: store for Step 2 display
  documents: { // NEW
    reference: { raw: '', id: null, inferredType: null },
    template: { raw: '', id: null, inferredType: null }
  },
  status: { loading: boolean, errorMessage: string | null }
}
```

### Server-Side Components

#### New Server Functions

**File**: `src/AdminSheet/GoogleClassroom/globals.js`

```javascript
/**
 * Validates document IDs and types, then saves definition for wizard Step 2.
 * Called when user submits Step 2 form.
 *
 * @param {string} assignmentId - The Classroom assignment ID
 * @param {Object} documentIds - { referenceDocumentId, templateDocumentId }
 * @returns {Object} { success: boolean, definitionKey?: string, error?: string, documentType?: string }
 */
function validateAndSaveDocumentIds(assignmentId, documentIds) {
  try {
    // Validate IDs are different
    if (documentIds.referenceDocumentId === documentIds.templateDocumentId) {
      return {
        success: false,
        error: 'Reference and template document IDs must be different.',
      };
    }

    // Use existing AssignmentController logic
    const controller = new AssignmentController();
    const { definition } = controller.ensureDefinitionFromInputs({
      assignmentTitle: null,
      assignmentId,
      documentIds,
    });

    return {
      success: true,
      definitionKey: definition.definitionKey,
      documentType: definition.documentType,
    };
  } catch (err) {
    ABLogger.getInstance().error('validateAndSaveDocumentIds failed', err);
    return {
      success: false,
      error: err.message || 'Failed to validate documents',
    };
  }
}

/**
 * Fetches previously saved document IDs for an assignment.
 * Used by wizard Step 2 to pre-fill form.
 *
 * @param {string} assignmentId - The assignment ID
 * @returns {Object} { referenceDocumentId?: string, templateDocumentId?: string }
 */
function fetchSavedDocumentIds(assignmentId) {
  try {
    const courseId = ConfigurationManager.getInstance().getAssessmentRecordCourseId();
    const courseWork = Classroom.Courses.CourseWork.get(courseId, assignmentId);
    const topicId = courseWork?.topicId || null;
    const primaryTitle = courseWork?.title;
    const abClassController = new ABClassController();
    const abClass = abClassController.loadClass(courseId);
    const yearGroup = abClass?.yearGroup ?? null;
    const primaryTopic = topicId ? ClassroomApiClient.fetchTopicName(courseId, topicId) : null;

    const definitionKey = AssignmentDefinition.buildDefinitionKey({
      primaryTitle,
      primaryTopic,
      yearGroup,
    });

    const definition = new AssignmentDefinitionController().getDefinitionByKey(definitionKey);

    if (definition) {
      return {
        referenceDocumentId: definition.referenceDocumentId,
        templateDocumentId: definition.templateDocumentId,
      };
    }
    return {};
  } catch (err) {
    ABLogger.getInstance().warn('fetchSavedDocumentIds failed', err);
    return {};
  }
}
```

**Existing Components Referenced (No Changes)**:

- **`AssignmentController.ensureDefinitionFromInputs()`**: Already validates MIME types and creates definition
- **`AssignmentController._detectDocumentType()`**: Already validates reference/template types match

### Integration Points

#### Files to Modify

1. **`src/AdminSheet/UI/AssessmentWizard.html`**
   - Add Step 2 panel HTML
   - Add URL parsing function
   - Extend wizard state management
   - Add step transition logic

2. **`src/AdminSheet/GoogleClassroom/globals.js`**
   - Add `validateAndSaveDocumentIds()` function
   - Add `fetchSavedDocumentIds()` function

#### Files Referenced (No Changes)

- `src/AdminSheet/y_controllers/AssignmentController.js` - `ensureDefinitionFromInputs()` and `_detectDocumentType()` already handle validation
- `src/AdminSheet/y_controllers/AssignmentDefinitionController.js` - `ensureDefinition()` already handles persistence
- `src/AdminSheet/GoogleDriveManager/DriveManager.js` - `getFileModifiedTime()` used by definition controller
- `src/AdminSheet/Models/AssignmentDefinition.js` - Model handles persistence and validation
- `src/AdminSheet/UI/99_BeerCssUIHandler.js` - Wizard already wired via `showAssessmentWizard()`
- `src/AdminSheet/UI/97_globals.js` - No changes needed

### Testing Strategy

#### UI Behaviour Tests

**New test file**: `tests/ui/assignmentWizardStep2.test.js`

Minimum behaviours to test:

1. **Initial render from Step 1 selection**:
   - Step 2 panel hidden initially
   - Becomes visible when Step 1 primary action clicked
   - Shows selected assignment name from Step 1
   - Input fields are empty (or pre-filled if saved IDs exist for assignment)

2. **URL parsing**:
   - Slides URL → extracts ID, shows type "Slides"
   - Sheets URL → extracts ID, shows type "Sheets"
   - Drive link → extracts ID, shows type "Unknown"
   - Raw ID → accepts, shows type "Unknown"
   - Invalid input → shows error, disables submit

3. **Real-time feedback**:
   - As user types, feedback updates
   - Extracted ID displayed
   - Inferred type displayed
   - Submit button disabled until both IDs extracted

4. **Validation**:
   - Both fields required
   - IDs must differ (shows error if same)
   - Warning if inferred types differ

5. **Server call on submit**:
   - Calls `google.script.run.validateAndSaveDocumentIds()`
   - Loading state shown during call
   - Success: transitions to Step 3 or starts assessment
   - Failure: error banner shown, user can retry

6. **Navigation**:
   - "Back" button returns to Step 1 (preserves Step 1 state)
   - "Cancel" closes dialog

7. **Pre-fill from server**:
   - When Step 2 loads, calls `fetchSavedDocumentIds()`
   - Success: pre-fills inputs
   - Failure: shows warning, allows user to proceed with empty fields

#### Server-Side Unit Tests

**New test file**: `tests/controllers/assignmentController.wizardStep2.test.js`

1. **`validateAndSaveDocumentIds()` success path**:
   - Valid, different IDs → returns success with definitionKey
   - Calls `ensureDefinitionFromInputs()` correctly

2. **`validateAndSaveDocumentIds()` validation failures**:
   - Same IDs → returns error
   - Invalid file ID → returns error
   - MIME type mismatch → returns error
   - Missing file → returns error

3. **`fetchSavedDocumentIds()` success and failure paths**:
   - Existing definition → returns IDs
   - No definition → returns empty object
   - API failure → returns empty object (graceful degradation)

4. **MIME type validation** (via `_detectDocumentType()`):
   - Slides reference + Slides template → success
   - Sheets reference + Sheets template → success
   - Slides reference + Sheets template → error
   - Invalid MIME type → error

#### URL Parsing Unit Tests

**Option 1**: If parsing stays inline, test via UI test using JSDOM

**Option 2**: If extracted to separate module:

**New file**: `src/AdminSheet/Utils/GoogleUrlParser.js`
**New test file**: `tests/utils/googleUrlParser.test.js`

Test cases:

- Slides URLs (various formats)
- Sheets URLs (various formats)
- Docs URLs (unsupported type detection)
- Drive links (`drive.google.com/...`, `open?id=`)
- Raw IDs
- Malformed inputs
- Empty strings

### Migration from Legacy `SlideIdsModal`

**Current flow**:

1. User selects assignment from dropdown (`AssignmentDropdown.html`)
2. `openReferenceSlideModal()` shows `SlideIdsModal.html`
3. User enters IDs, clicks "Go"
4. Calls `saveStartAndShowProgress()`

**New flow**:

1. User opens Assessment Wizard
2. Step 1: Select assignment
3. Step 2: Enter document IDs (replaces `SlideIdsModal`)
4. Step 3: Start assessment (triggers processing)

**Backward Compatibility**:

- Keep `SlideIdsModal.html` until wizard proven
- Keep `openReferenceSlideModal()` functional
- Menu provides both options initially
- Once wizard stable, deprecate legacy modal

### Open Questions

**Q1**: Should we extract the URL parser into a reusable module, or keep it inline?

**Recommendation**: Start inline (KISS). Extract to `src/AdminSheet/Utils/GoogleUrlParser.js` only when:

- Reused in another context
- Needs comprehensive unit testing beyond JSDOM coverage

**Q2**: Should Step 2 support Docs inputs, or only Slides/Sheets?

**Current Answer**: Client can parse Docs URLs and extract IDs. Server-side `_detectDocumentType()` will reject Docs MIME type with clear error. This allows future extension without client changes.

**Q3**: Should we validate file permissions (user can access file) in Step 2?

**Recommendation**: No. Defer to actual processing stage. Step 2 only validates:

- ID extractable
- MIME type supported and consistent
- File exists

Permissions checked when parsing begins (existing behaviour).

**Q4**: Should the wizard transition to Step 3 (progress panel) or close and show existing `ProgressModal`?

**Deferred**: For Step 2 implementation, wizard closes and shows existing `ProgressModal` (same as legacy flow). Step 3 design is separate iteration.

**Q5**: How should wizard handle network failures when fetching saved IDs?

**Recommendation**: Show warning banner but allow user to proceed. Empty fields are valid (new assignment setup).

### Files Summary

#### New Files

- `tests/ui/assignmentWizardStep2.test.js` - UI behaviour tests
- `tests/controllers/assignmentController.wizardStep2.test.js` - Server validation tests
- (Optional) `src/AdminSheet/Utils/GoogleUrlParser.js` - URL parser module
- (Optional) `tests/utils/googleUrlParser.test.js` - Parser unit tests

#### Modified Files

- `src/AdminSheet/UI/AssessmentWizard.html` - Add Step 2 panel and logic
- `src/AdminSheet/GoogleClassroom/globals.js` - Add `validateAndSaveDocumentIds()` and `fetchSavedDocumentIds()`

#### Referenced (No Changes)

- `src/AdminSheet/y_controllers/AssignmentController.js`
- `src/AdminSheet/y_controllers/AssignmentDefinitionController.js`
- `src/AdminSheet/GoogleDriveManager/DriveManager.js`
- `src/AdminSheet/Models/AssignmentDefinition.js`
- `src/AdminSheet/UI/99_BeerCssUIHandler.js`
- `src/AdminSheet/UI/97_globals.js`

#### Legacy (Keep for Now)

- `src/AdminSheet/UI/SlideIdsModal.html` - Original modal (deprecated when wizard stable)
- `tests/ui/slideIdsModal.test.js` - Legacy tests (keep until migration complete)
