import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  describe('Basic debounce behavior', () => {
    it('debounces callback with default 300ms delay', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDebounce(callback));

      result.current();
      expect(callback).not.toHaveBeenCalled();

      const justBeforeDefaultDelay = 299;
      vi.advanceTimersByTime(justBeforeDefaultDelay);
      expect(callback).not.toHaveBeenCalled();

      const oneMillisecond = 1;
      vi.advanceTimersByTime(oneMillisecond);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('debounces callback with custom delay', () => {
      const callback = vi.fn();
      const customDelay = 500;
      const { result } = renderHook(() => useDebounce(callback, customDelay));

      result.current();
      expect(callback).not.toHaveBeenCalled();

      const justBeforeCustomDelay = customDelay - 1;
      vi.advanceTimersByTime(justBeforeCustomDelay);
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multiple rapid calls', () => {
    const testDelay = 100;
    const halfTestDelay = 50;

    it('multiple rapid calls result in single callback execution', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDebounce(callback, testDelay));

      // Call multiple times rapidly
      result.current();
      result.current();
      result.current();

      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(testDelay);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('resets timer on each call', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDebounce(callback, testDelay));

      result.current();
      vi.advanceTimersByTime(halfTestDelay);
      result.current();
      vi.advanceTimersByTime(halfTestDelay);
      result.current();
      vi.advanceTimersByTime(halfTestDelay);

      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(halfTestDelay);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Callback arguments preservation', () => {
    const argumentTestDelay = 100;

    it('works with void callbacks without arguments', () => {
      const callback = vi.fn(() => {
        return 'no-args';
      });
      const { result } = renderHook(() => useDebounce(callback, argumentTestDelay));

      result.current();

      vi.advanceTimersByTime(argumentTestDelay);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('handles rapid calls with no arguments', () => {
      const callback = vi.fn(() => {
        return 'rapid-calls';
      });
      const { result } = renderHook(() => useDebounce(callback, argumentTestDelay));

      result.current();
      result.current();
      result.current();

      vi.advanceTimersByTime(argumentTestDelay);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cleanup on unmount', () => {
    const cleanupTestDelay = 100;

    it('cleans up timeout on unmount to prevent memory leaks', () => {
      const callback = vi.fn();
      const { result, unmount } = renderHook(() => useDebounce(callback, cleanupTestDelay));

      result.current();
      expect(callback).not.toHaveBeenCalled();

      unmount();

      vi.advanceTimersByTime(cleanupTestDelay);
      expect(callback).not.toHaveBeenCalled();
    });

    it('does not call callback after unmount', () => {
      const callback = vi.fn();
      const { result, unmount } = renderHook(() => useDebounce(callback, cleanupTestDelay));

      result.current();
      unmount();

      vi.advanceTimersByTime(cleanupTestDelay);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Type safety', () => {
    const typeTestDelay = 100;

    it('works with void return type', () => {
      const callback = vi.fn(() => {});
      const { result } = renderHook(() => useDebounce(callback, typeTestDelay));

      result.current();
      vi.advanceTimersByTime(typeTestDelay);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('debounced function returns void', () => {
      const expectedReturnValue = 42;
      const callback = vi.fn(() => expectedReturnValue);
      const { result } = renderHook(() => useDebounce(callback, typeTestDelay));

      const returnedValue = result.current();
      expect(returnedValue).toBeUndefined();

      vi.advanceTimersByTime(typeTestDelay);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
