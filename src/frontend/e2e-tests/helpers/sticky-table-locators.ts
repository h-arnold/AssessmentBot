import type { Locator, Page } from '@playwright/test';

/**
 * Structural locators for Ant Design sticky student tables.
 *
 * The sticky student tables (the Student Averages table and the Task Heatmap
 * on the Class page overview, the Class page assignment heatmap view, and the
 * standalone Heatmaps page) render as a split: a header table inside
 * `.ant-table-header.ant-table-sticky-holder`, the body table inside
 * `.ant-table-body` (the horizontal scroll region), and a
 * `.ant-table-sticky-scroll` bar that exists only while the body overflows
 * horizontally. When the source table supplies an `aria-label` — the Task
 * Heatmap does — Ant Design copies it onto both tables, so the accessible name
 * resolves to two `table` elements.
 *
 * Never resolve a sticky student table by accessible name: `getByRole('table',
 * { name: ... })`, `getByLabelText` and their `queryBy*`/`findBy*` variants
 * all match both halves and violate strict mode. Base row and cell queries on
 * `stickyTableBody` and column-header queries on `stickyTableHeaderHolder`;
 * use `stickyTableWrapper` only for roles whose occurrence count the split
 * does not change (a named column header, for example), for ancestor probes
 * such as the owning card, and as a readiness/visibility gate before scoping
 * into the halves. Tables outside the three student-table surfaces
 * (Classes, Assignments, modal tables) do not use this module.
 *
 * The selectors behind these locators are exported as constants so spec
 * modules running `evaluate` snapshots (which cannot close over imports)
 * can pass them in as arguments, keeping a rename single-sourced.
 *
 * Each base takes a scope that contains exactly one sticky student table: the
 * `Page` on a surface rendering a single table (the standalone Heatmaps page,
 * the Class page's assignment heatmap view), or the owning antd Card where the
 * surface could hold more than one table (the Class page overview's Student
 * Averages card).
 */

/** A locator scope that contains exactly one sticky student table. */
export type StickyTableScope = Page | Locator;

/**
 * Split render's wrapper, which contains both halves of the split.
 *
 * Exported for `evaluate` snapshots, which cannot close over the locators.
 */
export const STICKY_TABLE_WRAPPER_SELECTOR = '.ant-table-wrapper';

/** Split render's header holder, which contains the header table. */
export const HEADER_HOLDER_SELECTOR = '.ant-table-header.ant-table-sticky-holder';

/** Split render's body scroll region, which contains the body table. */
export const BODY_SELECTOR = '.ant-table-body';

/** Sticky horizontal scrollbar; absent when the table has no horizontal overflow. */
export const STICKY_SCROLL_SELECTOR = '.ant-table-sticky-scroll';

/** The sticky scrollbar's thumb, which exists only while the bar is mounted. */
export const STICKY_SCROLL_THUMB_SELECTOR = '.ant-table-sticky-scroll-bar';

/**
 * Return the wrapper of the sticky student table inside `scope`.
 *
 * The wrapper contains both halves of the split render, so it is the base for
 * roles whose occurrence count the split does not change (a named column
 * header keeps its pre-split count) and for ancestor probes such as the
 * owning card. It is also a readiness gate: awaiting its visibility confirms
 * the table has rendered before scoping into the halves. It is never a
 * substitute for `stickyTableBody` (rows and cells) or
 * `stickyTableHeaderHolder` (column headers), because the wrapper cannot
 * attribute a query to one half of the split.
 *
 * @param {StickyTableScope} scope - Page or locator holding one sticky table.
 * @returns {Locator} The `.ant-table-wrapper` of the sticky student table.
 */
export function stickyTableWrapper(scope: StickyTableScope): Locator {
  return scope.locator(STICKY_TABLE_WRAPPER_SELECTOR);
}

/**
 * Return the sticky header holder of the student table inside `scope`.
 *
 * The base for column-header assertions: the split render moves every header
 * cell into the header table inside this holder, so a body- or wrapper-scoped
 * `columnheader` query either misses or cannot be attributed to the header.
 * The holder is present whenever the table is rendered, so it also serves as
 * a visibility gate for the table's readiness.
 *
 * @param {StickyTableScope} scope - Page or locator holding one sticky table.
 * @returns {Locator} The `.ant-table-header.ant-table-sticky-holder` element.
 */
export function stickyTableHeaderHolder(scope: StickyTableScope): Locator {
  return scope.locator(HEADER_HOLDER_SELECTOR);
}

/**
 * Return the body scroll region of the student table inside `scope`.
 *
 * The base for row and cell assertions: the split render keeps every data row
 * and cell in the body table inside this element, which is also the region
 * that owns the table's horizontal overflow. Note the body table's `tbody`
 * starts with an `aria-hidden` measure row (`tr.ant-table-measure-row`) that
 * repeats the column titles as text, so count data rows with
 * `tbody tr.ant-table-row` rather than a bare `tbody tr`.
 *
 * @param {StickyTableScope} scope - Page or locator holding one sticky table.
 * @returns {Locator} The `.ant-table-body` element.
 */
export function stickyTableBody(scope: StickyTableScope): Locator {
  return scope.locator(BODY_SELECTOR);
}

/**
 * Return the sticky horizontal scrollbar of the student table inside `scope`.
 *
 * The bar renders only after Ant Design's first visibility check has run and
 * only while the body scroll region overflows horizontally, so poll for its
 * presence rather than asserting it synchronously. Its thumb is the
 * `.ant-table-sticky-scroll-bar` descendant. The bar is permanently absent
 * when the table has no horizontal overflow.
 *
 * @param {StickyTableScope} scope - Page or locator holding one sticky table.
 * @returns {Locator} The `.ant-table-sticky-scroll` element, or a locator
 *   matching nothing when the table does not overflow.
 */
export function stickyTableScrollBar(scope: StickyTableScope): Locator {
  return scope.locator(STICKY_SCROLL_SELECTOR);
}

/**
 * Return the thumb of the sticky horizontal scrollbar inside `scope`.
 *
 * The thumb is the bar's `.ant-table-sticky-scroll-bar` descendant, so it
 * exists only while the bar is mounted; await its visibility beside the bar's.
 *
 * @param {StickyTableScope} scope - Page or locator holding one sticky table.
 * @returns {Locator} The `.ant-table-sticky-scroll-bar` thumb element.
 */
export function stickyScrollBarThumb(scope: StickyTableScope): Locator {
  return stickyTableScrollBar(scope).locator(STICKY_SCROLL_THUMB_SELECTOR);
}
