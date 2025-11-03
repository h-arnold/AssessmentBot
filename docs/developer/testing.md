# Testing Structure and Guidelines

## Overview

AssessmentBot uses **Vitest** as the testing framework for unit and integration tests. Tests focus on logic, serialisation, state management, and behaviour in an isolated environment that mimics (but never invokes) Google Apps Script (GAS) services. External GAS / network calls are always mocked.

## Test Framework

- **Framework**: Vitest v3.2.4 (see `package.json`)
- **Environment**: Node.js (no browser DOM by default; UI suites spin up JSDOM when required)
- **Configuration**: `vitest.config.js` (loads `tests/setupGlobals.js`)
- **Test Runner (one-off)**: `npm test`
- **Watch Mode**: `npm run test:watch`
- **Module System**: Test files must use ESM `import` syntax for vitest (production code uses CommonJS `require`)

## Directory Structure

```
tests/
├── __mocks__/                 # Shared mock implementations
│   └── googleAppsScript.js    # Mock GAS globals (PropertiesService, SpreadsheetApp, etc.)
├── mocks/                     # Domain-specific mocks (e.g. ProgressTracker shim)
│   └── ProgressTracker.js
├── helpers/                   # Reusable test utilities & factories
│   ├── mockFactories.js       # GAS & service mock factories
│   ├── modelFactories.js      # Domain model factory helpers
│   ├── singletonTestSetup.js  # Singleton test harness helpers
│   └── testUtils.js           # Generic helpers (repeat, simpleHash, etc.)
├── setupGlobals.js            # Global test setup (loaded via vitest.config.js)
├── smoke.js                   # High-level smoke test (basic environment sanity)
├── assignment/                # Assignment-related tests
├── configurationManager/      # ConfigurationManager tests
├── models/                    # Domain model tests
├── parsers/                   # Document parser tests
├── requestHandlers/           # API request handler tests
├── singletons/                # Singleton behaviour, lifecycle & performance tests
│   ├── PerformanceMeasurement.js  # Test-only performance utility (not production code)
│   └── performanceMeasurement.test.js
├── ui/                        # UI modal/templated HTML tests (JSDOM-based)
└── utils/                     # Utility function tests
```

## Running Tests

```bash
# Run all tests (single run)
npm test

# Run all tests in watch mode
npm run test:watch

# Run a specific test file
npm test -- tests/models/abclass.test.js

# Run tests matching a folder/pattern
npm test -- tests/models/

# Run tests filtering by test name (-t passes through to Vitest)
npm test -- -t "serialise"
```

## Test Categories

### 1. Model Tests (`tests/models/`)

Test domain models including serialisation, validation, and business logic:

- **ABClass**: Class entity with students, teachers, assignments
- **Student**: Student entity with validation
- **Teacher**: Teacher entity with email/userId validation
- **TaskDefinition**: Task specifications with artifacts
- **StudentSubmission**: Submission tracking and hashing
- **Artifacts**: Various artifact types (TEXT, TABLE, IMAGE, etc.)

**Key patterns**:

- Test `toJSON()` / `fromJSON()` round-trip serialisation
- Validate hash stability and change detection
- Test business logic (e.g., setters, getters, validation)
- Use factory functions from `modelFactories.js`

### 2. Singleton Tests (`tests/singletons/`)

Verify singleton pattern implementation, lifecycle, and (optionally) performance:

- **baselineBehavior**: Lazy initialisation & instance stability
- **idempotency**: `getInstance()` repeatability (same object each call)
- **forbiddenGlobals**: Ensures no accidental global pollution
- **progressTrackerLazyInit**: ProgressTracker lazy behaviour
- **uiLazyProbe**: UIManager lazy instantiation
- **phase2Behavior**: Broader integration scenario
- **performanceMeasurement**: Uses `PerformanceMeasurement.js` helper to compare timings (test-only utility)

**Key patterns**:

- Use `SingletonTestHarness` to control GAS mocks
- Ensure singletons don't initialise until first `getInstance()`
- Verify `getInstance()` idempotency (stable reference)
- Isolate module cache between tests (clear `require.cache` as needed)
- (Optional) Capture performance deltas with `PerformanceMeasurement`

### 3. Parser Tests (`tests/parsers/`)

Test document parsing logic for Slides and Sheets:

- Extraction of text, tables, images from documents
- Normalisation of content
- Artifact creation from parsed content

