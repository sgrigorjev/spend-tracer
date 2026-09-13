import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const outDir = fileURLToPath(new URL("../fixtures/receipts", import.meta.url));
await mkdir(outDir, { recursive: true });

// Fictional pharmacy receipts in Spanish, styled after real ones. All data is
// invented; safe to commit as test fixtures.
interface Receipt {
  file: string;
  store: string;
  address: string;
  cif: string;
  date: string; // dd/mm/yyyy
  time: string;
  items: Array<[string, string]>; // [name, price with comma decimals]
  total: string; // e.g. "7,15 EUR"
}

const receipts: Receipt[] = [
  {
    file: "receipt-farmacia-sol.png",
    store: "FARMACIA SOL DE OTOÑO",
    address: "Calle de la Rosa 12, 28004 Madrid",
    cif: "CIF B-00123456",
    date: "12/08/2026",
    time: "10:24",
    items: [
      ["1  IBUPROFENO 600 MG", "4,85"],
      ["1  PARACETAMOL 1 G", "2,30"],
    ],
    total: "7,15 EUR",
  },
  {
    file: "receipt-farmacia-vega.png",
    store: "FARMACIA VEGA ALTA",
    address: "Avenida del Puerto 7, 46002 Valencia",
    cif: "CIF B-00234567",
    date: "20/08/2026",
    time: "18:05",
    items: [
      ["1  AMOXICILINA 500 MG", "9,60"],
      ["1  OMEPRAZOL 20 MG", "6,40"],
    ],
    total: "16,00 EUR",
  },
  {
    file: "receipt-farmacia-farola.png",
    store: "FARMACIA LA FAROLA",
    address: "Plaza del Mar 3, 41001 Sevilla",
    cif: "CIF B-00345678",
    date: "05/08/2026",
    time: "13:40",
    items: [
      ["1  LORATADINA 10 MG", "8,75"],
      ["1  SUERO FISIOLOGICO 500 ML", "3,20"],
      ["1  VITAMINA C 1 G", "5,50"],
    ],
    total: "17,45 EUR",
  },
  {
    file: "receipt-farmacia-norte.png",
    store: "FARMACIA DEL NORTE",
    address: "Gran Via 58, 48001 Bilbao",
    cif: "CIF B-00456789",
    date: "29/08/2026",
    time: "09:15",
    items: [
      ["1  JERINGAS 5 ML X10", "4,20"],
      ["1  GASA ESTERIL 10X10", "2,60"],
    ],
    total: "6,80 EUR",
  },
];

const MONO = "monospace, DejaVu Sans Mono, monospace";

function svg(r: Receipt): string {
  let y = 172;
  let rows = "";
  for (const [name, price] of r.items) {
    rows += `
      <text x="24" y="${y}" font-family="${MONO}" font-size="13">${name}</text>
      <text x="396" y="${y}" text-anchor="end" font-family="${MONO}" font-size="13">${price}</text>`;
    y += 24;
  }
  return `<svg width="420" height="560" xmlns="http://www.w3.org/2000/svg">
  <rect width="420" height="560" fill="#ffffff"/>
  <text x="210" y="48" text-anchor="middle" font-family="${MONO}" font-size="18" font-weight="bold">${r.store}</text>
  <text x="210" y="70" text-anchor="middle" font-family="${MONO}" font-size="12">${r.address}</text>
  <text x="210" y="88" text-anchor="middle" font-family="${MONO}" font-size="12">${r.cif}</text>
  <line x1="20" y1="104" x2="400" y2="104" stroke="#000000" stroke-width="1" stroke-dasharray="3,3"/>
  <text x="24" y="128" font-family="${MONO}" font-size="13">${r.date}   ${r.time}</text>
  <line x1="20" y1="144" x2="400" y2="144" stroke="#000000" stroke-width="1" stroke-dasharray="3,3"/>${rows}
  <line x1="20" y1="${y}" x2="400" y2="${y}" stroke="#000000" stroke-width="1"/>
  <text x="24" y="${y + 26}" font-family="${MONO}" font-size="14" font-weight="bold">TOTAL</text>
  <text x="396" y="${y + 26}" text-anchor="end" font-family="${MONO}" font-size="14" font-weight="bold">${r.total}</text>
  <text x="24" y="${y + 50}" font-family="${MONO}" font-size="12">Efectivo</text>
  <text x="210" y="524" text-anchor="middle" font-family="${MONO}" font-size="11">Gracias por su visita</text>
</svg>`;
}

for (const r of receipts) {
  const png = await sharp(Buffer.from(svg(r))).png().toBuffer();
  await writeFile(path.join(outDir, r.file), png);
  console.log(`wrote ${r.file} (${png.length} bytes)`);
}
