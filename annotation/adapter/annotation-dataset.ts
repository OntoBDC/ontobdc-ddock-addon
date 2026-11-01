/** The type of an annotation. */
export const ANNOTATION_ENTITY_TYPE = 'http://datacenter.app.br/ontology/domain/annotation/taxonomy/type.ttl#Annotation';

/** The dataset that holds the annotations of the container: its path in the container, as the datasets of the database give it. */
let dataset: string | null = null;

export const annotationDataset = (): string | null => dataset;

export const setAnnotationDataset = (path: string | null): void => {
  dataset = path;
};
