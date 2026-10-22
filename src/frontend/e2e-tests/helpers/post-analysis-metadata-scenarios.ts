/** Canonical historical-source boundary for changed post-analysis metadata writes. */

import classesByIdRaw from '@synthetic/small/classesById.json';
import classPartialsRaw from '@synthetic/small/classPartials.json';
import assignmentDefinitionPartialsRaw from '@synthetic/small/assignmentDefinitionPartials.json';
import assignmentsByKeyRaw from '@synthetic/small/assignmentsByKey.json';
import { DataAnalysisService } from '@/services/dataAnalysis/dataAnalysisService';
import {
  ABClassMetadataSchema,
  type AverageScores,
  type RecentAssignment,
} from '@/services/abClass/abClassMetadata.zod';
import type { MetricResult, PerClassResult } from '@/services/dataAnalysis/dataAnalysis.zod';
import {
  AssignmentDefinitionPartialsResponseSchema,
  type AssignmentDefinitionPartialsResponse,
} from '@/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { ClassFullSchema } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import { ClassPartialSchema } from '@/services/googleClassrooms/classPartials.zod';
import { AssignmentFullSchema } from '@/services/assignmentAssessment/assignmentAssessment.zod';
import type { ResponseItem, RuntimeScenario } from '../shared/runtimeMockTypes';

const CLASS_ID = 'class-2';
const SUMMARY_UPDATED_AT = '2026-10-20T06:30:00.123Z';
const OMIT_FINAL_ASSIGNMENT = 1;
const CLASS_PREFETCH_LIMIT = 3;
const TARGET_ASSIGNMENT_ID = 'assignment-2-2';
const LATER_TARGET_UPDATED_AT = '2026-10-21T06:30:00.123Z';
const classDocuments = classesByIdRaw as Record<string, unknown>;
const classPartials = classPartialsRaw as ReadonlyArray<Record<string, unknown>>;
const assignmentDefinitions = assignmentDefinitionPartialsRaw as unknown;
const assignmentsByKey = assignmentsByKeyRaw as Record<string, unknown>;

/**
 * Maps one analysis metric without importing the production metadata projection.
 * @param {MetricResult} metric - Calculated metric.
 * @returns {AverageScores['overall']} Wire score or marker.
 */
function expectedScore(metric: MetricResult): AverageScores['overall'] {
  return metric.state === 'excluded' ? 'excluded' : metric.value;
}

/**
 * Maps all four analysis metrics to their wire representation.
 * @param {PerClassResult} metrics - Calculated class metrics.
 * @returns {AverageScores} Wire scores.
 */
function expectedScores(metrics: PerClassResult): AverageScores {
  return {
    completeness: expectedScore(metrics.completeness),
    accuracy: expectedScore(metrics.accuracy),
    spag: expectedScore(metrics.spag),
    overall: expectedScore(metrics.overall),
  };
}

/**
 * Requires a keyed record from a canonical transport view.
 * @param {Record<string, unknown>} records - Canonical keyed view.
 * @param {string} id - Required record key.
 * @param {string} view - View label for diagnostics.
 * @returns {unknown} The canonical record.
 */
function requireRecord(records: Record<string, unknown>, id: string, view: string): unknown {
  const record = records[id];
  if (record === undefined) throw new Error(`Missing canonical ${view} record ${id}.`);
  return record;
}

/**
 * Requires a successful queued response and returns its untrusted payload.
 * @param {ResponseItem | undefined} entry - Queued response.
 * @param {string} label - Queue entry label for diagnostics.
 * @returns {unknown} Successful response payload.
 */
function requireSuccessData(entry: ResponseItem | undefined, label: string): unknown {
  if (entry?.kind !== 'success') throw new Error(`Missing successful ${label} response.`);
  return entry.data;
}

/**
 * Requires an existing queue rather than substituting an empty default.
 * @param {ReadonlyArray<ResponseItem> | undefined} queue - Runtime response queue.
 * @param {string} label - Queue label for diagnostics.
 * @returns {ReadonlyArray<ResponseItem>} Existing response queue.
 */
function requireQueue(
  queue: ReadonlyArray<ResponseItem> | undefined,
  label: string
): ReadonlyArray<ResponseItem> {
  if (queue === undefined) throw new Error(`Missing ${label} response queue.`);
  return queue;
}

/**
 * Builds the canonical historical-source metadata replacement journey.
 * @param {'class' | 'heatmaps'} surface - Consumer determining assignment-read queue.
 * @returns {RuntimeScenario} Ordered runtime queues.
 */
