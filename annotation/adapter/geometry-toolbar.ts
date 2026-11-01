import { DEFAULT_STYLE, STROKE_WIDTHS, type GeometryStyle, type Shape } from '@/addon/annotation/domain/model/geometry-tool';
import { DELETE_ICON } from '@/ontobdc/shared/adapter/menu-icons';
import { eventBus } from '@/ontobdc/shared/adapter/event-bus';
import { translate, type MessageKey } from '@/ontobdc/shared/plugin/i18n';

const SOURCE = 'annotations_geometry_toolbar';

const icon = (paths: string): string =>
  `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const ICONS: Record<Shape, string> = {
  rectangle: icon('<rect x="2.5" y="4" width="11" height="8"/>'),
  circle: icon('<circle cx="8" cy="8" r="5.5"/>'),
  amoeba: icon('<path d="M3 8.5C2 5.5 5 3 8 4c3-1.5 6.5 1 5 4.5 1 2.5-1.5 4.5-4 3.5-2.5 1.5-6 .5-6-3.5z"/>'),
  cross: icon('<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>'),
  box: icon('<path d="M2.5 5.5l5.5-3 5.5 3v6l-5.5 3-5.5-3z"/><path d="M2.5 5.5L8 8.5l5.5-3M8 8.5v6"/>'),
  cylinder: icon('<ellipse cx="8" cy="4.5" rx="4.5" ry="2"/><path d="M3.5 4.5v7c0 1.1 2 2 4.5 2s4.5-.9 4.5-2v-7"/>'),
  sphere: icon('<circle cx="8" cy="8" r="5.5"/><ellipse cx="8" cy="8" rx="5.5" ry="2"/>'),
  lollipop: icon('<circle cx="8" cy="5" r="3"/><path d="M8 8v6.5"/>'),
};

/**
 * The tools of the window the geometry is drawn in: the shapes in a row, and under them how the next one is drawn
 * (the colour and the width of its border, the colour of its fill). It keeps what was chosen and tells every change.
 */
export class GeometryToolbar {
  readonly element = document.createElement('div');
  private readonly unsubscribe: Array<() => void> = [];
  private tool: Shape | null = null;
  private style: GeometryStyle;
  private readonly showWidth: boolean;
  private controls: { stroke: HTMLInputElement; width: HTMLInputElement; fill: HTMLInputElement; none: HTMLInputElement } | null = null;

  /** `style` is how the next shape is drawn to begin with, and `width` whether the width of the border is the person's to choose (a shape in space has no border wider than a line). */
  constructor(private readonly id: string, shapes: readonly Shape[], options: { style?: GeometryStyle; width?: boolean } = {}) {
    this.style = { ...(options.style ?? DEFAULT_STYLE) };
    this.showWidth = options.width ?? true;
    this.element.className = 'geometry-toolbar';
    this.element.append(this.shapeRow(shapes), this.styleRow());
    this.element.querySelector('.geometry-toolbar-shapes')?.append(this.deleteButton());
  }

  dispose(): void {
    this.unsubscribe.forEach((dispose) => dispose());
  }

  /** The shape the person armed, none when they have not; and how it is drawn. */
  selection(): { tool: Shape | null; style: GeometryStyle } {
    return { tool: this.tool, style: { ...this.style } };
  }

  private shapeRow(shapes: readonly Shape[]): HTMLElement {
    const row = document.createElement('div');
    row.className = 'geometry-toolbar-shapes';
    row.setAttribute('role', 'toolbar');
    const buttons = new Map<Shape, HTMLButtonElement>();
    for (const shape of shapes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'geometry-tool';
      button.innerHTML = ICONS[shape];
      const label = translate(`annotations.shape.${shape}` as MessageKey);
      button.title = label;
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-pressed', 'false');
      button.dataset.shape = shape;
      button.addEventListener('click', () => {
        // The shape that is armed is put down by choosing it again.
        this.tool = this.tool === shape ? null : shape;
        for (const [name, other] of buttons) other.setAttribute('aria-pressed', String(name === this.tool));
        eventBus.publish('presentation.annotations.geometry.tool.changed', SOURCE, { id: this.id, tool: this.tool });
      });
      buttons.set(shape, button);
      row.append(button);
    }
    return row;
  }

  /** Takes off the shape that is chosen, as Delete does: on while there is one. */
  private deleteButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'geometry-tool geometry-delete';
    button.innerHTML = DELETE_ICON;
    const label = translate('annotations.geometry.delete');
    button.title = label;
    button.setAttribute('aria-label', label);
    button.disabled = true;
    let chosen: string | null = null;
    button.addEventListener('click', () => {
      if (chosen !== null) eventBus.publish('presentation.annotations.geometry.delete.requested', SOURCE, { id: this.id, geometry: chosen });
    });
    this.unsubscribe.push(eventBus.subscribe('presentation.annotations.geometry.selected', ({ payload }) => {
      if (payload?.id !== this.id) return;
      chosen = payload.geometry;
      button.disabled = chosen === null;
      if (payload.style) this.reflect(payload.style);
    }));
    return button;
  }

  /** The controls show how the shape that was chosen is drawn. They only show it: what changes them is not a change the person made. */
  private reflect(style: GeometryStyle): void {
    this.style = { ...style };
    if (!this.controls) return;
    this.controls.stroke.value = style.stroke;
    this.controls.width.value = String(style.strokeWidth);
    this.controls.none.checked = style.fill === null;
    this.controls.fill.disabled = style.fill === null;
    if (style.fill !== null) this.controls.fill.value = style.fill;
  }

  private styleRow(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'geometry-toolbar-style';

    const stroke = this.colour('stroke', this.style.stroke, (value) => this.change({ stroke: value }));
    const width = document.createElement('input');
    width.type = 'range';
    width.min = String(STROKE_WIDTHS.min);
    width.max = String(STROKE_WIDTHS.max);
    width.step = '1';
    width.value = String(this.style.strokeWidth);
    width.dataset.field = 'strokeWidth';
    width.title = translate('annotations.geometry.strokeWidth');
    width.setAttribute('aria-label', translate('annotations.geometry.strokeWidth'));
    width.addEventListener('input', () => this.change({ strokeWidth: Number(width.value) }));

    const fill = this.colour('fill', this.style.fill ?? DEFAULT_STYLE.stroke, (value) => this.change({ fill: value }));
    const none = document.createElement('label');
    none.className = 'geometry-toolbar-none';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = this.style.fill === null;
    check.dataset.field = 'noFill';
    check.addEventListener('change', () => {
      fill.input.disabled = check.checked;
      this.change({ fill: check.checked ? null : fill.input.value });
    });
    fill.input.disabled = check.checked;
    none.append(check, document.createTextNode(translate('annotations.geometry.noFill')));

    this.controls = { stroke: stroke.input, width, fill: fill.input, none: check };
    row.append(stroke.label, ...(this.showWidth ? [width] : []), fill.label, none);
    return row;
  }

  private colour(field: string, value: string, onChange: (value: string) => void): { label: HTMLLabelElement; input: HTMLInputElement } {
    const input = document.createElement('input');
    input.type = 'color';
    input.value = value;
    input.dataset.field = field;
    const text = translate(field === 'stroke' ? 'annotations.geometry.strokeColor' : 'annotations.geometry.fillColor');
    input.title = text;
    input.setAttribute('aria-label', text);
    input.addEventListener('input', () => onChange(input.value));
    const label = document.createElement('label');
    label.className = 'geometry-toolbar-colour';
    label.append(input);
    return { label, input };
  }

  private change(part: Partial<GeometryStyle>): void {
    this.style = { ...this.style, ...part };
    eventBus.publish('presentation.annotations.geometry.style.changed', SOURCE, { id: this.id, ...this.style });
  }
}
