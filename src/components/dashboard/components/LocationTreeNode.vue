<template>
  <div class="location-node" :style="{ paddingLeft: `${depth * 16 + 8}px` }">
    <div
      class="location-row"
      :class="{
        explored: isExplored,
        unexplored: !isExplored,
        current: isCurrent,
      }"
      @click="toggleExpand"
    >
      <span class="expand-icon" v-if="hasChildren">
        <ChevronRight v-if="!expanded" :size="14" />
        <ChevronDown v-else :size="14" />
      </span>
      <span class="expand-placeholder" v-else></span>
      <span class="location-name">{{ entry.名称 }}</span>
      <span class="location-badge current-badge" v-if="isCurrent">{{ t('当前') }}</span>
    </div>
    <div v-if="hasChildren && expanded" class="location-children">
      <LocationTreeNode
        v-for="(child, idx) in children"
        :key="child.名称 || idx"
        :entry="child"
        :explored-set="exploredSet"
        :current-location-desc="currentLocationDesc"
        :depth="depth + 1"
        :flat-entries="flatEntries"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ChevronRight, ChevronDown } from 'lucide-vue-next';
import { useI18n } from '@/i18n';
import type { LocationEntry } from '@/types/game';

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    entry: LocationEntry;
    exploredSet: Set<string>;
    currentLocationDesc: string;
    depth: number;
    /** 扁平地点列表，用于按 上级 推导子节点；不传则无子级 */
    flatEntries?: LocationEntry[];
  }>(),
  { flatEntries: undefined }
);

const expanded = ref(true);

/** 子节点：由扁平列表中 上级 === entry.名称 的条目组成 */
const children = computed(() => {
  const flat = props.flatEntries;
  if (!Array.isArray(flat)) return [];
  return flat.filter((e) => e.上级 === props.entry.名称);
});

const isExplored = computed(() => props.exploredSet.has(props.entry.名称));
const isCurrent = computed(
  () =>
    props.currentLocationDesc === props.entry.名称 ||
    (typeof props.currentLocationDesc === 'string' &&
      props.entry.名称 &&
      (props.currentLocationDesc.includes(props.entry.名称) || props.entry.名称.includes(props.currentLocationDesc)))
);
const hasChildren = computed(() => children.value.length > 0);

const toggleExpand = () => {
  if (hasChildren.value) expanded.value = !expanded.value;
};
</script>

<style scoped>
.location-node {
  margin: 2px 0;
}

.location-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
}

.location-row:hover {
  background: var(--color-surface-light);
}

.location-row.explored {
  color: var(--color-text);
}

.location-row.unexplored {
  color: var(--color-text-muted);
  opacity: 0.7;
}

.location-row.current {
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: var(--color-primary);
  font-weight: 600;
}

.expand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.expand-placeholder {
  width: 18px;
  flex-shrink: 0;
}

.location-name {
  flex: 1;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.location-badge {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

.current-badge {
  background: var(--color-primary);
  color: white;
}

.location-children {
  margin-top: 2px;
  border-left: 1px dashed var(--color-border);
  margin-left: 13px;
}
</style>
