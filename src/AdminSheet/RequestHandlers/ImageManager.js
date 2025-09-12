class ImageManager extends BaseRequestManager {
  constructor() {
    super();
    // In GAS runtime BaseRequestManager should supply configManager.
    // For test environments where it may be absent, guard access.
    if (this.configManager && typeof this.configManager.getApiKey === 'function') {
      this.apiKey = this.configManager.getApiKey();
    } else {
      this.apiKey = null; // not required for tested logic
    }
    this.progressTracker = ProgressTracker.getInstance();
  }

  /**
   * Collect all image artifacts (reference, template, submission) across the assignment.
   * Returns entries containing uid, url (metadata.sourceUrl), documentId, scope, taskId, and optional itemId.
   * @param {Assignment} assignment
   * @returns {Array<{uid:string,url:string,documentId:string,scope:'reference'|'template'|'submission',taskId:string,itemId?:string}>}
   */
  collectAllImageArtifacts(assignment) {
    const results = [];
    const taskDefs = assignment.tasks || {};
    // TaskDefinition artifacts (reference/template)
    Object.values(taskDefs).forEach(td => {
      ['reference','template'].forEach(role => {
        td.artifacts[role].forEach(artifact => {
          if (artifact.getType && artifact.getType() === 'IMAGE') {
            const sourceUrl = artifact.metadata && artifact.metadata.sourceUrl;
            if (Utils.isValidUrl && Utils.isValidUrl(sourceUrl)) {
              results.push({
                uid: artifact.getUid(),
                url: sourceUrl,
                documentId: role === 'reference' ? assignment.referenceDocumentId : assignment.templateDocumentId,
                scope: role,
                taskId: td.id
              });
            }
          }
        });
      });
    });

    // Submission items
  const submissions = assignment.submissions || [];
    submissions.forEach(sub => {
      if (!sub || !sub.documentId) return;
      const items = sub.items || {};
      Object.values(items).forEach(item => {
        if (!item || !item.artifact) return;
        const art = item.artifact;
  if (art.getType && art.getType() === 'IMAGE') {
          const sourceUrl = art.metadata && art.metadata.sourceUrl;
          if (Utils.isValidUrl && Utils.isValidUrl(sourceUrl)) {
            results.push({
              uid: art.getUid(),
              url: sourceUrl,
              documentId: sub.documentId,
              scope: 'submission',
              taskId: item.taskId,
              itemId: item.id
            });
          }
        }
      });
    });
    return results;
  }

  /**
   * Fetch images as blobs with round-robin ordering by documentId to distribute load.
   * @param {Array<{uid:string,url:string,documentId:string}>} entries
   * @returns {Array<{uid:string, blob:GoogleAppsScript.Base.Blob}>}
   */
  fetchImagesAsBlobs(entries) {
    const maxBatchSize = configurationManager.getSlidesFetchBatchSize()

    if (!entries || !entries.length) return [];
    // Group by documentId
    const byDoc = entries.reduce((acc, e) => {
      acc[e.documentId] = acc[e.documentId] || [];
      acc[e.documentId].push(e);
      return acc;
    }, {});
    // Round-robin merge
    const merged = [];
    const docLists = Object.values(byDoc);
    let added = true;
    while (added) {
      added = false;
      for (const list of docLists) {
        if (list.length) {
          merged.push(list.shift());
          added = true;
        }
      }
    }
    const results = [];
    for (let i = 0; i < merged.length; i += maxBatchSize) {
      const batch = merged.slice(i, i + maxBatchSize);
      this.progressTracker.updateProgress(`Fetching image batch ${Math.floor(i / maxBatchSize) + 1} of ${Math.ceil(merged.length / maxBatchSize)}`, false);
      const requests = batch.map(entry => ({
        url: entry.url,
        method: 'get',
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true
      }));
      const responses = this.sendRequestsInBatches(requests, maxBatchSize);
      responses.forEach((resp, idx) => {
        const entry = batch[idx];
        if (resp && resp.getResponseCode && resp.getResponseCode() === 200) {
          try {
            const blob = resp.getBlob();
            results.push({ uid: entry.uid, blob });
          } catch (e) {
            console.warn('Failed to read blob for image uid ' + entry.uid, e);
          }
        } else {
          console.warn('Failed to fetch image for uid ' + entry.uid);
        }
      });
    }
    return results;
  }

  /**
   * Apply fetched blobs back to their corresponding artifact objects.
   *
   * Behaviour and assumptions:
   * - This function is intentionally "fail-fast": it assumes the caller has ensured
   *   `assignment.tasks`, `assignment.submissions` and nested collections exist. If
   *   any expected property is missing the runtime will throw, making problems visible
   *   earlier rather than silently continuing.
   * - `blobs` is an array of objects with shape { uid, blob } where `uid` matches
   *   an artifact's unique id and `blob` is a GoogleAppsScript.Base.Blob fetched
   *   earlier (for example by `fetchImagesAsBlobs`).
   * - For each matching artifact that exposes `setContentFromBlob`, we call that
   *   method to update the artifact's internal content (base64) and associated hash.
   *
   * Inputs:
   * @param {Assignment} assignment - assignment model containing task definitions and submissions
   * @param {Array<{uid:string, blob:GoogleAppsScript.Base.Blob}>} blobs - blobs to apply
   */
  writeBackBlobs(assignment, blobs) {
    // Quick no-op when there are no blobs to apply.
    if (!blobs || !blobs.length) return;

    // Build a fast lookup from artifact uid -> artifact object. Using a map
    // allows applying blobs in O(1) per blob instead of scanning nested arrays.
    const artifactMap = {};

    // --- Collect artifacts defined on task definitions (reference & template) ---
    // For each task definition, inspect both the `reference` and `template` roles
    // and add any IMAGE artifacts to the lookup. We guard each artifact with a
    // small feature check (`getType`) to avoid assuming a concrete implementation.
    Object.values(assignment.tasks).forEach(taskDefinition => {
      ['reference', 'template'].forEach(role => {
        taskDefinition.artifacts[role].forEach(artifact => {
          if (artifact.getType && artifact.getType() === 'IMAGE') {
            artifactMap[artifact.getUid()] = artifact;
          }
        });
      });
    });

    // --- Collect artifacts attached to student submissions ---
    // Walk each submission's items and add any IMAGE artifacts to the same map.
    // Using a single map ensures we can apply blobs for any artifact regardless
    // of whether it originated from the assignment template/reference or a submission.
    assignment.submissions.forEach(submission => {
      Object.values(submission.items).forEach(item => {
        const artifact = item.artifact;
        if (artifact && artifact.getType && artifact.getType() === 'IMAGE') {
          artifactMap[artifact.getUid()] = artifact;
        }
      });
    });

    // --- Apply blobs to matched artifacts ---
    // For each fetched blob, find the corresponding artifact by uid and, if it
    // exposes `setContentFromBlob`, call it to update the artifact's stored data.
    // Artifacts that don't match or don't implement the setter are skipped.
    blobs.forEach(({ uid, blob }) => {
      const artifact = artifactMap[uid];
      if (artifact && artifact.setContentFromBlob) {
        artifact.setContentFromBlob(blob);
      }
    });
  }
}

// Export for Node/test environment
if (typeof module !== 'undefined') {
  module.exports = ImageManager;
}
