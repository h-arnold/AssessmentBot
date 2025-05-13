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