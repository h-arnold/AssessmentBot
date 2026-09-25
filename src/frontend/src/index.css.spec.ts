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

const INDEX_NOT_FOUND = -1;
const LEFT_ZERO_WEIGHT_EDGE = 'inset 2px 0 0 var(--ant-color-text-secondary)';
const RIGHT_ZERO_WEIGHT_EDGE = 'inset -2px 0 0 var(--ant-color-text-secondary)';

/**
 * Read the declaration body for one exact CSS selector.
 *
 * @param {string} selector - Selector to locate in the shared stylesheet.
 * @returns {string | undefined} CSS declarations without the surrounding braces.
 */
function readCssRule(selector: string): string | undefined {
  const ruleStart = appStylesRaw.indexOf(`${selector} {`);
  if (ruleStart === INDEX_NOT_FOUND) {
    return undefined;
  }

  const declarationStart = appStylesRaw.indexOf('{', ruleStart + selector.length) + 1;
  const declarationEnd = appStylesRaw.indexOf('}', declarationStart);
  return declarationEnd === INDEX_NOT_FOUND
    ? undefined
    : appStylesRaw.slice(declarationStart, declarationEnd);
}

/**
 * Find the zero-weight Tooltip target's `:focus-visible` rule.
 *
 * @returns {string | undefined} The selector and declarations, when present.
 */
function findZeroWeightFocusVisibleRule(): string | undefined {
  return appStylesRaw
    .split('}')
    .find((rule) => rule.includes('task-heatmap-zero-weight') && rule.includes(':focus-visible'));
}

describe('task heatmap zero-weight presentation styles', () => {
  it('defines the theme-aware 2px inset edges on the group and both metric boundaries', () => {
    const groupRule = readCssRule('.task-heatmap-zero-weight-group');
    const firstMetricRule = readCssRule('.task-heatmap-zero-weight-first');
    const lastMetricRule = readCssRule('.task-heatmap-zero-weight-last');

    expect(groupRule).toContain(LEFT_ZERO_WEIGHT_EDGE);
    expect(groupRule).toContain(RIGHT_ZERO_WEIGHT_EDGE);
    expect(firstMetricRule).toContain(LEFT_ZERO_WEIGHT_EDGE);
    expect(lastMetricRule).toContain(RIGHT_ZERO_WEIGHT_EDGE);
  });

  it('defines a visible focus indicator for the zero-weight tooltip target', () => {
    const focusVisibleRule = findZeroWeightFocusVisibleRule();
    const declarations = focusVisibleRule?.slice(focusVisibleRule.lastIndexOf('{') + 1);
    const hasVisibleOutline = declarations?.split(';').some((declaration) => {
      const separatorIndex = declaration.indexOf(':');
      if (separatorIndex === INDEX_NOT_FOUND) {
        return false;
      }
      const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
      const value = declaration
        .slice(separatorIndex + 1)
        .trim()
        .toLowerCase();
      if (property === 'outline') {
        return value !== 'none' && !value.startsWith('0');
      }
      return property === 'outline-style' && value !== 'none';
    });

    expect(focusVisibleRule).toBeDefined();
    expect(hasVisibleOutline).toBe(true);
  });
});
