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
    const referenceTasks = slidesParser.extractTasksFromSlides(this.referenceDocumentId, "reference");
    // Extract template tasks
    const templateTasks = slidesParser.extractTasksFromSlides(this.templateDocumentId, "template");

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
   * Accurately detects Google Slides attachments by verifying MIME types.
   * Implements the abstract fetchSubmittedDocuments method from the base class.
   */
  fetchSubmittedDocuments() {
    try {
      // Fetch all student submissions for the specific assignment
      const response = Classroom.Courses.CourseWork.StudentSubmissions.list(this.courseId, this.assignmentId);
      const submissions = response.studentSubmissions;

      if (!submissions || submissions.length === 0) {
        console.log(`No submissions found for assignment ID: ${this.assignmentId}`);
        return;
      }

      submissions.forEach(submission => {
        const studentId = submission.userId; // Google Classroom Student ID (string)
        const attachments = submission.assignmentSubmission?.attachments;

        if (attachments && attachments.length > 0) {
          attachments.forEach(attachment => {
            if (attachment.driveFile && attachment.driveFile.id) {
              const driveFileId = attachment.driveFile.id;

              try {
                // Fetch the Drive file using DriveApp
                const file = DriveApp.getFileById(driveFileId);
                const mimeType = file.getMimeType();

                // Check if the MIME type matches Google Slides
                if (mimeType === MimeType.GOOGLE_SLIDES) {
                  const documentId = driveFileId;

                  // Find the corresponding StudentTask instance
                  const studentTask = this.studentTasks.find(st => st.student.id === studentId);
                  if (studentTask) {
                    studentTask.documentId = documentId;
                    // console.log(`Assigned Document ID ${documentId} to student ${studentTask.student.name} (${studentTask.student.email})`);
                  } else {
                    console.log(`No matching student found for student ID: ${studentId}`);
                  }
                } else {
                  console.log(`Attachment with Drive File ID ${driveFileId} is not a Google Slides document (MIME type: ${mimeType}).`);
                }
              } catch (fileError) {
                console.error(`Error fetching Drive file with ID ${driveFileId}:`, fileError);
              }
            } else {
              console.log(`Attachment for student ID ${studentId} is not a Drive File or lacks a valid ID.`);
            }
          });
        } else {
          console.log(`No attachments found for student ID: ${studentId}`);
        }
      });
    } catch (error) {
      console.error(`Error fetching submissions for assignment ID ${this.assignmentId}:`, error);
    }
  }

  /**
   * Processes all student submissions by extracting responses.
   * Implements the abstract processAllSubmissions method from the base class.
   */
  processAllSubmissions() {
    const slidesParser = new SlidesParser();

    this.studentTasks.forEach(studentTask => {
      if (studentTask.documentId) {
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
