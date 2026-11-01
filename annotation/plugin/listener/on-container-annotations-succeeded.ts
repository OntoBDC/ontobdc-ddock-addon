import { ANNOTATION_LIST_COMMAND, annotationGroupsOf } from '@/addon/annotation/adapter/annotation-format';
import { eventBus, type AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';

const EVENT = 'presentation.main.code.success';
type Payload = AppEventMap[typeof EVENT];
const SOURCE = 'annotations_on_container_annotations_succeeded';

export class OnContainerAnnotationsSucceeded {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'annotations',
    description: 'Fills the Annotations panel when `ontobdc annotate --list` worked.',
    arguments: [
      {
        listen: [EVENT],
        valued: false,
        description: 'A command ran and worked; the result says which one.',
        type: 'str',
      },
    ],
  };

  private readonly payload: Payload | undefined;

  constructor(event: AppEvent) {
    this.payload = event.payload as Payload | undefined;
  }

  /** Publishes the groups the command answered, or says it could not read them. */
  run(): void {
    const success = this.payload;
    if (success?.result.stdin !== ANNOTATION_LIST_COMMAND) return;

    const groups = annotationGroupsOf(success.result.stdout);
    if (groups) eventBus.publish('presentation.container.annotations.found', SOURCE, { groups });
    else eventBus.publish('presentation.container.annotations.failed', SOURCE, { message: 'The annotation command did not answer with groups.' });
  }
}
