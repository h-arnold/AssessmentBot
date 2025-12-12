# Assessment Flow Documentation

## Summary Outline

This document traces the complete assessment flow in AssessmentBot, starting from the user clicking "Assess Student Work" in the menu and ending with completed assessments written to the Analysis and Overview sheets.

### High-Level Flow

1. **UI Interaction Phase** - User selects assignment and provides document IDs
2. **Trigger Setup Phase** - System creates time-based trigger with stored parameters
3. **Trigger Execution Phase** - Trigger fires and orchestrates the assessment pipeline
4. **Assignment Processing Pipeline** - Multi-stage processing including:
   - Assignment instance creation
   - Student roster hydration
   - Task definition parsing/caching
   - Submission document fetching
   - Content extraction
   - Image processing (Slides only)
   - Assessment execution (LLM or formula-based)
   - Data persistence
   - Analysis sheet generation

### Key Components

- **UI Layer**: `UIManager`, HTML templates
- **Controllers**: `AssignmentController`, `AssignmentDefinitionController`, `ABClassController`
- **Models**: `Assignment` (base), `SlidesAssignment`, `SheetsAssignment`, `AssignmentDefinition`, `TaskDefinition`, `StudentSubmission`
- **Processors**: `SlidesParser`, `SheetsParser`, Document parsers
- **Assessors**: `LLMRequestManager`, `SheetsAssessor`
- **Managers**: `GoogleClassroomManager`, `ImageManager`, `AnalysisSheetManager`, `OverviewSheetManager`
- **Utilities**: `ProgressTracker`, `TriggerController`, `DriveManager`, `Utils`

### Notes on Data Flow

1. **Progressive Hydration**: Data starts lightweight (just IDs and metadata) and progressively adds content as needed
2. **Two-Tier Persistence**: Full data in dedicated collections, partial summaries in ABClass for performance
   - Full assignment: `assign_full_{courseId}_{assignmentId}` collection
   - Full definition: `assdef_full_{definitionKey}` collection
   - Partial summaries: Stored in `class_{courseId}` and `assignment_definitions` collections
3. **Cache-First Assessment**: Always check cache before calling LLM to save API calls and time
4. **Fail-Fast Error Handling**: Errors propagate up immediately, logged at each level
5. **Singleton Pattern**: UIManager, ProgressTracker, ABLogger, ConfigurationManager, DbManager are all singletons
6. **Factory Pattern**: Assignment.create() returns appropriate subclass based on documentType
7. **Progress Tracking**: ProgressTracker updates visible to user throughout flow via Progress sheet
8. **Lock Management**: Document lock prevents concurrent assessment runs using LockService
9. **Trigger Pattern**: Time-based trigger decouples user action from heavy processing (5-second delay)
10. **Document Properties**: Used for cross-execution parameter passing between trigger setup and execution
11. **Lazy Loading**: Task definitions only re-parsed when Drive file modification times are newer than cached timestamps
12. **Batch Operations**: LLM requests sent in batches via `UrlFetchApp.fetchAll()` for efficiency

---

## Detailed Flow Documentation

### Phase 1: UI Interaction - Assignment Selection

#### Step 1.1: Show Assignment Dropdown

**Entry Points**: 
- Admin Sheet: User clicks "Debug" > "Assess Student Work" menu item
- Assessment Record: User clicks "Assessment Bot" > "Assess Assignment" menu item

**Global Function**: `showAssignmentDropdown()` (in `UI/globals.js`)

- **Location**: `/src/AdminSheet/UI/globals.js:41-44`
- **Purpose**: Global wrapper that delegates to UIManager
- **Calls**: `UIManager.getInstance().showAssignmentDropdown()`

**Method**: `UIManager.showAssignmentDropdown()`

