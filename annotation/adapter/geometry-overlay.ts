import { DEFAULT_SOLID_STYLE, SHAPES_2D, SHAPES_3D, type SavedGeometry } from '@/addon/annotation/domain/model/geometry-tool';
import { composeView } from '@/addon/annotation/adapter/compose-view';
import { GeometryCanvas } from '@/addon/annotation/adapter/geometry-canvas';
import { GeometryToolbar } from '@/addon/annotation/adapter/geometry-toolbar';
import type { GeometrySurface } from '@/addon/annotation/adapter/geometry-surface';
import { keepSpaceShot } from '@/addon/annotation/adapter/space-shot-cache';
import { SpaceCanvas } from '@/addon/annotation/adapter/space-canvas';
import { ContainerFileRepository } from '@/ontobdc/shared/adapter/container-file-repository';
import { ContainerRepository } from '@/ontobdc/shared/adapter/container-repository';
import { documentSpace } from '@/ontobdc/shared/adapter/document-space';
import { EntityRepository } from '@/ontobdc/shared/adapter/entity-repository';
import { eventBus } from '@/ontobdc/shared/adapter/event-bus';
import { failureMessage } from '@/ontobdc/shared/adapter/command-request';
import { notify } from '@/ontobdc/shared/adapter/notice';
import type { SpaceView } from '@/ontobdc/shared/domain/model/document-space';
import { translate } from '@/ontobdc/shared/plugin/i18n';

const SOURCE = 'annotations_geometry_overlay';

/**
 * The window the geometry of an annotation is drawn in: fixed over the page, with a loading mark until the image it is
 * drawn on is ready. There is one at a time; opening another takes the place of the first.
 */
export class GeometryOverlay {
  private static current: GeometryOverlay | null = null;

  private readonly root = document.createElement('section');
  private readonly stage = document.createElement('div');
  private imageUrl: string | null = null;
  private toolbar: GeometryToolbar | null = null;
  private canvas: GeometrySurface | null = null;
  private view: SpaceView | null = null;
  /** Whether the geometries of the annotation were changed while the window was open. */
  private changed = false;

  private constructor(private readonly id: string, title: string) {
    this.root.className = 'geometry-overlay';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', translate('annotations.geometry.title', { title }));

    const header = document.createElement('header');
    const heading = document.createElement('strong');
    heading.textContent = translate('annotations.geometry.title', { title });
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'geometry-overlay-close';
    close.textContent = '×';
    close.title = translate('annotations.geometry.close');
    close.setAttribute('aria-label', translate('annotations.geometry.close'));
    close.addEventListener('click', () => GeometryOverlay.close(true));
    header.append(heading, close);

    this.stage.className = 'geometry-overlay-stage';
    const loading = document.createElement('div');
    loading.className = 'geometry-overlay-loading';
    loading.setAttribute('role', 'status');
    const spinner = document.createElement('span');
    spinner.className = 'home-spinner';
    const message = document.createElement('span');
    message.textContent = translate('annotations.geometry.loading');
    loading.append(spinner, message);
    this.stage.append(loading);

    this.root.append(header, this.stage);
    document.body.append(this.root);
  }

  /** Opens the window, loading, in place of the one that was open. */
  static open(id: string, title: string): void {
    GeometryOverlay.close(false);
    GeometryOverlay.current = new GeometryOverlay(id, title);
  }

  /** Opens the window, loading, and shows the document in space in it when it is ready: there is no image to wait for. */
  static openSpace(id: string, title: string, document: string): void {
    GeometryOverlay.open(id, title);
    const overlay = GeometryOverlay.current;
    if (!overlay) return;
    overlay.loadSpace(document).catch((error: unknown) => {
      if (GeometryOverlay.current !== overlay) return;
      notify(failureMessage(error), 'error');
      GeometryOverlay.close(true);
    });
  }

