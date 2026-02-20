<template>
  <div class="settings-panel">
    <!-- 头部 -->
    <div class="panel-header">
      <div class="header-left">
        <div class="header-icon">⚙️</div>
        <div class="header-info">
          <h3 class="panel-title">{{ t('游戏设置') }}</h3>
          <span class="settings-subtitle">{{ t('自定义您的游戏体验') }}</span>
        </div>
      </div>
      <div class="header-actions">
        <button class="action-btn" @click="resetSettings">
          <RotateCcw :size="16" />
          <span class="btn-text">{{ t('重置') }}</span>
        </button>
        <button class="action-btn primary" @click="saveSettings">
          <Save :size="16" />
          <span class="btn-text">{{ t('保存') }}</span>
        </button>
      </div>
    </div>

    <!-- 设置内容 -->
    <div class="settings-container">
      <!-- 显示设置 -->
      <div class="settings-section">
        <div class="section-header">
          <h4 class="section-title">🎨 {{ t('显示设置') }}</h4>
        </div>
        <div class="settings-list">
          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name">{{ t('语言设置') }}</label>
              <span class="setting-desc">{{ t('选择界面语言') }}</span>
            </div>
            <div class="setting-control">
              <select v-model="currentLanguage" class="setting-select" @change="onLanguageChange">
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name">{{ t('主题模式') }}</label>
              <span class="setting-desc">{{ t('选择明亮或暗黑主题') }}</span>
            </div>
            <div class="setting-control">
              <select v-model="settings.theme" class="setting-select" @change="onSettingChange">
                <option value="light">{{ t('明亮') }}</option>
                <option value="dark">{{ t('暗黑') }}</option>
                <option value="auto">{{ t('跟随系统') }}</option>
              </select>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name">{{ t('界面缩放') }}</label>
              <span class="setting-desc">{{ t('调整UI界面大小') }}</span>
            </div>
            <div class="setting-control">
              <div class="range-container">
                <input
                  type="range"
                  v-model.number="settings.uiScale"
                  min="80"
                  max="120"
                  step="5"
                  class="setting-range"
                  @input="applyUIScale"
                />
                <span class="range-value">{{ settings.uiScale }}%</span>
              </div>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name">{{ t('文字大小') }}</label>
              <span class="setting-desc">{{ t('调整游戏文字显示大小（像素）') }}</span>
            </div>
            <div class="setting-control">
              <div class="range-container">
                <input
                  type="range"
                  v-model.number="settings.fontSize"
                  min="12"
                  max="24"
                  step="1"
                  class="setting-range"
                  @input="applyFontSize"
                />
                <span class="range-value">{{ settings.fontSize }}px</span>
              </div>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name">{{ t('快速动画') }}</label>
              <span class="setting-desc">{{ t('加速界面动画和过渡效果') }}</span>
            </div>
            <div class="setting-control">
              <label class="setting-switch">
                <input type="checkbox" v-model="settings.fastAnimations" @change="applyAnimationSettings(); onSettingChange()" />
                <span class="switch-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- 游戏功能 -->
      <div class="settings-section">
        <div class="section-header">
          <h4 class="section-title">🎮 {{ t('游戏功能') }}</h4>
        </div>
        <div class="settings-list">
          <!-- 道号修改 -->
          <div class="setting-item setting-item-full" v-if="currentPlayerName">
            <div class="setting-info">
              <label class="setting-name">{{ t('修改道号') }}</label>
              <span class="setting-desc">{{ t('修改当前角色的名字') }}</span>
            </div>
            <div class="setting-control-full" style="display: flex; gap: 0.5rem">
              <input
                v-model="newPlayerName"
                class="form-input-inline"
                :placeholder="currentPlayerName"
                style="flex: 1"
              />
              <button
                class="utility-btn primary"
                @click="updatePlayerName"
                :disabled="!newPlayerName || newPlayerName === currentPlayerName"
              >
                <Save :size="16" />
                {{ t('确认') }}
              </button>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name">{{ t('行动选项') }}</label>
              <span class="setting-desc">{{ t('AI生成可选的行动建议') }}</span>
            </div>
            <div class="setting-control">
              <label class="setting-switch">
                <input type="checkbox" v-model="uiStore.enableActionOptions" />
                <span class="switch-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-item setting-item-full">
            <div class="setting-info">
              <label class="setting-name">{{ t('自定义行动选项提示词') }}</label>
              <span class="setting-desc">{{
                t('指导AI生成特定风格的行动选项（可选，留空使用默认）')
              }}</span>
            </div>
            <div class="setting-control-full">
              <textarea
                v-model="uiStore.actionOptionsPrompt"
                class="setting-textarea"
                :placeholder="t('例如：多生成修炼和探索类选项，减少战斗选项...')"
                rows="3"
              ></textarea>
            </div>
          </div>
        </div>
      </div>

      <EngramSettingsSection v-model="settings.engram" @change="onSettingChange" />

      <!-- 世界心跳 -->
      <div class="settings-section">
        <div class="section-header">
          <h4 class="section-title">💓 {{ t('世界心跳') }}</h4>
        </div>
        <div class="settings-list">
          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name">{{ t('启用世界心跳') }}</label>
              <span class="setting-desc">{{ t('周期或事件触发时更新 NPC 位置/状态/内心想法/在做事项') }}</span>
            </div>
            <div class="setting-control">
              <label class="setting-switch">
                <input
                  type="checkbox"
                  :checked="worldHeartbeatEnabled"
                  @change="onWorldHeartbeatEnabledChange"
                />
                <span class="switch-slider"></span>
              </label>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name">{{ t('每 N 回合更新') }}</label>
              <span class="setting-desc">{{ t('周期触发时，每多少回合执行一次心跳') }}</span>
            </div>
            <div class="setting-control">
              <input
                type="number"
                class="config-input"
                min="1"
                max="99"
                :value="worldHeartbeatPeriod"
                @input="onWorldHeartbeatPeriodInput"
              />
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name">{{ t('历史保留条数') }}</label>
              <span class="setting-desc">{{ t('心跳记录列表最多保留条数') }}</span>
            </div>
            <div class="setting-control">
              <input
                type="number"
                class="config-input"
                min="5"
                max="100"
                :value="worldHeartbeatHistoryCount"
                @input="onWorldHeartbeatHistoryCountInput"
              />
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name">{{ t('遗忘回合数') }}</label>
              <span class="setting-desc">{{ t('超过此回合数未被主游戏更新的 NPC 不再参与心跳') }}</span>
            </div>
            <div class="setting-control">
              <input
                type="number"
                class="config-input"
                min="0"
                max="999"
                :value="worldHeartbeatForgetRounds"
                @input="onWorldHeartbeatForgetRoundsInput"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- NPC 设置 -->
      <div class="settings-section">
        <div class="section-header">
          <h4 class="section-title">👥 {{ t('NPC 设置') }}</h4>
        </div>
        <div class="settings-list">
          <!-- 重点NPC降级阈值 -->
          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name">{{ t('NPC 降级阈值') }}</label>
              <span class="setting-desc">{{ t('重点NPC若不被关注，超过N回合未活跃将降级为普通NPC') }}</span>
              <span class="setting-hint">{{ t('默认: 5 回合') }}</span>
            </div>
            <div class="setting-control">
              <input
                type="number"
                class="config-input"
                min="1"
                max="999"
                :value="npcDemotionThreshold"
                @input="onNpcDemotionThresholdInput"
              />
            </div>
          </div>

          <!-- 重点NPC生成数量范围 -->
          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name">{{ t('新地点重点NPC生成数量') }}</label>
              <span class="setting-desc">{{ t('到达新地点时，生成的重点NPC数量范围；0-0 表示不生成重点NPC') }}</span>
              <span class="setting-hint">{{ t('默认: 0 - 1') }}</span>
            </div>
            <div class="setting-control" style="display: flex; gap: 0.5rem; align-items: center;">
              <input
                type="number"
                class="config-input"
                style="width: 60px"
                min="0"
                max="10"
                :value="importantNpcGenerationMin"
                @input="onImportantNpcGenerationMinInput"
                placeholder="Min"
              />
              <span>-</span>
              <input
                type="number"
                class="config-input"
                style="width: 60px"
                min="0"
                max="10"
                :value="importantNpcGenerationMax"
                @input="onImportantNpcGenerationMaxInput"
                placeholder="Max"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 高级设置 -->
      <div class="settings-section">
        <div class="section-header">
          <h4 class="section-title">{{ t('🔧 高级设置') }}</h4>
        </div>
        <div class="settings-list">
          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name">{{ t('强制酒馆模式') }}</label>
              <span class="setting-desc">{{ t('强制启用酒馆相关逻辑（如特殊NPC事件），即使不在酒馆环境中') }}</span>
            </div>
            <div class="setting-control">
              <label class="setting-switch">
                <input type="checkbox" v-model="settings.forceTavernMode" @change="onSettingChange" />
                <span class="switch-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name">{{ t('调试模式') }}</label>
              <span class="setting-desc">{{ t('启用开发者调试信息和详细日志') }}</span>
              <span class="setting-hint" v-if="settings.debugMode">{{ t('开启后侧边栏将显示「提示词组装」，可查看最近一次发送给 API 的提示词构成。') }}</span>
            </div>
            <div class="setting-control">
              <label class="setting-switch">
                <input type="checkbox" v-model="settings.debugMode" @change="onSettingChange" />
                <span class="switch-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-item" v-if="settings.debugMode">
            <div class="setting-info">
              <label class="setting-name">{{ t('控制台调试') }}</label>
              <span class="setting-desc">{{ t('在浏览器控制台显示详细调试信息') }}</span>
            </div>
            <div class="setting-control">
              <label class="setting-switch">
                <input type="checkbox" v-model="settings.consoleDebug" @change="onSettingChange" />
                <span class="switch-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-item" v-if="settings.debugMode">
            <div class="setting-info">
              <label class="setting-name">{{ t('性能监控') }}</label>
              <span class="setting-desc">{{ t('监控组件性能和加载时间') }}</span>
            </div>
            <div class="setting-control">
              <label class="setting-switch">
                <input
                  type="checkbox"
                  v-model="settings.performanceMonitor"
                  @change="onSettingChange"
                />
                <span class="switch-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-item" v-if="settings.debugMode">
            <div class="setting-info">
              <label class="setting-name">{{ t('AI API日志') }}</label>
              <span class="setting-desc">{{ t('记录发送给AI的prompts和接收的响应') }}</span>
            </div>
            <div class="setting-control">
              <label class="setting-switch">
                <input
                  type="checkbox"
                  v-model="settings.aiApiLogging"
                  @change="onSettingChange"
                />
                <span class="switch-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name">{{ t('正则替换规则') }}</label>
              <span class="setting-desc">{{ t('对AI输出进行替换：正则 / 纯文本（用于格式修正、屏蔽词替换等）') }}</span>
            </div>
            <div class="setting-control">
              <button class="utility-btn" @click="showReplaceRulesModal = true">
                {{ t('编辑规则') }} <span v-if="enabledReplaceRulesCount > 0">({{ enabledReplaceRulesCount }})</span>
              </button>
            </div>
          </div>

          <TextReplaceRulesModal
            :open="showReplaceRulesModal"
            :rules="settings.replaceRules"
            @close="showReplaceRulesModal = false"
            @save="handleSaveReplaceRules"
          />



          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name">{{ t('导入设置') }}</label>
              <span class="setting-desc">{{ t('从文件恢复设置配置') }}</span>
            </div>
            <div class="setting-control">
              <button class="utility-btn" @click="importSettings">
                <Upload :size="16" />
                {{ t('导入') }}
              </button>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name">{{ t('清理缓存') }}</label>
              <span class="setting-desc">{{ t('清除游戏临时数据和缓存') }}</span>
            </div>
            <div class="setting-control">
              <button class="utility-btn" @click="clearCache">
                <Trash2 :size="16" />
                {{ t('清理') }}
              </button>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name">{{ t('导出设置') }}</label>
              <span class="setting-desc">{{ t('备份当前设置配置') }}</span>
            </div>
            <div class="setting-control">
              <button class="utility-btn" @click="exportSettings">
                <Download :size="16" />
                {{ t('导出') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch, computed } from 'vue';
import { Save, RotateCcw, Trash2, Download, Upload } from 'lucide-vue-next';
import { toast } from '@/utils/toast';
import { debug } from '@/utils/debug';
import { useI18n } from '@/i18n';
import TextReplaceRulesModal from '@/components/common/TextReplaceRulesModal.vue';
import type { TextReplaceRule } from '@/types/textRules';
import { useCharacterStore } from '@/stores/characterStore';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useUIStore } from '@/stores/uiStore';
import { unwrapDadBundle } from '@/utils/dadBundle';
import EngramSettingsSection from '@/components/engram/EngramSettingsSection.vue';
import { DEFAULT_ENGRAM_CONFIG, normalizeEngramConfig } from '@/services/engram/config';

