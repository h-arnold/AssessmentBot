import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMetadataRefreshFixture } from '@/test/abClass/metadataRefreshFixtures';
import { REFRESH_AB_CLASS_METADATA_TASK_ID } from './postAnalysisTasks';
import { logPostAnalysisFailure } from './postAnalysisDiagnostics';

const TWO_TIMESTAMP_VARIANTS = 2;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logPostAnalysisFailure metadata target attribution', () => {
  it('attributes malformed and noncanonical source timestamps to the newest canonical candidate', () => {
    const context = createMetadataRefreshFixture('small');
    const [canonical, malformed, noncanonical] = context.classFull.assignments;
    malformed.updatedAt = 'zz-invalid';
    noncanonical.updatedAt = '2026-10-20T06:30:00Z';
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    logPostAnalysisFailure(
      REFRESH_AB_CLASS_METADATA_TASK_ID,
      context,
      new Error('metadata refresh failed')
    );

    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({ assignmentId: canonical.assignmentId }),
      })
    );
  });

  it('omits assignment attribution when no source timestamp is canonical', () => {
    const context = createMetadataRefreshFixture('small');
    context.classFull.assignments.forEach((assignment, index) => {
      assignment.updatedAt =
        index % TWO_TIMESTAMP_VARIANTS === 0 ? 'zz-invalid' : '2026-10-20T06:30:00Z';
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      return logPostAnalysisFailure(
        REFRESH_AB_CLASS_METADATA_TASK_ID,
        context,
        new Error('metadata refresh failed')
      );
    }).not.toThrow();
    expect(log).toHaveBeenCalledOnce();
    const entry = log.mock.calls[0][1] as { metadata: Record<string, unknown> };
    expect(entry.metadata).not.toHaveProperty('assignmentId');
  });
});
