import { GeometrySurface, type Selection } from '@/addon/annotation/adapter/geometry-surface';
import type { SavedGeometry, Shape, ShapeRequest } from '@/addon/annotation/domain/model/geometry-tool';
import { eventBus } from '@/ontobdc/shared/adapter/event-bus';
import type { SpacePoint, SpaceView } from '@/ontobdc/shared/domain/model/document-space';

const SOURCE = 'annotations_space_canvas';

/** How far, in the pixels of the screen, a pointer has to be dragged for it to be a drag and not a click. */
const DRAG_PIXELS = 4;
/** How many of these a model's diagonal is, for the size of a shape put down with a click. */
const CLICK_SIZE_DIVISOR = 40;

const text = (value: number): string => String(Number(value.toFixed(6)));

/**
 * The numbers of a solid shape, by the name the shape command knows them, for a shape of half-size `r` put on the point
 * of the model that was clicked: a box, a cylinder and a sphere sit on it, and the stick of a lollipop starts at it.
 */
function solidArguments(shape: Shape, at: SpacePoint, r: number): Record<string, string> {
  const [x, y, z] = at;
  if (shape === 'box') return { x: text(x), y: text(y), z: text(z + r), width: text(2 * r), depth: text(2 * r), height: text(2 * r) };
  if (shape === 'cylinder') return { x: text(x), y: text(y), z: text(z + r), radius: text(r), height: text(2 * r) };
  if (shape === 'sphere') return { x: text(x), y: text(y), z: text(z + r), radius: text(r) };
  if (shape === 'lollipop') return { x: text(x), y: text(y), z: text(z), height: text(5 * r), radius: text(r) };
  throw new Error(`The shape ${shape} is not put in space.`);
}

/**
 * The model in space the person puts the geometries in. With a shape armed, pressing on a point of the model and dragging
 * is a shape: the point is where it sits and how far the pointer is dragged is its size, shown as it is dragged; letting
 * go asks for it (`presentation.annotations.geometry.shape.requested`). With none armed, pressing on a shape chooses it and
 * dragging moves it, on the plane facing the screen; pressing on anything else turns the model, as it does anywhere else.
 * Delete, and Ctrl or Command with Z, are what they are on an image. The coordinates are those of the model.
 */
export class SpaceCanvas extends GeometrySurface {
  private placing: { shape: Shape; at: SpacePoint; from: { x: number; y: number } } | null = null;
  private moving: { id: string; at: SpacePoint; from: { x: number; y: number }; by: SpacePoint; moved: boolean } | null = null;

  constructor(id: string, private readonly view: SpaceView, selection: Selection, initial: SavedGeometry[]) {
    super(id, selection, initial);
    const canvas = view.canvas;
    // Before the controls that turn the model hear the pointer, so that they can be taken off when it is a shape that is dragged.
    canvas.addEventListener('pointerdown', (event) => this.down(event as PointerEvent), true);
    canvas.addEventListener('pointermove', (event) => this.move(event as PointerEvent));
    canvas.addEventListener('pointerup', (event) => this.up(event as PointerEvent));
    this.unsubscribe.push(() => view.setPreview(null));
    this.render();
  }

  override failed(): void {
    this.moving = null;
    this.view.setOrbit(true);
    super.failed();
  }

  protected render(): void {
    this.view.setGeometries(this.geometries, this.selected);
  }

  protected armed(): void {
    this.cancel();
  }

  protected cancel(): void {
    this.placing = null;
    this.view.setPreview(null);
    this.view.setOrbit(true);
  }

  private down(event: PointerEvent): void {
    if (event.button !== 0) return;
    const { tool } = this.selection();
    if (tool) {
      const at = this.view.pointAt(event.clientX, event.clientY);
      if (!at) return;
      this.view.setOrbit(false);
      this.view.canvas.setPointerCapture(event.pointerId);
      this.placing = { shape: tool, at, from: { x: event.clientX, y: event.clientY } };
      this.preview(event);
      return;
    }
    const id = this.view.geometryAt(event.clientX, event.clientY);
    this.select(id);
    if (id === null) return;
    const at = this.view.pointAt(event.clientX, event.clientY);
    if (!at) return;
    this.view.setOrbit(false);
    this.view.canvas.setPointerCapture(event.pointerId);
    this.moving = { id, at, from: { x: event.clientX, y: event.clientY }, by: [0, 0, 0], moved: false };
  }

  private move(event: PointerEvent): void {
    if (this.moving) {
      const dx = event.clientX - this.moving.from.x;
      const dy = event.clientY - this.moving.from.y;
      if (Math.hypot(dx, dy) >= DRAG_PIXELS) this.moving.moved = true;
      if (!this.moving.moved) return;
      this.moving.by = this.view.dragDelta(this.moving.at, dx, dy);
      this.view.nudge(this.moving.id, this.moving.by);
      return;
    }
    if (this.placing) this.preview(event);
  }

  private up(event: PointerEvent): void {
    if (this.moving) {
      const { id, by, moved } = this.moving;
      this.moving = null;
      this.view.canvas.releasePointerCapture(event.pointerId);
      this.view.setOrbit(true);
      // A shape that was only pressed is chosen; one that was dragged stays where it was dropped until the command answers.
      if (moved) eventBus.publish('presentation.annotations.geometry.move.requested', SOURCE, { id: this.id, geometry: id, by });
      return;
    }
    if (!this.placing) return;
    const { shape, at } = this.placing;
    const size = this.size(event);
    this.view.canvas.releasePointerCapture(event.pointerId);
    this.cancel();
    const request: ShapeRequest = { shape, arguments: solidArguments(shape, at, size), style: this.selection().style };
    eventBus.publish('presentation.annotations.geometry.shape.requested', SOURCE, { id: this.id, ...request });
  }

  /** The half-size of the shape being put down: how far the pointer was dragged from the point, or a share of the model when it was only clicked. */
  private size(event: PointerEvent): number {
    if (!this.placing) return 0;
    const pixels = Math.hypot(event.clientX - this.placing.from.x, event.clientY - this.placing.from.y);
    return pixels < DRAG_PIXELS ? this.view.extent() / CLICK_SIZE_DIVISOR : this.view.lengthAt(this.placing.at, pixels);
  }

  /** The shape as it would be made, in the colour the person chose, until it is asked for. */
  private preview(event: PointerEvent): void {
    if (!this.placing) return;
    const { shape, at } = this.placing;
    const r = this.size(event);
    const { style } = this.selection();
    const center: SpacePoint = shape === 'lollipop' ? at : [at[0], at[1], at[2] + r];
    this.view.setPreview({ shape: shape as 'box' | 'cylinder' | 'sphere' | 'lollipop', center, size: r, color: style.fill ?? style.stroke });
  }
}
