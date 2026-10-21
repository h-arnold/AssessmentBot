import { afterEach, describe, expect, it, vi } from 'vitest';
import * as metadataTask from './refreshABClassMetadata';
import { PostAnalysisTaskRegistry } from './postAnalysisTasks';
import { ClassPartialSchema } from '@/services/googleClassrooms/classPartials.zod';
import type { PostAnalysisTaskDescriptor } from './runPostAnalysisTasks';
import {
  createMetadataRefreshFixture,
  NEW_SOURCE_TIME,
  SUMMARY_TIME,
  newestAssignment,
} from '@/test/abClass/metadataRefreshFixtures';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('PostAnalysisTaskRegistry metadata-only production list', () => {
  it('registers only metadata and forwards context plus the effect-owned clock without invoking it eagerly', async () => {
    const context = createMetadataRefreshFixture('small');
    const now = vi.fn(() => SUMMARY_TIME);
    const refresh = vi
      .spyOn(metadataTask, 'refreshABClassMetadata')
      .mockImplementation(() => Promise.resolve({ status: 'skipped', reason: 'unchanged' }));
    const registry = new PostAnalysisTaskRegistry(now);
    expect(registry.tasks.map((task: PostAnalysisTaskDescriptor) => task.id)).toEqual([
      'refreshABClassMetadata',
    ]);
    expect(now).not.toHaveBeenCalled();
    await expect(registry.tasks[0].run(context)).resolves.toEqual({
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
    const registry = new PostAnalysisTaskRegistry(() => SUMMARY_TIME);
    await expect(registry.tasks[0].run(context)).resolves.toEqual({
      status: 'succeeded',
      confirmedPersistence: true,
    });
  });

  it('keys attempts by class and assignment source version, not metadata or live weights', () => {
    const context = createMetadataRefreshFixture('small');
    const descriptor = new PostAnalysisTaskRegistry(() => SUMMARY_TIME).tasks[0];
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
});
