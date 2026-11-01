import type { MenuEntry } from '@/ontobdc/shared/adapter/menu';
import '@/addon/productivity/plugin/asset/productivity.css';
import makeProductivity from '@/addon/productivity/plugin/panel/productivity';

const productivityMenu: MenuEntry = {
  id: 'productivity',
  icon: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M11 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4.5"/>
      <path d="M3 9h16M7 2v4M15 2v4M9 6.5h4"/>
      <path d="M6 12.5h2M10 12.5h2M6 16h2M10 16h1"/>
      <circle cx="17" cy="17" r="5"/>
      <path d="M17 14.5V17l1.8 1.8"/>
    </svg>
  `,
  label: 'nav.productivity',
  header: 'pane.productivity.header',
  panel: makeProductivity,
};

export default productivityMenu;
