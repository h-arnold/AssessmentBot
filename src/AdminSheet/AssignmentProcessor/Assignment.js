/**
 * Assignment Class
 *
 * Base class representing an assignment within a course, managing tasks and student submissions.
 */
class Assignment {
  /**
   * Constructs an Assignment instance.
   * @param {string} courseId - The ID of the course.
   * @param {string} assignmentId - The ID of the assignment.
   * @param {number} assignmentWeighting - to be implemented later. Used to inform the weight given to the assignment when calculating the average overall.
   * @param {Date} dueDate - to be implemented later
   * @param {object} assignmentMetadata - to be implemented later
   * @param {Date} lastUpdated - the last time the assignment was updated (probably by running an assessments)
   */
  constructor(courseId, assignmentId, assignmentDefinition) {
    this.courseId = courseId;
    this.assignmentId = assignmentId;
    this.assignmentName = this.fetchAssignmentName(courseId, assignmentId);
    this.assignmentMetadata = null; //will be implemented later.
    this.dueDate = null; //to be implemented later with the homework tracker.
    // Timestamp for when this assignment was last updated. Use Date or null.
    this.lastUpdated = null;
    // Embedded definition copy (source of truth for tasks, doc IDs, weighting, documentType)
    this.assignmentDefinition = assignmentDefinition;
    Assignment._applyLegacyAliases(this);
    // Legacy alias fields kept for compatibility with existing code and tests

    // New model: submissions array of StudentSubmission
    this.submissions = []; // Array<StudentSubmission>
    // Legacy studentTasks alias removed – callers must use this.submissions.
    this.progressTracker = ProgressTracker.getInstance();
    // Controllers may temporarily attach `assignment.students` while an assessment run is active
    // to keep the hydrated roster handy. That property is transient and must never be persisted
    // (see docs/developer/DATA_SHAPES.md and rehydration.md).
    this._hydrationLevel = 'full';
  }

  static _applyLegacyAliases(target) {
    Object.defineProperties(target, {
      documentType: {
        get() {
          return target.assignmentDefinition?.documentType ?? target._documentTypeAlias ?? null;
        },
        set(value) {
          if (target.assignmentDefinition) target.assignmentDefinition.documentType = value;
          target._documentTypeAlias = value;
        },
        configurable: true,
      },
      referenceDocumentId: {
        get() {
          return (
            target.assignmentDefinition?.referenceDocumentId ??
            target._referenceDocumentIdAlias ??
            null
          );
        },
        set(value) {
          if (target.assignmentDefinition) target.assignmentDefinition.referenceDocumentId = value;
          target._referenceDocumentIdAlias = value;
        },
        configurable: true,
      },
      templateDocumentId: {
        get() {
          return (
            target.assignmentDefinition?.templateDocumentId ??
            target._templateDocumentIdAlias ??
            null
          );
        },
        set(value) {
          if (target.assignmentDefinition) target.assignmentDefinition.templateDocumentId = value;
          target._templateDocumentIdAlias = value;
        },
        configurable: true,
      },
      tasks: {
        get() {
          return target.assignmentDefinition?.tasks ?? target._tasksAlias ?? null;
        },
        set(value) {
          if (target.assignmentDefinition) target.assignmentDefinition.tasks = value;
          target._tasksAlias = value;
        },
        configurable: true,
      },
    });
  }

  /**
   * Serialize this Assignment to a plain JSON-friendly object.
   * - Dates are converted to ISO strings.
   * - If TaskDefinition or StudentSubmission provide toJSON, those are used.
   * - progressTracker is intentionally not serialized (singleton/session-specific).
   * @return {object}
   */
  toJSON() {
    const definitionJson = this.assignmentDefinition?.toJSON
      ? this.assignmentDefinition.toJSON()
      : this.assignmentDefinition;

    const submissions = (this.submissions || []).map((sub) => {
      if (sub && typeof sub.toJSON === 'function') return sub.toJSON();
      // Fallback serialization for StudentSubmission-like objects
      const out = {};
      if (sub && typeof sub === 'object') {
        out.studentId = sub.studentId || sub.userId || null;
        if ('documentId' in sub) out.documentId = sub.documentId;
        if ('score' in sub) out.score = sub.score;
        if ('feedback' in sub) out.feedback = sub.feedback;
        if (sub.updatedAt instanceof Date && !Number.isNaN(sub.updatedAt.getTime()))
          out.updatedAt = sub.updatedAt.toISOString();
        else if (sub.updatedAt) out.updatedAt = sub.updatedAt;
        // copy any other enumerable properties (non-enumerable like methods are ignored)
        Object.keys(sub).forEach((k) => {
          if (!Object.hasOwn(out, k)) out[k] = sub[k];
        });
      }
      return out;
    });

    return {
      courseId: this.courseId,
      assignmentId: this.assignmentId,
      assignmentName: this.assignmentName,
      assignmentMetadata: this.assignmentMetadata,
      dueDate: this.dueDate ? this.dueDate.toISOString() : null,
      lastUpdated: this.lastUpdated ? this.lastUpdated.toISOString() : null,
      ...this._extractFullDefinitionFields(definitionJson),
      submissions,
      assignmentDefinition: definitionJson || this.assignmentDefinition,
    };
  }

