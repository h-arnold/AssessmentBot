import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClassesManagementRow } from './classesManagementViewModel';
import type * as BulkSetCourseLengthFlowModule from './bulkSetCourseLengthFlow';

const callApiMock = vi.hoisted(() => vi.fn());
const INVALID_FRACTIONAL_COURSE_LENGTH = 1.5;
const MUTATED_COURSE_LENGTH = 3;
const SINGLE_ROW_COURSE_LENGTH = 4;
const TWO_CALLS = 2;

vi.mock('../../services/apiService', () => ({
  callApi: callApiMock,
}));

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
    expect(callApiMock).not.toHaveBeenCalled();
  });

  it('rejects non-integer course-length values before dispatching any mutations', async () => {
    const { bulkSetCourseLength } = await loadBulkSetCourseLengthFlow();

    await expect(
      bulkSetCourseLength(
        [makeRow()] as Parameters<typeof bulkSetCourseLength>[0],
        INVALID_FRACTIONAL_COURSE_LENGTH,
      ),
    ).rejects.toThrow('Course length must be an integer greater than or equal to 1.');
    expect(callApiMock).not.toHaveBeenCalled();
  });

  it('updates each selected class with a validated integer courseLength', async () => {
    const { bulkSetCourseLength } = await loadBulkSetCourseLengthFlow();
    callApiMock.mockResolvedValue({ ok: true });
    const rows: ClassesManagementRow[] = [
      makeRow({ classId: 'class-001', status: 'active' }),
      makeRow({ classId: 'class-002', status: 'inactive', active: false }),
    ];

    const results = await bulkSetCourseLength(rows, MUTATED_COURSE_LENGTH);

    expect(callApiMock).toHaveBeenCalledTimes(TWO_CALLS);
    expect(callApiMock).toHaveBeenNthCalledWith(1, 'updateABClass', {
      classId: 'class-001',
      courseLength: MUTATED_COURSE_LENGTH,
    });
    expect(callApiMock).toHaveBeenNthCalledWith(TWO_CALLS, 'updateABClass', {
      classId: 'class-002',
      courseLength: MUTATED_COURSE_LENGTH,
    });
    expect(results.map((result) => result.row.classId)).toEqual(['class-001', 'class-002']);
  });

  it('uses the same batch path for a single selected row edit', async () => {
    const { bulkSetCourseLength } = await loadBulkSetCourseLengthFlow();
    callApiMock.mockResolvedValue({ ok: true });
    const row = makeRow({ classId: 'class-single', status: 'inactive', active: false });

    const results = await bulkSetCourseLength([row], SINGLE_ROW_COURSE_LENGTH);

    expect(callApiMock).toHaveBeenCalledTimes(1);
    expect(callApiMock).toHaveBeenCalledWith('updateABClass', {
      classId: 'class-single',
      courseLength: SINGLE_ROW_COURSE_LENGTH,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ status: 'fulfilled', row });
  });
});
