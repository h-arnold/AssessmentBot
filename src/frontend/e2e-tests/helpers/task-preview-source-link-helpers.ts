/**
 * Locators, navigation, external navigation capture and viewport helpers for the
 * issue #19 task-preview source-link walkthroughs.
 *
 * @remarks
 * This module owns everything that *drives* a journey: the locators the specs
 * assert through, both entry-point walks, the context-wide Google Docs stub route
 * that makes new-tab behaviour verifiable without live Google access, and the
 * colour-scheme and pointer-reachability helpers.
 *
 * Scenario and queue construction lives in the sibling
 * `task-preview-source-link-scenarios.ts`; canonical record selection in
 * `task-preview-source-link-fixtures.ts`; derived URLs and cell selections in
 * `task-preview-source-link-expectations.ts`.
 */

import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import {
  installRuntimeMock,
  selectVisibleOption,
  type ResponseItem,
} from '../shared/endToEndRuntimeMocks';
import { pageContent } from '../../src/pages/pageContent';
import {
  HEATMAP_TABLE_NAME,
  SHEETS_ASSIGNMENT_TITLE,
  SLIDES_ASSIGNMENT_TITLE,
  SOURCE_LINK_CLASS_NAME,
} from './task-preview-source-link-fixtures';
import { SOURCE_ACTION_LABEL } from '../../src/features/taskHeatmap/TaskPreviewCard';
import { createSourceLinkScenario } from './task-preview-source-link-scenarios';

// ---------------------------------------------------------------------------
// Shared journey labels
// ---------------------------------------------------------------------------

/** Shell menu label for the Classes entry in the application sidebar. */
export const CLASSES_LABEL = 'Classes';

/** Shell menu label for the standalone Heatmaps entry. */
export const HEATMAPS_LABEL = pageContent.heatmaps.heading;

/** Accessible name of the shell's colour-scheme switch. */
const DARK_MODE_SWITCH_NAME = 'Dark mode';

/** Every Google Docs request the source action may open. */
const GOOGLE_DOCS_ROUTE_PATTERN = 'https://docs.google.com/**';

/** Stable element id of the stub content, asserted to prove local fulfilment. */
const GOOGLE_DOCS_STUB_MARKER = 'source-link-stub';

/**
 * Text the stubbed document announces.
 *
 * Exported so a spec asserts a captured popup against the text the route
 * actually fulfils, rather than restating the stub body in two modules.
 */
export const GOOGLE_DOCS_STUB_TEXT = 'Stubbed source document';

/** Harmless content served instead of a real Google document. */
const GOOGLE_DOCS_STUB_BODY = `<p id="${GOOGLE_DOCS_STUB_MARKER}">${GOOGLE_DOCS_STUB_TEXT}</p>`;

// Heatmaps builder combobox order: class, topics, assignments.
const HEATMAPS_CLASS_COMBOBOX_INDEX = 0;
const HEATMAPS_ASSIGNMENTS_COMBOBOX_INDEX = 2;

// ---------------------------------------------------------------------------
// Locators
// ---------------------------------------------------------------------------

/**
 * Return the popover trigger of one metric cell.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {string} cellAccessibleLabel - The shared cell/trigger accessible label.
 * @returns {Locator} The native `<button>` trigger locator.
 */
export function metricTrigger(page: Page, cellAccessibleLabel: string): Locator {
  return page.getByRole('button', { name: cellAccessibleLabel });
}

/**
 * Return the single open preview popover.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Locator} The visible popover locator.
 */
export function openPreviewPopover(page: Page): Locator {
  return page.locator('.ant-popover:not(.ant-popover-hidden)').last();
}

/**
 * Return the source action inside a preview popover.
 *
 * @param {Locator} container - The popover locator.
 * @returns {Locator} The accessible source-action link locator.
 */
export function sourceDocumentAction(container: Locator): Locator {
  return container.getByRole('link', { name: SOURCE_ACTION_LABEL });
}

/**
 * Return the tooltip the source action shows on hover and on focus.
 *
 * @remarks
 * The metric sub-column headers keep their own antd tooltips in the DOM, so the
 * newest visible tooltip is the one the action most recently opened.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Locator} The visible tooltip locator.
 */
