import { vi } from 'vitest';

// Import jest-dom extensions for vitest
import '@testing-library/jest-dom/vitest';

// Mock CSS files to avoid parsing warnings in tests
vi.mock('antd/dist/antd.css', () => ({}), { virtual: true });
vi.mock('antd/dist/reset.css', () => ({}), { virtual: true });

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
 * @returns {CSSStyleDeclaration} The computed style declaration.
 */
function getComputedStyleMock(): CSSStyleDeclaration {
  // Return a basic CSSStyleDeclaration-like object
  // This is a simplified mock that returns empty strings for all properties
  const style: Partial<CSSStyleDeclaration> = {
    getPropertyValue: () => '',
    setProperty: () => {},
    removeProperty: () => {},
    cssText: '',
    length: 0,
    parentRule: null,
    item: () => '',
  };
  return style as CSSStyleDeclaration;
}

// Define getComputedStyle on both globalThis and window
// The real getComputedStyle signature is (element: Element, pseudoElement?: string) => CSSStyleDeclaration
// but we return the same mock regardless of parameters
Object.defineProperty(globalThis, 'getComputedStyle', {
  configurable: true,
  value: (): CSSStyleDeclaration => getComputedStyleMock(),
  writable: true,
});

Object.defineProperty(globalThis.window, 'getComputedStyle', {
  configurable: true,
  value: (): CSSStyleDeclaration => getComputedStyleMock(),
  writable: true,
});
