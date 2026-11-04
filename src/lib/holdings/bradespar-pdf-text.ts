// Embedded-text extraction for the one-page Bradespar bulletin PDF.
//
// Uses unpdf (a dependency-free serverless build of Mozilla pdf.js) — reads
// the PDF's text layer only: no OCR, no rendering, no browser, no system
// binaries. A devDependency: imported by the precompute script and tests only,
// never by application routes.
//
// No @/ imports — also used by tsx scripts.

import { extractText, getDocumentProxy } from "unpdf";

export async function extractBulletinText(pdf: Uint8Array): Promise<string> {
  if (pdf.length < 5 || new TextDecoder("latin1").decode(pdf.subarray(0, 5)) !== "%PDF-") {
    throw new Error("not a PDF document");
  }
  // pdf.js takes ownership of the buffer; pass a copy so callers keep theirs.
  const doc = await getDocumentProxy(new Uint8Array(pdf), { verbosity: 0 });
  try {
    if (doc.numPages !== 1) throw new Error(`expected a one-page bulletin, got ${doc.numPages} pages`);
    const { text } = await extractText(doc, { mergePages: true });
    if (!text.trim()) throw new Error("PDF has no embedded text layer");
    return text;
  } finally {
    await doc.destroy();
  }
}
