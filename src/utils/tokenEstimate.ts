/**
 * 估算文本的 token 数量（与 aiService 的 estimateTokensForText 一致，供提示词组装等调试 UI 使用）。
 * 启发式：CJK 字符 ≈ 1 token，其他 ≈ 4 字符 1 token。
 */
export function estimateTokensForText(text: string): number {
  if (!text) return 0;
  let cjkCount = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 0x4e00 && code <= 0x9fff) cjkCount++;
  }
  const nonCjkCount = Math.max(0, text.length - cjkCount);
  return cjkCount + Math.ceil(nonCjkCount / 4);
}
