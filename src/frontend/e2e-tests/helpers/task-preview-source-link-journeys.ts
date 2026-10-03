/**
 * Journey composition for the issue #19 Section 4 Playwright source-link
 * walkthroughs.
 *
 * @remarks
 * **One responsibility.** Each journey needs three things set up together and in
 * a fixed order — the canonical runtime scenario, the context-wide Google Docs
 * stub route that makes a real navigation impossible, and the entry-point walk
 * itself. Composing them here keeps each spec to its own interactions and stops
 * the two specs from drifting on mock ordering or navigation.
 *
 * The stub route is registered by every journey, including the ones that never
 * open a source document: it is cheap, and it means no journey can reach live
 * Google even if an assertion is later added that activates the action.
 *
 * **Two callers.** The interaction/navigation walkthroughs and the state and
 * focus-session walkthroughs both enter journeys through this module, so the
 * composition is not a single-caller wrapper. The primitives it composes stay
 * put: locators, the raw entry-point walks, the popup capture and the theme and
 * pointer helpers live in `task-preview-source-link-helpers.ts`, and scenario
 * and queue construction in `task-preview-source-link-scenarios.ts`.
 *
 * @see docs/developer/frontend/frontend-playwright-e2e.md
 */

import { expect, type Locator, type Page } from '@playwright/test';
import { installRuntimeMock, type ResponseItem } from '../shared/endToEndRuntimeMocks';
import {
  metricTrigger,
  openEmbeddedHeatmap,
  openMergedHeatmap,
  openPreviewPopover,
  registerStubbedGoogleDocumentRoute,
} from './task-preview-source-link-helpers';
import { createSourceLinkScenario } from './task-preview-source-link-scenarios';

// ---------------------------------------------------------------------------
// Journey entry points
// ---------------------------------------------------------------------------

/**
 * Install the canonical stubs and walk to the embedded class-assignment heatmap.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {ReadonlyArray<ResponseItem>} [queue] - `getAssignment` queue override.
 * @returns {Promise<void>} Resolves once the heatmap table is visible.
 */
export async function enterEmbeddedJourney(
  page: Page,
  queue?: ReadonlyArray<ResponseItem>
): Promise<void> {
  await registerStubbedGoogleDocumentRoute(page.context());
  await installRuntimeMock(
    page,
    createSourceLinkScenario(queue === undefined ? {} : { getAssignment: queue })
  );
  await openEmbeddedHeatmap(page);
}

/**
 * Install the canonical stubs and walk to the standalone merged heatmap.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {ReadonlyArray<ResponseItem>} [queue] - `getAssignment` queue override.
 * @returns {Promise<void>} Resolves once the merged table is visible.
 */
export async function enterMergedJourney(
  page: Page,
  queue: ReadonlyArray<ResponseItem>
): Promise<void> {
  await registerStubbedGoogleDocumentRoute(page.context());
  await installRuntimeMock(page, createSourceLinkScenario({ getAssignment: queue }));
  await openMergedHeatmap(page);
}

// ---------------------------------------------------------------------------
// Preview opening
// ---------------------------------------------------------------------------

/**
 * Hover a metric cell and return its open preview popover.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {Locator} trigger - The metric cell trigger.
 * @returns {Promise<Locator>} The open preview popover.
 */
export async function hoverPreview(page: Page, trigger: Locator): Promise<Locator> {
  await trigger.hover();
  const popover = openPreviewPopover(page);
  await expect(popover).toBeVisible();
  return popover;
}

/**
 * Open the canonical embedded preview for one derived cell with the pointer.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {ReadonlyArray<ResponseItem>} queue - The `getAssignment` queue to serve.
 * @param {Readonly<{ cellAccessibleLabel: string }>} cell - The cell to open.
 * @returns {Promise<Locator>} The open preview popover.
 */
export async function hoverCanonicalCell(
  page: Page,
  queue: ReadonlyArray<ResponseItem>,
  cell: Readonly<{ cellAccessibleLabel: string }>
): Promise<Locator> {
  await enterEmbeddedJourney(page, queue);
  return await hoverPreview(page, metricTrigger(page, cell.cellAccessibleLabel));
}

/**
 * Return every metric sub-column trigger of one student's task group.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {Readonly<{ studentName: string; taskTitle: string }>} cell - The cell selection.
 * @returns {Locator} The task group's metric sub-column triggers.
 */
export function taskMetricCells(
  page: Page,
  cell: Readonly<{ studentName: string; taskTitle: string }>
): Locator {
  return page.locator(`[role="button"][aria-label^="${cell.studentName}, ${cell.taskTitle},"]`);
}
