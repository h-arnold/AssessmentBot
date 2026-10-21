import { toError } from '@/errors/normaliseUnknownError';
import { logPostAnalysisFailure } from './postAnalysisDiagnostics';
import {
  PostAnalysisTaskOutcomeDataSchema,
  PostAnalysisTaskResultSchema,
  type PostAnalysisContext,
  type PostAnalysisTaskOutcomeData,
  type PostAnalysisTaskResult as SchemaPostAnalysisTaskResult,
} from './postAnalysis.zod';

export type PostAnalysisTaskResult = SchemaPostAnalysisTaskResult;

/** Local execution handle, never an API payload. Freshness is task-owned. */
export interface PostAnalysisTaskDescriptor {
  readonly id: string;
  run(context: PostAnalysisContext): PostAnalysisTaskResult | Promise<PostAnalysisTaskResult>;
  getAttemptKey?(context: PostAnalysisContext): string;
}

export interface PostAnalysisTaskOutcome {
  data: PostAnalysisTaskOutcomeData;
  error: Error | null;
}

/** Rejects invalid registries before any task starts.
 * @param {readonly PostAnalysisTaskDescriptor[]} tasks - Ordered local descriptors.
 * @returns {void} Throws on empty or duplicate IDs.
 */
export function validatePostAnalysisTasks(tasks: readonly PostAnalysisTaskDescriptor[]): void {
  const ids = new Set<string>();
  for (const task of tasks) {
    if (!task.id) throw new Error('Post-analysis task ID must be non-empty');
    if (ids.has(task.id)) throw new Error(`Duplicate post-analysis task ID: ${task.id}`);
    ids.add(task.id);
  }
}

/** Runs independent tasks in declared order, retaining individual failures.
 * @param {PostAnalysisContext} context - Successful validated analysis context.
 * @param {readonly PostAnalysisTaskDescriptor[]} tasks - Unique ordered descriptors.
 * @returns {Promise<PostAnalysisTaskOutcome[]>} Ordered serialisable data and local Errors.
 * @remarks Failure never blocks a later independent task. No dependency graph or
 * retry policy is implied; the shared transport retains its own retry ownership.
 */
export async function runPostAnalysisTasks(
  context: PostAnalysisContext,
  tasks: readonly PostAnalysisTaskDescriptor[]
): Promise<PostAnalysisTaskOutcome[]> {
  validatePostAnalysisTasks(tasks);
  const outcomes: PostAnalysisTaskOutcome[] = [];
  for (const task of tasks) {
    try {
      const result = PostAnalysisTaskResultSchema.parse(await task.run(context));
      const data = PostAnalysisTaskOutcomeDataSchema.parse({ ...result, taskId: task.id });
      outcomes.push({ data, error: null });
    } catch (error_: unknown) {
      const error = toError(error_);
      logPostAnalysisFailure(task.id, context, error);
      outcomes.push({ data: { taskId: task.id, status: 'failed' }, error });
    }
  }
  return outcomes;
}
