# Implementation Plan for Refactoring `Task` and `StudentTask` Models

This implementation plan follows the specifications in `DESIGN.md` and addresses all dependencies listed in `DEPENDENCY_REFACTOR_REQUIREMENTS.md`. The refactoring replaces the current `Task` and `StudentTask` models with a new architecture centered around `TaskDefinition`, typed `TaskArtifact` hierarchy, and `StudentSubmission`/`StudentSubmissionItem` models.

## Phase 1: Core Model Implementation

### 1.1 Create New Model Foundation
- [x] Create `src/AdminSheet/Models/TaskDefinition.js`
  - [x] Implement TaskDefinition class with stable ID system
  - [x] Add artifact management (reference/template collections)
  - [x] Implement constructor, getId(), addReferenceArtifact(), addTemplateArtifact()
  - [x] Add getPrimaryReference(), getPrimaryTemplate() methods
  - [x] Implement toJSON()/fromJSON() serialization
  - [x] Add validation for required artifacts

### 1.2 Create TaskArtifact Hierarchy
- [x] Create `src/AdminSheet/Models/Artifacts.js`
  - [x] Implement BaseTaskArtifact base class
    - [x] Add shared fields: taskId, role, documentId, pageId, contentHash, metadata
    - [x] Implement constructor with UID generation
    - [x] Add normaliseContent(), validate(), ensureHash() methods
    - [x] Add getUid(), getType(), toJSON()/fromJSON() methods
  - [x] Implement TextTaskArtifact subclass
    - [x] Content normalisation (trim, newlines)
    - [x] Validation for text content
    - [ ] Static factory method fromRawText()
  - [x] Implement TableTaskArtifact subclass
    - [x] 2D array content handling
    - [x] Cell normalisation and validation
    - [x] Markdown generation for tables
    - [ ] Static factory method fromRawCells()
  - [x] Implement SpreadsheetTaskArtifact subclass (extends Table)
    - [x] Formula canonicalisation logic
    - [x] Metadata handling (range, sheetName, bbox)
    - [x] Move _normaliseFormulaCase logic from parser
  - [x] Implement ImageTaskArtifact subclass
    - [x] Base64 content handling
    - [x] setContentFromBlob() method
    - [x] sourceUrl metadata management
  - [x] Create ArtifactFactory class
    - [x] Implement create() method with type routing
    - [ ] Add factory methods for each artifact type

### 1.3 Create StudentSubmission Models
- [x] Create `src/AdminSheet/Models/StudentSubmission.js`
  - [x] Implement StudentSubmission class
    - [x] Fields: studentId, assignmentId, documentId, items, timestamps
    - [x] Constructor and basic accessors
    - [x] upsertItemFromExtraction() method
    - [x] getItem() method
    - [x] toJSON()/fromJSON() serialisation
  - [x] Implement StudentSubmissionItem class
    - [x] Fields: id, taskId, documentId, pageId, artifact, assessments, feedback
    - [x] Assessment management: addAssessment(), getAssessment()
    - [x] Feedback management: addFeedback(), getFeedback()
    - [x] markAssessed() method
    - [x] getType() method delegating to artifact
    - [x] toJSON()/fromJSON() serialisation

## Phase 2: Parser Interface Updates

### 2.1 Update DocumentParser Base Class
  - [x] Update `src/AdminSheet/DocumentParsers/DocumentParser.js`
  - [x] Add abstract extractTaskDefinitions(referenceId, templateId?) method
  - [x] Add abstract extractSubmissionArtifacts(documentId, taskDefs) method
  - [x] Deprecate parseTask() method (keep temporarily for migration)
  - [x] Update method signatures to work with primitives only

### 2.2 Update SlidesParser
- [ ] Update `src/AdminSheet/DocumentParsers/SlidesParser.js`
  - [ ] Implement extractTaskDefinitions() method
    - [ ] Walk reference and template documents
    - [ ] Align by title/page and create TaskDefinition instances
    - [ ] Add reference and template artifacts appropriately
    - [ ] Set TaskDefinition.id and index for document order
    - [ ] Handle image metadata.sourceUrl (no base64 at parse time)
  - [ ] Implement extractSubmissionArtifacts() method
    - [ ] Extract student content as primitives
    - [ ] Return array of {taskId, pageId, content, metadata} objects
    - [ ] Remove contentHash computation from parser
  - [ ] Remove direct Task instantiation and contentHash computation

