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
   * @param {AssignmentDefinition|Object} assignmentDefinition - Embedded definition containing document type and task metadata.
   */
  constructor(courseId, assignmentId, assignmentDefinition) {
    const definitionInstance =
      assignmentDefinition instanceof AssignmentDefinition
        ? assignmentDefinition
        : AssignmentDefinition.fromJSON(assignmentDefinition);
    super(courseId, assignmentId, definitionInstance);
  }

  /**
   * Deserialises SlidesAssignment from JSON data.
   * @param {object} data - JSON data object.
   * @returns {SlidesAssignment} Reconstructed SlidesAssignment instance.
   */
  static fromJSON(data) {
    const inst = Assignment._baseFromJSON(data);
    Object.setPrototypeOf(inst, SlidesAssignment.prototype);
    return inst;
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
      if (entries.length === 0) {
        ABLogger.getInstance().info('No image artifacts to process.', {
          workflow: 'SlidesAssignment.processImages',
          courseId: this.courseId,
          assignmentId: this.assignmentId,
        });
        return;
      }
      this.progressTracker.updateProgress(
        `Found ${entries.length} image artifacts. Fetching...`,
        false
      );
      const blobs = imageManager.fetchImagesAsBlobs(entries);
      this.progressTracker.updateProgress(
        `Fetched ${blobs.length} image blobs. Writing content...`,
        false
      );
      imageManager.writeBackBlobs(this, blobs);
      ABLogger.getInstance().info(`Hydrated ${blobs.length} image artifacts.`, {
        workflow: 'SlidesAssignment.processImages',
        courseId: this.courseId,
        assignmentId: this.assignmentId,
        count: blobs.length,
      });
    } catch (error) {
      ABLogger.getInstance().error('SlidesAssignment.processImages failed', {
        workflow: 'SlidesAssignment.processImages',
        courseId: this.courseId,
        assignmentId: this.assignmentId,
        err: error,
      });
      this.progressTracker.logError('Image processing failed.', {
        devContext: {
          workflow: 'SlidesAssignment.processImages',
          courseId: this.courseId,
          assignmentId: this.assignmentId,
        },
        err: error,
      });
      throw error;
    }
  }

  /**
   * Populates tasks from the reference and template slides.
   * Combines reference and template content based on task keys.
   * Implements the abstract populateTasks method from the base class.
   */
  populateTasks() {
    const { referenceDocumentId, templateDocumentId } = this.assignmentDefinition;
    const parser = new SlidesParser();
    const defs = parser.extractTaskDefinitions(referenceDocumentId, templateDocumentId);
    const validDefs = [];

    defs.forEach((definition) => {
      const validation = definition.validate();
      if (!validation.ok) {
        const message = `Task "${definition.taskTitle}" is missing required slide artifacts.`;
        this.progressTracker.logError(message, {
          taskId: definition.getId(),
          pageId: definition.pageId,
          errors: validation.errors,
        });
        return;
      }
      validDefs.push(definition);
    });

    this.assignmentDefinition.tasks = Object.fromEntries(validDefs.map((td) => [td.getId(), td]));
    ABLogger.getInstance().info(
      `Populated ${validDefs.length} TaskDefinitions from slides (input: ${defs.length}).`
    );
  }

  /**
   * Fetches and assigns submitted Google Slides documents for each student.
   * Only accepts Google Slides MIME type.
   */
  fetchSubmittedDocuments() {
    // Google Slides MIME type
    const SLIDES_MIME_TYPE = 'application/vnd.google-apps.presentation';
    this.fetchSubmittedDocumentsByMimeType(SLIDES_MIME_TYPE);
  }

  /**
   * Processes all student submissions by extracting responses.
   * Implements the abstract processAllSubmissions method from the base class.
   */
  processAllSubmissions() {
    const parser = new SlidesParser();
    const taskDefs = Object.values(this.assignmentDefinition.tasks);
    const total = this.submissions.length;
    this.submissions.forEach((sub, index) => {
      if (!sub.documentId) {
        ABLogger.getInstance().warn(`No document ID for student: ${sub.studentName}. Skipping.`, {
          workflow: 'SlidesAssignment.processAllSubmissions',
          courseId: this.courseId,
          assignmentId: this.assignmentId,
          studentName: sub.studentName,
        });
        return;
      }
      // Update progress with ordinal position (e.g. "Extracting response 3 of 12...")
      this.progressTracker.updateProgress(`Extracting response ${index + 1} of ${total}...`, false);
      const artifacts = parser.extractSubmissionArtifacts(sub.documentId, taskDefs);
      artifacts.forEach((a) => {
        const taskDefinition = this.assignmentDefinition.tasks[a.taskId];
        if (!taskDefinition) {
          ABLogger.getInstance().warn('Submission artifact references unknown taskId ' + a.taskId, {
            workflow: 'SlidesAssignment.processAllSubmissions',
            courseId: this.courseId,
            assignmentId: this.assignmentId,
            taskId: a.taskId,
            documentId: a.documentId,
          });
          return;
        }
        sub.upsertItemFromExtraction(taskDefinition, {
          pageId: a.pageId,
          content: a.content,
          metadata: a.metadata,
          documentId: a.documentId,
          // Parser placeholders already carry the single missing-content diagnostic,
          // so the model layer stores them silently without duplicate warnings.
          missingContentLogged: a.content == null && a.pageId == null,
        });
      });
    });
  }
}

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined') {
  module.exports = SlidesAssignment;
}
