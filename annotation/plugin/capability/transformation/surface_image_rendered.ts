import type { CapabilityContext, CapabilityMetadata } from '@/ontobdc/shared/domain/model/capability';
import type { DocumentImageRenderer } from '@/ontobdc/shared/domain/model/document-image';

export class SurfaceImageRenderedCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.annotations.plugin.capability.transformation.target.surface_image_rendered',
    description: 'Draw the document as one image, which the annotation is marked on.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const machine = context.machine ?? '';
    const file = (context.etl.read(machine, context.requestId, 'surface_document_read')?.result as { file: File } | undefined)?.file;
    const renderer = (context.etl.read(machine, context.requestId, 'surface_renderer_found')?.result as { renderer: DocumentImageRenderer } | undefined)?.renderer;
    if (!file || !renderer) throw new Error('The document and its renderer are needed to draw the image.');

    const image = await renderer.render(file);
    context.etl.write(machine, context.requestId, context.state, { phase: 'done', entity: { document: context.parameters.document }, result: { image } });
  }
}
