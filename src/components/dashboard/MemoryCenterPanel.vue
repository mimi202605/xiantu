<template>
  <div class="memory-center-panel game-panel">

    <!-- 记忆类型筛选 -->
    <div class="filter-section">
      <div class="filter-tabs">
        <button
          v-for="type in memoryTypes"
          :key="type.key"
          class="filter-tab"
          :class="{ active: activeFilter === type.key }"
          @click="setActiveFilter(type.key)"
        >
          <span class="tab-icon">{{ type.icon }}</span>
          <span class="tab-name">{{ t(type.name) }}</span>
          <span class="tab-count">{{ getTypeCount(type.key) }}</span>
        </button>
        <button
          class="settings-toggle-btn"
          @click="showSettings = !showSettings"
          :class="{ active: showSettings }"
          :title="t('记忆系统设置')"
        >
          <Settings :size="16" />
        </button>
      </div>
    </div>

    <!-- 导出工具（已发送信息不导出为小说） -->
    <div class="export-section" v-if="!showSettings && activeFilter !== 'vector' && activeFilter !== 'sent'">
      <button
        class="export-btn-main"
        @click="exportMemoriesAsNovel"
        :title="t('将完整的游戏对话历史（基于叙事历史）导出为小说格式，方便阅读和分享。')"
      >
        {{ t('📖 导出为小说') }}
      </button>
      <div class="export-hint">
        {{ t('将完整的游戏对话历史（基于叙事历史）导出为小说格式，方便阅读和分享。') }}
      </div>
    </div>

    <!-- 记忆系统设置 -->
    <div class="settings-section" v-if="showSettings">
      <div class="settings-header">
        <span class="settings-title">⚙️ {{ t('记忆系统配置') }}</span>
        <div class="header-actions">
          <button
            class="test-btn"
            @click="addTestMediumTermMemory"
            :title="t('添加测试中期记忆')"
          >
            🧪 {{ t('测试') }}
          </button>
          <button
            class="settings-close-btn"
            @click="showSettings = false"
          >✕</button>
        </div>
      </div>

      <div class="settings-content">
        <!-- 短期记忆 -->
        <section class="memory-config-section">
          <h4 class="memory-config-section-title">{{ t('短期记忆') }}</h4>
          <div class="setting-item">
            <label class="setting-label">{{ t('短期记忆上限（条）：') }}</label>
            <input
              type="number"
              v-model.number="memoryConfig.shortTermLimit"
              min="3"
              max="10"
              class="setting-input setting-input-num"
            />
            <span class="setting-hint">{{ t('默认') }}: 5</span>
          </div>
        </section>

        <!-- 中期精炼 -->
        <section class="memory-config-section">
          <h4 class="memory-config-section-title">{{ t('中期精炼') }}</h4>
          <div class="setting-item">
            <label class="setting-label">{{ t('精炼触发阈值（条）：') }}</label>
            <input
              type="number"
              v-model.number="memoryConfig.midTermRefineTrigger"
              min="10"
              max="100"
              class="setting-input setting-input-num"
            />
            <span class="setting-hint">{{ t('达到此数量时自动精炼中期记忆（去重合并）。默认：25') }}</span>
          </div>
        </section>

        <!-- 长期总结 -->
        <section class="memory-config-section">
          <h4 class="memory-config-section-title">{{ t('长期总结') }}</h4>
          <div class="setting-item">
            <label class="setting-label">{{ t('总结触发阈值（条）：') }}</label>
            <input
              type="number"
              v-model.number="memoryConfig.longTermTrigger"
              min="20"
              max="100"
              class="setting-input setting-input-num"
            />
            <span class="setting-hint">{{ t('达到此数量时自动将中期记忆转化为长期记忆。默认：50') }}</span>
          </div>
          <div class="setting-item">
            <label class="setting-label">{{ t('总结后保留中期数量（条）：') }}</label>
            <input
              type="number"
              v-model.number="memoryConfig.midTermKeep"
              min="-1"
              max="50"
              class="setting-input setting-input-num"
            />
            <span class="setting-hint">{{ t('总结后保留的最新中期条数；-1 表示不删减。默认：-1') }}</span>
          </div>
          <div v-if="memoryConfig.midTermKeep === -1" class="setting-sub-panel">
            <div class="setting-sub-panel-label">{{ t('当保留数量为 -1 时') }}</div>
            <div class="setting-item">
              <label class="setting-label">{{ t('不删减时参与总结的条数：') }}</label>
              <input
                type="number"
                v-model.number="memoryConfig.longTermSummarizeCount"
                min="5"
                max="100"
                class="setting-input setting-input-num"
              />
              <span class="setting-hint">{{ t('保留数量为 -1 时，取最旧 N 条生成 1 条长期。默认：50') }}</span>
            </div>
          </div>
          <div class="setting-item">
            <label class="setting-label setting-label-checkbox">
              <input
                type="checkbox"
                v-model="memoryConfig.autoSummaryEnabled"
                class="setting-checkbox"
              />
              {{ t('启用自动记忆转化') }}
            </label>
            <span class="setting-hint">{{ t('启用后，达到阈值时自动精炼或长期总结。禁用则仅手动触发。') }}</span>
          </div>
        </section>

        <!-- 自定义格式（高级） -->
        <section class="memory-config-section">
          <h4 class="memory-config-section-title">{{ t('自定义格式') }}</h4>
          <div class="setting-item">
            <label class="setting-label">{{ t('中期记忆格式（可选）：') }}</label>
            <textarea
              v-model="memoryConfig.midTermFormat"
              class="setting-textarea"
              :placeholder="t('留空使用默认格式。可自定义AI提示词来控制记忆的生成格式...')"
              rows="3"
            ></textarea>
            <span class="setting-hint">{{ t('自定义中期记忆的AI提示词格式。留空使用系统默认。') }}</span>
          </div>
          <div class="setting-item">
            <label class="setting-label">{{ t('长期记忆格式（可选）：') }}</label>
            <textarea
              v-model="memoryConfig.longTermFormat"
              class="setting-textarea"
              :placeholder="t('留空使用默认格式。可自定义AI提示词来控制记忆的生成格式...')"
              rows="3"
            ></textarea>
            <span class="setting-hint">{{ t('自定义长期记忆的AI提示词格式。留空使用系统默认。') }}</span>
          </div>
        </section>

        <div class="settings-actions">
          <button
            class="action-btn success"
            @click="saveMemoryConfig"
          >
            💾 {{ t('保存配置') }}
          </button>
          <button
            class="action-btn info"
            @click="resetMemoryConfig"
          >
            {{ t('重置为默认') }}
          </button>
        </div>

        <!-- 手动操作 -->
        <section class="memory-config-section manual-summary-section">
          <h4 class="memory-config-section-title">{{ t('手动操作') }}</h4>
          <div class="summary-info">
            <span class="info-text">{{ t('当前中期记忆：') }} <strong>{{ mediumTermMemories.length }}</strong> {{ t('条') }}</span>
            <span class="info-hint">{{ t('精炼阈值：{count}条', { count: memoryConfig.midTermRefineTrigger }) }} · {{ t('长期总结阈值：{count}条', { count: memoryConfig.longTermTrigger }) }}</span>
            <span class="info-hint info-hint-sub">{{ t('总结仅使用中期记忆转化为长期记忆，与主回合发送逻辑一致') }}</span>
          </div>
          <div class="manual-summary-buttons">
            <button
              class="action-btn info"
              @click="manualTriggerRefine"
              :disabled="mediumTermMemories.length < memoryConfig.midTermRefineTrigger"
              :title="mediumTermMemories.length < memoryConfig.midTermRefineTrigger ? t('manualRefineRequirement', { count: memoryConfig.midTermRefineTrigger }) : t('手动精炼中期记忆')"
            >
              🔄 {{ t('手动精炼中期记忆') }}
            </button>
            <button
              class="action-btn warning"
              @click="manualTriggerSummary"
              :disabled="mediumTermMemories.length < memoryConfig.longTermTrigger"
              :title="mediumTermMemories.length < memoryConfig.longTermTrigger ? t('manualLongTermRequirement', { count: memoryConfig.longTermTrigger }) : t('手动触发长期总结')"
            >
              📝 {{ t('手动触发长期总结') }}
            </button>
          </div>
        </section>
      </div>
    </div>

    <!-- 记忆列表 -->
    <div class="panel-content" v-if="!showSettings">
      <!-- 已发送信息：仅记录玩家发给 API 的原文，不参与 prompt -->
      <template v-if="activeFilter === 'sent'">
        <div class="sent-section">
          <div class="sent-hint">{{ t('已发送信息说明') }}</div>
          <div v-if="!sentMessagesList.length" class="empty-state">
            <div class="empty-icon">📤</div>
            <div class="empty-text">{{ t('暂无已发送信息') }}</div>
          </div>
          <div v-else class="sent-list">
            <div
              v-for="(item, index) in sentMessagesList"
              :key="item.timestamp + '-' + index"
              class="sent-card"
            >
              <div class="sent-card-header">
                <span class="sent-time">{{ formatSentTime(item.timestamp) }}</span>
                <button
                  type="button"
                  class="sent-copy-btn"
                  :title="t('复制')"
                  @click="copySentMessage(item.text)"
                >
                  {{ t('复制') }}
                </button>
              </div>
              <pre class="sent-text">{{ item.text }}</pre>
            </div>
          </div>
        </div>
      </template>

      <template v-else>
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner">⏳</div>
        <div class="loading-text">{{ t('正在读取记忆...') }}</div>
      </div>

      <div v-else-if="filteredMemories.length === 0" class="empty-state">
        <div class="empty-icon">🧠</div>
        <div class="empty-text">{{ getEmptyText() }}</div>
      </div>

      <div v-else>
        <!-- 分页控制 -->
        <div class="pagination-controls" v-if="filteredMemoriesAll.length > pageSize">
          <div class="pagination-info">
            {{ t('第 {currentPage} / {totalPages} 页，共 {total} 条记忆', { currentPage, totalPages, total: filteredMemoriesAll.length }) }}
          </div>
          <div class="pagination-buttons">
            <button
              class="page-btn"
              @click="goToFirstPage"
              :disabled="currentPage === 1"
              :title="t('首页')"
            >
              <ChevronsLeft :size="16" />
            </button>
            <button
              class="page-btn"
              @click="goToPage(currentPage - 1)"
              :disabled="currentPage === 1"
              :title="t('上一页')"
            >
              <ChevronLeft :size="16" />
            </button>
            <button
              class="page-btn"
              @click="goToPage(currentPage + 1)"
              :disabled="currentPage === totalPages"
              :title="t('下一页')"
            >
              <ChevronRight :size="16" />
            </button>
            <button
              class="page-btn"
              @click="goToLastPage"
              :disabled="currentPage === totalPages"
              :title="t('末页')"
            >
              <ChevronsRight :size="16" />
            </button>
          </div>
          <div class="pagination-jump">
            <input
              type="number"
              v-model="jumpToPage"
              :placeholder="t('页')"
              class="jump-input"
              @keyup.enter="handleJumpToPage"
              min="1"
              :max="totalPages"
            />
            <button class="jump-btn" @click="handleJumpToPage">{{ t('跳转') }}</button>
          </div>
        </div>

        <div class="memory-list">
          <div
            v-for="(memory, index) in filteredMemories"
            :key="index"
            class="memory-card"
            :class="`memory-${memory.type}`"
          >
          <div class="memory-header">
            <div class="memory-type-badge" :class="`badge-${memory.type}`">
              {{ getTypeIcon(memory.type) }} {{ getTypeName(memory.type) }}
            </div>
            <div class="memory-actions">
              <button
                class="delete-memory-btn"
                @click.stop="deleteMemory(memory)"
                :title="t('删除此记忆')"
              >
                🗑️
              </button>
              <div class="memory-time">{{ memory.time }}</div>
            </div>
          </div>

          <div class="memory-content">
            <div v-if="memory.parsedContent && memory.parsedContent.format" class="structured-memory">
              <div class="memory-title" v-if="memory.parsedContent.title">
                【{{ memory.parsedContent.title }}】
              </div>

              <template v-for="section in memory.parsedContent.format.sections" :key="section.key">
                <div
                  v-if="memory.parsedContent.sections && memory.parsedContent.sections[section.key]"
                  class="memory-section-group"
                >
                <div class="memory-section">
                  <span class="memory-icon">{{ section.icon }}</span>
                  <span class="memory-section-title">{{ section.title }}</span>
                </div>
                <!-- 确保只在数组时才遍历，字符串直接显示 -->
                <template v-if="Array.isArray(memory.parsedContent.sections[section.key])">
                  <div
                    v-for="item in memory.parsedContent.sections[section.key]"
                    :key="item"
                    class="memory-item"
                  >
                    {{ item }}
                  </div>
                </template>
                <div v-else class="memory-item">
                  {{ memory.parsedContent.sections[section.key] }}
                </div>
              </div>
              </template>

              <!-- 未识别的通用内容 -->
              <div
                v-if="memory.parsedContent.sections['general']"
                class="memory-section-group"
              >
                <div class="memory-section">
                  <span class="memory-icon">📝</span>
                  <span class="memory-section-title">{{ t('其他记录') }}</span>
                </div>
                <!-- 确保只在数组时才遍历，字符串直接显示 -->
                <template v-if="Array.isArray(memory.parsedContent.sections['general'])">
                  <div
                    v-for="item in memory.parsedContent.sections['general']"
                    :key="item"
                    class="memory-item"
                  >
                    {{ item }}
                  </div>
                </template>
                <div v-else class="memory-item">
                  {{ memory.parsedContent.sections['general'] }}
                </div>
              </div>
            </div>

            <div v-else class="simple-memory">
              {{ memory.content }}
            </div>
          </div>
          </div>
        </div>

        <!-- 底部分页控制 -->
        <div class="pagination-controls bottom" v-if="filteredMemoriesAll.length > pageSize">
          <div class="pagination-info">
            {{ t('页') }} {{ currentPage }} / {{ totalPages }}
          </div>
          <div class="pagination-buttons">
            <button
              class="page-btn"
              @click="goToFirstPage"
              :disabled="currentPage === 1"
            >
              <ChevronsLeft :size="16" />
            </button>
            <button
              class="page-btn"
              @click="goToPage(currentPage - 1)"
              :disabled="currentPage === 1"
            >
              <ChevronLeft :size="16" />
            </button>
            <button
              class="page-btn"
              @click="goToPage(currentPage + 1)"
              :disabled="currentPage === totalPages"
            >
              <ChevronRight :size="16" />
            </button>
            <button
              class="page-btn"
              @click="goToLastPage"
              :disabled="currentPage === totalPages"
            >
              <ChevronsRight :size="16" />
            </button>
          </div>
        </div>
      </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Settings, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-vue-next';
