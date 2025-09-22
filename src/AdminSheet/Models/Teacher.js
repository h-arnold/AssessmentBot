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
    const val = email || null;
    if (val === null) {
      this.email = null;
      return;
    }
    if (this._Validate && typeof this._Validate.isEmail === 'function') {
      if (!this._Validate.isEmail(val)) throw new TypeError('Invalid email');
    }
    this.email = val;
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
    const val = userId || null;
    if (val === null) {
      this.userId = null;
      return;
    }
    if (this._Validate && typeof this._Validate.isGoogleUserId === 'function') {
      if (!this._Validate.isGoogleUserId(val)) throw new TypeError('Invalid userId');
    }
    this.userId = val;
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