- **Location**: `/src/AdminSheet/UI/UIManager.js:251-262`
- **Class**: `UIManager` (singleton extending `BaseSingleton`)
- **Process**:
  1. Ensures `GoogleClassroomManager` is initialised via `ensureClassroomManager()`
  2. Gets `courseId` from the classroom manager
  3. Fetches assignments via `cm.getAssignments(courseId)`
  4. Calculates modal width based on longest assignment title
  5. Calls `_showTemplateDialog()` with assignment data
- **Data Passed**:
  ```javascript
  {
    assignments: [
      { id: 'assignmentId', title: 'Assignment Title' },
      // ... more assignments
    ];
  }
  ```
- **Template Shown**: `UI/AssignmentDropdown.html`

**GoogleClassroomManager Methods**:

- `getCourseId()`: Retrieves course ID from configuration
- `getAssignments(courseId)`: Fetches assignments from Google Classroom API
  - **Returns**: Array of assignment objects with `id` and `title` properties

**HTML Template**: `AssignmentDropdown.html`

- **Location**: `/src/AdminSheet/UI/AssignmentDropdown.html`
- **Displays**: Dropdown list of assignments using Materialize CSS
- **User Action**: User selects an assignment and clicks "Go" button
- **On Go Click**: JavaScript function `go()` is called
  - Constructs assignment data: `{ id: assignmentId, name: assignmentName }`
  - Calls server-side function: `google.script.run.openReferenceSlideModal(assignmentData)`

#### Step 1.2: Open Reference Slide Modal

**Global Function**: `openReferenceSlideModal(assignmentData)`

- **Location**: `/src/AdminSheet/UI/globals.js:17-20`
- **Parameters**:
  - `assignmentData` (string): JSON string containing `{ id, name }`
- **Calls**: `UIManager.getInstance().openReferenceSlideModal(assignmentData)`

**Method**: `UIManager.openReferenceSlideModal(assignmentData)`

- **Location**: `/src/AdminSheet/UI/UIManager.js:285-320`
- **Process**:
  1. Parses the JSON assignment data
  2. Retrieves course ID from GoogleClassroomManager
  3. Fetches courseWork details from Google Classroom API
  4. Extracts `topicId` from courseWork
  5. Loads `ABClass` instance to get `yearGroup`
  6. Fetches topic name if topicId exists
  7. Builds `definitionKey` using `AssignmentDefinition.buildDefinitionKey()`
  8. Attempts to load existing definition via `AssignmentDefinitionController`
  9. Extracts saved document IDs from definition if it exists
  10. Shows modal with assignment data and saved document IDs
- **Data Passed to Template**:
  ```javascript
  {
    assignmentDataObj: { id: "assignmentId", name: "Assignment Name" },
    savedDocumentIds: {
      referenceDocumentId: "docId" || "",
      templateDocumentId: "docId" || ""
    }
  }
  ```
- **Template Shown**: `UI/SlideIdsModal.html`

**Classes Used**:

- `ABClassController`: Loads class data
  - `loadClass(courseId)`: Returns `ABClass` instance
- `AssignmentDefinitionController`: Manages assignment definitions
  - `getDefinitionByKey(definitionKey)`: Returns `AssignmentDefinition` or null
- `ClassroomApiClient`: Fetches topic information
  - `fetchTopicName(courseId, topicId)`: Returns topic name string
- `AssignmentDefinition`: Static method for key generation
  - `buildDefinitionKey({ primaryTitle, primaryTopic, yearGroup })`: Returns definition key string
    - Format: `"{primaryTitle}_{primaryTopic}_{yearGroup}"` (e.g., "Essay 1_English_10")
    - Used to uniquely identify definitions across courses and years

**HTML Template**: `SlideIdsModal.html`

- **Location**: `/src/AdminSheet/UI/SlideIdsModal.html`
- **Displays**: Form with two input fields for document IDs (pre-filled if previously saved)
- **Validation**: Ensures reference and template IDs are different
- **User Action**: User enters/confirms document IDs and clicks "Go" button
- **On Go Click**: JavaScript function `saveAndRun()` is called
  - Shows loading overlay
  - Calls server-side function: `google.script.run.saveStartAndShowProgress(assignmentTitle, documentIds, assignmentId)`

