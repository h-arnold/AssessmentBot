import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';

import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import {
  createComputedMetricResult,
  createErrorMetricResult,
} from '../../test/dataAnalysis/fixtures';
import { NOT_ATTEMPTED_METRIC } from '../../services/dataAnalysis/heatmapAdapter';
import type { TaskDisplayMetric } from '../../services/dataAnalysis/dataAnalysis.zod';
import { TaskPreviewCard, type TaskPreviewData } from './TaskPreviewCard';

const STATUS_NAME_PREFIX = 'Completeness score: ';
const COMPUTED_SCORE = 5;
const FRACTIONAL_COMPUTED_SCORE = 2.5;
const ZERO_DECIMAL_COMPUTED_SCORE = '3';

/** A schema-valid error task-display metric. */
const ERROR_METRIC = createErrorMetricResult();

/** Task-display metrics whose display value is a non-numeric literal. */
const NON_COMPUTED_PREVIEW_METRICS: ReadonlyArray<TaskDisplayMetric> = [
  NOT_ATTEMPTED_METRIC,
  ERROR_METRIC,
];

const PREVIEW_DATA = {
  taskId: 'task-preview-status',
  artifactType: 'TEXT',
  artifactContent: 'Student response',
  metricKey: 'completeness',
  metric: createComputedMetricResult({ value: COMPUTED_SCORE }),
  reasoning: 'Reasoning for the current score',
} satisfies TaskPreviewData;

describe('TaskPreviewCard live header status', () => {
  it('announces the pinned metric label and score through a polite status region', () => {
    renderWithFrontendProviders(<TaskPreviewCard data={PREVIEW_DATA} />);

    const status = screen.getByRole('status', {
      name: `${STATUS_NAME_PREFIX}${COMPUTED_SCORE}`,
    });

    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(within(status).getByText('Completeness:')).toBeInTheDocument();
    expect(within(status).getByText(String(COMPUTED_SCORE))).toBeInTheDocument();
  });

  it('announces a fractional computed score using its visible zero-decimal pill text', () => {
    const fractionalData = {
      ...PREVIEW_DATA,
      metric: createComputedMetricResult({ value: FRACTIONAL_COMPUTED_SCORE }),
    } satisfies TaskPreviewData;

    renderWithFrontendProviders(<TaskPreviewCard data={fractionalData} />);

    const status = screen.getByRole('status');
    const visibleScore = within(status).getByText(ZERO_DECIMAL_COMPUTED_SCORE);

    expect(status).toHaveAccessibleName(`${STATUS_NAME_PREFIX}${visibleScore.textContent}`);
  });

  it.each(NON_COMPUTED_PREVIEW_METRICS)(
    'preserves the $value status label for the $state state',
    (metric) => {
      const data = { ...PREVIEW_DATA, metric } satisfies TaskPreviewData;

      renderWithFrontendProviders(<TaskPreviewCard data={data} />);

      const status = screen.getByRole('status', {
        name: `${STATUS_NAME_PREFIX}${metric.value}`,
      });

      expect(within(status).getByText(String(metric.value))).toBeInTheDocument();
    }
  );
});
