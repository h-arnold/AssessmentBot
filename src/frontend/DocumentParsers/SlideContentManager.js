/**
 * SlideContentManager Class
 * 
 * Handles extraction and processing of content from Google Slides presentations.
 * Generates slide export URLs.
 * Handles per-document rate limiting.
 */
class SlideContentManager {
  /**
   * Constructs a SlideContentManager instance.
   */
  constructor() {
    // No need for requestManager since we're not fetching images here
  }

  /**
   * Generates a slide export URL for a given slide in a Google Slides presentation.
   * @param {string} documentId - The ID of the Google Slides presentation.
   * @param {string} slideId - The ID of the specific slide within the presentation.
   * @return {string} - The URL to export the slide as an image.
   */
  generateSlideImageUrl(documentId, slideId) {

    const url = `https://docs.google.com/presentation/d/${documentId}/export/png?id=${documentId}&pageid=${slideId}`;

    if (Utils.isValidUrl(url)) {
      return url;
    } else {
      throw new Error(`Invalid URL produced.`)
    }
  }

  /**
   * Extracts Task instances from a Google Slides presentation.
   * Differentiates between task titles, images, notes, and entire slide images based on slide element descriptions.
   * @param {string} documentId - The ID of the Google Slides presentation.
   * @param {string|null} contentType - Type of content to extract: "reference", "empty", or null for default.
   * @return {Task[]} - An array of Task instances extracted from the slides.
   */
  extractTasksFromSlides(documentId, contentType = "reference") { // Default to "reference"
    const presentation = SlidesApp.openById(documentId);
    const slides = presentation.getSlides();
    let tasks = [];
    let lastTask = null; // To keep track of the last parsed Task for assigning notes

    slides.forEach((slide) => {
      const pageElements = slide.getPageElements();
      const currentSlideId = this.getSlideId(slide); // Retrieve slideId using helper

      pageElements.forEach(pageElement => {
        const description = pageElement.getDescription();

        if (!description || description.length === 0) {
          return; // Skip elements without descriptions
        }

        const tag = description.charAt(0);
        const key = description.substring(1).trim(); // Remove the tag and trim

        switch (tag) {
          case '#': // Text-Based Task Title
            // Existing logic for handling text-based task titles
            let content = '';
            let taskType = '';
            const type = pageElement.getPageElementType();

            if (type === SlidesApp.PageElementType.SHAPE) {
              content = this.extractTextFromShape(pageElement.asShape());
              taskType = "Text"; // Capitalize to match expected values
            } else if (type === SlidesApp.PageElementType.TABLE) {
              content = this.extractTextFromTable(pageElement.asTable());
              taskType = "Table";
            } else {
              console.log(`Unsupported PageElementType for text-based task title: ${type}`);
              return; // Skip unsupported types
            }

            // Parse the task and add to the tasks array
            const task = this.parseTask(key, content, currentSlideId, taskType, contentType);
            if (task) {
              tasks.push(task);
              lastTask = task; // Update the lastTask reference
            }
            break;

          case '^': // Notes
            if (lastTask) {
              const notesContent = this.extractTextFromPageElement(pageElement);
              lastTask.taskNotes = notesContent;
            } else {
              console.warn(`Note found without an associated task. Description: ${description}`);
            }
            break;

          case '~': //Quick workaround - see details above.
          case '|': // Entire Slide Image
            // For slide images, generate the slide export URL instead of fetching the image Blob
            const slideImageUrl = this.generateSlideImageUrl(documentId, currentSlideId);
            const slideImageTask = this.parseTask(key, slideImageUrl, currentSlideId, "Image", contentType);
            if (slideImageTask) {
              tasks.push(slideImageTask);
              lastTask = slideImageTask; // Update the lastTask reference
            } else {
              console.log(`Failed to create task for slide ID ${currentSlideId}`);
            }
            break;

          default:
            // Unsupported tag
            console.log(`Unsupported tag "${tag}" in description: ${description}`);
            break;
        }
      });
    });

    return tasks;
  }

