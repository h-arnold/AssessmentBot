/**
 * Playwright unavailable-source state walkthrough for the issue #19 task-preview
 * source link.
 *
 * Where `task-preview-source-link.spec.ts` proves the action's *interaction and
 * navigation*, this spec proves the state around it: a canonical acquisition-E
 * record whose artefact and parent submission both lack a usable document
 * renders no source action and no disabled placeholder.
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
  withUnreadableSubmissionSource,
} from './helpers/task-preview-source-link-fixtures';
import {
  deriveSourceLinkCell,
  deriveUnavailableSourceLinkCell,
} from './helpers/task-preview-source-link-expectations';

// ---------------------------------------------------------------------------
// Unavailable source state
// ---------------------------------------------------------------------------

test.describe('Task preview source link — unavailable source state', () => {
  test('offers no action when neither the artefact nor the parent has a document', async ({
    page,
  }) => {
    const noSource = withUnreadableSubmissionSource(CANONICAL_SLIDES_ASSIGNMENT);
    // The healthy canonical record supplies the same student/task cell identity;
    // the served acquisition record deliberately contains no ready response body.
    const cell = deriveSourceLinkCell(CANONICAL_SLIDES_ASSIGNMENT);
    expect(deriveUnavailableSourceLinkCell(noSource).expectedSourceUrl).toBeNull();

    const popover = await hoverCanonicalCell(
      page,
      createEmbeddedAssignmentQueue({ journeyAssignment: noSource }),
      cell
    );

    // Source-less acquisition E has no stale ready body, source action, or placeholder.
    await expect(sourceDocumentAction(popover)).toHaveCount(0);
    await expect(popover.getByRole('link')).toHaveCount(0);
    await expect(popover.getByRole('button', { disabled: true })).toHaveCount(0);
    await expect(popover.getByText(cell.artifactContent, { exact: true })).toHaveCount(0);
  });
});
