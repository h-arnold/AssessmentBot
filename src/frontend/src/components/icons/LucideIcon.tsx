import {
  createElement,
  type ComponentType,
  type CSSProperties,
  type MouseEventHandler,
  type ReactElement,
} from 'react';
import Icon from '@ant-design/icons';
import type { LucideProps } from 'lucide-react';

/**
 * A lucide-react icon component (for example `Plus` from `lucide-react`).
 */
export type LucideIconComponent = ComponentType<LucideProps>;

/**
 * Props for {@link LucideIcon}.
 *
 * The wrapper renders a lucide icon through antd's `Icon` so that it inherits
 * the same box model, spin animation, and rotate handling as antd icons. The
 * default `size` of `'1em'` matches antd's own icon sizing exactly, because
 * antd's `Icon` passes `width/height="1em"` to its inner SVG.
 */
export interface LucideIconProperties {
  /**
   * The lucide-react icon component to render.
   */
  icon: LucideIconComponent;

  /**
   * Rendered size of the icon. Defaults to `'1em'`, which makes the lucide
   * icon the same size as an antd icon in the same context.
   */
  size?: string | number;

  /**
   * Stroke colour. Defaults to `'currentColor'` so the icon follows the
   * surrounding text colour.
   */
  color?: string;

  /**
   * Stroke width passed through to the lucide icon.
   */
  strokeWidth?: number;

  /**
   * Apply antd's built-in spin animation (rotating loader style).
   */
  spin?: boolean;

  /**
   * Rotate the icon by the given number of degrees.
   */
  rotate?: number;

  /**
   * Additional class name applied to the antd `Icon` wrapper.
   */
  className?: string;

  /**
   * Inline style applied to the antd `Icon` wrapper.
   */
  style?: CSSProperties;

  /**
   * Accessible label. When provided, the icon is exposed to assistive
   * technology via `aria-label`; when omitted the icon is hidden from the
   * accessibility tree.
   */
  title?: string;

  /**
   * Click handler applied to the antd `Icon` wrapper.
   */
  onClick?: MouseEventHandler<HTMLSpanElement>;
}

/**
 * Renders a lucide-react icon at antd icon sizing with antd-compatible
 * ergonomics (`spin`, `rotate`, `className`, `style`, `onClick`).
 *
 * @param {LucideIconProperties} properties - The icon configuration.
 * @returns {ReactElement} The rendered antd `Icon` wrapper containing the lucide SVG.
 */
export function LucideIcon(properties: Readonly<LucideIconProperties>): ReactElement {
  const {
    icon,
    size = '1em',
    color = 'currentColor',
    strokeWidth,
    spin = false,
    rotate,
    className,
    style,
    title,
    onClick,
  } = properties;

  // antd's `Icon` passes `width="1em" height="1em"` to its inner component.
  // Override both with `size` so an explicit `size` (or our default `'1em'`)
  // always wins, while antd still owns the spin class and rotate transform via
  // the leftover `className`/`style` it injects into `rest`.
  const SizedLucideIcon = (innerProperties: Readonly<LucideProps>): ReactElement => {
    return createElement(icon, {
      ...innerProperties,
      width: size,
      height: size,
      size,
      color,
      strokeWidth,
    });
  };

  return (
    <Icon
      component={SizedLucideIcon as ComponentType<LucideProps>}
      spin={spin}
      rotate={rotate}
      className={className}
      style={style}
      onClick={onClick}
      {...(title ? { 'aria-label': title } : { 'aria-hidden': true })}
    />
  );
}
