import { useMemo, useState } from 'react';
import { usePostAnalysisTasks } from './usePostAnalysisTasks';
import { createPostAnalysisTaskDescriptors } from '@/services/dataAnalysis/postAnalysis/postAnalysisTasks';
import type { PostAnalysisContext } from '@/services/dataAnalysis/postAnalysis/postAnalysis.zod';
import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import type { AveragingResult } from '@/services/dataAnalysis/dataAnalysis.zod';
import type { AssignmentDefinitionPartialsResponse } from '@/services/assignmentDefinition/assignmentDefinitionPartials.zod';

/** Runs shared post-analysis work only for a ready, complete analysis.
 *
 * @remarks
 * Canonical page eligibility/context wrapper for the averaging surfaces. It
 * memoises the context on its inputs, creates the production descriptor list once
 * per mount with a mount-scoped clock, and always forwards the committed selected
 * class ID so feedback ownership survives a readiness-driven `null` context.
 *
 * @param {'loading' | 'blocking' | 'ready'} status - Surface eligibility.
 * @param {ClassFull | null} classFull - Complete class source.
 * @param {AssignmentDefinitionPartialsResponse | null} assignmentDefinitionPartials - Live definitions.
 * @param {AveragingResult | null} averagingResult - Successful analysis.
 * @param {string | null} selectedClassId - Explicit selected-class lifetime.
 * @returns {void} Registers the shared task lifecycle.
 */
export function usePagePostAnalysisTasks(
  status: 'loading' | 'blocking' | 'ready',
  classFull: ClassFull | null,
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse | null,
  averagingResult: AveragingResult | null,
  selectedClassId: string | null
): void {
  const [tasks] = useState(() => createPostAnalysisTaskDescriptors(() => new Date().toISOString()));
  const context = useMemo<PostAnalysisContext | null>(() => {
    if (
      status !== 'ready' ||
      classFull === null ||
      assignmentDefinitionPartials === null ||
      averagingResult === null
    )
      return null;
    return { classFull, assignmentDefinitionPartials, averagingResult };
  }, [status, classFull, assignmentDefinitionPartials, averagingResult]);
  usePostAnalysisTasks(context, tasks, selectedClassId);
}
