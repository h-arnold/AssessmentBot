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
    const imageManager = new ImageManager();

    // 1) collect all the URLs
    const slideUrls = imageManager.collectAllSlideUrls(this);
    // 2) fetch them as base64 in batches of 30
    const batchSize = configurationManager.getSlidesFetchBatchSize();
    const base64Images = imageManager.fetchImagesAsBase64(slideUrls, batchSize);

    // 3) re‐assign back into your tasks & student responses
    base64Images.forEach(({ uid, base64 }) => {
      const [taskUid, suffix] = uid.split('-', 2);

      // 3a) is this one of your Task refs/templates?
      const taskKey = Object.keys(this.tasks)
        .find(k => this.tasks[k].uid === taskUid);

      if (taskKey) {
        if (suffix === 'reference') {
          this.tasks[taskKey].taskReference = base64;
        } else if (suffix === 'template') {
          this.tasks[taskKey].templateContent = base64;
        }
        return;
      }

      // 3b) otherwise it must be a student response
      this.studentTasks.forEach(st =>
        Object.values(st.responses).forEach(resp => {
          if (resp.uid === uid) {
            resp.response = base64;
          }
        })
      );
    });
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
          `Extracting responses from ${studentTask.student.name}...`, false);
        studentTask.extractAndAssignResponses(slidesParser, this.tasks);
      } else {
        console.warn(`No document ID for student: ${studentTask.student.email}. Skipping response extraction.`);
      }
    });
  }


}
