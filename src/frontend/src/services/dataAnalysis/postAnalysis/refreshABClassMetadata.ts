import {
  refreshABClassMetadataInQueue,
  type RefreshOutcome,
} from '@/services/abClass/abClassMetadataService';
import type { PostAnalysisContext } from './postAnalysis.zod';
import { getMetadataRefreshDecision } from './metadataProjection';

/**
 * Runs the first post-analysis task after a successful validated averaging run.
 * @param {PostAnalysisContext} context - Successful analysis and unsliced source data.
 * @param {() => string} now - Write-preparation clock supplied by the lifecycle owner.
 * @returns {Promise<RefreshOutcome>} Cheap no-op or authoritative queued refresh.
 * @remarks Display results authorise this task but are never persisted as full
 * class scores. The writer recalculates with constructor-owned standard weights
 * and no display filters. Timestamp-only no-ops enqueue, calculate and stamp nothing.
 */
export async function refreshABClassMetadata(
  context: PostAnalysisContext,
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
