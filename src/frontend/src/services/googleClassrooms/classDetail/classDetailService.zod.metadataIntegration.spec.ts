import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import smallClassesByIdRaw from '@synthetic/small/classesById.json?raw';
import smallDefinitionPartialsRaw from '@synthetic/small/assignmentDefinitionPartials.json?raw';
import { ABClassMetadataSchema } from '@/services/abClass/abClassMetadata.zod';
import {
  AveragingAnalyserInputSchema,
  DataAnalysisResponseSchema,
  type AveragingAnalyserInput,
} from '@/services/dataAnalysis/dataAnalysis.zod';
import { AveragingAnalyser } from '@/services/dataAnalysis/analysers/averagingAnalyser';
import { ClassFullResponseSchema, ClassFullSchema } from './classDetailService.zod';
import { ClassPartialSchema, ClassPartialsResponseSchema } from '../classPartials.zod';
import {
  METADATA_PROFILE_CLASS_PARTIALS,
  cloneMetadata,
} from '@/test/abClass/abClassMetadataFixtures';

/**
 * Independently validates retained metadata on either parsed class-read shape.
 * @param {unknown} parsed - Parsed class or partial object.
 * @returns {unknown} The parsed, validated metadata value when present.
 */
function extractParsedMetadata(parsed: unknown): unknown {
  return z.object({ metadata: ABClassMetadataSchema }).parse(parsed).metadata;
}

/**
 * Adds an extra unrelated storage key to a cloned wire record.
 * @param {unknown} wireRecord - Cloned canonical wire value.
 * @returns {unknown} Mutable probe record carrying the extra key.
 */
function appendStorageOnlyField(wireRecord: unknown): Record<string, unknown> {
  return { ...(wireRecord as Record<string, unknown>), _storageOnlyField: 'strip-me' };
}

/**
 * Reads one metadata-bearing or null canonical partial row.
 * @param {'small' | 'medium' | 'large-representative'} profile - Committed profile.
 * @param {'null' | 'non-null'} variant - Which metadata variant to select.
 * @returns {Record<string, unknown>} A cloned canonical partial row.
 */
function canonicalPartialRow(
  profile: 'small' | 'medium' | 'large-representative',
  variant: 'null' | 'non-null'
): Record<string, unknown> {
  const rows = METADATA_PROFILE_CLASS_PARTIALS[profile];
  const sourceRow = rows.find((row) => (row.metadata === null) === (variant === 'null'));
  expect(sourceRow, `${profile}/${variant} canonical row`).toBeDefined();
  return cloneMetadata({ ...sourceRow });
}

/**
 * Builds a full-class analysis input from a cloned canonical class.
 * @param {unknown} fullClass - Cloned canonical full-class wire value.
 * @returns {AveragingAnalyserInput} Validated analyser input.
 */
function buildAnalysisInput(fullClass: unknown): AveragingAnalyserInput {
  return AveragingAnalyserInputSchema.parse({
    filter: { classIds: ['class-1'] },
    classes: [fullClass],
    assignmentDefinitionPartials: structuredClone(JSON.parse(smallDefinitionPartialsRaw)),
  });
}

const CANONICAL_SMALL_CLASSES = JSON.parse(smallClassesByIdRaw) as Record<string, unknown>;

