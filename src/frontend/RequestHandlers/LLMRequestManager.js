/**
 * LLMRequestManager Class
 *
 * Manages the creation, caching, and sending of request objects to the LLM.
 */
class LLMRequestManager extends BaseRequestManager {
  constructor() {
    super();
    this.progressTracker = ProgressTracker.getInstance();
    this.retryAttempts = {}; // Tracks retry attempts for each UID
    this.maxValidationRetries = 1; // Maximum retries for data validation
    this.cacheManager = new CacheManager(); // Use the CacheManager
    this.componentBuildErrorCount = 0; // Track repeated Langflow component build errors
    this.maxComponentBuildErrors = 2; // Threshold for aborting on backend errors
    this.abortOnComponentBuildError = false; // Flag to abort further processing
  }

  /**
 * Wakes up the LLM backend to ensure it's ready for processing.
 */
  warmUpLLM() {
    const payload = { "input_value": "Wake Up!" };
    const request = {
      url: this.configManager.getWarmUpUrl(),
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      headers: {
        "x-api-key": this.configManager.getLangflowApiKey()
      },
      muteHttpExceptions: true
    };

    try {
      const response = this.sendRequestWithRetries(request);
      if (response && (response.getResponseCode() === 200 || response.getResponseCode() === 201)) {
        Utils.toastMessage("AI backend warmed up and ready to go...", "Warm-Up", 5);
      } else {
        this.progressTracker.logAndThrowError("No successful response received from AI backend during warm-up.");
      }
    } catch (e) {
      this.progressTracker.logAndThrowError("Failed to warm up AI backend.", e);
    }
  }

  /**
   * Generates an array of request objects based on the Assignment instance.
   * Utilizes caching to avoid redundant requests.
   * @param {Assignment} assignment - The Assignment instance containing student tasks.
   * @return {Object[]} - An array of request objects ready to be sent via UrlFetchApp.fetchAll().
   */
  generateRequestObjects(assignment) {
    const requests = [];

    assignment.studentTasks.forEach(studentTask => {
      Object.keys(studentTask.responses).forEach(taskKey => {
        const response = studentTask.responses[taskKey];
        const { uid, response: rawStudentResponse, contentHash: contentHashResponse } = response;

        const studentResponse = rawStudentResponse ?? '';

        const task = assignment.tasks[taskKey];
        if (!task) {
          this.progressTracker.logError('No corresponding task found for task key: ' + taskKey);
          return;
        }

        if (!task.taskReference) {
          const errorMessage = 'Missing taskReference for task key: ' + taskKey + ' in assignment: ' + assignment.assignmentId;
          this.progressTracker.logAndThrowError(errorMessage);
        }

        if (task.templateContent === null || task.templateContent === undefined) {
          const errorMessage = 'Missing templateContent for task key: ' + taskKey + ' in assignment: ' + assignment.assignmentId;
          this.progressTracker.logAndThrowError(errorMessage);
        }

        const contentHashReference = task.contentHash;
        const contentHashTemplate = task.templateContentHash;

        // Check for unattempted tasks (template task matches student response)
        if (contentHashTemplate === contentHashResponse) {
          // Create default "Not Attempted" assessment
          const notAttemptedAssessment = this.createNotAttemptedAssessment();
          
          // Assign not attempted assessment
          this.assignAssessmentToStudentTask(uid, notAttemptedAssessment, assignment);
          console.log(`Task not attempted for UID: ${uid}. Assigned 'N' for all criteria'.`);
          return; // Skip adding to requests
        }

        // Use CacheManager to check for cached assessments
        const cachedAssessment = this.cacheManager.getCachedAssessment(contentHashReference, contentHashResponse);
        if (cachedAssessment) {
          // Assign assessment directly from cache
          this.assignAssessmentToStudentTask(uid, cachedAssessment, assignment);
          console.log(`Cache hit for UID: ${uid}. Assigned assessment from cache.`);
          return; // Skip adding to requests
        }

        // Build request for new backend /v1/assessor API
        const baseUrl = this.configManager.getBackendUrl();
        const apiKey  = this.configManager.getApiKey();
        requests.push({
          uid: uid,
          url: `${baseUrl}/v1/assessor`,
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({
            taskType:       task.taskType.toUpperCase(),
            reference:      task.taskReference,
            template:       task.templateContent,
            studentResponse: studentResponse
          }),
          headers: {
            Authorization: `Bearer ${apiKey}`
          },
          muteHttpExceptions: true
        });
      });
    });

    console.log(`Generated ${requests.length} request objects for LLM.`);
    return requests;
  }


  /**
   * Processes the responses from the LLM and assigns assessments to StudentTasks.
   * Also caches successful assessments.
   * @param {HTTPResponse[]} responses - Array of HTTPResponse objects from UrlFetchApp.fetchAll().
   * @param {Object[]} requests - Array of request objects sent in the current batch.
   * @param {Assignment} assignment - The Assignment instance containing StudentTasks.
   */
  processResponses(responses, requests, assignment) {

    this.progressTracker.updateProgress(`Double-checking all assessments.`,true);

    responses.forEach((response, index) => {
      this._processSingleResponse(response, requests[index], assignment);
    });
  }

