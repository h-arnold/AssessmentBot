# ACTION_PLAN

## Goal

Design and expose a backend service for the Assessment Wizard Step 3 submit that accepts reference/template document URLs, validates and normalises them to Drive IDs, detects Slides vs Sheets, and creates a new AssignmentDefinition populated with TaskDefinitions. The service must return a full AssignmentDefinition payload (with tasks and artifacts) for Step 4 weightings without starting the assessment run.

## Assumptions (confirmed)

- Step 3 is only invoked after a Classroom assignment exists and has been selected.
- Assignments must have topics; missing topics should fail fast server-side.

## Constraints

- Use existing controller pipeline for creation; do not duplicate parsing logic.
- Validate required parameters with `Validate.requireParams()`; no defensive guards for internal APIs.
- Use British English in new comments/messages.
- Fail fast or surface errors via `ProgressTracker.getInstance().logError(...)` as per logging contract.
- No UI changes in this plan; delegate UI/test changes to the appropriate sub-agents.
- Keep changes minimal (KISS) and aligned with existing patterns.

## Decision (normalisation path)

- Use the type-aware `openByUrl` validation path with a raw ID fast-path.
- The wrapper will require inferred types from the client for reference and template inputs.

## Acceptance Criteria

- A global backend wrapper exists for the wizard Step 3 submit and is callable from the UI.
- The wrapper accepts URLs or raw IDs and always normalises to Drive IDs server-side.
- Reference and template IDs are validated server-side and must be different.
- Slides and Sheets inputs are supported; mismatched types are rejected with a clear error.
- The wrapper returns a full `AssignmentDefinition` payload including `tasks`.
- The wrapper requires `assignmentId` for Classroom context and rejects assignments without topics.
- Existing extraction pipeline is used (no duplicate parsers or alternative pathways).
- New tests (delegated) cover success and failure paths for the wrapper and URL/ID normalisation.

## Current Extraction Pipeline (to reuse)

- `AssignmentController.ensureDefinitionFromInputs()` handles document IDs, detects type, and delegates to the definition controller.
- `AssignmentController._detectDocumentType()` validates Drive MIME type and enforces matching document types.
- `AssignmentDefinitionController.ensureDefinition()` triggers task parsing and persistence.
- `AssignmentDefinitionController._parseTasks()` routes to Slides or Sheets parsing.
- `SlidesParser.extractTaskDefinitions()` / `SheetsParser.extractTaskDefinitions()` build `TaskDefinition` instances.

## Current Wizard Step 3 Behaviour (to account for)

- `AssessmentWizard.html` currently calls `saveStartAndShowProgress()` with raw URL inputs in
  `referenceDocumentId` / `templateDocumentId` fields.
- The client only infers type from URL shape; it does not extract Drive IDs or send inferred types to the server.
- `AssignmentController._detectDocumentType()` calls `DriveApp.getFileById()` and will throw on raw URLs.
- The new backend wrapper must normalise URLs to IDs before any DriveApp access and must not start the assessment run.

## Files to Change

- ACTION_PLAN.md (this document)
- src/AdminSheet/AssignmentProcessor/globals.js
  - Add a new global function wrapper for Step 3 submission.
- src/AdminSheet/Utils/Validate.js or src/AdminSheet/GoogleDriveManager/DriveManager.js
  - Add a small helper to normalise URLs/IDs to Drive IDs if no suitable method exists.
- src/AdminSheet/y_controllers/AssignmentController.js
  - Add server-side enforcement that reference and template IDs are different (if not already present).

## New Functions/Methods to Create

1. Global wrapper (AssignmentProcessor globals)
   - Name: `createDefinitionFromWizardInputs` (exact name to align with UI call).
   - Responsibilities:
     - Validate required parameters via `Validate.requireParams()`.
     - Normalise URLs/IDs to Drive IDs.
     - Enforce reference/template IDs are different.
     - Call `AssignmentController.ensureDefinitionFromInputs()`.
     - Return `AssignmentDefinition.toJSON()` (full payload).

