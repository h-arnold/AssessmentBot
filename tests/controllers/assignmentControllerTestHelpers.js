/**
 * Shared fixtures for the AssignmentController suites that need a complete
 * `AssignmentDefinition` instance (`assignmentController.definitionInputs.test.js`
 * and `assignmentController.hydration.test.js`).
 *
 * The definition model is loaded through the backend CommonJS owner so both suites
 * share one module identity with the controller under test.
 */
const { AssignmentDefinition } = require('#backend/Models/AssignmentDefinition.js');

/**
 * Builds a complete `AssignmentDefinition`, filling in the standard fixture values for
 * any field the caller omits.
 *
 * @param {Object} [options] Field overrides.
 * @param {string} [options.primaryTitle] Title of the primary document.
 * @param {string} [options.primaryTopic] Topic of the primary document.
 * @param {string} [options.yearGroupKey] Year group key.
 * @param {string} [options.yearGroupLabel] Year group label.
 * @param {string} [options.documentType] Type of the primary document.
 * @param {string} [options.referenceDocumentId] Drive ID of the reference document.
 * @param {string} [options.templateDocumentId] Drive ID of the template document.
 * @param {Object} [options.tasks] Task map keyed by task ID.
 * @returns {Object} The constructed `AssignmentDefinition`.
 */
function createFullDefinition(options) {
  if (options === void 0) {
    options = {};
  }
  let primaryTitle = options.primaryTitle;
  let primaryTopic = options.primaryTopic;
  let yearGroupKey = options.yearGroupKey;
  let yearGroupLabel = options.yearGroupLabel;
  let documentType = options.documentType;
  let referenceDocumentId = options.referenceDocumentId;
  let templateDocumentId = options.templateDocumentId;
  let tasks = options.tasks;
  if (primaryTitle === void 0) {
    primaryTitle = 'Test';
  }
  if (primaryTopic === void 0) {
    primaryTopic = 'Topic';
  }
  if (yearGroupKey === void 0) {
    yearGroupKey = 'year-group-10';
  }
  if (yearGroupLabel === void 0) {
    yearGroupLabel = 'Year 10';
  }
  if (documentType === void 0) {
    documentType = 'SLIDES';
  }
  if (referenceDocumentId === void 0) {
    referenceDocumentId = 'ref';
  }
  if (templateDocumentId === void 0) {
    templateDocumentId = 'tpl';
  }
  if (tasks === void 0) {
    tasks = {
      t1: {
        id: 't1',
        taskTitle: 'Task 1',
        pageId: 'p1',
        artifacts: {
          reference: [{ taskId: 't1', role: 'reference', content: 'content', contentHash: 'hash' }],
        },
      },
    };
  }
  return new AssignmentDefinition({
    primaryTitle: primaryTitle,
    primaryTopic: primaryTopic,
    yearGroupKey: yearGroupKey,
    yearGroupLabel: yearGroupLabel,
    documentType: documentType,
    referenceDocumentId: referenceDocumentId,
    templateDocumentId: templateDocumentId,
    tasks: tasks,
  });
}

export { createFullDefinition };
