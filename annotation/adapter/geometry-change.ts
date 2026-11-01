import { contentOf } from '@/addon/annotation/adapter/annotation-format';
import type { SavedGeometry } from '@/addon/annotation/domain/model/geometry-tool';
import { failureMessage, requestCommand } from '@/ontobdc/shared/adapter/command-request';
import { eventBus } from '@/ontobdc/shared/adapter/event-bus';

/**
 * Runs a command that changes the geometries of an annotation and tells how it went: `presentation.annotations.geometry.saved`
 * with all the geometries the annotation has now, and the entity is asked to be read again; or
 * `presentation.annotations.geometry.save.failed` with why not.
 */
export async function changeGeometries(id: string, command: string, source: string): Promise<void> {
  try {
    const result = await requestCommand(command, source);
    const answer = contentOf(result.stdout);
    const geometries = answer?.geometries;
    const operation = answer?.operation;
    if (!Array.isArray(geometries) || (operation !== 'shape' && operation !== 'move' && operation !== 'delete' && operation !== 'style' && operation !== 'restore')) {
      throw new Error('The answer of the command tells no geometries.');
    }
    eventBus.publish('presentation.annotations.geometry.saved', source, { id, operation, geometries: geometries as SavedGeometry[] });
  } catch (error) {
    eventBus.publish('presentation.annotations.geometry.save.failed', source, { id, message: failureMessage(error) });
    return;
  }
  eventBus.publish('presentation.entity.refresh.requested', source, { id });
}
