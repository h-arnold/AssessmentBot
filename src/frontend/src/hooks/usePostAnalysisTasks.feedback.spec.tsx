import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { notification as staticNotification } from 'antd';
import { QueryClientProvider } from '@tanstack/react-query';
import { usePostAnalysisTasks } from './usePostAnalysisTasks';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from '@/query/queryClient';
import { ApiTransportError } from '@/errors/apiTransportError';
import {
  createMetadataRefreshFixture,
  newestAssignment,
  NEW_SOURCE_TIME,
} from '@/test/abClass/metadataRefreshFixtures';
import {
  completeNotificationLeave,
  metadataDescriptor,
  METADATA_TASK_ID,
  SAVE_TITLE,
  SAVE_DESCRIPTION,
  renderFeedbackOwners,
} from '@/test/abClass/postAnalysisFeedbackTestSupport';

const SOURCE_VERSION_COUNT = 2;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('usePostAnalysisTasks context-aware failure feedback', () => {
  it('uses the existing App warning API with persistent polite copy and preserves analysis focus', async () => {
    const context = createMetadataRefreshFixture('small');
    const gate = Promise.withResolvers<never>();
    const staticWarning = vi.spyOn(staticNotification, 'warning');
    const owner = renderFeedbackOwners(
      [context],
      [metadataDescriptor(() => gate.promise)],
      true,
      createAppQueryClient()
    );
    const warning = vi.spyOn(owner.notification(), 'warning');
    const focus = screen.getByRole('button', { name: 'Analysis 0' });
    await act(async () => focus.focus());
    expect(focus).toHaveFocus();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    await act(async () => gate.reject(new Error('private technical error')));
    await waitFor(() => expect(warning).toHaveBeenCalledTimes(1));
    expect(warning.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        title: SAVE_TITLE,
        description: SAVE_DESCRIPTION,
        duration: 0,
        closable: true,
        role: 'status',
        key: expect.any(String),
      })
    );
    expect(warning.mock.calls[0][0]).not.toHaveProperty('actions');
    expect(warning.mock.calls[0][0]).not.toHaveProperty('btn');
    expect(staticWarning).not.toHaveBeenCalled();
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(SAVE_TITLE);
    expect(status).toHaveTextContent(SAVE_DESCRIPTION);
    expect(within(status).getByRole('button', { name: /close/i })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /retry|reload/i })).not.toBeInTheDocument();
    expect(screen.queryByText('private technical error')).not.toBeInTheDocument();
    expect(focus).toHaveFocus();
    expect(focus).toBeEnabled();
    expect(owner.read(0).outcomes[0].error?.message).toBe('private technical error');
  });

  it('does not reopen dismissed feedback on ordinary/equal/cache-only rerenders but notifies for a new version', async () => {
    const user = userEvent.setup();
    const context = createMetadataRefreshFixture('small');
    const run = vi.fn(() => Promise.reject(new Error('save failed')));
    const owner = renderFeedbackOwners(
      [context],
      [metadataDescriptor(run)],
      true,
      createAppQueryClient()
    );
    const warning = vi.spyOn(owner.notification(), 'warning');
    const notice = await screen.findByRole('status');
    const initialKey = warning.mock.calls[0][0].key;
    expect(initialKey).toEqual(expect.any(String));
    await user.click(within(notice).getByRole('button', { name: /close/i }));
    await completeNotificationLeave(notice);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    await act(async () => owner.rerenderOwner());
    await act(async () => owner.update(0, structuredClone(context)));
    const cacheOnly = structuredClone(context);
    cacheOnly.classFull.metadata = null;
    await act(async () => owner.update(0, cacheOnly));
    await waitFor(() => expect(owner.read(0).outcomes[0].data.status).toBe('failed'));
    expect(warning).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    const next = structuredClone(context);
    newestAssignment(next.classFull).updatedAt = NEW_SOURCE_TIME;
    await act(async () => owner.update(0, next));
    await waitFor(() => expect(warning).toHaveBeenCalledTimes(SOURCE_VERSION_COUNT));
    expect(warning.mock.calls[1][0].key).not.toBe(initialKey);
    expect(await screen.findByRole('status')).toHaveTextContent(SAVE_TITLE);
    expect(run).toHaveBeenCalledTimes(SOURCE_VERSION_COUNT);
  });

  it('logs one bounded task diagnostic with IDs and request correlation, never full context payloads', async () => {
    const context = createMetadataRefreshFixture('small');
    const error = new ApiTransportError({
      requestId: 'metadata-write-request',
      error: { code: 'INTERNAL_ERROR', message: 'technical save failure', isRetriable: false },
    });
    const logs = vi.spyOn(console, 'error').mockImplementation(() => {});
    const owner = renderFeedbackOwners(
      [context],
      [metadataDescriptor(() => Promise.reject(error))],
      true,
      createAppQueryClient()
    );
    await waitFor(() => expect(owner.read(0).outcomes[0].data.status).toBe('failed'));
    await act(async () => owner.update(0, structuredClone(context)));
    expect(logs).toHaveBeenCalledTimes(1);
    const assignmentId = newestAssignment(context.classFull).assignmentId;
    expect(logs.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        errorMessage: error.message,
        metadata: expect.objectContaining({
          taskId: METADATA_TASK_ID,
          classId: context.classFull.classId,
          assignmentId,
          requestId: error.requestId,
          errorCode: error.code,
        }),
      })
    );
    const entry = logs.mock.calls[0][1] as { metadata: Record<string, unknown> };
    for (const value of Object.values(entry.metadata)) {
      // Task diagnostics are scalar identifiers, not nested class/student/metadata snapshots.
      expect(typeof value).not.toBe('object');
    }
    expect(owner.read(0).outcomes[0].error).toBe(error);
    expect(owner.read(0).outcomes[0].data).not.toHaveProperty('error');
  });

  it('logs the missing notification-host failure at the completion boundary', async () => {
    const context = createMetadataRefreshFixture('small');
    const logs = vi.spyOn(console, 'error').mockImplementation(() => {});
    const queryClient = createAppQueryClient();
    const tasks = [metadataDescriptor(() => Promise.reject(new Error('save failed')))];
    /** Exercises the hook without the required Ant Design notification host.
     * @returns {null} No UI beyond the hook under test.
     */
    function Owner() {
      usePostAnalysisTasks(context, tasks, context.classFull.classId);
      return null;
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Owner />
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(
        logs.mock.calls.some(
          ([, entry]) => (entry as { context?: string }).context === 'usePostAnalysisTasks.complete'
        )
      ).toBe(true);
    });
    const completionDiagnostic = logs.mock.calls
      .map(([, entry]) => entry as { context?: string; errorMessage?: string; metadata?: unknown })
      .find((entry) => entry.context === 'usePostAnalysisTasks.complete');
    expect(completionDiagnostic).toEqual(
      expect.objectContaining({
        context: 'usePostAnalysisTasks.complete',
        errorMessage: expect.stringContaining('warning'),
        metadata: { classId: context.classFull.classId },
      })
    );
  });

  it.each(['noAssignments', 'unchanged', 'staleSource', 'succeeded'] as const)(
    'does not publish success or unchanged feedback for %s',
    async (result) => {
      const owner = renderFeedbackOwners(
        [createMetadataRefreshFixture('small')],
        [
          metadataDescriptor(() => {
            return result === 'succeeded'
              ? { status: 'succeeded', confirmedPersistence: true }
              : { status: 'skipped', reason: result };
          }),
        ],
        false,
        createAppQueryClient()
      );
      const warning = vi.spyOn(owner.notification(), 'warning');
      const success = vi.spyOn(owner.notification(), 'success');
      await waitFor(() => expect(owner.read(0).outcomes[0].data.status).not.toBe('pending'));
      expect(warning).not.toHaveBeenCalled();
      expect(success).not.toHaveBeenCalled();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    }
  );
});