**Key patterns**:

- Mock document structure (slides, sheets, ranges)
- Verify artifact types and content
- Test edge cases (empty content, malformed data)

### 4. Request Handler Tests (`tests/requestHandlers/`)

Test API interactions and caching:

- **assignmentPhase3**: LLM request generation and processing
- **imageManagerPhase5**: Image upload and management

**Key patterns**:

- Mock external APIs (LLM, Drive)
- Test caching behaviour
- Verify batch processing

### 5. Assignment Tests (`tests/assignment/`)

Test assignment-related functionality:

- Assignment state tracking
- Last updated timestamp logic
- Assignment persistence
- Factory pattern for polymorphic assignment creation
- Assignment serialisation (full and partial)

**Key patterns**:

- Test `Assignment.create()` factory method for correct subclass instantiation
- Test `Assignment.fromJSON()` polymorphic deserialisation
- Verify `toPartialJSON()` redacts heavy fields while preserving identifiers
- Test round-trip serialisation preserves types and data

### 6. Controller Tests (`tests/controllers/`)

Test controller logic for managing domain entities and coordinating persistence:

- **ABClassController**: Loading, saving, and managing ABClass instances
- **InitController**: Initialisation workflows
- **Assignment Persistence**: Full and partial assignment storage workflows
- **Assignment Rehydration**: Restoring full assignments from partial summaries

**Key patterns**:

- Mock DbManager and collections with `vi.fn()` for database operations
- Mock ABLogger singleton for logging verification
- Test both success and error paths with appropriate error handling
- Verify method existence before testing (for RED phase tests)
- Use factory functions to create test data
- Test edge cases (null inputs, missing data, corrupt data)
- Verify logging calls for all significant operations

**Example controller test structure**:

```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let ControllerClass, mockDbManager, mockABLogger;

beforeEach(() => {
  // Setup mocks
  mockDbManager = {
    getCollection: vi.fn().mockReturnValue({
      insertOne: vi.fn(),
      findOne: vi.fn(),
      // ... other collection methods
    }),
  };

  globalThis.DbManager = class {
    static getInstance() {
      return mockDbManager;
    }
  };

  mockABLogger = {
    info: vi.fn(),
    error: vi.fn(),
  };

  globalThis.ABLogger = class {
    static getInstance() {
      return mockABLogger;
    }
  };

  // Load controller after mocks
  delete require.cache[require.resolve('../../src/.../Controller.js')];
  ControllerClass = require('../../src/.../Controller.js');
});

afterEach(() => {
  delete globalThis.DbManager;
  delete globalThis.ABLogger;
  vi.restoreAllMocks();
});

it('performs expected operation', () => {
  const controller = new ControllerClass();

  // Test implementation
  controller.someMethod();

  expect(mockDbManager.getCollection).toHaveBeenCalled();
  expect(mockABLogger.info).toHaveBeenCalled();
});
```

### 7. Configuration Tests (`tests/configurationManager/`)

Test configuration management:

- Loading/saving configuration
- Property serialisation/deserialisation
- Default value handling

### 7. Configuration Tests (`tests/configurationManager/`)

Test configuration management:

- Loading/saving configuration
- Property serialisation/deserialisation
- Default value handling

### 8. Utility Tests (`tests/utils/`)

### 8. Utility Tests (`tests/utils/`)

Test utility functions:

- **ABLogger**: Logging functionality
- **Validate**: Email and userId validation

### 9. UI Tests (`tests/ui/`)

Exercise client-side logic that lives inside Apps Script HTML templates (e.g. modal dialogs).

- **Environment**: `jsdom` (Vitest default Node runner with per-suite DOM setup).
- **Focus**: Validation flows, interactions with `google.script.run`, side-effects such as Materialize toasts, and templated data hydration.
- **Patterns**:
  - Read the HTML template from `src/AdminSheet/UI/` and replace templating placeholders (`<?= ... ?>`) with fixture values before instantiating `JSDOM`.
  - Stub Materialize (`window.M`) and GAS globals (`google.script.run`, `google.script.host`) with chainable mocks so that the modal logic can exercise success/failure callbacks.
  - Dispatch a synthetic `DOMContentLoaded` event after loading scripts to mirror Apps Script behaviour.
  - Keep tests focused on behaviour (DOM state, mock invocations) rather than Materialize internals.

Test utility functions:

