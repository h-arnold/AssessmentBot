import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

type ReferenceDataSchemasModule = typeof import('./referenceData.zod');

async function loadReferenceDataSchemas(): Promise<ReferenceDataSchemasModule> {
    try {
        return await import('./referenceData.zod');
    } catch (error) {
        throw new Error(
            'Expected ./referenceData.zod.ts to exist beside the service module and export the Section 4 reference-data schemas.',
            { cause: error as Error }
        );
    }
}

async function readReferenceDataSchemaSource(): Promise<string> {
    try {
        return await readFile(new URL('./referenceData.zod.ts', import.meta.url), 'utf8');
    } catch (error) {
        throw new Error(
            'Expected ./referenceData.zod.ts to exist so the frontend can define adjacent Zod schemas for reference data.',
            { cause: error as Error }
        );
    }
}

describe('referenceData.zod schemas', () => {
    it('derives exported frontend types from schemas with z.infer<typeof ...>', async () => {
        const source = await readReferenceDataSchemaSource();

        expect(source).toMatch(/export\s+type\s+Cohort\s*=\s*z\.infer<typeof\s+CohortSchema>/);
        expect(source).toMatch(
            /export\s+type\s+CreateCohortInput\s*=\s*z\.infer<typeof\s+CreateCohortInputSchema>/
        );
        expect(source).toMatch(
            /export\s+type\s+UpdateCohortInput\s*=\s*z\.infer<typeof\s+UpdateCohortInputSchema>/
        );
        expect(source).toMatch(
            /export\s+type\s+DeleteCohortInput\s*=\s*z\.infer<typeof\s+DeleteCohortInputSchema>/
        );
        expect(source).toMatch(
            /export\s+type\s+YearGroup\s*=\s*z\.infer<typeof\s+YearGroupSchema>/
        );
        expect(source).toMatch(
            /export\s+type\s+CreateYearGroupInput\s*=\s*z\.infer<typeof\s+CreateYearGroupInputSchema>/
        );
        expect(source).toMatch(
            /export\s+type\s+UpdateYearGroupInput\s*=\s*z\.infer<typeof\s+UpdateYearGroupInputSchema>/
        );
        expect(source).toMatch(
            /export\s+type\s+DeleteYearGroupInput\s*=\s*z\.infer<typeof\s+DeleteYearGroupInputSchema>/
        );
    });

    it('CohortSchema accepts { name: "Year 7", active: true }', async () => {
        const { CohortSchema } = await loadReferenceDataSchemas();

        expect(CohortSchema.parse({ name: 'Year 7', active: true })).toEqual({
            name: 'Year 7',
            active: true,
        });
    });

    it.each(['', '   '])('CohortSchema rejects empty or whitespace-only names: %j', async (name) => {
        const { CohortSchema } = await loadReferenceDataSchemas();

        expect(() => CohortSchema.parse({ name, active: true })).toThrow();
    });

    it('CohortSchema rejects non-boolean active', async () => {
        const { CohortSchema } = await loadReferenceDataSchemas();

        expect(() => CohortSchema.parse({ name: 'Year 7', active: 'yes' })).toThrow();
    });

    it('YearGroupSchema accepts { name: "Year 10" }', async () => {
        const { YearGroupSchema } = await loadReferenceDataSchemas();

        expect(YearGroupSchema.parse({ name: 'Year 10' })).toEqual({ name: 'Year 10' });
    });

    it.each(['', '   '])(
        'YearGroupSchema rejects empty or whitespace-only names: %j',
        async (name) => {
            const { YearGroupSchema } = await loadReferenceDataSchemas();

            expect(() => YearGroupSchema.parse({ name })).toThrow();
        }
    );

    it('CreateCohortInputSchema accepts omitted active', async () => {
        const { CreateCohortInputSchema } = await loadReferenceDataSchemas();

        expect(CreateCohortInputSchema.parse({ record: { name: 'Year 7' } })).toEqual({
            record: { name: 'Year 7' },
        });
    });

    it('UpdateCohortInputSchema requires originalName and a valid cohort record payload', async () => {
        const { UpdateCohortInputSchema } = await loadReferenceDataSchemas();

        expect(
            UpdateCohortInputSchema.parse({
                originalName: 'Year 7',
                record: { name: 'Year 8', active: false },
            })
        ).toEqual({
            originalName: 'Year 7',
            record: { name: 'Year 8', active: false },
        });

        expect(() => UpdateCohortInputSchema.parse({ record: { name: 'Year 8', active: true } })).toThrow();
        expect(() =>
            UpdateCohortInputSchema.parse({
                originalName: 'Year 7',
                record: { name: '   ', active: true },
            })
        ).toThrow();
    });

    it.each(['', '   '])('DeleteCohortInputSchema rejects empty names: %j', async (name) => {
        const { DeleteCohortInputSchema } = await loadReferenceDataSchemas();

        expect(() => DeleteCohortInputSchema.parse({ name })).toThrow();
    });

    it('yearGroup create, update, and delete input schemas reject malformed names', async () => {
        const {
            CreateYearGroupInputSchema,
            UpdateYearGroupInputSchema,
            DeleteYearGroupInputSchema,
        } = await loadReferenceDataSchemas();

        expect(() => CreateYearGroupInputSchema.parse({ record: { name: '   ' } })).toThrow();
        expect(() =>
            UpdateYearGroupInputSchema.parse({
                originalName: 'Year 9',
                record: { name: '' },
            })
        ).toThrow();
        expect(() => DeleteYearGroupInputSchema.parse({ name: '   ' })).toThrow();
    });
});