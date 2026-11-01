import { ANNOTATION_ENTITY_TYPE } from '@/addon/annotation/adapter/annotation-format';
import { setAnnotationDataset } from '@/addon/annotation/adapter/annotation-dataset';
import type { AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';

const EVENT = 'presentation.container.entities.found';
type Payload = AppEventMap[typeof EVENT];

export class OnContainerEntitiesFoundAnnotations {
  static readonly METADATA: ListenerMetadata = {
    id: 'annotations_on_container_entities_found',
    logical_component: 'annotations',
    description: 'Keeps which dataset of the database holds the annotations, so a new annotation can be created in it.',
    arguments: [
      {
        listen: [EVENT],
        valued: false,
        description: 'The datasets of the container were read.',
        type: 'str',
      },
    ],
  };

  private readonly payload: Payload | undefined;

  constructor(event: AppEvent) {
    this.payload = event.payload as Payload | undefined;
  }

  /** The dataset is the one that declares the annotation entity type; none when the container has no such dataset. */
  run(): void {
    const groups = Array.isArray(this.payload?.groups) ? this.payload.groups : [];
    setAnnotationDataset(groups.find((group) => group.entityTypes.includes(ANNOTATION_ENTITY_TYPE))?.id ?? null);
  }
}
