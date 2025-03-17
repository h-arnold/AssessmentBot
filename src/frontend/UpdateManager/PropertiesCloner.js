/**************************************************
 * PropertiesCloner Class
 * Gets all script and document properties, serialises them
 * and stores them in a hidden Google Sheet so that they can be deserialised again.
 * Currently this is used to manage updates of sheets.
 **************************************************/
class PropertiesCloner extends BaseSheetManager {
  /**
   * A subclass of BaseSheetManager for cloning Document and Script properties.
   * @param {string} [sheetName='propertiesStore'] - The name of the sheet to store properties.
   */
  constructor(sheet = 'propertiesStore', spreadSheetId = null) {
    super(sheet, spreadSheetId); // calls BaseSheetManager constructor
    
    // Retrieve references to Document and Script properties upfront
    this.docProperties = PropertiesService.getDocumentProperties();
    this.scriptProperties = PropertiesService.getScriptProperties();
  }

  /**
   * Serialises document and/or script properties to a hidden spreadsheet.
   * Creates a table with columns: Type, Key, Value.
   * Each property is stored as a row with its type (DOCUMENT/SCRIPT), key and value.
   *
   * @param {boolean} [serialiseDocProps=true] - Whether to serialise document properties
   * @param {boolean} [serialiseScriptProps=true] - Whether to serialise script properties
   * @returns {void} - Returns nothing if both parameters are false
   */
  serialiseProperties(serialiseDocProps = true, serialiseScriptProps = true) {
    // Prepare data array with a header row: [Type, Key, Value]
    const data = [['Type', 'Key', 'Value']];

    // Document Properties
    if (serialiseDocProps) {
      const docKeys = this.docProperties.getKeys();
      docKeys.forEach(key => {
        data.push(['DOCUMENT', key, this.docProperties.getProperty(key)]);
      });
    }

    // Script Properties
    if (serialiseScriptProps) {
      const scriptKeys = this.scriptProperties.getKeys();
      scriptKeys.forEach(key => {
        data.push(['SCRIPT', key, this.scriptProperties.getProperty(key)]);
      });
    }

    if (!serialiseDocProps && !serialiseScriptProps) {
      console.log('You have selected false for serialising document and script properties so nothing will be saved.');
      return;
    }

    // Write data to sheet and then hide it
    this.setAllValues(data);
    this.sheet.hideSheet();
  }

  /**
   * Deserialises properties stored in 'propertiesStore' back into Document and Script properties.
   * @param {boolean} [deleteSheetAfter=false] - Whether to delete the sheet after deserialising.
   */
  deserialiseProperties(deleteSheetAfter = false) {
    // Get all values from the sheet, excluding the header row
    const allValues = this.getAllValues();
    // Remove the header row
    const rows = allValues.slice(1);

    rows.forEach(row => {
      const [type, key, value] = row;
      if (type === 'DOCUMENT') {
        this.docProperties.setProperty(key, value);
      } else if (type === 'SCRIPT') {
        this.scriptProperties.setProperty(key, value);
      }
    });

    if (deleteSheetAfter) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      ss.deleteSheet(this.sheet);
    }
  }

  /**
   * Clears all script and document properties, then deletes the 'propertiesStore' sheet.
   */
  clearPropertiesAndSheet() {
    // Delete all document and script properties
    this.docProperties.deleteAllProperties();
    this.scriptProperties.deleteAllProperties();

    // Delete the sheet from the active spreadsheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.deleteSheet(this.sheet);
  }
}