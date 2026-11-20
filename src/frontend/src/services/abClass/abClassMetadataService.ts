import { runApiQueuedTask } from '../api/apiQueue';
import { callApi, parseApiResponse } from '../apiService';
import type { AssignmentDefinitionPartial } from '../assignmentDefinition/assignmentDefinitionPartials.zod';
import { DataAnalysisService } from '../dataAnalysis/dataAnalysisService';
import type { AveragingAnalyserInput } from '../dataAnalysis/dataAnalysis.zod';
import {
  compareAssignmentNewestFirst,
  getMetadataRefreshDecision,
  mergeClassMetadata,
  RECENT_ASSIGNMENT_LIMIT,
  type MetadataRefreshSkipped,
} from '../dataAnalysis/postAnalysis/metadataProjection';
import { getABClass } from '../googleClassrooms/classDetail/classDetailService';
import type { ClassFull } from '../googleClassrooms/classDetail/classDetailService.zod';
import { ClassPartialSchema, type ClassPartial } from '../googleClassrooms/classPartials.zod';
import { UpdateABClassRequestSchema } from './abClassMutations.zod';
import { CLASSES_BULK_MUTATION_JOB_NAME } from './abClassMutationService';

export type RefreshOutcome =
  | MetadataRefreshSkipped
  | { status: 'saved'; confirmedPersistence: true; classPartial: ClassPartial };

export interface MetadataRefreshInput {
  classId: string;
  assignmentDefinitionPartials: AssignmentDefinitionPartial[];
}

/**
 * Reserves the existing class-mutation lane for the entire refresh operation.
 * @param {MetadataRefreshInput} input - Class identity and live definition partials.
 * @param {() => string} now - Canonical UTC clock, read only when preparing a write.
 * @returns {Promise<RefreshOutcome>} Authoritative no-op or parsed confirmed save.
 * @remarks Serialisation is session-local, not a cross-session lock. The fresh
 * validated read bypasses the query cache and replaces any cached target decision.
 * Network calls inside the slot use callApi, never a nested same-lane enqueue.
 * Failures propagate unchanged; transport alone owns retries. No upsert or rollback.
 * The writer supplies the target and newest assignments to the single summary call:
 * all calculation, including baseline selection, belongs to the analysis service.
 * Rolling history stays with the projection and is never rebuilt from live
 * definitions. No query, invalidation or feedback hook is added here.
 */
export function refreshABClassMetadataInQueue(
  input: MetadataRefreshInput,
  now: () => string
): Promise<RefreshOutcome> {
  return runApiQueuedTask(CLASSES_BULK_MUTATION_JOB_NAME, async () => {
    const classFull = await getABClass({ classId: input.classId });
    if (classFull === null) throw new Error(`Class not found: ${input.classId}`);

    const decision = getMetadataRefreshDecision(classFull);
    if (decision.status === 'skipped') return decision;
    requireDefinitionCoverage(classFull, input.assignmentDefinitionPartials);

    const service = new DataAnalysisService();
    const analysisInput: AveragingAnalyserInput = {
      classes: [classFull],
      assignmentDefinitionPartials: input.assignmentDefinitionPartials,
      filter: { classIds: [classFull.classId], analysisMode: 'absolute' },
    };
    const recentAssignments = classFull.assignments
      .toSorted(compareAssignmentNewestFirst)
      .slice(0, RECENT_ASSIGNMENT_LIMIT);
    const summary = service.analyseClassSummary(analysisInput, {
      target: decision.target,
      recentAssignments,
    });
    const metadata = mergeClassMetadata(classFull.metadata, summary, now());
    const request = UpdateABClassRequestSchema.parse({ classId: input.classId, metadata });
    const method = 'updateABClass';
    const data = await callApi(method, request);
    const classPartial = parseApiResponse(ClassPartialSchema, method, data);
    return { status: 'saved', confirmedPersistence: true, classPartial };
  });
}

/**
 * Prevents the analyser's missing-definition filter from narrowing full scope.
 * @param {ClassFull} classFull - Authoritative complete class.
 * @param {AssignmentDefinitionPartial[]} definitions - Live definition registry.
 * @returns {void} Throws before calculation when any assignment cannot resolve.
 */
function requireDefinitionCoverage(
  classFull: ClassFull,
  definitions: AssignmentDefinitionPartial[]
): void {
  const keys = new Set(definitions.map((definition) => definition.definitionKey));
  for (const assignment of classFull.assignments) {
    if (!keys.has(assignment.assignmentDefinitionKey)) {
      throw new Error(
        `Missing assignment definition ${assignment.assignmentDefinitionKey} for class ${classFull.classId}, assignment ${assignment.assignmentId}`
      );
    }
  }
}
