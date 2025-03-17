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
- **Emphasise key points**: Use bold (**bold**) or italic (*italic*) text to highlight critical information. For code, add comments to clarify complex or critical segments.
- **Add tips and notes**: Use phrases like "💡 Tip" or "⚠️ Note" to call out additional details or warnings.
- **Clarity over complexity**: Avoid jargon. Provide meaningful names for variables, methods, and explain technical terms when they are first introduced.
- **Consistency**: Ensure code and documentation align with the style and structure of the existing project.
- **Testing**: Thoroughly test code in the Apps Script Editor with mock data or test spreadsheets, and preview documentation to ensure layout and links are correct.

---

# 🖥️ Contributing Code 

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
tasks.forEach(task => processTask(task));
```

### 🚨 Error Handling 

- Use `try...catch` for critical operations and log descriptive error messages to ensure user-friendly error handling.

```javascript
try {
  Sheets.Spreadsheets.batchUpdate({ requests: this.requests }, spreadsheetId);
} catch (e) {
  this.progressTracker.logError(`Batch update failed: ${e.message}`);
  throw new Error(`Batch update failed: ${e.message}`);
}
```

#### Using ProgressTracker for User-Facing Error Logging 

The `ProgressTracker` class tracks progress, manages status updates, and handles user-facing errors. Use it only for messages that users need to see.&#x20;

⚠️ **Note**: For more detailed or technical logs, continue to use `console.log` or `console.error`. To share user-relevant errors and ensure proper logging, use `logError` as shown above.

##### Important Notes:

- Use `this.progressTracker.logError()` for user-facing errors. `logError` also logs to the console automatically, so no need for separate console logging.

##### 📝 Example Usage of ProgressTracker 

⚠️ **Note**: Instantiate `ProgressTracker` before using it in a new class.&#x20;

💡 **Tip**: Example of instantiating and using `ProgressTracker`:

```javascript
class ExampleClass {
  constructor() {
    // Instantiate ProgressTracker if not already available
    this.progressTracker = ProgressTracker.getInstance();
  }

  performCriticalOperation() {
    try {
      someCriticalFunction();
    } catch (error) {
      this.progressTracker.logError(`Critical function failed: ${error.message}`);
      throw new Error(`Critical function failed: ${error.message}`);
    }
  }
}
```



This ensures users are clearly notified of failures, while developers get detailed logs for further diagnosis.

If you are not working within a class, or your class doesn't already have `ProgressTracker` instantiated, simply access it directly using:

```javascript
try {
  someCriticalFunction();
} catch (error) {
  this.progressTrackerlogError(`Critical function failed: ${error.message}`);
  throw new Error(`Critical function failed: ${error.message}`);
}
```

This ensures error messages are consistently communicated to both users and developers, maintaining transparency without redundancy.

In this example, the error will:

1. Be logged in the user-facing progress as an error state.
2. Automatically appear in the console log for debugging purposes.

This simplifies the process of handling errors, ensuring that error messages are consistently shared with both developers (via the console) and users (via progress tracking).



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
  console.log("Performing example operation");

  try {
    // Core logic here
  } catch (e) {
    // ⚠️ Note: Handle errors gracefully
    console.error("An error occurred:", e);
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

---

Thank you again for contributing to the Google Slides AI Assessor! Every contribution helps make this project better, and your efforts are greatly appreciated.

