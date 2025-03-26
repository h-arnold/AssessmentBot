#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * This script aims to replicate the functionality of clasp so that `gas-action` can push the resulting script.
 * Recursively traverses the input directory, copying each file to the output directory.
 * The new filename encodes the original directory structure by replacing path separators with underscores.
 *
 * @param {string} inputDir - The source directory to flatten.
 * @param {string} outputDir - The destination directory where flattened files will be stored.
 */
function flattenDirectory(inputDir, outputDir) {
  // Create the output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  /**
   * Internal function to recursively traverse directories.
   *
   * @param {string} currentDir - The current directory being processed.
   */
  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile()) {
        // Compute the relative path and then create a flattened file name
        const relativePath = path.relative(inputDir, fullPath);
        const flattenedName = relativePath.split(path.sep).join('_');
        const destination = path.join(outputDir, flattenedName);
        fs.copyFileSync(fullPath, destination);
      }
    }
  }
  traverse(inputDir);
}

// Read command-line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node flatten.js <input-directory> <output-directory>');
  process.exit(1);
}

const [inputDir, outputDir] = args;
flattenDirectory(inputDir, outputDir);
console.log(`Flattened files from ${inputDir} to ${outputDir}`);
