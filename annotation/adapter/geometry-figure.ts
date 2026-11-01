import { drawGeometries } from '@/addon/annotation/adapter/geometry-render';
import type { SavedGeometry } from '@/addon/annotation/domain/model/geometry-tool';

const SVG = 'http://www.w3.org/2000/svg';

/** The image of a document with the geometries drawn on it, as the tab of an annotation shows them. */
export function createGeometryFigure(url: string, width: number, height: number, geometries: SavedGeometry[]): HTMLElement {
  const figure = document.createElement('div');
  figure.className = 'geometry-figure';
  const image = document.createElement('img');
  image.src = url;
  image.alt = '';
  image.width = width;
  image.height = height;
  const layer = document.createElementNS(SVG, 'svg');
  layer.setAttribute('class', 'geometry-figure-layer');
  layer.setAttribute('viewBox', `0 0 ${width} ${height}`);
  layer.setAttribute('preserveAspectRatio', 'none');
  drawGeometries(layer, null, geometries, width, height, false);
  figure.append(image, layer);
  return figure;
}
