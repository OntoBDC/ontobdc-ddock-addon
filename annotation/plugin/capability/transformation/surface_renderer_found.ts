import { documentImageRenderer } from '@/ontobdc/shared/adapter/document-image';
import type { CapabilityContext, CapabilityMetadata } from '@/ontobdc/shared/domain/model/capability';

export class SurfaceRendererFoundCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.annotations.plugin.capability.transformation.target.surface_renderer_found',
    description: 'Find the addon that draws this kind of document as an image.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { document } = context.parameters;
    if (!document) throw new Error('Finding the renderer of a document requires its path.');
    const renderer = documentImageRenderer(document);
    if (!renderer) throw new Error(`No addon draws ${document} as an image.`);

    context.etl.write(context.machine ?? '', context.requestId, context.state, { phase: 'done', entity: { document }, result: { renderer } });
  }
}
