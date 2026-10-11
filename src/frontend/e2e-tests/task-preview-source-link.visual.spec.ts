/**
 * Playwright geometry and visual-coverage spec for the issue #19 task-preview
 * source link.
 *
 * Where `task-preview-source-link.spec.ts` proves what the action *does*, this
 * spec proves where the browser actually *paints* it: measured sizes, whole-card
 * metric centring, vertical alignment, the Card's right inset, non-overlap and
 * viewport containment — across both entry points, both themes and both
 * viewports, over long/short metric labels, every metric state, and all three
 * body renderers.
 *
 * @remarks
 * **Region selectors expected from the source-link UI.** Region resolution and
 * reading live in `task-preview-header-regions.ts`. Regions resolve through antd
 * Card semantic classes and accessible names, so only one genuinely new
 * project-owned region is required — the header's left balancing space, which
 * carries the `task-preview-header-balance` test id somewhere in
 * `.ant-card-head`. The action itself is located by its accessible name,
 * `Open source document (opens in a new tab)`, and must live in the Card `extra`
 * region. Both regions are matched as header *descendants*, because antd nests
 * `extra` inside `.ant-card-head-wrapper`: asserting a direct-child relationship
 * would demand markup antd does not produce. The action's icon is the `svg`
 * inside that action. Measurement never falls back to DOM order, SVG attributes
 * or CSS declarations — only `getBoundingClientRect()` values count, read once
 * settled (see `task-preview-source-link-geometry.ts`).
 *
 * Screenshots are captured as review evidence into Playwright's untracked
 * per-test output directory.
 *
 * **Narrow-viewport journey.** At 390x844 the heatmap's sticky Forename/Surname
 * columns are wider than the table's remaining visible strip, so they cover every
 * metric cell and the pointer physically cannot enter one. Those cases therefore
 * open the preview with the keyboard — the real journey at that size — while the
 * desktop cases keep the pointer journey. Recorded rather than worked around: the
 * pointer-reachability limit is a property of the existing table, not of this
 * feature.
 *
 * **Long metric label.** Metric labels are fixed production display metadata
 * (`METRIC_DISPLAY_META`), not test data, so no synthetic longer label is
 * invented. The longest rendered label (`Completeness`) is the canonical
 * widest-label case, the two shorter labels are covered alongside it, and the
 * narrow viewport supplies the least horizontal room the header ever has.
 *
 * **Closed-page overflow baseline.** Layout invariant 6 forbids *new* horizontal
 * overflow, so every journey here reads the page's `scrollWidth` with no preview
 * open — after the page itself has settled — and hands that baseline to
 * `assertReadyPreviewGeometry`. A baseline taken with a preview already open
 * absorbs the very overflow the invariant exists to catch, so
 * `readClosedPageOverflowWidth` fails loudly rather than returning one. Where a
 * journey opens several previews in a row, `rebaselineClosedPage` closes the
 * open one and re-reads instead of reusing an earlier reading.
 *
 * @see TASK_PREVIEW_SOURCE_LINK_LAYOUT.md — acceptance evidence
 * @see docs/developer/frontend/frontend-playwright-e2e.md
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import { installRuntimeMock } from './shared/endToEndRuntimeMocks';
import {
  type ControlActivation,
  metricTrigger,
  openEmbeddedHeatmap,
  openMergedHeatmap,
  openPreviewPopover,
  revealMetricCellForPointer,
  setColourScheme,
  sourceDocumentAction,
  taskMetricCells,
} from './helpers/task-preview-source-link-helpers';
import {
  createEmbeddedAssignmentQueue,
  createMergedAssignmentQueue,
  createSourceLinkScenario,
} from './helpers/task-preview-source-link-scenarios';
import {
  assertReadyPreviewGeometry,
  readClosedPageOverflowWidth,
  rebaselineClosedPageOverflow,
} from './helpers/task-preview-source-link-geometry';
import {
  CANONICAL_SLIDES_ASSIGNMENT,
  HEATMAP_TABLE_NAME,
  withArtifactBody,
  type SourceLinkBodyKind,
} from './helpers/task-preview-source-link-fixtures';
import {
  CANONICAL_SLIDES_CELL,
  deriveSourceLinkBodySelection,
} from './helpers/task-preview-source-link-expectations';
import { HEATMAP_METRIC_KEYS } from '../src/services/dataAnalysis/metricDisplay/metricDisplayMeta';
import { PREVIEW_HEADER_REGION_SELECTORS } from './helpers/task-preview-header-regions';

// ---------------------------------------------------------------------------
// Review matrix
// ---------------------------------------------------------------------------

/**
 * How a matrix case drives a journey at its viewport.
 *
 * `pointer` is a teacher's mouse journey. `keyboard` exists because at the narrow
 * viewport two antd controls have no usable pointer target: the builder's selection
 * bar collapses each select to roughly 21 CSS pixels, and the heatmap's sticky
 * Forename/Surname columns are wider than the table's remaining visible strip, so
 * they cover every metric cell. Both were measured
 * (`.opencode/scratchpad/issue19-sec4-probes/`), and the keyboard is the real user
 * journey at that size.
 */
