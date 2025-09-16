const BaseTaskArtifact =
  typeof module !== 'undefined' && module.exports
    ? require('./99_BaseTaskArtifact.js')
    : this.BaseTaskArtifact;

class TableTaskArtifact extends BaseTaskArtifact {
  getType() {
    return 'TABLE';
  }
  normalizeContent(content) {
    if (content == null) return null;
    if (typeof content === 'string') {
      const s = content.trim();
      return s === '' ? null : s;
    }
    if (!Array.isArray(content)) return null;
    const rows = content.map((row) =>
      Array.isArray(row) ? row.map((cell) => this._normCell(cell)) : []
    );
    const trimmed = this._trimEmpty(rows);
    if (!trimmed.length) return null;
    this._rows = trimmed;
    return this.toMarkdown(trimmed);
  }
  getRows() {
    if (this._rows && Array.isArray(this._rows)) return this._rows.map((r) => r.slice());
    return [];
  }
  _normCell(cell) {
    if (cell == null) return null;
    if (typeof cell === 'number') return cell;
    let s = String(cell).trim();
    return s === '' ? null : s;
  }
  _trimEmpty(rows) {
    while (rows.length && this._rowEmpty(rows[rows.length - 1])) rows.pop();
    if (rows.length) {
      let colCount = Math.max(...rows.map((r) => r.length));
      for (let c = colCount - 1; c >= 0; c--) {
        let allEmpty = true;
        for (let r = 0; r < rows.length; r++) {
          if (!this._cellEmpty(rows[r][c])) {
            allEmpty = false;
            break;
          }
        }
        if (allEmpty) {
          for (let r = 0; r < rows.length; r++) rows[r].splice(c, 1);
        }
      }
    }
    return rows;
  }
  _rowEmpty(row) {
    return !row.some((c) => !this._cellEmpty(c));
  }
  _cellEmpty(c) {
    return c == null || c === '';
  }
  toMarkdown(rowsOverride) {
    const candidate = this && this.content !== undefined ? this.content : undefined;
    let src = rowsOverride !== undefined ? rowsOverride : candidate;
    if (!src) return '';
    if (typeof src === 'string') return src.trim();
    if (!Array.isArray(src) || !src.length) return '';
    const header = src[0] || [];
    if (!Array.isArray(header)) return '';
    const lines = [];
    lines.push('| ' + header.map((c) => (c == null ? '' : String(c))).join(' | ') + ' |');
    lines.push('| ' + header.map(() => '---').join(' | ') + ' |');
    for (let i = 1; i < src.length; i++) {
      const row = Array.isArray(src[i]) ? src[i] : [];
      lines.push('| ' + row.map((c) => (c == null ? '' : String(c))).join(' | ') + ' |');
    }
    return lines.join('\n');
  }
  static fromRawCells(rawCells, params) {
    return new TableTaskArtifact({ ...params, content: rawCells });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TableTaskArtifact;
} else {
  this.TableTaskArtifact = TableTaskArtifact;
}
