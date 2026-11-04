/* global Assessment, AssignmentCurrentRestoration */

/**
 * ABClassAssignmentValidation
 *
 * Completed-run validation owner for assessment persistence, extracted from
 * `ABClassAssignmentOps` so persistence orchestration and completion rules stay
 * separable. Rejects a terminal assignment whose marker-1 graph,
 * task/submission identity, source/hash state or shared reference/template
 * artefacts contradict what the read path accepts, before any projection or
 * collection mutation.
 *
 * @remarks Pure validation: no database, service or model mutation. The owning
 * `ABClassAssignmentOps.persistAssignmentRun()` calls
 * {@link ABClassAssignmentValidation#_validateCompletedAssignmentRun} before
 * stamping the result-format marker. Rules mirror the marker-1 read invariants
 * (`AssignmentCurrentRestoration`, `StudentSubmissionItem`) rather than
 * re-deriving them, so a write cannot certify a record the read path would
 * repair. This is a completion gate, not a run-start eligibility preflight.
 */
class ABClassAssignmentValidation {
  /** Validates that a completed run is safe to persist.
   * Requires the assignment to hold a completed terminal result for every known
   * task: the embedded task universe and submission associations are
   * trustworthy, every submission covers the known task universe, every item
   * carries exactly the three canonical criteria as valid complete results with
   * a consistent source state, and every known task's required shared
   * reference/template artefacts are usable.
   *
   * @remarks Preserves blank content with a hash, source-less acquisition/extraction errors, sourced assessment errors and genuine no-submission.
   * Rejects marker-1 contradictions (task/submission identity, source/hash and
   * null-parent placeholder state) that the read path would otherwise repair.
   * Not a run-start eligibility gate.
   *
   * @param {Assignment} assignment - The assignment to validate.
   * @returns {void}
   * @throws {Error} With the owning task and a semantic reason when the state
   *   is not a valid completed run.
   */
  _validateCompletedAssignmentRun(assignment) {
    const tasks = assignment.assignmentDefinition?.tasks ?? {};
    const taskIds = Object.keys(tasks);
    this._validateCompletedTaskUniverse(tasks, taskIds);
    const submissions = this._requireCompletedSubmissions(assignment);
    for (const submission of submissions) {
      this._validateCompletedSubmission(submission, assignment, taskIds);
    }
    this._validateCompletedSharedArtefacts(taskIds, tasks);
  }

  /** Validates one submission's identity, item structure and task coverage.
   * A genuine no-submission (null document ID plus an empty item map) is the
   * only omission that may skip per-task coverage.
   *
   * @param {Object} submission - Completed submission.
   * @param {Assignment} assignment - Parent assignment.
   * @param {Array<string>} taskIds - Known task identities.
   * @returns {void}
   * @throws {Error} If the submission contradicts the assignment root or its
   *   known task universe.
   */
  _validateCompletedSubmission(submission, assignment, taskIds) {
    this._validateCompletedSubmissionIdentity(submission, assignment);
    const items = submission.items;
    if (!items || typeof items !== 'object' || Array.isArray(items)) {
      throw new Error(
        `Completed assignment run is invalid: submission for student ${submission.studentId} is missing its item structure.`
      );
    }
    // A genuine no-submission has no document or observed task results.
    if (submission.documentId == null && Object.keys(items).length === 0) return;
    for (const key of Object.keys(items)) {
      if (!taskIds.includes(key)) {
        throw new Error(
          `Completed assignment run is invalid: submission for student ${submission.studentId} carries an item for unknown-task '${key}' outside the embedded task universe.`
        );
      }
    }
    for (const taskId of taskIds) {
      const item = items[taskId];
      if (!item) {
        throw new Error(
          `Completed assignment run is invalid: submission for student ${submission.studentId} has no result for known task ${taskId} (incomplete task coverage).`
        );
      }
      this._validateCompletedItem(taskId, item, submission.documentId);
    }
  }