type PreviewActivation = ControlActivation;

/** One viewport the header geometry must hold at. */
interface ViewportCase {
  /** Matrix label used in every assertion message and screenshot name. */
  readonly key: string;
  readonly width: number;
  readonly height: number;
  /** How the matrix reaches a preview at this viewport. */
  readonly activation: PreviewActivation;
}

/** The viewports the layout document requires. */
const VIEWPORTS: readonly ViewportCase[] = [
  { key: 'desktop 1440x900', width: 1440, height: 900, activation: 'pointer' },
  { key: 'narrow 390x844', width: 390, height: 844, activation: 'keyboard' },
];

/** Both colour schemes the header action must read against. */
const SCHEMES = ['light', 'dark'] as const;

/** Both entry points a teacher opens a task preview from. */
const ENTRY_POINTS = ['embedded Classes', 'standalone Heatmaps'] as const;

/** One entry point of the review matrix. */
type EntryPoint = (typeof ENTRY_POINTS)[number];

/** Ready canonical TEXT cell used as the primary geometry subject. */
const TEXT_CELL = CANONICAL_SLIDES_CELL;

/** Every artefact body the preview card's three renderers must be measured over. */
const BODY_KINDS: readonly SourceLinkBodyKind[] = ['TEXT', 'IMAGE', 'TABLE'];

// ---------------------------------------------------------------------------
// Journeys
// ---------------------------------------------------------------------------

/**
 * Walk one entry point and leave the page ready to open a preview.
 *
 * Order matters: the viewport is set before navigation, the colour scheme is
 * switched before the pointer enters a cell (moving onto the shell switch would
 * close a hover-opened popover), and the page is scrolled right last for the
 * pointer journey only (a no-op where the page already fits, and pointless for
 * the keyboard journey, whose own focus scroll reveals the cell).
 *
 * @remarks
 * The closed-page overflow baseline is read last — once the journey has settled
 * and while no preview exists — and returned for the geometry assertion, because
 * that is the only reading a "no new overflow" comparison may start from.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {Readonly<ViewportCase>} viewport - The viewport under review.
 * @param {EntryPoint} entryPoint - The entry point under review.
 * @param {'light' | 'dark'} scheme - The colour scheme under review.
 * @returns {Promise<number>} The closed-page overflow baseline for this coordinate.
 */
async function enterEntryPoint(
  page: Page,
  viewport: Readonly<ViewportCase>,
  entryPoint: EntryPoint,
  scheme: 'light' | 'dark'
): Promise<number> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await installRuntimeMock(
    page,
    createSourceLinkScenario(
      entryPoint === 'embedded Classes' ? {} : { getAssignment: createMergedAssignmentQueue() }
    )
  );
  await (entryPoint === 'embedded Classes'
    ? openEmbeddedHeatmap(page)
    : openMergedHeatmap(page, { controlActivation: viewport.activation }));
  await expect(page.getByRole('table', { name: HEATMAP_TABLE_NAME })).toBeVisible();
  await setColourScheme(page, scheme);
  if (viewport.activation === 'pointer') {
    await revealMetricCellForPointer(page);
  }
  return await readClosedPageOverflowWidth(page, matrixKey(viewport, entryPoint, scheme));
}

/**
 * Open one metric cell's ready preview and return its popover.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {string} cellAccessibleLabel - The shared cell/trigger accessible label.
 * @param {PreviewActivation} activation - How this matrix case reaches the cell.
 * @returns {Promise<Locator>} The open preview popover.
 */
