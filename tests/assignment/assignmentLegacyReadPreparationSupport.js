/**
 * Shared fixtures for the legacy read-preparation suites.
 *
 * The fixtures are derived from the committed canonical `small` (healthy) and
 * `medium` (mixed numeric/E) synthetic views through
 * `deriveLegacyAssignmentScenario`, whose `'stored'` variant removes the
 * assessment-contract marker. Restoration then yields a legacy `Assignment`
 * instance whose `submissions` is the preserved raw array and whose embedded
 * `assignmentDefinition.tasks` is either the keyed full map or, for the
 * class-embedded shape, the lightweight summary array.
 *
 * Corruption probes clone these records and mutate one field locally; no
 * competing realistic fixture is introduced.
 */

const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
const Rehydration = require('#backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js');
const { Assessment } = require('#backend/Models/Assessment.js');

import { expect } from 'vitest';
import { loadSyntheticAnalysisProfile } from '#synthetic-data/loadSyntheticAnalysisProfile.js';
import { deriveLegacyAssignmentScenario } from '#synthetic-data/deriveLegacyAssignmentScenario.js';

/** Canonical healthy selection: `small` `class-0` / `assignment-0-1`. */
export const HEALTHY_ASSIGNMENT_ID = 'assignment-0-1';
/** Canonical mixed numeric/E selection: `medium` `class-0` / `assignment-0-2`. */
export const MIXED_ASSIGNMENT_ID = 'assignment-0-2';

/**
 * Derives one linked stored legacy scenario from the named committed profile.
 *
 * @param {string} profileName Committed profile name.
 * @param {string} assignmentId Selected assignment identifier.
 * @returns {{full: object, classEmbedded: object, classView: object}} Derived stored scenario.
 */
export function deriveStoredScenario(profileName, assignmentId) {
  return deriveLegacyAssignmentScenario({
    profileName,
    assignmentId,
    variant: 'stored',
    sources: {
      classesById: loadSyntheticAnalysisProfile(profileName, 'classesById'),
      assignmentsByKey: loadSyntheticAnalysisProfile(profileName, 'assignmentsByKey'),
    },
  });
}

/**
 * Clones the canonical healthy stored full record (keyed full definition).
 *
 * @returns {object} Detached full legacy record.
 */
export function healthyFullRecord() {
  return structuredClone(deriveStoredScenario('small', HEALTHY_ASSIGNMENT_ID).full);
}

/**
 * Clones the canonical mixed numeric/E stored full record (keyed full definition).
 *
 * @returns {object} Detached full legacy record.
 */
export function mixedFullRecord() {
  return structuredClone(deriveStoredScenario('medium', MIXED_ASSIGNMENT_ID).full);
}

/**
 * Restores a legacy record into an `Assignment` instance.
 *
 * @param {object} record Stored legacy record.
 * @returns {object} Restored legacy assignment.
 */
export function restoreLegacy(record) {
  const restored = Assignment.fromJSON(record);
  if (restored.assessmentContractVersion === 1) {
    throw new Error('Legacy fixture must not carry the current marker');
  }
  return restored;
}

/**
 * Converts a full legacy record into a redacted class-embedded partial record:
 * the tasks become the lightweight summary array, stored artefact bodies and
 * hashes are null, and numeric reasoning is stripped while E reasoning is kept.
 *
 * @param {object} fullRecord Full legacy record.
 * @returns {object} Detached partial legacy record with an array task definition.
 */
export function partialSnapshot(fullRecord) {
  const record = structuredClone(fullRecord);
  const definition = structuredClone(record.assignmentDefinition);
  definition.tasks = Object.values(definition.tasks).map((task) => ({
    taskId: task.taskId ?? task.id,
    taskWeighting: task.taskWeighting,
    taskTitle: task.taskTitle,
  }));
  record.assignmentDefinition = definition;
  for (const key of ['tasks', 'referenceDocumentId', 'templateDocumentId']) {
    Reflect.deleteProperty(record, key);
  }
  Reflect.deleteProperty(record, 'assessmentContractVersion');
  for (const submission of record.submissions) {
    for (const item of Object.values(submission.items)) {
      item.artifact.content = null;
      item.artifact.contentHash = null;
      for (const entry of Object.values(item.assessments)) {
        if (!(entry.score === 'E' && entry.error)) Reflect.deleteProperty(entry, 'reasoning');
      }
    }
  }
  return record;
}

/**
 * Restores a full record and, for partial validation, replaces its embedded
 * definition with the array summary shape. The stored submissions are kept
 * exactly as restored.
 *
 * @param {object} fullRecord Full legacy record.
 * @param {'full'|'partial'} definitionShape Embedded definition representation.
 * @returns {object} Restored legacy assignment carrying the requested definition shape.
 */
export function restoredWithDefinitionShape(fullRecord, definitionShape) {
  if (definitionShape === 'full') return restoreLegacy(fullRecord);
  return restoreLegacy(partialSnapshot(fullRecord));
}

/**
 * Invokes the legacy read-preparation owner, asserting the facade seam exists.
 *
 * @param {object} assignment Restored legacy assignment.
 * @param {'full'|'partial'} form Requested output serialisation form.
 * @returns {Array<object>|null} Prepared read submissions, or null for a non-array root.
 */
export function prepare(assignment, form) {
  expect(Rehydration.prepareLegacyReadSubmissions).toEqual(expect.any(Function));
  return Rehydration.prepareLegacyReadSubmissions(assignment, form);
}

/**
 * Task IDs carried by the assignment's embedded definition, in definition order.
 *
 * @param {object} assignment Restored legacy assignment.
 * @returns {string[]} Ordered task IDs.
 */
export function embeddedTaskIds(assignment) {
  const tasks = assignment.assignmentDefinition.tasks;
  return Array.isArray(tasks) ? tasks.map((task) => task.taskId) : Object.keys(tasks);
}

/** Fresh all-criteria validation/CORRUPT_RECORD catalogue map. */
export function corruptRecordAssessments() {
  const entry = () => Assessment.createError('validation', 'CORRUPT_RECORD').toJSON();
  return { completeness: entry(), accuracy: entry(), spag: entry() };
}
