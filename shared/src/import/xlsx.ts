import { readZip } from "./zip.ts";

/** Decode the XML entities that appear in machine-generated XLSX text. */
function unescapeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Turn a cell reference like `B12` into a zero-based column index. */
function columnIndex(ref: string): number {
  const letters = /^([A-Za-z]+)/.exec(ref)?.[1] ?? "A";
  let index = 0;
  for (const ch of letters.toUpperCase()) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
}

function sharedStrings(xml: string): string[] {
  const out: string[] = [];
  const items = xml.matchAll(/<si>([\s\S]*?)<\/si>/g);
  for (const item of items) {
    let text = "";
    for (const part of item[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) text += part[1];
    out.push(unescapeXml(text));
  }
  return out;
}

function sheetGrid(xml: string, strings: string[]): string[][] {
  const grid: string[][] = [];
  const rows = xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g);
  let rowIndex = 0;
  for (const row of rows) {
    const cells: string[] = [];
    let cursor = 0;
    const matcher = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cell: RegExpExecArray | null;
    while ((cell = matcher.exec(row[1])) !== null) {
      const attrs = cell[1];
      const body = cell[2] ?? "";
      const ref = /\br="([A-Za-z]+\d+)"/.exec(attrs)?.[1] ?? "";
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1] ?? "n";
      const col = ref ? columnIndex(ref) : cursor;
      let value = "";
      if (type === "s") {
        const index = Number(/<v[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "-1");
        value = strings[index] ?? "";
      } else if (type === "inlineStr") {
        let text = "";
        for (const part of body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) text += part[1];
        value = unescapeXml(text);
      } else {
        value = unescapeXml(/<v[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "");
      }
      while (cells.length < col) cells.push("");
      cells[col] = value;
      cursor = col + 1;
    }
    grid[rowIndex] = cells;
    rowIndex++;
  }
  return grid;
}

/**
 * Read the first worksheet of an XLSX file into a grid. Macro-enabled
 * workbooks are refused, since a statement never needs a macro and reading one
 * would process untrusted executable content.
 */
export function readXlsx(bytes: Buffer): string[][] {
  const entries = readZip(bytes);
  if (entries.has("xl/vbaProject.bin")) throw new Error("macro-enabled workbooks are not supported");

  const sheetName =
    [...entries.keys()].find((name) => name === "xl/worksheets/sheet1.xml") ??
    [...entries.keys()].sort().find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  if (!sheetName) throw new Error("not an XLSX workbook: no worksheet found");

  const strings = entries.has("xl/sharedStrings.xml")
    ? sharedStrings(entries.get("xl/sharedStrings.xml")!.toString("utf8"))
    : [];
  return sheetGrid(entries.get(sheetName)!.toString("utf8"), strings);
}
