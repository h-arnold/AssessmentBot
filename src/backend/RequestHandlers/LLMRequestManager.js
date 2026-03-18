/* eslint-disable no-magic-numbers */

/**
 * LLMRequestManager Class
 *
 * Manages the creation, caching, and sending of request objects to the LLM.
 */
const VALIDATION_RETRY_LIMIT = 3;
const LLM_TOAST_DURATION_SECONDS = 5;

/**
 * LLM request manager.
 */
class LLMRequestManager extends BaseRequestManager {
  /**
   * Initialises the LLMRequestManager with configuration, cache, progress tracking, and error handling.
   */
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
   * Generates an array of request objects based on the Assignment instance.
   * Utilises caching to avoid redundant requests.
   * @param {Assignment} assignment - The Assignment instance containing student tasks.
   * @returns {Object[]} An array of request objects ready to be sent via UrlFetchApp.fetchAll().
   */
  generateRequestObjects(assignment) {
    const requests = [];
    let cacheHits = 0;
    let newRequests = 0;
    let notAttemptedCount = 0;
    // Build uid -> { submission, item, taskDefinition } map for response routing.
    // Retain taskDef alias for existing callers and tests during the migration.
    this.uidIndex = {}; // reset per generation
    const baseUrl = this.configManager.getBackendUrl();
    const apiKey = this.configManager.getApiKey();

    assignment.submissions.forEach((submission) => {
      const tasks = assignment.assignmentDefinition.tasks;
      Object.values(submission.items).forEach((item) => {
        const taskDefinition = tasks[item.taskId];
        if (!taskDefinition) {
          this.progressTracker.logError('No TaskDefinition for taskId ' + item.taskId);
          return;
        }
        const type = item.getType();
        // Skip spreadsheet tasks (handled by Sheets assessor elsewhere)
        if (type === 'SPREADSHEET') return;
        const referenceTask = taskDefinition.getPrimaryReference();
        const templateTask = taskDefinition.getPrimaryTemplate();
        if (!referenceTask || !templateTask) {
          this.progressTracker.logError(
            'Missing reference/template artifacts for taskId ' + item.taskId
          );
          return;
        }
        const studentArtifact = item.artifact;

        // Not attempted detection: submission hash equals template hash
        if (
          studentArtifact.contentHash === templateTask.contentHash ||
          studentArtifact.content === ''
        ) {
          const notAttempted = this.createNotAttemptedAssessment();
          this._assignAssessmentArtifacts(item, notAttempted);
          notAttemptedCount++;
          return;
        }

        // Cache lookup using reference & student hashes
        const referenceTaskHash = referenceTask.contentHash;
        const studentResponseHash = studentArtifact.contentHash;
        if (referenceTaskHash && studentResponseHash) {
          const cached = this.cacheManager.getCachedAssessment(
            referenceTaskHash,
            studentResponseHash
          );
          if (cached) {
            this._assignAssessmentArtifacts(item, cached);
            cacheHits++;
            return;
          }
        }

        const uid = studentArtifact.getUid();
        this.uidIndex[uid] = {
          submission,
          item,
          taskDefinition,
          taskDef: taskDefinition,
        };
        const payload = {
          taskType: type,
          reference: referenceTask.content,
          template: templateTask.content,
          studentResponse: studentArtifact.content,
        };
        requests.push({
          uid,
          url: `${baseUrl}/v1/assessor`,
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          headers: { Authorization: `Bearer ${apiKey}` },
          muteHttpExceptions: true,
        });
        newRequests++;
      });
    });
    ABLogger.getInstance().info(
      `Generated ${requests.length} request objects for LLM (cache hits: ${cacheHits}, new requests: ${newRequests}, not attempted: ${notAttemptedCount}).`
    );
    return requests;
  }

  /**
   * Processes the responses from the LLM and assigns assessments to StudentTasks.
   * Also caches successful assessments.
   * @param {HTTPResponse[]} responses - Array of HTTPResponse objects from UrlFetchApp.fetchAll().
   * @param {Object[]} requests - Array of request objects sent in the current batch.
   * @param {Assignment} assignment - The Assignment instance containing StudentTasks.
   * @returns {void}
   */
  processResponses(responses, requests, assignment) {
    this.progressTracker.updateProgress(`Double-checking all assessments.`, true);

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
    if (!this.retryAttempts[uid]) this.retryAttempts[uid] = 0;

    if (this.retryAttempts[uid] >= this.maxValidationRetries) {
      this._handleRetryLimitReached(uid);
      return;
    }

    this.retryAttempts[uid]++;
    this._logValidationRetry(uid);

    const retryResponse = this.sendRequestWithRetries(request, VALIDATION_RETRY_LIMIT);
    if (!this._isSuccessfulResponse(retryResponse)) {
      this._handleRetryHttpFailure(uid);
      return;
    }

    this._processRetryResponse(uid, request, assignment, retryResponse);
  }

