/* eslint-disable no-magic-numbers */

// Hostname admission limits mirroring the shared URL acceptance policy, kept
// owner-local (never a Validate change); see the class @remarks for the privacy rationale.
const IMAGE_HOSTNAME_MAX_LENGTH = 253;
const IMAGE_MIN_HOSTNAME_LABEL_COUNT = 2;
const IMAGE_HOSTNAME_LABEL_MAX_LENGTH = 63;
const IMAGE_IPV4_MAX_OCTET = 255;

/**
 * Image manager.
 *
 * Collects IMAGE artefacts, hydrates them through the shared transport owner
 * and writes blobs back onto the artefact models. A student image failure
 * becomes that task's atomic extraction IMAGE_HYDRATION_FAILED E with null
 * content/hash while healthy siblings survive; an item whose upstream
 * acquisition/extraction failure is already established is preserved
 * verbatim. A required shared reference/template failure blocks the run by
 * throwing and preserves prior saved results. Image downloads accept only
 * HTTP 200 with no stop statuses, so an image 403 is local and never an
 * LLM-wide stop; a matched pending image is valid internal state, never a
 * completed null success. Unmatched or duplicate UIDs, missing model methods
 * and other wiring faults throw; returned unusable blob/content/hash data
 * converts by scope, while thrown native-read, base64, hash and writer
 * faults escape by original identity.
 * @remarks URL admission is owner-local and privacy-safe: the shared Validate
 * acceptance policy applies without its progress-tracking diagnostics, so
 * rejected source URLs never reach a log channel.
 */
class ImageManager extends BaseRequestManager {
  /**
   * Initialises the ImageManager with configuration, progress tracking and
   * logging singletons, plus the empty submission-item hydration registry.
   */
  constructor() {
    super();
    this.apiKey =
      this.configManager && typeof this.configManager.getApiKey === 'function'
        ? this.configManager.getApiKey()
        : null;
    this.progressTracker = ProgressTracker.getInstance();
    /** @private @type {Map<string, Object>} Owning submission item by artefact UID. */
    this._submissionItemByUid = new Map();
  }

  /**
   * Return true when the passed object exposes a callable getType()
   * method and reports 'IMAGE'. Centralises the defensive check used
   * throughout this class for readability and a single point of change.
   * @param {any} artifact - The artifact object to check.
   * @returns {boolean} True if the artifact is an image artefact.
   */
  isImageArtifact(artifact) {
    return typeof artifact?.getType === 'function' && artifact.getType() === 'IMAGE';
  }

