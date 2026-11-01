/** The entity types of the groups of the Productivity panel. */
const TYPE_BASE = 'http://datacenter.app.br/ontology/domain/productivity/taxonomy/type.ttl#';
export const TASK_ENTITY_TYPE = `${TYPE_BASE}Task`;
export const GOAL_ENTITY_TYPE = `${TYPE_BASE}Goal`;
export const MILESTONE_ENTITY_TYPE = `${TYPE_BASE}Milestone`;

/** The ontobdc commands the productivity listeners chain: each lists the entities of one type of the container. */
export const TASK_LIST_COMMAND = 'ontobdc container --entity task --list';
export const MILESTONE_LIST_COMMAND = 'ontobdc container --entity milestone --list';
/** The goals, each with what its facade says is below it: the tree is decided by the ontology. */
export const GOAL_TREE_COMMAND = 'ontobdc container --entity goal --tree';

/** The entity type whose tree a tree command lists, by the command. */
export const TREE_COMMAND_ENTITIES: Readonly<Record<string, string>> = {
  [GOAL_TREE_COMMAND]: GOAL_ENTITY_TYPE,
};
