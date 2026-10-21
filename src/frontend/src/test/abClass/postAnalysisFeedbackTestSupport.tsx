import { useLayoutEffect, useState } from 'react';
import { App } from 'antd';
import { act, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { usePostAnalysisTasks } from '@/hooks/usePostAnalysisTasks';
import type { PostAnalysisContext } from '@/services/dataAnalysis/postAnalysis/postAnalysis.zod';
import type { PostAnalysisTaskDescriptor } from '@/services/dataAnalysis/postAnalysis/runPostAnalysisTasks';
import { PostAnalysisTaskRegistry } from '@/services/dataAnalysis/postAnalysis/postAnalysisTasks';
import type { createAppQueryClient } from '@/query/queryClient';
import { renderWithFrontendProviders } from '../renderWithFrontendProviders';
import { SUMMARY_TIME } from './metadataRefreshFixtures';

export const METADATA_TASK_ID = 'refreshABClassMetadata';
export const SAVE_TITLE = 'Class summary not saved';
export const SAVE_DESCRIPTION =
  'Analysis is ready, but the class summary could not be saved. Reload the page to try again.';
export const REFRESH_TITLE = 'Class summary refresh failed';
export const REFRESH_DESCRIPTION =
  'The class summary was saved, but refreshed data could not be loaded. Reload the page to refresh it.';

/** Reuses the production metadata source key without duplicating its algorithm.
 * @param {PostAnalysisTaskDescriptor['run']} run - Local persistence outcome probe.
 * @returns {PostAnalysisTaskDescriptor} Metadata descriptor using its actual public identity.
 */
export function metadataDescriptor(
  run: PostAnalysisTaskDescriptor['run']
): PostAnalysisTaskDescriptor {
  return { ...new PostAnalysisTaskRegistry(() => SUMMARY_TIME).tasks[0], run };
}

type HookState = ReturnType<typeof usePostAnalysisTasks>;

/** Completes only an already-requested leave, as a browser CSS animation would.
 * @param {HTMLElement} notice - The actual notice whose dismissal/cleanup is under test.
 * @returns {Promise<void>} Resolves after rc-motion removes the notice from the real host.
 */
export async function completeNotificationLeave(notice: HTMLElement): Promise<void> {
  // HappyDOM does not run CSS animations; do not manufacture the leave itself.
  await waitFor(() => expect(notice).toHaveClass('ant-notification-fade-leave-active'));
  await act(async () => {
    notice.dispatchEvent(new Event('animationend', { bubbles: true }));
  });
  await waitFor(() => expect(notice).not.toBeInTheDocument());
}

/** Renders independent owners beneath one existing context-aware notification host.
 * @param {(PostAnalysisContext | null)[]} inputs - One initial context per mounted owner.
 * @param {readonly PostAnalysisTaskDescriptor[]} tasks - Shared ordered task registry.
 * @param {boolean} isStrict - Whether to replay root mount effects.
 * @param {ReturnType<typeof createAppQueryClient>} queryClient - Real shared query client.
 * @returns {object} Committed state, host API and owner-specific navigation/removal controls.
 */
export function renderFeedbackOwners(
  inputs: (PostAnalysisContext | null)[],
  tasks: readonly PostAnalysisTaskDescriptor[],
  isStrict: boolean,
  queryClient: ReturnType<typeof createAppQueryClient>
) {
  const observed = new Map<number, HookState>();
  let notification: ReturnType<typeof App.useApp>['notification'];
  let update: (
    index: number,
    context: PostAnalysisContext | null,
    selectedClassId?: string | null
  ) => void;
  let remove: (index: number) => void;
  let rerenderOwner: () => void;

  /** Captures the real host API without mocking App.useApp.
   * @returns {null} No additional host or UI.
   */
  function HostProbe() {
    const app = App.useApp();
    useLayoutEffect(() => {
      notification = app.notification;
    }, [app]);
    return null;
  }

  /** Observes committed hook state, never production-private owner state.
   * @param {object} properties - Stable owner slot and successful source context.
   * @param {number} properties.index - Stable mounted slot identity.
   * @param {PostAnalysisContext | null} properties.context - Successful source or no work.
   * @returns {React.JSX.Element} Usable analysis control for focus/non-blocking assertions.
   */
  function Owner(
    properties: Readonly<{
      index: number;
      context: PostAnalysisContext | null;
      selectedClassId: string | null;
    }>
  ) {
    const state = usePostAnalysisTasks(properties.context, tasks, properties.selectedClassId);
    useLayoutEffect(() => {
      observed.set(properties.index, state);
    }, [state, properties.index]);
    return <button type="button">Analysis {properties.index}</button>;
  }

  /** Keeps the shared App mounted when an individual owner navigates or unmounts.
   * @returns {React.JSX.Element} The ordinary shared host and owner slots.
   */
  function Harness() {
    const [entries, setEntries] = useState(() => {
      return inputs.map((context, index) => {
        return {
          index,
          context,
          selectedClassId: context?.classFull.classId ?? null,
        };
      });
    });
    const [revision, setRevision] = useState(0);
    /** Navigates one mounted owner without replacing the host.
     * @param {number} index - Stable owner slot.
     * @param {PostAnalysisContext | null} context - Next successful context or no work.
     * @param {string | null} [selectedClassId] - Explicit selection independent of readiness.
     * @returns {void} Schedules source replacement.
     */
    function updateContext(
      index: number,
      context: PostAnalysisContext | null,
      selectedClassId?: string | null
    ) {
      setEntries((current) => {
        const next = current.map((entry) => {
          return entry.index === index
            ? {
                ...entry,
                context,
                selectedClassId:
                  selectedClassId === undefined
                    ? (context?.classFull.classId ?? null)
                    : selectedClassId,
              }
            : entry;
        });
        return next;
      });
    }
    /** Removes one owner while leaving siblings and host feedback mounted.
     * @param {number} index - Stable owner slot.
     * @returns {void} Schedules owner removal.
     */
    function removeOwner(index: number) {
      setEntries((current) => current.filter((entry) => entry.index !== index));
    }
    useLayoutEffect(() => {
      update = updateContext;
      remove = removeOwner;
      rerenderOwner = () => setRevision((current) => current + 1);
    }, []);
    return (
      <App>
        <HostProbe />
        <span data-testid="host-revision">{revision}</span>
        {entries.map(function renderOwner(entry) {
          return <Owner key={entry.index} {...entry} />;
        })}
      </App>
    );
  }

  const view = renderWithFrontendProviders(<Harness />, {
    queryClient,
    renderOptions: { reactStrictMode: isStrict },
  });
  return {
    ...view,
    read: (index: number) => observed.get(index)!,
    notification: () => notification,
    update: (index: number, context: PostAnalysisContext | null, selectedClassId?: string | null) =>
      update(index, context, selectedClassId),
    remove: (index: number) => remove(index),
    rerenderOwner: () => rerenderOwner(),
  };
}
