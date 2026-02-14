import { sanitizeAITextForDisplay } from '@/utils/textSanitizer';
import type { GM_Response } from '@/types/AIGameMaster';
import { TextProcessor } from './TextProcessor';

/**
 * ResponseParser
 * 负责将AI返回的字符串解析为结构化的GM_Response对象
 */
export class ResponseParser {
  /**
   * 将原始响应解析为 GM_Response
   * @param rawResponse AI返回的原始字符串
   */
  public static parseAIResponse(rawResponse: string): GM_Response {
    if (!rawResponse || typeof rawResponse !== 'string') {
      throw new Error('AI响应为空或格式错误');
    }

    const rawText = rawResponse.trim();
    // console.log('[parseAIResponse] 原始响应长度:', rawText.length); // Disable excessive logging for now

    // 移除思维链
    const cleanedText = rawText
      .replace(/<(?:ant[-_]?)?thinking>[\s\S]*?<\/(?:ant[-_]?)?thinking>/gi, '')
      .replace(/<\/?(?:ant[-_]?)?thinking>/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
      .replace(/<\/?reasoning>/gi, '')
      .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
      .replace(/<\/?thought>/gi, '')
      .trim();

    const tryParse = (text: string): Record<string, unknown> | null => {
      try {
        return JSON.parse(text) as Record<string, unknown>;
      } catch {
        return null;
      }
    };

    const standardize = (obj: Record<string, unknown>): GM_Response => {
      const commands = Array.isArray(obj.tavern_commands) ? obj.tavern_commands :
                      Array.isArray(obj.指令) ? obj.指令 :
                      Array.isArray(obj.commands) ? obj.commands : [];

      const tavernCommands = commands.map((cmd: any) => ({
        action: cmd.action || 'set',
        key: cmd.key || '',
        value: cmd.value
      }));

      let actionOptions = Array.isArray(obj.action_options) ? obj.action_options :
                          Array.isArray(obj.行动选项) ? obj.行动选项 : [];

      actionOptions = actionOptions.filter((opt: unknown) =>
        typeof opt === 'string' && opt.trim().length > 0
      );

      if (actionOptions.length === 0) {
        console.warn('[parseAIResponse] ⚠️ action_options为空，使用默认选项');
        actionOptions = [
          '继续当前活动',
          '观察周围环境',
          '与附近的人交谈',
          '查看自身状态',
          '稍作休息调整'
        ];
      }

      const gm: GM_Response = {
        text: String(obj.text || obj.叙事文本 || obj.narrative || ''),
        mid_term_memory: String(obj.mid_term_memory || obj.中期记忆 || obj.memory || ''),
        tavern_commands: tavernCommands,
        action_options: TextProcessor.sanitizeActionOptions(actionOptions)
      };
      if (obj.semantic_memory != null && typeof obj.semantic_memory === 'object') gm.semantic_memory = obj.semantic_memory as GM_Response['semantic_memory'];
      return gm;
    };

    // 1. 直接解析
    let parsedObj = tryParse(cleanedText);
    if (parsedObj) return standardize(parsedObj);

    // 2. 提取代码块
    const codeBlockMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
    if (codeBlockMatch?.[1]) {
      parsedObj = tryParse(codeBlockMatch[1].trim());
      if (parsedObj) return standardize(parsedObj);
    }

    // 3. 提取第一个JSON对象
    const extractFirstJSON = (text: string): string | null => {
        const startIndex = text.indexOf('{');
        if (startIndex === -1) return null;

        let depth = 0;
        let inString = false;
        let escapeNext = false;

        for (let i = startIndex; i < text.length; i++) {
          const char = text[i];
          if (escapeNext) { escapeNext = false; continue; }
          if (char === '\\') { escapeNext = true; continue; }
          if (char === '"') { inString = !inString; continue; }
          if (inString) continue;

          if (char === '{') depth++;
          if (char === '}') {
            depth--;
            if (depth === 0) return text.substring(startIndex, i + 1);
          }
        }
        return null;
      };

      const firstJSON = extractFirstJSON(cleanedText);
      if (firstJSON) {
        parsedObj = tryParse(firstJSON);
        if (parsedObj) {
          // console.log('[parseAIResponse] ✅ 成功提取第一个JSON对象');
          return standardize(parsedObj);
        }
      }

      throw new Error('无法解析AI响应：未找到有效的JSON格式');
  }

  /**
   * 仅提取命令（供非主流程使用）
   */
  public static extractTavernCommands(
    rawResponse: string | Record<string, unknown> | null | undefined
  ): Array<{ action: string; key: string; value?: unknown }> {
    let contentStr: string;
    if (rawResponse == null) {
      contentStr = '';
    } else if (typeof rawResponse === 'string') {
      contentStr = rawResponse.trim();
    } else {
      const obj = rawResponse as Record<string, unknown>;
      const fromChoices = (obj.choices as Array<{ message?: { content?: string } }>)?.[0]?.message?.content;
      const fromCandidates = (obj.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }>)?.[0]?.content?.parts?.[0]?.text;
      contentStr = (typeof fromChoices === 'string' ? fromChoices : fromCandidates ?? '').trim();
      if (!contentStr && typeof obj.text === 'string') contentStr = String(obj.text).trim();
      if (!contentStr) contentStr = JSON.stringify(rawResponse);
    }

    // 移除思维链
    const cleanedText = contentStr
      .replace(/<(?:ant[-_]?)?thinking>[\s\S]*?<\/(?:ant[-_]?)?thinking>/gi, '')
      .replace(/<\/?(?:ant[-_]?)?thinking>/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
      .replace(/<\/?reasoning>/gi, '')
      .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
      .replace(/<\/?thought>/gi, '')
      .trim();

    const tryParse = (text: string): Record<string, unknown> | null => {
      try {
        return JSON.parse(text) as Record<string, unknown>;
      } catch {
        return null;
      }
    };

    // 1. 直接解析
    let parsedObj = tryParse(cleanedText);
    if (parsedObj) {
        const cmds = Array.isArray(parsedObj.tavern_commands) ? parsedObj.tavern_commands : Array.isArray(parsedObj.指令) ? parsedObj.指令 : [];
        return cmds.map((cmd: any) => ({ action: cmd.action || 'set', key: cmd.key || '', value: cmd.value }));
    }

    // 2. 提取代码块
    const codeBlockMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
    if (codeBlockMatch?.[1]) {
        parsedObj = tryParse(codeBlockMatch[1].trim());
        if (parsedObj) {
            const cmds = Array.isArray(parsedObj.tavern_commands) ? parsedObj.tavern_commands : Array.isArray(parsedObj.指令) ? parsedObj.指令 : [];
            return cmds.map((cmd: any) => ({ action: cmd.action || 'set', key: cmd.key || '', value: cmd.value }));
        }
    }

    // 3. 提取第一个 JSON 对象
    const extractFirstJSON = (text: string): string | null => {
        const startIndex = text.indexOf('{');
        if (startIndex === -1) return null;
        let depth = 0;
        let inString = false;
        let escapeNext = false;
        for (let i = startIndex; i < text.length; i++) {
            const char = text[i];
            if (escapeNext) { escapeNext = false; continue; }
            if (char === '\\') { escapeNext = true; continue; }
            if (char === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (char === '{') depth++;
            if (char === '}') { depth--; if (depth === 0) return text.substring(startIndex, i + 1); }
        }
        return null;
    };
    const firstJSON = extractFirstJSON(cleanedText);
    if (firstJSON) {
        parsedObj = tryParse(firstJSON);
        if (parsedObj) {
            const cmds = Array.isArray(parsedObj.tavern_commands) ? parsedObj.tavern_commands : Array.isArray(parsedObj.指令) ? parsedObj.指令 : [];
            return cmds.map((cmd: any) => ({ action: cmd.action || 'set', key: cmd.key || '', value: cmd.value }));
        }
    }

    return [];
  }
}
