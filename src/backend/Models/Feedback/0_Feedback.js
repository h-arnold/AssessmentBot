/**
 * Base class for all feedback types used in student task responses.
 * Provides common functionality and structure for different feedback types.
 */
class Feedback {
  /**
   * Constructs a new Feedback instance.
   * @param {string} type - The type identifier for this feedback.
   * @returns {void}
   */
  constructor(type) {
    this.type = type;
    this.createdAt = new Date();
  }

  /**
   * Gets the type of this feedback.
   * @returns {string} The feedback type.
   */
  getType() {
    return this.type;
  }

  /**
   * Serializes the feedback to a JSON object.
   * @returns {Object} JSON representation of the feedback.
   */
  toJSON() {
    return {
      type: this.type,
      createdAt: this.createdAt instanceof Date ? this.createdAt.toISOString() : this.createdAt,
    };
  }

  /**
   * Creates a feedback instance from JSON data.
   * @param {Object} json - JSON data to deserialize.
   * @returns {Feedback} A feedback instance of the appropriate subclass.
   */
  static fromJSON(json) {
    if (json.type === 'cellReference') {
      return CellReferenceFeedback.fromJSON(json);
    }
    // Add cases for future feedback types
    throw new Error(`Unknown feedback type: ${json.type}`);
  }
}

// Export for Node.js tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Feedback;
}
