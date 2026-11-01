/** One annotation of a group, as `ontobdc annotate --list` tells it. */
export type AnnotationItem = {
  /** Global id of the annotation. */
  id: string;
  title: string;
  text: string;
  author: string;
  createdAt: string;
  /** When the annotation was closed (`completed_at`); empty while it is open. */
  completedAt: string;
  /** Path, in the container, of the document the annotation was made on; empty when none. */
  sourceDocument: string;
  /** Paths, in the container, of the files the annotation refers to. */
  related: string[];
};

/**
 * One group of the Annotations panel: an annotation type the Brasidatacenter
 * ontology declares. `labels` has its name by lower-case language tag (`en`,
 * `pt-br`), `items` its annotations.
 */
export type AnnotationGroup = { id: string; labels: Record<string, string>; items: AnnotationItem[] };
