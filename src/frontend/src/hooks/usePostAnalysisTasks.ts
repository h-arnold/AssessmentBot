import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { App } from 'antd';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { PostAnalysisFeedback } from './postAnalysisFeedback';
import { completePostAnalysisInvalidation } from './postAnalysisInvalidation';
import { logFrontendError } from '@/logging/frontendLogger';
import {
  PostAnalysisContextSchema,
  type PostAnalysisContext,
} from '@/services/dataAnalysis/postAnalysis/postAnalysis.zod';
import {
  runPostAnalysisTasks,
  validatePostAnalysisTasks,
  type PostAnalysisTaskDescriptor,
  type PostAnalysisTaskOutcome,
} from '@/services/dataAnalysis/postAnalysis/runPostAnalysisTasks';
import { sourceVersionSignature } from '@/services/dataAnalysis/postAnalysis/postAnalysisTasks';

interface PostAnalysisState {
  outcomes: PostAnalysisTaskOutcome[];
}

type AttemptKey = string | PostAnalysisContext;

/** Mount-owned attempt storage and observable state, not a server-data cache. */
class PostAnalysisOwner {
  readonly feedback: PostAnalysisFeedback;
  private readonly attempts: Map<string, Map<AttemptKey, Promise<PostAnalysisTaskOutcome>>>;
  private readonly listeners: Set<() => void>;
  private snapshot: PostAnalysisState;
  private selectedClassId: string | null;
  private feedbackGeneration: object;

  /** Initialises mount-owned attempt storage and observable empty state.
   * @param {PostAnalysisFeedback} feedback - Independent notification lifecycle.
   */
  constructor(feedback: PostAnalysisFeedback) {
    this.feedback = feedback;
    this.attempts = new Map();
    this.listeners = new Set();
    this.snapshot = { outcomes: [] };
    this.selectedClassId = null;
    this.feedbackGeneration = {};
  }

  getSnapshot = (): PostAnalysisState => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Publishes the current task states.
   * @param {PostAnalysisTaskOutcome[]} outcomes - Ordered task state snapshot.
   * @returns {void} Notifies attached React subscribers.
   */
  private publish(outcomes: PostAnalysisTaskOutcome[]): void {
    this.snapshot = { outcomes };
    for (const listener of this.listeners) listener();
  }

  /** Tracks class ownership independently of analysis readiness.
   * @param {string | null} classId - Committed selection, or null when no class is selected.
   * @returns {void} Invalidates late feedback from previous visits.
   */
  navigate(classId: string | null): void {
    if (classId !== this.selectedClassId) this.feedbackGeneration = {};
    this.selectedClassId = classId;
    this.feedback.navigate(classId);
  }

  /** Attaches one committed effect to new or previously pending work.
   * @param {PostAnalysisContext | null} input - Explicit successful context or no work.
   * @param {readonly PostAnalysisTaskDescriptor[]} tasks - Ordered descriptors.
   * @param {QueryClient} queryClient - Shared server-state owner.
   * @param {ReturnType<typeof App.useApp>['notification']} notification - Existing App host API.
   * @returns {() => void} Detaches publication without aborting active network work.
   */
  attach(
    input: PostAnalysisContext | null,
    tasks: readonly PostAnalysisTaskDescriptor[],
    queryClient: QueryClient,
    notification: ReturnType<typeof App.useApp>['notification']
  ): () => void {
    let isAttached = true;
    if (input === null) {
      this.publish([]);
      return () => {
        isAttached = false;
      };
    }
    const feedbackGeneration = this.feedbackGeneration;
    const context = PostAnalysisContextSchema.parse(input);
    validatePostAnalysisTasks(tasks);
    const outcomes: PostAnalysisTaskOutcome[] = tasks.map((task) => {
      return {
        data: { taskId: task.id, status: 'pending' },
        error: null,
      };
    });
    this.publish([...outcomes]);

    const complete = async (): Promise<void> => {
      for (const [index, task] of tasks.entries()) {
        // Key computation is execution too: a task-local failure must not break
        // the effect or prevent a later independent descriptor from starting.
        let key: AttemptKey;
        let descriptor = task;
        try {
          key = task.getAttemptKey ? task.getAttemptKey(context) : input;
        } catch (error: unknown) {
          key = input;
          descriptor = {
            id: task.id,
            run: () => {
              throw error;
            },
          };
        }
        let taskAttempts = this.attempts.get(task.id);
        if (!taskAttempts) {
          taskAttempts = new Map();
          this.attempts.set(task.id, taskAttempts);
        }
        let attempt = taskAttempts.get(key);
        if (!attempt) {
          attempt = runPostAnalysisTasks(context, [descriptor]).then((results) =>
            completePostAnalysisInvalidation(queryClient, context, results[0])
          );
          taskAttempts.set(key, attempt);
        }
        outcomes[index] = await attempt;
        if (isAttached) this.publish([...outcomes]);
        this.showFeedback(notification, key, outcomes[index], feedbackGeneration);
      }
    };
    void complete().catch((error: unknown) => {
      logFrontendError('usePostAnalysisTasks.complete', error, {
        classId: context.classFull.classId,
      });
    });
    return () => {
      isAttached = false;
    };
  }

