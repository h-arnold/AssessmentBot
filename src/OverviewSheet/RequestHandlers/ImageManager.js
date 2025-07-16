class ImageManager extends BaseRequestManager {
  constructor() {
    super();
    this.apiKey = this.configManager.getApiKey();
    this.progressTracker = ProgressTracker.getInstance();
  }

  /**
   * Collects all unique slide URLs from the assignment's tasks and student responses.
   * @param {Assignment} assignment - The Assignment instance.
   * @return {Object[]} - An array of objects containing documentId, slideURL, and uid.
   */
  collectAllSlideUrls(assignment) {
    const slideUrls = []; // Array to hold { documentId, slideURL, uid }

    // Collect from tasks
    for (const taskKey in assignment.tasks) {
      const task = assignment.tasks[taskKey];

      // For Image tasks
      if (task.taskType === "Image") {
        if (task.taskReference) {
          slideUrls.push({
            documentId: assignment.referenceDocumentId,
            slideURL: task.taskReference,
            uid: task.uid + "-reference", // Append 'reference' to distinguish
          });
        }
        if (task.templateContent) {
          slideUrls.push({
            documentId: assignment.templateDocumentId,
            slideURL: task.templateContent,
            uid: task.uid + "-template", // Append 'template' to distinguish
          });
        }
      }
    }

    // Collect from student responses
    for (const studentTask of assignment.studentTasks) {
      if (studentTask.documentId) {
        for (const taskKey in studentTask.responses) {
          const response = studentTask.responses[taskKey];
          const task = assignment.tasks[taskKey];

          if (
            task.taskType === "Image" &&
            Utils.isValidUrl(response.response)
          ) {
            slideUrls.push({
              documentId: studentTask.documentId,
              slideURL: response.response,
              uid: response.uid, // UID from student response
            });
          }
        }
      } else {
        console.warn(
          `Invalid task data for: ${studentTask.student.email}. Skipping slide URL collection.`
        );
        console.error(
          `Task detail is as follows: \n ${JSON.stringify(studentTask)}`
        );
      }
    }

    return slideUrls;
  }


  /**
   * Fetch slide images as base64 in parallel batches.
   * @param {{documentId:string, slideURL:string, uid:string}[]} slideUrls
   * @param {number} maxBatchSize
   * @returns {{uid:string, base64:string}[]}
   */
  fetchImagesAsBase64(slideUrls, maxBatchSize = 30) {
    const images = [];
    for (let i = 0; i < slideUrls.length; i += maxBatchSize) {
      const batch = slideUrls.slice(i, i + maxBatchSize);
      this.progressTracker.updateProgress(
        `Fetching image batch ${Math.floor(i / maxBatchSize) + 1} of ${Math.ceil(
          slideUrls.length / maxBatchSize
        )}`,
        false
      );

      const requests = batch.map((slide) => ({
        url: slide.slideURL,
        method: "get",
        headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true,
      }));

      const responses = this.sendRequestsInBatches(requests, maxBatchSize);
      responses.forEach((resp, idx) => {
        const slide = batch[idx];
        if (resp && resp.getResponseCode() === 200) {
          const blob = resp.getBlob();
          images.push({
            uid: slide.uid,
            base64: Utilities.base64Encode(blob.getBytes()),
          });
        } else {
          console.warn(`Failed to fetch image for UID ${slide.uid}`);
        }
      });
    }
    return images;
  }
}
