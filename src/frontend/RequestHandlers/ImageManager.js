class ImageManager extends BaseRequestManager {
  constructor() {
    super();
    this.uploadUrl = this.configManager.getImageUploadUrl();
    this.apiKey = this.configManager.getLangflowApiKey();
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
   * Fetches images from the given slide URLs in batches, optimizing to avoid rate limits.
   * @param {Object[]} slideUrls - An array of objects containing documentId, slideURL, and uid.
   * @return {Object[]} - An array of objects containing uid, blob, and contentHash.
   */
  batchFetchImages(slideUrls) {
    const batches = [];
    const slidesByDocument = {};

    // Organize slide URLs by documentId
    slideUrls.forEach((slide) => {
      const docId = slide.documentId;
      if (!slidesByDocument[docId]) {
        slidesByDocument[docId] = [];
      }
      slidesByDocument[docId].push(slide);
    });

    let batchComplete = false;

    while (!batchComplete) {
      const batch = [];
      batchComplete = true;

      // Take one slide from each documentId
      for (const docId in slidesByDocument) {
        const slides = slidesByDocument[docId];
        if (slides.length > 0) {
          batch.push(slides.shift()); // Remove and return the first slide
          batchComplete = false; // Still have slides to process
        }
      }

      if (batch.length > 0) {
        batches.push(batch);
      }
    }

    // Now we have batches, where each batch contains slides from different documents

    const imageBlobs = []; // Array to hold { uid, blob, contentHash }

    batches.forEach((batch, batchIndex) => {
      this.progressTracker.updateProgress(
        `Fetching Slide Image Batch ${batchIndex + 1} of ${batches.length}`,
        false
      );
      console.log(
        `Fetching Slide Image Batch ${batchIndex + 1} of ${batches.length}`
      );

      const requests = batch.map((slide) => {
        return {
          url: slide.slideURL,
          method: "get",
          headers: {
            Authorization: "Bearer " + ScriptApp.getOAuthToken(),
          },
          muteHttpExceptions: true,
        };
      });

      // Use BaseRequestManager's sendRequestsInBatches method
      const responses = this.sendRequestsInBatches(requests, 1);

      responses.forEach((response, index) => {
        const slide = batch[index];
        if (response && response.getResponseCode() === 200) {
          const blob = response.getBlob().setName(`Slide_${slide.uid}.png`);
          const contentHash = Utils.generateHash(blob.getBytes());
          imageBlobs.push({
            uid: slide.uid,
            blob: blob,
            contentHash: contentHash,
          });

          // Assign contentHash to Task or StudentTask response if needed
          // Note: Since this method may not have access to the assignment object,
          // you might need to handle contentHash assignment elsewhere.
        } else {
          console.warn(`Failed to fetch image for UID: ${slide.uid}`);
        }
      });
    });

    // Return the collected image blobs after all batches are processed
    return imageBlobs;
  }

  /**
   * Uploads image Blobs to the image service in batches.
   * @param {Object[]} imageBlobs - An array of objects containing uid and Blob.
   * @return {Object} - A mapping of UIDs to uploaded image URLs.
   */
  batchUploadImages(imageBlobs) {
    const batches = [];
    const batchSize = this.configManager.getBatchSize() || 5; // Get batch size from config, default to 5

    // Split imageBlobs into batches
    for (let i = 0; i < imageBlobs.length; i += batchSize) {
      batches.push(imageBlobs.slice(i, i + batchSize));
    }

    const urlMappings = {}; // Mapping of UIDs to uploaded image URLs

    // Incrementing the step number and updating the message.

    this.progressTracker.updateProgress(
      `Uploading ${imageBlobs.length} images in ${batches.length} batches`,false)

    batches.forEach((batch, batchIndex) => {
      this.progressTracker.updateProgress(
        `Uploading batch ${batchIndex + 1} of ${batches.length}`, false
      );
      const requests = batch.map((imageBlobObj) => {
        const boundary = "---GoogleAppScriptBoundary";
        const imageBytes = imageBlobObj.blob.getBytes();
        const imageFileName = imageBlobObj.blob.getName();

        // Construct the multipart payload in binary format
        const payloadParts = [
          Utilities.newBlob(
            `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${imageFileName}"\r\nContent-Type: image/png\r\n\r\n`
          ).getBytes(),
          imageBytes,
          Utilities.newBlob(`\r\n--${boundary}--`).getBytes(),
        ];

        // Combine all parts into one payload blob
        const fullPayload = Utilities.newBlob(
          payloadParts.reduce((acc, part) => acc.concat(part), [])
        );

        return {
          uid: imageBlobObj.uid,
          url: this.uploadUrl,
          method: "post",
          contentType: `multipart/form-data; boundary=${boundary}`,
          payload: fullPayload.getBytes(),
          headers: {
            accept: "application/json",
            "x-api-key": this.apiKey,
          },
          muteHttpExceptions: true,
        };
      });

      // Use BaseRequestManager's sendRequestsInBatches method
      const responses = this.sendRequestsInBatches(requests);

      responses.forEach((response, index) => {
        const request = requests[index];
        const uid = request.uid;
        if (response && (response.getResponseCode() === 200 || response.getResponseCode() === 201)) {
          try {
            const responseData = JSON.parse(response.getContentText());
            if (responseData && responseData.file_path) {
              // Trim the file path to flowId/filename format for Langflow compatibility
              urlMappings[uid] = this.trimFilePathForLangflow(responseData.file_path);
            } else {
              console.warn(`Invalid response for UID: ${uid}`);
            }
          } catch (error) {
            console.error(`Error parsing response for UID: ${uid}`, error);
          }
        } else {
          console.warn(`Failed to upload image for UID: ${uid}`);
          // Handle failures as needed
        }
      });
    });

    return urlMappings;
  }

  /**
   * Updates the assignment's tasks and student responses with the uploaded image URLs.
   * @param {Assignment} assignment - The Assignment instance.
   * @param {Object} urlMappings - A mapping of UIDs to uploaded image URLs.
   */
  updateAssignmentWithImageUrls(assignment, urlMappings, imageBlobs) {
    // Create a mapping from uid to contentHash
    const contentHashMapping = {};
    imageBlobs.forEach((imageBlob) => {
      contentHashMapping[imageBlob.uid] = imageBlob.contentHash;
    });

    // Update tasks
    for (const taskKey in assignment.tasks) {
      const task = assignment.tasks[taskKey];
      if (task.taskType === "Image") {
        if (task.taskReference) {
          const uidReference = task.uid + "-reference";
          const imageUrl = urlMappings[uidReference];
          task.taskReference = imageUrl;
          task.contentHash = contentHashMapping[uidReference]; // Assign contentHash
        }
        if (task.templateContent) {
          const uidTemplate = task.uid + "-template";
          const imageUrl = urlMappings[uidTemplate];
          task.templateContent = imageUrl;
          task.templateContentHash = contentHashMapping[uidTemplate];
          // Assign contentHash if needed
        }
      }
    }

    // Update student responses
    for (const studentTask of assignment.studentTasks) {
      for (const taskKey in studentTask.responses) {
        const response = studentTask.responses[taskKey];
        const task = assignment.tasks[taskKey];

        if (task.taskType === "Image" && response.response) {
          const uid = response.uid;
          const imageUrl = urlMappings[uid];
          response.response = imageUrl;
          response.contentHash = contentHashMapping[uid]; // Assign contentHash
        }
      }
    }
  }

  /**
   * Trims the file path to include only the flowId and filename for Langflow compatibility.
   * Converts full paths like "/root/.cache/langflow/a430cc57-06bb-4c11-be39-d3d4de68d2c4/2024-11-27_14-47-50_image-file.png"
   * to "a430cc57-06bb-4c11-be39-d3d4de68d2c4/2024-11-27_14-47-50_image-file.png"
   * @param {string} filePath - The full file path returned from the upload service
   * @return {string} - The trimmed file path in flowId/filename format
   */
  trimFilePathForLangflow(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return filePath;
    }

    // Split the path by '/' and take the last two segments (flowId/filename)
    const pathSegments = filePath.split('/').filter(segment => segment.length > 0);
    
    // Return the last two segments joined with '/'
    if (pathSegments.length >= 2) {
      return pathSegments.slice(-2).join('/');
    }
    
    // If less than 2 segments, return the original path
    return filePath;
  }
}
