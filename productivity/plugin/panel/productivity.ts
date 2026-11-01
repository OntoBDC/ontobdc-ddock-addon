import { NEW_ICON } from '@/ontobdc/shared/adapter/menu-icons';
import { GOAL_ENTITY_TYPE, GOAL_TREE_COMMAND, MILESTONE_LIST_COMMAND, TASK_LIST_COMMAND, MILESTONE_ENTITY_TYPE, TASK_ENTITY_TYPE } from '@/addon/productivity/adapter/productivity-format';
import { renderTreeView } from '@/addon/productivity/plugin/panel/tree-view';
import { withEntitiesRead } from '@/ontobdc/shared/adapter/entity-groups';
import { createHistoryView } from '@/ontobdc/shared/adapter/history-view';
import { listSkeleton, watchCommand } from '@/ontobdc/shared/adapter/command-pending';
import { CONTAINER_ENTITY_COMMAND } from '@/ontobdc/shared/domain/model/container-command';
import { eventBus } from '@/ontobdc/shared/adapter/event-bus';
import { createMoreMenu } from '@/ontobdc/shared/adapter/more-menu';
import { ContainerRepository } from '@/ontobdc/shared/adapter/container-repository';
import type { Mountable } from '@/ontobdc/shared/adapter/view';
import { DAY_ENTITY_TYPE, todayAsDate } from '@/ontobdc/shared/domain/model/history';
import type { EntityGroup, EntityItem, EntityTreeNode } from '@/ontobdc/shared/domain/model/entity';
import { applyTranslations, getLocale, onLocaleChange, translate, type MessageKey } from '@/ontobdc/shared/plugin/i18n';

const SOURCE = 'productivity';

type Group = {
  id: string;
  label: MessageKey;
  /** The entity type the dataset that holds the group declares. */
  entityType: string;
  /** Whether the group can tell a completed item; only a task has a completion. */
  completable: boolean;
  /** Whether the group is a tree: its items are the entities of the type and what the facades say is below them. */
  tree: boolean;
};

/** The groups of the panel, in the order they are shown. */
const GROUPS: readonly Group[] = [
  { id: 'tasks', label: 'productivity.group.tasks', entityType: TASK_ENTITY_TYPE, completable: true, tree: false },
  { id: 'goals', label: 'productivity.group.goals', entityType: GOAL_ENTITY_TYPE, completable: false, tree: true },
  { id: 'milestones', label: 'productivity.group.milestones', entityType: MILESTONE_ENTITY_TYPE, completable: false, tree: false },
];

/** The group of the history, after the groups of entities. */
const HISTORY_GROUP = 'history';

const COMPLETION_FIELD = 'completion_percent';

const titleOf = (item: EntityItem): string => item.name || item.id;

/** A task is completed when its completion percentage is 100 or more. */
const isCompleted = (item: EntityItem): boolean => {
  const value = item.fields.find((field) => field.name === COMPLETION_FIELD)?.values[0];
  return value !== undefined && Number(value) >= 100;
};

/**
 * The Productivity panel. Its groups are tasks, goals and milestones, each an
 * accordion section; only one is open at a time. What a group lists is the
 * entities of the dataset of the container that holds its entity type, as
 * `presentation.container.entities.found` gives the datasets; a group that is a
 * tree (the goals) shows instead the entities of the type with what the facades
 * say is below them, as `presentation.productivity.tree.found` gives it. Under a group, a
 * check at the left of the sort (tasks only) hides the completed ones while it
 * is green and shows them again when grey; the sort orders by title; a double
 * click on an item publishes `presentation.database.item.opened`; and the ⋯ of
 * a group creates an item, through the generic flow of the database
 * (`presentation.entity.new.requested`, for the type of the group: the dataset is made when the container has none).
 * The panel starts disabled and is enabled when a container opens. It only shows
 * and reports; what those events mean is up to the listeners.
 */
