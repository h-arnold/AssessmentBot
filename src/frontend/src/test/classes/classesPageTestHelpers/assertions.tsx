/**
 * Assertion utilities for ClassesPage component tests.
 */

import { screen } from '@testing-library/react';
import type { buildClassesPageModel } from '../../../pages/classes/classesPageModel';
import type { ClassesPagePanelModel } from '../../../pages/classes/classesPageModel';
import { isInvalidDataViewModel } from './model';

/**
 * Asserts that a collapse region is present in the document.
 *
 * @param {string} [namePattern] - Optional name pattern for the collapse region.
 * @returns {HTMLElement} The collapse region element.
 */
export function assertCollapseRegion(namePattern = /year.*group/i): HTMLElement {
  const collapseRegion = screen.getByRole('region', { name: namePattern });
  expect(collapseRegion).toBeInTheDocument();
  return collapseRegion;
}

/**
 * Asserts that a collapse region is NOT present in the document.
 *
 * @param {string} [namePattern] - Optional name pattern for the collapse region.
 */
export function assertNoCollapseRegion(namePattern = /year.*group/i): void {
  expect(screen.queryByRole('region', { name: namePattern })).not.toBeInTheDocument();
}

/**
 * Asserts that a blocking alert is present.
 *
 * @returns {HTMLElement} The alert element.
 */
export function assertBlockingAlert(): HTMLElement {
  const alert = screen.getByRole('alert');
  expect(alert).toBeInTheDocument();
  expect(alert).toHaveTextContent(/could not be trusted or loaded/i);
  return alert;
}

/**
 * Asserts that no blocking alert is present.
 */
export function assertNoBlockingAlert(): void {
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
}

/**
 * Asserts that a skeleton loading indicator is present.
 *
 * @returns {HTMLElement} The skeleton element.
 */
export function assertLoadingSkeleton(): HTMLElement {
  const skeletonRegion = screen.getByRole('status');
  expect(skeletonRegion).toBeInTheDocument();
  expect(skeletonRegion).toHaveAttribute('aria-label', expect.stringContaining('loading'));
  return skeletonRegion;
}

/**
 * Asserts that no skeleton loading indicator is present.
 */
export function assertNoLoadingSkeleton(): void {
  expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
}

/**
 * Asserts that the empty state message is present.
 *
 * @param {string} [messagePattern] - Pattern to match in the empty message.
 * @returns {HTMLElement} The empty state element.
 */
export function assertEmptyState(messagePattern = /no year groups configured/i): HTMLElement {
  const emptyElement = screen.getByText(messagePattern);
  expect(emptyElement).toBeInTheDocument();
  return emptyElement;
}

/**
 * Asserts that the Classes page heading is present.
 *
 * @returns {HTMLElement} The heading element.
 */
export function assertClassesPageHeading(): HTMLElement {
  const heading = screen.getByRole('heading', { level: 2, name: /classes/i });
  expect(heading).toBeInTheDocument();
  return heading;
}

/**
 * Gets a class card by its name pattern.
 *
 * @param {string | RegExp} namePattern - Name pattern to match.
 * @returns {HTMLElement} The class card element.
 */
export function getClassCardByName(namePattern: string | RegExp): HTMLElement {
  return screen.getByRole('article', { name: namePattern });
}

/**
 * Asserts that a class card exists with the given name.
 *
 * @param {string | RegExp} namePattern - Name pattern to match.
 * @returns {HTMLElement} The class card element.
 */
export function assertClassCardExists(namePattern: string | RegExp): HTMLElement {
  const card = getClassCardByName(namePattern);
  expect(card).toBeInTheDocument();
  return card;
}

/**
 * Asserts that a panel with the given year group key exists and has the expected number of classes.
 *
 * @param {ReturnType<typeof buildClassesPageModel>} modelResult - The model result.
 * @param {string} yearGroupKey - The year group key to find.
 * @param {number} expectedClassCount - Expected number of classes in the panel.
 * @returns {ClassesPagePanelModel} The panel model.
 */
export function assertPanelHasClassCount(
  modelResult: ReturnType<typeof buildClassesPageModel>,
  yearGroupKey: string,
  expectedClassCount: number
): ClassesPagePanelModel {
  if (isInvalidDataViewModel(modelResult)) {
    throw new Error('Cannot check panel class count: model result is invalid');
  }

  const panel = modelResult.panels.find((p) => (p as { yearGroupKey: string }).yearGroupKey === yearGroupKey);
  expect(panel).toBeDefined();
  expect((panel as { classes: unknown[] }).classes).toHaveLength(expectedClassCount);
  // Cast to the expected type - we've already validated the model is not invalid
  return panel as ClassesPagePanelModel;
}

/**
 * Asserts that a panel header exists with the given year group label.
 *
 * @param {string | RegExp} labelPattern - Label pattern to match.
 * @returns {HTMLElement} The panel header element.
 */
export function assertPanelHeader(labelPattern: string | RegExp): HTMLElement {
  const header = screen.getByRole('heading', { level: 3, name: labelPattern });
  expect(header).toBeInTheDocument();
  return header;
}

/**
 * Asserts that a panel header has the expected aria-expanded state.
 *
 * @param {string | RegExp} labelPattern - Label pattern to match.
 * @param {boolean} expectedExpanded - Expected expanded state.
 */
export function assertPanelHeaderExpanded(
  labelPattern: string | RegExp,
  expectedExpanded: boolean
): void {
  const headerButton = screen.getByRole('button', { name: labelPattern });
  expect(headerButton).toHaveAttribute('aria-expanded', expectedExpanded ? 'true' : 'false');
}

/**
 * Asserts that a year group panel contains a specific class card.
 *
 * @param {string | RegExp} panelLabelPattern - Pattern to match the panel label.
 * @param {string | RegExp} cardNamePattern - Pattern to match the card name.
 */
export function assertPanelContainsClass(
  panelLabelPattern: string | RegExp,
  cardNamePattern: string | RegExp
): void {
  const panelRegion = screen.getByRole('region', { name: panelLabelPattern });
  expect(panelRegion).toBeInTheDocument();

  const card = getClassCardByName(cardNamePattern);
  expect(panelRegion).toContainElement(card);
}

/**
 * Asserts that a panel shows an empty state message.
 *
 * @param {string | RegExp} panelLabelPattern - Pattern to match the panel label.
 */
export function assertPanelEmpty(panelLabelPattern: string | RegExp): void {
  const panelRegion = screen.getByRole('region', { name: panelLabelPattern });
  expect(panelRegion).toBeInTheDocument();
  expect(panelRegion).toHaveTextContent(/no classes/i);
}
