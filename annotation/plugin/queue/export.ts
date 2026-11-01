import type { QueueNotice } from '@/ontobdc/shared/domain/model/queue-notice';

/** The export of annotations takes long and leaves a file. */
export const noticed: QueueNotice['noticed'] = [/\sannotate\s.*--export(\s|$)/];
