/** Decode statement bytes to text, honoring a BOM and falling back to cp1251. */
export function decodeText(bytes: Buffer, encoding?: string): string {
  if (encoding) {
    return new TextDecoder(normalizeEncoding(encoding)).decode(bytes);
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  // U+FFFD marks invalid UTF-8, which common bank exports use cp1251 instead.
  if (utf8.includes("\uFFFD")) return new TextDecoder("windows-1251").decode(bytes);
  return utf8;
}

function normalizeEncoding(encoding: string): string {
  const key = encoding.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (key === "cp1251" || key === "windows1251") return "windows-1251";
  if (key === "utf8") return "utf-8";
  return encoding;
}

/** Guess the delimiter from the first line that has more than one cell. */
export function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find((row) => row.trim() !== "") ?? "";
  const counts: Record<string, number> = {
    ",": (line.match(/,/g) ?? []).length,
    ";": (line.match(/;/g) ?? []).length,
    "\t": (line.match(/\t/g) ?? []).length,
    "|": (line.match(/\|/g) ?? []).length,
  };
  let best = ";";
  let bestCount = 0;
  for (const [delimiter, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Parse delimited text into a grid of cells. Handles quoted fields, escaped
 * quotes, embedded newlines and CRLF, per RFC 4180.
 */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch === "\r") {
      // swallow; the following \n ends the row
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Read a CSV statement into a grid, detecting encoding and delimiter. */
export function readCsv(bytes: Buffer, encoding?: string, delimiter?: string): string[][] {
  const text = decodeText(bytes, encoding);
  return parseDelimited(text, delimiter ?? detectDelimiter(text));
}
