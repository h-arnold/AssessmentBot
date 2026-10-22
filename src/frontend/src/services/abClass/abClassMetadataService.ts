import { runApiQueuedTask } from '../api/apiQueue';
import { callApi, parseApiResponse } from '../apiService';
import type { AssignmentDefinitionPartial } from '../assignmentDefinition/assignmentDefinitionPartials.zod';
import { DataAnalysisService } from '../dataAnalysis/dataAnalysisService';
import {
  getMetadataRefreshDecision,
  mergeClassMetadata,
  projectAverageScores,
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
    const analyse = (scope: ClassFull) => {
      const result = service.analyse({
        classes: [scope],
        assignmentDefinitionPartials: input.assignmentDefinitionPartials,
        filter: { classIds: [classFull.classId] },
      })[0];
      if (!result) throw new Error(`Missing averaging result for class ${classFull.classId}`);
      return projectAverageScores(result.perClass);
    };
    const classScores = analyse(classFull);
    const assignmentScores = analyse({ ...classFull, assignments: [decision.target] });
    const metadata = mergeClassMetadata(
      classFull.metadata,
      classScores,
      decision.target,
      assignmentScores,
      now()
    );
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
