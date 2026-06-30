# Assessment Flow Documentation

> **✅ Canonical document (June 2026):** This is the single canonical source for the assessment workflow and data flow. All file paths, method names, and architecture references describe the current `src/backend/` codebase. For any discrepancy found between this document and the source code, update the source code or file an issue — do not rely on stale copies.

## Shared Helper Status

- `AssignmentDefinitionController.upsertDefinition()` assignment-definition upsert orchestration helper
  - Status: `Implemented`
  - Supporting helpers: `_buildUpsertContext()`, `_resolveTaskStateForUpsert()`, `_applyTaskWeightingsIfProvided()`, and `_persistDefinitionWithRollback()` in `src/backend/y_controllers/AssignmentDefinitionController.js`
  - Behaviour: centralises create/update sequencing, stable opaque `definitionKey` handling, authoritative topic-key joins, duplicate-tuple rejection, parsing/reparse decisions, weighting application, and dual-store persistence.
- `AssignmentDefinitionController._rollbackFullStoreWrite()` rollback helper
  - Status: `Implemented`
  - Behaviour: restores or deletes the full-definition write when the later registry write fails; if rollback itself fails, the controller throws a repair-required error.
- `fetchCourseWork` paginating fetch of Google Classroom coursework
  - Status: `Implemented`
  - Behaviour: paginating fetch of Google Classroom coursework by courseId, sorted by updateTime descending, throws on API failure
  - Owning path: `ClassroomApiClient.fetchCourseWork()` in `src/backend/GoogleClassroom/ClassroomApiClient.js`

### Assignment-definition upsert contract note

The active backend upsert surface now treats `definitionKey` as a stable opaque identifier generated on create and preserved on update. Assignment topics are authoritative keyed reference data via `primaryTopicKey`, with `primaryTopic` retained only as a resolved display label.

## Summary Outline

This document traces the complete assessment flow in AssessmentBot, starting from the `startAssessmentRun` API call and ending with completed assessments persisted to the database.

### High-Level Flow

1. **API Trigger Phase** - Frontend calls `startAssessmentRun` API with `definitionKey`, `assignmentId`, `courseId`
2. **Trigger Setup Phase** - System validates definition freshness, creates time-based trigger with stored parameters
3. **Trigger Execution Phase** - Trigger fires and orchestrates the assessment pipeline
4. **Assignment Processing Pipeline** - Multi-stage processing including:
   - Assignment instance creation
   - Student roster hydration
   - Task definition freshness check
   - Submission document fetching
   - Content extraction
   - Image processing (Slides only)
   - Assessment execution (LLM or formula-based)
   - Data persistence

### Key Components

- **Backend API Layer**: `src/backend/z_Api` thin GAS global wrappers for frontend `apiHandler` transport calls
- **Controllers**: `AssignmentController`, `AssignmentDefinitionController`, `ABClassController`
- **Models**: `Assignment` (base), `SlidesAssignment`, `SheetsAssignment`, `AssignmentDefinition`, `TaskDefinition`, `StudentSubmission`
- **Processors**: `SlidesParser`, `SheetsParser`, Document parsers
- **Assessors**: `LLMRequestManager`, `SheetsAssessor`
- **Managers**: `ImageManager`
- **Utilities**: `ProgressTracker`, `TriggerController`, `DriveManager`, `Utils`

### Notes on Data Flow

1. **Progressive Hydration**: Data starts lightweight (just IDs and metadata) and progressively adds content as needed
2. **Two-Tier Persistence**: Full data in dedicated collections, partial summaries in ABClass for performance
   - Full assignment: `assign_full_{courseId}_{assignmentId}` collection
   - Full definition: `assdef_full_{definitionKey}` collection
   - Partial summaries: Stored in `class_{courseId}` and `assignment_definitions` collections
3. **Cache-First Assessment**: Always check cache before calling LLM to save API calls and time
4. **Fail-Fast Error Handling**: Errors propagate up immediately and should be logged at the appropriate top-level boundary without duplicating the same details at every layer
5. **Singleton Pattern**: ProgressTracker, ABLogger, ConfigurationManager, DbManager are all singletons
6. **Factory Pattern**: Assignment.create() returns appropriate subclass based on documentType
7. **Progress Tracking**: ProgressTracker updates visible to user throughout flow via Progress sheet
8. **Lock Management**: Document lock prevents concurrent assessment runs using LockService
9. **Trigger Pattern**: Time-based trigger decouples user action from heavy processing (5-second delay)
10. **User Properties**: Used for cross-execution parameter passing between trigger setup and execution
11. **Lazy Loading**: Task definitions only re-parsed when Drive file modification times are newer than cached timestamps
12. **Batch Operations**: LLM requests sent in batches via `UrlFetchApp.fetchAll()` for efficiency
13. **Configuration Transport**: Frontend configuration reads and writes now flow through `apiHandler` using `getBackendConfig` and `setBackendConfig` in `src/backend/z_Api/apiConfig.js`, with typed frontend access in `src/frontend/src/services/backendConfiguration/backendConfigurationService.ts`

---

## Architecture Note: API Layer

The backend uses `src/backend/z_Api` as the canonical GAS entry layer for frontend calls.

- API functions should stay thin and delegate to controllers.
- Remaining `globals.js` files in backend are temporary references and should be deleted once equivalent API functions exist.
- Backend configuration transport no longer uses `src/backend/ConfigurationManager/99_globals.js`; the canonical read/write methods are `getBackendConfig` and `setBackendConfig` through `src/backend/z_Api/z_apiHandler.js`.
- The frontend communicates with the backend exclusively through `apiHandler`.

### Current assignment-definition API contract

The backend now exposes three assignment-definition API surfaces:

1. **Assignment-topic CRUD via `apiHandler`**
   - `getAssignmentTopics`, `createAssignmentTopic`, `updateAssignmentTopic`, and `deleteAssignmentTopic` are allowlisted in `src/backend/z_Api/z_apiHandler.js`.
   - They reuse `ReferenceDataController` keyed CRUD behaviour against the `assignment_topics` collection.
   - Delete operations fail with machine-readable `IN_USE` errors when one or more registry rows in `assignment_definitions` still reference `primaryTopicKey`.
