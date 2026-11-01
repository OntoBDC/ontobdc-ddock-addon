import type { DocumentImageRenderer } from '@/ontobdc/shared/domain/model/document-image';

const EXTENSION = /\.(png|jpe?g|webp|gif|bmp)$/i;

/** An image is its own image: only its size is read. */
export const renderer: DocumentImageRenderer = {
  accepts: (path) => EXTENSION.test(path),
  async render(file) {
    const bitmap = await createImageBitmap(file);
    const image = { blob: file, width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return image;
  },
};
