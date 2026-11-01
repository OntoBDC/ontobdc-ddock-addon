import type { en } from './en';

export default {
  'nav.productivity': 'Productividad',
  'pane.productivity.header': 'PRODUCTIVIDAD',
  'productivity.empty': 'Ninguna tarea, objetivo o hito todavía',
  'productivity.group.tasks': 'Tareas',
  'productivity.group.goals': 'Objetivos',
  'productivity.group.milestones': 'Hitos',
  'productivity.group.history': 'Historial',
  'productivity.filter.hideCompleted': 'Ocultar tareas completadas',
  'productivity.filter.showCompleted': 'Mostrar tareas completadas',
  'productivity.group.actions': 'Acciones de {group}',
} satisfies Record<keyof typeof en, string>;
