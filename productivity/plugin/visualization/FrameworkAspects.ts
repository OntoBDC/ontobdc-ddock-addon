import { fillEntityChoices, NEW_PREFIX } from '@/ontobdc/shared/adapter/editor/entity_choices';
import { EntityRepository } from '@/ontobdc/shared/adapter/entity-repository';
import { quoted, requestCommand, failureMessage } from '@/ontobdc/shared/adapter/command-request';
import { entityTypeLabelsOf, entityTypesOf, registerReferenceEditor, requestNewEntityFor } from '@/ontobdc/shared/adapter/entity-references';
import { eventBus } from '@/ontobdc/shared/adapter/event-bus';
import { nameIn, type Facade, type FacadeField } from '@/ontobdc/shared/adapter/facade-labels';
import { notify } from '@/ontobdc/shared/adapter/notice';
import type { EntityField } from '@/ontobdc/shared/domain/model/entity';
import type { VisualizationContext, VisualizationResult } from '@/ontobdc/shared/domain/model/visualization';
import { getLocale, translate } from '@/ontobdc/shared/plugin/i18n';
import { WORKSTREAM_ENTITY_TYPE } from '@/addon/productivity/adapter/productivity-format';

const SOURCE = 'productivity_framework_aspects';
/** The separator of the values of a field in its data source. */
const SEPARATOR = '|';

/**
 * The visualization of the field that points to the framework a work stream is managed through (`facade:FrameworkAspects`).
 * The value of the field is the global id of the framework entity (a 5W2H, for instance). What is drawn is that entity's
 * fields that point to entities, each with the entities chosen in it: one is taken off with the × on it, and one is added by
 * choosing it in the list at the end, or by making a new one there. Beside each aspect's entities stands its labeled
 * multiline free-text field, named after it (`what` and `what_text`). Both fields are saved with
 * `presentation.entity.save.requested`, and go back to what was saved if saving fails. What can be added to an aspect is
 * what the facade of the framework says it takes (the goals, for the what of a 5W2H), so the lists are drawn when that
 * facade is known. A framework that is not among the entities of the container, or that has no such field, is not drawn:
 * the field stays as text.
 */
/** The facade of an entity type: the one the repository has, else the one `ontobdc context --entity <type> --inspect` tells, kept for the next time. */
async function facadeOf(entityType: string): Promise<Facade> {
  const repository = EntityRepository.getInstance();
  const known = repository.facadeOfEntityType(entityType);
  if (known) return known;
  const result = await requestCommand(`ontobdc context --entity ${quoted(entityType)} --inspect`, SOURCE);
  const response = result.stdout;
  const facade = response && typeof response === 'object' && !Array.isArray(response) ? response.content : null;
  if (!facade || typeof facade !== 'object' || Array.isArray(facade) || !Array.isArray(facade.fields)) {
    throw new Error(`The facade inspection returned no facade for ${entityType}.`);
  }
  repository.setFacadeForEntityType(entityType, facade as Facade);
  return facade as Facade;
}

