import type { ClassPartial } from '../../services/classPartialsService';
import type { GoogleClassroom } from '../../services/googleClassroomsService';

export type ClassesManagementStatus = 'active' | 'inactive' | 'notCreated' | 'orphaned';

export interface ClassesManagementRow {
  classId: string;
  className: string;
  status: ClassesManagementStatus;
  cohortKey?: string | null;
  cohortLabel: string | null;
  yearGroupKey?: string | null;
  yearGroupLabel: string | null;
  courseLength: number | null;
  active: boolean | null;
}

export interface BuildClassesManagementRowsInput {
  googleClassrooms: GoogleClassroom[];
  classPartials: ClassPartial[];
  cohortLabelsByKey: Readonly<Record<string, string>>;
  yearGroupLabelsByKey: Readonly<Record<string, string>>;
}

export const STATUS_ORDER: Readonly<Record<ClassesManagementStatus, number>> = {
  active: 0,
  inactive: 1,
  notCreated: 2,
  orphaned: 3,
};

/**
 * Resolves the preferred display label for a reference-data key.
 *
 * @param {string | null} key Reference-data key.
 * @param {string | null} fallbackLabel Backend-provided fallback label.
 * @param {ReadonlyMap<string, string>} labelsByKey Labels indexed by key.
 * @returns {string | null} Display label.
 */
function resolveLabel(
  key: string | null,
  fallbackLabel: string | null,
  labelsByKey: ReadonlyMap<string, string>,
): string | null {
  if (key === null) {
    return fallbackLabel;
  }

  return labelsByKey.get(key) ?? fallbackLabel;
}

/**
 * Compares rows by the default status-priority contract and class-name tie-break.
 *
 * @param {ClassesManagementRow} left Left row.
 * @param {ClassesManagementRow} right Right row.
 * @returns {number} Comparison result for sorting.
 */
export function compareRowsByDefaultPriority(left: ClassesManagementRow, right: ClassesManagementRow): number {
  const statusComparison = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
  if (statusComparison !== 0) {
    return statusComparison;
  }

  const classNameComparison = left.className.localeCompare(right.className, undefined, { sensitivity: 'base' });
  if (classNameComparison !== 0) {
    return classNameComparison;
  }

  return left.classId.localeCompare(right.classId);
}

/**
 * Builds merged Classes table rows from shared query datasets.
 *
 * @param {BuildClassesManagementRowsInput} input Source datasets.
 * @returns {ClassesManagementRow[]} Merged and sorted rows.
 */
export function buildClassesManagementRows(
  input: BuildClassesManagementRowsInput,
): ClassesManagementRow[] {
  const cohortLabelsByKey = new Map(Object.entries(input.cohortLabelsByKey));
  const yearGroupLabelsByKey = new Map(Object.entries(input.yearGroupLabelsByKey));
  const partialsByClassId = new Map(input.classPartials.map((classPartial) => [classPartial.classId, classPartial]));
  const googleByClassId = new Map(input.googleClassrooms.map((googleClassroom) => [googleClassroom.classId, googleClassroom]));

  const rows: ClassesManagementRow[] = [];

  for (const googleClassroom of input.googleClassrooms) {
    const classPartial = partialsByClassId.get(googleClassroom.classId);
    if (classPartial === undefined) {
      rows.push({
        classId: googleClassroom.classId,
        className: googleClassroom.className,
        status: 'notCreated',
        cohortKey: null,
        cohortLabel: null,
        yearGroupKey: null,
        yearGroupLabel: null,
        courseLength: null,
        active: null,
      });
      continue;
    }

    rows.push({
      classId: googleClassroom.classId,
      className: googleClassroom.className,
      status: classPartial.active === true ? 'active' : 'inactive',
      cohortKey: classPartial.cohortKey,
      cohortLabel: resolveLabel(classPartial.cohortKey, classPartial.cohortLabel, cohortLabelsByKey),
      yearGroupKey: classPartial.yearGroupKey,
      yearGroupLabel: resolveLabel(classPartial.yearGroupKey, classPartial.yearGroupLabel, yearGroupLabelsByKey),
      courseLength: classPartial.courseLength,
      active: classPartial.active,
    });
  }

  for (const classPartial of input.classPartials) {
    if (googleByClassId.has(classPartial.classId)) {
      continue;
    }

    rows.push({
      classId: classPartial.classId,
      className: classPartial.className ?? classPartial.classId,
      status: 'orphaned',
      cohortKey: classPartial.cohortKey,
      cohortLabel: resolveLabel(classPartial.cohortKey, classPartial.cohortLabel, cohortLabelsByKey),
      yearGroupKey: classPartial.yearGroupKey,
      yearGroupLabel: resolveLabel(classPartial.yearGroupKey, classPartial.yearGroupLabel, yearGroupLabelsByKey),
      courseLength: classPartial.courseLength,
      active: classPartial.active,
    });
  }

  rows.sort(compareRowsByDefaultPriority);

  return rows;
}
