# 🏗️ Singleton Pattern Guide

This document explains the lazy singleton pattern used throughout the AssessmentBot codebase and provides guidelines for developers working with or extending singleton classes.

- [🏗️ Singleton Pattern Guide](#️-singleton-pattern-guide)
  - [📖 Overview](#-overview)
  - [✅ Correct Pattern (Do This)](#-correct-pattern-do-this)
    - [Basic Singleton Structure](#basic-singleton-structure)
    - [Using Singletons](#using-singletons)
    - [Heavy Initialization Pattern](#heavy-initialization-pattern)
  - [❌ Anti-Patterns (Don't Do This)](#-anti-patterns-dont-do-this)
    - [Direct Constructor Calls](#direct-constructor-calls)
    - [Eager Heavy Work](#eager-heavy-work)
    - [Global Variable Instantiation](#global-variable-instantiation)
  - [🧪 Testing Conventions](#-testing-conventions)
    - [Test Setup](#test-setup)
    - [Testing Laziness](#testing-laziness)
    - [Testing Idempotency](#testing-idempotency)
  - [🔄 Migration Guide](#-migration-guide)
    - [Converting a Regular Class to Singleton](#converting-a-regular-class-to-singleton)
    - [Updating Code that Uses Singletons](#updating-code-that-uses-singletons)
  - [🏛️ Architecture Principles](#️-architecture-principles)
  - [💡 Best Practices](#-best-practices)
  - [🐛 Common Pitfalls](#-common-pitfalls)

---

## 📖 Overview

The AssessmentBot uses a **lazy singleton pattern** to ensure:

- **No eager side-effects at file load** - Heavy operations (Drive/Properties/Classroom access) only happen when needed
- **Deterministic initialization** - Singletons initialize exactly once, when first used
- **Test-friendly design** - Easy to reset state between tests
- **Performance optimization** - Avoid unnecessary work during script startup

All singleton classes extend `BaseSingleton` and follow consistent patterns for instantiation and initialization.

---

## ✅ Correct Pattern (Do This)

### Basic Singleton Structure

```javascript
/**
 * ExampleManager - manages example functionality
 * Use ExampleManager.getInstance(); do not call constructor directly.
 */
class ExampleManager extends BaseSingleton {
  constructor(isSingletonCreator = false) {
    super();

    // Prevent direct instantiation. ESLint is helpful, but runtime enforcement
    // makes the pattern robust.
    if (!isSingletonCreator) {
      throw new Error(
        'ExampleManager is a singleton. Use ExampleManager.getInstance() to get the instance.'
      );
    }

    // Light initialization only - no heavy work!
    this.cache = null;
    this._initialized = false;
  }

  /**
   * Canonical accessor - always use this instead of `new`.
   */
  static getInstance() {
    return super.getInstance();
  }

  /**
   * Heavy initialization boundary - safe to call multiple times.
   */
  ensureInitialized() {
    if (this._initialized) return;

    if (globalThis.__TRACE_SINGLETON__) {
      console.log('[TRACE][HeavyInit] ExampleManager.ensureInitialized');
    }

    this.cache = this.loadExpensiveData();
    this._initialized = true;
  }

  /**
   * Public method that needs heavy initialization
   */
  getImportantData() {
    this.ensureInitialized(); // Ensure heavy work is done
    return this.cache.importantData;
  }

  /**
   * Test helper - resets singleton state
   */
  static resetForTests() {
    ExampleManager._instance = null;
  }
}
```

### Using Singletons

```javascript
// ✅ Correct - use getInstance()
const manager = ExampleManager.getInstance();
const data = manager.getImportantData();

// ✅ Correct - multiple calls return same instance
const manager1 = ExampleManager.getInstance();
const manager2 = ExampleManager.getInstance();
console.log(manager1 === manager2); // true
```

### Heavy Initialization Pattern

```javascript
class ConfigurationManager extends BaseSingleton {
  ensureInitialized() {
    if (this._initialized) return;

    // Heavy operations only happen here
    this.scriptProperties = PropertiesService.getScriptProperties();
    this.documentProperties = PropertiesService.getDocumentProperties();
    this.maybeDeserializeProperties();

    this._initialized = true;
  }

  getApiKey() {
    this.ensureInitialized(); // Heavy work happens here on first call
    return this.scriptProperties.getProperty('API_KEY');
  }

  setApiKey(value) {
    this.ensureInitialized(); // Ensure we have properties service
    this.scriptProperties.setProperty('API_KEY', value);
  }
}
```

---

## ❌ Anti-Patterns (Don't Do This)

### Direct Constructor Calls

```javascript
// ❌ Wrong - direct constructor call
const config = new ConfigurationManager();

// ❌ Wrong - multiple instances created
const config1 = new ConfigurationManager();
const config2 = new ConfigurationManager();
console.log(config1 === config2); // false - different instances!
```

### Eager Heavy Work

```javascript
// ❌ Wrong - heavy work in constructor
class BadManager extends BaseSingleton {
  constructor() {
    super();

    // This violates lazy initialization!
    this.driveFiles = DriveApp.getFiles(); // Heavy Drive access
    this.properties = PropertiesService.getScriptProperties(); // Heavy property access
    this.classrooms = ClassroomApp.Courses.list(); // Heavy API call
  }
}
```

### Global Variable Instantiation

```javascript
// ❌ Wrong - eager global instantiation (old pattern)
const configurationManager = new ConfigurationManager();
const uiManager = new UIManager();

// These create instances immediately when the file loads,
// causing heavy work before it's needed!
```

---

## 🧪 Testing Conventions

### Test Setup

```javascript
const { SingletonTestHarness } = require('./SingletonTestHarness.js');

describe('ExampleManager Tests', () => {
  let harness;

  beforeEach(() => {
    harness = new SingletonTestHarness();
    harness.setupGASMocks(); // Mock Google Apps Script globals
  });

  afterEach(() => {
    ExampleManager.resetForTests(); // Clean up singleton state
  });
});
```

### Testing Laziness

```javascript
test('should not perform heavy work until needed', () => {
  const manager = ExampleManager.getInstance();

  // Should not have accessed expensive services yet
  expect(harness.wasPropertiesServiceAccessed()).toBe(false);
  expect(harness.wasDriveServiceAccessed()).toBe(false);

  // Trigger heavy work
  manager.getImportantData();

  // Now heavy services should be accessed
  expect(harness.wasPropertiesServiceAccessed()).toBe(true);
});
```

### Testing Idempotency

```javascript
test('getInstance() returns same instance across multiple calls', () => {
  const instance1 = ExampleManager.getInstance();
  const instance2 = ExampleManager.getInstance();
  const instance3 = ExampleManager.getInstance();

  expect(instance1).toBe(instance2);
  expect(instance2).toBe(instance3);
  expect(harness.getConstructorCallCount('ExampleManager')).toBe(1);
});

test('ensureInitialized() only performs heavy work once', () => {
  const manager = ExampleManager.getInstance();

  manager.ensureInitialized();
  const callsAfterFirst = harness.getHeavyCallCount();

  manager.ensureInitialized(); // Should be no-op
  manager.ensureInitialized(); // Should be no-op

  expect(harness.getHeavyCallCount()).toBe(callsAfterFirst);
});
```

---

## 🔄 Migration Guide

### Converting a Regular Class to Singleton

1. **Extend BaseSingleton**:

   ```javascript
   class MyClass extends BaseSingleton {
   ```

2. **Update constructor**:

   ```javascript
   constructor(isSingletonCreator = false) {
     super();
     if (!isSingletonCreator && MyClass._instance) {
       return MyClass._instance;
     }
     // Light initialization only
     this._initialized = false;
     if (!MyClass._instance) {
       MyClass._instance = this;
     }
   }
   ```

3. **Add getInstance() method**:

   ```javascript
   static getInstance() {
     return super.getInstance();
   }
   ```

4. **Extract heavy work** to `ensureInitialized()`:

   ```javascript
   ensureInitialized() {
     if (this._initialized) return;
     // Move heavy constructor work here
     this._initialized = true;
   }
   ```

5. **Guard public methods**:

   ```javascript
   publicMethod() {
     this.ensureInitialized();
     // Method logic here
   }
   ```

6. **Add test helper**:
   ```javascript
   static resetForTests() {
     MyClass._instance = null;
   }
   ```

### Updating Code that Uses Singletons

```javascript
// Before (old pattern)
const config = new ConfigurationManager();
const apiKey = config.getApiKey();

// After (singleton pattern)
const config = ConfigurationManager.getInstance();
const apiKey = config.getApiKey();
```

---

## 🏛️ Architecture Principles

1. **Separation of Construction vs. Initialization**:
   - Constructor: Light object setup
   - `ensureInitialized()`: Heavy resource loading

2. **Lazy Loading**:
   - No work until first method requiring it is called
   - Transparent to callers - they just call methods normally

3. **Idempotent Operations**:
   - Multiple calls to `getInstance()` return same object
   - Multiple calls to `ensureInitialized()` perform work only once

4. **Test-Friendly Design**:
   - `resetForTests()` allows clean state between tests
   - Easy to mock and verify lazy behavior

---

## 💡 Best Practices

1. **Always use `getInstance()`** - Never call constructors directly
2. **Guard heavy methods** - Call `ensureInitialized()` in methods that need resources
3. **Minimize constructor work** - Keep constructors lightweight
4. **Add JSDoc banners** - Include "Use Class.getInstance(); do not call constructor directly"
5. **Use trace logging** - Gate heavy init logs behind `globalThis.__TRACE_SINGLETON__`
6. **Test lazy behavior** - Verify no heavy work happens until needed
7. **Reset in tests** - Always call `resetForTests()` in test cleanup

---

## 🐛 Common Pitfalls

1. **Forgetting to call `ensureInitialized()`**:

   ```javascript
   // ❌ Wrong - might use uninitialized resources
   getApiKey() {
     return this.scriptProperties.getProperty('API_KEY'); // Error if not initialized!
   }

   // ✅ Correct
   getApiKey() {
     this.ensureInitialized();
     return this.scriptProperties.getProperty('API_KEY');
   }
   ```

2. **Heavy work in constructor**:
   - Move all Drive/Properties/API calls to `ensureInitialized()`

3. **Not resetting in tests**:
   - Always call `YourClass.resetForTests()` in test cleanup

4. **Circular dependencies**:
   - Defer cross-singleton access to inside methods, not constructors

5. **Direct constructor usage**:
   - ESLint rules help catch this, but always review PRs carefully

💡 **Tip**: When in doubt, check existing singleton implementations like `ConfigurationManager`, `ProgressTracker`, or `UIManager` for reference patterns.

⚠️ **Remember**: The goal is to have **zero heavy work** happening during file load or object construction. All expensive operations should be deferred until they're actually needed!
