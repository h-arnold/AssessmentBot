//Task.gs

class Task {
    /**
     * Constructs a Task instance.
     * @param {string} taskTitle - Title or description of the task.
     * @param {string} taskType - Type of the task: "Text", "Table", "Image" or "Spreadsheet".
     * @param {string} pageId - The ID of the page where the task is located in the reference document (slide ID for presentations or sheet tab ID for spreadsheets).
     * @param {string|null} imageCategory - Applicable only for images (e.g., "diagram", "block code"). Null otherwise.
     * @param {string|string[]} taskReference - Reference content for assessment (string for Text/Table, array of URLs for Image).
     * @param {string|null} taskNotes - Additional notes for LLM assessment. Can be null.
     * @param {string|string[]} templateContent - Blank template content for the task (string or array of URLs).
     * @param {string|null} contentHash - Hash of the task content for caching purposes.
     * @param {string|null} templateContentHash - Hash of the template content for caching purposes.
     * @param {Object|null} taskMetadata - Additional metadata for the task (e.g., boundingBox for spreadsheet tasks).
     */
    constructor(
        taskTitle,
        taskType,
        pageId,
        imageCategory,
        taskReference = null,
        taskNotes = null,
        templateContent = null,
        contentHash = null,
        templateContentHash = null,
        taskMetadata = null
    ) {
        this.taskTitle = taskTitle;          // string
        this.taskType = taskType;            // "Text", "Table", "Image", or "Spreadsheet"
        this.pageId = pageId;                // string - slide ID or spreadsheet tab ID
        this.imageCategory = imageCategory;  // string or null
        this.taskReference = taskReference;  // string or array of URLs (for Image tasks)
        this.taskNotes = taskNotes;          // string or null
        this.templateContent = templateContent;    // string or array of URLs (for Image tasks)
        this.contentHash = contentHash;      // string or null
        this.templateContentHash = templateContentHash; // string or null
        this.taskMetadata = taskMetadata || {}; // Object or empty object if null
        this.uid = Task.generateUID(taskTitle, pageId);
    }

    /**
     * Generates a unique UID for the Task instance.
     * @param {string} taskTitle - The task title.
     * @param {string} pageId - The page ID (slide ID or spreadsheet tab ID).
     * @return {string} - The generated UID.
     */
    static generateUID(taskTitle, pageId) {
        const uniqueString = `${taskTitle}-${pageId}`;
        return Utils.generateHash(uniqueString);
    }

    /**
     * Serializes the Task instance to a JSON object.
     * @return {Object} - The JSON representation of the Task.
     */
    toJSON() {
        return {
            taskTitle: this.taskTitle,
            taskType: this.taskType,
            pageId: this.pageId,
            imageCategory: this.imageCategory,
            taskReference: this.taskReference,
            taskNotes: this.taskNotes,
            templateContent: this.templateContent,
            contentHash: this.contentHash,
            templateContentHash: this.templateContentHash,
            taskMetadata: this.taskMetadata
        };
    }

    /**
     * Deserializes a JSON object to a Task instance.
     * @param {Object} json - The JSON object representing a Task.
     * @return {Task} - The Task instance.
     */
    static fromJSON(json) {
        const {
            taskTitle,
            taskType,
            pageId,
            imageCategory,
            taskReference,
            taskNotes,
            templateContent,
            contentHash,
            templateContentHash,
            taskMetadata
        } = json;
        return new Task(
            taskTitle,
            taskType,
            pageId,
            imageCategory,
            taskReference,
            taskNotes,
            templateContent,
            contentHash,
            templateContentHash,
            taskMetadata
        );
    }
}