describe('ClassPartialSchema metadata integration', () => {
  it('retains canonical non-null metadata from every committed profile', () => {
    for (const profile of ['small', 'medium', 'large-representative'] as const) {
      const raw = canonicalPartialRow(profile, 'non-null');
      const expectedMetadata = ABClassMetadataSchema.parse(structuredClone(raw.metadata));

      const parsed = ClassPartialSchema.parse(structuredClone(raw));

      expect(Object.hasOwn(parsed, 'metadata')).toBe(true);
      expect(extractParsedMetadata(parsed)).toEqual(expectedMetadata);
    }
  });

  it('retains canonical null metadata as an own nullable property', () => {
    const raw = canonicalPartialRow('small', 'null');

    const parsed = ClassPartialSchema.parse(structuredClone(raw));

    expect(Object.hasOwn(parsed, 'metadata')).toBe(true);
    expect(extractParsedMetadata(parsed)).toBeNull();
  });

  it('rejects a partial response when metadata is missing', () => {
    const raw = canonicalPartialRow('small', 'non-null');
    delete raw.metadata;

    expect(() => ClassPartialSchema.parse(raw)).toThrow();
  });

  it('rejects malformed metadata on a partial response', () => {
    const raw = canonicalPartialRow('small', 'non-null');
    const metadata = raw.metadata as { classAverages: { accuracy: unknown } };
    metadata.classAverages.accuracy = 9;

    expect(() => ClassPartialSchema.parse(raw)).toThrow();
  });

  it('rejects metadata unknown fields', () => {
    const raw = canonicalPartialRow('medium', 'non-null');
    (raw.metadata as { unknownMarker: string }).unknownMarker = 'reject-me';

    expect(() => ClassPartialSchema.parse(raw)).toThrow();
  });

  it('strips unrelated top-level extras on a partial read', () => {
    const raw = appendStorageOnlyField(canonicalPartialRow('small', 'null'));

    const parsed = ClassPartialSchema.parse(raw);

    expect(Object.keys(parsed)).not.toContain('_storageOnlyField');
  });
});

describe('ClassFullSchema metadata integration', () => {
  it('retains canonical non-null metadata on a full class read', () => {
    const raw = appendStorageOnlyField(structuredClone(CANONICAL_SMALL_CLASSES['class-1']));
    const expectedMetadata = ABClassMetadataSchema.parse(structuredClone(raw.metadata));

    const parsed = ClassFullSchema.parse(raw);

    expect(Object.hasOwn(parsed, 'metadata')).toBe(true);
    expect(extractParsedMetadata(parsed)).toEqual(expectedMetadata);
    expect(Object.keys(parsed)).not.toContain('_storageOnlyField');
  });

  it('retains canonical null metadata on a full class read', () => {
    const raw = appendStorageOnlyField(structuredClone(CANONICAL_SMALL_CLASSES['class-0']));

    const parsed = ClassFullSchema.parse(raw);

    expect(Object.hasOwn(parsed, 'metadata')).toBe(true);
    expect(extractParsedMetadata(parsed)).toBeNull();
    expect(Object.keys(parsed)).not.toContain('_storageOnlyField');
  });

  it('rejects a full class read when metadata is missing', () => {
    const raw = structuredClone(CANONICAL_SMALL_CLASSES['class-1']) as Record<string, unknown>;
    delete raw.metadata;

    expect(() => ClassFullSchema.parse(raw)).toThrow();
  });

  it('rejects malformed metadata on a full class read', () => {
    const raw = structuredClone(CANONICAL_SMALL_CLASSES['class-1']) as Record<string, unknown>;
    const metadata = raw.metadata as { classAverages: Record<string, unknown> };
    metadata.classAverages.spag = 'five';

    expect(() => ClassFullSchema.parse(raw)).toThrow();
  });
});

describe('class read envelope contracts unchanged', () => {
  it('keeps the full response top-level null for a missing class', () => {
    expect(ClassFullResponseSchema.parse(null)).toBeNull();
  });

  it('keeps the partial list response an empty array when no classes exist', () => {
    expect(ClassPartialsResponseSchema.parse([])).toEqual([]);
  });
});

describe('class analysis with metadata-bearing input', () => {
  it('accepts a metadata-bearing canonical class without changing scores', () => {
    const withMetadata = appendStorageOnlyField(
      structuredClone(CANONICAL_SMALL_CLASSES['class-1'])
    );
    const withoutMetadata = appendStorageOnlyField(
      structuredClone(CANONICAL_SMALL_CLASSES['class-1'])
    );
    // Explicit null is the canonical minimal boundary of the nullable whole
    // field; a deleted own property is a missing-field rejection covered above.
    withoutMetadata.metadata = null;

    const resultWith = DataAnalysisResponseSchema.parse(
      new AveragingAnalyser().analyse(buildAnalysisInput(withMetadata))
    );
    const resultWithout = DataAnalysisResponseSchema.parse(
      new AveragingAnalyser().analyse(buildAnalysisInput(withoutMetadata))
    );

    expect(resultWith).toEqual(resultWithout);
  });
});
