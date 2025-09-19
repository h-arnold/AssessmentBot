/**
 * Performance measurement utilities for singleton initialization
 *
 * This utility helps track and compare initialization times before and after
 * the lazy loading refactoring to verify performance improvements.
 */

class PerformanceMeasurement {
  constructor() {
    this.measurements = new Map();
    this.baseline = new Map();
  }

  /**
   * Start a performance measurement
   * @param {string} name - Name of the operation being measured
   */
  start(name) {
    this.measurements.set(`${name}_start`, performance.now());
  }

  /**
   * End a performance measurement and return the duration
   * @param {string} name - Name of the operation
   * @returns {number} Duration in milliseconds
   */
  end(name) {
    const startTime = this.measurements.get(`${name}_start`);
    if (!startTime) {
      throw new Error(`No start time found for measurement: ${name}`);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    this.measurements.set(`${name}_duration`, duration);

    return duration;
  }

  /**
   * Record a baseline measurement for comparison
   * @param {string} name - Name of the operation
   * @param {number} duration - Duration in milliseconds
   */
  recordBaseline(name, duration) {
    this.baseline.set(name, duration);
  }

  /**
   * Get the recorded baseline for an operation
   * @param {string} name - Name of the operation
   * @returns {number|null} Baseline duration in milliseconds, or null if not recorded
   */
  getBaseline(name) {
    return this.baseline.get(name) || null;
  }

  /**
   * Get the most recent measurement for an operation
   * @param {string} name - Name of the operation
   * @returns {number|null} Duration in milliseconds, or null if not measured
   */
  getMeasurement(name) {
    return this.measurements.get(`${name}_duration`) || null;
  }

  /**
   * Compare current measurement to baseline
   * @param {string} name - Name of the operation
   * @returns {Object} Comparison result with improvement info
   */
  compareToBaseline(name) {
    const current = this.getMeasurement(name);
    const baseline = this.getBaseline(name);

    if (!current || !baseline) {
      return {
        valid: false,
        reason: 'Missing baseline or current measurement',
      };
    }

    const improvement = baseline - current;
    const percentImprovement = (improvement / baseline) * 100;

    return {
      valid: true,
      baseline: baseline,
      current: current,
      improvement: improvement,
      percentImprovement: percentImprovement,
      faster: improvement > 0,
    };
  }

  /**
   * Measure a function's execution time
   * @param {string} name - Name for the measurement
   * @param {Function} fn - Function to measure
   * @returns {any} Return value of the function
   */
  measure(name, fn) {
    this.start(name);
    try {
      const result = fn();
      this.end(name);
      return result;
    } catch (error) {
      this.end(name);
      throw error;
    }
  }

  /**
   * Measure an async function's execution time
   * @param {string} name - Name for the measurement
   * @param {Function} fn - Async function to measure
   * @returns {Promise<any>} Return value of the function
   */
  async measureAsync(name, fn) {
    this.start(name);
    try {
      const result = await fn();
      this.end(name);
      return result;
    } catch (error) {
      this.end(name);
      throw error;
    }
  }

  /**
   * Generate a performance report
   * @returns {string} Formatted performance report
   */
  generateReport() {
    const lines = ['=== Performance Report ==='];

    // Get all unique operation names
    const operations = new Set();
    for (const [key] of this.measurements) {
      if (key.endsWith('_duration')) {
        operations.add(key.replace('_duration', ''));
      }
    }
    for (const [key] of this.baseline) {
      operations.add(key);
    }

    for (const operation of operations) {
      const comparison = this.compareToBaseline(operation);
      const current = this.getMeasurement(operation);
      const baseline = this.getBaseline(operation);

      lines.push(`\n${operation}:`);

      if (baseline) {
        lines.push(`  Baseline: ${baseline.toFixed(2)}ms`);
      }

      if (current) {
        lines.push(`  Current:  ${current.toFixed(2)}ms`);
      }

      if (comparison.valid) {
        const direction = comparison.faster ? 'faster' : 'slower';
        const percent = Math.abs(comparison.percentImprovement).toFixed(1);
        lines.push(`  Change:   ${comparison.improvement.toFixed(2)}ms (${percent}% ${direction})`);
      }
    }

    lines.push('\n==========================');
    return lines.join('\n');
  }

  /**
   * Clear all measurements and baselines
   */
  clear() {
    this.measurements.clear();
    this.baseline.clear();
  }

  /**
   * Log the performance report to console
   */
  logReport() {
    console.log(this.generateReport());
  }
}

module.exports = { PerformanceMeasurement };
