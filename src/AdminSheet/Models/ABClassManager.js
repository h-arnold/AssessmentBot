/**
 * ABClassManager
 *
 * Small utility to load and save ABClass instances from the JsonDbApp-backed
 * collections managed by DbManager. The convention used here is that each
 * class is stored in a collection named after its classId. The documents inside
 * that collection are plain serialized ABClass objects (from ABClass.toJSON()).
 */

// Ensure BaseSingleton and DbManager are available in Apps Script runtime
require('../../00_BaseSingleton.js');
let DbManagerRef = null;
if (typeof require === 'function') {
  DbManagerRef = require('../DbManager/DbManager.js');
} else if (typeof DbManager !== 'undefined') {
  DbManagerRef = DbManager;
}

// In Node tests ABClass is exported as { ABClass } from ABClass.js; in GAS it's global.
let ABClassRef = null;
if (typeof require === 'function') {
  ABClassRef = require('./ABClass.js');
} else if (typeof ABClass !== 'undefined') {
  ABClassRef = ABClass;
}
const ABClass = ABClassRef?.ABClass ?? ABClassRef;

class ABClassManager {
  constructor() {
    this.dbManager = DbManager.getInstance ? DbManager.getInstance() : new DbManager(true);
  }

  /**
   * Load an ABClass by its classId. Returns an ABClass instance or null if not found.
   * Strategy: read all documents from the collection named by classId, pick the
   * first document (collection stores a single ABClass serialized object) and
   * call ABClass.fromJSON on it.
   *
   * @param {string} classId
   * @returns {ABClass|null}
   */
  loadClass(classId) {
    if (!classId) throw new TypeError('classId is required');
    const colName = String(classId);
    const docs = this.dbManager.readAll(colName) || [];
    if (!docs || docs.length === 0) return null;
    // If multiple docs exist, prefer the first (legacy behaviour)
    const doc = docs[0];
    return typeof ABClass?.fromJSON === 'function' ? ABClass.fromJSON(doc) : null;
  }

  /**
   * Save an ABClass instance (or plain object) to its collection named by classId.
   * Replaces all documents in the collection with a single serialized object.
   * Returns true on success.
   *
   * @param {ABClass|Object} abClass
   * @returns {boolean}
   */
  saveClass(abClass) {
    if (!abClass?.classId) throw new TypeError('abClass with classId is required');
    const colName = String(abClass.classId);
    const serialized = typeof abClass?.toJSON === 'function' ? abClass.toJSON() : abClass;

    const collection = this.dbManager.getCollection(colName);

    // Normalize to an insert/update path. Prefer updateOne upsert when available.
    if (typeof collection.updateOne === 'function' && serialized && '_id' in serialized) {
      collection.updateOne({ _id: serialized._id }, { $set: serialized }, { upsert: true });
    } else if (typeof collection.insertOne === 'function') {
      // Attempt to clear/replace by removing all docs first if API available
      try {
        if (typeof collection.removeMany === 'function') collection.removeMany({});
        else if (typeof collection.clear === 'function') collection.clear();
      } catch (err) {
        console.warn('Collection clear attempt failed, continuing to insert', err);
      }
      collection.insertOne(serialized);
    } else {
      throw new Error('Collection API does not support insert or update operations');
    }

    // Persist changes
    if (typeof collection.save === 'function') collection.save();
    else this.dbManager.saveCollection(collection);

    return true;
  }
}

// Export for Node tests
if (typeof module !== 'undefined') {
  module.exports = ABClassManager;
}