### 2.3 Update SheetsParser
- [ ] Update `src/AdminSheet/DocumentParsers/SheetsParser.js`
  - [ ] Implement extractTaskDefinitions() method
    - [ ] Create TaskDefinition per sheet with SpreadsheetTaskArtifacts
    - [ ] Move boundingBox and referenceLocationsMap to TaskDefinition.taskMetadata
    - [ ] Handle reference and template artifacts
  - [ ] Implement extractSubmissionArtifacts() method
    - [ ] Use bbox/referenceLocationsMap from TaskDefinition.taskMetadata
    - [ ] Extract student formulas from specific locations only
    - [ ] Return primitive formula arrays with location metadata
  - [ ] Move formula canonicalisation to SpreadsheetTaskArtifact
  - [ ] Update extractStudentTasks() to use new model

## Phase 3: Assignment Layer Updates

### 3.1 Update Assignment Base Class
  - [x] Update `src/AdminSheet/AssignmentProcessor/Assignment.js`
  - [x] Replace this.tasks with {[taskId]: TaskDefinition} map
  - [x] Replace this.studentTasks with this.submissions: StudentSubmission[]
  - [x] Update addStudent() to create StudentSubmission instances
  - [x] Update generateLLMRequests() to delegate to LLMRequestManager
  - [x] Update assessResponses() to handle new model
  - [x] Add temporary getter for legacy compatibility (remove later)
  - [x] Update `src/AdminSheet/RequestHandlers/LLMRequestManager.js`
    - [x] Iterate assignment.submissions instead of studentTasks
    - [x] Filter to text/table/image items only (skip spreadsheets)
    - [x] Get TaskDefinition by taskId for context
    - [x] Use artifact.contentHash for not-attempted detection
    - [x] Use artifact.contentHash for caching keys
    - [x] Build payloads from artifact.content
    - [x] Use artifact.getUid() for result routing
    - [x] Create uid→{submission, item} mapping for result assignment

### 3.2 Update SlidesAssignment
  - [x] Update `src/AdminSheet/AssignmentProcessor/SlidesAssignment.js`
  - [x] Update populateTasks() to use extractTaskDefinitions()
  - [x] Update processAllSubmissions() to use extractSubmissionArtifacts()
  - [x] Replace processImages() with new ImageManager flow (placeholder no-op)
  - [x] Remove StudentTask.extractAndAssignResponses() usage
  - [x] Update to use submission.upsertItemFromExtraction()

### 3.3 Update SheetsAssignment  
  - [x] Update `src/AdminSheet/AssignmentProcessor/SheetsAssignment.js`
  - [x] Update populateTasks() to use extractTaskDefinitions()
  - [x] Update processAllSubmissions() to use new extraction flow
  - [x] Replace assessResponses() with AssessmentEngineRouter (placeholder logic added)
  - [x] Update to work with StudentSubmission model
  - [ ] Remove legacy SheetsAssessor usage (pending future phase)



## Phase 5: Supporting System Updates

### 5.1 Update ImageManager
  - [x] Update `src/AdminSheet/RequestHandlers/ImageManager.js`
  - [x] Replace collectAllSlideUrls() with collectAllImageArtifacts()
  - [x] Update to collect from TaskDefinition artifacts and StudentSubmissionItems
  - [x] Include artifact UIDs and metadata.sourceUrl
  - [x] Update fetchImagesAsBlobs() with round-robin by documentId
  - [x] Use artifact.setContentFromBlob() to write base64 and compute hashes
  - [x] Remove direct base64 writing to task/response fields

### 5.2 Update AnalysisSheetManager
  - [x] Update `src/AdminSheet/Sheets/AnalysisSheetManager.js`
  - [x] Use TaskDefinition map keyed by taskId
  - [x] Replace studentTasks with submissions
  - [x] Use submission.getItem(taskId) for data access
  - [x] Use TaskDefinition.taskTitle for display headers
  - [x] Maintain deterministic order via TaskDefinition.index
  - [x] Convert item.artifact.content to display strings

### 5.3 Update FeedbackPopulators
  - [x] Update `src/AdminSheet/FeedbackPopulators/SheetsFeedback.js`
  - [x] Accept StudentSubmission[] instead of StudentTask[]
  - [x] Use submission.documentId and item.pageId for targeting
  - [x] Access feedback via StudentSubmissionItem.getFeedback()
  - [x] Maintain existing feedback JSON structure

### 5.4 Update TaskSheet Helper
  - [x] Update `src/AdminSheet/Sheets/TaskSheet.js`
  - [x] Ensure outputs are primitives only (no GAS objects)
  - [x] Remove contentHash computation
  - [x] Remove canonicalisation (move to SpreadsheetTaskArtifact)
  - [x] Keep as Sheets API helper for extraction

