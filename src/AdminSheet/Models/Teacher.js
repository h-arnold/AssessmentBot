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
   * @param {string} teacherName - Optional full name of the teacher
   */
  constructor(email, userId = null, teacherName = null) {
    this.userId = userId || null;
    this.email = email || null;
    this.teacherName = teacherName || null;
  }

  /**
   * Get the teacher's name.
   * @return {string|null}
   */
  getTeacherName() {
    return this.teacherName;
  }

  /**
   * Set the teacher's name.
   * @param {string} name
   */
  setTeacherName(name) {
    const val = name || null;
    if (val === null) {
      this.teacherName = null;
      return;
    }
    if (this._Validate && typeof this._Validate.isString === 'function') {
      if (!this._Validate.isString(val)) throw new TypeError('Invalid teacherName');
    }
    this.teacherName = val;
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
    return Object.assign({
      email: this.email,
      userId: this.userId,
    }, this.teacherName == null ? {} : { teacherName: this.teacherName });
  }

  static fromJSON(json) {
    if (!json || typeof json !== 'object') return null;
    const { email, userId } = json;
    if ('teacherName' in json) return new Teacher(email || null, userId || null, json.teacherName);
    return new Teacher(email || null, userId || null);
  }
}

if (typeof module !== 'undefined') {
  module.exports = { Teacher };
}
