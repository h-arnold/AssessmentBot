// ClassroomApiClient.js

/**
 * Handles operations related to Google Classroom entities.
 *
 * @class ClassroomApiClient
 * This class is responsible solely for direct interactions with the Google Classroom API:
 * creating, updating, and fetching courses, and inviting teachers.
 */
class ClassroomApiClient {
  /**
   * Creates a new Google Classroom.
   * @param {string} name - The name of the classroom.
   * @param {string} ownerId - The email of the owner teacher.
   * @param {Array<string>} teacherEmails - The emails of additional teachers.
   * @returns {GoogleAppsScript.Classroom.Schema.Course} The created course object.
   */
  static createClassroom(name, ownerId, teacherEmails = []) {
    const progressTracker = ProgressTracker.getInstance();
    try {
      const course = {
        name: name,
        ownerId: ownerId,
        courseState: 'ACTIVE',
      };
      const newCourse = Classroom.Courses.create(course);
      console.log(`Created Classroom: ${name} (${newCourse.id})`);

      // Invite additional teachers
      teacherEmails.forEach((email) => {
        if (email !== ownerId) {
          // Avoid inviting the owner again
          this.inviteTeacher(newCourse.id, email);
        }
      });

      return newCourse;
    } catch (error) {
      progressTracker.logAndThrowError(
        `Failed to create classroom '${name}': ${error.message}`,
        error
      );
    }
  }

  /**
   * Sends an invitation to a teacher to join a classroom.
   * @param {string} courseId - The ID of the classroom.
   * @param {string} teacherEmail - The email of the teacher to invite.
   */
  static inviteTeacher(courseId, teacherEmail) {
    const progressTracker = ProgressTracker.getInstance();
    try {
      // Check if the teacher is already part of the course
      const existingTeachers = Classroom.Courses.Teachers.list(courseId).teachers || [];
      const existingTeacherEmails = existingTeachers.map((teacher) => teacher.profile.emailAddress);

      if (existingTeacherEmails.includes(teacherEmail)) {
        console.log(
          `Teacher ${teacherEmail} is already part of course ${courseId}. Skipping invitation.`
        );
        return;
      }

      const invitation = {
        courseId: courseId,
        role: 'TEACHER',
        userId: teacherEmail,
      };
      Classroom.Invitations.create(invitation);
      console.log(`Sent invitation to teacher: ${teacherEmail} for course: ${courseId}`);
    } catch (error) {
      progressTracker.logError(
        `Failed to invite teacher (${teacherEmail}) to course (${courseId}): ${error.message}`,
        error
      );
    }
  }

  /**
   * Updates an existing Google Classroom based on provided data.
   * @param {string} courseId - The ID of the classroom to update.
   * @param {string} newName - The new name for the classroom.
   * @param {string} newOwnerId - The new owner email, if changing owner.
   * @param {Array<string>} newTeacherEmails - The updated list of teacher emails.
   */
  static updateClassroom(courseId, newName, newOwnerId, newTeacherEmails = []) {
    const progressTracker = ProgressTracker.getInstance();
    try {
      const course = Classroom.Courses.get(courseId);

      // Update course name if changed
      if (course.name !== newName) {
        course.name = newName;
        Classroom.Courses.update(course, courseId);
        console.log(`Updated course name to '${newName}' for course ID: ${courseId}`);
      }

      // Update owner if changed
      if (newOwnerId && course.ownerId !== newOwnerId) {
        course.ownerId = newOwnerId;
        Classroom.Courses.update(course, courseId);
        console.log(`Updated course owner to '${newOwnerId}' for course ID: ${courseId}`);
      }

      // Get existing teachers
      const existingTeachers = Classroom.Courses.Teachers.list(courseId).teachers || [];
      const existingTeacherEmails = existingTeachers.map((teacher) => teacher.profile.emailAddress);

      // Invite new teachers who are not already teachers
      newTeacherEmails.forEach((email) => {
        if (email !== newOwnerId && !existingTeacherEmails.includes(email)) {
          this.inviteTeacher(courseId, email);
        }
      });

      console.log(`Updated classroom (${courseId}) successfully.`);
    } catch (error) {
      progressTracker.logAndThrowError(
        `Failed to update classroom (${courseId}): ${error.message}`,
        error
      );
    }
  }

  /**
   * Fetches all classrooms where the user is a teacher.
   * @returns {Array<GoogleAppsScript.Classroom.Schema.Course>} An array of classroom objects.
   */
  static fetchClassrooms() {
    const progressTracker = ProgressTracker.getInstance();
    try {
      const response = Classroom.Courses.list({ teacherId: 'me', courseStates: ['ACTIVE'] });
      const courses = response.courses || [];
      console.log(`Fetched ${courses.length} classrooms.`);
      return courses;
    } catch (error) {
      progressTracker.logAndThrowError(`Failed to fetch classrooms: ${error.message}`, error);
    }
  }

  /**
   * Fetches all active classrooms with pagination.
   * Iterates through all pages until there is no nextPageToken.
   * @returns {Array<Object>} An array of objects containing course IDs and names.
   */
  static fetchAllActiveClassrooms() {
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
          courses = courses.concat(activeCourses);
        }
        pageToken = response.nextPageToken;
      } while (pageToken);

      ABLogger.getInstance().info('Active classrooms retrieved', { count: courses.length });
      return courses;
    } catch (error) {
      progressTracker.logError(`Failed to retrieve active classrooms: ${error.message}`, error);
      return [];
    }
  }

  /**
   * Fetch a single course by ID.
   * @param {string} courseId
   * @returns {GoogleAppsScript.Classroom.Schema.Course|null}
   */
  static fetchCourse(courseId) {
    const progressTracker = ProgressTracker.getInstance();
    try {
      const course = Classroom.Courses.get(courseId);
      return course || null;
    } catch (error) {
      progressTracker.logError(`Failed to fetch course (${courseId}): ${error.message}`, error);
      return null;
    }
  }

  /**
   * Fetch teachers for a given course.
   * Returns the raw teacher objects as provided by the API (so callers can
   * inspect profile fields).
   * @param {string} courseId
   * @returns {Array<Object>} array of teacher resource objects
   */
  static fetchTeachers(courseId) {
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
          } catch (err) {
            // If mapping fails for any entry, log and skip that entry.
            progressTracker.logError(
              `Failed to map teacher resource for course (${courseId}): ${err.message}`,
              err
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
  }

  /**
   * Fetches all students from Google Classroom for a given course.
   * Iterates through pages until there is no nextPageToken.
   * @param {string} courseId - The ID of the Google Classroom course.
   * @return {Student[]} - An array of Student instances.
   */
  static fetchAllStudents(courseId) {
    const progressTracker = ProgressTracker.getInstance();
    try {
      const studentList = [];
      let pageToken = null;

      do {
        const params = { pageSize: 40 };
        if (pageToken) params.pageToken = pageToken;

        const response = Classroom.Courses.Students.list(courseId, params);

        if (response.students && response.students.length > 0) {
          response.students.forEach((student) => {
            const name = student.profile.name.fullName;
            const email = student.profile.emailAddress;
            const id = student.profile.id;

            const studentInstance = new Student(name, email, id);
            studentList.push(studentInstance);
          });
        } else {
          console.log(`No students found for course ID: ${courseId} on this page.`);
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
  }
}

// Export for Node tests / CommonJS environment
if (typeof module !== 'undefined') {
  module.exports = { ClassroomApiClient };
}
