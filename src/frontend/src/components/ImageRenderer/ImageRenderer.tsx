/**
 * Presentational component for rendering a student's image artifact.
 *
 * Accepts a base64 data URL as `src` and renders it as an inline `<img>`
 * element constrained to the popover layout dimensions.
 *
 * @remarks
 * The `maxHeight: 400` constraint matches the layout specification
 * (see `TASK_PREVIEW_CARD_LAYOUT.md` §5 — Student Response section), which
 * prevents the image from making the popover card overflow the viewport.
 * This value may be adjusted in future if the card layout changes.
 */

import type { JSX } from 'react';

export interface ImageRendererProperties {
  /** Base64 data URL of the student's image response. */
  readonly src: string;
  /** Alt text for the image. Defaults to "Student response image". */
  readonly alt?: string;
}

/**
 * Render a student response image from a base64 data URL.
 *
 * @param {ImageRendererProperties} props - Component properties.
 * @param {string} props.src - Base64 data URL of the image.
 * @param {string} [props.alt="Student response image"] - Accessible alt text.
 * @returns {JSX.Element} An `<img>` element with responsive sizing.
 */
export function ImageRenderer({
  src,
  alt = 'Student response image',
}: ImageRendererProperties): JSX.Element {
  return (
    <img
      src={src}
      alt={alt}
      style={{ maxWidth: '100%', height: 'auto', maxHeight: 400 }}
    />
  );
}