#### Step 1.3: Save and Start Processing

**Global Function**: `saveStartAndShowProgress(assignmentTitle, documentIds, assignmentId)`

- **Location**: `/src/AdminSheet/AssignmentProcessor/globals.js:14-28`
- **Parameters**:
  - `assignmentTitle` (string): The assignment title
  - `documentIds` (object): `{ referenceDocumentId, templateDocumentId }`
  - `assignmentId` (string): Google Classroom assignment ID
- **Calls**: `AssignmentController.saveStartAndShowProgress(assignmentTitle, documentIds, assignmentId)`

**Method**: `AssignmentController.saveStartAndShowProgress()`

- **Location**: `/src/AdminSheet/y_controllers/AssignmentController.js:28-57`
- **Class**: `AssignmentController` (non-singleton controller)
- **Process**:
  1. Calls `ensureDefinitionFromInputs()` to get/create definition
  2. Calls `startProcessing()` with assignmentId and definitionKey
  3. Starts progress tracking via `ProgressTracker.getInstance().startTracking()`
  4. Shows progress modal via `UIManager.getInstance().showProgressModal()`
- **Error Handling**:
  - Shows toast message on failure
  - Logs error via `progressTracker.logAndThrowError()`

---

### Phase 2: Trigger Setup and Parameter Storage

#### Step 2.1: Ensure Assignment Definition

**Method**: `AssignmentController.ensureDefinitionFromInputs()`

- **Location**: `/src/AdminSheet/y_controllers/AssignmentController.js:398-427`
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
  5. Calls `AssignmentDefinitionController.ensureDefinition()` to get/create definition
- **Returns**:
  ```javascript
  {
    definition: AssignmentDefinition,
    courseId: string,
    abClass: ABClass
  }
  ```

**Helper Method**: `_detectDocumentType(referenceDocumentId, templateDocumentId)`

- **Location**: `/src/AdminSheet/y_controllers/AssignmentController.js:362-386`
- **Process**:
  1. Gets file from Drive using DriveApp.getFileById()
  2. Checks MIME type for each document
  3. Validates both documents are the same type
  4. Returns 'SLIDES' or 'SHEETS'
- **MIME Types**:
  - Slides: `application/vnd.google-apps.presentation`
  - Sheets: `application/vnd.google-apps.spreadsheet`

**Controller**: `AssignmentDefinitionController.ensureDefinition()`

- **Location**: `/src/AdminSheet/y_controllers/AssignmentDefinitionController.js`
- **Purpose**: Gets existing definition or creates new one
- **Process**:
  1. Builds definition key from parameters
  2. Attempts to load from database
  3. If not found, creates new `AssignmentDefinition` instance
  4. Saves to database if newly created
- **Returns**: `AssignmentDefinition` instance

#### Step 2.2: Create Time-Based Trigger

**Method**: `AssignmentController.startProcessing(assignmentId, definitionKey)`

- **Location**: `/src/AdminSheet/y_controllers/AssignmentController.js:68-95`
- **Parameters**:
  - `assignmentId` (string): Google Classroom assignment ID
  - `definitionKey` (string): Assignment definition key
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

- **Location**: `/src/AdminSheet/Utils/TriggerController.js`
- **Key Method**: `createTimeBasedTrigger(functionName, triggerTime)`
  - Creates a ScriptApp trigger set to run at specified time
  - If triggerTime not provided, defaults to 5 seconds from now
  - Returns trigger ID for later cleanup
  - Trigger will execute the named global function
  - Handles "too many triggers" error by cleaning up and retrying

**Helper Method**: `applyDocumentProperties(properties, propertyMap)`