  /**
   * Helper to extract full definition fields from assignmentDefinition.
   * Used by toJSON to include complete definition data.
   * @param {object} definitionJson - The serialized definition object
   * @return {object} Full definition fields
   * @private
   */
  _extractFullDefinitionFields(definitionJson) {
    return {
      documentType: definitionJson?.documentType ?? null,
      referenceDocumentId: definitionJson?.referenceDocumentId ?? null,
      templateDocumentId: definitionJson?.templateDocumentId ?? null,
      tasks: definitionJson?.tasks ?? null,
    };
  }

  /**
   * Helper to extract minimal fields for partial definitions.
   * Only includes documentType (for routing); omits doc IDs and tasks.
   * @param {object} definitionJson - The serialized definition object
   * @return {object} Minimal root fields
   * @private
   */
  _extractPartialRootFields(definitionJson) {
    return {
      documentType: definitionJson?.documentType ?? null,
    };
  }

  /**
   * Produce a lightweight JSON payload with heavy artifact fields redacted.
   * @return {object}
   */
  toPartialJSON() {
    const definitionJson = this.assignmentDefinition?.toPartialJSON
      ? this.assignmentDefinition.toPartialJSON()
      : this.assignmentDefinition;

    const partialSubmissions = (this.submissions || []).map((submission) =>
      submission.toPartialJSON()
    );

    return {
      courseId: this.courseId,
      assignmentId: this.assignmentId,
      assignmentName: this.assignmentName,
      assignmentMetadata: this.assignmentMetadata,
      dueDate: this.dueDate ? this.dueDate.toISOString() : null,
      lastUpdated: this.lastUpdated ? this.lastUpdated.toISOString() : null,
      ...this._extractPartialRootFields(definitionJson),
      submissions: partialSubmissions,
      assignmentDefinition: definitionJson,
    };
  }

  /**
   * Factory method to create the correct Assignment subclass based on documentType.
   * @param {AssignmentDefinition|Object} assignmentDefinition - Embedded definition containing docType and task metadata
   * @param {string} courseId - The ID of the course
   * @param {string} assignmentId - The ID of the assignment
   * @return {Assignment} Instance of appropriate subclass
   * @throws {Error} If documentType is invalid or unknown
   */
  static create(assignmentDefinition, courseId, assignmentId) {
    if (!assignmentDefinition?.documentType) {
      throw new TypeError(
        'assignmentDefinition with documentType is required to create Assignment.'
      );
    }

    const type = assignmentDefinition.documentType.toUpperCase();

    if (type === 'SLIDES') {
      return new SlidesAssignment(courseId, assignmentId, assignmentDefinition);
    }

    if (type === 'SHEETS') {
      return new SheetsAssignment(courseId, assignmentId, assignmentDefinition);
    }

    throw new Error(
      `Unknown documentType: ${assignmentDefinition.documentType}. Valid types are 'SLIDES' or 'SHEETS'. See docs/developer/DATA_SHAPES.md for details.`
    );
  }

