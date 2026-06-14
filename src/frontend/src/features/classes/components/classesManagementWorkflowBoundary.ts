// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClassesWorkflowMutationBoundaryState = Readonly<{
  createSubmitting: boolean;
  deleteSubmitting: boolean;
  setActiveSubmitting: boolean;
  setCohortSubmitting: boolean;
  setCourseLengthSubmitting: boolean;
  setInactiveSubmitting: boolean;
  setYearGroupSubmitting: boolean;
}>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns whether the classes data-workflow write boundary is currently active.
 *
 * @param {ClassesWorkflowMutationBoundaryState} state Mutation submission state.
 * @returns {boolean} True when conflicting workflow writes should stay disabled.
 */
export function isClassesWorkflowMutationBoundaryActive(
  state: ClassesWorkflowMutationBoundaryState
): boolean {
  return [
    state.createSubmitting,
    state.deleteSubmitting,
    state.setActiveSubmitting,
    state.setInactiveSubmitting,
    state.setCohortSubmitting,
    state.setYearGroupSubmitting,
    state.setCourseLengthSubmitting,
  ].some(Boolean);
}

/**
 * Returns whether stale rows should be hidden until classes are refreshed.
 *
 * @param {boolean} suppressStaleTableData Local suppress flag from mutation outcomes.
 * @param {string | null} refreshRequiredMessage Refresh-required message from the hook.
 * @returns {boolean} True when stale rows should stay hidden.
 */
export function shouldSuppressClassesTableData(
  suppressStaleTableData: boolean,
  refreshRequiredMessage: string | null
): boolean {
  return suppressStaleTableData || refreshRequiredMessage !== null;
}

/**
 * Returns the panel-level aria-busy token for the classes workflow region.
 *
 * @param {boolean} isRefreshing Whether the classes workflow is currently refreshing.
 * @returns {'true' | undefined} Busy token for aria-busy.
 */
export function getClassesWorkflowBusyState(isRefreshing: boolean): 'true' | undefined {
  return isRefreshing ? 'true' : undefined;
}
