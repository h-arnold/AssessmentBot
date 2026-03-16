import { z } from 'zod';

export const TeacherSummarySchema = z.object({
    userId: z.string().nullable(),
    email: z.string().nullable(),
    teacherName: z.string().nullable(),
});

export type TeacherSummary = z.infer<typeof TeacherSummarySchema>;

/**
 * Shape of a class partial document returned by the backend transport.
 * Teacher-bearing fields use TeacherSummary rather than the full Teacher model.
 */
export const ClassPartialSchema = z.object({
    classId: z.string(),
    className: z.string().nullable(),
    cohort: z.string().nullable(),
    courseLength: z.number(),
    yearGroup: z.number().nullable(),
    classOwner: TeacherSummarySchema.nullable(),
    teachers: z.array(TeacherSummarySchema),
    active: z.boolean().nullable(),
});

export type ClassPartial = z.infer<typeof ClassPartialSchema>;

export const ClassPartialsResponseSchema = z.array(ClassPartialSchema);

export type ClassPartialsResponse = z.infer<typeof ClassPartialsResponseSchema>;