- **ABLogger**: Logging functionality
- **Validate**: Email and userId validation

## Testing Helpers

### Mock Factories (`tests/helpers/mockFactories.js`)

Provides factory functions for creating reusable mocks:

```javascript
const {
  createMockPropertiesService,
  createMockUtils,
  createMockSpreadsheetApp,
  createMockClassroomApiClient,
  setupGlobalGASMocks,
} = require('../helpers/mockFactories.js');

// Create individual mocks
const mockProps = createMockPropertiesService(vi);
const mockUtils = createMockUtils(vi);
const mockClassroom = createMockClassroomApiClient();

// Setup all common GAS mocks at once
const mocks = setupGlobalGASMocks(vi, { mockConsole: true });
```

**Available factories**:

- `createMockPropertiesService(vi)` - PropertiesService with script/document properties
- `createMockUtils(vi)` - Utils with hash generation
- `createMockDriveApp(vi)` - DriveApp for file operations
- `createMockSpreadsheetApp(vi, options)` - SpreadsheetApp with sheets
- `createMockClassroomApiClient()` - ClassroomApiClient wrapping Classroom API
- `createMockMimeType()` - Google MIME type constants
- `setupGlobalGASMocks(vi, options)` - Setup all common mocks

### Model Factories (`tests/helpers/modelFactories.js`)

Provides factory functions for creating test model instances:

```javascript
const {
  createTaskDefinition,
  createTextTask,
  createStudentSubmission,
  createDummyProgressTracker,
} = require('../helpers/modelFactories.js');

// Create a task definition with sensible defaults
const task = createTaskDefinition({
  index: 0,
  title: 'Task 1',
  refContent: 'Reference content',
  refType: 'TEXT',
});

// Create a text task (convenience wrapper)
const textTask = createTextTask(0, 'Reference text', 'Template text');

// Create a student submission
const submission = createStudentSubmission({
  studentId: 'student1',
  assignmentId: 'assignment1',
  documentId: 'doc1',
});
```

### Test Utils (`tests/helpers/testUtils.js`)

General utility functions for tests:

```javascript
const { repeat, noop, assert, delay, simpleHash } = require('../helpers/testUtils.js');

// Repeat a function n times
repeat(5, (i) => console.log(`Iteration ${i}`));

// Simple deterministic hash for testing
const hash = simpleHash('some content');
```

### Singleton Test Setup (`tests/helpers/singletonTestSetup.js`)

Helpers for singleton-specific test setup:

```javascript
const {
  createSingletonTestContext,
  loadSingletonsWithMocks,
} = require('../helpers/singletonTestSetup.js');

// Create a test harness
const context = createSingletonTestContext();

// Load specific singletons with mocks
const singletons = loadSingletonsWithMocks(context.harness, {
  loadConfigurationManager: true,
  loadProgressTracker: true,
});
```

## Global Test Setup

### setupGlobals.js

This file runs before all tests and sets up the global environment:

1. Loads `BaseSingleton` (canonical singleton base class)
2. Mocks core GAS-like globals: `Utils`, `Utilities`, `Logger`
3. Provides lightweight `ProgressTracker` mock
4. Exposes `ArtifactFactory` (required by `TaskDefinition` tests)
5. Provides a basic `ClassroomManager` shim (student fetching where required)

### Common Global Mocks

Available in all tests via `setupGlobals.js`:

- `global.Utils.generateHash(str)` - Simple hash generation
- `global.Utilities.base64Encode(bytes)` - Base64 encoding
- `global.Logger.log(...)` - Logging
- `global.ProgressTracker.getInstance()` - Lightweight progress tracking
- `global.ArtifactFactory` - Artifact creation

## Writing Tests

### Basic Test Structure

