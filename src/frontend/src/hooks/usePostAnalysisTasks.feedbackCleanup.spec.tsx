import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from '@/query/queryClient';
import { getQueueState, runApiQueuedTask } from '@/services/api/apiQueue';
import { createMetadataRefreshFixture } from '@/test/abClass/metadataRefreshFixtures';
import {
  completeNotificationLeave,
  metadataDescriptor,
  SAVE_TITLE,
  renderFeedbackOwners,
} from '@/test/abClass/postAnalysisFeedbackTestSupport';

const OWNER_COUNT = 2;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('usePostAnalysisTasks notification ownership', () => {
  it('retains a shown warning while analysis readiness is temporarily null for the selected class', async () => {
    const context = createMetadataRefreshFixture('small');
    const owner = renderFeedbackOwners(
      [context],
      [metadataDescriptor(() => Promise.reject(new Error('save failed')))],
      true,
      createAppQueryClient()
    );
    const warning = vi.spyOn(owner.notification(), 'warning');
    expect(await screen.findByRole('status')).toHaveTextContent(SAVE_TITLE);
    await act(async () => owner.update(0, null, context.classFull.classId));
    expect(screen.getByRole('status')).toHaveTextContent(SAVE_TITLE);
    await act(async () => owner.update(0, context));
    expect(screen.getByRole('status')).toHaveTextContent(SAVE_TITLE);
    expect(warning).toHaveBeenCalledTimes(1);
  });

  it('keeps an undismissed persistent warning alive across unrelated and equal-source effect rerenders', async () => {
    const context = createMetadataRefreshFixture('small');
    const run = vi.fn(() => Promise.reject(new Error('save failed')));
    const owner = renderFeedbackOwners(
      [context],
      [metadataDescriptor(run)],
      true,
      createAppQueryClient()
    );
    const warning = vi.spyOn(owner.notification(), 'warning');
    const destroy = vi.spyOn(owner.notification(), 'destroy');
    expect(await screen.findByRole('status')).toHaveTextContent(SAVE_TITLE);
    const key = warning.mock.calls[0][0].key;
    await act(async () => owner.rerenderOwner());
    await act(async () => owner.update(0, structuredClone(context)));
    const metadataOnly = structuredClone(context);
    metadataOnly.classFull.metadata = null;
    await act(async () => owner.update(0, metadataOnly));
    await waitFor(() => expect(owner.read(0).outcomes[0].data.status).toBe('failed'));
    expect(screen.getByRole('status')).toHaveTextContent(SAVE_TITLE);
    expect(destroy).not.toHaveBeenCalledWith(key);
    expect(warning).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it.each(['navigation', 'null', 'unmount'] as const)(
    'destroys only owned notices on %s while preserving unrelated host feedback',
    async (transition) => {
      const context = createMetadataRefreshFixture('small');
      const owner = renderFeedbackOwners(
        [context],
        [
          metadataDescriptor((input) => {
            if (input.classFull.classId !== context.classFull.classId) {
              return { status: 'skipped', reason: 'unchanged' };
            }
            throw new Error('save failed');
          }),
        ],
        false,
        createAppQueryClient()
      );
      const warning = vi.spyOn(owner.notification(), 'warning');
      const destroy = vi.spyOn(owner.notification(), 'destroy');
      await act(async () => {
        owner.notification().info({
          key: 'unrelated-notice',
          title: 'Unrelated work',
          description: 'Keep this notice',
          duration: 0,
        });
      });
      await screen.findByText(SAVE_TITLE);
      const notice = screen.getByRole('status');
      const ownedKey = warning.mock.calls[0][0].key;
      await act(async () => {
        if (transition === 'unmount') owner.remove(0);
        else owner.update(0, transition === 'null' ? null : createMetadataRefreshFixture('medium'));
      });
      await completeNotificationLeave(notice);
      await waitFor(() => expect(screen.queryByText(SAVE_TITLE)).not.toBeInTheDocument());
      expect(screen.getByText('Unrelated work')).toBeInTheDocument();
      expect(destroy).toHaveBeenCalledWith(ownedKey);
      expect(
        destroy.mock.calls.every(([key]) => key !== undefined && key !== 'unrelated-notice')
      ).toBe(true);
    }
  );

  it('keeps a second same-source owner warning when the first owner leaves the shared host', async () => {
    const context = createMetadataRefreshFixture('small');
    const owner = renderFeedbackOwners(
      [context, structuredClone(context)],
      [metadataDescriptor(() => Promise.reject(new Error('save failed')))],
      true,
      createAppQueryClient()
    );
    const warning = vi.spyOn(owner.notification(), 'warning');
    const destroy = vi.spyOn(owner.notification(), 'destroy');
    await waitFor(() => expect(screen.getAllByText(SAVE_TITLE)).toHaveLength(OWNER_COUNT));
    const [departingNotice, survivingNotice] = screen.getAllByRole('status');
    const keys = warning.mock.calls.map(([config]) => config.key);
    expect(new Set(keys).size).toBe(OWNER_COUNT);
    await act(async () => owner.remove(0));
    await completeNotificationLeave(departingNotice);
    await waitFor(() => expect(screen.getAllByText(SAVE_TITLE)).toHaveLength(1));
    expect(screen.getByRole('status')).toBe(survivingNotice);
    expect(survivingNotice).not.toHaveClass('ant-notification-fade-leave');
    await act(async () => owner.rerenderOwner());
    expect(screen.getByRole('status')).toBe(survivingNotice);
    expect(warning).toHaveBeenCalledTimes(OWNER_COUNT);
    expect(owner.read(1).outcomes[0].data.status).toBe('failed');
    expect(destroy.mock.calls).toHaveLength(1);
    expect(keys).toContain(destroy.mock.calls[0][0]);
    expect(destroy.mock.calls[0][0]).not.toBeUndefined();
  });

  it.each(['navigation', 'null', 'unmount'] as const)(
    'lets active write work finish after %s without late state or notification publication',
    async (transition) => {
      const context = createMetadataRefreshFixture('small');
      const gate = Promise.withResolvers<never>();
      const completed = vi.fn();
      const tasks = [
        metadataDescriptor((input) => {
          if (input.classFull.classId !== context.classFull.classId) {
            return { status: 'skipped', reason: 'unchanged' };
          }
          return runApiQueuedTask('classesBulkMutation', () => gate.promise.finally(completed));
        }),
      ];
      const owner = renderFeedbackOwners([context], tasks, true, createAppQueryClient());
      const warning = vi.spyOn(owner.notification(), 'warning');
      expect(owner.read(0).outcomes[0].data.status).toBe('pending');
      expect(getQueueState('classesBulkMutation')).toEqual({ pending: 0, active: true });
      await act(async () => {
        if (transition === 'unmount') owner.remove(0);
        else owner.update(0, transition === 'null' ? null : createMetadataRefreshFixture('medium'));
      });
      const snapshot = owner.read(0);
      expect(getQueueState('classesBulkMutation').active).toBe(true);
      await act(async () => gate.reject(new Error('late active write failure')));
      expect(completed).toHaveBeenCalledTimes(1);
      expect(getQueueState('classesBulkMutation')).toEqual({ pending: 0, active: false });
      expect(owner.read(0)).toBe(snapshot);
      expect(warning).not.toHaveBeenCalled();
      expect(screen.queryByText(SAVE_TITLE)).not.toBeInTheDocument();
    }
  );
});
