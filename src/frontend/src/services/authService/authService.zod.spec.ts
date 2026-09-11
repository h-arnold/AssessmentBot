import { describe, expect, it } from 'vitest';
import {
  ApplicationAccessSchema,
  AuthenticationSettingsSchema,
  SetAuthenticationSettingsRequestSchema,
  SetAuthenticationSettingsResultSchema,
} from './authService.zod';

/**
 * Contract tests for the typed auth endpoint Zod schemas that back the
 * `getApplicationAccess`, `getAuthenticationSettings` and
 * `setAuthenticationSettings` services.
 *
 * The schemas under test live in `authService.zod.ts` and mirror the exact
 * `docs/developer/data-shapes/auth-users.md` transport shapes: the four-value
 * `reason` enum with no `'unconfigured'` and no `provider` field, nullable
 * `role`, the settings read/write variants, and the first-switch omission of
 * `expectedAuthRevision`. The assertions lock that implemented contract in
 * place so any drift from the canonical shapes fails loudly.
 */

const adminEmail = 'teacher@school.edu';
const learnerEmail = 'learner@school.edu';
const groupEmail = 'staff@school.edu';

const adminEntry = { email: adminEmail, role: 'admin' };
const learnerEntry = { email: learnerEmail, role: 'user' };

const okAdminApplicationAccess = {
  allowed: true,
  role: 'admin',
  email: adminEmail,
  reason: 'ok',
};

const okUserApplicationAccess = {
  allowed: true,
  role: 'user',
  email: learnerEmail,
  reason: 'ok',
};

const freshInstallBlankCallerAccess = {
  allowed: false,
  role: null,
  email: '',
  reason: 'freshInstall',
};

const brokenConfigApplicationAccess = {
  allowed: false,
  role: null,
  email: adminEmail,
  reason: 'brokenConfig',
};

const deniedApplicationAccess = {
  allowed: false,
  role: null,
  email: adminEmail,
  reason: 'denied',
};

const scriptPropertiesSettingsRead = {
  authMode: 'scriptProperties',
  authGroupEmail: groupEmail,
  authUsers: [adminEntry, learnerEntry],
  authRevision: '7',
};

const googleGroupsSettingsRead = {
  authMode: 'googleGroups',
  authGroupEmail: groupEmail,
  authUsers: [],
  authRevision: null,
};

const scriptPropertiesSaveRequest = {
  authMode: 'scriptProperties',
  authUsers: [adminEntry, learnerEntry],
  expectedAuthRevision: '3',
};

const firstSwitchScriptPropertiesSaveRequest = {
  authMode: 'scriptProperties',
  authUsers: [adminEntry],
};

const googleGroupsSaveRequest = {
  authMode: 'googleGroups',
  authGroupEmail: groupEmail,
};

