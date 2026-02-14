import { sanitizeAITextForDisplay } from '@/utils/textSanitizer';
import { useAPIManagementStore } from '@/stores/apiManagementStore';
import { aiService } from '@/services/aiService';
import { getPrompt } from '@/services/defaultPrompts';
import { ResponseParser } from './ResponseParser';
import type { GameTime } from '@/types/game';

/**
 * TextProcessor
 * 负责所有的文本清理、格式化和优化操作
 */
export class TextProcessor {
  /**
   * 提取AI响应中的叙事文本
   * 移除思维链标签，尝试解析JSON或代码块
   */
  public static extractNarrativeText(raw: string): string {
    // 🔥 移除思维链标签（兜底保护）
    const cleaned = String(raw || '')
      .replace(/<(?:ant[-_]?)?thinking>[\s\S]*?<\/(?:ant[-_]?)?thinking>/gi, '')
      .replace(/<\/?(?:ant[-_]?)?thinking>/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
      .replace(/<\/?reasoning>/gi, '')
      .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
      .replace(/<\/?thought>/gi, '')
      .trim();

    if (!cleaned) return '';

    // 如果是JSON格式，提取text字段
    if (cleaned.startsWith('{') || cleaned.includes('```')) {
      try {
        const parsed = ResponseParser.parseAIResponse(cleaned);
        return parsed?.text?.trim() || '';
      } catch {
        // JSON解析失败，尝试提取代码块
        const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (codeBlockMatch?.[1]) {
          try {
            const obj = JSON.parse(codeBlockMatch[1].trim()) as Record<string, unknown>;
            return String(obj.text || obj.叙事文本 || obj.narrative || '').trim();
          } catch {
            // 代码块内容本身就是文本
            return codeBlockMatch[1].trim();
          }
        }
      }
    }

    return cleaned;
  }

  /**
   * 文本优化：调用AI对生成的文本进行润色
   */
  public static async optimizeText(
    text: string,
    onProgressUpdate?: (progress: string) => void
  ): Promise<string> {
    const apiStore = useAPIManagementStore();

    if (!apiStore.isFunctionEnabled('text_optimization')) {
      return text;
    }

    // 检查是否有可用的API配置
    const apiConfig = apiStore.getAPIForType('text_optimization');
    if (!apiConfig) {
      console.warn('[文本优化] 未配置text_optimization API，跳过优化');
      return text;
    }

    onProgressUpdate?.('正在优化文本…');

    try {
      const textOptPrompt = await getPrompt('textOptimization');

      const optimizedText = await aiService.generateRaw({
        ordered_prompts: [
          { role: 'system', content: textOptPrompt },
          { role: 'user', content: `请优化以下文本：\n\n${text}` }
        ],
        should_stream: false,
        generation_id: `text_optimization_${Date.now()}`,
        usageType: 'text_optimization',
      });

      const result = String(optimizedText).trim();
      if (result && result.length > 0) {
        console.log('[文本优化] 优化完成，原长度:', text.length, '新长度:', result.length);
        return result;
      }

      console.warn('[文本优化] 优化结果为空，使用原文本');
      return text;
    } catch (error) {
      console.error('[文本优化] 优化失败:', error);
      return text;
    }
  }

  public static formatGameTime(gameTime: GameTime | undefined): string {
    if (!gameTime) return '【仙历元年】';
    const minutes = gameTime.分钟 ?? 0;
    return `【仙道${gameTime.年}年${gameTime.月}月${gameTime.日}日 ${String(gameTime.小时).padStart(2, '0')}:${String(minutes).padStart(2, '0')}】`;
  }

  public static sanitizeActionOptions(options: unknown): string[] {
    if (!Array.isArray(options)) return [];
    return options
      .filter((opt) => typeof opt === 'string')
      .map((opt) => sanitizeAITextForDisplay(opt).trim())
      .filter((opt) => opt.length > 0);
  }
}
