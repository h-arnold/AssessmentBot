# Wizard Modal Refactor - Step 2 Review Summary

## Executive Summary

This document provides a comprehensive review of the Wizard Modal Refactor Plan, specifically focusing on Step 2 implementation requirements. The review identified missing components, validated existing architecture, documented test requirements, and provided recommendations for implementation.

**Status**: The plan is comprehensive and well-structured. Step 2 has been fully specified with detailed implementation guidance added to `WizardModalRefactorPlan.md`.

## Key Findings

### 1. Architecture Validation

**✓ VALIDATED**: The existing architecture supports Step 2 without requiring major refactoring.

- **AssignmentController** already has `ensureDefinitionFromInputs()` which handles:
  - MIME type detection and validation
  - Reference/template type matching
  - Definition persistence via `AssignmentDefinitionController`

- **Drive validation** is centralized in `_detectDocumentType()`:
  - Uses `DriveApp.getFileById()` to fetch file
  - Validates MIME types (`application/vnd.google-apps.presentation` for Slides, `application/vnd.google-apps.spreadsheet` for Sheets)
  - Ensures reference and template types match

- **Persistence layer** is already established:
  - `AssignmentDefinitionController.ensureDefinition()` handles full definition creation
  - `saveDefinition()` persists to JsonDbApp
  - Supports both partial and full hydration (see DATA_SHAPES.md)

### 2. Missing Components Identified

**NEW FILES REQUIRED**:

1. **Server-side functions** (in `src/AdminSheet/GoogleClassroom/globals.js`):
   - `validateAndSaveDocumentIds(assignmentId, documentIds)` - Validates and persists document IDs from wizard
   - `fetchSavedDocumentIds(assignmentId)` - Retrieves previously saved IDs for pre-fill

2. **Step 2 UI template** (extend `src/AdminSheet/UI/AssessmentWizard.html`):
   - Step 2 panel HTML
   - URL parsing logic (inline JavaScript)
   - State management extension
   - Navigation between steps

3. **Test files**:
   - `tests/ui/assignmentWizardStep2.test.js` - UI behaviour tests
   - `tests/controllers/assignmentController.wizardStep2.test.js` - Server validation tests

**OPTIONAL FILES** (defer unless needed):

- `src/AdminSheet/Utils/GoogleUrlParser.js` - Extract URL parsing if reused elsewhere
- `tests/utils/googleUrlParser.test.js` - Parser unit tests if extracted

### 3. Test Coverage Requirements

#### UI Behaviour Tests (JSDOM-based)

The existing test pattern from `tests/ui/assignmentWizardStep1.test.js` should be replicated for Step 2:

**Core behaviours**:

1. Step transition from Step 1 to Step 2
2. URL parsing and ID extraction
3. Real-time feedback display
4. Client-side validation
5. Server call orchestration
6. Error handling
7. Pre-fill from saved IDs
8. Navigation (back to Step 1, cancel)

**Test infrastructure**:

- Use `renderTemplateWithIncludes()` helper from `tests/helpers/htmlTemplateRenderer.js`
- Mock `google.script.run` with chainable pattern
- Test BeerCSS-specific DOM structures
- Verify field activation and suffix element positioning

#### Server-Side Unit Tests

**New test suite** for wizard-specific server functions:

1. **`validateAndSaveDocumentIds()`**:
   - Success path with valid Slides
   - Success path with valid Sheets
   - Failure: identical IDs
   - Failure: type mismatch (Slides ref + Sheets template)
   - Failure: invalid file ID
   - Failure: unsupported MIME type

2. **`fetchSavedDocumentIds()`**:
   - Success: definition exists
   - Success: definition missing (empty object)
   - Graceful degradation on API failure

3. **Integration with existing controllers**:
   - Verify calls to `ensureDefinitionFromInputs()`
   - Verify definition persistence
   - Verify error propagation

### 4. URL Parsing Requirements

**Supported formats**:

| Input Type | Pattern                              | Inferred Type | Example                                          |
| ---------- | ------------------------------------ | ------------- | ------------------------------------------------ |
| Slides URL | `/presentation/d/<id>`               | `SLIDES`      | `https://docs.google.com/presentation/d/1ABC...` |
| Sheets URL | `/spreadsheets/d/<id>`               | `SHEETS`      | `https://docs.google.com/spreadsheets/d/1XYZ...` |
| Drive link | `drive.google.com/...` or `open?id=` | `unknown`     | `https://drive.google.com/file/d/1GHI...`        |
| Raw ID     | Alphanumeric + `_-`, 25+ chars       | `unknown`     | `1AbCdEfGhIjKlMnOpQrStUvWxYz...`                 |

**Client-side inference**:

- Provides immediate feedback to user
- Reduces server round-trips
- Allows pre-validation warnings (type mismatch)

**Server-side validation**:

- Authoritative MIME type check
- File existence verification
- Type consistency enforcement

