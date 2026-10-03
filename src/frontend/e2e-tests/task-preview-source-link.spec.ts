/**
 * Playwright interaction and navigation walkthroughs for the issue #19
 * task-preview source link.
 *
 * The specs walk both entry points a teacher uses — the embedded class-assignment
 * heatmap and the standalone/merged Heatmaps table — and verify what a user can
 * actually see and do: pointer traversal onto the action, its tooltip, the exact
 * outgoing editor URL in a new tab, the link's own keyboard journey, and the
 * source-URL boundary variants.
 *
 * @remarks
 * Every Google Docs request is fulfilled by a context-wide route registered
 * before navigation, so new-tab behaviour is verified without live Google
 * access. Mocked `getAssignment` payloads carry only stored transport metadata;
 * the expected editor URLs are derived from those raw records.
 *
 * **Scope.** This spec covers the action that exists: pointer and keyboard
 * activation, its tooltip, its outgoing navigation and the URL shapes it must
 * resolve. The states around the action — a preview that is still loading, one
 * that failed, one whose record offers no source, and the focus session a
 * keyboard user is left in — live in
 * `task-preview-source-link.states.spec.ts`, so each spec stays readable and
 * below the module-size gate.
 *
 * Section 4 was authored red-first, before the Section 3 UI delivered the
 * source action and its focus ownership; that provenance is why the suite pins
 * their presence rather than assuming them. The suite now pins the delivered
 * behaviour, and any failure must be a genuine behaviour failure, never a
 * navigation, schema or queue artefact. Actual visual and geometry sign-off
 * remains pending the Section 4 visual review.
 *
 * @see TASK_PREVIEW_SOURCE_LINK_LAYOUT.md
 * @see docs/developer/frontend/frontend-playwright-e2e.md — runtime mocks, StrictMode rule
 */

import { expect, test } from '@playwright/test';
import { getMethodCalls } from './shared/endToEndRuntimeMocks';
import {
  GOOGLE_DOCS_STUB_TEXT,
  captureSourceNavigation,
  metricTrigger,
  openPreviewPopover,
  sourceDocumentAction,
  visibleTooltip,
} from './helpers/task-preview-source-link-helpers';
import {
  enterEmbeddedJourney,
  enterMergedJourney,
  hoverCanonicalCell,
  hoverPreview,
  taskMetricCells,
} from './helpers/task-preview-source-link-journeys';
import {
  createEmbeddedAssignmentQueue,
  createMergedAssignmentQueue,
} from './helpers/task-preview-source-link-scenarios';
import {
  CANONICAL_SLIDES_ASSIGNMENT,
  HEATMAP_TABLE_NAME,
  SOURCE_DOCUMENT_ACTION_LABEL,
  withNumericSheetsPageId,
  withSourceLocationOverride,
} from './helpers/task-preview-source-link-fixtures';
import {
  CANONICAL_SHEETS_CELL,
  CANONICAL_SLIDES_CELL,
  deriveSourceLinkCell,
  requireReadyCell,
} from './helpers/task-preview-source-link-expectations';
import { measureStablePreviewHeader } from './helpers/task-preview-source-link-geometry';
import { HEATMAP_METRIC_KEYS } from '../src/services/dataAnalysis/metricDisplay/metricDisplayMeta';

// ---------------------------------------------------------------------------
// Journey cells
// ---------------------------------------------------------------------------

/** Ready Slides preview cell of the canonical Slides assignment. */
const slidesCell = CANONICAL_SLIDES_CELL;

/** Ready Sheets preview cell of the canonical Sheets assignment. */
const sheetsCell = CANONICAL_SHEETS_CELL;

// ---------------------------------------------------------------------------
// Pointer interaction
// ---------------------------------------------------------------------------

