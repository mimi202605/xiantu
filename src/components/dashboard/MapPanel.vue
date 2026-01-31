<template>
  <div class="map-panel">
    <div class="map-header">
      <h2 class="map-title">{{ t('坤舆图') }}</h2>
      <div class="map-legend">
        <span class="legend-item explored">
          <span class="legend-dot explored"></span>
          {{ t('已探索') }}
        </span>
        <span class="legend-item unexplored">
          <span class="legend-dot unexplored"></span>
          {{ t('未探索') }}
        </span>
        <span class="legend-item current">
          <span class="legend-dot current"></span>
          {{ t('当前位置') }}
        </span>
      </div>
    </div>

    <div class="map-content">
      <div v-if="!hasLocations" class="map-empty">
        {{ t('尚无地点记录，游历四方后将逐步显现。') }}
      </div>
      <div v-else class="location-tree">
        <LocationTreeNode
          v-for="(loc, idx) in topLevelLocations"
          :key="loc.名称 || idx"
          :entry="loc"
          :explored-set="exploredSet"
          :current-location-desc="currentLocationDesc"
          :depth="0"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useI18n } from '@/i18n';
import type { LocationEntry } from '@/types/game';
import LocationTreeNode from './components/LocationTreeNode.vue';

const { t } = useI18n();
const gameStateStore = useGameStateStore();

const topLevelLocations = computed(() => {
  const info = gameStateStore.worldInfo?.地点信息;
  if (!Array.isArray(info)) return [];
  return info.filter((e): e is LocationEntry => e && typeof e === 'object' && typeof (e as any).名称 === 'string');
});

const exploredSet = computed(() => {
  const rec = gameStateStore.explorationRecord;
  return new Set(Array.isArray(rec) ? rec : []);
});

const currentLocationDesc = computed(() => gameStateStore.location?.描述 ?? '');

const hasLocations = computed(() => topLevelLocations.value.length > 0);
</script>

<style scoped>
.map-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  font-family: var(--font-family-sans-serif);
}

.map-header {
  flex-shrink: 0;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.map-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

.map-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-dot.explored {
  background: var(--color-success, #22c55e);
}

.legend-dot.unexplored {
  background: var(--color-text-muted, #94a3b8);
  opacity: 0.6;
}

.legend-dot.current {
  background: var(--color-primary, #3b82f6);
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
}

.map-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.map-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--color-text-secondary);
  font-size: 0.95rem;
  text-align: center;
  padding: 24px;
}

.location-tree {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
