/* global ABLogger, Assignment, AssignmentNotFoundError, TypeError, AssignmentDefinitionController, Validate, Assessment, AssignmentCurrentRestoration, AssignmentSerialisation */

/**
 * ABClassAssignmentOps
 *
 * Assignment run persistence and rehydration operations. Persists full
 * assignment payloads to dedicated collections and manages the
 * hydration lifecycle between partial and full assignment representations.
 */
class ABClassAssignmentOps {
  /** Constructs ABClassAssignmentOps.
   * @param {Object} options - Options object.
   * @param {Object} options.dbManager - The DbManager instance for collection access.
   * @param {Object} options.validation - An ABClassValidation instance.
   * @param {Object} options.persistence - An ABClassPersistence instance.
   */
  constructor({ dbManager, validation, persistence }) {
    this._dbManager = dbManager;
    this._validation = validation;
    this._persistence = persistence;
  }

  /** Generates the collection name for a full assignment.
   * @param {string} courseId - The Classroom course ID.
   * @param {string} assignmentId - The assignment ID.
   * @returns {string} Collection name following pattern: assign_full_<courseId>_<assignmentId>.
   */
  _getFullAssignmentCollectionName(courseId, assignmentId) {
    return `assign_full_${courseId}_${assignmentId}`;
  }

  /** Persists a completed assignment run and its class projections.
   * Persist an assignment run by writing full payload to dedicated collection
   * and updating the ABClass with a partial summary.
   *
   * @remarks Deliberately NOT transactional, no rollback: the full assignment
   * store is written first, then the class store, then the abclass_partials
   * registry. All four projections (full assignment, embedded partial,
   * prospective full class, class-partials registry) are prepared through the
   * existing class preparation owner before the first collection mutation, and
   * every later write consumes those exact prepared payloads. A storage failure
   * throws after logging the failed phase and whether the full assignment write
   * committed; it never reports a completed run and nothing repairs the state.
   *
   * @param {ABClass|Object} abClass - An ABClass instance or plain object with
   *   a `classId` property and a `toPartialJSON()` method.
   * @param {Assignment} assignment - The assignment to persist
   * @returns {Object} Prepared class and registry payloads for the facade write.
   */
  persistAssignmentRun(abClass, assignment) {
    const logger = ABLogger.getInstance();
    let failedPhase = 'completed-write-validation';
    let hasFullWriteCommitted = false;
    try {
      Validate.requireParams({ abClass, assignment }, 'persistAssignmentRun');

      if (!assignment.courseId || !assignment.assignmentId) {
        throw new TypeError('Assignment must have courseId and assignmentId');
      }

      if (typeof abClass.classId !== 'string' || abClass.classId.trim().length === 0) {
        throw new TypeError(
          'persistAssignmentRun: expected abClass.classId to be a non-empty string'
        );
      }

      if (typeof assignment.courseId !== 'string' || assignment.courseId.trim().length === 0) {
        throw new TypeError(
          'persistAssignmentRun: expected assignment.courseId to be a non-empty string'
        );
      }

      if (
        typeof assignment.assignmentId !== 'string' ||
        assignment.assignmentId.trim().length === 0
      ) {
        throw new TypeError(
          'persistAssignmentRun: expected assignment.assignmentId to be a non-empty string'
        );
      }

      // Fail-fast: reject partial assignmentDefinition (tasks is an array).
      // Full persistence requires a fully hydrated definition with keyed task objects.
      if (Array.isArray(assignment.assignmentDefinition?.tasks)) {
        throw new TypeError(
          'Cannot persist full assignment with partial assignmentDefinition (tasks is an array)'
        );
      }

      // Completed-write gate: reject an incomplete or invalid terminal result
      // before any projection or collection mutation.
      this._validateCompletedAssignmentRun(assignment);

      // Stamp the result-format marker only after the completed state is valid
      // and before the full and partial payloads are serialised.
      assignment.assessmentContractVersion = 1;

      // 1. Prepare the full assignment and embedded partial projections, detached
      // from the live model so later writes cannot observe model mutations.
      failedPhase = 'full-assignment-projection';
      assignment._hydrationLevel = 'full';
      const fullPayload = AssignmentSerialisation.copyJsonSnapshot(assignment.toJSON());

      failedPhase = 'embedded-partial-projection';
      const partialPayload = AssignmentSerialisation.copyJsonSnapshot(assignment.toPartialJSON());

      // Restore the actual partial representation that will live in the class.
      // This is a representation conversion, not a validation-only round-trip.
      const partialView = Assignment.fromJSON(partialPayload, 'partial');
      partialView._hydrationLevel = 'partial';
      const assignmentIndex = abClass.findAssignmentIndex(
        (a) => a.assignmentId === assignment.assignmentId
      );
      const existingAssignment = assignmentIndex >= 0 ? abClass.assignments[assignmentIndex] : null;
      if (assignmentIndex >= 0) abClass.assignments[assignmentIndex] = partialView;
      else abClass.assignments.push(partialView);
      let classFullData;
      let classPartialData;
      try {
        failedPhase = 'prospective-class-projection';
        classFullData = this._persistence._prepareFullClass(abClass);
        failedPhase = 'class-partials-projection';
        classPartialData = this._persistence._prepareClassPartial(abClass);
      } finally {
        if (assignmentIndex >= 0) abClass.assignments[assignmentIndex] = existingAssignment;
        else abClass.assignments.pop();
      }

      // 3. Write the full assignment to its dedicated collection.
      failedPhase = 'full-assignment-store';
      const collectionName = this._getFullAssignmentCollectionName(
        assignment.courseId,
        assignment.assignmentId
      );
      const fullCollection = this._dbManager.getCollection(collectionName);

      logger.info('persistAssignmentRun: writing full assignment', {
        courseId: assignment.courseId,
        assignmentId: assignment.assignmentId,
        collectionName,
      });

      // Use replaceOne to ensure single document per assignment
      const filter = {
        courseId: assignment.courseId,
        assignmentId: assignment.assignmentId,
      };
      const existing = fullCollection.findOne(filter);

      if (existing) {
        fullCollection.replaceOne(filter, fullPayload);
      } else {
        fullCollection.insertOne(fullPayload);
      }
      fullCollection.save();
      hasFullWriteCommitted = true;

      if (assignmentIndex >= 0) abClass.assignments[assignmentIndex] = partialView;
      else abClass.assignments.push(partialView);
      logger.info('persistAssignmentRun: prepared class projections', {
        assignmentId: assignment.assignmentId,
        index: assignmentIndex,
      });
      return {
        fullData: classFullData,
        partialData: classPartialData,
        fullWriteCommitted: true,
      };
    } catch (error) {
      logger.error('persistAssignmentRun failed', {
        courseId: assignment?.courseId,
        assignmentId: assignment?.assignmentId,
        err: error,
        failedPhase,
        fullWriteCommitted: hasFullWriteCommitted,
      });
      throw error;
    }
  }

