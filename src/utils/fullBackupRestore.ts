/**
 * 完整备份恢复：根据 full_backup 的 payload 恢复角色、存档、设置、API、提示词、语言等。
 * 供 SavePanel 与 CharacterManagement（续前世因缘）共用。
 */
import { useCharacterStore } from '@/stores/characterStore';
import { isSaveDataV3, migrateSaveDataToLatest } from '@/utils/saveMigration';
import { validateSaveDataV3 } from '@/utils/saveValidationV3';

export interface FullBackupRestoreResult {
  importedChars: number;
  importedSaves: number;
  skippedChars: number;
}

export async function executeFullBackupRestore(payload: any): Promise<FullBackupRestoreResult> {
  const characterStore = useCharacterStore();
  let importedChars = 0;
  let importedSaves = 0;
  let skippedChars = 0;
  let firstImportedCharId: string | null = null;
  let firstImportedSlotId: string | null = null;

  if (Array.isArray(payload.characters)) {
    const { saveSaveData: saveSaveDataFn, saveCharacters, saveActiveSave: saveActiveSaveFn } = await import(
      '@/utils/indexedDBManager'
    );
    const { saveEngramVectorStore } = await import('@/services/engram/vectorRepository');

    for (const charExport of payload.characters) {
      if (!charExport.角色信息 || !charExport.角色信息.角色) continue;

      const charName = charExport.角色信息.角色.名字 || '未知角色';
      const isDuplicate = Object.values(characterStore.rootState.角色列表).some(
        (p: any) => p.角色.名字 === charName
      );

      if (isDuplicate) {
        console.warn(`[完整备份恢复] 角色 "${charName}" 已存在，跳过`);
        skippedChars++;
        continue;
      }

      const newCharId = `char_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const profileData = { ...charExport.角色信息 };
      profileData.存档列表 = {};

      if (Array.isArray(charExport.存档列表)) {
        for (const save of charExport.存档列表) {
          const saveName = save.存档名 || '导入存档';
          if (!save.存档数据) continue;

          let v3Data: any;
          try {
            v3Data = isSaveDataV3(save.存档数据 as any)
              ? save.存档数据
              : migrateSaveDataToLatest(save.存档数据 as any).migrated;
            const validation = validateSaveDataV3(v3Data as any);
            if (!validation.isValid) {
              console.warn(`[完整备份恢复] 存档「${saveName}」校验失败，跳过`);
              continue;
            }
          } catch {
            console.warn(`[完整备份恢复] 存档「${saveName}」迁移失败，跳过`);
            continue;
          }

          await saveSaveDataFn(newCharId, saveName, v3Data);

          if (save.向量数据 && typeof save.向量数据 === 'object') {
            try {
              await saveEngramVectorStore(
                { characterId: newCharId, slotId: saveName },
                save.向量数据
              );
            } catch {
              /* 向量恢复失败不影响主流程 */
            }
          }

          const attrs = v3Data?.角色?.属性;
          const loc = v3Data?.角色?.位置;
          profileData.存档列表[saveName] = {
            存档名: saveName,
            角色名字: save.角色名字 ?? v3Data?.角色?.身份?.名字,
            地位: save.地位 ?? attrs?.地位?.名称,
            位置: save.位置 ?? loc?.描述,
            保存时间: save.保存时间,
            最后保存时间: save.最后保存时间,
          };
          if (firstImportedCharId === null) {
            firstImportedCharId = newCharId;
            firstImportedSlotId = saveName;
          }
          importedSaves++;
        }
      }

      characterStore.rootState.角色列表[newCharId] = profileData;
      importedChars++;
      await new Promise(r => setTimeout(r, 5));
    }

    if (importedChars > 0) {
      const { saveCharacters } = await import('@/utils/indexedDBManager');
      await saveCharacters(characterStore.rootState.角色列表);
    }

    if (firstImportedCharId && firstImportedSlotId) {
      characterStore.rootState.当前激活存档 = {
        角色ID: firstImportedCharId,
        存档槽位: firstImportedSlotId,
      };
      await saveActiveSaveFn(characterStore.rootState.当前激活存档);
    }
  }

  if (payload.settings && typeof payload.settings === 'object') {
    localStorage.setItem('dad_game_settings', JSON.stringify(payload.settings));
  }

  if (payload.uiSettings && typeof payload.uiSettings === 'object') {
    const ui = payload.uiSettings;
    if (ui.enableActionOptions !== undefined && ui.enableActionOptions !== null) {
      localStorage.setItem('enableActionOptions', String(ui.enableActionOptions));
    }
    if (ui.actionOptionsPrompt !== undefined && ui.actionOptionsPrompt !== null) {
      localStorage.setItem('actionOptionsPrompt', String(ui.actionOptionsPrompt));
    }
    if (ui.actionOptionsMode === 'action' || ui.actionOptionsMode === 'story') {
      localStorage.setItem('actionOptionsMode', ui.actionOptionsMode);
    }
    if (ui.actionPace === 'fast' || ui.actionPace === 'slow') {
      localStorage.setItem('actionPace', ui.actionPace);
    }
    if (ui.useStreaming !== undefined && ui.useStreaming !== null) {
      localStorage.setItem('useStreaming', String(ui.useStreaming));
    }
    if (ui.useSystemCot !== undefined && ui.useSystemCot !== null) {
      localStorage.setItem('useSystemCot', String(ui.useSystemCot));
    }
  }

  if (payload.apiConfig && typeof payload.apiConfig === 'object') {
    try {
      const { useAPIManagementStore } = await import('@/stores/apiManagementStore');
      const apiStore = useAPIManagementStore();
      apiStore.importConfig(payload.apiConfig);
    } catch (e) {
      console.warn('[完整备份恢复] API配置恢复失败:', e);
    }
  }

  if (payload.prompts && typeof payload.prompts === 'object') {
    try {
      const { promptStorage } = await import('@/services/promptStorage');
      await promptStorage.importPrompts(payload.prompts);
    } catch (e) {
      console.warn('[完整备份恢复] 提示词恢复失败:', e);
    }
  }

  if (payload.language && typeof payload.language === 'string') {
    localStorage.setItem('language', payload.language);
  }

  return { importedChars, importedSaves, skippedChars };
}
