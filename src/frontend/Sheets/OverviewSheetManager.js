/**
 * OverviewSheetManager Class
 *
 * Handles the creation and updating of the overview sheet with overall student averages.
 */
class OverviewSheetManager extends BaseSheetManager {
    /**
     * Constructs an OverviewSheetManager instance.
     */
    constructor() {
        super();
        this.headers = ['Name', 'Completeness', 'Accuracy', 'SPaG', 'Average'];
        this.studentAverages = [];     // To hold calculated averages
        this.rangeAssociations = [];   // To keep track of range types and sheet names
        this.requests = [];            // Initialise requests array
    }

    /**
     * Main method to create and populate the overview sheet.
     */
    createOverviewSheet() {
        this.createOrGetSheet('Overview');
        this.prepareData();
        this.buildRequests();
        this.executeBatchUpdate();
    }

    /**
     * Prepares data by fetching stored ranges and calculating averages.
     */
    prepareData() {
        this.retrieveStoredRanges();
        this.fetchData();
        this.calculateAverages();
    }

    /**
     * Retrieves stored ranges from document properties.
     */
    retrieveStoredRanges() {
        const documentProperties = PropertiesService.getDocumentProperties();
        const averagesRanges = JSON.parse(documentProperties.getProperty('averagesRanges') || '{}');
        this.averagesRanges = averagesRanges;
    }

    /**
     * Fetches data from all stored ranges via the Google Sheets API.
     * If a sheet is missing, cleans the invalid references and retries.
     */
    fetchData() {
        const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();

        // Build up the list of ranges we want to batch-get
        let ranges = [];
        this.rangeAssociations = [];

        for (const sheetName in this.averagesRanges) {
            const sheetRanges = this.averagesRanges[sheetName];

            if (sheetRanges.studentName) {
                ranges.push(sheetRanges.studentName);
                this.rangeAssociations.push({ type: 'studentName', sheetName });
            }
            if (sheetRanges.completeness) {
                ranges.push(sheetRanges.completeness);
                this.rangeAssociations.push({ type: 'completeness', sheetName });
            }
            if (sheetRanges.accuracy) {
                ranges.push(sheetRanges.accuracy);
                this.rangeAssociations.push({ type: 'accuracy', sheetName });
            }
            if (sheetRanges.spag) {
                ranges.push(sheetRanges.spag);
                this.rangeAssociations.push({ type: 'spag', sheetName });
            }
        }

        // Attempt the batchGet
        try {
            const response = Sheets.Spreadsheets.Values.batchGet(spreadsheetId, { ranges });
            this.retrievedData = response.valueRanges;
        } catch (error) {
            // If batchGet fails, attempt to clean invalid ranges
            this.cleanInvalidStoredRanges();

            // Rebuild the ranges from the newly cleaned this.averagesRanges
            ranges = [];
            this.rangeAssociations = [];
            for (const sheetName in this.averagesRanges) {
                const sheetRanges = this.averagesRanges[sheetName];

                if (sheetRanges.studentName) {
                    ranges.push(sheetRanges.studentName);
                    this.rangeAssociations.push({ type: 'studentName', sheetName });
                }
                if (sheetRanges.completeness) {
                    ranges.push(sheetRanges.completeness);
                    this.rangeAssociations.push({ type: 'completeness', sheetName });
                }
                if (sheetRanges.accuracy) {
                    ranges.push(sheetRanges.accuracy);
                    this.rangeAssociations.push({ type: 'accuracy', sheetName });
                }
                if (sheetRanges.spag) {
                    ranges.push(sheetRanges.spag);
                    this.rangeAssociations.push({ type: 'spag', sheetName });
                }
            }

            // Attempt batchGet again with cleaned references
            try {
                const retryResponse = Sheets.Spreadsheets.Values.batchGet(spreadsheetId, { ranges });
                this.retrievedData = retryResponse.valueRanges;
            } catch (error2) {
                // If it still fails, bubble up a clearer error
                throw new Error('After cleaning invalid references, batchGet still fails. Please check references manually.');
            }
        }
    }

