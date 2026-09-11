/**
 * Unit tests for the pure authentication-settings save-error mapping helpers.
 *
 * These specs exercise `mapAuthenticationSettingsSaveError` directly so every
 * branch — including the mode-dependent saving-admin denial copy and the
 * generic fallbacks for unmapped transport codes and non-local `ZodError`
 * issues — has focused regression coverage independent of the mounted tab.
 */

import { ZodError } from 'zod';
import { describe, expect, it } from 'vitest';
import { ApiTransportError } from '../../../errors/apiTransportError';
import {
  mapAuthenticationSettingsSaveError,
  type AuthenticationSettingsSaveErrorMapping,
} from './useAuthenticationSettings.helpers';

const genericSaveErrorMessage = 'Unable to save authentication settings right now.';
const rateLimitedErrorMessage = 'The service is busy. Please try again shortly.';
const staleRevisionWarningMessage =
  'Another administrator saved first. Review and re-save your changes.';
const lastAdminErrorMessage = 'At least one admin must remain. Review the user list and try again.';
const invalidCandidateErrorMessage =
  'The candidate list is invalid. Review the authorised users and try again.';
const scriptPropertiesSavingAdminDeniedMessage =
  'Your admin access is missing from the candidate list. Add yourself as an admin and try again.';
const googleGroupsSavingAdminDeniedMessage =
  'Your group role does not grant access. You must be an OWNER or MANAGER of the Google Group; ask a group owner to update your role, then try again.';

/**
 * Builds the transport error the save-failure mapping is exercised with.
 *
 * @param {string} code The stable backend error code.
 * @returns {ApiTransportError} The transport error under test.
 */
function createTransportError(code: string): ApiTransportError {
  return new ApiTransportError({
    requestId: `req-${code.toLowerCase()}`,
    error: { code, message: 'Raw backend prose that must never be rendered.' },
  });
}

/**
 * Builds the generic (non-preserved-path) `ZodError` the save-failure mapping
 * is exercised with.
 *
 * @returns {ZodError} A `ZodError` whose issues carry no locally preserved field path.
 */
function createUnmappedZodError(): ZodError {
  return new ZodError([
    {
      code: 'custom',
      message: 'Malformed transport response payload.',
      path: ['authRevision'],
    },
  ]);
}

describe('mapAuthenticationSettingsSaveError saving-admin denial copy', () => {
  it('returns the candidate-list recovery copy for a scriptProperties saving-admin denial', () => {
    const mapping = mapAuthenticationSettingsSaveError(
      createTransportError('AUTH_SETTINGS_SAVING_ADMIN_DENIED'),
      'scriptProperties'
    );

    expect(mapping).toEqual<AuthenticationSettingsSaveErrorMapping>({
      message: scriptPropertiesSavingAdminDeniedMessage,
      isStaleRevision: false,
    });
  });

  it('returns the group-role recovery copy for a googleGroups saving-admin denial', () => {
    const mapping = mapAuthenticationSettingsSaveError(
      createTransportError('AUTH_SETTINGS_SAVING_ADMIN_DENIED'),
      'googleGroups'
    );

    expect(mapping).toEqual<AuthenticationSettingsSaveErrorMapping>({
      message: googleGroupsSavingAdminDeniedMessage,
      isStaleRevision: false,
    });
  });

  it('never renders the raw backend saving-admin prose', () => {
    const mapping = mapAuthenticationSettingsSaveError(
      createTransportError('AUTH_SETTINGS_SAVING_ADMIN_DENIED'),
      'scriptProperties'
    );

    expect(mapping.message).not.toContain('Raw backend prose');
  });
});

describe('mapAuthenticationSettingsSaveError mapped transport codes', () => {
  it('maps stale-revision and revision-required codes to the persistent stale warning', () => {
    for (const code of ['AUTH_SETTINGS_STALE_REVISION', 'AUTH_SETTINGS_REVISION_REQUIRED']) {
      expect(
        mapAuthenticationSettingsSaveError(createTransportError(code), 'scriptProperties')
      ).toEqual({
        message: staleRevisionWarningMessage,
        isStaleRevision: true,
      });
    }
  });

  it('maps the last-admin code to the at-least-one-admin copy', () => {
    expect(
      mapAuthenticationSettingsSaveError(
        createTransportError('AUTH_SETTINGS_LAST_ADMIN'),
        'scriptProperties'
      )
    ).toEqual({ message: lastAdminErrorMessage, isStaleRevision: false });
  });

  it('maps the invalid-candidate code to the neutral invalid-candidate copy', () => {
    const mapping = mapAuthenticationSettingsSaveError(
      createTransportError('AUTH_SETTINGS_INVALID_CANDIDATE'),
      'scriptProperties'
    );

    expect(mapping).toEqual({
      message: invalidCandidateErrorMessage,
      isStaleRevision: false,
    });
    expect(mapping.message).not.toContain('missing from the candidate list');
  });

  it('maps the rate-limited code to the busy/service copy', () => {
    expect(
      mapAuthenticationSettingsSaveError(createTransportError('RATE_LIMITED'), 'scriptProperties')
    ).toEqual({ message: rateLimitedErrorMessage, isStaleRevision: false });
  });
});

describe('mapAuthenticationSettingsSaveError generic fallbacks', () => {
  it('falls back to generic save copy for a transport error carrying an unmapped stable code', () => {
    const mapping = mapAuthenticationSettingsSaveError(
      createTransportError('AUTH_SETTINGS_UNRECOGNISED_CODE'),
      'scriptProperties'
    );

    expect(mapping).toEqual({ message: genericSaveErrorMessage, isStaleRevision: false });
    expect(mapping.message).not.toContain('Raw backend prose');
  });

  it('falls back to generic save copy for a ZodError outside the preserved local validation paths', () => {
    const mapping = mapAuthenticationSettingsSaveError(
      createUnmappedZodError(),
      'scriptProperties'
    );

    expect(mapping).toEqual({ message: genericSaveErrorMessage, isStaleRevision: false });
    expect(mapping.message).not.toContain('Malformed transport response payload');
  });

  it('surfaces the targeted message for a preserved local validation path', () => {
    const localZodError = new ZodError([
      {
        code: 'custom',
        message: 'Auth group email must be non-blank when the mode is googleGroups.',
        path: ['authGroupEmail'],
      },
    ]);

    expect(mapAuthenticationSettingsSaveError(localZodError, 'googleGroups')).toEqual({
      message: 'Auth group email must be non-blank when the mode is googleGroups.',
      isStaleRevision: false,
    });
  });

  it('recognises a preserved local path nested inside the candidate user list', () => {
    const localZodError = new ZodError([
      {
        code: 'custom',
        message: 'At least one administrator is required.',
        path: ['authUsers', 0, 'role'],
      },
    ]);

    expect(mapAuthenticationSettingsSaveError(localZodError, 'scriptProperties')).toEqual({
      message: 'At least one administrator is required.',
      isStaleRevision: false,
    });
  });

  it('falls back to generic save copy for a plain Error carrying no transport code', () => {
    expect(
      mapAuthenticationSettingsSaveError(
        new Error('Another administrator saved first. Review and re-save your changes.'),
        'scriptProperties'
      )
    ).toEqual({ message: genericSaveErrorMessage, isStaleRevision: false });
  });
});
