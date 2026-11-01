import type { EntityTreeNode } from '@/ontobdc/shared/domain/model/entity';

/**
 * The events of the Productivity addon and the data each one carries. The addon
 * adds them to the event map of the application (`AppEventMap`) from here, so the
 * core does not know the addon: it only needs this file to be part of the build.
 */
export type ProductivityEvents = {
  /** `ontobdc container --entity <type> --tree` answered: the entities of the type, each with the entities below it; replaces the tree of the type. */
  'presentation.productivity.tree.found': { entity: string; nodes: EntityTreeNode[] };
  /** The tree of the type could not be read; the Productivity panel keeps what it showed. */
  'presentation.productivity.tree.failed': { entity: string; message: string };
};

declare module '@/ontobdc/shared/domain/model/event' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AppEventMap extends ProductivityEvents {}
}
