/**
 * Shared wiring for the two connected run-completion suites
 * (`assignmentRunCompletion.test.js` and `assignmentRunCompletion.llmOutcomes.test.js`).
 *
 * Both suites drive the real `AssignmentController.processSelectedAssignment` over the real
 * persistence chain, so they need the same hermetic store and production seams. This module
 * owns that wiring; it installs globals on `globalThis` at call time and never restores them,
 * leaving restoration to each suite's own `saveGlobals`/`restoreGlobals` pair.
 */
import { vi } from 'vitest';

const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
const AssignmentController = require('#backend/y_controllers/AssignmentController.js');

/**
 * Reports whether a document matches every key/value pair in a store filter.
 *
 * @param {Object} document Candidate stored document.
 * @param {Object} [filter] Store filter of exact-match key/value pairs.
 * @returns {boolean} True when every filter entry matches the document.
 */
function matchesFilter(document, filter) {
  return Object.entries(filter ?? {}).every(([key, value]) => document[key] === value);
}

/**
 * Creates hermetic per-name in-memory collections recording every store operation.
 *
 * @returns {{ collections: Map<string, Object>, instance: Object }} The collection map and the
 *   DbManager-shaped instance that resolves it.
 */
function createMockDb() {
  const collections = new Map();
  const instance = {
    getCollection(name) {
      if (!collections.has(name)) {
        const docs = [];
        collections.set(name, {
          docs,
          findOne: vi.fn((filter) => docs.find((doc) => matchesFilter(doc, filter)) ?? null),
          insertOne: vi.fn((doc) => docs.push(doc)),
          replaceOne: vi.fn((filter, doc) => {
            const index = docs.findIndex((stored) => matchesFilter(stored, filter));
            if (index >= 0) docs.splice(index, 1, doc);
            else docs.push(doc);
          }),
          updateOne: vi.fn((filter, patch) => {
            const stored = docs.find((doc) => matchesFilter(doc, filter));
            if (stored && patch?.$set) Object.assign(stored, patch.$set);
          }),
          save: vi.fn(),
        });
      }
      return collections.get(name);
    },
  };
  return { collections, instance };
}

/**
 * Counts distinct submission items by whether any criterion carries an explicit E.
 *
 * @param {Object} fullRecord Persisted full assignment record.
 * @param {boolean} failed Whether to count items carrying an E (true) or not (false).
 * @returns {number} The number of matching items.
 */
function countItems(fullRecord, failed) {
  let count = 0;
  for (const submission of fullRecord.submissions) {
    for (const item of Object.values(submission.items ?? {})) {
      const hasError = Object.values(item.assessments ?? {}).some((entry) => entry.score === 'E');
      if (hasError === failed) count += 1;
    }
  }
  return count;
}

/**
 * Wires one run's hermetic stores and production seams: in-memory DbManager collections
 * seeded with the canonical class document, a DriveManager freshness seam returning the
 * definition's own timestamps, a ClassroomApiClient roster seam derived from that class
 * document, and a definition seam returning the (model-owned) canonical full definition.
 *
 * @param {string} courseId Course whose class collection receives the class document.
 * @param {Object} classDocument Canonical class document to seed.
 * @param {Object} definition Canonical full assignment definition.
 * @returns {{ collections: Map<string, Object>, instance: Object }} The seeded mock database.
 */
function wireRunStores(courseId, classDocument, definition) {
  const db = createMockDb();
  globalThis.DbManager = { getInstance: () => db.instance };
  db.instance.getCollection(courseId).docs.push(classDocument);
  globalThis.DriveManager = {
    getFileModifiedTime: vi.fn((id) =>
      id === definition.referenceDocumentId
        ? definition.referenceLastModified
        : definition.templateLastModified
    ),
  };
  globalThis.ClassroomApiClient = {
    fetchCourse: vi.fn(() => ({
      id: courseId,
      name: classDocument.className,
      ownerId: classDocument.classOwner?.userId ?? null,
    })),
    fetchTeachers: vi.fn(() => structuredClone(classDocument.teachers)),
    fetchAllStudents: vi.fn(() => structuredClone(classDocument.students)),
  };
  globalThis.AssignmentDefinitionController = class {
    getDefinitionByKey() {
      return structuredClone(definition);
    }
  };
  return db;
}

/**
 * Installs the Assignment.create seam and the no-op pipeline stage spies.
 *
 * @param {Object} assignment Restored assignment instance the controller must receive.
 * @param {Object} stages Object that receives each installed stage spy by stage name.
 * @returns {void}
 */
function wireRunAssignment(assignment, stages) {
  vi.spyOn(Assignment, 'create').mockReturnValue(assignment);
  for (const stage of ['fetchSubmittedDocuments', 'processAllSubmissions', 'assessResponses']) {
    stages[stage] = vi.spyOn(assignment, stage).mockImplementation(() => {});
  }
  if (typeof assignment.processImages === 'function') {
    stages.processImages = vi.spyOn(assignment, 'processImages').mockImplementation(() => {});
  }
}

/**
 * Narrows a definition's task map to the selected task IDs, in place.
 *
 * @param {Object} definition Full assignment definition to narrow.
 * @param {Set<string>} selectedTaskIds Task IDs the completed run must cover.
 * @returns {void}
 */
function narrowDefinitionTasks(definition, selectedTaskIds) {
  definition.tasks = Object.fromEntries(
    Object.entries(definition.tasks).filter(([id]) => selectedTaskIds.has(id))
  );
}

/**
 * Builds the completion runner for one restored assignment: the real controller's
 * `processSelectedAssignment` bound to that assignment's identifiers.
 *
 * @param {Object} assignment Restored assignment whose run must be driven.
 * @returns {() => void} Runner invoking the real completion path.
 */
function createRun(assignment) {
  const controller = new AssignmentController();
  return () =>
    controller.processSelectedAssignment({
      assignmentId: assignment.assignmentId,
      definitionKey: assignment.assignmentDefinition.definitionKey,
      courseId: assignment.courseId,
    });
}

export {
  countItems,
  createMockDb,
  createRun,
  matchesFilter,
  narrowDefinitionTasks,
  wireRunAssignment,
  wireRunStores,
};
