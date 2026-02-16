import type { MingEntityNode, MingEntityRelation, MingEventNode, SaveData } from '@/types/game';

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const relationId = (fromId: string, relation: string, toId: string): string =>
  `rel:${fromId}:${relation}:${toId}`;

export interface BuildRelationsInput {
  events: MingEventNode[];
  entities: MingEntityNode[];
  saveData: SaveData | Record<string, unknown>;
}

const buildNameIndex = (entities: MingEntityNode[]): Map<string, string> => {
  const index = new Map<string, string>();
  for (const entity of entities || []) {
    if (!entity?.id) continue;
    const name = clean(entity.name);
    if (name) index.set(name, entity.id);
    for (const alias of entity.aliases || []) {
      const aliasName = clean(alias);
      if (aliasName) index.set(aliasName, entity.id);
    }
  }
  return index;
};

const addRelation = (
  map: Map<string, MingEntityRelation>,
  fromId: string,
  toId: string,
  relation: string,
  confidence: number,
  sourceEventId?: string,
) => {
  if (!fromId || !toId || fromId === toId || !relation) return;
  const id = relationId(fromId, relation, toId);
  map.set(id, {
    id,
    from_id: fromId,
    to_id: toId,
    relation,
    confidence: Math.max(0, Math.min(1, confidence)),
    source_event_id: sourceEventId,
    last_updated_at: Date.now(),
  });
};

/**
 * Build relation edges from events and social state.
 */
export function buildRelationsFromEvents(input: BuildRelationsInput): MingEntityRelation[] {
  const save = (input.saveData ?? {}) as any;
  const relations = new Map<string, MingEntityRelation>();
  const nameToId = buildNameIndex(input.entities || []);
  const playerName = clean(save?.角色?.身份?.名字) || '玩家';
  const playerId = nameToId.get(playerName) || '';

  for (const event of input.events || []) {
    const kv = (event as any)?.structured_kv || {};
    const roleNames = Array.isArray(kv.role) ? kv.role.map(clean).filter(Boolean) : [];
    const locationNames = Array.isArray(kv.location) ? kv.location.map(clean).filter(Boolean) : [];
    const conceptName = clean(kv.event);
    const roleIds = roleNames
      .map((name: string) => nameToId.get(name))
      .filter((id: string | undefined): id is string => Boolean(id));
    const locationIds = locationNames
      .map((name: string) => nameToId.get(name))
      .filter((id: string | undefined): id is string => Boolean(id));
    const conceptId = conceptName ? nameToId.get(conceptName) : undefined;

    for (let i = 0; i < roleIds.length; i += 1) {
      for (let j = i + 1; j < roleIds.length; j += 1) {
        addRelation(relations, roleIds[i], roleIds[j], 'co_occurs_with', 0.55, event.id);
        addRelation(relations, roleIds[j], roleIds[i], 'co_occurs_with', 0.55, event.id);
      }
    }

    for (const roleId of roleIds) {
      for (const locId of locationIds) {
        addRelation(relations, roleId, locId, 'appears_at', 0.7, event.id);
      }
      if (conceptId) {
        addRelation(relations, roleId, conceptId, 'involved_in', 0.65, event.id);
      }
    }
  }

  const socialRelations = save?.社交?.关系 || {};
  if (socialRelations && typeof socialRelations === 'object' && playerId) {
    for (const [npcName, npc] of Object.entries(socialRelations)) {
      const npcId = nameToId.get(clean(npcName));
      if (!npcId) continue;
      const rel = clean((npc as any)?.与玩家关系) || 'related_to';
      addRelation(relations, npcId, playerId, `rel_${rel}`, 0.8);
    }
  }

  return Array.from(relations.values());
}
