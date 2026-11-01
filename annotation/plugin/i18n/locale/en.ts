/**
 * The words of the Annotations addon, in English. The core reads every
 * plugin/i18n/locale file of the addons, by the name of the file, and the keys
 * below are added to the message keys of the application.
 */
export const en = {
  'notice.annotations.delete.failed': 'Could not delete the annotation: {message}',
  'notice.annotations.export.failed': 'Could not export the annotations: {message}',
  'notice.annotations.geometry.failed': 'Could not empty the geometry of the annotation: {message}',
  'notice.annotations.geometry.cleared': 'The geometry of the annotation “{title}” was deleted because its source document changed: the points were of the old document. Make it again on the new one.',
  'annotations.filter.hideClosed': 'Hide closed annotations',
  'annotations.filter.showClosed': 'Show closed annotations',
  'annotations.filter.allClosed': 'All the annotations are closed.',
  'nav.annotations': 'Annotations',
  'pane.annotations.header': 'ANNOTATIONS',
  'annotations.empty': 'No annotations yet',
  'annotations.failed': 'Annotations could not be read',
  'annotations.moreActions': 'More actions for {item}',
  'annotations.hasFiles': '{count} related files',
  'annotations.group.actions': 'Actions for {group}',
  'annotations.export': 'Export',
  'annotations.export.excel': 'Excel',
  'annotations.export.empty': 'No annotations to export.',
  'annotations.export.exporting': 'Exporting…',
  'annotations.menu.open': 'Open',
  'annotations.geometry.view.noDocument': 'Choose the source document of the annotation to see its geometry on it.',
  'annotations.geometry.view.notDrawable': 'The source document cannot be drawn as an image yet.',
  'annotations.geometry.view.failed': 'The document could not be drawn.',
  'annotations.geometry.view.open': 'Double-click to draw',
  'annotations.geometry.delete': 'Delete the chosen shape (Del)',
  'annotations.menu.draw': 'Draw geometry',
  'annotations.geometry.title': 'Geometry of “{title}”',
  'annotations.geometry.loading': 'Drawing the document…',
  'annotations.geometry.close': 'Close',
  'annotations.shape.rectangle': 'Rectangle',
  'annotations.shape.circle': 'Circle',
  'annotations.shape.amoeba': 'Amoeba',
  'annotations.shape.cross': 'Cross',
  'annotations.shape.box': 'Box',
  'annotations.shape.cylinder': 'Cylinder',
  'annotations.shape.sphere': 'Sphere',
  'annotations.shape.lollipop': 'Lollipop',
  'annotations.geometry.strokeColor': 'Border colour',
  'annotations.geometry.strokeWidth': 'Border width',
  'annotations.geometry.fillColor': 'Fill colour',
  'annotations.geometry.noFill': 'No fill',
  'notice.annotations.geometry.save.failed': 'Could not save the shape on the annotation: {message}',
  'notice.annotations.view.save.failed': 'Could not keep the view of the annotation: {message}',
  'notice.annotations.surface.failed': 'Could not draw the document of the annotation: {message}',
  'notice.annotations.geometry.noDocument': 'Choose the source document of the annotation first: the geometry is drawn on it.',
  'notice.annotations.geometry.notDrawable': 'The source document {document} cannot be drawn as an image yet.',
  'annotation.delete.title': 'Delete annotation',
  'annotation.delete.message': 'Delete “{title}”? This cannot be undone.',
  'annotation.delete.confirm': 'Delete',
};

declare module '@/ontobdc/shared/plugin/i18n' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AddonMessages extends Record<keyof typeof en, string> {}
}

export default en;
