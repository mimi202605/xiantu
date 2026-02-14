<template>
  <div class="world-heartbeat-widget">
    <div class="heartbeat-header">
      <h4 class="heartbeat-title">世界呼吸 / 世界心跳</h4>
      <div class="heartbeat-toolbar">
        <button
          type="button"
          class="tool-btn"
          :disabled="!canTrigger || isRunning"
          @click="onManualTrigger"
        >
          {{ isRunning ? '执行中…' : '手动触发心跳' }}
        </button>
        <button
          type="button"
          class="tool-btn tool-btn-subtle"
          :disabled="!canRevertAll || isRunning"
          @click="onRevertAll"
        >
          全部回溯（最近一条）
        </button>
      </div>
    </div>
    <div v-if="!heartbeat" class="heartbeat-empty">
      <p>未加载或未启用心跳</p>
    </div>
    <div v-else class="heartbeat-list">
      <div v-if="!reversedHistory.length" class="heartbeat-empty">
        <p>暂无心跳记录</p>
      </div>
      <div
        v-for="(record, index) in reversedHistory"
        :key="recordKey(record, index)"
        class="heartbeat-item"
      >
        <div class="heartbeat-item-header" @click="toggleExpand(record, index)">
          <span class="heartbeat-time">{{ record.时间 }}</span>
          <span class="heartbeat-round">回合 {{ record.回合序号 }}</span>
          <span class="heartbeat-mode">{{ record.触发方式 }}</span>
          <span class="heartbeat-count">{{ record.更新列表?.length ?? 0 }} 人</span>
          <span class="heartbeat-expand-icon">{{ expandedIds.has(recordKey(record, index)) ? '▼' : '▶' }}</span>
        </div>
        <div v-show="expandedIds.has(recordKey(record, index))" class="heartbeat-item-body">
          <div
            v-for="entry in (record.更新列表 || [])"
            :key="entry.npc名字"
            class="heartbeat-npc-row"
          >
            <span class="npc-name">{{ entry.npc名字 }}</span>
            <span class="npc-summary">{{ entry.更新摘要 || '—' }}</span>
            <button
              type="button"
              class="tool-btn btn-revert-one"
              :disabled="isRunning"
              @click.stop="onRevertOne(record, entry.npc名字)"
            >
              回溯此人
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useCharacterStore } from '@/stores/characterStore';
import type { HeartbeatRecord, WorldHeartbeatConfig } from '@/types/game';
import { cloneDeep } from 'lodash';
import { toast } from '@/utils/toast';

const gameStateStore = useGameStateStore();
const characterStore = useCharacterStore();

const isRunning = ref(false);
const expandedIds = ref<Set<string>>(new Set());

const heartbeat = computed<WorldHeartbeatConfig | null>(() => gameStateStore.worldHeartbeat);

const reversedHistory = computed(() => {
  const hist = heartbeat.value?.历史;
  if (!Array.isArray(hist)) return [];
  return [...hist].reverse();
});

const canTrigger = computed(() => gameStateStore.isGameLoaded && heartbeat.value != null);
const canRevertAll = computed(() => {
  const hist = heartbeat.value?.历史;
  return Array.isArray(hist) && hist.length > 0 && !isRunning.value;
});

/** 每条心跳记录的唯一 key（用原始历史下标，避免同时间/回合/方式导致多条同时展开） */
function recordKey(record: HeartbeatRecord, reversedIndex: number): string {
  const total = reversedHistory.value.length;
  return `hb-${total - 1 - reversedIndex}`;
}

