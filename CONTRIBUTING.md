# 🚀 **Contributing**

Thank you for considering contributing to the Google Slides AI Assessor project! For an idea of what I'm currently working on, check out the [roadmap](./docs/roadmap.md).

As a one-man-band, I'm very grateful for any contributions and I'd be even more grateful if your contributions follow the style guide outlined here.

> 💡 **Tip**: Pasting your code/documentation and the style guide into ChatGPT or a similar tool can be a quick and easy way of updating your contribution to fit the style guide. If you have your own preferences, feel free to write your contribution in your style first and then use an LLM to match the rest of the codebase.

**Example**:

```markdown
# My Code

{paste your code here}

# The Style Guide

{paste the relevant section of the style guide here}

# Task

Please modify my code/documentation to match with the style guide provided. Ensure that all logic/wording remains exactly the same - the goal is to make superficial changes to meet the style guide. If this is not possible, do not continue and tell me what needs to change first.
```

---

# 📜 General Guidelines

## Writing Style (Code and Documentation)

- **Be concise**: Use clear, simple, and direct language.
- **Use British English**: Ensure spelling and grammar adhere to British English conventions.
- **Emphasise key points**: Use bold (**bold**) or italic (_italic_) text to highlight critical information. For code, add comments to clarify complex or critical segments.
- **Add tips and notes**: Use phrases like "💡 Tip" or "⚠️ Note" to call out additional details or warnings.
- **Clarity over complexity**: Avoid jargon. Provide meaningful names for variables, methods, and explain technical terms when they are first introduced.
- **Consistency**: Ensure code and documentation align with the style and structure of the existing project.
- **Testing**: Run Node unit tests locally (npm test) and avoid GAS services in unit tests; for end-to-end/manual checks, verify in the Apps Script Editor with mock data or test spreadsheets. Preview documentation to ensure layout and links are correct.

## Testing in Node (unit tests)

When running unit tests locally with Node (Vitest/Jest) it's common to hit missing Google Apps Script globals
such as `Classroom`, `DriveApp`, or project singletons like `ProgressTracker`. Many classes in this repository
call those globals in their constructors which will cause tests to fail.

Tip: prefer creating instances via their `fromJSON()` (or similar rehydration) methods inside unit tests. These
methods restore an instance's state without invoking the constructor and avoid GAS dependencies, making tests
hermetic and fast. Example:

```javascript
// Bad: may throw because Classroom/ProgressTracker aren't defined in Node
// const a = new Assignment('courseId', 'assignmentId');

// Good: rehydrates without invoking constructor
const a = Assignment.fromJSON({ courseId: 'c1', assignmentId: 'as1' });
```

If a class has no `fromJSON()` helper and you need constructor behavior, consider mocking the required globals in
your test setup or refactoring the class to split side-effecting logic out of the constructor.

---

# 🖥️ Contributing Code

## 🌲Folder and Code Structure

```bash
.
└── src
    └── frontend
        ├── BaseClassFolder
        │   ├── BaseClass.js
        │   ├── Subclass(es).js
        │   └── globals.js
        ├── UIManager
        │   ├── appScriptFrontendHTML.html
        │   └── UIManager.js
        └── z_Controllers
            └── BaseClassController.js

```

## 🛠️ Formatting Style Guide

### File and Class Naming

- **File Names**:
  - Use numeric prefixes to establish load order (e.g., `0BaseSheetManager.gs`).
  - Use descriptive names for files reflecting their purpose.
- **Class Names**:
  - Use PascalCase for class names:
    - ✅ `class BaseSheetManager`
    - 🚫 `class baseSheetManager`

### Function and Variable Naming

- **Functions**:
  - Use `camelCase` for function and method names:
    - ✅ `fetchAssignmentName(courseId, assignmentId)`
    - 🚫 `FetchAssignmentName(courseId, assignmentId)`
- **Variables**:
  - Use `const` for constants, `let` for mutable variables, and avoid `var` entirely.
  - Use descriptive, meaningful names:
    - ✅ `studentEmail`
    - 🚫 `x`

