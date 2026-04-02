import { describe, expect, it } from 'vitest';
import {
    CohortSchema,
    CreateCohortInputSchema,
    CreateYearGroupInputSchema,
    DeleteCohortResponseSchema,
    DeleteYearGroupInputSchema,
    DeleteYearGroupResponseSchema,
    UpdateCohortInputSchema,
    UpdateYearGroupInputSchema,
    YearGroupSchema,
} from './referenceData.zod';

const omittedBackendSuccessPayload = new Map<string, never>().get('missing');

describe('referenceData.zod current legacy schemas', () => {
    it('CohortSchema accepts the current legacy { name, active } payload', () => {
        expect(CohortSchema.parse({ name: '2025 Cohort', active: true })).toEqual({
            name: '2025 Cohort',
            active: true,
        });
    });

    it.each(['', '   '])('CohortSchema rejects empty names: %j', (name) => {
        expect(() => CohortSchema.parse({ name, active: true })).toThrow();
    });

    it('CohortSchema rejects a missing active flag', () => {
        expect(() => CohortSchema.parse({ name: '2025 Cohort' })).toThrow();
    });

    it('CohortSchema rejects a non-boolean active flag', () => {
        expect(() => CohortSchema.parse({ name: '2025 Cohort', active: 'true' })).toThrow();
    });

    it('YearGroupSchema accepts the current legacy { name } payload', () => {
        expect(YearGroupSchema.parse({ name: 'Year 10' })).toEqual({ name: 'Year 10' });
    });

    it.each(['', '   '])('YearGroupSchema rejects empty or whitespace-only names: %j', (name) => {
        expect(() => YearGroupSchema.parse({ name })).toThrow();
    });

    it('CreateCohortInputSchema accepts omitted active in the record payload', () => {
        expect(CreateCohortInputSchema.parse({ record: { name: '2025 Cohort' } })).toEqual({
            record: { name: '2025 Cohort' },
        });
    });

    it('UpdateCohortInputSchema requires originalName and the current legacy record shape', () => {
        expect(
            UpdateCohortInputSchema.parse({
                originalName: '2024 Cohort',
                record: { name: '2025 Cohort', active: true },
            })
        ).toEqual({
            originalName: '2024 Cohort',
            record: { name: '2025 Cohort', active: true },
        });

        expect(() =>
            UpdateCohortInputSchema.parse({
                record: { name: '2025 Cohort', active: true },
            })
        ).toThrow();
        expect(() =>
            UpdateCohortInputSchema.parse({
                originalName: '2024 Cohort',
                record: { name: '2025 Cohort' },
            })
        ).toThrow();
    });

    it('DeleteCohortResponseSchema accepts an omitted backend success payload', () => {
        expect(DeleteCohortResponseSchema.parse(omittedBackendSuccessPayload)).toBeUndefined();
    });

    it('DeleteCohortResponseSchema rejects unexpected backend success payload data', () => {
        expect(() => DeleteCohortResponseSchema.parse({ deleted: true })).toThrow();
    });

    it.each([
        ['CreateYearGroupInputSchema', () => CreateYearGroupInputSchema.parse({ record: { name: '   ' } })],
        [
            'UpdateYearGroupInputSchema originalName',
            () =>
                UpdateYearGroupInputSchema.parse({
                    originalName: '   ',
                    record: { name: 'Year 10' },
                }),
        ],
        [
            'UpdateYearGroupInputSchema record.name',
            () =>
                UpdateYearGroupInputSchema.parse({
                    originalName: 'Year 9',
                    record: { name: '   ' },
                }),
        ],
        ['DeleteYearGroupInputSchema', () => DeleteYearGroupInputSchema.parse({ name: '' })],
    ])('%s rejects malformed names', (_, parseInvalidInput) => {
        expect(parseInvalidInput).toThrow();
    });

    it('DeleteYearGroupResponseSchema accepts an omitted backend success payload', () => {
        expect(DeleteYearGroupResponseSchema.parse(omittedBackendSuccessPayload)).toBeUndefined();
    });

    it('DeleteYearGroupResponseSchema rejects unexpected backend success payload data', () => {
        expect(() => DeleteYearGroupResponseSchema.parse({ deleted: true })).toThrow();
    });
});

describe('referenceData.zod future keyed schemas', () => {
    it.todo('CohortSchema accepts keyed cohort payloads with academic-year metadata');
    it.todo('CohortSchema rejects empty or whitespace-only keyed names');
    it.todo('CohortSchema rejects backend cohort payloads that omit keyed metadata');
    it.todo('CohortSchema rejects non-boolean active within keyed cohort payloads');
    it.todo('CohortListResponseSchema rejects legacy cohort payloads without key and academic-year metadata');
    it.todo('YearGroupSchema accepts keyed year-group payloads');
    it.todo('CreateCohortInputSchema preserves provided academic-year metadata');
    it.todo('UpdateCohortInputSchema requires key-addressed payloads with the keyed cohort record shape');
    it.todo('DeleteCohortInputSchema accepts only key-addressed identity payloads');
    it.todo('year-group update and delete input schemas require keyed identity');
});