  /**
  * Parses raw task content to create a Task instance.
  * @param {string} key - The task key extracted from the slide.
  * @param {string} content - The raw content of the task (string or URL).
  * @param {string} slideId - The ID of the slide where the task is located.
  * @param {string} taskType - The type of the task: "Text", "Table", "Image".
  * @param {string|null} contentType - Type of content: "reference", "empty", or null for default.
  * @return {Task|null} - The Task instance or null if parsing fails.
  */
  parseTask(key, content, slideId, taskType, contentType) {
    let taskReference = null;
    let emptyContent = null;
    let taskNotes = null;
    let contentHash = null;
    let emptyContentHash = null;

    if (contentType === "reference") {
      taskReference = content;
      contentHash = Utils.generateHash(content);
    } else if (contentType === "empty") {
      emptyContent = content;
      emptyContentHash = Utils.generateHash(content);
    } else {
      taskReference = content;
      contentHash = Utils.generateHash(content);
    }

    return new Task(
      key,
      taskType,
      slideId,
      null,          // imageCategory
      taskReference,
      taskNotes,     // Will be assigned separately if present
      emptyContent,
      contentHash,
      emptyContentHash
    );
  }

  /**
   * Helper function to retrieve the slide ID.
   * @param {GoogleAppsScript.Slides.Slide} slide - The slide object.
   * @return {string} - The unique ID of the slide.
   */
  getSlideId(slide) {
    return slide.getObjectId();
  }

  /**
   * Extracts text from a shape element.
   * @param {GoogleAppsScript.Slides.Shape} shape - The shape element to extract text from.
   * @return {string} - The extracted text from the shape.
   */
  extractTextFromShape(shape) {
    if (!shape || !shape.getText) {
      console.log("The provided element is not a shape or does not contain text.");
      return '';
    }

    const text = shape.getText().asString();
    return text.trim();
  }

  /**
   * Converts a Google Slides Table to a Markdown-formatted string.
   * @param {GoogleAppsScript.Slides.Table} table - The table element to convert.
   * @return {string} - The Markdown-formatted table.
   */
  convertTableToMarkdown(table) {
    if (!table || !(table.getNumRows() && table.getNumColumns())) {
      console.log("The provided element is not a table or is empty.");
      return '';
    }

    const numRows = table.getNumRows();
    const numCols = table.getNumColumns();
    let markdownTable = '';

    // Extract all rows' data
    let rows = [];
    for (let i = 0; i < numRows; i++) {
      let row = [];
      for (let j = 0; j < numCols; j++) {
        const cell = table.getCell(i, j);
        const text = cell.getText().asString().trim();
        // Escape pipe characters in Markdown
        const escapedText = text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
        row.push(escapedText);
      }
      rows.push(row);
    }

    if (rows.length === 0) return '';

    // Assume first row as header
    const header = rows[0];
    const separator = header.map(() => '---');
    const dataRows = rows.slice(1);

    // Create header row
    markdownTable += '| ' + header.join(' | ') + ' |\n';

    // Create separator row
    markdownTable += '| ' + separator.join(' | ') + ' |\n';

    // Create data rows
    dataRows.forEach(row => {
      markdownTable += '| ' + row.join(' | ') + ' |\n';
    });

    return markdownTable;
  }

  /**
   * Extracts text from a table element and converts it to Markdown.
   * @param {GoogleAppsScript.Slides.Table} table - The table element to extract text from.
   * @return {string} - The extracted Markdown text from the table.
   */
  extractTextFromTable(table) {
    return this.convertTableToMarkdown(table);
  }

  /**
   * Extracts text from any page element (Shape, Table, Image).
   * @param {GoogleAppsScript.Slides.PageElement} pageElement - The page element to extract text from.
   * @return {string} - The extracted text or image description.
   */
  extractTextFromPageElement(pageElement) {
    const type = pageElement.getPageElementType();

    if (type === SlidesApp.PageElementType.SHAPE) {
      return this.extractTextFromShape(pageElement.asShape());
    } else if (type === SlidesApp.PageElementType.TABLE) {
      return this.extractTextFromTable(pageElement.asTable());
    } else if (type === SlidesApp.PageElementType.IMAGE) {
      return this.extractImageDescription(pageElement.asImage());
    } else {
      console.log(`Unsupported PageElementType for notes: ${type}`);
      return '';
    }
  }

  /**
   * Extracts image description or relevant metadata from an image element.
   * @param {GoogleAppsScript.Slides.Image} image - The image element to extract data from.
   * @return {string} - The extracted description or metadata.
   */
  extractImageDescription(image) {
    // Assuming that the image has alt text or description that specifies the category
    // e.g., "Diagram of the system architecture"
    const description = image.getDescription();
    return description ? description.trim() : '';
  }
}