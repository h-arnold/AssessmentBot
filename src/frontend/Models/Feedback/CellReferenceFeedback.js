/**
 * Feedback specific to cell references in spreadsheet tasks.
 * Tracks which cells have correct, incorrect, or missing formulae.
 */
class CellReferenceFeedback extends Feedback {
  /**
   * Constructs a new CellReferenceFeedback instance.
   * @param {Array} [items] - Optional initial array of feedback items.
   */
  constructor(items = []) {
    super('cellReference');
    this.items = items; // Array of {location, status} objects
  }

  /**
   * Adds a feedback item for a specific cell.
   * @param {string} location - The cell location (e.g., "A1").
   * @param {string} status - The status of the cell ("correct", "incorrect", "notAttempted").
   */
  addItem(location, status) {
    this.items.push({ location, status });
  }

  /**
   * Gets all feedback items.
   * @return {Array} Array of feedback items.
   */
  getItems() {
    return this.items;
  }

  /**
   * Gets feedback items filtered by status.
   * @param {string} status - The status to filter by.
   * @return {Array} Array of feedback items with the specified status.
   */
  getItemsByStatus(status) {
    return this.items.filter(item => item.status === status);
  }

  /**
   * Gets the count of items with a specific status.
   * @param {string} status - The status to count.
   * @return {number} Number of items with the specified status.
   */
  getCountByStatus(status) {
    return this.getItemsByStatus(status).length;
  }

  /**
   * Serializes the feedback to a JSON object.
   * @return {Object} JSON representation of the feedback.
   */
  toJSON() {
    return {
      ...super.toJSON(),
      items: this.items
    };
  }

  /**
   * Creates a CellReferenceFeedback instance from JSON data.
   * @param {Object} json - JSON data to deserialize.
   * @return {CellReferenceFeedback} A new CellReferenceFeedback instance.
   */
  static fromJSON(json) {
    const feedback = new CellReferenceFeedback(json.items);
    if (json.createdAt) {
      feedback.createdAt = new Date(json.createdAt);
    }
    return feedback;
  }
}

// Export for Apps Script
if (typeof module !== 'undefined') module.exports = CellReferenceFeedback;