const { t, setLanguage, currentLanguage } = useI18n();
const characterStore = useCharacterStore();
const gameStateStore = useGameStateStore();
const uiStore = useUIStore();
const onLanguageChange = () => {
  setLanguage(currentLanguage.value);
  toast.success('语言设置已更新');
};

// 道号修改相关
const newPlayerName = ref('');
const currentPlayerName = computed(() => {
  return gameStateStore.character?.名字 || '';
});

// 世界心跳（来自 gameStateStore.worldHeartbeat，随存档保存）
const worldHeartbeatEnabled = computed(() => gameStateStore.worldHeartbeat?.启用 ?? false);
const worldHeartbeatPeriod = computed(() => gameStateStore.worldHeartbeat?.周期数值 ?? 3);
const worldHeartbeatHistoryCount = computed(() => gameStateStore.worldHeartbeat?.历史条数 ?? 20);
const worldHeartbeatForgetRounds = computed(() => gameStateStore.worldHeartbeat?.遗忘回合数 ?? 30);

const persistWorldHeartbeat = async () => {
  if (gameStateStore.isGameLoaded) {
    try {
      await characterStore.saveCurrentGame();
    } catch (e) {
      console.warn('[设置] 世界心跳配置持久化失败:', e);
    }
  }
};

function onWorldHeartbeatEnabledChange(e: Event) {
  const checked = (e.target as HTMLInputElement).checked;
  gameStateStore.updateState('worldHeartbeat.启用', checked);
  persistWorldHeartbeat();
}