test.describe('Task preview source link — pointer interaction', () => {
  test('traverses onto the Slides action and opens the exact editor URL', async ({ page }) => {
    await enterEmbeddedJourney(page);

    const trigger = metricTrigger(page, slidesCell.cellAccessibleLabel);
    await expect(trigger).toHaveCount(1);
    const callsBeforePreview = await getMethodCalls(page);

    const popover = await hoverPreview(page, trigger);

    // Opening a preview is a pure client read: no backend method may be called.
    expect(await getMethodCalls(page)).toEqual(callsBeforePreview);
    await expect(popover.getByText(slidesCell.artifactContent, { exact: true })).toHaveCount(1);

    const action = sourceDocumentAction(popover);
    await expect(action).toBeVisible();
    await expect(action).toHaveAttribute('target', '_blank');
    await expect(action).toHaveAttribute('rel', /noopener/);
    await expect(action).toHaveAttribute('rel', /noreferrer/);
    await expect(action).toHaveAttribute('href', slidesCell.expectedSourceUrl);

    // Wait for the settled ready-header geometry before the pointer leaves the
    // trigger: the Popover's `zoom-big` entrance transform otherwise moves the
    // action under the cursor mid-transition, the pointer never settles on it,
    // and rc-trigger hides the preview before any tooltip can open.
    await measureStablePreviewHeader(popover, 'Slides pointer traversal');

    // Traversing onto the action keeps the popover usable and never hands
    // keyboard focus to the action.
    await action.hover();
    await expect(popover).toBeVisible();
    await expect(visibleTooltip(page)).toHaveText(SOURCE_DOCUMENT_ACTION_LABEL);
    await expect(action).not.toBeFocused();

    const navigation = await captureSourceNavigation(page, async () => action.click());

    expect(navigation.url).toBe(slidesCell.expectedSourceUrl);
    expect(navigation.stubContent).toBe(GOOGLE_DOCS_STUB_TEXT);
    // Chromium's native anchor click activation focuses the link itself; the
    // contract forbids the hover opening that focus theft, not the click's own
    // native focus. Assert the true native behaviour directly.
    await expect(action).toBeFocused();
    // The original view survives the new-tab navigation untouched.
    await expect(page.getByRole('table', { name: HEATMAP_TABLE_NAME })).toBeVisible();
    await expect(metricTrigger(page, slidesCell.cellAccessibleLabel)).toHaveCount(1);
    expect(await getMethodCalls(page)).toEqual(callsBeforePreview);
  });

  test('opens the Sheets editor URL with its gid fragment from the merged table', async ({
    page,
  }) => {
    await enterMergedJourney(page, createMergedAssignmentQueue());

    // Merged first-wins selection keeps each cell's own source, so the cell of
    // the second selected assignment resolves to the Sheets document.
    const trigger = metricTrigger(page, sheetsCell.cellAccessibleLabel);
    await expect(trigger).toHaveCount(1);
    const callsBeforePreview = await getMethodCalls(page);

    const popover = await hoverPreview(page, trigger);
    expect(await getMethodCalls(page)).toEqual(callsBeforePreview);

    const action = sourceDocumentAction(popover);
    expect(sheetsCell.expectedSourceUrl).toContain('#gid=');
    await expect(action).toBeVisible();
    await expect(action).toHaveAttribute('target', '_blank');
    await expect(action).toHaveAttribute('rel', /noopener/);
    await expect(action).toHaveAttribute('rel', /noreferrer/);
    await expect(action).toHaveAttribute('href', sheetsCell.expectedSourceUrl);

    const navigation = await captureSourceNavigation(page, async () => action.click());

    expect(navigation.url).toBe(sheetsCell.expectedSourceUrl);
    expect(navigation.stubContent).toBe(GOOGLE_DOCS_STUB_TEXT);
    await expect(page.getByRole('table', { name: HEATMAP_TABLE_NAME })).toBeVisible();
    expect(await getMethodCalls(page)).toEqual(callsBeforePreview);
  });
});

// ---------------------------------------------------------------------------
// Keyboard interaction
// ---------------------------------------------------------------------------

