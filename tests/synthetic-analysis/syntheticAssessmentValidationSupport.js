import { generateSyntheticAnalysisGraph } from '#synthetic-data/generateSyntheticAnalysisGraph.js';
import { buildValidationContext } from '#synthetic-data/validationContext.js';
import { toTransportViews } from '#synthetic-data/toTransportViews.js';
import { validatePersistenceGraph } from '#synthetic-data/validatePersistenceGraph.js';
import { validateTransportGraph } from '#synthetic-data/validateTransportGraph.js';
import { assertAssignmentsByKeyView } from '#synthetic-data/validateAssignmentsByKeyView.js';

import {
  readItemMap,
  recordsOf,
  requireDefined,
  requireRecord,
} from './syntheticAssessmentContractSupport.js';
import {
  assessmentCauseEntries,
  canonicalNumericAssessments,
} from './syntheticAssessmentValidationRules.js';

/**
 * Boundary traversal and canonicalisation helpers owned by the subject
 * factories in `syntheticAssessmentValidationOwners.js`.
 *
 * @remarks
 * These probes retain local canonicalisation from their historical Red origin;
 * the generator and committed corpus have since cut over. Validation-context
 * nodes hold identifiers only, and document submissions carry complete
 * numeric maps, so mutations in one view cannot alias another owner's state.
 * The helper exports below are shared within this test-only family and are not
 * a public contract.
 */

/** @typedef {Record<string, unknown>} RawRecord */
/** @typedef {{item: RawRecord, submission: RawRecord, assignmentId: unknown}} Target */
/** @typedef {{taskId: string, task: RawRecord}} DefinitionTaskTarget */

const CURRENT_MARKER = 1;

/** Fresh, connected raw graph pieces for one deterministic profile run. */
export function freshPieces() {
  const graph = generateSyntheticAnalysisGraph('small');
  const persistence = /** @type {Record<string, unknown>} */ (graph.persistence);
  return { manifest: graph.manifest, referenceData: graph.referenceData, persistence };
}

/**
 * Replaces one null-document item with the canonical base placeholder state.
 *
 * @param {RawRecord} item Null-document submission item.
 */
function canonicaliseNullDocumentItem(item) {
  const artefact = /** @type {Record<string, unknown>} */ (
    requireDefined(item.artifact, 'null-document artefact')
  );
  item.artifact = {
    taskId: item.taskId,
    role: 'submission',
    pageId: null,
    documentId: null,
    content: null,
    contentHash: null,
    metadata: {},
    uid: artefact.uid,
    type: 'base',
  };
  item.assessments = assessmentCauseEntries('acquisition', 'SOURCE_UNREADABLE');
  item.feedback = {};
}

/**
 * Locally canonicalises a cloned persistence graph into the desired
 * version-1 state by stamping the marker once per assignment and completing
 * every assessment map.
 *
 * @param {Record<string, unknown>} persistence Raw persistence graph.
 */
export function canonicalisePersistence(persistence) {
  for (const assignment of recordsOf(persistence.assignments, 'assignments')) {
    assignment.assessmentContractVersion = CURRENT_MARKER;
    for (const submission of recordsOf(assignment.submissions, 'submissions')) {
      for (const item of Object.values(readItemMap(submission.items))) {
        if (submission.documentId === null) canonicaliseNullDocumentItem(item);
        else item.assessments = canonicalNumericAssessments();
      }
    }
  }
}

/**
 * Retains E reasoning and causes in the partial view and stamps the current
 * marker on both wire views so the local baseline stays coherent with the
 * canonical contract. This preserves the boundary setup used by historical Red
 * probes while exercising the current generator contract.
 *
 * @param {{assignmentsByKey: unknown, classesById: unknown}} views Transport views.
 */
export function canonicaliseTransportViews(views) {
  for (const fullView of /** @type {RawRecord[]} */ (Object.values(views.assignmentsByKey))) {
    fullView.assessmentContractVersion = CURRENT_MARKER;
  }
  for (const classView of /** @type {RawRecord[]} */ (Object.values(views.classesById))) {
    for (const partial of recordsOf(classView.assignments, 'assignments')) {
      partial.assessmentContractVersion = CURRENT_MARKER;
      for (const submission of recordsOf(partial.submissions, 'submissions')) {
        if (submission.documentId !== null) continue;
        for (const item of Object.values(readItemMap(submission.items))) {
          item.assessments = assessmentCauseEntries('acquisition', 'SOURCE_UNREADABLE');
        }
      }
    }
  }
}

/** Locates the first null-document or document submission target. */
export function findTarget(assignments, wantNullDocument) {
  for (const assignment of recordsOf(assignments, 'assignments')) {
    for (const submission of recordsOf(assignment.submissions, 'submissions')) {
      if ((submission.documentId === null) !== wantNullDocument) continue;
      const firstEntry = Object.entries(readItemMap(submission.items)).at(0);
      if (firstEntry === undefined) continue;
      return {
        item: firstEntry[1],
        submission,
        assignmentId: assignment.assignmentId,
      };
    }
  }
  throw new Error('Expected a canonical submission item for the boundary probe.');
}

/** Resolves the first keyed task of one hydrated completed-assignment definition. */
function firstKeyedTaskOf(definition) {
  const firstTaskEntry = Object.entries(
    /** @type {Record<string, unknown>} */ (definition.tasks)
  ).at(0);
  if (firstTaskEntry === undefined) {
    throw new Error('Expected at least one keyed definition task for the boundary probe.');
  }
  return {
    taskId: String(firstTaskEntry[0]),
    task: requireDefined(firstTaskEntry[1], 'definition task'),
  };
}

/**
 * Locates the first hydrated (keyed-task) definition task behind a completed
 * generated assignment, so shared reference/template artefact probes act on the
 * actual completed-assignment structure of the current graph instead of an
 * invented definition shape.
 *
 * @param {unknown[]} assignments Raw assignments to search.
 * @param {unknown[]} definitions Raw definitions keyed by definitionKey.
 * @param {(assignment: RawRecord) => string} keyOf Definition-key reader; full
 *   transport view callers supply the embedded-definition variant.
 * @returns {DefinitionTaskTarget} The first completed definition task.
 */
export function findCompletedDefinitionTask(assignments, definitions, keyOf) {
  const definitionByKey = new Map(
    recordsOf(definitions, 'definitions').map((definition) => [
      String(definition.definitionKey),
      definition,
    ])
  );
  for (const assignment of recordsOf(assignments, 'assignments')) {
    const definition = definitionByKey.get(keyOf(assignment));
    if (definition !== undefined && !Array.isArray(definition.tasks)) {
      return firstKeyedTaskOf(definition);
    }
  }
  throw new Error('Expected a hydrated completed-assignment definition task boundary.');
}
