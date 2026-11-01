import { GOAL_TREE_COMMAND, MILESTONE_LIST_COMMAND, TASK_LIST_COMMAND } from '@/addon/productivity/adapter/productivity-format';
import { eventBus } from '@/ontobdc/shared/adapter/event-bus';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';

const SOURCE = 'productivity_on_container_refresh_completed';

export class OnContainerRefreshCompletedProductivity {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'productivity',
    description: 'Asks for the tasks, the tree of goals and the milestones of the container once it was refreshed, and again whenever an entity changed.',
    arguments: [
      {
        listen: [
          'presentation.container.refresh.completed',
          'presentation.entity.created',
          'presentation.entity.saved',
          'presentation.entity.deleted',
        ],
        valued: false,
        description: 'The container was refreshed, or an entity was created, saved or deleted.',
        type: 'str',
      },
    ],
  };

  /** Requests the listings; the terminal shows them and the run listener executes them. */
  run(): void {
    for (const command of [TASK_LIST_COMMAND, GOAL_TREE_COMMAND, MILESTONE_LIST_COMMAND]) {
      eventBus.publish('presentation.main.command.requested', SOURCE, {
        requestId: crypto.randomUUID(),
        command,
      });
    }
  }
}
