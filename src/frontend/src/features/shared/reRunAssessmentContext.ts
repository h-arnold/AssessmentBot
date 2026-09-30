/**
 * Shared re-run entry contract handed from a heatmap surface to its owning
 * page and on to the Assess Task modal.
 *
 * Lives in `features/shared` because it crosses three feature directories
 * (`taskHeatmap`, `classPage` and `classes/AssessTaskModal`); the taskHeatmap
 * feature must not import from `features/classPage`.
 */

/**
 * One explicit re-run entry: the assignment to re-assess and the definition
 * key persisted when it was last assessed.
 *
 * @remarks `definitionKey` is `null` when the assignment has no linked
 * definition. The modal fails closed on that case instead of re-matching by
 * title or topic, so a re-run always targets the definition the user saw when
 * the assessment was first run.
 */
export type ReRunContext = Readonly<{
  /** The assignment identifier to re-run. */
  assignmentId: string;
  /** The persisted definition key, or null when the assignment has no linked definition. */
  definitionKey: string | null;
}>;
