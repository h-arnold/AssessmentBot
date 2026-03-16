// AssignmentDefinition.js
// Represents a reusable assignment/lesson definition persisted in JsonDbApp.

class AssignmentDefinition {
  /**
   * @param {Object} params - Assignment definition properties.
   * @param {string} params.primaryTitle - Canonical assignment title.
   * @param {string} params.primaryTopic - Canonical topic name.
   * @param {number|null} [params.yearGroup=null] - Intended year group; may be null until enriched.
   * @param {string[]} [params.alternateTitles=[]] - Known title variants.
   * @param {string[]} [params.alternateTopics=[]] - Known topic variants.
   * @param {string} params.documentType - Document type ('SLIDES' | 'SHEETS').
   * @param {string} params.referenceDocumentId - Reference document ID.
   * @param {string} params.templateDocumentId - Template document ID.
   * @param {string|null} [params.referenceLastModified=null] - ISO timestamp snapshot for reference document.
   * @param {string|null} [params.templateLastModified=null] - ISO timestamp snapshot for template document.
   * @param {number|null} [params.assignmentWeighting=null] - Optional weighting value.
   * @param {Object<string, TaskDefinition>|Object} [params.tasks={}] - Task definitions keyed by taskId.
   * @param {string|null} [params.createdAt=null] - ISO created timestamp; defaults to now when null.
   * @param {string|null} [params.updatedAt=null] - ISO updated timestamp; defaults to now when null.
   * @param {string|null} [params.definitionKey=null] - Composite key used for persistence.
   */
  constructor({
    primaryTitle,
    primaryTopic,
    yearGroup = null,
    alternateTitles = [],
    alternateTopics = [],
    documentType,
    referenceDocumentId,
    templateDocumentId,
    referenceLastModified = null,
    templateLastModified = null,
    assignmentWeighting = null,
    tasks = {},
    createdAt = null,
    updatedAt = null,
    definitionKey = null,
  } = {}) {
    this.primaryTitle = primaryTitle;
    this.primaryTopic = primaryTopic;
    this.yearGroup = yearGroup ?? null;
    this.alternateTitles = alternateTitles || [];
    this.alternateTopics = alternateTopics || [];
    this.documentType = documentType;
    this.referenceDocumentId = referenceDocumentId;
    this.templateDocumentId = templateDocumentId;
    this.referenceLastModified = referenceLastModified;
    this.templateLastModified = templateLastModified;
    this.assignmentWeighting = assignmentWeighting ?? null;
    this.definitionKey = definitionKey;
    this.createdAt = createdAt || new Date().toISOString();
    this.updatedAt = updatedAt || this.createdAt;

    // Validate based on whether tasks is null (partial) or not (full)
    this._validate(tasks);

    // Only hydrate tasks if not null (partial definitions have tasks: null)
    if (tasks !== null) {
      this._hydrateTasks(tasks);
    } else {
      this.tasks = null;
    }

    if (!this.definitionKey) {
      this.definitionKey = AssignmentDefinition.buildDefinitionKey({
        primaryTitle: this.primaryTitle,
        primaryTopic: this.primaryTopic,
        yearGroup: this.yearGroup,
      });
    }
  }

  /**
   * Validate required fields and types based on whether this is a partial or full definition.
   * Routes to appropriate validation method based on tasks parameter.
   * @param {Object|null} tasks - The tasks parameter passed to constructor
   * @private
   */
  _validate(tasks) {
    if (tasks === null) {
      this._validatePartial();
    } else {
      this._validateFull();
    }
  }

  /**
   * Validate common fields required for both partial and full definitions.
   * @private
   */
  _validateCommon() {
    const tracker = ProgressTracker.getInstance();

    if (!this.primaryTitle) {
      tracker.logAndThrowError('Missing required assignment property: primaryTitle', {
        devContext: { property: 'primaryTitle', value: this.primaryTitle },
      });
    }

    if (!this.primaryTopic) {
      tracker.logAndThrowError('Missing required assignment property: primaryTopic', {
        devContext: { property: 'primaryTopic', value: this.primaryTopic },
      });
    }

    if (this.yearGroup !== null && !Number.isInteger(this.yearGroup)) {
      tracker.logAndThrowError(
        'Invalid assignment property: yearGroup must be an integer or null',
        {
          devContext: { property: 'yearGroup', value: this.yearGroup },
        }
      );
    }
  }

  /**
   * Validate partial definition (tasks must be null).
   * Partial definitions require metadata + documentType but NOT doc IDs.
   * @private
   */
  _validatePartial() {
    this._validateCommon();

    const tracker = ProgressTracker.getInstance();

    // Partial definitions still need documentType for routing
    if (!this.documentType) {
      tracker.logAndThrowError('Missing required assignment property: documentType', {
        devContext: { property: 'documentType', value: this.documentType },
      });
    }
  }

