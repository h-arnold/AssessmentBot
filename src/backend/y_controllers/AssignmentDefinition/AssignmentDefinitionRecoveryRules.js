/**
 * AssignmentDefinitionRecoveryRules
 *
 * Pure recovery and reparse rules for assignment-definition upserts (issue #301).
 * Owns the explicit recovery-path decisions consumed by the upsert orchestrator:
 * forced-reparse request gating, approval-save baseline comparison, recognised
 * parse-failure mapping, and stored-weighting restoration for equivalent tasks.
 * Ordinary upserts never reach these rules; they keep the timestamp
 * short-circuit in the orchestrator untouched.
 */

const DEFINITION_PARSE_FAILED_MESSAGE =
  'The assignment documents could not be parsed. Check the reference and template documents, then try again.';

/**
 * Asserts the forced-reparse preconditions before any parsing or persistence.
 *
 * A forced reparse is an explicit recovery/manual-reparse request: it requires
 * an existing definition and must not carry a weighting patch, whose precedence
 * against freshly parsed tasks would be ambiguous.
 *
 * @param {Object} payload - Upsert payload.
 * @param {boolean} isUpdate - Whether this is an update of a stored definition.
 * @returns {void} Returns nothing.
 * @throws {ApiValidationError} When a forced-reparse precondition is violated;
 *   the transport envelope surfaces `INVALID_REQUEST`.
 */
function assertRecoveryPreconditions_(payload, isUpdate) {
  /* global ApiValidationError */
  if (payload.forceReparse === true && !isUpdate) {
    throw new ApiValidationError(
      'forceReparse requires an existing definitionKey for recovery reparses.',
      { method: 'upsertAssignmentDefinition' }
    );
  }

  if (payload.forceReparse === true && Object.hasOwn(payload, 'taskWeightings')) {
    throw new ApiValidationError(
      'forceReparse must not be combined with taskWeightings. Explicit forced requests omit weighting patches.',
      { method: 'upsertAssignmentDefinition' }
    );
  }
}

/**
 * Rejects an approval save whose baseline does not match the stored definition.
 *
 * The frontend sends the response `updatedAt` from its latest load or reparse;
 * a mismatch means the definition changed since review, so the save is refused
 * with DEFINITION_STALE before any persistence. Requests without a string
 * baseline retain ordinary upsert behaviour.
 *
 * @param {Object|null} existingDefinition - Stored definition when updating.
 * @param {*} updatedAt - Approval-save baseline from the request.
 * @param {boolean} isUpdate - Whether this is an update of a stored definition.
 * @returns {void} Returns nothing.
 * @throws {ApiValidationError} When the baseline does not match the stored definition,
 *   carrying `code: 'DEFINITION_STALE'`.
 */
function assertApprovalBaselineFresh_(existingDefinition, updatedAt, isUpdate) {
  /* global ABLogger, ApiValidationError */
  if (isUpdate && typeof updatedAt === 'string' && updatedAt !== existingDefinition.updatedAt) {
    ABLogger.getInstance().warn('Upsert rejected as stale approval baseline.', {
      definitionKey: existingDefinition.definitionKey,
    });
    throw new ApiValidationError(
      'The assignment definition changed since it was reviewed. Reparse the documents and try again.',
      {
        method: 'upsertAssignmentDefinition',
        fieldName: 'updatedAt',
        code: 'DEFINITION_STALE',
      }
    );
  }
}

/**
 * Parses document tasks, mapping recognised content failures to DEFINITION_PARSE_FAILED.
 *
 * A throwing parser, a zero-task result, or a parse whose output is marked as
 * containing invalid tasks all block the refresh: nothing is persisted and the
 * stored definition is left unchanged by the caller, which throws before
 * reaching persistence. Raw diagnostics stay in the logs; the thrown error
 * carries only safe user copy.
 *
 * @param {Object} params - Parse parameters.
 * @param {Object} params.taskParser - Task parser sub-class instance.
 * @param {string} params.documentType - Document type.
 * @param {string} params.referenceDocumentId - Reference document ID.
 * @param {string} params.templateDocumentId - Template document ID.
 * @returns {Object} Parsed task map keyed by task ID (never empty).
 * @throws {ApiValidationError} When parsing throws a recognised content error,
 *   yields zero tasks, or reports invalid tasks; carries
 *   `code: 'DEFINITION_PARSE_FAILED'`.
 * @throws {Error} The original parser error when it carries its own
 *   classification (for example rate-limit, authorisation, or persistence).
 */