import { useI18n } from '@/i18n';
import { panelBus } from '@/utils/panelBus';
import { useCharacterStore } from '@/stores/characterStore';
import { isTavernEnv } from '@/utils/tavern';
import { useGameStateStore } from '@/stores/gameStateStore'; // 导入 gameStateStore
import { toast } from '@/utils/toast';
import { debug } from '@/utils/debug';
import { type MemoryFormatConfig } from '@/utils/memoryFormatConfig';
import { AIBidirectionalSystem } from '@/utils/AIBidirectionalSystem'; // 导入AI系统



interface Memory {
  type: 'short' | 'medium' | 'long';
  content: string;
  time: string;
  parsedContent?: {
    title?: string;
    sections: { [key: string]: string[] };
    format?: MemoryFormatConfig;
    事件?: string;
    时间?: string;
    地点?: string;
    人物?: string;
    影响?: string;
  };
  // 新增字段用于记忆转化逻辑
  originalIndex?: number; // 原始索引位置
  isConverted?: boolean; // 是否是转化后的记忆
  isSummarized?: boolean; // 是否是AI总结后的记忆
  importance?: number; // 记忆重要性（1-10）
}

const characterStore = useCharacterStore();
const isTavernEnvFlag = isTavernEnv();
const gameStateStore = useGameStateStore(); // 实例化 gameStateStore
// const apiManagementStore = useAPIManagementStore(); // [MING] Removed unused store
const { t } = useI18n();
// const saveData = computed(() => characterStore.activeSaveSlot?.存档数据); // [已废弃]
const loading = ref(false);
const activeFilter = ref('all');
const showSettings = ref(false);

