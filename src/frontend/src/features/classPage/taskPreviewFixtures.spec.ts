/**
 * Unit tests for the `getTaskPreviewData` adapter (v1 fixture loader).
 *
 * The adapter uses a deterministic metricKey → fixture mapping:
 * - `completeness` → imageTask.json  (t_preview_image_001, IMAGE)
 * - `accuracy`     → textTask.json   (t_preview_text_001, TEXT)
 * - `spag`         → table_task.json (t_preview_table_001, TABLE)
 *
 * The `taskId` parameter is accepted but unused in v1 (the lookup is keyed
 * purely by `metricKey`). The "returns null for unknown taskIds" test is
 * deferred to the service-wiring round.
 */

import { describe, it, expect } from 'vitest';
import { getTaskPreviewData } from './taskPreviewFixtures';
import type { MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import imageFixture from './fixtures/imageTask.json';
import textFixture from './fixtures/textTask.json';
import tableFixture from './fixtures/table_task.json';

// ---------------------------------------------------------------------------
// MetricResult fixtures for test inputs
// ---------------------------------------------------------------------------

const COMPUTED_SCORE = 5;

const computedMetricResult: MetricResult = {
  state: 'computed',
  value: COMPUTED_SCORE,
  totalWeight: 0,
  applicableDataPoints: 1,
  totalDataPoints: 1,
};

const notAttemptedMetricResult: MetricResult = {
  state: 'notAttempted',
  value: 'N',
  totalWeight: 0,
  applicableDataPoints: 0,
  totalDataPoints: 1,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getTaskPreviewData', () => {
  it('returns IMAGE artifact data for completeness metric', () => {
    const result = getTaskPreviewData('ignored-task-id', 'completeness', computedMetricResult);

    expect(result).not.toBeNull();

    // Assert artifact shape is IMAGE
    expect(result!.artifactType).toBe('IMAGE');
    expect(result!.artifactContent).toBe(imageFixture.t_preview_image_001.artifact.content);

    // Assert reasoning comes from the completeness assessment
    expect(result!.reasoning).toBe(
      imageFixture.t_preview_image_001.assessments.completeness.reasoning
    );

    // Assert fixture's own taskId is used (not the passed parameter)
    expect(result!.taskId).toBe('t_preview_image_001');

    // Assert metric identity is carried through
    expect(result!.metricKey).toBe('completeness');

    // Assert metricScore/metricState come from the passed metricResult, not the fixture
    expect(result!.metricScore).toBe(COMPUTED_SCORE);
    expect(result!.metricState).toBe('computed');
  });

  it('returns TEXT artifact data for accuracy metric', () => {
    const result = getTaskPreviewData('some-other-id', 'accuracy', computedMetricResult);

    expect(result).not.toBeNull();
    expect(result!.artifactType).toBe('TEXT');
    expect(result!.artifactContent).toBe(textFixture.t_preview_text_001.artifact.content);
    expect(result!.reasoning).toBe(textFixture.t_preview_text_001.assessments.accuracy.reasoning);
    expect(result!.taskId).toBe('t_preview_text_001');
    expect(result!.metricKey).toBe('accuracy');
  });

  it('returns TABLE artifact data for spag metric', () => {
    const result = getTaskPreviewData('', 'spag', computedMetricResult);

    expect(result).not.toBeNull();
    expect(result!.artifactType).toBe('TABLE');
    expect(result!.artifactContent).toBe(tableFixture.t_preview_table_001.artifact.content);
    expect(result!.reasoning).toBe(tableFixture.t_preview_table_001.assessments.spag.reasoning);
    expect(result!.taskId).toBe('t_preview_table_001');
    expect(result!.metricKey).toBe('spag');
  });

  it('preserves metricScore and metricState from the input MetricResult', () => {
    // Computed result — value preserved as number
    const computedResult = getTaskPreviewData('task-1', 'completeness', computedMetricResult);
    expect(computedResult!.metricScore).toBe(COMPUTED_SCORE);
    expect(computedResult!.metricState).toBe('computed');

    // Not-attempted result — value preserved as 'N'
    const notAttemptedResult = getTaskPreviewData('task-2', 'accuracy', notAttemptedMetricResult);
    expect(notAttemptedResult!.metricScore).toBe('N');
    expect(notAttemptedResult!.metricState).toBe('notAttempted');
  });
});
