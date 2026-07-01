/**
 * AssignmentSubmissions — Student submission management sub-class
 *
 * Owns addStudent(), _processAttachmentForSubmission(), fetchSubmittedDocumentsByMimeType(),
 * and isValidMimeType().
 *
 * Operates on the parent Assignment instance's state via this._assignment.
 * Depends on global `Classroom`, `DriveApp`, `StudentSubmission`, and `ABLogger` (GAS runtime globals).
 * @class
 */
/**
 * AssignmentSubmissions — Student submission management sub-class
 *
 * Owns addStudent(), _processAttachmentForSubmission(), fetchSubmittedDocumentsByMimeType(),
 * and isValidMimeType().
 *
 * Operates on the parent Assignment instance's state via this._assignment.
 * Depends on global `Classroom`, `DriveApp`, `StudentSubmission`, and `ABLogger` (GAS runtime globals).
 * @class
 */
class AssignmentSubmissions {
  /**
   * Constructor.
   * @param {import('../Assignment.js')} assignment - The parent Assignment instance.
   */
  constructor(assignment) {
    /** @type {import('../Assignment.js')} */
    this._assignment = assignment;
  }

  /**
   * Adds a student to the assignment.
   * @param {Student} student - The Student instance to add.
   * @returns {StudentSubmission|null} The created StudentSubmission, or null if studentId is not resolvable.
   */
  addStudent(student) {
    // Expect student object with id
    const studentId = student.id || student.studentId || student.userId;
    if (!studentId) {
      ABLogger.getInstance().warn('addStudent called without resolvable studentId');
      return null;
    }
    // Avoid duplicates
    const existing = this._assignment.submissions.find((s) => s.studentId === studentId);
    if (existing) return existing;
    const studentName =
      student && (student.name || student.studentName || student.fullName)
        ? student.name || student.studentName || student.fullName
        : null;
    const submission = new StudentSubmission(
      studentId,
      this._assignment.assignmentId,
      null,
      studentName
    );
    // Attach original student metadata for any legacy code (non-persisted)
    submission._legacyStudent = student;
    this._assignment.submissions.push(submission);
    return submission;
  }

  /**
   * Processes a single attachment for a student's submission.
   * Separates logic to reduce cognitive complexity in the parent method.
   * @param {object} attachment - The attachment object from Classroom submission.
   * @param {string} studentId - The Google Classroom student ID.
   * @param {string} mimeType - The expected MIME type to validate against.
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
        const submissionObject = this._assignment.submissions.find(
          (sub) => sub.studentId === studentId
        );
        if (submissionObject) {
          submissionObject.documentId = documentId;
          // Keep updatedAt coherent if method exists
          if (typeof submissionObject.touchUpdated === 'function') submissionObject.touchUpdated();
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
   * @returns {void}
   */
  fetchSubmittedDocumentsByMimeType(mimeType) {
    try {
      // Fetch all student submissions for the specific assignment
      const response = Classroom.Courses.CourseWork.StudentSubmissions.list(
        this._assignment.courseId,
        this._assignment.assignmentId
      );
      const submissions = response.studentSubmissions;

      if (!submissions || submissions.length === 0) {
        ABLogger.getInstance().info(
          `No submissions found for assignment ID: ${this._assignment.assignmentId}`
        );
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
        `Error fetching submissions for assignment ID ${this._assignment.assignmentId}:`,
        error
      );
    }
  }

  /**
   * Validates if the file's MIME type matches the expected type.
   * @param {string} fileMimeType - The MIME type of the file from Drive.
   * @param {string} expectedMimeType - The expected Google MIME type.
   * @returns {boolean} True if valid, false otherwise.
   */
  isValidMimeType(fileMimeType, expectedMimeType) {
    return fileMimeType === expectedMimeType;
  }
}

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentSubmissions;
}
