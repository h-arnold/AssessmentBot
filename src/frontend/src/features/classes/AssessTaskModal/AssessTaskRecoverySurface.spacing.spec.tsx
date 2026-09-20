/**
 * Spacing-contract coverage for the stale-recovery review surface.
 *
 * Alert separation and action-row gaps use the canonical `theme/spacing.ts`
 * constants with explicit token-aligned `Space` sizes instead of raw literals
 * and implicit sizing.
 */

import { describe, expect, it } from 'vitest';
import recoverySurfaceSourceRaw from './AssessTaskRecoverySurface.tsx?raw';

describe('AssessTaskRecoverySurface spacing contract', () => {
  it('separates stacked alerts with the canonical gap constant', () => {
    const source = recoverySurfaceSourceRaw as unknown as string;

    expect(source).toContain('APP_GAP_MD');
    expect(source).not.toContain('marginBottom: 16');
  });

  it('sizes every action row explicitly with canonical space constants', () => {
    const source = recoverySurfaceSourceRaw as unknown as string;

    expect(source).toContain('APP_SPACE_SIZE');
    expect(source).not.toContain('<Space>');
  });
});
