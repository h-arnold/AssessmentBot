# Singleton Testing Documentation

This directory contains tests and utilities for the singleton refactoring project.

## Overview

The singleton tests are designed to verify lazy initialization behavior and measure performance improvements during the refactoring process.

## Files

- `SingletonTestHarness.js` - Test utilities for singleton isolation and measurement
- `baselineBehavior.test.js` - Baseline tests that document desired lazy behavior
- `__mocks__/googleAppsScript.js` - Mock implementations of GAS globals

## Running Tests

### Run all singleton tests

```bash
npm test -- singletons
```

### Run only baseline behavior tests

```bash
npm test -- baselineBehavior
```

### Run tests with verbose output

```bash
npm test -- singletons --reporter=verbose
```

### Run tests in watch mode during development

```bash
npm run test:watch -- singletons
```

## Test Structure

### Phase 0: Baseline Tests

These tests establish the current (eager) behavior and document the desired lazy behavior. Many tests are marked with `.skip` because they represent the target state after refactoring.

**Key Test Categories:**

- ConfigurationManager lazy initialization
- InitController lazy UI instantiation
- UIManager lazy classroom manager creation
- ProgressTracker control tests (already lazy)
- Performance baseline measurements

### SingletonTestHarness

The test harness provides utilities for:

- Resetting singleton instances between tests
- Tracking constructor and initialization calls
- Measuring performance timing
- Providing isolated test environments
- Mocking Google Apps Script globals

**Key Methods:**

- `withFreshSingletons(testFn)` - Run test with clean singleton state
- `resetAllSingletons()` - Clear all singleton instances
- `trackConstructorCall(className)` - Count constructor invocations
- `wasPropertiesServiceAccessed()` - Check if heavy properties access occurred
- `getTimingDuration(operation)` - Get performance measurements

## Test Development Guidelines

### Adding New Singleton Tests

1. Use `harness.withFreshSingletons()` to ensure test isolation
2. Setup GAS mocks with `harness.setupGASMocks()`
3. Import classes after mocks are established
4. Use `.skip` for tests that represent target behavior not yet implemented
5. Track heavy operations like PropertiesService access, UI creation, etc.

### Example Test Pattern

```javascript
test.skip('should not access PropertiesService until needed', async () => {
  await harness.withFreshSingletons(() => {
    harness.setupGASMocks();

    const config = new ConfigurationManager();

    // Should not have accessed heavy resources yet
    expect(harness.wasPropertiesServiceAccessed()).toBe(false);

    // Trigger operation that needs heavy resources
    config.getApiKey();

    // Should have accessed heavy resources now
    expect(harness.wasPropertiesServiceAccessed()).toBe(true);
  });
});
```

## Mock System

The mock system provides lightweight implementations of Google Apps Script globals:

- `PropertiesService` - Tracks property access and modification
- `SpreadsheetApp` - Tracks UI operations
- `HtmlService` - Tracks HTML file creation
- `GoogleClassroomManager` - Counts instantiations
- `PropertiesCloner` - Tracks property deserialization

All mocks track when they are called, allowing tests to verify lazy behavior.

## Performance Measurement

Use the harness timing methods to measure initialization performance:

```javascript
harness.startTiming('operation');
// ... perform operation ...
const duration = harness.endTiming('operation');
console.log(`Operation took ${duration}ms`);
```

## Debugging

Use `harness.logState()` to output current test state including:

- Constructor call counts
- Initialization call counts
- Performance timings
- Mock call logs

## Phase Progression

As the refactoring progresses through phases:

1. **Phase 0** - All lazy tests are skipped, baseline established
2. **Phase 1** - Enable tests as `getInstance()` methods are added
3. **Phase 2** - Enable tests as heavy initialization is deferred
4. **Phase 3** - All tests should pass with proper lazy behavior

Remove `.skip` from tests as the corresponding refactoring phases are completed.
