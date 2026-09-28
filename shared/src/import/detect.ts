/** Kind of a statement file, decided from its content, not its name. */
export type FileKind = "csv" | "xlsx" | "pdf" | "image";

/**
 * Decide how to read a statement from its leading bytes. The extension is
 * deliberately ignored, so a mislabelled file is still read correctly.
 */
export function detectKind(bytes: Buffer): FileKind {
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return "xlsx";
  }
  if (bytes.length >= 4 && bytes.subarray(0, 4).toString("latin1") === "%PDF") return "pdf";
  if (isImage(bytes)) return "image";
  return "csv";
}

/** Detect a PNG or JPEG image from its magic bytes. */
export function isImage(bytes: Buffer): boolean {
  const png = bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return png || jpeg;
}
