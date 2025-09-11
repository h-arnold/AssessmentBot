# Dependency Refactor Requirements

Refactor callers from legacy Task and StudentTask to the new architecture in DESIGN.md: TaskDefinition + TaskArtifact hierarchy and StudentSubmission + StudentSubmissionItem.

This document lists every class that currently interacts with Task or StudentTask, explains the current coupling points, and prescribes the exact changes needed to work with the new model. It also highlights cross-cutting changes, interim shims, and migration notes.


## Legend: old → new concepts

- Task → TaskDefinition (owns reference/template artifacts)
- Task.taskReference (string|table|formulas|url) → TaskArtifact(role='reference').content or metadata
- Task.templateContent → TaskArtifact(role='template').content or metadata
- Task.contentHash → reference artifact.contentHash
- Task.templateContentHash → template artifact.contentHash
- Task.taskNotes → TaskDefinition.taskNotes
- Task.taskMetadata → TaskDefinition.taskMetadata
- Task.uid → artifact.metadata.uid (see UID pattern in DESIGN.md)
- StudentTask → StudentSubmission
- StudentTask.responses[taskKey] → StudentSubmission.items[taskId]
- responses[...].uid → StudentSubmissionItem.artifact.metadata.uid
- responses[...].pageId → StudentSubmissionItem.pageId (or artifact.pageId)
- responses[...].response → StudentSubmissionItem.artifact.content (typed)
- responses[...].contentHash → StudentSubmissionItem.artifact.contentHash
- addAssessment/addFeedback/get* → on StudentSubmissionItem

Note: All hashing is centralized in TaskArtifact.ensureHash(). Parsers and other layers must not compute contentHash.


## Cross-cutting changes you must make everywhere

- Stop using task titles/keys for identity. Use TaskDefinition.id (taskId) consistently for maps and lookups.
- Replace string/array payloads in code paths with typed artifacts: TextTaskArtifact, TableTaskArtifact, SpreadsheetTaskArtifact, ImageTaskArtifact.
- Use artifact.getUid() for image pipeline identity instead of Task.uid or StudentTask response uid.
- Not-attempted detection uses submission.artifact.contentHash === templateArtifact.contentHash.


## src/AdminSheet/AssignmentProcessor/Assignment.js

Current coupling
- Holds this.tasks as { [taskKey]: Task }.
- Holds this.studentTasks as StudentTask[].
- addStudent creates new StudentTask(student, assignmentId, null).
- generateLLMRequests/assessResponses indirectly operate over StudentTask.

Refactor steps
- Replace this.tasks with { [taskId: string]: TaskDefinition }.
- Replace this.studentTasks with this.submissions: StudentSubmission[].
- addStudent(student): create new StudentSubmission(student.id, this.assignmentId, null).
- generateLLMRequests delegates to LLMRequestManager.generateRequestObjects(assignment) which now iterates submissions and StudentSubmissionItem instances; skip spreadsheets.


Migration notes
- Provide a temporary getter this.studentTasks to return this.submissions during the migration (read-only) if needed by legacy callers, then remove once all callers are updated.


## src/AdminSheet/AssignmentProcessor/SlidesAssignment.js

Current coupling
- populateTasks(): SlidesParser.extractTasks(referenceId|templateId) returns Task[], then merges by taskTitle and writes Task.templateContent/Hash.
- processImages(): ImageManager works with Task.uid and StudentTask.response.uid and writes base64 back into task.taskReference/templateContent or response.response.
- processAllSubmissions(): for each StudentTask, calls studentTask.extractAndAssignResponses(slidesParser, this.tasks).

Refactor steps
- populateTasks(): call SlidesParser.extractTaskDefinitions(referenceId, templateId) → TaskDefinition[]. Map to this.tasks by taskId (definition.getId()). No manual merge; parser must attach both reference and template artifacts on the TaskDefinition.
- Replace processImages() flow with ImageManager.collectAllImageArtifacts(this) → fetchImagesAsBlobs(entries) → for each result, find the artifact by uid and call artifact.setContentFromBlob(blob). Do not write base64 into definition fields; the artifact persists base64 and contentHash.
- processAllSubmissions(): for each StudentSubmission with documentId, call parser.extractSubmissionArtifacts(docId, Object.values(this.tasks)) → array of { taskId, pageId, content, metadata }. For each, call submission.upsertItemFromExtraction(taskDef, { pageId, content, metadata }). Remove StudentTask.extractAndAssignResponses.

