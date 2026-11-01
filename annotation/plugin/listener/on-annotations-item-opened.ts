import { eventBus, type AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';

const ITEM_OPENED = 'presentation.annotations.item.opened';
type ItemOpened = AppEventMap[typeof ITEM_OPENED];
const SOURCE = 'annotations_on_item_opened';

export class OnAnnotationsItemOpened {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'annotations',
    description: 'Opens the tab of an annotation when an item of the Annotations panel is opened.',
    arguments: [
      {
        listen: [ITEM_OPENED],
        valued: true,
        parameter: 'id',
        description: 'Global id of the annotation that was opened.',
        type: 'str',
      },
    ],
  };

  private readonly request: ItemOpened | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as ItemOpened | undefined;
  }

  /** An annotation is an entity of the container: asks the surface for the tab `entity:<global id>`; asking again focuses it. */
  run(): void {
    if (!this.request?.id) throw new Error('The opened annotation carries no id.');

    eventBus.publish('presentation.main.panel.open.requested', SOURCE, {
      container: 'surface',
      id: `entity:${this.request.id}`,
      component: 'entity',
      title: this.request.title || this.request.id,
    });
  }
}
