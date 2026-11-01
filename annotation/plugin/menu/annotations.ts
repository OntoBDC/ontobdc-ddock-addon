import type { MenuEntry } from '@/ontobdc/shared/adapter/menu';
import '@/addon/annotation/plugin/asset/annotations.css';
import makeAnnotations from '@/addon/annotation/plugin/panel/annotations';

const annotationsMenu: MenuEntry = {
  id: 'annotations',
  icon: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6l-4 4v-4H6a2 2 0 0 1-2-2Z"/>
      <path d="M8 8h8M8 12h5"/>
    </svg>
  `,
  label: 'nav.annotations',
  header: 'pane.annotations.header',
  panel: makeAnnotations,
};

export default annotationsMenu;