// 分页相关
const currentPage = ref(1);
const pageSize = ref(10);
const jumpToPage = ref('');

// 记忆系统配置
const memoryConfig = ref({
  shortTermLimit: 5,
  midTermRefineTrigger: 25, // 中期精炼触发条数
  longTermTrigger: 50, // 中期→长期总结触发条数
  midTermKeep: -1, // 长期总结后保留中期条数，-1 表示不删减
  longTermSummarizeCount: 50, // midTermKeep=-1 时，参与本次长期总结的条数
  autoSummaryEnabled: true,
  midTermFormat: '',
  longTermFormat: '',
  useRawMode: true,
  useStreaming: true,
});

// 记忆转化配置
const MEMORY_CONFIG = {
  SHORT_TERM_LIMIT: 3, // 短期记忆上限（与后端同步）
  MEDIUM_TERM_LIMIT: 25, // 中期记忆上限（与后端同步）
  LONG_TERM_LIMIT: 50, // 长期记忆上限
  CONVERT_THRESHOLD: 0.8 // 转化阈值（达到上限的80%就开始转化）
};

// 记忆数据 - 按类型分类存储
const shortTermMemories = ref<Memory[]>([]);
const mediumTermMemories = ref<Memory[]>([]);
const longTermMemories = ref<Memory[]>([]);



// 合并所有记忆用于显示
const memories = computed(() => {
  const allMemories = [
    ...longTermMemories.value,
    ...mediumTermMemories.value,
    ...shortTermMemories.value
  ];
  return allMemories.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
});

// 记忆类型
const memoryTypes = computed(() => [
  { key: 'all', name: t('全部'), icon: '🧠' },
  { key: 'short', name: t('短期'), icon: '⚡' },
  { key: 'medium', name: t('中期'), icon: '💭' },
  { key: 'long', name: t('长期'), icon: '💾' },
  { key: 'sent', name: t('已发送信息'), icon: '📤' },
  // { key: 'vector', name: '向量库', icon: '🧬' }
]);

// 筛选后的记忆（不分页）
const filteredMemoriesAll = computed(() => {
  if (activeFilter.value === 'all') {
    return memories.value;
  }

  switch (activeFilter.value) {
    case 'short': return shortTermMemories.value;
    case 'medium': return mediumTermMemories.value;
    case 'long': return longTermMemories.value;
    default: return memories.value;
  }
});

// 总页数
const totalPages = computed(() => {
  return Math.ceil(filteredMemoriesAll.value.length / pageSize.value) || 1;
});

// 当前页的记忆（分页后）
const filteredMemories = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredMemoriesAll.value.slice(start, end);
});

// 总记忆数量
const totalMemoryCount = computed(() =>
  shortTermMemories.value.length + mediumTermMemories.value.length + longTermMemories.value.length
);

// 已发送信息列表（仅供查阅，不参与 prompt）
const sentMessagesList = computed(() => {
  const list = gameStateStore.sentToApiMessages;
  return Array.isArray(list) ? [...list] : [];
});

// 获取类型数量
const getTypeCount = (type: string): number => {
  if (type === 'all') return totalMemoryCount.value;
  switch (type) {
    case 'short': return shortTermMemories.value.length;
    case 'medium': return mediumTermMemories.value.length;
    case 'long': return longTermMemories.value.length;
    case 'sent': return sentMessagesList.value.length;
    default: return 0;
  }
};

// 获取空状态文本
const getEmptyText = (): string => {
  if (activeFilter.value === 'all') return t('心如明镜，尚未记录任何修行感悟');
  if (activeFilter.value === 'sent') return t('暂无已发送信息');
  const type = memoryTypes.value.find(t => t.key === activeFilter.value);
  return t('暂无{type}记忆', { type: type?.name });
};

// 已发送信息：格式化时间
const formatSentTime = (timestamp: number): string => {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

// 已发送信息：复制到剪贴板（优先 Clipboard API，失败时用 execCommand 兜底）
const copySentMessage = async (text: string) => {
  const doFallbackCopy = (): boolean => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      document.body.removeChild(textarea);
      return false;
    }
  };

  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      toast.success(t('已复制到剪贴板'));
      return;
    }
  } catch {
    // 非安全上下文或权限被拒时 fallback
  }
  if (doFallbackCopy()) {
    toast.success(t('已复制到剪贴板'));
  } else {
    toast.error(t('复制失败'));
  }
};

// 获取类型图标
const getTypeIcon = (type: string): string => {
  const iconMap: Record<string, string> = {
    'short': '⚡',
    'medium': '💭',
    'long': '💾'
  };
  return iconMap[type] || '🧠';
};

// 获取类型名称
const getTypeName = (type: string): string => {
  const nameMap: Record<string, string> = {
    'short': t('短期记忆'),
    'medium': t('中期记忆'),
    'long': t('长期记忆')
  };
  return nameMap[type] || t('未知');
};

// 格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
};

// 此函数已废弃，逻辑已移至 AIBidirectionalSystem.ts
// const summarizeMidTermToLongTerm = async () => { ... };

/**
 * 保存记忆数据到存档
 */
const saveMemoriesToStore = async () => {
  try {
    if (!gameStateStore.memory) {
      debug.warn('记忆中心', 'gameStateStore.memory 不存在，无法保存记忆');
      // 如果不存在，则创建一个空的记忆对象
      gameStateStore.memory = { 短期记忆: [], 中期记忆: [], 长期记忆: [], 隐式中期记忆: [] };
    }

    // 写入 store（新数组引用以触发响应式），格式与 loadMemoryData 读取一致
    const shortArr = shortTermMemories.value.map(m => m.content);
    const midArr = mediumTermMemories.value.map(m => m.content);
    const longArr = longTermMemories.value.map(m => m.content);
    gameStateStore.memory.短期记忆 = shortArr;
    gameStateStore.memory.中期记忆 = [...midArr];
    gameStateStore.memory.长期记忆 = longArr;

    // 触发存档保存
    await characterStore.saveCurrentGame();

    debug.log('记忆中心', '记忆数据已保存到存档');
  } catch (error) {
    debug.error('记忆中心', '保存记忆数据到存档失败:', error);
    throw error;
  }
};