- **Location**: `/src/AdminSheet/y_controllers/AssignmentController.js:347-351`
- **Purpose**: Sets multiple document properties from object
- **Parameters**:
  - `properties`: PropertiesService document properties instance
  - `propertyMap`: Object with key-value pairs to store
- **Process**: Iterates through propertyMap and calls `properties.setProperty(key, value)` for each

**Helper Method**: `runStage(startMessage, action, completionMessage)`

- **Location**: `/src/AdminSheet/y_controllers/AssignmentController.js:333-340`
- **Purpose**: Wraps pipeline stages with consistent progress tracking
- **Process**:
  1. Updates progress with start message
  2. Executes action function
  3. Updates progress with completion message (if provided)
  4. Returns result of action function
- **Used Throughout**: All pipeline stages use this pattern for consistent logging

**Document Properties Stored**:

```javascript
{
  assignmentId: "123456789",
  definitionKey: "Essay 1_English_10",
  triggerId: "trigger_id_string"
}
```

---

### Phase 3: Trigger Execution - Main Assessment Pipeline

#### Step 3.1: Trigger Fires

**Global Function**: `triggerProcessSelectedAssignment()`

- **Location**: `/src/AdminSheet/AssignmentProcessor/globals.js:45-48`
- **Trigger**: Automatically called by time-based trigger (1 second after setup)
- **Calls**: `AssignmentController.processSelectedAssignment()`

#### Step 3.2: Process Selected Assignment (Orchestrator)

**Method**: `AssignmentController.processSelectedAssignment()`

- **Location**: `/src/AdminSheet/y_controllers/AssignmentController.js:137-227`
- **Purpose**: Main orchestrator for the entire assessment pipeline
- **Lock Management**: Uses `LockService.getDocumentLock()` to prevent concurrent execution
  - Attempts lock for 5 seconds
  - Returns early if lock cannot be acquired

**Process Flow**:

1. **Parameter Retrieval** (lines 147-157)
   - Gets document properties: `assignmentId`, `definitionKey`, `triggerId`
   - Validates all parameters exist
   - Cleans up pending triggers if parameters missing

2. **Trigger Cleanup** (lines 160-162)
   - Deletes the trigger that launched this execution
   - Uses `TriggerController.deleteTriggerById(triggerId)`

3. **Progress Initialization** (lines 163-164)
   - Starts progress tracking
   - Updates progress: "Assessment run starting."

4. **Course and Class Loading** (lines 166-178)
   - Gets courseId from GoogleClassroomManager
   - Loads ABClass via ABClassController
   - Checks if assignment exists in class and rehydrates if needed

5. **Definition Loading** (lines 180-186)
   - Loads full assignment definition via `AssignmentDefinitionController.getDefinitionByKey()`
   - Validates definition exists
   - Option `{ form: 'full' }` ensures all artifacts are loaded

6. **Assignment Instance Creation** (line 188)
   - Calls `createAssignmentInstance(definition, courseId, assignmentId)`
   - Returns `SlidesAssignment` or `SheetsAssignment` instance

7. **Pipeline Execution** (lines 190-192)
   - Extracts students from ABClass
   - Determines if images should be processed (SLIDES only)
   - Calls `runAssignmentPipeline(assignment, students, options)`

8. **Persistence** (lines 196-200)
   - Updates assignment's `lastUpdated` timestamp
   - Persists assignment run via `ABClassController.persistAssignmentRun()`
   - Writes both full and partial (summary) versions to database

9. **Analysis Generation** (line 203)
   - Calls `analyseAssignmentData(assignment)`
   - Creates Analysis and Overview sheets

10. **Completion** (lines 205-208)
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
- `GoogleClassroomManager`: For course operations
- `ABClassController`: For class data operations
- `AssignmentDefinitionController`: For definition operations

#### Step 3.3: Create Assignment Instance

**Method**: `AssignmentController.createAssignmentInstance()`

- **Location**: `/src/AdminSheet/y_controllers/AssignmentController.js:236-242`
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

