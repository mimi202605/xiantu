
// Self-contained verification script
// Copy of runNpcMaintenance from src/services/worldHeartbeatService.ts

interface NpcProfile {
  名称: string;
  类型?: '重点' | '普通';
  实时关注: boolean;
  上次主回合更新回合?: number;
  当前位置?: { 描述: string };
  [key: string]: any;
}

interface SaveData {
    元数据?: { 回合序号: number };
    系统?: { 配置?: { npcDemotionThreshold?: number } };
    社交?: { 关系?: Record<string, NpcProfile> };
    [key: string]: any;
}

/**
 * 运行 NPC 维护任务：降级不活跃的重点 NPC、清理无效数据等。
 * 此操作不产生回溯记录，直接修改 saveData。
 */
function runNpcMaintenance(saveData: SaveData): { demotedCount: number; demotedNames: string[] } {
  const anySave = saveData as any;
  const relationships = anySave.社交?.关系 as Record<string, NpcProfile> | undefined;
  if (!relationships) return { demotedCount: 0, demotedNames: [] };

  const config = (saveData as any).系统?.配置;
  const threshold = typeof config?.npcDemotionThreshold === 'number' ? config.npcDemotionThreshold : 5;
  const currentTurn = anySave.元数据?.回合序号 ?? 0;

  const demotedNames: string[] = [];

  for (const [name, npc] of Object.entries(relationships)) {
    // 缺省类型视为重点
    const type = npc.类型 || '重点';

    // 仅处理重点 NPC
    if (type !== '重点') continue;

    // 实时关注的 NPC 不降级
    if (npc.实时关注 === true) continue;

    const lastUpdate = npc.上次主回合更新回合;
    // 如果从未更新过（undefined），暂不降级，或者视为很久没更新？
    // 策略：新生成的 NPC 上次更新回合可能是 undefined，给予保护期？
    // 假设 undefined = 0，如果当前回合 < threshold 则不降级（开局保护）
    // 或者：只有明确有 lastUpdate 且超时的才降级。
    // 稳妥起见：if lastUpdate is undefined, do not demote yet (let them be active once).
    if (typeof lastUpdate !== 'number') continue;

    if (currentTurn - lastUpdate > threshold) {
      npc.类型 = '普通';
      demotedNames.push(name);
    }
  }

  if (demotedNames.length > 0) {
    console.log(`[NPC维护] 降级了 ${demotedNames.length} 个不活跃重点 NPC: ${demotedNames.join('、')}`);
  }

  return { demotedCount: demotedNames.length, demotedNames };
}

// Test Execution
const createNpc = (type: '重点' | '普通' | undefined, lastUpdate: number | undefined, tracked: boolean, name: string): NpcProfile => ({
    名称: name,
    类型: type,
    实时关注: tracked,
    上次主回合更新回合: lastUpdate,
    当前位置: { 描述: 'TestLoc' }
} as any);

const runTest = () => {
    console.log('Running NPC Optimization Logic Verification...');

    const saveData: SaveData = {
        元数据: { 回合序号: 100 },
        系统: { 配置: { npcDemotionThreshold: 5 } },
        社交: {
            关系: {
                'ActiveImportant': createNpc('重点', 98, false, 'ActiveImportant'),
                'InactiveImportant': createNpc('重点', 90, false, 'InactiveImportant'), // Should demote
                'TrackedInactiveImportant': createNpc('重点', 90, true, 'TrackedInactiveImportant'), // Should keep
                'Normal': createNpc('普通', 90, false, 'Normal'), // Should keep
                'UndefType': createNpc(undefined, 90, false, 'UndefType'), // Treated as Important, inactive -> demote
                'NoLastUpdate': createNpc('重点', undefined, false, 'NoLastUpdate'), // Should keep (undefined protection)
            }
        }
    };

    console.log('Initial State:', JSON.stringify(saveData.社交?.关系, null, 2));

    const result = runNpcMaintenance(saveData);

    console.log('Maintenance Result:', result);
    console.log('Final State:', JSON.stringify(saveData.社交?.关系, null, 2));

    let passed = true;

    // Checks
    if (saveData.社交!.关系!['ActiveImportant'].类型 !== '重点') { console.error('FAIL: ActiveImportant demoted'); passed = false; }
    if (saveData.社交!.关系!['InactiveImportant'].类型 !== '普通') { console.error('FAIL: InactiveImportant NOT demoted'); passed = false; }
    if (saveData.社交!.关系!['TrackedInactiveImportant'].类型 !== '重点') { console.error('FAIL: TrackedInactiveImportant demoted'); passed = false; }
    if (saveData.社交!.关系!['Normal'].类型 !== '普通') { console.error('FAIL: Normal changed type'); passed = false; }
    if (saveData.社交!.关系!['UndefType'].类型 !== '普通') { console.error('FAIL: UndefType NOT demoted'); passed = false; }
    if (saveData.社交!.关系!['NoLastUpdate'].类型 !== '重点') { console.error('FAIL: NoLastUpdate demoted'); passed = false; }

    if (passed) console.log('✅ runNpcMaintenance Logic Test Passed');
    else console.error('❌ runNpcMaintenance Logic Test Failed');

    // Filtering logic verification (simulated)
    console.log('\n--- Verifying Filtering Logic (Simulation) ---');
    const playerLocDesc = 'PlayerLoc';
    const filterRelationships = (relationships: Record<string, NpcProfile>) => {
          const filtered: Record<string, NpcProfile> = {};
          for (const [name, npc] of Object.entries(relationships)) {
            const type = npc.类型 || '重点';
            const isImportant = type === '重点';
            const isTracked = npc.实时关注 === true;
            const isLocal = npc.当前位置?.描述 === playerLocDesc; // Mock player location check

            if (isImportant || isTracked || isLocal) {
              filtered[name] = npc;
            }
          }
          return filtered;
    };

    const mockRels = {
        'Important': createNpc('重点', 100, false, 'Important'),
        'Normal': createNpc('普通', 100, false, 'Normal'),
        'TrackedNormal': createNpc('普通', 100, true, 'TrackedNormal'),
        'LocalNormal': { ...createNpc('普通', 100, false, 'LocalNormal'), 当前位置: { 描述: playerLocDesc } },
    };

    const filtered = filterRelationships(mockRels);
    console.log('Filtered Results:', Object.keys(filtered));

    if (filtered['Important'] && !filtered['Normal'] && filtered['TrackedNormal'] && filtered['LocalNormal']) {
        console.log('✅ Filtering Logic Test Passed');
    } else {
        console.error('❌ Filtering Logic Test Failed');
        passed = false;
    }
};

runTest();
