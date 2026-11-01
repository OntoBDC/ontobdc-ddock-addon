import { ANNOTATION_LIST_COMMAND } from '@/addon/annotation/adapter/annotation-format';
import { eventBus, type AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';

const EVENT = 'presentation.main.code.failure';
type Payload = AppEventMap[typeof EVENT];
const SOURCE = 'annotations_on_container_annotations_failed';

export class OnContainerAnnotationsFailed {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'annotations',
    description: 'Tells the Annotations panel that `ontobdc annotate --list` failed.',
    arguments: [
      {
        listen: [EVENT],
        valued: false,
        description: 'A command ran and did not work; the result says which one.',
        type: 'str',
      },
    ],
  };

  private readonly payload: Payload | undefined;

  constructor(event: AppEvent) {
    this.payload = event.payload as Payload | undefined;
  }

  /** Publishes why the annotations could not be read. */
  run(): void {
    const failure = this.payload;
    if (failure?.result?.stdin !== ANNOTATION_LIST_COMMAND) return;

    eventBus.publish('presentation.container.annotations.failed', SOURCE, { message: failure.message });
  }
}