- **Location**: `/src/AdminSheet/AssignmentProcessor/Assignment.js:184-209`
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

- **Location**: `/src/AdminSheet/AssignmentProcessor/SlidesAssignment.js`
- **Constructor**:
  - Converts assignmentDefinition to instance if needed
  - Calls parent constructor with courseId, assignmentId, and definition
- **Properties Initialized**:
  - `courseId`, `assignmentId`, `assignmentName`
  - `assignmentDefinition` (embedded copy)
  - `submissions` (empty array)
  - `progressTracker` (singleton reference)
  - `_hydrationLevel` = 'full'

**Class**: `Assignment` (base class)

- **Location**: `/src/AdminSheet/AssignmentProcessor/Assignment.js:6-695`
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
- **Legacy Aliases**: Via `_applyLegacyAliases()` for backward compatibility
  - `documentType`, `referenceDocumentId`, `templateDocumentId`, `tasks`

---

### Phase 4: Assignment Processing Pipeline

#### Step 4.1: Run Assignment Pipeline

**Method**: `AssignmentController.runAssignmentPipeline()`

- **Location**: `/src/AdminSheet/y_controllers/AssignmentController.js:252-324`
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

- **Location**: `/src/AdminSheet/AssignmentProcessor/Assignment.js:500-519`
- **Process**:
  1. Extracts studentId from student object
  2. Checks for duplicates in submissions array
  3. Creates new `StudentSubmission` instance
  4. Attaches legacy student metadata (non-persisted)
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

##### Stage 2: Check and Parse Tasks (lines 264-289)

- **Purpose**: Parse tasks from reference/template documents or use cached version
- **Process**:
  1. Gets reference and template modification times from Drive
  2. Checks if definition needs refresh via `Utils.definitionNeedsRefresh()`
  3. If refresh needed:
     - Calls `assignment.populateTasks()`
     - Updates definition modification timestamps
     - Saves updated definition to database
  4. If refresh not needed:
     - Logs skip message
     - Uses existing tasks from definition

**Method**: `SlidesAssignment.populateTasks()`

- **Location**: `/src/AdminSheet/AssignmentProcessor/SlidesAssignment.js:74-98`
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

- **Location**: `/src/AdminSheet/DocumentParsers/SlidesParser.js`
- **Method**: `extractTaskDefinitions(referenceId, templateId)`
  - Fetches both presentations via Slides API
  - Iterates through slides
  - Extracts task titles from notes
  - Creates artifacts from slide content (as images)
  - Returns array of `TaskDefinition` instances

**Class**: `TaskDefinition`

