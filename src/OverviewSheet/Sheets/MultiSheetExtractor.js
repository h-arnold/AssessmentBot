/**
 * @class MultiSheetExtractor
 * @classdesc Manages the extraction and aggregation of data from multiple Google Sheets.
 * @property {Array<{fileId: string, name: string, yearGroup: string}>} sheetsData - Array storing metadata from the master sheet
 * @property {Object.<string, Object.<string, Array>>} overviewData - Nested object storing aggregated data by year group and class name
 */
class MultiSheetExtractor extends BaseSheetManager {

    constructor(sheet) {
        super(sheet);
        this.sheetsData = [];   // Array of {fileId: string, name: string, yearGroup: string} from the "master" sheet
        this.overviewData = {};  // Final aggregated object: { 'Year Group': { 'Class Name': [...] } }
    }

    /**
     * Reads the "master" sheet (the one we are attached to via BaseSheetManager)
     * and extracts details of all class assessment files to process.
     * For example: columns for 'AR File ID', 'Name', 'Year Group', etc.
     *
     * @returns {Array<Object>} - An array of objects containing fileId, name, yearGroup, etc.
     * @property {string} fileId - The ID of the file.
     * @property {string} name - The name of the file.
     * @property {string} yearGroup - The year group of the file.
     */
    getDetailsOfSheetsToExtractDataFrom() {
        const arFileIdColumn = 'AR File ID';
        const nameColumn = 'Name';
        const yearGroupColumn = 'Year Group';

        // Extract columns by header name
        const fileIds = this.extractColumn(arFileIdColumn);
        const names = this.extractColumn(nameColumn);
        const years = this.extractColumn(yearGroupColumn);

        // Rebuild them into an array of objects
        this.sheetsData = fileIds.map((fileId, index) => ({
            fileId,
            name: names[index] || '',
            yearGroup: years[index] || ''
        }));

        if (this.sheetsData.length === 0) {
            this.getDetailsOfSheetsToExtractDataFrom();
        }
    }

    /**
     * Iterates over all files listed in sheetsData, opens each spreadsheet,
     * creates a ClassAssessmentSheet instance, and extracts the overview data.
     * Aggregates data by year group -> class name in this.overviewData.
     *
     * @returns {Object} e.g. { 'Year 10': { 'Class A': [...], ... }, 'Year 11': ... }
     */
    processAllOverviewSheets() {
        this.getDetailsOfSheetsToExtractDataFrom();

        this.overviewData = this.sheetsData.reduce((acc, { fileId, name, yearGroup }) => {
            if (!fileId || !name || !yearGroup) return acc; // Skip if any of the values are invalid

            try {
                const spreadsheet = SpreadsheetApp.openById(fileId);
                const assessmentRecordDestinationFolder = new ClassAssessmentSheet(spreadsheet, name, yearGroup);

                // Extract the overview data from this single class's assessment file
                const sheetData = assessmentRecordDestinationFolder.extractOverviewSheetData();

                // Group by year group, then by class name
                if (!acc[yearGroup]) {
                    acc[yearGroup] = {};
                }
                acc[yearGroup][name] = sheetData;

            } catch (error) {
                console.error(`Error processing sheet "${name}" (File ID: ${fileId}): ${error.message}`);
            }
            return acc;
        }, {});

        return this.overviewData;
    }
}