  /** Requires the completed assignment to expose a submissions structure.
   * Fails loudly rather than treating a missing or malformed structure as an
   * empty run, which would otherwise certify nothing as complete.
   *
   * @param {Assignment} assignment - The assignment being persisted.
   * @returns {Array<Object>} The submission list.
   * @throws {TypeError} If the submissions structure is missing or not a list.
   */
  _requireCompletedSubmissions(assignment) {
    const submissions = assignment.submissions;
    if (!Array.isArray(submissions)) {
      throw new TypeError(
        'Completed assignment run is invalid: the submissions structure is missing or malformed.'
      );
    }
    return submissions;
  }

  /** Validates the embedded task universe before item associations are checked.
   * The task map must be a keyed object, non-empty, and every entry's `id` must
   * match its dictionary key. Item associations are only meaningful once this
   * universe is trustworthy.
   *
   * @param {Object} tasks - Embedded definition task map.
   * @param {Array<string>} taskIds - Keys of the embedded task map.
   * @returns {void}
   * @throws {Error} If the task universe is empty or internally inconsistent.
   */
  _validateCompletedTaskUniverse(tasks, taskIds) {
    if (!tasks || typeof tasks !== 'object' || Array.isArray(tasks)) {
      throw new Error(
        'Completed assignment run is invalid: the embedded task universe is missing or untrustworthy.'
      );
    }
    if (taskIds.length === 0) {
      throw new Error(
        'Completed assignment run is invalid: the embedded task universe is empty beside present submissions.'
      );
    }
    taskIds.forEach((taskId) => {
      const task = tasks[taskId];
      if (!task || typeof task !== 'object' || task.id !== taskId) {
        throw new Error(
          `Completed assignment run is invalid: task universe entry '${taskId}' has a mismatched task identity.`
        );
      }
    });
  }

  /** Validates that a submission belongs to the assignment being persisted.
   * The submission's `assignmentId` must match the assignment root, so an item
   * cannot be persisted under a mismatched parent association.
   *
   * @param {Object} submission - Completed submission.
   * @param {Assignment} assignment - Parent assignment.
   * @returns {void}
   * @throws {Error} If the submission identity contradicts the assignment root.
   */
  _validateCompletedSubmissionIdentity(submission, assignment) {
    if (!submission || typeof submission !== 'object') {
      throw new Error(
        'Completed assignment run is invalid: the submissions structure contains a missing submission.'
      );
    }
    if (submission.assignmentId !== assignment.assignmentId) {
      throw new Error(
        `Completed assignment run is invalid: submission for student ${submission.studentId} has an assignment identity that differs from the assignment root (submission association mismatch).`
      );
    }
  }

  /** Validates completed item results and source consistency.
   * Delegates criterion completeness and result validity to the existing
   * marker-1 read rule (`AssignmentCurrentRestoration`), then checks the
   * source/hash state.
   *
   * @param {string} taskId - Task identity.
   * @param {Object} item - Completed item.
   * @param {string|null} parentDocumentId - Parent source identity.
   * @returns {void}
   * @throws {Error} If the criterion map or source state is not a valid
   *   completed result.
   */
  _validateCompletedItem(taskId, item, parentDocumentId) {
    this._validateCompletedItemIdentity(taskId, item);
    const assessments = item.assessments ?? {};
    if (!AssignmentCurrentRestoration._hasValidCompletedCurrentAssessments(assessments, 'full')) {
      throw this._invalidCompletedRun(taskId, this._completedAssessmentsReason(assessments));
    }
    this._validateCompletedItemSource(taskId, item, Object.values(assessments), parentDocumentId);
  }

  /** Validates the marker-1 item/artefact identity associations.
   * Mirrors StudentSubmissionItem._hasValidCurrentArtifactIdentity and the
   * dictionary-key/task identity rule reached from validateCurrentRawArtifact.
   * The item and its artefact must carry the authoritative task key, and the
   * artefact role must be `submission`.
   *
   * @param {string} taskId - Authoritative task key.
   * @param {Object} item - Completed item.
   * @returns {void}
   * @throws {Error} If the item or artefact identity contradicts its task key.
   */
  _validateCompletedItemIdentity(taskId, item) {
    if (item.taskId !== taskId) {
      throw this._invalidCompletedRun(
        taskId,
        `the item task identity '${item.taskId}' differs from its dictionary key (task identity mismatch).`
      );
    }
    const artifact = item.artifact;
    if (!artifact || typeof artifact !== 'object') {
      throw this._invalidCompletedRun(taskId, 'the item artefact association is missing.');
    }
    if (artifact.taskId !== taskId) {
      throw this._invalidCompletedRun(
        taskId,
        `the artefact task identity '${artifact.taskId}' differs from its item task (task identity mismatch).`
      );
    }
    if (artifact.role !== 'submission') {
      throw this._invalidCompletedRun(
        taskId,
        `the artefact role '${artifact.role}' is not a submission association.`
      );
    }
  }

