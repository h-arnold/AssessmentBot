// ClassroomApiClient.js

/**
 * Handles operations related to Google Classroom entities.
 * This object is responsible solely for read-only interactions with the Google Classroom API.
 */
const ClassroomApiClient = {
  /**
   * Fetches all classrooms where the user is a teacher.
   * @returns {Array<GoogleAppsScript.Classroom.Schema.Course>} An array of classroom objects.
   */
  fetchClassrooms() {
    const progressTracker = ProgressTracker.getInstance();
    try {
      const response = Classroom.Courses.list({ teacherId: 'me', courseStates: ['ACTIVE'] });
      const courses = response.courses || [];
      ABLogger.getInstance().info('Fetched classrooms.', { count: courses.length });
      return courses;
    } catch (error) {
      progressTracker.logAndThrowError(`Failed to fetch classrooms: ${error.message}`, error);
    }
  },

  /**
   * Fetches all active classrooms with pagination.
   * Iterates through all pages until there is no nextPageToken.
   * @returns {Array<Object>} An array of objects containing course IDs and names.
   */
  fetchAllActiveClassrooms() {
    const progressTracker = ProgressTracker.getInstance();
    try {
      let courses = [];
      let pageToken;
      do {
        const response = Classroom.Courses.list({
          pageToken: pageToken,
          courseStates: ['ACTIVE'],
        });
        if (response.courses && response.courses.length > 0) {
          const activeCourses = response.courses.map((course) => ({
            id: course.id,
            name: course.name,
            enrollmentCode: course.enrollmentCode,
          }));
          courses = [...courses, ...activeCourses];
        }
        pageToken = response.nextPageToken;
      } while (pageToken);

      ABLogger.getInstance().info('Active classrooms retrieved', { count: courses.length });
      return courses;
    } catch (error) {
      progressTracker.logError(`Failed to retrieve active classrooms: ${error.message}`, error);
      return [];
    }
  },

  /**
   * Fetch a single course by ID.
   * @param {string} courseId - The ID of the course to fetch.
   * @returns {GoogleAppsScript.Classroom.Schema.Course|null} The course object, or null if not found.
   */
  fetchCourse(courseId) {
    const progressTracker = ProgressTracker.getInstance();
    try {
      const course = Classroom.Courses.get(courseId);
      return course || null;
    } catch (error) {
      progressTracker.logError(`Failed to fetch course (${courseId}): ${error.message}`, error);
      return null;
    }
  },

  /**
   * Fetch a topic's name for a given course/topic id pair.
   * @param {string} courseId - The ID of the course.
   * @param {string} topicId - The ID of the topic.
   * @returns {string|null} Topic name or null when missing.
   */
  fetchTopicName(courseId, topicId) {
    const progressTracker = ProgressTracker.getInstance();
    if (!courseId || !topicId) {
      progressTracker.logAndThrowError('courseId and topicId are required to fetch topic name.');
    }

    try {
      const topic = Classroom.Courses.Topics.get(courseId, topicId);
      const name = topic?.name;
      if (!name) {
        progressTracker.logError('Topic name not found for provided course/topic.', {
          courseId,
          topicId,
        });
        return null;
      }
      return name;
    } catch (error) {
      progressTracker.logError('Failed to fetch topic name from Classroom.', {
        courseId,
        topicId,
        err: error,
      });
      throw error;
    }
  },

  /**
   * Fetch the updateTime property for a course and return it as a JavaScript Date.
   * @param {string} courseId - The ID of the course.
   * @returns {Date|null} JavaScript Date instance representing the course's updateTime, or null if not available.
   */
  fetchCourseUpdateTime(courseId) {
    try {
      const course = Classroom.Courses.get(courseId);
      if (!course?.updateTime) {
        ABLogger.getInstance().error('Course updateTime not present', { courseId });
        return null;
      }

      // updateTime is an RFC3339 timestamp (e.g. "2020-09-30T12:34:56.789Z").
      const date = new Date(course.updateTime);
      if (Number.isNaN(date.getTime())) {
        ABLogger.getInstance().error('Invalid course updateTime format', {
          courseId,
          updateTime: course.updateTime,
        });
        return null;
      }

      return date;
    } catch (error) {
      ABLogger.getInstance().error('Failed to fetch course updateTime', {
        courseId,
        error: error.message,
      });
      return null;
    }
  },

  /**
   * Fetch teachers for a given course.
   * Maps Classroom API teacher resources to `Teacher` model instances.
   * @param {string} courseId - The ID of the course.
   * @returns {Teacher[]} An array of Teacher model instances.
   */
  fetchTeachers(courseId) {
    const progressTracker = ProgressTracker.getInstance();
    try {
      const resp = Classroom.Courses.Teachers.list(courseId) || {};
      const raw = resp.teachers || [];

      // Map raw API teacher resources to local Teacher model instances.
      // Keep the original raw objects available to callers by returning
      // Teacher instances (which contain email, userId and name).
      const teachers = raw
        .map((t) => {
          try {
            const name = t?.profile?.name?.fullName || null;
            const email = t?.profile?.emailAddress || null;
            const userId = t?.profile?.id || null;
            return new Teacher(email, userId, name);
          } catch (error) {
            // If mapping fails for any entry, log and skip that entry.
            progressTracker.logError(
              `Failed to map teacher resource for course (${courseId}): ${error.message}`,
              error
            );
            return null;
          }
        })
        .filter(Boolean);

      return teachers;
    } catch (error) {
      progressTracker.logError(
        `Failed to fetch teachers for course (${courseId}): ${error.message}`,
        error
      );
      return [];
    }
  },

  /**
   * Fetch all students from Google Classroom for a given course.
   * Iterates through pages until there is no nextPageToken.
   * @param {string} courseId - The ID of the Google Classroom course.
   * @returns {Student[]} An array of Student instances.
   */
  fetchAllStudents(courseId) {
    const progressTracker = ProgressTracker.getInstance();
    try {
      const studentList = [];
      let pageToken = null;

      do {
        const parameters = { pageSize: 40 };
        if (pageToken) parameters.pageToken = pageToken;

        const response = Classroom.Courses.Students.list(courseId, parameters);

        if (response.students && response.students.length > 0) {
          response.students.forEach((student) => {
            const name = student.profile.name.fullName;
            const email = student.profile.emailAddress;
            const id = student.profile.id;

            const studentInstance = new Student(name, email, id);
            studentList.push(studentInstance);
          });
        }

        pageToken = response.nextPageToken;
      } while (pageToken);

      return studentList;
    } catch (error) {
      progressTracker.logError(
        `Error fetching students for course ID ${courseId}: ${error.message}`,
        error
      );
      return [];
    }
  },
};

// Export for Node tests / CommonJS environment
if (typeof module !== 'undefined') {
  module.exports = ClassroomApiClient;
}
