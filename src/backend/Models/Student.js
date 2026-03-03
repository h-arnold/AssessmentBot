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
    this.name = name; // string: Full name
    this.email = email; // string: Email address
    this.id = id; // string: Unique ID from Google Classroom
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
    };
  }

  /**
   * Deserializes a JSON object to a Student instance.
   * @param {Object} json - The JSON object representing a Student.
   * @return {Student} - The Student instance.
   */
  static fromJSON(json) {
    const { name, email, id } = json;
    const student = new Student(name, email, id);
    return student;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { Student };
}
