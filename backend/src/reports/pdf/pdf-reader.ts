import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getDocument,
  type PDFPageProxy,
} from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
}

// pdf.js loads the standard PDF fonts from this folder
const standardFontDataUrl = `${dirname(fileURLToPath(import.meta.resolve('pdfjs-dist/package.json')))}/standard_fonts/`;

// Returns the text of every page. Positions are fractions of the page size
// (0 to 1) so the parser doesn't care how big the page is.
export async function readPdfPages(file: Buffer): Promise<TextItem[][]> {
  const task = getDocument({ data: new Uint8Array(file), standardFontDataUrl });
  try {
    const pdf = await task.promise;
    const pages: TextItem[][] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      pages.push(await readTextLayer(await pdf.getPage(pageNumber)));
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

async function readTextLayer(page: PDFPageProxy): Promise<TextItem[]> {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items: TextItem[] = [];

  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue;
    const [x, y] = viewport.convertToViewportPoint(
      item.transform[4],
      item.transform[5],
    );
    items.push({
      text: item.str.trim(),
      x: x / viewport.width,
      y: y / viewport.height,
      width: item.width / viewport.width,
    });
  }
  return items;
}