Migration notes
- Maintain a title lookup for reporting: const titleById = Object.fromEntries(Object.values(this.tasks).map(td => [td.id, td.taskTitle])). Use for sheets/analysis display.


## src/AdminSheet/AssignmentProcessor/SheetsAssignment.js

Current coupling
- populateTasks(): this.tasks = sheetsParser.extractTasks(referenceId, templateId) returning Task[].
- processAllSubmissions(): loops StudentTask and calls studentTask.extractAndAssignResponses(sheetsParser, this.tasks).
- assessResponses(): new SheetsAssessor(this.tasks, this.studentTasks).assessResponses().

Refactor steps
- populateTasks(): this.tasks = mapById(sheetsParser.extractTaskDefinitions(referenceId, templateId)). Each TaskDefinition should have primary SpreadsheetTaskArtifact artifacts for reference/template and taskMetadata with bbox and referenceLocationsMap.
- processAllSubmissions(): for each StudentSubmission with documentId → const artifacts = parser.extractSubmissionArtifacts(studentDocId, Object.values(this.tasks)); artifacts.forEach(a => submission.upsertItemFromExtraction(taskDef, a)).


## src/AdminSheet/DocumentParsers/DocumentParser.js

Current coupling
- parseTask() builds and returns Task with taskReference or templateContent and precomputed contentHash.

Refactor steps
- Replace parseTask() with helpers that return primitives only: strings, arrays of arrays, formula arrays, plus positional metadata. Do not compute hashes.
- Add abstract methods per DESIGN.md: extractTaskDefinitions(referenceId, templateId?) returning TaskDefinition[]; extractSubmissionArtifacts(documentId, taskDefs) returning [{ taskId, pageId?, content, metadata }].

Migration notes
- Keep legacy parseTask only while Slides/Sheets parsers are migrated; delete afterwards.


## src/AdminSheet/DocumentParsers/SlidesParser.js

Current coupling
- extractTasks(documentId, contentType) → Task[].
- parseTask() computes contentHash and returns Task.
- Generates slide image URL as task content for Image tasks.

Refactor steps
- Implement extractTaskDefinitions(referenceId, templateId):
  - Walk both docs, align by discovered titles/pages, and build TaskDefinition for each taskTitle/pageId pair.
  - Add reference artifacts on reference pass; add template artifacts on template pass.
  - For text/table: artifact content is primitive (string for text, 2D array for table). For image: set metadata.sourceUrl only; no base64 at parse time.
  - Set TaskDefinition.id (hash(title + '-' + pageId)) and index order.
- Implement extractSubmissionArtifacts(documentId, taskDefs):
  - For each detected task/page: extract student primitive content and return { taskId, pageId, content, metadata } records. No hashing.
- Stop computing hashes in parser; let artifacts normalize and hash.

Migration notes
- Any code assuming Task.uid must switch to artifact.metadata.uid.


## src/AdminSheet/DocumentParsers/SheetsParser.js

Current coupling
- extractTasks(referenceId, templateId) → Task[] with taskMetadata.boundingBox and referenceLocationsMap; normalizes formulas and computes contentHash.
- extractStudentTasks(studentDocumentId, referenceTasks) → Task[] for each student sheet, computing contentHash.

Refactor steps
- extractTaskDefinitions(referenceId, templateId):
  - Produce TaskDefinition per sheet name with index.
  - Add SpreadsheetTaskArtifact for reference with content = array of { referenceFormula, location } or simply canonicalized cells; include metadata { sheetName, bbox, referenceLocationsMap } on TaskDefinition.taskMetadata.
  - Add SpreadsheetTaskArtifact for template (content may be minimal; primarily used for not-attempted detection if needed for non-spreadsheet types; spreadsheets won’t use LLM path).
- extractSubmissionArtifacts(studentDocId, taskDefs):
  - For each taskDef, use bbox/referenceLocationsMap from taskDef.taskMetadata to extract student formulas from only those locations.
  - Return [{ taskId, pageId: sheetId, content: array of { formula, location }, metadata: { sheetName, bbox } }]. Do not normalize canonical case here beyond trivial trimming.
- Move _normaliseFormulaCase logic into SpreadsheetTaskArtifact.normalizeContent; parser should not define canonicalization that affects hashing.

Migration notes
- TaskSheet remains an internal utility, but must only return primitive arrays; keep types off artifacts.


## src/AdminSheet/Models/Task.js

Current coupling
- Data holder for taskTitle, taskType, pageId, taskReference/templateContent, contentHash/templateHash, metadata, uid generation.

