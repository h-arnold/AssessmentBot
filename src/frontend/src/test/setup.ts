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