### 5. Integration Points Verified

**No changes required** to existing components:

- ✓ `AssignmentController.ensureDefinitionFromInputs()` - Already handles all validation
- ✓ `AssignmentController._detectDocumentType()` - MIME type validation complete
- ✓ `AssignmentDefinitionController.ensureDefinition()` - Persistence complete
- ✓ `AssignmentDefinitionController.getDefinitionByKey()` - Retrieval for pre-fill
- ✓ `UIManager.openReferenceSlideModal()` - Same pattern for ID lookup (can reuse)

**Minimal changes required**:

- `AssessmentWizard.html` - Add Step 2 panel (extend existing template)
- `GoogleClassroom/globals.js` - Add two new global functions

### 6. Legacy Component Migration

**Current legacy flow** (`SlideIdsModal.html`):

- Template-based rendering with server-side scriptlets
- Materialize CSS styling
- Direct call to `saveStartAndShowProgress()`
- Tests in `tests/ui/slideIdsModal.test.js`

**Migration strategy**:

1. Keep `SlideIdsModal.html` operational during wizard rollout
2. Menu provides both "Assess Student Work" (legacy) and "Assessment wizard" (new)
3. Once wizard proven stable, remove legacy modal
4. Archive `slideIdsModal.test.js` as reference

**Shared behaviour between legacy and new**:

- Both call `saveStartAndShowProgress()` or equivalent
- Both validate IDs are different
- Both persist to `AssignmentDefinition`
- Both trigger assessment processing

### 7. Open Questions & Recommendations

#### Q1: URL Parser Module Extraction

**Question**: Should URL parsing be extracted to a reusable utility module?

**Analysis**:

- **Pro**: Better unit testability, potential reuse
- **Con**: Adds complexity, wizard is currently the only consumer
- **Current state**: No other components parse Google URLs

**Recommendation**: **Keep inline** (KISS principle). Extract only when:

- Another component needs URL parsing
- Complexity requires dedicated unit tests beyond JSDOM coverage

#### Q2: Document Type Support

**Question**: Should wizard support Google Docs (unsupported document type)?

**Analysis**:

- Client can parse Docs URLs and extract IDs
- Server will reject Docs MIME type with clear error
- Allows future extension without client changes

**Recommendation**: **Parse Docs URLs client-side, reject server-side**. This provides:

- Clear error messages ("Docs not yet supported")
- Easy future extension (change server validation only)
- Consistent user experience

#### Q3: Permission Validation

**Question**: Should Step 2 validate user has access to files?

**Analysis**:

- Permissions checked during actual processing (existing behaviour)
- Early validation could improve UX
- Adds latency to Step 2 submission
- Permissions can change between validation and processing

**Recommendation**: **No permission check in Step 2**. Validate only:

- File exists
- MIME type supported and consistent
- IDs are different

Defer permissions to processing stage (existing behaviour preserved).

#### Q4: Step 3 Design

**Question**: Should wizard include Step 3 (progress panel) or use existing `ProgressModal`?

**Analysis**:

- Existing `ProgressModal` is functional and tested
- Step 3 design is substantial additional work
- Current plan defers this decision

**Recommendation**: **Use existing `ProgressModal` for Step 2 implementation**. Design Step 3 as separate iteration.

**Implementation**: After Step 2 submit succeeds:

```javascript
// Close wizard
google.script.host.close();

// Trigger processing (shows ProgressModal)
google.script.run
  .withSuccessHandler(() => {
    // ProgressModal shown by server
  })
  .saveStartAndShowProgress(assignmentTitle, documentIds, assignmentId);
```

#### Q5: Pre-fill Error Handling

**Question**: How should wizard handle failures when fetching saved IDs?

**Analysis**:

- Network failures possible
- Empty fields are valid (new assignment)
- User should still be able to proceed

**Recommendation**: **Graceful degradation with warning**:

```javascript
google.script.run
  .withSuccessHandler((ids) => {
    // Pre-fill inputs
    state.documents.reference.raw = ids.referenceDocumentId || '';
    state.documents.template.raw = ids.templateDocumentId || '';
  })
  .withFailureHandler((err) => {
    // Show warning but allow proceed
    showWarning('Could not load saved IDs. Please enter manually.');
  })
  .fetchSavedDocumentIds(selectedAssignmentId);
```

### 8. Additional Components Not Listed in Original Plan

The following components interact with the wizard flow but were not explicitly listed in the original plan:

1. **`src/AdminSheet/GoogleClassroom/ClassroomApiClient.js`**
   - Used by `fetchSavedDocumentIds()` to resolve topic names
   - Method: `fetchTopicName(courseId, topicId)`

2. **`src/AdminSheet/y_controllers/ABClassController.js`**
   - Used by `fetchSavedDocumentIds()` to get year group
   - Method: `loadClass(courseId)`

