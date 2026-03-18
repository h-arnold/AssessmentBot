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