  /** Resolves task-owned source identity for feedback.
   * @param {ReturnType<typeof App.useApp>['notification']} notification - Existing host API.
   * @param {AttemptKey} key - Task source version or original context identity.
   * @param {PostAnalysisTaskOutcome} outcome - Settled attempt result.
   * @param {object} generation - Class visit that started this execution.
   * @returns {void} Offers the result to the metadata feedback owner.
   */
  private showFeedback(
    notification: ReturnType<typeof App.useApp>['notification'],
    key: AttemptKey,
    outcome: PostAnalysisTaskOutcome,
    generation: object
  ): void {
    if (generation !== this.feedbackGeneration) return;
    const source =
      typeof key === 'string' ? key : sourceVersionSignature(key.classFull.assignments);
    this.feedback.show(notification, source, outcome);
  }
}

/** Canonical shared extension point for post-analysis side effects.
 * @param {PostAnalysisContext | null} context - Successful validated analysis and unsliced class.
 * @param {readonly PostAnalysisTaskDescriptor[]} tasks - Ordered unique task descriptors.
 * @param {string | null} selectedClassId - Class ownership, independent of analysis readiness.
 * @returns {PostAnalysisState} Non-blocking per-task state and local technical Errors.
 * @remarks Register a descriptor in the production task factory to add a task. Each
 * task owns eligibility and an optional source-version key; unkeyed tasks run for
 * each new successful context object. Metadata-only refreshes do not retry keyed
 * work, including failures. Attempts last for this mount, across class navigation.
 * Effects start only after commit. StrictMode replay reattaches to cached promises;
 * cleanup suppresses stale state publication but never claims to abort queued writes.
 * Confirmed metadata attempts include both required query invalidations before
 * settling. Persistent feedback has a separate mount/class lifetime, so ordinary
 * effect detachment neither destroys nor reopens a dismissed warning, and a
 * readiness-driven null context for the same selected class does not suppress a
 * pending attempt's warning.
 */
export function usePostAnalysisTasks(
  context: PostAnalysisContext | null,
  tasks: readonly PostAnalysisTaskDescriptor[],
  selectedClassId: string | null
): PostAnalysisState {
  const ownerId = useId();
  const queryClient = useQueryClient();
  const { notification } = App.useApp();
  const [owner] = useState(() => new PostAnalysisOwner(new PostAnalysisFeedback(ownerId)));
  const state = useSyncExternalStore(owner.subscribe, owner.getSnapshot);
  useEffect(() => owner.feedback.mount(), [owner]);
  useEffect(() => owner.navigate(selectedClassId), [owner, selectedClassId]);
  useEffect(
    () => owner.attach(context, tasks, queryClient, notification),
    [owner, context, tasks, queryClient, notification, selectedClassId]
  );
  return state;
}