function buildScenario(surface: 'class' | 'heatmaps'): RuntimeScenario {
  const canonical = ClassFullSchema.parse(requireRecord(classDocuments, CLASS_ID, 'classesById'));
  // The committed corpus's newest assignment has null studentName. Model its preceding
  // source version by omitting only that final assignment; do not repair canonical evidence.
  const source = structuredClone(canonical);
  source.assignments = source.assignments.slice(0, -OMIT_FINAL_ASSIGNMENT);
  const target = source.assignments.find(
    (assignment) => assignment.assignmentId === TARGET_ASSIGNMENT_ID
  );
  if (target === undefined)
    throw new Error(`Missing canonical target assignment ${TARGET_ASSIGNMENT_ID}.`);
  if (target?.updatedAt == null) {
    throw new Error(`Canonical historical class ${CLASS_ID} has no timestamped target.`);
  }
  source.metadata = null;
  const updatedPartial = classPartials.find((row) => row.classId === CLASS_ID);
  if (updatedPartial === undefined) throw new Error(`Missing canonical class partial ${CLASS_ID}.`);

  const definitions: AssignmentDefinitionPartialsResponse =
    AssignmentDefinitionPartialsResponseSchema.parse(assignmentDefinitions);
  const analysis = new DataAnalysisService().analyse({
    classes: [source],
    assignmentDefinitionPartials: definitions,
    filter: { classIds: [CLASS_ID] },
  })[0];
  const targetAnalysis = new DataAnalysisService().analyse({
    classes: [ClassFullSchema.parse({ ...source, assignments: [target] })],
    assignmentDefinitionPartials: definitions,
    filter: { classIds: [CLASS_ID] },
  })[0];
  const classAverages = expectedScores(analysis.perClass);
  const recent: RecentAssignment = {
    assignmentId: target.assignmentId,
    assignmentDefinitionKey: target.assignmentDefinitionKey,
    averages: expectedScores(targetAnalysis.perClass),
    updatedAt: target.updatedAt,
  };
  const metadata = {
    classAverages: { ...classAverages, updatedAt: SUMMARY_UPDATED_AT },
    recentAssignments: [recent],
  };
  const updatedFull = { ...source, metadata };
  const updatedPartialWithMetadata = { ...updatedPartial, metadata };
  // Class-page prefetch follows its actual top-three order. The target is the
  // only requested assignment on standalone Heatmaps; do not invent a replay.
  const assignmentRequests =
    surface === 'class'
      ? source.assignments
          .toSorted((left, right) => {
            if (left.updatedAt == null || right.updatedAt == null) {
              throw new Error('Canonical class prefetch assignments must include timestamps.');
            }
            const timestampOrder = right.updatedAt.localeCompare(left.updatedAt);
            return timestampOrder || left.assignmentId.localeCompare(right.assignmentId);
          })
          .slice(0, CLASS_PREFETCH_LIMIT)
          .map((assignment) => {
            const record = assignmentsByKey[assignment.assignmentId];
            return record === undefined ? null : AssignmentFullSchema.parse(record);
          })
      : [
          AssignmentFullSchema.parse(
            requireRecord(assignmentsByKey, TARGET_ASSIGNMENT_ID, 'assignmentsByKey')
          ),
        ];

  return {
    hasScriptAuthorisation: [successResponse(true)],
    getABClassPartials: [
      successResponse([{ ...updatedPartial, metadata: null }]),
      successResponse([updatedPartialWithMetadata]),
    ],
    getABClass: [successResponse(source), successResponse(source), successResponse(updatedFull)],
    updateABClass: [successResponse(updatedPartialWithMetadata)],
    getAssignmentDefinitionPartials: [successResponse(definitions)],
    getAssignment: assignmentRequests.map((assignment) => successResponse(assignment)),
    getCohorts: [successResponse([])],
    getYearGroups: [successResponse([{ key: 'year-group-9', name: '9' }])],
    getAssignmentTopics: [successResponse([])],
  };
}

/**
 * Wraps a payload in a successful runtime response.
 * @param {unknown} data - Successful payload.
 * @returns {ResponseItem} Runtime response item.
 */
function successResponse(data: unknown): ResponseItem {
  return { kind: 'success', data };
}

