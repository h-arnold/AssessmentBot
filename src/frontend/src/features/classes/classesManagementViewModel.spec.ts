import { describe, expect, it } from 'vitest';
import type { ClassPartial } from '../../services/classPartialsService';
import type { GoogleClassroom } from '../../services/googleClassroomsService';

type LabelsByKey = Readonly<Record<string, string>>;

/**
 * Builds rows through the production view-model helper.
 *
 * @param {Readonly<{
 *   googleClassrooms: GoogleClassroom[];
 *   classPartials: ClassPartial[];
 *   cohortLabelsByKey: LabelsByKey;
 *   yearGroupLabelsByKey: LabelsByKey;
 * }>} input Source datasets.
 * @param {GoogleClassroom[]} input.googleClassrooms Source Google Classrooms.
 * @param {ClassPartial[]} input.classPartials Source class partials.
 * @param {LabelsByKey} input.cohortLabelsByKey Cohort labels by key.
 * @param {LabelsByKey} input.yearGroupLabelsByKey Year-group labels by key.
 * @returns {Promise<ReturnType<typeof import('./classesManagementViewModel').buildClassesManagementRows>>} Built rows.
 */
async function buildRows(input: {
  googleClassrooms: GoogleClassroom[];
  classPartials: ClassPartial[];
  cohortLabelsByKey: LabelsByKey;
  yearGroupLabelsByKey: LabelsByKey;
}) {
  const { buildClassesManagementRows } = await import('./classesManagementViewModel');

  return buildClassesManagementRows(input);
}

