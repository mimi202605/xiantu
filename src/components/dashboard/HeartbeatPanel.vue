<template>
  <div class="heartbeat-panel event-panel">
    <div class="event-toolbar">
      <div class="title">
        <span class="title-text">{{ t('世界心跳') }}</span>
        <span class="meta">· {{ t('回合推进时世界状态更新') }}</span>
      </div>
    </div>
    <div class="heartbeat-content">
      <WorldHeartbeatWidget />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n';
import WorldHeartbeatWidget from './components/WorldHeartbeatWidget.vue';

const { t } = useI18n();
</script>

<style scoped>
.heartbeat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.event-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.title {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.title-text {
  font-weight: 700;
  color: var(--color-text);
}

.meta {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.heartbeat-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow: hidden;
}
</style>
