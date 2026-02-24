/**
 * 主回合 AI 响应结构验证（与 MainGamePanel 重试逻辑一致）
 * 用于在应用指令与 embedding 前判定响应是否合法，避免失败回合污染状态与向量库。
 */

export interface AIResponseValidation {
  isValid: boolean;
  errors: string[];
}

export function validateAIResponse(response: unknown): AIResponseValidation {
  const errors: string[] = [];

  if (!response) {
    errors.push('AI响应为空');
    return { isValid: false, errors };
  }

  const resp = response as Record<string, unknown>;

  if (!resp.text || typeof resp.text !== 'string') {
    errors.push('缺少有效的text字段');
  }

  const mid = resp.mid_term_memory;
  if (mid == null) {
    errors.push('缺少必要的mid_term_memory字段（中期记忆总结）');
  } else if (typeof mid === 'string') {
    if ((mid as string).trim().length === 0) errors.push('mid_term_memory字段不能为空');
  } else if (typeof mid === 'object' && typeof (mid as { 记忆主体?: string }).记忆主体 === 'string') {
    if ((mid as { 记忆主体: string }).记忆主体.trim().length === 0) errors.push('mid_term_memory.记忆主体不能为空');
  } else {
    errors.push('mid_term_memory须为字符串或隐性格式对象');
  }

  if (resp.tavern_commands) {
    if (!Array.isArray(resp.tavern_commands)) {
      errors.push('tavern_commands字段必须是数组');
    } else {
      resp.tavern_commands.forEach((cmd: unknown, index: number) => {
        const command = cmd as Record<string, unknown>;
        if (!cmd || typeof cmd !== 'object') {
          errors.push(`tavern_commands[${index}]不是有效对象`);
        } else if (!command.action || !command.key) {
          errors.push(`tavern_commands[${index}]缺少必要字段(action/key)`);
        }
      });
    }
  }

  return { isValid: errors.length === 0, errors };
}
