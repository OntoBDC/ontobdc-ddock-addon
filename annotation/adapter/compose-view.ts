import { drawGeometries } from '@/addon/annotation/adapter/geometry-render';
import type { SavedGeometry } from '@/addon/annotation/domain/model/geometry-tool';

const SVG = 'http://www.w3.org/2000/svg';

/** The longest side, in pixels, of the picture of a document kept for an annotation: a page of a document is drawn larger than a sheet of a workbook shows. */
const LONG_SIDE = 2400;

/**
 * The picture of a document drawn as an image with the geometries of its annotation on it, as the address of a PNG: what the
 * tab shows, as a file. The image has to be loaded; it is read before this waits for anything.
 */
export async function composeView(image: HTMLImageElement, width: number, height: number, geometries: SavedGeometry[]): Promise<string> {
  const scale = Math.min(1, LONG_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The picture of the document could not be made.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const layer = document.createElementNS(SVG, 'svg');
  layer.setAttribute('xmlns', SVG);
  layer.setAttribute('viewBox', `0 0 ${width} ${height}`);
  layer.setAttribute('width', String(canvas.width));
  layer.setAttribute('height', String(canvas.height));
  drawGeometries(layer, null, geometries, width, height, false);
  const shapes = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    shapes.onload = () => resolve();
    shapes.onerror = () => reject(new Error('The geometries could not be drawn on the picture of the document.'));
  });
  shapes.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(layer))}`;
  await loaded;
  context.drawImage(shapes, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}