  /** Validates a terminal item against its result map and source state.
   * Validates that the assignment holds a completed terminal result for every
   * known task before persistence: every submission covers the known task
   * universe, every item carries exactly the three canonical criteria as valid
   * complete results with a consistent source state, and every known task's
   * required shared reference/template artefacts are usable.
   *
   * @remarks Preserves blank content with a hash, source-less acquisition/extraction errors, sourced assessment errors and genuine no-submission.
   * Not a run-start eligibility gate.
   *
   * @param {Assignment} assignment - The assignment to validate.
   * @returns {void}
   * @throws {Error} With the owning task and a semantic reason when the state
   *   is not a valid completed run.
   * @private
   */
  _validateCompletedAssignmentRun(assignment) {
    const tasks = assignment.assignmentDefinition?.tasks ?? {};
    const taskIds = Object.keys(tasks);
    const submissions = assignment.submissions ?? [];
    for (const submission of submissions) {
      const items = submission.items ?? {};
      // A genuine no-submission has no document or observed task results.
      if (submission.documentId == null && Object.keys(items).length === 0) continue;
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
    this._validateCompletedSharedArtefacts(taskIds, tasks);
  }

  /** Validates completed item results and source consistency.
   * @param {string} taskId - Task identity.
   * @param {Object} item - Completed item.
   * @param {string|null} parentDocumentId - Parent source identity.
   * @returns {void}
   * @private
   */
  _validateCompletedItem(taskId, item, parentDocumentId) {
    const assessments = item.assessments ?? {};
    if (!AssignmentCurrentRestoration._hasValidCompletedCurrentAssessments(assessments, 'full')) {
      throw this._invalidCompletedRun(taskId, this._completedAssessmentsReason(assessments));
    }
    this._validateCompletedItemSource(taskId, item, Object.values(assessments), parentDocumentId);
  }
  /**
   * Returns a safe explanation for an invalid completed criterion map.
   * @param {Object} assessments - Criterion result map.
   * @returns {string} Contextual validation reason.
   */
  _completedAssessmentsReason(assessments) {
    if (!assessments || typeof assessments !== 'object' || Array.isArray(assessments))
      return 'criterion result map is missing or invalid';
    const criteria = ['completeness', 'accuracy', 'spag'];
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
   * @param {string} taskId - Task identity.
   * @param {Object} item - Completed item.
   * @param {Array<Object>} entries - Criterion results.
   * @param {string|null} parentDocumentId - Parent source identity.
   * @returns {void}
   * @private
   */
  _validateCompletedItemSource(taskId, item, entries, parentDocumentId) {
    const artifact = item.artifact;
    if (parentDocumentId == null && artifact.content != null) {
      throw this._invalidCompletedRun(
        taskId,
        'a submission without a source document cannot carry artefact content'
      );
    }
    if (artifact.content == null) {
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

  /** Validates null-source items against their parent submission and error causes.
   * @param {string} taskId - Task identity.
   * @param {Array<Object>} entries - Criterion results.
   * @param {string|null} parentDocumentId - Parent source identity.
   * @returns {void}
   * @private
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
   * @param {string} taskId - Task identity.
   * @param {string} reason - Rejection reason.
   * @returns {Error} Contextual error.
   * @private
   */
  _invalidCompletedRun(taskId, reason) {
    return new Error(`Completed assignment run is invalid for task ${taskId}: ${reason}`);
  }

  /** Validates shared artefacts for all completed tasks.
   * @param {Array<string>} taskIds - Known task identities.
   * @param {Object} tasks - Known task definitions.
   * @returns {void}
   * @private
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

  /**
   * Read-only rehydration of an assignment from its dedicated collection.
   * Loads and hydrates an assignment without requiring an ABClass instance,
   * triggering a roster refresh, or mutating any class.
   *
   * @param {string} courseId - The Classroom course ID.
   * @param {string} assignmentId - The assignment ID to rehydrate.
   * @returns {Assignment} The fully hydrated assignment instance.
   * @throws {TypeError} If courseId or assignmentId are not non-empty strings.
   * @throws {AssignmentNotFoundError} If no document exists for the given identifiers.
   * @throws {Error} If the document is corrupt or the definition cannot be resolved.
   */
  readRehydrateAssignment(courseId, assignmentId) {
    // Keep the direct guards: requireParams would replace the required exact
    // TypeError messages with a generic Error for null or undefined inputs.
    if (typeof courseId !== 'string' || courseId.trim().length === 0) {
      throw new TypeError('readRehydrateAssignment: expected courseId to be a non-empty string');
    }

    if (typeof assignmentId !== 'string' || assignmentId.trim().length === 0) {
      throw new TypeError(
        'readRehydrateAssignment: expected assignmentId to be a non-empty string'
      );
    }

    const document = this._loadFullAssignmentDocument(courseId, assignmentId);
    this._validateAssignmentDocument(document);

    const hydratedAssignment = Assignment.fromJSON(document, 'full');
    this._ensureFullDefinition(hydratedAssignment);
    hydratedAssignment._hydrationLevel = 'full';

    return hydratedAssignment;
  }

  /**
   * Loads the full assignment document from its dedicated collection.
   *
   * @param {string} courseId - The Classroom course ID.
   * @param {string} assignmentId - The assignment ID.
   * @returns {Object} The assignment document.
   * @throws {AssignmentNotFoundError} If the document is not found in its dedicated collection.
   * @throws {Error} If an error occurs during loading.
   */
  _loadFullAssignmentDocument(courseId, assignmentId) {
    const logger = ABLogger.getInstance();
    const collectionName = this._getFullAssignmentCollectionName(courseId, assignmentId);
    const fullCollection = this._dbManager.getCollection(collectionName);
    const document = fullCollection.findOne({ courseId, assignmentId });

    if (!document) {
      throw new AssignmentNotFoundError(
        `No document found in collection ${collectionName} for courseId=${courseId}, assignmentId=${assignmentId}. Assignment does not exist or has not been persisted.`,
        { courseId, assignmentId, collectionName }
      );
    }

    logger.info('_loadFullAssignmentDocument: loading full assignment', {
      courseId,
      assignmentId,
      collectionName,
    });

    return document;
  }

  /**
   * Validates that an assignment document has all required fields.
   *
   * @param {Object} document - The assignment document to validate.
   * @throws {Error} If required fields courseId, assignmentId, or assignmentDefinition are missing.
   */
  _validateAssignmentDocument(document) {
    if (!document.courseId || !document.assignmentId) {
      throw new Error(
        'Corrupt or invalid assignment data: missing required fields courseId or assignmentId'
      );
    }

    if (!document.assignmentDefinition) {
      throw new Error(
        'Corrupt or invalid assignment data: missing required field assignmentDefinition'
      );
    }
  }

  /**
   * Ensures the assignment has a full definition.
   * Detects partial definitions (tasks is an array) and fetches the full definition as needed.
   *
   * @param {Assignment} assignment - The assignment to check and potentially complete.
   */
  _ensureFullDefinition(assignment) {
    const definitionKey = assignment.assignmentDefinition?.definitionKey;
    if (!definitionKey) return;

    // Detect partial definition by checking if tasks is an array
    const isPartial = Array.isArray(assignment.assignmentDefinition?.tasks);

    if (!isPartial) return;

    const definitionController = new AssignmentDefinitionController();
    const storedDefinition = definitionController.getDefinitionByKey(definitionKey, {
      form: 'full',
    });

    if (!storedDefinition || Array.isArray(storedDefinition.tasks)) {
      throw new Error(
        `Failed to rehydrate definition '${definitionKey}': the authoritative record is a partial (tasks is an array).`
      );
    }

    // Use the full definition from the registry
    assignment.assignmentDefinition = storedDefinition;
  }
}

// Export for Node tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ABClassAssignmentOps;
}