### Comments and Documentation

- Use **JSDoc** for all classes, methods, and non-obvious logic.

**Example**:

```javascript
/**
 * Creates or retrieves a sheet with the given name.
 * @param {string} sheetName - The name of the sheet.
 * @return {Sheet} The Google Sheet instance.
 */
createOrGetSheet(sheetName) { ... }
```

- Include **inline comments** to explain specific steps or unusual code:

```javascript
// Ensure all tasks are processed before generating the report
tasks.forEach((task) => processTask(task));
```

### 🚨 Error Handling

- Use `try...catch` for top-level triggers and critical operations only. Follow the logging contract: user-facing failures go via `ProgressTracker`, developer diagnostics via `ABLogger`. Do not double-log the same error and do not use `console.*`.

```javascript
try {
  Sheets.Spreadsheets.batchUpdate({ requests: this.requests }, spreadsheetId);
} catch (err) {
  ProgressTracker.getInstance().logError('Batch update failed', { err });
  ABLogger.getInstance().error('Batch update failed', err);
  throw err; // preserve fail-fast
}
```

#### Using ProgressTracker (user-facing) and ABLogger (developer)

The `ProgressTracker` class tracks progress and user-facing errors. Use it for messages users need to see. Use `ABLogger` for developer diagnostics (`debugUi`, `info`, `warn`, `error`). Do not use `console.*` in new code.

##### Important Notes

- Pick one: either log via `ProgressTracker.logError(userMsg, { err, devContext })` or via `ABLogger.*` for developer diagnostics. Do not duplicate the same error details in both unless you are passing dev details into `logError` as the second parameter.
- Prefer failing fast. Do not wrap known internal/GAS calls in existence or feature checks to avoid exceptions.

##### 📝 Example

```javascript
class ExampleClass {
  performCriticalOperation() {
    try {
      someCriticalFunction();
    } catch (err) {
      ProgressTracker.getInstance().logError('Critical function failed', { err });
      ABLogger.getInstance().error('Critical function failed', err);
      throw err;
    }
  }
}
```

Outside a class:

```javascript
try {
  someCriticalFunction();
} catch (err) {
  ProgressTracker.getInstance().logError('Critical function failed', { err });
  ABLogger.getInstance().error('Critical function failed', err);
  throw err;
}
```

### 🛡️ Defensive Guards

- Do not add defensive runtime guards (existence checks, `typeof`/feature detection, optional chaining as a gate) for internal calls or GAS services.
- Only validate direct function parameters for public APIs. Assume project singletons and GAS APIs exist; let misconfigurations throw so issues are visible.

### Code Organisation

- Use **2 spaces** for indentation.
- Add **line breaks** to separate logical sections.
- Avoid trailing spaces.
- Segment long methods into smaller, reusable functions with single responsibilities.

**Example**:

```javascript
class ExampleClass {
  constructor() {
    this.value = null;
  }

  initialize() {
    this.value = this.fetchData();
    this.processData();
  }

  fetchData() {
    // Fetch data logic
  }

  processData() {
    // Data processing logic
  }
}
```

---

# 🖋️ Contributing Documentation

## 🛠️ Formatting Style Guide

### Headings

- Use a structured hierarchy for headings:
  - `#` for top-level headings (e.g., document titles)
  - `##` for section headings
  - `###` for sub-sections
  - `####` for further breakdowns
- Add relevant emojis to headings sparingly to enhance visual appeal.

**Example:**

```markdown
## 📂 Setting Up Your Environment
```

### Lists

- Use numbered lists for step-by-step instructions.
- Use bullet points for unordered lists and general information.

**Example:**

```markdown
1. Clone the repository.
2. Navigate to the project directory.
3. Run the setup script.

- This is an unordered list item.
```

### Images