```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ComponentName', () => {
  let component;

  beforeEach(() => {
    // Setup: create mocks, instantiate component
    global.SomeDependency = mockDependency;
    component = new Component();
  });

  afterEach(() => {
    // Cleanup: remove globals, clear caches
    delete global.SomeDependency;
  });

  it('should perform expected behaviour', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = component.process(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

**Note**: Use ESM `import` for vitest and test helpers. Production code (CommonJS modules) can still be loaded with `require()` if needed.

### Testing Serialisation

Models should implement `toJSON()` and `fromJSON()` for persistence:

```javascript
it('should serialise and deserialise correctly', () => {
  const original = new MyModel({ name: 'Test', value: 42 });

  // Serialise to JSON
  const json = original.toJSON();
  expect(json).toEqual({
    name: 'Test',
    value: 42,
  });

  // Deserialise back to instance
  const restored = MyModel.fromJSON(json);
  expect(restored.name).toBe('Test');
  expect(restored.value).toBe(42);

  // Should be equivalent but not same instance
  expect(restored).not.toBe(original);
});
```

### Testing Hash Stability

Hashes should be stable and change when content changes:

```javascript
it('should generate stable hashes', () => {
  const obj1 = new MyModel({ content: 'test' });
  const obj2 = new MyModel({ content: 'test' });

  const hash1 = obj1.generateHash();
  const hash2 = obj2.generateHash();

  // Same content = same hash
  expect(hash1).toBe(hash2);
  expect(hash1).toBeTruthy();
});

it('should change hash when content changes', () => {
  const obj = new MyModel({ content: 'original' });
  const originalHash = obj.generateHash();

  obj.content = 'modified';
  const newHash = obj.generateHash();

  expect(newHash).not.toBe(originalHash);
});
```

### Testing Singletons

```javascript
it('getInstance returns same instance across calls', () => {
  const instance1 = MySingleton.getInstance();
  const instance2 = MySingleton.getInstance();

  expect(instance1).toBe(instance2);
  expect(instance1).toBeTruthy();
});

it('should not initialise until first use (lazy)', () => {
  // Load the module but don't call getInstance
  delete require.cache[require.resolve('../path/to/MySingleton.js')];
  require('../path/to/MySingleton.js');

  // Verify no initialisation happened
  expect(global.SomeService.init).not.toHaveBeenCalled();

  // Now call getInstance
  MySingleton.getInstance();

  // Should be initialised now
  expect(global.SomeService.init).toHaveBeenCalled();
});
```

### Mocking Google Apps Script APIs

#### Mocking Classroom API

```javascript
beforeEach(() => {
  // Setup domain models globally
  global.Student = Student;
  global.Teacher = Teacher;

  // Mock Classroom API
  global.Classroom = {
    Courses: {
      get: (courseId) => ({
        id: courseId,
        name: 'Test Course',
        ownerId: 'teacher1',
      }),
      Teachers: {
        list: (courseId) => ({
          teachers: [
            {
              profile: {
                name: { fullName: 'Teacher One' },
                emailAddress: 'teacher@school.edu',
                id: 't1',
              },
            },
          ],
        }),
      },
      Students: {
        list: (courseId) => ({
          students: [
            {
              profile: {
                name: { fullName: 'Student One' },
                emailAddress: 'student@school.edu',
                id: 's1',
              },
            },
          ],
        }),
      },
    },
  };

  // Use the centralized mock wrapper
  const { createMockClassroomApiClient } = require('../helpers/mockFactories.js');
  global.ClassroomApiClient = createMockClassroomApiClient();
});
```

#### Mocking DbManager

```javascript
beforeEach(() => {
  global.DbManager = class MockDbManager {
    static getInstance() {
      return {
        getCollection: () => ({
          insertOne: vi.fn(),
          save: vi.fn(),
          updateOne: vi.fn(),
          removeMany: vi.fn(),
          clear: vi.fn(),
        }),
        readAll: vi.fn().mockReturnValue([]),
        saveCollection: vi.fn(),
      };
    }
  };
});
```

#### Mocking SpreadsheetApp

```javascript
import { vi } from 'vitest';
const { createMockSpreadsheetApp } = require('../helpers/mockFactories.js');

beforeEach(() => {
  global.SpreadsheetApp = createMockSpreadsheetApp(vi, {
    mockActiveSpreadsheet: true,
    sheetsConfig: [
      { name: 'Sheet1', id: 's1' },
      { name: 'Sheet2', id: 's2' },
    ],
  });
});
```

### Module Cache Management

When testing modules that maintain state, clear the require cache:

```javascript
beforeEach(() => {
  // Clear module cache to get fresh instance
  delete require.cache[require.resolve('../../src/path/to/Module.js')];

  // Setup mocks before requiring
  global.SomeDependency = mockDependency;

  // Now require the module
  MyModule = require('../../src/path/to/Module.js');
});