function onWorldHeartbeatPeriodInput(e: Event) {
  const v = Math.max(1, Math.min(99, Number((e.target as HTMLInputElement).value) || 3));
  gameStateStore.updateState('worldHeartbeat.周期数值', v);
  persistWorldHeartbeat();
}

function onWorldHeartbeatHistoryCountInput(e: Event) {
  const v = Math.max(5, Math.min(100, Number((e.target as HTMLInputElement).value) || 20));
  gameStateStore.updateState('worldHeartbeat.历史条数', v);
  persistWorldHeartbeat();
}

function onWorldHeartbeatForgetRoundsInput(e: Event) {
  const v = Math.max(0, Math.min(999, Number((e.target as HTMLInputElement).value) || 30));
  gameStateStore.updateState('worldHeartbeat.遗忘回合数', v);
  persistWorldHeartbeat();
}

// NPC 设置相关
const npcDemotionThreshold = computed(() => (gameStateStore.systemConfig as any)?.npcDemotionThreshold ?? 5);
const importantNpcGenerationMin = computed(() => (gameStateStore.systemConfig as any)?.importantNpcGenerationRange?.min ?? 0);
const importantNpcGenerationMax = computed(() => (gameStateStore.systemConfig as any)?.importantNpcGenerationRange?.max ?? 1);

