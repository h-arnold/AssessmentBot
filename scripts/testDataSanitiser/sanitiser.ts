import * as fs from 'fs';
import * as path from 'path';

// Core configuration for identifying PII target fields
const TARGET_FIELDS = {
  studentNames: ['name', 'studentName'],
  teacherNames: ['teacherName'],
  emails: ['email'],
  identifiers: [
    'id',
    'userId',
    'studentId',
    'documentId',
    'referenceDocumentId',
    'templateDocumentId',
  ],
};

// Structural patterns to catch PII regardless of key name (Schema-Agnostic fallback)
const REGEX_PATTERNS = {
  // Matches standard email formats
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // Matches 21-digit numeric system identifiers (User/Student IDs)
  numericId: /\b\d{21}\b/g,
  // Fallback: Matches loose Google resource IDs starting with '1' ranging from 40 to 57 characters
  looseGoogleId: /\b1[a-zA-Z0-9-_]{39,56}\b/g,
};

// Global state tracking for sequential mapping and stateful translation
const translationMap = new Map<string, string>();
let studentCounter = 0;
let teacherCounter = 0;

/**
 * Utility function that scrambles a string while perfectly preserving its
 * character length, casing, numeric locations, and punctuation/special symbols.
 * (e.g. "arnoldh12@hwbcymru.net" -> "pqskjba45@lxodhtru.net")
 */
function preserveShapeScramble(input: string): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';

  return input
    .split('')
    .map((char) => {
      if (/[a-z]/.test(char)) {
        return lowercase[Math.floor(Math.random() * lowercase.length)];
      } else if (/[A-Z]/.test(char)) {
        return uppercase[Math.floor(Math.random() * uppercase.length)];
      } else if (/[0-9]/.test(char)) {
        return digits[Math.floor(Math.random() * digits.length)];
      }
      return char; // Keeps hyphens, underscores, @, periods, etc. completely intact
    })
    .join('');
}

/**
 * Extracts Google Drive resource IDs from standard URL formats (Docs, Sheets, Slides, Folders, Files).
 * This works for both path-based identifiers and query-based parameters.
 */
