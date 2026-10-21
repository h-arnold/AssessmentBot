import {
  refreshABClassMetadataInQueue,
  type RefreshOutcome,
} from '@/services/abClass/abClassMetadataService';
import type { AssignmentDefinitionPartial } from '@/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import type { AveragingResult } from '../dataAnalysis.zod';
import { getMetadataRefreshDecision } from './metadataProjection';

export interface MetadataRefreshContext {
  classFull: ClassFull;
  assignmentDefinitionPartials: AssignmentDefinitionPartial[];
  averagingResult: AveragingResult;
}

/**
 * Runs the first post-analysis task after a successful validated averaging run.
 * @param {MetadataRefreshContext} context - Successful analysis and unsliced source data.
 * @param {() => string} now - Write-preparation clock supplied by the lifecycle owner.
 * @returns {Promise<RefreshOutcome>} Cheap no-op or authoritative queued refresh.
 * @remarks Display results authorise this task but are never persisted as full
 * class scores. The writer recalculates with constructor-owned standard weights
 * and no display filters. Timestamp-only no-ops enqueue, calculate and stamp nothing.
 */
export async function refreshABClassMetadata(
  context: MetadataRefreshContext,
  now: () => string
): Promise<RefreshOutcome> {
  const decision = getMetadataRefreshDecision(context.classFull);
  if (decision.status === 'skipped') return decision;
  return refreshABClassMetadataInQueue(
    {
      classId: context.classFull.classId,
      assignmentDefinitionPartials: context.assignmentDefinitionPartials,
    },
    now
  );
}