2. **Assignment-definition upsert via `apiHandler`**
   - `upsertAssignmentDefinition` delegates to `AssignmentDefinitionController.upsertDefinition()`.
   - The controller resolves `primaryTopic` from `assignment_topics`, rejects duplicate `{ primaryTitle, primaryTopicKey, yearGroup }` tuples, generates a UUID-style `definitionKey` on create, preserves the stored key on update, reparses tasks when source documents change, reapplies stored or supplied task weightings, and writes the full store before the registry.
   - Registry-write failures trigger `_rollbackFullStoreWrite()`; rollback failures surface as repair-required hard failures.
3. **Assignment-definition partial transport**
   - `getAssignmentDefinitionPartials` returns registry rows with `tasks: null` and requires `primaryTopicKey` to be present, trimmed, and authoritative.
   - `primaryTopic` remains a resolved display label only.

---

## Detailed Flow Documentation

### Phase 1: Assessment Initiation

#### Step 1.1: Start Assessment Run

**API method**: `startAssessmentRun`

- **Transport**: `src/backend/z_Api/assignmentAssessment.js`, via `startAssessmentRun_()` → `ALLOWLISTED_METHOD_HANDLERS` → `AssignmentController.startAssessmentRun()`
- **Request payload**:
  ```javascript
  {
    definitionKey: string,   // stable key of the existing AssignmentDefinition
    assignmentId: string,    // Google Classroom coursework ID
    courseId: string         // Google Classroom course ID (matches an ABClass)
  }
  ```
- **Process**:
  1. Validates all three required string fields at the transport boundary
  2. Fetches the full definition via `AssignmentDefinitionController.getDefinitionByKey`
  3. Checks per-document freshness via `_validateDefinitionFreshness()` using `DriveManager.getFileModifiedTime` and `DateUtils.isNewer` — throws `DefinitionStaleError` if either document has changed
  4. Resolves the ABClass via `ABClassController.loadClass(courseId)` — throws if no stored class exists
  5. Delegates to `startProcessing(assignmentId, definitionKey, courseId)` which creates the time-based trigger and stores context in `UserProperties` via `GASPropertiesUtils`
  6. Returns `null` (no data payload)
- **Error Handling**:
  - Transport validation failures throw `ApiValidationError` → mapped to `INVALID_REQUEST`
  - Stale definition throws `DefinitionStaleError` → mapped to `DEFINITION_STALE` with `details` block
  - Missing definition or ABClass throws `Error` → mapped to `INTERNAL_ERROR`

---

### Phase 2: Trigger Setup and Parameter Storage

#### Step 2.1: Ensure Assignment Definition

**Method**: `AssignmentController.ensureDefinitionFromInputs()`

- **Location**: `src/backend/y_controllers/AssignmentController.js:398-427`
- **Parameters**:

  ```javascript
  {
    assignmentTitle: string | null,
    assignmentId: string,
    documentIds: {
      referenceDocumentId: string,
      templateDocumentId: string
    }
  }
  ```

- **Process**:
  1. Detects document type (SLIDES or SHEETS) via `_detectDocumentType()`
  2. Fetches courseWork from Google Classroom API
  3. Extracts topicId and primaryTitle from courseWork
  4. Loads ABClass to get yearGroup
  5. Calls `AssignmentDefinitionController.upsertDefinition()` to create or update definition
- **Returns**:

  ```javascript
  {
    definition: AssignmentDefinition,
    courseId: string,
    abClass: ABClass
  }
  ```

**Helper Method**: `_detectDocumentType(referenceDocumentId, templateDocumentId)`

- **Location**: `src/backend/y_controllers/AssignmentController.js:362-386`
- **Process**:
  1. Gets file from Drive using DriveApp.getFileById()
  2. Checks MIME type for each document
  3. Validates both documents are the same type
  4. Returns 'SLIDES' or 'SHEETS'
- **MIME Types**:
  - Slides: `application/vnd.google-apps.presentation`
  - Sheets: `application/vnd.google-apps.spreadsheet`

**Controller**: `AssignmentDefinitionController.upsertDefinition()`

- **Location**: `src/backend/y_controllers/AssignmentDefinition/index.js` (facade)
- **Purpose**: Creates or updates an assignment definition
- **Process**:
  1. Delegates to `AssignmentDefinitionUpsertOrchestrator`
  2. Generates UUID-style `definitionKey` on create; preserves stored key on update
  3. Resolves `primaryTopicKey` from reference data
  4. Rejects duplicate `{ primaryTitle, primaryTopicKey, yearGroup }` tuples
  5. Writes full-definition store before registry partial
  6. Attempts rollback of full-definition write if registry write fails
- **Returns**: `AssignmentDefinition` instance

#### Step 2.2: Create Time-Based Trigger

**Method**: `AssignmentController.startProcessing(assignmentId, definitionKey)`

- **Location**: `src/backend/y_controllers/AssignmentController.js:68-95`
- **Parameters**:
  - `assignmentId` (string): Google Classroom assignment ID
  - `definitionKey` (string): Stable opaque assignment-definition lookup key
- **Process**:
  1. Creates TriggerController instance
  2. Gets PropertiesService.getDocumentProperties()
  3. Creates time-based trigger for `triggerProcessSelectedAssignment` function
  4. Stores parameters in document properties:
     - `assignmentId`
     - `definitionKey`
     - `triggerId`
  5. Logs success messages
- **Error Handling**: Logs errors and shows toast messages

**Class**: `TriggerController`

- **Location**: `src/backend/Utils/TriggerController.js`
- **Key Method**: `createTimeBasedTrigger(functionName, triggerTime)`
  - Creates a ScriptApp trigger set to run at specified time
  - If triggerTime not provided, defaults to 5 seconds from now
  - Returns trigger ID for later cleanup
  - Trigger will execute the named global function
  - Handles "too many triggers" error by cleaning up and retrying

**Properties Storage**: Properties are stored inline in `startProcessing()` via `GASPropertiesUtils.applyProperties(properties, propertyMap)` — there is no separate `applyDocumentProperties` helper method.

**Helper Method**: `runStage(startMessage, action, completionMessage)`

- **Location**: `src/backend/y_controllers/AssignmentController.js:333-340`
- **Purpose**: Wraps pipeline stages with consistent progress tracking
- **Process**:
  1. Updates progress with start message
  2. Executes action function
  3. Updates progress with completion message (if provided)
  4. Returns result of action function
- **Used Throughout**: All pipeline stages use this pattern for consistent logging