export function visibleTooltip(page: Page): Locator {
  return page.locator('.ant-tooltip:not(.ant-tooltip-hidden)').last();
}

// ---------------------------------------------------------------------------
// External navigation capture
// ---------------------------------------------------------------------------

/**
 * Register a context-wide Google Docs route fulfilled with harmless content.
 *
 * @remarks
 * `page.route` cannot intercept the first request of a popup page, so the route
 * is registered on the browser context before navigation. Every document request
 * is therefore served locally and no live Google access can occur.
 *
 * @param {BrowserContext} context - The Playwright browser context under test.
 * @returns {Promise<void>} Resolves once the route is installed.
 */
async function registerStubbedGoogleDocumentRoute(context: BrowserContext): Promise<void> {
  await context.route(GOOGLE_DOCS_ROUTE_PATTERN, async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: GOOGLE_DOCS_STUB_BODY });
  });
}

/**
 * Activate the source action and capture the URL of the new tab it opens.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {() => Promise<void>} activate - Pointer click or `Enter` key press.
 * @returns {Promise<{ url: string; stubContent: string }>} The captured navigation.
 */
export async function captureSourceNavigation(
  page: Page,
  activate: () => Promise<void>
): Promise<{ url: string; stubContent: string }> {
  const popupPromise = page.waitForEvent('popup');
  await activate();
  const popup = await popupPromise;
  await popup.waitForLoadState();

  const url = popup.url();
  const stubContent = await popup.locator(`#${GOOGLE_DOCS_STUB_MARKER}`).textContent();
  await popup.close();

  if (stubContent == null) {
    throw new Error(
      `The stubbed Google document served no #${GOOGLE_DOCS_STUB_MARKER} content, so the request was not fulfilled locally.`
    );
  }

  return { url, stubContent };
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * Navigate root → Classes → the canonical class overview (Recent Assignments).
 *
 * @remarks
 * Mocks must already be installed before calling this.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<void>} Resolves once Recent Assignments is visible.
 */
async function openCanonicalClassOverview(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

  const classCard = page.getByRole('article').filter({ hasText: SOURCE_LINK_CLASS_NAME });
  await expect(classCard).toBeVisible();
  await classCard.getByRole('button', { name: 'View' }).click();
  await expect(page.getByText('Recent Assignments')).toBeVisible();
}

/**
 * Navigate root → Classes → canonical class → embedded heatmap table.
 *
 * @remarks
 * Mocks must already be installed before calling this.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {string} [assignmentTitle] - Recent-assignment card title to open.
 * @returns {Promise<void>} Resolves once the heatmap table is visible.
 */
export async function openEmbeddedHeatmap(
  page: Page,
  assignmentTitle: string = SLIDES_ASSIGNMENT_TITLE
): Promise<void> {
  await openCanonicalClassOverview(page);
  await page.getByRole('button').filter({ hasText: assignmentTitle }).click();
  await expect(page.getByRole('table', { name: HEATMAP_TABLE_NAME })).toBeVisible();
}

/**
 * How a journey drives an antd control that has no usable pointer target at some
 * viewport widths.
 *
 * @remarks
 * At 390x844 the Heatmaps builder's selection bar collapses each select to roughly
 * 21 CSS pixels, so the search input has no painted area and the dropdown inherits
 * that width: a pointer click on either the select or one of its options is
 * impossible. Focusing a control requires no painted area, so the keyboard journey
 * still works at that width, and it is the journey a teacher actually has there.
 */
export type ControlActivation = 'pointer' | 'keyboard';

/**
 * Choose one option in a Heatmaps builder select.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {number} controlIndex - Index of the select in the builder's control row.
 * @param {string} optionLabel - The visible option label to choose.
 * @param {ControlActivation} activation - How the select is driven.
 * @returns {Promise<void>} Resolves once the option is selected.
 */