test.describe('Task preview source link — keyboard interaction', () => {
  test('Enter on a metric cell opens the preview and focuses its source link', async ({ page }) => {
    await enterEmbeddedJourney(page);

    const trigger = metricTrigger(page, slidesCell.cellAccessibleLabel);
    await trigger.focus();
    await expect(trigger).toBeFocused();

    await page.keyboard.press('Enter');

    const popover = openPreviewPopover(page);
    await expect(popover).toBeVisible();
    await expect(sourceDocumentAction(popover)).toBeFocused();
    await expect(visibleTooltip(page)).toHaveText(SOURCE_DOCUMENT_ACTION_LABEL);
  });

  test('Space opens the preview and focuses the link, which Enter then activates', async ({
    page,
  }) => {
    await enterEmbeddedJourney(page);

    const trigger = metricTrigger(page, slidesCell.cellAccessibleLabel);
    await trigger.focus();
    await page.keyboard.press(' ');

    const popover = openPreviewPopover(page);
    await expect(popover).toBeVisible();
    await expect(sourceDocumentAction(popover)).toBeFocused();

    // Enter on the native link performs the browser's own new-tab navigation.
    const navigation = await captureSourceNavigation(page, async () =>
      page.keyboard.press('Enter')
    );
    expect(navigation.url).toBe(slidesCell.expectedSourceUrl);
  });

  test('Escape inside the open preview closes it and restores focus to the cell', async ({
    page,
  }) => {
    await enterEmbeddedJourney(page);

    const trigger = metricTrigger(page, slidesCell.cellAccessibleLabel);
    await trigger.focus();
    await page.keyboard.press('Enter');

    const popover = openPreviewPopover(page);
    await expect(sourceDocumentAction(popover)).toBeFocused();

    await page.keyboard.press('Escape');

    await expect(openPreviewPopover(page)).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('ordinary Tab and Shift+Tab move between metric cells without a focus trap', async ({
    page,
  }) => {
    await enterEmbeddedJourney(page);

    const cells = taskMetricCells(page, slidesCell);
    await expect(cells).toHaveCount(HEATMAP_METRIC_KEYS.length);
    const trigger = cells.first();
    await trigger.focus();

    await page.keyboard.press('Tab');
    // Tab continued into the next metric sub-column instead of being trapped
    // inside the open preview.
    await expect(cells.nth(1)).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(trigger).toBeFocused();
  });
});

// ---------------------------------------------------------------------------
// Source URL boundaries
// ---------------------------------------------------------------------------

test.describe('Task preview source link — source URL boundaries', () => {
  test('links the document root without a fragment when the page is unknown', async ({ page }) => {
    const rootFallback = withSourceLocationOverride(CANONICAL_SLIDES_ASSIGNMENT, {
      artifactPageId: null,
    });
    const cell = requireReadyCell(deriveSourceLinkCell(rootFallback));
    expect(cell.expectedSourceUrl).not.toContain('#');

    const popover = await hoverCanonicalCell(
      page,
      createEmbeddedAssignmentQueue({ journeyAssignment: rootFallback }),
      cell
    );

    const action = sourceDocumentAction(popover);
    await expect(action).toBeVisible();
    await expect(action).toHaveAttribute('href', cell.expectedSourceUrl);
  });

  test('falls back to the parent submission document when the artefact has none', async ({
    page,
  }) => {
    const parentFallback = withSourceLocationOverride(CANONICAL_SLIDES_ASSIGNMENT, {
      artifactDocumentId: null,
    });
    const cell = requireReadyCell(deriveSourceLinkCell(parentFallback));
    // The parent document differs from the artefact's own stored document, so
    // the resolved URL must differ from the canonical artefact-based URL.
    expect(cell.expectedSourceUrl).not.toBe(slidesCell.expectedSourceUrl);

    const popover = await hoverCanonicalCell(
      page,
      createEmbeddedAssignmentQueue({ journeyAssignment: parentFallback }),
      cell
    );

    const action = sourceDocumentAction(popover);
    await expect(action).toBeVisible();
    await expect(action).toHaveAttribute('href', cell.expectedSourceUrl);
  });

  test('keeps a valid numeric Sheets gid in the link fragment', async ({ page }) => {
    const numericGid = withNumericSheetsPageId();
    const cell = requireReadyCell(deriveSourceLinkCell(numericGid));
    expect(cell.expectedSourceUrl).toContain('#gid=0');

    await enterMergedJourney(page, createMergedAssignmentQueue({ sheetsAssignment: numericGid }));
    const popover = await hoverPreview(page, metricTrigger(page, cell.cellAccessibleLabel));

    const action = sourceDocumentAction(popover);
    await expect(action).toBeVisible();
    await expect(action).toHaveAttribute('href', cell.expectedSourceUrl);
  });
});
