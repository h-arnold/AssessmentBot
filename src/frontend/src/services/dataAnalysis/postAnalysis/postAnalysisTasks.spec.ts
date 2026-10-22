import { afterEach, describe, expect, it, vi } from 'vitest';
import * as metadataTask from './refreshABClassMetadata';
import {
  createPostAnalysisTaskDescriptors,
  REFRESH_AB_CLASS_METADATA_TASK_ID,
} from './postAnalysisTasks';
import { compareAssignmentNewestFirst } from './metadataProjection';
import { ClassPartialSchema } from '@/services/googleClassrooms/classPartials.zod';
import type { PostAnalysisTaskDescriptor } from './runPostAnalysisTasks';
import {
  createMetadataRefreshFixture,
  NEW_SOURCE_TIME,
  SUMMARY_TIME,
  newestAssignment,
} from '@/test/abClass/metadataRefreshFixtures';

const LATER_SOURCE_TIME = '2026-10-21T00:00:00.000Z';
const FIRST_ASSIGNMENT_INDEX = 0;

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('production post-analysis task descriptors', () => {
  it('shares the canonical task ID and orders equal timestamps by ascending assignment ID', () => {
    expect(createPostAnalysisTaskDescriptors(() => SUMMARY_TIME)[0].id).toBe(
      REFRESH_AB_CLASS_METADATA_TASK_ID
    );
    const first = { assignmentId: 'a', updatedAt: SUMMARY_TIME };
    const second = { assignmentId: 'b', updatedAt: SUMMARY_TIME };
    expect(compareAssignmentNewestFirst(first, second)).toBeLessThan(0);
    expect(compareAssignmentNewestFirst(second, first)).toBeGreaterThan(0);
    expect(
      compareAssignmentNewestFirst(
        { assignmentId: 'z', updatedAt: LATER_SOURCE_TIME },
        { assignmentId: 'a', updatedAt: SUMMARY_TIME }
      )
    ).toBeLessThan(0);
  });
  it('registers only metadata and forwards context plus the effect-owned clock without invoking it eagerly', async () => {
    const context = createMetadataRefreshFixture('small');
    const now = vi.fn(() => SUMMARY_TIME);
    const refresh = vi
      .spyOn(metadataTask, 'refreshABClassMetadata')
      .mockImplementation(() => Promise.resolve({ status: 'skipped', reason: 'unchanged' }));
    const tasks = createPostAnalysisTaskDescriptors(now);
    expect(tasks.map((task: PostAnalysisTaskDescriptor) => task.id)).toEqual([
      'refreshABClassMetadata',
    ]);
    expect(now).not.toHaveBeenCalled();
    await expect(tasks[0].run(context)).resolves.toEqual({
      status: 'skipped',
      reason: 'unchanged',
    });
    expect(refresh).toHaveBeenCalledWith(context, now);
    expect(now).not.toHaveBeenCalled();
  });

  it('maps confirmed saves to success while preserving confirmation for the later refresh lifecycle', async () => {
    const context = createMetadataRefreshFixture('small');
    const classPartial = ClassPartialSchema.parse(context.classFull);
    vi.spyOn(metadataTask, 'refreshABClassMetadata').mockImplementation(() => {
      return Promise.resolve({
        status: 'saved',
        confirmedPersistence: true,
        classPartial,
      });
    });
    const tasks = createPostAnalysisTaskDescriptors(() => SUMMARY_TIME);
    await expect(tasks[0].run(context)).resolves.toEqual({
      status: 'succeeded',
      confirmedPersistence: true,
    });
  });

  it('keys attempts by class and assignment source version, not metadata or live weights', () => {
    const context = createMetadataRefreshFixture('small');
    const descriptor = createPostAnalysisTaskDescriptors(() => SUMMARY_TIME)[0];
    expect(descriptor.getAttemptKey).toBeTypeOf('function');
    const key = descriptor.getAttemptKey!(context);
    const cacheRefresh = structuredClone(context);
    cacheRefresh.classFull.metadata = null;
    cacheRefresh.assignmentDefinitionPartials[0].assignmentWeighting = 0;
    expect(descriptor.getAttemptKey!(cacheRefresh)).toBe(key);
    newestAssignment(cacheRefresh.classFull).updatedAt = NEW_SOURCE_TIME;
    expect(descriptor.getAttemptKey!(cacheRefresh)).not.toBe(key);
    const otherClass = structuredClone(context);
    otherClass.classFull.classId = 'other-class';
    otherClass.averagingResult.classId = 'other-class';
    expect(descriptor.getAttemptKey!(otherClass)).not.toBe(key);
  });

  it.each([FIRST_ASSIGNMENT_INDEX, FIRST_ASSIGNMENT_INDEX + 1])(
    'keeps raw attempt identity total when assignment %i has a null timestamp',
    (nullIndex) => {
      const context = createMetadataRefreshFixture('small');
      context.classFull.assignments[nullIndex].updatedAt = null;
      const descriptor = createPostAnalysisTaskDescriptors(() => SUMMARY_TIME)[0];
      const key = descriptor.getAttemptKey!(context);
      expect(key).toContain('null');
      expect(descriptor.getAttemptKey!(structuredClone(context))).toBe(key);
    }
  );
});
