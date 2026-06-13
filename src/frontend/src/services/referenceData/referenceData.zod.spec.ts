import { describe, expect, it } from 'vitest';
import {
  AssignmentTopicSchema,
  AssignmentTopicListResponseSchema,
  CohortSchema,
  CreateAssignmentTopicInputSchema,
  CreateAssignmentTopicResponseSchema,
  CreateCohortInputSchema,
  CreateYearGroupInputSchema,
  DeleteAssignmentTopicInputSchema,
  DeleteAssignmentTopicResponseSchema,
  DeleteCohortInputSchema,
  DeleteCohortResponseSchema,
  DeleteYearGroupInputSchema,
  DeleteYearGroupResponseSchema,
  UpdateAssignmentTopicInputSchema,
  UpdateAssignmentTopicResponseSchema,
  UpdateCohortInputSchema,
  UpdateYearGroupInputSchema,
  YearGroupSchema,
} from './referenceData.zod';

const omittedBackendSuccessPayload = new Map<string, never>().get('missing');
const INVALID_MONTH_BELOW_RANGE = 0;
const INVALID_MONTH_ABOVE_RANGE = 13;

describe('referenceData.zod keyed schemas', () => {
  it('CohortSchema accepts keyed cohort payloads with academic-year metadata', () => {
    expect(
      CohortSchema.parse({
        key: 'cohort-2025',
        name: '2025 Cohort',
        active: true,
        startYear: 2025,
        startMonth: 9,
      })
    ).toEqual({
      key: 'cohort-2025',
      name: '2025 Cohort',
      active: true,
      startYear: 2025,
      startMonth: 9,
    });
  });

  it.each(['', '   '])('CohortSchema rejects empty or whitespace-only keyed names: %j', (name) => {
    expect(() =>
      CohortSchema.parse({
        key: 'cohort-2025',
        name,
        active: true,
        startYear: 2025,
        startMonth: 9,
      })
    ).toThrow();
  });

  it.each(['', '   '])('CohortSchema rejects empty or whitespace-only keys: %j', (key) => {
    expect(() =>
      CohortSchema.parse({
        key,
        name: '2025 Cohort',
        active: true,
        startYear: 2025,
        startMonth: 9,
      })
    ).toThrow();
  });

  it('CohortSchema rejects backend cohort payloads that omit keyed metadata', () => {
    expect(() =>
      CohortSchema.parse({ key: 'cohort-2025', name: '2025 Cohort', active: true })
    ).toThrow();
  });

  it('CohortSchema rejects non-boolean active within keyed cohort payloads', () => {
    expect(() =>
      CohortSchema.parse({
        key: 'cohort-2025',
        name: '2025 Cohort',
        active: 'yes',
        startYear: 2025,
        startMonth: 9,
      })
    ).toThrow();
  });

  it.each([INVALID_MONTH_BELOW_RANGE, INVALID_MONTH_ABOVE_RANGE])(
    'CohortSchema rejects invalid startMonth values: %j',
    (startMonth) => {
      expect(() =>
        CohortSchema.parse({
          key: 'cohort-2025',
          name: '2025 Cohort',
          active: true,
          startYear: 2025,
          startMonth,
        })
      ).toThrow();
    }
  );

  it('YearGroupSchema accepts keyed year-group payloads', () => {
    expect(YearGroupSchema.parse({ key: 'year-10', name: 'Year 10' })).toEqual({
      key: 'year-10',
      name: 'Year 10',
    });
  });

  it.each(['', '   '])(
    'YearGroupSchema rejects empty or whitespace-only keyed names: %j',
    (name) => {
      expect(() => YearGroupSchema.parse({ key: 'year-10', name })).toThrow();
    }
  );

  it.each(['', '   '])('YearGroupSchema rejects empty or whitespace-only keys: %j', (key) => {
    expect(() => YearGroupSchema.parse({ key, name: 'Year 10' })).toThrow();
  });

  it('CreateCohortInputSchema accepts omitted academic-year metadata in the record payload', () => {
    expect(CreateCohortInputSchema.parse({ record: { name: '2025 Cohort' } })).toEqual({
      record: { name: '2025 Cohort' },
    });
  });

  it('CreateCohortInputSchema preserves provided academic-year metadata', () => {
    expect(
      CreateCohortInputSchema.parse({
        record: { name: '2025 Cohort', active: true, startYear: 2025, startMonth: 9 },
      })
    ).toEqual({
      record: { name: '2025 Cohort', active: true, startYear: 2025, startMonth: 9 },
    });
  });

  it('UpdateCohortInputSchema requires key-addressed payloads with the keyed cohort record shape', () => {
    expect(
      UpdateCohortInputSchema.parse({
        key: 'cohort-2024',
        record: { name: '2025 Cohort', active: true },
      })
    ).toEqual({
      key: 'cohort-2024',
      record: { name: '2025 Cohort', active: true },
    });

    expect(() =>
      UpdateCohortInputSchema.parse({
        record: { name: '2025 Cohort', active: true },
      })
    ).toThrow();
    expect(() =>
      UpdateCohortInputSchema.parse({
        key: 'cohort-2024',
        record: { name: '2025 Cohort' },
      })
    ).toThrow();
  });

  it('DeleteCohortInputSchema accepts only key-addressed identity payloads', () => {
    expect(DeleteCohortInputSchema.parse({ key: 'cohort-2025' })).toEqual({
      key: 'cohort-2025',
    });
  });

  it('DeleteCohortResponseSchema accepts an omitted backend success payload', () => {
    expect(DeleteCohortResponseSchema.parse(omittedBackendSuccessPayload)).toBeUndefined();
  });

  it('DeleteCohortResponseSchema rejects unexpected backend success payload data', () => {
    expect(() => DeleteCohortResponseSchema.parse({ deleted: true })).toThrow();
  });

  it.each([
    [
      'CreateYearGroupInputSchema',
      () => CreateYearGroupInputSchema.parse({ record: { name: '   ' } }),
    ],
    [
      'UpdateYearGroupInputSchema key',
      () =>
        UpdateYearGroupInputSchema.parse({
          key: '   ',
          record: { name: 'Year 10' },
        }),
    ],
    [
      'UpdateYearGroupInputSchema record.name',
      () =>
        UpdateYearGroupInputSchema.parse({
          key: 'year-9',
          record: { name: '   ' },
        }),
    ],
    ['DeleteYearGroupInputSchema', () => DeleteYearGroupInputSchema.parse({ key: '' })],
  ])('%s rejects malformed names', (_, parseInvalidInput) => {
    expect(parseInvalidInput).toThrow();
  });

  it('year-group update and delete input schemas require keyed identity', () => {
    expect(
      UpdateYearGroupInputSchema.parse({
        key: 'year-9',
        record: { name: 'Year 10' },
      })
    ).toEqual({
      key: 'year-9',
      record: { name: 'Year 10' },
    });

    expect(() =>
      UpdateYearGroupInputSchema.parse({
        record: { name: 'Year 10' },
      })
    ).toThrow();

    expect(DeleteYearGroupInputSchema.parse({ key: 'year-10' })).toEqual({ key: 'year-10' });
    expect(() => DeleteYearGroupInputSchema.parse({})).toThrow();
  });

  it('DeleteYearGroupResponseSchema accepts an omitted backend success payload', () => {
    expect(DeleteYearGroupResponseSchema.parse(omittedBackendSuccessPayload)).toBeUndefined();
  });

  it('DeleteYearGroupResponseSchema rejects unexpected backend success payload data', () => {
    expect(() => DeleteYearGroupResponseSchema.parse({ deleted: true })).toThrow();
  });
});

