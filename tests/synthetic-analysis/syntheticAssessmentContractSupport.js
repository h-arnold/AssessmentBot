import { expect } from 'vitest';

import { generateSyntheticAnalysisGraph } from '#synthetic-data/generateSyntheticAnalysisGraph.js';

/**
 * Raw boundary guards shared by the canonical synthetic assessment contract
 * suites. The generated graph is untyped JavaScript, so structural nodes are
 * narrowed with explicit record/array guards and asserted leaves stay raw
 * `unknown`; planned missing capabilities are asserted rather than typed.
 */

/** @type {ReadonlyArray<'completeness'|'accuracy'|'spag'>} */
export const CRITERIA = ['completeness', 'accuracy', 'spag'];

/** @type {ReadonlyArray<'TEXT'|'IMAGE'|'SPREADSHEET'>} */
export const ARTEFACT_TYPES = ['TEXT', 'IMAGE', 'SPREADSHEET'];

export const SOURCE_UNREADABLE_REASONING = 'The submitted document could not be accessed.';
export const ASSESSMENT_FAILED_REASONING = 'The extracted work could not be assessed.';
/** Roster index that the generated corpus gives the null-document variant. */
export const NULL_DOCUMENT_ROSTER_INDEX = 2;

/**
 * Verifies a value is a plain object record.
 *
 * @param {unknown} value Value to verify.
 * @returns {boolean} True for plain objects and class instances, not arrays or null.
 */
export function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Returns an object record or throws a labelled error.
 *
 * @param {unknown} value Value to narrow.
 * @param {string} label Assertion label.
 * @returns {Record<string, unknown>} The narrowed record.
 */
export function requireRecord(value, label) {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return /** @type {Record<string, unknown>} */ (value);
}

/**
 * Returns an array or throws a labelled error.
 *
 * @param {unknown} value Value to narrow.
 * @param {string} label Assertion label.
 * @returns {unknown[]} The narrowed array.
 */
export function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

/**
 * Returns a defined value or throws a labelled error.
 *
 * @template T
 * @param {T | undefined} value Value to narrow.
 * @param {string} label Assertion label.
 * @returns {T} The defined value.
 */
export function requireDefined(value, label) {
  if (value === undefined) throw new Error(`${label} is missing.`);
  return value;
}

/**
 * Narrows an array of plain-object records or throws a labelled error.
 *
 * @param {unknown} value Value to narrow.
 * @param {string} label Assertion label.
 * @returns {Record<string, unknown>[]} The narrowed records.
 */
export function recordsOf(value, label) {
  return requireArray(value, label).map((entry, index) =>
    requireRecord(entry, `${label}[${index}]`)
  );
}

/**
 * Reads a submission item map keyed by task ID.
 *
 * @param {unknown} value Raw items container.
 * @returns {Record<string, Record<string, unknown>>} Items keyed by task ID.
 */
export function readItemMap(value) {
  const container = requireRecord(value, 'items');
  return Object.fromEntries(
    Object.entries(container).map(([taskId, item]) => [
      taskId,
      requireRecord(item, `item ${taskId}`),
    ])
  );
}

/**
 * Collects every submission item across the supplied assignments.
 *
 * @param {unknown[]} assignments Raw assignments.
 * @returns {Record<string, unknown>[]} Submission items as records.
 */
export function itemsOfAssignments(assignments) {
  return recordsOf(assignments, 'assignments').flatMap((assignment) =>
    recordsOf(assignment.submissions, 'submissions').flatMap((submission) =>
      Object.values(readItemMap(submission.items))
    )
  );
}

/**
 * Generates a named profile graph narrowed to a raw record.
 *
 * @param {string} profile Supported profile name.
 * @returns {Record<string, unknown>} The generated graph.
 */
export function graphFor(profile) {
  return requireRecord(generateSyntheticAnalysisGraph(profile), 'graph');
}

/**
 * Resolves declared task IDs from a keyed task record or a partial summary array.
 *
 * @param {unknown} definition Raw assignment definition.
 * @returns {string[]} Declared task IDs.
 */
export function resolveTaskIds(definition) {
  const tasks = requireRecord(definition, 'definition').tasks;
  if (Array.isArray(tasks)) {
    return recordsOf(tasks, 'tasks').map((task) => {
      if (typeof task.taskId !== 'string')
        throw new Error('Task summaries must carry string task IDs.');
      return task.taskId;
    });
  }
  return Object.keys(requireRecord(tasks, 'tasks'));
}

