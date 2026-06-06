/**
 * GASPropertiesUtils - Utility methods for Google Apps Script PropertiesService operations.
 *
 * Provides a single, canonical entry point for ScriptProperties and UserProperties
 * operations. All methods are static and do not require instantiation.
 *
 * @remarks This is the canonical entry point for PropertiesService access.
 * Direct calls to PropertiesService.getScriptProperties() and
 * PropertiesService.getUserProperties() should be migrated to use this class
 * opportunistically.
 */
// eslint-disable-next-line unicorn/no-static-only-class
class GASPropertiesUtils {
  /**
   * Returns the ScriptProperties service instance.
   * @returns {GoogleAppsScript.Properties.ScriptProperties} The ScriptProperties service.
   */
  static getScriptProperties() {
    return PropertiesService.getScriptProperties();
  }

  /**
   * Returns the UserProperties service instance.
   * @returns {GoogleAppsScript.Properties.UserProperties} The UserProperties service.
   */
  static getUserProperties() {
    return PropertiesService.getUserProperties();
  }

  /**
   * Sets each key-value pair from the given propertyMap on the specified properties store.
   * @param {GoogleAppsScript.Properties.Properties} properties - The properties store to update.
   * @param {Object<string, string>} propertyMap - An object mapping property keys to their values.
   * @returns {void}
   */
  static applyProperties(properties, propertyMap) {
    const entries = Object.entries(propertyMap);
    for (const [key, value] of entries) {
      properties.setProperty(key, value);
    }
  }

  /**
   * Deletes each key in the given keys array from the specified properties store.
   * @param {GoogleAppsScript.Properties.Properties} properties - The properties store to update.
   * @param {string[]} keys - An array of property keys to delete.
   * @returns {void}
   */
  static clearProperties(properties, keys) {
    for (const key of keys) {
      properties.deleteProperty(key);
    }
  }
}

// Export for Node/Vitest environment
if (typeof module !== 'undefined') {
  module.exports = GASPropertiesUtils;
}
