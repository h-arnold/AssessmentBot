// Student.js

/**
 * Student Class
 * 
 * Represents an individual student within an assignment.
 */
class Student {
    /**
     * Constructs a Student instance.
     * @param {string} name - Full name of the student.
     * @param {string} email - Email address of the student.
     * @param {string} id - Unique ID of the student from Google Classroom.
     */
    constructor(name, email, id) {
      this.name = name;         // string: Full name
      this.email = email;       // string: Email address
      this.id = id;             // string: Unique ID from Google Classroom
      this.documentId = null;   // string: Slide ID of the student's submission (to be assigned)
    }
  
    /**
     * Serializes the Student instance to a JSON object.
     * @return {Object} - The JSON representation of the Student.
     */
    toJSON() {
      return {
        name: this.name,
        email: this.email,
        id: this.id,
        documentId: this.documentId
      };
    }
  
    /**
     * Deserializes a JSON object to a Student instance.
     * @param {Object} json - The JSON object representing a Student.
     * @return {Student} - The Student instance.
     */
    static fromJSON(json) {
      const { name, email, id, documentId } = json;
      const student = new Student(name, email, id);
      student.documentId = documentId || null;
      return student;
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
            response.students.forEach(student => {
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