async function selectBuilderOption(
  page: Page,
  controlIndex: number,
  optionLabel: string,
  activation: ControlActivation
): Promise<void> {
  const control = page.getByRole('combobox').nth(controlIndex);

  if (activation === 'pointer') {
    await control.click();
    await selectVisibleOption(page, optionLabel);
    return;
  }

  await control.focus();
  await page.keyboard.type(optionLabel);
  // antd auto-highlights the single match while filtering, so the active state on
  // the option *item* is the honest precondition for committing it with Enter.
  await expect(
    page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
      .locator('.ant-select-item', { has: page.getByText(optionLabel, { exact: true }) })
      .first()
  ).toHaveClass(/ant-select-item-option-active/);
  await page.keyboard.press('Enter');
}

/** Options for the standalone merged Heatmaps journey. */
interface OpenMergedHeatmapOptions {
  /** Option labels to select, in selection order (default: both canonical titles). */
  readonly assignmentTitles?: readonly string[];
  /** How the builder's selects are driven (default: `pointer`). */
  readonly controlActivation?: ControlActivation;
}

/**
 * Navigate root → Heatmaps → canonical class and assignments → merged table.
 *
 * @remarks
 * Mocks must already be installed before calling this.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {OpenMergedHeatmapOptions} [options] - Journey customisation.
 * @returns {Promise<void>} Resolves once the merged table is visible.
 */
export async function openMergedHeatmap(
  page: Page,
  options: OpenMergedHeatmapOptions = {}
): Promise<void> {
  const {
    assignmentTitles = [SLIDES_ASSIGNMENT_TITLE, SHEETS_ASSIGNMENT_TITLE],
    controlActivation = 'pointer',
  } = options;

  await page.goto('/');
  await page.getByRole('menuitem', { name: HEATMAPS_LABEL }).click();
  await expect(page.getByRole('heading', { level: 2, name: HEATMAPS_LABEL })).toBeVisible();

  await selectBuilderOption(
    page,
    HEATMAPS_CLASS_COMBOBOX_INDEX,
    SOURCE_LINK_CLASS_NAME,
    controlActivation
  );

  let selection = Promise.resolve();
  assignmentTitles.forEach((assignmentTitle) => {
    selection = selection.then(() =>
      selectBuilderOption(
        page,
        HEATMAPS_ASSIGNMENTS_COMBOBOX_INDEX,
        assignmentTitle,
        controlActivation
      )
    );
  });
  await selection;

  await expect(page.getByRole('table', { name: HEATMAP_TABLE_NAME })).toBeVisible();
}

// ---------------------------------------------------------------------------
// Journey composition
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
 * @param {ReadonlyArray<ResponseItem>} queue - `getAssignment` queue override.
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
  return page.locator(`button[aria-label^="${cell.studentName}, ${cell.taskTitle},"]`);
}

// ---------------------------------------------------------------------------
// Theme and pointer reachability
// ---------------------------------------------------------------------------

/**
 * Switch the shell to the requested colour scheme and wait for it to apply.
 *
 * Call this before opening a preview: the switch lives in the shell, so moving
 * the pointer onto it closes a hover-opened popover.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {'light' | 'dark'} scheme - The scheme the walkthrough must review.
 * @returns {Promise<void>} Resolves once the switch reflects the requested scheme.
 */
export async function setColourScheme(page: Page, scheme: 'light' | 'dark'): Promise<void> {
  const themeSwitch = page.getByRole('switch', { name: DARK_MODE_SWITCH_NAME });
  const shouldBeDark = scheme === 'dark';
  await expect(themeSwitch).toBeVisible();

  if ((await themeSwitch.isChecked()) !== shouldBeDark) {
    await themeSwitch.click();
  }
  await expect(themeSwitch).toBeChecked({ checked: shouldBeDark });
}

/**
 * Scroll the page fully right so a metric cell clears the table's sticky name
 * columns for the pointer journey.
 *
 * @remarks
 * At the narrow viewport the heatmap table is wider than the page, so the page is
 * scrolled — which is exactly what a teacher does. It is not sufficient there:
 * measured at 390x844, the sticky Forename/Surname columns are wider than the
 * table's remaining visible strip and cover every metric cell, so no pointer
 * journey exists at that viewport and callers open the preview with the keyboard
 * instead. At viewports where the page already fits this is a no-op.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<void>} Resolves once the page is scrolled fully right.
 */
export async function revealMetricCellForPointer(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(document.documentElement.scrollWidth, 0);
  });
}