// 记忆转化功能
const convertMemories = () => {
  let hasConversion = false;

  // 检查短期记忆是否达到转化阈值（使用配置的上限）
  const shortLimit = typeof memoryConfig.value.shortTermLimit === 'number' && memoryConfig.value.shortTermLimit > 0
    ? memoryConfig.value.shortTermLimit
    : 5;
  if (shortTermMemories.value.length >= shortLimit) {
    debug.log('记忆中心', '短期记忆达到上限，开始转化为中期记忆');

    // 取最早的短期记忆转化为中期记忆
    const oldestShort = shortTermMemories.value.shift();
    if (oldestShort) {
      const convertedMemory: Memory = {
        ...oldestShort,
        type: 'medium',
        time: t('convertedAt', { time: formatTime(Date.now()) }),
        isConverted: true
      };
      mediumTermMemories.value.push(convertedMemory);
      hasConversion = true;
    }
  }

  // 检查中期记忆是否达到长期总结阈值
  const longTermTrigger = memoryConfig.value.longTermTrigger ?? 50;
  if (mediumTermMemories.value.length >= longTermTrigger && memoryConfig.value.autoSummaryEnabled) {
    debug.log('记忆中心', '中期记忆达到长期总结阈值，将在后台触发AI总结');
    AIBidirectionalSystem.triggerMemorySummary({
      useRawMode: memoryConfig.value.useRawMode,
      useStreaming: memoryConfig.value.useStreaming
    }).catch(error => {
      debug.error('记忆中心', '自动总结失败:', error);
    });
  } else if (mediumTermMemories.value.length >= longTermTrigger && !memoryConfig.value.autoSummaryEnabled) {
    // 未启用自动总结，直接转化（旧逻辑）
    const oldestMedium = mediumTermMemories.value.shift();
    if (oldestMedium) {
      const convertedMemory: Memory = {
        ...oldestMedium,
        type: 'long',
        time: t('archivedAt', { time: formatTime(Date.now()) }),
        importance: Math.max(oldestMedium.importance || 5, 7),
        isConverted: true
      };
      longTermMemories.value.push(convertedMemory);
      hasConversion = true;
    }
  }

  // 检查长期记忆是否超限
  if (longTermMemories.value.length > MEMORY_CONFIG.LONG_TERM_LIMIT) {
    // 按重要性排序，保留重要的
    longTermMemories.value.sort((a, b) => (b.importance || 5) - (a.importance || 5));
    const removed = longTermMemories.value.splice(MEMORY_CONFIG.LONG_TERM_LIMIT);
    debug.log('记忆中心', `长期记忆超限，移除${removed.length}条低重要性记忆`);
  }

  if (hasConversion) {
    toast.success(t('记忆已重新整理，旧记忆已转化'));
  }
};

// 添加记忆的功能
const addMemory = (type: 'short' | 'medium' | 'long', content: string, importance: number = 5, parsedContent?: Memory['parsedContent']) => {
  const memory: Memory = {
    type,
    content,
    time: formatTime(Date.now()),
    importance,
    parsedContent
  };

  switch (type) {
    case 'short':
      shortTermMemories.value.push(memory);
      break;
    case 'medium':
      mediumTermMemories.value.push(memory);
      break;
    case 'long':
      longTermMemories.value.push(memory);
      break;
  }

  // 检查是否需要转化
  convertMemories();
};

// 设置活跃筛选器
const setActiveFilter = async (filterKey: string) => {
  activeFilter.value = filterKey;
  currentPage.value = 1; // 切换筛选器时重置到第一页
  jumpToPage.value = '';
};

const getActiveTotalPages = () => totalPages.value;

// 分页相关函数
const goToPage = (page: number) => {
  const max = getActiveTotalPages();
  if (page >= 1 && page <= max) {
    currentPage.value = page;
  }
};

const goToFirstPage = () => {
  currentPage.value = 1;
};

const goToLastPage = () => {
  currentPage.value = getActiveTotalPages();
};

const handleJumpToPage = () => {
  const page = parseInt(jumpToPage.value);
  const max = getActiveTotalPages();
  if (!isNaN(page) && page >= 1 && page <= max) {
    currentPage.value = page;
    jumpToPage.value = '';
  } else {
    toast.warning(`请输入 1-${max} 之间的页码`);
  }
};

// 清理记忆（使用全局确认弹窗）
import { useUIStore } from '@/stores/uiStore';
const uiStore = useUIStore();

const clearMemory = async () => {
  uiStore.showRetryDialog({
    title: t('清空记忆'),
    message: isTavernEnvFlag
      ? t('确定要清空所有记忆吗？此操作不可撤销，同时会清空酒馆数据。')
      : '确定要清空所有记忆吗？此操作不可撤销。',
    confirmText: t('确认清空'),
    cancelText: t('取消'),
    onConfirm: async () => {
      try {
        // 清理本地显示数据
        shortTermMemories.value = [];
        mediumTermMemories.value = [];
        longTermMemories.value = [];

        // 同步清理 gameStateStore 中的数据
        if (gameStateStore.memory) {
          gameStateStore.memory.短期记忆 = [];
          gameStateStore.memory.中期记忆 = [];
          gameStateStore.memory.长期记忆 = [];
        }

        // 保存变更
        await characterStore.saveCurrentGame();

        toast.success(isTavernEnvFlag ? t('记忆已清空并同步到酒馆') : '记忆已清空');
      } catch (error) {
        console.error('[记忆中心] 清理记忆失败:', error);
        toast.error(t('清空记忆失败，请重试'));
      }
    },
    onCancel: () => {}
  });
};

// 测试记忆转化功能（保留但不使用）
// const testMemoryConversion = () => {
//   const testMessages = [
//     '今日在练功房修炼《太极心经》，有所感悟',
//     '与师兄切磋武艺，招式精进不少',
//     '在藏书阁阅读古籍，了解到远古修真历史',
//     '炼制了几枚回气丹，成功率提升',
//     '探索后山秘境，发现奇异灵草'
//   ];
//
//   const randomMessage = testMessages[Math.floor(Math.random() * testMessages.length)];
//   addMemory('short', randomMessage, Math.floor(Math.random() * 5) + 5);
//
//   toast.success(`已添加测试记忆: ${randomMessage.substring(0, 20)}...`);
// };

// 加载记忆数据 - 简化版本：直接从存档数据读取字符串数组
const loadMemoryData = async () => {
  try {
    debug.log('记忆中心', '开始加载记忆数据');

    const loadedShortMemories: Memory[] = [];
    const loadedMediumMemories: Memory[] = [];
    const loadedLongMemories: Memory[] = [];

    // 直接从 gameStateStore 获取记忆
    const memoryData = gameStateStore.memory;

    if (memoryData) {
      debug.log('记忆中心', '从存档数据加载记忆:', Object.keys(memoryData));

      // 短期记忆 - 字符串数组
      if (Array.isArray(memoryData.短期记忆)) {
        memoryData.短期记忆.forEach((content: string, index: number) => {
          if (content && typeof content === 'string') {
            const memory: Memory = {
              type: 'short',
              content,
              time: formatTime(Date.now() - index * 300000), // 5分钟间隔
              importance: 5
            };
            loadedShortMemories.push(memory);
          }
        });
      }

      // 中期记忆 - 支持 string 或 { 记忆主体, 已精炼? } 格式
      if (Array.isArray(memoryData.中期记忆)) {
        memoryData.中期记忆.forEach((entry: any, index: number) => {
          const content = typeof entry === 'string' ? entry : (entry?.记忆主体 ?? '');
          if (content) {
            const memory: Memory = {
              type: 'medium',
              content,
              time: formatTime(Date.now() - index * 3600000),
              importance: 7
            };
            loadedMediumMemories.push(memory);
          }
        });
      }

      // 长期记忆 - 字符串数组
      if (Array.isArray(memoryData.长期记忆)) {
        debug.log('记忆中心', `发现长期记忆数组，长度: ${memoryData.长期记忆.length}`);
        debug.log('记忆中心', '长期记忆原始数据:', memoryData.长期记忆);

        memoryData.长期记忆.forEach((content: string, index: number) => {
          if (content && typeof content === 'string') {
            const memory: Memory = {
              type: 'long',
              content,
              time: formatTime(Date.now() - index * 86400000), // 1天间隔
              importance: 9
            };
            loadedLongMemories.push(memory);
            debug.log('记忆中心', `加载长期记忆 #${index}:`, content.substring(0, 50));
          }
        });
      } else {
        debug.warn('记忆中心', '长期记忆不是数组或不存在:', memoryData.长期记忆);
      }

      debug.log('记忆中心', `记忆加载完成: 短期${loadedShortMemories.length}, 中期${loadedMediumMemories.length}, 长期${loadedLongMemories.length}`);
    } else {
      debug.warn('记忆中心', '未找到存档记忆数据');
    }

    // 更新显示状态
    shortTermMemories.value = loadedShortMemories;
    mediumTermMemories.value = loadedMediumMemories;
    longTermMemories.value = loadedLongMemories;

    // 统计各类型记忆数量
    const totalMemories = loadedShortMemories.length + loadedMediumMemories.length + loadedLongMemories.length;
    debug.log('记忆中心', `记忆加载完成：总计 ${totalMemories} 条记忆`);

  } catch (error) {
    debug.error('记忆中心', '加载记忆数据失败', error);
    toast.error('加载记忆数据失败');
  }
};

