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
  - [ ] Update `src/AdminSheet/DocumentParsers/DocumentParser.js`
  - [ ] Add abstract extractTaskDefinitions(referenceId, templateId?) method
  - [ ] Add abstract extractSubmissionArtifacts(documentId, taskDefs) method
  - [ ] Deprecate parseTask() method (keep temporarily for migration)
  - [ ] Update method signatures to work with primitives only

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
  - [ ] Update `src/AdminSheet/AssignmentProcessor/Assignment.js`
  - [ ] Replace this.tasks with {[taskId]: TaskDefinition} map
  - [ ] Replace this.studentTasks with this.submissions: StudentSubmission[]
  - [ ] Update addStudent() to create StudentSubmission instances
  - [ ] Update generateLLMRequests() to delegate to LLMRequestManager
  - [ ] Update assessResponses() to handle new model
  - [ ] Add temporary getter for legacy compatibility (remove later)
  - [ ] Update `src/AdminSheet/RequestHandlers/LLMRequestManager.js`
    - [ ] Iterate assignment.submissions instead of studentTasks
    - [ ] Filter to text/table/image items only (skip spreadsheets)
    - [ ] Get TaskDefinition by taskId for context
    - [ ] Use artifact.contentHash for not-attempted detection
    - [ ] Use artifact.contentHash for caching keys
    - [ ] Build payloads from artifact.content
    - [ ] Use artifact.getUid() for result routing
    - [ ] Create uid→{submission, item} mapping for result assignment

### 3.2 Update SlidesAssignment
  - [ ] Update `src/AdminSheet/AssignmentProcessor/SlidesAssignment.js`
  - [ ] Update populateTasks() to use extractTaskDefinitions()
  - [ ] Update processAllSubmissions() to use extractSubmissionArtifacts()
  - [ ] Replace processImages() with new ImageManager flow
  - [ ] Remove StudentTask.extractAndAssignResponses() usage
  - [ ] Update to use submission.upsertItemFromExtraction()

### 3.3 Update SheetsAssignment  
  - [ ] Update `src/AdminSheet/AssignmentProcessor/SheetsAssignment.js`
  - [ ] Update populateTasks() to use extractTaskDefinitions()
  - [ ] Update processAllSubmissions() to use new extraction flow
  - [ ] Replace assessResponses() with AssessmentEngineRouter
  - [ ] Update to work with StudentSubmission model
  - [ ] Remove legacy SheetsAssessor usage



## Phase 5: Supporting System Updates

### 5.1 Update ImageManager
  - [ ] Update `src/AdminSheet/RequestHandlers/ImageManager.js`
  - [ ] Replace collectAllSlideUrls() with collectAllImageArtifacts()
  - [ ] Update to collect from TaskDefinition artifacts and StudentSubmissionItems
  - [ ] Include artifact UIDs and metadata.sourceUrl
  - [ ] Update fetchImagesAsBlobs() with round-robin by documentId
  - [ ] Use artifact.setContentFromBlob() to write base64 and compute hashes
  - [ ] Remove direct base64 writing to task/response fields

### 5.2 Update AnalysisSheetManager
  - [ ] Update `src/AdminSheet/Sheets/AnalysisSheetManager.js`
  - [ ] Use TaskDefinition map keyed by taskId
  - [ ] Replace studentTasks with submissions
  - [ ] Use submission.getItem(taskId) for data access
  - [ ] Use TaskDefinition.taskTitle for display headers
  - [ ] Maintain deterministic order via TaskDefinition.index
  - [ ] Convert item.artifact.content to display strings

### 5.3 Update FeedbackPopulators
  - [ ] Update `src/AdminSheet/FeedbackPopulators/SheetsFeedback.js`
  - [ ] Accept StudentSubmission[] instead of StudentTask[]
  - [ ] Use submission.documentId and item.pageId for targeting
  - [ ] Access feedback via StudentSubmissionItem.getFeedback()
  - [ ] Maintain existing feedback JSON structure

### 5.4 Update TaskSheet Helper
  - [ ] Update `src/AdminSheet/Sheets/TaskSheet.js`
  - [ ] Ensure outputs are primitives only (no GAS objects)
  - [ ] Remove contentHash computation
  - [ ] Remove canonicalisation (move to SpreadsheetTaskArtifact)
  - [ ] Keep as Sheets API helper for extraction

## Phase 6: Final Integration and Cleanup

### 6.1 Update Remaining Dependencies
  - [ ] Update `src/AdminSheet/y_controllers/AssignmentController.js`
  - [ ] Use assignment.submissions instead of studentTasks
  - [ ] Update SheetsFeedback construction
  - [ ] Ensure compatibility with new model
  - [ ] Update any remaining classes that reference Task/StudentTask
  - [ ] Verify CacheManager works with new artifact hashes

### 6.2 Create Migration Utilities (Temporary)
  - [ ] Create adapter for legacy Task JSON to TaskDefinition
  - [ ] Create adapter for legacy StudentTask JSON to StudentSubmission
  - [ ] Add validation utilities for new model integrity

### 6.3 Remove Legacy Models
  - [ ] Deprecate `src/AdminSheet/Models/Task.js`
  - [ ] Deprecate `src/AdminSheet/Models/StudentTask.js`
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
- [x] StudentSubmissionItem: `addAssessment` stores JSON; `markAssessed` updates `lastAssessedHash`; `getType()` proxies artifact type.
- [x] Factory helpers: `ArtifactFactory.text/table/spreadsheet/image` create matching subclass types.

### Phase 2 – Parser Interface Updates (Interface-Level / Stubs)
Create a minimal stub subclass `TestDocumentParser` (no GAS) to validate interface contracts.
- [ ] Abstract enforcement: instantiating base `DocumentParser` (if exported) throws or calling abstract methods throws.
- [ ] Stub parser `extractTaskDefinitions()` returns array of TaskDefinitions with sequential `index` values starting at 0.
- [ ] Returned TaskDefinitions contain only primitive artifact contents (strings / arrays / null) – no functions or objects.
- [ ] `extractSubmissionArtifacts()` output objects contain only primitive fields: `{ taskId, pageId?, content, metadata? }` and NO `contentHash`.
- [ ] Ensure parser does not compute `contentHash` (artifacts assigned later do it).
- [ ] Alignment logic (stub): when titles repeated or out-of-order, assigned `index` keeps original order of appearance.

### Phase 3 – Assignment Layer Updates (Using Stubs / Models Only)
Use lightweight stub for LLMRequestManager that records received payloads.
- [ ] Assignment base (updated): `tasks` stored as `{[taskId]: TaskDefinition}` map; insertion order preserved via numeric `index`.
- [ ] Adding students builds `StudentSubmission` objects with correct `assignmentId` / `studentId`.
- [ ] `generateLLMRequests()` skips spreadsheet artifacts; includes text/table/image; request count matches eligible submission items.
- [ ] Not-attempted detection: if submission artifact hash === template artifact hash, request excluded.
- [ ] Result routing: simulate LLM responses keyed by artifact `uid`; correct `StudentSubmissionItem` updated.
- [ ] `assessResponses()` marks items assessed and sets `lastAssessedHash`.

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