describe('authService.zod schemas', () => {
  describe('ApplicationAccessSchema', () => {
    it('accepts an ok response with the admin role', () => {
      expect(ApplicationAccessSchema.parse(okAdminApplicationAccess)).toEqual(
        okAdminApplicationAccess
      );
    });

    it('accepts an ok response with the user role', () => {
      expect(ApplicationAccessSchema.parse(okUserApplicationAccess)).toEqual(
        okUserApplicationAccess
      );
    });

    it('accepts a freshInstall response with a null role and a blank server-resolved email', () => {
      expect(ApplicationAccessSchema.parse(freshInstallBlankCallerAccess)).toEqual(
        freshInstallBlankCallerAccess
      );
    });

    it('accepts a brokenConfig response with a null role', () => {
      expect(ApplicationAccessSchema.parse(brokenConfigApplicationAccess)).toEqual(
        brokenConfigApplicationAccess
      );
    });

    it('accepts a denied response with a null role', () => {
      expect(ApplicationAccessSchema.parse(deniedApplicationAccess)).toEqual(
        deniedApplicationAccess
      );
    });

    it('rejects a response with an unrecognised reason', () => {
      const result = ApplicationAccessSchema.safeParse({
        ...deniedApplicationAccess,
        reason: 'unconfigured',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a response whose role is not an allowed application role', () => {
      const result = ApplicationAccessSchema.safeParse({
        ...okAdminApplicationAccess,
        role: 'owner',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a response that omits the role field', () => {
      const withoutRole = {
        allowed: true,
        email: adminEmail,
        reason: 'ok',
      };
      const result = ApplicationAccessSchema.safeParse(withoutRole);
      expect(result.success).toBe(false);
    });

    it('rejects a response that omits the email field', () => {
      const withoutEmail = {
        allowed: true,
        role: 'admin',
        reason: 'ok',
      };
      const result = ApplicationAccessSchema.safeParse(withoutEmail);
      expect(result.success).toBe(false);
    });

    it('rejects a response that carries a provider field (strict lockstep)', () => {
      const result = ApplicationAccessSchema.safeParse({
        ...okAdminApplicationAccess,
        provider: 'googleGroups',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('AuthenticationSettingsSchema', () => {
    it('accepts the scriptProperties settings read with parsed users and the revision', () => {
      expect(AuthenticationSettingsSchema.parse(scriptPropertiesSettingsRead)).toEqual(
        scriptPropertiesSettingsRead
      );
    });

    it('accepts the googleGroups settings read with an empty user list and a null revision', () => {
      expect(AuthenticationSettingsSchema.parse(googleGroupsSettingsRead)).toEqual(
        googleGroupsSettingsRead
      );
    });

    it('rejects a settings read with an unrecognised authMode', () => {
      const result = AuthenticationSettingsSchema.safeParse({
        ...googleGroupsSettingsRead,
        authMode: 'none',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a settings read whose authUsers entry carries an unknown key', () => {
      const result = AuthenticationSettingsSchema.safeParse({
        ...scriptPropertiesSettingsRead,
        authUsers: [{ ...adminEntry, extra: true }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects a scriptProperties settings read with a non-string authRevision', () => {
      const result = AuthenticationSettingsSchema.safeParse({
        ...scriptPropertiesSettingsRead,
        authRevision: 7,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('SetAuthenticationSettingsRequestSchema', () => {
    it('accepts a scriptProperties save request with an expectedAuthRevision', () => {
      expect(SetAuthenticationSettingsRequestSchema.parse(scriptPropertiesSaveRequest)).toEqual(
        scriptPropertiesSaveRequest
      );
    });

    it('accepts a first-switch scriptProperties save request that omits expectedAuthRevision', () => {
      expect(
        SetAuthenticationSettingsRequestSchema.parse(firstSwitchScriptPropertiesSaveRequest)
      ).toEqual(firstSwitchScriptPropertiesSaveRequest);
    });

    it('accepts a googleGroups save request that omits authUsers and expectedAuthRevision', () => {
      expect(SetAuthenticationSettingsRequestSchema.parse(googleGroupsSaveRequest)).toEqual(
        googleGroupsSaveRequest
      );
    });

    it('rejects a googleGroups save request that supplies authUsers (must be omitted)', () => {
      const result = SetAuthenticationSettingsRequestSchema.safeParse({
        ...googleGroupsSaveRequest,
        authUsers: [adminEntry],
      });
      expect(result.success).toBe(false);
    });

    it('rejects a googleGroups save request with a blank authGroupEmail', () => {
      const result = SetAuthenticationSettingsRequestSchema.safeParse({
        authMode: 'googleGroups',
        authGroupEmail: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a save request with an unrecognised authMode', () => {
      const result = SetAuthenticationSettingsRequestSchema.safeParse({
        authMode: 'none',
        authGroupEmail: groupEmail,
      });
      expect(result.success).toBe(false);
    });

    it('rejects a scriptProperties save request without a full candidate authUsers list', () => {
      const result = SetAuthenticationSettingsRequestSchema.safeParse({
        authMode: 'scriptProperties',
        expectedAuthRevision: '3',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a scriptProperties save request whose candidate list has no administrator', () => {
      const result = SetAuthenticationSettingsRequestSchema.safeParse({
        authMode: 'scriptProperties',
        authUsers: [{ email: learnerEmail, role: 'user' }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects a scriptProperties save request with an empty candidate list', () => {
      const result = SetAuthenticationSettingsRequestSchema.safeParse({
        authMode: 'scriptProperties',
        authUsers: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects a scriptProperties save request whose candidate entry has an unknown role', () => {
      const result = SetAuthenticationSettingsRequestSchema.safeParse({
        authMode: 'scriptProperties',
        authUsers: [{ email: adminEmail, role: 'owner' }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('SetAuthenticationSettingsResultSchema', () => {
    it('accepts a scriptProperties commit result with the new revision', () => {
      const result = { success: true, authRevision: '4' };
      expect(SetAuthenticationSettingsResultSchema.parse(result)).toEqual(result);
    });

    it('accepts a googleGroups commit result with a null revision', () => {
      const result = { success: true, authRevision: null };
      expect(SetAuthenticationSettingsResultSchema.parse(result)).toEqual(result);
    });

    it('rejects a commit result that omits authRevision', () => {
      const result = SetAuthenticationSettingsResultSchema.safeParse({ success: true });
      expect(result.success).toBe(false);
    });
  });
});
