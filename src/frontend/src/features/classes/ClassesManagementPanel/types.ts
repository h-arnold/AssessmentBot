import type { RowMutationResult } from '../batchMutationEngine';
import type { ClassesManagementRow } from '../classesManagementViewModel';

export type BulkActionOutcomeAlert = Readonly<{
  description: string;
  title: string;
  type: 'error' | 'warning';
}>;

export type BulkFailureMessageCopy = Readonly<{
  allFailure: (totalCount: number) => string;
  partialFailure: (failedCount: number, totalCount: number) => string;
  partialRefreshFailure: (failedCount: number, totalCount: number) => string;
  singleFailure: string;
}>;

export type TopLevelBulkMutationResolution = Readonly<{
  alert: BulkActionOutcomeAlert | null;
  refreshRequiredMessage: string | null;
  selectedRowKeys: string[];
  shouldCloseSurface: boolean;
  suppressStaleTableData: boolean;
}>;

export type MetadataBulkMutationResolution = Readonly<{
  alert: BulkActionOutcomeAlert | null;
  errorMessage: string | null;
  refreshRequiredMessage: string | null;
  selectedRowKeys: string[];
  shouldCloseModal: boolean;
  suppressStaleTableData: boolean;
}>;

export type TopLevelBulkMutationCopy = Readonly<{
  createFailureMessage: (
    failedCount: number,
    totalCount: number,
    hasRefreshFailure: boolean
  ) => string;
  fullFailureTitle: string;
  partialFailureTitle: string;
}>;

export type TopLevelBulkActionDescriptor = TopLevelBulkMutationCopy &
  Readonly<{
    closeSurface?: () => void;
    mutateRows: (
      rows: ClassesManagementRow[]
    ) => Promise<RowMutationResult<ClassesManagementRow, unknown>[]>;
    setSubmitting: (value: boolean) => void;
  }>;

export type ClassesWorkflowMutationBoundaryState = Readonly<{
  createSubmitting: boolean;
  deleteSubmitting: boolean;
  setActiveSubmitting: boolean;
  setCohortSubmitting: boolean;
  setCourseLengthSubmitting: boolean;
  setInactiveSubmitting: boolean;
  setYearGroupSubmitting: boolean;
}>;