const persistSystemConfig = async () => {
  if (gameStateStore.isGameLoaded) {
    try {
      await characterStore.saveCurrentGame();
    } catch (e) {
      console.warn('[设置] 系统配置持久化失败:', e);
    }
  }
};

function onNpcDemotionThresholdInput(e: Event) {
  const v = Math.max(1, Math.min(999, Number((e.target as HTMLInputElement).value) || 5));
  gameStateStore.updateState('systemConfig.npcDemotionThreshold', v);
  persistSystemConfig();
}

function onImportantNpcGenerationMinInput(e: Event) {
  const v = Math.max(0, Math.min(10, Number((e.target as HTMLInputElement).value) || 0));
  // 确保 min <= max
  if (v > importantNpcGenerationMax.value) {
    gameStateStore.updateState('systemConfig.importantNpcGenerationRange.max', v);
  }
  gameStateStore.updateState('systemConfig.importantNpcGenerationRange.min', v);
  persistSystemConfig();
}

function onImportantNpcGenerationMaxInput(e: Event) {
  const raw = Number((e.target as HTMLInputElement).value);
  const v = Math.max(0, Math.min(10, Number.isNaN(raw) ? 1 : raw));
  // 确保 max >= min
  if (v < importantNpcGenerationMin.value) {
    gameStateStore.updateState('systemConfig.importantNpcGenerationRange.min', v);
  }
  gameStateStore.updateState('systemConfig.importantNpcGenerationRange.max', v);
  persistSystemConfig();
}

// 更新玩家道号
const updatePlayerName = async () => {
  if (!newPlayerName.value || newPlayerName.value === currentPlayerName.value) {
    return;
  }

  try {
    // 更新 gameStateStore 中的角色身份信息（V3：gameStateStore.character）
    if (gameStateStore.character) {
      (gameStateStore.character as any).名字 = newPlayerName.value;
    }

    // 同步到 characterStore 并保存到当前存档槽位
    const currentSlotName = characterStore.rootState.当前激活存档?.存档槽位;
    if (currentSlotName) {
      await characterStore.saveToSlot(currentSlotName);
    }

    toast.success(`道号已修改为「${newPlayerName.value}」`);
    newPlayerName.value = ''; // 清空输入框
  } catch (error) {
    console.error('修改道号失败:', error);
    toast.error('修改道号失败，请重试');
  }
};

// 设置数据结构
const settings = reactive({
  // 显示设置
  theme: 'auto',
  uiScale: 100,
  fontSize: 16,

  // 游戏设置
  fastAnimations: false,
  splitResponseGeneration: false,  // 默认关闭分步生成

  // 🔞 成人内容（nsfwMode 全局生效；酒馆环境检测逻辑受 forceTavernMode 影响）
  enableNsfwMode: true,
  nsfwGenderFilter: 'female' as 'all' | 'male' | 'female',
  forceTavernMode: true, // 强制启用酒馆模式逻辑（默认开启，v3.8 改动）


  // 高级设置
  debugMode: false,
  consoleDebug: false,
  performanceMonitor: false,
  aiApiLogging: false,
  replaceRules: [] as TextReplaceRule[],
  engram: normalizeEngramConfig(DEFAULT_ENGRAM_CONFIG),
});

const loading = ref(false);
const hasUnsavedChanges = ref(false);
const showReplaceRulesModal = ref(false);

const enabledReplaceRulesCount = computed(() => {
  const rules = (settings as any).replaceRules as TextReplaceRule[] | undefined;
  if (!Array.isArray(rules)) return 0;
  return rules.filter(r => r && r.enabled).length;
});

