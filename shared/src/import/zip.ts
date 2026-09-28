import { inflateRawSync } from "node:zlib";

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;

/** Guard against a zip bomb: refuse an archive whose parts inflate past this. */
export const MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;

/**
 * Read the entries of a ZIP archive using only node:zlib. XLSX is a ZIP of XML
 * parts, so this avoids a spreadsheet dependency. Only stored and deflated
 * entries are supported, which is all XLSX producers use.
 */
export function readZip(buffer: Buffer, maxBytes = MAX_UNCOMPRESSED_BYTES): Map<string, Buffer> {
  let eocd = -1;
  const lowest = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= lowest; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip archive");

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map<string, Buffer>();
  let total = 0;

  for (let n = 0; n < count; n++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL_SIG) {
      throw new Error("corrupt zip central directory");
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLen).toString("utf8");

    const localNameLen = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    // Reject from the header before inflating, and cap the inflate as well in
    // case the header understates the real size. This is the zip-bomb guard.
    if (total + uncompressedSize > maxBytes) throw new Error("zip archive expands past the allowed size");
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const data =
      method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: maxBytes - total });
    total += data.length;
    if (total > maxBytes) throw new Error("zip archive expands past the allowed size");
    entries.set(name, data);

    offset += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}
