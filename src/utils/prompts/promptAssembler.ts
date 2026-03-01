import { getPrompt } from '@/services/defaultPrompts';
import { SAVE_DATA_STRUCTURE_MING, stripNsfwContentMing } from './definitions/ming/dataDefinitionsMing';
// import { isTavernEnv } from '@/utils/tavern';
import { getNsfwSettingsFromStorage } from '@/utils/nsfw';

// 导出常用的规则常量（Ming 通用版）
export { SAVE_DATA_STRUCTURE_MING as DATA_STRUCTURE_DEFINITIONS };

/** 组装时可选：收集每个模组信息（用于调试可视化） */
export interface AssembleSectionCollector {
  (module: { key: string; 构成: string; 生成原因: string; content: string }): void;
}

/**
 * 组装最终的系统Prompt（异步版本，支持自定义提示词）
 * 所有提示词都通过 getPrompt() 获取，支持用户自定义
 * @param activePrompts - 一个包含了当前需要激活的prompt模块名称的数组
 * @param customActionPrompt - 自定义行动选项提示词（可选）
 * @param gameState - 游戏状态（可选，用于检测联机穿越状态）
 * @param options - onSection：调试用；actionOptionsMode/actionPace：行动选项子模式（可选）
 * @returns {Promise<string>} - 拼接好的完整prompt字符串
 */
