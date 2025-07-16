/**
 * StudentTask Class
 *
 * Represents a student's submission for an assignment, containing responses to each task.
 */
class StudentTask {
  /**
   * Constructs a StudentTask instance.
   * @param {Student} student - The Student instance associated with this submission.
   * @param {string} assignmentId - The ID of the associated Assignment.
   * @param {string} documentId - The ID of the student's submission document.
   */
  constructor(student, assignmentId, documentId) {
    this.student = student; // Student: Associated student
    this.assignmentId = assignmentId; // string: ID of the assignment
    this.documentId = documentId; // string: Document ID of the student's submission
    this.responses = {}; // Object: Mapping of taskKey to { uid, pageId, response, contentHash, assessments }
  }

  /**
   * Adds a response to a specific task.
   * @param {string|null} taskKey - The key of the task (typically the task title).
   * @param {string} uid - The unique ID of this response.
   * @param {string} pageId - The ID of the page where the task is located (slide ID for presentations or sheet tab ID for spreadsheets).
   * @param {string|string[]} response - The student's response to the task (string or array of URLs).
   * @param {string|null} contentHash - Hash of the response content for caching purposes.
   */
  addResponse(taskKey, uid, pageId, response, contentHash = null) {
    this.responses[taskKey] = {
      uid: uid,
      pageId: pageId,
      response: response, // String for Text/Table, array of URLs for Image
      contentHash: contentHash, // New property
      assessments: null, // To be filled after LLM assessment
    };
  }

  /**
   * Retrieves a response for a specific task.
   * @param {string} taskKey - The key of the task.
   * @return {Object|null} - An object containing uid, pageId, response, and assessments, or null if not found.
   */
  getResponse(taskKey) {
    return this.responses.hasOwnProperty(taskKey)
      ? this.responses[taskKey]
      : null;
  }

  /**
   * Adds an assessment to a specific task response.
   * @param {string} taskKey - The key of the task.
   * @param {string} criterion - The assessment criterion (e.g., 'completeness').
   * @param {Assessment} assessment - The Assessment instance to add.
   */
  addAssessment(taskKey, criterion, assessment) {
    if (this.responses[taskKey]) {
      // Initialize assessments as an empty object if it's null
      if (!this.responses[taskKey].assessments) {
        this.responses[taskKey].assessments = {};
      }
      this.responses[taskKey].assessments[criterion] = {
        score: assessment.score,
        reasoning: assessment.reasoning,
      };
    } else {
      console.warn(`No response found for taskKey: ${taskKey}`);
    }
  }

  /**
   * Retrieves an assessment for a specific task.
   * @param {string} taskKey - The key of the task.
   * @return {Object|null} - The assessment object or null if not found.
   */
  getAssessment(taskKey) {
    return this.responses[taskKey]?.assessments || null;
  }

  /**
   * Adds feedback to a specific task response.
   * @param {string} taskKey - The key of the task.
   * @param {Feedback} feedbackObject - The feedback object to add.
   */
  addFeedback(taskKey, feedbackObject) {
    if (this.responses[taskKey]) {
      if (!this.responses[taskKey].feedback) {
        this.responses[taskKey].feedback = {};
      }
      this.responses[taskKey].feedback[feedbackObject.getType()] = feedbackObject;
    } else {
      console.warn(`No response found for taskKey: ${taskKey}`);
    }
  }

  /**
   * Retrieves feedback for a specific task.
   * @param {string} taskKey - The key of the task.
   * @param {string} [feedbackType] - Optional: specific feedback type to retrieve.
   * @return {Feedback|Object|null} - The feedback object, all feedback, or null if not found.
   */
  getFeedback(taskKey, feedbackType = null) {
    if (!this.responses[taskKey]?.feedback) {
      return null;
    }
    if (feedbackType) {
      return this.responses[taskKey].feedback[feedbackType] || null;
    }
    return this.responses[taskKey].feedback;
  }

  /**
   * Serializes the StudentTask instance to a JSON object.
   * @return {Object} - The JSON representation of the StudentTask.
   */
  toJSON() {
    return {
      student: this.student.toJSON(),
      assignmentId: this.assignmentId,
      documentId: this.documentId,
      responses: Object.fromEntries(
        Object.entries(this.responses).map(([key, value]) => [
          key,
          {
            uid: value.uid,
            pageId: value.pageId,
            response: value.response,
            contentHash: value.contentHash, // Include contentHash
            assessments: value.assessments ? value.assessments : null,
            feedback: value.feedback ? 
              Object.fromEntries(
                Object.entries(value.feedback).map(([fbType, fbObj]) => 
                  [fbType, fbObj.toJSON()]
                )
              ) : {},
          },
        ])
      ),
    };
  }