  /**
   * Internal helper to restore base Assignment fields from JSON data.
   * Used by both base Assignment and subclass fromJSON methods.
   * @param {object} data - JSON data object
   * @return {Assignment} Assignment instance with base fields populated
   */
  static _baseFromJSON(data) {
    if (!data || typeof data !== 'object')
      throw new Error('Invalid data supplied to Assignment._baseFromJSON');

    if (!data.courseId || !data.assignmentId) {
      throw new Error('courseId and assignmentId are required fields in Assignment data');
    }

    const inst = Object.create(Assignment.prototype);
    inst.courseId = data.courseId;
    inst.assignmentId = data.assignmentId;
    inst.assignmentName = data.assignmentName || `Assignment ${data.assignmentId}`;
    inst.assignmentMetadata = data.assignmentMetadata ?? null;
    inst.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    inst.lastUpdated = data.lastUpdated ? new Date(data.lastUpdated) : null;
    inst.assignmentDefinition = data.assignmentDefinition
      ? AssignmentDefinition.fromJSON(data.assignmentDefinition)
      : null;
    Assignment._applyLegacyAliases(inst);
    // Set legacy alias fields for backward compatibility with old serialized data
    if (data.documentType) inst.documentType = data.documentType;
    if (data.referenceDocumentId) inst.referenceDocumentId = data.referenceDocumentId;
    if (data.templateDocumentId) inst.templateDocumentId = data.templateDocumentId;
    if (data.tasks) inst.tasks = data.tasks;
    inst.submissions = [];
    // Do not set transient hydration marker here — remain absent/undefined so
    // that deserialized objects don't claim a persisted hydration level.

    if (Array.isArray(data.submissions)) {
      data.submissions.forEach((subObj) => Assignment._rehydrateSubmission(inst, subObj));
    }

    // restore progress tracker singleton if available
    inst.progressTracker = ProgressTracker.getInstance();

    // Copy any additional fields that aren't already handled (e.g., referenceDocumentId, templateDocumentId for graceful degradation)
    const knownFields = new Set([
      'courseId',
      'assignmentId',
      'assignmentName',
      'assignmentMetadata',
      'dueDate',
      'lastUpdated',
      'assignmentDefinition',
      'submissions',
      'students', // Transient, don't restore
      'progressTracker', // Transient, don't restore
      '_hydrationLevel', // Transient, don't restore
    ]);
    Object.keys(data).forEach((key) => {
      if (!knownFields.has(key)) {
        inst[key] = data[key];
      }
    });

    // Do not populate `inst.students` here; any roster data should be sourced from ABClass at runtime
    // and treated as ephemeral to avoid duplicate persistence.

    return inst;
  }

  static _rehydrateSubmission(inst, subObj) {
    const identifier = subObj && (subObj.studentId || subObj.userId);

    try {
      if (
        typeof StudentSubmission !== 'undefined' &&
        typeof StudentSubmission.fromJSON === 'function'
      ) {
        const submission = StudentSubmission.fromJSON(subObj);
        inst.submissions.push(submission);
        return;
      }
    } catch (error) {
      ABLogger.getInstance().warn(
        `StudentSubmission.fromJSON threw for studentId=${identifier}:`,
        error
      );
    }

    try {
      const submission = new StudentSubmission(
        identifier || null,
        inst.assignmentId,
        subObj.documentId || null,
        subObj.studentName || subObj.name || null
      );
      Object.keys(subObj || {}).forEach((key) => {
        if (key === 'updatedAt' && subObj.updatedAt) {
          submission.updatedAt =
            subObj.updatedAt instanceof Date ? subObj.updatedAt : new Date(subObj.updatedAt);
          return;
        }
        submission[key] = subObj[key];
      });
      inst.submissions.push(submission);
    } catch (error_) {
      ABLogger.getInstance().warn(
        `StudentSubmission reconstruction failed for studentId=${identifier}:`,
        error_
      );
      const raw = { ...subObj };
      if (raw.updatedAt) {
        if (raw.updatedAt instanceof Date) raw.updatedAt = raw.updatedAt.toISOString();
        else if (typeof raw.updatedAt === 'string') {
          const parsed = new Date(raw.updatedAt);
          if (!Number.isNaN(parsed.getTime())) raw.updatedAt = parsed.toISOString();
        }
      }
      inst.submissions.push(raw);
    }
  }