  /**
   * Validates the structure of the assessment data returned by the LLM.
   * @param {Object} data - The assessment data.
   * @returns {boolean} True if valid, false otherwise.
   */
  validateAssessmentData(data) {
    const requiredCriteria = ['completeness', 'accuracy', 'spag'];
    return requiredCriteria.every(
      (criterion) =>
        data.hasOwnProperty(criterion) &&
        typeof data[criterion].score === 'number' &&
        Validate.isString(data[criterion].reasoning)
    );
  }

  /**
   * Sends requests to Langflow and processes the responses, adding assessment data to the assignment object.
   * @param {Object[]} requests - An array of request objects to send.
   * @param {Object} assignment - The Assignment instance containing StudentTasks.
   * @returns {void}
   */
  processStudentResponses(requests, assignment) {
    if (!requests || requests.length === 0) {
      ABLogger.getInstance().info('No requests to send.');
      return;
    }
    ABLogger.getInstance().info(
      `Sending student responses in batches of ${this.configManager.getBackendAssessorBatchSize()}.`
    );

    // Use BaseRequestManager's sendRequestsInBatches method
    const responses = this.sendRequestsInBatches(requests);

    // Process responses
    this.processResponses(responses, requests, assignment);
  }

  /**
   * Creates an Assessment instance from LLM data.
   * @param {Object} data - The assessment data from LLM.
   * @returns {Object} An object mapping criteria to Assessment instances.
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
   * Assigns assessments to the mapped StudentSubmissionItem via uidIndex.
   * @param {string} uid - The unique identifier for the submission.
   * @param {Object} assessmentData - Assessment data (criterion -> Assessment instance).
   * @returns {void}
   */
  assignAssessmentToStudentTask(uid, assessmentData) {
    // name retained to minimise external ripple
    const item = this.uidIndex?.[uid]?.item;
    if (item) {
      this._assignAssessmentArtifacts(item, assessmentData);
    } else {
      console.warn(`No matching submission item found for UID: ${uid}`);
    }
  }

  /**
   * Assigns assessments to a StudentSubmissionItem.
   * @param {Object} item - The StudentSubmissionItem to assign assessments to.
   * @param {Object} assessmentData - Assessment data mapping criteria to Assessment instances.
   * @returns {void}
   */
  _assignAssessmentArtifacts(item, assessmentData) {
    for (const [criterion, assessment] of Object.entries(assessmentData)) {
      item.addAssessment(criterion, assessment);
    }
  }

  /**
   * Checks if an HTTP response indicates successful completion.
   * @param {HTTPResponse} response - The HTTP response to check.
   * @returns {boolean} True if the response indicates success.
   */
  _isSuccessfulResponse(response) {
    if (!response) return false;
    const code = response.getResponseCode();
    return (
      code === BaseRequestManager.HTTP_STATUS_OK || code === BaseRequestManager.HTTP_STATUS_CREATED
    );
  }

  /**
   * Logs a validation retry attempt for a submission.
   * @param {string} uid - The unique identifier of the submission.
   * @returns {void}
   */
  _logValidationRetry(uid) {
    this.progressTracker.logError(
      'Validation failed for UID: ' +
        uid +
        '. Retrying attempt ' +
        this.retryAttempts[uid] +
        ' of ' +
        this.maxValidationRetries +
        '.'
    );
  }

  /**
   * Handles the case where retry limit has been reached for a submission.
   * @param {string} uid - The unique identifier of the submission.
   * @returns {void}
   */
  _handleRetryLimitReached(uid) {
    this.progressTracker.logError('Max validation retries reached for UID: ' + uid + '.');
    Utils.toastMessage(
      'Failed to process assessment for UID: ' + uid,
      'Error',
      LLM_TOAST_DURATION_SECONDS
    );
  }

  /**
   * Handles HTTP failure during retry attempt.
   * @param {string} uid - The unique identifier of the submission.
   * @returns {void}
   */
  _handleRetryHttpFailure(uid) {
    this.progressTracker.logError('Retry failed for UID: ' + uid);
    Utils.toastMessage(
      'Failed to process assessment for UID: ' + uid,
      'Error',
      LLM_TOAST_DURATION_SECONDS
    );
  }

