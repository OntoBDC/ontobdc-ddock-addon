import { annotationClearGeometryCommand, ANNOTATION_ENTITY_TYPE } from '@/addon/annotation/adapter/annotation-format';
import { failureMessage, quoted, requestCommand } from '@/ontobdc/shared/adapter/command-request';
import { EntityRepository } from '@/ontobdc/shared/adapter/entity-repository';
import { eventBus, type AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';

const ENTITY_SAVED = 'presentation.entity.saved';
type EntitySaved = AppEventMap[typeof ENTITY_SAVED];
const SOURCE = 'annotations_on_annotation_source_document_saved';
const SOURCE_DOCUMENT = 'source_document';
const GEOMETRY = 'geometry';

export class OnAnnotationSourceDocumentSaved {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'annotations',
    description: 'Empties the geometry of an annotation whose source document was saved: its points belonged to the old document.',
    arguments: [
      {
        listen: [ENTITY_SAVED],
        valued: true,
        parameter: 'id',
        description: 'Global id of the entity whose changes were saved.',
        type: 'str',
      },
    ],
  };

  private readonly saved: EntitySaved | undefined;

  constructor(event: AppEvent) {
    this.saved = event.payload as EntitySaved | undefined;
  }

  /**
   * When the source document of an annotation that has a geometry was saved, empties the geometry
   * (`ontobdc annotate --guid <id> --clear geometry`), publishes `presentation.annotations.geometry.cleared`
   * and asks for the entity to be read again; when the command fails it publishes
   * `presentation.annotations.geometry.clear.failed`. A geometry that was saved together with the document is the one
   * the person gave for the new document, and stays.
   */
  async run(): Promise<void> {
    const id = this.saved?.id;
    const changed = this.saved?.changed ?? [];
    if (!id) throw new Error('The saved entity carries no id.');
    if (!changed.includes(SOURCE_DOCUMENT) || changed.includes(GEOMETRY)) return;

    // What the repository holds is the entity before this save: the points the old document had.
    const found = EntityRepository.getInstance().find(id);
    if (!found?.group.entityTypes.includes(ANNOTATION_ENTITY_TYPE)) return;
    if (!found.item.fields.some((field) => field.name === GEOMETRY && field.values.some((value) => value.trim() !== ''))) return;

    try {
      await requestCommand(annotationClearGeometryCommand(quoted(id)), SOURCE);
    } catch (error) {
      eventBus.publish('presentation.annotations.geometry.clear.failed', SOURCE, { id, message: failureMessage(error) });
      return;
    }
    eventBus.publish('presentation.annotations.geometry.cleared', SOURCE, { id });
    eventBus.publish('presentation.entity.refresh.requested', SOURCE, { id });
  }
}