3. **`src/AdminSheet/ConfigurationManager/ConfigurationManagerClass.js`**
   - Used by both server functions to get current course ID
   - Method: `getAssessmentRecordCourseId()`

4. **`src/AdminSheet/AssignmentProcessor/globals.js`**
   - Contains `saveStartAndShowProgress()` called after Step 2
   - Triggers `AssignmentController.saveStartAndShowProgress()`

5. **`src/AdminSheet/UI/98_UIManager.js`**
   - Contains legacy `openReferenceSlideModal()` as reference
   - Same lookup pattern for saved IDs (lines 311-336)

**Impact**: None require changes. All are dependencies that already exist and function correctly.

### 9. BeerCSS-Specific Considerations

Based on `docs/developer/UI.md` and Step 1 implementation:

**Required patterns**:

1. **Field structure** for text inputs with real-time feedback:

   ```html
   <div class="field label border">
     <input type="text" id="referenceInput" />
     <label for="referenceInput">Reference document (URL or ID)</label>
   </div>
   <output id="referenceFeedback" class="status" aria-live="polite"></output>
   ```

2. **State classes** for validation:
   - `.invalid` - Invalid input (e.g., IDs match)
   - `.danger` - Error state for output elements

3. **Margin reset** to avoid scrollbars:

   ```css
   html,
   body {
     margin: 0;
     padding: 0;
   }
   ```

4. **Modal title**: Must be non-empty string (use "Step 2 - Document IDs" or similar)

5. **Accessibility**:
   - Use `<output>` for status messages (not `<div role="status">`)
   - Include `aria-live="polite"` for feedback areas
   - Prefer `globalThis` over `window` for test hooks

### 10. Test File Organization

**Existing pattern** from Step 1:

```
tests/ui/assignmentWizardStep1.test.js
├── Helper: createGoogleMock() - Mock google.script.run
├── Helper: setupWizard() - Render template and initialize
└── Test suites:
    ├── Initial render
    ├── Server call trigger
    ├── Success path
    ├── Selection gating
    ├── Failure path
    └── Cancel interaction
```

**Proposed pattern** for Step 2:

```
tests/ui/assignmentWizardStep2.test.js
├── Helper: createGoogleMock() - Extend to include validateAndSaveDocumentIds, fetchSavedDocumentIds
├── Helper: setupWizardAtStep2() - Render and advance to Step 2
└── Test suites:
    ├── Step transition from Step 1
    ├── URL parsing and feedback
    ├── Client-side validation
    ├── Pre-fill from server
    ├── Server submission success
    ├── Server submission failure
    ├── Navigation (back, cancel)
    └── Edge cases (network failures, etc.)
```

**Server-side tests**:

```
tests/controllers/assignmentController.wizardStep2.test.js
├── Setup: Mock DriveApp, Classroom API, controllers
└── Test suites:
    ├── validateAndSaveDocumentIds - success paths
    ├── validateAndSaveDocumentIds - failure paths
    ├── fetchSavedDocumentIds - success and failure
    └── Integration with ensureDefinitionFromInputs
```

## Summary of Changes to WizardModalRefactorPlan.md

The following section has been added to the plan:

- **Step 2 Implementation Plan** (comprehensive)
  - Overview
  - UI Components (HTML template, client-side behaviour, state extension)
  - Server-Side Components (new functions, existing components)
  - Integration Points (files to modify, files referenced)
  - Testing Strategy (UI, server-side, URL parsing)
  - Migration from Legacy SlideIdsModal
  - Open Questions (with recommendations)
  - Files Summary

## Recommendations for Next Steps

1. **Implement Step 2 UI**:
   - Extend `AssessmentWizard.html` with Step 2 panel
   - Add URL parsing logic inline
   - Implement step transitions

2. **Implement server functions**:
   - Add `validateAndSaveDocumentIds()` to `GoogleClassroom/globals.js`
   - Add `fetchSavedDocumentIds()` to `GoogleClassroom/globals.js`

3. **Write tests**:
   - `tests/ui/assignmentWizardStep2.test.js` following Step 1 pattern
   - `tests/controllers/assignmentController.wizardStep2.test.js` for server validation

4. **Manual testing**:
   - Test with real Slides documents
   - Test with real Sheets documents
   - Test with invalid IDs
   - Test with mismatched types
   - Test pre-fill behaviour

5. **Documentation**:
   - Update developer docs if patterns change
   - Document any deviations from plan

## Questions Requiring Clarification

**None identified**. All ambiguities have been addressed with recommendations in the updated plan. If the user disagrees with any recommendation, those can be revised before implementation begins.

## Conclusion

The Wizard Modal Refactor Plan Step 2 is now fully specified and ready for implementation. All dependencies have been verified, test requirements documented, and integration points identified. The architecture supports the plan without requiring major refactoring, and the implementation can proceed following the detailed guidance in `WizardModalRefactorPlan.md`.

**Status**: ✅ Review complete. Plan is comprehensive and implementable.
