import type { AnnotationGroup } from '@/addon/annotation/domain/model/annotation';
import type { GeometryStyle, SavedGeometry, Shape, ShapeRequest } from '@/addon/annotation/domain/model/geometry-tool';

/**
 * The events of the Annotations addon and the data each one carries. The addon
 * adds them to the event map of the application (`AppEventMap`) from here, so the
 * core does not know the addon: it only needs this file to be part of the build.
 */
export type AnnotationsEvents = {
  /** `ontobdc annotate --list` answered: the annotation types of the ontology, each with its annotations; replaces every group. */
  'presentation.container.annotations.found': { groups: AnnotationGroup[] };
  /** `ontobdc annotate --list` could not be read; the Annotations panel keeps what it showed. */
  'presentation.container.annotations.failed': { message: string };
  /** The person opened an annotation of the Annotations panel; id is its global id, group its annotation type. */
  'presentation.annotations.item.opened': { group: string; id: string; title: string };
  /** The person asked to delete an annotation; nothing is deleted before they confirm. */
  'presentation.annotations.item.delete.requested': { id: string; title: string };
  'presentation.annotations.item.delete.confirmed': { id: string; title: string };
  'presentation.annotations.item.delete.cancelled': { id: string; title: string };
  /** The annotation was removed from the container. */
  'presentation.annotations.item.deleted': { id: string };
  'presentation.annotations.item.delete.failed': { id: string; message: string };
  /** The geometry of an annotation was emptied, because the document it was made on was changed: the points belonged to the old one. */
  'presentation.annotations.geometry.cleared': { id: string };
  'presentation.annotations.geometry.clear.failed': { id: string; message: string };
  /** The person asked to draw the geometry of an annotation on the document it was made on; `document` is its path in the container. */
  'presentation.annotations.geometry.draw.requested': { id: string; title: string; document: string };
  /** The person armed a shape in the window of the geometry, or put it down (`tool` is null). */
  'presentation.annotations.geometry.tool.changed': { id: string; tool: Shape | null };
  /** The person changed how the next shape is drawn; `fill` is null when it has none. */
  'presentation.annotations.geometry.style.changed': { id: string; stroke: string; strokeWidth: number; fill: string | null };
  /** The person drew a shape on the image: its name, its numbers and how it is drawn. Nothing is kept before the command answers. */
  'presentation.annotations.geometry.shape.requested': { id: string } & ShapeRequest;
  /** The person asked to move a geometry of the annotation, by this much of the width and of the height of the image. */
  'presentation.annotations.geometry.move.requested': { id: string; geometry: string; by: number[] };
  /** The person asked to change how a geometry of the annotation is drawn. */
  'presentation.annotations.geometry.style.requested': { id: string; geometry: string; style: GeometryStyle };
  /** A geometry that was taken off is asked to be put back, with what it had and where it was among the others. */
  'presentation.annotations.geometry.restore.requested': { id: string; geometry: SavedGeometry; position: number };
  /** The person asked to take a geometry off the annotation. */
  'presentation.annotations.geometry.delete.requested': { id: string; geometry: string };
  /** The person chose a shape of the window, or none (`geometry` and `style` are null); `style` is how it is drawn. */
  'presentation.annotations.geometry.selected': { id: string; geometry: string | null; style: GeometryStyle | null };
  /** What was asked of the geometries (a shape put, one moved, one taken off) was done and kept; `geometries` are all the annotation has now, as the command tells them. */
  'presentation.annotations.geometry.saved': { id: string; operation: 'shape' | 'move' | 'delete' | 'style' | 'restore'; geometries: SavedGeometry[] };
  'presentation.annotations.geometry.save.failed': { id: string; message: string };
  /** The person closed the window the geometry is drawn in. */
  'presentation.annotations.geometry.draw.closed': { id: string };
  'presentation.annotations.geometry.shot.taken': { id: string };
  'presentation.annotations.view.save.requested': { id: string; image: string };
  'presentation.annotations.view.saved': { id: string };
  'presentation.annotations.view.save.failed': { id: string; message: string };
  /** The document the annotation is made on has to be drawn as the image the geometry is marked on. */
  'presentation.annotations.surface.requested': { id: string; document: string };
  'presentation.annotations.surface.generation.started': { id: string };
  /** The document was drawn as an image; `image` is the address of the image in the browser, which lasts until the window is closed. */
  'presentation.annotations.surface.generation.succeeded': { id: string; image: string; width: number; height: number };
  'presentation.annotations.surface.generation.failed': { id: string; message: string };
  /** The person asked to export the annotations of a group (an annotation type) in a format. */
  'presentation.annotations.group.export.requested': { group: string; format: 'excel'; ids?: string[] };
  'presentation.annotations.group.export.started': { group: string };
  /** The export was handed to the browser as a download. */
  'presentation.annotations.group.export.finished': { group: string; filename: string; bytes: number };
  'presentation.annotations.group.export.failed': { group: string; message: string };
};

declare module '@/ontobdc/shared/domain/model/event' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AppEventMap extends AnnotationsEvents {}
}
