const UNAVAILABLE_VALUE = '—';

/**
 * Formats an ISO timestamp for table display and filtering.
 *
 * The em-dash fallback (`UNAVAILABLE_VALUE`) is returned for null or
 * unparseable input.  This behaviour is consumed by `AssignmentsPage`
 * (which renders the fallback directly).  The Class page adapter does
 * **not** use the fallback — it throws upstream on null or unparseable
 * input, so this helper is always called with a valid ISO string in that
 * path.
 *
 * @remarks
 * - Locale: `en-GB` (day/month/year).
 * - Format: date only, no time, rendered in UTC.
 * - Pure function: no side effects, no React / antd / I/O / state.
 *
 * Call-site divergence:
 * - `AssignmentsPage` renders the result directly, including the em-dash
 *   fallback for soft null / unparseable input.
 * - The Class page adapter calls this helper only after a null/unparseable
 *   check has thrown upstream; the helper is always called with a valid
 *   ISO string in that path.
 *
 * @param {string | null} updatedAt - ISO 8601 timestamp or null.
 * @returns {string} Formatted date string or em-dash fallback.
 */
export function formatUpdatedAtLabel(updatedAt: string | null): string {
  if (updatedAt === null) {
    return UNAVAILABLE_VALUE;
  }

  const parsedDate = new Date(updatedAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return UNAVAILABLE_VALUE;
  }

  return parsedDate.toLocaleDateString('en-GB', { timeZone: 'UTC' });
}