  /**
   * Polymorphic deserialization routing based on documentType field.
   * Routes to appropriate subclass fromJSON or creates base Assignment for legacy data.
   * @param {object} data - JSON data object
   * @return {Assignment} Instance of appropriate class (SlidesAssignment, SheetsAssignment, or base Assignment)
   */
  static fromJSON(data) {
    if (!data || typeof data !== 'object')
      throw new Error('Invalid data supplied to Assignment.fromJSON');

    if (!data.courseId || !data.assignmentId) {
      throw new Error('courseId and assignmentId are required fields in Assignment data');
    }

    if (!data.assignmentDefinition) {
      if (!data.documentType) {
        ProgressTracker.getInstance().logAndThrowError(
          `Assignment data missing documentType for courseId=${data.courseId}, assignmentId=${data.assignmentId}`,
          { data }
        );
      }

      data.assignmentDefinition = new AssignmentDefinition({
        primaryTitle: data.assignmentName || `Assignment ${data.assignmentId}`,
        primaryTopic: data.assignmentName || 'Assignment',
        documentType: data.documentType,
        referenceDocumentId: data.referenceDocumentId,
        templateDocumentId: data.templateDocumentId,
        tasks: data.tasks ?? {},
        referenceLastModified: data.referenceLastModified ?? null,
        templateLastModified: data.templateLastModified ?? null,
      }).toJSON();
    }

    const docType = data.assignmentDefinition.documentType;

    if (!docType || typeof docType !== 'string') {
      ProgressTracker.getInstance().logAndThrowError(
        `Assignment data missing documentType for courseId=${data.courseId}, assignmentId=${data.assignmentId}`,
        { data }
      );
    }

    const type = docType.toUpperCase();

    if (type === 'SLIDES') {
      return SlidesAssignment.fromJSON(data);
    }

    if (type === 'SHEETS') {
      return SheetsAssignment.fromJSON(data);
    }

    ProgressTracker.getInstance().logAndThrowError(
      `Unknown assignment documentType '${docType}' for courseId=${data.courseId}, assignmentId=${data.assignmentId}`,
      { documentType: docType, data }
    );
  }
  /**
   * Fetches the assignment name from Google Classroom.
   * @param {string} courseId - The ID of the course.
   * @param {string} assignmentId - The ID of the assignment.
   * @return {string} - The name/title of the assignment.
   */
  fetchAssignmentName(courseId, assignmentId) {
    try {
      const courseWork = Classroom.Courses.CourseWork.get(courseId, assignmentId);
      return courseWork.title || `Assignment ${assignmentId}`;
    } catch (error) {
      ABLogger.getInstance().error(`Error fetching assignment name for ID ${assignmentId}:`, error);
      return `Assignment ${assignmentId}`;
    }
  }

  /**
   * Update the lastUpdated timestamp to the current date/time.
   * Call this whenever the assignment is modified in-memory.
   * @return {Date} the new lastUpdated value
   */
  touchUpdated() {
    // Use setLastUpdated to centralize validation/copying behavior.
    return this.setLastUpdated(new Date());
  }

  /**
   * Returns the lastUpdated Date or null if not set.
   * @return {Date|null}
   */
  getLastUpdated() {
    return this.lastUpdated || null;
  }