// 记忆配置管理功能
const loadMemoryConfig = async () => {
  try {
    const saved = localStorage.getItem('memory-settings');
    if (saved) {
      const settings = JSON.parse(saved);
      memoryConfig.value = { ...memoryConfig.value, ...settings };
      // 兼容旧配置：仅有 midTermTrigger 时视为精炼阈值，长期阈值用默认 50
      if (typeof (settings as any).midTermTrigger === 'number' && (settings as any).longTermTrigger == null) {
        memoryConfig.value.midTermRefineTrigger = (settings as any).midTermTrigger;
        memoryConfig.value.longTermTrigger = 50;
      }
      if ((settings as any).midTermKeep == null && (settings as any).midTermTrigger != null) {
        memoryConfig.value.midTermKeep = -1;
        memoryConfig.value.longTermSummarizeCount = 50;
      }
      debug.log('记忆中心', '已从localStorage加载配置', memoryConfig.value);
      return;
    }
    debug.log('记忆中心', '未找到配置，使用默认值');
  } catch (error) {
    debug.error('记忆中心', '加载记忆配置失败:', error);
  }
};

const saveMemoryConfig = async () => {
  try {
    // 🔥 [新架构] 保存到 localStorage
    localStorage.setItem('memory-settings', JSON.stringify(memoryConfig.value));

    // 发送全局事件，通知其他面板配置已更新
    panelBus.emit('memory-settings-updated', memoryConfig.value);

    toast.success('记忆系统配置已保存');
    debug.log('记忆中心', '配置已保存:', memoryConfig.value);
  } catch (error) {
    debug.error('记忆中心', '保存配置失败:', error);
    toast.error('保存配置失败');
  }
};

const resetMemoryConfig = () => {
  memoryConfig.value = {
    shortTermLimit: 5,
    midTermRefineTrigger: 25,
    longTermTrigger: 50,
    midTermKeep: -1,
    longTermSummarizeCount: 50,
    autoSummaryEnabled: true,
    midTermFormat: '',
    longTermFormat: '',
    useRawMode: true,
    useStreaming: true,
  };
  toast.success('配置已重置为默认值');
};

/**
 * 手动触发中期记忆精炼
 */
const manualTriggerRefine = async () => {
  const minRequired = memoryConfig.value.midTermRefineTrigger;
  if (mediumTermMemories.value.length < minRequired) {
    toast.warning(t('manualRefineRequirement', { count: minRequired }));
    return;
  }
  await AIBidirectionalSystem.triggerMidTermRefine();
};

/**
 * 手动触发中期记忆→长期记忆的AI总结
 */
const manualTriggerSummary = async () => {
  const minRequired = memoryConfig.value.longTermTrigger;
  if (mediumTermMemories.value.length < minRequired) {
    toast.warning(t('manualLongTermRequirement', { count: minRequired }));
    return;
  }
  await AIBidirectionalSystem.triggerMemorySummary({
    useRawMode: memoryConfig.value.useRawMode,
    useStreaming: memoryConfig.value.useStreaming
  });
};

/**
 * 删除单条记忆（同时删除本地显示、IndexedDB存档和酒馆变量）
 * 这是唯一能完整删除记忆的方法，确保三处数据同步
 */
const deleteMemory = async (memory: Memory) => {
  uiStore.showRetryDialog({
    title: t('删除记忆'),
    message: t('confirmDeleteMemory', { type: getTypeName(memory.type), content: memory.content.substring(0, 50) }),
    confirmText: t('删除'),
    cancelText: t('取消'),
    onConfirm: async () => {
      try {
        // 🔥 步骤1：从显示数组中删除
        let actualIndex = -1;
        switch (memory.type) {
          case 'short':
            actualIndex = shortTermMemories.value.findIndex(m => m === memory);
            if (actualIndex !== -1) {
              shortTermMemories.value.splice(actualIndex, 1);
            }
            break;
          case 'medium':
            actualIndex = mediumTermMemories.value.findIndex(m => m === memory);
            if (actualIndex !== -1) {
              mediumTermMemories.value.splice(actualIndex, 1);
            }
            break;
          case 'long':
            actualIndex = longTermMemories.value.findIndex(m => m === memory);
            if (actualIndex !== -1) {
              longTermMemories.value.splice(actualIndex, 1);
            }
            break;
        }

        if (actualIndex === -1) {
          toast.error(t('未找到要删除的记忆'));
          return;
        }

        // 保存到 gameStateStore 和 IndexedDB
        await saveMemoriesToStore();

        debug.log('记忆中心', `✅ 已删除${getTypeName(memory.type)}并同步到存档`);
        toast.success(t('memoryDeleted', { type: getTypeName(memory.type) }));
      } catch (error) {
        debug.error('记忆中心', '删除记忆失败:', error);
        const errorMsg = error instanceof Error ? error.message : '未知错误';
        toast.error(t('deleteFailed', { error: errorMsg }));
      }
    },
    onCancel: () => {}
  });
};

/**
 * [重构] 导出叙事历史为小说格式
 */