export default function frameworkAspects(context: VisualizationContext): VisualizationResult {
  const element = document.createElement('div');
  element.className = 'framework-aspects';
  const owner = context.entityId ?? '';
  const frameworkId = context.values[0] ?? '';
  const framework = EntityRepository.getInstance().find(frameworkId)?.item;
  const aspects: EntityField[] = framework?.fields.filter((field) => field.referencesEntities === true) ?? [];
  if (!framework || aspects.length === 0) {
    return { element, handled: [], dispose: () => element.remove() };
  }

  /** The fields of the framework, by name: the free text of an aspect is the field named after it (`what` and `what_text`). */
  const byName = new Map(framework.fields.map((field) => [field.name, field]));
  const textOf = (aspect: EntityField): EntityField | undefined => byName.get(`${aspect.name}_text`);
  const texts = aspects.map(textOf).filter((field): field is EntityField => field !== undefined);

  const idsOf = (field: EntityField): string[] => field.values.flatMap((text) => text.split(SEPARATOR)).map((text) => text.trim()).filter(Boolean);
  const nameOf = (id: string): string => EntityRepository.getInstance().find(id)?.item.name || id;
  /** The fields of the facade of the framework, by identifier: what each aspect takes. None until the facade is known. */
  let facadeFields: Map<string, FacadeField> | null = null;

  /** What each aspect holds now, entities and free text alike: what is shown, and what was last saved. */
  const committed = new Map(aspects.map((field) => [field.name, idsOf(field)]));
  const shown = new Map(committed);
  const committedTexts = new Map(texts.map((field) => [field.name, field.values[0] ?? '']));
  const shownTexts = new Map(committedTexts);
  let saving: string | null = null;
  let disposed = false;

  const save = (name: string, next: string[]): void => {
    if (saving !== null || disposed) return;
    saving = name;
    shown.set(name, next);
    draw();
    eventBus.publish('presentation.entity.save.requested', SOURCE, { id: frameworkId, changes: { [name]: next.join(SEPARATOR) } });
  };

  const saveText = (name: string, next: string): void => {
    if (saving !== null || disposed || shownTexts.get(name) === next) return;
    saving = name;
    shownTexts.set(name, next);
    draw();
    eventBus.publish('presentation.entity.save.requested', SOURCE, { id: frameworkId, changes: { [name]: next } });
  };

  /** A chip for an entity chosen in an aspect. */
  const chip = (field: EntityField, value: string, label: string): HTMLElement => {
    const tag = document.createElement('span');
    tag.className = 'tag-chip';
    const text = document.createElement('span');
    text.className = 'tag-text';
    text.textContent = label;
    text.title = value;
    tag.append(text);
    if (field.editable) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'tag-remove';
      remove.textContent = '×';
      remove.title = translate('tags.remove', { name: label });
      remove.setAttribute('aria-label', remove.title);
      remove.disabled = saving !== null;
      remove.addEventListener('click', () => save(field.name, (shown.get(field.name) ?? []).filter((other) => other !== value)));
      tag.append(remove);
    }
    return tag;
  };

  const adder = (field: EntityField): HTMLSelectElement => {
    const select = document.createElement('select');
    select.className = 'framework-aspect-add';
    select.setAttribute('aria-label', nameIn(field.labels, getLocale()) ?? field.name);
    select.disabled = saving !== null;
    select.append(document.createElement('option'));
    const declared = facadeFields?.get(field.name);
    fillEntityChoices(select, owner, declared ? entityTypesOf(declared) : [], declared ? entityTypeLabelsOf(declared) : {}, false, [WORKSTREAM_ENTITY_TYPE]);
    select.addEventListener('change', () => {
      const chosen = select.value;
      select.value = '';
      if (chosen.startsWith(NEW_PREFIX)) requestNewEntityFor(owner, field.name, chosen.slice(NEW_PREFIX.length));
      else if (chosen && !(shown.get(field.name) ?? []).includes(chosen)) save(field.name, [...(shown.get(field.name) ?? []), chosen]);
    });
    return select;
  };

  // An entity made in the list of an aspect, to be chosen in it, goes in when it is saved.
  for (const field of aspects) {
    if (!field.editable) continue;
    registerReferenceEditor(owner, field.name, (id) => {
      if (!disposed && !(shown.get(field.name) ?? []).includes(id)) save(field.name, [...(shown.get(field.name) ?? []), id]);
    });
  }

  const draw = (): void => {
    element.dataset.saving = String(saving !== null);
    const title = document.createElement('div');
    title.className = 'framework-aspects-title';
    title.textContent = framework.name || frameworkId;
    const rows = aspects.map((field) => {
      const row = document.createElement('div');
      row.className = 'framework-aspect';
      const label = document.createElement('span');
      label.className = 'framework-aspect-label';
      label.textContent = nameIn(field.labels, getLocale()) ?? field.name;
      const text = textOf(field);
      const values = document.createElement('div');
      values.className = `tag-cloud framework-aspect-values${text ? ' framework-aspect-values-aligned' : ''}`;
      values.append(...(shown.get(field.name) ?? []).map((id) => chip(field, id, nameOf(id))), ...(field.editable && facadeFields ? [adder(field)] : []));
      if (!text) {
        row.append(label, values);
        return row;
      }
      const notes = document.createElement('div');
      notes.className = 'framework-aspect-texts';
      const textLabel = document.createElement('span');
      textLabel.className = 'framework-aspect-text-label';
      textLabel.textContent = nameIn(text.labels, getLocale()) ?? text.name;
      const textInput = document.createElement('textarea');
      textInput.className = 'framework-aspect-textarea';
      textInput.setAttribute('aria-label', textLabel.textContent);
      textInput.value = shownTexts.get(text.name) ?? '';
      textInput.disabled = !text.editable || saving !== null;
      textInput.addEventListener('change', () => saveText(text.name, textInput.value));
      notes.append(textLabel, textInput);
      row.append(label, notes, values);
      return row;
    });
    element.replaceChildren(title, ...rows);
  };

  const unsubscribe = [
    eventBus.subscribe('presentation.entity.saved', ({ payload }) => {
      if (payload?.id !== frameworkId || saving === null) return;
      if (shownTexts.has(saving)) committedTexts.set(saving, shownTexts.get(saving) ?? '');
      else committed.set(saving, [...(shown.get(saving) ?? [])]);
      saving = null;
      draw();
    }),
    eventBus.subscribe('presentation.entity.save.failed', ({ payload }) => {
      if (payload?.id !== frameworkId || saving === null) return;
      if (committedTexts.has(saving)) shownTexts.set(saving, committedTexts.get(saving) ?? '');
      else shown.set(saving, [...(committed.get(saving) ?? [])]);
      saving = null;
      draw();
    }),
  ];
  draw();
  facadeOf(framework.type)
    .then((facade) => {
      if (disposed) return;
      facadeFields = new Map(facade.fields.map((declared) => [declared.identifier, declared]));
      draw();
    })
    .catch((error: unknown) => notify(failureMessage(error), 'error'));

  return {
    element,
    handled: [frameworkId],
    dispose: () => {
      disposed = true;
      unsubscribe.forEach((off) => off());
      element.remove();
    },
  };
}
