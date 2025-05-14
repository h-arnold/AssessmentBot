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
   * Processes all images in tasks and student responses by fetching and uploading them.
   */
  processImages() {
    const imageManager = new ImageManager();

    // Collect all slide URLs
    const slideUrls = imageManager.collectAllSlideUrls(this);

    // Fetch images
    const imageBlobs = imageManager.batchFetchImages(slideUrls);

    // Upload images
    const urlMappings = imageManager.batchUploadImages(imageBlobs);

    // Update assignment with uploaded image URLs
    imageManager.updateAssignmentWithImageUrls(this, urlMappings, imageBlobs);
  }

  /**
   * Populates tasks from the reference and template slides.
   * Combines reference and template content based on task keys.
   * Implements the abstract populateTasks method from the base class.
   */
  populateTasks() {
    const slidesParser = new SlidesParser();

    // Extract reference tasks
    const referenceTasks = slidesParser.extractTasks(this.referenceDocumentId, "reference");
    // Extract template tasks
    const templateTasks = slidesParser.extractTasks(this.templateDocumentId, "template");

    // Create a map of tasks from referenceTasks
    const tasksMap = {};
    referenceTasks.forEach(refTask => {
      const key = refTask.taskTitle;
      tasksMap[key] = refTask; // Add the task to the map
    });

    // Update tasks with templateContent from templateTasks
    templateTasks.forEach(templateTask => {
      const key = templateTask.taskTitle;
      if (tasksMap[key]) {
        tasksMap[key].templateContent = templateTask.templateContent;
        tasksMap[key].templateContentHash = templateTask.templateContentHash;
      } else {
        console.warn(`No matching reference task for template task with key: ${key}`);
        // Optionally, you can decide to add this task or handle it differently
      }
    });

    // Assign the tasksMap to this.tasks
    this.tasks = tasksMap;

    console.log(`Populated ${Object.keys(this.tasks).length} tasks from slides.`);
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
    const slidesParser = new SlidesParser();

    this.studentTasks.forEach(studentTask => {
      if (studentTask.documentId) {
        this.progressTracker.updateProgress(
          `Extracting responses from ${studentTask.student.name}...`, false       );
        studentTask.extractAndAssignResponses(slidesParser, this.tasks);
      } else {
        console.warn(`No document ID for student: ${studentTask.student.email}. Skipping response extraction.`);
      }
    });
  }

  /**
   * Uploads all image blobs in tasks and student responses to the image service.
   * Replaces blobs with the returned URLs.
   */
  uploadAllImages() {
    const imageRequestManager = new ImageRequestManager();

    // Upload images in tasks
    for (const taskKey in this.tasks) {
      const task = this.tasks[taskKey];
      task.uploadImages(imageRequestManager);
    }

    // Upload images in student responses
    for (const studentTask of this.studentTasks) {
      studentTask.uploadResponsesImages(imageRequestManager);
    }

    console.log("All images have been uploaded and URLs have been updated.");
  }
}
