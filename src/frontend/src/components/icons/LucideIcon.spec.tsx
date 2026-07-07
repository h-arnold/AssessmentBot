import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Plus } from 'lucide-react';
import { LucideIcon } from './LucideIcon';

describe('LucideIcon', () => {
  describe('sizing', () => {
    it('renders with default size of 1em when no size is given', () => {
      const { container } = render(<LucideIcon icon={Plus} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '1em');
      expect(svg).toHaveAttribute('height', '1em');
    });

    it('forwards an explicit numeric size to the SVG', () => {
      const { container } = render(<LucideIcon icon={Plus} size={24} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '24');
      expect(svg).toHaveAttribute('height', '24');
    });

    it('forwards an explicit string size to the SVG', () => {
      const { container } = render(<LucideIcon icon={Plus} size="2em" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '2em');
      expect(svg).toHaveAttribute('height', '2em');
    });
  });

  describe('spin', () => {
    it('adds anticon-spin class when spin is true', () => {
      const { container } = render(<LucideIcon icon={Plus} spin />);
      const wrapper = container.querySelector('span.anticon');
      expect(wrapper).toBeInTheDocument();
      expect(wrapper).toHaveClass('anticon-spin');
    });

    it('does not add anticon-spin class when spin is not set', () => {
      const { container } = render(<LucideIcon icon={Plus} />);
      const wrapper = container.querySelector('span.anticon');
      expect(wrapper).not.toHaveClass('anticon-spin');
    });
  });

  describe('rotate', () => {
    it('forwards rotate to the SVG element as a transform', () => {
      const { container } = render(<LucideIcon icon={Plus} rotate={90} />);
      const svg = container.querySelector('svg');
      // antd v6 passes the rotate prop through to the custom component,
      // which results in style="transform: rotate(90deg)" on the SVG.
      expect(svg).toHaveStyle('transform: rotate(90deg)');
    });

    it('does not apply rotate transform when rotate is not set', () => {
      const { container } = render(<LucideIcon icon={Plus} />);
      const svg = container.querySelector('svg');
      expect(svg).not.toHaveStyle('transform: rotate(90deg)');
    });
  });

  describe('colour and strokeWidth forwarding', () => {
    it('forwards color prop to the SVG as stroke', () => {
      const { container } = render(<LucideIcon icon={Plus} color="red" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('stroke', 'red');
    });

    it('uses currentColor as the default stroke', () => {
      const { container } = render(<LucideIcon icon={Plus} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('stroke', 'currentColor');
    });

    it('forwards strokeWidth prop to the SVG', () => {
      const { container } = render(<LucideIcon icon={Plus} strokeWidth={3} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('stroke-width', '3');
    });
  });

  describe('accessibility', () => {
    it('sets aria-label on the wrapper when title is supplied', () => {
      const { container } = render(<LucideIcon icon={Plus} title="Add" />);
      const wrapper = container.querySelector('span.anticon');
      expect(wrapper).toHaveAttribute('aria-label', 'Add');
    });

    it('sets aria-hidden on the wrapper when title is omitted', () => {
      const { container } = render(<LucideIcon icon={Plus} />);
      const wrapper = container.querySelector('span.anticon');
      expect(wrapper).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
