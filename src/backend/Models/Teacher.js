// Teacher.js

/**
 * Represents a teacher referenced in classroom sheets.
 * Holds contact information and unique identifiers.
 */
class Teacher {
  /**
   * Constructs a Teacher instance.
   * @param {string} email - Teacher's email address
   * @param {string|null} [userId] - Google userId for the teacher (from Classroom API)
   * @param {string|null} [teacherName] - Optional full name of the teacher
   */
  constructor(email, userId = null, teacherName = null) {
    this.userId = userId || null;
    this.email = email || null;
    this.teacherName = teacherName || null;
  }

  /**
   * Get the teacher's name.
   * @returns {string|null} The teacher's name, or null if not set
   */
  getTeacherName() {
    return this.teacherName;
  }

  /**
   * Set the teacher's name.
   * @param {string|null} name - The teacher's name, or null to clear
   */
  setTeacherName(name = null) {
    if (!name) {
      this.teacherName = null;
      return;
    }
    if (
      this._Validate &&
      typeof this._Validate.isString === 'function' &&
      !this._Validate.isString(name)
    )
      throw new TypeError('Invalid teacherName');
    this.teacherName = name;
  }

  /**
   * Get the teacher's email address.
   * @returns {string|null} The teacher's email, or null if not set
   */
  getEmail() {
    return this.email;
  }

  /**
   * Set the teacher's email address.
   * @param {string|null} email - The teacher's email, or null to clear
   */
  setEmail(email = null) {
    if (!email) {
      this.email = null;
      return;
    }
    if (
      this._Validate &&
      typeof this._Validate.isEmail === 'function' &&
      !this._Validate.isEmail(email)
    )
      throw new TypeError('Invalid email');
    this.email = email;
  }

  /**
   * Get the teacher's Google userId.
   * @returns {string|null} The teacher's Google userId, or null if not set
   */
  getUserId() {
    return this.userId;
  }

  /**
   * Set the teacher's Google userId.
   * @param {string|null} userId - The teacher's Google userId, or null to clear
   */
  setUserId(userId = null) {
    if (!userId) {
      this.userId = null;
      return;
    }
    if (
      this._Validate &&
      typeof this._Validate.isGoogleUserId === 'function' &&
      !this._Validate.isGoogleUserId(userId)
    )
      throw new TypeError('Invalid userId');
    this.userId = userId;
  }

  /**
   * Serialises this teacher to a JSON object.
   * @returns {Object} A plain object representation of the teacher
   */
  toJSON() {
    return {
      email: this.email,
      userId: this.userId,
      ...(this.teacherName == null ? {} : { teacherName: this.teacherName }),
    };
  }

  /**
   * Deserialises a JSON object to a Teacher instance.
   * @param {Object|null} json - The serialised teacher object
   * @returns {Teacher|null} A new Teacher instance, or null if json is falsy
   */
  static fromJSON(json) {
    if (!json || typeof json !== 'object') return null;
    const { email, userId, teacherName } = json;
    if ('teacherName' in json) return new Teacher(email || null, userId || null, teacherName);
    return new Teacher(email || null, userId || null);
  }
}

if (typeof module !== 'undefined') {
  module.exports = { Teacher };
}
