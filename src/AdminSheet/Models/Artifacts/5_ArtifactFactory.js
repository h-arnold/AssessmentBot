class ArtifactFactory {
  static create(params) {
    const rawType = (params.type || '').toString();
    const type = rawType.toUpperCase();
    switch (type) {
      case 'TEXT': return new TextTaskArtifact(params);
      case 'TABLE': return new TableTaskArtifact(params);
      case 'SPREADSHEET': return new SpreadsheetTaskArtifact(params);
      case 'IMAGE': return new ImageTaskArtifact(params);
      default: return new BaseTaskArtifact(params);
    }
  }
  static fromJSON(json) { return this.create(json); }
  static text(params) { return this.create({ ...params, type: 'TEXT' }); }
  static table(params) { return this.create({ ...params, type: 'TABLE' }); }
  static spreadsheet(params) { return this.create({ ...params, type: 'SPREADSHEET' }); }
  static image(params) { return this.create({ ...params, type: 'IMAGE' }); }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ArtifactFactory;
} else {
  this.ArtifactFactory = ArtifactFactory;
}