function toggleExpand(record: HeartbeatRecord, reversedIndex: number) {
  const id = recordKey(record, reversedIndex);
  const next = new Set(expandedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedIds.value = next;
}

async function onManualTrigger() {
  if (!gameStateStore.isGameLoaded || !heartbeat.value?.启用) {
    toast.warning('请先启用心跳（设置 → 世界心跳）');
    return;
  }
  isRunning.value = true;
  try {
    const result = await gameStateStore.performHeartbeat({ triggerMode: '手动' });
    if (result.success) {
      toast.success('心跳已执行');
    } else {
      console.error('[世界心跳] 手动触发失败:', result.message);
      toast.error('心跳执行失败');
    }
  } catch (e) {
    console.error('[世界心跳] 手动触发失败:', e);
    toast.error('心跳执行失败');
  } finally {
    isRunning.value = false;
  }
}

async function onRevertAll() {
  const hist = heartbeat.value?.历史;
  if (!Array.isArray(hist) || hist.length === 0) return;
  isRunning.value = true;
  try {
    const last = hist[hist.length - 1];
    const snapshot = last.快照;
    if (snapshot && typeof snapshot === 'object') {
      const saveData = gameStateStore.toSaveData();
      if (!saveData) return;
      const 关系 = (saveData as any).社交?.关系 ?? {};
      for (const [name, npc] of Object.entries(snapshot)) {
        if (npc && typeof npc === 'object') 关系[name] = cloneDeep(npc);
      }
      (saveData as any).社交 = (saveData as any).社交 ?? {};
      (saveData as any).社交.关系 = 关系;
      const newHist = hist.slice(0, -1);
      if ((saveData as any).世界?.状态?.心跳) (saveData as any).世界.状态.心跳.历史 = newHist;
      gameStateStore.updateState('worldHeartbeat.历史', newHist);
      gameStateStore.loadFromSaveData(saveData);
      await characterStore.saveCurrentGame();
      toast.success('已回溯最近一次心跳');
    }
  } catch (e) {
    console.error('[世界心跳] 全部回溯失败:', e);
    toast.error('回溯失败');
  } finally {
    isRunning.value = false;
  }
}

async function onRevertOne(record: HeartbeatRecord, npcName: string) {
  const snapshot = record.快照?.[npcName];
  if (!snapshot || typeof snapshot !== 'object') return;
  isRunning.value = true;
  try {
    const saveData = gameStateStore.toSaveData();
    if (!saveData) return;
    const 关系 = (saveData as any).社交?.关系 ?? {};
    关系[npcName] = cloneDeep(snapshot);
    (saveData as any).社交.关系 = 关系;
    const 历史 = heartbeat.value?.历史;
    if (Array.isArray(历史)) {
      const idx = 历史.findIndex((r) => r === record);
      if (idx >= 0 && 历史[idx].更新列表) {
        const newHist = 历史.map((r, i) =>
          i === idx ? { ...r, 更新列表: r.更新列表.filter((e) => e.npc名字 !== npcName) } : r
        );
        if ((saveData as any).世界?.状态?.心跳) (saveData as any).世界.状态.心跳.历史 = newHist;
        gameStateStore.updateState('worldHeartbeat.历史', newHist);
      }
    }
    gameStateStore.loadFromSaveData(saveData);
    await characterStore.saveCurrentGame();
    toast.success(`已回溯 ${npcName}`);
  } catch (e) {
    console.error('[世界心跳] 单条回溯失败:', e);
    toast.error('回溯失败');
  } finally {
    isRunning.value = false;
  }
}
</script>

<style scoped>
.world-heartbeat-widget {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  margin-top: 0;
  padding: 0.75rem;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}
.heartbeat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  flex-shrink: 0;
}
.heartbeat-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
}
.heartbeat-toolbar {
  display: flex;
  gap: 0.5rem;
}
.tool-btn {
  padding: 6px 10px;
  font-size: 0.8rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s ease;
}
.tool-btn:hover:not(:disabled) {
  background: var(--color-surface-hover);
  border-color: var(--color-border-hover);
}
.tool-btn-subtle {
  color: var(--color-text-secondary);
}
.tool-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.heartbeat-empty {
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  padding: 0.5rem 0;
  flex-shrink: 0;
}
.heartbeat-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.heartbeat-item {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  margin-bottom: 0.5rem;
  overflow: hidden;
}
.heartbeat-item-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  cursor: pointer;
  font-size: 0.8rem;
  background: rgba(0,0,0,0.03);
}
.heartbeat-item-header:hover {
  background: rgba(0,0,0,0.06);
}
.heartbeat-time { flex: 0 0 auto; }
.heartbeat-round { color: var(--color-text-secondary); }
.heartbeat-mode { color: var(--color-primary); }
.heartbeat-count { margin-left: auto; }
.heartbeat-expand-icon { font-size: 0.7rem; }
.heartbeat-item-body {
  padding: 0.4rem 0.6rem;
  font-size: 0.8rem;
  border-top: 1px solid var(--color-border);
}
.heartbeat-npc-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
}
.npc-name { font-weight: 600; min-width: 4em; }
.npc-summary { flex: 1; color: var(--color-text-secondary); }
.btn-revert-one {
  padding: 6px 10px;
  font-size: 0.8rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-revert-one:hover:not(:disabled) {
  background: var(--color-surface-hover);
  border-color: var(--color-border-hover);
}
</style>