**User Properties Stored**:

```javascript
{
  assignmentId: "123456789",
  definitionKey: "stable-opaque-definition-key",
  triggerId: "trigger_id_string",
  courseId: "classroom_course_id"
}
```

Current state: `startProcessing` stores context via `GASPropertiesUtils.getUserProperties()` and `GASPropertiesUtils.applyProperties()`. The `DocumentProperties` scope has been migrated to `UserProperties`.

---

### Phase 3: Trigger Execution - Main Assessment Pipeline

#### Step 3.1: Trigger Fires

**Global Function**: `triggerProcessSelectedAssignment()`

- **Location**: `src/backend/AssignmentProcessor/globals.js:45-48`
- **Trigger**: Automatically called by time-based trigger (5 seconds after setup)
- **Calls**: `AssignmentController.processSelectedAssignment()`

#### Step 3.2: Process Selected Assignment (Orchestrator)

**Method**: `AssignmentController.processSelectedAssignment()`

- **Location**: `src/backend/y_controllers/AssignmentController.js:137-227`
- **Purpose**: Main orchestrator for the entire assessment pipeline
- **Lock Management**: Uses `LockService.getDocumentLock()` to prevent concurrent execution
  - Attempts lock for 5 seconds
  - Returns early if lock cannot be acquired

**Process Flow**:

1. **Parameter Retrieval**
   - Gets user properties: `assignmentId`, `definitionKey`, `triggerId`, `courseId`
   - Validates all parameters exist
   - Cleans up pending triggers if parameters missing

2. **Trigger Cleanup**
   - Deletes the trigger that launched this execution
   - Uses `TriggerController.deleteTriggerById(triggerId)`

3. **Progress Initialisation**
   - Starts progress tracking
   - Updates progress: "Assessment run starting."

4. **Definition Loading**
   - Loads full assignment definition via `AssignmentDefinitionController.getDefinitionByKey()`
   - Validates definition exists
   - Option `{ form: 'full' }` ensures all artifacts are loaded

5. **Course and Class Loading**
   - Gets courseId from stored properties
   - Loads ABClass via ABClassController
   - Checks if assignment exists in class and rehydrates if needed

6. **Assignment Instance Creation**
   - Calls `createAssignmentInstance(definition, courseId, assignmentId)`
   - Returns `SlidesAssignment` or `SheetsAssignment` instance

7. **Pipeline Execution**
   - Extracts students from ABClass
   - Determines if images should be processed (SLIDES only)
   - Calls `runAssignmentPipeline(assignment, students, options)`

8. **Persistence**
   - Updates assignment's `lastUpdated` timestamp
   - Persists assignment run via `ABClassController.persistAssignmentRun()`
   - Writes both full and partial (summary) versions to database

9. **Completion**
   - Marks progress as complete
   - Shows success toast message
   - Logs completion

**Error Handling** (lines 210-226):

- Catches any errors in try-catch
- Logs error via ProgressTracker
- Finally block:
  - Releases document lock
  - Cleans up document properties
  - Logs cleanup errors separately

**Classes Instantiated**:

- `TriggerController`: For trigger management
- `ABClassController`: For class data operations
- `AssignmentDefinitionController`: For definition operations

#### Step 3.3: Create Assignment Instance

**Method**: `AssignmentController.createAssignmentInstance()`

- **Location**: `src/backend/y_controllers/AssignmentController.js:236-242`
- **Parameters**:
  - `assignmentDefinition` (AssignmentDefinition): Definition instance
  - `courseId` (string): Google Classroom course ID
  - `assignmentId` (string): Google Classroom assignment ID
- **Process**:
  1. Wraps creation in `runStage()` for progress tracking
  2. Calls `Assignment.create()` factory method
  3. Returns appropriate subclass instance
- **Progress Messages**:
  - Start: "Creating Assignment instance."
  - Complete: "Assignment instance created."

**Static Factory Method**: `Assignment.create()`

- **Location**: `src/backend/AssignmentProcessor/Assignment.js:184-209`
- **Purpose**: Factory pattern for polymorphic instantiation
- **Process**:
  1. Validates assignmentDefinition parameter
  2. Checks `documentType` field
  3. Instantiates appropriate subclass:
     - `SLIDES` → `new SlidesAssignment()`
     - `SHEETS` → `new SheetsAssignment()`
  4. Throws error if unknown type
- **Returns**: `SlidesAssignment` or `SheetsAssignment` instance

**Class**: `SlidesAssignment` (extends `Assignment`)

- **Location**: `/src/backend/AssignmentProcessor/SlidesAssignment.js`
- **Constructor**:
  - Converts assignmentDefinition to instance if needed
  - Calls parent constructor with courseId, assignmentId, and definition
- **Properties Initialised**:
  - `courseId`, `assignmentId`, `assignmentName`
  - `assignmentDefinition` (embedded copy)
  - `submissions` (empty array)
  - `progressTracker` (singleton reference)
  - `_hydrationLevel` = 'full'

**Class**: `Assignment` (base class)

- **Location**: `src/backend/AssignmentProcessor/Assignment.js:6-695`
- **Constructor Properties**:

  ```javascript
  {
    courseId: string,
    assignmentId: string,
    assignmentName: string,
    assignmentMetadata: null,
    dueDate: null,
    lastUpdated: null,
    assignmentDefinition: AssignmentDefinition,
    submissions: [],
    progressTracker: ProgressTracker,
    _hydrationLevel: 'full'
  }
  ```

- Document metadata is accessed through the embedded `assignmentDefinition` object

---

### Phase 4: Assignment Processing Pipeline

#### Step 4.1: Run Assignment Pipeline

**Method**: `AssignmentController.runAssignmentPipeline()`

- **Location**: `src/backend/y_controllers/AssignmentController.js:252-324`
- **Parameters**:
  - `assignment` (Assignment): Assignment instance
  - `students` (Array): Student objects from ABClass
  - `options` (Object):
    - `includeImages` (boolean): Whether to process images
    - `definitionController` (AssignmentDefinitionController): For persistence
- **Purpose**: Executes all stages of assignment processing in sequence

**Pipeline Stages**:

##### Stage 1: Add Students (lines 256-262)

- **Progress**: "Adding students from class record."
- **Process**: Iterates through students array and calls `assignment.addStudent(student)` for each
- **Result**: Submissions array populated with StudentSubmission instances
- **Completion**: "{count} students added to the assignment from class record."

