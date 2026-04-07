import '@testing-library/jest-dom/vitest';

/**
 * Minimal ResizeObserver test double required by Ant Design tab measurements in jsdom.
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
 * Minimal matchMedia test double required by Ant Design responsive observers in jsdom.
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


const originalGetComputedStyle = globalThis.window.getComputedStyle.bind(globalThis.window);

/**
 * Normalises pseudo-element style lookups that jsdom does not implement.
 *
 * Ant Design occasionally calls `getComputedStyle(element, '::before')` as part of
 * motion and wave bookkeeping. jsdom logs that path as not implemented, so the test
 * harness falls back to the base element style declaration instead.
 *
 * @param {Element} element The element whose computed styles are being read.
 * @param {string | undefined} pseudoElement Optional pseudo-element selector.
 * @returns {CSSStyleDeclaration} The computed style declaration.
 */
function getComputedStyleMock(element: Element, pseudoElement?: string): CSSStyleDeclaration {
  if (pseudoElement !== undefined && pseudoElement !== '') {
    return originalGetComputedStyle(element);
  }

  return originalGetComputedStyle(element, pseudoElement);
}

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
