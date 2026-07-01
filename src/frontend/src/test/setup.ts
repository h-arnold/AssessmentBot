import { vi } from 'vitest';

// Set React 19 act environment flag to suppress "not configured to support act" warnings.
// React Testing Library sets this dynamically during operations, but happy-dom can trigger
// state updates between act() boundaries. Setting it globally suppresses the false-positive
// variant of the act() warning that occurs between wrapped operations.
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true,
  writable: true,
});

// Import jest-dom extensions for vitest
import '@testing-library/jest-dom/vitest';

// Mock CSS files to avoid parsing warnings in tests
vi.mock('antd/dist/antd.css', () => ({}));
vi.mock('antd/dist/reset.css', () => ({}));

/**
 * Minimal matchMedia test double required by Ant Design responsive observers.
 *
 * @param {string} mediaQuery The media query to evaluate.
 * @returns {MediaQueryList} The mock media query list.
 */
function createMatchMediaMock(mediaQuery: string): MediaQueryList {
  return {
    matches: false,
    media: mediaQuery,
    onchange: null,
    addEventListener() {
      return;
    },
    removeEventListener() {
      return;
    },
    addListener() {
      return;
    },
    removeListener() {
      return;
    },
    dispatchEvent() {
      return false;
    },
  };
}

Object.defineProperty(globalThis, 'matchMedia', {
  configurable: true,
  value: createMatchMediaMock,
  writable: true,
});

Object.defineProperty(globalThis.window, 'matchMedia', {
  configurable: true,
  value: createMatchMediaMock,
  writable: true,
});

/**
 * Minimal ResizeObserver test double required by Ant Design tab measurements.
 * HappyDOM does not support ResizeObserver natively.
 */
class ResizeObserverMock {
  /**
   * Starts observing the supplied element.
   *
   * @returns {void} No return value.
   */
  observe() {
    return;
  }

  /**
   * Stops observing the supplied element.
   *
   * @returns {void} No return value.
   */
  unobserve() {
    return;
  }

  /**
   * Disconnects all active observations.
   *
   * @returns {void} No return value.
   */
  disconnect() {
    return;
  }
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: ResizeObserverMock,
  writable: true,
});

/**
 * Read inline style attribute values into a plain key-value record.
 *
 * @param {Element} element - The DOM element to read styles from.
 * @returns {Record<string, string>} A record of CSS property to value.
 */
function readInlineStyles(element: Element): Record<string, string> {
  const styles: Record<string, string> = {};
  const styleAttribute = element.getAttribute('style');
  if (!styleAttribute) {
    return styles;
  }

  for (const declaration of styleAttribute.split(';')) {
    const colonIndex = declaration.indexOf(':');
    if (colonIndex > 0) {
      const property = declaration.slice(0, Math.max(0, colonIndex)).trim();
      const value = declaration.slice(Math.max(0, colonIndex + 1)).trim();
      if (property && value) {
        // eslint-disable-next-line security/detect-object-injection -- CSS property names in this test double are not user-controlled; they are static inline style strings from component props, making the object-injection rule a false positive here
        styles[property] = value;
      }
    }
  }
  return styles;
}

/**
 * Minimal getComputedStyle test double required by Ant Design for CSS computations.
 * HappyDOM has incomplete getComputedStyle support, so we provide a basic mock.
 *
 * Supports both `getPropertyValue('font-size')` and direct `.fontSize` / `.fontWeight`
 * access. Reads inline styles from the element's `style` attribute so that components
 * using the `style` prop are reflected in computed styles.
 *
 * @param {Element} [element] - The element to get computed styles for.
 * @returns {CSSStyleDeclaration} The computed style declaration.
 */
function getComputedStyleMock(element?: Element): CSSStyleDeclaration {
  /* eslint-disable security/detect-object-injection -- mock lookups use controlled property keys only */
  // Essential properties that Ant Design commonly checks
  // Modal: position, z-index, left, top, width, height, display
  // Table: width, height, overflow, display
  // Menu: width, height, transform, display
  // Select: width, position, z-index, display
  // E2E tests: background-color
  const essentialProperties: Record<string, string> = {
    // Layout
    display: 'block',
    width: '100px',
    height: 'auto',
    'box-sizing': 'border-box',
    position: 'static',
    overflow: 'visible',

    // Spacing
    padding: '0px',
    margin: '0px',

    // Borders
    'border-width': '0px',
    'border-style': 'solid',

    // Colors (fixes e2e backgroundColor check)
    'background-color': 'rgb(255, 255, 255)',
    color: 'rgb(0, 0, 0)',

    // Text
    'font-size': '14px',
    'line-height': '1.5',

    // Positioning (Modal/Dropdown/Tooltip)
    'z-index': 'auto',
    left: '0px',
    top: '0px',
  };

  const inlineStyles: Record<string, string> = element ? readInlineStyles(element) : {};

  /**
   * Resolve a hyphenated property: inline values take priority over essential defaults.
   *
   * @param {string} property - The hyphenated CSS property name.
   * @returns {string} The resolved value.
   */
  function resolveValue(property: string): string {
    return inlineStyles[property] ?? essentialProperties[property] ?? '';
  }

  const propertyNames = Object.keys(essentialProperties);

  /* eslint-enable security/detect-object-injection */
  return {
    getPropertyValue: (property: string) => resolveValue(property),
    setProperty: () => {},
    removeProperty: () => {},
    cssText: '',
    length: propertyNames.length,
    parentRule: null,
    item: (index: number) => propertyNames.at(index) ?? '',

    // CamelCase accessors for common CSS properties used by test assertions.
    // HappyDOM getComputedStyle does not return inline styles via direct property
    // access, so we provide getters that fall through to resolveValue.
    get fontSize() {
      return resolveValue('font-size');
    },
    get fontWeight() {
      return resolveValue('font-weight');
    },
    get opacity() {
      return resolveValue('opacity');
    },
  } as unknown as CSSStyleDeclaration; // Double assertion required: mock implements only the ~20 properties Ant Design reads, not all 500+ of CSSStyleDeclaration. `unknown` is the type-safe way to assert intentional type override for test doubles.
}

// Define getComputedStyle on both globalThis and window with correct signature
Object.defineProperty(globalThis, 'getComputedStyle', {
  configurable: true,
  value: getComputedStyleMock,
  writable: true,
});

Object.defineProperty(globalThis.window, 'getComputedStyle', {
  configurable: true,
  value: getComputedStyleMock,
  writable: true,
});