function extractGoogleDriveIds(text: string): string[] {
  const ids: string[] = [];

  // Pattern 1: Path-based resources e.g. /document/d/[ID]/edit, /drive/folders/[ID]
  const pathPattern =
    /https?:\/\/(?:docs|drive)\.google\.com\/(?:[a-zA-Z0-9-%._+~#=]+\/)+(?:d|folders|file)\/([a-zA-Z0-9-_]{25,100})/gi;

  // Pattern 2: Query-based resources e.g. /open?id=[ID]
  const queryPattern =
    /https?:\/\/drive\.google\.com\/open\?[a-zA-Z0-9-%._+~#=]*id=([a-zA-Z0-9-_]{25,100})/gi;

  for (const match of text.matchAll(pathPattern)) {
    if (match[1]) ids.push(match[1]);
  }

  for (const match of text.matchAll(queryPattern)) {
    if (match[1]) ids.push(match[1]);
  }

  return ids;
}

/**
 * Adds names and their sub-components (first name, last name) to the translation map.
 * This guarantees that if a student writes just "Benjamin" or "Wainwright" in their
 * actual assessed text content, it gets intercepted and sanitized consistently.
 */
function registerNameWithSubTokens(fullName: string, placeholder: string): void {
  // 1. Register the full name
  translationMap.set(fullName, placeholder);

  // 2. Extract and register sub-tokens (first name, last name) to capture casual usage in text
  const parts = fullName.trim().split(/\s+/);
  if (parts.length > 1) {
    parts.forEach((part, index) => {
      // Ignore very short tokens (e.g., middle initials like "J.") to prevent false positives
      if (part.length > 2 && !translationMap.has(part)) {
        const suffix = index === 0 ? '_First' : `_Last${index > 1 ? index : ''}`;
        translationMap.set(part, `${placeholder}${suffix}`);
      }
    });
  }
}

/**
 * Pass 1: Recursively inspects parsed JSON data to discover sensitive values
 * and populate the central cross-file translation map. Includes guards
 * to ignore data that has already been sanitized (Idempotency).
 */
function discoverPII(data: any): void {
  if (!data || typeof data !== 'object') return;

  if (Array.isArray(data)) {
    for (const item of data) {
      discoverPII(item);
    }
    return;
  }

  for (const key of Object.keys(data)) {
    const value = data[key];

    if (typeof value === 'string' && value.trim() !== '') {
      // --- IDEMPOTENCY GUARD ---
      // If we encounter standard patterns of already sanitized names, skip
      if (/^(studentName|teacherName)\d+(_(First|Last\d*))?$/.test(value)) {
        continue;
      }

      // 1. Process Student Names explicitly
      if (TARGET_FIELDS.studentNames.includes(key)) {
        if (!translationMap.has(value)) {
          studentCounter++;
          registerNameWithSubTokens(value, `studentName${studentCounter}`);
        }
        continue;
      }

      // 2. Process Teacher Names explicitly
      if (TARGET_FIELDS.teacherNames.includes(key)) {
        if (!translationMap.has(value)) {
          teacherCounter++;
          registerNameWithSubTokens(value, `teacherName${teacherCounter}`);
        }
        continue;
      }

      // 3. Process Schema-Agnostic Fallback matching (Shape and URL detection)

      // Catch and scramble emails
      const emailsFound = value.match(REGEX_PATTERNS.email);
      if (emailsFound) {
        emailsFound.forEach((email) => {
          if (!translationMap.has(email)) {
            translationMap.set(email, preserveShapeScramble(email));
          }
        });
      }

      // Catch and scramble IDs found in Google Drive URLs
      const googleDriveIds = extractGoogleDriveIds(value);
      googleDriveIds.forEach((docId) => {
        if (!translationMap.has(docId)) {
          translationMap.set(docId, preserveShapeScramble(docId));
        }
      });

      // Catch and scramble loose/unstructured Google Document IDs
      const looseDocsFound = value.match(REGEX_PATTERNS.looseGoogleId);
      if (looseDocsFound) {
        looseDocsFound.forEach((docId) => {
          if (!translationMap.has(docId)) {
            translationMap.set(docId, preserveShapeScramble(docId));
          }
        });
      }

      // Catch and scramble 21-digit system IDs
      const idsFound = value.match(REGEX_PATTERNS.numericId);
      if (idsFound) {
        idsFound.forEach((id) => {
          if (!translationMap.has(id)) {
            translationMap.set(id, preserveShapeScramble(id));
          }
        });
      }
    } else {
      // Deep traverse nested arrays or objects
      discoverPII(value);
    }
  }
}

/**
 * Pass 2: Executes a single-pass global substring swap against raw text serialization.
 * Compiles a single master Regular Expression dynamically to prevent sub-token collisions.
 */
function applySanitization(rawContent: string): string {
  // Sort keys descending by length to ensure longer values are matched first
  // (e.g. "Benjamin Wainwright" matches before "Benjamin" can be partially intercepted)
  const sortedKeys = Array.from(translationMap.keys()).sort((a, b) => b.length - a.length);

  if (sortedKeys.length === 0) {
    return rawContent;
  }

  // Escape special regex characters (such as dots, hyphens, and parentheses in emails/names)
  const escapedKeys = sortedKeys.map((key) => key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));

  // Combine all strings into a single "OR" alternation regex
  const masterRegex = new RegExp(escapedKeys.join('|'), 'g');

  // Replace in a single left-to-right scan. Replaced pieces are never evaluated twice!
  return rawContent.replace(masterRegex, (match) => {
    return translationMap.get(match) || match;
  });
}

/**
 * Main execution handler to process and sanitize JSON file collections
 * @param filePaths Array of local JSON files to sanitize
 * @param outputDir Target directory to write clean snapshots
 */
export function sanitizeCollections(filePaths: string[], outputDir: string): void {
  const fileContents: { path: string; raw: string }[] = [];

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('🔄 Executing Pass 1: Crawling data structures & applying regex guards...');
  for (const fPath of filePaths) {
    if (!fs.existsSync(fPath)) {
      console.warn(`⚠️ File not found, skipping: ${fPath}`);
      continue;
    }
    const raw = fs.readFileSync(fPath, 'utf8');
    fileContents.push({ path: fPath, raw });

    try {
      const parsed = JSON.parse(raw);
      discoverPII(parsed);
    } catch (err) {
      console.error(`❌ JSON parser error on file: ${fPath}`, err);
    }
  }

  console.log(`✅ Discovery complete. Registered ${translationMap.size} unique translation rules.`);
  console.log(
    '🔄 Executing Pass 2: Sanitizing structures using a collision-proof single-pass replaces...'
  );

  for (const file of fileContents) {
    const sanitizedRaw = applySanitization(file.raw);
    const fileName = path.basename(file.path);
    const destPath = path.join(outputDir, `sanitized_${fileName}`);

    fs.writeFileSync(destPath, sanitizedRaw, 'utf8');
    console.log(`💾 Saved sanitized snapshot -> ${destPath}`);
  }

  console.log('🎉 Operations completed successfully.');
}
