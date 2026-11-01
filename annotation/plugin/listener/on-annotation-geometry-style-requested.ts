import { annotationStyleGeometryCommand } from '@/addon/annotation/adapter/annotation-format';
import { changeGeometries } from '@/addon/annotation/adapter/geometry-change';
import { quoted } from '@/ontobdc/shared/adapter/command-request';
import type { AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';

const REQUESTED = 'presentation.annotations.geometry.style.requested';
type Requested = AppEventMap[typeof REQUESTED];
const SOURCE = 'annotations_on_geometry_style_requested';

export class OnAnnotationGeometryStyleRequested {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'annotations',
    description: 'Changes how a geometry of an annotation is drawn by the command that changes its geometries, and tells how it went.',
    arguments: [
      {
        listen: [REQUESTED],
        valued: true,
        parameter: 'id',
        description: 'Global id of the annotation whose geometry is changed.',
        type: 'str',
      },
    ],
  };

  private readonly request: Requested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as Requested | undefined;
  }

  /** Runs `ontobdc annotate --guid <id> --style-geometry <geometry> --stroke <colour> --stroke-width <width> --fill <colour|none>`. */
  async run(): Promise<void> {
    if (!this.request?.id || !this.request.geometry) throw new Error('The request carries no annotation or geometry.');
    const { id, geometry, style } = this.request;

    await changeGeometries(id, annotationStyleGeometryCommand(quoted(id), quoted(geometry), style), SOURCE);
  }
}
