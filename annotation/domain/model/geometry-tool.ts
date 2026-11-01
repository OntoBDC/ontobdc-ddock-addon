/** The flat shapes a person can put on an image, and the solid ones they can put in space: the names the shape command knows. */
export const SHAPES_2D = ['rectangle', 'circle', 'amoeba', 'cross'] as const;
export const SHAPES_3D = ['box', 'cylinder', 'sphere', 'lollipop'] as const;

export type Shape = (typeof SHAPES_2D)[number] | (typeof SHAPES_3D)[number];

/** How the next shape is drawn: the colour and width of its border, and the colour of its fill, none when it has none. */
export type GeometryStyle = {
  stroke: string;
  strokeWidth: number;
  fill: string | null;
};

export const DEFAULT_STYLE: GeometryStyle = { stroke: '#e53935', strokeWidth: 2, fill: null };

/** How a shape in space is drawn when the person has not chosen: a solid, as a solid with no fill would be only its edges. */
export const DEFAULT_SOLID_STYLE: GeometryStyle = { stroke: '#e53935', strokeWidth: 1, fill: '#e53935' };

/** What a gesture of the person asks for: a shape, its numbers by name, and how it is drawn. */
export type ShapeRequest = { shape: Shape; arguments: Record<string, string>; style: GeometryStyle };

/** A geometry of an annotation, as the entity and the commands tell it. */
export type { EntityGeometry as SavedGeometry } from '@/ontobdc/shared/domain/model/entity';

/** A point of the image, as the share of its width (x) and of its height (y), from its top left corner. */
export type ImagePoint = { x: number; y: number };

/** The widths the border can have, in the pixels of the image. */
export const STROKE_WIDTHS = { min: 1, max: 12 } as const;
