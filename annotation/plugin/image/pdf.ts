import type { DocumentImageRenderer } from '@/ontobdc/shared/domain/model/document-image';

/** Browsers cannot draw a canvas much taller than this. */
const MAX_HEIGHT = 16000;
const SCALE = 2;

/**
 * A PDF is every page, one under the other, in one image: what is marked on it is told in the whole image, so the page
 * is the part of the height it falls in. The pages are drawn at the largest scale the whole fits at.
 */
export const renderer: DocumentImageRenderer = {
  accepts: (path) => /\.pdf$/i.test(path),
  async render(file) {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    try {
      const pages = [];
      for (let number = 1; number <= pdf.numPages; number += 1) pages.push(await pdf.getPage(number));
      const sizes = pages.map((page) => page.getViewport({ scale: 1 }));
      const scale = Math.min(SCALE, MAX_HEIGHT / sizes.reduce((sum, size) => sum + size.height, 0));
      const width = Math.ceil(Math.max(...sizes.map((size) => size.width)) * scale);
      const height = Math.ceil(sizes.reduce((sum, size) => sum + size.height * scale, 0));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('The browser gave no canvas to draw the PDF on.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);

      let top = 0;
      for (const page of pages) {
        const viewport = page.getViewport({ scale });
        const sheet = document.createElement('canvas');
        sheet.width = Math.ceil(viewport.width);
        sheet.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: sheet.getContext('2d') as CanvasRenderingContext2D, viewport }).promise;
        context.drawImage(sheet, 0, top);
        top += sheet.height;
      }
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('The PDF could not be made into an image.');
      return { blob, width, height };
    } finally {
      await pdf.destroy();
    }
  },
};
