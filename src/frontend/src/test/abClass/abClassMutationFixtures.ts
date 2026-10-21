import smallPartialsRaw from '@synthetic/small/classPartials.json?raw';
import { ClassPartialSchema } from '@/services/googleClassrooms/classPartials.zod';
import { createCanonicalMetadataFixture } from './abClassMetadataSharedFixtures';

/**
 * Returns a detached canonical mutation response with non-null metadata.
 * @returns {import('@/services/googleClassrooms/classPartials.zod').ClassPartial} A fresh canonical class partial.
 */
export function createMutationResponse() {
  const rows = ClassPartialSchema.array().parse(JSON.parse(smallPartialsRaw));
  const row = rows.find((candidate) => candidate.metadata !== null);
  if (!row) throw new Error('Canonical mutation response is missing.');
  return row;
}

/**
 * Selects the required upsert configuration from a canonical class partial.
 * @returns {{ classId: string; cohortKey: string; yearGroupKey: string; courseLength: number }} Required configuration without metadata.
 */
export function createUpsertRequest() {
  const rows = ClassPartialSchema.array().parse(JSON.parse(smallPartialsRaw));
  const row = rows.find(
    (candidate) => candidate.cohortKey !== null && candidate.yearGroupKey !== null
  );
  if (row?.cohortKey === undefined || row.cohortKey === null || row.yearGroupKey === null) {
    throw new Error('Canonical non-null upsert configuration is missing.');
  }
  return {
    classId: row.classId,
    cohortKey: row.cohortKey,
    yearGroupKey: row.yearGroupKey,
    courseLength: row.courseLength,
  };
}

/**
 * Returns a complete mutable replacement request.
 * @returns {{ classId: string; metadata: NonNullable<import('@/services/abClass/abClassMetadata.zod').ABClassMetadata> }} A fresh complete replacement request.
 */
export function createUpdateRequest() {
  return { classId: createMutationResponse().classId, metadata: createCanonicalMetadataFixture() };
}