## Phase 6: Final Integration and Cleanup

### 6.1 Update Remaining Dependencies
  - [x] Update `src/AdminSheet/y_controllers/AssignmentController.js`
  - [x] Use assignment.submissions instead of studentTasks
  - [x] Update SheetsFeedback construction
  - [ ] Ensure compatibility with new model (final pass after tests)
  - [ ] Update any remaining classes that reference Task/StudentTask
  - [ ] Verify CacheManager works with new artifact hashes

### 6.3 Remove Legacy Models
  - [x] Deprecate `src/AdminSheet/Models/Task.js`
  - [x] Deprecate `src/AdminSheet/Models/StudentTask.js`
  - [ ] Remove legacy adapters after verification
  - [ ] Clean up any remaining legacy references

## Phase 7: Testing and Validation

### 7.1 Model Validation
- [ ] Test TaskDefinition creation and artifact management
- [ ] Test all TaskArtifact subclasses for normalisation and hashing
- [ ] Test StudentSubmission and StudentSubmissionItem functionality
- [ ] Verify JSON serialisation/deserialization integrity

### 7.2 Integration Testing
- [ ] Test parser extraction workflows
- [ ] Test assignment processing end-to-end
- [ ] Test assessment engine routing
- [ ] Test image processing pipeline
- [ ] Test analysis sheet generation
- [ ] Test feedback population

### 7.3 Performance and Compatibility
- [ ] Verify no performance regressions
- [ ] Test with existing data (if possible)
- [ ] Validate UID generation and uniqueness
- [ ] Confirm stable hashing behavior

## Implementation Notes

### Key Design Principles
- **Single Source of Truth**: TaskDefinition owns task identity and metadata
- **Typed Artifacts**: All content is handled by appropriate artifact subclasses  
- **Centralised Hashing**: Only artifacts compute contentHash values
- **Stable Identity**: TaskDefinition.id persists across title/page changes
- **Separation of Concerns**: Parsers extract primitives, artifacts handle normalisation

### Migration Strategy
- Implement new models alongside legacy ones initially
- Update dependent classes incrementally
- Use adapters temporarily to bridge old/new data formats
- Remove legacy models only after full validation

### Critical Success Factors
- Preserve existing workflow functionality
- Maintain performance characteristics
- Ensure stable identity and hashing
- Support extensibility for new task types
- Keep assessment routing flexible

This plan provides a comprehensive roadmap for the refactoring while maintaining system stability and functionality throughout the transition.

---

## Non-GAS Test Case Checklist (Pure / Stubbed Logic Only)

The following test cases avoid direct Google Apps Script API objects. They rely solely on primitives, simple stubs, or already-exported model classes. Add/adjust as implementation evolves. All boxes start unchecked until implemented in the Vitest suite.

### Phase 1 – Core Model Implementation
- [x] TaskDefinition: generates stable id; id unchanged after mutating `taskTitle` or `pageId` post-construction.
- [x] TaskDefinition: `validate()` fails when missing reference or template artifacts.
- [x] TaskDefinition: serialization round-trip preserves `index`, `taskMetadata`, and artifacts (deep equality by JSON).
- [x] TextTaskArtifact: normalises CRLF → LF; trims; converts empty string → null; hash stable across repeated `ensureHash()`.
- [x] TableTaskArtifact: trims trailing empty rows/cols; trims individual cells; preserves internal non-empty cells; markdown output contains header separator line count = content length.
- [x] SpreadsheetTaskArtifact: formula canonicalisation uppercases outside quotes; quoted segments preserved; multiple calls idempotent (canonical form unchanged after second normalisation).
- [x] ImageTaskArtifact: `setContentFromBlob` (simulated Uint8Array) sets base64 and hash; identical byte arrays produce identical `contentHash`; different bytes produce different hash.
- [x] Artifact UID format: default `uid` matches pattern `<taskId>-<taskIndex>-<role>-<pageId|na>-<artifactIndex>`.
- [x] StudentSubmission: first `upsertItemFromExtraction` creates item; second call with new content updates hash and `updatedAt` increases; metadata merge does not erase existing keys.
- [x] StudentSubmissionItem: `addAssessment` stores JSON; `markAssessed` triggers submission `updatedAt` update; `getType()` proxies artifact type.
- [x] Factory helpers: `ArtifactFactory.text/table/spreadsheet/image` create matching subclass types.

