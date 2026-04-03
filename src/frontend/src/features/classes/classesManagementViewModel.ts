import type { ClassPartial } from '../../services/classPartialsService';
import type { GoogleClassroom } from '../../services/googleClassroomsService';

export type ClassesManagementStatus = 'active' | 'inactive' | 'notCreated' | 'orphaned';

export interface ClassesManagementRow {
  classId: string;
  className: string;
  status: ClassesManagementStatus;
  cohortLabel: string | null;
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

const STATUS_ORDER: Readonly<Record<ClassesManagementStatus, number>> = {
  active: 0,
  inactive: 1,
  notCreated: 2,
  orphaned: 3,
};

function resolveLabel(
  key: string | null,
  fallbackLabel: string | null,
  labelsByKey: Readonly<Record<string, string>>,
): string | null {
  if (key === null) {
    return fallbackLabel;
  }

  return labelsByKey[key] ?? fallbackLabel;
}

export function buildClassesManagementRows(
  input: BuildClassesManagementRowsInput,
): ClassesManagementRow[] {
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
        cohortLabel: null,
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
      cohortLabel: resolveLabel(classPartial.cohortKey, classPartial.cohortLabel, input.cohortLabelsByKey),
      yearGroupLabel: resolveLabel(classPartial.yearGroupKey, classPartial.yearGroupLabel, input.yearGroupLabelsByKey),
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
      cohortLabel: resolveLabel(classPartial.cohortKey, classPartial.cohortLabel, input.cohortLabelsByKey),
      yearGroupLabel: resolveLabel(classPartial.yearGroupKey, classPartial.yearGroupLabel, input.yearGroupLabelsByKey),
      courseLength: classPartial.courseLength,
      active: classPartial.active,
    });
  }

  rows.sort((left, right) => {
    const statusComparison = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
    if (statusComparison !== 0) {
      return statusComparison;
    }

    const classNameComparison = left.className.localeCompare(right.className, undefined, { sensitivity: 'base' });
    if (classNameComparison !== 0) {
      return classNameComparison;
    }

    return left.classId.localeCompare(right.classId);
  });

  return rows;
}
