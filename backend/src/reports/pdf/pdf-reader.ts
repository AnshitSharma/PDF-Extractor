import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Canvas, createCanvas } from '@napi-rs/canvas';
import {
  getDocument,
  type PDFPageProxy,
} from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';

export interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
}

export const MAX_PAGES = 20;

export class TooManyPagesError extends Error {}
export class OcrError extends Error {}

// pdf.js loads the standard PDF fonts from this folder
const standardFontDataUrl = `${dirname(fileURLToPath(import.meta.resolve('pdfjs-dist/package.json')))}/standard_fonts/`;

// English OCR data comes from an npm package, so nothing is downloaded at runtime
const ocrLanguageData = `${dirname(fileURLToPath(import.meta.resolve('@tesseract.js-data/eng/package.json')))}/4.0.0_best_int`;

// scanned pages are rendered at about 300 DPI before OCR
const OCR_SCALE = 4;

// Returns the text of every page. Positions are fractions of the page size
// (0 to 1) so the parser doesn't care how big the page is.
export async function readPdfPages(file: Buffer): Promise<TextItem[][]> {
  const task = getDocument({ data: new Uint8Array(file), standardFontDataUrl });
  let worker: Worker | undefined;
  try {
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PAGES) throw new TooManyPagesError();

    const pages: TextItem[][] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      let items = await readTextLayer(page);

      // a page without any text is a scan, so read it with OCR instead
      if (items.length === 0) {
        const image = await renderPage(page);
        try {
          worker ??= await createOcrWorker();
          items = await readWords(worker, image);
        } catch (error) {
          throw new OcrError('OCR failed', { cause: error });
        }
      }
      pages.push(items);
    }
    return pages;
  } finally {
    await worker?.terminate();
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

async function renderPage(page: PDFPageProxy) {
  const viewport = page.getViewport({ scale: OCR_SCALE });
  const canvas = createCanvas(viewport.width, viewport.height);
  // pdf.js is typed for the browser canvas, the Node one works the same way
  await page.render({
    canvas: canvas as unknown as HTMLCanvasElement,
    viewport,
  }).promise;
  return canvas;
}

async function createOcrWorker() {
  // Without an errorHandler tesseract.js throws job errors from its worker
  // thread, which crashes the server. A failed language load is also only
  // reported there, so it's used to reject the call.
  const worker = await new Promise<Worker>((resolve, reject) => {
    createWorker('eng', OEM.LSTM_ONLY, {
      langPath: ocrLanguageData,
      cacheMethod: 'none',
      errorHandler: reject,
    }).then(resolve, reject);
  });
  // the default mode treats the page as one block of text and misreads
  // numbers in tables, automatic layout does much better
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
  return worker;
}

async function readWords(worker: Worker, image: Canvas): Promise<TextItem[]> {
  const { data } = await worker.recognize(
    await image.encode('png'),
    {},
    { blocks: true },
  );
  const words = (data.blocks ?? []).flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines.flatMap((line) => line.words),
    ),
  );

  return words
    .filter((word) => word.text.trim())
    .map(({ text, bbox }) => ({
      text: text.trim(),
      x: bbox.x0 / image.width,
      y: (bbox.y0 + bbox.y1) / 2 / image.height,
      width: (bbox.x1 - bbox.x0) / image.width,
    }));
}
