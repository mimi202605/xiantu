import { AIRequestCoordinator, ProcessOptions } from '@/systems/ai/AIRequestCoordinator';
import { MemoryManager, MemorySummaryOptions } from '@/systems/ai/MemoryManager';
import { getTavernHelper } from '@/utils/tavern';
import type { GM_Response } from '@/types/AIGameMaster';
import type { SaveData, StateChangeLog, CharacterProfile } from '@/types/game';

/**
 * AIBidirectionalSystem (Facade)
 *
 * This class now acts as a facade, delegating all logic to the new modular components
 * in `src/systems/ai/`. This ensures backward compatibility with existing code.
 */
class AIBidirectionalSystemClass {
  private static instance: AIBidirectionalSystemClass;
  private coordinator: AIRequestCoordinator;

  private constructor() {
    this.coordinator = AIRequestCoordinator.getInstance();
  }

  public static getInstance(): AIBidirectionalSystemClass {
    if (!AIBidirectionalSystemClass.instance) {
      AIBidirectionalSystemClass.instance = new AIBidirectionalSystemClass();
    }
    return AIBidirectionalSystemClass.instance;
  }

  /**
   * 处理玩家行动
   */
  public async processPlayerAction(
    userMessage: string,
    character: CharacterProfile,
    options?: ProcessOptions & { generation_id?: string }
  ): Promise<GM_Response | null> {
    return this.coordinator.processPlayerAction(userMessage, character, options);
  }

  /**
   * 生成开场白
   */
  public async generateInitialMessage(
    systemPrompt: string,
    userPrompt: string,
    options?: ProcessOptions
  ): Promise<GM_Response> {
    return this.coordinator.generateInitialMessage(systemPrompt, userPrompt, options);
  }

  /**
   * 触发记忆总结
   */
  public async triggerMemorySummary(options?: MemorySummaryOptions): Promise<void> {
    return MemoryManager.triggerMemorySummary(options);
  }

  /**
   * 处理 GM 响应并更新状态 (Deprecated/Legacy support)
   * logic moved to StateUpdater but kept here if some external caller uses it directly.
   * However, `processPlayerAction` now handles execution internally via Coordinator -> StateUpdater.
   * If this method is called externally, we should map it to StateUpdater.
   */
  public async processGmResponse(
    response: GM_Response,
    currentSaveData: SaveData,
    _isInitialization = false,
    _shouldAbort?: () => boolean
  ): Promise<{ saveData: SaveData; stateChanges: StateChangeLog }> {
      // Provide a warning or implement redirection if feasible.
      // Given the refactor, we prefer the coordinator to handle this.
      console.warn('AIBidirectionalSystem.processGmResponse is deprecated. Use AIRequestCoordinator or StateUpdater directly.');

      // Temporary stub to prevent crash if called
      return { saveData: currentSaveData, stateChanges: { changes: [] } };
  }
}

export const AIBidirectionalSystem = AIBidirectionalSystemClass.getInstance();
export { getTavernHelper };