**Method**: `Assignment.addStudent(student)`

- **Location**: `src/backend/AssignmentProcessor/Assignment.js:500-519`
- **Process**:
  1. Extracts studentId from student object
  2. Checks for duplicates in submissions array
  3. Creates new `StudentSubmission` instance
  4. Attaches student metadata (non-persisted)
  5. Adds to submissions array
- **StudentSubmission Created**:

  ```javascript
  new StudentSubmission(
    studentId, // from student.id
    assignmentId, // from assignment
    null, // documentId - to be populated later
    studentName // from student.name
  );
  ```

##### Stage 2: Check Definition Freshness

- **Purpose**: Validate that the stored assignment definition is still fresh before proceeding
- **Process**:
  1. Gets reference and template modification times from Drive
  2. Checks per-document staleness via `DateUtils.isNewer(referenceModified, definition.referenceLastModified)` and `DateUtils.isNewer(templateModified, definition.templateLastModified)`
  3. If either document is stale:
     - Throws `DefinitionStaleError` with `definitionKey`, `referenceStale`, `templateStale`, `referenceLastModified`, `templateLastModified`
     - The error is caught by `processSelectedAssignment`'s try/catch and surfaced via `ProgressTracker.logAndThrowError`
  4. If neither is stale: proceeds with cached tasks from the definition
- **Why re-check here?**: The pipeline re-evaluates freshness at trigger time so any edits to the reference or template slides made after the `startAssessmentRun` API call are caught. When the definition is stale the pipeline now throws `DefinitionStaleError` instead of silently re-parsing, which surfaces the stale state via `ProgressTracker.logAndThrowError`.

**Method**: `SlidesAssignment.populateTasks()`

- **Location**: `/src/backend/AssignmentProcessor/SlidesAssignment.js`
- **Process**:
  1. Gets referenceDocumentId and templateDocumentId from definition
  2. Creates `SlidesParser` instance
  3. Calls `parser.extractTaskDefinitions(referenceDocumentId, templateDocumentId)`
  4. Validates each task definition
  5. Filters out invalid tasks (logs errors for missing artifacts)
  6. Stores valid tasks in `assignmentDefinition.tasks` as object keyed by task ID
- **Progress Messages**:
  - Start: "Getting the tasks from the reference document."
  - Complete: "Tasks populated from reference document."

**Class**: `SlidesParser` (extends `DocumentParser`)

- **Location**: `/src/backend/DocumentParsers/SlidesParser.js`
- **Method**: `extractTaskDefinitions(referenceId, templateId)`
  - Fetches both presentations via Slides API
  - Iterates through tagged slide elements in the reference and template decks
  - Matches reference and template content into one `TaskDefinition` by task title, even when page IDs differ
  - Builds stable Slides task IDs from task title while retaining the reference page ID as metadata
  - Stores source `documentId` on created reference and template artefacts
  - Returns array of `TaskDefinition` instances

**Class**: `TaskDefinition`

- **Location**: `/src/backend/Models/TaskDefinition.js`
- **Properties**:

  ```javascript
  {
    id: string,              // Generated ID
    taskTitle: string,       // From tagged slide element descriptions
    pageId: string,          // Slide page ID
    artifacts: {
      reference: [BaseTaskArtifact],  // Reference slide content
      template: [BaseTaskArtifact]    // Template slide content
    }
  }
  ```

- **Methods**:
  - `validate()`: Checks for required artifacts
  - `getId()`: Returns task ID
  - `getPrimaryReference()`: Gets first reference artifact
  - `getPrimaryTemplate()`: Gets first template artifact

##### Stage 3: Fetch Submitted Documents (lines 291-297)

- **Progress**: "Fetching submitted documents from students."
- **Process**: Calls `assignment.fetchSubmittedDocuments()`
- **Completion**: "Submitted documents fetched."

**Method**: `SlidesAssignment.fetchSubmittedDocuments()`

- **Location**: `/src/backend/AssignmentProcessor/SlidesAssignment.js`
- **Process**:
  - Defines SLIDES_MIME_TYPE constant
  - Calls parent method `fetchSubmittedDocumentsByMimeType(SLIDES_MIME_TYPE)`

**Method**: `Assignment.fetchSubmittedDocumentsByMimeType()`

- **Location**: `/src/backend/AssignmentProcessor/Assignment.js`
- **Process**:
  1. Calls Google Classroom API:
     - `Classroom.Courses.CourseWork.StudentSubmissions.list(courseId, assignmentId)`
  2. Iterates through submissions
  3. For each submission:
     - Extracts userId (student ID)
     - Gets attachments array
     - Processes each attachment via `_processAttachmentForSubmission()`
  4. Logs if no submissions or attachments found

**Helper Method**: `_processAttachmentForSubmission(attachment, studentId, mimeType)`

- **Location**: `/src/backend/AssignmentProcessor/Assignment.js`
- **Process**:
  1. Extracts driveFileId from attachment
  2. Fetches file from Drive
  3. Validates MIME type matches expected type
  4. Finds matching StudentSubmission in submissions array
  5. Sets documentId on submission
  6. Updates submission timestamp via `touchUpdated()`
- **Result**: Each StudentSubmission now has a documentId property pointing to their submission

##### Stage 4: Extract Student Work (lines 299-305)

- **Progress**: "Extracting student work from documents."
- **Process**: Calls `assignment.processAllSubmissions()`
- **Completion**: "All student work extracted."

**Method**: `SlidesAssignment.processAllSubmissions()`

- **Location**: `/src/backend/AssignmentProcessor/SlidesAssignment.js`
- **Process**:
  1. Creates `SlidesParser` instance
  2. Gets task definitions from assignment
  3. Iterates through each submission
  4. For each submission:
     - Updates progress with ordinal position
     - Calls `parser.extractSubmissionArtifacts(documentId, taskDefs)`
     - For each artifact returned:
       - Gets corresponding TaskDefinition
       - Calls `submission.upsertItemFromExtraction(taskDef, extractionData)`
  5. Skips submissions without documentId

**Method**: `SlidesParser.extractSubmissionArtifacts(documentId, taskDefs)`