Refactor steps
- Deprecate this class. Replace with TaskDefinition and the artifacts module per DESIGN.md. Remove uid usage here; artifacts own uid.
- Provide a thin adapter temporarily if removal is staged: TaskAdapter.toDefinition(Task) to help migrate existing serialized data.


## src/AdminSheet/Models/StudentTask.js

Current coupling
- Holds student, assignmentId, documentId, and responses map keyed by taskKey (title). Responses contain uid, pageId, response, contentHash, assessments, feedback. Provides addResponse, addAssessment, addFeedback, getters, toJSON/fromJSON, generateUID, and extractAndAssignResponses(parser, tasks).

Refactor steps
- Replace with StudentSubmission (studentId, assignmentId, documentId?, items, createdAt/updatedAt). No Student object attached directly; store only studentId on the submission aggregate.
- Replace responses map with items[taskId] = StudentSubmissionItem { id, taskId, documentId?, pageId?, artifact(role='submission'), assessments, feedback }.
- Add submission.upsertItemFromExtraction(taskDef, { pageId, content, metadata }): create or update item with a typed artifact via ArtifactFactory (role='submission'); artifacts compute contentHash.
- Move JSON (de)serialization to StudentSubmission/Item shapes.
- Remove extractAndAssignResponses; Assignment.processAllSubmissions will coordinate extraction and upserts using parsers.

Migration notes
- Keep a conversion shim from legacy StudentTask JSON to StudentSubmission for reading old stored data during transition if needed.


## src/AdminSheet/RequestHandlers/LLMRequestManager.js

Current coupling
- Iterates assignment.studentTasks; uses studentTask.responses, extracts uid, raw studentResponse, contentHash; looks up Task by taskKey, uses task.taskReference/templateContent and their hashes; not-attempted when template hash === response hash; assigns assessments back via StudentTask.addAssessment; caches on reference/response hashes; builds payload { taskType, reference, template, studentResponse }.

Refactor steps
- Iterate assignment.submissions (StudentSubmission[]). For each submission, iterate submission.items (StudentSubmissionItem) that require LLM: item.getType() in { 'text', 'table', 'image' }.
- For each item, find its TaskDefinition by taskId, get primary reference/template artifacts: const ref = taskDef.getPrimaryReference(); const tpl = taskDef.getPrimaryTemplate().
- Not-attempted: if item.artifact.contentHash === tpl.contentHash → assign “N” and skip.
- Caching: use ref.contentHash and item.artifact.contentHash as keys; same CacheManager, different inputs.
- Payload: taskType = item.getType().toUpperCase(); reference = ref.content; template = tpl.content; studentResponse = item.artifact.content (or base64 for images as already set by ImageManager).
- UID: use item.artifact.getUid() for routing results; assign results via item.addAssessment(criterion, new Assessment(...)); no StudentTask lookup by uid; instead: build an index map uid→{ submission, item } during request generation to avoid searching.
- Skip spreadsheets entirely in request generation.




## src/AdminSheet/RequestHandlers/ImageManager.js

Current coupling
- collectAllSlideUrls(assignment) builds a list from Task (Image) and StudentTask.responses (Image), using Task.uid / response.uid; fetchImagesAsBase64 then SlidesAssignment.processImages rewrites base64 into tasks or responses.

Refactor steps
- Replace with:
  - collectAllImageArtifacts(assignment):
    - For each TaskDefinition: for each Image reference/template artifact, emit { uid: artifact.getUid(), url: artifact.metadata.sourceUrl, documentId, scope: 'reference'|'template', taskId }.
    - For each StudentSubmissionItem with type image: emit { uid: item.artifact.getUid(), url: item.artifact.metadata.sourceUrl, documentId: submission.documentId, scope: 'submission', taskId, itemId }.
  - fetchImagesAsBlobs(entries, batchSize): round-robin batches by documentId; fetch blobs.
  - Apply: for each result, locate the artifact via uid and call artifact.setContentFromBlob(blob) which sets content (base64) and updates contentHash.
- Remove SlidesAssignment.processImages rewriting; ImageManager should be the one to set artifact content via the setter.

Migration notes
- Ensure artifacts are created with metadata.sourceUrl at parse/upsert time; otherwise ImageManager won’t have URLs to fetch.


## src/AdminSheet/Assessors/SheetsAssessor.js 

Current coupling
- Constructed with tasks (reference Task map) and studentTasks; loops studentTask.responses; looks up referenceTask by taskKey; compares student formulas vs referenceTask.taskReference; writes assessments via StudentTask.addAssessment and feedback via addFeedback.