export async function assembleSystemPrompt(
  activePrompts: string[],
  customActionPrompt?: string,
  gameState?: any,
  options?: {
    onSection?: AssembleSectionCollector;
    actionOptionsMode?: 'action' | 'story';
    actionPace?: 'fast' | 'slow';
  }
): Promise<string> {
  const push = options?.onSection;
  const actionOptionsMode = options?.actionOptionsMode ?? 'action';
  const actionPace = options?.actionPace ?? 'fast';

  // 所有提示词都使用 getPrompt() 获取，支持用户自定义
  const [
    coreRulesPrompt,
    businessRulesPrompt,
    dataDefinitionsPrompt,
    textFormatsPrompt,
    worldStandardsPrompt
  ] = await Promise.all([
    getPrompt('coreOutputRules'),
    getPrompt('businessRules'),
    getPrompt('dataDefinitions'),
    getPrompt('textFormatRules'),
    getPrompt('worldStandards')
  ]);

  // [Ming] NSFW 内容开关不再依赖于酒馆环境，而是完全由设置控制 (nsfwMode)
  // const tavernEnv = isTavernEnv(); // 移除旧逻辑依赖
  const settingsFromStore = getNsfwSettingsFromStorage();
  const cfg = (gameState?.系统?.配置 ?? {}) as Record<string, unknown>;
  // 优先使用游戏内配置，否则使用全局设置
  const nsfwMode = typeof cfg.nsfwMode === 'boolean' ? cfg.nsfwMode : settingsFromStore.nsfwMode;

  const sanitizedDataDefinitionsPrompt = nsfwMode ? dataDefinitionsPrompt : stripNsfwContentMing(dataDefinitionsPrompt);
  const sanitizedBusinessRulesPrompt = nsfwMode ? businessRulesPrompt : stripNsfwContentMing(businessRulesPrompt);

  const promptSections: string[] = [];

  const add = (key: string, 构成: string, 原因: string, content: string) => {
    promptSections.push(content); // 实际参与返回值的只有这一行
    push?.({ key, 构成, 生成原因: 原因, content }); // 调试用，不影响返回值
  };

  add('coreOutputRules', '核心输出规则', '正常游戏请求时按顺序发送', coreRulesPrompt);
  add('businessRules', '核心规则', 'NPC、冲突、难度等业务规则', sanitizedBusinessRulesPrompt);
  add('dataDefinitions', '数据结构', '存档结构定义', sanitizedDataDefinitionsPrompt);
  add('textFormatRules', '文本格式', '判定、伤害、命名', textFormatsPrompt);
  add('worldStandards', '世界标准', '属性、品质', worldStandardsPrompt);

  if (activePrompts.includes('actionOptions')) {
    const promptKey = actionOptionsMode === 'story' ? 'actionOptionsStory' : 'actionOptions';
    let actionOptionsPrompt = (await getPrompt(promptKey)).trim();
    const customPromptSection = customActionPrompt
      ? `**用户自定义要求**：${customActionPrompt}

请严格按照以上自定义要求生成行动选项。`
      : '（无特殊要求，按默认规则生成）';
    if (actionOptionsPrompt) {
      actionOptionsPrompt = actionOptionsPrompt.replace('{{CUSTOM_ACTION_PROMPT}}', customPromptSection);
      if (actionOptionsMode === 'action') {
        const paceHint =
          actionPace === 'fast'
            ? '**当前为快速推动剧情模式**：选项请保持简短明确（8–20 字），便于快速推进。'
            : '**当前为慢速体验剧情模式**：选项可稍详细一些（可至 30 字左右），便于沉浸体验。';
        actionOptionsPrompt = actionOptionsPrompt.replace('{{ACTION_PACE_HINT}}', paceHint);
      } else {
        actionOptionsPrompt = actionOptionsPrompt.replace('{{ACTION_PACE_HINT}}', '');
      }
      add('actionOptions', '行动选项', '生成玩家可选的行动选项', actionOptionsPrompt);
    }
  }

  if (activePrompts.includes('eventSystem')) {
    const eventRules = (await getPrompt('eventSystemRules')).trim();
    if (eventRules) {
      promptSections.push(eventRules);
      push?.({ key: 'eventSystemRules', 构成: '世界事件规则', 生成原因: '世界事件演变与影响', content: eventRules });
    }
  }

  // 始终注入 NSFW 设置规则（即使是 disabled 状态，也明确告知 AI 禁止生成）
  {
    const nsfwGenderFilter =
      typeof cfg.nsfwGenderFilter === 'string' ? cfg.nsfwGenderFilter : settingsFromStore.nsfwGenderFilter;
    const content = [
      '# NSFW设置',
      `- nsfwMode: ${nsfwMode ? 'true' : 'false'}`,
      `- nsfwGenderFilter: ${nsfwGenderFilter}`,
      '- 当 nsfwMode=true 且 NPC性别符合过滤条件时，创建NPC必须生成完整私密信息(PrivacyProfile)',
      '- 若 NPC 已存在但私密信息缺失，需用 set 写入 社交.关系.[NPC名].私密信息 完整对象',
      '- 当 nsfwMode=false 或 性别不匹配 时，禁止生成私密信息'
    ].join('\n');
    promptSections.push(content);
    push?.({ key: 'nsfwSettings', 构成: 'NSFW设置', 生成原因: '私密信息生成范围控制', content });
  }

  const onlineState = gameState?.系统?.联机 || gameState?.onlineState;
  const isTraveling = onlineState?.模式 === '联机' && onlineState?.房间ID && onlineState?.穿越目标;

  if (isTraveling) {
    const onlineModeRules = (await getPrompt('onlineModeRules')).trim();
    if (onlineModeRules) {
      promptSections.push(onlineModeRules);
      push?.({ key: 'onlineModeRules', 构成: '联机规则', 生成原因: '联机穿越时注入', content: onlineModeRules });
    }
    const onlineTravelContext = (await getPrompt('onlineTravelContext')).trim();
    if (onlineTravelContext) {
      promptSections.push(onlineTravelContext);
      push?.({ key: 'onlineTravelContext', 构成: '穿越场景理解', 生成原因: '联机穿越时注入', content: onlineTravelContext });
    }
    const onlineWorldSync = (await getPrompt('onlineWorldSync')).trim();
    if (onlineWorldSync) {
      promptSections.push(onlineWorldSync);
      push?.({ key: 'onlineWorldSync', 构成: '联机世界同步', 生成原因: '联机穿越时注入', content: onlineWorldSync });
    }
    const onlineInteraction = (await getPrompt('onlineInteraction')).trim();
    if (onlineInteraction) {
      promptSections.push(onlineInteraction);
      push?.({ key: 'onlineInteraction', 构成: '联机交互', 生成原因: '联机穿越时注入', content: onlineInteraction });
    }
  }

  const normalizedSections = promptSections
    .map(section => section.trim())
    .filter(Boolean);

  return normalizedSections.join('\n\n---\n\n');
}
