import { documentImage } from '@/addon/annotation/adapter/document-image-cache';
import { GeometryOverlay } from '@/addon/annotation/adapter/geometry-overlay';
import { savedSpaceShot, spaceShot } from '@/addon/annotation/adapter/space-shot-cache';
import { createGeometryFigure } from '@/addon/annotation/adapter/geometry-figure';
import { documentPath } from '@/ontobdc/shared/adapter/document-iri';
import { ContainerFileRepository } from '@/ontobdc/shared/adapter/container-file-repository';
import { ContainerRepository } from '@/ontobdc/shared/adapter/container-repository';
import { documentImageRenderer } from '@/ontobdc/shared/adapter/document-image';
import { documentSpace } from '@/ontobdc/shared/adapter/document-space';
import { EntityRepository } from '@/ontobdc/shared/adapter/entity-repository';
import { eventBus } from '@/ontobdc/shared/adapter/event-bus';
import type { SavedGeometry } from '@/addon/annotation/domain/model/geometry-tool';
import type { DocumentImage } from '@/ontobdc/shared/domain/model/document-image';
import type { DocumentSpace } from '@/ontobdc/shared/domain/model/document-space';
import type { VisualizationContext, VisualizationResult } from '@/ontobdc/shared/domain/model/visualization';
import { translate } from '@/ontobdc/shared/plugin/i18n';

const SOURCE = 'annotations_geometry_overlay_visualization';

/** How big the picture of a document shown in space is, which is not drawn once for all as an image is: it is seen from where the person would see it. */
const SNAPSHOT = { width: 960, height: 600 };

async function snapshot(space: DocumentSpace, path: string, geometries: SavedGeometry[]): Promise<DocumentImage> {
  const folder = ContainerRepository.getInstance().get()?.folder;
  if (!folder) throw new Error('No container is open to read the document from.');
  return space.snapshot(await ContainerFileRepository.of(folder).file(path), geometries, SNAPSHOT);
}

/**
 * The visualization of the geometry of an annotation: the document it was made on, drawn as an image, with its
 * geometries on it, in place of their text. It is the file of the carousel, one file, with what was drawn on it.
 * Double-clicking it asks for the geometries to be drawn, as the button of the field does. When the document cannot be
 * drawn it says so: the text of a geometry is not what the field shows.
 */
export default function geometryOverlay(context: VisualizationContext): VisualizationResult {
  const element = document.createElement('div');
  element.className = 'geometry-view';
  const id = context.entityId ?? '';
  const item = EntityRepository.getInstance().find(id)?.item;
  const geometries = item?.fields.find((field) => field.name === 'geometry')?.geometries ?? [];
  const iri = item?.fields.find((field) => field.name === 'source_document')?.values[0]?.trim() ?? '';
  const path = iri ? documentPath(iri) : undefined;

  const say = (key: 'annotations.geometry.view.noDocument' | 'annotations.geometry.view.notDrawable' | 'annotations.geometry.view.failed'): void => {
    const note = document.createElement('p');
    note.className = 'geometry-view-note';
    note.textContent = translate(key);
    element.replaceChildren(note);
  };

  let disposed = false;
  let revoke: string | null = null;
  const unsubscribe: Array<() => void> = [];
  const show = (url: string, width: number, height: number, shapes: SavedGeometry[]): void => {
    delete element.dataset.loading;
    const figure = createGeometryFigure(url, width, height, shapes);
    figure.title = translate('annotations.geometry.view.open');
    figure.addEventListener('dblclick', () => eventBus.publish('presentation.entity.geometry.draw.requested', SOURCE, { owner: id, field: 'geometry' }));
    element.replaceChildren(figure);
  };
  const failed = (): void => {
    if (disposed) return;
    delete element.dataset.loading;
    say('annotations.geometry.view.failed');
  };
  const space = path ? documentSpace(path) : undefined;
  if (!path) say('annotations.geometry.view.noDocument');
  else if (!documentImageRenderer(path) && !space) say('annotations.geometry.view.notDrawable');
  else if (space) {
    // A document in space is shown as the person left it: the picture of the view they closed its window in, with the shapes in it, so nothing is drawn over it.
    const shown = (): boolean => {
      const shot = spaceShot(id);
      if (!shot || disposed) return false;
      show(shot.url, shot.width, shot.height, []);
      return true;
    };
    unsubscribe.push(eventBus.subscribe('presentation.annotations.geometry.shot.taken', ({ payload }) => {
      if (payload?.id === id) shown();
    }));
    element.dataset.loading = 'true';
    // While the window is open the picture is the one it will leave. With none taken since the page was opened, it is the one kept beside the annotation; with none kept, the model is drawn once, from where it starts.
    if (!shown() && !GeometryOverlay.isOpenFor(id)) {
      savedSpaceShot(id).then(() => {
        if (disposed || shown()) return;
        return snapshot(space, path, geometries).then((image) => {
          const url = URL.createObjectURL(image.blob);
          if (disposed || spaceShot(id)) {
            URL.revokeObjectURL(url);
            return;
          }
          revoke = url;
          show(url, image.width, image.height, []);
        });
      }).catch(failed);
    }
  } else {
    element.dataset.loading = 'true';
    documentImage(path).then((image) => {
      if (disposed) return;
      show(image.url, image.width, image.height, geometries);
    }).catch(failed);
  }

  return { element, handled: context.values, dispose: () => {
      disposed = true;
      unsubscribe.forEach((dispose) => dispose());
      if (revoke) URL.revokeObjectURL(revoke);
    } };
}
