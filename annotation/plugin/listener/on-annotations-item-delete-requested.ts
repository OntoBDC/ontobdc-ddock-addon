import { confirmDialog } from '@/ontobdc/shared/adapter/confirm-dialog';
import { eventBus, type AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';
import { translate } from '@/ontobdc/shared/plugin/i18n';

const DELETE_REQUESTED = 'presentation.annotations.item.delete.requested';
type DeleteRequested = AppEventMap[typeof DELETE_REQUESTED];
const SOURCE = 'annotations_on_item_delete_requested';

export class OnAnnotationsItemDeleteRequested {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'annotations',
    description: 'Asks the person to confirm the deletion of an annotation, in a modal, and says whether they did.',
    arguments: [
      {
        listen: [DELETE_REQUESTED],
        valued: true,
        parameter: 'id',
        description: 'Global id of the annotation whose deletion was requested.',
        type: 'str',
      },
    ],
  };

  private readonly request: DeleteRequested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as DeleteRequested | undefined;
  }

  /** Publishes `presentation.annotations.item.delete.confirmed` or `.cancelled` with the id and title. Deletes nothing. */
  async run(): Promise<void> {
    const id = this.request?.id;
    if (!id) throw new Error('The deletion request carries no annotation id.');

    const title = this.request?.title || id;
    const confirmed = await confirmDialog({
      title: translate('annotation.delete.title'),
      message: translate('annotation.delete.message', { title }),
      confirmLabel: translate('annotation.delete.confirm'),
      cancelLabel: translate('confirm.cancel'),
    });
    eventBus.publish(confirmed ? 'presentation.annotations.item.delete.confirmed' : 'presentation.annotations.item.delete.cancelled', SOURCE, { id, title });
  }
}
