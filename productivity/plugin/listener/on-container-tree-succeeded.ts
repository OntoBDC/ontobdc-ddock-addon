import { TREE_COMMAND_ENTITIES } from '@/addon/productivity/adapter/productivity-format';
import { eventBus, type AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import { entityTreeOf } from '@/ontobdc/shared/adapter/container-format';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';

const EVENT = 'presentation.main.code.success';
const SOURCE = 'productivity_on_container_tree_succeeded';
type Payload = AppEventMap[typeof EVENT];

export class OnContainerTreeSucceeded {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'productivity',
    description: 'Fills the tree of the Productivity panel when `ontobdc container --entity <type> --tree` worked.',
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

  /** Publishes the tree the command answered, or says it could not read it. */
  run(): void {
    const entity = this.payload ? TREE_COMMAND_ENTITIES[this.payload.result.stdin] : undefined;
    if (!this.payload || !entity) return;

    const nodes = entityTreeOf(this.payload.result.stdout);
    if (nodes) eventBus.publish('presentation.productivity.tree.found', SOURCE, { entity, nodes });
    else eventBus.publish('presentation.productivity.tree.failed', SOURCE, { entity, message: 'The tree command did not answer with nodes.' });
  }
}
