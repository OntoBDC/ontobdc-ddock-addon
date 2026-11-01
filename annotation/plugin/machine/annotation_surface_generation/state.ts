/** The states of making the surface an annotation is drawn on: the document is read, drawn as an image by a renderer. */
export const AnnotationSurfaceGenerationState = {
  UNDEFINED: 'undefined',
  SURFACE_DOCUMENT_READ: 'surface_document_read',
  SURFACE_RENDERER_FOUND: 'surface_renderer_found',
  SURFACE_IMAGE_RENDERED: 'surface_image_rendered',
} as const;

export type AnnotationSurfaceGenerationStateValue =
  (typeof AnnotationSurfaceGenerationState)[keyof typeof AnnotationSurfaceGenerationState];