  /**
   * Decides whether an image source URL is admissible for download: the
   * shared Validate acceptance policy (HTTPS, DNS hostname only, no IP
   * address, no localhost, no port) without its progress-tracking
   * diagnostics.
   * @param {unknown} url - Candidate image source URL.
   * @returns {boolean} Whether the URL is admissible.
   * @private
   */
  _isAdmissibleImageUrl(url) {
    if (typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (trimmed.length === 0 || /\s/u.test(trimmed)) return false;
    const match = /^https:\/\/([\d.A-Za-z-]+)(?:[#/?]|$)/u.exec(trimmed);
    if (!match) return false;
    const hostname = match[1].toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.length === 0 ||
      this._isIPv4Hostname(hostname) ||
      hostname.length > IMAGE_HOSTNAME_MAX_LENGTH
    ) {
      return false;
    }
    const labels = hostname.split('.');
    return !(
      labels.length < IMAGE_MIN_HOSTNAME_LABEL_COUNT ||
      labels.some(
        (label) => label.length === 0 || label.length > IMAGE_HOSTNAME_LABEL_MAX_LENGTH
      ) ||
      labels.some((label) => label.startsWith('-') || label.endsWith('-')) ||
      labels.some((label) => !/^[\da-z-]+$/u.test(label))
    );
  }

  /**
   * Determines whether a hostname string is a valid dotted IPv4 address.
   * @param {string} hostname - Hostname candidate to test.
   * @returns {boolean} True when the hostname is an IPv4 address.
   * @private
   */
  _isIPv4Hostname(hostname) {
    const ipv4Exec = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u.exec(hostname);
    if (!ipv4Exec) return false;
    const octets = [ipv4Exec[1], ipv4Exec[2], ipv4Exec[3], ipv4Exec[4]].map(Number);
    return octets.every(
      (octet) => !Number.isNaN(octet) && octet >= 0 && octet <= IMAGE_IPV4_MAX_OCTET
    );
  }

  /**
   * Materialises the atomic task-wide hydration failure on one student item:
   * the model's setError replaces every criterion with the catalogue
   * extraction IMAGE_HYDRATION_FAILED E and clears stale feedback. A missing
   * model method is a wiring fault that throws before any state is cleared.
   * The diagnostic is bounded to opaque identifiers; source URLs, payloads
   * and raw error text are never logged.
   * @param {Object} item - The owning student submission item.
   * @param {string} message - Bounded diagnostic message.
   * @param {Object} diagnostic - Bounded metadata (uid, taskId, scope and,
   *   for transport failures, attempts/responseCode).
   * @returns {void}
   * @private
   */
  _materialiseHydrationFailure(item, message, diagnostic) {
    item.setError('extraction', 'IMAGE_HYDRATION_FAILED');
    item.artifact.content = null;
    item.artifact.contentHash = null;
    ABLogger.getInstance().warn(message, diagnostic);
  }

  /**
   * Collect all image artifacts (reference, template, submission) across the assignment.
   * Returns entries containing uid, `url` (metadata.sourceUrl), documentId, scope, taskId, and optional itemId.
   * A required shared reference/template image without an admissible source
   * URL or owning document blocks the run by throwing. A student image
   * without an admissible source URL materialises the scoped hydration
   * failure on its owning item instead of being collected; an item with an
   * established upstream terminal failure is preserved verbatim and never
   * collected.
   * @param {Assignment} assignment - The assignment containing tasks and submissions.
   * @returns {Array<{uid:string,url:string,documentId:string,scope:'reference'|'template'|'submission',taskId:string,itemId?:string}>} Array of image artefact entries.
   */
  collectAllImageArtifacts(assignment) {
    const results = [];
    this._submissionItemByUid.clear();
    const taskDefs = assignment.assignmentDefinition.tasks;
    // TaskDefinition artifacts (reference/template)
    Object.values(taskDefs).forEach((taskDefinition) => {
      ['reference', 'template'].forEach((role) => {
        taskDefinition.artifacts[role].forEach((artifact) => {
          if (!this.isImageArtifact(artifact)) {
            return;
          }
          const sourceUrl = artifact.metadata?.sourceUrl;
          const documentId =
            role === 'reference'
              ? assignment.assignmentDefinition.referenceDocumentId
              : assignment.assignmentDefinition.templateDocumentId;
          if (this._isAdmissibleImageUrl(sourceUrl) && documentId) {
            results.push({
              uid: artifact.getUid(),
              url: sourceUrl,
              documentId,
              scope: role,
              taskId: taskDefinition.id,
            });
            return;
          }
          // Already-hydrated shared artefacts need no download; a pending one without a usable source blocks the run.
          if (this._hasUsableHydratedContent(artifact)) return;
          throw new Error(
            `Required shared ${role} image artefact for task ${taskDefinition.id} has no usable source URL or owning document`
          );
        });
      });
    });

    // Submission items (current structure uses `assignment.submissions` only)
    const submissions = assignment.submissions || [];
    submissions.forEach((sub) => {
      if (!sub?.documentId) return;
      const items = sub.items || {};
      Object.values(items).forEach((item) => {
        if (!item?.artifact) return;
        const art = item.artifact;
        if (!this.isImageArtifact(art)) return;
        // An upstream-established terminal failure is preserved verbatim: no download, no overwrite.
        const existing = item.getAssessment?.() || {};
        const hasEstablishedError = ['completeness', 'accuracy', 'spag'].every(
          (criterion) => existing[criterion]?.score === 'E'
        );
        if (hasEstablishedError) return;
        const sourceUrl = art.metadata?.sourceUrl;
        if (this._isAdmissibleImageUrl(sourceUrl)) {
          this._submissionItemByUid.set(art.getUid(), item);
          results.push({
            uid: art.getUid(),
            url: sourceUrl,
            documentId: sub.documentId,
            scope: 'submission',
            taskId: item.taskId,
            itemId: item.id,
          });
          return;
        }
        // Already-hydrated student artefacts need no download; a pending one without a usable source materialises the hydration failure.
        if (this._hasUsableHydratedContent(art)) return;
        this._materialiseHydrationFailure(item, 'Submission image has no usable source URL', {
          uid: art.getUid(),
          taskId: item.taskId,
          scope: 'submission',
        });
      });
    });
    return results;
  }

  /**
   * Fetch images as blobs with round-robin ordering by documentId to distribute load.
   * One full-list sender invocation carries the configured Slides-fetch batch
   * size, HTTP 200-only acceptance and no stop statuses. Final success
   * outcomes have their blobs read before the next batch; final failures are
   * routed by scope: a student failure materialises the hydration error on
   * its owning item, while a shared or scope-less failure throws.
   * @param {Array<{uid:string,url:string,documentId:string}>} entries - Image artefact entries to fetch.
   * @returns {Array<{uid:string, blob:GoogleAppsScript.Base.Blob}>} Array of fetched image blobs with their UIDs.
   */
  fetchImagesAsBlobs(entries) {
    if (!entries?.length) return [];

    const maxBatchSize = ConfigurationManager.getInstance().getSlidesFetchBatchSize();
    const byDocument = Object.groupBy(entries, (entry) => entry.documentId);
    // Round-robin merge
    const merged = [];
    const documentLists = Object.values(byDocument);
    let rounds = 0;
    for (const list of documentLists) {
      rounds = Math.max(rounds, list.length);
    }
    for (let round = 0; round < rounds; round += 1) {
      for (const list of documentLists) {
        if (round < list.length) {
          merged.push(list[round]);
        }
      }
    }
    const entryByUid = new Map();
    const requests = merged.map((entry) => {
      if (entryByUid.has(entry.uid)) throw new Error(`Duplicate image request UID: ${entry.uid}`);
      entryByUid.set(entry.uid, entry);
      return {
        uid: entry.uid,
        url: entry.url,
        method: 'get',
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true,
      };
    });
    const results = [];
    let batchNumber = 0;
    this.sendRequestsInBatches(requests, {
      batchSize: maxBatchSize,
      acceptedStatuses: [200],
      stopStatuses: [],
      onBatchComplete: (outcomes) => {
        batchNumber += 1;
        this.progressTracker.updateProgress(
          `Fetched image batch ${batchNumber} of ${Math.ceil(merged.length / maxBatchSize)}`,
          false
        );
        this._assertKnownOutcomeUids(outcomes, entryByUid);
        outcomes.forEach((outcome) => {
          const entry = entryByUid.get(outcome.uid);
          const responseCode = outcome.response?.getResponseCode?.() ?? null;
          if (responseCode === 200) {
            // Native blob read: thrown faults escape by original identity without a
            // manager diagnostic; the caller boundary owns the failure log.
            results.push({ uid: outcome.uid, blob: outcome.response.getBlob() });
            return;
          }
          this._assignFinalImageFailure(entry, outcome, responseCode);
        });
      },
    });
    return results;
  }

  /**
   * Rejects unknown or duplicate final outcome UIDs before any blob access or
   * further dispatch.
   * @param {Object[]} outcomes - Final outcomes for one completed batch.
   * @param {Map<string, Object>} entryByUid - Collected entries by UID.
   * @returns {void}
   * @private
   */
  _assertKnownOutcomeUids(outcomes, entryByUid) {
    const seen = new Set();
    outcomes.forEach((outcome) => {
      if (!entryByUid.has(outcome.uid) || seen.has(outcome.uid)) {
        throw new Error(`Unknown or duplicate image outcome UID: ${outcome.uid}`);
      }
      seen.add(outcome.uid);
    });
  }

  /**
   * Routes one final non-200/network image outcome by its scope.
   * @param {Object} entry - The collected entry owning the outcome UID.
   * @param {Object} outcome - The final shared-transport outcome.
   * @param {number|null} responseCode - Final response code, or null for a network failure.
   * @returns {void}
   * @throws {Error} When the failure is shared (blocking the run) or the entry is scope-less (a wiring fault).
   * @private
   */
  _assignFinalImageFailure(entry, outcome, responseCode) {
    if (entry.scope === 'submission') {
      const item = this._submissionItemByUid.get(entry.uid);
      if (!item) {
        throw new Error(`No owning submission item for image outcome UID: ${entry.uid}`);
      }
      this._materialiseHydrationFailure(item, 'Failed to fetch image', {
        uid: entry.uid,
        taskId: entry.taskId,
        scope: 'submission',
        attempts: outcome.attempts,
        responseCode,
      });
      return;
    }
    if (entry.scope === 'reference' || entry.scope === 'template') {
      throw new Error(
        `Required shared ${entry.scope} image failed to hydrate for task ${entry.taskId}`
      );
    }
    throw new Error(`Image outcome UID ${entry.uid} has no hydration scope`);
  }

  /**
   * Apply fetched blobs back to their corresponding artifact objects.
   *
   * Behaviour and assumptions:
   * - This function is intentionally "fail-fast": it assumes the caller has ensured
   *   `assignment.assignmentDefinition.tasks`, `assignment.submissions` and nested collections exist; any
   *   missing property throws so problems surface instead of silently continuing.
   * - `blobs` is an array of { uid, blob } pairs whose `uid` matches an artifact's
   *   unique id and whose `blob` is a GoogleAppsScript.Base.Blob fetched earlier
   *   (for example by `fetchImagesAsBlobs`); every UID is validated once before
   *   any blob is applied, and unmatched/duplicate UIDs throw.
   * @param {Assignment} assignment - assignment model containing task definitions and submissions
   * @param {Array<{uid:string, blob:GoogleAppsScript.Base.Blob}>} blobs - blobs to apply
   */
  writeBackBlobs(assignment, blobs) {
    if (!blobs?.length) return;

    const targets = this._collectWriteBackTargets(assignment);
    const seen = new Set();
    blobs.forEach(({ uid }) => {
      if (!targets.has(uid)) {
        throw new Error(`Blob uid did not match any image artefact: ${uid}`);
      }
      if (seen.has(uid)) {
        throw new Error(`Duplicate image blob UID: ${uid}`);
      }
      seen.add(uid);
    });
    blobs.forEach(({ uid, blob }) => {
      this._applyHydratedBlob(targets.get(uid), blob);
    });
  }

  /**
   * Registers every image artefact in the model by UID with its scope and
   * owning submission item.
   * @param {Assignment} assignment - Assignment model to scan.
   * @returns {Map<string, Object>} Write-back targets by artefact UID.
   * @throws {Error} When the model contains duplicate image artefact UIDs.
   * @private
   */
  _collectWriteBackTargets(assignment) {
    const targets = new Map();
    const register = (artifact, scope, item) => {
      const uid = artifact.getUid();
      if (targets.has(uid)) {
        throw new Error(`Duplicate image artefact UID in model: ${uid}`);
      }
      targets.set(uid, { artifact, scope, item });
    };
    Object.values(assignment.assignmentDefinition.tasks).forEach((taskDefinition) => {
      ['reference', 'template'].forEach((role) => {
        taskDefinition.artifacts[role].forEach((artifact) => {
          if (!this.isImageArtifact(artifact)) return;
          register(artifact, role, null);
        });
      });
    });
    assignment.submissions.forEach((submission) => {
      Object.values(submission.items).forEach((item) => {
        const artifact = item.artifact;
        if (!this.isImageArtifact(artifact)) return;
        register(artifact, 'submission', item);
      });
    });
    return targets;
  }

  /**
   * Applies one blob to its target: unusable returned data converts by scope
   * while thrown faults escape; a successful write validates the hydrated
   * content/hash and invalidates stale results/feedback only when content changed.
   * @param {Object} record - Write-back target ({artifact, scope, item}).
   * @param {GoogleAppsScript.Base.Blob} blob - The fetched blob.
   * @returns {void}
   * @private
   */
  _applyHydratedBlob(record, blob) {
    const { artifact, scope, item } = record;
    // The required model writer is verified before any returned-data
    // classification, so unusable data cannot hide a missing writer behind a
    // normal hydration failure.
    if (typeof artifact.setContentFromBlob !== 'function') {
      throw new TypeError('Image artefact is missing the required setContentFromBlob writer');
    }
    if (!blob || typeof blob.getBytes !== 'function') {
      // A null/reader-less blob cannot carry hydratable bytes: the writer
      // still runs so a throwing writer's fault escapes by identity (the real
      // writer early-returns), then the outcome is classified as unusable
      // returned content by scope — retained old content never certifies
      // hydration.
      artifact.setContentFromBlob(blob);
      this._assignUnusableReturnedContent(record);
      return;
    }
    // One native byte read per blob: the already-read bytes are exposed to
    // the model writer through a tiny adapter, keeping data-URL/hash
    // conversion model-owned without a second native read. Thrown native,
    // base64, hash and writer faults escape by original identity.
    const bytes = blob.getBytes();
    if (!bytes || bytes.length === 0) {
      this._assignUnusableReturnedContent(record);
      return;
    }
    const isSubmissionScope = scope === 'submission';
    const previousContent = artifact.content;
    artifact.setContentFromBlob({ getBytes: () => bytes });
    if (!this._hasUsableHydratedContent(artifact)) {
      this._assignUnusableReturnedContent(record);
      return;
    }
    if (!isSubmissionScope || artifact.content === previousContent) return;
    // Replaced content invalidates the item's stale results and feedback,
    // mirroring the model's own content-replacement rule
    // (StudentSubmission._mergeExtractedContent): no callable model
    // invalidation primitive exists on the item, so the same rule is
    // applied owner-locally. Unchanged content preserves the complete
    // snapshots.
    item.assessments = {};
    item.feedback = {};
  }

  /**
   * Assigns one unusable returned-content outcome by scope: the owning
   * student item materialises the hydration failure, while a shared artefact
   * blocks the run.
   * @param {Object} record - Write-back target ({artifact, scope, item}).
   * @returns {void}
   * @throws {Error} When the unusable content belongs to a shared artefact.
   * @private
   */
  _assignUnusableReturnedContent(record) {
    if (record.scope === 'submission') {
      this._materialiseHydrationFailure(record.item, 'Hydrated image content is unusable', {
        uid: record.artifact.getUid(),
        taskId: record.item.taskId,
        scope: 'submission',
      });
      return;
    }
    throw new Error(
      `Required shared ${record.scope} image artefact for task ${record.artifact.taskId} returned unusable hydrated content`
    );
  }

  /**
   * Validates that a hydrated artefact carries usable content and a usable
   * content hash before the writeback may stand as a success.
   * @param {Object} artifact - The hydrated image artefact.
   * @returns {boolean} Whether content and hash are usable.
   * @private
   */
  _hasUsableHydratedContent(artifact) {
    return (
      typeof artifact.content === 'string' &&
      artifact.content.length > 0 &&
      Validate.isNonEmptyString(artifact.contentHash)
    );
  }
}

// Export for Node/test environment
if (typeof module !== 'undefined') {
  module.exports = ImageManager;
}
