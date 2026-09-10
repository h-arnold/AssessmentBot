import { z } from 'zod';

export const AuthorisationStatusSchema = z.boolean();

const ApplicationAccessReasonValues = ['ok', 'freshInstall', 'brokenConfig', 'denied'] as const;
const ApplicationRoleValues = ['admin', 'user'] as const;

/**
 * Transport schema for the gate-exempt `getApplicationAccess` response.
 *
 * @remarks
 * Mirrors `docs/developer/data-shapes/auth-users.md`: the caller's own access
 * state is revealed with the four-value `reason` enum (`'ok'`,
 * `'freshInstall'`, `'brokenConfig'`, `'denied'`) and no `provider` field.
 * `role` is `null` whenever access is not allowed or not yet claimed, and the
 * server-resolved `email` is `''` when blank. `.strict()` keeps the read locked
 * against unrelated backend fields.
 */
export const ApplicationAccessSchema = z
  .object({
    allowed: z.boolean(),
    role: z.enum(ApplicationRoleValues).nullable(),
    email: z.string(),
    reason: z.enum(ApplicationAccessReasonValues),
  })
  .strict();

export type ApplicationAccess = z.infer<typeof ApplicationAccessSchema>;

/**
 * Transport type for one authorised user entry inside the parsed `authUsers` list.
 */
export type AuthUserEntry = z.infer<typeof AuthUserEntrySchema>;

/**
 * Transport type for the role assigned to an authorised user entry.
 */
export type AuthUserRole = AuthUserEntry['role'];

const AuthModeValues = ['googleGroups', 'scriptProperties'] as const;
const AuthUserRoleValues = ['admin', 'user'] as const;

/**
 * Transport schema for one authorised user entry inside the parsed `authUsers`
 * list. Entries are strict: no extra keys and only the two application roles.
 */
const AuthUserEntrySchema = z
  .object({
    email: z.string(),
    role: z.enum(AuthUserRoleValues),
  })
  .strict();

/**
 * Transport schema for the admin-only `getAuthenticationSettings` response.
 *
 * @remarks
 * Mirrors `docs/developer/data-shapes/auth-users.md`: both modes always carry
 * `authGroupEmail`, the parsed `authUsers` list (empty when absent in
 * groups/legacy mode) and `authRevision` (`null` when not applicable). `.strict()`
 * keeps the read locked against unrelated backend fields.
 */
export const AuthenticationSettingsSchema = z
  .object({
    authMode: z.enum(AuthModeValues),
    authGroupEmail: z.string(),
    authUsers: z.array(AuthUserEntrySchema),
    authRevision: z.string().nullable(),
  })
  .strict();

export type AuthenticationSettings = z.infer<typeof AuthenticationSettingsSchema>;

const GoogleGroupsAuthGroupEmailSchema = z.string().trim().min(1, {
  message: 'Auth group email must be non-blank when the mode is googleGroups.',
});

const GoogleGroupsSaveRequestSchema = z
  .object({
    authMode: z.literal('googleGroups'),
    authGroupEmail: GoogleGroupsAuthGroupEmailSchema,
  })
  .strict();

const ScriptPropertiesSaveRequestSchema = z
  .object({
    authMode: z.literal('scriptProperties'),
    authUsers: z.array(AuthUserEntrySchema),
    expectedAuthRevision: z.string().optional(),
  })
  .strict();

/**
 * Transport schema for the admin-only `setAuthenticationSettings` request.
 *
 * @remarks
 * Mirrors `docs/developer/data-shapes/auth-users.md`: the googleGroups variant
 * must omit `authUsers`/`expectedAuthRevision` entirely (the list is not
 * editable there); the scriptProperties variant carries the full candidate
 * `authUsers` list and only supplies `expectedAuthRevision` when a stored
 * revision exists (omitted on the first switch, which seeds `'1'`). `.strict()`
 * on each branch rejects keys that belong to the other mode.
 */
export const SetAuthenticationSettingsRequestSchema = z.discriminatedUnion('authMode', [
  ScriptPropertiesSaveRequestSchema,
  GoogleGroupsSaveRequestSchema,
]);

export type SetAuthenticationSettingsRequest = z.infer<
  typeof SetAuthenticationSettingsRequestSchema
>;

/**
 * Transport schema for the `setAuthenticationSettings` commit result.
 *
 * @remarks
 * The backend returns `{ success: true, authRevision }` on commit; the new
 * revision is a positive-integer string in scriptProperties mode and `null` in
 * googleGroups mode. Transport-level failures use the shared error envelope
 * rather than this schema.
 */
export const SetAuthenticationSettingsResultSchema = z
  .object({
    success: z.literal(true),
    authRevision: z.string().nullable(),
  })
  .strict();

export type SetAuthenticationSettingsResult = z.infer<typeof SetAuthenticationSettingsResultSchema>;
