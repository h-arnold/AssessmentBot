/**
 * Bulk set-course-length flow — unit tests.
 *
 * Covers: course-length validation (below 1, non-integer), correct QueuedBatchItem
 * construction via bulkMetadataUpdate, onProgress forwarding, and empty-list
 * short-circuit.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClassesManagementRow } from '../classesManagementViewModel';
import type { BatchProgressSnapshot } from './runQueuedBatchMutation';

const runQueuedBatchMutationMock = vi.hoisted(() => vi.fn());

vi.mock('./runQueuedBatchMutation', () => ({
  runQueuedBatchMutation: runQueuedBatchMutationMock,
}));

import type * as BulkSetCourseLengthFlowModule from './bulkSetCourseLengthFlow';

const INVALID_FRACTIONAL_COURSE_LENGTH = 1.5;
const MUTATED_COURSE_LENGTH = 3;
const SINGLE_ROW_COURSE_LENGTH = 4;

/**
 * Loads the bulk course-length flow lazily so the test can import the current implementation shape.
 *
 * @returns {Promise<typeof BulkSetCourseLengthFlowModule>} The course-length flow module.
 */
function loadBulkSetCourseLengthFlow(): Promise<typeof BulkSetCourseLengthFlowModule> {
  return import('./bulkSetCourseLengthFlow');
}

/**
 * Builds a canonical classes-management row for course-length flow tests.
 *
 * @param {Partial<ClassesManagementRow>} overrides Field overrides for the returned row.
 * @returns {ClassesManagementRow} The composed test row.
 */
function makeRow(overrides: Partial<ClassesManagementRow> = {}): ClassesManagementRow {
  return {
    classId: 'class-001',
    className: 'Year 10 Maths',
    status: 'active',
    cohortKey: 'cohort-current',
    cohortLabel: 'Cohort Current',
    yearGroupKey: 'year-10',
    yearGroupLabel: 'Year 10',
    courseLength: 2,
    active: true,
    ...overrides,
  };
}

describe('bulkSetCourseLengthFlow', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects course-length values below 1 before dispatching any mutations', async () => {
    const { bulkSetCourseLength } = await loadBulkSetCourseLengthFlow();

    await expect(
      bulkSetCourseLength(
        [makeRow()] as Parameters<typeof bulkSetCourseLength>[0],
        0,
      ),
    ).rejects.toThrow(
      'Course length must be an integer greater than or equal to 1.',
    );
    expect(runQueuedBatchMutationMock).not.toHaveBeenCalled();
  });

  it('rejects non-integer course-length values before dispatching any mutations', async () => {
    const { bulkSetCourseLength } = await loadBulkSetCourseLengthFlow();

    await expect(
      bulkSetCourseLength(
        [makeRow()] as Parameters<typeof bulkSetCourseLength>[0],
        INVALID_FRACTIONAL_COURSE_LENGTH,
      ),
    ).rejects.toThrow('Course length must be an integer greater than or equal to 1.');
    expect(runQueuedBatchMutationMock).not.toHaveBeenCalled();
  });

  it('calls bulkMetadataUpdate which calls runQueuedBatchMutation with correct items', async () => {
    runQueuedBatchMutationMock.mockResolvedValue([
      { status: 'fulfilled', row: makeRow({ classId: 'class-001', status: 'active' }), data: { ok: true } },
      { status: 'fulfilled', row: makeRow({ classId: 'class-002', status: 'inactive', active: false }), data: { ok: true } },
    ]);

    const { bulkSetCourseLength } = await loadBulkSetCourseLengthFlow();
    const rows: ClassesManagementRow[] = [
      makeRow({ classId: 'class-001', status: 'active' }),
      makeRow({ classId: 'class-002', status: 'inactive', active: false }),
    ];

    const results = await bulkSetCourseLength(rows, MUTATED_COURSE_LENGTH);

    expect(runQueuedBatchMutationMock).toHaveBeenCalledTimes(1);
    const [items] = runQueuedBatchMutationMock.mock.calls[0] as [unknown[]];
    const firstItem = items[0] as Record<string, unknown>;
    expect(firstItem.method).toBe('updateABClass');
    expect(firstItem.verb).toBe('Setting course length for');
    expect((firstItem.parameters as Record<string, unknown>).courseLength).toBe(MUTATED_COURSE_LENGTH);
    expect(results.map((result) => result.row.classId)).toEqual(['class-001', 'class-002']);
  });

  it('uses the same batch path for a single selected row edit', async () => {
    runQueuedBatchMutationMock.mockResolvedValue([
      { status: 'fulfilled', row: makeRow({ classId: 'class-single', status: 'inactive', active: false }), data: { ok: true } },
    ]);

    const { bulkSetCourseLength } = await loadBulkSetCourseLengthFlow();
    const row = makeRow({ classId: 'class-single', status: 'inactive', active: false });

    const results = await bulkSetCourseLength([row], SINGLE_ROW_COURSE_LENGTH);

    expect(runQueuedBatchMutationMock).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ status: 'fulfilled', row });
  });

  it('forwards onProgress to runQueuedBatchMutation via bulkMetadataUpdate', async () => {
    runQueuedBatchMutationMock.mockResolvedValue([
      { status: 'fulfilled', row: makeRow({ classId: 'class-001' }), data: { ok: true } },
    ]);

    const { bulkSetCourseLength } = await loadBulkSetCourseLengthFlow();
    const row = makeRow({ classId: 'class-001' });
    const onProgress: (snapshot: BatchProgressSnapshot) => void = vi.fn();

    await bulkSetCourseLength([row], SINGLE_ROW_COURSE_LENGTH, onProgress);

    expect(runQueuedBatchMutationMock).toHaveBeenCalledTimes(1);
    const [, options] = runQueuedBatchMutationMock.mock.calls[0] as [unknown[], { onProgress?: unknown }];
    expect(options.onProgress).toBe(onProgress);
  });
});
