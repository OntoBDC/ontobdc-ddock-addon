import source from './standard_annotation_surface_generation.yaml?raw';
import { convertStatechart, stateSequence, type StatechartConfig } from '@/ontobdc/shared/adapter/statechart-converter';

/** Provides the statechart definition independently of machine execution. */
export class AnnotationSurfaceGenerationStatechart {
  static config(): StatechartConfig {
    return convertStatechart(source);
  }

  static sequence(): string[] {
    return stateSequence(AnnotationSurfaceGenerationStatechart.config());
  }
}
