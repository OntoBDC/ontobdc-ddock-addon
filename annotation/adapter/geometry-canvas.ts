import { drawGeometries, markSelected } from '@/addon/annotation/adapter/geometry-render';
import { GeometrySurface, type Selection } from '@/addon/annotation/adapter/geometry-surface';
import { shapeArguments } from '@/addon/annotation/adapter/shape-arguments';
import type { ImagePoint, SavedGeometry, Shape, ShapeRequest } from '@/addon/annotation/domain/model/geometry-tool';
import { eventBus } from '@/ontobdc/shared/adapter/event-bus';

const SOURCE = 'annotations_geometry_canvas';
const SVG = 'http://www.w3.org/2000/svg';

/** How near, in the pixels of the screen, a click has to be to the first point of an amoeba to close it. */
const CLOSE_PIXELS = 12;
/** How far, in the pixels of the screen, a shape has to be dragged for it to be moved and not only chosen. */
const MOVE_PIXELS = 4;

/**
 * The layer over the image the person draws on. With a shape armed, a drag (a rectangle, a circle, a cross) or a few
 * clicks (an amoeba) is a shape, which is asked for by `presentation.annotations.geometry.shape.requested`. With none
 * armed, a click chooses the shape under it and a drag moves it (`…geometry.move.requested`); Delete takes the chosen
 * one off (`…geometry.delete.requested`), and Ctrl or Command with Z undoes the last thing done here (a shape drawn, moved,
 * taken off or drawn in other colours), and before it the one before. What the annotation has is what the commands answer: every answer is the whole list, which is drawn again. The coordinates are
 * the share of the width and of the height of the image, from its top left corner.
 */
export class GeometryCanvas extends GeometrySurface {
  readonly element = document.createElement('div');
  private readonly layer = document.createElementNS(SVG, 'svg');
  private readonly preview = document.createElementNS(SVG, 'g');
  private points: ImagePoint[] = [];
  private dragging = false;
  private moving: { id: string; group: SVGElement; from: { x: number; y: number }; moved: boolean } | null = null;
  /** The shape under the pointer when a drag began with a shape armed: if it is not a drag, it is the shape that is chosen. */
  private under: { id: string; from: { x: number; y: number } } | null = null;

  constructor(
    id: string,
    readonly image: HTMLImageElement,
    readonly width: number,
    readonly height: number,
    selection: Selection,
    initial: SavedGeometry[],
  ) {
    super(id, selection, initial);
    this.element.className = 'geometry-overlay-surface';
    this.layer.setAttribute('class', 'geometry-overlay-layer');
    this.layer.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.layer.setAttribute('preserveAspectRatio', 'none');
    this.layer.append(this.preview);
    this.element.append(image, this.layer);
    this.render();

    this.layer.addEventListener('pointerdown', (event) => this.down(event));
    this.layer.addEventListener('pointermove', (event) => this.move(event));
    this.layer.addEventListener('pointerup', (event) => this.up(event));
    this.layer.addEventListener('dblclick', () => this.finishAmoeba());
  }

  /** The command could not do what was asked: what the annotation has is drawn again, and the shape that was being moved goes back. */
  override failed(): void {
    this.moving = null;
    super.failed();
  }

  protected render(): void {
    drawGeometries(this.layer, this.preview, this.geometries, this.width, this.height, true);
    markSelected(this.layer, this.selected);
  }

  private at(event: PointerEvent): ImagePoint {
    const box = this.image.getBoundingClientRect();
    const share = (value: number): number => Math.min(1, Math.max(0, value));
    return { x: share((event.clientX - box.left) / box.width), y: share((event.clientY - box.top) / box.height) };
  }

  private down(event: PointerEvent): void {
    if (event.button !== 0) return;
    const { tool } = this.selection();
    if (!tool) {
      this.choose(event);
      return;
    }
    const point = this.at(event);
    if (tool === 'amoeba') {
      const first = this.points[0];
      const box = this.image.getBoundingClientRect();
      if (this.points.length >= 3 && Math.hypot((point.x - first.x) * box.width, (point.y - first.y) * box.height) <= CLOSE_PIXELS) {
        this.finishAmoeba();
        return;
      }
      const last = this.points[this.points.length - 1];
      // The two clicks of a double click are one point.
      if (last && Math.hypot((point.x - last.x) * box.width, (point.y - last.y) * box.height) < 4) return;
      this.points.push(point);
      this.draw(tool, point);
      return;
    }
    this.layer.setPointerCapture(event.pointerId);
    this.points = [point];
    this.dragging = true;
    const id = (event.target as Element).closest<SVGElement>('[data-geometry]')?.dataset.geometry;
    this.under = id ? { id, from: { x: event.clientX, y: event.clientY } } : null;
  }