const exportMemoriesAsNovel = () => {
  try {
    const characterName = gameStateStore.character?.名字 || t('修仙者');
    const worldName = gameStateStore.worldInfo?.世界名称 || t('修仙世界');
    const narrativeHistory = gameStateStore.narrativeHistory || [];

    if (narrativeHistory.length === 0) {
      toast.warning(t('没有叙事历史可导出'));
      return;
    }

    // 生成小说格式的文本
    let novelText = t('novelTitle', { characterName }) + '\n\n';
    novelText += `${t('世界档案')}: ${worldName}\n`;
    novelText += `${t('导出时间')}: ${new Date().toLocaleString('zh-CN')}\n`;
    novelText += `${t('总段落数')}: ${narrativeHistory.length}\n`;
    novelText += `\n${'='.repeat(60)}\n\n`;

    narrativeHistory.forEach((entry, index) => {
      const isPlayer = entry.type === 'user' || entry.type === 'player';
      const content = entry.content.replace(/【.*?】/g, '').trim(); // 移除时间戳

      if (isPlayer) {
        novelText += `${t('我说')}: "${content}"\n`;
      } else {
        novelText += `${content}\n`;
      }

      // 每条之间添加分隔线
      novelText += `${'─'.repeat(50)}\n\n`;

      // 每10个段落添加一个章节分隔符
      if ((index + 1) % 10 === 0) {
        novelText += `\n${'═'.repeat(50)}\n`;
        novelText += `${t('第')} ${Math.floor((index + 1) / 10)}\n`;
        novelText += `${'═'.repeat(50)}\n\n`;
      }
    });

    // 创建下载
    const blob = new Blob([novelText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${characterName}_修仙历程_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(t('narrativeHistoryExported', { count: narrativeHistory.length }));
  } catch (error) {
    console.error('[记忆中心] 导出失败:', error);
    toast.error(t('导出失败，请查看控制台'));
  }
};

onMounted(async () => {
  await loadMemoryData();
  await loadMemoryConfig();
  await loadMemoryConfig();

  // 绑定统一顶栏动作
  panelBus.on('refresh', async () => {
    loading.value = true;
    try { await loadMemoryData(); } finally { loading.value = false; }
  });
  panelBus.on('test', () => {
    addMemory('short', '【测试记忆】用于检验转化与渲染。');
  });
  panelBus.on('clear', async () => {
    await clearMemory();
  });
});

// 测试函数：添加一条中期记忆（仅写入中期列表并同步到 store，保存后从 store 重载以保持 tab 计数一致）
const addTestMediumTermMemory = async () => {
  try {
    const testContent = `测试中期记忆 ${Date.now()} - 这是一条用于测试的中期记忆记录。`;
    const testMemory: Memory = {
      content: testContent,
      time: formatTime(Date.now()),
      type: 'medium',
      isConverted: false,
      isSummarized: false,
      parsedContent: {
        影响: '测试',
        sections: {}
      }
    };

    mediumTermMemories.value.push(testMemory);

    // 保存到 store 并持久化
    await saveMemoriesToStore();

    // 从 store 重新加载，确保「全部」与「中期」等 tab 计数与 store 一致
    await loadMemoryData();

    const midCount = mediumTermMemories.value.length;
    toast.success(t('testMemoryAdded', { count: midCount }));
    debug.log('记忆中心', '添加测试中期记忆成功', { midCount, content: testContent });
  } catch (error) {
    debug.error('记忆中心', '添加测试记忆失败', error);
    toast.error(t('添加测试记忆失败'));
  }
};
</script>

<style scoped>
/* 顶栏动作统一处理，移除本地工具栏 */
/* 容器约束防止溢出 */
.memory-center-panel {
  width: 100%;
  max-width: 100%;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
  container-type: inline-size;
  margin: 0;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* 导出区域样式 */
.export-section {
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(37, 99, 235, 0.08) 100%);
  border: 1.5px solid rgba(59, 130, 246, 0.15);
  border-radius: 14px;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.08);
}

.export-btn-main {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.25);
  letter-spacing: 0.3px;
}

.export-btn-main:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.35);
}

.export-hint {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
  opacity: 0.85;
}

.filter-section {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
  background: rgba(var(--color-surface-rgb), 0.6);
  border: 1px solid rgba(var(--color-border-rgb), 0.2);
  border-radius: 16px;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.filter-tabs {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  overflow: hidden;
  box-sizing: border-box;
  align-items: center;
  justify-content: flex-start;
  margin: 0;
  padding: 0.75rem;
}

.filter-tabs .filter-tab {
  flex: 0 0 auto;
  margin: 0;
}

.filter-tabs .settings-toggle-btn {
  margin-left: auto;
}

.filter-tab {
  flex-shrink: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
  margin: 0;
  padding: 0.7rem 1.2rem;
  border: 1.5px solid rgba(100, 116, 139, 0.2);
  background: rgba(255, 255, 255, 0.95);
  color: #475569;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  box-sizing: border-box;
  font-size: 0.875rem;
  font-weight: 600;
  min-height: 42px;
  position: relative;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  letter-spacing: 0.3px;
}

.filter-tab:hover {
  background: rgba(241, 245, 249, 1);
  border-color: rgba(59, 130, 246, 0.35);
  color: #1e293b;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.filter-tab.active {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-color: transparent;
  color: white;
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);
  transform: translateY(-1px);
}

