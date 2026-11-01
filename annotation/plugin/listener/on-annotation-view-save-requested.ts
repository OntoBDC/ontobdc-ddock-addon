import { annotationViewCommand } from '@/addon/annotation/adapter/annotation-format';
import { failureMessage, quoted, requestCommand } from '@/ontobdc/shared/adapter/command-request';
import { eventBus, type AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';

const REQUESTED = 'presentation.annotations.view.save.requested';
type Requested = AppEventMap[typeof REQUESTED];
const SOURCE = 'annotations_on_view_save_requested';

/** What a picture's address carries before its bytes. */
const DATA_URL = /^data:image\/png;base64,/;

export class OnAnnotationViewSaveRequested {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'annotations',
    description: 'Keeps the picture of the model an annotation was drawn in, as the person left it, beside the annotation, by the command that keeps it, and tells how it went.',
    arguments: [
      {
        listen: [REQUESTED],
        valued: true,
        parameter: 'id',
        description: 'Global id of the annotation whose view is kept.',
        type: 'str',
      },
    ],
  };

  private readonly request: Requested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as Requested | undefined;
  }

  /** Runs `ontobdc annotate --guid <id> --view <base64>`. */
  async run(): Promise<void> {
    if (!this.request?.id || !DATA_URL.test(this.request.image)) throw new Error('The request carries no annotation or no PNG.');
    const { id, image } = this.request;

    try {
      await requestCommand(annotationViewCommand(quoted(id), image.replace(DATA_URL, '')), SOURCE);
    } catch (error) {
      eventBus.publish('presentation.annotations.view.save.failed', SOURCE, { id, message: failureMessage(error) });
      return;
    }
    eventBus.publish('presentation.annotations.view.saved', SOURCE, { id });
  }
}