2. URL/ID normaliser helper
   **Note:** Use DriveManager here. There is no DriveApp helper to extract IDs from URLs, so either use a pure string parser or a type-aware `openByUrl` validation step.
   - Location: `DriveManager` (choose the most aligned existing utility).
   - Responsibilities:
     - Accept raw input (URL or ID).
     - Extract Drive file ID when possible.
     - Return the raw ID unchanged if already in ID form.
     - Throw or return a clear error when extraction fails.
   - Validation/normalisation options:
     - Preferred minimal path: use `DriveManager.isValidGoogleDriveFileId()` as a format check, then parse URL shapes like `/d/<id>`, `open?id=<id>`, and `?id=<id>`.
     - Alternative (type-aware validation): if the client provides an inferred type, call `SlidesApp.openByUrl()` or `SpreadsheetApp.openByUrl()` to validate the URL and use `getId()` from the returned document. This still requires the raw ID fast-path for inputs already in ID form.
     - In both cases, keep `_detectDocumentType()` as the authoritative server-side type check.

## Implementation Stages

### Stage 1: Confirm entry points and current validators (read-only)

- Verify the full call chain in controller and parser classes.
- Confirm the current wizard Step 3 client request shape.
- Output: Clear mapping of inputs required by `AssignmentController.ensureDefinitionFromInputs()`.
  - Required inputs should include: `assignmentId`, `assignmentTitle` (fallback), `documentIds.referenceDocumentId`, `documentIds.templateDocumentId`.
  - Confirm topic requirement: `AssignmentDefinitionController.ensureDefinition()` fails if `topicId` does not resolve to a topic name.
  - Confirm client does not currently send inferred types; plan a UI update to include them.

### Stage 2: Add server-side URL/ID normalisation helper

- Implement the normaliser in the chosen utility file.
- Ensure it is a small, reusable function with a single responsibility.
- Output: Helper available for the new global wrapper.
  - Decide whether to use the pure parsing path or the type-aware `openByUrl` path (requires inferred type input).

### Stage 3: Add the wizard Step 3 global wrapper

**Note**: The wizard step 3 already exists and has client side validation of the supplied template and reference URLs. The server side must validate using DriveApp after normalisation. Check `AssessmentWizard.html` for current submission wiring.

- Implement `createDefinitionFromWizardInputs` in `src/AdminSheet/AssignmentProcessor/globals.js`.
- Apply `Validate.requireParams()` for required inputs.
- Use the normaliser helper for both reference and template inputs.
- Enforce reference/template IDs are different.
- Call `AssignmentController.ensureDefinitionFromInputs()` and return full JSON.
- Output: A callable global entry point for the wizard Step 3 submit.
  - Ensure the wrapper takes `assignmentId` (required) and `assignmentTitle` (fallback) plus raw document inputs.
  - Build the `documentIds` object expected by `ensureDefinitionFromInputs()`.
  - Do not start any triggers or call `saveStartAndShowProgress()` from this wrapper.
  - If using `openByUrl` normalisation, require the client to pass inferred document types for both inputs.
  - UI dependency (delegate): update the wizard submission payload to include inferred types for reference/template inputs.

### Stage 4: Server-side validation parity

- If not already enforced in controller layer, add a server-side check for identical IDs to fail fast.
- Output: Consistent server-side enforcement even if the client bypasses checks.
  - Keep topic enforcement in place (assignment must have a resolved topic name).

### Stage 5: Tests (delegate to Testing Specialist)

- Provide the new helper and wrapper signatures and expected behaviours.
- Define test cases and mocks based on existing testing patterns.
- Output: Tests covering the new functionality.

## Test Cases (for delegation)

- URL/ID normaliser
- URL/ID normaliser
- Valid Slides URL -> extracted ID.
- Valid Sheets URL -> extracted ID.
- Raw ID input -> unchanged.
- Malformed URL -> error.
- URL with /edit and query params -> correct ID extraction.
- If using `openByUrl` validation: invalid type-specific URL -> error from the respective Apps Script service.
- Global wrapper success
  - Slides reference/template inputs -> returns full AssignmentDefinition with populated tasks.
  - Sheets reference/template inputs -> returns full AssignmentDefinition with populated tasks.
- Global wrapper failure
  - Missing reference or template input -> error.
  - Reference and template inputs identical -> error.
  - Mismatched document types -> error.
  - Invalid Drive ID -> error from DriveApp access.
  - Assignment without topic -> error (enforced server-side).
- Contract verification
  - Response contains `tasks` (not null), ensuring full definition payload for Step 4.

## Notes

- No UI changes are included here. If the Step 3 modal needs to call the new wrapper, that work must be delegated to the UI Specialist.
- Testing must be delegated to the Testing Specialist and should follow existing Vitest patterns and mocks.