.filter-tab .tab-icon {
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-tab .tab-name {
  font-weight: 500;
  letter-spacing: 0.2px;
}

.filter-tab .tab-count {
  background: rgba(100, 116, 139, 0.12);
  color: #64748b;
  padding: 0.2rem 0.5rem;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  min-width: 20px;
  text-align: center;
  line-height: 1;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
}

.filter-tab.active .tab-count {
  background: rgba(255, 255, 255, 0.3);
  color: white;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.panel-content {
  width: 100%;
  max-width: 100%;
  height: calc(100% - 80px);
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* 设置界面样式 */
.settings-section {
  margin: 0;
  padding: 0;
  background: rgba(var(--color-surface-rgb), 0.95);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  animation: fadeIn 0.3s ease-in-out;
  max-width: 100%;
  width: 100%;
  height: 100%;
  max-height: calc(100% - 80px);
  box-sizing: border-box;
  overflow: hidden;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0;
  padding: 1rem 1rem 0.5rem 1rem;
  border-bottom: 1px solid var(--color-border);
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.export-btn {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border: none;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
  margin-right: 0.5rem;
}

.export-btn:hover {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.test-btn {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border: none;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}

.test-btn:hover {
  background: linear-gradient(135deg, #059669, #047857);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.settings-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-close-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 1.2rem;
  padding: 0.2rem;
  border-radius: 4px;
  transition: var(--transition-fast);
  flex-shrink: 0;
}

.settings-close-btn:hover {
  background: rgba(var(--color-danger-rgb), 0.1);
  color: var(--color-danger);
}

.settings-content {
  display: block;
  max-width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
  padding: 1.25rem;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.settings-content::-webkit-scrollbar {
  width: 8px;
}

.settings-content::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 4px;
}

.settings-content::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 4px;
}

.settings-content::-webkit-scrollbar-thumb:hover {
  background: transparent;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  max-width: 100%;
  overflow: visible;
  box-sizing: border-box;
  margin-bottom: 1rem;
}
.setting-item:last-child {
  margin-bottom: 0;
}

.setting-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 100%;
  overflow: hidden;
  word-wrap: break-word;
}

.setting-input {
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.875rem;
  width: 100px;
  max-width: 120px;
  transition: var(--transition-fast);
  box-sizing: border-box;
}

.setting-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
}

.setting-textarea {
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.875rem;
  width: 100%;
  max-width: 100%;
  transition: var(--transition-fast);
  box-sizing: border-box;
  resize: vertical;
  min-height: 100px;
  font-family: monospace;
  line-height: 1.4;
}

.setting-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
}

.setting-textarea::placeholder {
  color: var(--color-text-secondary);
  opacity: 0.7;
}

.setting-checkbox {
  margin-right: 0.5rem;
  accent-color: var(--color-primary);
  flex-shrink: 0;
}

.setting-hint {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  opacity: 0.8;
  max-width: 100%;
  overflow: hidden;
  word-wrap: break-word;
}

/* 记忆配置分组：仅用统一间距，无分割线 */
.memory-config-section {
  margin-top: 1.5rem;
}
.memory-config-section:first-child {
  margin-top: 0;
}
.memory-config-section:last-of-type {
  margin-bottom: 0;
}

.memory-config-section-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin: 0 0 0.625rem 0;
  padding: 0;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.setting-input-num {
  width: 5rem;
  min-width: 5rem;
  text-align: right;
}

/* 条件子区块：保留 -1 时的「参与总结条数」 */
.setting-sub-panel {
  margin-top: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  background: rgba(var(--color-primary-rgb), 0.06);
  border: 1px solid rgba(var(--color-primary-rgb), 0.15);
  border-radius: 6px;
}
.setting-sub-panel .setting-item {
  margin-bottom: 0;
}
.setting-sub-panel-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 0.5rem;
  letter-spacing: 0.02em;
}

.setting-label-checkbox {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.settings-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.25rem;
  margin-bottom: 0;
  flex-wrap: wrap;
  max-width: 100%;
  overflow: visible;
  box-sizing: border-box;
}

/* 手动操作区域：上下左右 padding 统一 */
.manual-summary-section {
  margin-top: 1.25rem;
  padding: 1.25rem 1rem;
  background: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}
.manual-summary-section .memory-config-section-title {
  margin-bottom: 0.75rem;
}
.manual-summary-section .setting-item:last-child {
  margin-bottom: 0;
}

.summary-info {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 1rem;
}

.info-text {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
}

.info-hint {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.info-hint-sub {
  margin-top: 0.25rem;
  opacity: 0.85;
}

.manual-summary-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0;
}

/* 通用操作按钮基样式，确保有清晰边框 */
.action-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: var(--transition-fast);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-sizing: border-box;
  background: var(--color-surface);
  color: var(--color-text);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.action-btn.success {
  background: rgba(var(--color-success-rgb), 0.1);
  border: 1px solid rgba(var(--color-success-rgb), 0.3);
  color: var(--color-success);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: var(--transition-fast);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-sizing: border-box;
}

.action-btn.success:hover {
  background: rgba(var(--color-success-rgb), 0.2);
  border-color: var(--color-success);
}

/* 信息按钮，用于“重置默认”等操作 */
.action-btn.info {
  background: rgba(var(--color-info-rgb), 0.1);
  border: 1px solid rgba(var(--color-info-rgb), 0.3);
  color: var(--color-info);
}

.action-btn.info:hover {
  background: rgba(var(--color-info-rgb), 0.2);
  border-color: var(--color-info);
}

.settings-toggle-btn {
  background: rgba(var(--color-surface-rgb), 0.9);
  border: 1.5px solid rgba(var(--color-border-rgb), 0.4);
  padding: 0.65rem;
  border-radius: 10px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  box-sizing: border-box;
  backdrop-filter: blur(10px);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.settings-toggle-btn:hover,
.settings-toggle-btn.active {
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.5);
  color: #3b82f6;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}

/* 记忆卡片特定样式 */
.memory-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.memory-card {
  padding: 1.25rem 1.5rem;
  background: var(--color-surface);
  border: 1.5px solid rgba(var(--color-border-rgb), 0.5);
  border-radius: 12px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
  word-wrap: break-word;
  word-break: break-word;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.memory-card:hover {
  background: var(--color-surface-light);
  border-color: rgba(59, 130, 246, 0.35);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.12);
}

.memory-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(var(--color-border-rgb), 0.15);
}

.memory-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.delete-memory-btn {
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  opacity: 0.6;
}

.delete-memory-btn:hover {
  opacity: 1;
  background: rgba(220, 38, 38, 0.1);
  border-color: #dc2626;
  transform: scale(1.1);
}

.memory-type-badge {
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface-light);
  color: var(--color-text-secondary);
  letter-spacing: 0.3px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.badge-short {
  border-color: rgba(var(--color-warning-rgb), 0.3);
  background: rgba(var(--color-warning-rgb), 0.1);
  color: var(--color-warning);
}

.badge-medium {
  border-color: rgba(var(--color-success-rgb), 0.3);
  background: rgba(var(--color-success-rgb), 0.1);
  color: var(--color-success);
}

.badge-long {
  border-color: rgba(var(--color-info-rgb), 0.3);
  background: rgba(var(--color-info-rgb), 0.1);
  color: var(--color-info);
}

.memory-time {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.memory-content {
  font-size: 0.875rem;
  color: var(--color-text);
  line-height: 1.5;
  margin-bottom: 0.5rem;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  word-wrap: break-word;
  word-break: break-word;
}

.memory-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: 0.75rem;
  text-align: center;
  padding: 0.5rem;
  background: linear-gradient(135deg, rgba(var(--color-primary-rgb), 0.1), rgba(var(--color-accent-rgb), 0.05));
  border-radius: 6px;
  border: 1px solid rgba(var(--color-primary-rgb), 0.2);
}

.memory-section {
  display: flex;
  align-items: center;
  margin: 0.75rem 0 0.5rem 0;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(var(--color-border-rgb), 0.3);
}

.memory-icon {
  font-size: 1.2rem;
  margin-right: 0.5rem;
}

.memory-section-title {
  font-weight: 600;
  color: var(--color-text);
  font-size: 0.9rem;
}

.memory-item {
  margin: 0.3rem 0;
  padding-left: 1rem;
  color: var(--color-text);
  line-height: 1.4;
  position: relative;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  word-wrap: break-word;
  word-break: break-word;
}

.memory-item::before {
  content: '';
  position: absolute;
  left: 0.25rem;
  top: 0.6rem;
  width: 3px;
  height: 3px;
  background: var(--color-accent);
  border-radius: 50%;
}

.memory-importance {
  font-size: 0.75rem;
  color: var(--color-accent);
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  background: rgba(var(--color-accent-rgb), 0.1);
  border-radius: 4px;
  border: 1px solid rgba(var(--color-accent-rgb), 0.3);
  display: inline-block;
}

.empty-hint {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  opacity: 0.7;
}

/* 响应式设计 */
@media (max-width: 640px) {
  .memory-center-panel {
    gap: 0.75rem;
    width: 100%;
    max-width: 100%;
    overflow: hidden;
  }

  .header-actions .btn-text {
    display: none;
  }

  .filter-tabs {
    gap: 0.3rem;
  }

  .filter-tab {
    max-width: 120px;
    font-size: 0.8rem;
  }

  .memory-status {
    gap: 0.5rem;
    padding: 0.6rem;
    flex-direction: column;
  }

  .status-item {
    min-width: 80px;
    flex: 1 1 100px;
    width: 100%;
    max-width: 100%;
  }

  .status-text {
    font-size: 0.7rem;
    min-width: 2.5rem;
  }

  .memory-card {
    padding: 0.8rem;
  }

  .memory-content {
    font-size: 0.8rem;
  }

  .memory-header {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .memory-type-badge {
    align-self: flex-start;
  }

  .memory-time {
    align-self: flex-end;
    font-size: 0.7rem;
  }
}

@media (max-width: 480px) {
  .memory-center-panel {
    gap: 0.5rem;
  }

  .filter-tabs {
    gap: 0.2rem;
  }

  .filter-tab {
    max-width: 100px;
    font-size: 0.75rem;
    padding: 0.4rem 0.6rem;
  }

  .memory-status {
    padding: 0.5rem;
  }

  .status-item {
    gap: 0.3rem;
  }

  .status-label {
    font-size: 0.7rem;
    min-width: 1.5rem;
  }

  .status-bar {
    height: 4px;
  }

  .status-text {
    font-size: 0.65rem;
    min-width: 2rem;
  }

  .memory-card {
    padding: 0.6rem;
  }

  .memory-content {
    font-size: 0.75rem;
  }

  .memory-section-title {
    font-size: 0.8rem;
  }

  .memory-item {
    font-size: 0.75rem;
    padding-left: 0.8rem;
  }
}

/* 分页控制样式 */
.pagination-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 1.25rem 1.5rem;
  background: rgba(var(--color-surface-rgb), 0.6);
  border: 1.5px solid rgba(var(--color-border-rgb), 0.2);
  border-radius: 12px;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.pagination-controls.bottom {
  margin-top: 1.25rem;
  margin-bottom: 0;
}

.pagination-info {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.pagination-buttons {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.page-btn {
  background: var(--color-surface);
  border: 1.5px solid rgba(var(--color-border-rgb), 0.4);
  border-radius: 8px;
  padding: 0.6rem 0.85rem;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  color: var(--color-text);
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.page-btn:hover:not(:disabled) {
  background: var(--color-surface-light);
  border-color: rgba(59, 130, 246, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(59, 130, 246, 0.15);
}

.page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  filter: grayscale(0.3);
}

.pagination-jump {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.jump-input {
  width: 75px;
  padding: 0.6rem 0.75rem;
  border: 1.5px solid rgba(var(--color-border-rgb), 0.4);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.875rem;
  text-align: center;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  font-weight: 500;
}

.jump-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.jump-btn {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.6rem 1.25rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.2);
  letter-spacing: 0.3px;
}

.jump-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(59, 130, 246, 0.3);
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
}

.vector-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.vector-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-size: 0.9rem;
  color: var(--color-text);
}

.status-subtext {
  flex-basis: 100%;
  margin-left: 1.5rem;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.status-subtext.warning {
  color: var(--color-warning);
}

.embedding-api-selector {
  flex-basis: 100%;
  margin-left: 1.5rem;
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
}

.api-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--color-warning);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
}

.status-dot.enabled {
  background: var(--color-success);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
}

.vector-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.vector-content {
  padding: 1rem;
}

.vector-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  margin-bottom: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}

.stats-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text);
}

