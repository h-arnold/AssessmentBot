# Assessment Flow Documentation

> **Canonical document.** This page is the single source for the assessment workflow and data flow; paths and method names describe the current `src/backend/` codebase.

## Related contracts

This page is the workflow narrative. The durable contracts it references are owned elsewhere:

- Assessment results, cache reuse and write-boundary gates: [Component Shape: Assessment](../data-shapes/assessment.md)
- Submission and item models, restoration and coverage rules: [Component Shape: Student Submission](../data-shapes/student-submission.md)
- Definition persistence, upsert, rollback and parse-failure semantics: [Contract: AssignmentDefinition](../data-shapes/assignment-definition.md)
- Assignment persistence and partial variants: [Contract: Assignment](../data-shapes/assignment.md)
- Read-time rehydration: [rehydration.md](rehydration.md)
- API transport, validation ownership and error mapping: [api-layer.md](api-layer.md)
- Logging and error-handling policy: [backend-logging-and-error-handling.md](backend-logging-and-error-handling.md)

## At a glance

This document traces one assessment run from the `startAssessmentRun` API call to persisted results.

1. **API trigger** — the frontend calls `startAssessmentRun` with `definitionKey`, `assignmentId` and `courseId`.
2. **Trigger setup** — the definition is freshness-checked; a time-based trigger is created and the run context is stored in Script Properties, keyed by triggerUid.
3. **Trigger execution** — the trigger fires about five seconds later and orchestrates the pipeline.
4. **Pipeline** — instance creation → students added → definition freshness check → submission fetch → content extraction → image hydration (Slides only) → assessment → persistence.
5. **Persistence** — the run is validated and written as a full assignment record plus a partial summary embedded in the class document.

Principles to keep in mind while reading the detailed flow:

- **Progressive hydration** — data starts lightweight and gains content as the run proceeds.
- **Two-tier persistence** — full payloads live in dedicated collections (`assign_full_*`, `assdef_full_*`); lightweight summaries ride in the per-class collection (named by `classId`) and `assignment_definitions`. See [Contract: ABClass](../data-shapes/abclass.md).
- **Cache-first assessment** — the LLM is called only after a cache miss.
- **Fail fast** — errors propagate to a top-level boundary, which logs once; do not duplicate the same error at every layer.
- **Singletons and factories** — `ProgressTracker`, `ABLogger`, `ConfigurationManager` and `DbManager` are singletons; `Assignment.create()` selects the document-type subclass.
- **Trigger decoupling** — heavy work runs off a time-based trigger; user-facing operations return quickly.
- **Batch transport** — LLM and image requests go through `UrlFetchApp.fetchAll()` with bounded per-member retries owned by `BaseRequestManager`.

## API layer

Frontend calls reach the backend exclusively through `apiHandler`; `z_Api` trailing-underscore helpers delegate to controllers, and `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js` is the registry. See [api-layer.md](api-layer.md) for the transport contract, allowlist, validation ownership and error mapping, and for the assignment-definition surfaces (`upsertAssignmentDefinition`, `getAssignmentDefinitionPartials`, topic CRUD).