- **Location**: `/src/AdminSheet/Models/TaskDefinition.js`
- **Properties**:
  ```javascript
  {
    id: string,              // Generated ID
    taskTitle: string,       // From slide notes
    pageId: string,          // Slide page ID
    documentId: string,      // Reference document ID
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

- **Location**: `/src/AdminSheet/AssignmentProcessor/SlidesAssignment.js:104-108`
- **Process**:
  - Defines SLIDES_MIME_TYPE constant
  - Calls parent method `fetchSubmittedDocumentsByMimeType(SLIDES_MIME_TYPE)`

**Method**: `Assignment.fetchSubmittedDocumentsByMimeType()`

- **Location**: `/src/AdminSheet/AssignmentProcessor/Assignment.js:566-598`
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

- **Location**: `/src/AdminSheet/AssignmentProcessor/Assignment.js:528-560`
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

- **Location**: `/src/AdminSheet/AssignmentProcessor/SlidesAssignment.js:114-140`
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

- **Location**: `/src/AdminSheet/DocumentParsers/SlidesParser.js`
- **Process**:
  1. Fetches presentation via Slides API
  2. Iterates through slides
  3. For each slide:
     - Checks notes for task title
     - Matches against taskDefs array
     - Extracts slide content as base64 image
     - Creates artifact object
  4. Returns array of artifacts

**Method**: `StudentSubmission.upsertItemFromExtraction(taskDef, extractionData)`

- **Location**: `/src/AdminSheet/Models/StudentSubmission.js`
- **Process**:
  1. Gets or creates StudentSubmissionItem for taskId
  2. Creates new artifact from extraction data
  3. Sets artifact properties (pageId, content, metadata, documentId)
  4. Stores artifact in item
  5. Updates item timestamp

**Class**: `StudentSubmissionItem`

- **Location**: `/src/AdminSheet/Models/StudentSubmission.js` (both classes in same file)
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
        feedback: [],
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

- **Location**: `/src/AdminSheet/AssignmentProcessor/SlidesAssignment.js:39-67`
- **Process**:
  1. Creates `ImageManager` instance
  2. Collects all image artifacts via `imageManager.collectAllImageArtifacts(this)`
  3. If no artifacts, returns early
  4. Fetches images as blobs via `imageManager.fetchImagesAsBlobs(entries)`
  5. Writes blobs back to artifacts via `imageManager.writeBackBlobs(this, blobs)`
  6. Logs completion

**Class**: `ImageManager`

- **Location**: `/src/AdminSheet/RequestHandlers/ImageManager.js`
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

- **Location**: `/src/AdminSheet/AssignmentProcessor/Assignment.js:645-654`
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

- **Location**: `/src/AdminSheet/RequestHandlers/LLMRequestManager.js`

**Method**: `generateRequestObjects(assignment)`

- **Location**: Lines 24-105
- **Purpose**: Creates HTTP request objects for LLM API calls
- **Process**:
  1. Initializes counters and UID index
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
  - Contains `score` (0-5 or 'N' for not attempted) and `reasoning` (explanation text)
  - Stored as JSON in StudentSubmissionItem.assessments

**Class**: `Assessment`

- **Location**: `/src/AdminSheet/Models/Assessment.js`
- **Properties**:
  ```javascript
  {
    category: string,      // completeness, accuracy, spag
    score: number,         // 0-100
    justification: string, // Explanation
    createdAt: Date,
    uid: string           // Unique identifier
  }
  ```

**Result After Assessment**:

```javascript
submission.items["task_001"] = {
  taskId: "task_001",
  artifact: { ... },
  assessments: {
    completeness: Assessment { score: 85, justification: "..." },
    accuracy: Assessment { score: 90, justification: "..." },
    spag: Assessment { score: 95, justification: "..." }
  },
  feedback: [
    Feedback { text: "Great work!", category: "general" }
  ]
}
```

#### Step 4.3: Sheets Assessment Process (for Spreadsheets)

**Method**: `SheetsAssignment.assessResponses()` (overridden)

- **Location**: `/src/AdminSheet/AssignmentProcessor/SheetsAssignment.js`
- **Process**:
  1. Creates `SheetsAssessor` instance with tasks and submissions
  2. Calls `assessor.assessResponses()`
  3. Does NOT use LLM - formula-based assessment only

**Class**: `SheetsAssessor`

- **Location**: `/src/AdminSheet/Assessors/SheetsAssessor.js`

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

- **Location**: `/src/AdminSheet/AssignmentProcessor/Assignment.js`
- **Purpose**: Sets lastUpdated to current timestamp
- **Called**: Line 196 in `processSelectedAssignment()`

#### Step 5.2: Persist Assignment Run

**Method**: `ABClassController.persistAssignmentRun(abClass, assignment)`

- **Location**: `/src/AdminSheet/y_controllers/ABClassController.js`
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
            completeness: { score: 85, justification: "..." },
            accuracy: { score: 90, justification: "..." },
            spag: { score: 95, justification: "..." }
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

---

### Phase 6: Analysis and Reporting

#### Step 6.1: Analyse Assignment Data

**Method**: `AssignmentController.analyseAssignmentData(assignment)`

- **Location**: `/src/AdminSheet/y_controllers/AssignmentController.js:102-112`
- **Purpose**: Creates Analysis and Overview sheets
- **Process**:
  1. Creates Analysis Sheet:
     - Instantiates `AnalysisSheetManager(assignment)`
     - Calls `createAnalysisSheet()`
  2. Updates Overview Sheet:
     - Instantiates `OverviewSheetManager()`
     - Calls `createOverviewSheet()`

**Class**: `AnalysisSheetManager`

- **Location**: `/src/AdminSheet/Sheets/AnalysisSheetManager.js`
- **Purpose**: Creates detailed analysis sheet for single assignment
- **Method**: `createAnalysisSheet()`
  - Creates new sheet or clears existing
  - Writes headers
  - For each student submission:
    - Writes student name
    - For each task:
      - Writes task title
      - Writes assessment scores
      - Writes feedback
  - Formats cells and applies conditional formatting
  - Calculates averages and statistics

**Class**: `OverviewSheetManager`

- **Location**: `/src/AdminSheet/Sheets/OverviewSheetManager.js`
- **Purpose**: Creates/updates overview sheet with all assignments
- **Method**: `createOverviewSheet()`
  - Loads all assignments from ABClass
  - Creates new sheet or clears existing
  - Writes summary row for each assignment:
    - Assignment name
    - Average scores across all students
    - Completion rates
    - Last updated timestamp
  - Sorts by date
  - Applies formatting

**Analysis Sheet Structure**:

```
| Student Name | Task 1 - Completeness | Task 1 - Accuracy | Task 1 - SPaG | ... | Averages - Completeness | Averages - Accuracy | Averages - SPaG |
|--------------|----------------------|-------------------|---------------|-----|------------------------|---------------------|-----------------|
| Jane Doe     | 4                    | 5                 | 4             | ... | 4.2                    | 4.5                 | 4.3             |
| John Smith   | 3                    | 4                 | 3             | ... | 3.5                    | 3.8                 | 3.6             |
| Average      | 3.5                  | 4.5               | 3.5           | ... | 3.85                   | 4.15                | 3.95            |
```

Note: Scores are 0-5 (or 'N' for not attempted). Feedback is stored in the data model but not displayed in analysis sheets.

**Overview Sheet Structure**:

```
| Assignment Name | Avg Completeness | Avg Accuracy | Avg SPaG | Last Updated        |
|----------------|------------------|--------------|----------|---------------------|
| Essay 1        | 80               | 85           | 90       | 2025-01-15T10:30:00 |
| Lab Report 1   | 85               | 88           | 92       | 2025-01-14T14:20:00 |
```

#### Step 6.2: Progress Completion

**Method**: `ProgressTracker.complete()`

- **Location**: `/src/AdminSheet/Utils/ProgressTracker.js`
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
  primaryTopic: string | null,
  yearGroup: number | null,
  documentType: "SLIDES" | "SHEETS",
  referenceDocumentId: string,
  templateDocumentId: string,
  referenceLastModified: ISO date string,
  templateLastModified: ISO date string,
  definitionKey: string,
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

- **Location**: `/src/AdminSheet/Utils/ProgressTracker.js`
- **Purpose**: Singleton for tracking progress and logging user-facing errors
- **Key Methods**:
  - `updateProgress(message, incrementStep)`: Updates progress display
  - `logError(userMessage, devDetails)`: Logs user-facing error
  - `logAndThrowError(message, error)`: Logs and throws error
  - `startTracking()`: Initialises progress tracking
  - `complete()`: Marks process as complete

### ABLogger

- **Location**: `/src/AdminSheet/ABLogger.js`
- **Purpose**: Singleton for developer diagnostic logging
- **Key Methods**:
  - `info(message, data)`: Informational log
  - `warn(message, data)`: Warning log
  - `error(message, error)`: Error log
  - `debugUi(message, data)`: UI-specific debug log

### Error Flow

1. Errors in user-facing operations → `ProgressTracker.logError()`
2. Developer diagnostics → `ABLogger.error/warn/info()`
3. Critical failures → Both ProgressTracker and ABLogger
4. Never use `console.*` in production code

---

## Caching Strategy

### LLM Assessment Cache

- **Manager**: `CacheManager`
- **Location**: `/src/AdminSheet/RequestHandlers/CacheManager.js`
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

---

## Complete Method Call Chain

Here's the complete chain from user action to completion:

```
User clicks "Assess Student Work"
  ↓