.stats-label {
  opacity: 0.7;
}

.stats-value {
  font-weight: 600;
}

.vector-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.vector-card {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 0.75rem;
  background: var(--color-surface);
}

.vector-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.vector-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.vector-badge {
  font-size: 0.8rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: rgba(var(--color-primary-rgb), 0.12);
  color: var(--color-primary);
  border: 1px solid rgba(var(--color-primary-rgb), 0.2);
}

.vector-badge.secondary {
  background: rgba(148, 163, 184, 0.12);
  color: var(--color-text);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.vector-time {
  font-size: 0.8rem;
  opacity: 0.75;
}

.vector-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
}

.vector-tag {
  font-size: 0.8rem;
  padding: 0.15rem 0.45rem;
  border-radius: 8px;
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.2);
  color: var(--color-text);
}

.vector-text {
  white-space: pre-wrap;
  line-height: 1.6;
  color: var(--color-text);
}

@media (max-width: 640px) {
  .pagination-controls {
    flex-direction: column;
    gap: 0.75rem;
  }

  .pagination-info {
    width: 100%;
    text-align: center;
  }

  .pagination-buttons {
    width: 100%;
    justify-content: center;
  }

  .pagination-jump {
    width: 100%;
    justify-content: center;
  }
}

/* ========== 亮色主题适配 ========== */
[data-theme="light"] .filter-tab {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(59, 130, 246, 0.2);
  color: #475569;
}

[data-theme="light"] .filter-tab:hover {
  background: rgba(241, 245, 249, 0.95);
  border-color: rgba(59, 130, 246, 0.4);
  color: #1e293b;
}

[data-theme="light"] .filter-tab.active {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-color: #3b82f6;
  color: white;
}

[data-theme="light"] .settings-toggle-btn {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(59, 130, 246, 0.2);
  color: #475569;
}

[data-theme="light"] .settings-toggle-btn:hover,
[data-theme="light"] .settings-toggle-btn.active {
  background: rgba(59, 130, 246, 0.1);
  border-color: #3b82f6;
  color: #2563eb;
}

[data-theme="light"] .memory-card {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(59, 130, 246, 0.15);
}

[data-theme="light"] .memory-card:hover {
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}

[data-theme="light"] .export-btn-main {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
}

[data-theme="light"] .export-btn-main:hover {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
}

/* ========== 深色主题适配 ========== */
[data-theme="dark"] .filter-tab {
  background: rgba(30, 41, 59, 0.9);
  border-color: rgba(59, 130, 246, 0.3);
  color: #cbd5e1;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

[data-theme="dark"] .filter-tab:hover {
  background: rgba(51, 65, 85, 0.95);
  border-color: rgba(59, 130, 246, 0.5);
  color: #f1f5f9;
}

[data-theme="dark"] .filter-tab.active {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-color: transparent;
  color: white;
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);
}

[data-theme="dark"] .filter-tab .tab-count {
  background: rgba(59, 130, 246, 0.25);
  color: #93c5fd;
}

[data-theme="dark"] .filter-tab.active .tab-count {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

[data-theme="dark"] .settings-toggle-btn {
  background: rgba(30, 41, 59, 0.9);
  border-color: rgba(59, 130, 246, 0.3);
  color: #94a3b8;
}

[data-theme="dark"] .settings-toggle-btn:hover,
[data-theme="dark"] .settings-toggle-btn.active {
  background: rgba(59, 130, 246, 0.2);
  border-color: #3b82f6;
  color: #93c5fd;
}

[data-theme="dark"] .memory-card {
  background: rgba(30, 41, 59, 0.9);
  border-color: rgba(59, 130, 246, 0.2);
}

[data-theme="dark"] .memory-card:hover {
  border-color: rgba(59, 130, 246, 0.4);
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.15);
}

[data-theme="dark"] .export-section {
  background: rgba(30, 41, 59, 0.7);
  border-color: rgba(59, 130, 246, 0.2);
}

[data-theme="dark"] .export-btn-main {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

[data-theme="dark"] .export-btn-main:hover {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}

[data-theme="dark"] .pagination-controls {
  background: rgba(30, 41, 59, 0.7);
  border-color: rgba(59, 130, 246, 0.2);
}

[data-theme="dark"] .page-btn {
  background: rgba(51, 65, 85, 0.9);
  border-color: rgba(59, 130, 246, 0.3);
  color: #e2e8f0;
}

[data-theme="dark"] .page-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.2);
  border-color: #3b82f6;
}

[data-theme="dark"] .jump-input {
  background: rgba(30, 41, 59, 0.9);
  border-color: rgba(59, 130, 246, 0.3);
  color: #e2e8f0;
}

[data-theme="dark"] .jump-btn {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
}

[data-theme="dark"] .settings-section {
  background: rgba(30, 41, 59, 0.95);
  border-color: rgba(59, 130, 246, 0.2);
}

[data-theme="dark"] .settings-header {
  border-bottom-color: rgba(59, 130, 246, 0.2);
}

[data-theme="dark"] .vector-card {
  background: rgba(30, 41, 59, 0.9);
  border-color: rgba(59, 130, 246, 0.2);
}

[data-theme="dark"] .vector-stats {
  background: rgba(30, 41, 59, 0.9);
  border-color: rgba(59, 130, 246, 0.2);
}

/* 已发送信息 */
.sent-section {
  padding: 0.5rem 0;
}
.sent-hint {
  font-size: 0.85rem;
  color: var(--color-text-secondary, #64748b);
  margin-bottom: 0.75rem;
}
.sent-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.sent-card {
  background: var(--panel-bg, rgba(248, 250, 252, 0.95));
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  overflow: hidden;
}
.sent-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.sent-time {
  font-size: 0.8rem;
  color: var(--color-text-secondary, #64748b);
}
.sent-copy-btn {
  padding: 0.25rem 0.6rem;
  font-size: 0.8rem;
  border-radius: 6px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-secondary, #f1f5f9);
  cursor: pointer;
}
.sent-copy-btn:hover {
  background: var(--bg-hover, #e2e8f0);
}
.sent-text {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 12rem;
  overflow-y: auto;
}

[data-theme="dark"] .sent-card {
  background: rgba(30, 41, 59, 0.9);
  border-color: rgba(59, 130, 246, 0.2);
}

[data-theme="dark"] .sent-copy-btn {
  background: rgba(51, 65, 85, 0.9);
  border-color: rgba(59, 130, 246, 0.3);
  color: #e2e8f0;
}

[data-theme="dark"] .sent-copy-btn:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: #3b82f6;
}
</style>