function parseTasksOrThrow_({ taskParser, documentType, referenceDocumentId, templateDocumentId }) {
  /* global ABLogger, ApiValidationError */
  let parsedTasks;
  try {
    parsedTasks = taskParser.parseTasks({
      documentType,
      referenceDocumentId,
      templateDocumentId,
    });
  } catch (error) {
    if (!isRecognisedContentParsingFailure_(error)) {
      ABLogger.getInstance().error('Assignment definition parser failed.', {
        documentType,
        referenceDocumentId,
        templateDocumentId,
        err: error,
      });
      throw error;
    }

    ABLogger.getInstance().error('Assignment definition documents could not be parsed.', {
      documentType,
      referenceDocumentId,
      templateDocumentId,
      err: error,
    });
    throw new ApiValidationError(DEFINITION_PARSE_FAILED_MESSAGE, {
      method: 'upsertAssignmentDefinition',
      code: 'DEFINITION_PARSE_FAILED',
      cause: error,
    });
  }

  if (!parsedTasks || Object.keys(parsedTasks).length === 0) {
    ABLogger.getInstance().error(
      'Assignment definition parse yielded zero tasks; blocking refresh.',
      {
        documentType,
        referenceDocumentId,
        templateDocumentId,
      }
    );
    throw new ApiValidationError(DEFINITION_PARSE_FAILED_MESSAGE, {
      method: 'upsertAssignmentDefinition',
      code: 'DEFINITION_PARSE_FAILED',
    });
  }

  if (parsedTasks.hasInvalidTasks === true) {
    ABLogger.getInstance().error(
      'Assignment definition parse yielded invalid tasks; blocking refresh.',
      {
        documentType,
        referenceDocumentId,
        templateDocumentId,
      }
    );
    throw new ApiValidationError(DEFINITION_PARSE_FAILED_MESSAGE, {
      method: 'upsertAssignmentDefinition',
      code: 'DEFINITION_PARSE_FAILED',
    });
  }

  return parsedTasks;
}

/**
 * Returns whether an unclassified native error is a document-content failure.
 * Typed errors carry their own transport classification and must pass through.
 *
 * @param {*} error - Parser error.
 * @returns {boolean} True when the error is a recognised content failure.
 * @private
 */
function isRecognisedContentParsingFailure_(error) {
  return error instanceof Error && error.name === 'Error';
}

/**
 * Preserves stored weightings only for reparsed tasks with equivalent content.
 *
 * Tasks are matched by task ID. Equivalent content keeps the stored weighting
 * (including a valid zero); new or changed tasks keep the freshly parsed
 * weighting for the constructor default to settle; removed tasks disappear
 * because the returned map holds only reparsed tasks. Assignment-level
 * weighting is resolved separately and untouched here.
 *
 * @param {Object} existingTasks - Stored task map keyed by task ID.
 * @param {Object} parsedTasks - Freshly parsed task map keyed by task ID.
 * @returns {Object} Reparsed tasks with equivalent stored weightings restored.
 */
function applyEquivalentStoredWeightings_(existingTasks, parsedTasks) {
  /* global compareTaskEquivalence_ */
  const reconciledTasks = parsedTasks || {};

  Object.entries(existingTasks || {}).forEach(([taskId, previousTask]) => {
    const reparsedTask = reconciledTasks[taskId] || null;
    if (!previousTask || !reparsedTask) {
      return;
    }

    const decision = compareTaskEquivalence_(previousTask, reparsedTask);
    if (decision.equivalent && Object.hasOwn(previousTask, 'taskWeighting')) {
      reparsedTask.taskWeighting = previousTask.taskWeighting;
    }
  });

  return reconciledTasks;
}

// Export for Node tests / CommonJS environments. The script-scope functions keep
// trailing underscores so GAS does not expose them to google.script.run.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    assertRecoveryPreconditions_,
    assertApprovalBaselineFresh_,
    parseTasksOrThrow_,
    applyEquivalentStoredWeightings_,
  };
}
