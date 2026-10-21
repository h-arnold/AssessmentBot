import smallPartialsRaw from '@synthetic/small/classPartials.json?raw';
import mediumPartialsRaw from '@synthetic/medium/classPartials.json?raw';
import representativePartialsRaw from '@synthetic/large-representative/classPartials.json?raw';
import { deepFreeze } from '../shared/canonicalFixturePrimitives';

export {
  CANONICAL_NON_NULL_METADATA,
  createCanonicalMetadataFixture,
} from './abClassMetadataSharedFixtures';

export type MetadataProfile = 'small' | 'medium' | 'large-representative';

/** Committed profile keys in canonical order, asserted against the selectors. */
export const METADATA_PROFILES: readonly MetadataProfile[] = [
  'small',
  'medium',
  'large-representative',
];

/** One committed class-partial record carrying canonical metadata. */
export interface MetadataSnapshotRow {
  metadata: unknown;
}

/** Parsed committed class-partial views carrying canonical metadata samples. */
export const METADATA_PROFILE_CLASS_PARTIALS = deepFreeze({
  small: JSON.parse(smallPartialsRaw) as MetadataSnapshotRow[],
  medium: JSON.parse(mediumPartialsRaw) as MetadataSnapshotRow[],
  'large-representative': JSON.parse(representativePartialsRaw) as MetadataSnapshotRow[],
} satisfies Record<MetadataProfile, MetadataSnapshotRow[]>);

/**
 * Makes a mutable copy of a canonical or locally-created metadata value.
 * @param {T} value - Value to copy.
 * @returns {T} A detached copy.
 */
export function cloneMetadata<T>(value: T): T {
  return structuredClone(value);
}
