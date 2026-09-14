/**
 * Shared guards for synthetic analysis graph validation.
 */

/**
 * Throws an actionable invariant failure.
 *
 * @param {string} message Human-readable failure detail.
 */
export function fail(message) {
  throw new Error(`Synthetic analysis graph invariant failed: ${message}`);
}

/**
 * Reports whether a value is a non-null, non-array object record.
 *
 * @param {unknown} value Candidate value.
 * @returns {boolean} True for a plain record.
 */
export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Rejects JavaScript value types that cannot cross JSON transport.
 *
 * @param {string} valueType The `typeof` result for the current value.
 * @param {string} path Human-readable path used in reported failures.
 */
function assertSupportedType(valueType, path) {
  if (valueType === 'function' || valueType === 'symbol' || valueType === 'bigint') {
    fail(`${path} is a ${valueType}; generated data must be JSON-serialisable.`);
  }
}

/**
 * Walks a value graph and rejects values that cannot cross JSON transport.
 *
 * @param {unknown} value Current value.
 * @param {string} path Human-readable path used in reported failures.
 */
export function assertSerialisable(value, path) {
  if (value === undefined) {
    fail(`${path} is undefined; generated data must be JSON-serialisable.`);
  }
  if (value === null) {
    return;
  }
  if (value instanceof Date) {
    fail(`${path} is a live Date; generated data must use ISO 8601 strings.`);
  }

  const valueType = typeof value;
  assertSupportedType(valueType, path);

  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSerialisable(entry, `${path}[${index}]`));
    return;
  }

  if (valueType === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      assertSerialisable(entry, `${path}.${key}`);
    }
  }
}