  /**
   * Handles validation failures by retrying the request if retry attempts are below the maximum limit.
   * @param {string} uid - The unique identifier of the response.
   * @param {Object} request - The original request object.
   * @param {Assignment} assignment - The Assignment instance.
   */
  handleValidationFailure(uid, request, assignment) {
    // Abort flag prevents further processing if critical backend errors have occurred

    if (!this.retryAttempts[uid]) {
      this.retryAttempts[uid] = 0;
    }

    if (this.retryAttempts[uid] < this.maxValidationRetries) {
      this.retryAttempts[uid]++;
      this.progressTracker.logError('Validation failed for UID: ' + uid + '. Retrying attempt ' + this.retryAttempts[uid] + ' of ' + this.maxValidationRetries + '.');

      const retryResponse = this.sendRequestWithRetries(request, 3);


      if (retryResponse && (retryResponse.getResponseCode() === 200 || retryResponse.getResponseCode() === 201)) {
        try {
          const responseData = JSON.parse(retryResponse.getContentText());
          const assessmentDataRaw = JSON.parse(responseData.outputs[0].outputs[0].messages[0].message);
          const assessmentData = Utils.normaliseKeysToLowerCase(assessmentDataRaw);

          if (this.validateAssessmentData(assessmentData)) {
            const assessment = this.createAssessmentFromData(assessmentData);
            this.assignAssessmentToStudentTask(uid, assessment, assignment);
            const studentTask = this.findStudentTaskByUid(uid, assignment);
            if (studentTask) {
              const taskKey = this.findTaskKeyByUid(uid, studentTask);
              const task = assignment.tasks[taskKey];
              if (task) {
                const studentResponse = studentTask.responses[taskKey].response;
                this.cacheManager.setCachedAssessment(task.taskReference, studentResponse, assessmentData);
              }
            }
            this.retryAttempts[uid] = 0; // Reset after successful retry
          } else {
            this.progressTracker.logError('Invalid assessment data for UID: ' + uid + '. Assessment data object: ' + JSON.stringify(assessmentData));
            this.handleValidationFailure(uid, request, assignment);
          }
        } catch (e) {
          this.progressTracker.logError('Error parsing retry response for UID: ' + uid + ' - ' + e.message, e);
          this.handleValidationFailure(uid, request, assignment);
        }
      } else {
        this.progressTracker.logError('Retry failed for UID: ' + uid);
        Utils.toastMessage('Failed to process assessment for UID: ' + uid, 'Error', 5);
      }
    } else {
      this.progressTracker.logError('Max validation retries reached for UID: ' + uid + '.');
      Utils.toastMessage('Failed to process assessment for UID: ' + uid, 'Error', 5);
    }
  }


  /**
   * Validates the structure of the assessment data returned by the LLM.
   * @param {Object} data - The assessment data.
   * @return {boolean} - True if valid, false otherwise.
   */
  validateAssessmentData(data) {
    const requiredCriteria = ['completeness', 'accuracy', 'spag'];
    return requiredCriteria.every(criterion =>
      data.hasOwnProperty(criterion) &&
      typeof data[criterion].score === 'number' &&
      typeof data[criterion].reasoning === 'string'
    );
  }

  /**
   * Sends requests to Langflow and processes the responses, adding them assessment data to the assignment object.
   * @param {Object[]} requests - an array of request objects to send
   * @param {Object} assignment - The Assignment instance containing StudentTasks.
   * @return {void}
   */
  processStudentResponses(requests, assignment) {
    if (!requests || requests.length === 0) {
      console.log("No requests to send.");
      return;
    }
    console.log(`Sending student responses in batches of ${this.configManager.getBatchSize()}.`)

    // Use BaseRequestManager's sendRequestsInBatches method
    const responses = this.sendRequestsInBatches(requests);

    // Process responses
    this.processResponses(responses, requests, assignment);
  }

  /**
   * Creates an Assessment instance from LLM data.
   * @param {Object} data - The assessment data from LLM.
   * @return {Object} - An object mapping criteria to Assessment instances.
   */
  createAssessmentFromData(data) {
    // Assuming uniform criteria; adjust if criteria vary
    const assessments = {};
    for (const [criterion, details] of Object.entries(data)) {
      assessments[criterion] = new Assessment(details.score, details.reasoning);
    }
    return assessments;
  }

  /**
   * Assigns the assessment to the corresponding StudentTask based on UID.
   * @param {string} uid - The unique identifier of the response.
   * @param {Object} assessmentData - The assessment data to assign.
   * @param {Assignment} assignment - The Assignment instance.
   */
  assignAssessmentToStudentTask(uid, assessmentData, assignment) {
    // Iterate through studentTasks to find the matching UID
    for (const studentTask of assignment.studentTasks) {
      for (const [taskKey, response] of Object.entries(studentTask.responses)) {
        if (response.uid === uid) {
          // Assign each criterion's assessment
          for (const [criterion, assessment] of Object.entries(assessmentData)) {
            studentTask.addAssessment(taskKey, criterion, assessment);
          }
          return; // Assessment assigned; exit the function
        }
      }
    }
    console.warn(`No matching StudentTask found for UID: ${uid}`);
  }

