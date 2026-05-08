import { vi } from 'vitest';

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
 * Minimal getComputedStyle test double required by Ant Design for CSS computations.
 * HappyDOM has incomplete getComputedStyle support, so we provide a basic mock.
 *
 * @param {Element} [element] - The element to get computed styles for.
 * @param {string} [pseudoElement] - The pseudo-element to get computed styles for.
 * @returns {CSSStyleDeclaration} The computed style declaration.
 */
function getComputedStyleMock(/* element?: Element, pseudoElement?: string | null */): CSSStyleDeclaration {
  /* eslint-disable security/detect-object-injection */
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

  const propertyNames = Object.keys(essentialProperties);

  return {
    getPropertyValue: (property: string) => essentialProperties[property] || '',
    setProperty: () => {},
    removeProperty: () => {},
    cssText: '',
    length: propertyNames.length,
    parentRule: null,
    item: (index: number) => propertyNames[index] || '',
  } as CSSStyleDeclaration;
  /* eslint-enable security/detect-object-injection */
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