Refactor steps
- Update class so that it: 
  - Accepts (taskDefinition, refArtifact: SpreadsheetTaskArtifact, item: StudentSubmissionItem) triplets
  - Uses taskDefinition.taskMetadata (bbox, referenceLocationsMap, sheetName) for positional context.
  - Compares canonicalized formulas: refArtifact.content vs item.artifact.content. Write results via item.addAssessment/addFeedback and item.markAssessed().


Migration notes
- Keep existing formula diff logic but move canonicalization into SpreadsheetTaskArtifact.normalizeContent.


## src/AdminSheet/Sheets/TaskSheet.js

Current coupling
- Constructed with Google Sheet and a type string 'reference'|'template'|'studentTask'. Provides getAllFormulae(), getRange(bbox, 'formulas'), etc. Used by SheetsParser for both reference/template extraction and student sheet extraction.

Refactor steps
- Keep as a Sheets API helper but:
  - Ensure outputs are primitives only (arrays of strings/null). No GAS objects are passed to artifacts.
  - The 'type' flag is internal to extraction; artifacts should not depend on it.
- Do not compute contentHash or canonicalize; leave to SpreadsheetTaskArtifact.


## src/AdminSheet/Sheets/AnalysisSheetManager.js

Current coupling
- Builds headers and rows from this.assignment.tasks (map of Task keyed by taskKey) and this.assignment.studentTasks. Uses StudentTask.getResponse(taskKey) and studentTask.student.name.

Refactor steps
- Use this.assignment.tasks as { [taskId]: TaskDefinition }. When rendering, use taskDef.taskTitle for display; maintain deterministic order via TaskDefinition.index.
- Replace studentTasks with submissions. For each submission, for each taskId in the assignment.tasks order:
  - const item = submission.getItem(taskId)
  - const assessment = item?.getAssessment()
  - const feedback = item?.getFeedback()
  - For response preview, use item?.artifact.content (convert to suitable string for display; for tables/spreadsheets consider a compact representation).

Migration notes
- Keep a helper to map taskId → human title for headers quickly.


## src/AdminSheet/FeedbackPopulators/SheetsFeedback.js

Current coupling
- Accepts StudentTask[]; iterates studentTask.responses; uses response.pageId, response.feedback, and studentTask.documentId to build Google Sheets batchUpdate requests.

Refactor steps
- Accept StudentSubmission[]. For each submission, for each item with feedback present and a valid pageId:
  - Use submission.documentId and item.pageId (or item.artifact.pageId) to target sheets.
  - The feedback object now lives on StudentSubmissionItem.feedback; structure can remain the same (type→FeedbackJSON).

Migration notes
- Ensure StudentSubmissionItem.getFeedback() returns the existing shapes used by this writer.


## src/AdminSheet/RequestHandlers/CacheManager.js

Current coupling
- generateCacheKey(contentHashReference, contentHashResponse) and get/set using those hashes.

Refactor steps
- Keep as-is, but callers now supply artifact hashes: refArtifact.contentHash, submissionItem.artifact.contentHash. Do not use Task.* or StudentTask.* values.


## src/AdminSheet/RequestHandlers/BaseRequestManager.js (implicit)

- No direct Task/StudentTask coupling; no changes beyond payload wiring from LLMRequestManager and ImageManager.


## src/AdminSheet/y_controllers/AssignmentController.js

Current coupling
- Orchestrates processSlidesAssignment/processSheetsAssignment using Assignment subclasses; constructs SheetsFeedback with assignment.studentTasks; analyseAssignmentData(assignment) expects AnalysisSheetManager(assignment).

Refactor steps
- Replace SheetsFeedback construction to use assignment.submissions.
- No direct Task coupling otherwise; ensure downstream classes accept submissions not studentTasks.


## What changes per file (quick map)

- src/AdminSheet/AssignmentProcessor/Assignment.js
  - tasks: TaskDefinition map
  - studentTasks → submissions: StudentSubmission[]
  - addStudent: new StudentSubmission
  - generateLLMRequests/assessResponses route via new model

- src/AdminSheet/AssignmentProcessor/SlidesAssignment.js
  - populateTasks: use extractTaskDefinitions
  - processAllSubmissions: use extractSubmissionArtifacts + submission.upsertItemFromExtraction
  - processImages: delegate to ImageManager artifact setter