const normalizeReplaceRules = (rawRules: unknown): TextReplaceRule[] => {
  if (!Array.isArray(rawRules)) return [];
  return rawRules.slice(0, 50).map((r: any, idx: number) => ({
    id: typeof r?.id === 'string' ? r.id.slice(0, 80) : `rule_${idx}`,
    enabled: r?.enabled !== false,
    mode: r?.mode === 'text' ? 'text' : 'regex',
    pattern: typeof r?.pattern === 'string' ? r.pattern.slice(0, 500) : '',
    replacement: typeof r?.replacement === 'string' ? r.replacement.slice(0, 1500) : '',
    ignoreCase: !!r?.ignoreCase,
    global: r?.global !== false,
    multiline: !!r?.multiline,
    dotAll: !!r?.dotAll,
  }));
};

const persistReplaceRules = (rules: TextReplaceRule[]) => {
  try {
    const raw = localStorage.getItem('dad_game_settings');
    const parsed = raw ? JSON.parse(raw) : {};
    const base =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    const next = { ...base, replaceRules: rules };
    localStorage.setItem('dad_game_settings', JSON.stringify(next));
  } catch {
  }
};

const handleSaveReplaceRules = (rules: TextReplaceRule[]) => {
  const normalizedRules = normalizeReplaceRules(rules);
  (settings as any).replaceRules = normalizedRules;
  persistReplaceRules(normalizedRules);
  onSettingChange();
};

// 监听所有设置变化
watch(settings, () => {
  hasUnsavedChanges.value = true;
}, { deep: true });

// 监听调试模式变化
watch(() => settings.debugMode, (newValue) => {
  debug.setMode(newValue);
  uiStore.setDebugMode(newValue);
  debug.log('设置面板', `调试模式${newValue ? '已启用' : '已禁用'}`);
});

// 设置变更处理
const onSettingChange = () => {
  hasUnsavedChanges.value = true;
};

// 加载设置
const loadSettings = async () => {
  debug.timeStart('加载设置');
  try {
    // 先从localStorage加载设置
    const savedSettings = localStorage.getItem('dad_game_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      Object.assign(settings, parsed);
      settings.engram = normalizeEngramConfig((parsed as any).engram);
      uiStore.syncDebugModeFromStorage();
      debug.log('设置面板', '设置加载成功', parsed);
    } else {
      settings.engram = normalizeEngramConfig(DEFAULT_ENGRAM_CONFIG);
      debug.log('设置面板', '使用默认设置');
    }

  } catch (error) {
    debug.error('设置面板', '加载设置失败', error);
    toast.error('加载设置失败，将使用默认设置');
  } finally {
    debug.timeEnd('加载设置');
  }
};

// 保存设置
const saveSettings = async () => {
  if (loading.value) return;

  loading.value = true;
  debug.timeStart('保存设置');

  try {
    // 验证设置
    validateSettings();

    // 保存到localStorage
    localStorage.setItem('dad_game_settings', JSON.stringify(settings));

    debug.log('设置面板', '设置已保存到localStorage', settings);

    // 应用设置
    await applySettings();

    hasUnsavedChanges.value = false;
    toast.success('设置已保存并应用');

  } catch (error) {
    debug.error('设置面板', '保存设置失败', error);
    toast.error(`保存设置失败: ${error instanceof Error ? error.message : '未知错误'}`);
  } finally {
    loading.value = false;
    debug.timeEnd('保存设置');
  }
};

// 验证设置
const validateSettings = () => {
  debug.group('设置验证');

  try {
    // 验证UI缩放
    if (settings.uiScale < 50 || settings.uiScale > 200) {
      settings.uiScale = Math.max(50, Math.min(200, settings.uiScale));
      debug.warn('设置面板', `UI缩放值已修正为: ${settings.uiScale}%`);
    }

    if (typeof (settings as any).splitResponseGeneration !== 'boolean') {
      (settings as any).splitResponseGeneration = false;  // 默认关闭分步生成
    }

    // 正则替换规则：确保结构正确并限制大小，避免卡顿/存储膨胀
    const rawReplaceRules = (settings as any).replaceRules;
    (settings as any).replaceRules = normalizeReplaceRules(rawReplaceRules);

    // Engram 配置：统一归一化，避免历史设置导致字段缺失
    (settings as any).engram = normalizeEngramConfig((settings as any).engram);

    debug.log('设置面板', '设置验证完成');
  } catch (error) {
    debug.error('设置面板', '设置验证失败', error);
    throw new Error('设置验证失败');
  } finally {
    debug.groupEnd();
  }
};

// 应用设置
const applySettings = async () => {
  debug.group('应用设置');

  try {
    // 应用主题
    applyTheme();

    // 应用UI缩放
    applyUIScale();

    // 应用字体大小
    applyFontSize();

    // 应用动画设置
    applyAnimationSettings();

    // 应用调试模式（同步到 uiStore，侧边栏「提示词组装」等入口据此显示）
    debug.setMode(settings.debugMode);
    uiStore.setDebugMode(settings.debugMode);

    debug.log('设置面板', '所有设置已应用');
  } catch (error) {
    debug.error('设置面板', '应用设置时出错', error);
    throw error;
  } finally {
    debug.groupEnd();
  }
};

