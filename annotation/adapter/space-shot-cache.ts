import { annotationDataset } from '@/addon/annotation/adapter/annotation-dataset';
import { ContainerFileRepository } from '@/ontobdc/shared/adapter/container-file-repository';
import { ContainerRepository } from '@/ontobdc/shared/adapter/container-repository';
import { eventBus } from '@/ontobdc/shared/adapter/event-bus';

const SOURCE = 'annotations_space_shot_cache';

/** A model in space as the person left it, as a picture: the view they chose, with the shapes they put in it. */
export type SpaceShot = { url: string; width: number; height: number };

const shots = new Map<string, SpaceShot>();

/** The picture the person left the model of this annotation in, none until they have closed its window. */
export function spaceShot(id: string): SpaceShot | undefined {
  return shots.get(id);
}

/** Keeps the picture of the model of an annotation, in place of the one before, and tells whoever shows it. */
export function keepSpaceShot(id: string, shot: SpaceShot): void {
  shots.set(id, shot);
  eventBus.publish('presentation.annotations.geometry.shot.taken', SOURCE, { id });
}

/**
 * The picture kept beside the annotation, in the documents of its dataset, named by its global id: the view the person left
 * the model in when they last closed its window, even in another session. None when no picture was kept. It is
 * remembered like one just taken.
 */
export async function savedSpaceShot(id: string): Promise<SpaceShot | undefined> {
  const known = shots.get(id);
  if (known) return known;
  const folder = ContainerRepository.getInstance().get()?.folder;
  const dataset = annotationDataset();
  if (!folder || !dataset) return undefined;

  let file: File;
  try {
    file = await ContainerFileRepository.of(folder).file(`${dataset}/payload/document/${id}.png`);
  } catch {
    return undefined;
  }
  const bitmap = await createImageBitmap(file);
  const shot = { url: URL.createObjectURL(file), width: bitmap.width, height: bitmap.height };
  bitmap.close();
  // A picture taken while it was read is the later one.
  return shots.get(id) ?? (shots.set(id, shot), shot);
}
