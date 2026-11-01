import type { AnnotationSurfaceGenerationStateValue } from './state';

/** What the statechart's guards and actions ask of the machine. */
export interface AnnotationSurfaceGenerationHandlerPort {
  /** Whether the machine may go from its current state to this one. */
  canTransitTo(state: AnnotationSurfaceGenerationStateValue): boolean;
  /** Records that the machine entered the state. */
  performStateTransition(state: AnnotationSurfaceGenerationStateValue): void;
}

/** What making the surface is asked with: the path, in the container, of the document to draw. */
export type AnnotationSurfaceGenerationRequest = {
  document: string;
};