// 应用主题
const applyTheme = () => {
  let targetTheme = settings.theme;

  if (settings.theme === 'auto') {
    targetTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  document.documentElement.setAttribute('data-theme', targetTheme);
  debug.log('设置面板', `主题已应用: ${targetTheme}`);
};

// 应用UI缩放
const applyUIScale = () => {
  const scaleValue = settings.uiScale / 100;
  document.documentElement.style.setProperty('--ui-scale', scaleValue.toString());
  debug.log('设置面板', `UI缩放已应用: ${settings.uiScale}%`);
};

// 应用字体大小
const applyFontSize = () => {
  const fontSize = `${settings.fontSize}px`;
  document.documentElement.style.setProperty('--base-font-size', fontSize);
  debug.log('设置面板', `字体大小已应用: ${fontSize}`);
};

// 应用动画设置
const applyAnimationSettings = () => {
  const transitionSeconds = settings.fastAnimations ? 0.12 : 0.2;
  document.documentElement.style.setProperty('--transition-fast', `all ${transitionSeconds}s ease-in-out`);
  debug.log('设置面板', `动画速度已应用: ${transitionSeconds}s`);
};

// uiStore 已在脚本顶部初始化
// 重置设置
const resetSettings = () => {
  uiStore.showRetryDialog({
    title: '重置设置',
    message: '确定要重置所有设置为默认值吗？这将清除所有自定义配置。',
    confirmText: '确认重置',
    cancelText: '取消',
    onConfirm: () => {
      debug.log('设置面板', '开始重置设置');
      Object.assign(settings, {
        theme: 'auto',
        uiScale: 100,
        fontSize: 16,
        fastAnimations: false,
        splitResponseGeneration: false,  // 默认关闭分步生成
        enableNsfwMode: true,
        nsfwGenderFilter: 'female',
        forceTavernMode: true,
        debugMode: false,
        consoleDebug: false,
        performanceMonitor: false,
        aiApiLogging: false,
        engram: normalizeEngramConfig(DEFAULT_ENGRAM_CONFIG),
      });
      saveSettings();
      toast.info('设置已重置为默认值');
    },
    onCancel: () => {}
  });
};

// 清理缓存
const clearCache = async () => {
  uiStore.showRetryDialog({
    title: '清理缓存',
    message: '确定要清理缓存吗？这将删除临时数据但不会影响存档。',
    confirmText: '确认清理',
    cancelText: '取消',
    onConfirm: async () => {
      debug.log('设置面板', '开始清理缓存');
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('dad_cache_') || key.startsWith('temp_') || key.startsWith('debug_') || key.includes('_temp'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        sessionStorage.clear();
        debug.log('设置面板', `缓存清理完成，共清理 ${keysToRemove.length} 项数据`);
        toast.success(`已清理 ${keysToRemove.length} 项缓存数据`);
      } catch (error) {
        debug.error('设置面板', '清理缓存失败', error);
        toast.error('清理缓存失败');
      }
    },
    onCancel: () => {}
  });
};

/**
 * 收集所有分散在独立 localStorage 键中的 UI 设置
 */
const collectExtraUiSettings = () => ({
  enableActionOptions: uiStore.enableActionOptions,
  actionOptionsPrompt: uiStore.actionOptionsPrompt,
  useStreaming: uiStore.useStreaming,
  useSystemCot: uiStore.useSystemCot,
});

/**
 * 恢复独立 localStorage 键中的 UI 设置
 */
const restoreExtraUiSettings = (data: any) => {
  if (data.enableActionOptions !== undefined) {
    uiStore.enableActionOptions = !!data.enableActionOptions;
  }
  if (data.actionOptionsPrompt !== undefined) {
    uiStore.actionOptionsPrompt = String(data.actionOptionsPrompt);
  }
  if (data.useStreaming !== undefined) {
    uiStore.useStreaming = !!data.useStreaming;
  }
  if (data.useSystemCot !== undefined) {
    uiStore.useSystemCot = !!data.useSystemCot;
  }
};

// 导出设置
const exportSettings = () => {
  debug.log('设置面板', '开始导出设置');

  try {
    const exportData = {
      settings: settings,
      uiSettings: collectExtraUiSettings(),
      exportInfo: {
        timestamp: new Date().toISOString(),
        version: '3.7.4',
        userAgent: navigator.userAgent,
        gameVersion: '仙途 v3.7.4'
      }
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `仙途-设置备份-${dateStr}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(link.href);

    debug.log('设置面板', '设置导出成功');
    toast.success('设置已导出');

  } catch (error) {
    debug.error('设置面板', '导出设置失败', error);
    toast.error('导出设置失败');
  }
};

// 导入设置
const importSettings = () => {
  debug.log('设置面板', '开始导入设置');

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      // 🔥 支持 dad.bundle 格式和旧格式
      const unwrapped = unwrapDadBundle(importData);

      // 提取设置数据
      let settingsData: any = null;
      let uiSettingsData: any = null;

      if (unwrapped.type === 'settings') {
        // dad.bundle 格式或旧格式 { type: 'settings', settings: {...} }
        settingsData = unwrapped.payload;
      } else if (importData.settings) {
        // 旧导出格式 { settings: {...}, uiSettings: {...}, exportInfo: {...} }
        settingsData = importData.settings;
        uiSettingsData = importData.uiSettings;
      } else if (unwrapped.type === null && typeof unwrapped.payload === 'object') {
        // 直接是设置对象（最旧的格式）
        settingsData = unwrapped.payload;
      }

      if (!settingsData || typeof settingsData !== 'object') {
        throw new Error('无效的设置文件格式');
      }

      // 验证并合并设置
      const validatedSettings = { ...settings, ...settingsData };
      Object.assign(settings, validatedSettings);

      // 恢复独立 localStorage 键中的 UI 设置
      if (uiSettingsData && typeof uiSettingsData === 'object') {
        restoreExtraUiSettings(uiSettingsData);
      }

      await saveSettings();

      debug.log('设置面板', '设置导入成功', settingsData);
      toast.success('设置导入成功并已应用');
    } catch (error) {
      debug.error('设置面板', '导入设置失败', error);
      toast.error(`导入设置失败: ${error instanceof Error ? error.message : '请检查文件格式'}`);
    }
  };

  input.click();
};

const openPromptManagement = () => {
  // 检查当前是否在游戏中（/game路由下）
  const currentPath = router.currentRoute.value.path;
  if (currentPath.startsWith('/game')) {
    // 在游戏中，跳转到游戏内的提示词管理
    router.push('/game/prompts');
  } else {
    // 不在游戏中（如首页），跳转到独立的提示词管理页面
    router.push('/prompts');
  }
};

// 加载向量记忆配置（占位函数）
const loadVectorMemoryConfig = () => {
  debug.log('设置面板', '向量记忆配置加载（功能待实现）');
  // TODO: 实现向量记忆配置加载逻辑
};

import { useRouter } from 'vue-router';
const router = useRouter();

// 组件挂载时加载设置
onMounted(() => {
  debug.log('设置面板', '组件已加载');
  loadSettings();
  loadVectorMemoryConfig();

  // 初始加载时不再强制应用设置，以避免覆盖全局主题
  // applySettings(); // 移除此调用

  // 🔧 开发者控制：如果启用授权验证且未验证，自动弹出验证窗口
});
</script>

<style scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-background);
  overflow: hidden;
  padding: 1rem;
  gap: 1rem;
  position: relative;
}

/* 头部 */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--color-surface);
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-icon {
  font-size: 1.5rem;
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.panel-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
}

.settings-subtitle {
  font-size: 0.875rem;
  color: #64748b;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
}

.action-btn:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.action-btn.primary {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.action-btn.primary:hover {
  background: #2563eb;
  border-color: #2563eb;
}

/* 设置容器 */
.settings-container {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 0 0.5rem 3rem 0.5rem;

  /* 滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.settings-container::-webkit-scrollbar {
  width: 8px;
}

.settings-container::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 4px;
}

.settings-container::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 4px;
  transition: background 0.2s ease;
}

.settings-container::-webkit-scrollbar-thumb:hover {
  background: transparent;
}

/* 设置区块 */
.settings-section {
  margin-bottom: 1.5rem;
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.section-header {
  padding: 1rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.section-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
}

.settings-list {
  padding: 0.5rem;
}

/* 设置项 */
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-radius: 0.5rem;
  transition: background 0.2s ease;
}

.setting-item:hover {
  background: #f8fafc;
}

.setting-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.setting-name {
  font-weight: 500;
  color: #1e293b;
  cursor: pointer;
}

.setting-desc {
  font-size: 0.875rem;
  color: #64748b;
}

.setting-hint {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.8rem;
  color: var(--color-primary, #6366f1);
}

.setting-control {
  display: flex;
  align-items: center;
}

.model-control {
  flex-direction: column;
  align-items: stretch;
  gap: 0.5rem;
}

.model-select-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.model-search {
  width: 100%;
}

/* 控件样式 */
.setting-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  color: #374151;
  font-size: 0.875rem;
  min-width: 80px;
}

.setting-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.range-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.setting-range {
  width: 100px;
}

.range-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  min-width: 40px;
}

/* 下拉选择框样式 */
.setting-select {
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background-color: white;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23374151' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 12px;
  color: #374151;
  font-size: 0.875rem;
  cursor: pointer;
  transition: border-color 0.2s ease;
  appearance: none;
  min-width: 120px;
}

.setting-select:hover {
  border-color: #94a3b8;
}

.setting-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

[data-theme='dark'] .setting-select {
  background-color: #374151;
  border-color: #4b5563;
  color: #e5e7eb;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23e5e7eb' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
}

[data-theme='dark'] .setting-select:hover {
  border-color: #6b7280;
}

/* 数字/文本配置输入框（与 setting-select 统一视觉） */
.config-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background-color: white;
  color: #374151;
  font-size: 0.875rem;
  min-width: 80px;
  max-width: 140px;
  transition: border-color 0.2s ease;
}

.config-input:hover {
  border-color: #94a3b8;
}

.config-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.config-input.wide {
  max-width: 100%;
  width: 280px;
}

[data-theme='dark'] .config-input {
  background-color: #374151;
  border-color: #4b5563;
  color: #e5e7eb;
}

[data-theme='dark'] .config-input:hover {
  border-color: #6b7280;
}

[data-theme='dark'] .config-input::placeholder {
  color: #9ca3af;
}

/* 开关样式 */
.setting-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.setting-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #cbd5e1;
  transition: 0.2s;
  border-radius: 24px;
}

.switch-slider:before {
  position: absolute;
  content: '';
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
}

input:checked + .switch-slider {
  background-color: #3b82f6;
}

input:checked + .switch-slider:before {
  transform: translateX(20px);
}

/* 全宽设置项 */
.setting-item-full {
  flex-direction: column;
  align-items: flex-start;
}

.setting-control-full {
  width: 100%;
  margin-top: 0.5rem;
}

.setting-textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: #374151;
  font-size: 0.875rem;
  font-family: inherit;
  resize: vertical;
  min-height: 60px;
}

.setting-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.setting-textarea::placeholder {
  color: #9ca3af;
}

[data-theme='dark'] .setting-textarea {
  background: #374151;
  border-color: #4b5563;
  color: #e5e7eb;
}

[data-theme='dark'] .setting-textarea::placeholder {
  color: #6b7280;
}

/* 工具按钮 */
.utility-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
}

.utility-btn:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

/* 响应式设计 */
@media (max-width: 640px) {
  .setting-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .setting-control {
    width: 100%;
    justify-content: flex-end;
  }

  .model-control {
    justify-content: flex-start;
  }

  .model-select-row {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .model-select-row .setting-select,
  .model-select-row .utility-btn {
    width: 100%;
    justify-content: center;
  }

  .range-container {
    width: 100%;
    justify-content: space-between;
  }

  .header-actions .btn-text {
    display: none;
  }
}

/* 深色主题 */
[data-theme='dark'] .settings-panel {
  background: var(--color-background);
}

[data-theme='dark'] .panel-header,
[data-theme='dark'] .settings-section {
  background: #1e293b;
  border-color: #475569;
}

[data-theme='dark'] .section-header {
  background: #334155;
  border-bottom-color: #475569;
}

[data-theme='dark'] .panel-title,
[data-theme='dark'] .section-title,
[data-theme='dark'] .setting-name {
  color: #f1f5f9;
}

[data-theme='dark'] .settings-subtitle,
[data-theme='dark'] .setting-desc {
  color: #94a3b8;
}

[data-theme='dark'] .setting-item:hover {
  background: #334155;
}

[data-theme='dark'] .action-btn,
[data-theme='dark'] .setting-select,
[data-theme='dark'] .utility-btn {
  background: #374151;
  border-color: #4b5563;
  color: #e5e7eb;
}

[data-theme='dark'] .action-btn:hover,
[data-theme='dark'] .utility-btn:hover {
  background: #4b5563;
  border-color: #6b7280;
}

[data-theme='dark'] .switch-slider {
  background-color: #4b5563;
}

/* 授权验证相关样式 */
.form-input-inline {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  color: #374151;
  font-size: 0.875rem;
  min-width: 200px;
  transition: all 0.2s ease;
}

.form-input-inline:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.auth-status {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
}

.auth-status.verified {
  background: #d1fae5;
  color: #059669;
  border: 1px solid #a7f3d0;
}

.auth-status.unverified {
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.utility-btn.primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.utility-btn.primary:hover {
  background: var(--color-primary-dark, #2563eb);
  border-color: var(--color-primary-dark, #2563eb);
}

[data-theme='dark'] .form-input-inline {
  background: #334155;
  border-color: #475569;
  color: #e5e7eb;
}

[data-theme='dark'] .auth-status.verified {
  background: rgba(5, 150, 105, 0.2);
  color: #6ee7b7;
  border-color: rgba(5, 150, 105, 0.3);
}

[data-theme='dark'] .auth-status.unverified {
  background: rgba(220, 38, 38, 0.2);
  color: #fca5a5;
  border-color: rgba(220, 38, 38, 0.3);
}

/* 加载脉冲动画 */
.loading-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

</style>
