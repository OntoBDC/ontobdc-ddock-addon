import type { GeometryStyle, SavedGeometry, Shape } from '@/addon/annotation/domain/model/geometry-tool';
import { eventBus } from '@/ontobdc/shared/adapter/event-bus';

const SOURCE = 'annotations_geometry_surface';

/** How long a colour or a width has to stay as it is for the chosen shape to be drawn so. */
const STYLE_DELAY_MS = 300;

/** What undoes a thing that was done to the geometries of the annotation. */
type Undo =
  | { kind: 'remove'; id: string }
  | { kind: 'move'; id: string; by: number[] }
  | { kind: 'style'; id: string; style: GeometryStyle }
  | { kind: 'restore'; geometry: SavedGeometry; position: number };

export type Selection = () => { tool: Shape | null; style: GeometryStyle };

/**
 * What the surfaces the geometries of an annotation are drawn on have in common, whatever they are drawn on (an image, a
 * model in space): the geometries the annotation has, the one that is chosen, what undoes what was done, and what is asked
 * when a key is pressed or a colour is changed. Each surface knows how to draw the geometries, and how a pointer chooses
 * one, moves one and makes one. What the annotation has is what the commands answer: every answer is the whole list.
 */
export abstract class GeometrySurface {
  protected geometries: SavedGeometry[];
  protected selected: string | null = null;
  protected readonly unsubscribe: Array<() => void> = [];
  /** What undoes each thing done here that worked, the last at the end: what Ctrl or Command with Z does, from the last. */
  private readonly history: Undo[] = [];
  /** What undoes each thing asked and not answered yet, in the order they were asked, which is the order they are answered in. None for what undoes something. */
  private readonly asked: Array<Undo | 'added' | null> = [];
  /** Set while the surface asks for something that undoes what was done: it is not something to undo in its turn. */
  private undoing = false;
  private restyling = 0;

  protected constructor(
    protected readonly id: string,
    protected readonly selection: Selection,
    initial: SavedGeometry[],
  ) {
    this.geometries = initial;
    const keys = (event: KeyboardEvent): void => this.key(event);
    document.addEventListener('keydown', keys);
    // Everything asked of the geometries of this annotation, wherever it is asked from (a drag, Delete, the button, the controls), is told what undoes it, once it works.
    const asked = (record: (payload: never) => Undo | 'added' | null) => (event: { payload?: { id: string } }): void => {
      if (event.payload?.id !== this.id) return;
      this.asked.push(this.undoing ? null : record(event.payload as never));
    };
    this.unsubscribe.push(
      () => document.removeEventListener('keydown', keys),
      eventBus.subscribe('presentation.annotations.geometry.shape.requested', asked(() => 'added')),
      eventBus.subscribe('presentation.annotations.geometry.move.requested', asked((payload: { geometry: string; by: number[] }) => ({ kind: 'move', id: payload.geometry, by: payload.by.map((value) => -value) }))),
      eventBus.subscribe('presentation.annotations.geometry.delete.requested', asked((payload: { geometry: string }) => {
        const position = this.geometries.findIndex((geometry) => geometry.id === payload.geometry);
        return position < 0 ? null : { kind: 'restore', geometry: this.geometries[position], position };
      })),
      eventBus.subscribe('presentation.annotations.geometry.style.requested', asked((payload: { geometry: string }) => {
        const before = this.geometries.find((geometry) => geometry.id === payload.geometry);
        return before ? { kind: 'style', id: before.id, style: { stroke: before.stroke ?? '#000000', strokeWidth: before.stroke_width ?? 1, fill: before.fill } } : null;
      })),
      eventBus.subscribe('presentation.annotations.geometry.restore.requested', asked(() => null)),
      // How the next shape is drawn is how the chosen one is too: changing it changes the shape that is chosen.
      eventBus.subscribe('presentation.annotations.geometry.style.changed', ({ payload }) => {
        if (payload?.id !== this.id || this.selected === null) return;
        // A colour or a width is changed over many steps as it is dragged: only where it stops is asked for.
        const geometry = this.selected;
        const style = { stroke: payload.stroke, strokeWidth: payload.strokeWidth, fill: payload.fill };
        window.clearTimeout(this.restyling);
        this.restyling = window.setTimeout(() => {
          eventBus.publish('presentation.annotations.geometry.style.requested', SOURCE, { id: this.id, geometry, style });
        }, STYLE_DELAY_MS);
      }),
      eventBus.subscribe('presentation.annotations.geometry.tool.changed', ({ payload }) => {
        if (payload?.id === this.id) this.armed(payload.tool !== null);
      }),
    );
  }

