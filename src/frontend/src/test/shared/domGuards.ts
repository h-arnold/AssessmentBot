/**
 * Assert that an element is present and an HTML element.
 *
 * @param {Element | null} element - The candidate element.
 * @param {string} message - Failure message.
 * @returns {HTMLElement} The asserted element.
 */
export function requireElement(element: Element | null, message: string): HTMLElement {
  if (!(element instanceof HTMLElement)) {
    throw new TypeError(message);
  }

  return element;
}

/**
 * Assert that an element is present and an HTML table element.
 *
 * @param {Element | null} element - The candidate element.
 * @param {string} message - Failure message.
 * @returns {HTMLTableElement} The asserted table element.
 */
export function requireTableElement(element: Element | null, message: string): HTMLTableElement {
  if (!(element instanceof HTMLTableElement)) {
    throw new TypeError(message);
  }

  return element;
}
