import { AnnotationSurfaceGenerationMachine } from '@/addon/annotation/plugin/machine/annotation_surface_generation/machine';
import { eventBus, type AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import { failureMessage } from '@/ontobdc/shared/adapter/command-request';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';

const SURFACE_REQUESTED = 'presentation.annotations.surface.requested';
type SurfaceRequested = AppEventMap[typeof SURFACE_REQUESTED];
const SOURCE = 'annotations_on_surface_requested';

export class OnAnnotationSurfaceRequested {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'annotations',
    description: 'Draws the document of an annotation as an image, by the machine that reads it and finds its renderer, and tells how it went.',
    arguments: [
      {
        listen: [SURFACE_REQUESTED],
        valued: true,
        parameter: 'id',
        description: 'Global id of the annotation whose document is drawn.',
        type: 'str',
      },
    ],
  };

  private readonly request: SurfaceRequested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as SurfaceRequested | undefined;
  }

  async run(): Promise<void> {
    const { id, document } = this.request ?? {};
    if (!id || !document) throw new Error('The surface to draw carries no annotation id or document.');

    eventBus.publish('presentation.annotations.surface.generation.started', SOURCE, { id });
    try {
      const image = await new AnnotationSurfaceGenerationMachine({ document }).execute();
      eventBus.publish('presentation.annotations.surface.generation.succeeded', SOURCE, {
        id,
        image: URL.createObjectURL(image.blob),
        width: image.width,
        height: image.height,
      });
    } catch (error) {
      eventBus.publish('presentation.annotations.surface.generation.failed', SOURCE, { id, message: failureMessage(error) });
    }
  }
}
