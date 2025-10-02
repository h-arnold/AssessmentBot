// ClassroomManager.js
/**
 * Handles operations related to Google Classroom entities.
 */
class ClassroomManager {
  /**
   * Fetches all classrooms where the user is a teacher.
   * @returns {Array<GoogleAppsScript.Classroom.Schema.Course>} An array of classroom objects.
   */
  static fetchClassrooms() {
    try {
      const response = Classroom.Courses.list({ teacherId: 'me', courseStates: ['ACTIVE'] });
      const courses = response.courses || [];
      console.log(`Fetched ${courses.length} classrooms.`);
      return courses;
    } catch (error) {
      console.error(`Failed to fetch classrooms: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetches all students from Google Classroom for a given course.
   * Iterates through pages until there is no nextPageToken.
   * @param {string} courseId - The ID of the Google Classroom course.
   * @return {Student[]} - An array of Student instances.
   */
  static fetchAllStudents(courseId) {
    try {
      const studentList = [];
      let pageToken = null; // Start with no page token

      // Continue fetching pages as long as there is a nextPageToken.
      do {
        // Prepare the parameters for the API call.
        const params = { pageSize: 40 };
        if (pageToken) {
          params.pageToken = pageToken;
        }

        // Fetch a page of students.
        const response = Classroom.Courses.Students.list(courseId, params);

        // If there are any students returned, process them.
        if (response.students && response.students.length > 0) {
          response.students.forEach((student) => {
            const name = student.profile.name.fullName;
            const email = student.profile.emailAddress;
            const id = student.profile.id; // Google Classroom student ID

            const studentInstance = new Student(name, email, id);
            studentList.push(studentInstance);
          });
        } else {
          console.log(`No students found for course ID: ${courseId} on this page.`);
        }

        // Update pageToken for the next iteration.
        pageToken = response.nextPageToken;
      } while (pageToken); // Loop until nextPageToken is undefined or null

      return studentList;
    } catch (error) {
      console.error(`Error fetching students for course ID ${courseId}:`, error);
      return [];
    }
  }
}

if (typeof module !== 'undefined') {
  module.exports = { ClassroomManager };
}
