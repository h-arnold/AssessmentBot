/**
 * Selection-cascade reducer for the standalone Heatmaps surface.
 *
 * @remarks
 * Pure, deterministic, idempotent reducer owning the builder's cascade rules (a class change
 * atomically clears topic and assignment selections; a topic change clears assignments whose
 * topic no longer matches; widening the topic set never restores cleared assignments):
 *
 * - **`selectClass`** atomically clears `topicKeys` and `assignmentIds` in a single
 *   state update (no intermediate inconsistent frame), so dependent selectors never
 *   observe a class with stale topic/assignment selections. Passing `null` resets to
 *   the initial no-class state.
 * - **`changeTopics`** narrows the assignment selection to those whose resolved
 *   `primaryTopicKey` (supplied by the caller via `assignmentTopicKeys`) is in the
 *   active topic set. A *zero-topic* set means "no constraint" — every current
 *   assignment stays valid. Critically, narrowing never *restores* cleared
 *   assignments: the filter runs only over the existing `assignmentIds`, so widening
 *   the topic set back out cannot resurrect an assignment the user previously
 *   deselected via cascade. This is what keeps the cascade non-restoring.
 *
 * The reducer stays pure: it takes `assignmentTopicKeys` as a parameter (a
 * `Map<assignmentId, primaryTopicKey>`) rather than reaching into class/definition
 * data, keeping it trivially testable and free of feature-side data dependencies.
 */

/**
 * Feature-owned selection state for the Heatmaps builder surface.
 *
 * Mirrors the shape consumed by `useHeatmapsPageData` and `HeatmapSelectionBar`.
 */
export type SelectionState = Readonly<{
  /** Selected class ID, or `null` when no class has been chosen yet. */
  classId: string | null;
  /** Selected topic keys (cascade-narrowed assignment options derive from these). */
  topicKeys: readonly string[];
  /** Selected assignment IDs (the merged-table scope). */
  assignmentIds: readonly string[];
}>;

/**
 * Discriminated union of selection-cascade actions.
 */
export type SelectionCascadeAction =
  | { type: 'selectClass'; classId: string | null }
  | {
      readonly type: 'changeTopics';
      readonly topicKeys: readonly string[];
      readonly assignmentTopicKeys: ReadonlyMap<string, string>;
    }
  | { readonly type: 'changeAssignments'; readonly assignmentIds: readonly string[] };

/** Initial selection: no class, no topics, no assignments. */
export const INITIAL_SELECTION_STATE: SelectionState = Object.freeze({
  classId: null,
  topicKeys: [],
  assignmentIds: [],
});

/**
 * Pure selection-cascade reducer.
 *
 * @param {SelectionState} state - The current selection state.
 * @param {SelectionCascadeAction} action - The cascade action to apply.
 * @returns {SelectionState} The next selection state.
 */
export function selectionCascadeReducer(
  state: SelectionState,
  action: SelectionCascadeAction
): SelectionState {
  switch (action.type) {
    case 'selectClass': {
      // Clearing the class returns the frozen initial state; selecting a class
      // atomically resets topics and assignments (cascade-clearing rationale).
      if (action.classId === null) {
        return INITIAL_SELECTION_STATE;
      }
      return {
        classId: action.classId,
        topicKeys: [],
        assignmentIds: [],
      };
    }

    case 'changeTopics': {
      const activeTopicSet = new Set(action.topicKeys);

      // Zero topics = no constraint: every currently-selected assignment remains valid.
      const assignmentIds =
        activeTopicSet.size === 0
          ? state.assignmentIds
          : state.assignmentIds.filter((assignmentId) => {
              const topicKey = action.assignmentTopicKeys.get(assignmentId);
              return topicKey !== undefined && activeTopicSet.has(topicKey);
            });

      return {
        ...state,
        topicKeys: action.topicKeys,
        assignmentIds,
      };
    }

    case 'changeAssignments': {
      return {
        ...state,
        assignmentIds: action.assignmentIds,
      };
    }

    default: {
      return state;
    }
  }
}
