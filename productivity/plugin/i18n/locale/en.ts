/**
 * The words of the Productivity addon, in English. The core reads every
 * plugin/i18n/locale file of the addons, by the name of the file, and the keys
 * below are added to the message keys of the application.
 */
export const en = {
  'nav.productivity': 'Productivity',
  'pane.productivity.header': 'PRODUCTIVITY',
  'productivity.empty': 'No tasks, goals or milestones yet',
  'productivity.group.tasks': 'Tasks',
  'productivity.group.goals': 'Goals',
  'productivity.group.milestones': 'Milestones',
  'productivity.group.history': 'History',
  'productivity.filter.hideCompleted': 'Hide completed tasks',
  'productivity.filter.showCompleted': 'Show completed tasks',
  'productivity.group.actions': 'Actions of {group}',
};

declare module '@/ontobdc/shared/plugin/i18n' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AddonMessages extends Record<keyof typeof en, string> {}
}

export default en;
