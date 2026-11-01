import type { AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import { notify } from '@/ontobdc/shared/adapter/notice';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';
import { translate, type MessageKey } from '@/ontobdc/shared/plugin/i18n';

const FAILURES: Record<string, MessageKey> = {
  'presentation.annotations.item.delete.failed': 'notice.annotations.delete.failed',
  'presentation.annotations.group.export.failed': 'notice.annotations.export.failed',
  'presentation.annotations.geometry.clear.failed': 'notice.annotations.geometry.failed',
  'presentation.annotations.geometry.save.failed': 'notice.annotations.geometry.save.failed',
  'presentation.annotations.view.save.failed': 'notice.annotations.view.save.failed',
  'presentation.annotations.surface.generation.failed': 'notice.annotations.surface.failed',
};

export class OnAnnotationsFailureReported {
  static readonly METADATA: ListenerMetadata = {
    id: 'annotations_on_failure_reported',
    logical_component: 'annotations',
    description: 'Tells the person, in a notice, that deleting or exporting annotations, emptying or saving their geometry, keeping the view of the model they drew it in, or drawing the document they are made on, failed.',
    arguments: [{
      listen: Object.keys(FAILURES),
      valued: false,
      description: 'A failure of an action of the person on the annotations.',
      type: 'str',
    }],
  };

  constructor(private readonly event: AppEvent<{ message?: string }>) {}

  /** Shows the reason of the failure the event reports. */
  run(): void {
    const key = FAILURES[this.event.type];
    if (!key) return;
    notify(translate(key, { message: this.event.payload?.message ?? '' }), 'error');
  }
}