- **Location**: `/src/backend/DocumentParsers/SlidesParser.js`
- **Process**:
  1. Fetches presentation via Slides API
  2. Builds an index of tagged student slide elements across the whole deck
  3. For each task definition:
     - Matches student content by stable task ID first, then task title
     - Accepts moved or copied slides with different page IDs
     - Extracts text, table, or tagged image artefacts based on the definition type
     - Preserves the matched student `pageId` and submission `documentId` on the extraction
  4. Returns array of artifacts

**Method**: `StudentSubmission.upsertItemFromExtraction(taskDef, extractionData)`

- **Location**: `/src/backend/Models/StudentSubmission.js`
- **Process**:
  1. Gets or creates StudentSubmissionItem for taskId
  2. Creates new artifact from extraction data
  3. Sets artifact properties (pageId, content, metadata, documentId)
  4. Stores artifact in item
  5. Updates item timestamp

**Class**: `StudentSubmissionItem`

- **Location**: `/src/backend/Models/StudentSubmission.js` (both classes in the same file)
- **Properties**:

  ```javascript
  {
    id: string,              // Derived ID (ssi_{hash})
    taskId: string,
    artifact: BaseTaskArtifact,  // Student's work
    assessments: {},             // Populated later (stored as JSON)
    feedback: {},                // Populated later (stored as JSON, keyed by type)
  }
  ```

**Data Structure After Extraction**:

```javascript
assignment.submissions = [
  {
    studentId: '123',
    studentName: 'Jane Doe',
    assignmentId: '456',
    documentId: 'abc789',
    items: {
      task_001: {
        taskId: 'task_001',
        artifact: {
          content: 'base64_encoded_image_data',
          contentHash: 'hash_value',
          pageId: 'slide_123',
          metadata: {},
        },
        assessments: {},
        feedback: {},
      },
      // ... more items
    },
  },
  // ... more submissions
];
```

##### Stage 5: Process Images (lines 307-315) - SLIDES ONLY

- **Condition**: Only runs if `includeImages` is true (Slides assignments)
- **Progress**: "Processing Images."
- **Process**: Calls `assignment.processImages()`
- **Completion**: "Images uploaded."

**Method**: `SlidesAssignment.processImages()`

- **Location**: `/src/backend/AssignmentProcessor/SlidesAssignment.js`
- **Process**:
  1. Creates `ImageManager` instance
  2. Collects all image artifacts via `imageManager.collectAllImageArtifacts(this)`
  3. If no artifacts, returns early
  4. Fetches images as blobs via `imageManager.fetchImagesAsBlobs(entries)`
  5. Writes blobs back to artifacts via `imageManager.writeBackBlobs(this, blobs)`
  6. Logs completion

**Class**: `ImageManager`

- **Location**: `src/backend/RequestHandlers/ImageManager.js`
- **Purpose**: Batch-processes images for LLM consumption
- **Methods**:
  - `collectAllImageArtifacts(assignment)`: Gathers all image artifact references
  - `fetchImagesAsBlobs(entries)`: Downloads images in batches
  - `writeBackBlobs(assignment, blobs)`: Updates artifacts with base64 content

##### Stage 6: Assess Responses (lines 317-323)

- **Progress**: "Assessing student responses."
- **Process**: Calls `assignment.assessResponses()`
- **Completion**: "Responses assessed."

**Method**: `Assignment.assessResponses()` (base implementation)

- **Location**: `src/backend/AssignmentProcessor/Assignment.js:645-654`
- **Purpose**: Routes to appropriate assessor based on document type
- **Process**:
  1. Creates `LLMRequestManager` instance via `_getLLMManager()`
  2. Generates request objects via `manager.generateRequestObjects(this)`
  3. If no requests, shows toast and returns
  4. Processes responses via `manager.processStudentResponses(requests, this)`

**For Sheets Assignments**: `SheetsAssignment.assessResponses()` (overridden)

- Uses `SheetsAssessor` for formula-based assessment instead of LLM

#### Step 4.2: LLM Assessment Process (for Slides/Text/Images)

**Class**: `LLMRequestManager` (extends `BaseRequestManager`)

- **Location**: `src/backend/RequestHandlers/LLMRequestManager.js`

**Method**: `generateRequestObjects(assignment)`

- **Location**: Lines 24-105
- **Purpose**: Creates HTTP request objects for LLM API calls
- **Process**:
  1. Initialises counters and UID index
  2. Gets backend URL and API key from configuration
  3. For each submission's items:
     - Gets task definition and artifact type
     - Skips SPREADSHEET types (handled by SheetsAssessor)
     - Checks for "not attempted" (student hash equals template hash)
       - If not attempted, creates special assessment and skips LLM
     - Checks cache using reference and student content hashes
       - If cached, assigns cached assessment and skips LLM
     - If no cache hit, creates request object
  4. Builds UID index for response routing
  5. Returns array of request objects
- **Request Object Structure**:

  ```javascript
  {
    uid: string,           // Unique identifier
    url: string,           // Backend API endpoint
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      taskType: string,      // TEXT, IMAGE, TABLE
      reference: string,     // Reference content
      template: string,      // Template content
      studentResponse: string // Student content
    }),
    headers: { Authorization: 'Bearer {apiKey}' },
    muteHttpExceptions: true
  }
  ```

- **Logging**: Reports cache hits, new requests, and not-attempted count

**Method**: `processStudentResponses(requests, assignment)`

- **Purpose**: Sends requests and processes responses
- **Process**:
  1. Sends all requests in batch via `UrlFetchApp.fetchAll(requests)`
  2. Calls `processResponses(responses, requests, assignment)`
  3. Processes each response individually

**Method**: `_processSingleResponse(response, request, assignment)`

- **Process**:
  1. Checks HTTP response code
  2. Parses JSON response body
  3. Validates assessment structure
  4. Extracts UID from request
  5. Looks up submission and item from UID index
  6. Assigns assessment artifacts to item via `_assignAssessmentArtifacts()`
  7. Caches successful assessments
  8. Handles validation failures with retry logic

**Method**: `_assignAssessmentArtifacts(item, assessmentData)`

- **Purpose**: Attaches assessment results to StudentSubmissionItem
- **Process**:
  1. Creates Assessment instances for each category
  2. Calls `item.addAssessment(category, assessment)`
  3. Adds feedback if present
- **Assessment Categories**:
  - `completeness`: How complete is the work
  - `accuracy`: How accurate is the work
  - `spag`: Spelling, Punctuation, and Grammar