- Store all images relative to the Markdown file's location.
- Use the `<img>` HTML tag for images to control their size.
- Set the `width` attribute to `400px` for all images unless otherwise specified.
- Provide descriptive `alt` text for accessibility.

**Example:**

```markdown
<img src="images/example_image.png" alt="Description of the image" width="400">
```

### Links

- Use relative paths for internal links (e.g., `./images/example.png`).
- For external links, always include a descriptive label.

**Example:**

```markdown
[Learn more about Markdown](https://www.markdownguide.org/)
```

---

# 🖼️ Example Templates

## Code Template

Here’s a quick reference for writing new functions:

```javascript
/**
 * [Title of the Function]
 * [Brief description of the function's purpose]
 *
 * @param {string} paramName - [Description of the parameter]
 * @return {Type} [Description of what the function returns]
 */
function exampleFunction(paramName) {
  // 💡 Tip: Add meaningful inline comments for clarity
  ABLogger.getInstance().info('Performing example operation');

  try {
    // Core logic here
  } catch (err) {
    // ⚠️ Note: Handle errors gracefully following the logging contract
    ProgressTracker.getInstance().logError('Example operation failed', { err });
    ABLogger.getInstance().error('Example operation failed', err);
    throw err;
  }

  return result;
}
```

## Documentation Template

Here’s a quick reference template for writing new documentation:

```markdown
# Title of the Documentation

## 📄 Overview

Provide a brief description of what this document is about.

---

## 🔧 Steps to Follow

1. Step one.
   <img src="images/step1_example.png" alt="Step 1 visual" width="400">
2. Step two.
   <img src="images/step2_example.png" alt="Step 2 visual" width="400">

---

## 💡 Tips and Tricks

- 💡 **Tip**: Useful information to help users succeed.
- ⚠️ **Note**: Important warnings or caveats.
```

---

# 🤖 Prompting Assistance for Style Guide Updates

If you’re unsure how to align your code or documentation with this style guide, consider using an AI assistant like ChatGPT. Here’s how:

1. Share your code or documentation.
2. Ask the assistant to **"Update my code/documentation to align with the CONTRIBUTING.md style guide."** (Ensure you post this document above).
3. Review the updated code for accuracy and clarity.

By following this, you can ensure your contributions remain consistent with my standards while saving time. 🚀

---

# 🔄 Submitting Changes

Before submitting your changes, please ensure you've followed these guidelines:

## 📋 Pre-Submission Checklist

- [ ] **No eager heavy work in top-level scope** - Ensure no singletons perform expensive operations (Drive/Properties/Classroom access) during file load or construction
- [ ] **Use singleton pattern correctly** - Use `Class.getInstance()` instead of `new Class()` for singleton classes
- [ ] **Follow coding standards** - Code adheres to the style guide outlined in this document
- [ ] **Test thoroughly** - Changes are tested in Apps Script Editor with mock data or test spreadsheets
- [ ] **Documentation updated** - Any new features or changes have corresponding documentation updates
- [ ] **Singleton tests pass** - If modifying singleton classes, verify lazy initialization tests still pass

## 🚀 Submission Process

1. **Fork the repository** and clone it to your local machine.
2. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Write or update code** following this style guide.
4. **Test your changes** thoroughly in the Apps Script Editor.
5. **Submit a pull request** with:
   - A clear description of your changes.
   - Steps for reviewers to test and validate your contribution.
   - Confirmation that you've completed the pre-submission checklist above.

---

Thank you again for contributing to the Google Slides AI Assessor! Every contribution helps make this project better, and your efforts are greatly appreciated.

## Git hooks (Husky)

This project uses Husky to provide Git hooks for contributors. On a fresh checkout, install dependencies with `npm install` which will run `npm run prepare` and create the Git hooks automatically.

The repository ships a `pre-commit` hook which runs `npm run lint`. If you want to (re)install the hooks manually, run:

```bash
npx husky install
```

To add or update hooks locally, use the `npx husky add` command. For example:

```bash
npx husky add .husky/pre-commit "npm run lint"
```
