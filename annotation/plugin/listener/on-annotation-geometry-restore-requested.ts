import { annotationRestoreGeometryCommand } from '@/addon/annotation/adapter/annotation-format';
import { changeGeometries } from '@/addon/annotation/adapter/geometry-change';
import { quoted } from '@/ontobdc/shared/adapter/command-request';
import type { AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';

const REQUESTED = 'presentation.annotations.geometry.restore.requested';
type Requested = AppEventMap[typeof REQUESTED];
const SOURCE = 'annotations_on_geometry_restore_requested';

export class OnAnnotationGeometryRestoreRequested {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'annotations',
    description: 'Puts back a geometry that was taken off an annotation, by the command that changes its geometries, and tells how it went.',
    arguments: [
      {
        listen: [REQUESTED],
        valued: true,
        parameter: 'id',
        description: 'Global id of the annotation the geometry is put back on.',
        type: 'str',
      },
    ],
  };

  private readonly request: Requested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as Requested | undefined;
  }

  /** Runs `ontobdc annotate --guid <id> --restore-geometry <geometry> --wkt <text> --position <n>`, with what the geometry was made as and how it was drawn. */
  async run(): Promise<void> {
    if (!this.request?.id || !this.request.geometry) throw new Error('The request carries no annotation or geometry.');
    const { id, geometry, position } = this.request;

    await changeGeometries(id, annotationRestoreGeometryCommand(quoted(id), geometry, position), SOURCE);
  }
}
