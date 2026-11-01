import type { GeometryStyle, SavedGeometry, ShapeRequest } from '@/addon/annotation/domain/model/geometry-tool';
import { quoted } from '@/ontobdc/shared/adapter/command-request';
import { unwrapCliText } from '@/ontobdc/shared/adapter/container-format';
import type { AnnotationGroup, AnnotationItem } from '@/addon/annotation/domain/model/annotation';

/** The ontobdc command the annotation listeners chain: a result is recognized by the command it answers. */
export const ANNOTATION_LIST_COMMAND = 'ontobdc annotate --list';
/** The command that empties the geometry of one annotation, by its global id, as `quoted` gives it. */
export const annotationClearGeometryCommand = (quotedId: string): string => `ontobdc annotate --guid ${quotedId} --clear geometry`;

/** The entity type of an annotation, as the datasets of the container declare it: the dataset that holds the annotations is the one that declares it. */
/** The command that puts a shape on one annotation, by its global id, as `quoted` gives it. The colours and the width are the ones the shape is drawn with; a fill of none leaves the shape with no fill. */
export const annotationShapeCommand = (quotedId: string, request: ShapeRequest): string => {
  const params = Object.entries(request.arguments).map(([name, value]) => ` --param ${quoted(`${name}=${value}`)}`).join('');
  const { stroke, strokeWidth, fill } = request.style;
  return `ontobdc annotate --guid ${quotedId} --shape ${request.shape}${params} --stroke ${quoted(stroke)} --stroke-width ${strokeWidth}${fill === null ? '' : ` --fill ${quoted(fill)}`}`;
};

/** The command that keeps the picture of the document of an annotation as the person left it, as the base64 text of a PNG. */
export const annotationViewCommand = (quotedId: string, base64: string): string => `ontobdc annotate --guid ${quotedId} --view ${base64}`;

/** The command that moves a geometry of an annotation by this much, as `quoted` gives the identifiers. */
export const annotationMoveGeometryCommand = (quotedId: string, quotedGeometry: string, by: number[]): string =>
  `ontobdc annotate --guid ${quotedId} --move-geometry ${quotedGeometry} --by ${by.map((value) => Number(value.toFixed(6))).join(',')}`;

/** The command that changes how a geometry of an annotation is drawn, as `quoted` gives the identifiers; a fill of none takes the fill off. */
export const annotationStyleGeometryCommand = (quotedId: string, quotedGeometry: string, style: GeometryStyle): string =>
  `ontobdc annotate --guid ${quotedId} --style-geometry ${quotedGeometry} --stroke ${quoted(style.stroke)} --stroke-width ${style.strokeWidth} --fill ${style.fill === null ? 'none' : quoted(style.fill)}`;

/** The command that puts a geometry back on an annotation, where it was in the list: what undoes taking it off. */
export const annotationRestoreGeometryCommand = (quotedId: string, geometry: SavedGeometry, position: number): string => {
  const style = [
    geometry.shape === null ? '' : ` --shape ${quoted(geometry.shape)}`,
    geometry.stroke === null ? '' : ` --stroke ${quoted(geometry.stroke)}`,
    geometry.stroke_width === null ? '' : ` --stroke-width ${geometry.stroke_width}`,
    geometry.fill === null ? '' : ` --fill ${quoted(geometry.fill)}`,
  ].join('');
  return `ontobdc annotate --guid ${quotedId} --restore-geometry ${quoted(geometry.id)} --wkt ${quoted(geometry.wkt)} --position ${position}${style}`;
};

/** The command that takes a geometry off an annotation. */
export const annotationDeleteGeometryCommand = (quotedId: string, quotedGeometry: string): string =>
  `ontobdc annotate --guid ${quotedId} --delete-geometry ${quotedGeometry}`;

export const ANNOTATION_ENTITY_TYPE = 'http://datacenter.app.br/ontology/domain/annotation/taxonomy/type.ttl#Annotation';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A text field of the listing; the CLI wraps long strings, so the breaks it adds are removed. */
const textOf = (value: unknown): string => (typeof value === 'string' ? unwrapCliText(value) : '');

/** The `content` of a CLI answer that was already parsed, or null when it is not one. */
export function contentOf(response: unknown): Record<string, unknown> | null {
  return isRecord(response) && isRecord(response.content) ? response.content : null;
}

/**
 * The groups `ontobdc annotate --list` answers: one per annotation type the
 * Brasidatacenter ontology declares, in the order the CLI gives them, each with
 * its labels by language and its annotations. Returns null when the response is
 * not that answer.
 */
export function annotationGroupsOf(response: unknown): AnnotationGroup[] | null {
  const groups = contentOf(response)?.groups;
  if (!Array.isArray(groups)) return null;

  const parsed: AnnotationGroup[] = [];
  for (const group of groups) {
    if (!isRecord(group) || typeof group.id !== 'string' || !group.id) return null;
    parsed.push({ id: group.id, labels: labelsOf(group.labels, group.id), items: itemsOf(group.annotations) });
  }
  return parsed;
}

function labelsOf(labels: unknown, fallback: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  if (isRecord(labels)) {
    for (const [language, label] of Object.entries(labels)) {
      if (typeof label === 'string' && label) parsed[language.toLowerCase()] = unwrapCliText(label);
    }
  }
  if (!parsed.en) parsed.en = fallback;
  return parsed;
}

function itemsOf(annotations: unknown): AnnotationItem[] {
  if (!Array.isArray(annotations)) return [];
  const items: AnnotationItem[] = [];
  for (const annotation of annotations) {
    if (!isRecord(annotation) || typeof annotation.global_id !== 'string' || typeof annotation.title !== 'string') continue;
    items.push({
      id: annotation.global_id,
      title: unwrapCliText(annotation.title),
      text: textOf(annotation.text),
      author: textOf(annotation.author),
      createdAt: textOf(annotation.created_at),
      completedAt: textOf(annotation.completed_at),
      sourceDocument: textOf(annotation.source_document),
      related: Array.isArray(annotation.related_documents)
        ? annotation.related_documents.filter((path): path is string => typeof path === 'string' && path !== '').map(unwrapCliText)
        : [],
    });
  }
  return items;
}

/** The name of a group in the current language: the label the ontology gives in the locale (`pt-br`), else in its language (`pt`), else English. */
export function groupLabel(group: AnnotationGroup, locale: string): string {
  const tag = locale.toLowerCase();
  const label = group.labels[tag] ?? group.labels[tag.split('-')[0]] ?? group.labels.en ?? group.id;
  return label.toLocaleUpperCase(locale);
}

/** Whether the annotation was closed: it has a `completed_at`. */
export const isClosed = (annotation: AnnotationItem): boolean => annotation.completedAt.trim() !== '';
