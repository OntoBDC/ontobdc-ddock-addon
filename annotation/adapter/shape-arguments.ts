import type { ImagePoint, Shape } from '@/addon/annotation/domain/model/geometry-tool';

/** Least size of a gesture, in the pixels of the image: a smaller one is a click, not a shape. */
const MIN_PIXELS = 2;

const text = (value: number): string => String(Number(value.toFixed(6)));

/**
 * The numbers of a shape, by the name the shape command knows them, from the points the person gave on an image of
 * `width` by `height` pixels, in the order they gave them: the corners of a rectangle, the centre and a point of the
 * edge of a circle, the centre and a corner of a cross, the points an amoeba goes through. None when what they gave
 * makes no shape. A circle and a cross are given in the share of the width, with the proportion of the image, so they are
 * round and square on it.
 */
export function shapeArguments(shape: Shape, points: ImagePoint[], width: number, height: number): Record<string, string> | null {
  const [first, second] = points;
  if (shape === 'amoeba') {
    return points.length >= 3 ? { points: points.map((point) => `${text(point.x)},${text(point.y)}`).join(';') } : null;
  }
  if (!first || !second) return null;

  const across = Math.abs(second.x - first.x) * width;
  const down = Math.abs(second.y - first.y) * height;
  if (shape === 'rectangle') {
    if (across < MIN_PIXELS || down < MIN_PIXELS) return null;
    return {
      x: text(Math.min(first.x, second.x)),
      y: text(Math.min(first.y, second.y)),
      width: text(across / width),
      height: text(down / height),
    };
  }
  if (shape === 'circle') {
    const radius = Math.hypot(across, down);
    return radius < MIN_PIXELS ? null : { x: text(first.x), y: text(first.y), radius: text(radius / width), aspect: text(width / height) };
  }
  if (shape === 'cross') {
    const half = Math.max(across, down);
    return half < MIN_PIXELS ? null : { x: text(first.x), y: text(first.y), size: text((2 * half) / width), aspect: text(width / height) };
  }
  throw new Error(`The shape ${shape} is not drawn on an image.`);
}
