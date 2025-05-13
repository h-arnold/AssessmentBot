//Task.gs

class Task {
    /**
     * Constructs a Task instance.
     * @param {string} taskTitle - Title or description of the task.
     * @param {string} taskType - Type of the task: "Text", "Table", "Image" or "Spreadsheet".
     * @param {string} slideId - The ID of the slide where the task is located in the reference document.
     * @param {string|null} imageCategory - Applicable only for images (e.g., "diagram", "block code"). Null otherwise.
     * @param {string|string[]} taskReference - Reference content for assessment (string for Text/Table, array of URLs for Image).
     * @param {string|null} taskNotes - Additional notes for LLM assessment. Can be null.
     * @param {string|string[]} templateContent - Blank template content for the task (string or array of URLs).
     * @param {string|null} contentHash - Hash of the task content for caching purposes.
     * @param {string|null} templateContentHash - Hash of the template content for caching purposes.
     */
    constructor(
        taskTitle,
        taskType,
        slideId,
        imageCategory,
        taskReference = null,
        taskNotes = null,
        templateContent = null,
        contentHash = null,
        templateContentHash = null
    ) {
        this.taskTitle = taskTitle;          // string
        this.taskType = taskType;            // "Text", "Table", "Image", or "Spreadsheet"
        this.slideId = slideId;              // string
        this.imageCategory = imageCategory;  // string or null
        this.taskReference = taskReference;  // string or array of URLs (for Image tasks)
        this.taskNotes = taskNotes;          // string or null
        this.templateContent = templateContent;    // string or array of URLs (for Image tasks)
        this.contentHash = contentHash;      // string or null
        this.templateContentHash = templateContentHash; // string or null
        this.uid = Task.generateUID(taskTitle, slideId);
    }

    /**
     * Generates a unique UID for the Task instance.
     * @param {string} taskTitle - The task title.
     * @param {string} slideId - The slide ID.
     * @return {string} - The generated UID.
     */
    static generateUID(taskTitle, slideId) {
        const uniqueString = `${taskTitle}-${slideId}`;
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
            slideId: this.slideId,
            imageCategory: this.imageCategory,
            taskReference: this.taskReference,
            taskNotes: this.taskNotes,
            templateContent: this.templateContent,
            contentHash: this.contentHash,
            templateContentHash: this.templateContentHash
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
            slideId,
            imageCategory,
            taskReference,
            taskNotes,
            templateContent,
            contentHash,
            templateContentHash
        } = json;
        return new Task(
            taskTitle,
            taskType,
            slideId,
            imageCategory,
            taskReference,
            taskNotes,
            templateContent,
            contentHash,
            templateContentHash
        );
    }
}