import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';

import { TaskPreviewCard, type TaskPreviewData } from './TaskPreviewCard';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';

const COMPUTED_SCORE = 5;
const PREVIEW_DATA = {
  taskId: 'task-preview-status',
  artifactType: 'TEXT',
  artifactContent: 'Student response',
  metricKey: 'completeness',
  metricState: 'computed',
  metricScore: COMPUTED_SCORE,
  reasoning: 'Reasoning for the current score',
} satisfies TaskPreviewData;

describe('TaskPreviewCard live header status', () => {
  it('announces the pinned metric label and score through a polite status region', () => {
    renderWithFrontendProviders(<TaskPreviewCard data={PREVIEW_DATA} />);

    const metricLabel = screen.getByText('Completeness:');
    const status = metricLabel.closest('[role="status"]');

    expect(status).not.toBeNull();
    if (!(status instanceof HTMLElement)) {
      throw new TypeError('Expected the TaskPreviewCard header to expose a status region.');
    }
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(within(status).getByText('Completeness:')).toBeInTheDocument();
    expect(within(status).getByText(String(COMPUTED_SCORE))).toBeInTheDocument();
  });
});
