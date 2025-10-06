/**
 * DbManager
 *
 * A thin, idiomatic wrapper around the JsonDbApp library that:
 * - Verifies the JsonDbApp library is available
 * - Lazily initialises/loads the database using a configured master index
 * - Exposes convenient helpers for fetching and saving collections
 * - Centralises error handling via ProgressTracker
 */

class DbManager extends BaseSingleton {
  constructor(isSingletonCreator = false) {
    // follow BaseSingleton convention: only allow heavy construction when flag provided
    super();
    // Singleton guard: constructor should only execute once via getInstance()
    if (!isSingletonCreator && this.constructor._instance) {
      return; // no-op if already constructed
    }

    this.progressTracker = ProgressTracker.getInstance();
    this._db = null;
    this._options = {}; // legacy tests used to inject options; default to empty

    // Validate library presence up-front (fail-fast), but don't initialise DB yet
    this._assertLibraryAvailable();

    if (!this.constructor._instance) {
      this.constructor._instance = this;
    }
  }

  /**
   * Default configuration values. These will be superseded by future
   * ConfigurationManager-backed values once added there.
   */
  static get DEFAULTS() {
    return {
      masterIndexKey: 'ASSESSMENT_BOT_DB_MASTER_INDEX',
      autoCreateCollections: true,
      lockTimeout: 10000,
      logLevel: 'INFO',
      backupOnInitialise: false,
      rootFolderId: null,
    };
  }

  /**
   * Resolve configuration for JsonDbApp. Prefer provided options, then
   * values discoverable from the environment, finally fall back to defaults.
   */
  _getConfig() {
    const defaults = DbManager.DEFAULTS;
    const provided = this._options || {};

    const configManager =
      typeof ConfigurationManager !== 'undefined' &&
      ConfigurationManager &&
      typeof ConfigurationManager.getInstance === 'function'
        ? ConfigurationManager.getInstance()
        : null;

    const managerConfig = configManager
      ? {
          masterIndexKey: configManager.getJsonDbMasterIndexKey(),
          autoCreateCollections: configManager.getJsonDbAutoCreateCollections(),
          lockTimeout: configManager.getJsonDbLockTimeoutMs(),
          logLevel: configManager.getJsonDbLogLevel(),
          backupOnInitialise: configManager.getJsonDbBackupOnInitialise(),
          rootFolderId: configManager.getJsonDbRootFolderId(),
        }
      : {};

    // Root folder: prefer caller-provided, else the parent of the active sheet, else Drive root
    let rootFolderId =
      (Validate.isNonEmptyString(provided.rootFolderId) && provided.rootFolderId) ||
      (Validate.isNonEmptyString(managerConfig.rootFolderId) && managerConfig.rootFolderId) ||
      undefined;
    try {
      if (!rootFolderId && typeof SpreadsheetApp !== 'undefined') {
        const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
        const spreadsheetId =
          spreadsheet && typeof spreadsheet.getId === 'function' ? spreadsheet.getId() : null;
        if (spreadsheetId) {
          const parentId = DriveManager.getParentFolderId(spreadsheetId);
          if (Validate.isNonEmptyString(parentId)) {
            rootFolderId = parentId;
          }
        }
      }
    } catch (e) {
      // Fall back quietly; Drive root will be determined by the library if omitted
      rootFolderId = rootFolderId || undefined;
    }

    const masterIndexKey =
      (Validate.isNonEmptyString(provided.masterIndexKey) && provided.masterIndexKey) ||
      (Validate.isNonEmptyString(managerConfig.masterIndexKey) && managerConfig.masterIndexKey) ||
      defaults.masterIndexKey;

    const autoCreateCollections = Validate.isBoolean(provided.autoCreateCollections)
      ? provided.autoCreateCollections
      : Validate.isBoolean(managerConfig.autoCreateCollections)
      ? managerConfig.autoCreateCollections
      : defaults.autoCreateCollections;

    const lockTimeout = Validate.isNumber(provided.lockTimeout)
      ? provided.lockTimeout
      : Validate.isNumber(managerConfig.lockTimeout)
      ? managerConfig.lockTimeout
      : defaults.lockTimeout;

    const logLevel =
      (Validate.isNonEmptyString(provided.logLevel) && provided.logLevel) ||
      (Validate.isNonEmptyString(managerConfig.logLevel) && managerConfig.logLevel) ||
      defaults.logLevel;

    const backupOnInitialise = Validate.isBoolean(provided.backupOnInitialise)
      ? provided.backupOnInitialise
      : Validate.isBoolean(managerConfig.backupOnInitialise)
      ? managerConfig.backupOnInitialise
      : defaults.backupOnInitialise;

    const resolvedRootFolderId = Validate.isNonEmptyString(rootFolderId) ? rootFolderId : undefined;

    // In the future, these can be read from configurationManager once keys exist.
    return {
      masterIndexKey,
      autoCreateCollections,
      lockTimeout,
      logLevel,
      backupOnInitialise,
      // Only include rootFolderId if we actually resolved one; JsonDbApp can discover a default
      ...(resolvedRootFolderId ? { rootFolderId: resolvedRootFolderId } : {}),
    };
  }

