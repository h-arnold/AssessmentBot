import { Faker, base, en } from '@faker-js/faker';

/**
 * Shared deterministic primitives for synthetic analysis generation.
 *
 * @remarks
 * The generator must never depend on wall-clock time, so every timestamp is
 * derived from this fixed epoch rather than `Date.now()`. Faker instances are
 * seeded explicitly so a profile seed fully identifies the generated corpus.
 */

const SUPPORTED_LOCALES = [en, base];
const MILLISECONDS_PER_MINUTE = 60_000;
const TIMELINE_START_YEAR = 2024;
const TIMELINE_START_DAY = 2;
const TIMELINE_START_HOUR = 9;

/** Fixed, bounded academic timeline start used by every generated timestamp. */
export const TIMELINE_START_MS = Date.UTC(
  TIMELINE_START_YEAR,
  0,
  TIMELINE_START_DAY,
  TIMELINE_START_HOUR,
  0,
  0
);

/**
 * Creates an isolated Faker instance seeded with the given integer.
 *
 * @param {number} seed Deterministic integer seed.
 * @returns {Faker} A seeded Faker instance.
 */
export function createSeededFaker(seed) {
  const faker = new Faker({ locale: SUPPORTED_LOCALES });
  faker.seed(seed);
  return faker;
}

/**
 * Converts a deterministic minute offset into an ISO 8601 UTC string.
 *
 * @param {number} minuteOffset Offset in minutes from the fixed timeline start.
 * @returns {string} ISO 8601 UTC timestamp with millisecond precision.
 */
export function isoAt(minuteOffset) {
  return new Date(TIMELINE_START_MS + minuteOffset * MILLISECONDS_PER_MINUTE).toISOString();
}
