/**
 * AssignmentDefinitionReferenceData
 *
 * Resolves reference data (topics, year groups) for assignment definition operations.
 * Creates ReferenceDataController instances as needed for database lookups.
 */
/* global ReferenceDataController */
/**
 *
 */
class AssignmentDefinitionReferenceData {
  /**
   * Resolves and validates an assignment topic by key.
   *
   * @param {string} primaryTopicKey - Topic key.
   * @returns {{key: string, name: string}} Topic record.
   * @throws {Error} When topic key is unknown.
   */
  requireExistingAssignmentTopic(primaryTopicKey) {
    const topics = this.listAssignmentTopics();
    const topicRecord = topics.find((topic) => topic?.key === primaryTopicKey) || null;

    if (!topicRecord) {
      throw new Error(`Unknown primaryTopicKey: ${primaryTopicKey}`);
    }

    return topicRecord;
  }

  /**
   * Lists assignment-topic records.
   *
   * @returns {Array<{key: string, name: string}>} Topic records.
   */
  listAssignmentTopics() {
    const controller = new ReferenceDataController();
    return controller.listAssignmentTopics();
  }

  /**
   * Resolves and validates a year-group record by key.
   *
   * @param {string} yearGroupKey - Year-group key.
   * @returns {{key: string, name: string}} Year-group record.
   * @throws {Error} When yearGroupKey is unknown or invalid.
   */
  requireExistingYearGroupRecord(yearGroupKey) {
    if (typeof yearGroupKey !== 'string' || yearGroupKey.trim().length === 0) {
      throw new Error('yearGroupKey must be a non-empty string.');
    }
    const normalisedYearGroupKey = yearGroupKey.trim();
    const yearGroupRecords = this.listYearGroups();
    const yearGroupRecord =
      yearGroupRecords.find((record) => record?.key === normalisedYearGroupKey) || null;

    if (!yearGroupRecord) {
      throw new Error(`Unknown yearGroupKey: ${yearGroupKey}`);
    }

    return yearGroupRecord;
  }

  /**
   * Lists year-group reference records.
   *
   * @returns {Array<{key: string, name: string}>} Year-group records.
   */
  listYearGroups() {
    const controller = new ReferenceDataController();
    return controller.listYearGroups();
  }
}

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentDefinitionReferenceData;
}
