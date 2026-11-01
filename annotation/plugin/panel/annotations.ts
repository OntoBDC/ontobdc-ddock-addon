import { ANNOTATION_ENTITY_TYPE, annotationDataset } from '@/addon/annotation/adapter/annotation-dataset';
import { groupLabel, isClosed } from '@/addon/annotation/adapter/annotation-format';
import { activeEntityId } from '@/ontobdc/shared/adapter/active-panel';
import { eventBus } from '@/ontobdc/shared/adapter/event-bus';
import { documentImageRenderer } from '@/ontobdc/shared/adapter/document-image';
import { DELETE_ICON, DRAW_ICON, EXPORT_ICON, NEW_ICON, OPEN_ICON } from '@/ontobdc/shared/adapter/menu-icons';
import { createMoreMenu } from '@/ontobdc/shared/adapter/more-menu';
import { ContainerRepository } from '@/ontobdc/shared/adapter/container-repository';
import type { Mountable } from '@/ontobdc/shared/adapter/view';
import type { AnnotationGroup, AnnotationItem } from '@/addon/annotation/domain/model/annotation';
import { applyTranslations, getLocale, onLocaleChange, translate } from '@/ontobdc/shared/plugin/i18n';

const SOURCE = 'annotations';

/** Excel, in outline: a sheet with its X. */
const EXCEL_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5"/></svg>';

/**
 * The Annotations panel. Its groups are not fixed: they are the annotation
 * types the Brasidatacenter ontology declares, as `ontobdc annotate --list`
 * answers them, and arrive in `presentation.container.annotations.found`, which
 * replaces them all. Each group is an accordion section and only one is open at
 * a time; the open one stays open when the groups are replaced. Under a group,
 * a check at the left of the sort hides the annotations that are closed (those
 * with a `completed_at`) while it is green and shows them again when grey; each
 * annotation shows its title, with a files icon when it refers to files; a
 * double click or the menu's Open publishes `presentation.annotations.item.opened`,
 * and the menu's Delete `presentation.annotations.item.delete.requested`. The ⋯
 * of a group creates an annotation, through the generic flow of the entities
 * (`presentation.entity.new.requested`, for the type of the annotations, with the type of the group already chosen), or exports the group: `presentation.annotations.group.export.requested`. The
 * panel starts disabled and is enabled when a container opens. It only shows and
 * reports; what those events mean is up to the listeners.
 */