  /** Returns a safe explanation for an invalid completed criterion map.
   * Checks the map is a plain object with exactly the three canonical criteria,
   * each a valid raw result, and that any `E` entry carries non-blank reasoning.
   * Used only to build the rejection reason, never to salvage marks.
   *
   * @param {Object} assessments - Criterion result map.
   * @returns {string} Contextual validation reason.
   */
  _completedAssessmentsReason(assessments) {
    if (!assessments || typeof assessments !== 'object' || Array.isArray(assessments))
      return 'criterion result map is missing or invalid';
    const criteria = Assessment.CRITERIA;
    const keys = Object.keys(assessments);
    const missing = criteria.find((criterion) => !Object.hasOwn(assessments, criterion));
    if (missing) return `missing required ${missing} criterion result`;
    if (keys.some((key) => !criteria.includes(key))) return 'unexpected criterion result key';
    for (const criterion of criteria) {
      const entry = assessments[criterion];
      if (entry?.score === 'E' && (typeof entry.reasoning !== 'string' || !entry.reasoning.trim()))
        return `${criterion} reasoning must be non-blank`;
      if (!Assessment.isValidRawResult(entry)) return `invalid ${criterion} criterion result`;
    }
    return 'invalid criterion results';
  }

  /** Validates permitted terminal errors when source content is null.
   * Present content requires a usable hash. Null content requires an explicit
   * null hash and an all-three terminal error whose stage matches the parent
   * source state: acquisition/validation for a null parent document,
   * acquisition/extraction/validation otherwise. A still-pending or
   * unavailable source beside non-error results is rejected.
   *
   * @param {string} taskId - Task identity.
   * @param {Object} item - Completed item.
   * @param {Array<Object>} entries - Criterion results.
   * @param {string|null} parentDocumentId - Parent source identity.
   * @returns {void}
   * @throws {Error} If the source/hash state or error stages contradict a
   *   completed result.
   */
  _validateCompletedItemSource(taskId, item, entries, parentDocumentId) {
    const artifact = item.artifact;
    if (parentDocumentId == null) {
      this._validateNullParentPlaceholder(taskId, item);
      if (artifact.content != null) {
        throw this._invalidCompletedRun(
          taskId,
          'a submission without a source document cannot carry artefact content'
        );
      }
      this._validateNullSourceItem(taskId, entries, parentDocumentId);
      return;
    }
    if (artifact.content == null) {
      // A source-less item must carry an explicit null hash; a stale value or a
      // deleted property is a source/hash contradiction, not a valid placeholder.
      if (!Object.hasOwn(artifact, 'contentHash') || artifact.contentHash !== null) {
        throw this._invalidCompletedRun(
          taskId,
          'null source content requires an explicit null content hash (source/hash contradiction).'
        );
      }
      this._validateNullSourceItem(taskId, entries, parentDocumentId);
      return;
    }
    if (typeof artifact.contentHash !== 'string' || artifact.contentHash.length === 0) {
      throw this._invalidCompletedRun(
        taskId,
        'present submission content requires a usable content hash'
      );
    }
  }

