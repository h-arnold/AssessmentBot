# Implementation Plan for Refactoring `Task` and `StudentTask` Models

This implementation plan follows the specifications in `DESIGN.md` and addresses all dependencies listed in `DEPENDENCY_REFACTOR_REQUIREMENTS.md`. The refactoring replaces the current `Task` and `StudentTask` models with a new architecture centered around `TaskDefinition`, typed `TaskArtifact` hierarchy, and `StudentSubmission`/`StudentSubmissionItem` models.

## Phase 1: Core Model Implementation

### 1.1 Create New Model Foundation
- [ ] Create `src/AdminSheet/Models/TaskDefinition.js`
  - [ ] Implement TaskDefinition class with stable ID system
  - [ ] Add artifact management (reference/template collections)
  - [ ] Implement constructor, getId(), addReferenceArtifact(), addTemplateArtifact()
  - [ ] Add getPrimaryReference(), getPrimaryTemplate() methods
  - [ ] Implement toJSON()/fromJSON() serialization
  - [ ] Add validation for required artifacts

### 1.2 Create TaskArtifact Hierarchy
- [ ] Create `src/AdminSheet/Models/Artifacts.js`
  - [ ] Implement BaseTaskArtifact base class
    - [ ] Add shared fields: taskId, role, documentId, pageId, contentHash, metadata
    - [ ] Implement constructor with UID generation
    - [ ] Add normalizeContent(), validate(), ensureHash() methods
    - [ ] Add getUid(), getType(), toJSON()/fromJSON() methods
  - [ ] Implement TextTaskArtifact subclass
    - [ ] Content normalization (trim, newlines)
    - [ ] Validation for text content
    - [ ] Static factory method fromRawText()
  - [ ] Implement TableTaskArtifact subclass
    - [ ] 2D array content handling
    - [ ] Cell normalization and validation
    - [ ] Markdown generation for tables
    - [ ] Static factory method fromRawCells()
  - [ ] Implement SpreadsheetTaskArtifact subclass (extends Table)
    - [ ] Formula canonicalization logic
    - [ ] Metadata handling (range, sheetName, bbox)
    - [ ] Move _normaliseFormulaCase logic from parser
  - [ ] Implement ImageTaskArtifact subclass
    - [ ] Base64 content handling
    - [ ] setContentFromBlob() method
    - [ ] sourceUrl metadata management
  - [ ] Create ArtifactFactory class
    - [ ] Implement create() method with type routing
    - [ ] Add factory methods for each artifact type

### 1.3 Create StudentSubmission Models
- [ ] Create `src/AdminSheet/Models/StudentSubmission.js`
  - [ ] Implement StudentSubmission class
    - [ ] Fields: studentId, assignmentId, documentId, items, timestamps
    - [ ] Constructor and basic accessors
    - [ ] upsertItemFromExtraction() method
    - [ ] getItem() method
    - [ ] toJSON()/fromJSON() serialization
  - [ ] Implement StudentSubmissionItem class
    - [ ] Fields: id, taskId, documentId, pageId, artifact, assessments, feedback
    - [ ] Assessment management: addAssessment(), getAssessment()
    - [ ] Feedback management: addFeedback(), getFeedback()
    - [ ] markAssessed() method
    - [ ] getType() method delegating to artifact
    - [ ] toJSON()/fromJSON() serialization

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
  - [ ] Move formula canonicalization to SpreadsheetTaskArtifact
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
  - [ ] Remove canonicalization (move to SpreadsheetTaskArtifact)
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
- [ ] Test all TaskArtifact subclasses for normalization and hashing
- [ ] Test StudentSubmission and StudentSubmissionItem functionality
- [ ] Verify JSON serialization/deserialization integrity

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
- **Centralized Hashing**: Only artifacts compute contentHash values
- **Stable Identity**: TaskDefinition.id persists across title/page changes
- **Separation of Concerns**: Parsers extract primitives, artifacts handle normalization

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