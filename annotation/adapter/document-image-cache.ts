import { ContainerFileRepository } from '@/ontobdc/shared/adapter/container-file-repository';
import { ContainerRepository } from '@/ontobdc/shared/adapter/container-repository';
import { documentImageRenderer } from '@/ontobdc/shared/adapter/document-image';

/** A document drawn as an image, at an address of the browser the cache keeps until it lets go of it. */
export type CachedImage = { url: string; width: number; height: number };

/** How many documents are kept drawn: the pictures of the tabs that are open, and some that were. */
const KEPT = 8;
const cache = new Map<string, Promise<CachedImage>>();

/**
 * The document of the container drawn as an image, by the addon that draws its kind. A document is drawn once while it is
 * kept and is not changed: the same file is the same image, and another version of it is another one. Rejects when no
 * container is open, no addon draws it, or it cannot be drawn.
 */
export async function documentImage(path: string): Promise<CachedImage> {
  const folder = ContainerRepository.getInstance().get()?.folder;
  if (!folder) throw new Error('No container is open to read the document from.');
  const renderer = documentImageRenderer(path);
  if (!renderer) throw new Error(`No addon draws ${path} as an image.`);

  const file = await ContainerFileRepository.of(folder).file(path);
  const key = `${path}\u0000${file.size}\u0000${file.lastModified}`;
  const known = cache.get(key);
  if (known) return known;

  const drawn = renderer.render(file).then((image) => ({ url: URL.createObjectURL(image.blob), width: image.width, height: image.height }));
  cache.set(key, drawn);
  drawn.catch(() => cache.delete(key));
  if (cache.size > KEPT) {
    const [oldest] = cache.keys();
    void cache.get(oldest)?.then((image) => URL.revokeObjectURL(image.url));
    cache.delete(oldest);
  }
  return drawn;
}
