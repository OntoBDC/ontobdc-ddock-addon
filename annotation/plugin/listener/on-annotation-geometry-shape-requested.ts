import { annotationShapeCommand } from '@/addon/annotation/adapter/annotation-format';
import { changeGeometries } from '@/addon/annotation/adapter/geometry-change';
import { quoted } from '@/ontobdc/shared/adapter/command-request';
import type { AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';

const SHAPE_REQUESTED = 'presentation.annotations.geometry.shape.requested';
type ShapeRequested = AppEventMap[typeof SHAPE_REQUESTED];
const SOURCE = 'annotations_on_geometry_shape_requested';

export class OnAnnotationGeometryShapeRequested {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'annotations',
    description: 'Keeps the shape the person drew on the annotation, by the command that makes it into geometries, and tells how it went.',
    arguments: [
      {
        listen: [SHAPE_REQUESTED],
        valued: true,
        parameter: 'id',
        description: 'Global id of the annotation the shape is drawn for.',
        type: 'str',
      },
    ],
  };

  private readonly request: ShapeRequested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as ShapeRequested | undefined;
  }

  /** Runs `ontobdc annotate --guid <id> --shape <shape> --param <name>=<value>...`. */
  async run(): Promise<void> {
    if (!this.request?.id) throw new Error('The shape carries no annotation id.');
    const { id, shape, arguments: given, style } = this.request;

    await changeGeometries(id, annotationShapeCommand(quoted(id), { shape, arguments: given, style }), SOURCE);
  }
}
