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
   */
  constructor(courseId, assignmentId) {
    this.courseId = courseId;
    this.assignmentId = assignmentId;
    this.assignmentName = this.fetchAssignmentName(courseId, assignmentId);
    this.assignmentWeighting = null //will be implemented later.
    this.assignmentMetadata = null //will be implemented later.
    this.dueDate = null //to be implemented later with the homework tracker. 
    // New model: tasks keyed by stable taskId -> TaskDefinition
    this.tasks = {};           // { [taskId: string]: TaskDefinition }
    // New model: submissions array of StudentSubmission
    this.submissions = [];     // Array<StudentSubmission>
    // Legacy studentTasks alias removed – callers must use this.submissions.
    this.progressTracker = ProgressTracker.getInstance();
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
        if (task && typeof task === 'object') return [taskId, Object.assign({}, task)];
        return [taskId, task];
      })
    );

    const submissions = (this.submissions || []).map(sub => {
      if (sub && typeof sub.toJSON === 'function') return sub.toJSON();
      // Fallback serialization for StudentSubmission-like objects
      const out = {};
      if (sub && typeof sub === 'object') {
        out.studentId = sub.studentId || sub.userId || null;
        if ('documentId' in sub) out.documentId = sub.documentId;
        if ('score' in sub) out.score = sub.score;
        if ('feedback' in sub) out.feedback = sub.feedback;
        if (sub.updatedAt instanceof Date) out.updatedAt = sub.updatedAt.toISOString();
        else if (sub.updatedAt) out.updatedAt = sub.updatedAt;
        // copy any other enumerable properties (non-enumerable like methods are ignored)
        Object.keys(sub).forEach(k => {
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
      tasks,
      submissions,
    };
  }

  /**
   * Rehydrate an Assignment instance from a JSON object previously produced by toJSON().
   * This avoids calling the constructor (which may hit external APIs) by creating
   * a prototype-backed object and populating fields directly.
   * The method will attempt to use TaskDefinition.fromJSON / StudentSubmission.fromJSON
   * if available, or fall back to basic reconstruction.
   * @param {object} data
   * @return {Assignment}
   */
  static fromJSON(data) {
    if (!data || typeof data !== 'object') throw new Error('Invalid data supplied to Assignment.fromJSON');

    const inst = Object.create(Assignment.prototype);
    inst.courseId = data.courseId;
    inst.assignmentId = data.assignmentId;
    inst.assignmentName = data.assignmentName || `Assignment ${data.assignmentId}`;
    inst.assignmentWeighting = data.assignmentWeighting ?? null;
    inst.assignmentMetadata = data.assignmentMetadata ?? null;
    inst.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    inst.tasks = {};
    inst.submissions = [];
    // restore tasks
    if (data.tasks && typeof data.tasks === 'object') {
      Object.entries(data.tasks).forEach(([taskId, taskObj]) => {
        if (typeof TaskDefinition !== 'undefined' && TaskDefinition && typeof TaskDefinition.fromJSON === 'function') {
          try {
            inst.tasks[taskId] = TaskDefinition.fromJSON(taskObj);
            return;
          } catch (e) {
            // fallback to raw object
          }
        }
        if (typeof TaskDefinition !== 'undefined' && TaskDefinition) {
          try {
            inst.tasks[taskId] = new TaskDefinition(taskObj);
            return;
          } catch (e) {
            // fallback
          }
        }
        inst.tasks[taskId] = taskObj;
      });
    }

    // restore submissions
    if (Array.isArray(data.submissions)) {
      data.submissions.forEach(subObj => {
        if (typeof StudentSubmission !== 'undefined' && StudentSubmission && typeof StudentSubmission.fromJSON === 'function') {
          try {
            inst.submissions.push(StudentSubmission.fromJSON(subObj));
            return;
          } catch (e) {
            // fallback
          }
        }
        if (typeof StudentSubmission !== 'undefined' && StudentSubmission) {
          try {
            const sub = new StudentSubmission(subObj.studentId || subObj.userId || null, inst.assignmentId, subObj.documentId || null);
            // copy fields
            Object.keys(subObj || {}).forEach(k => {
              if (k === 'updatedAt' && subObj.updatedAt) sub.updatedAt = subObj.updatedAt instanceof Date ? subObj.updatedAt : new Date(subObj.updatedAt);
              else if (k in sub) sub[k] = subObj[k];
              else sub[k] = subObj[k];
            });
            inst.submissions.push(sub);
            return;
          } catch (e) {
            // fallback
          }
        }
        // raw fallback
        const raw = Object.assign({}, subObj);
        if (raw.updatedAt) raw.updatedAt = new Date(raw.updatedAt);
        inst.submissions.push(raw);
      });
    }

    // restore progress tracker singleton if available
    inst.progressTracker = (typeof ProgressTracker !== 'undefined' && ProgressTracker && typeof ProgressTracker.getInstance === 'function') ? ProgressTracker.getInstance() : null;

    return inst;
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
      console.error(`Error fetching assignment name for ID ${assignmentId}:`, error);
      return `Assignment ${assignmentId}`;
    }
  }

  /**
   * Adds a student to the assignment.
   * @param {Student} student - The Student instance to add.
   */
  addStudent(student) {
    // Expect student object with id
    const studentId = student.id || student.studentId || student.userId;
    if (!studentId) {
      console.warn('addStudent called without resolvable studentId');
      return null;
    }
    // Avoid duplicates
    const existing = this.submissions.find(s => s.studentId === studentId);
    if (existing) return existing;
    const submission = new StudentSubmission(studentId, this.assignmentId, null);
    // Attach original student metadata for any legacy code (non-persisted)
    submission._legacyStudent = student;
    this.submissions.push(submission);
    return submission;
  }

  /**
   * Fetches and assigns submitted Google Drive documents for each student, filtered by the provided MIME type.
   * @param {string} mimeType - The Google Drive MIME type to filter for (e.g., MimeType.GOOGLE_SLIDES, MimeType.GOOGLE_SHEETS).
   */
  fetchSubmittedDocumentsByMimeType(mimeType) {
    try {
      // Fetch all student submissions for the specific assignment
      const response = Classroom.Courses.CourseWork.StudentSubmissions.list(this.courseId, this.assignmentId);
      const submissions = response.studentSubmissions;

      if (!submissions || submissions.length === 0) {
        console.log(`No submissions found for assignment ID: ${this.assignmentId}`);
        return;
      }

      submissions.forEach(submission => {
        const studentId = submission.userId; // Google Classroom Student ID (string)
        const attachments = submission.assignmentSubmission?.attachments;

        if (attachments && attachments.length > 0) {
          attachments.forEach(attachment => {
            if (attachment.driveFile && attachment.driveFile.id) {
              const driveFileId = attachment.driveFile.id;
              try {
                // Fetch the Drive file using DriveApp
                const file = DriveApp.getFileById(driveFileId);
                const fileMimeType = file.getMimeType();
                if (this.isValidMimeType(fileMimeType, mimeType)) {
                  const documentId = driveFileId;
                  // New model: submissions array holds StudentSubmission objects with studentId
                  const submissionObj = this.submissions.find(sub => sub.studentId === studentId);
                  if (submissionObj) {
                    submissionObj.documentId = documentId;
                    // Keep updatedAt coherent if method exists
                    if (typeof submissionObj.touchUpdated === 'function') submissionObj.touchUpdated();
                  } else {
                    console.log(`No matching submission found for student ID: ${studentId}`);
                  }
                } else {
                  console.log(`Attachment with Drive File ID ${driveFileId} is not a supported document (MIME type: ${fileMimeType}).`);
                }
              } catch (fileError) {
                console.error(`Error fetching Drive file with ID ${driveFileId}:`, fileError);
              }
            } else {
              console.log(`Attachment for student ID ${studentId} is not a Drive File or lacks a valid ID.`);
            }
          });
        } else {
          console.log(`No attachments found for student ID: ${studentId}`);
        }
      });
    } catch (error) {
      console.error(`Error fetching submissions for assignment ID ${this.assignmentId}:`, error);
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