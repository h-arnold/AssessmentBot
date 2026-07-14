/**
 * Tests for MetricIconLabel component.
 *
 * Verifies icon rendering, tooltip display, accessibility attributes,
 * and theme-aware colour styling.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ListTodo } from 'lucide-react';
import { MetricIconLabel } from './MetricIconLabel';

describe('MetricIconLabel', () => {
  const defaultProperties = {
    icon: ListTodo,
    label: 'Completeness',
  };

  it('renders an SVG icon with the correct aria-label', () => {
    render(<MetricIconLabel {...defaultProperties} />);
    const icon = screen.getByLabelText('Completeness');
    expect(icon).toBeInTheDocument();
    // happy-dom returns lowercase tagName for SVG elements
    expect(icon.tagName).toBe('svg');
  });

  it('sets aria-label for accessibility', () => {
    render(<MetricIconLabel {...defaultProperties} />);
    expect(screen.getByLabelText('Completeness')).toBeInTheDocument();
  });

  it('shows tooltip with label on hover', async () => {
    const user = userEvent.setup();
    render(<MetricIconLabel {...defaultProperties} />);

    // Tooltip overlay is not visible initially
    expect(screen.queryByText('Completeness')).not.toBeInTheDocument();

    // Hover over the icon to trigger tooltip display
    await user.hover(screen.getByLabelText('Completeness'));

    // Tooltip text should appear after the mouse enter delay
    expect(await screen.findByText('Completeness', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('the wrapper span has inline-flex display style', () => {
    render(<MetricIconLabel {...defaultProperties} />);
    const icon = screen.getByLabelText('Completeness');
    const wrapper = icon.closest('span')!;
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveStyle('display: inline-flex');
  });

  it('the wrapper span has a colour derived from the theme token', () => {
    render(<MetricIconLabel {...defaultProperties} />);
    const icon = screen.getByLabelText('Completeness');
    const wrapper = icon.closest('span')!;
    expect(wrapper).toBeInTheDocument();

    // Colour should be a non-empty CSS value derived from the theme
    expect(wrapper.style.color).toBeTruthy();

    // Should NOT be the old hardcoded black
    expect(wrapper.style.color).not.toBe('#000000');
  });

  it('icon receives size and strokeWidth props passed to createElement', () => {
    render(<MetricIconLabel {...defaultProperties} />);
    const icon = screen.getByLabelText('Completeness');

    // Lucide renders size as width/height attributes on the SVG
    expect(icon).toHaveAttribute('width', '20');
    expect(icon).toHaveAttribute('height', '20');

    // Lucide renders strokeWidth as stroke-width attribute on the SVG
    expect(icon).toHaveAttribute('stroke-width', '1.5');
  });
});
