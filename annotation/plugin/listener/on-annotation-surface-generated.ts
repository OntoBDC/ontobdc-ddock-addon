import { GeometryOverlay } from '@/addon/annotation/adapter/geometry-overlay';
import type { AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';

const SUCCEEDED = 'presentation.annotations.surface.generation.succeeded';
const FAILED = 'presentation.annotations.surface.generation.failed';
type Succeeded = AppEventMap[typeof SUCCEEDED];

export class OnAnnotationSurfaceGenerated {
  static readonly METADATA: ListenerMetadata = {
    id: 'annotations_on_surface_generated',
    logical_component: 'annotations',
    description: 'Puts the image of the document in the window of the geometry when it is ready, and closes the window when it could not be drawn.',
    arguments: [
      {
        listen: [SUCCEEDED, FAILED],
        valued: false,
        description: 'The end of the drawing of the document of an annotation.',
        type: 'str',
      },
    ],
  };

  constructor(private readonly event: AppEvent) {}

  run(): void {
    if (this.event.type === SUCCEEDED) {
      const { id, image, width, height } = this.event.payload as Succeeded;
      GeometryOverlay.show(id, image, width, height);
      return;
    }
    GeometryOverlay.closeFor((this.event.payload as { id: string }).id);
  }
}
