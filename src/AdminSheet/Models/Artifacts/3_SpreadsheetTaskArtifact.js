const BaseTaskArtifact =
  typeof module !== 'undefined' && module.exports
    ? require('./99_BaseTaskArtifact.js')
    : this.BaseTaskArtifact;

class SpreadsheetTaskArtifact extends BaseTaskArtifact {
  getType() {
    return 'SPREADSHEET';
  }
  normalizeContent(content) {
    if (content == null) return null;
    if (typeof content === 'string') return null;
    if (!Array.isArray(content)) return null;
    const rows = content.map((row) =>
      Array.isArray(row) ? row.map((cell) => this._normCell(cell)) : []
    );
    const trimmed = this._trimEmpty(rows);
    if (!trimmed.length) return null;
    for (let r = 0; r < trimmed.length; r++) {
      for (let c = 0; c < trimmed[r].length; c++) {
        const cell = trimmed[r][c];
        if (typeof cell === 'string' && cell.startsWith('=')) {
          trimmed[r][c] = this._canonicaliseFormula(cell);
        }
      }
    }
    return trimmed;
  }
  _normCell(cell) {
    if (cell == null) return null;
    if (typeof cell === 'number') return cell;
    const s = String(cell).trim();
    return s === '' ? null : s;
  }
  _trimEmpty(rows) {
    while (rows.length && this._rowEmpty(rows[rows.length - 1])) rows.pop();
    if (rows.length) {
      let colCount = Math.max(...rows.map((r) => r.length));
      for (let c = colCount - 1; c >= 0; c--) {
        let allEmpty = true;
        for (let r = 0; r < rows.length; r++) {
          const v = rows[r][c];
          if (!(v == null || v === '')) {
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
    return !row.some((c) => !(c == null || c === ''));
  }
  _canonicaliseFormula(f) {
    let result = '';
    let inQuote = false;
    for (let i = 0; i < f.length; i++) {
      const ch = f[i];
      if (ch === '"') {
        inQuote = !inQuote;
        result += ch;
        continue;
      }
      result += inQuote ? ch : ch.toUpperCase();
    }
    return result;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpreadsheetTaskArtifact;
} else {
  this.SpreadsheetTaskArtifact = SpreadsheetTaskArtifact;
}
