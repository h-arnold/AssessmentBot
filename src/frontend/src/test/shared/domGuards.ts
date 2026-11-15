/**
 * Assert that an element is present and an HTML element.
 *
 * @param {Element | null} element - The candidate element.
 * @param {string} message - Failure message.
 * @returns {HTMLElement} The asserted element.
 * @throws {TypeError} When the element is absent or is not an HTML element.
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
 * @throws {TypeError} When the element is absent or is not an HTML table element.
 */
export function requireTableElement(element: Element | null, message: string): HTMLTableElement {
  if (!(element instanceof HTMLTableElement)) {
    throw new TypeError(message);
  }

  return element;
}

/** The split elements Ant Design renders for a sticky table. */
export type StickyTableParts = Readonly<{
  /** The `.ant-table-header.ant-table-sticky-holder` element. */
  headerHolder: HTMLElement;
  /** The `.ant-table-body` element. */
  body: HTMLElement;
  /** The header `<table>` inside the header holder. */
  headerTable: HTMLTableElement;
  /** The body `<table>` inside the body element. */
  bodyTable: HTMLTableElement;
}>;

/**
 * Resolve the split header and body elements of a rendered sticky table.
 *
 * A sticky Ant Design table renders a header table inside
 * `.ant-table-header.ant-table-sticky-holder` and a body table inside
 * `.ant-table-body`. Resolve both from the wrapper rather than by accessible
 * name, because Ant Design copies the source `aria-label` onto both halves.
 *
 * @param {HTMLElement} wrapper - The `.ant-table-wrapper` element.
 * @param {string} surface - Surface name used in failure messages.
 * @returns {StickyTableParts} The header holder, body, header table, and body table.
 * @throws {TypeError} When any part of the split structure is missing.
 */
export function resolveStickyTables(wrapper: HTMLElement, surface: string): StickyTableParts {
  const headerHolder = requireElement(
    wrapper.querySelector('.ant-table-header.ant-table-sticky-holder'),
    `Expected the ${surface} sticky header holder.`
  );
  const body = requireElement(
    wrapper.querySelector('.ant-table-body'),
    `Expected the ${surface} sticky body.`
  );
  const headerTable = requireTableElement(
    headerHolder.querySelector('table'),
    `Expected the ${surface} header table.`
  );
  const bodyTable = requireTableElement(
    body.querySelector('table'),
    `Expected the ${surface} body table.`
  );

  return { headerHolder, body, headerTable, bodyTable };
}
