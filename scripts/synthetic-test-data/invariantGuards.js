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
 * Rejects JavaScript value types that cannot cross JSON transport and reports
 * the value's `typeof` result for collection handling.
 *
 * @param {unknown} value Current value.
 * @param {string} path Human-readable path used in reported failures.
 * @returns {string} The `typeof` result for the current value.
 */
function assertSupportedValue(value, path) {
  const valueType = typeof value;
  if (valueType === 'function' || valueType === 'symbol' || valueType === 'bigint') {
    fail(`${path} is a ${valueType}; generated data must be JSON-serialisable.`);
  }
  if (valueType === 'number' && !Number.isFinite(value)) {
    fail(`${path} is a non-finite number; generated data must be JSON-serialisable.`);
  }
  return valueType;
}

/**
 * Recursively walks an array or object value's children.
 *
 * @param {unknown} value Current array or object value.
 * @param {string} path Human-readable path used in reported failures.
 * @param {string} valueType The `typeof` result for the current value.
 */
function assertSerialisableChildren(value, path, valueType) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSerialisable(entry, `${path}[${index}]`));
    return;
  }

  if (valueType !== 'object') {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    assertSerialisable(entry, `${path}.${key}`);
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

  const valueType = assertSupportedValue(value, path);
  assertSerialisableChildren(value, path, valueType);
}
