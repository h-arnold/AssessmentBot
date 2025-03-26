#!/bin/bash
set -e

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <input-directory> <output-directory>"
  exit 1
fi

INPUT_DIR="$1"
OUTPUT_DIR="$2"

mkdir -p "$OUTPUT_DIR"

# Find all files recursively within the input directory
find "$INPUT_DIR" -type f | while read -r file; do
  # Strip the input directory prefix to obtain the relative path
  relative="${file#$INPUT_DIR/}"
  # Replace directory separators with underscores to flatten the filename
  flattened_name=$(echo "$relative" | tr '/' '_')
  cp "$file" "$OUTPUT_DIR/$flattened_name"
done

echo "Flattened files from $INPUT_DIR to $OUTPUT_DIR"
