/**
 * 提示词配置服务 [MING - Simplified]
 * 本地提示词配置，不依赖后端
 * 优先级：用户自定义 > 本地默认
 */

// [MING] Removed backend dependencies - local only
// import { request } from './request';
// import { isBackendConfigured } from './backendConfig';

// 远程提示词配置接口（保留类型定义以兼容）
export interface RemotePromptConfig {
  prompts: Record<string, {
    content: string;
    enabled: boolean;
    description?: string;
  }>;
  version: string;
  lastUpdated?: string;
}

// [MING] No remote config - always null
let cachedRemoteConfig: RemotePromptConfig | null = null;

/**
 * [MING] 从后端获取远程提示词配置 - 禁用，始终返回null
 * @returns 始终返回 null
 */
export async function fetchRemotePromptConfig(): Promise<RemotePromptConfig | null> {
  // [MING] Backend removed - always return null
  console.log('[提示词配置] Ming模式：使用本地配置');
  return null;
}

/**
 * 获取指定 key 的提示词内容
 * @param key 提示词 key
 * @param defaultValue 默认值
 * @returns 提示词内容
 */
export function getPromptWithRemoteOverride(key: string, defaultValue: string): string {
  // [MING] Always use default value since no remote config
  return defaultValue;
}

/**
 * 检查指定 key 的提示词是否启用
 * @param key 提示词 key
 * @returns 是否启用
 */
export function isPromptEnabled(key: string): boolean {
  // [MING] Always enabled
  return true;
}

/**
 * 获取所有远程提示词配置
 * @returns 空对象（Ming模式无远程配置）
 */
export function getAllRemotePrompts(): Record<string, { content: string; enabled: boolean }> {
  return {};
}

/**
 * 清除缓存的远程配置
 */
export function clearRemotePromptCache(): void {
  cachedRemoteConfig = null;
  console.log('[提示词配置] 已清除配置缓存');
}

/**
 * 获取远程配置版本
 * @returns 始终返回 null（Ming模式无远程配置）
 */
export function getRemoteConfigVersion(): string | null {
  return null;
}