  /**
   * Validate full definition (requires documentType, doc IDs, and non-null tasks).
   * @private
   */
  _validateFull() {
    this._validateCommon();

    const tracker = ProgressTracker.getInstance();

    if (!this.documentType) {
      tracker.logAndThrowError('Missing required assignment property: documentType', {
        devContext: { property: 'documentType', value: this.documentType },
      });
    }

    if (!this.referenceDocumentId) {
      tracker.logAndThrowError('Missing required assignment property: referenceDocumentId', {
        devContext: { property: 'referenceDocumentId', value: this.referenceDocumentId },
      });
    }

    if (!this.templateDocumentId) {
      tracker.logAndThrowError('Missing required assignment property: templateDocumentId', {
        devContext: { property: 'templateDocumentId', value: this.templateDocumentId },
      });
    }

    if (this.yearGroup !== null && !Number.isInteger(this.yearGroup)) {
      tracker.logAndThrowError(
        'Invalid assignment property: yearGroup must be an integer or null',
        {
          devContext: { property: 'yearGroup', value: this.yearGroup },
        }
      );
    }

    // Full definition cannot have null tasks
    if (this.tasks === null) {
      tracker.logAndThrowError('Full definition cannot have tasks: null', {
        devContext: { tasks: this.tasks },
      });
    }
  }

  _hydrateTasks(tasks) {
    // Skip hydration if tasks is null (partial definition)
    if (tasks === null) {
      this.tasks = null;
      return;
    }

    this.tasks = Object.fromEntries(
      Object.entries(tasks).map(([taskId, task]) => {
        if (task instanceof TaskDefinition) {
          return [taskId, task];
        }

        if (task?.taskTitle) {
          return [taskId, TaskDefinition.fromJSON(task)];
        }

        ProgressTracker.getInstance().logAndThrowError(
          'Invalid task payload: taskTitle is required to hydrate TaskDefinition.',
          { devContext: { taskId, task } }
        );
      })
    );
  }

  /**
   * Generates the canonical definition key `${primaryTitle}_${primaryTopic}_${yearGroup || 'null'}`.
   * @param {Object} params
   * @param {string} params.primaryTitle
   * @param {string} params.primaryTopic
   * @param {number|null|undefined} params.yearGroup
   * @return {string}
   */
  static buildDefinitionKey({ primaryTitle, primaryTopic, yearGroup }) {
    const yr = yearGroup === undefined || yearGroup === null ? 'null' : yearGroup;
    return `${primaryTitle}_${primaryTopic}_${yr}`;
  }

  /**
   * Update reference/template modified timestamps and touch updatedAt.
   * @param {Object} params
   * @param {string|null} [params.referenceLastModified]
   * @param {string|null} [params.templateLastModified]
   */
  updateModifiedTimestamps({ referenceLastModified = null, templateLastModified = null } = {}) {
    if (referenceLastModified !== null) this.referenceLastModified = referenceLastModified;
    if (templateLastModified !== null) this.templateLastModified = templateLastModified;
    this.touchUpdated();
  }

  touchUpdated() {
    this.updatedAt = new Date().toISOString();
    return this.updatedAt;
  }

  toJSON() {
    return {
      primaryTitle: this.primaryTitle,
      primaryTopic: this.primaryTopic,
      yearGroup: this.yearGroup,
      alternateTitles: this.alternateTitles,
      alternateTopics: this.alternateTopics,
      documentType: this.documentType,
      referenceDocumentId: this.referenceDocumentId,
      templateDocumentId: this.templateDocumentId,
      referenceLastModified: this.referenceLastModified,
      templateLastModified: this.templateLastModified,
      assignmentWeighting: this.assignmentWeighting,
      definitionKey: this.definitionKey,
      tasks: Object.fromEntries(
        Object.entries(this.tasks).map(([taskId, task]) => [
          taskId,
          task.toJSON ? task.toJSON() : task,
        ])
      ),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toPartialJSON() {
    return {
      primaryTitle: this.primaryTitle,
      primaryTopic: this.primaryTopic,
      yearGroup: this.yearGroup,
      alternateTitles: this.alternateTitles,
      alternateTopics: this.alternateTopics,
      documentType: this.documentType,
      referenceDocumentId: this.referenceDocumentId,
      templateDocumentId: this.templateDocumentId,
      assignmentWeighting: this.assignmentWeighting,
      definitionKey: this.definitionKey,
      tasks: null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(json) {
    if (!json) {
      throw new Error('Invalid data for AssignmentDefinition.fromJSON');
    }
    return new AssignmentDefinition({
      primaryTitle: json.primaryTitle,
      primaryTopic: json.primaryTopic,
      yearGroup: json.yearGroup ?? null,
      alternateTitles: json.alternateTitles ?? [],
      alternateTopics: json.alternateTopics ?? [],
      documentType: json.documentType ?? null,
      referenceDocumentId: json.referenceDocumentId ?? null,
      templateDocumentId: json.templateDocumentId ?? null,
      referenceLastModified: json.referenceLastModified ?? null,
      templateLastModified: json.templateLastModified ?? null,
      assignmentWeighting: json.assignmentWeighting ?? null,
      tasks: 'tasks' in json ? json.tasks : {},
      createdAt: json.createdAt ?? null,
      updatedAt: json.updatedAt ?? null,
      definitionKey: json.definitionKey ?? null,
    });
  }
}

if (typeof module !== 'undefined') {
  module.exports = { AssignmentDefinition };
}
