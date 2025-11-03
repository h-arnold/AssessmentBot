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
  constructor(courseId, assignmentId) {
    this.courseId = courseId;
    this.assignmentId = assignmentId;
    this.assignmentName = this.fetchAssignmentName(courseId, assignmentId);
    this.assignmentWeighting = null; //will be implemented later.
    this.assignmentMetadata = null; //will be implemented later.
    this.dueDate = null; //to be implemented later with the homework tracker.
    // Timestamp for when this assignment was last updated. Use Date or null.
    this.lastUpdated = null;
    // Document type identifier set by subclasses (e.g., 'SLIDES', 'SHEETS')
    this.documentType = null;
    // New model: tasks keyed by stable taskId -> TaskDefinition
    this.tasks = {}; // { [taskId: string]: TaskDefinition }
    // New model: submissions array of StudentSubmission
    this.submissions = []; // Array<StudentSubmission>
    // Legacy studentTasks alias removed – callers must use this.submissions.
    this.progressTracker = ProgressTracker.getInstance();
    // Controllers may temporarily attach `assignment.students` while an assessment run is active
    // to keep the hydrated roster handy. That property is transient and must never be persisted
    // (see docs/developer/DATA_SHAPES.md and rehydration.md).
  }

  /**
   * Serialize this Assignment to a plain JSON-friendly object.
   * - Dates are converted to ISO strings.
   * - If TaskDefinition or StudentSubmission provide toJSON, those are used.
   * - progressTracker is intentionally not serialized (singleton/session-specific).
   * @return {object}
   */
  toJSON() {
    const tasks = Object.fromEntries(
      Object.entries(this.tasks || {}).map(([taskId, task]) => {
        if (task && typeof task.toJSON === 'function') return [taskId, task.toJSON()];
        if (task && typeof task === 'object') return [taskId, { ...task }];
        return [taskId, task];
      })
    );

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
          if (!out.hasOwnProperty(k)) out[k] = sub[k];
        });
      }
      return out;
    });

    return {
      courseId: this.courseId,
      assignmentId: this.assignmentId,
      assignmentName: this.assignmentName,
      assignmentWeighting: this.assignmentWeighting,
      assignmentMetadata: this.assignmentMetadata,
      dueDate: this.dueDate ? this.dueDate.toISOString() : null,
      lastUpdated: this.lastUpdated ? this.lastUpdated.toISOString() : null,
      documentType: this.documentType,
      tasks,
      submissions,
      // Intentionally exclude any transient `students` roster attached at runtime.
    };
  }

  /**
   * Factory method to create the correct Assignment subclass based on documentType.
   * @param {string} documentType - Document type ('SLIDES' or 'SHEETS')
   * @param {string} courseId - The ID of the course
   * @param {string} assignmentId - The ID of the assignment
   * @param {string} referenceDocumentId - The ID of the reference document
   * @param {string} templateDocumentId - The ID of the template document
   * @return {Assignment} Instance of appropriate subclass
   * @throws {Error} If documentType is invalid or unknown
   */
  static create(documentType, courseId, assignmentId, referenceDocumentId, templateDocumentId) {
    if (!documentType || typeof documentType !== 'string') {
      throw new TypeError(
        'documentType is required and must be a string: accepted values are "SLIDES" or "SHEETS". See docs/developer/DATA_SHAPES.md for accepted values.'
      );
    }

    const type = documentType.toUpperCase();

    if (type === 'SLIDES') {
      return new SlidesAssignment(courseId, assignmentId, referenceDocumentId, templateDocumentId);
    }

    if (type === 'SHEETS') {
      return new SheetsAssignment(courseId, assignmentId, referenceDocumentId, templateDocumentId);
    }

    throw new Error(
      `Unknown documentType: ${documentType}. Valid types are 'SLIDES' or 'SHEETS'. See docs/developer/DATA_SHAPES.md for details.`
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
    inst.assignmentWeighting = data.assignmentWeighting ?? null;
    inst.assignmentMetadata = data.assignmentMetadata ?? null;
    inst.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    inst.lastUpdated = data.lastUpdated ? new Date(data.lastUpdated) : null;
    if ('documentType' in data) {
      inst.documentType = data.documentType;
    }
    inst.tasks = {};
    inst.submissions = [];
    // restore tasks
    if (data.tasks && typeof data.tasks === 'object') {
      Object.entries(data.tasks).forEach(([taskId, taskObj]) => {
        try {
          inst.tasks[taskId] = TaskDefinition.fromJSON(taskObj);
          return;
        } catch (e) {
          // Log the primary reconstruction error so it isn't an unhandled/ignored exception
          ABLogger.getInstance().warn(`TaskDefinition.fromJSON threw for taskId=${taskId}:`, e);
          try {
            inst.tasks[taskId] = new TaskDefinition(taskObj);
            return;
          } catch (error_) {
            ABLogger.getInstance().warn(
              `TaskDefinition reconstruction failed for taskId=${taskId}:`,
              error_
            );
          }
        }
        inst.tasks[taskId] = taskObj;
      });
    }

    // restore submissions
    if (Array.isArray(data.submissions)) {
      data.submissions.forEach((subObj) => {
        try {
          inst.submissions.push(StudentSubmission.fromJSON(subObj));
          return;
        } catch (e) {
          // Log the primary reconstruction error so it isn't an unhandled/ignored exception
          ABLogger.getInstance().warn(
            `StudentSubmission.fromJSON threw for studentId=${
              subObj && (subObj.studentId || subObj.userId)
            }:`,
            e
          );
          try {
            const sub = new StudentSubmission(
              subObj.studentId || subObj.userId || null,
              inst.assignmentId,
              subObj.documentId || null,
              subObj.studentName || subObj.name || null
            );
            // copy fields
            Object.keys(subObj || {}).forEach((k) => {
              if (k === 'updatedAt' && subObj.updatedAt)
                sub.updatedAt =
                  subObj.updatedAt instanceof Date ? subObj.updatedAt : new Date(subObj.updatedAt);
              else if (k in sub) sub[k] = subObj[k];
              else sub[k] = subObj[k];
            });
            inst.submissions.push(sub);
            return;
          } catch (error_) {
            ABLogger.getInstance().warn(
              `StudentSubmission reconstruction failed for studentId=${
                subObj && (subObj.studentId || subObj.userId)
              }:`,
              error_
            );
          }
        }
        // raw fallback
        const raw = { ...subObj };
        if (raw.updatedAt) raw.updatedAt = new Date(raw.updatedAt);
        inst.submissions.push(raw);
      });
    }

    // restore progress tracker singleton if available
    inst.progressTracker = ProgressTracker.getInstance();

    // Copy any additional fields that aren't already handled (e.g., referenceDocumentId, templateDocumentId for graceful degradation)
    const knownFields = new Set([
      'courseId',
      'assignmentId',
      'assignmentName',
      'assignmentWeighting',
      'assignmentMetadata',
      'dueDate',
      'lastUpdated',
      'documentType',
      'tasks',
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

    const docType = data.documentType;

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
    throw new Error('fetchSubmittedDocuments must be implemented by subclasses');
  }

  /**
   * Populates tasks from reference documents.
   * This is a base method that should be implemented by subclasses.
   */
  populateTasks() {
    throw new Error('populateTasks must be implemented by subclasses');
  }

  /**
   * Processes all student submissions by extracting responses.
   * This is a base method that should be implemented by subclasses.
   */
  processAllSubmissions() {
    throw new Error('processAllSubmissions must be implemented by subclasses');
  }

  /**
   * Generates an array of request objects ready to be sent to the LLM.
   * @return {Object[]} - An array of request objects.
   */
  generateLLMRequests() {
    // Delegate to LLMRequestManager (new model aware)
    const manager = new LLMRequestManager();
    return manager.generateRequestObjects(this);
  }

  /**
   * Assesses student responses by interacting with the LLM.
   */
  assessResponses() {
    // Base Assignment only handles non-spreadsheet (text/table/image) via LLM
    const manager = new LLMRequestManager();
    const requests = manager.generateRequestObjects(this);
    if (!requests || requests.length === 0) {
      Utils.toastMessage('No LLM requests to send.', 'Info', 3);
      return;
    }
    manager.processStudentResponses(requests, this);
  }
}

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined') {
  module.exports = Assignment;
}