    /**
     * Cleans any invalid references (e.g. removed sheets) from the stored ranges.
     */
    cleanInvalidStoredRanges() {
        const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
        const documentProperties = PropertiesService.getDocumentProperties();
        let hasChanges = false;

        // Create a new object to store valid ranges
        const validRanges = {};

        // Check each sheet in averagesRanges
        for (const sheetName in this.averagesRanges) {
            const sheet = spreadsheet.getSheetByName(sheetName);
            if (sheet) {
                // Sheet exists, keep its ranges
                validRanges[sheetName] = this.averagesRanges[sheetName];
            } else {
                // Sheet doesn't exist, skip it
                hasChanges = true;
                console.log(`Removing references to deleted sheet: ${sheetName}`);
            }
        }

        if (hasChanges) {
            // Update stored ranges with only valid entries
            documentProperties.setProperty('averagesRanges', JSON.stringify(validRanges));
            this.averagesRanges = validRanges;
        }
    }

    /**
     * Calculates overall averages for each student, skipping non-numeric values.
     */
    calculateAverages() {
        const studentData = {};

        for (let i = 0; i < this.retrievedData.length; i++) {
            const association = this.rangeAssociations[i];
            const values = this.retrievedData[i].values || [];

            values.forEach((row, index) => {
                const value = row[0];
                const studentKey = `${association.sheetName}_${index}`;

                if (association.type === 'studentName') {
                    if (!studentData[studentKey]) {
                        studentData[studentKey] = { name: value };
                    } else {
                        studentData[studentKey].name = value;
                    }
                } else {
                    const numericValue = parseFloat(value);
                    if (!studentData[studentKey]) {
                        studentData[studentKey] = { name: '' };
                    }
                    if (!studentData[studentKey][association.type]) {
                        studentData[studentKey][association.type] = 0;
                        studentData[studentKey][`${association.type}Count`] = 0;
                    }
                    if (!isNaN(numericValue)) {
                        studentData[studentKey][association.type] += numericValue;
                        studentData[studentKey][`${association.type}Count`] += 1;
                    }
                }
            });
        }

        // Aggregate data by student name
        const aggregatedData = {};

        for (const key in studentData) {
            const data = studentData[key];
            const name = data.name.trim();
            if (!name) continue; // Skip entries without a name

            if (!aggregatedData[name]) {
                aggregatedData[name] = {
                    completeness: 0,
                    completenessCount: 0,
                    accuracy: 0,
                    accuracyCount: 0,
                    spag: 0,
                    spagCount: 0
                };
            }

            if (data.completeness !== undefined) {
                aggregatedData[name].completeness += data.completeness;
                aggregatedData[name].completenessCount += data.completenessCount;
            }

            if (data.accuracy !== undefined) {
                aggregatedData[name].accuracy += data.accuracy;
                aggregatedData[name].accuracyCount += data.accuracyCount;
            }

            if (data.spag !== undefined) {
                aggregatedData[name].spag += data.spag;
                aggregatedData[name].spagCount += data.spagCount;
            }
        }

        // Prepare student averages array
        this.studentAverages = [];

        for (const name in aggregatedData) {
            const data = aggregatedData[name];

            const completenessAvg = data.completenessCount > 0
                ? (data.completeness / data.completenessCount).toFixed(2)
                : 'N/A';

            const accuracyAvg = data.accuracyCount > 0
                ? (data.accuracy / data.accuracyCount).toFixed(2)
                : 'N/A';

            const spagAvg = data.spagCount > 0
                ? (data.spag / data.spagCount).toFixed(2)
                : 'N/A';

            this.studentAverages.push({
                name: name,
                completeness: completenessAvg,
                accuracy: accuracyAvg,
                spag: spagAvg
            });
        }

        // Sort students alphabetically
        this.studentAverages.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Builds batchUpdate requests to populate the overview sheet.
     */
    buildRequests() {
        const sheetId = this.sheet.getSheetId();

        // Ensure enough columns
        this.ensureSheetHasEnoughColumns(this.headers.length);

        // Create headers
        this.requests.push(this.createHeaderValuesRequest(sheetId, this.headers, 0));

        // Format headers
        this.requests.push(this.createHeaderFormattingRequest(sheetId, this.headers.length, 0, 1));

        // Set column widths
        const columnWidths = [200, 75, 75, 75, 75];
        this.requests.push(...this.createColumnWidthRequests(sheetId, columnWidths));

        // Freeze headers
        this.requests.push(this.createFreezeRequest(sheetId, 1, 1));

        // Add data rows
        this.addDataRows(sheetId);

        // Add class average row
        this.addClassAverageRow(sheetId);

        // Apply conditional formatting
        this.applyFormatting(sheetId);
    }

    /**
     * Adds data rows for each student's averages.
     * @param {number} sheetId - The ID of the sheet.
     */
    addDataRows(sheetId) {
        const startRowIndex = 1; // Data starts after headers

        this.studentAverages.forEach((student, index) => {
            const rowData = [
                { userEnteredValue: { stringValue: student.name } },
                {
                    userEnteredValue: {
                        numberValue: student.completeness !== 'N/A' ? parseFloat(student.completeness) : null
                    }
                },
                {
                    userEnteredValue: {
                        numberValue: student.accuracy !== 'N/A' ? parseFloat(student.accuracy) : null
                    }
                },
                {
                    userEnteredValue: {
                        numberValue: student.spag !== 'N/A' ? parseFloat(student.spag) : null
                    }
                },
                {
                    userEnteredValue: {
                        formulaValue: `=IFERROR(ROUND(AVERAGE(B${startRowIndex + index + 1}:D${startRowIndex + index + 1}),1),0)`
                    }
                }
            ];

            this.requests.push({
                updateCells: {
                    rows: [{ values: rowData }],
                    fields: 'userEnteredValue',
                    start: { sheetId, rowIndex: startRowIndex + index, columnIndex: 0 }
                }
            });
        });
    }

    /**
     * Adds the class average row to the sheet.
     * @param {number} sheetId - The ID of the sheet.
     */
    addClassAverageRow(sheetId) {
        const lastDataRowIndex = this.studentAverages.length + 1;
        const averageRowIndex = lastDataRowIndex + 1; // One blank row in between

        // Add blank row
        this.requests.push({
            updateCells: {
                rows: [{}],
                fields: 'userEnteredValue',
                start: { sheetId, rowIndex: lastDataRowIndex, columnIndex: 0 }
            }
        });

        // Prepare Class Average row
        const rowData = [
            {
                userEnteredValue: { stringValue: 'Class Average' },
                userEnteredFormat: { textFormat: { bold: true } }
            }
        ];

        const columns = ['B', 'C', 'D', 'E'];
        columns.forEach(col => {
            let formula;
            if (col === 'E') {
                // Overall average
                formula = `=IFERROR(ROUND(AVERAGE(E2:E${lastDataRowIndex}),1),0)`;
            } else {
                // Column-specific average
                formula = `=IFERROR(ROUND(AVERAGE(${col}2:${col}${lastDataRowIndex}),1),0)`;
            }

            rowData.push({
                userEnteredValue: { formulaValue: formula },
                userEnteredFormat: {
                    horizontalAlignment: "CENTER",
                    verticalAlignment: "MIDDLE",
                    textFormat: { bold: true }
                }
            });
        });

        // Add Class Average row
        this.requests.push({
            updateCells: {
                rows: [{ values: rowData }],
                fields: 'userEnteredValue,userEnteredFormat',
                start: { sheetId, rowIndex: averageRowIndex, columnIndex: 0 }
            }
        });
    }

    /**
     * Applies conditional formatting to the data cells.
     * @param {number} sheetId - The ID of the sheet.
     */
    applyFormatting(sheetId) {
        const numRows = this.studentAverages.length + 1; // Data rows plus header row
        const numColumns = this.headers.length;

        // Apply basic cell formatting
        this.requests.push({
            repeatCell: {
                range: {
                    sheetId,
                    startRowIndex: 1, // After headers
                    endRowIndex: numRows + 2, // Including blank and average rows
                    startColumnIndex: 1,
                    endColumnIndex: numColumns
                },
                cell: {
                    userEnteredFormat: {
                        horizontalAlignment: "CENTER",
                        verticalAlignment: "MIDDLE"
                    }
                },
                fields: "userEnteredFormat(horizontalAlignment,verticalAlignment)"
            }
        });

        // Create conditional formatting requests
        this.requests.push(...this.createConditionalFormattingRequests(sheetId, numRows, numColumns));
    }

    /**
     * Creates conditional formatting requests for the data cells.
     * @param {number} sheetId - The ID of the sheet.
     * @param {number} numRows - The number of data rows.
     * @param {number} numColumns - The number of columns to format.
     * @returns {Array<Object>} - An array of conditional formatting requests.
     */
    createConditionalFormattingRequests(sheetId, numRows, numColumns) {
        const requests = [];
        const startRowIndex = 1; // Data starts after headers
        const endRowIndex = numRows + 2; // Including blank row and class average row
        const startColumnIndex = 1; // Start from 'Completeness' column
        const endColumnIndex = numColumns;

        const range = {
            sheetId,
            startRowIndex,
            startColumnIndex,
            endRowIndex,
            endColumnIndex
        };

        // Gradient formatting based on score
        requests.push({
            addConditionalFormatRule: {
                rule: {
                    ranges: [range],
                    gradientRule: {
                        minpoint: {
                            color: { red: 1, green: 0, blue: 0 }, // Red for 0
                            type: "NUMBER",
                            value: "0"
                        },
                        midpoint: {
                            color: { red: 1, green: 1, blue: 0 }, // Yellow for 2.5
                            type: "NUMBER",
                            value: "2.5"
                        },
                        maxpoint: {
                            color: { red: 0, green: 1, blue: 0 }, // Green for 5
                            type: "NUMBER",
                            value: "5"
                        }
                    }
                },
                index: 0
            }
        });

        return requests;
    }

    /**
     * Ensures the sheet has enough columns.
     * @param {number} requiredColumns - The number of required columns.
     */
    ensureSheetHasEnoughColumns(requiredColumns) {
        const currentColumns = this.sheet.getMaxColumns();
        if (currentColumns < requiredColumns) {
            this.sheet.insertColumnsAfter(currentColumns, requiredColumns - currentColumns);
        }
    }

    /**
     * Creates a request to set header values.
     * @param {number} sheetId - The ID of the sheet.
     * @param {Array<string>} headers - The header titles.
     * @param {number} rowIndex - The row index for setting headers.
     * @returns {Object} - The request for updating header values.
     */
    createHeaderValuesRequest(sheetId, headers, rowIndex) {
        return {
            updateCells: {
                rows: [{
                    values: headers.map(header => ({
                        userEnteredValue: { stringValue: header }
                    }))
                }],
                fields: 'userEnteredValue',
                start: { sheetId, rowIndex, columnIndex: 0 }
            }
        };
    }

    /**
     * Creates a request to format headers.
     * @param {number} sheetId - The ID of the sheet.
     * @param {number} numColumns - Number of columns to format.
     * @param {number} rowIndex - The row index of headers.
     * @param {number} numRows - Number of rows to format.
     * @returns {Object} - The request for header formatting.
     */
    createHeaderFormattingRequest(sheetId, numColumns, rowIndex, numRows) {
        return {
            repeatCell: {
                range: {
                    sheetId,
                    startRowIndex: rowIndex,
                    endRowIndex: rowIndex + numRows,
                    startColumnIndex: 0,
                    endColumnIndex: numColumns
                },
                cell: {
                    userEnteredFormat: {
                        textFormat: { bold: true },
                        horizontalAlignment: "CENTER",
                        verticalAlignment: "MIDDLE"
                    }
                },
                fields: "userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)"
            }
        };
    }

    /**
     * Creates requests to set column widths.
     * @param {number} sheetId - The ID of the sheet.
     * @param {Array<number>} widths - Array of widths for each column.
     * @returns {Array<Object>} - Array of requests to set column widths.
     */
    createColumnWidthRequests(sheetId, widths) {
        return widths.map((width, index) => ({
            updateDimensionProperties: {
                range: {
                    sheetId,
                    dimension: "COLUMNS",
                    startIndex: index,
                    endIndex: index + 1
                },
                properties: { pixelSize: width },
                fields: "pixelSize"
            }
        }));
    }

    /**
     * Creates a request to freeze rows or columns.
     * @param {number} sheetId - The ID of the sheet.
     * @param {number} frozenRowCount - Number of rows to freeze.
     * @param {number} frozenColumnCount - Number of columns to freeze.
     * @returns {Object} - The request for freezing row/column.
     */
    createFreezeRequest(sheetId, frozenRowCount, frozenColumnCount) {
        return {
            updateSheetProperties: {
                properties: {
                    sheetId,
                    gridProperties: {
                        frozenRowCount,
                        frozenColumnCount
                    }
                },
                fields: "gridProperties.frozenRowCount, gridProperties.frozenColumnCount"
            }
        };
    }

    /**
     * Executes all batch update requests.
     */
    executeBatchUpdate() {
        if (this.requests.length === 0) return;

        const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
        Sheets.Spreadsheets.batchUpdate({ requests: this.requests }, spreadsheetId);
    }
}