### Phase 2 – Parser Interface Updates (Interface-Level / Stubs)
Create a minimal stub subclass `TestDocumentParser` (no GAS) to validate interface contracts.
- [x] Abstract enforcement: instantiating base `DocumentParser` (if exported) throws or calling abstract methods throws.
- [x] Stub parser `extractTaskDefinitions()` returns array of TaskDefinitions with sequential `index` values starting at 0.
- [x] Returned TaskDefinitions contain only primitive artifact contents (strings / arrays / null) – no functions or objects.
- [x] `extractSubmissionArtifacts()` output objects contain only primitive fields: `{ taskId, pageId?, content, metadata? }` and NO `contentHash` on the primitive extraction objects.
- [x] Parsers must NOT manually compute or inject `contentHash` into extracted primitives; Artifact constructors now compute `contentHash` immediately when `content` is present.
- [x] Alignment logic (stub): when titles repeated or out-of-order, assigned `index` keeps original order of appearance.

### Phase 3 – Assignment Layer Updates (Using Stubs / Models Only)
Use lightweight stub for LLMRequestManager that records received payloads.
- [ ] Assignment base (updated): `tasks` stored as `{[taskId]: TaskDefinition}` map; insertion order preserved via numeric `index`.
- [ ] Adding students builds `StudentSubmission` objects with correct `assignmentId` / `studentId`.
- [ ] `generateLLMRequests()` skips spreadsheet artifacts; includes text/table/image; request count matches eligible submission items.
- [ ] Not-attempted detection: if submission artifact hash === template artifact hash, request excluded.
- [ ] Result routing: simulate LLM responses keyed by artifact `uid`; correct `StudentSubmissionItem` updated.
- [ ] `assessResponses()` marks items assessed and updates the containing `StudentSubmission.updatedAt` to the current time when any item changes.

### Phase 5 – Supporting System Updates
- [ ] ImageManager.collectAllImageArtifacts: returns entries for reference, template, and submission image artifacts with required fields `{ uid, url, documentId, scope, taskId }`.
- [ ] ImageManager round-robin ordering: given artifacts across 3 documentIds, output sequence cycles documents (A,B,C,A,B,C...).
- [ ] ImageManager blob write: calling simulated fetch results updates artifact base64 and hash (hash changes from null → value).
- [ ] AnalysisSheetManager ordering: output columns ordered by `TaskDefinition.index` regardless of object insertion order.
- [ ] AnalysisSheetManager cell rendering: `null` artifact content rendered as empty string; tables summarised (e.g., first row joined) – choose deterministic helper.
- [ ] SheetsFeedback: adding feedback via `StudentSubmissionItem.addFeedback` retrievable after manager population (no mutation of unrelated feedback keys).
- [ ] TaskSheet helper (pure functions): given primitive 2D formula arrays returns same shape; never returns functions / class instances.

### Phase 6 – Migration & Cleanup
- [ ] Legacy Task JSON → TaskDefinition adapter: preserves `id` if present; computes new if absent; artifact counts equal input counts.
- [ ] Legacy StudentTask JSON → StudentSubmission adapter: number of tasks equals number of items after migration; artifacts role set to `submission`.
- [ ] Validation utility: detects duplicate `taskId` across definitions.
- [ ] Validation utility: detects TaskDefinition missing primary reference or template.
- [ ] Cleanup script (dry-run mode) lists files referencing deprecated `Task` / `StudentTask` without modifying content.

### Phase 7 – Extended Testing & Validation
- [ ] Serialization invariance: `JSON.stringify(fromJSON(toJSON(obj)))` stable across two cycles (idempotent) for each artifact type.
- [ ] Hash stability: calling `ensureHash()` multiple times does not change `contentHash`.
- [ ] UID uniqueness: across a constructed assignment with N tasks * M artifacts each, all `uid`s are unique.
- [ ] Performance sanity: creating 500 TextTaskArtifacts completes under threshold (e.g., < 100ms on local machine) – soft assertion (skipped in CI if flaky).
- [ ] Spreadsheet canonicalisation edge: formulas containing nested quotes and mixed case remain logically same after second normalisation pass.
- [ ] Table trimming edge: rows with internal non-empty cell not removed even if trailing cells empty.
- [ ] Image hash equality: two artifacts fed different blobs with identical bytes produce identical `contentHash`.

### Cross-Cutting / Invariants
- [ ] No test introduces GAS-specific classes (no `new Date()` except for timestamps, no `DriveApp`, `SlidesApp`, etc.).
- [ ] All model tests rely only on exported constructors and primitive data.
- [ ] Content mutability check: modifying returned object from `toJSON()` does not mutate internal model state.
- [ ] Deep clone safety: cloning artifact via `fromJSON(toJSON(a))` yields equal content/hash but different object identity.

---