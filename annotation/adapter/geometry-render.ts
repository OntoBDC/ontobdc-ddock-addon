import { wktPath } from '@/addon/annotation/adapter/wkt-path';
import type { SavedGeometry } from '@/addon/annotation/domain/model/geometry-tool';

const SVG = 'http://www.w3.org/2000/svg';

/** Whether the geometry can be drawn on an image: a line, several, or a polygon, in two dimensions. A mesh or a point of space is not. */
export const isFlat = (wkt: string): boolean => /^\s*(MULTILINESTRING|LINESTRING|POLYGON)\s*\(/i.test(wkt);

/** How wide, in the pixels of the screen, the part of a shape that takes a click is. */
const HIT_PIXELS = 14;

/**
 * Draws the geometries in a layer of an image of `width` by `height` pixels, each one a group with the identifier of the
 * geometry (`data-geometry`) in place of the ones the layer had, before `before`. The geometries that cannot be
 * drawn on an image are left out. With `hits`, each group also has a part that takes the click: the shape, and a stroke
 * that is easy to hit, wide on the screen whatever the size of the image.
 */
export function drawGeometries(
  layer: SVGElement,
  before: Element | null,
  geometries: SavedGeometry[],
  width: number,
  height: number,
  hits: boolean,
): void {
  layer.querySelectorAll('[data-geometry]').forEach((group) => group.remove());
  for (const geometry of geometries) {
    if (!isFlat(geometry.wkt)) continue;
    const d = wktPath(geometry.wkt, width, height);
    const group = document.createElementNS(SVG, 'g');
    group.dataset.geometry = geometry.id;

    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', geometry.stroke ?? '#000000');
    path.setAttribute('stroke-width', String(geometry.stroke_width ?? 1));
    path.setAttribute('fill', geometry.fill ?? 'none');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('class', 'geometry-shape');
    group.append(path);

    if (hits) {
      const hit = document.createElementNS(SVG, 'path');
      hit.setAttribute('d', d);
      // A closed shape is hit anywhere in it, and a line where it is.
      hit.setAttribute('fill', /^\s*POLYGON/i.test(geometry.wkt) ? 'transparent' : 'none');
      hit.setAttribute('stroke', 'transparent');
      hit.setAttribute('stroke-width', String(HIT_PIXELS));
      hit.setAttribute('vector-effect', 'non-scaling-stroke');
      hit.setAttribute('class', 'geometry-hit');
      group.append(hit);
    }
    layer.insertBefore(group, before);
  }
}

/** Draws a line round a shape that is chosen, wide on the screen. */
export function markSelected(layer: SVGElement, id: string | null): void {
  layer.querySelectorAll('.geometry-selected').forEach((mark) => mark.remove());
  if (id === null) return;
  const group = [...layer.querySelectorAll<SVGElement>('[data-geometry]')].find((candidate) => candidate.dataset.geometry === id);
  const path = group?.querySelector('.geometry-shape');
  if (!group || !path) return;
  const mark = path.cloneNode() as SVGElement;
  mark.setAttribute('class', 'geometry-selected');
  mark.setAttribute('fill', 'none');
  mark.setAttribute('stroke', '#1e88e5');
  mark.setAttribute('stroke-opacity', '0.55');
  mark.setAttribute('stroke-width', '8');
  mark.setAttribute('stroke-dasharray', '10 6');
  mark.setAttribute('vector-effect', 'non-scaling-stroke');
  group.insertBefore(mark, path);
}
