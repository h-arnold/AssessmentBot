import { renderHook } from '@testing-library/react';
import { App } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePagePostAnalysisTasks } from './usePagePostAnalysisTasks';
import * as hookModule from './usePostAnalysisTasks';
import { createMetadataRefreshFixture } from '@/test/abClass/metadataRefreshFixtures';

vi.mock('./usePostAnalysisTasks', () => ({ usePostAnalysisTasks: vi.fn() }));

const fixture = createMetadataRefreshFixture('small');
const OWNED_CLASS_ID = fixture.classFull.classId;

afterEach(() => vi.resetAllMocks());

describe('usePagePostAnalysisTasks shared page eligibility', () => {
  it('passes complete ready inputs and preserves selected-class ownership during blocking readiness', () => {
    const call = vi.mocked(hookModule.usePostAnalysisTasks);
    const client = new QueryClient();
    const { rerender } = renderHook(
      ({
        status,
        selectedClassId,
      }: {
        status: 'loading' | 'blocking' | 'ready';
        selectedClassId: string | null;
      }) => {
        return usePagePostAnalysisTasks(
          status,
          fixture.classFull,
          fixture.assignmentDefinitionPartials,
          fixture.averagingResult,
          selectedClassId
        );
      },
      {
        initialProps: { status: 'ready', selectedClassId: OWNED_CLASS_ID },
        wrapper: ({ children }) => {
          return (
            <QueryClientProvider client={client}>
              <App>{children}</App>
            </QueryClientProvider>
          );
        },
      }
    );
    expect(call.mock.lastCall?.[0]).toEqual({
      classFull: fixture.classFull,
      assignmentDefinitionPartials: fixture.assignmentDefinitionPartials,
      averagingResult: fixture.averagingResult,
    });
    const tasks = call.mock.lastCall![1];
    expect(call.mock.lastCall?.[2]).toBe(OWNED_CLASS_ID);
    rerender({ status: 'blocking', selectedClassId: OWNED_CLASS_ID });
    expect(call.mock.lastCall?.[0]).toBeNull();
    expect(call.mock.lastCall?.[2]).toBe(OWNED_CLASS_ID);
    rerender({ status: 'ready', selectedClassId: 'another-class' });
    expect(call.mock.lastCall?.[1]).toBe(tasks);
    expect(call.mock.lastCall?.[2]).toBe('another-class');
  });

  it.each([
    { name: 'loading status', status: 'loading' as const, missing: 'none' },
    { name: 'absent class', status: 'ready' as const, missing: 'class' },
    { name: 'absent definitions', status: 'ready' as const, missing: 'definitions' },
    { name: 'absent result', status: 'ready' as const, missing: 'result' },
  ])('passes null for $name', ({ status, missing }) => {
    const call = vi.mocked(hookModule.usePostAnalysisTasks);
    const client = new QueryClient();
    renderHook(
      () => {
        return usePagePostAnalysisTasks(
          status,
          missing === 'class' ? null : fixture.classFull,
          missing === 'definitions' ? null : fixture.assignmentDefinitionPartials,
          missing === 'result' ? null : fixture.averagingResult,
          OWNED_CLASS_ID
        );
      },
      {
        wrapper: ({ children }) => {
          return (
            <QueryClientProvider client={client}>
              <App>{children}</App>
            </QueryClientProvider>
          );
        },
      }
    );
    expect(call.mock.lastCall?.[0]).toBeNull();
  });
});
