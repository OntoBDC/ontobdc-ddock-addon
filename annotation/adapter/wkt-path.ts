/**
 * The path of a flat well-known text (a point is none; a line or several, a polygon with its holes), in the pixels of an image
 * of `width` by `height`, from coordinates that are the share of its width and height. The text is what the shape
 * command writes: `LINESTRING (x y, x y)`, `MULTILINESTRING ((x y, x y), (...))` and `POLYGON ((x y, ...), (...))`.
 */
export function wktPath(wkt: string, width: number, height: number): string {
  const match = /^\s*(MULTILINESTRING|LINESTRING|POLYGON)\s*(\(.*\))\s*$/is.exec(wkt);
  if (!match) throw new Error(`Only a line or a polygon of two dimensions is drawn: ${wkt}`);

  const kind = match[1].toUpperCase();
  const rings = kind === 'LINESTRING'
    ? [match[2].slice(1, -1)]
    : [...match[2].matchAll(/\(([^()]*)\)/g)].map((ring) => ring[1]);
  return rings.map((ring) => {
    const points = ring.split(',').map((pair) => {
      const [x, y, ...rest] = pair.trim().split(/\s+/).map(Number);
      if (rest.length > 0 || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Only a geometry of two dimensions is drawn: ${wkt}`);
      return `${Number((x * width).toFixed(2))} ${Number((y * height).toFixed(2))}`;
    });
    return `M${points.join(' L')}${kind === 'POLYGON' ? ' Z' : ''}`;
  }).join(' ');
}
