import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../query/queryKeys';
import type { ClassPartial } from '../../../services/googleClassrooms/classPartials.zod';
import type { AssignmentDefinitionPartial } from '../../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { AssignmentTopic } from '../../../services/referenceData/referenceData.zod';
import {
  getLinkableDefinitionsForModal,
  type LinkableDefinition,
} from './getLinkableDefinitionsForModal';

export type AssessmentAlertType = 'success' | 'error' | 'warning';

export type AssessmentState = 'idle' | 'loading' | 'success' | 'error';

export type NoMatchResolution = 'idle' | 'choice' | 'creating' | 'linking';

export type AssessmentFetchState = 'loading' | 'error' | 'ready';

export type AssessTaskAssignment = {
  assignmentId: string;
  title: string;
  topicId: string | null;
  topicName: string | null;
};

export type CapturedStartContext = {
  definitionKey: string;
  assignmentId: string;
  courseId: string;
};

/** Identifies one assessment-start attempt so obsolete completions can be ignored. */
export type StartAttempt = {
  session: number;
  assignmentId: string;
};

/** Describes a cache-data validation failure during assessment run. */
export type CacheValidationError = {
  kind: 'cache-error';
  alertType: AssessmentAlertType;
  message: string;
};

export type ValidatedCachedData =
  | { kind: 'valid'; classPartial: ClassPartial; definitionPartials: AssignmentDefinitionPartial[] }
  | CacheValidationError;

export type WizardInitialValues = Readonly<{
  title?: string;
  topic?: string;
  yearGroup?: string;
}>;

/**
 * Reads class partials and definition partials from the React Query cache,
 * validates them, and returns the matched class partial or a validation error.
 *
 * @param {QueryClient} queryClient The React Query client holding the cached rows.
 * @param {string} classId The class identifier to match in the cached class partials.
 * @returns {ValidatedCachedData} The class partial or a validation error descriptor.
 */
export function getValidatedCachedData(
  queryClient: QueryClient,
  classId: string
): ValidatedCachedData {
  const classPartials = queryClient.getQueryData<ClassPartial[]>(queryKeys.classPartials());
  const definitionPartials = queryClient.getQueryData<AssignmentDefinitionPartial[]>(
    queryKeys.assignmentDefinitionPartials()
  );

  if (!classPartials) {
    return {
      kind: 'cache-error',
      alertType: 'error',
      message: 'Failed to load class data. Please refresh and try again.',
    };
  }
  if (!definitionPartials) {
    return {
      kind: 'cache-error',
      alertType: 'error',
      message: 'Failed to load definition data. Please refresh and try again.',
    };
  }

  const classPartial = classPartials.find((cp) => cp.classId === classId);
  if (!classPartial) {
    return {
      kind: 'cache-error',
      alertType: 'error',
      message: 'Class not found in cached data. Please refresh and try again.',
    };
  }
  if (classPartial.yearGroupKey === null) {
    return {
      kind: 'cache-error',
      alertType: 'error',
      message: 'Cannot determine year group for this class.',
    };
  }

  return { kind: 'valid', classPartial, definitionPartials };
}

/**
 * Derives initial values for the AssignmentDefinitionWizardModal when
 * the user is creating a new definition from a no-match resolution.
 *
 * @remarks The stale definition's pre-populated data (task weightings, etc.)
 * is handled by the wizard's own re-parse logic, not by this derivation —
 * the wizard reads the stale definition from cache when opened in
 * `mode="create"`.
 *
 * @param {object} parameters The derivation inputs.
 * @param {NoMatchResolution} parameters.noMatchResolution The current no-match resolution state.
 * @param {readonly AssessTaskAssignment[]} parameters.assignments The fetched assignments.
 * @param {string | undefined} parameters.selectedAssignmentId The selected assignment identifier.
 * @param {AssignmentTopic[] | undefined} parameters.assignmentTopics The cached assignment topics.
 * @param {string | null | undefined} parameters.yearGroupKey The class year group key.
 * @returns {WizardInitialValues | undefined} The wizard initial values, or undefined outside the creating state.
 */
export function deriveWizardInitialValues(parameters: {
  noMatchResolution: NoMatchResolution;
  assignments: readonly AssessTaskAssignment[];
  selectedAssignmentId: string | undefined;
  assignmentTopics: AssignmentTopic[] | undefined;
  yearGroupKey: string | null | undefined;
}): WizardInitialValues | undefined {
  const { noMatchResolution, assignments, selectedAssignmentId, assignmentTopics, yearGroupKey } =
    parameters;
  if (noMatchResolution !== 'creating') return undefined;
  const selectedAssignment = assignments.find((a) => a.assignmentId === selectedAssignmentId);
  if (!selectedAssignment) return undefined;
  const values: { title?: string; topic?: string; yearGroup?: string } = {
    title: selectedAssignment.title,
  };
  if (
    selectedAssignment.topicId &&
    assignmentTopics?.some((t) => t.key === selectedAssignment.topicId)
  ) {
    values.topic = selectedAssignment.topicId;
  }
  if (yearGroupKey) {
    values.yearGroup = yearGroupKey;
  }
  return values;
}

/**
 * Derives the linkable definitions for the picker list from the cached
 * AssignmentDefinitionPartial rows. Returns the filtered, sorted list
 * or an empty array when not in the relevant no-match states.
 *
 * @param {object} parameters The derivation inputs.
 * @param {NoMatchResolution} parameters.noMatchResolution The current no-match resolution state.
 * @param {string | null | undefined} parameters.yearGroupKey The class year group key.
 * @param {AssessTaskAssignment | null} parameters.selectedAssignmentForChoice The assignment chosen for no-match resolution.
 * @param {AssignmentDefinitionPartial[]} parameters.definitionPartials The cached definition partials.
 * @returns {LinkableDefinition[]} The linkable definitions for the picker.
 */
export function deriveLinkableDefinitions(parameters: {
  noMatchResolution: NoMatchResolution;
  yearGroupKey: string | null | undefined;
  selectedAssignmentForChoice: AssessTaskAssignment | null;
  definitionPartials: AssignmentDefinitionPartial[];
}): LinkableDefinition[] {
  const { noMatchResolution, yearGroupKey, selectedAssignmentForChoice, definitionPartials } =
    parameters;
  if (noMatchResolution !== 'linking' && noMatchResolution !== 'choice') return [];
  if (!yearGroupKey) return [];
  if (!selectedAssignmentForChoice) return [];

  return getLinkableDefinitionsForModal(
    definitionPartials,
    yearGroupKey,
    selectedAssignmentForChoice
  );
}
