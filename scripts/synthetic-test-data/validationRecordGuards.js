import { fail, isRecord } from './invariantGuards.js';

/** @typedef {Record<string, unknown>} RawRecord */

/**
 * Renders keys as quoted JSON list fragments for failure messages.
 *
 * @param {Array<string>} keys Keys to render.
 * @returns {string} Quoted comma-joined key list.
 */
export function quoteKeys(keys) {
  return keys.map((key) => JSON.stringify(key)).join(', ');
}

/**
 * Asserts a value is a plain object record or fails with the given label.
 *
 * @param {unknown} value Value to verify.
 * @param {string} label Failure-message context.
 * @returns {RawRecord} The verified record.
 */
export function requireItemRecord(value, label) {
  if (!isRecord(value)) {
    fail(`${label} must be an object.`);
  }
  return /** @type {RawRecord} */ (value);
}
