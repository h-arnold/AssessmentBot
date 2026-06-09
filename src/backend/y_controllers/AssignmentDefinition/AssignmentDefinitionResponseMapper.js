/**
 * AssignmentDefinitionResponseMapper
 *
 * Maps full assignment definitions to canonical response shapes
 * for frontend transport.
 */
class AssignmentDefinitionResponseMapper {
  /**
   * Creates the instance with injected dependencies.
   * @param {Object} deps - Dependency injection.
   * @param {Object} deps.referenceData - AssignmentDefinitionReferenceData instance.
   * @param {Object} deps.validation - AssignmentDefinitionValidation instance.
   */
  constructor({ referenceData, validation } = {}) {
    this.referenceData = referenceData;
    this.validation = validation;
  }

  /**
   * Maps a full assignment definition to the canonical editable transport shape.
   *
   * @param {AssignmentDefinition|Object} definition - Definition source.
   * @returns {Object} Canonical full-definition payload.
   */
  getFull(definition) {
    return this._getFullAssignmentDefinition(definition);
  }

  /**
   * Maps a full assignment definition to the canonical editable transport shape.
   *
   * @param {AssignmentDefinition|Object} definition - Definition source.
   * @returns {Object} Canonical full-definition payload.
   * @private
   */
  _getFullAssignmentDefinition(definition) {
    /* global AssignmentDefinition, ABLogger */
    const source = definition instanceof AssignmentDefinition ? definition.toJSON() : definition;

    if (!this.validation.isNonEmptyString(source.yearGroupKey)) {
      throw new Error(
        `Stored definition ${source.definitionKey} is missing required yearGroupKey for canonical reads.`
      );
    }

    const canonicalYearGroupKey = source.yearGroupKey.trim();
    const resolvedYearGroup =
      this.referenceData.listYearGroups().find((record) => record?.key === canonicalYearGroupKey) ||
      null;
    if (
      !resolvedYearGroup ||
      typeof resolvedYearGroup.name !== 'string' ||
      resolvedYearGroup.name.trim().length === 0
    ) {
      throw new Error(
        `Stored definition ${source.definitionKey} has unresolved yearGroupKey: ${canonicalYearGroupKey}.`
      );
    }
    const canonicalYearGroupLabel = resolvedYearGroup.name.trim();

    const canonicalTasks = Object.entries(source.tasks || {})
      .filter(([, task]) => task?.taskWeighting !== null && task?.taskWeighting !== undefined)
      .map(([taskId, task]) => ({
        taskId,
        taskTitle: task.taskTitle,
        taskWeighting: task.taskWeighting,
      }));

    const result = {
      definitionKey: source.definitionKey,
      primaryTitle: source.primaryTitle,
      primaryTopicKey: source.primaryTopicKey,
      primaryTopic: source.primaryTopic,
      yearGroupKey: canonicalYearGroupKey,
      yearGroupLabel: canonicalYearGroupLabel,
      alternateTitles: source.alternateTitles || [],
      alternateTopics: source.alternateTopics || [],
      documentType: source.documentType,
      referenceDocumentId: source.referenceDocumentId,
      templateDocumentId: source.templateDocumentId,
      assignmentWeighting: source.assignmentWeighting,
      tasks: canonicalTasks,
      createdAt: source.createdAt || null,
      updatedAt: source.updatedAt || null,
    };

    // Validate required fields are present and non-undefined
    // Using direct property access to avoid security lint warnings
    const requiredFieldChecks = [
      { field: 'definitionKey', value: result.definitionKey },
      { field: 'primaryTitle', value: result.primaryTitle },
      { field: 'primaryTopicKey', value: result.primaryTopicKey },
      { field: 'primaryTopic', value: result.primaryTopic },
      { field: 'yearGroupKey', value: result.yearGroupKey },
      { field: 'yearGroupLabel', value: result.yearGroupLabel },
      { field: 'documentType', value: result.documentType },
      { field: 'referenceDocumentId', value: result.referenceDocumentId },
      { field: 'templateDocumentId', value: result.templateDocumentId },
      { field: 'tasks', value: result.tasks },
    ];
    for (const check of requiredFieldChecks) {
      if (check.value === undefined) {
        throw new Error(`Canonical response missing required field: ${check.field}`);
      }
    }

    return result;
  }
}

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentDefinitionResponseMapper;
}
