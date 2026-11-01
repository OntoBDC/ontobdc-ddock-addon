import { ANNOTATION_LIST_COMMAND } from '@/addon/annotation/adapter/annotation-format';
import { eventBus } from '@/ontobdc/shared/adapter/event-bus';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';

const SOURCE = 'annotations_on_container_refresh_completed';

export class OnContainerRefreshCompletedAnnotations {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'annotations',
    description: 'Asks for the annotations of the container once it was refreshed, and again whenever an annotation or an entity changed.',
    arguments: [
      {
        listen: [
          'presentation.container.refresh.completed',
          'presentation.annotations.item.deleted',
          'presentation.entity.created',
          'presentation.entity.saved',
          'presentation.entity.deleted',
        ],
        valued: false,
        description: 'The container was refreshed, or an annotation or entity was created, saved or deleted.',
        type: 'str',
      },
    ],
  };

  /** Requests `ontobdc annotate --list`; the terminal shows it and the run listener executes it. */
  run(): void {
    eventBus.publish('presentation.main.command.requested', SOURCE, {
      requestId: crypto.randomUUID(),
      command: ANNOTATION_LIST_COMMAND,
    });
  }
}