  /** Validates the empty metadata/feedback contract of a null-parent placeholder.
   * Mirrors the placeholder half of AssignmentCurrentRestoration._hasConsistentCurrentSource
   * (empty artefact metadata and empty item feedback). The remaining null-parent
   * identity checks of that read invariant are satisfied before this gate runs:
   * the parent submission has no document, the item/artefact task identities must
   * match, and content/hash must be exactly null. The artefact type is the read
   * path's canonical `base` placeholder type, which this write gate does not
   * re-derive from the artefact subclass.
   * @param {string} taskId - Task identity.
   * @param {Object} item - Completed item.
   * @returns {void}
   * @throws {Error} If the placeholder carries artefact metadata or item feedback.
   */
  _validateNullParentPlaceholder(taskId, item) {
    const metadata = item.artifact?.metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw this._invalidCompletedRun(
        taskId,
        'a submission without a source document requires empty artefact metadata (placeholder metadata invariant).'
      );
    }
    if (Object.keys(metadata).length > 0) {
      throw this._invalidCompletedRun(
        taskId,
        'a submission without a source document cannot carry artefact metadata (placeholder metadata invariant).'
      );
    }
    const feedback = item.feedback;
    if (!feedback || typeof feedback !== 'object' || Array.isArray(feedback)) {
      throw this._invalidCompletedRun(
        taskId,
        'a submission without a source document requires empty item feedback (placeholder feedback invariant).'
      );
    }
    if (Object.keys(feedback).length > 0) {
      throw this._invalidCompletedRun(
        taskId,
        'a submission without a source document cannot carry item feedback (placeholder feedback invariant).'
      );
    }
  }

  /** Validates null-source items against their parent submission and error causes.
   * Every criterion must be `E` with a stage permitted by the parent source
   * state: acquisition/validation for a null parent document,
   * acquisition/extraction/validation otherwise. A still-pending or unavailable
   * source beside non-error results is rejected.
   *
   * @param {string} taskId - Task identity.
   * @param {Array<Object>} entries - Criterion results.
   * @param {string|null} parentDocumentId - Parent source identity.
   * @returns {void}
   * @throws {Error} If the criteria are not a permitted terminal error set for
   *   this source state.
   */
  _validateNullSourceItem(taskId, entries, parentDocumentId) {
    const isNullDocument = parentDocumentId == null;
    const allowedStages = isNullDocument
      ? ['acquisition', 'validation']
      : ['acquisition', 'extraction', 'validation'];
    const allErrors = entries.every((entry) => entry.score === 'E');
    if (allErrors && entries.every((entry) => allowedStages.includes(entry.error?.stage))) return;
    if (isNullDocument) {
      throw this._invalidCompletedRun(
        taskId,
        'a submission without a source document may only carry acquisition or validation error placeholders'
      );
    }
    throw this._invalidCompletedRun(
      taskId,
      'submission artefact has no source content beside terminal results that are not acquisition/extraction error placeholders (pending or unavailable content)'
    );
  }

  /** Creates a task-contextual completion validation error.
   * Centralises the message prefix so every rejection names the owning task and
   * a semantic reason; tests assert on that shape.
   *
   * @param {string} taskId - Task identity.
   * @param {string} reason - Rejection reason.
   * @returns {Error} Contextual error.
   */
  _invalidCompletedRun(taskId, reason) {
    return new Error(`Completed assignment run is invalid for task ${taskId}: ${reason}`);
  }

  /** Validates shared artefacts for all completed tasks.
   * A known task's required reference/template artefact array must be present
   * and non-empty, and every artefact must carry usable content and a non-empty
   * string hash. This is the completed-assignment artefact gate; the looser
   * pending-IMAGE exception belongs to the definition-write validator.
   *
   * @param {Array<string>} taskIds - Known task identities.
   * @param {Object} tasks - Known task definitions.
   * @returns {void}
   * @throws {Error} If a required shared artefact array is empty or an artefact
   *   has no usable content or hash.
   */
  _validateCompletedSharedArtefacts(taskIds, tasks) {
    taskIds.forEach((taskId) => {
      const artifacts = tasks[taskId]?.artifacts ?? {};
      ['reference', 'template'].forEach((role) => {
        const roleArtifacts = artifacts[role];
        if (!roleArtifacts) return;
        if (roleArtifacts.length === 0)
          throw this._invalidCompletedRun(
            taskId,
            `the required shared ${role} artefact array is empty`
          );
        roleArtifacts.forEach((artefact) => {
          if (artefact?.content == null)
            throw this._invalidCompletedRun(
              taskId,
              `the shared ${role} artefact has no usable content`
            );
          if (typeof artefact.contentHash !== 'string' || artefact.contentHash.length === 0)
            throw this._invalidCompletedRun(
              taskId,
              `the shared ${role} artefact has no usable content hash`
            );
        });
      });
    });
  }
}

// Export for Node tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ABClassAssignmentValidation;
}
