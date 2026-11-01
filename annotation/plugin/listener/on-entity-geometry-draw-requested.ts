import { ANNOTATION_ENTITY_TYPE } from '@/addon/annotation/adapter/annotation-format';
import { documentImageRenderer } from '@/ontobdc/shared/adapter/document-image';
import { documentSpace } from '@/ontobdc/shared/adapter/document-space';
import { documentPath } from '@/ontobdc/shared/adapter/document-iri';
import { EntityRepository } from '@/ontobdc/shared/adapter/entity-repository';
import { eventBus, type AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import { notify } from '@/ontobdc/shared/adapter/notice';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';
import { translate } from '@/ontobdc/shared/plugin/i18n';

const DRAW_REQUESTED = 'presentation.entity.geometry.draw.requested';
type DrawRequested = AppEventMap[typeof DRAW_REQUESTED];
const SOURCE = 'annotations_on_entity_geometry_draw_requested';

export class OnEntityGeometryDrawRequested {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'annotations',
    description: 'Opens the window the geometry of an annotation is drawn in when the geometry field of its tab asks for it, on the document it was made on.',
    arguments: [
      {
        listen: [DRAW_REQUESTED],
        valued: true,
        parameter: 'owner',
        description: 'Global id of the entity whose geometries are drawn.',
        type: 'str',
      },
    ],
  };

  private readonly request: DrawRequested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as DrawRequested | undefined;
  }

  /** Says why when there is nothing to draw on: no source document, or one that no addon draws as an image or shows in space. */
  run(): void {
    const id = this.request?.owner;
    if (!id) throw new Error('The geometry to draw carries no entity id.');
    const found = EntityRepository.getInstance().find(id);
    if (!found?.group.entityTypes.includes(ANNOTATION_ENTITY_TYPE)) return;

    const iri = found.item.fields.find((field) => field.name === 'source_document')?.values[0]?.trim() ?? '';
    const document = iri ? documentPath(iri) : undefined;
    if (!document) {
      notify(translate('notice.annotations.geometry.noDocument'), 'warning');
      return;
    }
    if (!documentImageRenderer(document) && !documentSpace(document)) {
      notify(translate('notice.annotations.geometry.notDrawable', { document }), 'warning');
      return;
    }
    eventBus.publish('presentation.annotations.geometry.draw.requested', SOURCE, { id, title: found.item.name || id, document });
  }
}
