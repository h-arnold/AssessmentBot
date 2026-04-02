import { z } from 'zod';

export const TeacherSummarySchema = z.object({
    userId: z.string().nullable(),
    email: z.string().nullable(),
    teacherName: z.string().nullable().optional().transform((value) => value ?? null),
});

export type TeacherSummary = z.infer<typeof TeacherSummarySchema>;

/**
 * Shape of a class partial document returned by the backend transport.
 * Teacher-bearing fields use TeacherSummary rather than the full Teacher model.
 */
export const ClassPartialSchema = z.object({
    classId: z.string(),
    className: z.string().nullable(),
    cohortKey: z.string().nullable(),
    cohortLabel: z.string().nullable(),
    courseLength: z.number(),
    yearGroupKey: z.string().nullable(),
    yearGroupLabel: z.string().nullable(),
    classOwner: TeacherSummarySchema.nullable(),
    teachers: z.array(TeacherSummarySchema),
    active: z.boolean().nullable(),
});

export type ClassPartial = z.infer<typeof ClassPartialSchema>;

export const ClassPartialsResponseSchema = z.array(ClassPartialSchema);

export type ClassPartialsResponse = z.infer<typeof ClassPartialsResponseSchema>;
