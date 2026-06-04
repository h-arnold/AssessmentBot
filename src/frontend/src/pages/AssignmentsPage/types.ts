import type { FilterValue } from 'antd/es/table/interface';
import type { AssignmentDefinitionPartial } from '../../services/assignmentDefinitionPartialsService';

export const ASSIGNMENTS_PANEL_REGION_LABEL = 'Assignments management panel';
export const BLOCKING_ERROR_MESSAGE = 'Assignment definitions could not be trusted or loaded.';
export const DELETE_SUCCESS_MESSAGE = 'Assignment definition deleted.';
export const DELETE_FAILURE_MESSAGE = 'Could not delete assignment definition. Please try again.';
export const UNAVAILABLE_VALUE = '—';

export const FILTER_DROPDOWN_PROPERTIES = { transitionName: '' } as const;

export type AssignmentsFilterState = Readonly<{
  primaryTitle: FilterValue | null;
  primaryTopic: FilterValue | null;
  yearGroup: FilterValue | null;
  documentType: FilterValue | null;
  updatedAt: FilterValue | null;
}>;

export type AssignmentsFilterColumnKey = keyof AssignmentsFilterState;

export type AssignmentsFilterOption = Readonly<{ text: string; value: string }>;

export type AssignmentsFilterDescriptor = Readonly<{
  key: AssignmentsFilterColumnKey;
  title: string;
  filterLabel: string;
  getFilterValue: (row: AssignmentDefinitionPartial) => string;
  renderCell?: (row: AssignmentDefinitionPartial) => string;
}>;

export type DeleteOutcome = Readonly<{
  type: 'success' | 'error';
  message: string;
}>;

export type AssignmentsSurfaceState = Readonly<{
  shouldRenderActionLoadingState: boolean;
  shouldRenderBlockingState: boolean;
  shouldRenderTableLoadingState: boolean;
}>;

export const EMPTY_FILTER_STATE: AssignmentsFilterState = {
  primaryTitle: null,
  primaryTopic: null,
  yearGroup: null,
  documentType: null,
  updatedAt: null,
};
