import type { ClassPartial } from '@/services/googleClassrooms/classPartialsService';
import type { GoogleClassroom } from '@/services/googleClassrooms/googleClassroomsService';
import type { BatchProgressSnapshot } from './bulk/runQueuedBatchMutation';
import type { BulkCreateOptions } from './bulk/bulkCreateFlow';

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

// ---------------------------------------------------------------------------
// Panel view-model types
// ---------------------------------------------------------------------------

type SelectOption = Readonly<{ label: string; value: string }>;

/** Rows and reference-data presentation values used by the workflow content. */
export interface ClassesWorkflowDataView {
  rows: ClassesManagementRow[];
  selectedRows: ClassesManagementRow[];
  selectedRowKeys: string[];
  onSelectedRowKeysChange: (selectedRowKeys: string[]) => void;
  cohortOptions: SelectOption[];
  yearGroupOptions: SelectOption[];
  pendingCreatedCohortKey?: string;
  pendingCreatedYearGroupKey?: string;
}

/** Busy and submitting flags that drive workflow accessibility and loading. */
export interface ClassesWorkflowBusyView {
  isRefreshing: boolean;
  isMutationBoundaryActive: boolean;
  createSubmitting: boolean;
  deleteSubmitting: boolean;
  setActiveSubmitting: boolean;
  setInactiveSubmitting: boolean;
}

/** One modal surface: its open state and the setter that controls it. */
export interface ClassesWorkflowSurface {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
}

/** Modal surfaces owned by the panel shell. */
export interface ClassesWorkflowSurfacesView {
  create: ClassesWorkflowSurface;
  delete: ClassesWorkflowSurface;
  setCohort: ClassesWorkflowSurface;
  setYearGroup: ClassesWorkflowSurface;
  setCourseLength: ClassesWorkflowSurface;
  manageCohorts: ClassesWorkflowSurface;
  manageYearGroups: ClassesWorkflowSurface;
}

/** Queued-mutation progress modal state and actions. */
export interface ClassesWorkflowProgressView {
  isProgressModalOpen: boolean;
  progress: BatchProgressSnapshot;
  verb: string;
  onCancelQueue: () => void;
  onDismissProgressModal: () => void;
}

/** Mutation and reference-data handlers wired by the panel shell. */
export interface ClassesWorkflowActions {
  onBulkCreate: (options: BulkCreateOptions) => Promise<void>;
  onBulkDelete: () => Promise<void>;
  onSetActive: () => void;
  onSetInactive: () => void;
  onSetCohort: (cohortKey: string) => Promise<void>;
  onSetYearGroup: (yearGroupKey: string) => Promise<void>;
  onSetCourseLength: (courseLength: number) => Promise<void>;
  onCohortAddNew: () => void;
  onYearGroupAddNew: () => void;
  onCohortEntityCreated: (entity: { key: string }) => void;
  onYearGroupEntityCreated: (entity: { key: string }) => void;
}

export interface ClassesManagementWorkflowContentProperties {
  shouldSuppressStaleTableData: boolean;
  data: ClassesWorkflowDataView;
  busy: ClassesWorkflowBusyView;
  surfaces: ClassesWorkflowSurfacesView;
  progress: ClassesWorkflowProgressView;
  actions: ClassesWorkflowActions;
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
 * @remarks This is a UI-only derivation step. Transport payloads should carry
 * keys only; labels are resolved here from reference-data maps.
 *
 * @param {string | null} key Reference-data key.
 * @param {ReadonlyMap<string, string>} labelsByKey Labels indexed by key.
 * @returns {string | null} Display label.
 */
function resolveLabel(key: string | null, labelsByKey: ReadonlyMap<string, string>): string | null {
  if (key === null) {
    return null;
  }

  return labelsByKey.get(key) ?? null;
}

/**
 * Compares rows by the default status-priority contract and class-name tie-break.
 *
 * @param {ClassesManagementRow} left Left row.
 * @param {ClassesManagementRow} right Right row.
 * @returns {number} Comparison result for sorting.
 */
export function compareRowsByDefaultPriority(
  left: ClassesManagementRow,
  right: ClassesManagementRow
): number {
  const statusComparison = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
  if (statusComparison !== 0) {
    return statusComparison;
  }

  const classNameComparison = left.className.localeCompare(right.className, undefined, {
    sensitivity: 'base',
  });
  if (classNameComparison !== 0) {
    return classNameComparison;
  }

  return left.classId.localeCompare(right.classId);
}

/**
 * Builds merged Classes table rows from shared query datasets.
 *
 * @remarks `cohortLabel` and `yearGroupLabel` are derived view fields only and
 * must not be treated as backend transport fields.
 *
 * @remarks Status mapping intentionally treats only `active === true` as active.
 * `active === false` and `active === null` both map to inactive UI state unless
 * a separate product rule introduces an explicit unknown-state presentation.
 *
 * @param {BuildClassesManagementRowsInput} input Source datasets.
 * @returns {ClassesManagementRow[]} Merged and sorted rows.
 */
export function buildClassesManagementRows(
  input: BuildClassesManagementRowsInput
): ClassesManagementRow[] {
  const cohortLabelsByKey = new Map(Object.entries(input.cohortLabelsByKey));
  const yearGroupLabelsByKey = new Map(Object.entries(input.yearGroupLabelsByKey));
  const partialsByClassId = new Map(
    input.classPartials.map((classPartial) => [classPartial.classId, classPartial])
  );
  const googleByClassId = new Map(
    input.googleClassrooms.map((googleClassroom) => [googleClassroom.classId, googleClassroom])
  );

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
      cohortLabel: resolveLabel(classPartial.cohortKey, cohortLabelsByKey),
      yearGroupKey: classPartial.yearGroupKey,
      yearGroupLabel: resolveLabel(classPartial.yearGroupKey, yearGroupLabelsByKey),
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
      cohortLabel: resolveLabel(classPartial.cohortKey, cohortLabelsByKey),
      yearGroupKey: classPartial.yearGroupKey,
      yearGroupLabel: resolveLabel(classPartial.yearGroupKey, yearGroupLabelsByKey),
      courseLength: classPartial.courseLength,
      active: classPartial.active,
    });
  }

  rows.sort(compareRowsByDefaultPriority);

  return rows;
}