/** Canonical class identity used by post-analysis metadata browser journeys. */
export const POST_ANALYSIS_CLASS_ID = CLASS_ID;
/** Canonical class label used by the standalone Heatmaps selector. */
export const POST_ANALYSIS_CLASS_NAME = (() => {
  const className = ClassFullSchema.parse(
    requireRecord(classDocuments, CLASS_ID, 'classesById')
  ).className;
  if (typeof className !== 'string' || className.length === 0) {
    throw new Error(`Canonical class ${CLASS_ID} has no class name.`);
  }
  return className;
})();
/** Canonical assignment id selected in the standalone Heatmaps journey. */
export const POST_ANALYSIS_ASSIGNMENT_ID = TARGET_ASSIGNMENT_ID;
/** Display label from the matching canonical live assignment definition. */
export const POST_ANALYSIS_ASSIGNMENT_TITLE = (() => {
  const assignment = ClassFullSchema.parse(
    requireRecord(classDocuments, CLASS_ID, 'classesById')
  ).assignments.find((item) => item.assignmentId === TARGET_ASSIGNMENT_ID);
  if (assignment === undefined)
    throw new Error(`Missing canonical target assignment ${TARGET_ASSIGNMENT_ID}.`);
  const definitions = AssignmentDefinitionPartialsResponseSchema.parse(assignmentDefinitions);
  const definition = definitions.find(
    (item) => item.definitionKey === assignment.assignmentDefinitionKey
  );
  if (definition === undefined)
    throw new Error(`Missing canonical target definition ${assignment.assignmentDefinitionKey}.`);
  if (typeof definition.primaryTitle !== 'string' || definition.primaryTitle.length === 0) {
    throw new Error(
      `Canonical target definition ${definition.definitionKey} has no primary title.`
    );
  }
  return definition.primaryTitle;
})();

/**
 * Create a browser runtime scenario for the changed-metadata journey.
 * @param {'class' | 'heatmaps'} surface - Consumer determining assignment-read queue.
 * @returns {RuntimeScenario} Canonical source and calculated replacement queues.
 */
export function createChangedMetadataScenario(surface: 'class' | 'heatmaps'): RuntimeScenario {
  return buildScenario(surface);
}

/**
 * Creates a Heatmaps lifecycle with a genuinely newer target source version on manual refresh.
 * @returns {RuntimeScenario} Ordered queues for two confirmed metadata writes.
 */
export function createLaterVersionMetadataScenario(): RuntimeScenario {
  const initial = buildScenario('heatmaps');
  const firstPartial = requireSuccessData(
    requireQueue(initial.getABClassPartials, 'class partials')[1],
    'initial class partial'
  );
  const firstClass = requireSuccessData(
    requireQueue(initial.getABClass, 'class')[2],
    'initial class'
  );
  const newerSource = ClassFullSchema.parse(firstClass);
  const target = newerSource.assignments.find(
    (assignment) => assignment.assignmentId === TARGET_ASSIGNMENT_ID
  );
  if (target === undefined) throw new Error(`Missing target ${TARGET_ASSIGNMENT_ID}.`);
  target.updatedAt = LATER_TARGET_UPDATED_AT;
  const stalePartial = ClassPartialSchema.array().parse(firstPartial).at(0);
  if (stalePartial === undefined) throw new Error('Initial class partial response is empty.');
  const staleFull = structuredClone(newerSource);
  const savedPartial = structuredClone(stalePartial);
  const savedFull = structuredClone(newerSource);
  const targetAfterWrite = savedFull.assignments.find(
    (assignment) => assignment.assignmentId === TARGET_ASSIGNMENT_ID
  );
  if (targetAfterWrite === undefined) throw new Error(`Missing target ${TARGET_ASSIGNMENT_ID}.`);
  const savedMetadata = ABClassMetadataSchema.parse(savedFull.metadata);
  if (savedMetadata === null) throw new Error('Initial saved class metadata is null.');
  savedFull.metadata = {
    ...savedMetadata,
    recentAssignments: savedMetadata.recentAssignments.map((recent) => {
      return recent.assignmentId === TARGET_ASSIGNMENT_ID
        ? { ...recent, updatedAt: LATER_TARGET_UPDATED_AT }
        : recent;
    }),
  };
  savedPartial.metadata = savedFull.metadata;
  return {
    ...initial,
    getABClassPartials: [
      ...requireQueue(initial.getABClassPartials, 'class partials'),
      successResponse([stalePartial]),
    ],
    getABClass: [
      ...requireQueue(initial.getABClass, 'class'),
      successResponse(staleFull),
      successResponse(newerSource),
      successResponse(savedFull),
    ],
    updateABClass: [successResponse(stalePartial), successResponse(savedPartial)],
    getAssignmentDefinitionPartials: [
      ...requireQueue(initial.getAssignmentDefinitionPartials, 'assignment definitions'),
      ...requireQueue(initial.getAssignmentDefinitionPartials, 'assignment definitions'),
    ],
    getAssignment: [
      ...requireQueue(initial.getAssignment, 'assignments'),
      ...requireQueue(initial.getAssignment, 'assignments'),
    ],
  };
}