  /** The geometries the annotation has, as the last answer told them. */
  current(): SavedGeometry[] {
    return this.geometries;
  }

  /** The annotation has these geometries now, as the command answered: they are drawn in place of what was. */
  saved(geometries: SavedGeometry[]): void {
    const before = new Set(this.geometries.map((geometry) => geometry.id));
    const now = new Set(geometries.map((geometry) => geometry.id));
    const undo = this.asked.shift();
    if (undo === 'added') {
      const added = geometries.find((geometry) => !before.has(geometry.id));
      if (added) this.history.push({ kind: 'remove', id: added.id });
    } else if (undo) {
      this.history.push(undo);
    }
    this.geometries = geometries;
    if (this.selected !== null && !now.has(this.selected)) this.select(null);
    this.render();
  }

  /** The command could not do what was asked: what the annotation has is drawn again, and the shape that was being moved goes back. */
  failed(): void {
    this.asked.shift();
    this.cancel();
    this.render();
  }

  dispose(): void {
    window.clearTimeout(this.restyling);
    this.unsubscribe.forEach((dispose) => dispose());
  }

  /** Draws the geometries the annotation has, and the one that is chosen. */
  protected abstract render(): void;
  /** Drops what is being drawn or moved, whatever it is. */
  protected abstract cancel(): void;
  /** A tool was armed or put down. */
  protected abstract armed(armed: boolean): void;

  protected select(id: string | null): void {
    if (this.selected === id) return;
    this.selected = id;
    this.render();
    const chosen = this.geometries.find((geometry) => geometry.id === id);
    eventBus.publish('presentation.annotations.geometry.selected', SOURCE, {
      id: this.id,
      geometry: id,
      style: chosen ? { stroke: chosen.stroke ?? '#000000', strokeWidth: chosen.stroke_width ?? 1, fill: chosen.fill } : null,
    });
  }

  private key(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.cancel();
      return;
    }
    // What is typed in a field of the window is not for the shapes; a colour, a width or a box to tick is not typed in.
    if ((event.target as Element | null)?.closest('textarea, select, input:not([type="range"]):not([type="color"]):not([type="checkbox"])')) return;
    if ((event.key === 'Delete' || event.key === 'Backspace') && this.selected !== null) {
      event.preventDefault();
      eventBus.publish('presentation.annotations.geometry.delete.requested', SOURCE, { id: this.id, geometry: this.selected });
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      this.undo();
    }
  }

  /** Undoes the last thing done here that worked, as far back as there is something to undo. What it undoes may be gone (a shape that was taken off since): that is skipped. */
  private undo(): void {
    const exists = (id: string): boolean => this.geometries.some((geometry) => geometry.id === id);
    for (let entry = this.history.pop(); entry !== undefined; entry = this.history.pop()) {
      this.undoing = true;
      try {
        if (entry.kind === 'remove' && exists(entry.id)) {
          eventBus.publish('presentation.annotations.geometry.delete.requested', SOURCE, { id: this.id, geometry: entry.id });
          return;
        }
        if (entry.kind === 'move' && exists(entry.id)) {
          eventBus.publish('presentation.annotations.geometry.move.requested', SOURCE, { id: this.id, geometry: entry.id, by: entry.by });
          return;
        }
        if (entry.kind === 'style' && exists(entry.id)) {
          eventBus.publish('presentation.annotations.geometry.style.requested', SOURCE, { id: this.id, geometry: entry.id, style: entry.style });
          return;
        }
        if (entry.kind === 'restore' && !exists(entry.geometry.id)) {
          eventBus.publish('presentation.annotations.geometry.restore.requested', SOURCE, { id: this.id, geometry: entry.geometry, position: entry.position });
          return;
        }
      } finally {
        this.undoing = false;
      }
    }
  }
}
