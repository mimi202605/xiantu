import { toast } from '@/utils/toast';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useCharacterStore } from '@/stores/characterStore';
import { getPrompt } from '@/services/defaultPrompts';
import { getTavernHelper } from '@/utils/tavern';
import { aiService } from '@/services/aiService';
import type { SaveData } from '@/types/game';
import { cloneDeep } from 'lodash';
import { ResponseParser } from './ResponseParser';

/**
 * 记忆总结选项
 */
export interface MemorySummaryOptions {
  useRawMode?: boolean;
  useStreaming?: boolean;
}

export class MemoryManager {
  private static isSummarizing = false;

  public static async triggerMemorySummary(options?: MemorySummaryOptions): Promise<void> {
    if (this.isSummarizing) {
      toast.warning('已有一个总结任务正在进行中，请稍候...');
      console.log('[AI双向系统] 检测到已有总结任务在运行，本次触发被跳过。');
      return;
    }

    this.isSummarizing = true;
    console.log('[AI双向系统] 开始记忆总结流程...');
    toast.loading('正在调用AI总结中期记忆...', { id: 'memory-summary' });

    try {
      const gameStateStore = useGameStateStore();
      const characterStore = useCharacterStore();
      const saveData = gameStateStore.toSaveData();

      if (!saveData || !(saveData as any).社交?.记忆) {
        throw new Error('无法获取存档数据或记忆模块');
      }

      // 1. 从 localStorage 读取最新配置
      const settings = JSON.parse(localStorage.getItem('memory-settings') || '{}');
      const midTermTrigger = settings.midTermTrigger ?? 25;
      const midTermKeep = settings.midTermKeep ?? 8;

      // 2. 再次检查是否需要总结
      const midTermMemories = (saveData as any).社交.记忆.中期记忆 || [];

      // 检查中期记忆数量是否达到触发阈值
      if (midTermMemories.length < midTermTrigger) {
        console.log(`[AI双向系统] 中期记忆数量(${midTermMemories.length})未达到触发阈值(${midTermTrigger})，取消总结。`);
        toast.info(`中期记忆未达到触发阈值(${midTermTrigger}条)，已取消总结`, { id: 'memory-summary' });
        return;
      }

      // 3. 确定要总结和保留的记忆
      const numToSummarize = midTermTrigger - midTermKeep;

      if (numToSummarize <= 0) {
        console.log('[AI双向系统] 计算出的总结数量 <= 0，配置错误，取消操作。');
        toast.error('记忆配置错误：触发阈值必须大于保留数量', { id: 'memory-summary' });
        return;
      }

      if (midTermMemories.length < numToSummarize) {
        console.log(`[AI双向系统] 中期记忆数量(${midTermMemories.length})不足以总结${numToSummarize}条，取消总结。`);
        toast.info(`中期记忆不足${numToSummarize}条，已取消总结`, { id: 'memory-summary' });
        return;
      }

      // 从最旧的记忆开始（数组前面），取出需要总结的数量
      const memoriesToSummarize = midTermMemories.slice(0, numToSummarize);
      // 保留剩余的记忆（从 numToSummarize 位置开始到末尾）
      const memoriesToKeep = midTermMemories.slice(numToSummarize);
      const memoriesText = memoriesToSummarize.map((m: string, i: number) => `${i + 1}. ${m}`).join('\n');

      console.log(`[AI双向系统] 准备总结：从${midTermMemories.length}条中期记忆中，总结最旧的${numToSummarize}条，保留最新的${memoriesToKeep.length}条`);
      console.log(`[AI双向系统] 配置：触发阈值=${midTermTrigger}, 保留数量=${midTermKeep}, 总结数量=${numToSummarize}`);

      // 4. 使用用户自定义的记忆总结提示词
      const memorySummaryPrompt = await getPrompt('memorySummary');
      const userPrompt = memorySummaryPrompt.replace('{{记忆内容}}', memoriesText);

      // 5. 调用 AI
      const tavernHelper = getTavernHelper();

      // 从aiService读取通用配置（流式等）
      const aiConfig = aiService.getConfig();
      const useStreaming = aiConfig.streaming !== false;

      // 记忆总结模式：从 API管理 的“功能分配 -> 模式”读取（酒馆端有效）
      let useRawMode = true;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useAPIManagementStore } = require('@/stores/apiManagementStore');
        const apiStore = useAPIManagementStore();
        useRawMode = apiStore.getFunctionMode('memory_summary') === 'raw';
      } catch {
        // 兼容旧配置
        useRawMode = aiConfig.memorySummaryMode === 'raw';
      }

      // 检查AI服务可用性
      if (!tavernHelper) {
        const availability = aiService.checkAvailability();
        if (!availability.available) {
          throw new Error(availability.message);
        }
      }

      // 🔥 获取精简版游戏存档数据（只包含记忆总结需要的信息）
      const simplifiedSaveData = this._extractEssentialDataForSummary(saveData);
      const saveDataJson = JSON.stringify(simplifiedSaveData, null, 2);

