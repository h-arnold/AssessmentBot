/**
 * Feature-local fixture adapter for the Task Preview Card.
 *
 * Provides `getTaskPreviewData` — a pure function that resolves preview data
 * for a given heatmap cell using a deterministic metricKey → fixture switch.
 *
 * @remarks
 * In v1 the `_taskId` parameter is part of the forward-looking contract but is
 * **not used** by the implementation — the lookup is keyed purely by `metricKey`
 * via a switch statement. The parameter is retained so the v1 implementation
 * satisfies the service-wiring contract without a signature change later.
 */

import type { TaskPreviewData } from './TaskPreviewCard';
import type { MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import type { HeatmapMetricKey } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';
import { z } from 'zod';

import imageFixtureJson from './fixtures/imageTask.json';
import textFixtureJson from './fixtures/textTask.json';
import tableFixtureJson from './fixtures/table_task.json';

// ---------------------------------------------------------------------------
// Zod schemas for fixture validation
// ---------------------------------------------------------------------------

const FixtureArtifactSchema = z.object({
  type: z.enum(['IMAGE', 'TEXT', 'TABLE']),
  content: z.string(),
});

const FixtureAssessmentSchema = z.object({ reasoning: z.string() });

const FixtureEntrySchema = z.object({
  artifact: FixtureArtifactSchema,
  assessments: z.object({
    completeness: FixtureAssessmentSchema,
    accuracy: FixtureAssessmentSchema,
    spag: FixtureAssessmentSchema,
  }),
});

const FixtureDataSchema = z.record(z.string(), FixtureEntrySchema);

// ---------------------------------------------------------------------------
// Parsed fixtures (validated at module load)
// ---------------------------------------------------------------------------

const imageFixture = FixtureDataSchema.parse(imageFixtureJson);
const textFixture = FixtureDataSchema.parse(textFixtureJson);
const tableFixture = FixtureDataSchema.parse(tableFixtureJson);

// ---------------------------------------------------------------------------
// Fixture resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a fixture entry and its taskId for the given metricKey.
 *
 * @param {HeatmapMetricKey} metricKey - The metric sub-column key.
 * @returns {{ readonly entry: z.infer<typeof FixtureEntrySchema>; readonly fixtureTaskId: string } | null}
 *   An object containing the resolved fixture entry and its taskId, or `null`
 *   when the metricKey is unrecognised.
 */
function getFixtureEntry(
  metricKey: HeatmapMetricKey
): { readonly entry: z.infer<typeof FixtureEntrySchema>; readonly fixtureTaskId: string } | null {
  switch (metricKey) {
    case 'completeness': {
      const data = imageFixture;
      return { entry: data.t_preview_image_001, fixtureTaskId: 't_preview_image_001' };
    }
    case 'accuracy': {
      const data = textFixture;
      return { entry: data.t_preview_text_001, fixtureTaskId: 't_preview_text_001' };
    }
    case 'spag': {
      const data = tableFixture;
      return { entry: data.t_preview_table_001, fixtureTaskId: 't_preview_table_001' };
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve preview data for a given heatmap cell using feature-local fixtures.
 *
 * @param {string} _taskId - Heatmap cell task ID **(unused in v1)**; retained
 *   for the service-wiring contract so that the signature does not change when
 *   the fixture adapter is replaced by the `assignmentAssessment` service hook.
 * @param {HeatmapMetricKey} metricKey - The metric sub-column key.
 * @param {MetricResult} metricResult - The heatmap cell's `MetricResult`
 *   (score + state). `metricScore` and `metricState` in the returned
 *   `TaskPreviewData` are derived from this value, not from the fixture data.
 * @returns {TaskPreviewData | null} A `TaskPreviewData` object assembled from
 *   the fixture and the supplied `metricResult`, or `null` if the metricKey is
 *   unrecognised.
 */
export function getTaskPreviewData(
  _taskId: string,
  metricKey: HeatmapMetricKey,
  metricResult: MetricResult
): TaskPreviewData | null {
  const resolved = getFixtureEntry(metricKey);

  if (resolved === null) {
    return null;
  }

  const { entry, fixtureTaskId } = resolved;

  return {
    taskId: fixtureTaskId,
    artifactType: entry.artifact.type,
    artifactContent: entry.artifact.content,
    metricKey,
    metricScore: metricResult.value,
    metricState: metricResult.state,
    reasoning: entry.assessments[metricKey].reasoning,
  };
}