  /**
   * Process a retry response, reassigning and caching the assessment or triggering another retry.
   * @param {string} uid - UID for routing the assessment.
   * @param {Object} request - Original HTTP request data.
   * @param {Assignment} assignment - Assignment instance for error handling.
   * @param {HTTPResponse} response - HTTP response that triggered the retry.
   */
  _processRetryResponse(uid, request, assignment, response) {
    try {
      const assessmentData = this._extractAssessmentData(response);
      if (!this.validateAssessmentData(assessmentData)) {
        this.progressTracker.logError(
          'Invalid assessment data for UID: ' +
            uid +
            '. Assessment data object: ' +
            JSON.stringify(assessmentData)
        );
        this.handleValidationFailure(uid, request, assignment);
        return;
      }

      this._assignAndCacheAssessment(uid, assessmentData);
      this.retryAttempts[uid] = 0;
    } catch (error) {
      this.progressTracker.logError(
        'Error parsing retry response for UID: ' + uid + ' - ' + error.message,
        error
      );
      this.handleValidationFailure(uid, request, assignment);
    }
  }

  // Removed legacy findStudentTaskByUid & findTaskKeyByUid (StudentTask model deprecated)

  /**
   * Creates a default assessment for unattempted tasks.
   * @returns {Object} An object with default assessments for each criterion.
   */
  createNotAttemptedAssessment() {
    const criteria = ['completeness', 'accuracy', 'spag'];
    const assessments = {};

    criteria.forEach((criterion) => {
      assessments[criterion] = new Assessment('N', 'Task not attempted');
    });

    return assessments;
  }

  /**
   * Handle HTTP errors from backend, including 400, 401, and 403 cases.
   * @param {HTTPResponse} response - The HTTP response object.
   * @param {string} uid - The UID of the request for logging.
   */
  _handleHttpError(response, uid) {
    const code = response ? response.getResponseCode() : null;
    const text = response ? response.getContentText() : 'No response';
    if (code === 401) {
      // Unauthorised: invalid API key, abort script
      this.progressTracker.logAndThrowError(
        `Unauthorised (401) for UID: ${uid}. Invalid API key. Aborting script.`,
        text
      );
      return;
    }
    if (code === 403) {
      // Forbidden: insufficient permissions, abort script
      this.progressTracker.logAndThrowError(
        `Forbidden (403) for UID: ${uid}. Check API key permissions. Aborting script.`,
        text
      );
      return;
    }
    if (code === 400) {
      // Bad request: skip and log
      console.warn(`Bad Request (400) for UID: ${uid}. Skipping request. Response: ${text}`);
      this.progressTracker.logError(`Bad Request (400) for UID: ${uid}. Payload invalid.`, text);
      return;
    }
    if (code === 413) {
      // Payload too large: skip and log
      console.warn(`Payload Too Large (413) for UID: ${uid}. Skipping request. Response: ${text}`);
      this.progressTracker.logError(
        `Payload Too Large (413) for UID: ${uid}. Request body exceeds size limit.`,
        text
      );
      return;
    }
    // Other errors: log and continue
    this.progressTracker.logError(`HTTP error for UID: ${uid} - Code: ${code}`, text);
    this.progressTracker.updateProgress(`Failed to process assessment for UID: ${uid}`, false);
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
    if (
      code === BaseRequestManager.HTTP_STATUS_OK ||
      code === BaseRequestManager.HTTP_STATUS_CREATED
    ) {
      // Successful response
      this.componentBuildErrorCount = 0;
      try {
        const assessmentData = this._extractAssessmentData(response);
        if (this.validateAssessmentData(assessmentData)) {
          this._assignAndCacheAssessment(uid, assessmentData);
          this.retryAttempts[uid] = 0;
        } else {
          this.handleValidationFailure(uid, request, assignment);
        }
      } catch (error) {
        this.progressTracker.logError(
          `Error parsing response for UID: ${uid} - ${error.message}`,
          error
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
   * @param {HTTPResponse} response - The HTTP response containing the assessment data.
   * @returns {Object} Normalised assessment data.
   */
  _extractAssessmentData(response) {
    // Parse direct JSON payload from new /v1/assessor API
    const text = response.getContentText();
    const data = JSON.parse(text);
    return Utils.normaliseKeysToLowerCase(data);
  }

  /**
   * Assigns assessments to StudentTask and caches the result.
   * @param {string} uid - The unique identifier of the submission.
   * @param {Object} assessmentData - The assessment data to assign and cache.
   * @returns {void}
   */
  _assignAndCacheAssessment(uid, assessmentData) {
    this.assignAssessmentToStudentTask(uid, this.createAssessmentFromData(assessmentData));
    if (this.uidIndex?.[uid]) {
      const { item, taskDefinition } = this.uidIndex[uid];
      const reference = taskDefinition.getPrimaryReference();
      const referenceHash = reference?.contentHash;
      const respHash = item.artifact?.contentHash;
      if (referenceHash && respHash) {
        this.cacheManager.setCachedAssessment(referenceHash, respHash, assessmentData);
      }
    }
  }
}

// Export for Node/Vitest environment
if (typeof module !== 'undefined') {
  module.exports = LLMRequestManager;
}