- src/AdminSheet/AssignmentProcessor/SheetsAssignment.js
  - populateTasks: use extractTaskDefinitions
  - processAllSubmissions: use extractSubmissionArtifacts + upserts

- src/AdminSheet/DocumentParsers/DocumentParser.js
  - deprecate parseTask building Task; add new extract* methods signatures

- src/AdminSheet/DocumentParsers/SlidesParser.js
  - implement extractTaskDefinitions, extractSubmissionArtifacts
  - stop hashing in parser

- src/AdminSheet/DocumentParsers/SheetsParser.js
  - implement extractTaskDefinitions, extractSubmissionArtifacts
  - move canonicalization into SpreadsheetTaskArtifact

- src/AdminSheet/Models/Task.js
  - deprecate; replace with TaskDefinition + Artifacts module

- src/AdminSheet/Models/StudentTask.js
  - deprecate; replace with StudentSubmission/StudentSubmissionItem

- src/AdminSheet/RequestHandlers/LLMRequestManager.js
  - iterate submissions/items
  - build payloads from artifacts
  - not-attempted and caching by artifact hashes
  - assign via item.addAssessment
  - use uid→item mapping for response assignment

- src/AdminSheet/RequestHandlers/ImageManager.js
  - collectAllImageArtifacts, fetchImagesAsBlobs, artifact.setContentFromBlob

- src/AdminSheet/Sheets/AnalysisSheetManager.js
  - switch to taskId keyed maps and StudentSubmission

- src/AdminSheet/FeedbackPopulators/SheetsFeedback.js
  - accept StudentSubmission[] and StudentSubmissionItem feedback

- src/AdminSheet/Sheets/TaskSheet.js
  - ensure primitive outputs; no hashing/canonicalization


## Data shape mapping details (field-by-field)

- TaskDefinition
  - id: hash(taskTitle + '-' + pageId) — persist and reuse
  - taskTitle: legacy Task.taskTitle
  - pageId: lives on artifacts; TaskDefinition may keep for convenience
  - taskNotes → TaskDefinition.taskNotes
  - taskMetadata → TaskDefinition.taskMetadata
  - artifacts.reference[0].content ← Task.taskReference (text/table/spreadsheet); for image: leave content null and set metadata.sourceUrl
  - artifacts.template[0].content ← Task.templateContent; for image: metadata.sourceUrl
  - artifacts.*[0].contentHash computed by artifact.ensureHash()

- StudentSubmission/StudentSubmissionItem
  - studentId ← Student.id
  - assignmentId: unchanged
  - documentId: unchanged
  - items[taskId].artifact.content ← responses[taskKey].response
  - items[taskId].artifact.contentHash ← responses[taskKey].contentHash (recomputed by artifact)
  - items[taskId].pageId ← responses[taskKey].pageId
  - items[taskId].assessments/feedback: same semantics
  - items[taskId].artifact.metadata.uid provides routing identity


## Edge cases and error handling

- Unknown taskId from parser.extractSubmissionArtifacts: warn and skip (maintain existing behavior).
- Missing submission.documentId: skip extraction for that student; log once.
- Validation failures in artifacts.validate(): record status/errors on item.artifact.metadata and continue.
- Title/page changes: persist TaskDefinition.id externally; never re-derive automatically.


## Migration plan (phased)

1) Introduce new models alongside legacy:
- Add src/AdminSheet/Models/TaskDefinition.js, Artifacts.js, StudentSubmission.js as specified in DESIGN.md.

2) Parser migration:
- Update SlidesParser/SheetsParser to implement extractTaskDefinitions/extractSubmissionArtifacts, returning primitives; keep legacy extractTasks for a short period.

3) Assignment layer:
- Switch Assignment subclasses to use TaskDefinition + StudentSubmission flow. Keep a temporary translation to legacy structures for Analysis/Feedback until those are updated.

4) Request/Assessor/Image pipelines:
- Update LLMRequestManager and ImageManager to the artifact model and uid mapping.

5) Reporting/feedback:
- Update AnalysisSheetManager and SheetsFeedback to submission/items and taskId indexing.

6) Remove legacy:
- Delete Models/Task.js and Models/StudentTask.js and any adapters after verification.


## Notes
- Keep hashing and canonicalization in artifacts. Never compute contentHash in parsers, assignments, or managers.
- For images, artifacts store base64 in content and compute hashes from that payload; metadata.sourceUrl remains the single fetch URL.
- Ensure TaskDefinition.index is set incrementally by parsers to keep document order in UI/exports.
