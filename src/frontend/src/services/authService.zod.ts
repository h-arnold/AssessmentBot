import { z } from 'zod';

export const AuthorisationStatusSchema = z.boolean();

export type AuthorisationStatus = z.infer<typeof AuthorisationStatusSchema>;
