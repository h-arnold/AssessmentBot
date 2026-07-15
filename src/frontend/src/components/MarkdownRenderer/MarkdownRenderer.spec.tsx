/**
 * Tests for MarkdownRenderer component (RED phase).
 *
 * Verifies markdown rendering via react-markdown + remark-gfm:
 * plain text, bold/italic, tables, HTML escaping, and lists.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownRenderer } from './MarkdownRenderer';

const TABLE_ROW_COUNT = 2;
const TABLE_DATA_CELL_COUNT = 2;
const LIST_ITEM_COUNT = 2;

describe('MarkdownRenderer', () => {
  it('renders plain text markdown as a paragraph', () => {
    render(<MarkdownRenderer>Hello world</MarkdownRenderer>);
    const paragraph = screen.getByText('Hello world');
    expect(paragraph).toBeInTheDocument();
    expect(paragraph.tagName).toBe('P');
  });

  it('renders bold and italic text', () => {
    render(<MarkdownRenderer>**bold** and *italic*</MarkdownRenderer>);
    const bold = screen.getByText('bold');
    const italic = screen.getByText('italic');
    expect(bold.tagName).toBe('STRONG');
    expect(italic.tagName).toBe('EM');
  });

  it('renders a GFM table with correct structure', () => {
    const tableMarkdown = '| A | B |\n|---|---|\n| 1 | 2 |';
    render(<MarkdownRenderer>{tableMarkdown}</MarkdownRenderer>);
    const table = document.querySelector('table');
    expect(table).toBeInTheDocument();
    expect(table!.querySelectorAll('tr')).toHaveLength(TABLE_ROW_COUNT); // header + one data row
    expect(table!.querySelectorAll('td')).toHaveLength(TABLE_DATA_CELL_COUNT);
    expect(table!.querySelector('td')).toHaveTextContent('1');
  });

  it('escapes raw HTML — does not render a <script> element', () => {
    render(<MarkdownRenderer>{'<script>alert(1)</script>'}</MarkdownRenderer>);
    // The script tag should NOT be in the DOM as an element
    expect(document.querySelector('script')).not.toBeInTheDocument();
    // The text content should be present as escaped text
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
  });

  it('renders an ordered list with <ol> and <li> elements', () => {
    render(<MarkdownRenderer>{'1. one\n2. two'}</MarkdownRenderer>);
    const list = document.querySelector('ol');
    expect(list).toBeInTheDocument();
    expect(list!.querySelectorAll('li')).toHaveLength(LIST_ITEM_COUNT);
    expect(list!.querySelector('li')).toHaveTextContent('one');
  });

  it('renders an unordered list with <ul> and <li> elements', () => {
    render(<MarkdownRenderer>{'- a\n- b'}</MarkdownRenderer>);
    const list = document.querySelector('ul');
    expect(list).toBeInTheDocument();
    expect(list!.querySelectorAll('li')).toHaveLength(LIST_ITEM_COUNT);
    expect(list!.querySelector('li')).toHaveTextContent('a');
  });
});