      console.log(`[AI双向系统] 记忆总结模式: ${useRawMode ? 'Raw模式（纯净总结）' : '标准模式（带预设）'}, 传输方式: ${useStreaming ? '流式' : '非流式'}`);

      let response: string;

      if (tavernHelper) {
        // 酒馆模式
        if (useRawMode) {
          // Raw模式：使用自定义提示词
          const rawResponse = await tavernHelper.generateRaw({
            ordered_prompts: [
              { role: 'system', content: `【游戏存档数据】（供参考）：\n${saveDataJson}` },
              { role: 'user', content: userPrompt },
              { role: 'user', content: ['Continue.', 'Proceed.', 'Next.', 'Go on.', 'Resume.'][Math.floor(Math.random() * 5)] },
              { role: 'assistant', content: '</input>' }
            ],
            should_stream: useStreaming,
            usageType: 'memory_summary'
          });
          response = String(rawResponse);
        } else {
          // 标准模式：使用自定义提示词
          const systemPromptCombined = `${memorySummaryPrompt}
\n【游戏存档数据】（供参考）：
${saveDataJson}`;

          const standardResponse = await tavernHelper.generate({
            user_input: userPrompt,
            should_stream: useStreaming,
            generation_id: `memory_summary_${Date.now()}`,
            usageType: 'memory_summary',
            injects: [
              {
                content: systemPromptCombined,
                role: 'system',
                depth: 4,  // 插入到较深位置，确保在用户输入之前
                position: 'in_chat'
              },
              // 🛡️ 添加assistant角色的占位消息（防止输入截断）
              {
                content: '</input>',
                role: 'assistant',
                depth: 0,  // 插入到最新位置
                position: 'in_chat'
              }
            ]
          });
          response = String(standardResponse);
        }
      } else {
        // 自定义API模式
        if (useRawMode) {
          console.log('[AI双向系统] 自定义API模式 - Raw模式记忆总结');
          response = await aiService.generateRaw({
            ordered_prompts: [
              { role: 'system', content: `【游戏存档数据】（供参考）：\n${saveDataJson}` },
              { role: 'user', content: userPrompt },
              { role: 'user', content: ['Continue.', 'Proceed.', 'Next.', 'Go on.', 'Resume.'][Math.floor(Math.random() * 5)] }
            ],
            should_stream: useStreaming,
            usageType: 'memory_summary'
          });
        } else {
          console.log('[AI双向系统] 自定义API模式 - 标准模式记忆总结');
          const systemPromptCombined = `${memorySummaryPrompt}
\n【游戏存档数据】（供参考）：
${saveDataJson}`;

          response = await aiService.generate({
            user_input: userPrompt,
            should_stream: useStreaming,
            generation_id: `memory_summary_${Date.now()}`,
            usageType: 'memory_summary',
            injects: [
              {
                content: systemPromptCombined,
                role: 'system',
                depth: 4,
                position: 'in_chat'
              }
            ] as any
          });
        }
      }

      // 解析响应（与NPC记忆总结相同的方式）
      let summaryText: string;
      const responseText = String(response).trim();

      const parsedRes = ResponseParser.parseAIResponse(responseText);
      if (parsedRes.text) {
        summaryText = parsedRes.text.trim();
      } else {
        summaryText = responseText;
      }

      if (!summaryText || summaryText.length === 0) {
        throw new Error('AI返回了空的总结结果');
      }

      console.log('[AI双向系统] 总结文本长度:', summaryText.length, '预览:', summaryText.substring(0, 100));

      // 6. 更新游戏状态
      // 长期记忆不需要时间前缀和【记忆总结】标签，直接存储总结内容
      const newLongTermMemory = summaryText;

      // 确保 memory 对象存在
      if (!gameStateStore.memory) {
        gameStateStore.memory = { 短期记忆: [], 中期记忆: [], 长期记忆: [], 隐式中期记忆: [] };
      }

      gameStateStore.memory.长期记忆.push(newLongTermMemory);
      gameStateStore.memory.中期记忆 = memoriesToKeep;

      // 7. 保存到存档
      await characterStore.saveCurrentGame();

      console.log(`[AI双向系统] ✅ 总结完成：${numToSummarize}条中期记忆 -> 1条长期记忆。保留 ${memoriesToKeep.length} 条。`);
      toast.success(`成功总结 ${numToSummarize} 条记忆！`, { id: 'memory-summary' });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      console.error('[AI双向系统] 记忆总结失败:', error);
      toast.error(`记忆总结失败: ${errorMsg}`, { id: 'memory-summary' });
    } finally {
      this.isSummarizing = false;
      console.log('[AI双向系统] 记忆总结流程结束，已释放锁。');
    }
  }

  private static _extractEssentialDataForSummary(saveData: SaveData): SaveData {
    const simplified = cloneDeep(saveData);

    // 移除叙事历史（避免与短期记忆重复）
    if (simplified.历史?.叙事) {
      delete simplified.历史.叙事;
    }

    // 移除短期和隐式中期记忆（以优化AI上下文）
    if (simplified.记忆) {
      delete simplified.记忆.短期记忆;
      delete simplified.记忆.隐式中期记忆;
    }

    return simplified;
  }
}