/**
 * Reports hydration eligibility: keyed tasks and both document identifiers present.
 *
 * @param {unknown} definition Raw assignment definition.
 * @returns {boolean} True when the definition can hydrate a full assignment.
 */
export function isHydratableDefinition(definition) {
  const record = requireRecord(definition, 'definition');
  return (
    !Array.isArray(record.tasks) &&
    typeof record.referenceDocumentId === 'string' &&
    typeof record.templateDocumentId === 'string'
  );
}

/**
 * Asserts a complete all-three E failure map with the pinned reasoning and cause.
 *
 * @param {unknown} assessments Raw failure map.
 * @param {string} label Assertion label.
 * @param {string} stage Expected cause stage.
 * @param {string} code Expected cause code.
 * @param {string} reasoning Expected catalogue reasoning.
 */
export function expectAllThreeFailures(assessments, label, stage, code, reasoning) {
  const record = requireRecord(assessments, label);
  expect(Object.keys(record).sort()).toEqual([...CRITERIA].sort());
  for (const criterion of CRITERIA) {
    const entry = requireRecord(record[criterion], `${label}.${criterion}`);
    expect(entry.score).toBe('E');
    expect(entry.reasoning).toBe(reasoning);
    const cause = requireRecord(entry.error, `${label}.${criterion}.error`);
    expect(cause.stage).toBe(stage);
    expect(cause.code).toBe(code);
  }
}

/**
 * Asserts usable full artefact bodies in their raw shapes: TEXT/IMAGE strings,
 * SPREADSHEET 2D grids.
 *
 * @param {Record<string, unknown>} artefact Raw artefact record.
 * @param {string} label Assertion label.
 */
export function expectUsableArtefactBody(artefact, label) {
  expect(typeof artefact.contentHash === 'string' && artefact.contentHash.length > 0).toBe(true);
  if (artefact.type === 'SPREADSHEET') {
    const grid = requireArray(artefact.content, `${label}.content`);
    expect(grid.length).toBeGreaterThan(0);
    grid.forEach((row, rowIndex) => {
      for (const cell of requireArray(row, `${label}.row ${rowIndex}`)) {
        expect(cell === null || typeof cell === 'string' || typeof cell === 'number').toBe(true);
      }
    });
    return;
  }
  if (typeof artefact.content !== 'string')
    throw new Error(`${label}.content must be a usable string body.`);
  expect(artefact.content.length).toBeGreaterThan(0);
  if (artefact.type === 'IMAGE') expect(artefact.content).toMatch(/^data:image\//u);
}

/**
 * Collects the reference/template artefact records of one task.
 *
 * @param {unknown} task Raw task record.
 * @returns {Record<string, unknown>[]} Reference and template artefact records.
 */
export function artefactsOfTask(task) {
  const artifacts = requireRecord(requireRecord(task, 'task').artifacts, 'artifacts');
  return [
    ...recordsOf(artifacts.reference, 'reference'),
    ...recordsOf(artifacts.template, 'template'),
  ];
}

/**
 * Collects the class-embedded assignment partials from a full transport view.
 *
 * @param {Record<string, unknown>} transport Raw transport view.
 * @returns {Record<string, unknown>[]} Embedded partial assignment records.
 */
export function embeddedPartialsOf(transport) {
  return Object.values(requireRecord(transport.classesById, 'classesById')).flatMap((classView) =>
    recordsOf(requireRecord(classView, 'classById').assignments, 'assignments')
  );
}

/**
 * Asserts one variant row survives each representation with the same identities
 * and values.
 *
 * @param {unknown} assignment Raw projected assignment.
 * @param {Record<string, unknown>} submission Persistence-shaped variant submission.
 * @param {string[]} expectedTaskIds Declared task IDs.
 * @param {Readonly<Record<string, Record<string, unknown>>>} items Persistence variant items.
 */
export function assertVariantProjection(assignment, submission, expectedTaskIds, items) {
  const projectedSubmission = requireDefined(
    recordsOf(requireRecord(assignment, 'projected assignment').submissions, 'submissions').find(
      (candidate) => candidate.studentId === submission.studentId
    ),
    'projected submission by identity'
  );
  expect(projectedSubmission.documentId).toBeNull();
  const projectedItems = readItemMap(projectedSubmission.items);
  expect(Object.keys(projectedItems).sort()).toEqual([...expectedTaskIds].sort());
  for (const taskId of expectedTaskIds) {
    expect(projectedItems[taskId]).toStrictEqual(items[taskId]);
  }
}