- **Assessment Model**:
  - Each assessment is an instance of the `Assessment` class
  - Contains `score` (0-5 or 'N' for not attempted) and `reasoning` (explanation text); partial hydration summaries remove `reasoning` to keep the payload lightweight
  - Stored as JSON in StudentSubmissionItem.assessments

**Class**: `Assessment`

- **Location**: `src/backend/Models/Assessment.js`
- **Properties**:

  ```javascript
  {
    score: number | string, // 0-5 or 'N' (for not attempted)
    reasoning: string       // Explanation
  }
  ```

**Result After Assessment**:

```javascript
submission.items["task_001"] = {
  taskId: "task_001",
  artifact: { ... },
  assessments: {
    completeness: Assessment { score: 4, reasoning: "..." },
    accuracy: Assessment { score: 5, reasoning: "..." },
    spag: Assessment { score: 3, reasoning: "..." }
  },
  feedback: {
    general: { text: "Great work!", category: "general" }
  }
}
```

#### Step 4.3: Sheets Assessment Process (for Spreadsheets)

**Method**: `SheetsAssignment.assessResponses()` (overridden)

- **Location**: `src/backend/AssignmentProcessor/SheetsAssignment.js`
- **Process**:
  1. Creates `SheetsAssessor` instance with tasks and submissions
  2. Calls `assessor.assessResponses()`
  3. Does NOT use LLM - formula-based assessment only

**Class**: `SheetsAssessor`

- **Location**: `src/backend/Assessors/SheetsAssessor.js`

**Method**: `SheetsAssessor.assessResponses()`

- **Location**: Lines 18-84
- **Process**:
  1. Iterates through submissions
  2. For each submission's items:
     - Gets corresponding task definition
     - Skips non-formula responses
     - Calls `assessFormulaeTasks()` for formula assessment
     - Adds assessments to submission
     - Adds formula comparison results
     - Adds cell reference feedback

**Method**: `assessFormulaeTasks()`

- **Purpose**: Compares student formulas against reference formulas
- **Process**:
  1. Extracts formulas from student response and reference
  2. Compares formulas cell by cell
  3. Generates completeness assessment (% of cells completed)
  4. Generates accuracy assessment (% of formulas correct)
  5. Generates spag assessment (formula syntax quality)
  6. Creates feedback for incorrect cell references
- **Returns**:

  ```javascript
  {
    completenessAssessment: Assessment,
    accuracyAssessment: Assessment,
    spagAssessment: Assessment,
    formulaComparisonResults: {
      cellReferenceFeedback: Feedback[]
    }
  }
  ```

---

### Phase 5: Data Persistence

#### Step 5.1: Update Timestamp

**Method**: `Assignment.touchUpdated()`

- **Location**: `src/backend/AssignmentProcessor/Assignment.js`
- **Purpose**: Sets lastUpdated to current timestamp
- **Called**: Line 196 in `processSelectedAssignment()`

#### Step 5.2: Persist Assignment Run

**Method**: `ABClassController.persistAssignmentRun(abClass, assignment)`

- **Location**: `src/backend/y_controllers/ABClassController.js`
- **Purpose**: Saves assignment data in two forms
- **Process**:
  1. Saves full assignment to dedicated collection
     - Collection key: `assign_full_{courseId}_{assignmentId}`
     - Contains complete data with all artifacts and content
  2. Creates partial (summary) assignment
     - Redacts artifact content and hashes
     - Keeps structure but removes heavy payloads
  3. Updates/adds partial assignment to ABClass.assignments array
  4. Saves updated ABClass to database
     - Collection key: `class_{courseId}`

**Data Shapes Persisted**:

**Full Assignment Record** (`assign_full_*`):

```javascript
{
  courseId: string,
  assignmentId: string,
  assignmentName: string,
  lastUpdated: ISO date string,
  assignmentDefinition: {
    primaryTitle: string,
    documentType: "SLIDES" | "SHEETS",
    referenceDocumentId: string,
    templateDocumentId: string,
    tasks: {
      "task_001": {
        id: "task_001",
        taskTitle: string,
        artifacts: {
          reference: [{ content: "...", contentHash: "..." }],
          template: [{ content: "...", contentHash: "..." }]
        }
      }
    }
  },
  submissions: [
    {
      studentId: string,
      studentName: string,
      documentId: string,
      items: {
        "task_001": {
          taskId: "task_001",
          artifact: { content: "...", contentHash: "..." },
          assessments: {
            completeness: { score: 4, reasoning: "..." },
            accuracy: { score: 5, reasoning: "..." },
            spag: { score: 3, reasoning: "..." }
          },
          feedback: [...]
        }
      }
    }
  ]
}
```

**Partial Assignment in ABClass** (`class_*`):

```javascript
{
  // Same structure but:
  // - artifact.content = null
  // - artifact.contentHash = null
  // - Lightweight for list views and cohort analysis
}
```

#### Step 5.3: Progress Completion

**Method**: `ProgressTracker.complete()`

- **Location**: `src/backend/Utils/ProgressTracker.js`
- **Purpose**: Marks progress as complete
- **Process**:
  1. Sets completion flag
  2. Writes final status to Progress sheet
  3. Clears any error flags
  4. Logs completion time

**Progress Updates Throughout Flow**:

- ProgressTracker is a singleton that maintains state throughout execution
- Updates are written to a "Progress" sheet in the spreadsheet
- Users can check progress via "Check Progress" menu item
- Updates include:
  - Current step description
  - Timestamp
  - Percentage complete
  - Error messages if any

---

## Key Data Structures

### AssignmentDefinition

```javascript
{
  primaryTitle: string,
  primaryTopicKey: string | null,
  primaryTopic: string | null, // resolved display label
  yearGroup: number | null,
  alternateTitles: string[],
  documentType: "SLIDES" | "SHEETS",
  referenceDocumentId: string,
  templateDocumentId: string,
  referenceLastModified: ISO date string,
  templateLastModified: ISO date string,
  assignmentWeighting: number | null,
  definitionKey: string, // stable opaque identifier for API upsert
  tasks: {
    [taskId]: TaskDefinition
  },
  createdAt: ISO date string,
  updatedAt: ISO date string
}
```

### TaskDefinition

