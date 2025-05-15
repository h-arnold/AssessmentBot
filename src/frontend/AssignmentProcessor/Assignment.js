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
   */
  constructor(courseId, assignmentId) {
    this.courseId = courseId;
    this.assignmentId = assignmentId;
    this.assignmentName = this.fetchAssignmentName(courseId, assignmentId);
    this.tasks = {};           // { taskKey: Task }
    this.studentTasks = [];    // Array of StudentTask instances
    this.progressTracker = ProgressTracker.getInstance();
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
    const studentTask = new StudentTask(student, this.assignmentId, null);
    this.studentTasks.push(studentTask);
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
                  // Find the corresponding StudentTask instance
                  const studentTask = this.studentTasks.find(st => st.student.id === studentId);
                  if (studentTask) {
                    studentTask.documentId = documentId;
                  } else {
                    console.log(`No matching student found for student ID: ${studentId}`);
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
    // Utilize the singleton instance of LLMRequestManager
    const requests = llmRequestManager.generateRequestObjects(this);
    return requests;
  }

  /**
   * Assesses student responses by interacting with the LLM.
   */
  assessResponses() {
    // Utilize the singleton instance of LLMRequestManager
    const llmRequestManager = new LLMRequestManager();

    // Generate LLM Requests
    const requests = llmRequestManager.generateRequestObjects(this);
    if (requests.length === 0) {
      Utils.toastMessage("No LLM requests to send.", "Info", 3);
      return;
    }

    // Send Requests in Batches and adds the responses to the assignment instance
    llmRequestManager.processStudentResponses(requests, this);
  }
}