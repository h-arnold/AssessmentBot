/**
 * Presentational component for rendering markdown content using react-markdown.
 *
 * Accepts markdown as children (a string) and renders it via `react-markdown`
 * with the `remark-gfm` plugin for GFM table, strikethrough, and task-list support.
 *
 * @remarks
 * `rehype-raw` is intentionally **not** included in the plugin pipeline.
 * Raw HTML within markdown input is escaped by react-markdown's default
 * behaviour, guarding against stored cross-site scripting (XSS) attacks
 * when rendering student-submitted markdown content. This is a deliberate
 * security posture — do not add `rehype-raw` without explicit approval.
 *
 * Tables rendered by this component receive basic styling (borders, padding,
 * collapsed borders) via a co-located CSS module (`MarkdownRenderer.module.css`),
 * scoped to the wrapping `<div>` element.
 */

import type { JSX } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './MarkdownRenderer.module.css';

export interface MarkdownRendererProperties {
  /** Markdown string content to render. */
  readonly children: string;
  /** Optional additional CSS class name. */
  readonly className?: string;
}

/**
 * Render markdown content as HTML with GFM support.
 *
 * @param {MarkdownRendererProperties} props - Component properties.
 * @param {string} props.children - Markdown string to render.
 * @param {string} [props.className] - Optional additional CSS class.
 * @returns {JSX.Element} Rendered markdown wrapped in a styled container.
 */
export function MarkdownRenderer({
  children,
  className,
}: MarkdownRendererProperties): JSX.Element {
  const classes = className
    ? `${styles.markdown} ${className}`
    : styles.markdown;

  return (
    <div className={classes}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
