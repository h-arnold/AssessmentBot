import '@testing-library/jest-dom/vitest';

/**
 * Minimal ResizeObserver test double required by Ant Design tab measurements in jsdom.
 */
class ResizeObserverMock {
  /**
   * Starts observing the supplied element.
   */
  observe() {}

  /**
   * Stops observing the supplied element.
   */
  unobserve() {}

  /**
   * Disconnects all active observations.
   */
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: ResizeObserverMock,
  writable: true,
});