  /**
   * Set the lastUpdated timestamp from a JavaScript Date object (or null to clear).
   * The method copies the provided Date to avoid external mutation.
   * @param {Date|null} date
   * @throws {TypeError} if the provided value is not a Date or null
   * @return {Date|null} the stored Date instance or null
   */
  setLastUpdated(date) {
    if (date === null) {
      this.lastUpdated = null;
      return null;
    }
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      throw new TypeError('setLastUpdated expects a valid Date or null');
    }
    // store a copy to avoid outside mutation
    this.lastUpdated = new Date(date);
    return this.lastUpdated;
  }

  /**
   * Adds a student to the assignment.
   * @param {Student} student - The Student instance to add.
   */
  addStudent(student) {
    // Expect student object with id
    const studentId = student.id || student.studentId || student.userId;
    if (!studentId) {
      ABLogger.getInstance().warn('addStudent called without resolvable studentId');
      return null;
    }
    // Avoid duplicates
    const existing = this.submissions.find((s) => s.studentId === studentId);
    if (existing) return existing;
    const studentName =
      student && (student.name || student.studentName || student.fullName)
        ? student.name || student.studentName || student.fullName
        : null;
    const submission = new StudentSubmission(studentId, this.assignmentId, null, studentName);
    // Attach original student metadata for any legacy code (non-persisted)
    submission._legacyStudent = student;
    this.submissions.push(submission);
    return submission;
  }

  /**
   * Process a single attachment for a student's submission.
   * Separated out to reduce cognitive complexity in the parent method.
   * @param {object} attachment
   * @param {string} studentId
   * @param {string} mimeType
   */
  _processAttachmentForSubmission(attachment, studentId, mimeType) {
    const driveFileId = attachment?.driveFile?.id;
    if (!driveFileId) {
      ABLogger.getInstance().info(
        `Attachment for student ID ${studentId} is not a Drive File or lacks a valid ID.`
      );
      return;
    }

    try {
      // Fetch the Drive file using DriveApp
      const file = DriveApp.getFileById(driveFileId);
      const fileMimeType = file.getMimeType();
      if (this.isValidMimeType(fileMimeType, mimeType)) {
        const documentId = driveFileId;
        // New model: submissions array holds StudentSubmission objects with studentId
        const submissionObj = this.submissions.find((sub) => sub.studentId === studentId);
        if (submissionObj) {
          submissionObj.documentId = documentId;
          // Keep updatedAt coherent if method exists
          if (typeof submissionObj.touchUpdated === 'function') submissionObj.touchUpdated();
        } else {
          ABLogger.getInstance().info(`No matching submission found for student ID: ${studentId}`);
        }
      } else {
        ABLogger.getInstance().info(
          `Attachment with Drive File ID ${driveFileId} is not a supported document (MIME type: ${fileMimeType}).`
        );
      }
    } catch (fileError) {
      ABLogger.getInstance().error(`Error fetching Drive file with ID ${driveFileId}:`, fileError);
    }
  }

  /**
   * Fetches and assigns submitted Google Drive documents for each student, filtered by the provided MIME type.
   * @param {string} mimeType - The Google Drive MIME type to filter for (e.g., MimeType.GOOGLE_SLIDES, MimeType.GOOGLE_SHEETS).
   */
  fetchSubmittedDocumentsByMimeType(mimeType) {
    try {
      // Fetch all student submissions for the specific assignment
      const response = Classroom.Courses.CourseWork.StudentSubmissions.list(
        this.courseId,
        this.assignmentId
      );
      const submissions = response.studentSubmissions;

      if (!submissions || submissions.length === 0) {
        ABLogger.getInstance().info(`No submissions found for assignment ID: ${this.assignmentId}`);
        return;
      }

      submissions.forEach((submission) => {
        const studentId = submission.userId; // Google Classroom Student ID (string)
        const attachments = submission.assignmentSubmission?.attachments;

        if (attachments && attachments.length > 0) {
          attachments.forEach((attachment) =>
            this._processAttachmentForSubmission(attachment, studentId, mimeType)
          );
        } else {
          ABLogger.getInstance().info(`No attachments found for student ID: ${studentId}`);
        }
      });
    } catch (error) {
      ABLogger.getInstance().error(
        `Error fetching submissions for assignment ID ${this.assignmentId}:`,
        error
      );
    }
  }

  /**
   * Helper to validate if the file's MIME type matches the expected type (Google Docs or Google Sheets).
   * @param {string} fileMimeType - The MIME type of the file from Drive.
   * @param {string} expectedMimeType - The expected Google MIME type.
   * @return {boolean} True if valid, false otherwise.
   */
  isValidMimeType(fileMimeType, expectedMimeType) {
    return fileMimeType === expectedMimeType;
  }

  /**
   * Fetches and assigns submitted documents for each student.
   * This is a base method that should be implemented by subclasses.
   */
  fetchSubmittedDocuments() {
    this._requireImplementation('fetchSubmittedDocuments');
  }

  /**
   * Populates tasks from reference documents.
   * This is a base method that should be implemented by subclasses.
   */
  populateTasks() {
    this._requireImplementation('populateTasks');
  }

  /**
   * Processes all student submissions by extracting responses.
   * This is a base method that should be implemented by subclasses.
   */
  processAllSubmissions() {
    this._requireImplementation('processAllSubmissions');
  }

  /**
   * Generates an array of request objects ready to be sent to the LLM.
   * @return {Object[]} - An array of request objects.
   */
  generateLLMRequests() {
    return this._getLLMManager().generateRequestObjects(this);
  }

  /**
   * Assesses student responses by interacting with the LLM.
   */
  assessResponses() {
    // Base Assignment only handles non-spreadsheet (text/table/image) via LLM
    const manager = this._getLLMManager();
    const requests = manager.generateRequestObjects(this);
    if (!requests || requests.length === 0) {
      Utils.toastMessage('No LLM requests to send.', 'Info', 3);
      return;
    }
    manager.processStudentResponses(requests, this);
  }

  /**
   * Small helper to centralise creation of the LLMRequestManager instance.
   * This keeps construction in a single place and reduces copy/paste.
   * @return {LLMRequestManager}
   */
  _getLLMManager() {
    return new LLMRequestManager();
  }

  /**
   * Small helper used by base-class methods that must be implemented by subclasses.
   * Centralising the throw here reduces the duplicated error message logic across
   * multiple tiny abstract-style methods.
   * @param {string} methodName - Name of the method that should be implemented
   */
  _requireImplementation(methodName) {
    throw new Error(`${methodName} must be implemented by subclasses`);
  }

  getTasks() {
    return this.assignmentDefinition?.tasks ?? null;
  }

  setTasks(tasks) {
    this.tasks = tasks;
    return tasks;
  }

  getDocumentType() {
    return this.assignmentDefinition?.documentType || null;
  }

  getReferenceDocumentId() {
    return this.assignmentDefinition?.referenceDocumentId || null;
  }

  getTemplateDocumentId() {
    return this.assignmentDefinition?.templateDocumentId || null;
  }
}

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined') {
  module.exports = Assignment;
}
