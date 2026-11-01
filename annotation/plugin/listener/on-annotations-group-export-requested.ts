import { contentOf } from '@/addon/annotation/adapter/annotation-format';
import { quoted, requestCommand } from '@/ontobdc/shared/adapter/command-request';
import { eventBus, type AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import { ContainerFileRepository } from '@/ontobdc/shared/adapter/container-file-repository';
import { ContainerRepository } from '@/ontobdc/shared/adapter/container-repository';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';
import { getLocale, translate } from '@/ontobdc/shared/plugin/i18n';

const EXPORT_REQUESTED = 'presentation.annotations.group.export.requested';
type ExportRequested = AppEventMap[typeof EXPORT_REQUESTED];
const SOURCE = 'annotations_on_group_export_requested';
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export class OnAnnotationsGroupExportRequested {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'annotations',
    description: 'Exports the annotations of one annotation type to an Excel workbook and hands it to the browser as a download.',
    arguments: [
      {
        listen: [EXPORT_REQUESTED],
        valued: true,
        parameter: 'group',
        description: 'The annotation type whose annotations are exported.',
        type: 'str',
      },
    ],
  };

  private readonly request: ExportRequested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as ExportRequested | undefined;
  }

  /**
   * Runs `ontobdc annotate --export excel --type <group> --language <locale> [--only <ids>]`,
   * reads the workbook it leaves in the container and downloads it. Publishes
   * `presentation.annotations.group.export.started` and `.finished`, or `.failed`
   * with the reason when nothing could be exported.
   */
  async run(): Promise<void> {
    const group = this.request?.group;
    if (!group) throw new Error('The export request carries no annotation type.');

    eventBus.publish('presentation.annotations.group.export.started', SOURCE, { group });
    try {
      const container = ContainerRepository.getInstance().get();
      if (container?.access !== 'readwrite' || !container.folder) throw new Error(translate('container.readOnly'));

      // The ids are of what the group showed: the ones it hid are not exported.
      const only = (this.request?.ids ?? []).filter((id) => !id.includes('|')).join('|');
      const result = await requestCommand(
        `ontobdc annotate --export excel --type ${quoted(group)} --language ${quoted(getLocale().toLowerCase())}`
          + (only ? ` --only ${quoted(only)}` : ''),
        SOURCE,
      );
      const relativePath = contentOf(result.stdout)?.relative_path;
      if (typeof relativePath !== 'string' || !relativePath) throw new Error('The export left no file.');

      const file = await ContainerFileRepository.of(container.folder).file(relativePath);
      const filename = `${exportName(container.name, group)}.xlsx`;
      const url = URL.createObjectURL(new Blob([file], { type: MIME }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      eventBus.publish('presentation.annotations.group.export.finished', SOURCE, { group, filename, bytes: file.size });
    } catch (error) {
      eventBus.publish('presentation.annotations.group.export.failed', SOURCE, { group, message: error instanceof Error ? error.message : String(error) });
    }
  }
}

/** `<container>_<group>_<date>` without what a file name cannot hold. */
function exportName(container: string, group: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${container || 'container'}_${group}_${date}`.replace(/[\\/:*?"<>|\s]+/g, '_');
}
