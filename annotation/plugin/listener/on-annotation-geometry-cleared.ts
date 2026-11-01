import { notify } from '@/ontobdc/shared/adapter/notice';
import { EntityRepository } from '@/ontobdc/shared/adapter/entity-repository';
import type { AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';
import { translate } from '@/ontobdc/shared/plugin/i18n';

const GEOMETRY_CLEARED = 'presentation.annotations.geometry.cleared';
type GeometryCleared = AppEventMap[typeof GEOMETRY_CLEARED];

export class OnAnnotationGeometryCleared {
  static readonly METADATA: ListenerMetadata = {
    id: 'annotations_on_annotation_geometry_cleared',
    logical_component: 'annotations',
    description: 'Tells the person, in a notice, that the geometry of an annotation was emptied and has to be made again.',
    arguments: [
      {
        listen: [GEOMETRY_CLEARED],
        valued: true,
        parameter: 'id',
        description: 'Global id of the annotation whose geometry was emptied.',
        type: 'str',
      },
    ],
  };

  private readonly cleared: GeometryCleared | undefined;

  constructor(event: AppEvent) {
    this.cleared = event.payload as GeometryCleared | undefined;
  }

  /** Warns that the points were of the old source document, so the geometry has to be made again on the new one. */
  run(): void {
    const id = this.cleared?.id;
    if (!id) throw new Error('The cleared geometry carries no annotation id.');

    // The entity is read again after this: what the repository holds still names it.
    const title = EntityRepository.getInstance().find(id)?.item.name || id;
    notify(translate('notice.annotations.geometry.cleared', { title }), 'warning');
  }
}
