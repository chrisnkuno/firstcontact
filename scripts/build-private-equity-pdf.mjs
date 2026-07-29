import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const inputPath = join(root, "docs", "PRIVATE_EQUITY_RESEARCH.md");
const outputPath = join(root, "public", "firstcontact-private-equity-research.pdf");
const markdown = readFileSync(inputPath, "utf8");

function plainText(value) {
  return value
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\((https?:\/\/[^)]+)\)/g, "$1 ($2)")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/→/g, "->")
    .replace(/×/g, "x")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "");
}

function wrap(text, width) {
  const words = text.split(/\s+/).filter(Boolean);
  const rows = [];
  let row = "";
  for (const word of words) {
    if (!row) {
      row = word;
    } else if (`${row} ${word}`.length <= width) {
      row += ` ${word}`;
    } else {
      rows.push(row);
      row = word;
    }
  }
  if (row) rows.push(row);
  return rows.length ? rows : [""];
}

const blocks = [];
let tableRows = [];
function flushTable() {
  if (!tableRows.length) return;
  blocks.push({ text: tableRows.join("\n"), size: 8.5, bold: false, indent: 8, before: 8, after: 8, preserveLines: true });
  tableRows = [];
}

for (const rawLine of markdown.split("\n")) {
  const line = rawLine.trim();
  if (line.startsWith("|")) {
    if (!/^\|[-| ]+\|$/.test(line)) {
      tableRows.push(line.replace(/^\||\|$/g, "").split("|").map((cell) => plainText(cell.trim())).join("  |  "));
    }
    continue;
  }
  flushTable();
  if (!line) continue;
  if (line.startsWith("# ")) {
    blocks.push({ text: plainText(line.slice(2)), size: 22, bold: true, indent: 0, before: 0, after: 18 });
  } else if (line.startsWith("### ")) {
    blocks.push({ text: plainText(line.slice(4)), size: 12, bold: true, indent: 0, before: 14, after: 6 });
  } else if (line.startsWith("## ")) {
    blocks.push({ text: plainText(line.slice(3)), size: 15, bold: true, indent: 0, before: 18, after: 8 });
  } else if (line.startsWith("> ")) {
    blocks.push({ text: plainText(line.slice(2)), size: 11, bold: true, indent: 16, before: 10, after: 10 });
  } else if (/^\d+\.\s/.test(line)) {
    blocks.push({ text: plainText(line), size: 9.5, bold: false, indent: 12, before: 3, after: 3 });
  } else if (line.startsWith("- ")) {
    blocks.push({ text: `- ${plainText(line.slice(2))}`, size: 9.5, bold: false, indent: 12, before: 2, after: 2 });
  } else {
    blocks.push({ text: plainText(line), size: 9.5, bold: false, indent: 0, before: 4, after: 5 });
  }
}
flushTable();

const pageWidth = 612;
const pageHeight = 792;
const marginX = 54;
const top = 738;
const bottom = 52;
const contentWidth = pageWidth - marginX * 2;
const pages = [[]];
let y = top;

for (const block of blocks) {
  const width = Math.max(32, Math.floor((contentWidth - block.indent) / (block.size * 0.52)));
  const rows = block.preserveLines
    ? block.text.split("\n").flatMap((row) => wrap(row, width))
    : wrap(block.text, width);
  const leading = block.size * 1.35;
  const height = block.before + rows.length * leading + block.after;
  if (y - height < bottom) {
    pages.push([]);
    y = top;
  }
  y -= block.before;
  for (const row of rows) {
    pages.at(-1).push({ text: row, x: marginX + block.indent, y, size: block.size, bold: block.bold });
    y -= leading;
  }
  y -= block.after;
}

function pdfEscape(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

const objects = [];
const addObject = (body) => {
  objects.push(body);
  return objects.length;
};

addObject("<< /Type /Catalog /Pages 2 0 R >>");
addObject("");
const regularFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
const pageIds = [];

for (const [index, page] of pages.entries()) {
  const drawing = [
    "0.10 0.16 0.13 rg",
    ...page.map(({ text, x, y: rowY, size, bold }) =>
      `BT /${bold ? "F2" : "F1"} ${size.toFixed(1)} Tf 1 0 0 1 ${x.toFixed(1)} ${rowY.toFixed(1)} Tm (${pdfEscape(text)}) Tj ET`
    ),
    `BT /F1 8 Tf 0.35 0.40 0.37 rg 1 0 0 1 ${marginX} 28 Tm (FirstContact research - ${index + 1} / ${pages.length}) Tj ET`,
  ].join("\n");
  const contentId = addObject(`<< /Length ${Buffer.byteLength(drawing, "latin1")} >>\nstream\n${drawing}\nendstream`);
  const pageId = addObject(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`
  );
  pageIds.push(pageId);
}

objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
const offsets = [0];
for (const [index, object] of objects.entries()) {
  offsets.push(Buffer.byteLength(pdf, "latin1"));
  pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
}
const xrefOffset = Buffer.byteLength(pdf, "latin1");
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const offset of offsets.slice(1)) {
  pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

writeFileSync(outputPath, Buffer.from(pdf, "latin1"));
console.log(`Wrote ${outputPath} (${pages.length} pages)`);
