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
    this.tasks = {};
    this.definitionKey = definitionKey;
    this.createdAt = createdAt || new Date().toISOString();
    this.updatedAt = updatedAt || this.createdAt;

    this._validate();
    this._hydrateTasks(tasks);

    if (!this.definitionKey) {
      this.definitionKey = AssignmentDefinition.buildDefinitionKey({
        primaryTitle: this.primaryTitle,
        primaryTopic: this.primaryTopic,
        yearGroup: this.yearGroup,
      });
    }
  }

  _validate() {
    if (!this.primaryTitle) {
      throw new Error('AssignmentDefinition requires primaryTitle');
    }
    if (!this.primaryTopic) {
      throw new Error('AssignmentDefinition requires primaryTopic');
    }
    if (!this.documentType) {
      throw new Error('AssignmentDefinition requires documentType');
    }
    if (!this.referenceDocumentId) {
      throw new Error('AssignmentDefinition requires referenceDocumentId');
    }
    if (!this.templateDocumentId) {
      throw new Error('AssignmentDefinition requires templateDocumentId');
    }
    if (this.yearGroup !== null && !Number.isInteger(this.yearGroup)) {
      throw new TypeError('yearGroup must be an integer or null');
    }
  }

  _hydrateTasks(tasks) {
    if (!tasks || typeof tasks !== 'object') {
      this.tasks = {};
      return;
    }
    this.tasks = Object.fromEntries(
      Object.entries(tasks).map(([taskId, task]) => {
        if (task instanceof TaskDefinition) return [taskId, task];
        try {
          return [taskId, TaskDefinition.fromJSON(task)];
        } catch (error) {
          ABLogger.getInstance().warn('Failed to hydrate TaskDefinition from JSON', {
            taskId,
            err: error,
          });
          return [taskId, task];
        }
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
    const partialTasks = Object.fromEntries(
      Object.entries(this.tasks).map(([taskId, task]) => {
        if (task && typeof task.toPartialJSON === 'function') return [taskId, task.toPartialJSON()];
        if (task && typeof task.toJSON === 'function')
          return [taskId, AssignmentDefinition._redactTask(task.toJSON())];
        return [taskId, AssignmentDefinition._redactTask(task)];
      })
    );

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
      tasks: partialTasks,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static _redactArtifact(artifact) {
    if (!artifact || typeof artifact !== 'object') return artifact;
    return { ...artifact, content: null, contentHash: null };
  }

  static _redactTask(task) {
    if (!task || typeof task !== 'object') return {};
    const artifacts = task.artifacts || {};
    return {
      ...task,
      artifacts: {
        reference: (artifacts.reference || []).map(AssignmentDefinition._redactArtifact),
        template: (artifacts.template || []).map(AssignmentDefinition._redactArtifact),
        submission: (artifacts.submission || []).map(AssignmentDefinition._redactArtifact),
      },
    };
  }

  static fromJSON(json) {
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid data for AssignmentDefinition.fromJSON');
    }
    const inst = new AssignmentDefinition({
      primaryTitle: json.primaryTitle,
      primaryTopic: json.primaryTopic,
      yearGroup: json.yearGroup ?? null,
      alternateTitles: json.alternateTitles || [],
      alternateTopics: json.alternateTopics || [],
      documentType: json.documentType,
      referenceDocumentId: json.referenceDocumentId,
      templateDocumentId: json.templateDocumentId,
      referenceLastModified: json.referenceLastModified ?? null,
      templateLastModified: json.templateLastModified ?? null,
      assignmentWeighting: json.assignmentWeighting ?? null,
      tasks: json.tasks || {},
      createdAt: json.createdAt || null,
      updatedAt: json.updatedAt || null,
      definitionKey: json.definitionKey || null,
    });
    return inst;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { AssignmentDefinition };
}
