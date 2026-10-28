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
   * @param {import('./index.js')} assignment - The parent Assignment instance.
   */
  constructor(assignment) {
    /** @type {import('./index.js')} */
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
    const studentName = student.name || student.studentName || student.fullName || null;
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
   * @param {{failures: Map<string, string>, supported: Set<string>}|undefined} scanState -
   *   Optional scan-local accumulator. The complete scan applies its first failure only
   *   when it found no supported attachment; direct calls materialise immediately.
   */
  _processAttachmentForSubmission(attachment, studentId, mimeType, scanState) {
    const driveFileId = attachment?.driveFile?.id;
    if (!driveFileId) {
      ABLogger.getInstance().info(
        `Attachment for student ID ${studentId} is not a Drive File or lacks a valid ID.`
      );
      return;
    }

    let fileMimeType;
    try {
      fileMimeType = DriveApp.getFileById(driveFileId).getMimeType();
    } catch (fileError) {
      // Apps Script reports inaccessible/missing Drive files as generic exceptions.
      // Keep language-level faults out of this source-access conversion boundary.
      if (
        !(fileError instanceof Error) ||
        fileError instanceof TypeError ||
        fileError instanceof ReferenceError
      ) {
        throw fileError;
      }
      ABLogger.getInstance().error(`Error fetching Drive file with ID ${driveFileId}:`, fileError);
      this._recordAcquisitionFailure(studentId, 'SOURCE_UNREADABLE', scanState);
      return;
    }

    if (this.isValidMimeType(fileMimeType, mimeType)) {
      const documentId = driveFileId;
      // New model: submissions array holds StudentSubmission objects with studentId
      const submissionObject = this._assignment.submissions.find(
        (sub) => sub.studentId === studentId
      );
      if (submissionObject) {
        submissionObject.documentId = documentId;
        this._recordSupportedAttachment(studentId, scanState);
        // Keep updatedAt coherent if method exists
        if (typeof submissionObject.touchUpdated === 'function') submissionObject.touchUpdated();
      } else {
        ABLogger.getInstance().info(`No matching submission found for student ID: ${studentId}`);
        return;
      }
      return;
    }
    ABLogger.getInstance().info(
      `Attachment with Drive File ID ${driveFileId} is not a supported document (MIME type: ${fileMimeType}).`
    );
    this._recordAcquisitionFailure(studentId, 'UNSUPPORTED_DOCUMENT', scanState);
  }

  /**
   * Accumulates scan failures without creating provisional items; direct calls keep
   * their historical immediate materialisation behaviour.
   * @param {string} studentId - The affected student identity.
   * @param {'SOURCE_UNREADABLE'|'UNSUPPORTED_DOCUMENT'} code - The first observed failure.
   * @param {{failures: Map<string, string>, supported: Set<string>}|undefined} scanState - Scan-local state.
   */
  _recordAcquisitionFailure(studentId, code, scanState) {
    if (!scanState) {
      this._materialiseAcquisitionOutcome(studentId, code);
      return;
    }
    if (!scanState.supported.has(studentId) && !scanState.failures.has(studentId)) {
      scanState.failures.set(studentId, code);
    }
  }

  /**
   * Marks that scanning found an admitted source, discarding earlier provisional failures.
   * @param {string} studentId - The student with an admitted document.
   * @param {{failures: Map<string, string>, supported: Set<string>}|undefined} scanState - Scan-local state.
   */
  _recordSupportedAttachment(studentId, scanState) {
    if (!scanState) return;
    scanState.supported.add(studentId);
    scanState.failures.delete(studentId);
  }

  /**
   * Materialises an acquisition result for the student's known tasks.
   * @param {string} studentId - The student whose document failed acquisition.
   * @param {'SOURCE_UNREADABLE'|'UNSUPPORTED_DOCUMENT'} code - The acquisition cause.
   */
  _materialiseAcquisitionOutcome(studentId, code) {
    const submission = this._assignment.submissions.find((sub) => sub.studentId === studentId);
    if (!submission) return;
    for (const taskId of Object.keys(this._assignment.getTasks())) {
      const artifact = new BaseTaskArtifact({
        taskId,
        role: 'submission',
        pageId: null,
        documentId: null,
        content: null,
        contentHash: null,
        metadata: {},
        uid: `${taskId}-${submission.studentId}-na-0`,
      });
      const item = new StudentSubmissionItem({
        taskId,
        artifact,
        onMutate: () => submission.touchUpdated(),
      });
      submission.items[taskId] = item;
      submission.touchUpdated();
      item.setError('acquisition', code);
    }
  }

  /**
   * Fetches and assigns submitted Google Drive documents for each student, filtered by the provided MIME type.
   * @param {string} mimeType - The Google Drive MIME type to filter for (e.g., MimeType.GOOGLE_SLIDES, MimeType.GOOGLE_SHEETS).
   * @returns {void}
   * @remarks The complete paginated scan preserves the last supported attachment for each
   * student across attachment arrays and duplicate Classroom records. It defers acquisition
   * E creation until scanning ends, and applies the first observed failure only when no
   * supported attachment exists. Pagination must finish before absence is concluded.
   * Expected Drive source exceptions become acquisition outcomes; programming and wiring
   * faults propagate.
   */
  fetchSubmittedDocumentsByMimeType(mimeType) {
    try {
      // Fetch all student submissions for the specific assignment
      const submissions = [];
      let pageToken;
      do {
        const options = pageToken ? { pageToken } : undefined;
        const response = Classroom.Courses.CourseWork.StudentSubmissions.list(
          this._assignment.courseId,
          this._assignment.assignmentId,
          options
        );
        if (response.studentSubmissions) submissions.push(...response.studentSubmissions);
        pageToken = response.nextPageToken;
      } while (pageToken);

      if (!submissions || submissions.length === 0) {
        ABLogger.getInstance().info(
          `No submissions found for assignment ID: ${this._assignment.assignmentId}`
        );
        return;
      }

      const scanState = { failures: new Map(), supported: new Set() };
      submissions.forEach((submission) => {
        const studentId = submission.userId; // Google Classroom Student ID (string)
        const attachments = submission.assignmentSubmission?.attachments;

        if (attachments && attachments.length > 0) {
          attachments.forEach((attachment) => {
            this._processAttachmentForSubmission(attachment, studentId, mimeType, scanState);
          });
        } else {
          ABLogger.getInstance().info(`No attachments found for student ID: ${studentId}`);
        }
      });
      scanState.failures.forEach((code, studentId) =>
        this._materialiseAcquisitionOutcome(studentId, code)
      );
    } catch (error) {
      ABLogger.getInstance().error(
        `Error fetching submissions for assignment ID ${this._assignment.assignmentId}:`,
        error
      );
      throw error;
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
