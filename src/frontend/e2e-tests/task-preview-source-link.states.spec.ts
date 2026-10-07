/**
 * Playwright unavailable-source state walkthrough for the issue #19 task-preview
 * source link.
 *
 * Where `task-preview-source-link.spec.ts` proves the action's *interaction and
 * navigation*, this spec proves the state around it: a ready record whose
 * artefact and parent submission both lack a usable document renders no source
 * action and no disabled placeholder.
 *
 * @remarks
 * Vitest owns loading, error and deferred-readiness focus behaviour. Playwright
 * owns unavailable-source rendering and the companion spec's browser navigation.
 *
 * @see TASK_PREVIEW_SOURCE_LINK_LAYOUT.md
 * @see docs/developer/frontend/frontend-playwright-e2e.md — runtime mocks, StrictMode rule
 */

import { expect, test } from '@playwright/test';
import {
  hoverCanonicalCell,
  sourceDocumentAction,
} from './helpers/task-preview-source-link-helpers';
import { createEmbeddedAssignmentQueue } from './helpers/task-preview-source-link-scenarios';
import {
  CANONICAL_SLIDES_ASSIGNMENT,
  withSourceLocationOverride,
} from './helpers/task-preview-source-link-fixtures';
import { deriveSourceLinkCell } from './helpers/task-preview-source-link-expectations';

// ---------------------------------------------------------------------------
// Unavailable source state
// ---------------------------------------------------------------------------

test.describe('Task preview source link — unavailable source state', () => {
  test('offers no action when neither the artefact nor the parent has a document', async ({
    page,
  }) => {
    const noSource = withSourceLocationOverride(CANONICAL_SLIDES_ASSIGNMENT, {
      artifactDocumentId: null,
      parentDocumentId: null,
    });
    const cell = deriveSourceLinkCell(noSource);
    expect(cell.expectedSourceUrl).toBeNull();

    const popover = await hoverCanonicalCell(
      page,
      createEmbeddedAssignmentQueue({ journeyAssignment: noSource }),
      cell
    );

    // A ready card with no usable source renders no action and no placeholder.
    await expect(popover.getByText(cell.artifactContent, { exact: true })).toHaveCount(1);
    await expect(sourceDocumentAction(popover)).toHaveCount(0);
  });
});
