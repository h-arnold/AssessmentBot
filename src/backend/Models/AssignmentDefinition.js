// AssignmentDefinition.js
// Represents a reusable assignment/lesson definition persisted in JsonDbApp.

const MAX_ASSIGNMENT_WEIGHTING = 10;

/**
 * Represents a reusable assignment definition with reference and template documents.
 * Can be instantiated in "partial" form (with a tasks array of lightweight summaries) or "full" form (with keyed task objects).
 */
class AssignmentDefinition {
  /**
   * Constructs an AssignmentDefinition instance.
   * @param {Object} params - Assignment definition properties.
   * @param {string} params.primaryTitle - Canonical assignment title.
   * @param {string} params.primaryTopic - Canonical topic name.
   * @param {string|null} [params.primaryTopicKey=null] - Authoritative keyed topic reference.
   * @param {string} params.yearGroupKey - Authoritative year-group key. Must be a string.
   * @param {string|null} [params.yearGroupLabel=null] - Resolved year-group display label when available.
   * @param {string[]} [params.alternateTitles=[]] - Known title variants.
   * @param {string[]} [params.alternateTopics=[]] - Known topic variants.
   * @param {string} params.documentType - Document type ('SLIDES' | 'SHEETS').
   * @param {string} params.referenceDocumentId - Reference document ID.
   * @param {string} params.templateDocumentId - Template document ID.
   * @param {string|null} [params.referenceLastModified=null] - ISO timestamp snapshot for reference document.
   * @param {string|null} [params.templateLastModified=null] - ISO timestamp snapshot for template document.
   * @param {number} [params.assignmentWeighting=1] - Optional weighting value. Defaults to 1. Must be in range 0-10.
   * @param {Object<string, TaskDefinition>|Array} [params.tasks] - Task definitions keyed by taskId (full definition,
   *   rehydrated via {@link _hydrateTasks}) or an array of lightweight `{taskId, taskWeighting, taskTitle}` summaries
   *   (partial wire format, stored verbatim). Must be provided — null/undefined is a hard error.
   *   The constructor stores arrays verbatim (no rehydration to `TaskDefinition` instances).
   *   See {@link AssignmentDefinition#toPartialJSON} for the wire format.
   * @param {string|null} [params.createdAt=null] - ISO created timestamp; defaults to now when null.
   * @param {string|null} [params.updatedAt=null] - ISO updated timestamp; defaults to now when null.
   * @param {string|null} [params.definitionKey=null] - Stable definition key used for persistence.
   * @throws {TypeError} If params contain deprecated yearGroup property.
   * @throws {TypeError} If yearGroupKey is not a string.
   * @throws {RangeError} If assignmentWeighting is outside range 0-10.
   * @remarks This constructor enforces the refactored year-group handling per SPEC.md v1.9.0 Option B:
   * - The deprecated numeric `yearGroup` field is completely removed; its presence throws a TypeError.
   * - `yearGroupKey` (string) is now the canonical year-group reference and must be provided (controller guarantees non-null).
   * - `yearGroupLabel` is a display-only field resolved by the controller from reference data.
   * - `assignmentWeighting` defaults to 1 when null/undefined/missing and enforces range 0-10.
   * - Validation ownership: model owns type validation and range enforcement; controller owns null resolution.
   */
  constructor({
    primaryTitle,
    primaryTopic,
    primaryTopicKey = null,
    yearGroupKey,
    yearGroupLabel = null,
    alternateTitles = [],
    alternateTopics = [],
    documentType,
    referenceDocumentId,
    templateDocumentId,
    referenceLastModified = null,
    templateLastModified = null,
    assignmentWeighting,
    tasks,
    createdAt = null,
    updatedAt = null,
    definitionKey = null,
  } = {}) {
    // Fail-fast: reject deprecated yearGroup property
    if (arguments[0] && 'yearGroup' in arguments[0]) {
      throw new TypeError('yearGroup property is deprecated and no longer supported');
    }

    this.primaryTitle = primaryTitle;
    this.primaryTopic = primaryTopic;
    this.primaryTopicKey = primaryTopicKey ?? null;

    // Validate yearGroupKey type (controller guarantees non-null per SPEC.md)
    if (typeof yearGroupKey !== 'string') {
      throw new TypeError('yearGroupKey must be a string');
    }
    this.yearGroupKey = yearGroupKey;

    this.yearGroupLabel = yearGroupLabel ?? null;
    this.alternateTitles = alternateTitles || [];
    this.alternateTopics = alternateTopics || [];
    this.documentType = documentType;
    this.referenceDocumentId = referenceDocumentId;
    this.templateDocumentId = templateDocumentId;
    this.referenceLastModified = referenceLastModified;
    this.templateLastModified = templateLastModified;

    // Default assignmentWeighting to 1, enforce range 0-MAX, ensure stored value is always a number
    if (assignmentWeighting === null || assignmentWeighting === undefined) {
      this.assignmentWeighting = 1;
    } else {
      const number_ = Number(assignmentWeighting);
      if (Number.isNaN(number_)) {
        throw new TypeError('assignmentWeighting must be a number');
      }
      if (number_ < 0 || number_ > MAX_ASSIGNMENT_WEIGHTING) {
        throw new RangeError(
          `assignmentWeighting must be between 0 and ${MAX_ASSIGNMENT_WEIGHTING} inclusive`
        );
      }
      this.assignmentWeighting = number_;
    }

    this.definitionKey = definitionKey;
    this.createdAt = createdAt || new Date().toISOString();
    this.updatedAt = updatedAt || this.createdAt;

    // Fail-fast: tasks must be provided (array for partial, object for full)
    if (!tasks) {
      ProgressTracker.getInstance().logAndThrowError(
        'AssignmentDefinition requires a tasks value (array for partials, object for full definitions); received null/undefined.',
        { devContext: { tasks } }
      );
    }

    // Validate based on whether tasks is an array (partial) or object (full)
    this._validate(tasks);

    // Array tasks are lightweight summaries stored verbatim (partial wire format)
    if (Array.isArray(tasks)) {
      this.tasks = tasks;
    } else {
      // Object tasks are keyed by taskId, rehydrated to TaskDefinition instances
      this._hydrateTasks(tasks);
    }

    if (!this.definitionKey) {
      this.definitionKey = AssignmentDefinition.buildDefinitionKey({
        primaryTitle: this.primaryTitle,
        primaryTopic: this.primaryTopic,
        yearGroupKey: this.yearGroupKey,
      });
    }
  }