  /**
   * Finds the StudentTask instance by UID.
   * @param {string} uid - The unique identifier of the response.
   * @param {Assignment} assignment - The Assignment instance.
   * @return {StudentTask|null} - The matching StudentTask or null if not found.
   */
  findStudentTaskByUid(uid, assignment) {
    for (const studentTask of assignment.studentTasks) {
      for (const response of Object.values(studentTask.responses)) {
        if (response.uid === uid) {
          return studentTask;
        }
      }
    }
    return null;
  }

  /**
   * Finds the task key within a StudentTask by UID.
   * @param {string} uid - The unique identifier of the response.
   * @param {StudentTask} studentTask - The StudentTask instance.
   * @return {string|null} - The task key or null if not found.
   */
  findTaskKeyByUid(uid, studentTask) {
    for (const [taskKey, response] of Object.entries(studentTask.responses)) {
      if (response.uid === uid) {
        return taskKey;
      }
    }
    return null;
  }

  /**
   * Creates a default assessment for unattempted tasks.
   * @return {Object} - An object with default assessments for each criterion.
   */
  createNotAttemptedAssessment() {
    const criteria = ['completeness', 'accuracy', 'spag'];
    const assessments = {};
    
    criteria.forEach(criterion => {
      assessments[criterion] = new Assessment("N", "Task not attempted");
    });
    
    return assessments;
  }

  /**
   * Handle HTTP errors from backend, including 400 and 401 cases.
   * @param {HTTPResponse} response - The HTTP response object.
   * @param {string} uid - The UID of the request for logging.
   */
  _handleHttpError(response, uid) {
    const code = response ? response.getResponseCode() : null;
    const text = response ? response.getContentText() : 'No response';
    if (code === 401) {
      // Unauthorized: invalid API key, abort script
      this.progressTracker.logAndThrowError(
        `Unauthorized (401) for UID: ${uid}. Invalid API key. Aborting script.`,
        text
      );
      return;
    }
    if (code === 400) {
      // Bad request: skip and log
      console.warn(`Bad Request (400) for UID: ${uid}. Skipping request. Response: ${text}`);
      this.progressTracker.logError(
        `Bad Request (400) for UID: ${uid}. Payload invalid.`,
        text
      );
      return;
    }
    // Other errors: log and continue
    this.progressTracker.logError(
      `HTTP error for UID: ${uid} - Code: ${code}`,
      text
    );
    this.progressTracker.updateProgress(
      `Failed to process assessment for UID: ${uid}`,
      false
    );
  }

  /**
   * Process a single HTTP response, handling success or passing errors to _handleHttpError.
   * @param {HTTPResponse|null} response - The HTTP response object.
   * @param {Object} request - The original request object.
   * @param {Assignment} assignment - The Assignment instance.
   */
  _processSingleResponse(response, request, assignment) {
    const uid = request.uid;
    const code = response ? response.getResponseCode() : null;
    if (code === 200 || code === 201) {
      // Successful response
      this.componentBuildErrorCount = 0;
      try {
        const assessmentData = this._extractAssessmentData(response);
        if (this.validateAssessmentData(assessmentData)) {
          this._assignAndCacheAssessment(uid, assessmentData, request, assignment);
          this.retryAttempts[uid] = 0;
        } else {
          this.handleValidationFailure(uid, request, assignment);
        }
      } catch (e) {
        this.progressTracker.logError(
          `Error parsing response for UID: ${uid} - ${e.message}`,
          e
        );
        this.handleValidationFailure(uid, request, assignment);
      }
    } else {
      // HTTP error or no response
      this._handleHttpError(response, uid);
    }
  }

  /**
   * Extracts and parses assessment data from an HTTPResponse.
   * @param {HTTPResponse} response
   * @return {Object} Normalized assessment data.
   */
  _extractAssessmentData(response) {
    // Parse direct JSON payload from new /v1/assessor API
    const text = response.getContentText();
    const data = JSON.parse(text);
    return Utils.normaliseKeysToLowerCase(data);
  }

  /**
   * Assigns assessments to StudentTask and caches the result.
   * @param {string} uid
   * @param {Object} assessmentData
   * @param {Object} request
   * @param {Assignment} assignment
   */
  _assignAndCacheAssessment(uid, assessmentData, request, assignment) {
    // Assign to StudentTask
    this.assignAssessmentToStudentTask(uid, this.createAssessmentFromData(assessmentData), assignment);
    // Cache lookup and store
    const studentTask = this.findStudentTaskByUid(uid, assignment);
    if (studentTask) {
      const taskKey = this.findTaskKeyByUid(uid, studentTask);
      const task = assignment.tasks[taskKey];
      if (task) {
        const referenceHash = task.contentHash;
        const responseHash  = studentTask.responses[taskKey].contentHash;
        this.cacheManager.setCachedAssessment(
          referenceHash,
          responseHash,
          assessmentData
        );
      }
    }
  }
}
