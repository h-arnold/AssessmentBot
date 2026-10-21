import smallPartials from '@synthetic/small/classPartials.json';
import { ABClassMetadataSchema } from '@/services/abClass/abClassMetadata.zod';
import { deepFreeze } from '../shared/canonicalFixturePrimitives';

const canonicalRow = smallPartials.find((row) => row.metadata !== null);
if (!canonicalRow) {
  throw new Error('No canonical non-null metadata row in the small profile');
}
const parsedMetadata = ABClassMetadataSchema.parse(canonicalRow.metadata);
if (parsedMetadata === null) {
  throw new Error('Expected non-null canonical metadata');
}

/** Validated, frozen numeric snapshot shared by Vitest and Playwright fixtures. */
export const CANONICAL_NON_NULL_METADATA = deepFreeze(parsedMetadata);

/**
 * Copies the canonical snapshot without any runner-specific raw imports.
 * @returns {typeof CANONICAL_NON_NULL_METADATA} Detached mutable metadata.
 */
export function createCanonicalMetadataFixture(): typeof CANONICAL_NON_NULL_METADATA {
  return structuredClone(CANONICAL_NON_NULL_METADATA);
}