  /**
   * Validate required fields and types based on whether this is a partial or full definition.
   * Routes to appropriate validation method based on tasks parameter.
   * With the fail-fast guard in the constructor, `tasks` is guaranteed to be present
   * (not null/undefined). Arrays are treated as partial-definition markers.
   * @param {Object|Array} tasks - The tasks parameter passed to constructor (never null/undefined)
   * @private
   */
  _validate(tasks) {
    if (Array.isArray(tasks)) {
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
  }

  /**
   * Validate partial definition (tasks is an array of lightweight summaries).
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
   * Validate full definition (requires documentType, doc IDs, and keyed task objects).
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
  }

  /**
   * Hydrates task objects from plain JSON or existing TaskDefinition instances.
   * Converts raw task payloads to TaskDefinition instances.
   * @param {Object} tasks - A map of taskId to task objects
   * @private
   */
  _hydrateTasks(tasks) {
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
   * Generates the metadata-derived definition key.
   * Format: `${primaryTitle}_${primaryTopic}_${yearGroupKey}`.
   * @param {Object} params - Parameters for key generation
   * @param {string} params.primaryTitle - The primary assignment title
   * @param {string} params.primaryTopic - The primary topic name
   * @param {string} params.yearGroupKey - The year group key
   * @returns {string} Metadata-derived definition key
   * @remarks Parameter renamed from `yearGroup` to `yearGroupKey` per SPEC.md v1.9.0 Option B. This method
   * does NOT validate its parameters; validation is the caller's responsibility per the controller-resolution
   * pattern. Old definition keys using numeric yearGroup (e.g., `Math_Algebra_10`) will not be found by
   * new lookups using string yearGroupKey (e.g., `Math_Algebra_year-group-10`).
   */
  static buildDefinitionKey({ primaryTitle, primaryTopic, yearGroupKey }) {
    return `${primaryTitle}_${primaryTopic}_${yearGroupKey}`;
  }

  /**
   * Updates reference and template document modification timestamps, and touches updatedAt.
   * @param {Object} params - Timestamp parameters
   * @param {string|null} [params.referenceLastModified] - ISO timestamp for reference document
   * @param {string|null} [params.templateLastModified] - ISO timestamp for template document
   */
  updateModifiedTimestamps({ referenceLastModified = null, templateLastModified = null } = {}) {
    if (referenceLastModified !== null) this.referenceLastModified = referenceLastModified;
    if (templateLastModified !== null) this.templateLastModified = templateLastModified;
    this.touchUpdated();
  }

  /**
   * Updates the updatedAt timestamp to the current time.
   * @returns {string} The new ISO timestamp
   */
  touchUpdated() {
    this.updatedAt = new Date().toISOString();
    return this.updatedAt;
  }

  /**
   * Serialises this assignment definition to a JSON object.
   * @returns {Object} A plain object representation of the full assignment with all tasks
   */
  toJSON() {
    const tasks = Object.fromEntries(
      Object.entries(this.tasks).map(([taskId, task]) => [
        taskId,
        task.toJSON ? task.toJSON() : task,
      ])
    );
    return {
      primaryTitle: this.primaryTitle,
      primaryTopic: this.primaryTopic,
      primaryTopicKey: this.primaryTopicKey,
      yearGroupKey: this.yearGroupKey,
      yearGroupLabel: this.yearGroupLabel,
      alternateTitles: this.alternateTitles,
      alternateTopics: this.alternateTopics,
      documentType: this.documentType,
      referenceDocumentId: this.referenceDocumentId,
      templateDocumentId: this.templateDocumentId,
      referenceLastModified: this.referenceLastModified,
      templateLastModified: this.templateLastModified,
      assignmentWeighting: this.assignmentWeighting,
      definitionKey: this.definitionKey,
      tasks,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Serialises this assignment definition to the lightweight registry payload.
   * Carries `tasks` as an array of lightweight `{ id, taskWeighting }` summaries
   * (empty array when no tasks), and omits document-modified timestamp fields that
   * are only stored on full definitions.
   * @returns {Object} A plain object representation for the `assignment_definitions` registry
   * @remarks The `tasks` field now carries stable task IDs and their weightings instead of
   *          emitting `null`.  This avoids extra `getAssignmentDefinition` API calls when the
   *          analyser needs per-task weighting data.  Full task data (titles, page IDs,
   *          artefacts, etc.) is only available via {@link toJSON()} or a dedicated
   *          `getAssignmentDefinition` call.  See SPEC § "Backend changes required" §1.
   */
  toPartialJSON() {
    return {
      primaryTitle: this.primaryTitle,
      primaryTopic: this.primaryTopic,
      primaryTopicKey: this.primaryTopicKey,
      yearGroupKey: this.yearGroupKey,
      yearGroupLabel: this.yearGroupLabel,
      alternateTitles: this.alternateTitles,
      alternateTopics: this.alternateTopics,
      documentType: this.documentType,
      referenceDocumentId: this.referenceDocumentId,
      templateDocumentId: this.templateDocumentId,
      assignmentWeighting: this.assignmentWeighting,
      definitionKey: this.definitionKey,
      tasks: this._computePartialTasks(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Computes the tasks array for partial JSON serialisation.
   * Handles three shapes: null/undefined → [], array (partial wire format) → mapped,
   * keyed object (full definition with TaskDefinition instances) → mapped.
   * @returns {Array<{taskId: string, taskWeighting: number, taskTitle: string}>} The tasks array for partial JSON serialisation
   * @private
   */
  _computePartialTasks() {
    if (!this.tasks) {
      return [];
    }
    if (Array.isArray(this.tasks)) {
      return this.tasks.map((task) => ({
        taskId: task.taskId,
        taskWeighting: task.taskWeighting,
        taskTitle: task.taskTitle,
      }));
    }
    return Object.values(this.tasks).map((task) => ({
      taskId: task.taskId ?? task.id,
      taskWeighting: task.taskWeighting,
      taskTitle: task.taskTitle,
    }));
  }

  /**
   * Deserialises a JSON object to an AssignmentDefinition instance.
   * @param {Object} json - The serialised assignment definition object
   * @returns {AssignmentDefinition} A new AssignmentDefinition instance
   * @throws {Error} If json is falsy
   * @throws {TypeError} If json contains deprecated yearGroup field
   * @throws {TypeError} If json.yearGroupKey is not a string
   * @remarks This method enforces fail-fast validation per SPEC.md v1.9.0: throws TypeError if the input JSON
   * contains a `yearGroup` field (detecting missed migration entries). The `yearGroupKey` field must be a string
   * (type validation only; null/undefined is controller responsibility). Stored definitions with `yearGroup`
   * fields will fail to load and must be re-created through the new flow.
   */
  static fromJSON(json) {
    if (!json) {
      throw new Error('Invalid data for AssignmentDefinition.fromJSON');
    }

    // Fail-fast: reject deprecated yearGroup field in JSON
    if ('yearGroup' in json) {
      throw new TypeError('yearGroup field is deprecated and no longer supported');
    }

    // Validate yearGroupKey type in JSON
    if (json.yearGroupKey !== undefined && typeof json.yearGroupKey !== 'string') {
      throw new TypeError('yearGroupKey must be a string');
    }

    // Tasks can be a keyed object (full definition, rehydrated to TaskDefinition instances)
    // or an array of lightweight summaries (partial wire format, stored verbatim).
    // Pass through whatever shape is present; the constructor handles each case.
    // Backward compatibility: legacy persisted partials stored tasks: null.
    // Coerce to the wire-format array so historical records still load.
    const tasksValue = 'tasks' in json ? (json.tasks ?? []) : [];

    return new AssignmentDefinition({
      primaryTitle: json.primaryTitle,
      primaryTopic: json.primaryTopic,
      primaryTopicKey: json.primaryTopicKey ?? null,
      yearGroupKey: json.yearGroupKey,
      yearGroupLabel: json.yearGroupLabel ?? null,
      alternateTitles: json.alternateTitles ?? [],
      alternateTopics: json.alternateTopics ?? [],
      documentType: json.documentType ?? null,
      referenceDocumentId: json.referenceDocumentId ?? null,
      templateDocumentId: json.templateDocumentId ?? null,
      referenceLastModified: json.referenceLastModified ?? null,
      templateLastModified: json.templateLastModified ?? null,
      assignmentWeighting: json.assignmentWeighting,
      tasks: tasksValue,
      createdAt: json.createdAt ?? null,
      updatedAt: json.updatedAt ?? null,
      definitionKey: json.definitionKey ?? null,
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AssignmentDefinition };
}
