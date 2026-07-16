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

import imageFixture from './fixtures/imageTask.json';
import textFixture from './fixtures/textTask.json';
import tableFixture from './fixtures/table_task.json';

// ---------------------------------------------------------------------------
// Local types (minimal — only the fields consumed by the adapter)
// ---------------------------------------------------------------------------

interface FixtureEntry {
  readonly taskId: string;
  readonly artifact: {
    readonly type: 'IMAGE' | 'TEXT' | 'TABLE';
    readonly content: string;
  };
  readonly assessments: Record<HeatmapMetricKey, { readonly reasoning: string }>;
}

interface FixtureData {
  readonly [taskId: string]: FixtureEntry;
}

// ---------------------------------------------------------------------------
// Fixture resolution (switch-based to avoid object-injection lint)
// ---------------------------------------------------------------------------

/**
 * Resolve a fixture entry and its taskId for the given metricKey.
 *
 * Uses a switch statement (not dynamic property access) to satisfy the
 * `security/detect-object-injection` lint rule.
 *
 * @param {HeatmapMetricKey} metricKey - The metric sub-column key.
 * @returns {{ readonly entry: FixtureEntry; readonly fixtureTaskId: string } | null}
 *   An object containing the resolved fixture entry and its taskId, or `null`
 *   when the metricKey is unrecognised.
 */
function getFixtureEntry(
  metricKey: HeatmapMetricKey
): { readonly entry: FixtureEntry; readonly fixtureTaskId: string } | null {
  switch (metricKey) {
    case 'completeness': {
      const data = imageFixture as FixtureData;
      return { entry: data.t_preview_image_001, fixtureTaskId: 't_preview_image_001' };
    }
    case 'accuracy': {
      const data = textFixture as FixtureData;
      return { entry: data.t_preview_text_001, fixtureTaskId: 't_preview_text_001' };
    }
    case 'spag': {
      const data = tableFixture as FixtureData;
      return { entry: data.t_preview_table_001, fixtureTaskId: 't_preview_table_001' };
    }
  }
}

/**
 * Extract the reasoning text for a given metricKey from a fixture entry.
 *
 * @param {FixtureEntry} entry - The fixture entry containing assessments.
 * @param {HeatmapMetricKey} metricKey - The metric key to extract reasoning for.
 * @returns {string} The reasoning text string.
 */
function getReasoning(entry: FixtureEntry, metricKey: HeatmapMetricKey): string {
  switch (metricKey) {
    case 'completeness': {
      return entry.assessments.completeness.reasoning;
    }
    case 'accuracy': {
      return entry.assessments.accuracy.reasoning;
    }
    case 'spag': {
      return entry.assessments.spag.reasoning;
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
    reasoning: getReasoning(entry, metricKey),
  };
}
