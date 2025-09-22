// Teacher.js

/**
 * Teacher Class
 *
 * Minimal model to represent a teacher referenced in classroom sheets.
 */
class Teacher {
  /**
   * @param {string} email - Teacher's email address
   * @param {string} userId - Google userId for the teacher (from Classroom API)
   */
  constructor(email, userId = null) {
    this.email = email || null;
    this.userId = userId || null;
  }

  /**
   * Get the teacher's email address.
   * @return {string|null}
   */
  getEmail() {
    return this.email;
  }

  /**
   * Set the teacher's email address.
   * @param {string} email
   */
  setEmail(email) {
    this.email = email || null;
  }

  /**
   * Get the teacher's Google userId.
   * @return {string|null}
   */
  getUserId() {
    return this.userId;
  }

  /**
   * Set the teacher's Google userId.
   * @param {string} userId
   */
  setUserId(userId) {
    this.userId = userId || null;
  }

  toJSON() {
    return {
      email: this.email,
      userId: this.userId,
    };
  }

  static fromJSON(json) {
    if (!json || typeof json !== 'object') return null;
    const { email, userId } = json;
    return new Teacher(email || null, userId || null);
  }
}

if (typeof module !== 'undefined') {
  module.exports = { Teacher };
}
