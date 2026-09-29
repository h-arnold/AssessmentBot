/**
 * Shared helpers for reading the visible button order in the document.
 *
 * Used by placement assertions (for example verifying that an action sits
 * immediately left of another in a navigation card), so the mapping from a
 * rendered button to its accessible name stays identical across specs.
 */

import { screen } from '@testing-library/react';

/**
 * Reads the accessible button names in document order for placement assertions.
 *
 * Prefers `aria-label` and falls back to the button text, so icon-only actions
 * (which carry an `aria-label`) and text actions are compared on equal terms.
 *
 * @returns {string[]} The accessible button names, in document order.
 */
export function getAccessibleButtonNames(): string[] {
  return screen.getAllByRole('button').map((button) => {
    return (button.getAttribute('aria-label') ?? button.textContent ?? '').trim();
  });
}

/**
 * Index of a named button in document order, or -1 when it is absent.
 *
 * @param {string} name The accessible button name to locate.
 * @returns {number} The document-order index, or -1 when absent.
 */
export function getAccessibleButtonIndex(name: string): number {
  return getAccessibleButtonNames().indexOf(name);
}
