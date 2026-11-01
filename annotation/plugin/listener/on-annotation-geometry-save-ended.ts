import { GeometryOverlay } from '@/addon/annotation/adapter/geometry-overlay';
import type { AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';

const SAVED = 'presentation.annotations.geometry.saved';
const FAILED = 'presentation.annotations.geometry.save.failed';
type Saved = AppEventMap[typeof SAVED];

export class OnAnnotationGeometrySaveEnded {
  static readonly METADATA: ListenerMetadata = {
    id: 'annotations_on_geometry_save_ended',
    logical_component: 'annotations',
    description: 'Draws the geometries the annotation has on the image of the window when what was asked of them was done, and shows what it has when it was not.',
    arguments: [
      {
        listen: [SAVED, FAILED],
        valued: false,
        description: 'What was asked of the geometries of an annotation was done, or was not.',
        type: 'str',
      },
    ],
  };

  constructor(private readonly event: AppEvent) {}

  run(): void {
    if (this.event.type === SAVED) {
      const { id, geometries } = this.event.payload as Saved;
      GeometryOverlay.saved(id, geometries);
      return;
    }
    GeometryOverlay.saveFailed((this.event.payload as { id: string }).id);
  }
}
