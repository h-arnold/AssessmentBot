import { describe, expect, it } from 'vitest';
import loadingAndWidthStandards from '../../../docs/developer/frontend/frontend-loading-and-width-standards.md?raw';
import { appStylesRaw } from './test/appStylesRaw';

/**
 * Returns documented shared modal-width tokens from frontend standards.
 *
 * @returns {string[]} Unique shared modal-width token names.
 */
function getDocumentedSharedModalWidthTokens(): string[] {
  const modalWidthTokens = loadingAndWidthStandards.match(/--app-modal-width-[\da-z-]+/g) ?? [];

  return [...new Set(modalWidthTokens)];
}

describe('shared modal width standards', () => {
  it('documents one centralised shared modal-width exception token', () => {
    expect(getDocumentedSharedModalWidthTokens()).toHaveLength(1);
  });

  it('keeps the documented shared modal-width exception token defined in the shared stylesheet', () => {
    const [sharedModalWidthToken] = getDocumentedSharedModalWidthTokens();

    expect(sharedModalWidthToken).toBeTypeOf('string');
    expect(appStylesRaw).toContain(`${sharedModalWidthToken}:`);
  });
});