export default function makeAnnotations(): Mountable {
  const root = document.createElement('div');
  root.className = 'panel-content tree-panel annotations-panel';

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

  let groups: AnnotationGroup[] = [];
  let openGroup: string | null = null;
  let failure: string | null = null;
  /** The alphabetical order each group is sorted in, by group id; a group not in it keeps the order the CLI gave. */
  const sortOrder = new Map<string, 'asc' | 'desc'>();
  /** The groups that hide their closed annotations (the check is green), by group id; a group not in it shows them all. */
  const hideClosed = new Set<string>();
  /** The groups being exported now, by annotation type. */
  const exporting = new Set<string>();
  const moreMenu = createMoreMenu();
  let selected: HTMLLIElement | null = null;
  /** The global id of the entity the active tab of the surface shows, null when it shows none. */
  let shown: string | null = activeEntityId();

  /** Whether the open container can be written to; deleting and exporting need it. */
  const writable = (): boolean => ContainerRepository.getInstance().get()?.access === 'readwrite';

  const emptyMessage = (): HTMLParagraphElement => {
    const empty = document.createElement('p');
    empty.className = 'tree-empty';
    empty.dataset.i18n = 'annotations.empty';
    empty.textContent = translate('annotations.empty');
    return empty;
  };

  /**
   * Marks, in the list, the annotation the active tab shows. With `reveal`, the group that lists it is the one open,
   * so that it is seen.
   */
  const markShown = (reveal: boolean): void => {
    root.querySelectorAll('.tree-node.tab-active').forEach((row) => row.classList.remove('tab-active'));
    const row = shown === null ? undefined : [...root.querySelectorAll<HTMLElement>('.tree-node.annotation')].find((candidate) => candidate.dataset.id === shown);
    if (!row) return;
    row.classList.add('tab-active');
    const section = row.closest<HTMLDetailsElement>('details');
    if (!reveal || !section || section.open) return;
    for (const sibling of root.querySelectorAll<HTMLDetailsElement>(':scope > details')) sibling.open = false;
    section.open = true;
    openGroup = section.dataset.group ?? openGroup;
  };

  const select = (item: HTMLLIElement): void => {
    selected?.classList.remove('selected');
    selected = item;
    item.classList.add('selected');
  };

  const open = (group: AnnotationGroup, annotation: AnnotationItem): void => {
    eventBus.publish('presentation.annotations.item.opened', SOURCE, { group: group.id, id: annotation.id, title: annotation.title });
  };

  const renderAnnotation = (group: AnnotationGroup, annotation: AnnotationItem): HTMLLIElement => {
    const hasRelated = annotation.related.length > 0;
    const li = document.createElement('li');
    li.className = 'tree-node file annotation';
    li.dataset.id = annotation.id;
    li.setAttribute('role', 'treeitem');

    const row = document.createElement('div');
    row.className = 'tree-row';
    row.style.setProperty('--depth', '0');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tree-item';
    button.textContent = annotation.title;
    button.title = hasRelated
      ? `${annotation.title} — ${translate('annotations.hasFiles', { count: String(annotation.related.length) })}`
      : annotation.title;
    if (hasRelated) {
      // In the place of a chevron: the annotation refers to files, which are not listed here.
      const icon = document.createElement('span');
      icon.className = 'annotation-files-icon';
      icon.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 2.5h5L13 5v6.5H5.5z"/><path d="M10.5 2.5V5H13"/><path d="M3 5v8.5h7.5"/></svg>';
      button.append(icon);
    }

    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'tree-more';
    more.dataset.item = annotation.id;
    more.setAttribute('aria-label', translate('annotations.moreActions', { item: annotation.title }));
    more.textContent = '⋯';

    button.addEventListener('click', () => {
      select(li);
      moreMenu.close();
    });
    button.addEventListener('dblclick', () => {
      select(li);
      open(group, annotation);
    });
    more.addEventListener('click', (event) => {
      event.stopPropagation();
      select(li);
      if (moreMenu.isOpen()) { moreMenu.close(); return; }
      moreMenu.show(more, [
        { id: 'open', label: translate('annotations.menu.open'), icon: OPEN_ICON, run: () => open(group, annotation) },
        ...(annotation.sourceDocument && documentImageRenderer(annotation.sourceDocument)
          ? [{
              id: 'draw',
              label: translate('annotations.menu.draw'),
              icon: DRAW_ICON,
              ...(writable() ? {} : { disabledReason: translate('container.readOnly') }),
              run: () => eventBus.publish('presentation.annotations.geometry.draw.requested', SOURCE, {
                id: annotation.id,
                title: annotation.title,
                document: annotation.sourceDocument,
              }),
            }]
          : []),
        {
          id: 'delete',
          label: translate('entity.action.delete'),
          icon: DELETE_ICON,
          ...(writable() ? {} : { disabledReason: translate('container.readOnly') }),
          run: () => eventBus.publish('presentation.annotations.item.delete.requested', SOURCE, { id: annotation.id, title: annotation.title }),
        },
      ]);
    });

    row.append(button, more);
    li.append(row);
    return li;
  };

  /** The global ids of the annotations the group shows, which are the ones that can be exported. */
  const visibleIds = (group: AnnotationGroup): string[] => sortedItems(group).map((annotation) => annotation.id);

  /** The annotations the group shows: all of them, or only the open ones while its check is green; sorted when asked. */
  const sortedItems = (group: AnnotationGroup): AnnotationItem[] => {
    const shown = hideClosed.has(group.id) ? group.items.filter((annotation) => !isClosed(annotation)) : group.items;
    const order = sortOrder.get(group.id);
    if (!order) return shown;
    const sign = order === 'asc' ? 1 : -1;
    return [...shown].sort((a, b) => sign * a.title.localeCompare(b.title, getLocale(), { numeric: true, sensitivity: 'base' }));
  };

  /** Only the busy mark of the group's ⋯ button changes: the tree stays as it is. */
  const markExporting = (group: string, busy: boolean): void => {
    if (busy) exporting.add(group);
    else exporting.delete(group);
    root.querySelectorAll<HTMLElement>(`.annotations-group-more[data-group="${CSS.escape(group)}"]`).forEach((button) => {
      button.dataset.busy = String(busy);
    });
  };

  const render = (): void => {
    moreMenu.close();
    selected = null;
    const sections: HTMLElement[] = [];
    if (failure !== null) {
      const error = document.createElement('p');
      error.className = 'tree-empty annotations-failure';
      error.dataset.i18n = 'annotations.failed';
      error.textContent = translate('annotations.failed');
      error.title = failure;
      sections.push(error);
    }
    if (groups.length === 0 && failure === null) sections.push(emptyMessage());
    if (openGroup === null || !groups.some((group) => group.id === openGroup)) openGroup = groups[0]?.id ?? null;

    for (const group of groups) {
      const section = document.createElement('details');
      section.open = group.id === openGroup;
      section.dataset.group = group.id;
      const summary = document.createElement('summary');
      const shown = sortedItems(group);
      const name = groupLabel(group, getLocale());
      // The title of the group, with how many annotations it lists (the closed ones are not counted while they are hidden).
      const label = document.createElement('span');
      label.className = 'tree-group-label';
      label.textContent = `${name} (${shown.length})`;
      summary.appendChild(label);

      // The check at the left of the sort: green hides the annotations that are closed, grey shows them again.
      const hiding = hideClosed.has(group.id);
      const filter = document.createElement('button');
      filter.type = 'button';
      filter.className = 'annotations-filter';
      filter.dataset.active = String(hiding);
      filter.setAttribute('aria-pressed', String(hiding));
      filter.title = translate(hiding ? 'annotations.filter.showClosed' : 'annotations.filter.hideClosed');
      filter.setAttribute('aria-label', filter.title);
      filter.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.5"/></svg>';
      filter.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (hiding) hideClosed.delete(group.id);
        else hideClosed.add(group.id);
        render();
      });
      summary.appendChild(filter);

      // Sorts the group's annotations by title: A to Z, then Z to A, and so on.
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

      // The menu of the group: Export, which expands to the formats.
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'tree-group-more annotations-group-more';
      more.dataset.group = group.id;
      more.dataset.busy = String(exporting.has(group.id));
      more.setAttribute('aria-label', translate('annotations.group.actions', { group: name }));
      more.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (moreMenu.isOpen()) { moreMenu.close(); return; }
        const blocker = !writable()
          ? translate('container.readOnly')
          : exporting.has(group.id)
            ? translate('annotations.export.exporting')
            : visibleIds(group).length === 0 ? translate('annotations.export.empty') : undefined;
        // A new annotation is a new entity of the type: the generic flow of the entities.
        const newBlocker = !writable() ? translate('container.readOnly') : undefined;
        moreMenu.show(more, [
          {
            id: 'new',
            label: translate('database.menu.new'),
            icon: NEW_ICON,
            disabledReason: newBlocker,
            run: () => {
              eventBus.publish('presentation.entity.new.requested', SOURCE, { entityType: ANNOTATION_ENTITY_TYPE, values: { annotation_type: group.id } });
            },
          },
          {
            id: 'export',
            label: translate('annotations.export'),
            icon: EXPORT_ICON,
            disabledReason: blocker,
            run: () => undefined,
            children: [
              {
                id: 'excel',
                label: translate('annotations.export.excel'),
                icon: EXCEL_ICON,
                // Only what the group shows is exported: the ones its check hides are left out.
                run: () => eventBus.publish('presentation.annotations.group.export.requested', SOURCE, { group: group.id, format: 'excel', ids: visibleIds(group) }),
              },
            ],
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
      body.className = 'tree-group-body annotations-group-body';
      if (group.items.length === 0) {
        body.appendChild(emptyMessage());
      } else if (shown.length === 0) {
        const closed = document.createElement('p');
        closed.className = 'tree-empty';
        closed.dataset.i18n = 'annotations.filter.allClosed';
        closed.textContent = translate('annotations.filter.allClosed');
        body.appendChild(closed);
      } else {
        const list = document.createElement('ul');
        list.className = 'tree annotations-list';
        list.setAttribute('role', 'tree');
        list.append(...shown.map((annotation) => renderAnnotation(group, annotation)));
        body.appendChild(list);
      }
      section.appendChild(body);
      sections.push(section);
    }
    root.replaceChildren(...sections);
    applyTranslations(root);
    // The list was drawn again: what the active tab shows is marked in it again.
    markShown(false);
  };

  render();

  const unsubscribers = [
    eventBus.subscribe('presentation.container.local.opened', activate),
    eventBus.subscribe('presentation.container.remote.opened', activate),
    eventBus.subscribe('presentation.container.state.reported', ({ payload }) => {
      if (payload?.container) activate();
    }),
    eventBus.subscribe('presentation.container.annotations.found', ({ payload }) => {
      groups = Array.isArray(payload?.groups) ? payload.groups : [];
      failure = null;
      render();
    }),
    eventBus.subscribe('presentation.container.annotations.failed', ({ payload }) => {
      failure = payload?.message ?? '';
      render();
    }),
    eventBus.subscribe('presentation.annotations.group.export.started', ({ payload }) => {
      if (payload?.group) markExporting(payload.group, true);
    }),
    eventBus.subscribe('presentation.annotations.group.export.finished', ({ payload }) => {
      if (payload?.group) markExporting(payload.group, false);
    }),
    eventBus.subscribe('presentation.annotations.group.export.failed', ({ payload }) => {
      if (payload?.group) markExporting(payload.group, false);
    }),
    // The annotation the tab that becomes active shows is marked in the list, so that it is there when the person comes back to it.
    eventBus.subscribe('presentation.main.panel.activated', ({ payload }) => {
      if (payload?.container !== 'surface') return;
      shown = payload.kind === 'entity' ? payload.entityId ?? null : null;
      markShown(true);
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
      moreMenu.close();
      root.remove();
    },
  };
}