export default function makeProductivity(): Mountable {
  const root = document.createElement('div');
  root.className = 'panel-content tree-panel productivity-panel';

  let activated = false;
  const setInactive = (inactive: boolean): void => {
    root.classList.toggle('inactive', inactive);
    root.setAttribute('aria-disabled', inactive ? 'true' : 'false');
    root.inert = inactive;
  };
  const activate = (): void => {
    if (activated) return;
    activated = true;
    setInactive(false);
  };
  setInactive(true);

  /** The datasets of the container, as the last `presentation.container.entities.found` gave them. */
  /** Whether the container has answered: until then there is nothing to group, and the panel says so. */
  let loaded = false;
  let datasets: EntityGroup[] = [];
  let openGroup: string = GROUPS[0].id;
  const sortOrder = new Map<string, 'asc' | 'desc'>();
  /** The tree of each group that is one, by entity type, as the last `presentation.productivity.tree.found` gave it. */
  const trees = new Map<string, EntityTreeNode[]>();
  /** The branches that are open and the place selected, kept across renders: the tree is drawn again whenever its data or the locale change. */
  const expanded = new Set<string>();
  let selectedPlace: string | null = null;
  /** The groups that hide their completed items (the check is green). */
  const hideCompleted = new Set<string>();
  /** The commands that are running: the datasets, and the listing of each group. A group waits for its own and for the datasets. */
  const pending = { datasets: false, tasks: false, goals: false, milestones: false };
  const waiting = (group: Group): boolean => pending.datasets || pending[group.id as 'tasks' | 'goals' | 'milestones'];
  const historyView = createHistoryView(SOURCE);
  const moreMenu = createMoreMenu();
  let selected: HTMLLIElement | null = null;

  const writable = (): boolean => ContainerRepository.getInstance().get()?.access === 'readwrite';
  const datasetOf = (group: Group): EntityGroup | undefined => datasets.find((dataset) => dataset.entityTypes.includes(group.entityType));

  /** The items the group shows: all of them, or only the not completed while its check is green; sorted when asked. */
  const shownItems = (group: Group): EntityItem[] => {
    const items = datasetOf(group)?.items ?? [];
    const shown = hideCompleted.has(group.id) ? items.filter((item) => !isCompleted(item)) : items;
    const order = sortOrder.get(group.id);
    if (!order) return shown;
    const sign = order === 'asc' ? 1 : -1;
    return [...shown].sort((a, b) => sign * titleOf(a).localeCompare(titleOf(b), getLocale(), { numeric: true, sensitivity: 'base' }));
  };

  const renderItem = (dataset: string, item: EntityItem): HTMLLIElement => {
    const li = document.createElement('li');
    li.className = 'tree-node file';
    li.dataset.id = item.id;
    li.setAttribute('role', 'treeitem');

    const row = document.createElement('div');
    row.className = 'tree-row';
    row.style.setProperty('--depth', '0');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tree-item';
    button.textContent = titleOf(item);
    button.title = titleOf(item);
    button.addEventListener('click', () => {
      selected?.classList.remove('selected');
      selected = li;
      li.classList.add('selected');
    });
    button.addEventListener('dblclick', () => {
      eventBus.publish('presentation.database.item.opened', SOURCE, { group: dataset, id: item.id });
    });
    row.append(button);
    li.append(row);
    return li;
  };

  /** The history, under the groups of entities: the calendars of the days, and ⋯ to create a day. */
  const historySection = (): HTMLElement => {
    const name = translate('productivity.group.history');
    const section = document.createElement('details');
    section.open = HISTORY_GROUP === openGroup;
    section.dataset.group = HISTORY_GROUP;

    const summary = document.createElement('summary');
    const label = document.createElement('span');
    label.className = 'tree-group-label';
    label.textContent = name;
    summary.appendChild(label);

    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'tree-group-more productivity-group-more';
    more.dataset.group = HISTORY_GROUP;
    more.setAttribute('aria-label', translate('productivity.group.actions', { group: name }));
    more.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (moreMenu.isOpen()) { moreMenu.close(); return; }
      moreMenu.show(more, [
        {
          id: 'new',
          label: translate('database.menu.new'),
          icon: NEW_ICON,
          disabledReason: writable() ? undefined : translate('container.readOnly'),
          run: () => eventBus.publish('presentation.entity.new.requested', SOURCE, { entityType: DAY_ENTITY_TYPE, values: { date: todayAsDate() } }),
        },
      ]);
    });
    summary.appendChild(more);
    section.appendChild(summary);

    summary.addEventListener('click', (event) => {
      event.preventDefault();
      if (section.open) return;
      for (const sibling of root.querySelectorAll<HTMLDetailsElement>(':scope > details')) sibling.open = false;
      section.open = true;
      openGroup = HISTORY_GROUP;
    });

    const body = document.createElement('div');
    body.className = 'tree-group-body productivity-group-body';
    body.appendChild(historyView.element);
    section.appendChild(body);
    return section;
  };

  const render = (): void => {
    moreMenu.close();
    selected = null;
    if (!loaded && (pending.datasets || pending.tasks || pending.goals || pending.milestones)) {
      root.replaceChildren(listSkeleton(6));
      return;
    }
    if (!loaded) {
      const empty = document.createElement('p');
      empty.className = 'tree-empty';
      empty.dataset.i18n = 'productivity.empty';
      empty.textContent = translate('productivity.empty');
      root.replaceChildren(empty);
      return;
    }
    const sections = GROUPS.map((group) => {
      const dataset = datasetOf(group);
      const shown = shownItems(group);
      const tree = group.tree ? trees.get(group.entityType) : undefined;
      const name = translate(group.label);

      const section = document.createElement('details');
      section.open = group.id === openGroup;
      section.dataset.group = group.id;
      section.dataset.loading = String(waiting(group));

      const summary = document.createElement('summary');
      const label = document.createElement('span');
      label.className = 'tree-group-label';
      label.textContent = `${name} (${tree ? tree.length : shown.length})`;
      summary.appendChild(label);

      // The check at the left of the sort: green hides the completed items, grey shows them again.
      if (group.completable) {
        const hiding = hideCompleted.has(group.id);
        const filter = document.createElement('button');
        filter.type = 'button';
        filter.className = 'productivity-filter';
        filter.dataset.active = String(hiding);
        filter.setAttribute('aria-pressed', String(hiding));
        filter.title = translate(hiding ? 'productivity.filter.showCompleted' : 'productivity.filter.hideCompleted');
        filter.setAttribute('aria-label', filter.title);
        filter.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.5"/></svg>';
        filter.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (hiding) hideCompleted.delete(group.id);
          else hideCompleted.add(group.id);
          render();
        });
        summary.appendChild(filter);
      }

      // Sorts the group's items by title: A to Z, then Z to A, and so on.
      const order = sortOrder.get(group.id);
      const sort = document.createElement('button');
      sort.type = 'button';
      sort.className = 'group-sort';
      sort.dataset.order = order ?? 'none';
      sort.textContent = order === 'asc' ? 'A→Z' : order === 'desc' ? 'Z→A' : 'A↕Z';
      sort.title = translate(order === 'asc' ? 'group.sort.desc' : 'group.sort.asc');
      sort.setAttribute('aria-label', sort.title);
      sort.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        sortOrder.set(group.id, order === 'asc' ? 'desc' : 'asc');
        render();
      });
      summary.appendChild(sort);

      // The menu of the group: New, an entity of the dataset that holds them, by the generic flow of the database.
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'tree-group-more productivity-group-more';
      more.dataset.group = group.id;
      more.setAttribute('aria-label', translate('productivity.group.actions', { group: name }));
      more.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (moreMenu.isOpen()) { moreMenu.close(); return; }
        const blocker = !writable() ? translate('container.readOnly') : undefined;
        moreMenu.show(more, [
          {
            id: 'new',
            label: translate('database.menu.new'),
            icon: NEW_ICON,
            disabledReason: blocker,
            run: () => {
              eventBus.publish('presentation.entity.new.requested', SOURCE, { entityType: group.entityType });
            },
          },
        ]);
      });
      summary.appendChild(more);
      section.appendChild(summary);

      summary.addEventListener('click', (event) => {
        event.preventDefault();
        if (section.open) return;
        for (const sibling of root.querySelectorAll<HTMLDetailsElement>(':scope > details')) sibling.open = false;
        section.open = true;
        openGroup = group.id;
      });

      const body = document.createElement('div');
      body.className = 'tree-group-body productivity-group-body';
      if (tree) {
        // A tree: the entities of the type and what the facades say is below them, in whichever datasets they are.
        body.appendChild(renderTreeView(tree, {
          expanded,
          selected: selectedPlace,
          order: sortOrder.get(group.id),
          locale: getLocale(),
          onSelect: (place) => { selectedPlace = place; },
          onToggle: (place, open) => { if (open) expanded.add(place); else expanded.delete(place); },
          onOpen: (node) => eventBus.publish('presentation.database.item.opened', SOURCE, { group: node.dataset, id: node.id }),
        }));
      } else if (dataset && shown.length > 0) {
        const list = document.createElement('ul');
        list.className = 'tree productivity-list';
        list.setAttribute('role', 'tree');
        list.append(...shown.map((item) => renderItem(dataset.id, item)));
        body.appendChild(list);
      }
      if (waiting(group) && body.childElementCount === 0) body.appendChild(listSkeleton(3));
      section.appendChild(body);
      return section;
    });
    root.replaceChildren(...sections, historySection());
    applyTranslations(root);
  };
  render();

  const unsubscribers = [
    watchCommand((command) => command === CONTAINER_ENTITY_COMMAND, (value) => { pending.datasets = value; render(); }),
    watchCommand((command) => command === TASK_LIST_COMMAND, (value) => { pending.tasks = value; render(); }),
    watchCommand((command) => command === GOAL_TREE_COMMAND, (value) => { pending.goals = value; render(); }),
    watchCommand((command) => command === MILESTONE_LIST_COMMAND, (value) => { pending.milestones = value; render(); }),
    eventBus.subscribe('presentation.container.local.opened', activate),
    eventBus.subscribe('presentation.container.remote.opened', activate),
    eventBus.subscribe('presentation.container.state.reported', ({ payload }) => {
      if (payload?.container) activate();
    }),
    eventBus.subscribe('presentation.container.entities.found', ({ payload }) => {
      datasets = Array.isArray(payload?.groups) ? payload.groups : [];
      loaded = true;
      render();
    }),
    // One entity was read again: it takes the place of the one its dataset had.
    eventBus.subscribe('presentation.container.entity.found', ({ payload }) => {
      datasets = withEntitiesRead(datasets, Array.isArray(payload?.groups) ? payload.groups : []);
      render();
    }),
    eventBus.subscribe('presentation.productivity.tree.found', ({ payload }) => {
      if (!payload || !Array.isArray(payload.nodes)) return;
      trees.set(payload.entity, payload.nodes);
      loaded = true;
      render();
    }),
    onLocaleChange(render),
  ];

  // A container may already be open by the time the panel mounts; ask for the
  // current state so the panel does not stay locked forever.
  eventBus.publish('presentation.container.state.requested', SOURCE);

  return {
    element: root,
    dispose: () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      historyView.dispose();
      moreMenu.close();
      root.remove();
    },
  };
}