describe('referenceData.zod AssignmentTopic schemas', () => {
  it('AssignmentTopicSchema validates correct shape with yearGroupKeys', () => {
    expect(
      AssignmentTopicSchema.parse({
        key: 'test',
        name: 'Test Topic',
        yearGroupKeys: ['yg1', 'yg2'],
      })
    ).toEqual({
      key: 'test',
      name: 'Test Topic',
      yearGroupKeys: ['yg1', 'yg2'],
    });
  });

  it('AssignmentTopicSchema accepts whitespace in name (which gets trimmed by NonEmptyNameSchema)', () => {
    expect(
      AssignmentTopicSchema.parse({
        key: 'test',
        name: '  Test Topic  ',
        yearGroupKeys: ['yg1'],
      })
    ).toEqual({
      key: 'test',
      name: 'Test Topic',
      yearGroupKeys: ['yg1'],
    });
  });

  it('AssignmentTopicSchema accepts empty array for yearGroupKeys', () => {
    expect(
      AssignmentTopicSchema.parse({
        key: 'test',
        name: 'Test Topic',
        yearGroupKeys: [],
      })
    ).toEqual({
      key: 'test',
      name: 'Test Topic',
      yearGroupKeys: [],
    });
  });

  it.each(['', '   '])('AssignmentTopicSchema rejects empty string for name: %j', (name) => {
    expect(() =>
      AssignmentTopicSchema.parse({
        key: 'test',
        name,
        yearGroupKeys: [],
      })
    ).toThrow();
  });

  it.each(['', '   '])('AssignmentTopicSchema rejects empty string for key: %j', (key) => {
    expect(() =>
      AssignmentTopicSchema.parse({
        key,
        name: 'Test Topic',
        yearGroupKeys: [],
      })
    ).toThrow();
  });

  it('AssignmentTopicSchema rejects array with empty strings in yearGroupKeys', () => {
    expect(() =>
      AssignmentTopicSchema.parse({
        key: 'test',
        name: 'Test Topic',
        yearGroupKeys: ['yg1', ''],
      })
    ).toThrow();
  });

  it('AssignmentTopicListResponseSchema validates array of valid topics', () => {
    expect(
      AssignmentTopicListResponseSchema.parse([
        { key: 'test1', name: 'Topic 1', yearGroupKeys: ['yg1'] },
        { key: 'test2', name: 'Topic 2', yearGroupKeys: ['yg2', 'yg3'] },
      ])
    ).toEqual([
      { key: 'test1', name: 'Topic 1', yearGroupKeys: ['yg1'] },
      { key: 'test2', name: 'Topic 2', yearGroupKeys: ['yg2', 'yg3'] },
    ]);
  });

  it('CreateAssignmentTopicInputSchema validates input with yearGroupKeys', () => {
    expect(
      CreateAssignmentTopicInputSchema.parse({
        record: { name: 'New Topic', yearGroupKeys: ['yg1'] },
      })
    ).toEqual({
      record: { name: 'New Topic', yearGroupKeys: ['yg1'] },
    });
  });

  it('UpdateAssignmentTopicInputSchema validates input with yearGroupKeys', () => {
    expect(
      UpdateAssignmentTopicInputSchema.parse({
        key: 'test',
        record: { name: 'Updated', yearGroupKeys: ['yg1', 'yg2'] },
      })
    ).toEqual({
      key: 'test',
      record: { name: 'Updated', yearGroupKeys: ['yg1', 'yg2'] },
    });
  });

  it('UpdateAssignmentTopicInputSchema rejects missing key', () => {
    expect(() =>
      UpdateAssignmentTopicInputSchema.parse({
        record: { name: 'Updated', yearGroupKeys: ['yg1'] },
      })
    ).toThrow();
  });

  it('DeleteAssignmentTopicInputSchema validates input', () => {
    expect(DeleteAssignmentTopicInputSchema.parse({ key: 'test' })).toEqual({ key: 'test' });
  });

  it('DeleteAssignmentTopicInputSchema rejects empty key', () => {
    expect(() => DeleteAssignmentTopicInputSchema.parse({ key: '' })).toThrow();
  });

  it('DeleteAssignmentTopicResponseSchema accepts void', () => {
    expect(DeleteAssignmentTopicResponseSchema.parse(omittedBackendSuccessPayload)).toBeUndefined();
  });

  it('DeleteAssignmentTopicResponseSchema rejects non-void', () => {
    expect(() => DeleteAssignmentTopicResponseSchema.parse({ deleted: true })).toThrow();
  });

  it('CreateAssignmentTopicResponseSchema validates response with yearGroupKeys', () => {
    expect(
      CreateAssignmentTopicResponseSchema.parse({
        key: 'created-key',
        name: 'Created Topic',
        yearGroupKeys: ['yg1'],
      })
    ).toEqual({
      key: 'created-key',
      name: 'Created Topic',
      yearGroupKeys: ['yg1'],
    });
  });

  it('UpdateAssignmentTopicResponseSchema validates response with yearGroupKeys', () => {
    expect(
      UpdateAssignmentTopicResponseSchema.parse({
        key: 'updated-key',
        name: 'Updated Topic',
        yearGroupKeys: ['yg1', 'yg2'],
      })
    ).toEqual({
      key: 'updated-key',
      name: 'Updated Topic',
      yearGroupKeys: ['yg1', 'yg2'],
    });
  });
});