async function openReadyPreview(
  page: Page,
  cellAccessibleLabel: string,
  activation: PreviewActivation
): Promise<Locator> {
  const trigger = metricTrigger(page, cellAccessibleLabel);
  await expect(trigger).toHaveCount(1);

  if (activation === 'pointer') {
    await trigger.hover();
  } else {
    // `focus()` brings the cell into view inside the table's own scroll
    // container, which is what a teacher on a small screen must use.
    await trigger.focus();
    await page.keyboard.press('Enter');
  }

  const popover = openPreviewPopover(page);
  await expect(popover).toBeVisible();
  return popover;
}

/**
 * Build the matrix coordinate used in messages and screenshot names.
 *
 * @param {Readonly<ViewportCase>} viewport - The viewport under review.
 * @param {EntryPoint} entryPoint - The entry point under review.
 * @param {'light' | 'dark'} scheme - The colour scheme under review.
 * @returns {string} The matrix coordinate.
 */
function matrixKey(
  viewport: Readonly<ViewportCase>,
  entryPoint: EntryPoint,
  scheme: 'light' | 'dark'
): string {
  return `${viewport.key} ${scheme} ${entryPoint}`;
}

// ---------------------------------------------------------------------------
// Ready header geometry: viewport x theme x entry point
// ---------------------------------------------------------------------------

