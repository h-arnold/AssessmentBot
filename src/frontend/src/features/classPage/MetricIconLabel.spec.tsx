/**
 * Tests for MetricIconLabel — accessible metric icon with tooltip.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { Check } from 'lucide-react';
import { MetricIconLabel } from './MetricIconLabel';

describe('MetricIconLabel', () => {
  const label = 'Completeness';
  const icon = Check;

  // -------------------------------------------------------------------------
  // aria-label
  // -------------------------------------------------------------------------
  it('renders the icon with the correct aria-label', () => {
    render(<MetricIconLabel icon={icon} label={label} />);

    expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // SVG structure
  // -------------------------------------------------------------------------
  it('renders the icon as an SVG element with correct dimensions and stroke width', () => {
    render(<MetricIconLabel icon={icon} label={label} />);

    const svg = screen.getByLabelText(label);
    expect(svg.tagName).toBe('svg');
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveAttribute('height', '20');
    expect(svg).toHaveAttribute('stroke-width', '1.5');
  });

  // -------------------------------------------------------------------------
  // Wrapper span styles
  // -------------------------------------------------------------------------
  it('wraps the icon in a span with expected inline styles', () => {
    render(<MetricIconLabel icon={icon} label={label} />);

    const svg = screen.getByLabelText(label);
    const wrapper = svg.closest('span');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveStyle({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    });
  });

  // -------------------------------------------------------------------------
  // Theme token colour (default)
  // -------------------------------------------------------------------------
  it('applies a non-empty theme colour on the wrapper span', () => {
    render(<MetricIconLabel icon={icon} label={label} />);

    const svg = screen.getByLabelText(label);
    const wrapper = svg.closest('span');
    // token.colorText resolves to a non-empty CSS colour from the default theme
    expect(wrapper!.style.color).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Theme token colour (custom ConfigProvider)
  // -------------------------------------------------------------------------
  it('adapts the icon colour when rendered inside a custom ConfigProvider theme', () => {
    const customColor = 'rgb(255, 0, 0)';
    render(
      <ConfigProvider theme={{ token: { colorText: customColor } }}>
        <MetricIconLabel icon={icon} label={label} />
      </ConfigProvider>,
    );

    const svg = screen.getByLabelText(label);
    const wrapper = svg.closest('span');
    expect(wrapper).toHaveStyle({ color: customColor });
  });
});
