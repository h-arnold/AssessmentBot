import { describe, expect, it } from 'vitest';
import { classFull } from '../classPage/classPageAdapterTestFixtures';
import { createClassFull } from '../dataAnalysis/fixtures';
import { createFixtureClassPartial } from '../classes/classesPageTestFixtures';
import {
  CANONICAL_NON_NULL_METADATA,
  createCanonicalMetadataFixture,
} from './abClassMetadataSharedFixtures';
import { createCanonicalMetadataFixture as compatibilityFactory } from './abClassMetadataFixtures';
import type { ABClassMetadata } from '@/services/abClass/abClassMetadata.zod';

const providers = [
  {
    name: 'Class page adapter',
    build: (overrides: { metadata?: ABClassMetadata }) => classFull(overrides),
  },
  {
    name: 'data analysis',
    build: (overrides: { metadata?: ABClassMetadata }) =>
      createClassFull({ classId: 'probe', assignments: [], ...overrides }),
  },
];

describe.each(providers)('$name metadata fixture', ({ build }) => {
  it('preserves explicit null metadata', () => {
    expect(build({ metadata: null }).metadata).toBeNull();
  });

  it('defaults omitted/undefined metadata to detached canonical snapshots', () => {
    const first = build({}).metadata;
    const second = build({ metadata: undefined }).metadata;
    expect(first).toEqual(CANONICAL_NON_NULL_METADATA);
    expect(second).toEqual(CANONICAL_NON_NULL_METADATA);
    expect(first).not.toBe(second);
    expect(first).not.toBe(CANONICAL_NON_NULL_METADATA);
    if (first === null || second === null) throw new Error('Expected non-null defaults');
    expect(first.classAverages).not.toBe(second.classAverages);
    expect(first.recentAssignments).not.toBe(second.recentAssignments);
    first.classAverages.completeness = 'E';
    expect(second).toEqual(CANONICAL_NON_NULL_METADATA);
    expect(build({}).metadata).toEqual(CANONICAL_NON_NULL_METADATA);
  });

  it('retains an explicit complete metadata override', () => {
    const metadata = createCanonicalMetadataFixture();
    metadata.classAverages.overall = 'N';
    expect(build({ metadata }).metadata).toBe(metadata);
  });
});

describe('runner-neutral canonical metadata factory', () => {
  it('preserves the Vitest compatibility export and freezes the canonical source', () => {
    expect(compatibilityFactory).toBe(createCanonicalMetadataFixture);
    expect(Object.isFrozen(CANONICAL_NON_NULL_METADATA)).toBe(true);
    expect(Object.isFrozen(CANONICAL_NON_NULL_METADATA.classAverages)).toBe(true);
    expect(Object.isFrozen(CANONICAL_NON_NULL_METADATA.recentAssignments)).toBe(true);
  });

  it('supplies independent snapshots to ClassesPage fixtures and preserves null', () => {
    const first = createFixtureClassPartial({ classId: 'first' });
    const second = createFixtureClassPartial({ classId: 'second' });
    expect(first.metadata).toEqual(createCanonicalMetadataFixture());
    expect(first.metadata).not.toBe(second.metadata);
    expect(createFixtureClassPartial({ classId: 'boundary', metadata: null }).metadata).toBeNull();
  });
});
