import type { EntityTreeNode } from '@/ontobdc/shared/domain/model/entity';

/** What the tree view needs from its owner; the owner keeps the state, so it survives a new render. */
export type TreeViewOptions = {
  /** The branches that are open, by the key of their place in the tree (`placeKey`). */
  expanded: Set<string>;
  /** The place of the node selected, if any. */
  selected: string | null;
  /** The order of every level by name; the order the nodes came in when absent. */
  order?: 'asc' | 'desc';
  locale: string;
  onSelect: (place: string) => void;
  onToggle: (place: string, open: boolean) => void;
  onOpen: (node: EntityTreeNode) => void;
};

/** The identity of an entity: its resource when it has one, else the dataset that keeps it and its global id. */
export const nodeKey = (node: EntityTreeNode): string => node.iri ?? `${node.dataset}\u0000${node.id}`;

/** The place of a node: the keys of the nodes above it and its own, so one entity under two parents is two places. */
export const placeKey = (above: readonly string[], node: EntityTreeNode): string => [...above, nodeKey(node)].join('\u0001');

const titleOf = (node: EntityTreeNode): string => node.name || node.id;

/**
 * Draws nodes and what is below them, however deep, as the trees of the application are drawn.
 * It knows nothing of what the nodes are: the hierarchy is the one it is given. A click on a node
 * selects it and opens or closes its branch; a double click, or Enter, opens the entity and leaves
 * the branch as it was; the arrows of the keyboard open and close the branch. A node that already
 * is among the ones above it is not drawn again, so a hierarchy that closes a loop ends.
 */
export function renderTreeView(nodes: readonly EntityTreeNode[], options: TreeViewOptions): HTMLUListElement {
  const sorted = (level: readonly EntityTreeNode[]): EntityTreeNode[] => {
    if (!options.order) return [...level];
    const sign = options.order === 'asc' ? 1 : -1;
    return [...level].sort((a, b) => sign * titleOf(a).localeCompare(titleOf(b), options.locale, { numeric: true, sensitivity: 'base' }));
  };

  const renderLevel = (level: readonly EntityTreeNode[], depth: number, above: readonly string[]): HTMLUListElement => {
    const list = document.createElement('ul');
    list.className = depth === 0 ? 'tree' : 'tree tree-children';
    list.setAttribute('role', depth === 0 ? 'tree' : 'group');

    for (const node of sorted(level)) {
      const place = placeKey(above, node);
      const path = [...above, nodeKey(node)];
      // What closes a loop is not drawn: a branch is only what still has something below it.
      const children = node.children.filter((child) => !path.includes(nodeKey(child)));
      const branch = children.length > 0;

      const item = document.createElement('li');
      item.className = branch ? 'tree-node dir' : 'tree-node file';
      item.dataset.place = place;
      item.dataset.id = node.id;
      item.setAttribute('role', 'treeitem');
      if (options.selected === place) item.classList.add('selected');

      const row = document.createElement('div');
      row.className = 'tree-row';
      row.style.setProperty('--depth', String(depth));

      const button = document.createElement('button');
      button.type = 'button';
      button.className = branch ? 'tree-item dir' : 'tree-item';
      button.textContent = titleOf(node);
      button.title = titleOf(node);

      const below = branch ? renderLevel(children, depth + 1, path) : null;
      const setOpen = (open: boolean): void => {
        if (!below) return;
        below.hidden = !open;
        item.setAttribute('aria-expanded', String(open));
        options.onToggle(place, open);
      };
      if (below) {
        const open = options.expanded.has(place);
        below.hidden = !open;
        item.setAttribute('aria-expanded', String(open));
      }

      button.addEventListener('click', () => {
        root.querySelectorAll('.tree-node.selected').forEach((other) => other.classList.remove('selected'));
        item.classList.add('selected');
        options.onSelect(place);
        if (below) setOpen(below.hidden);
      });
      button.addEventListener('dblclick', () => options.onOpen(node));
      button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') options.onOpen(node);
        else if (event.key === 'ArrowRight' && below?.hidden) setOpen(true);
        else if (event.key === 'ArrowLeft' && below && !below.hidden) setOpen(false);
        else return;
        event.preventDefault();
      });

      row.append(button);
      item.append(row);
      if (below) item.append(below);
      list.append(item);
    }
    return list;
  };

  const root = renderLevel(nodes, 0, []);
  return root;
}
