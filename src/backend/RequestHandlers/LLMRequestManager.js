/* eslint-disable no-magic-numbers */

/**
 * LLMRequestManager Class
 *
 * Manages the creation, caching, and sending of request objects to the LLM.
 */
const LLM_CACHE_KEY_VERSION = 'v1';
const LLM_ACCEPTED_STATUSES = [200, 201];
const LLM_STOP_STATUSES = [401, 403, 404];
const LLM_TOO_MANY_REQUESTS = 429;
const LLM_RETRYABLE_SERVER_MIN = 500;
const LLM_RETRYABLE_SERVER_MAX = 599;
const LLM_CRITERIA = ['completeness', 'accuracy', 'spag'];
const LLM_ERROR_STAGE = 'assessment';

/**
 * LLM request manager.
 */
class LLMRequestManager extends BaseRequestManager {
  /**
   * Initialises the LLMRequestManager with configuration, cache and progress tracking.
   */
  constructor() {
    super();
    this.progressTracker = ProgressTracker.getInstance();
    this.cacheManager = new CacheManager(); // Generic cache owner; identity lives here.
    /** @type {boolean} Whether this processing invocation received an LLM run-stop. */
    this.runStopped = false;
    /** @type {Map<string, number>} Attempt provenance per routed outcome, reset per run. */
    this._routedOutcomeAttempts = new Map();
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
    let notAttemptedCount = 0;
    // Build uid -> { submission, item, taskDefinition, cacheKey } map for response
    // routing and writeback. Reset per generation.
    this.uidIndex = {};
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
        // A prior terminal error is preserved verbatim: never dispatch or overwrite it.
        if (this._hasTerminalError(item)) return;
        const referenceTask = taskDefinition.getPrimaryReference();
        const templateTask = taskDefinition.getPrimaryTemplate();
        if (!referenceTask || !templateTask) {
          this.progressTracker.logError(
            'Missing reference/template artifacts for taskId ' + item.taskId
          );
          return;
        }
        const studentArtifact = item.artifact;
        // Stored content must carry a usable fingerprint for every role. This is an
        // internal invariant fault: it fails loudly before any cache lookup or LLM
        // dispatch, never falling back to live marking, a new assessment error or a
        // false not-attempted result.
        this._requireUsableHashes(item, referenceTask, templateTask, studentArtifact);

        // Not attempted detection: submission hash equals template hash, or blank work
        if (
          studentArtifact.contentHash === templateTask.contentHash ||
          studentArtifact.content === ''
        ) {
          const notAttempted = this.createNotAttemptedAssessment();
          this._assignAssessmentArtifacts(item, notAttempted);
          notAttemptedCount++;
          return;
        }

        // Versioned cache identity: task type plus reference/template/student hashes.
        const cacheKey = this._buildCacheKey(type, referenceTask, templateTask, studentArtifact);
        const cached = this.cacheManager.get(cacheKey);
        if (cached !== null && cached !== undefined) {
          if (this.validateAssessmentData(cached)) {
            this._assignAssessmentArtifacts(item, this.createAssessmentFromData(cached));
            cacheHits++;
            return;
          }
          // Malformed hit: one bounded structural diagnostic, then a real live request below.
          ABLogger.getInstance().warn('Discarding invalid cached assessment result.', { cacheKey });
        }

        const uid = studentArtifact.getUid();
        if (Object.hasOwn(this.uidIndex, uid)) {
          throw new Error(`Duplicate generated LLM request UID: ${uid}`);
        }
        this.uidIndex[uid] = { submission, item, taskDefinition, cacheKey };
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
      });
    });
    ABLogger.getInstance().info(
      `Generated ${requests.length} request objects for LLM (cache hits: ${cacheHits}, new requests: ${requests.length}, not attempted: ${notAttemptedCount}).`
    );
    return requests;
  }

  /**
   * Validates the structure of a successful LLM or cached assessment result. Requires
   * exactly the three canonical criterion keys as own properties (inherited or extra
   * keys are invalid), each reusing the Assessment result union through
   * isValidRawResult: a finite numeric score in inclusive range 0-5, a required
   * string reasoning, and no error metadata on a numeric result. Unrelated permissible
   * entry metadata is allowed.
   * @param {Object} data - The assessment data.
   * @returns {boolean} True if valid, false otherwise.
   */
  validateAssessmentData(data) {
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      Object.keys(data).length !== LLM_CRITERIA.length ||
      LLM_CRITERIA.some((criterion) => !Object.hasOwn(data, criterion))
    ) {
      return false;
    }
    return LLM_CRITERIA.every((criterion) => {
      const entry = data[criterion];
      return Assessment.isValidRawResult(entry) && typeof entry.score === 'number';
    });
  }

  /**
   * Sends requests to the LLM service and processes the responses, adding assessment
   * data to the assignment object. Every dispatched outcome is terminal; when the run
   * stops, never-dispatched eligible items are terminalised without further HTTP.
   * @param {Object[]} requests - An array of request objects to send.
   * @param {Object} assignment - The Assignment instance containing StudentTasks.
   * @returns {void}
   */
  processStudentResponses(requests, assignment) {
    this.runStopped = false;
    this._routedOutcomeAttempts = new Map();
    if (!requests || requests.length === 0) {
      ABLogger.getInstance().info('No requests to send.');
      return;
    }
    Validate.requireParams({ requests, assignment }, 'processStudentResponses');
    const requestByUid = new Map();
    requests.forEach((request) => {
      if (requestByUid.has(request.uid))
        throw new Error(`Duplicate LLM request UID: ${request.uid}`);
      requestByUid.set(request.uid, request);
    });
    const processedUids = new Set();
    this.sendRequestsInBatches(requests, {
      batchSize: this.configManager.getBackendAssessorBatchSize(),
      acceptedStatuses: LLM_ACCEPTED_STATUSES,
      stopStatuses: LLM_STOP_STATUSES,
      onBatchComplete: (outcomes) => {
        if (
          outcomes.some(
            ({ response }) => response && LLM_STOP_STATUSES.includes(response.getResponseCode())
          )
        ) {
          this.runStopped = true;
        }
        const seen = new Set();
        const routed = outcomes.map((outcome) => {
          if (!requestByUid.has(outcome.uid) || seen.has(outcome.uid)) {
            throw new Error(`Unknown or duplicate LLM outcome UID: ${outcome.uid}`);
          }
          seen.add(outcome.uid);
          return { outcome, request: requestByUid.get(outcome.uid) };
        });
        routed.sort((left, right) => {
          return (
            Number(LLM_ACCEPTED_STATUSES.includes(right.outcome.response?.getResponseCode?.())) -
            Number(LLM_ACCEPTED_STATUSES.includes(left.outcome.response?.getResponseCode?.()))
          );
        });
        this.progressTracker.updateProgress('Double-checking all assessments.', true);
        routed.forEach(({ outcome, request }) => {
          processedUids.add(outcome.uid);
          // The full outcome is available here: retain its attempt provenance so the
          // terminal mapping can distinguish stop-cancelled work from exhaustion.
          this._routedOutcomeAttempts.set(outcome.uid, outcome.attempts);
          this._processSingleResponse(outcome.response, request, assignment);
        });
        // Exactly false stops the shared sender: no later batch is dispatched, while
        // every response already received in this batch has been processed above.
        return !this.runStopped;
      },
    });
    if (this.runStopped) this._terminaliseUnprocessedItems(processedUids);
  }

  /**
   * Terminalises every eligible item whose outcome was never routed after a run stop,
   * without any further HTTP dispatch. Earlier-batch and same-batch outcomes, cached
   * results and not-attempted results are never touched. A missing generated route
   * map, entry or item is an internal wiring fault that fails loudly.
   * @param {Set<string>} processedUids - UIDs whose outcomes were already routed.
   * @returns {void}
   * @throws {Error} When the generated route state is missing or incomplete.
   * @private
   */
  _terminaliseUnprocessedItems(processedUids) {
    if (!this.uidIndex) {
      throw new Error('LLM generated route map is missing; cannot terminalise unprocessed items.');
    }
    Object.entries(this.uidIndex).forEach(([uid, entry]) => {
      if (!entry || !entry.item) {
        throw new Error(`LLM generated route entry or item is missing for UID: ${uid}`);
      }
      if (!processedUids.has(uid)) {
        entry.item.setError(LLM_ERROR_STAGE, 'LLM_RUN_STOPPED');
      }
    });
  }

  /**
   * Creates an Assessment instance from LLM data.
   * @param {Object} data - The assessment data from LLM.
   * @returns {Object} An object mapping criteria to Assessment instances.
   */
  createAssessmentFromData(data) {
    const assessments = {};
    for (const [criterion, details] of Object.entries(data)) {
      assessments[criterion] = new Assessment(details.score, details.reasoning);
    }
    return assessments;
  }

  /**
   * Assigns assessments to the mapped StudentSubmissionItem via uidIndex. A missing
   * routed entry or item is an internal wiring fault that fails loudly and never
   * caches an apparent success.
   * @param {string} uid - The unique identifier for the submission.
   * @param {Object} assessmentData - Assessment data (criterion -> Assessment instance).
   * @returns {void}
   * @throws {Error} When no routed item exists for the UID.
   */
  assignAssessmentToStudentTask(uid, assessmentData) {
    const entry = this.uidIndex?.[uid];
    if (!entry || !entry.item) {
      throw new Error(`No routed submission item for LLM UID: ${uid}`);
    }
    this._assignAssessmentArtifacts(entry.item, assessmentData);
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
   * Creates a default assessment for unattempted tasks.
   * @returns {Object} An object with default assessments for each criterion.
   */
  createNotAttemptedAssessment() {
    const assessments = {};

    LLM_CRITERIA.forEach((criterion) => {
      assessments[criterion] = new Assessment('N', 'Task not attempted');
    });

    return assessments;
  }

  /**
   * Checks whether an item already carries the atomic all-three terminal error left by
   * an earlier stage, which must be preserved without dispatch or overwrite.
   * @param {Object} item - The StudentSubmissionItem to inspect.
   * @returns {boolean} True when all three canonical criteria are explicit E results.
   * @private
   */
  _hasTerminalError(item) {
    const existing = item.getAssessment();
    return (
      Boolean(existing) && LLM_CRITERIA.every((criterion) => existing[criterion]?.score === 'E')
    );
  }

  /**
   * Fails loudly when stored reference/template/student content carries no usable
   * contentHash. Null-hash equality must never establish a not-attempted result.
   * @param {Object} item - The StudentSubmissionItem under consideration.
   * @param {Object} referenceTask - The task's primary reference artefact.
   * @param {Object} templateTask - The task's primary template artefact.
   * @param {Object} studentArtifact - The student's artefact.
   * @returns {void}
   * @throws {Error} With the offending role named, before any cache lookup or dispatch.
   * @private
   */
  _requireUsableHashes(item, referenceTask, templateTask, studentArtifact) {
    [
      ['reference', referenceTask],
      ['template', templateTask],
      ['student', studentArtifact],
    ].forEach(([role, artifact]) => {
      if (typeof artifact.contentHash !== 'string' || artifact.contentHash.length === 0) {
        throw new Error(
          `Stored ${role} content has no usable contentHash for taskId ${item.taskId}.`
        );
      }
    });
  }

  /**
   * Builds the versioned assessment cache identity from the task type and the
   * reference, template and student content hashes. Old key spaces are simply misses.
   * @param {string} taskType - The task artifact type.
   * @param {Object} referenceTask - The task's primary reference artefact.
   * @param {Object} templateTask - The task's primary template artefact.
   * @param {Object} studentArtifact - The student's artefact.
   * @returns {string} The versioned opaque cache key.
   * @private
   */
  _buildCacheKey(taskType, referenceTask, templateTask, studentArtifact) {
    const raw = [
      LLM_CACHE_KEY_VERSION,
      taskType,
      referenceTask.contentHash,
      templateTask.contentHash,
      studentArtifact.contentHash,
    ].join('|');
    return Utils.generateHash(raw);
  }

  /**
   * Processes one final outcome, assigning the terminal result for its routed item.
   * Successful responses are read, parsed, normalised and validated once; invalid
   * values terminalise atomically as LLM_INVALID_RESPONSE with no semantic retry.
   * Non-accepted outcomes require valid attempt provenance — a positive integer
   * within the shared budget — before their catalogue mapping; missing or invalid
   * provenance throws before any mutation. Native-read wiring, programming and
   * non-Error faults propagate with original identity outside the parse catch;
   * routing, normalisation, mutation, cache wiring and serialisation faults are never
   * swallowed either.
   * @param {Object|null} response - The HTTP response object, or null for a network failure.
   * @param {Object} request - The original request object.
   * @param {Object} assignment - The Assignment instance.
   * @returns {void}
   */
  _processSingleResponse(response, request, assignment) {
    const uid = request.uid;
    const entry = this.uidIndex?.[uid];
    if (!entry) {
      throw new Error(`Unknown LLM outcome UID: ${uid}`);
    }
    const item = entry.item;
    const code = response ? response.getResponseCode() : null;
    if (code === null || !LLM_ACCEPTED_STATUSES.includes(code)) {
      const attempts = this._routedOutcomeAttempts.get(uid);
      if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > this.maxAttempts)
        throw new Error(`Missing or invalid routed attempt provenance for UID: ${uid}`);
      item.setError(LLM_ERROR_STAGE, this._terminalCodeFor(code, attempts));
      return;
    }
    const text = response.getContentText();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Expected bad service input: an unparseable body is terminal, never a retry.
      // The native body read above sits outside this catch, so reader wiring and
      // programming faults propagate with their original identity.
      this._rejectInvalidResponse(uid, item, 'unparseable JSON body');
      return;
    }
    // Reject non-object roots and raw criterion keys that are not admissible
    // case-insensitive canonical identities BEFORE normalisation can erase
    // inherited-key, extra-key or colliding case-variant evidence. Normaliser,
    // validation and mutation faults below still escape with original identity.
    if (!this._rawCriteriaAreAdmissible(parsed)) {
      this._rejectInvalidResponse(uid, item, 'invalid assessment structure');
      return;
    }
    const assessmentData = Utils.normaliseKeysToLowerCase(parsed);
    if (!this.validateAssessmentData(assessmentData)) {
      this._rejectInvalidResponse(uid, item, 'invalid assessment structure');
      return;
    }
    this._assignAndCacheAssessment(uid, assessmentData);
  }

  /**
   * Resolves the terminal catalogue code for one non-accepted final outcome. A stop
   * status terminalises the item (the run-wide latch is owned by the batch callback).
   * A retryable status or network failure means the shared budget was exhausted only
   * when the outcome shows the full attempt budget spent; with unspent budget the
   * shared engine's pending work was cancelled by a run stop, so the item is affected
   * remaining eligible work and terminalises as LLM_RUN_STOPPED. The range mirrors the
   * shared engine's retry classification for outcome mapping only — the retry/backoff
   * decisions remain owned by the shared engine.
   * @param {number|null} code - The final HTTP status, or null for a network failure.
   * @param {number} attempts - Attempt provenance carried by the final outcome.
   * @returns {string} The catalogue error code.
   * @private
   */
  _terminalCodeFor(code, attempts) {
    if (LLM_STOP_STATUSES.includes(code)) return 'LLM_RUN_STOPPED';
    const isRetryable =
      code === null ||
      code === LLM_TOO_MANY_REQUESTS ||
      (code >= LLM_RETRYABLE_SERVER_MIN && code <= LLM_RETRYABLE_SERVER_MAX);
    if (!isRetryable) return 'LLM_HTTP_FAILED';
    return attempts >= this.maxAttempts ? 'LLM_UNAVAILABLE' : 'LLM_RUN_STOPPED';
  }

  /**
   * Applies the atomic invalid-response outcome with one bounded structural diagnostic.
   * @param {string} uid - The opaque request UID for correlation.
   * @param {Object} item - The StudentSubmissionItem to terminalise.
   * @param {string} detail - Short structural reason; never raw payload content.
   * @returns {void}
   * @private
   */
  _rejectInvalidResponse(uid, item, detail) {
    ABLogger.getInstance().warn('LLM returned an invalid assessment response.', { uid, detail });
    item.setError(LLM_ERROR_STAGE, 'LLM_INVALID_RESPONSE');
  }

  /**
   * Checks a raw decoded service root before key normalisation. Non-object roots are
   * invalid, and every own raw key must be an admissible case-insensitive canonical
   * criterion with no colliding case variants, so normalisation can never silently
   * erase inherited-key, extra-key or duplicate-case evidence.
   * @param {Object} parsed - The decoded JSON payload.
   * @returns {boolean} True when the raw root's criterion keys are admissible.
   * @private
   */
  _rawCriteriaAreAdmissible(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    const loweredKeys = Object.keys(parsed).map((key) => key.toLowerCase());
    const canonical = new Set(LLM_CRITERIA);
    return (
      loweredKeys.every((key) => canonical.has(key)) &&
      new Set(loweredKeys).size === loweredKeys.length
    );
  }

  /**
   * Assigns assessments to the routed item and caches the validated result under the
   * retained generation-time cache key, passing the shared CacheManager TTL explicitly.
   * A missing retained cache key is an internal wiring fault that fails loudly instead
   * of pretending success; native cache-service failures stay best-effort inside the
   * generic put.
   * @param {string} uid - The unique identifier of the submission.
   * @param {Object} assessmentData - The validated assessment data to assign and cache.
   * @returns {void}
   * @throws {Error} When the routed entry has no retained cache key.
   * @private
   */
  _assignAndCacheAssessment(uid, assessmentData) {
    this.assignAssessmentToStudentTask(uid, this.createAssessmentFromData(assessmentData));
    const entry = this.uidIndex?.[uid];
    if (!entry?.cacheKey) {
      throw new Error(`Missing retained cache key for routed LLM UID: ${uid}`);
    }
    this.cacheManager.put(entry.cacheKey, assessmentData, CacheManager.CACHE_EXPIRY_SECONDS);
  }
}

// Export for Node/Vitest environment
if (typeof module !== 'undefined') {
  module.exports = LLMRequestManager;
}