```javascript
{
  id: string,
  taskTitle: string,
  pageId: string,
  documentId: string,
  artifacts: {
    reference: BaseTaskArtifact[],
    template: BaseTaskArtifact[]
  }
}
```

### BaseTaskArtifact

```javascript
{
  content: string | null,      // Base64 or text content
  contentHash: string | null,  // SHA-256 hash
  pageId: string,
  metadata: object,
  artifactType: "IMAGE" | "TEXT" | "TABLE" | "SPREADSHEET"
}
```

### StudentSubmission

```javascript
{
  studentId: string,
  studentName: string,     // Temporary for v0.7.2, will be removed
  assignmentId: string,
  documentId: string,
  items: {
    [taskId]: StudentSubmissionItem  // keyed by taskId
  },
  createdAt: ISO date string,
  updatedAt: ISO date string  // with counter suffix (e.g., "...Z#1")
}
```

### StudentSubmissionItem

```javascript
{
  id: string,              // Derived ID (ssi_{hash})
  taskId: string,
  artifact: BaseTaskArtifact,
  assessments: {           // JSON representations of Assessment objects
    completeness: {
      score: number | string,  // 0-5 or 'N'
      reasoning: string
    },
    accuracy: {
      score: number | string,  // 0-5 or 'N'
      reasoning: string
    },
    spag: {
      score: number | string,  // 0-5 or 'N'
      reasoning: string
    }
  },
  feedback: {              // JSON representations keyed by type
    general: {
      text: string,
      category: string
    }
  }
}
```

> **Note:** Partial summaries (such as the ABClass/JsonDbApp payloads) keep the assessment map but remove each `reasoning` field so only the `score` (and any non-reasoning metadata) remains until a full hydration rehydrates the explanations.

### Assessment

```javascript
{
  score: number | string,  // 0-5 or 'N' (for not attempted)
  reasoning: string        // Explanation text from LLM
}
```

---

## Error Handling and Logging

### ProgressTracker

- **Location**: `src/backend/Utils/ProgressTracker.js`
- **Purpose**: Singleton for tracking progress and logging user-facing errors
- **Key Methods**:
  - `updateProgress(message, incrementStep)`: Updates progress display
  - `logError(userMessage, devDetails)`: Logs user-facing error
  - `logAndThrowError(message, error)`: Logs and throws error
  - `startTracking()`: Initialises progress tracking
  - `complete()`: Marks process as complete

### ABLogger

- **Location**: `src/backend/Utils/ABLogger.js`
- **Purpose**: Singleton for developer diagnostic logging
- **Key Methods**:
  - `info(message, data)`: Informational log
  - `warn(message, data)`: Warning log
  - `error(message, error)`: Error log
  - `debugUi(message, data)`: UI-specific debug log

### Error Flow

1. Errors in user-facing operations → `ProgressTracker.logError()`
2. Developer diagnostics → `ABLogger.error/warn/info()`
3. Critical top-level failures may use both channels, but each should carry its own purpose-specific detail without duplicating the same error payload in both
4. Never use `console.*` in production code

---

## Caching Strategy

### LLM Assessment Cache

- **Manager**: `CacheManager`
- **Location**: `src/backend/RequestHandlers/CacheManager.js`
- **Key**: `{referenceHash}_{studentHash}`
- **Stored**: Assessment objects (completeness, accuracy, spag)
- **Purpose**: Avoid re-assessing identical student responses
- **Invalidation**: When reference content changes (new hash)

### Assignment Definition Cache

- **Storage**: JsonDbApp collections
- **Full Definition**: `assdef_full_{definitionKey}`
- **Partial Definition**: `assignment_definitions` collection
- **Refresh Logic**:
  - Compare Drive file modification times
  - Re-parse only if reference or template changed
  - Update timestamps in definition after refresh
- **Write ordering for API upserts**:
  - Persist the full-definition store first
  - Persist the registry partial second
  - Attempt rollback of the full-definition write if the later registry write fails
  - Surface a repair-required hard failure if rollback also fails

---

## Complete Method Call Chain

Here's the complete chain from user action to completion:

```text
Frontend calls startAssessmentRun() via apiHandler
  ↓
startAssessmentRun() [apiHandler → startAssessmentRun_]
  ↓
AssignmentController.startAssessmentRun()
  ├─ AssignmentDefinitionController.getDefinitionByKey()
  ├─ _validateDefinitionFreshness() [DateUtils.isNewer]
  ├─ ABClassController.loadClass()
  └─ AssignmentController.startProcessing()
      ├─ TriggerController.createTimeBasedTrigger()
      └─ GASPropertiesUtils.applyProperties() [x4]
  ↓
ProgressTracker.startTracking()
  ↓
[5 second delay - trigger fires]
  ↓
triggerProcessSelectedAssignment() [trigger → globals]
  ↓
AssignmentController.processSelectedAssignment()
  ├─ LockService.getDocumentLock()
  ├─ GASPropertiesUtils.getUserProperties() [x4]
  ├─ TriggerController.deleteTriggerById()
  ├─ ABClassController.loadClass()
  ├─ AssignmentDefinitionController.getDefinitionByKey()
  ├─ AssignmentController.createAssignmentInstance()
  │   └─ Assignment.create()
  │       └─ new SlidesAssignment() or new SheetsAssignment()
  ├─ AssignmentController.runAssignmentPipeline()
  │   ├─ Assignment.addStudent() [for each student]
   │   ├─ DriveManager.getFileModifiedTime() [x2]
   │   ├─ AssignmentController._validateDefinitionFreshness()
  │   ├─ [If refresh needed]:
  │   │   ├─ SlidesAssignment.populateTasks()
  │   │   │   └─ SlidesParser.extractTaskDefinitions()
  │   │   │       └─ Creates TaskDefinition instances
  │   │   └─ AssignmentDefinitionController.saveDefinition()
  │   ├─ Assignment.fetchSubmittedDocuments()
  │   │   └─ Assignment.fetchSubmittedDocumentsByMimeType()
  │   │       ├─ Classroom.Courses.CourseWork.StudentSubmissions.list()
  │   │       └─ Assignment._processAttachmentForSubmission() [for each]
  │   ├─ SlidesAssignment.processAllSubmissions()
  │   │   └─ SlidesParser.extractSubmissionArtifacts() [for each student]
  │   │       └─ StudentSubmission.upsertItemFromExtraction()
  │   ├─ [If SLIDES]: SlidesAssignment.processImages()
  │   │   ├─ ImageManager.collectAllImageArtifacts()
  │   │   ├─ ImageManager.fetchImagesAsBlobs()
  │   │   └─ ImageManager.writeBackBlobs()
  │   └─ Assignment.assessResponses()
  │       ├─ [If SLIDES/TEXT]: LLMRequestManager flow
  │       │   ├─ LLMRequestManager.generateRequestObjects()
  │       │   │   ├─ CacheManager.getCachedAssessment() [for each item]
  │       │   │   └─ Build HTTP request objects
  │       │   └─ LLMRequestManager.processStudentResponses()
  │       │       ├─ UrlFetchApp.fetchAll()
  │       │       ├─ Process each response
  │       │       ├─ Assign assessments to items
  │       │       └─ CacheManager.cacheAssessment() [for each]
  │       └─ [If SHEETS]: SheetsAssessor.assessResponses()
  │           └─ SheetsAssessor.assessFormulaeTasks() [for each item]
  ├─ Assignment.touchUpdated()
  ├─ ABClassController.persistAssignmentRun()
  │   ├─ Save full assignment to `assign_full_*`
  │   ├─ Create partial assignment
  │   └─ Update ABClass.assignments and save to `class_*`
  ├─ ProgressTracker.complete()
  └─ GASPropertiesUtils.clearProperties()
```

