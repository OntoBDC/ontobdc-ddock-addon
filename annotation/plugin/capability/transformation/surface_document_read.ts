import { ContainerFileRepository } from '@/ontobdc/shared/adapter/container-file-repository';
import { ContainerRepository } from '@/ontobdc/shared/adapter/container-repository';
import type { CapabilityContext, CapabilityMetadata } from '@/ontobdc/shared/domain/model/capability';

export class SurfaceDocumentReadCapability {
  static readonly METADATA: CapabilityMetadata = {
    id: 'org.annotations.plugin.capability.transformation.target.surface_document_read',
    description: 'Read the document the annotation is made on from the container.',
  };

  async execute(context: CapabilityContext): Promise<void> {
    const { document } = context.parameters;
    if (!document) throw new Error('Reading the document of an annotation requires its path.');
    const folder = ContainerRepository.getInstance().get()?.folder;
    if (!folder) throw new Error('No container is open to read the document from.');

    const file = await ContainerFileRepository.of(folder).file(document);
    context.etl.write(context.machine ?? '', context.requestId, context.state, { phase: 'done', entity: { document }, result: { file } });
  }
}
