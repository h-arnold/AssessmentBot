/**
 * SlidesAssignment Class
 *
 * Represents a Google Slides-based assignment within a course.
 * Handles slide-specific task extraction and processing.
 */
class SlidesAssignment extends Assignment {
  /**
   * Constructs a SlidesAssignment instance.
   * @param {string} courseId - The ID of the course.
   * @param {string} assignmentId - The ID of the assignment.
   * @param {string} referenceDocumentId - The ID of the reference slides document.
   * @param {string} templateDocumentId - The ID of the template slides document.
   */
  constructor(courseId, assignmentId, referenceDocumentId, templateDocumentId) {
    super(courseId, assignmentId);
    this.referenceDocumentId = referenceDocumentId;
    this.templateDocumentId = templateDocumentId;
  }

  /**
   * Fetches every slide URL (task refs/templates + student responses),
   * pulls down each batch as base64, and re‐writes either
   * taskReference/templateContent or studentTask.responses[x].response.
   */
  processImages() {
    // New Phase 5 image hydration flow: collect image artifacts, fetch blobs, write back base64 + hashes.
    try {
      const imageManager = new ImageManager();
      const entries = imageManager.collectAllImageArtifacts(this);
      if (!entries.length) {
        console.log('No image artifacts to process.');
        return;
      }
      // Use optional chaining to call updateProgress if progressTracker exists
      this.progressTracker?.updateProgress(
        `Found ${entries.length} image artifacts. Fetching...`,
        false
      );
      const blobs = imageManager.fetchImagesAsBlobs(entries);
      // Optional chaining for concise progress update
      this.progressTracker?.updateProgress(
        `Fetched ${blobs.length} image blobs. Writing content...`,
        false
      );
      imageManager.writeBackBlobs(this, blobs);
      console.log(`Hydrated ${blobs.length} image artifacts.`);
    } catch (e) {
      console.error('SlidesAssignment.processImages failed', e);
      if (this.progressTracker && typeof this.progressTracker.logError === 'function') {
        this.progressTracker.logError('Image processing failed: ' + e.message, e);
      }
    }
  }

  /**
   * Populates tasks from the reference and template slides.
   * Combines reference and template content based on task keys.
   * Implements the abstract populateTasks method from the base class.
   */
  populateTasks() {
    const parser = new SlidesParser();
    const defs = parser.extractTaskDefinitions(this.referenceDocumentId, this.templateDocumentId);
    this.tasks = Object.fromEntries(defs.map((td) => [td.getId(), td]));
    console.log(`Populated ${defs.length} TaskDefinitions from slides.`);
  }

  /**
   * Fetches and assigns submitted Google Slides documents for each student.
   * Only accepts Google Slides MIME type.
   */
  fetchSubmittedDocuments() {
    // Google Slides MIME type
    const SLIDES_MIME_TYPE = MimeType.GOOGLE_SLIDES;
    this.fetchSubmittedDocumentsByMimeType(SLIDES_MIME_TYPE);
  }

  /**
   * Processes all student submissions by extracting responses.
   * Implements the abstract processAllSubmissions method from the base class.
   */
  processAllSubmissions() {
    const parser = new SlidesParser();
    const taskDefs = Object.values(this.tasks);
    this.submissions.forEach((sub) => {
      if (!sub.documentId) {
        console.warn(`No document ID for studentId: ${sub.studentId}. Skipping.`);
        return;
      }
      this.progressTracker.updateProgress(
        `Extracting responses from student ${sub.studentId}...`,
        false
      );
      const artifacts = parser.extractSubmissionArtifacts(sub.documentId, taskDefs);
      artifacts.forEach((a) => {
        const taskDef = this.tasks[a.taskId];
        if (!taskDef) {
          console.warn('Submission artifact references unknown taskId ' + a.taskId);
          return;
        }
        sub.upsertItemFromExtraction(taskDef, {
          pageId: a.pageId,
          content: a.content,
          metadata: a.metadata,
        });
      });
    });
  }
}