for (const viewport of VIEWPORTS) {
  for (const scheme of SCHEMES) {
    for (const entryPoint of ENTRY_POINTS) {
      test(`holds the ready header geometry at ${matrixKey(viewport, entryPoint, scheme)}`, async ({
        page,
      }) => {
        const description = matrixKey(viewport, entryPoint, scheme);
        const closedPageWidth = await enterEntryPoint(page, viewport, entryPoint, scheme);

        const popover = await openReadyPreview(
          page,
          TEXT_CELL.cellAccessibleLabel,
          viewport.activation
        );
        // The canonical body must still render, so a geometry pass can never be
        // satisfied by a card that dropped its content.
        await expect(popover.getByText(TEXT_CELL.artifactContent, { exact: true })).toHaveCount(1);

        await assertReadyPreviewGeometry(page, popover, description, closedPageWidth);

        await popover.screenshot({
          path: `${test.info().outputDir}/${description.replaceAll(' ', '-')}.png`,
        });
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Metric label and body renderer fold
// ---------------------------------------------------------------------------

test.describe('Metric label geometry (representative coordinate)', () => {
  test('holds the header geometry for every metric label of the canonical task', async ({
    page,
  }) => {
    const description = 'desktop 1440x900 light embedded Classes (all metric labels)';
    let closedPageWidth = await enterEntryPoint(page, VIEWPORTS[0], 'embedded Classes', 'light');

    const cellPrefix = `${TEXT_CELL.studentName}, ${TEXT_CELL.taskTitle}, `;
    const triggers = taskMetricCells(page, TEXT_CELL);
    await expect(triggers).toHaveCount(HEATMAP_METRIC_KEYS.length);
    const labels = await triggers.evaluateAll((cells) =>
      cells.map((cell) => cell.getAttribute('aria-label') ?? '')
    );
    // Every metric label the heatmap can render must be represented, so this
    // cannot quietly collapse into the widest label alone.
    expect(new Set(labels.map((label) => label.slice(cellPrefix.length).split(':')[0])).size).toBe(
      HEATMAP_METRIC_KEYS.length
    );

    // Each iteration is measured against a page at rest, and the preview is
    // closed and re-baselined between iterations.
    for (const label of labels) {
      const popover = await openReadyPreview(page, label, VIEWPORTS[0].activation);
      await assertReadyPreviewGeometry(page, popover, `${description} — ${label}`, closedPageWidth);
      closedPageWidth = await rebaselineClosedPageOverflow(page, description);
    }
  });
});

test.describe('Preview body renderer samples', () => {
  for (const bodyKind of BODY_KINDS) {
    test(`holds the header geometry and captures a ${bodyKind} response body`, async ({ page }) => {
      // TEXT is the canonical body; IMAGE and TABLE reuse the recorded local
      // content exception on a clone of the canonical record.
      const servedRecord = withArtifactBody(CANONICAL_SLIDES_ASSIGNMENT, bodyKind);
      const body = deriveSourceLinkBodySelection(servedRecord);
      expect(body.artifactType, 'the served record carries the requested body type').toBe(bodyKind);

      const description = `desktop 1440x900 light embedded Classes (${bodyKind} body)`;
      await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
      // The derived record is what the browser must render, so it is the record the
      // journey queue serves; the canonical default queue would serve the TEXT body.
      await installRuntimeMock(
        page,
        createSourceLinkScenario({
          getAssignment: createEmbeddedAssignmentQueue({ journeyAssignment: servedRecord }),
        })
      );
      await openEmbeddedHeatmap(page);
      await setColourScheme(page, 'light');
      await revealMetricCellForPointer(page);

      // The journey has settled and nothing is open yet, so this is the one
      // reading the preview below may be compared against.
      const closedPageWidth = await readClosedPageOverflowWidth(page, description);
      const popover = await openReadyPreview(page, body.cellAccessibleLabel, 'pointer');
      if (bodyKind === 'IMAGE') {
        await expect(popover.locator('img')).toHaveCount(1);
      } else if (bodyKind === 'TABLE') {
        await expect(popover.locator('table')).toHaveCount(1);
      } else {
        await expect(popover.getByText(body.artifactContent, { exact: true })).toHaveCount(1);
      }

      await assertReadyPreviewGeometry(page, popover, description, closedPageWidth);
      await popover.screenshot({
        path: `${test.info().outputDir}/${description.replaceAll(' ', '-')}.png`,
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Review screenshot capture
// ---------------------------------------------------------------------------

for (const viewport of VIEWPORTS) {
  for (const scheme of SCHEMES) {
    for (const entryPoint of ENTRY_POINTS) {
      test(`captures normal, hovered and keyboard-focused review screenshots at ${matrixKey(viewport, entryPoint, scheme)}`, async ({
        page,
      }) => {
        const description = `${matrixKey(viewport, entryPoint, scheme)} (keyboard-opened capture)`;
        const closedPageWidth = await enterEntryPoint(page, viewport, entryPoint, scheme);

        // Capture the page as a teacher first sees it, before the page is scrolled
        // to bring the metric cell clear of the sticky name columns.
        await page.screenshot({
          path: `${test.info().outputDir}/${viewport.key.replaceAll(' ', '-')}-${scheme}-${entryPoint.replaceAll(' ', '-')}-page-initial.png`,
        });

        const trigger = metricTrigger(page, TEXT_CELL.cellAccessibleLabel);
        await expect(trigger).toHaveCount(1);
        await trigger.focus();
        await page.keyboard.press('Enter');

        const popover = openPreviewPopover(page);
        await expect(popover).toBeVisible();
        // The keyboard-opened preview is the state a keyboard user sees, so its
        // focused capture is taken first.
        const action = sourceDocumentAction(popover);
        await expect(action).toBeFocused();
        // The measured matrix opens a pointer preview at 1440x900 but a keyboard
        // preview at 390x844, so this keyboard-opened capture only contributes a
        // new measurement at the desktop viewport; at the narrow viewport the
        // matrix has already measured the keyboard journey.
        if (viewport.activation === 'pointer') {
          await assertReadyPreviewGeometry(page, popover, description, closedPageWidth);
        }
        // The card itself is the capture subject: the popover root's box includes
        // placement offsets that `locator.screenshot` clips incorrectly once the
        // overlay overflows the viewport at 390x844, whereas the Card's own box
        // captures the focused action and its focus ring faithfully.
        const card = popover.locator(PREVIEW_HEADER_REGION_SELECTORS.card);
        await expect(card).toHaveCount(1);
        await card.screenshot({
          path: `${test.info().outputDir}/${viewport.key.replaceAll(' ', '-')}-${scheme}-${entryPoint.replaceAll(' ', '-')}-card-keyboard-focused.png`,
        });

        // Tab off the action without dismissing the preview: leaving focus never
        // closes it, so this is the genuinely unfocused card a keyboard user sees
        // after tabbing on, distinct from the focused capture above.
        await page.keyboard.press('Tab');
        await expect(action).not.toBeFocused();
        await expect(popover).toBeVisible();
        await card.screenshot({
          path: `${test.info().outputDir}/${viewport.key.replaceAll(' ', '-')}-${scheme}-${entryPoint.replaceAll(' ', '-')}-card-normal.png`,
        });

        // Hovering the action renders its tooltip; at the narrow viewport the
        // pointer journey is not the real one, so its capture is skipped.
        if (viewport.activation === 'pointer') {
          await action.hover();
          await expect(popover).toBeVisible();
          await card.screenshot({
            path: `${test.info().outputDir}/${viewport.key.replaceAll(' ', '-')}-${scheme}-${entryPoint.replaceAll(' ', '-')}-card-hovered.png`,
          });
        }
      });
    }
  }
}
