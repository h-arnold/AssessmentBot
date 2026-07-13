/**
 * Tests for `MetricPill` — presentational Ant Design Tag for a MetricResult.
 *
 * @see SPEC_CLASS_PAGE_PREPARATION.md lines 299–346
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MetricResult } from '../dataAnalysis.zod';
import {
  createComputedMetricResult,
  createNotAttemptedMetricResult,
  createErrorMetricResult,
} from '../../../test/dataAnalysis/fixtures';
import { MetricPill } from './MetricPill';
import { resolveMetricTone } from './metricTone';

/** Default font size (px) for a non-emphasised Tag. */
const DEFAULT_TAG_FONT_SIZE_PX = 14;

/** Bold font weight used when `emphasised` is true. */
const EMPHASISED_FONT_WEIGHT = 600;

/** Font size (px) for a compact Tag. */
const COMPACT_TAG_FONT_SIZE_PX = 12;

/** Font size (px) for an emphasised Tag. */
const EMPHASISED_TAG_FONT_SIZE_PX = 17.5;

describe('MetricPill', () => {
  // -------------------------------------------------------------------------
  // Computed state rendering
  // -------------------------------------------------------------------------

  it('renders the computed value formatted with default precision of 2', () => {
    const metric: MetricResult = createComputedMetricResult({ value: 3.14 });

    const { container } = render(<MetricPill metric={metric} />);

    const pill = screen.getByText('3.14');
    expect(pill).toBeInTheDocument();

    // Computed values render a continuous gradient (custom HSL) via the
    // filled-tag style rather than a fixed band class.
    const tag = container.querySelector('.ant-tag');
    expect(tag).not.toBeNull();
    expect(tag!.className).toContain('ant-tag-filled');
    expect(tag!.getAttribute('style')).toContain(resolveMetricTone(metric).color);
  });

  // -------------------------------------------------------------------------
  // NotAttempted state rendering
  // -------------------------------------------------------------------------

  it('renders uppercase N for notAttempted metric with default colour and muted opacity', () => {
    const metric: MetricResult = createNotAttemptedMetricResult();

    const { container } = render(<MetricPill metric={metric} />);

    const pill = screen.getByText('N');
    expect(pill).toBeInTheDocument();

    // Default-colour tag must not pick up an unintended colour class
    const tag = container.querySelector('.ant-tag');
    expect(tag).not.toBeNull();
    expect(tag!.className).not.toContain('ant-tag-red');
  });

  // -------------------------------------------------------------------------
  // Error state rendering
  // -------------------------------------------------------------------------

  it('renders uppercase E for error metric with volcano colour', () => {
    const metric: MetricResult = createErrorMetricResult();

    const { container } = render(<MetricPill metric={metric} />);

    const pill = screen.getByText('E');
    expect(pill).toBeInTheDocument();

    // Default errorColor is 'volcano' → ant-tag-volcano class
    const tag = container.querySelector('.ant-tag');
    expect(tag).not.toBeNull();
    expect(tag!.className).toContain('ant-tag-volcano');
  });

  // -------------------------------------------------------------------------
  // Precision prop
  // -------------------------------------------------------------------------

  it('formats a computed value using the precision prop', () => {
    const metric: MetricResult = createComputedMetricResult({ value: 2.718 });

    render(<MetricPill metric={metric} precision={3} />);

    const pill = screen.getByText('2.718');
    expect(pill).toBeInTheDocument();
  });

  it('ignores the precision prop for notAttempted metrics', () => {
    const metric: MetricResult = createNotAttemptedMetricResult();

    render(<MetricPill metric={metric} precision={4} />);

    // Must render literal 'N', not 'N'.toFixed(4)
    const pill = screen.getByText('N');
    expect(pill).toBeInTheDocument();
  });

  it('ignores the precision prop for error metrics', () => {
    const metric: MetricResult = createErrorMetricResult();

    render(<MetricPill metric={metric} precision={4} />);

    // Must render literal 'E', not 'E'.toFixed(4)
    const pill = screen.getByText('E');
    expect(pill).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Emphasised prop
  // -------------------------------------------------------------------------

  it('applies larger font size and bold weight when emphasised is true', () => {
    const metric: MetricResult = createComputedMetricResult({ value: 3.5 });

    const { container } = render(<MetricPill metric={metric} emphasised />);

    const tag = container.querySelector('.ant-tag');
    expect(tag).not.toBeNull();

    const styles = getComputedStyle(tag!);
    // Emphasised: ~1.25x font size and weight 600
    expect(Number.parseFloat(styles.fontSize)).toBeGreaterThan(DEFAULT_TAG_FONT_SIZE_PX);
    expect(Number(styles.fontWeight)).toBe(EMPHASISED_FONT_WEIGHT);
  });

  // -------------------------------------------------------------------------
  // errorColor pass-through
  // -------------------------------------------------------------------------

  it('passes errorColor prop through to resolveMetricTone for error metrics', () => {
    const metric: MetricResult = createErrorMetricResult();

    const { container } = render(<MetricPill metric={metric} errorColor="red" />);

    // When errorColor="red" is passed, the tag should use "red" colour
    const pill = screen.getByText('E');
    expect(pill).toBeInTheDocument();

    const tag = container.querySelector('.ant-tag');
    expect(tag).not.toBeNull();
    expect(tag!.className).toContain('ant-tag-red');
  });

  // -------------------------------------------------------------------------
  // Degraded rendering (notAttempted / error) — pill is never collapsed
  // -------------------------------------------------------------------------

  it('renders the pill for notAttempted metrics without collapsing', () => {
    const metric: MetricResult = createNotAttemptedMetricResult();

    render(<MetricPill metric={metric} />);

    // The pill must not be hidden or have display:none
    const pill = screen.getByText('N');
    expect(pill).toBeInTheDocument();
    expect(pill.closest('.ant-tag')).not.toBeNull();
  });

  it('renders the pill for error metrics without collapsing', () => {
    const metric: MetricResult = createErrorMetricResult();

    render(<MetricPill metric={metric} />);

    // The pill must not be hidden or have display:none
    const pill = screen.getByText('E');
    expect(pill).toBeInTheDocument();
    expect(pill.closest('.ant-tag')).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Compact variant
  // -------------------------------------------------------------------------

  it('renders computed score with 2dp, green band, and compact footprint when compact', () => {
    const metric: MetricResult = createComputedMetricResult({ value: 5 });
    const { container } = render(<MetricPill metric={metric} compact />);

    // Score displayed with 2dp (same precision default)
    const pill = screen.getByText('5.00');
    expect(pill).toBeInTheDocument();

    // Gradient colour for value 5 (dark green end of the 0–5 range)
    const tag = container.querySelector('.ant-tag');
    expect(tag).not.toBeNull();
    expect(tag!.className).toContain('ant-tag-filled');
    expect(tag!.getAttribute('style')).toContain(resolveMetricTone(metric).color);

    // Compact footprint: smaller font (12px) and reduced padding (2px 4px)
    // RED: these fail because `compact` is not yet handled in MetricPill
    expect(Number.parseFloat(getComputedStyle(tag!).fontSize)).toBe(COMPACT_TAG_FONT_SIZE_PX);
    expect(getComputedStyle(tag!).getPropertyValue('padding')).toBe('2px 4px');
  });

  it('renders N with filled band colour for notAttempted when compact', () => {
    const metric: MetricResult = createNotAttemptedMetricResult();

    render(<MetricPill metric={metric} compact />);

    // Literal 'N' — no decimal padding
    const pill = screen.getByText('N');
    expect(pill).toBeInTheDocument();

    const tag = pill.closest('.ant-tag');
    expect(tag).not.toBeNull();
    // Custom grey colour (#434343) renders as ant-tag-filled
    expect(tag!.className).toContain('ant-tag-filled');
  });

  it('renders same colour token as emphasised and introduces no aria-label or role', () => {
    const metric: MetricResult = createComputedMetricResult({ value: 5 });

    const { container: compactContainer } = render(<MetricPill metric={metric} compact />);
    const { container: emphasisedContainer } = render(
      <MetricPill metric={metric} emphasised />
    );

    const compactTag = compactContainer.querySelector('.ant-tag');
    const emphasisedTag = emphasisedContainer.querySelector('.ant-tag');
    expect(compactTag).not.toBeNull();
    expect(emphasisedTag).not.toBeNull();

    // Same gradient colour (dark green) for value 5 in both variants
    expect(compactTag!.className).toContain('ant-tag-filled');
    expect(emphasisedTag!.className).toContain('ant-tag-filled');
    expect(compactTag!.getAttribute('style')).toContain(resolveMetricTone(metric).color);
    expect(emphasisedTag!.getAttribute('style')).toContain(resolveMetricTone(metric).color);

    // v1 signed-off accessibility gap: no aria-label or role on the pill
    expect(compactTag!.getAttribute('aria-label')).toBeNull();
    expect(compactTag!.getAttribute('role')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Emphasised regression
  // -------------------------------------------------------------------------

  it('renders computed score with 2dp, large font, bold weight, and green band when emphasised', () => {
    const metric: MetricResult = createComputedMetricResult({ value: 5 });
    const { container } = render(<MetricPill metric={metric} emphasised />);

    // Score formatted to 2dp
    const pill = screen.getByText('5.00');
    expect(pill).toBeInTheDocument();

    const tag = container.querySelector('.ant-tag');
    expect(tag).not.toBeNull();

    // Gradient colour for value 5 (dark green end of the 0–5 range)
    expect(tag!.className).toContain('ant-tag-filled');
    expect(tag!.getAttribute('style')).toContain(resolveMetricTone(metric).color);

    // Emphasised styling: large font size and bold weight
    expect(Number.parseFloat(getComputedStyle(tag!).fontSize)).toBeCloseTo(
      EMPHASISED_TAG_FONT_SIZE_PX,
      1,
    );
    expect(Number(getComputedStyle(tag!).fontWeight)).toBe(EMPHASISED_FONT_WEIGHT);
  });
});
