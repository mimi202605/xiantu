import type { MingEntityNode, MingEventNode, SaveData } from '@/types/game';

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeName = (value: string): string => value.replace(/\s+/g, ' ').trim();

const makeId = (type: MingEntityNode['type'], name: string): string => {
  const safe = name
    .toLowerCase()
    .replace(/[\s/\\|:;,.!?()[\]{}"'`~]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${type}:${safe || 'unknown'}`;
};

const upsertEntity = (
  map: Map<string, MingEntityNode>,
  name: string,
  type: MingEntityNode['type'],
  partial: Partial<MingEntityNode> = {},
): void => {
  const normalizedName = normalizeName(name);
  if (!normalizedName) return;
  const id = makeId(type, normalizedName);
  const existing = map.get(id);
  const now = Date.now();

  if (!existing) {
    map.set(id, {
      id,
      name: normalizedName,
      type,
      aliases: [],
      description: partial.description || '',
      profile: partial.profile && typeof partial.profile === 'object' ? partial.profile : {},
      is_embedded: false,
      last_updated_at: now,
    });
    return;
  }

  const aliasSet = new Set<string>(existing.aliases || []);
  if (normalizedName !== existing.name) aliasSet.add(normalizedName);

  map.set(id, {
    ...existing,
    aliases: Array.from(aliasSet),
    description: partial.description || existing.description,
    profile: {
      ...(existing.profile || {}),
      ...((partial.profile as Record<string, unknown>) || {}),
    },
    last_updated_at: now,
  });
};

export interface BuildEntitiesInput {
  events: MingEventNode[];
  saveData: SaveData | Record<string, unknown>;
}

/**
 * Build/update entity nodes from newly ingested events and current save context.
 */
export function buildEntitiesFromEvents(input: BuildEntitiesInput): MingEntityNode[] {
  const save = (input.saveData ?? {}) as any;
  const map = new Map<string, MingEntityNode>();
  const relationships = save?.社交?.关系 || {};
  const playerName = clean(save?.角色?.身份?.名字) || '玩家';

  upsertEntity(map, playerName, 'char', {
    description: '玩家角色',
    profile: { source: 'player' },
  });

  if (relationships && typeof relationships === 'object') {
    for (const [name, npc] of Object.entries(relationships)) {
      const npcName = normalizeName(name);
      if (!npcName) continue;
      upsertEntity(map, npcName, 'char', {
        description: clean((npc as any)?.当前外貌状态) || clean((npc as any)?.当前内心想法),
        profile: {
          relationToPlayer: clean((npc as any)?.与玩家关系),
          location: clean((npc as any)?.位置),
          source: 'relationship',
        },
      });
    }
  }

  for (const event of input.events || []) {
    const kv = (event as any)?.structured_kv || {};
    const roles = Array.isArray(kv.role) ? kv.role : [];
    const locations = Array.isArray(kv.location) ? kv.location : [];

    for (const role of roles) {
      const roleName = clean(role);
      if (!roleName) continue;
      upsertEntity(map, roleName, 'char', {
        profile: { source: 'event_role', lastEventId: event.id },
      });
    }

    for (const loc of locations) {
      const locName = clean(loc);
      if (!locName) continue;
      upsertEntity(map, locName, 'loc', {
        profile: { source: 'event_location', lastEventId: event.id },
      });
    }

    const eventTitle = clean(kv.event);
    if (eventTitle) {
      upsertEntity(map, eventTitle, 'concept', {
        profile: { source: 'event_concept', lastEventId: event.id },
      });
    }
  }

  return Array.from(map.values());
}
