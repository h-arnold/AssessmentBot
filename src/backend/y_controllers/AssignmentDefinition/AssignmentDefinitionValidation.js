const MIN_WEIGHTING = 0;
const MAX_WEIGHTING = 10;

/**
 * AssignmentDefinitionValidation
 *
 * Shared validation helpers for assignment definition operations.
 * Pure functions with no dependencies on other modules.
 */
class AssignmentDefinitionValidation {
  /**
   * Returns whether the value is a non-empty string after trim.
   *
   * @param {*} value - Value to check.
   * @returns {boolean} True when non-empty trimmed string.
   */
  isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  /**
   * Requires a non-empty string and returns trimmed value.
   *
   * @param {*} value - Candidate value.
   * @param {string} fieldName - Field for diagnostics.
   * @returns {string} Trimmed string.
   * @throws {Error} When value is not a non-empty string.
   */
  requireTrimmedString(value, fieldName) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${fieldName} must be a non-empty string.`);
    }

    return value.trim();
  }

  /**
   * Normalises duplicate-check title format.
   *
   * @param {string} title - Candidate title.
   * @returns {string} Normalised title.
   */
  normaliseTitleForDuplicate(title) {
    return String(title || '')
      .trim()
      .toLowerCase();
  }

  /**
   * Normalises alternate titles payload.
   *
   * @param {*} alternateTitles - Candidate title list.
   * @returns {Array<string>} Normalised title list.
   * @throws {TypeError|Error} When alternateTitles is invalid.
   */
  normaliseAlternateTitles(alternateTitles) {
    if (alternateTitles === undefined || alternateTitles === null) {
      return [];
    }

    if (!Array.isArray(alternateTitles)) {
      throw new TypeError('alternateTitles must be an array when provided.');
    }

    return alternateTitles.map((title, index) => {
      if (typeof title !== 'string' || title.trim().length === 0) {
        throw new Error(`alternateTitles[${index}] must be a non-empty string.`);
      }
      return title.trim();
    });
  }

  /**
   * Validates weighting values for assignment and task contracts.
   *
   * @param {*} value - Candidate weighting.
   * @param {string} fieldName - Field label for diagnostics.
   * @returns {number|null} Validated weighting.
   * @throws {TypeError|RangeError} When value is invalid.
   */
  requireNumericOrNullWeighting(value, fieldName) {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`${fieldName} must be a number or null.`);
    }

    if (value < MIN_WEIGHTING || value > MAX_WEIGHTING) {
      throw new RangeError(`${fieldName} must be between ${MIN_WEIGHTING} and ${MAX_WEIGHTING}.`);
    }

    return value;
  }

  /**
   * Validates shared artefacts on resolved definition tasks before persistence.
   * Pending IMAGE artefacts are permitted; other artefacts require usable content/hash.
   * @param {Object} task - Resolved task definition or its JSON representation.
   * @returns {boolean} True when shared artefacts are usable.
   * @throws {ApiValidationError} When a non-IMAGE shared artefact lacks usable content/hash or a
   *   SPREADSHEET reference has no assessable formula; carries `code: 'DEFINITION_PARSE_FAILED'`.
   * @throws {Error} When the task or its reference/template artefact groups are missing;
   *   structural and wiring faults propagate unchanged.
   * @remarks Pending IMAGE artefacts are valid definition-store state. The stricter
   *   completed-full-assignment artefact gate belongs to the completion path, not here.
   */
  validateSharedArtifacts(task) {
    /* global ABLogger, ApiValidationError */
    Validate.requireParams({ task }, 'validateSharedArtifacts');
    const taskJson = typeof task.toJSON === 'function' ? task.toJSON() : task;
    const taskId = taskJson.id || taskJson.taskId;
    const artifactGroups = taskJson.artifacts;
    for (const role of ['reference', 'template']) {
      const artifacts = artifactGroups[role];
      for (const artifact of artifacts) {
        if (artifact.type === 'IMAGE') continue;
        if (artifact.content == null || typeof artifact.contentHash !== 'string') {
          this._rejectDefinitionContent(
            `Shared artifact content and hash are required for task ${taskId}.`,
            { taskId }
          );
        }
      }
    }

    const referenceArtifacts = artifactGroups.reference;
    for (const artifact of referenceArtifacts) {
      if (artifact.type !== 'SPREADSHEET') continue;
      const formulas = artifact.content
        .flat()
        .filter((cell) => typeof cell === 'string' && cell.startsWith('='));
      if (formulas.length === 0) {
        this._rejectDefinitionContent(
          `Spreadsheet definition task ${taskId} has no assessable formulas.`,
          { taskId }
        );
      }
    }
    return true;
  }

  /**
   * Reports expected unusable shared document content using the established safe definition failure.
   * @param {string} diagnostic - Internal content-rejection detail.
   * @param {Object} context - Safe task context for diagnostics.
   * @throws {ApiValidationError} Definition content is unusable.
   * @private
   */
  _rejectDefinitionContent(diagnostic, context) {
    ABLogger.getInstance().error('Assignment definition documents could not be parsed.', {
      ...context,
      detail: diagnostic,
    });
    throw new ApiValidationError(
      'The assignment documents could not be parsed. Check the reference and template documents, then try again.',
      {
        method: 'upsertAssignmentDefinition',
        code: 'DEFINITION_PARSE_FAILED',
      }
    );
  }
}

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentDefinitionValidation;
}