  /**
   * Throws a user-friendly error when the JsonDbApp library cannot be found.
   */
  _assertLibraryAvailable() {
    const ok =
      typeof JsonDbApp !== 'undefined' &&
      JsonDbApp &&
      typeof JsonDbApp.loadDatabase === 'function' &&
      typeof JsonDbApp.createAndInitialiseDatabase === 'function';
    if (!ok) {
      this.progressTracker.logAndThrowError(
        'JsonDbApp library is not available. Please add it as a library to this Apps Script project.'
      );
    }
  }

  /**
   * Returns the connected Database instance. Lazily initialises the DB if needed.
   *
   * Strategy: if ScriptProperties does not contain the masterIndexKey, create a new
   * database; otherwise attempt to load an existing one.
   */
  getDb() {
    if (this._db) return this._db;

    this._assertLibraryAvailable();
    const config = this._getConfig();

    try {
      const hasMaster = !!config.masterIndexKey;
      this._db = hasMaster
        ? JsonDbApp.loadDatabase(config)
        : JsonDbApp.createAndInitialiseDatabase(config);
      return this._db;
    } catch (error) {
      // If loading fails because the MasterIndex is missing, attempt a first-time initialise
      const message = String(error?.message ?? '');
      const missingMaster = /master\s*index|not\s*found|missing/i.test(message);
      if (missingMaster) {
        try {
          this._db = JsonDbApp.createAndInitialiseDatabase(this._getConfig());
          return this._db;
        } catch (initError) {
          this.progressTracker.logAndThrowError(
            'Failed to initialise database (first-time setup).',
            initError
          );
        }
      }
      this.progressTracker.logAndThrowError('Failed to load database.', error);
    }
  }

  /**
   * Ensures the database is initialised. Returns a small status summary for UI/debugging.
   */
  ensureInitialised() {
    const db = this.getDb();
    let collections = [];
    try {
      collections = db.listCollections ? db.listCollections() : [];
    } catch (e) {
      console.warn('DbManager: listCollections failed; continuing.', e);
      collections = [];
    }
    const result = {
      ok: true,
      masterIndexKey: this._getConfig().masterIndexKey,
      collections,
    };

    // Optionally freeze the instance after initialisation if BaseSingleton requests it
    try {
      if (typeof this.constructor._maybeFreeze === 'function') {
        this.constructor._maybeFreeze(this);
      }
    } catch (freezeErr) {
      // Don't prevent normal operation if freezing fails in some environments
      console.warn('DbManager: _maybeFreeze failed or is unsupported.', freezeErr);
    }

    return result;
  }

  /**
   * Fetch a collection by name. Will auto-create if enabled in config (default).
   */
  getCollection(name) {
    if (!name || typeof name !== 'string') {
      this.progressTracker.logAndThrowError('Collection name must be a non-empty string.');
    }
    const db = this.getDb();
    try {
      return db.collection(name);
    } catch (error) {
      this.progressTracker.logAndThrowError(`Failed to get collection "${name}".`, error);
    }
  }

  /**
   * Read all documents from a collection. Returns an array of plain objects.
   */
  readAll(name) {
    const col = this.getCollection(name);
    try {
      // Convention: empty query returns all docs in this implementation
      return col.find({});
    } catch (error) {
      this.progressTracker.logAndThrowError(`Failed to read documents from "${name}".`, error);
    }
  }

  /**
   * Persist any pending changes in the collection to Drive.
   * Accepts either a collection instance or a collection name.
   */
  saveCollection(collectionOrName) {
    const col =
      collectionOrName && typeof collectionOrName.save === 'function'
        ? collectionOrName
        : this.getCollection(collectionOrName);
    try {
      col.save();
      return true;
    } catch (error) {
      const name = typeof collectionOrName === 'string' ? collectionOrName : '<collection>';
      this.progressTracker.logAndThrowError(`Failed to save collection "${name}".`, error);
    }
  }

  /**
   * Insert many documents into the named collection, then persist to Drive.
   */
  insertMany(collectionName, docs) {
    if (!Array.isArray(docs)) {
      this.progressTracker.logAndThrowError('insertMany requires an array of documents.');
    }
    const col = this.getCollection(collectionName);
    try {
      docs.forEach((d) => col.insertOne(d));
      col.save();
      return { inserted: docs.length };
    } catch (error) {
      this.progressTracker.logAndThrowError(`Failed to insert into "${collectionName}".`, error);
    }
  }

  /**
   * Upsert many documents by _id using $set, then persist to Drive.
   */
  upsertManyById(collectionName, docs) {
    if (!Array.isArray(docs)) {
      this.progressTracker.logAndThrowError('upsertManyById requires an array of documents.');
    }
    const col = this.getCollection(collectionName);
    try {
      let count = 0;
      docs.forEach((doc) => {
        if (!doc || typeof doc !== 'object' || !('_id' in doc)) {
          throw new Error('Each document must be an object with an _id field.');
        }
        col.updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
        count++;
      });
      col.save();
      return { upserted: count };
    } catch (error) {
      this.progressTracker.logAndThrowError(`Failed to upsert into "${collectionName}".`, error);
    }
  }
}

// Export for tests (Node environment)
if (typeof module !== 'undefined') {
  module.exports = DbManager;
}
