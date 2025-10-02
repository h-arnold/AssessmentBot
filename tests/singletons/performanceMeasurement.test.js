/**
 * Tests for the PerformanceMeasurement utility
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { PerformanceMeasurement } from '../../src/AdminSheet/singletons/PerformanceMeasurement.js';

describe('PerformanceMeasurement Utility', () => {
  let perf;

  beforeEach(() => {
    perf = new PerformanceMeasurement();
  });

  test('measures synchronous operations', () => {
    perf.start('test-op');

    // Simulate some work
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      sum += i;
    }

    const duration = perf.end('test-op');

    expect(duration).toBeGreaterThan(0);
    expect(perf.getMeasurement('test-op')).toBe(duration);
  });

  test('measures using helper function', () => {
    const result = perf.measure('helper-test', () => {
      return 42;
    });

    expect(result).toBe(42);
    expect(perf.getMeasurement('helper-test')).toBeGreaterThan(0);
  });

  test('compares to baseline', () => {
    // Record a baseline
    perf.recordBaseline('baseline-test', 100);

    // Make a measurement
    perf.start('baseline-test');
    perf.end('baseline-test');

    const comparison = perf.compareToBaseline('baseline-test');

    expect(comparison.valid).toBe(true);
    expect(comparison.baseline).toBe(100);
    expect(typeof comparison.current).toBe('number');
    expect(typeof comparison.improvement).toBe('number');
    expect(typeof comparison.percentImprovement).toBe('number');
  });

  test('generates performance report', () => {
    perf.recordBaseline('op1', 50);
    perf.measure('op1', () => {});

    const report = perf.generateReport();

    expect(report).toContain('Performance Report');
    expect(report).toContain('op1:');
    expect(report).toContain('Baseline:');
    expect(report).toContain('Current:');
  });

  test('handles missing measurements gracefully', () => {
    const comparison = perf.compareToBaseline('missing-op');

    expect(comparison.valid).toBe(false);
    expect(comparison.reason).toContain('Missing');
  });

  test('clears measurements', () => {
    perf.recordBaseline('test', 100);
    perf.measure('test', () => {});

    perf.clear();

    expect(perf.getBaseline('test')).toBeNull();
    expect(perf.getMeasurement('test')).toBeNull();
  });
});
