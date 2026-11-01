import { documentSpace } from '@/ontobdc/shared/adapter/document-space';
import { GeometryOverlay } from '@/addon/annotation/adapter/geometry-overlay';
import { eventBus, type AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';

const DRAW_REQUESTED = 'presentation.annotations.geometry.draw.requested';
type DrawRequested = AppEventMap[typeof DRAW_REQUESTED];
const SOURCE = 'annotations_on_geometry_draw_requested';

export class OnAnnotationGeometryDrawRequested {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'annotations',
    description: 'Opens the window the geometry of an annotation is drawn in: a document shown in space as it is, any other loading, and asks for the document to be drawn as an image.',
    arguments: [
      {
        listen: [DRAW_REQUESTED],
        valued: true,
        parameter: 'id',
        description: 'Global id of the annotation whose geometry is drawn.',
        type: 'str',
      },
    ],
  };

  private readonly request: DrawRequested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as DrawRequested | undefined;
  }

  run(): void {
    const { id, title, document } = this.request ?? {};
    if (!id || !document) throw new Error('The geometry to draw carries no annotation id or document.');

    // A document shown in space is opened as it is, the way its tab opens it; any other is drawn as an image first.
    if (documentSpace(document)) {
      GeometryOverlay.openSpace(id, title || id, document);
      return;
    }
    GeometryOverlay.open(id, title || id);
    eventBus.publish('presentation.annotations.surface.requested', SOURCE, { id, document });
  }
}
