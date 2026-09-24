import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { TaskHeatmapTable } from './TaskHeatmapTable';
import {
  buildNoSubmissionsResult,
  buildZeroTasksResult,
} from '../../test/taskHeatmapTableTestHelpers';

afterEach(() => {
  cleanup();
});

describe('TaskHeatmapTable submission status', () => {
  it('announces the no-submissions caption through a polite status region', () => {
    render(
      <TaskHeatmapTable
        heatmapResult={buildNoSubmissionsResult()}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    const caption = screen.getByText('No submissions yet');
    const status = caption.closest('[role="status"]');

    expect(status).not.toBeNull();
    if (!(status instanceof HTMLElement)) {
      throw new TypeError('Expected the no-submissions caption to expose a status region.');
    }
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('No submissions yet');
  });

  it('does not announce a no-submissions status when the heatmap has no task columns', () => {
    render(
      <TaskHeatmapTable
        heatmapResult={buildZeroTasksResult()}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    expect(screen.queryByText('No submissions yet')).not.toBeInTheDocument();
  });
});
