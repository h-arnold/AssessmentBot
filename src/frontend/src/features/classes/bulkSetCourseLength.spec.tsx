import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClassTableRow } from './bulkCreateFlow';

const callApiMock = vi.hoisted(() => vi.fn());
const INVALID_FRACTIONAL_COURSE_LENGTH = 1.5;
const MUTATED_COURSE_LENGTH = 3;
const SINGLE_ROW_COURSE_LENGTH = 4;
const TWO_CALLS = 2;

vi.mock('../../services/apiService', () => ({
  callApi: callApiMock,
}));

type BulkSetCourseLengthFlowModule = Readonly<{
  filterEligibleForBulkSetCourseLength: (rows: ClassTableRow[]) => ClassTableRow[];
  bulkSetCourseLength: (
    rows: ClassTableRow[],
    courseLength: number,
  ) => Promise<Array<{ status: string; row: ClassTableRow }>>;
}>;

/**
 * Loads the future bulk course-length flow module lazily so this RED spec can
 * compile before the implementation exists.
 *
 * @returns {Promise<BulkSetCourseLengthFlowModule>} The bulk course-length flow module.
 */
function loadBulkSetCourseLengthFlow(): Promise<BulkSetCourseLengthFlowModule> {
  return import('./bulkSetCourseLengthFlow') as Promise<BulkSetCourseLengthFlowModule>;
}

/**
 * Builds a representative existing class row for flow tests.
 *
 * @param {Partial<ClassTableRow>} overrides Optional field overrides.
 * @returns {ClassTableRow} The composed class row.
 */
function makeRow(overrides: Partial<ClassTableRow> = {}): ClassTableRow {
  return {
    rowKey: 'row-001',
    status: 'linked',
    classId: 'class-001',
    cohortKey: 'cohort-current',
    yearGroupKey: 'year-10',
    courseLength: 2,
    active: true,
    className: 'Year 10 Maths',
    ...overrides,
  };
}

describe('bulkSetCourseLengthFlow', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns only active and inactive existing rows for bulk course-length editing', async () => {
    const { filterEligibleForBulkSetCourseLength } = await loadBulkSetCourseLengthFlow();
    const rows: ClassTableRow[] = [
      makeRow({ rowKey: 'linked-active', classId: 'class-active', active: true }),
      makeRow({ rowKey: 'linked-inactive', classId: 'class-inactive', active: false }),
      makeRow({ rowKey: 'not-created', classId: 'class-missing', status: 'notCreated', active: null }),
      makeRow({ rowKey: 'orphaned', classId: 'class-orphaned', status: 'partial', active: false }),
    ];

    expect(filterEligibleForBulkSetCourseLength(rows).map((row) => row.classId)).toEqual([
      'class-active',
      'class-inactive',
    ]);
  });

  it('rejects course-length values below 1 before dispatching any mutations', async () => {
    const { bulkSetCourseLength } = await loadBulkSetCourseLengthFlow();

    await expect(bulkSetCourseLength([makeRow()], 0)).rejects.toThrow(
      'Course length must be an integer greater than or equal to 1.',
    );
    expect(callApiMock).not.toHaveBeenCalled();
  });

  it('rejects non-integer course-length values before dispatching any mutations', async () => {
    const { bulkSetCourseLength } = await loadBulkSetCourseLengthFlow();

    await expect(
      bulkSetCourseLength([makeRow()], INVALID_FRACTIONAL_COURSE_LENGTH),
    ).rejects.toThrow('Course length must be an integer greater than or equal to 1.');
    expect(callApiMock).not.toHaveBeenCalled();
  });

  it('updates each selected class with a validated integer courseLength', async () => {
    const { bulkSetCourseLength } = await loadBulkSetCourseLengthFlow();
    callApiMock.mockResolvedValue({ ok: true });
    const rows: ClassTableRow[] = [
      makeRow({ rowKey: 'r1', classId: 'class-001' }),
      makeRow({ rowKey: 'r2', classId: 'class-002', active: false }),
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
    const row = makeRow({ classId: 'class-single' });

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
