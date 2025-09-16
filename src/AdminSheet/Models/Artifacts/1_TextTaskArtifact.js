class TextTaskArtifact extends BaseTaskArtifact {
  getType() { return 'TEXT'; }
  normalizeContent(content) {
    if (content == null) return null;
    if (typeof content !== 'string') content = String(content);
    const normalised = content.replace(/\r\n?/g, '\n').trim();
    return normalised === '' ? null : normalised;
  }
  static fromRawText(raw, params) {
    return new TextTaskArtifact({ ...params, content: raw });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TextTaskArtifact;
} else {
  this.TextTaskArtifact = TextTaskArtifact;
}
