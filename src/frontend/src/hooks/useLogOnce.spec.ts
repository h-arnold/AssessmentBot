import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLogOnce } from './useLogOnce';

describe('useLogOnce', () => {
  it('invokes callback when condition becomes true', () => {
    const callback = vi.fn();
    const { rerender } = renderHook(
      ({ condition }: { condition: boolean }) => useLogOnce(condition, callback),
      { initialProps: { condition: false } }
    );

    expect(callback).not.toHaveBeenCalled();

    rerender({ condition: true });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not invoke callback on re-renders while condition stays true', () => {
    const callback = vi.fn();
    const { rerender } = renderHook(
      ({ condition }: { condition: boolean }) => useLogOnce(condition, callback),
      { initialProps: { condition: true } }
    );

    // First render with condition=true should invoke callback
    expect(callback).toHaveBeenCalledTimes(1);

    // Re-render while condition stays true — callback should not fire again
    rerender({ condition: true });
    expect(callback).toHaveBeenCalledTimes(1);

    rerender({ condition: true });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('invokes callback once when condition is already true on first render', () => {
    const callback = vi.fn();
    renderHook(({ condition }: { condition: boolean }) => useLogOnce(condition, callback), {
      initialProps: { condition: true },
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
