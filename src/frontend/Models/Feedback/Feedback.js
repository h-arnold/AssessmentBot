/**
 * Base class for all feedback types used in student task responses.
 * Provides common functionality and structure for different feedback types.
 */
class Feedback {
  /**
   * Constructs a new Feedback instance.
   * @param {string} type - The type identifier for this feedback.
   */
  constructor(type) {
    this.type = type;
    this.createdAt = new Date();
  }

  /**
   * Gets the type of this feedback.
   * @return {string} The feedback type.
   */
  getType() {
    return this.type;
  }

  /**
   * Serializes the feedback to a JSON object.
   * @return {Object} JSON representation of the feedback.
   */
  toJSON() {
    return {
      type: this.type,
      createdAt: this.createdAt
    };
  }

  /**
   * Creates a feedback instance from JSON data.
   * @param {Object} json - JSON data to deserialize.
   * @return {Feedback} A feedback instance of the appropriate subclass.
   */
  static fromJSON(json) {
    switch(json.type) {
      case 'cellReference':
        return CellReferenceFeedback.fromJSON(json);
      // Add cases for future feedback types
      default:
        throw new Error(`Unknown feedback type: ${json.type}`);
    }
  }
}

// Export for Apps Script
if (typeof module !== 'undefined') module.exports = Feedback;