  /** With no shape armed: the shape under the pointer is chosen, and moves with it if it is dragged; nothing under it, nothing is chosen. */
  private choose(event: PointerEvent): void {
    const group = (event.target as Element).closest<SVGElement>('[data-geometry]');
    const id = group?.dataset.geometry ?? null;
    this.select(id);
    if (!group || id === null) return;
    // Choosing draws the shapes again: the one that moves is the one that is there now.
    const live = [...this.layer.querySelectorAll<SVGElement>('[data-geometry]')].find((candidate) => candidate.dataset.geometry === id);
    if (!live) return;
    this.layer.setPointerCapture(event.pointerId);
    this.moving = { id, group: live, from: { x: event.clientX, y: event.clientY }, moved: false };
  }

  private move(event: PointerEvent): void {
    if (this.moving) {
      const box = this.image.getBoundingClientRect();
      const dx = event.clientX - this.moving.from.x;
      const dy = event.clientY - this.moving.from.y;
      if (Math.hypot(dx, dy) >= MOVE_PIXELS) this.moving.moved = true;
      if (this.moving.moved) this.moving.group.setAttribute('transform', `translate(${(dx / box.width) * this.width} ${(dy / box.height) * this.height})`);
      return;
    }
    const { tool } = this.selection();
    if (!tool) return;
    if (tool === 'amoeba' ? this.points.length > 0 : this.dragging) this.draw(tool, this.at(event));
  }

  private up(event: PointerEvent): void {
    if (this.moving) {
      const { id, from, moved } = this.moving;
      this.layer.releasePointerCapture(event.pointerId);
      if (!moved) {
        this.moving = null;
        return;
      }
      const box = this.image.getBoundingClientRect();
      // The shape stays where it was dropped until the command answers; the answer draws it there, for good.
      this.moving = null;
      eventBus.publish('presentation.annotations.geometry.move.requested', SOURCE, {
        id: this.id,
        geometry: id,
        by: [(event.clientX - from.x) / box.width, (event.clientY - from.y) / box.height],
      });
      return;
    }
    const { tool } = this.selection();
    if (!tool || tool === 'amoeba' || !this.dragging) return;
    this.dragging = false;
    this.layer.releasePointerCapture(event.pointerId);
    const under = this.under;
    this.under = null;
    if (under && Math.hypot(event.clientX - under.from.x, event.clientY - under.from.y) < MOVE_PIXELS) {
      // Not a drag: the shape that was clicked is chosen, and nothing is drawn.
      this.cancel();
      this.select(under.id);
      return;
    }
    this.request(tool, [this.points[0], this.at(event)]);
  }

  private finishAmoeba(): void {
    if (this.selection().tool === 'amoeba') this.request('amoeba', this.points);
  }

  private request(shape: Shape, points: ImagePoint[]): void {
    const given = shapeArguments(shape, points, this.width, this.height);
    this.cancel();
    if (!given) return;
    const request: ShapeRequest = { shape, arguments: given, style: this.selection().style };
    eventBus.publish('presentation.annotations.geometry.shape.requested', SOURCE, { id: this.id, ...request });
  }

  protected armed(armed: boolean): void {
    this.cancel();
    this.layer.dataset.armed = String(armed);
  }

  protected cancel(): void {
    this.points = [];
    this.dragging = false;
    this.preview.replaceChildren();
  }

  /** What the shape being drawn looks like until it is asked for, in the style the person chose. */
  private draw(shape: Shape, to: ImagePoint): void {
    const { style } = this.selection();
    const px = (point: ImagePoint): [number, number] => [point.x * this.width, point.y * this.height];
    const [x0, y0] = px(this.points[0]);
    const [x1, y1] = px(to);
    let element: SVGElement;
    if (shape === 'rectangle') {
      element = document.createElementNS(SVG, 'rect');
      element.setAttribute('x', String(Math.min(x0, x1)));
      element.setAttribute('y', String(Math.min(y0, y1)));
      element.setAttribute('width', String(Math.abs(x1 - x0)));
      element.setAttribute('height', String(Math.abs(y1 - y0)));
    } else if (shape === 'circle') {
      element = document.createElementNS(SVG, 'circle');
      element.setAttribute('cx', String(x0));
      element.setAttribute('cy', String(y0));
      element.setAttribute('r', String(Math.hypot(x1 - x0, y1 - y0)));
    } else if (shape === 'cross') {
      const half = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      element = document.createElementNS(SVG, 'path');
      element.setAttribute('d', `M${x0 - half} ${y0 - half} L${x0 + half} ${y0 + half} M${x0 - half} ${y0 + half} L${x0 + half} ${y0 - half}`);
    } else {
      element = document.createElementNS(SVG, 'polyline');
      element.setAttribute('points', [...this.points, to].map((point) => px(point).join(',')).join(' '));
    }
    element.setAttribute('stroke', style.stroke);
    element.setAttribute('stroke-width', String(style.strokeWidth));
    element.setAttribute('stroke-dasharray', '6 4');
    element.setAttribute('fill', shape === 'amoeba' || shape === 'cross' ? 'none' : (style.fill ?? 'none'));
    this.preview.replaceChildren(element);
  }
}
