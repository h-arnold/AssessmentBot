const BaseTaskArtifact = (typeof module !== 'undefined' && module.exports)
  ? require('./0_BaseTaskArtifact.js')
  : this.BaseTaskArtifact;

class ImageTaskArtifact extends BaseTaskArtifact {
  getType() { return 'IMAGE'; }
  normalizeContent(content) {
    if (content == null) return null;
    if (typeof content !== 'string') return null;
    const trimmed = content.trim();
    return trimmed === '' ? null : trimmed;
  }
  setContentFromBlob(blob) {
    if (!blob) return;
    try {
      let bytes;
      if (blob.getBytes) {
        bytes = blob.getBytes();
      }
      if (!bytes) return;
      let base64;
      if (typeof Utilities !== 'undefined' && Utilities.base64Encode) {
        base64 = Utilities.base64Encode(bytes);
      } else if (typeof Buffer !== 'undefined') {
        base64 = Buffer.from(bytes).toString('base64');
      } else {
        return;
      }
      const pngPrefix = 'data:image/png;base64,';
      this.content = pngPrefix + base64;
      this.ensureHash();
    } catch (e) {
      // swallow errors
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImageTaskArtifact;
} else {
  this.ImageTaskArtifact = ImageTaskArtifact;
}