afterEach(() => {
  // Clean up
  delete require.cache[require.resolve('../../src/path/to/Module.js')];
  delete global.SomeDependency;
});
```

## Best Practices

### 1. Test Logic, Not GAS Services

**Do test**:

- Serialisation (`toJSON`/`fromJSON`)
- Hash generation and stability
- Business logic and validation
- State management
- Edge cases (null, empty, large data)

**Don't test**:

- Apps Script services (SpreadsheetApp, DriveApp, etc.)
- Network calls
- Timers tied to GAS runtime
- UI rendering

### 2. Use Factory Functions

Prefer factory functions over inline object creation:

```javascript
// Good
const task = createTaskDefinition({ index: 0, refContent: 'test' });

// Avoid (unless testing specific edge case)
const task = new TaskDefinition({
  taskTitle: 'Task 0',
  pageId: 'p0',
  index: 0,
  taskMetadata: {},
});
task.addReferenceArtifact({ type: 'TEXT', content: 'test' });
```

### 3. Centralize Mocks

Add reusable mocks to `mockFactories.js`:

```javascript
// In mockFactories.js
function createMockMyService(vi) {
  return {
    fetch: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
}

module.exports = {
  // ... other exports
  createMockMyService,
};

// In tests
const { createMockMyService } = require('../helpers/mockFactories.js');
global.MyService = createMockMyService(vi);
```

### 4. Clean Up Globals

Always clean up global mocks in `afterEach`:

```javascript
afterEach(() => {
  delete global.MyMock;
  delete global.AnotherMock;
  delete require.cache[require.resolve('../../src/Module.js')];
});
```

### 5. Test Isolation

Each test should be independent:

- Don't rely on test execution order
- Reset mocks in `beforeEach`
- Clear state in `afterEach`
- Don't share mutable state between tests

### 6. Meaningful Assertions

Write clear, specific assertions:

```javascript
// Good
expect(result.name).toBe('Expected Name');
expect(result.items).toHaveLength(3);
expect(result.hash).toBeTruthy();

// Avoid vague assertions
expect(result).toBeTruthy();
expect(result.items.length > 0).toBe(true);
```

### 7. Test Edge Cases

Consider testing:

- Empty inputs (`''`, `[]`, `{}`, `null`, `undefined`)
- Large inputs (many items, long strings)
- Invalid inputs (malformed data, wrong types)
- Boundary conditions (0, -1, max values)

## Debugging Tests

### Running Single Test

```bash
# Run specific test file
npm test -- tests/models/abclass.test.js

# Run specific test by name pattern
npm test -- -t "should serialise correctly"
```

### Using Console Output

```javascript
it('should do something', () => {
  console.log('Debug value:', myValue);
  expect(myValue).toBe(expected);
});
```

<!-- Vitest UI section removed: @vitest/ui not currently installed; add back if tooling added. -->

## Common Patterns

### Testing Error Handling

```javascript
it('should throw on invalid input', () => {
  expect(() => {
    component.process(null);
  }).toThrow('Expected error message');
});
```

### Spying on Methods

```javascript
import { vi } from 'vitest';

it('should call dependency method', () => {
  const spy = vi.fn();
  global.Dependency = { method: spy };

  component.execute();

  expect(spy).toHaveBeenCalledWith('expected', 'args');
  expect(spy).toHaveBeenCalledTimes(1);
});
```

### Testing Module Exports

```javascript
// For production modules (CommonJS): use require
const ConfigurationManager = require('../../src/AdminSheet/ConfigurationManager/ConfigurationManagerClass.js');

// For test helpers (may be CommonJS or ESM): use import
import { setupGlobalGASMocks } from '../helpers/mockFactories.js';

// For modules that might have default or named exports
const MyClassExport = require('../../src/path/to/Module.js');
const MyClass = MyClassExport.MyClass || MyClassExport;
```

## Troubleshooting

### "Module not found" errors

- Check the require path is correct
- Ensure the file exists in `src/`
- Check `setupGlobals.js` is loading required dependencies

### "X is not defined" errors

- Add the global mock in `beforeEach`
- Check if `setupGlobals.js` should provide it
- Verify module cache is cleared between tests

### Tests passing locally but failing in CI

- Check for test interdependencies
- Verify all mocks are properly cleaned up
- Look for timing issues (use `await` for async)
- Check for hardcoded file paths

### Singleton state leaking between tests

- Clear `require.cache` in `afterEach`
- Use singleton `resetForTests()` if available
- Ensure globals are deleted in `afterEach`