describe('classesManagementViewModel.buildClassesManagementRows', () => {
  it('merges matched Google Classroom and class-partial records into active rows with resolved labels', async () => {
    const rows = await buildRows({
      googleClassrooms: [{ classId: 'class-active-1', className: 'Alpha' }],
      classPartials: [
        {
          classId: 'class-active-1',
          className: 'Alpha',
          cohortKey: 'cohort-a',
          courseLength: 2,
          yearGroupKey: 'year-10',
          classOwner: null,
          teachers: [],
          active: true,
        },
      ],
      cohortLabelsByKey: { 'cohort-a': 'Cohort A' },
      yearGroupLabelsByKey: { 'year-10': 'Year 10' },
    });

    expect(rows).toEqual([
      expect.objectContaining({
        classId: 'class-active-1',
        className: 'Alpha',
        status: 'active',
        cohortLabel: 'Cohort A',
        yearGroupLabel: 'Year 10',
        courseLength: 2,
      }),
    ]);
  });

  it('maps matched records with active=false to inactive status', async () => {
    const rows = await buildRows({
      googleClassrooms: [{ classId: 'class-inactive-1', className: 'Bravo' }],
      classPartials: [
        {
          classId: 'class-inactive-1',
          className: 'Bravo',
          cohortKey: null,
          courseLength: 1,
          yearGroupKey: null,
          classOwner: null,
          teachers: [],
          active: false,
        },
      ],
      cohortLabelsByKey: {},
      yearGroupLabelsByKey: {},
    });

    expect(rows).toEqual([
      expect.objectContaining({
        classId: 'class-inactive-1',
        className: 'Bravo',
        status: 'inactive',
      }),
    ]);
  });

  it('maps Google Classroom records without class-partials to notCreated status', async () => {
    const rows = await buildRows({
      googleClassrooms: [{ classId: 'class-not-created-1', className: 'Charlie' }],
      classPartials: [],
      cohortLabelsByKey: {},
      yearGroupLabelsByKey: {},
    });

    expect(rows).toEqual([
      expect.objectContaining({
        classId: 'class-not-created-1',
        className: 'Charlie',
        status: 'notCreated',
      }),
    ]);
  });

  it('maps class-partials with no Google Classroom match to orphaned status', async () => {
    const rows = await buildRows({
      googleClassrooms: [],
      classPartials: [
        {
          classId: 'class-orphaned-1',
          className: 'Delta',
          cohortKey: 'cohort-z',
          courseLength: 3,
          yearGroupKey: 'year-12',
          classOwner: null,
          teachers: [],
          active: true,
        },
      ],
      cohortLabelsByKey: { 'cohort-z': 'Cohort Z' },
      yearGroupLabelsByKey: { 'year-12': 'Year 12' },
    });

    expect(rows).toEqual([
      expect.objectContaining({
        classId: 'class-orphaned-1',
        className: 'Delta',
        status: 'orphaned',
      }),
    ]);
  });

  it('orders rows by status priority then by case-insensitive className localeCompare', async () => {
    const rows = await buildRows({
      googleClassrooms: [
        { classId: 'active-z', className: 'Zulu' },
        { classId: 'active-a', className: 'alpha' },
        { classId: 'inactive-b', className: 'Bravo' },
        { classId: 'inactive-a', className: 'aardvark' },
        { classId: 'not-created-b', className: 'Echo' },
        { classId: 'not-created-a', className: 'delta' },
      ],
      classPartials: [
        {
          classId: 'active-z',
          className: 'Zulu',
          cohortKey: null,
          courseLength: 1,
          yearGroupKey: null,
          classOwner: null,
          teachers: [],
          active: true,
        },
        {
          classId: 'active-a',
          className: 'alpha',
          cohortKey: null,
          courseLength: 1,
          yearGroupKey: null,
          classOwner: null,
          teachers: [],
          active: true,
        },
        {
          classId: 'inactive-b',
          className: 'Bravo',
          cohortKey: null,
          courseLength: 1,
          yearGroupKey: null,
          classOwner: null,
          teachers: [],
          active: false,
        },
        {
          classId: 'inactive-a',
          className: 'aardvark',
          cohortKey: null,
          courseLength: 1,
          yearGroupKey: null,
          classOwner: null,
          teachers: [],
          active: false,
        },
        {
          classId: 'orphaned-b',
          className: 'yankee',
          cohortKey: null,
          courseLength: 1,
          yearGroupKey: null,
          classOwner: null,
          teachers: [],
          active: true,
        },
        {
          classId: 'orphaned-a',
          className: 'Foxtrot',
          cohortKey: null,
          courseLength: 1,
          yearGroupKey: null,
          classOwner: null,
          teachers: [],
          active: false,
        },
      ],
      cohortLabelsByKey: {},
      yearGroupLabelsByKey: {},
    });

    expect(rows.map((row: { classId: string; status: string }) => `${row.status}:${row.classId}`)).toEqual([
      'active:active-a',
      'active:active-z',
      'inactive:inactive-a',
      'inactive:inactive-b',
      'notCreated:not-created-a',
      'notCreated:not-created-b',
      'orphaned:orphaned-a',
      'orphaned:orphaned-b',
    ]);
  });

  it('uses classId as a deterministic tie-break when class names are equal under base sensitivity', async () => {
    expect('Alpha'.localeCompare('alpha', undefined, { sensitivity: 'base' })).toBe(0);

    const rows = await buildRows({
      googleClassrooms: [
        { classId: 'active-upper', className: 'Alpha' },
        { classId: 'active-lower', className: 'alpha' },
      ],
      classPartials: [
        {
          classId: 'active-upper',
          className: 'Alpha',
          cohortKey: null,
          courseLength: 1,
          yearGroupKey: null,
          classOwner: null,
          teachers: [],
          active: true,
        },
        {
          classId: 'active-lower',
          className: 'alpha',
          cohortKey: null,
          courseLength: 1,
          yearGroupKey: null,
          classOwner: null,
          teachers: [],
          active: true,
        },
      ],
      cohortLabelsByKey: {},
      yearGroupLabelsByKey: {},
    });

    expect(rows.map((row: { classId: string }) => row.classId)).toEqual(['active-lower', 'active-upper']);
  });
});