  private async loadSpace(document: string): Promise<void> {
    const space = documentSpace(document);
    const folder = ContainerRepository.getInstance().get()?.folder;
    if (!space || !folder) throw new Error(`The document ${document} cannot be shown in space.`);

    const file = await ContainerFileRepository.of(folder).file(document);
    const host = window.document.createElement('div');
    host.className = 'geometry-overlay-space';
    this.stage.append(host);
    const view = await space.open(file, host);
    // The window was closed, or another one opened, while the model was read.
    if (GeometryOverlay.current !== this) {
      view.dispose();
      host.remove();
      return;
    }
    this.view = view;
    const toolbar = new GeometryToolbar(this.id, SHAPES_3D, { style: DEFAULT_SOLID_STYLE, width: false });
    this.toolbar = toolbar;
    this.canvas = new SpaceCanvas(this.id, view, () => toolbar.selection(), GeometryOverlay.initial(this.id));
    this.stage.querySelector('.geometry-overlay-loading')?.remove();
    this.root.append(toolbar.element);
  }

  private static initial(id: string): SavedGeometry[] {
    return EntityRepository.getInstance().find(id)?.item.fields.find((field) => field.name === 'geometry')?.geometries ?? [];
  }

  /** Shows the image of the annotation in place of the loading mark; nothing happens if its window is no longer open. */
  static show(id: string, imageUrl: string, width: number, height: number): void {
    const overlay = GeometryOverlay.current;
    if (!overlay || overlay.id !== id) {
      URL.revokeObjectURL(imageUrl);
      return;
    }
    const image = document.createElement('img');
    image.className = 'geometry-overlay-image';
    image.src = imageUrl;
    image.width = width;
    image.height = height;
    image.alt = '';
    overlay.imageUrl = imageUrl;
    const toolbar = new GeometryToolbar(id, SHAPES_2D);
    overlay.toolbar = toolbar;
    const canvas = new GeometryCanvas(id, image, width, height, () => toolbar.selection(), GeometryOverlay.initial(id));
    overlay.canvas = canvas;
    overlay.stage.replaceChildren(canvas.element);
    overlay.root.append(toolbar.element);
  }

  /** Draws on the image the geometries the annotation has now; nothing happens if the window of the annotation is no longer open. */
  static saved(id: string, geometries: SavedGeometry[]): void {
    const overlay = GeometryOverlay.current;
    if (overlay?.id !== id) return;
    overlay.changed = true;
    overlay.canvas?.saved(geometries);
  }

  /** What was asked of the geometries could not be done: the window shows what the annotation has. */
  static saveFailed(id: string): void {
    const overlay = GeometryOverlay.current;
    if (overlay?.id === id) overlay.canvas?.failed();
  }

  /** Whether the window of this annotation is open. */
  static isOpenFor(id: string): boolean {
    return GeometryOverlay.current?.id === id;
  }

  /** Closes the window of the annotation, if it is the one open. */
  static closeFor(id: string): void {
    if (GeometryOverlay.current?.id === id) GeometryOverlay.close(false);
  }

  private static close(announce: boolean): void {
    const overlay = GeometryOverlay.current;
    if (!overlay) return;
    GeometryOverlay.current = null;
    // The document drawn as an image is kept with the geometries on it, as the tab shows it, for what cannot draw them itself (a workbook).
    if (overlay.canvas instanceof GeometryCanvas && overlay.changed) {
      const { image, width, height } = overlay.canvas;
      const id = overlay.id;
      composeView(image, width, height, overlay.canvas.current())
        .then((url) => eventBus.publish('presentation.annotations.view.save.requested', SOURCE, { id, image: url }))
        .catch((error: unknown) => eventBus.publish('presentation.annotations.view.save.failed', SOURCE, { id, message: failureMessage(error) }));
    }
    overlay.canvas?.dispose();
    overlay.toolbar?.dispose();
    if (overlay.view) {
      // The view the person left the model in is the picture the annotation shows: the model is not drawn again to show it.
      const url = overlay.view.capture();
      keepSpaceShot(overlay.id, { url, width: overlay.view.canvas.clientWidth, height: overlay.view.canvas.clientHeight });
      // It is kept beside the annotation too, so that it is what is shown the next time the page is opened.
      eventBus.publish('presentation.annotations.view.save.requested', SOURCE, { id: overlay.id, image: url });
      overlay.view.dispose();
    }
    overlay.root.remove();
    if (overlay.imageUrl) URL.revokeObjectURL(overlay.imageUrl);
    if (announce) eventBus.publish('presentation.annotations.geometry.draw.closed', SOURCE, { id: overlay.id });
  }
}