  /**
   * Deserializes a JSON object to a StudentTask instance.
   * @param {Object} json - The JSON object representing a StudentTask.
   * @return {StudentTask} - The StudentTask instance.
   */
  static fromJSON(json) {
    const { student, assignmentId, documentId, responses } = json;
    const studentInstance = Student.fromJSON(student);
    const studentTask = new StudentTask(
      studentInstance,
      assignmentId,
      documentId
    );
    for (const [taskKey, responseObj] of Object.entries(responses)) {
      studentTask.responses[taskKey] = {
        uid: responseObj.uid,
        pageId: responseObj.pageId,
        response: responseObj.response,
        contentHash: responseObj.contentHash, // Include contentHash
        assessments: responseObj.assessments ? responseObj.assessments : null,
        feedback: {},
      };
      if (responseObj.feedback) {
        for (const [fbType, fbJson] of Object.entries(responseObj.feedback)) {
          studentTask.responses[taskKey].feedback[fbType] = Feedback.fromJSON(fbJson);
        }
      }
    }
    return studentTask;
  }

  /**
   * Generates a unique UID for the StudentTask instance.
   * Utilizes the Utils class to generate a hash based on student ID and timestamp.
   * @param {string} pageId - The ID of the page (slide ID for presentations or sheet tab ID for spreadsheets).
   * @return {string} - The generated UID.
   */
  static generateUID(pageId) {
    const timestamp = new Date().getTime();
    const uniqueString = `${pageId}-${timestamp}`;
    return Utils.generateHash(uniqueString);
  }

  // TODO: Sort out this mess of a method to create Student Task instances. I think in the long run, the Document Parsers should create student tasks rather thn having this method here.
  /**
   * Extracts and assigns responses from the student's submission document.
   * @param {DocumentParser} parser - An instance of a DocumentParser (SlidesParser or SheetsParser).
   * @param {Object} tasks - An object of Task instances from the Assignment, keyed by taskTitle.
   */
  extractAndAssignResponses(parser, tasks) {
    try {
      if (!this.documentId) {
        console.error("No document ID provided for student task extraction");
        this.progressTracker?.logError("Missing student document ID");
        return;
      }

      // Convert tasks object to array if needed for SheetsParser
      const tasksArray = Object.values(tasks);

      let studentTasks = [];

      // Extract tasks based on parser type
      if (
        typeof SheetsParser !== "undefined" &&
        parser instanceof SheetsParser
      ) {
        // Use the SheetsParser to extract student tasks from a spreadsheet
        studentTasks = parser.extractStudentTasks(this.documentId, tasksArray);
      } else if (
        typeof SlidesParser !== "undefined" &&
        parser instanceof SlidesParser
      ) {
        // Use the SlidesParser to extract student tasks from slides
        studentTasks = parser.extractTasks(this.documentId);
      } else {
        console.error(
          "Unsupported or incorrect parser type for student document extraction"
        );
        this.progressTracker?.logError(
          "Unsupported or incorrect parser type for student document extraction"
        );
        return;
      }

      // Create a map of taskTitle to task data (pageId and response)
      const submissionMap = {};
      studentTasks.forEach((task) => {
        submissionMap[task.taskTitle] = {
          pageId: task.pageId, // Page ID within student's document (slide ID or sheet ID)
          response: task.taskReference, // For spreadsheets, this will be formula objects
          contentHash: task.contentHash, // Use the content hash from the extracted task
        };
      });

      // Assign responses ensuring consistency with Assignment's tasks
      Object.keys(tasks).forEach((taskKey) => {
        const task = tasks[taskKey];
        const taskTitle = task.taskTitle;

        if (submissionMap.hasOwnProperty(taskTitle)) {
          const { pageId, response, contentHash } = submissionMap[taskTitle];
          const uid = StudentTask.generateUID(pageId);

          // Use the content hash from the extracted task or generate one if not available
          let responseHash = contentHash;
          if (!responseHash) {
            if (
              task.taskType.toLowerCase() === "text" ||
              task.taskType.toLowerCase() === "table"
            ) {
              // Generate contentHash for Text and Table tasks
              responseHash = Utils.generateHash(response);
            }
            // For Image tasks, contentHash will be assigned after image fetching
          }

          this.addResponse(taskKey, uid, pageId, response, responseHash);
        } else {
          this.addResponse(taskKey, null, null, null);
        }
      });
    } catch (error) {
      console.error("Error extracting and assigning responses:", error);
      this.progressTracker?.logError("Failed to extract student responses");
    }
  }
}