Reads are not persistence serialisations: `getAssignment` goes through `ABClassController.readRehydrateAssignment()` → `Assignment.toReadJSON()`, which strips `progressTracker` and applies `DateUtils.deepConvertDates()` at the boundary. See [Contract: Assignment § getAssignment (read)](../data-shapes/assignment.md#getassignment-read).

`apiHandler()` returns its envelope as a JSON string so `google.script.run` cannot drop `null`
properties; the frontend parses it once in `apiService.ts`. Storage reads are the other direction:
JsonDbApp revives stored ISO strings as `Date` objects, so stored-read gates convert them back
before domain validation. See [api-layer.md § Response envelope](api-layer.md#response-envelope) and
[rehydration.md § Stored-read Date revival](rehydration.md#stored-read-date-revival).

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
  5. Delegates to `startProcessing(assignmentId, definitionKey, courseId)`, which creates the time-based trigger and stores the run context in Script Properties
  6. Returns `null` (no data payload)
- **Error Handling**:
  - Transport validation failures throw `ApiValidationError` → mapped to `INVALID_REQUEST`
  - Stale definition throws `DefinitionStaleError` → mapped to `DEFINITION_STALE` with `details` block
  - Missing definition or ABClass (`ClassNotFoundError`) → mapped to `INTERNAL_ERROR`

---

### Phase 2: Trigger Setup and Context Storage

Definitions are created and updated by a separate flow: the frontend upserts via `upsertAssignmentDefinition` (see [api-layer.md](api-layer.md) and [Contract: AssignmentDefinition](../data-shapes/assignment-definition.md)). The assessment run assumes an existing definition and validates only its freshness.

#### Step 2.1: Create Time-Based Trigger

**Method**: `AssignmentController.startProcessing(assignmentId, definitionKey, courseId)`

- **Location**: `src/backend/y_controllers/AssignmentController.js`
- **Process**:
  1. Validates the three required strings (`Validate.requireParams`).
  2. Creates a five-second time-based trigger for `triggerHandler` via `TriggerController.createTimeBasedTrigger()`.
  3. Stores the run context in Script Properties via `TriggerController.storeTriggerContext(triggerUid, { method: 'processSelectedAssignment', params: { assignmentId, definitionKey, courseId } })` — see [Contract: TriggerContext](../data-shapes/trigger-context.md).
- **Failures**: trigger-creation or context-storage failures throw via `ProgressTracker.logAndThrowError`.

**Class**: `TriggerController` (`src/backend/Triggers/TriggerController.js`)

- `createTimeBasedTrigger()` cleans up matching triggers and retries once on the "too many triggers" error.
- `getTriggerContext()` / `clearTriggerContext()` / `deleteTriggerById()` are used by `triggerHandler`.

**Helper Method**: `runStage(startMessage, action, completionMessage)` (`src/backend/y_controllers/AssignmentController.js`)

- Wraps each pipeline stage: progress update, action execution, completion message; returns the action result.

---

### Phase 3: Trigger Execution

#### Step 3.1: Trigger Fires

**Global Function**: `triggerHandler(event)`

- **Location**: `src/backend/Triggers/triggerHandler.js`
- **Process**:
  1. Validates `event.triggerUid`; a malformed event is logged and returns without cleanup or dispatch.
  2. Resolves the stored context via `TriggerController.getTriggerContext()`; an unknown triggerUid returns with no cleanup; an incomplete or unregistered context is logged and cleaned up.
  3. Fail-closed auth check — `AuthService.checkAccess({ bypassCache: true, neverClaim: true, method })`; a denial is logged once by AuthService and the context is cleaned up.
  4. Dispatches through `TRIGGER_METHOD_HANDLERS` (`src/backend/Triggers/triggerMethodHandlers.js`) — currently a single `processSelectedAssignment` entry.
  5. Owns all cleanup (context clear + trigger deletion) in a finally block, whether the handler completes or throws.

#### Step 3.2: Process Selected Assignment (Orchestrator)

**Method**: `AssignmentController.processSelectedAssignment({ assignmentId, definitionKey, courseId })`

- **Location**: `src/backend/y_controllers/AssignmentController.js`
- **Purpose**: Main orchestrator for the entire assessment pipeline. Receives the dispatched params directly; it does not read User Properties, and trigger cleanup is owned by `triggerHandler`.
- **Process Flow**:
  1. Validates params; starts progress tracking ("Assessment run starting.").
  2. Loads the full definition via `AssignmentDefinitionController.getDefinitionByKey(definitionKey, { form: 'full' })`; throws if missing.
  3. Loads the ABClass via `ABClassController.loadClass(courseId)` — refreshes and persists the Classroom roster; throws `ClassNotFoundError` when no stored class exists.
  4. Creates the assignment instance (Step 3.3).
  5. Extracts students from the class; `includeImages` is true for SLIDES.
  6. Runs the pipeline (Phase 4).
  7. Persists the run via `ABClassController.persistAssignmentRun()` (Phase 5).
  8. Completion feedback: counts distinct failed items via `_countFailedSubmissionItems()`. If any, reports "N tasks failed." then "Assessment run completed with errors." with a warning toast; otherwise reports success. Persistence failure propagates and is never reported as completion.
- **Error Handling**: errors propagate to `triggerHandler`, which logs them via `ProgressTracker.logAndThrowError` and still cleans up the trigger.

#### Step 3.3: Create Assignment Instance

**Method**: `AssignmentController.createAssignmentInstance()`

- **Location**: `src/backend/y_controllers/AssignmentController.js`
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

- **Location**: `src/backend/AssignmentProcessor/Assignment/01_AssignmentFactory.js`
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

- **Location**: `src/backend/AssignmentProcessor/SlidesAssignment.js`
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

- **Location**: `src/backend/AssignmentProcessor/Assignment/index.js`

Document metadata is accessed through the embedded `assignmentDefinition` object; `submissions` starts empty and `progressTracker` is the singleton reference.

---

### Phase 4: Assignment Processing Pipeline

#### Step 4.1: Run Assignment Pipeline

**Method**: `AssignmentController.runAssignmentPipeline()`

- **Location**: `src/backend/y_controllers/AssignmentController.js`
- **Parameters**: see the `runAssignmentPipeline()` JSDoc (`assignment`, `students`, `options.includeImages`)
- **Purpose**: Executes all stages of assignment processing in sequence

**Pipeline Stages**:

##### Stage 1: Add Students

- **Progress**: "Adding students from class record."
- **Process**: Iterates through students array and calls `assignment.addStudent(student)` for each
- **Result**: Submissions array populated with StudentSubmission instances
- **Completion**: "{count} students added to the assignment from class record."

**Method**: `Assignment.addStudent(student)`

- **Location**: `src/backend/AssignmentProcessor/Assignment/04_AssignmentSubmissions.js`
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

- **Purpose**: revalidate that the stored definition still matches the source documents at trigger time.
- **Process**: `AssignmentController._validateDefinitionFreshness()` reads the reference and template modified times via `DriveManager.getFileModifiedTime()` and compares them with `DateUtils.isNewer()`. If either document changed, it throws `DefinitionStaleError` (caught at the trigger boundary and surfaced via `ProgressTracker.logAndThrowError`).
- The pipeline then reports `Tasks are up to date; skipping parse.` before fetching submissions.
- **Not a re-parse**: the run never re-parses the definition inline. `SlidesAssignment.populateTasks()` exists but is not on the run path; definitions are (re)parsed when upserted — see [Contract: AssignmentDefinition](../data-shapes/assignment-definition.md).

##### Stage 3: Fetch Submitted Documents

- **Progress**: "Fetching submitted documents from students."
- **Process**: Calls `assignment.fetchSubmittedDocuments()`
- **Completion**: "Submitted documents fetched."

**Method**: `SlidesAssignment.fetchSubmittedDocuments()`

- **Location**: `src/backend/AssignmentProcessor/SlidesAssignment.js`
- **Process**:
  - Defines SLIDES_MIME_TYPE constant
  - Calls parent method `fetchSubmittedDocumentsByMimeType(SLIDES_MIME_TYPE)`

**Method**: `Assignment.fetchSubmittedDocumentsByMimeType()`

- **Location**: `src/backend/AssignmentProcessor/Assignment/04_AssignmentSubmissions.js`
- **Process**:
  1. Calls `Classroom.Courses.CourseWork.StudentSubmissions.list(courseId, assignmentId)`, following every `nextPageToken` page before concluding that a student has no attachment. A later-page list failure is logged and rethrown unchanged, so the run stops instead of manufacturing no-submission.
  2. Iterates through the accumulated submissions
  3. For each submission:
     - Extracts userId (student ID)
     - Gets attachments array
     - Processes each attachment via `_processAttachmentForSubmission()` with a scan-local `{ failures, supported }` accumulator
  4. After the complete scan, materialises the recorded first failure, if one exists, for each student with no supported attachment; an accepted source clears any earlier rejected-candidate failure. Logs if no submissions or attachments found.

**Helper Method**: `_processAttachmentForSubmission(attachment, studentId, mimeType, scanState)`

- **Location**: `src/backend/AssignmentProcessor/Assignment/04_AssignmentSubmissions.js`
- **Process**:
  1.  Extracts driveFileId from attachment; non-Drive/missing-ID attachments are logged and ignored without recording a failure
  2.  Reads the MIME type through the immediate native `DriveApp.getFileById(id).getMimeType()` call; an ordinary native `Error` records `SOURCE_UNREADABLE`, while an actually thrown `TypeError`, `ReferenceError` or non-`Error` value propagates
  3.  Validates the MIME type; a mismatched supported-Drive attachment records `UNSUPPORTED_DOCUMENT`
  4.  On a valid type, finds the matching StudentSubmission, sets its `documentId` (the last supported attachment wins) and marks the student as supported
  5.  Updates the submission timestamp via `touchUpdated()`
- **Result**: Each admitted StudentSubmission has a `documentId`. A student whose supported-admission candidates all fail receives acquisition `E` items for every known task, using the first recorded failure. A student with no supported source and no recorded acquisition failure keeps `documentId: null` and an empty item map (genuine no-submission); absent attachments and ignored non-Drive/missing-ID candidates are the only routes to that state. Ignored candidates alongside failed Drive candidates do not erase the recorded failure.

##### Stage 4: Extract Student Work

- **Progress**: "Extracting student work from documents."
- **Process**: Calls `assignment.processAllSubmissions()`
- **Completion**: "All student work extracted."

**Method**: `SlidesAssignment.processAllSubmissions()` (and the `SheetsAssignment` equivalent)

- **Location**: `src/backend/AssignmentProcessor/SlidesAssignment.js`, `src/backend/AssignmentProcessor/SheetsAssignment.js`
- **Process**:
  1. Creates the parser instance and gets task definitions from the assignment
  2. Iterates through each submission:
     - Skips submissions without `documentId`; a failed acquisition has already materialised its failure items
     - Updates progress before extraction (Slides reports ordinal position; Sheets names the student)
     - Calls `parser.extractSubmissionArtifacts(documentId, taskDefs)`
     - Applies the outcome through the shared `_applyExtractedArtifacts(submission, artifacts, taskDefs, handlers)` helper (below)
  3. Healthy extracted items keep an empty assessment map until the assessment stage; a matched Slides IMAGE stays legitimately pending until image hydration

**Helper Method**: `AssignmentAssessmentBase._applyExtractedArtifacts(submission, artifacts, taskDefinitions, handlers)`

- **Location**: `src/backend/AssignmentProcessor/Assignment/05_AssignmentAssessmentBase.js`, reached from both runners through the `Assignment._applyExtractedArtifacts` forwarder
- **Process**:
  1. If the parser returns its failed-open null sentinel, creates one item per known task with `setError('acquisition', 'SOURCE_UNREADABLE')`
  2. Otherwise upserts each returned artifact through `submission.upsertItemFromExtraction(taskDef, extractionData)`, warning and ignoring unknown task IDs via the `onUnknownTask` handler
  3. Materialises extraction `SOURCE_CONTENT_UNAVAILABLE` for known tasks with no extraction outcome, and for returned artifacts whose content is null unless the `isPendingArtifact` handler reports the artifact as legitimately pending. Slides treats a matched IMAGE with a student `pageId` and `metadata.sourceUrl` as pending; Sheets treats every IMAGE artifact as pending

**Method**: `SlidesParser.extractSubmissionArtifacts(documentId, taskDefs)`

- **Location**: `src/backend/DocumentParsers/SlidesParser/index.js` (delegating to `01_SlidesParserSubmissionMatcher.js`)
- **Process**:
  1. Opens the presentation through the immediate native `SlidesApp.openById(documentId)` call; an ordinary native `Error` logs once and returns `null`, while an actually thrown `TypeError`, `ReferenceError` or non-`Error` value propagates
  2. Builds an index of tagged student slide elements across the whole deck
  3. For each task definition:
     - Matches student content by stable task ID first, then task title
     - Accepts moved or copied slides with different page IDs
     - Extracts text, table, or tagged image artefacts based on the definition type
     - Preserves the matched student `pageId` and submission `documentId` on the extraction
     - Emits a canonical placeholder with null `pageId`/`content` for a missing match
  4. Returns an array of artifacts; `null` is reserved for a failed document open

**Method**: `StudentSubmission.upsertItemFromExtraction(taskDef, extractionData)`

- **Location**: `src/backend/Models/StudentSubmission/index.js`
- **Process**:
  1. Gets or creates StudentSubmissionItem for taskId
  2. Creates new artifact from extraction data
  3. Sets artifact properties (pageId, content, metadata, documentId); an explicit `pageId: null` is preserved when the parent submission document is known, while an omitted/`undefined` page ID falls back to the task definition page
  4. Stores artifact in item
  5. Updates item timestamp

**Item model**: `src/backend/Models/StudentSubmission/00_StudentSubmissionItem.js` (the `StudentSubmission` entry is `src/backend/Models/StudentSubmission/index.js`). See [Component Shape: Student Submission](../data-shapes/student-submission.md) for the item shape.

After this stage, a submission is either genuinely no-submission (`documentId: null`, empty item map), a set of terminal acquisition/extraction `E` items, or in-flight items awaiting assessment (with matched Slides IMAGEs still pending).

##### Stage 5: Process Images - SLIDES ONLY

- **Condition**: Only runs if `includeImages` is true (Slides assignments)
- **Progress**: "Processing Images."
- **Process**: Calls `assignment.processImages()`
- **Completion**: "Images uploaded."

**Method**: `SlidesAssignment.processImages()`

- **Location**: `src/backend/AssignmentProcessor/SlidesAssignment.js`
- **Process**:
  1. Creates `ImageManager` instance
  2. Collects image artefacts via `imageManager.collectAllImageArtifacts(this)`; a pending required shared image with no usable source or owning document throws, while a pending student image with no usable source becomes that task's hydration `E` instead of an entry
  3. If no artefacts are collected, logs and returns early
  4. Fetches images as blobs via `imageManager.fetchImagesAsBlobs(entries)`, routing final failures by scope
  5. Writes blobs back via `imageManager.writeBackBlobs(this, blobs)`, converting unusable returned content by scope and invalidating stale results only when content changed
  6. Logs completion; a thrown fault is logged at this caller boundary (developer and user channels) and rethrown, so the run stops before persistence

**Class**: `ImageManager`

- **Location**: `src/backend/RequestHandlers/ImageManager.js`
- **Purpose**: Owns scoped image hydration (collection, download and writeback) for LLM consumption
- **Methods**:
  - `collectAllImageArtifacts(assignment)`: Gathers reference, template and submission IMAGE artefacts with their scope, document and task identities. Preserves an upstream all-three terminal `E` verbatim, materialises extraction `IMAGE_HYDRATION_FAILED` for a pending student image with no admissible source, and throws for a pending required shared image with no admissible source or owning document.
  - `fetchImagesAsBlobs(entries)`: Downloads images in document round-robin order through the shared sender, using the configured Slides-fetch batch size, accepted `[200]` and no stop statuses. Empty input returns an empty array before reading the batch-size configuration, so empty input does not acquire configuration or trigger its failures. Final 200 blobs are read before the next batch; final non-200/network outcomes are routed by scope (student task `E` or a run-blocking throw), and blob-read faults propagate unchanged.
  - `writeBackBlobs(assignment, blobs)`: Applies fetched blobs by UID, requiring the model writer before classifying returned data and reading native bytes once. Unusable returned content converts by scope; changed non-null content clears stale assessments/feedback, unchanged content preserves them; thrown faults escape by original identity.

##### Stage 6: Assess Responses

- **Progress**: "Assessing student responses."
- **Process**: Calls `assignment.assessResponses()`
- **Completion**: "Responses assessed."

**Method**: `Assignment.assessResponses()` (base implementation)

- **Location**: `src/backend/AssignmentProcessor/Assignment/06_AssignmentLLMOrchestration.js`
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

- **Location**: `src/backend/RequestHandlers/LLMRequestManager.js`
- **Purpose**: Creates HTTP request objects for LLM API calls
- **Process**:
  1. Initialises counters and the generated UID route index
  2. Gets backend URL and API key from configuration
  3. For each submission's items:
     - Gets task definition and artifact type
     - Skips SPREADSHEET types (handled by SheetsAssessor)
     - Preserves a prior all-three `E` result verbatim without dispatch
     - Requires usable non-empty string hashes on the reference, template and student artefacts; a null/empty hash throws before lookup or dispatch
     - Checks for "not attempted" (student hash equals template hash, or blank work)
       - If not attempted, creates the `N` assessment and skips LLM
     - Builds the versioned cache identity from task type plus reference/template/student hashes and reads generic `CacheManager.get()`
       - A hit is accepted only after shared numeric validation; a malformed/`N`/`E` hit is logged as a miss
     - If no cache hit, creates the request object and records the retained key on the route entry
  4. Rejects duplicate generated UIDs before returning
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

- **Purpose**: Sends requests through the shared batch transport and applies final outcomes
- **Process**:
  1. Resets the run-stop latch and the routed-attempt provenance map. Returns before input validation when `requests` is empty; otherwise validates the assignment and rejects duplicate request UIDs.
  2. Calls `sendRequestsInBatches()` once with the configured assessor batch size, accepted statuses `[200, 201]` and stop statuses `[401, 403, 404]`.
  3. For each completed batch, rejects unknown/duplicate outcome UIDs, records a run stop when any outcome is 401/403/404, applies accepted responses before non-success outcomes, and routes each outcome by its retained request UID. Immediately before routing, it records that outcome's attempt count in the invocation-local map.
  4. Returns exactly `false` to the sender when stopped, preventing later batches while completed same-batch successes are retained.
  5. After the sender returns, if the run stopped, terminalises every eligible item that was never routed as `LLM_RUN_STOPPED` with no further HTTP.

**Method**: `_processSingleResponse(response, request)`

- **Process**:
  1. Resolves the routed entry and item by UID; a missing route throws.
  2. For a null or non-accepted response, reads the attempt count retained by the batch callback. Requires a safe integer in `1..maxAttempts`; missing, `undefined`/`null`, numeric-string, fractional, non-finite, unsafe-integer or out-of-budget provenance throws a contextual `Error` naming the UID before any mutation.
  3. Maps the non-accepted outcome through `_terminalCodeFor`: stop status → `LLM_RUN_STOPPED`; permanent status → `LLM_HTTP_FAILED`; retryable/network with a spent budget (`attempts === maxAttempts`) → `LLM_UNAVAILABLE`; retryable/network with unspent budget (pending retries cancelled by a same-batch stop) → `LLM_RUN_STOPPED`. Calls `item.setError('assessment', code)` atomically.
  4. For an accepted response, reads `getContentText()` outside the catch, then catches only `JSON.parse`.
  5. Rejects non-object roots and raw criterion keys that are not admissible case-insensitive canonical identities before normalisation, so inherited-key, extra-key and colliding case-variant evidence cannot be erased.
  6. Normalises keys, validates the result once through `validateAssessmentData()` (exact own canonical keys, each `Assessment.isValidRawResult` and numeric), and assigns the three `Assessment` instances.
  7. Writes the validated numeric result through generic `CacheManager.put()` at the retained generation-time key with `CacheManager.CACHE_EXPIRY_SECONDS`. There is no semantic retry and no partial salvage.

**Method**: `_terminaliseUnprocessedItems(processedUids)`

- **Purpose**: Completes a stopped run without extra HTTP
- **Process**: iterates the generated UID route map and calls `setError('assessment', 'LLM_RUN_STOPPED')` for every eligible item whose UID was not routed. A missing route map, entry or item throws; earlier-batch and same-batch outcomes, cached results and genuine `N` results are never touched.

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

Assessments are `Assessment` instances (`src/backend/Models/Assessment.js`); see [Component Shape: Assessment](../data-shapes/assessment.md) for the `E` error model and the partial-reasoning rule.

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

- **Process**:
  1. Iterates through submissions
  2. For each submission's items:
     - Gets corresponding task definition
     - Skips non-formula responses
     - Calls `assessFormulaeTasks()` for formula assessment
     - Adds the three assessments to the submission
     - Uses the transient comparison results to add cell-reference feedback; the comparison result itself is not persisted

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

`formulaComparisonResults` is transient. The assessor writes only the three assessments and the `cellReference` feedback to the submission item; it no longer writes an `assessments.formulaComparison` entry. See [Component Shape: BaseTaskArtifact § Concrete artifact types](../data-shapes/base-task-artifact.md#concrete-artifact-types).

---

### Phase 5: Data Persistence

#### Step 5.1: Update Timestamp

**Method**: `Assignment.touchUpdated()`

- **Location**: `src/backend/AssignmentProcessor/Assignment/03_AssignmentTimestamps.js`
- **Purpose**: Sets updatedAt to current timestamp

#### Step 5.2: Persist Assignment Run

**Method**: `ABClassController.persistAssignmentRun(abClass, assignment)`

- **Location**: `src/backend/y_controllers/ABClassController/index.js`, delegating to `ABClassAssignmentOps.persistAssignmentRun()` and `ABClassPersistence.persistClassAndPartial()`
- **Purpose**: Validates the completed run, stamps the result-format marker, then saves assignment data in two forms
- **Process**:
  1. Validates the completed run before any mutation
     - `ABClassAssignmentValidation._validateCompletedAssignmentRun()` mirrors the marker-1 read invariants: task-universe integrity, submission association, item/artefact identity, exactly three canonical criterion results per item, and source/hash consistency. Genuine no-submission (`documentId == null` plus an empty item map) remains valid and is skipped.
     - Reuses the existing class-save contract (`ABClassValidation._validateClassForSave`) before the first mutation.
  2. Stamps the result-format marker
     - Sets `assignment.assessmentContractVersion = 1` only after the completed-run gate passes and before serialisation.
  3. Prepares four payloads before the first collection mutation
     - Full assignment via `Assignment.toJSON()`; embedded partial via `Assignment.toPartialJSON()`, then constructed back through `Assignment.fromJSON(partialPayload, 'partial')` as the actual partial representation that will live in the class (a representation conversion, not a validation-only round-trip)
     - Prospective updated full-class and class-partials documents via `ABClassPersistence._prepareFullClass()`/`_prepareClassPartial()` with the partial temporarily spliced into `abClass.assignments`
     - These are plain serializer outputs plus a detached metadata copy, not deep-detached clones of the model
  4. Writes the full assignment to its dedicated collection
     - Collection key: `assign_full_{courseId}_{assignmentId}`
     - Contains complete data with all artifacts, content and the marker
  5. Writes the prepared full-class and class-partials payloads
     - Full class: per-class collection named by `classId` (see [Contract: ABClass](../data-shapes/abclass.md)); partials registry: `abclass_partials`
     - Both writes consume the exact prepared payloads; nothing re-serialises after the full commit
  - The write order is deliberately non-transactional (full assignment → class → partials). A storage failure throws after logging the failed phase and whether the full assignment write committed; it never reports a completed run and nothing repairs the state.

Persisted shapes: [Contract: Assignment](../data-shapes/assignment.md) (full record and partial variant) and [Component Shape: Assessment](../data-shapes/assessment.md) (result marker).

#### Step 5.3: Progress Completion

**Method**: `ProgressTracker.complete()` — `src/backend/Utils/ProgressTracker.js`

- Progress is a singleton writing a JSON record (`step`, `message`, `completed`, `error`, `timestamp`) to User Properties under the `ProgressTracker` key.
- `complete()` sets `completed: true`; it does not clear a previously recorded `error`.

---

## Key data structures

The persisted and transported shapes are specified in the canonical data-shape docs:

- [Contract: AssignmentDefinition](../data-shapes/assignment-definition.md) — definition, registry and full-store payloads, TaskDefinition, BaseTaskArtifact
- [Contract: Assignment](../data-shapes/assignment.md) — full and partial assignment records
- [Component Shape: Student Submission](../data-shapes/student-submission.md) — StudentSubmission and StudentSubmissionItem
- [Component Shape: BaseTaskArtifact](../data-shapes/base-task-artifact.md) — artifact types and content/hash semantics
- [Component Shape: Assessment](../data-shapes/assessment.md) — Assessment results, including the `E` error entries

Partial summaries strip `reasoning` from numeric and `'N'` results; an `'E'` result keeps `{ score: 'E', reasoning, error }` so an embedded failure retains its explanation.

## Error handling and logging

See [backend-logging-and-error-handling.md](backend-logging-and-error-handling.md) for policy. In short:

- User-facing progress and errors go through `ProgressTracker`; developer diagnostics go through `ABLogger`.
- Critical top-level failures may use both channels, each with its own purpose-specific detail — never the same payload twice, and never `console.*`.

## Caching

- **LLM assessments** — keyed by a versioned hash of `v1`, the task type and the reference/template/student content hashes, computed at request generation and retained through writeback. Stored via generic `CacheManager.get()`/`put()` with `CacheManager.CACHE_EXPIRY_SECONDS`; only validated numeric results are cached, and hits are re-validated before use. Old key spaces are misses; there is no purge or migration.
- **Assignment definitions** — compared by Drive file modification time; re-parsed only when the reference or template changed. API upserts write the full store first, then the registry; a registry failure triggers rollback of the full-store write, and a rollback failure surfaces as a repair-required hard failure.

Details: [Component Shape: Assessment](../data-shapes/assessment.md) and [Contract: AssignmentDefinition](../data-shapes/assignment-definition.md).

## Batch transport

`BaseRequestManager` (`src/backend/RequestHandlers/BaseRequestManager.js`) is the sole HTTP dispatch and retry owner for `LLMRequestManager` and `ImageManager`:

- At most three total dispatches per request, including the initial `fetchAll` batch attempt; wait 5,000 ms before attempt two and 7,500 ms before attempt three.
- Only network exceptions, HTTP 429 and HTTP 500–599 retry; retries are sequential per-member `UrlFetchApp.fetch` calls, never re-batched.
- Callers read accepted/stop statuses per batch; the batch callback returning exactly `false` stops later retries and batches in that invocation.

## Extension points

### Adding New Document Types

To add a new document type (e.g., Google Docs):

1. Create new subclass in `AssignmentProcessor/Assignment/` (e.g., `DocsAssignment.js`)
2. Extend `Assignment` base class
3. Implement the abstract methods the pipeline calls:
   - `fetchSubmittedDocuments()`: Get student submissions
   - `processAllSubmissions()`: Extract student responses, applying outcomes through `Assignment._applyExtractedArtifacts` with `onUnknownTask` and `isPendingArtifact` handlers
   - `assessResponses()`: Route to the appropriate assessor (optional override)
   - `populateTasks()` exists on the base class but is not on the run path
4. Add MIME type constant for the new document type
5. Update `Assignment.create()` factory method to handle new type
6. Create corresponding parser in `DocumentParsers/` if needed

### Adding New Assessment Types

To add a new assessment category (beyond completeness, accuracy, spag):

1. Add the criterion to `Assessment.CRITERIA` in `src/backend/Models/Assessment.js`. Every
   backend validator, restoration path and terminal-error primitive derives from it, so
   no other backend list needs editing.
2. Update the LLM backend API to return the new category
3. Update any analysis or reporting views to display the new category
4. No changes needed to the stored data models (assessments are stored as flexible objects)

### Extending the Pipeline

To add new processing stages:

1. Add stage in `AssignmentController.runAssignmentPipeline()`
2. Use `runStage()` helper for consistent progress tracking
3. Follow existing patterns for error handling
4. Consider impact on caching (may need cache invalidation)

### Testing

Backend tests cannot call Apps Script services; mock Classroom, Drive, Slides and Sheets APIs, and keep model serialisation round-trippable. See [backend-testing.md](backend-testing.md).
