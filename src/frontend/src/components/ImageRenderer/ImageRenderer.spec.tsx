/**
 * Tests for ImageRenderer component (RED phase).
 *
 * Verifies image rendering with base64 data URL, default and custom alt text,
 * and inline style constraints.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImageRenderer } from './ImageRenderer';

const SAMPLE_BASE64 = 'data:image/png;base64,iVBORw0KGgo=';
const DEFAULT_ALT = 'Student response image';
const CUSTOM_ALT = 'Custom alt text';

describe('ImageRenderer', () => {
  it('renders an <img> element with the correct src attribute', () => {
    render(<ImageRenderer src={SAMPLE_BASE64} />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', SAMPLE_BASE64);
  });

  it('renders with the default alt text when no alt prop is passed', () => {
    render(<ImageRenderer src={SAMPLE_BASE64} />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', DEFAULT_ALT);
  });

  it('renders with a custom alt text when the alt prop is provided', () => {
    render(<ImageRenderer src={SAMPLE_BASE64} alt={CUSTOM_ALT} />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', CUSTOM_ALT);
  });

  it('applies the correct inline styles: maxWidth, height, maxHeight', () => {
    render(<ImageRenderer src={SAMPLE_BASE64} />);
    const img = screen.getByRole('img');
    expect(img.style.maxWidth).toBe('100%');
    expect(img.style.height).toBe('auto');
    expect(img.style.maxHeight).toBe('400px');
  });

  it('renders "Invalid image source" and no <img> when src is not an image data URL', () => {
    render(<ImageRenderer src="https://example.com/x.png" />);
    expect(screen.getByText('Invalid image source')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
