import { quoted, requestCommand } from '@/ontobdc/shared/adapter/command-request';
import { eventBus, type AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import { ContainerRepository } from '@/ontobdc/shared/adapter/container-repository';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';
import { translate } from '@/ontobdc/shared/plugin/i18n';

const DELETE_CONFIRMED = 'presentation.annotations.item.delete.confirmed';
type DeleteConfirmed = AppEventMap[typeof DELETE_CONFIRMED];
const SOURCE = 'annotations_on_item_delete_confirmed';

export class OnAnnotationsItemDeleteConfirmed {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'annotations',
    description: 'Deletes an annotation of the container once its deletion was confirmed.',
    arguments: [
      {
        listen: [DELETE_CONFIRMED],
        valued: true,
        parameter: 'id',
        description: 'Global id of the annotation whose deletion was confirmed.',
        type: 'str',
      },
    ],
  };

  private readonly request: DeleteConfirmed | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as DeleteConfirmed | undefined;
  }

  /**
   * Runs `ontobdc annotate --guid <id> --delete`. When it worked, publishes
   * `presentation.annotations.item.deleted`, which has the annotations read
   * again; when it did not, `presentation.annotations.item.delete.failed` with
   * the reason.
   */
  async run(): Promise<void> {
    const id = this.request?.id;
    if (!id) throw new Error('The confirmed deletion carries no annotation id.');

    try {
      if (ContainerRepository.getInstance().get()?.access !== 'readwrite') throw new Error(translate('container.readOnly'));
      await requestCommand(`ontobdc annotate --guid ${quoted(id)} --delete`, SOURCE);
    } catch (error) {
      eventBus.publish('presentation.annotations.item.delete.failed', SOURCE, { id, message: error instanceof Error ? error.message : String(error) });
      return;
    }
    eventBus.publish('presentation.annotations.item.deleted', SOURCE, { id });
  }
}
