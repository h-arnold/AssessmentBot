import type {
  AssessmentSchema,
  AssignmentFull,
  BaseTaskArtifactSchema,
} from '../../services/assignmentAssessment/assignmentAssessment.zod';
import { HEATMAP_METRIC_KEYS } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';
import type { HeatmapMetricKey } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';
import type { z } from 'zod';

/**
 * Assessment shape, derived from {@link AssessmentSchema} so the two cannot
 * drift. Mirrors `Assessment.toJSON()` in `src/backend/Models/Assessment.js`.
 */
type Assessment = z.infer<typeof AssessmentSchema>;

/**
 * Discriminant values for a task artifact's type, derived from the
 * {@link BaseTaskArtifactSchema} discriminated union so the two cannot drift.
 */
type ArtifactType = z.infer<typeof BaseTaskArtifactSchema>['type'];

/**
 * Maps each `ArtifactType` to its corresponding `artifactContent` type.
 */
type ArtifactContentByType<T extends ArtifactType> = T extends 'SPREADSHEET'
  ? Array<Array<string | number | null>> | null
  : T extends 'base'
    ? unknown
    : string | null;

/**
 * Per-cell preview data extracted from a single (student, task) pair in
 * the AssignmentFull payload.
 *
 * Discriminated union keyed on `artifactType` so that `artifactContent`
 * narrows automatically when the type is checked.
 */
export type CellPreviewData = {
  [K in ArtifactType]: {
    readonly artifactType: K;
    readonly artifactContent: ArtifactContentByType<K>;
    /** Per-metric reasoning strings (null when assessment is absent for that metric). */
    readonly reasoning: Record<HeatmapMetricKey, string | null>;
  };
}[ArtifactType];

/**
 * Keyed lookup: outer key is studentId, inner key is the composite `taskKey`
 * (`` `${definitionKey}::${taskId}` ``).
 *
 * A missing student entry or taskKey entry means no submission exists for that
 * (student, task) pair. O(1) retrieval via two Map.get calls. The inner key is
 * composite so that two assignment instances sharing one definition key no
 * longer collide on the bare `taskId` (see the `@remarks` block on
 * {@link buildCellPreviewLookup} for the full rationale).
 */
export type CellPreviewLookup = ReadonlyMap<string, ReadonlyMap<string, CellPreviewData>>;

/**
 * Builds a `CellPreviewData` from a single submission item's artifact and assessments.
 *
 * @param {ArtifactType} artifactType - The artifact type discriminator.
 * @param {unknown} artifactContent - The artifact content.
 * @param {Record<string, Assessment>} assessments - The per-metric assessments.
 * @returns {CellPreviewData} The assembled cell preview data.
 */
function createCellPreviewData(
  artifactType: ArtifactType,
  artifactContent: unknown,
  assessments: Record<string, Assessment>
): CellPreviewData {
  return {
    artifactType,
    artifactContent,
    // `assessments` is keyed by backend metric names (`completeness`,
    // `accuracy`, `spag`). `HEATMAP_METRIC_KEYS` provides the same three
    // keys used for lookup. If a metric key is absent, `reasoning` defaults
    // to `null`.
    reasoning: Object.fromEntries(
      HEATMAP_METRIC_KEYS.map((key) => [key, assessments[key]?.reasoning ?? null])
    ) as Record<HeatmapMetricKey, string | null>,
  } as CellPreviewData;
}

/**
 * Transforms an `AssignmentFull` payload into a `Map<studentId, Map<taskKey, CellPreviewData>>`
 * for O(1) popover lookup, where `taskKey` is the composite `` `${definitionKey}::${taskId}` ``.
 *
 * @param {AssignmentFull} assignment - The full assignment payload (must be non-null; caller guards null).
 * @returns {CellPreviewLookup} A read-only Map keyed by studentId → taskKey → CellPreviewData.
 *
 * @remarks
 * The inner key is the composite `taskKey`, not the bare `taskId`. The
 * `definitionKey` is derived internally from the payload's embedded
 * `assignmentDefinition.definitionKey` (present on `AssignmentFull`), so the
 * lookup keys line up with the heatmap column `taskKey`s produced by
 * `adaptMetricsToHeatmap`.
 *
 * Two reasons justify the composite key:
 *
 * 1. **Cross-fetch invariant.** The embedded popover path relies on
 *    `getABClass.assignments[].assignmentDefinitionKey` (class-fetch side)
 *    equalling `getAssignment.assignmentDefinition.definitionKey` (assignment-fetch
 *    side) for the same assignment. The backend guarantees this today because the
 *    class mapper derives `assignmentDefinitionKey` from the very same embedded
 *    definition document (`src/backend/y_controllers/ABClassController/ABClassResponseMapper.js:88`).
 *    Keying the lookup by the composite `taskKey` therefore keeps the embedded
 *    flow correct once keys widen, and the invariant is pinned by a dedicated
 *    cross-fetch parity test.
 * 2. **Collision elimination.** Two assignment instances that share one
 *    definition key would otherwise merge their submissions under identical bare
 *    `taskId`s; the composite key keeps each instance's cells distinct.
 *
 * If the embedded `assignmentDefinition` or its `definitionKey` is absent, the
 * function throws. This is a fail-fast invariant guard, not validation: the
 * transport schema already forbids the omission. Were we to silently fall back
 * to a bare `taskId` (or a default key) instead of throwing, a broken invariant
 * would surface not as a crash but as embedded popovers silently losing data —
 * the lookup would build keys that never match the column `taskKey`s, so every
 * `get(taskKey)` returns `undefined` and previews would silently fail to render.
 */
export function buildCellPreviewLookup(assignment: AssignmentFull): CellPreviewLookup {
  const definition = assignment.assignmentDefinition;
  if (definition?.definitionKey == null) {
    throw new Error(
      'buildCellPreviewLookup: assignment.assignmentDefinition.definitionKey is required to derive composite task keys; the embedded definition was absent.'
    );
  }
  const definitionKey = definition.definitionKey;

  const outerMap = new Map<string, Map<string, CellPreviewData>>();

  for (const submission of assignment.submissions) {
    const innerMap = new Map<string, CellPreviewData>();

    for (const item of Object.values(submission.items)) {
      const taskKey = `${definitionKey}::${item.taskId}`;
      // First-wins: only set if this taskKey has not been encountered yet
      if (!innerMap.has(taskKey)) {
        innerMap.set(
          taskKey,
          createCellPreviewData(item.artifact.type, item.artifact.content, item.assessments)
        );
      }
    }

    outerMap.set(submission.studentId, innerMap);
  }

  return outerMap;
}
