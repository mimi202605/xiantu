<template>
  <div class="map-panel">
    <div class="map-header">
      <h2 class="map-title">{{ t('探索地图') }}</h2>
      <div class="map-header-right">
        <div class="map-legend">
          <span class="legend-item current">
            <span class="legend-dot current"></span>
            {{ t('当前位置') }}
          </span>
        </div>
        <button type="button" class="map-help-btn" :title="t('查看地图使用说明')" @click="showMapHelp = true">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </button>
      </div>
    </div>

    <div class="map-content">
      <div v-if="!hasLocations" class="map-empty">
        {{ t('尚无地点记录，游历四方后将逐步显现。') }}
      </div>
      <MapMinimap v-else :entries="locationEntries" />
    </div>
  </div>

  <!-- 地图使用说明弹窗（参考判定窗口 info 设计） -->
  <Teleport to="body">
    <div v-if="showMapHelp" class="map-help-overlay" @click="showMapHelp = false">
      <div class="map-help-modal" @click.stop>
        <div class="map-help-header">
          <h3>📍 {{ t('地图使用说明') }}</h3>
          <button type="button" class="map-help-close" :aria-label="t('关闭')" @click="showMapHelp = false">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="map-help-content">
          <section class="map-help-section">
            <h4>📖 {{ t('概述') }}</h4>
            <p>{{ t('探索地图按层级展示世界地点结构。最外层为大陆或城市等，每个最外层区域使用不同色系，其下所有子地点与该区域同色系。支持缩放、平移与双击进入或回退。') }}</p>
          </section>
          <section class="map-help-section">
            <h4>🔍 {{ t('缩放') }}</h4>
            <p>{{ t('使用左上角 + / - 按钮，或在地图上滚动鼠标滚轮可放大、缩小。') }}</p>
          </section>
          <section class="map-help-section">
            <h4>✋ {{ t('平移') }}</h4>
            <p>{{ t('在地图上按住鼠标拖动可平移视图；触屏设备可单指拖动。') }}</p>
          </section>
          <section class="map-help-section">
            <h4>📂 {{ t('双击进入') }}</h4>
            <p>{{ t('双击某个地点节点可「进入」该区域：视口会缩放并居中到该节点及其直接子节点，便于查看内部结构。') }}</p>
          </section>
          <section class="map-help-section">
            <h4>↩️ {{ t('双击空白回退') }}</h4>
            <p>{{ t('放大到某一区域后，双击空白处（背景或节点外的区域）可回退到上一级；多次双击可回到最外层全图。') }}</p>
          </section>
          <section class="map-help-section">
            <h4>🔄 {{ t('重置视图') }}</h4>
            <p>{{ t('点击重置视图按钮可将整张地图适配到视口并居中。') }}</p>
          </section>
          <section class="map-help-section">
            <h4>🏷️ {{ t('图例') }}</h4>
            <p>{{ t('红色描边表示角色当前位置。悬停地点时在气泡中显示探索状态：已探索、未探索或部分探索（有子地点被探索但该地点本身未到过）。') }}</p>
          </section>
          <section class="map-help-section">
            <h4>🎨 {{ t('色系') }}</h4>
            <p>{{ t('每个最外层区域（如大陆、城市）使用一种色系；其下所有子地点与该区域同色系，便于区分所属。') }}</p>
          </section>
          <section class="map-help-section">
            <h4>📁 {{ t('层级结构') }}</h4>
            <p>{{ t('带圆角的方框表示有子地点的容器，双击可进入查看；小圆点表示无子地点的叶子地点。') }}</p>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useI18n } from '@/i18n';
import type { LocationEntry } from '@/types/game';
import MapMinimap from './components/MapMinimap.vue';

const { t } = useI18n();
const gameStateStore = useGameStateStore();
const showMapHelp = ref(false);

const locationEntries = computed(() => {
  const info = gameStateStore.worldInfo?.地点信息;
  if (!Array.isArray(info)) return [];
  return info.filter((e): e is LocationEntry => e && typeof e === 'object' && typeof (e as any).名称 === 'string');
});

const hasLocations = computed(() => locationEntries.value.length > 0);
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

.map-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.map-help-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s, transform 0.15s;
}
.map-help-btn:hover {
  background: white;
  border-color: var(--color-primary, #6366f1);
  color: var(--color-primary, #6366f1);
  transform: scale(1.08);
}
.map-help-btn:active {
  transform: scale(0.96);
}

/* 地图帮助弹窗（与判定窗口 info 风格一致） */
.map-help-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 24px;
}
.map-help-modal {
  background: var(--color-surface);
  color: var(--color-text);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 560px;
  width: 100%;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.map-help-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-border, #e2e8f0);
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}
.map-help-header h3 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-text);
}
.map-help-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: white;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
.map-help-close:hover {
  background: #fee2e2;
  border-color: #ef4444;
  color: #ef4444;
}
.map-help-content {
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
  max-height: calc(85vh - 72px);
}
.map-help-section {
  margin-bottom: 1.25rem;
}
.map-help-section:last-child {
  margin-bottom: 0;
}
.map-help-section h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
}
.map-help-section p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--color-text-secondary);
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

.legend-dot.current {
  background: transparent;
  border: 2px solid #ef4444;
  box-shadow: 0 0 6px rgba(239, 68, 68, 0.5);
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

[data-theme="dark"] .map-help-modal {
  background: var(--color-surface, #1e293b);
  color: var(--color-text, #f1f5f9);
}
[data-theme="dark"] .map-help-header {
  background: rgba(255, 255, 255, 0.05);
  border-bottom-color: var(--color-border, rgba(255, 255, 255, 0.1));
}
[data-theme="dark"] .map-help-header h3,
[data-theme="dark"] .map-help-section h4 {
  color: var(--color-text, #f1f5f9);
}
[data-theme="dark"] .map-help-section p {
  color: var(--color-text-secondary, #94a3b8);
}
[data-theme="dark"] .map-help-close {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--color-border, rgba(255, 255, 255, 0.1));
  color: var(--color-text-secondary, #94a3b8);
}
[data-theme="dark"] .map-help-close:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
  color: #ef4444;
}
[data-theme="dark"] .map-help-btn {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--color-border, rgba(255, 255, 255, 0.1));
  color: var(--color-text-secondary, #94a3b8);
}
[data-theme="dark"] .map-help-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--color-primary, #6366f1);
  color: var(--color-primary, #6366f1);
}
</style>