showAssignmentDropdown() [globals]
  ↓
UIManager.showAssignmentDropdown()
  ↓
GoogleClassroomManager.getAssignments()
  ↓
[User selects assignment in modal]
  ↓
openReferenceSlideModal(assignmentData) [HTML → globals]
  ↓
UIManager.openReferenceSlideModal()
  ↓
ABClassController.loadClass()
AssignmentDefinitionController.getDefinitionByKey()
  ↓
[User enters document IDs in modal]
  ↓
saveStartAndShowProgress() [HTML → globals]
  ↓
AssignmentController.saveStartAndShowProgress()
  ↓
AssignmentController.ensureDefinitionFromInputs()
  ├─ AssignmentController._detectDocumentType()
  ├─ GoogleClassroomManager.getCourseId()
  ├─ ABClassController.loadClass()
  └─ AssignmentDefinitionController.ensureDefinition()
  ↓
AssignmentController.startProcessing()
  ├─ TriggerController.createTimeBasedTrigger()
  └─ PropertiesService.setProperty() [x3]
  ↓
ProgressTracker.startTracking()
UIManager.showProgressModal()
  ↓
[1 second delay - trigger fires]
  ↓
triggerProcessSelectedAssignment() [trigger → globals]
  ↓
AssignmentController.processSelectedAssignment()
  ├─ LockService.getDocumentLock()
  ├─ PropertiesService.getProperty() [x3]
  ├─ TriggerController.deleteTriggerById()
  ├─ GoogleClassroomManager.getCourseId()
  ├─ ABClassController.loadClass()
  ├─ AssignmentDefinitionController.getDefinitionByKey()
  ├─ AssignmentController.createAssignmentInstance()
  │   └─ Assignment.create()
  │       └─ new SlidesAssignment() or new SheetsAssignment()
  ├─ AssignmentController.runAssignmentPipeline()
  │   ├─ Assignment.addStudent() [for each student]
  │   ├─ DriveManager.getFileModifiedTime() [x2]
  │   ├─ Utils.definitionNeedsRefresh()
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
  ├─ AssignmentController.analyseAssignmentData()
  │   ├─ AnalysisSheetManager.createAnalysisSheet()
  │   └─ OverviewSheetManager.createOverviewSheet()
  ├─ ProgressTracker.complete()
  └─ PropertiesService.deleteProperty() [x3]
```

---

## Summary of Components by Role

### UI Components

- `UIManager`: Singleton managing all UI operations
- `showAssignmentDropdown()`, `openReferenceSlideModal()`, `saveStartAndShowProgress()`: Global wrapper functions
- HTML Templates: `AssignmentDropdown.html`, `SlideIdsModal.html`, `ProgressModal.html`

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

### Sheet Managers

- `AnalysisSheetManager`: Creates detailed analysis sheets
- `OverviewSheetManager`: Creates summary overview sheets

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

- `GoogleClassroomManager`: Google Classroom integration
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
3. Update `AnalysisSheetManager` to display new category in sheets
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
2. **Test Serialization**: All models must implement `toJSON()` and `fromJSON()`
3. **Mock External APIs**: Google Classroom, Drive, Slides, Sheets APIs must be mocked
4. **See**: `/docs/developer/testing.md` for complete testing guidelines

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

- Verify task titles in slide notes or sheet headers
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
