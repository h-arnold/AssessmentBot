import {
  ABClassMetadataSchema,
  type ABClassMetadata,
} from '@/services/abClass/abClassMetadata.zod';
import classPartialsRaw from '@synthetic/small/classPartials.json';

/**
 * Canonical-backed class metadata fixtures for browser scenarios.
 *
 * The class transport schemas require every successful `getABClass` or
 * `getABClassPartials` row to carry the whole nullable `metadata` snapshot;
 * a missing or malformed field fails parsing at the service boundary. Browser
 * fixtures therefore serve snapshots cloned from the committed canonical
 * `small`-profile corpus instead of inventing values, and keep the canonical
 * `null` for classes that truthfully have no stored snapshot (for example a
 * class created moments ago by a bulk flow, or legacy records the backend has
 * normalised to explicit `null`).
 *
 * Each factory returns a fresh structured clone so one scenario can never
 * mutate a snapshot shared with another. No scenario asserts on snapshot
 * values; they are carried for read-contract fidelity.
 */

type CanonicalPartialRow = Readonly<{
  classId: string;
  metadata: unknown;
}>;

const CANONICAL_PROFILE_ROWS = classPartialsRaw as unknown as ReadonlyArray<CanonicalPartialRow>;

/**
 * Canonical snapshot identities: `class-0` ships metadata `null`, `class-1`
 * ships a numeric snapshot with zero recent entries, and `class-2` ships an
 * all-`N` snapshot with one recent entry.
 */
const CANONICAL_NULL_SNAPSHOT_ID = 'class-0';
const CANONICAL_NUMERIC_SNAPSHOT_ID = 'class-1';
const CANONICAL_NOT_ATTEMPTED_SNAPSHOT_ID = 'class-2';

/**
 * Parses one canonical corpus snapshot through the real ABClass metadata schema.
 *
 * @param {string} identity The corpus class identifier to mirror.
 * @returns {ABClassMetadata} The schema-validated canonical snapshot.
 */
function parseCanonicalMetadataSnapshot(identity: string): ABClassMetadata {
  const row = CANONICAL_PROFILE_ROWS.find((candidate) => candidate.classId === identity);
  if (!row) {
    throw new Error(
      `class-metadata-fixtures: the committed canonical profile has no class partial row for ${identity}.`
    );
  }

  const parsed = ABClassMetadataSchema.safeParse(row.metadata);
  if (!parsed.success) {
    throw new Error(
      `class-metadata-fixtures: the committed canonical metadata for ${identity} no longer parses as ABClass metadata.`
    );
  }

  return parsed.data;
}

const canonicalNullSnapshot = parseCanonicalMetadataSnapshot(CANONICAL_NULL_SNAPSHOT_ID);
const canonicalNumericSnapshot = parseCanonicalMetadataSnapshot(CANONICAL_NUMERIC_SNAPSHOT_ID);
const canonicalNotAttemptedSnapshot = parseCanonicalMetadataSnapshot(
  CANONICAL_NOT_ATTEMPTED_SNAPSHOT_ID
);

/**
 * Canonical `null` metadata for classes without a stored assessment snapshot.
 *
 * @remarks This is the truthful backend emission for a newly created class or a
 * legacy record, not a fake default for a class with assessment history.
 */
export const CANONICAL_NULL_CLASS_METADATA: ABClassMetadata = canonicalNullSnapshot;

/**
 * Serves a fresh clone of the canonical numeric snapshot (zero recent entries).
 *
 * @returns {ABClassMetadata} A detached canonical metadata snapshot.
 */
export function createCanonicalNumericClassMetadata(): ABClassMetadata {
  return structuredClone(canonicalNumericSnapshot);
}

/**
 * Serves a fresh clone of the canonical all-`N` snapshot (one recent entry).
 *
 * @returns {ABClassMetadata} A detached canonical metadata snapshot.
 */
export function createCanonicalNotAttemptedClassMetadata(): ABClassMetadata {
  return structuredClone(canonicalNotAttemptedSnapshot);
}