---

## Summary of Components by Role

### Controllers

- `AssignmentController`: Main orchestrator for assessment workflow
- `AssignmentDefinitionController`: Manages assignment definitions
- `ABClassController`: Manages class data and persistence
- `TriggerController`: Manages Apps Script triggers

### Models

- `Assignment` (base class): Shared functionality
- `SlidesAssignment`: Google Slides-specific implementation
- `SheetsAssignment`: Google Sheets-specific implementation
- `AssignmentDefinition`: Reusable lesson/assignment metadata
- `TaskDefinition`: Individual task within assignment
- `StudentSubmission`: Student's submission container
- `StudentSubmissionItem`: Individual task response
- `Assessment`: Assessment result for one category
- `Feedback`: Feedback message
- `ABClass`: Class/cohort data container
- `Student`: Student data model

### Processors/Parsers

- `SlidesParser`: Extracts content from Google Slides
- `SheetsParser`: Extracts content from Google Sheets
- `ImageManager`: Batch-processes images

### Assessors

- `LLMRequestManager`: Manages LLM API calls for text/image assessment
- `SheetsAssessor`: Formula-based assessment for spreadsheets
- `CacheManager`: Caches assessment results

### Utilities

- `ProgressTracker`: Singleton for progress tracking and user errors
- `ABLogger`: Singleton for developer logging
- `Utils`: General utility functions
- `DriveManager`: Google Drive operations
- `ConfigurationManager`: Singleton for configuration management
- `DbManager`: Singleton for JsonDbApp database operations
  - Manages collections for assignments, definitions, and classes
  - Provides abstraction over JsonDbApp library

### External Services

- `ClassroomApiClient`: Google Classroom API wrapper
- Google Apps Script services: `LockService`, `PropertiesService`, `DriveApp`, `Classroom`, `Slides`, `Sheets`

---

## Extension Points and Considerations

### Adding New Document Types

To add a new document type (e.g., Google Docs):

1. Create new subclass in `AssignmentProcessor/` (e.g., `DocsAssignment.js`)
2. Extend `Assignment` base class
3. Implement required methods:
   - `populateTasks()`: Parse reference/template documents
   - `fetchSubmittedDocuments()`: Get student submissions
   - `processAllSubmissions()`: Extract student responses
   - `assessResponses()`: Route to appropriate assessor (optional override)
4. Add MIME type constant for the new document type
5. Update `Assignment.create()` factory method to handle new type
6. Create corresponding parser in `DocumentParsers/` if needed

### Adding New Assessment Types

To add a new assessment category (beyond completeness, accuracy, spag):

1. Update LLM backend API to return new category
2. Modify `LLMRequestManager._assignAssessmentArtifacts()` to handle new category
3. Update any analysis or reporting views to display the new category
4. No changes needed to data models (assessments stored as flexible objects)

### Extending the Pipeline

To add new processing stages:

1. Add stage in `AssignmentController.runAssignmentPipeline()`
2. Use `runStage()` helper for consistent progress tracking
3. Follow existing patterns for error handling
4. Consider impact on caching (may need cache invalidation)

### Performance Considerations

1. **Batch Operations**: Always use `UrlFetchApp.fetchAll()` for multiple HTTP requests
2. **Caching**: Check cache before expensive operations (LLM calls, Drive file fetches)
3. **Progressive Loading**: Use partial hydration for list views, full hydration only when needed
4. **Lock Management**: Always use document lock for long-running operations
5. **Trigger Pattern**: Keep user-facing operations fast by delegating heavy work to triggers

### Testing Considerations

1. **No GAS Services in Tests**: Tests use Vitest and cannot call Apps Script services
2. **Test Serialisation**: All models must implement `toJSON()` and `fromJSON()`
3. **Mock External APIs**: Google Classroom, Drive, Slides, Sheets APIs must be mocked
4. **See**: `/docs/developer/backend/backend-testing.md` for complete backend testing guidelines

### Common Troubleshooting Scenarios

**Assessment doesn't start:**

- Check Progress sheet for errors
- Verify trigger was created (check document properties)
- Check ProgressTracker logs for error messages
- Verify user has necessary permissions

**Cache not working:**

- Check content hashes are being generated correctly
- Verify CacheManager is storing/retrieving properly
- Content changes should generate new hashes automatically

**Students missing from results:**

- Check if students have submitted work in Google Classroom
- Verify MIME type matches (Slides vs Sheets)
- Check DriveApp permissions for accessing student files

**Tasks not appearing:**

- Verify task titles in tagged slide element descriptions or sheet headers
- Check TaskDefinition validation (must have reference and template artifacts)
- Review task parsing logs in ABLogger output

**Trigger fails to execute:**

- Check for document lock conflicts
- Verify document properties contain required parameters
- Check for "too many triggers" error (TriggerController handles cleanup)

**Progress tracking stops:**

- Check for uncaught exceptions in pipeline
- Verify ProgressTracker.complete() is called
- Check lock timeout (5 seconds default)
