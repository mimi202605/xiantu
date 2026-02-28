<template>
  <div class="relationship-network-panel">
    <div class="panel-content">
      <!-- 人物关系列表 -->
      <div class="relationships-container" :class="{ 'details-active': isDetailViewActive }">
        <!-- 左侧：人物列表 -->
        <div class="relationship-list">
          <div class="list-header">
            <div class="list-header-top">
              <h3 class="panel-title">人物关系</h3>
              <button class="create-npc-btn" @click="createNewNpc" title="新建人物">
                <Plus :size="14" /> 新建
              </button>
            </div>
            <div class="search-bar">
              <Search :size="16" />
              <input v-model="searchQuery" placeholder="搜索人物..." class="search-input" />
            </div>
          </div>

          <div class="list-content">
            <div v-if="isLoading" class="loading-state">
              <Loader2 :size="32" class="animate-spin" />
              <p>{{ t('正在读取人际关系...') }}</p>
            </div>
            <div v-else-if="filteredRelationships.length === 0" class="empty-state">
              <Users2 :size="48" class="empty-icon" />
              <p class="empty-text">
                {{
                  relationshipStats.total > 0
                    ? '人物关系数据不完整或未能解析'
                    : t('尚未建立人际关系')
                }}
              </p>
              <p class="empty-hint" v-if="relationshipStats.total > 0">
                已检测到 {{ relationshipStats.total }} 条关系记录，但有效NPC为
                0；建议继续进行一回合以触发数据修复，或在「调试信息」里执行同步/强制刷新。
              </p>
              <p class="empty-hint" v-else>{{ t('在游戏中与更多人物互动建立关系') }}</p>
            </div>
            <div v-else class="person-list">
              <div
                v-for="person in filteredRelationships"
                :key="person.名字"
                class="person-card"
                :class="{ selected: selectedPerson?.名字 === person.名字 }"
                @click="selectPerson(person)"
              >
                <div class="person-avatar">
                  <span class="avatar-text">{{ person.名字.charAt(0) }}</span>
                </div>

                <div class="person-info">
                  <div class="person-name">{{ person.名字 }}</div>
                  <div class="person-meta">
                    <span class="relationship-type">{{ person.与玩家关系 || '相识' }}</span>
                    <div class="card-actions" @click.stop>
                      <button
                        class="attention-toggle"
                        @click.stop="toggleAttention(person)"
                        :title="isAttentionEnabled(person) ? '取消关注' : '添加关注'"
                      >
                        <Eye
                          v-if="isAttentionEnabled(person)"
                          :size="14"
                          class="attention-icon active"
                        />
                        <EyeOff v-else :size="14" class="attention-icon inactive" />
                      </button>
                      <button
                        class="heartbeat-lock-toggle"
                        @click.stop="toggleHeartbeatLock(person)"
                        :title="isHeartbeatLocked(person) ? '解锁心跳更新' : '锁定心跳更新'"
                      >
                        <Lock v-if="isHeartbeatLocked(person)" :size="14" class="lock-icon locked" />
                        <Unlock v-else :size="14" class="lock-icon unlocked" />
                      </button>
                      <button
                        @click.stop="confirmDeleteNpc(person)"
                        class="delete-btn-card"
                        title="删除人物"
                      >
                        <Trash2 :size="14" />
                      </button>
                    </div>
                  </div>
                  <div class="person-realm">
                    <span class="realm-label">{{ t('地位') }}:</span>
                    <span class="realm-value">{{ getNpcRealm(person) }}</span>
                  </div>
                  <div class="intimacy-info">
                    <div class="intimacy-bar">
                      <div
                        class="intimacy-fill"
                        :class="getIntimacyClass(person.好感度)"
                        :style="{ width: Math.max(5, Math.abs(person.好感度 || 0)) + '%' }"
                      ></div>
                    </div>
                    <span class="intimacy-value">{{ person.好感度 || 0 }}</span>
                  </div>
                </div>
                <ChevronRight :size="16" class="arrow-icon" />
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：人物详情 -->
        <div class="relationship-detail">
          <template v-if="selectedPerson">
            <!-- 详情头部 -->
            <div class="detail-header">
              <button @click="isDetailViewActive = false" class="back-to-list-btn">
                <ArrowLeft :size="20" />
              </button>
              <div class="detail-avatar">
                <span class="avatar-text">{{ selectedPerson.名字.charAt(0) }}</span>
              </div>
              <div class="detail-info">
                <div class="name-and-actions">
                  <h3 class="detail-name">{{ selectedPerson.名字 }}</h3>
                  <div class="action-buttons">
                    <button
                      @click="refineNpcWithAI"
                      class="action-btn refine-btn"
                      :disabled="isRefiningNpc"
                      :title="isRefiningNpc ? 'AI完善中...' : 'AI完善此人物'"
                    >
                      <Wand2 :size="16" :class="{ 'animate-spin': isRefiningNpc }" />
                    </button>
                    <button
                      @click="downloadCharacterData"
                      class="action-btn download-btn"
                      title="下载完整人物数据"
                    >
                      <Download :size="16" />
                    </button>
                    <button
                      v-if="hasNativeTavernFlag"
                      @click="exportToWorldBook"
                      class="action-btn export-btn"
                      title="导出到世界书（不含记忆）"
                    >
                      <BookOpen :size="16" />
                    </button>
                    <button
                      v-if="selectedPerson"
                      @click.stop="confirmDeleteNpc(selectedPerson)"
                      class="delete-npc-btn"
                      title="删除此人物"
                    >
                      <Trash2 :size="16" />
                    </button>
                  </div>
                </div>
                <div class="detail-badges">
                  <span class="relationship-badge editable-badge" @click="editField !== '与玩家关系' && startEdit('与玩家关系', selectedPerson.与玩家关系)">
                    <template v-if="editField === '与玩家关系'">
                      <input v-model="editValue" class="badge-edit-input" @keyup.enter="confirmEdit('与玩家关系')" @keyup.escape="cancelEdit" />
                      <button class="badge-action-btn confirm" @click.stop="confirmEdit('与玩家关系')" title="确认"><Check :size="10" /></button>
                      <button class="badge-action-btn cancel" @click.stop="cancelEdit" title="取消"><X :size="10" /></button>
                    </template>
                    <template v-else>{{ selectedPerson.与玩家关系 || '相识' }}</template>
                  </span>
                  <span class="intimacy-badge editable-badge" :class="getIntimacyClass(selectedPerson.好感度)" @click="editField !== '好感度' && startEdit('好感度', selectedPerson.好感度)">
                    <template v-if="editField === '好感度'">
                      好感 <input type="number" v-model.number="editValue" class="badge-edit-input badge-edit-num" min="-100" max="100" @keyup.enter="confirmEdit('好感度')" @keyup.escape="cancelEdit" />
                      <button class="badge-action-btn confirm" @click.stop="confirmEdit('好感度')" title="确认"><Check :size="10" /></button>
                      <button class="badge-action-btn cancel" @click.stop="cancelEdit" title="取消"><X :size="10" /></button>
                    </template>
                    <template v-else>好感 {{ selectedPerson.好感度 || 0 }}</template>
                  </span>
                  <span class="race-badge editable-badge" @click="editField !== '种族' && startEdit('种族', selectedPerson.种族)">
                    <template v-if="editField === '种族'">
                      <input v-model="editValue" class="badge-edit-input" @keyup.enter="confirmEdit('种族')" @keyup.escape="cancelEdit" />
                      <button class="badge-action-btn confirm" @click.stop="confirmEdit('种族')" title="确认"><Check :size="10" /></button>
                      <button class="badge-action-btn cancel" @click.stop="cancelEdit" title="取消"><X :size="10" /></button>
                    </template>
                    <template v-else>{{ selectedPerson.种族 || '人族' }}</template>
                  </span>
                </div>
              </div>
            </div>

            <!-- 详情主体 -->
            <div class="detail-body">
              <!-- 选项卡导航 -->
              <div class="detail-tabs">
                <button
                  v-for="tab in tabs"
                  :key="tab.id"
                  :class="['tab-btn', { active: activeTab === tab.id }]"
                  @click="activeTab = tab.id"
                >
                  {{ tab.icon }} {{ tab.label }}
                </button>
              </div>

              <!-- 选项卡内容 -->
              <div class="tab-content">
                <!-- Tab 1: 基本信息 -->
                <div v-show="activeTab === 'basic'" class="tab-panel">
                  <!-- 基础档案 -->
                  <div class="detail-section">
                    <h5 class="section-title">📋 基本信息</h5>
                    <div class="info-grid-responsive">
                      <div class="info-item-row editable-row" @click="editField !== '地位' && startEdit('地位', getNpcRealm(selectedPerson))">
                        <span class="info-label">{{ t('地位') }}</span>
                        <template v-if="editField === '地位'">
                          <input v-model="editValue" class="inline-edit-input" @keyup.enter="confirmEdit('地位')" @keyup.escape="cancelEdit" />
                          <div class="edit-actions-inline">
                            <button class="edit-ok-btn" @click.stop="confirmEdit('地位')" title="确认"><Check :size="12" /></button>
                            <button class="edit-no-btn" @click.stop="cancelEdit" title="取消"><X :size="12" /></button>
                          </div>
                        </template>
                        <span v-else class="info-value">{{ getNpcRealm(selectedPerson) }} <Edit :size="12" class="inline-edit-icon" /></span>
                      </div>
                      <div class="info-item-row editable-row" @click="editField !== '性别' && startEdit('性别', selectedPerson.性别)">
                        <span class="info-label">性别</span>
                        <template v-if="editField === '性别'">
                          <input v-model="editValue" class="inline-edit-input" @keyup.enter="confirmEdit('性别')" @keyup.escape="cancelEdit" />
                          <div class="edit-actions-inline">
                            <button class="edit-ok-btn" @click.stop="confirmEdit('性别')" title="确认"><Check :size="12" /></button>
                            <button class="edit-no-btn" @click.stop="cancelEdit" title="取消"><X :size="12" /></button>
                          </div>
                        </template>
                        <span v-else class="info-value">{{ selectedPerson.性别 || '未知' }} <Edit :size="12" class="inline-edit-icon" /></span>
                      </div>
                      <div class="info-item-row editable-row" @click="editField !== '年龄' && startEdit('年龄', selectedPerson.出生日期)">
                        <span class="info-label">年龄</span>
                        <template v-if="editField === '年龄'">
                          <input v-model="editValue" class="inline-edit-input" placeholder="出生日期 如 980年3月" @keyup.enter="confirmEdit('年龄')" @keyup.escape="cancelEdit" />
                          <div class="edit-actions-inline">
                            <button class="edit-ok-btn" @click.stop="confirmEdit('年龄')" title="确认"><Check :size="12" /></button>
                            <button class="edit-no-btn" @click.stop="cancelEdit" title="取消"><X :size="12" /></button>
                          </div>
                        </template>
                        <span v-else class="info-value">{{ getNpcAge(selectedPerson) }} <Edit :size="12" class="inline-edit-icon" /></span>
                      </div>
                      <div class="info-item-row editable-row" @click="editField !== '特质' && startEdit('特质', selectedPerson.特质)">
                        <span class="info-label">{{ traitOrRootLabel }}</span>
                        <template v-if="editField === '特质'">
                          <input v-model="editValue" class="inline-edit-input" @keyup.enter="confirmEdit('特质')" @keyup.escape="cancelEdit" />
                          <div class="edit-actions-inline">
                            <button class="edit-ok-btn" @click.stop="confirmEdit('特质')" title="确认"><Check :size="12" /></button>
                            <button class="edit-no-btn" @click.stop="cancelEdit" title="取消"><X :size="12" /></button>
                          </div>
                        </template>
                        <span v-else class="info-value">{{ getNpcSpiritRoot(selectedPerson) }} <Edit :size="12" class="inline-edit-icon" /></span>
                      </div>
                      <div class="info-item-row editable-row">
                        <span class="info-label">位置</span>
                        <template v-if="editField === '当前位置'">
                          <div class="location-edit-wrapper">
                            <div class="location-input-group">
                              <select v-if="!isLocationCustomInput" v-model="locationSearchQuery" class="inline-edit-select location-select">
                                <option value="" disabled>选择地点...</option>
                                <option v-for="loc in allLocationNames" :key="loc" :value="loc">{{ loc }}</option>
                              </select>
                              <input v-else v-model="locationSearchQuery" class="inline-edit-input" placeholder="输入地点名称" list="npc-location-list" @keyup.escape="cancelEdit" />
                              <datalist id="npc-location-list" v-if="isLocationCustomInput">
                                <option v-for="loc in allLocationNames" :key="loc" :value="loc" />
                              </datalist>

                              <button class="toggle-input-mode-btn" @click="isLocationCustomInput = !isLocationCustomInput" :title="isLocationCustomInput ? '切换到选择列表' : '切换到手动输入'">
                                <List v-if="isLocationCustomInput" :size="14" />
                                <Type v-else :size="14" />
                              </button>
                            </div>
                            <div class="location-edit-actions">
                              <button class="loc-confirm-btn" @click="confirmEdit('当前位置')" title="确认"><Check :size="14" /> 确认</button>
                              <button class="loc-cancel-btn" @click="cancelEdit" title="取消"><X :size="14" /> 取消</button>
                            </div>
                          </div>
                        </template>
                        <span v-else class="info-value" @click="startEdit('当前位置', selectedPerson.当前位置)">{{ selectedPerson.当前位置?.描述 || '未知' }} <Edit :size="12" class="inline-edit-icon" /></span>
                      </div>
                      <div class="info-item-row editable-row" @click="editField !== '出生' && startEdit('出生', selectedPerson.出生)">
                        <span class="info-label">出生</span>
                        <template v-if="editField === '出生'">
                          <input v-model="editValue" class="inline-edit-input" @keyup.enter="confirmEdit('出生')" @keyup.escape="cancelEdit" />
                          <div class="edit-actions-inline">
                            <button class="edit-ok-btn" @click.stop="confirmEdit('出生')" title="确认"><Check :size="12" /></button>
                            <button class="edit-no-btn" @click.stop="cancelEdit" title="取消"><X :size="12" /></button>
                          </div>
                        </template>
                        <span v-else class="info-value">{{ getNpcOrigin(selectedPerson.出生) || '普通人' }} <Edit :size="12" class="inline-edit-icon" /></span>
                      </div>
                    </div>
                  </div>

                  <!-- 核心数值（体力/精力 兼容 气血/灵气；神识有值才显示） -->
                  <div class="detail-section" v-if="hasNpcCoreStats(selectedPerson)">
                    <h5 class="section-title">核心数值</h5>
                    <div class="npc-vitals-container">
                      <div class="npc-vital-row" v-for="statKey in ['体力','精力']" :key="statKey">
                        <div class="npc-vital-meta editable-row" @click="editField !== `stat_${statKey}` && startEdit(`stat_${statKey}`, { cur: getNpcStatCurrent(selectedPerson, statKey), max: getNpcStatMax(selectedPerson, statKey) })">
                          <span class="npc-vital-name">{{ t(statKey) }}</span>
                          <template v-if="editField === `stat_${statKey}`">
                            <span class="stat-edit-group">
                              <input type="number" v-model.number="editValue.cur" class="inline-edit-input-sm" min="0" @keyup.escape="cancelEdit" />
                              /
                              <input type="number" v-model.number="editValue.max" class="inline-edit-input-sm" min="1" @keyup.escape="cancelEdit" />
                              <button class="edit-ok-btn" @click.stop="updateStatValue(statKey, editValue.cur, editValue.max); cancelEdit()" title="确认"><Check :size="10" /></button>
                              <button class="edit-no-btn" @click.stop="cancelEdit" title="取消"><X :size="10" /></button>
                            </span>
                          </template>
                          <span v-else class="npc-vital-nums">{{ formatNpcStatPair(selectedPerson, statKey) }} <Edit :size="10" class="inline-edit-icon" /></span>
                        </div>
                        <div class="npc-vital-track">
                          <div class="npc-vital-bar" :class="statKey === '体力' ? 'red-bar' : 'blue-bar'" :style="{ width: getNpcStatPercentage(selectedPerson, statKey) + '%' }"></div>
                        </div>
                      </div>
                      <div class="npc-vital-row" v-if="hasNpcStatPair(selectedPerson, '洞察力')">
                        <div class="npc-vital-meta editable-row" @click="editField !== 'stat_洞察力' && startEdit('stat_洞察力', { cur: getNpcStatCurrent(selectedPerson, '洞察力'), max: getNpcStatMax(selectedPerson, '洞察力') })">
                          <span class="npc-vital-name">{{ t('洞察力') }}</span>
                          <template v-if="editField === 'stat_洞察力'">
                            <span class="stat-edit-group">
                              <input type="number" v-model.number="editValue.cur" class="inline-edit-input-sm" min="0" @keyup.escape="cancelEdit" />
                              /
                              <input type="number" v-model.number="editValue.max" class="inline-edit-input-sm" min="1" @keyup.escape="cancelEdit" />
                              <button class="edit-ok-btn" @click.stop="updateStatValue('洞察力', editValue.cur, editValue.max); cancelEdit()" title="确认"><Check :size="10" /></button>
                              <button class="edit-no-btn" @click.stop="cancelEdit" title="取消"><X :size="10" /></button>
                            </span>
                          </template>
                          <span v-else class="npc-vital-nums">{{ formatNpcStatPair(selectedPerson, '洞察力') }} <Edit :size="10" class="inline-edit-icon" /></span>
                        </div>
                        <div class="npc-vital-track">
                          <div class="npc-vital-bar gold-bar" :style="{ width: getNpcStatPercentage(selectedPerson, '洞察力') + '%' }"></div>
                        </div>
                      </div>
                      <div class="npc-vital-row">
                        <div class="npc-vital-meta editable-row" @click="editField !== 'stat_寿元' && startEdit('stat_寿元', getNpcLifespanMax(selectedPerson))">
                          <span class="npc-vital-name">寿元</span>
                          <template v-if="editField === 'stat_寿元'">
                            <span class="stat-edit-group">
                              上限 <input type="number" v-model.number="editValue" class="inline-edit-input-sm" min="1" @keyup.escape="cancelEdit" />
                              <button class="edit-ok-btn" @click.stop="updateLifespanMax(editValue); cancelEdit()" title="确认"><Check :size="10" /></button>
                              <button class="edit-no-btn" @click.stop="cancelEdit" title="取消"><X :size="10" /></button>
                            </span>
                          </template>
                          <span v-else class="npc-vital-nums">{{ formatNpcLifespan(selectedPerson) }} <Edit :size="10" class="inline-edit-icon" /></span>
                        </div>
                        <div class="npc-vital-track">
                          <div class="npc-vital-bar purple-bar" :style="{ width: getNpcLifespanPercentage(selectedPerson) + '%' }"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 外貌与性格 -->
                  <div class="detail-section">
                    <h5 class="section-title">外貌与性格</h5>
                    <div class="appearance-description">
                      <template v-if="editField === '外貌描述'">
                        <textarea v-model="editValue" class="inline-edit-textarea" rows="3" @keyup.escape="cancelEdit" />
                        <div class="edit-actions-row">
                          <button class="edit-confirm-btn" @click="confirmEdit('外貌描述')">确定</button>
                          <button class="edit-cancel-btn" @click="cancelEdit">取消</button>
                        </div>
                      </template>
                      <p v-else class="description-text editable-text" @click="startEdit('外貌描述', selectedPerson.外貌描述)">{{ selectedPerson.外貌描述 || '点击添加外貌描述...' }} <Edit :size="12" class="inline-edit-icon" /></p>
                    </div>
                    <div class="talents-grid editable-list" style="margin-top: 1rem">
                      <span
                        v-for="(trait, index) in (selectedPerson.性格特征 || [])"
                        :key="trait"
                        class="talent-tag with-delete"
                      >{{ trait }}<button class="tag-delete-btn" @click.stop="removeListItem('性格特征', index)" title="删除">&times;</button></span>
                      <span class="talent-tag add-tag" @click="newListItemInput = ''; startEdit('性格特征_add', '')">
                        <template v-if="editField === '性格特征_add'">
                          <input v-model="newListItemInput" class="tag-add-input" placeholder="新性格" @keyup.enter="addListItem('性格特征', newListItemInput); cancelEdit()" @keyup.escape="cancelEdit" @blur="{ if(newListItemInput.trim()) addListItem('性格特征', newListItemInput); cancelEdit(); }" />
                        </template>
                        <template v-else><Plus :size="12" /> 添加</template>
                      </span>
                    </div>
                  </div>

                  <!-- 天赋与六维属性 -->
                    <div
                      class="detail-section"
                      v-if="true"
                    >
                      <h5 class="section-title">{{ t('天赋与六维属性') }}</h5>
                      <div>
                        <h6 class="subsection-title">天赋能力</h6>
                      <div class="talents-grid editable-list">
                        <span
                          v-for="(talent, index) in selectedPerson.天赋"
                          :key="index"
                          class="talent-tag with-delete"
                          @click="showTalentDetail(talent)"
                          style="cursor: pointer"
                        >
                          {{ getTalentName(talent) }}
                          <button class="tag-delete-btn" @click.stop="removeListItem('天赋', index)" title="删除">&times;</button>
                        </span>
                        <span class="talent-tag add-tag" @click="newListItemInput = ''; startEdit('天赋_add', '')">
                          <template v-if="editField === '天赋_add'">
                            <input v-model="newListItemInput" class="tag-add-input" placeholder="新天赋" @keyup.enter="addListItem('天赋', newListItemInput); cancelEdit()" @keyup.escape="cancelEdit" @blur="{ if(newListItemInput.trim()) addListItem('天赋', newListItemInput); cancelEdit(); }" />
                          </template>
                          <template v-else><Plus :size="12" /> 添加</template>
                        </span>
                      </div>
                    </div>
                    <div v-if="(selectedPerson as any).先天六维属性 || (selectedPerson as any).先天六司" style="margin-top: 1rem">
                      <h6 class="subsection-title">{{ t('先天六维属性') }}</h6>
                      <div class="attributes-grid">
                        <div class="attribute-item editable-row" v-for="attrName in ['体质','直觉','悟性','气运','魅力','心性']" :key="attrName" @click="editField !== `attr_${attrName}` && startEdit(`attr_${attrName}`, npcInnateAttrs(selectedPerson)[attrName] || 0)">
                          <span class="attr-label">{{ attrName }}</span>
                          <template v-if="editField === `attr_${attrName}`">
                            <input type="number" v-model.number="editValue" class="inline-edit-input-sm" min="0" max="100" @keyup.enter="updateInnateAttr(attrName, editValue); cancelEdit()" @keyup.escape="cancelEdit" />
                            <button class="edit-ok-btn" @click.stop="updateInnateAttr(attrName, editValue); cancelEdit()" title="确认"><Check :size="10" /></button>
                            <button class="edit-no-btn" @click.stop="cancelEdit" title="取消"><X :size="10" /></button>
                          </template>
                          <span v-else class="attr-value">{{ npcInnateAttrs(selectedPerson)[attrName] || 0 }} <Edit :size="10" class="inline-edit-icon" /></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 最近记忆 -->
                  <div
                    class="detail-section"
                    v-if="getNpcRecentMemories(selectedPerson).length > 0"
                  >
                    <h5 class="section-title">📝 最近记忆</h5>
                    <div class="npc-memories-list">
                      <div
                        v-for="(memory, index) in getNpcRecentMemories(selectedPerson)"
                        :key="index"
                        class="npc-memory-item"
                      >
                        <div class="npc-memory-content">{{ memory }}</div>
                      </div>
                    </div>
                  </div>

                  <!-- 人格底线（所有NPC都有）-->
                  <div class="detail-section personality-section">
                    <h5 class="section-title">⚠️ 人格底线</h5>
                    <div class="personality-bottomlines">
                      <div class="bottomline-tags editable-list">
                        <span
                          v-for="(line, index) in (selectedPerson.人格底线 || [])"
                          :key="index"
                          class="bottomline-tag with-delete"
                        >{{ line }}<button class="tag-delete-btn" @click.stop="removeListItem('人格底线', index)" title="删除">&times;</button></span>
                        <span class="bottomline-tag add-tag" @click="newListItemInput = ''; startEdit('人格底线_add', '')">
                          <template v-if="editField === '人格底线_add'">
                            <input v-model="newListItemInput" class="tag-add-input" placeholder="新底线" @keyup.enter="addListItem('人格底线', newListItemInput); cancelEdit()" @keyup.escape="cancelEdit" @blur="{ if(newListItemInput.trim()) addListItem('人格底线', newListItemInput); cancelEdit(); }" />
                          </template>
                          <template v-else><Plus :size="12" /> 添加</template>
                        </span>
                      </div>
                      <div v-if="!(selectedPerson.人格底线?.length)" class="bottomline-empty">未记录人格底线</div>
                    </div>
                    <div class="bottomline-warning">
                      <span class="warning-icon">⚡</span>
                      <span class="warning-text"
                        >触犯人格底线将导致好感度断崖式下跌（-30 ~ -60），关系破裂且极难修复</span
                      >
                    </div>
                  </div>
                </div>

                <!-- Tab 2: 实时状态 -->
                <div v-show="activeTab === 'status'" class="tab-panel">
                  <div class="detail-section highlight-section">
                    <h5 class="section-title">💭 当前状态（实时）</h5>
                    <div class="realtime-status">
                      <div class="status-item editable-row" @click="editField !== '当前外貌状态' && startEdit('当前外貌状态', selectedPerson.当前外貌状态)">
                        <span class="status-icon">😶</span>
                        <div class="status-content">
                          <div class="status-label">外貌状态</div>
                          <template v-if="editField === '当前外貌状态'">
                            <input v-model="editValue" class="inline-edit-input" @keyup.enter="confirmEdit('当前外貌状态')" @keyup.escape="cancelEdit" />
                            <div class="edit-actions-inline">
                              <button class="edit-ok-btn" @click.stop="confirmEdit('当前外貌状态')" title="确认"><Check :size="12" /></button>
                              <button class="edit-no-btn" @click.stop="cancelEdit" title="取消"><X :size="12" /></button>
                            </div>
                          </template>
                          <div v-else class="status-text editable-text">
                            {{ selectedPerson.当前外貌状态 || '神态自然，衣衫整洁' }} <Edit :size="12" class="inline-edit-icon" />
                          </div>
                        </div>
                      </div>
                      <div class="status-item editable-row" @click="editField !== '当前内心想法' && startEdit('当前内心想法', selectedPerson.当前内心想法)">
                        <span class="status-icon">💭</span>
                        <div class="status-content">
                          <div class="status-label">内心想法</div>
                          <template v-if="editField === '当前内心想法'">
                            <input v-model="editValue" class="inline-edit-input" @keyup.enter="confirmEdit('当前内心想法')" @keyup.escape="cancelEdit" />
                            <div class="edit-actions-inline">
                              <button class="edit-ok-btn" @click.stop="confirmEdit('当前内心想法')" title="确认"><Check :size="12" /></button>
                              <button class="edit-no-btn" @click.stop="cancelEdit" title="取消"><X :size="12" /></button>
                            </div>
                          </template>
                          <div v-else class="status-text editable-text">
                            {{ selectedPerson.当前内心想法 || '心如止水，平静无波' }} <Edit :size="12" class="inline-edit-icon" />
                          </div>
                        </div>
                      </div>
                      <div class="status-item status-item-actions">
                        <span class="status-icon">🔒</span>
                        <div class="status-content">
                          <div class="status-label">世界心跳更新</div>
                          <label class="toggle-switch-inline">
                            <input type="checkbox" :checked="isHeartbeatLocked(selectedPerson)" @change="toggleHeartbeatLock(selectedPerson)" />
                            <span class="toggle-slider"></span>
                          </label>
                          <span class="status-hint">{{ isHeartbeatLocked(selectedPerson) ? '已锁定（不参与心跳更新）' : '未锁定' }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Tab: 在做事项 -->
                <div v-show="activeTab === 'activity'" class="tab-panel">
                  <div class="detail-section highlight-section">
                    <h5 class="section-title">📌 在做事项</h5>
                    <div class="realtime-status">
                      <div class="status-item editable-row" @click="editField !== '在做事项' && startEdit('在做事项', selectedPerson.在做事项)">
                        <span class="status-icon">📌</span>
                        <div class="status-content">
                          <div class="status-label">当前在做事项</div>
                          <template v-if="editField === '在做事项'">
                            <input v-model="editValue" class="inline-edit-input" @keyup.enter="confirmEdit('在做事项')" @keyup.escape="cancelEdit" />
                            <div class="edit-actions-inline">
                              <button class="edit-ok-btn" @click.stop="confirmEdit('在做事项')" title="确认"><Check :size="12" /></button>
                              <button class="edit-no-btn" @click.stop="cancelEdit" title="取消"><X :size="12" /></button>
                            </div>
                          </template>
                          <div v-else class="status-text editable-text">
                            {{ selectedPerson.在做事项 || '暂无' }} <Edit :size="12" class="inline-edit-icon" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div v-if="historyActivityList.length > 0" class="activity-history-section">
                      <h6 class="subsection-title">{{ t('历史在做事项') }}</h6>
                      <ul class="activity-history-list">
                        <li v-for="(item, index) in historyActivityList" :key="index" class="activity-history-item">
                          {{ item }}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <!-- Tab: 私密信息（仅酒馆环境） -->
                <div v-if="isTavernEnvFlag" v-show="activeTab === 'nsfw'" class="tab-panel">
                  <div class="detail-section nsfw-section">
                    <h5 class="section-title">🔞 私密信息</h5>

                    <div v-if="!nsfwEnabled" class="bottomline-empty">
                      成人内容未启用（可在设置面板开启）
                    </div>

                    <div v-else-if="privacy">
                      <!-- 概览 -->
                      <div class="nsfw-subsection">
                        <h6 class="subsection-title">概览</h6>

                        <div class="info-grid-responsive">
                          <div class="info-item-row editable-row" @click="editField !== '是否为处女' && startEdit('是否为处女', privacy.是否为处女)">
                            <span class="info-label">是否为处女</span>
                            <template v-if="editField === '是否为处女'">
                              <select v-model="editValue" class="inline-edit-select" @click.stop>
                                <option :value="true">是</option>
                                <option :value="false">否</option>
                              </select>
                              <div class="edit-actions-inline">
                                <button class="edit-ok-btn" @click.stop="confirmEdit('是否为处女')"><Check :size="12" /></button>
                                <button class="edit-no-btn" @click.stop="cancelEdit"><X :size="12" /></button>
                              </div>
                            </template>
                            <span v-else class="info-value">{{ privacy.是否为处女 ? '是' : '否' }} <Edit :size="10" class="inline-edit-icon" /></span>
                          </div>
                          <div class="info-item-row editable-row" @click="editField !== '性格倾向' && startEdit('性格倾向', privacy.性格倾向)">
                            <span class="info-label">性格倾向</span>
                            <template v-if="editField === '性格倾向'">
                              <input v-model="editValue" class="inline-edit-input-sm" @keyup.enter="confirmEdit('性格倾向')" @keyup.escape="cancelEdit" @click.stop />
                              <div class="edit-actions-inline">
                                <button class="edit-ok-btn" @click.stop="confirmEdit('性格倾向')"><Check :size="12" /></button>
                                <button class="edit-no-btn" @click.stop="cancelEdit"><X :size="12" /></button>
                              </div>
                            </template>
                            <span v-else class="info-value">{{ privacy.性格倾向 || '无' }} <Edit :size="10" class="inline-edit-icon" /></span>
                          </div>
                          <div class="info-item-row editable-row" @click="editField !== '性取向' && startEdit('性取向', privacy.性取向)">
                            <span class="info-label">性取向</span>
                            <template v-if="editField === '性取向'">
                              <input v-model="editValue" class="inline-edit-input-sm" @keyup.enter="confirmEdit('性取向')" @keyup.escape="cancelEdit" @click.stop />
                              <div class="edit-actions-inline">
                                <button class="edit-ok-btn" @click.stop="confirmEdit('性取向')"><Check :size="12" /></button>
                                <button class="edit-no-btn" @click.stop="cancelEdit"><X :size="12" /></button>
                              </div>
                            </template>
                            <span v-else class="info-value">{{ privacy.性取向 || '无' }} <Edit :size="10" class="inline-edit-icon" /></span>
                          </div>
                          <div class="info-item-row editable-row" @click="editField !== '当前性状态' && startEdit('当前性状态', privacy.当前性状态)">
                            <span class="info-label">当前性状态</span>
                            <template v-if="editField === '当前性状态'">
                              <input v-model="editValue" class="inline-edit-input-sm" @keyup.enter="confirmEdit('当前性状态')" @keyup.escape="cancelEdit" @click.stop />
                              <div class="edit-actions-inline">
                                <button class="edit-ok-btn" @click.stop="confirmEdit('当前性状态')"><Check :size="12" /></button>
                                <button class="edit-no-btn" @click.stop="cancelEdit"><X :size="12" /></button>
                              </div>
                            </template>
                            <span v-else class="info-value">{{ privacy.当前性状态 || '无' }} <Edit :size="10" class="inline-edit-icon" /></span>
                          </div>
                          <div class="info-item-row editable-row" @click="editField !== '体液分泌状态' && startEdit('体液分泌状态', privacy.体液分泌状态)">
                            <span class="info-label">体液分泌状态</span>
                            <template v-if="editField === '体液分泌状态'">
                              <input v-model="editValue" class="inline-edit-input-sm" @keyup.enter="confirmEdit('体液分泌状态')" @keyup.escape="cancelEdit" @click.stop />
                              <div class="edit-actions-inline">
                                <button class="edit-ok-btn" @click.stop="confirmEdit('体液分泌状态')"><Check :size="12" /></button>
                                <button class="edit-no-btn" @click.stop="cancelEdit"><X :size="12" /></button>
                              </div>
                            </template>
                            <span v-else class="info-value"
                              ><span
                                class="status-badge"
                                :class="`status-${privacy.体液分泌状态 || '正常'}`"
                                >{{ privacy.体液分泌状态 || '正常' }} <Edit :size="10" class="inline-edit-icon" /></span
                              ></span
                            >
                          </div>
                          <div class="info-item-row editable-row" @click="editField !== '性交总次数' && startEdit('性交总次数', privacy.性交总次数)">
                            <span class="info-label">性交总次数</span>
                            <template v-if="editField === '性交总次数'">
                              <input type="number" v-model.number="editValue" class="inline-edit-input-sm" min="0" @keyup.enter="confirmEdit('性交总次数')" @keyup.escape="cancelEdit" @click.stop />
                              <div class="edit-actions-inline">
                                <button class="edit-ok-btn" @click.stop="confirmEdit('性交总次数')"><Check :size="12" /></button>
                                <button class="edit-no-btn" @click.stop="cancelEdit"><X :size="12" /></button>
                              </div>
                            </template>
                            <span v-else class="info-value">{{ privacy.性交总次数 ?? 0 }} <Edit :size="10" class="inline-edit-icon" /></span>
                          </div>
                        </div>

                        <div class="development-bars" style="margin-top: 0.75rem">
                          <div class="dev-bar-item editable-row" @click="editField !== '性渴望程度' && startEdit('性渴望程度', privacy.性渴望程度)">
                            <div class="dev-bar-header">
                              <span class="dev-label">性渴望程度</span>
                              <template v-if="editField === '性渴望程度'">
                                <div class="edit-container-inline">
                                  <input type="number" v-model.number="editValue" class="inline-edit-input-sm" min="0" max="100" @keyup.enter="confirmEdit('性渴望程度')" @keyup.escape="cancelEdit" @click.stop />
                                  <button class="edit-ok-btn" @click.stop="confirmEdit('性渴望程度')"><Check :size="12" /></button>
                                  <button class="edit-no-btn" @click.stop="cancelEdit"><X :size="12" /></button>
                                </div>
                              </template>
                              <span v-else class="dev-value" style="display:flex; align-items:center;">{{ privacy.性渴望程度 ?? 0 }}/100 <Edit :size="10" class="inline-edit-icon" style="margin-left:4px" /></span>
                            </div>
                            <div class="dev-bar-track">
                              <div
                                class="dev-bar-fill desire-fill"
                                :style="{ width: `${clampPercent(privacy.性渴望程度)}%` }"
                              ></div>
                            </div>
                          </div>
                        </div>

                        <div v-if="privacyLastTime" class="last-time-info">
                          <span class="last-time-label">最近一次：</span>
                          <span class="last-time-value">{{ privacyLastTime }}</span>
                        </div>
                      </div>

                      <!-- 偏好/体质 -->
                      <div
                        class="nsfw-subsection"
                      >
                        <h6 class="subsection-title">偏好与体质</h6>
                        <div class="bottomline-tags editable-list">
                          <span
                            v-for="(kink, index) in privacyFetishesAll"
                            :key="`${kink}-${index}`"
                            class="fetish-tag with-delete"
                            >{{ kink }}
                            <button class="tag-delete-btn" @click.stop="removeListItemByValue('性癖好', kink, '私密信息.性癖好')" title="删除">&times;</button>
                          </span>
                        </div>
                        <div class="bottomline-tags editable-list" style="margin-top: 0.5rem">
                           <span class="fetish-tag add-tag" @click="newListItemInput = ''; startEdit('性癖好_add', '')">
                            <template v-if="editField === '性癖好_add'">
                              <input v-model="newListItemInput" class="tag-add-input" placeholder="新性癖" @keyup.enter="addListItem('性癖好', newListItemInput, '私密信息.性癖好'); cancelEdit()" @keyup.escape="cancelEdit" @blur="{ if(newListItemInput.trim()) addListItem('性癖好', newListItemInput, '私密信息.性癖好'); cancelEdit(); }" />
                            </template>
                            <template v-else><Plus :size="12" /> 添加性癖</template>
                          </span>
                        </div>
                        <div
                          class="bottomline-tags editable-list"
                          style="margin-top: 0.5rem"
                        >
                          <span
                            v-for="(trait, index) in privacyTraitsAll"
                            :key="`${trait}-${index}`"
                            class="special-trait-tag with-delete"
                            >{{ trait }}
                            <button class="tag-delete-btn" @click.stop="removeListItemByValue('特殊体质', trait, '私密信息.特殊体质')" title="删除">&times;</button>
                          </span>
                           <span class="special-trait-tag add-tag" @click="newListItemInput = ''; startEdit('特殊体质_add', '')">
                            <template v-if="editField === '特殊体质_add'">
                              <input v-model="newListItemInput" class="tag-add-input" placeholder="新体质" @keyup.enter="addListItem('特殊体质', newListItemInput, '私密信息.特殊体质'); cancelEdit()" @keyup.escape="cancelEdit" @blur="{ if(newListItemInput.trim()) addListItem('特殊体质', newListItemInput, '私密信息.特殊体质'); cancelEdit(); }" />
                            </template>
                            <template v-else><Plus :size="12" /> 添加体质</template>
                          </span>
                        </div>
                      </div>

                      <!-- 性伴侣名单 -->
                      <div class="nsfw-subsection">
                        <h6 class="subsection-title">性伴侣名单</h6>
                        <div class="bottomline-tags partner-list editable-list">
                          <span
                            v-for="(partner, index) in privacyPartners"
                            :key="`${partner}-${index}`"
                            class="partner-tag with-delete"
                            >{{ partner }}
                            <button class="tag-delete-btn" @click.stop="removeListItemByValue('性伴侣名单', partner, '私密信息.性伴侣名单')" title="删除">&times;</button>
                          </span>
                          <span class="partner-tag add-tag" @click="newListItemInput = ''; startEdit('性伴侣名单_add', '')">
                            <template v-if="editField === '性伴侣名单_add'">
                              <input v-model="newListItemInput" class="tag-add-input" placeholder="新伴侣" @keyup.enter="addListItem('性伴侣名单', newListItemInput, '私密信息.性伴侣名单'); cancelEdit()" @keyup.escape="cancelEdit" @blur="{ if(newListItemInput.trim()) addListItem('性伴侣名单', newListItemInput, '私密信息.性伴侣名单'); cancelEdit(); }" />
                            </template>
                            <template v-else><Plus :size="12" /> 添加</template>
                          </span>
                        </div>
                        <button
                          v-if="privacyPartnersAll.length > privacyPartners.length"
                          class="toggle-more-btn"
                          @click="showAllPrivacyPartners = true"
                          type="button"
                        >
                          显示全部（{{ privacyPartnersAll.length }}）
                        </button>
                        <button
                          v-else-if="
                            privacyPartnersAll.length > privacyPartnersPreviewLimit &&
                            showAllPrivacyPartners
                          "
                          class="toggle-more-btn"
                          @click="showAllPrivacyPartners = false"
                          type="button"
                        >
                          收起
                        </button>
                      </div>

                      <!-- 身体部位 -->
                      <div class="nsfw-subsection">
                        <div class="subsection-header-row">
                          <h6 class="subsection-title">身体部位</h6>
                          <button class="add-btn-sm" @click="openAddBodyPartModal">
                            <Plus :size="12" /> 添加
                          </button>
                        </div>

                        <div class="body-parts-list">
                          <div
                            v-for="(part, index) in privacyBodyParts"
                            :key="`${part.部位名称}-${index}`"
                            class="body-part-item editable-card"
                          >
                            <div class="part-header">
                              <span class="part-name">{{
                                part.部位名称 || `部位${index + 1}`
                              }}</span>
                              <div class="part-actions-hover">
                                <button class="action-btn-icon" @click.stop="openEditBodyPartModal(part, index)" title="编辑">
                                  <Edit :size="12" />
                                </button>
                                <button class="action-btn-icon delete" @click.stop="deleteBodyPart(index)" title="删除">
                                  <Trash2 :size="12" />
                                </button>
                              </div>
                              <span v-if="part.特殊印记" class="part-mark">{{
                                part.特殊印记
                              }}</span>
                            </div>
                            <div v-if="part.特征描述" class="part-description">
                              {{ part.特征描述 }}
                            </div>
                            <div class="part-stats">
                              <div class="part-stat">
                                <span class="stat-label">敏感度</span>
                                <div class="stat-bar-mini">
                                  <div
                                    class="stat-bar-fill sensitivity"
                                    :style="{ width: `${clampPercent(part.敏感度)}%` }"
                                  ></div>
                                </div>
                                <span class="stat-value">{{ part.敏感度 ?? 0 }}</span>
                              </div>
                              <div class="part-stat">
                                <span class="stat-label">开发度</span>
                                <div class="stat-bar-mini">
                                  <div
                                    class="stat-bar-fill development"
                                    :style="{ width: `${clampPercent(part.开发度)}%` }"
                                  ></div>
                                </div>
                                <span class="stat-value">{{ part.开发度 ?? 0 }}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <button
                          v-if="privacyBodyPartsAll.length > privacyBodyParts.length"
                          class="toggle-more-btn"
                          @click="showAllPrivacyBodyParts = true"
                          type="button"
                        >
                          显示全部（{{ privacyBodyPartsAll.length }}）
                        </button>
                        <button
                          v-else-if="
                            privacyBodyPartsAll.length > privacyBodyPartsPreviewLimit &&
                            showAllPrivacyBodyParts
                          "
                          class="toggle-more-btn"
                          @click="showAllPrivacyBodyParts = false"
                          type="button"
                        >
                          收起
                        </button>
                      </div>
                    </div>

                    <div v-else class="bottomline-empty">
                      暂无私密信息
                      <button class="create-blank-btn" @click="createBlankPrivacyProfile">
                        <Plus :size="14" /> 创建空白模板
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Tab 3: 记忆档案 -->
                <div v-show="activeTab === 'memory'" class="tab-panel">
                  <!-- 详细记忆区域 -->
                  <div class="detail-section" v-if="selectedPerson.记忆?.length">
                    <div class="memory-header">
                      <h5 class="section-title" style="border: none; padding: 0; margin: 0">
                        📝 详细记忆
                      </h5>
                      <div class="memory-actions-header">
                        <div class="memory-count">{{ selectedPerson.记忆?.length || 0 }} 条</div>
                        <div class="memory-controls-group">
                          <button
                            class="download-memory-btn"
                            @click="downloadMemories"
                            title="下载所有记忆"
                          >
                            💾 下载记忆
                          </button>
                          <div
                            v-if="(selectedPerson.记忆?.length || 0) >= 3"
                            class="summarize-controls"
                          >
                            <input
                              type="number"
                              v-model.number="memoriesToSummarize"
                              :min="3"
                              :max="selectedPerson.记忆?.length || 3"
                              class="summarize-input"
                              placeholder="条数"
                              title="从最旧开始总结的记忆条数"
                            />
                            <button
                              class="summarize-btn"
                              @click="summarizeMemories"
                              :disabled="isSummarizing"
                              title="总结最旧的记忆"
                            >
                              {{ isSummarizing ? '总结中...' : '📝 总结' }}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <!-- 总结模式提示 -->
                    <div class="summary-mode-hint">
                      ℹ️ 总结模式配置（Raw/标准、流式/非流式）请前往 <strong>记忆中心面板</strong> →
                      设置
                    </div>
                    <div class="memory-list">
                      <div
                        v-for="(memory, index) in paginatedMemory"
                        :key="index"
                        class="memory-item"
                      >
                        <div class="memory-content">
                          <div v-if="getMemoryTime(memory)" class="memory-time">
                            {{ getMemoryTime(memory) }}
                          </div>
                          <div class="memory-event">{{ getMemoryEvent(memory) }}</div>
                        </div>
                        <div class="memory-actions">
                          <button
                            class="memory-btn edit"
                            @click="editMemory((currentMemoryPage - 1) * memoryPageSize + index)"
                          >
                            编辑
                          </button>
                          <button
                            class="memory-btn delete"
                            @click="deleteMemory((currentMemoryPage - 1) * memoryPageSize + index)"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                    <div class="memory-pagination" v-if="totalMemoryPages > 1">
                      <button
                        class="pagination-btn"
                        :disabled="currentMemoryPage <= 1"
                        @click="goToMemoryPage(currentMemoryPage - 1)"
                      >
                        上一页
                      </button>
                      <div class="pagination-controls">
                        <span class="pagination-info"
                          >{{ currentMemoryPage }} / {{ totalMemoryPages }}</span
                        >
                        <div class="jump-to-page">
                          <input
                            type="number"
                            v-model.number="jumpToPageInput"
                            :min="1"
                            :max="totalMemoryPages"
                            class="page-input"
                            placeholder="页码"
                            @keyup.enter="jumpToSpecificPage"
                          />
                          <button class="jump-btn" @click="jumpToSpecificPage">跳转</button>
                        </div>
                      </div>
                      <button
                        class="pagination-btn"
                        :disabled="currentMemoryPage >= totalMemoryPages"
                        @click="goToMemoryPage(currentMemoryPage + 1)"
                      >
                        下一页
                      </button>
                    </div>
                  </div>

                  <!-- 记忆总结区域 -->
                  <div
                    class="detail-section memory-summary-section"
                    v-if="selectedPerson.记忆总结?.length"
                  >
                    <h5 class="section-title">📜 记忆总结</h5>
                    <div class="memory-summary-list">
                      <div
                        v-for="(summary, index) in selectedPerson.记忆总结"
                        :key="index"
                        class="memory-summary-item"
                      >
                        <div class="summary-icon">📜</div>
                        <div class="summary-text">{{ summary }}</div>
                      </div>
                    </div>
                  </div>

                  <!-- 空状态提示 -->
                  <div
                    v-if="!selectedPerson.记忆?.length && !selectedPerson.记忆总结?.length"
                    class="detail-section"
                  >
                    <div class="empty-state-small">
                      <BookOpen :size="24" class="empty-icon" />
                      <p>此人暂无记忆</p>
                      <p class="empty-hint">在游戏中与该人物互动会生成记忆</p>
                    </div>
                  </div>
                </div>
                <!-- End of Tab 4: 记忆档案 -->

                <!-- Tab 5: 背包 -->
                <div v-show="activeTab === 'inventory'" class="tab-panel">
                  <div class="detail-section">
                    <div class="section-header-row">
                      <h5 class="section-title">背包</h5>
                      <button class="add-item-btn" @click="showAddItemModal = true" title="添加物品">
                        <Plus :size="14" /> 添加物品
                      </button>
                    </div>
                    <div v-if="selectedPerson.背包?.金钱 || (selectedPerson.背包 as any)?.灵石" class="spirit-stones-grid">
                      <div class="spirit-stone-item editable-row" v-for="g in ['现金','铜','银','金']" :key="g" @click="editField !== `货币_${g}` && startEdit(`货币_${g}`, getNpcCurrencyTier(selectedPerson, g))">
                        <span>{{ t(g) }}{{ t('金钱') }}</span>
                        <template v-if="editField === `货币_${g}`">
                          <input type="number" v-model.number="editValue" class="inline-edit-input-sm" min="0" @keyup.enter="updateCurrency(g, editValue); cancelEdit()" @keyup.escape="cancelEdit" />
                          <button class="edit-ok-btn" @click.stop="updateCurrency(g, editValue); cancelEdit()" title="确认"><Check :size="10" /></button>
                          <button class="edit-no-btn" @click.stop="cancelEdit" title="取消"><X :size="10" /></button>
                        </template>
                        <span v-else>{{ getNpcCurrencyTier(selectedPerson, g) }} <Edit :size="10" class="inline-edit-icon" /></span>
                      </div>
                    </div>
                    <div class="npc-inventory" style="margin-top: 1rem">
                      <div v-if="hasNpcItems(selectedPerson)" class="npc-items-grid">
                        <div
                          v-for="(item, itemId) in selectedPerson.背包.物品"
                          :key="itemId"
                          class="npc-item-card"
                          :class="getItemQualityClass(item.品质?.quality)"
                        >
                          <div class="item-header">
                            <span class="item-name">{{ item.名称 || itemId }}</span>
                            <span class="item-type">{{ item.类型 || '其他' }}</span>
                            <button class="item-delete-btn" @click.stop="deleteNpcItem(String(itemId))" title="删除此物品">
                              <X :size="12" />
                            </button>
                          </div>
                          <div class="item-quality" v-if="item.品质">
                            <span class="quality-text"
                              >{{ item.品质?.quality || '未知'
                              }}{{ item.品质?.grade ? getGradeText(item.品质.grade) : '' }}</span
                            >
                          </div>
                          <div class="item-quantity" v-if="item.数量 > 1">
                            <span>x{{ item.数量 }}</span>
                          </div>
                          <div class="item-description" v-if="item.描述">
                            <p>{{ item.描述 }}</p>
                          </div>
                          <div class="item-actions">
                            <button
                              class="trade-btn"
                              @click="initiateTradeWithNpc(selectedPerson, item)"
                              title="尝试交易此物品"
                            >
                              <ArrowRightLeft :size="12" />交易
                            </button>
                            <button
                              class="request-btn"
                              @click="requestItemFromNpc(selectedPerson, item)"
                              title="请求获得此物品"
                            >
                              🙏 索要
                            </button>
                            <button
                              class="steal-btn"
                              @click="attemptStealFromNpc(selectedPerson, item)"
                              title="尝试偷取此物品"
                            >
                              🥷 偷窃
                            </button>
                          </div>
                        </div>
                      </div>
                      <div v-else class="empty-inventory">
                        <Package :size="24" class="empty-icon" />
                        <p>此人身上没有物品</p>
                      </div>
                    </div>
                  </div>



                  <!-- 添加物品弹窗 -->
                  <div v-if="showAddItemModal" class="modal-overlay" @click.self="showAddItemModal = false">
                    <div class="add-item-modal">
                      <h4 class="modal-title">添加物品</h4>
                      <div class="modal-form">
                        <div class="form-group">
                          <label>名称</label>
                          <input v-model="newItemForm.名称" class="form-input" placeholder="物品名称" />
                        </div>
                        <div class="form-group">
                          <label>类型</label>
                          <select v-model="newItemForm.类型" class="form-input">
                            <option v-for="t in ['武器', '护甲', '药品', '材料', '功法', '其他']" :key="t" :value="t">{{ t }}</option>
                          </select>
                        </div>
                        <div class="form-group">
                          <label>品质</label>
                          <input v-model="newItemForm.品质" class="form-input" placeholder="如：凡品/精品/传说" />
                        </div>
                        <div class="form-group">
                          <label>数量</label>
                          <input type="number" v-model.number="newItemForm.数量" class="form-input" min="1" />
                        </div>
                        <div class="form-group">
                          <label>描述</label>
                          <textarea v-model="newItemForm.描述" class="form-input form-textarea" rows="2" placeholder="物品描述（可选）" />
                        </div>
                      </div>
                      <div class="modal-actions">
                        <button class="modal-btn confirm" @click="addItemToNpc">确定添加</button>
                        <button class="modal-btn cancel" @click="showAddItemModal = false">取消</button>
                      </div>
                    </div>
                  </div>
                </div>
                <!-- End of Tab 5: 背包 -->

                <!-- Tab 6: 原始数据 -->
                <div v-show="activeTab === 'raw'" class="tab-panel">
                  <div class="detail-section">
                    <h5 class="section-title">原始数据 (JSON)</h5>
                    <div class="raw-data-container">
                      <pre><code>{{ JSON.stringify(selectedPerson, null, 2) }}</code></pre>
                    </div>
                  </div>
                </div>
                <!-- End of Tab 7: 原始数据 -->
              </div>
              <!-- End of tab-content -->
            </div>
            <!-- End of detail-body -->
          </template>
          <div v-else class="no-selection">
            <Users2 :size="64" class="placeholder-icon" />
            <p class="placeholder-text">选择一个人物查看详细信息</p>
            <p class="placeholder-hint">在游戏中与人物互动会建立关系记录</p>
          </div>
        </div>
      </div>
    </div>
  </div>
  <Teleport to="body">
    <div v-if="showBodyPartModal" class="modal-overlay" @click.self="showBodyPartModal = false">
      <div class="add-item-modal glass-modal">
        <div class="modal-header">
          <h4 class="modal-title">{{ editingBodyPartIndex === -1 ? '添加身体部位' : '编辑身体部位' }}</h4>
          <button class="close-btn" @click="showBodyPartModal = false"><X :size="20" /></button>
        </div>
        <div class="modal-form">
          <div class="form-group">
            <label>部位名称</label>
            <input v-model="bodyPartForm.部位名称" class="form-input glow-input" placeholder="如：胸部、大腿" />
          </div>
          <div class="form-group">
            <label>特殊印记</label>
            <input v-model="bodyPartForm.特殊印记" class="form-input glow-input" placeholder="如：蝴蝶纹身" />
          </div>
          <div class="form-group-row">
            <div class="form-group half">
              <label>敏感度 (0-100)</label>
              <input type="number" v-model.number="bodyPartForm.敏感度" class="form-input glow-input" min="0" max="100" />
            </div>
            <div class="form-group half">
              <label>开发度 (0-100)</label>
              <input type="number" v-model.number="bodyPartForm.开发度" class="form-input glow-input" min="0" max="100" />
            </div>
          </div>
          <div class="form-group">
            <label>特征描述</label>
            <textarea v-model="bodyPartForm.特征描述" class="form-input form-textarea glow-input" rows="3" placeholder="部位的详细外观描述..." />
          </div>
        </div>
        <div class="modal-actions">
          <button class="modal-btn cancel" @click="showBodyPartModal = false">取消</button>
          <button class="modal-btn confirm glow-btn" @click="saveBodyPart">确定</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated, watch } from 'vue';
import { useActionQueueStore } from '@/stores/actionQueueStore';
import { useI18n } from '@/i18n';
import { USE_MING_PROMPTS } from '@/services/defaultPrompts';
import type { NpcProfile, Item, BodyPartDevelopment, PrivacyProfile, SaveData } from '@/types/game';
import type { SpiritRoot } from '@/types';
import {
  Users2, Search,
  Loader2, ChevronRight, Package, ArrowRightLeft, Eye, EyeOff, Trash2, ArrowLeft, Download, BookOpen, Lock, Unlock, Edit, Plus, X, Check, Wand2, List, Type
} from 'lucide-vue-next';
import { collectAllLocationNames, ensureLocationExists, appendNpcsToLocation } from '@/utils/locationUtils';
import { validateAndRepairNpcProfile } from '@/utils/dataValidation';
import { useUIStore } from '@/stores/uiStore';
import { useCharacterStore } from '@/stores/characterStore';
import { useGameStateStore } from '@/stores/gameStateStore';
import { getMemoryTime, getMemoryEvent } from '@/utils/memoryUtils';
import { isTavernEnv, hasNativeTavernHelper } from '@/utils/tavern';
import { cloneDeep } from 'lodash';

/**
 * 提取NPC记忆总结所需的精简存档数据
 * 与正式游戏交互保持一致：移除叙事历史、短期记忆、隐式中期记忆
 */
function extractEssentialDataForNPCSummary(saveData: SaveData | null): SaveData | Record<string, never> {
  if (!saveData) return {};

  const simplified = cloneDeep(saveData);

  // 移除叙事历史（避免与短期记忆重复）
  if ((simplified as any).系统?.历史?.叙事) {
    delete (simplified as any).系统.历史.叙事;
  }

  // 移除短期和隐式中期记忆（以优化AI上下文）
  if ((simplified as any).社交?.记忆) {
    delete (simplified as any).社交.记忆.短期记忆;
    delete (simplified as any).社交.记忆.隐式中期记忆;
  }

  return simplified;
}

function clampPercent(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(100, numeric));
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeStringList(value: unknown): string[] {
  const dedupe = (items: string[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
  };

  if (Array.isArray(value)) {
    return dedupe(
      value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean),
    );
  }

  const single = normalizeNonEmptyString(value);
  if (!single) return [];

  // 兼容旧数据：可能是“a、b、c”这种拼接字符串
  if (/[、,，;；\n]/.test(single)) {
    return dedupe(
      single
      .split(/[、,，;；\n]/)
      .map((s) => s.trim())
        .filter(Boolean),
    );
  }

  return [single];
}

function normalizeBodyParts(value: unknown): BodyPartDevelopment[] {
  if (Array.isArray(value)) {
    const parts = value.filter((p): p is BodyPartDevelopment => typeof p === 'object' && p !== null);
    const seen = new Set<string>();
    return parts.filter((part, index) => {
      const key = normalizeNonEmptyString((part as any).部位名称) ?? `__index_${index}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.values(value as Record<string, unknown>);
    const parts = entries.filter((p): p is BodyPartDevelopment => typeof p === 'object' && p !== null);
    const seen = new Set<string>();
    return parts.filter((part, index) => {
      const key = normalizeNonEmptyString((part as any).部位名称) ?? `__index_${index}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return [];
}

// 🔥 新架构：从 gameStateStore 获取数据
const gameStateStore = useGameStateStore();
const isTavernEnvFlag = ref(isTavernEnv());
const hasNativeTavernFlag = ref(hasNativeTavernHelper());

onMounted(() => {
  isTavernEnvFlag.value = isTavernEnv();
  hasNativeTavernFlag.value = hasNativeTavernHelper();
});

onActivated(() => {
  isTavernEnvFlag.value = isTavernEnv();
  hasNativeTavernFlag.value = hasNativeTavernHelper();
});
const { t } = useI18n();
const traitOrRootLabel = computed(() => t('特质'));
const characterData = computed(() => gameStateStore.getCurrentSaveData());
const actionQueue = useActionQueueStore();
const uiStore = useUIStore();
const characterStore = useCharacterStore();
const isLoading = ref(false);
const selectedPerson = ref<NpcProfile | null>(null);
const searchQuery = ref('');
const isDetailViewActive = ref(false); // 用于移动端视图切换

const privacy = computed<PrivacyProfile | null>(() => selectedPerson.value?.私密信息 ?? null);
const privacyLastTime = computed(() => normalizeNonEmptyString(privacy.value?.最近一次性行为时间) ?? '');
const privacyFetishesAll = computed(() => normalizeStringList(privacy.value?.性癖好));
const privacyTraitsAll = computed(() => normalizeStringList(privacy.value?.特殊体质));

const privacyPartnersPreviewLimit = 10;
const showAllPrivacyPartners = ref(false);
const privacyPartnersAll = computed(() => normalizeStringList(privacy.value?.性伴侣名单));
const privacyPartners = computed(() =>
  showAllPrivacyPartners.value ? privacyPartnersAll.value : privacyPartnersAll.value.slice(0, privacyPartnersPreviewLimit),
);

const privacyBodyPartsPreviewLimit = 6;
const showAllPrivacyBodyParts = ref(false);
const privacyBodyPartsAll = computed(() => normalizeBodyParts(privacy.value?.身体部位));
const privacyBodyParts = computed(() =>
  showAllPrivacyBodyParts.value
    ? privacyBodyPartsAll.value
    : privacyBodyPartsAll.value.slice(0, privacyBodyPartsPreviewLimit),
);

const nsfwEnabled = computed(() => {
  try {
    const raw = localStorage.getItem('dad_game_settings');
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { enableNsfwMode?: boolean };
    return parsed.enableNsfwMode !== false;
  } catch {
    return true;
  }
});

// 历史在做事项（在做事项 tab 下方只读归档）
const historyActivityList = computed(() => {
  const arr = (selectedPerson.value as any)?.历史在做事项;
  return Array.isArray(arr) ? arr : [];
});

// ==================== NPC 编辑功能 ====================

// 编辑状态
const editField = ref<string | null>(null);
const editValue = ref<any>(null);
const isCreatingNpc = ref(false);
const isRefiningNpc = ref(false);
const showAddItemModal = ref(false);
const showLocationDropdown = ref(false);
const locationSearchQuery = ref('');
const isLocationCustomInput = ref(false);

// 新增物品表单
const newItemForm = ref({
  名称: '',
  类型: '其他' as string,
  品质: '',
  数量: 1,
  描述: '',
});

// 身体部位编辑表单
const showBodyPartModal = ref(false);
const editingBodyPartIndex = ref(-1);
const bodyPartForm = ref<BodyPartDevelopment>({
  部位名称: '',
  特征描述: '',
  特殊印记: '',
  敏感度: 0,
  开发度: 0,
});

// 所有地点名称（用于位置 dropdown）
const allLocationNames = computed(() => {
  const saveData = gameStateStore.getCurrentSaveData();
  if (!saveData) return [];
  return collectAllLocationNames(saveData as Record<string, unknown>);
});

// 过滤后的地点
const filteredLocations = computed(() => {
  const q = locationSearchQuery.value.trim().toLowerCase();
  if (!q) return allLocationNames.value;
  return allLocationNames.value.filter(name => name.toLowerCase().includes(q));
});

// 查找 NPC 在 store 中的 key
const getNpcStoreKey = (): string | null => {
  if (!selectedPerson.value) return null;
  return findRelationshipKeyByName(selectedPerson.value.名字);
};

// 开始编辑某个字段
const startEdit = (field: string, currentValue: any) => {
  editField.value = field;
  editValue.value = typeof currentValue === 'object' ? JSON.parse(JSON.stringify(currentValue)) : currentValue;
  if (field === '当前位置') {
    showLocationDropdown.value = true;
    locationSearchQuery.value = typeof currentValue === 'string' ? currentValue : (currentValue?.描述 || '');
    // Auto-detect mode: if value is effectively empty or exists in list, use select; otherwise use input
    const val = locationSearchQuery.value;
    isLocationCustomInput.value = !!val && !allLocationNames.value.includes(val);
  }
};

// 取消编辑
const cancelEdit = () => {
  editField.value = null;
  editValue.value = null;
  showLocationDropdown.value = false;
  locationSearchQuery.value = '';
};

// 核心：更新 NPC 字段
const updateNpcField = async (field: string, value: any, nestedPath?: string) => {
  const key = getNpcStoreKey();
  if (!key || !gameStateStore.relationships?.[key]) return;

  const npc = gameStateStore.relationships[key];
  if (nestedPath) {
    // 处理嵌套路径，如 '属性.体力.当前'
    const parts = nestedPath.split('.');
    let target: any = npc;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!target[parts[i]]) target[parts[i]] = {};
      target = target[parts[i]];
    }
    target[parts[parts.length - 1]] = value;
  } else {
    (npc as any)[field] = value;
  }

  // 刷新 selectedPerson
  selectedPerson.value = { ...gameStateStore.relationships[key] };
  await gameStateStore.saveGame();
  uiStore.showToast(`已更新 ${field}`, { type: 'success' });
};

// 确认编辑
const confirmEdit = async (field: string) => {
  if (editField.value !== field) return;
  const value = editValue.value;

  // 字段验证
  if (field === '好感度') {
    const num = Number(value);
    if (!Number.isFinite(num) || num < -100 || num > 100) {
      uiStore.showToast('好感度必须在 -100 到 100 之间', { type: 'error' });
      return;
    }
    await updateNpcField(field, num);
  } else if (field === '名字') {
    const str = String(value).trim();
    if (!str) {
      uiStore.showToast('名字不能为空', { type: 'error' });
      return;
    }
    // 更新 store key（名字是 key）
    const oldKey = getNpcStoreKey();
    if (!oldKey || !gameStateStore.relationships?.[oldKey]) return;
    const npcData = gameStateStore.relationships[oldKey];
    npcData.名字 = str;
    // 如果名字变了，需要重新映射 key
    if (oldKey !== str) {
      gameStateStore.relationships[str] = npcData;
      delete gameStateStore.relationships[oldKey];
    }
    selectedPerson.value = { ...gameStateStore.relationships[str] };
    await gameStateStore.saveGame();
    uiStore.showToast('已更新名字', { type: 'success' });
  } else if (field === '当前位置') {
    const locName = String(locationSearchQuery.value || editValue.value).trim();
    if (!locName) {
      uiStore.showToast('位置不能为空', { type: 'error' });
      return;
    }
    await updateNpcLocation(locName);
  } else if (['性渴望程度', '性交总次数'].includes(field)) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      uiStore.showToast('数值必须为非负数', { type: 'error' });
      return;
    }
    if (field === '性渴望程度' && num > 100) {
      uiStore.showToast('性渴望程度必须在 0-100 之间', { type: 'error' });
      return;
    }
    await updateNpcField(field, num, `私密信息.${field}`);
  } else if (field === '是否为处女') {
    await updateNpcField(field, value, '私密信息.是否为处女');
  } else if (field === '地位') {
    const existing = (gameStateStore.relationships?.[getNpcStoreKey() ?? ''] as any)?.地位;
    const desc = existing && typeof existing === 'object' ? (existing.描述 ?? '') : '';
    await updateNpcField(field, { 名称: String(value), 描述: desc });
  } else if (field === '年龄') {
    const newAge = parseInt(String(value));
    if (Number.isFinite(newAge) && newAge >= 0) {
      const currentYear = (gameStateStore.worldInfo as any)?.时间?.年 ?? (characterData.value as any)?.元数据?.时间?.年 ?? 0;
      const newBirthYear = currentYear - newAge;

      const key = getNpcStoreKey();
      if (key && gameStateStore.relationships?.[key]) {
        const npc = gameStateStore.relationships[key];
        if (!npc.出生日期) (npc as any).出生日期 = { 年: newBirthYear, 月: 1, 日: 1 };
        else npc.出生日期.年 = newBirthYear;

        selectedPerson.value = { ...gameStateStore.relationships[key] };
        await gameStateStore.saveGame();
        uiStore.showToast(`已更新年龄为 ${newAge}岁`, { type: 'success' });
      }
    }
  } else if (['性格倾向', '性取向', '当前性状态', '体液分泌状态'].includes(field)) {
    // 私密信息概览字段
    await updateNpcField(field, value, `私密信息.${field}`);
  } else {
    await updateNpcField(field, value);
  }
  cancelEdit();
};

// ==================== 身体部位编辑逻辑 ====================

const openAddBodyPartModal = () => {
  editingBodyPartIndex.value = -1;
  bodyPartForm.value = {
    部位名称: '',
    特征描述: '',
    特殊印记: '',
    敏感度: 0,
    开发度: 0,
  };
  showBodyPartModal.value = true;
};

const openEditBodyPartModal = (part: BodyPartDevelopment, index: number) => {
  editingBodyPartIndex.value = index;
  // 深拷贝防止直接修改
  bodyPartForm.value = JSON.parse(JSON.stringify(part));
  showBodyPartModal.value = true;
};

const saveBodyPart = async () => {
  if (!selectedPerson.value) return;
  const name = bodyPartForm.value.部位名称?.trim();
  if (!name) {
    uiStore.showToast('部位名称不能为空', { type: 'error' });
    return;
  }

  const key = getNpcStoreKey();
  if (!key || !gameStateStore.relationships?.[key]) return;
  const npc = gameStateStore.relationships[key];

  // 确保结构存在
  if (!npc.私密信息) (npc as any).私密信息 = {};
  if (!npc.私密信息!.身体部位) npc.私密信息!.身体部位 = [];

  const parts = npc.私密信息!.身体部位;

  // 准备数据
  const newPart: BodyPartDevelopment = {
    ...bodyPartForm.value,
    敏感度: clampPercent(bodyPartForm.value.敏感度),
    开发度: clampPercent(bodyPartForm.value.开发度),
  };

  if (editingBodyPartIndex.value === -1) {
    // 新增
    parts.push(newPart);
    uiStore.showToast(`已添加部位: ${name}`, { type: 'success' });
  } else {
    // 编辑
    if (editingBodyPartIndex.value >= 0 && editingBodyPartIndex.value < parts.length) {
      parts[editingBodyPartIndex.value] = newPart;
      uiStore.showToast(`已更新部位: ${name}`, { type: 'success' });
    }
  }

  // 保存
  selectedPerson.value = { ...npc };
  await gameStateStore.saveGame();
  showBodyPartModal.value = false;
};

const deleteBodyPart = async (index: number) => {
  if (!confirm('确定要删除这个身体部位吗？')) return;

  const key = getNpcStoreKey();
  if (!key || !gameStateStore.relationships?.[key]) return;
  const npc = gameStateStore.relationships[key];

  if (npc.私密信息?.身体部位 && index >= 0 && index < npc.私密信息.身体部位.length) {
    const removed = npc.私密信息.身体部位.splice(index, 1)[0];
    selectedPerson.value = { ...npc };
    await gameStateStore.saveGame();
    uiStore.showToast(`已删除部位: ${removed.部位名称}`, { type: 'success' });
  }
};

// 更新 NPC 位置（含地图联动）
const updateNpcLocation = async (locName: string) => {
  const key = getNpcStoreKey();
  if (!key || !gameStateStore.relationships?.[key]) return;

  const npc = gameStateStore.relationships[key];
  const oldLoc = npc.当前位置?.描述;

  // 更新 NPC 位置
  if (!npc.当前位置) {
    (npc as any).当前位置 = { 描述: locName };
  } else {
    npc.当前位置.描述 = locName;
  }

  // 获取 saveData 进行地图联动
  const saveData = gameStateStore.toSaveData() as Record<string, unknown>;

  // 确保地点存在（支持 A·B·C 格式自动创建）
  const existingNames = allLocationNames.value;
  if (!existingNames.includes(locName)) {
    ensureLocationExists(saveData, locName);
  }

  // 将 NPC 添加到新地点的 地点NPC
  appendNpcsToLocation(saveData, locName, [npc.名字]);

  // 同步地点信息回 store
  const worldInfo = (saveData as any)?.世界?.信息;
  if (worldInfo) {
    gameStateStore.worldInfo = worldInfo;
  }

  selectedPerson.value = { ...gameStateStore.relationships[key] };
  await gameStateStore.saveGame();
  showLocationDropdown.value = false;
  locationSearchQuery.value = '';
  uiStore.showToast(`已更新位置: ${oldLoc || '无'} → ${locName}`, { type: 'success' });
};

// 选择位置 dropdown 条目
const selectLocation = (locName: string) => {
  locationSearchQuery.value = locName;
  editValue.value = locName;
};

// 列表字段：新增项
const addListItem = async (field: string, value: string, nestedPath?: string) => {
  const trimmed = value.trim();
  if (!trimmed) return;
  const key = getNpcStoreKey();
  if (!key || !gameStateStore.relationships?.[key]) return;

  const npc = gameStateStore.relationships[key];
  let arr: any[];
  if (nestedPath) {
    const parts = nestedPath.split('.');
    let target: any = npc;
    for (const p of parts) {
      if (!target[p]) target[p] = [];
      target = target[p];
    }
    arr = target;
  } else {
    if (!Array.isArray((npc as any)[field])) (npc as any)[field] = [];
    arr = (npc as any)[field];
  }

  if (Array.isArray(arr) && !arr.includes(trimmed)) {
    arr.push(trimmed);
    selectedPerson.value = { ...gameStateStore.relationships[key] };
    await gameStateStore.saveGame();
    uiStore.showToast(`已添加: ${trimmed}`, { type: 'success' });
  }
};

// 列表字段：删除项
const removeListItem = async (field: string, index: number, nestedPath?: string) => {
  const key = getNpcStoreKey();
  if (!key || !gameStateStore.relationships?.[key]) return;

  const npc = gameStateStore.relationships[key];
  let arr: any[];
  if (nestedPath) {
    const parts = nestedPath.split('.');
    let target: any = npc;
    for (const p of parts) { target = target?.[p]; }
    arr = target;
  } else {
    arr = (npc as any)[field];
  }

  if (Array.isArray(arr) && index >= 0 && index < arr.length) {
    const removed = arr.splice(index, 1)[0];
    selectedPerson.value = { ...gameStateStore.relationships[key] };
    await gameStateStore.saveGame();
    uiStore.showToast(`已删除: ${typeof removed === 'string' ? removed : JSON.stringify(removed)}`, { type: 'success' });
  }
};

// 列表字段：按值删除 (用于 computed 列表)
const removeListItemByValue = async (field: string, value: string, nestedPath?: string) => {
  const key = getNpcStoreKey();
  if (!key || !gameStateStore.relationships?.[key]) return;

  const npc = gameStateStore.relationships[key];
  let arr: any[];
  if (nestedPath) {
    const parts = nestedPath.split('.');
    let target: any = npc;
    for (const p of parts) { target = target?.[p]; }
    arr = target;
  } else {
    arr = (npc as any)[field];
  }

  if (Array.isArray(arr)) {
    const index = arr.findIndex(item => item === value || item?.trim() === value.trim());
    if (index !== -1) {
      const removed = arr.splice(index, 1)[0];
      selectedPerson.value = { ...gameStateStore.relationships[key] };
      await gameStateStore.saveGame();
      uiStore.showToast(`已删除: ${value}`, { type: 'success' });
    }
  }
};

// 六司属性编辑
const updateInnateAttr = async (attrName: string, value: number, type: '先天' | '后天' = '先天') => {
  const key = getNpcStoreKey();
  if (!key || !gameStateStore.relationships?.[key]) return;
  const npc = gameStateStore.relationships[key];
  const fieldKey = type === '先天' ? '先天六维属性' : '后天六维属性';
  const maxVal = type === '先天' ? 10 : 20;
  const clamped = Math.max(0, Math.min(maxVal, Math.round(value)));
  if (!(npc as any)[fieldKey]) (npc as any)[fieldKey] = {};
  (npc as any)[fieldKey][attrName] = clamped;
  selectedPerson.value = { ...gameStateStore.relationships[key] };
  await gameStateStore.saveGame();
};

// 核心数值编辑 (体力/精力/洞察力 的当前/上限)
const updateStatValue = async (statKey: string, curValue: number, maxValue: number) => {
  const key = getNpcStoreKey();
  if (!key || !gameStateStore.relationships?.[key]) return;
  const npc = gameStateStore.relationships[key];
  if (!npc.属性) (npc as any).属性 = {};
  (npc.属性 as any)[statKey] = {
    当前: Math.max(0, Math.round(curValue)),
    上限: Math.max(1, Math.round(maxValue)),
  };
  selectedPerson.value = { ...gameStateStore.relationships[key] };
  await gameStateStore.saveGame();
  uiStore.showToast(`已更新 ${statKey}`, { type: 'success' });
};

const updateLifespanMax = async (value: number) => {
  const key = getNpcStoreKey();
  if (!key || !gameStateStore.relationships?.[key]) return;
  const npc = gameStateStore.relationships[key];
  if (!npc.属性) (npc as any).属性 = {};
  npc.属性.寿元上限 = Math.max(1, Math.round(value));
  selectedPerson.value = { ...gameStateStore.relationships[key] };
  await gameStateStore.saveGame();
  uiStore.showToast('已更新寿元上限', { type: 'success' });
};

// 货币编辑
const updateCurrency = async (tier: string, value: number) => {
  const key = getNpcStoreKey();
  if (!key || !gameStateStore.relationships?.[key]) return;
  const npc = gameStateStore.relationships[key];
  if (!npc.背包) (npc as any).背包 = { 金钱: {}, 物品: {} };
  if (!npc.背包.金钱) (npc.背包 as any).金钱 = { 现金: 0, 铜: 0, 银: 0, 金: 0 };
  (npc.背包.金钱 as any)[tier] = Math.max(0, Math.round(value));
  selectedPerson.value = { ...gameStateStore.relationships[key] };
  await gameStateStore.saveGame();
  uiStore.showToast(`已更新 ${tier}`, { type: 'success' });
};

// 新增物品
const addItemToNpc = async () => {
  const key = getNpcStoreKey();
  if (!key || !gameStateStore.relationships?.[key]) return;
  const { 名称, 类型, 品质, 数量, 描述 } = newItemForm.value;
  if (!名称.trim()) {
    uiStore.showToast('物品名称不能为空', { type: 'error' });
    return;
  }
  const npc = gameStateStore.relationships[key];
  if (!npc.背包) (npc as any).背包 = { 金钱: {}, 物品: {} };
  if (!npc.背包.物品) npc.背包.物品 = {};
  const itemId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  npc.背包.物品[itemId] = {
    名称: 名称.trim(),
    类型: 类型 as any,
    数量: Math.max(1, 数量),
    描述: 描述.trim() || undefined,
    品质: 品质 ? { quality: 品质 } : undefined,
  } as any;
  selectedPerson.value = { ...gameStateStore.relationships[key] };
  await gameStateStore.saveGame();
  showAddItemModal.value = false;
  newItemForm.value = { 名称: '', 类型: '其他', 品质: '', 数量: 1, 描述: '' };
  uiStore.showToast(`已添加物品: ${名称.trim()}`, { type: 'success' });
};

// 删除物品
const deleteNpcItem = async (itemId: string) => {
  const key = getNpcStoreKey();
  if (!key || !gameStateStore.relationships?.[key]) return;
  const npc = gameStateStore.relationships[key];
  if (!npc.背包?.物品?.[itemId]) return;
  const itemName = npc.背包.物品[itemId].名称 || itemId;
  delete npc.背包.物品[itemId];
  selectedPerson.value = { ...gameStateStore.relationships[key] };
  await gameStateStore.saveGame();
  uiStore.showToast(`已删除物品: ${itemName}`, { type: 'success' });
};

// NSFW: 创建空白私密信息模板
const createBlankPrivacyProfile = async () => {
  const key = getNpcStoreKey();
  if (!key || !gameStateStore.relationships?.[key]) return;
  const npc = gameStateStore.relationships[key];
  (npc as any).私密信息 = {
    是否为处女: true,
    身体部位: [],
    性格倾向: '',
    性取向: '',
    性癖好: [],
    性渴望程度: 0,
    当前性状态: '正常',
    体液分泌状态: '正常',
    性交总次数: 0,
    性伴侣名单: [],
    最近一次性行为时间: '',
    特殊体质: [],
  } as PrivacyProfile;
  selectedPerson.value = { ...gameStateStore.relationships[key] };
  await gameStateStore.saveGame();
  uiStore.showToast('已创建私密信息模板', { type: 'success' });
};

// NSFW: 新增/删除身体部位
const addBodyPart = async (partName: string) => {
  if (!partName.trim()) return;
  const key = getNpcStoreKey();
  if (!key || !gameStateStore.relationships?.[key]) return;
  const npc = gameStateStore.relationships[key];
  if (!npc.私密信息) return;
  if (!Array.isArray(npc.私密信息.身体部位)) npc.私密信息.身体部位 = [];
  npc.私密信息.身体部位.push({
    部位名称: partName.trim(),
    敏感度: 0,
    开发度: 0,
    特征描述: '',
  });
  selectedPerson.value = { ...gameStateStore.relationships[key] };
  await gameStateStore.saveGame();
  uiStore.showToast(`已添加身体部位: ${partName.trim()}`, { type: 'success' });
};

const removeBodyPart = async (index: number) => {
  const key = getNpcStoreKey();
  if (!key || !gameStateStore.relationships?.[key]) return;
  const npc = gameStateStore.relationships[key];
  if (!Array.isArray(npc.私密信息?.身体部位)) return;
  const parts = npc.私密信息!.身体部位;
  const removed = parts.splice(index, 1)[0];
  selectedPerson.value = { ...gameStateStore.relationships![key] };
  await gameStateStore.saveGame();
  uiStore.showToast(`已删除身体部位: ${removed?.部位名称 || ''}`, { type: 'success' });
};

// NPC 创建
const generateNpcTemplate = (): NpcProfile => {
  const gameTime = (characterData.value as any)?.元数据?.时间;
  const birthYear = (gameTime?.年 ?? 2000) - 25;
  const playerLoc = (characterData.value as any)?.角色?.身份?.位置?.描述 || (gameStateStore as any).location?.描述 || '未知';

  return {
    名字: '',
    性别: '男',
    出生日期: { 年: birthYear, 月: 1, 日: 1 },
    种族: '人族',
    出生: '普通人',
    外貌描述: '',
    性格特征: [],
    地位: { 名称: '还未揭露', 描述: '' },
    特质: '',
    先天六维属性: { 体质: 5, 直觉: 5, 悟性: 5, 气运: 5, 魅力: 5, 心性: 5 } as any,
    属性: {
      体力: { 当前: 100, 上限: 100 },
      精力: { 当前: 100, 上限: 100 },
      寿元上限: 80,
    },
    与玩家关系: '陌生人',
    类型: '重点',
    好感度: 0,
    当前位置: { 描述: playerLoc },
    人格底线: [],
    记忆: [],
    记忆总结: [],
    当前外貌状态: '神态自然',
    当前内心想法: '...',
    背包: { 金钱: { 现金: 0, 铜: 0, 银: 0, 金: 0 } as any, 物品: {} },
    实时关注: false,
    心跳锁定: false,
    势力归属: '',
  } as NpcProfile;
};

const createNewNpc = async () => {
  const name = window.prompt('请输入新人物的名字：');
  if (!name || !name.trim()) return;

  const template = generateNpcTemplate();
  template.名字 = name.trim();

  // 检查是否已存在
  if (gameStateStore.relationships?.[name.trim()]) {
    uiStore.showToast(`人物 "${name.trim()}" 已存在`, { type: 'error' });
    return;
  }

  if (!gameStateStore.relationships) {
    (gameStateStore as any).relationships = {};
  }
  gameStateStore.relationships![name.trim()] = template as any;

  // 地图联动
  const saveData = gameStateStore.toSaveData() as Record<string, unknown>;
  const locDesc = template.当前位置?.描述;
  if (locDesc) {
    ensureLocationExists(saveData, locDesc);
    appendNpcsToLocation(saveData, locDesc, [name.trim()]);
    const worldInfo = (saveData as any)?.世界?.信息;
    if (worldInfo) gameStateStore.worldInfo = worldInfo;
  }

  await gameStateStore.saveGame();
  selectedPerson.value = { ...template };
  isDetailViewActive.value = true;
  uiStore.showToast(`已创建新人物: ${name.trim()}`, { type: 'success' });
};

// AI完善NPC
const refineNpcWithAI = async () => {
  if (!selectedPerson.value || isRefiningNpc.value) return;
  const npcName = selectedPerson.value.名字;

  isRefiningNpc.value = true;
  uiStore.showToast(`正在用AI完善 ${npcName}...`, { type: 'info' });

  try {
    // 使用通用 action 执行心跳并同步
    const result = await gameStateStore.performHeartbeat({
      triggerMode: '手动',
      candidateNames: [npcName],
    });

    if (!result.success) {
      uiStore.showToast(`AI完善失败: ${result.message}`, { type: 'error' });
      return;
    }

    // 验证返回数据 (record.快照 包含更新前的，但我们需要更新后的数据来校验?
    // performHeartbeat 已经同步到 store 了，所以我们可以直接从 store 取)

    // 注意：performHeartbeat 返回的 record.快照 是更新前的。
    // 我们需要检查 store 里的新数据。
    const key = findRelationshipKeyByName(npcName);
    const updatedNpc = gameStateStore.relationships?.[key];
    if (updatedNpc) {
      // 校验格式
      try {
        const [isValid] = validateAndRepairNpcProfile(updatedNpc);
        if (!isValid) {
          console.warn('[AI完善] 数据校验不通过，但已自动应用');
        }
      } catch (e) {
        console.warn('[AI完善] 数据校验警告:', e);
      }

      selectedPerson.value = { ...updatedNpc };
      uiStore.showToast(`AI已完善 ${npcName}`, { type: 'success' });
    } else {
       // Should not happen if success
       selectedPerson.value = { ...gameStateStore.relationships![key] };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : '未知错误';
    uiStore.showToast(`AI完善失败: ${msg}`, { type: 'error' });
    console.error('[AI完善]', error);
  } finally {
    isRefiningNpc.value = false;
  }
};

// 编辑中的 list 新增临时输入值
const newListItemInput = ref('');

// Tab管理
const activeTab = ref('basic');
const tabs = computed(() => {
  const baseTabs = [
    { id: 'basic', label: '基本信息', icon: '📋' },
    { id: 'status', label: '实时状态', icon: '💭' },
    { id: 'activity', label: '在做事项', icon: '📌' },
  ];

  if (isTavernEnvFlag.value) {
    baseTabs.push({ id: 'nsfw', label: '私密信息', icon: '🔞' });
  }

  // 添加记忆档案tab
  baseTabs.push({ id: 'memory', label: '记忆档案', icon: '📝' });

  // 添加背包tab
  baseTabs.push({ id: 'inventory', label: '背包', icon: '🎒' });

  // 添加原始数据tab
  baseTabs.push({ id: 'raw', label: '原始数据(JSON)', icon: '🔧' });

  return baseTabs;
});

// 记忆总结状态
const isSummarizing = ref(false);
// 要总结的记忆条数（从最旧开始）
const memoriesToSummarize = ref(10);

// 记忆分页相关
const memoryPageSize = ref(5); // 每页显示的记忆数量
const currentMemoryPage = ref(1); // 当前页码
const jumpToPageInput = ref<number | null>(null); // 跳转页码输入

// 计算分页后的记忆
const paginatedMemory = computed(() => {
  if (!selectedPerson.value?.记忆?.length) return [];
  const memories = selectedPerson.value.记忆;
  const startIndex = (currentMemoryPage.value - 1) * memoryPageSize.value;
  const endIndex = startIndex + memoryPageSize.value;
  return memories.slice(startIndex, endIndex);
});

// 计算总页数
const totalMemoryPages = computed(() => {
  if (!selectedPerson.value?.记忆?.length) return 0;
  return Math.ceil(selectedPerson.value.记忆.length / memoryPageSize.value);
});

// 切换记忆页面
const goToMemoryPage = (page: number) => {
  if (page >= 1 && page <= totalMemoryPages.value) {
    currentMemoryPage.value = page;
  }
};

// 跳转到指定页
const jumpToSpecificPage = () => {
  if (jumpToPageInput.value && jumpToPageInput.value >= 1 && jumpToPageInput.value <= totalMemoryPages.value) {
    currentMemoryPage.value = jumpToPageInput.value;
    jumpToPageInput.value = null; // 清空输入
  }
};

// 重置分页状态当选择新人物时
const resetMemoryPagination = () => {
  currentMemoryPage.value = 1;
};


const npcInnateAttrs = (npc: NpcProfile): Record<string, number> => {
  const raw = (npc as any).先天六维属性 ?? (npc as any).先天六司;
  return raw && typeof raw === 'object' ? raw : {};
};

const getNpcRealm = (npc: NpcProfile): string => {
  const realmField = (npc as any).地位 ?? (npc as any).境界;
  if (!realmField) return '还未揭露';

  if (typeof realmField === 'object' && realmField !== null) {
    return realmField.名称 || '还未揭露';
  }

  if (typeof realmField === 'string') {
    return realmField;
  }

  return '还未揭露';
};

// 获取NPC特质信息
const getNpcSpiritRoot = (npc: NpcProfile): string => {
  return formatSpiritRoot((npc as any).特质 ?? (npc as any).灵根);
};

// 获取NPC出生信息
const getNpcOrigin = (origin: string | { 名称?: string; 描述?: string; name?: string; description?: string } | undefined): string => {
  if (!origin) return '未知';
  if (typeof origin === 'string') return origin;
  if (typeof origin === 'object') {
    return origin.描述 || origin.description || origin.名称 || origin.name || '未知';
  }
  return '未知';
};

const CURRENCY_TIERS = ['现金', '铜', '银', '金'] as const;
const LEGACY_CURRENCY_MAP: Record<string, string> = { 下品: '现金', 中品: '铜', 上品: '银', 极品: '金' };
const getNpcCurrencyTier = (npc: NpcProfile, tier: string): number => {
  const bag = npc.背包?.金钱 ?? (npc.背包 as any)?.灵石;
  if (!bag || typeof bag !== 'object') return 0;
  const key = LEGACY_CURRENCY_MAP[tier] ?? tier;
  return Number((bag as Record<string, unknown>)[key] ?? (bag as Record<string, unknown>)[tier] ?? 0) || 0;
};

const toFiniteNumber = (value: unknown): number | null => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

type NpcCoreStatKey = '体力' | '精力' | '神识' | '洞察力' | '气血' | '灵气';

const getNpcStatPair = (npc: NpcProfile, key: NpcCoreStatKey): { current: number | null; max: number | null } => {
  const attrs = (npc as any)?.属性;
  let raw: unknown = attrs?.[key];
  if (key === '体力') raw = attrs?.体力 ?? attrs?.气血;
  else if (key === '精力') raw = attrs?.精力 ?? attrs?.灵气;
  else if (key === '洞察力') raw = attrs?.洞察力 ?? attrs?.神识;
  if (!raw || typeof raw !== 'object') {
    return { current: null, max: null };
  }
  const current = toFiniteNumber((raw as any).当前 ?? (raw as any).current);
  const max = toFiniteNumber((raw as any).上限 ?? (raw as any).max);
  return { current, max };
};

const formatNpcStatPair = (npc: NpcProfile, key: string): string => {
  const { current, max } = getNpcStatPair(npc, key as NpcCoreStatKey);
  if (current === null && max === null) return '--';
  if (current === null) return `--/${max}`;
  if (max === null) return `${current}/--`;
  return `${current}/${max}`;
};

const getNpcLifespanMax = (npc: NpcProfile): number | null => {
  const raw = (npc as any)?.属性?.寿元上限 ?? (npc as any)?.寿元上限 ?? (npc as any)?.寿命?.上限;
  return toFiniteNumber(raw);
};



const getNpcStatCurrent = (npc: NpcProfile, key: string): number => {
  return getNpcStatPair(npc, key as NpcCoreStatKey).current ?? 0;
};

const getNpcStatMax = (npc: NpcProfile, key: string): number => {
  return getNpcStatPair(npc, key as NpcCoreStatKey).max ?? 0;
};

const hasNpcStatPair = (npc: NpcProfile, key: NpcCoreStatKey): boolean => {
  const pair = getNpcStatPair(npc, key);
  return pair.current !== null || pair.max !== null;
};

const hasNpcCoreStats = (npc: NpcProfile): boolean => {
  return hasNpcStatPair(npc, '体力') || hasNpcStatPair(npc, '精力') || hasNpcStatPair(npc, '洞察力') || getNpcLifespanMax(npc) !== null;
};

// 获取NPC最近三条记忆
const getNpcRecentMemories = (npc: NpcProfile): string[] => {
  if (!npc.记忆) return [];

  // 如果记忆是数组格式
  if (Array.isArray(npc.记忆)) {
    return npc.记忆
      .slice(-3)
      .reverse()
      .map(m => {
        if (typeof m === 'string') return m;
        if (typeof m === 'object' && m.事件) return m.事件;
        return '';
      })
      .filter(m => m.length > 0);
  }

  return [];
};

// 格式化特质品级显示
const formatSpiritRootTier = (tier: unknown): string => {
  if (!tier) return '';
  if (typeof tier === 'string') return tier;
  if (typeof tier === 'object') {
    const tierObj = tier as Record<string, unknown>;
    const qualityValue =
      tierObj.quality ?? tierObj.品质 ?? tierObj.品级 ?? tierObj.quality_name ?? tierObj.name ?? tierObj.名称;
    const gradeValue = tierObj.grade ?? tierObj.阶 ?? tierObj.等级 ?? tierObj.level;
    const rawQuality = typeof qualityValue === 'string' ? qualityValue.trim() : '';
    const cleaned = rawQuality ? rawQuality.replace(/\d+/g, '').replace(/[阶品级]/g, '').trim() : '';
    const grade =
      typeof gradeValue === 'number' || typeof gradeValue === 'string'
        ? String(gradeValue).trim()
        : '';
    if (cleaned) {
      const qualityLabel = cleaned.endsWith('品级') ? cleaned : `${cleaned}品质`;
      const gradeSuffix = grade ? `${grade}阶` : '';
      return `${qualityLabel}${gradeSuffix}`.trim();
    }
  }
  return '';
};

// 格式化特质显示
const formatSpiritRoot = (spiritRoot: string | SpiritRoot | { 名称?: string; 品级?: string; 描述?: string } | undefined): string => {
  if (!spiritRoot) return '未知';
  if (typeof spiritRoot === 'string') return spiritRoot;
  // ????????
  if (typeof spiritRoot === 'object') {
    const typedSpiritRoot = spiritRoot as {
      name?: string;
      名称?: string;
      tier?: unknown;
      品级?: unknown;
      quality?: unknown;
      grade?: unknown;
    };
    const nameValue = typedSpiritRoot.name || typedSpiritRoot.名称;
    const tier = formatSpiritRootTier(
      typedSpiritRoot.tier ?? typedSpiritRoot.品级 ?? typedSpiritRoot.quality ?? typedSpiritRoot.grade
    );
    if (nameValue && tier) {
      return `${nameValue}(${tier})`;
    }
    if (nameValue) {
      return `${nameValue}(未知品级)`;
    }
    if (tier) {
      return tier;
    }
  }
  return '格式错误';
};

// 计算NPC年龄
const getNpcAge = (npc: NpcProfile | null): string => {
  const gameTime = (characterData.value as any)?.元数据?.时间;
  if (!npc || !npc.出生日期 || !gameTime) {
    return '未知';
  }
  const birthYear = npc.出生日期.年;
  const currentYear = gameTime.年;
  const age = currentYear - birthYear;
  return age > 0 ? `${age}岁` : '1岁以内';
};

const getNpcAgeValue = (npc: NpcProfile | null): number | null => {
  if (!npc) return null;
  const ageText = getNpcAge(npc);
  if (!ageText || ageText === '未知') return null;
  const match = ageText.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatNpcLifespan = (npc: NpcProfile): string => {
  const current = getNpcAgeValue(npc);
  const max = getNpcLifespanMax(npc);
  if (current === null && max === null) return '--';
  if (current === null) return `--/${max}`;
  if (max === null) return `${current}/--`;
  return `${current}/${max}`;
};

const getNpcStatPercentage = (npc: NpcProfile, key: string): number => {
  const { current, max } = getNpcStatPair(npc, key as NpcCoreStatKey);
  if (current === null || max === null || max === 0) return 0;
  return Math.min(100, Math.round((current / max) * 100));
};

const getNpcLifespanPercentage = (npc: NpcProfile): number => {
  const current = getNpcAgeValue(npc);
  const max = getNpcLifespanMax(npc);
  if (current === null || max === null || max === 0) return 0;
  return Math.min(100, Math.round((current / max) * 100));
};

const relationshipStats = computed(() => {
  const raw = (characterData.value as any)?.社交?.关系;
  if (!raw || typeof raw !== 'object') {
    return { total: 0, valid: 0, invalid: 0, list: [] as NpcProfile[] };
  }

  const entries = Object.entries(raw as Record<string, unknown>).filter(([key]) => !key.startsWith('_'));
  const total = entries.length;
  const list: NpcProfile[] = [];
  let invalid = 0;

  for (const [key, value] of entries) {
    if (!value || typeof value !== 'object') {
      invalid += 1;
      continue;
    }

    const npc = value as any;
    // 过滤掉普通 NPC，除非被实时关注
    if (npc.类型 === '普通' && !npc.实时关注) continue;
    const nameFromValue = typeof npc.名字 === 'string' ? npc.名字.trim() : '';
    const nameFromKey = typeof key === 'string' ? key.trim() : '';
    const finalName = nameFromValue || nameFromKey;
    if (!finalName) {
      invalid += 1;
      continue;
    }

    list.push({ ...npc, 名字: finalName } as NpcProfile);
  }

  return { total, valid: list.length, invalid, list };
});

const relationships = computed<NpcProfile[]>(() => relationshipStats.value.list);

// 过滤后的关系列表（只保留搜索功能）
const filteredRelationships = computed<NpcProfile[]>(() => {
  let filtered = [...relationships.value];

  // 搜索过滤
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(person =>
      person.名字.toLowerCase().includes(query) ||
      (person.与玩家关系 || '').toLowerCase().includes(query)
    );
  }

  // 按好感度排序
  return filtered.sort((a, b) => (b.好感度 || 0) - (a.好感度 || 0));
});

// 工具函数
const getIntimacyLevel = (intimacy: number | undefined): string => {
  const value = intimacy || 0;
  if (value >= 80) return 'high';
  if (value >= 60) return 'good';
  if (value >= 40) return 'medium';
  if (value >= 20) return 'low';
  if (value >= 0) return 'neutral';
  if (value >= -20) return 'dislike';
  if (value >= -40) return 'hostile';
  return 'enemy';
};

const getIntimacyClass = (intimacy: number | undefined): string => {
  return `intimacy-${getIntimacyLevel(intimacy)}`;
};

const selectPerson = (person: NpcProfile) => {
  const isNewSelection = selectedPerson.value?.名字 !== person.名字;

  // 🔧 数据规范化：确保记忆总结是数组
  if (person && person.记忆总结) {
    if (typeof person.记忆总结 === 'string') {
      // 如果是字符串，转换为数组
      person.记忆总结 = [person.记忆总结];
    } else if (!Array.isArray(person.记忆总结)) {
      // 如果既不是字符串也不是数组，设为空数组
      person.记忆总结 = [];
    }
  }

  selectedPerson.value = selectedPerson.value?.名字 === person.名字
    ? null
    : person;

  // 如果选择了新的人物，重置记忆分页和tab
  if (isNewSelection && selectedPerson.value) {
    resetMemoryPagination();
    activeTab.value = 'basic';
  }

  if (selectedPerson.value) {
    isDetailViewActive.value = true;
  } else {
    isDetailViewActive.value = false;
  }
};

watch(selectedPerson, (newPerson) => {
  if (newPerson) {
    resetMemoryPagination();
  }
});

onMounted(async () => {
  console.log('[人脉系统] 人物关系面板已载入，开始同步数据');
  isLoading.value = true;
  try {
    // 默认选择第一个人物
    if (filteredRelationships.value.length > 0) {
      selectedPerson.value = filteredRelationships.value[0];
    }
  } catch (error) {
    console.error('[人脉系统] 同步数据失败:', error);
    uiStore.showToast('人脉数据同步失败', { type: 'error' });
  } finally {
    isLoading.value = false;
  }
});
// -- 记忆编辑与删除 --
const findRelationshipKeyByName = (name: string): string | null => {
  const relations = (characterData.value as any)?.社交?.关系;
  if (!relations) return null;
  return Object.keys(relations).find(key => relations[key]?.名字 === name) || null;
};

const editMemory = async (index: number) => {
  if (!selectedPerson.value) return;
  const name = selectedPerson.value.名字;
  const key = findRelationshipKeyByName(name);
  if (!key) return;

  // 🔴 修复：直接从 gameStateStore.relationships 获取记忆
  if (!gameStateStore.relationships?.[key]?.记忆) return;

  const current = gameStateStore.relationships[key].记忆[index];

  // 新格式：字符串记忆
  if (typeof current === 'string') {
    const newEvent = window.prompt('编辑记忆内容', current);
    if (newEvent === null || newEvent.trim() === '') return;

    // 🔴 修复：直接修改 gameStateStore.relationships
    gameStateStore.relationships[key].记忆[index] = newEvent.trim();
    selectedPerson.value = { ...gameStateStore.relationships[key] };

    await gameStateStore.saveGame();
    uiStore.showToast('记忆已更新', { type: 'success' });
    return;
  }

  // 旧格式兼容：对象记忆
  if (current && typeof current === 'object') {
    const currentTime = (current as { 时间?: string }).时间 || '未知时间';
    const currentEvent = (current as { 事件?: string }).事件 || '';

    const newTime = window.prompt('编辑记忆时间', currentTime);
    if (newTime === null) return;

    const newEvent = window.prompt('编辑记忆事件', currentEvent);
    if (newEvent === null) return;

    // 🔴 修复：直接修改 gameStateStore.relationships
    gameStateStore.relationships[key].记忆[index] = {
      时间: newTime.trim(),
      事件: newEvent.trim()
    };

    selectedPerson.value = { ...gameStateStore.relationships[key] };

    await gameStateStore.saveGame();
    uiStore.showToast('记忆已更新', { type: 'success' });
  }
};

const deleteMemory = async (index: number) => {
  if (!selectedPerson.value) return;
  uiStore.showRetryDialog({
    title: '删除记忆',
    message: '确定要删除这条记忆吗？',
    confirmText: '删除',
    cancelText: '取消',
    onConfirm: async () => {
      const name = selectedPerson.value!.名字;
      const key = findRelationshipKeyByName(name);
      if (!key) return;

      // 🔴 修复：直接修改 gameStateStore.relationships，而不是 characterData
      if (!gameStateStore.relationships?.[key]?.记忆) return;

      // 删除记忆
      gameStateStore.relationships[key].记忆.splice(index, 1);

      // 更新选中的人物
      selectedPerson.value = { ...gameStateStore.relationships[key] };

      // 保存到数据库
      await gameStateStore.saveGame();

      uiStore.showToast('记忆已删除', { type: 'success' });
    },
    onCancel: () => {}
  });
};

// NPC物品相关函数
const hasNpcItems = (person: NpcProfile): boolean => {
  const items = person.背包?.物品;
  return items ? Object.keys(items).length > 0 : false;
};

const getItemQualityClass = (quality?: string): string => {
  if (!quality) return 'quality-unknown';
  return `quality-${quality.toLowerCase()}`;
};

const getGradeText = (grade?: number): string => {
  if (grade === undefined || grade === null) return '';
  if (grade === 0) return '残缺';
  if (grade >= 1 && grade <= 3) return '下品';
  if (grade >= 4 && grade <= 6) return '中品';
  if (grade >= 7 && grade <= 9) return '上品';
  if (grade === 10) return '极品';
  return '';
};

const initiateTradeWithNpc = (npc: NpcProfile, item: Item) => {
  const actionDescription = `尝试与 ${npc.名字} 交易 ${item.名称}`;
  actionQueue.addAction({
    type: 'npc_trade',
    itemName: item.名称,
    itemType: 'NPC交易',
    description: actionDescription,
    npcName: npc.名字,
    itemId: item.物品ID || item.名称,
    tradeType: 'trade'
  });
  uiStore.showToast(`已将与 ${npc.名字} 的交易请求加入动作队列`, { type: 'success' });
};

// 向NPC索要物品
const requestItemFromNpc = (npc: NpcProfile, item: Item) => {
  const actionDescription = `向 ${npc.名字} 索要 ${item.名称}`;
  actionQueue.addAction({
    type: 'npc_request',
    itemName: item.名称,
    itemType: 'NPC索要',
    description: actionDescription,
    npcName: npc.名字,
    itemId: item.物品ID || item.名称,
    tradeType: 'request'
  });
  uiStore.showToast(`已将向 ${npc.名字} 索要物品的请求加入动作队列`, { type: 'success' });
};

// 切换NPC关注状态
const toggleAttention = async (person: NpcProfile) => {
  console.log('[关注按钮] 点击了关注按钮，人物:', person.名字);
  const npcName = person.名字;

  try {
    // 🔥 直接访问 gameStateStore 的响应式数据，而不是副本
    const relationships = gameStateStore.relationships;
    if (!relationships) {
      uiStore.showToast('人物关系数据不存在', { type: 'error' });
      return;
    }

    const npcKey = Object.keys(relationships).find(
      key => relationships[key]?.名字 === npcName
    );

    if (!npcKey) {
      uiStore.showToast(`找不到名为 ${npcName} 的人物`, { type: 'error' });
      return;
    }

    // 直接修改 gameStateStore.relationships（响应式数据）
    const npcProfile = relationships[npcKey];
    const newState = !(npcProfile.实时关注 || false);
    npcProfile.实时关注 = newState;

    console.log('[关注按钮] 切换状态:', newState, '保存前的数据:', npcProfile.实时关注);

    // 通过 gameStateStore 保存，这将处理所有持久化逻辑
    await gameStateStore.saveGame();

    console.log('[关注按钮] 保存完成');

    uiStore.showToast(newState ? `已关注 ${npcName}` : `已取消关注 ${npcName}`, { type: 'success' });

    // 强制更新选中的人物（触发响应式）
    if (selectedPerson.value?.名字 === npcName) {
      selectedPerson.value = { ...relationships[npcKey] };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    uiStore.showToast(`操作失败: ${errorMsg}`, { type: 'error' });
    console.error('[关注按钮] 错误:', error);
  }
};

// 检查NPC是否被关注
const isAttentionEnabled = (person: NpcProfile): boolean => {
  return person.实时关注 || false;
};

// 切换心跳锁定（锁定后该 NPC 不参与世界心跳更新）
const toggleHeartbeatLock = async (person: NpcProfile) => {
  const npcName = person.名字;
  try {
    const relationships = gameStateStore.relationships;
    if (!relationships) {
      uiStore.showToast('人物关系数据不存在', { type: 'error' });
      return;
    }
    const npcKey = Object.keys(relationships).find(key => relationships[key]?.名字 === npcName);
    if (!npcKey) {
      uiStore.showToast(`找不到名为 ${npcName} 的人物`, { type: 'error' });
      return;
    }
    const npcProfile = relationships[npcKey];
    const newLocked = !(npcProfile.心跳锁定 || false);
    npcProfile.心跳锁定 = newLocked;
    await gameStateStore.saveGame();
    uiStore.showToast(newLocked ? `已锁定 ${npcName} 的心跳更新` : `已解锁 ${npcName} 的心跳更新`, { type: 'success' });
    if (selectedPerson.value?.名字 === npcName) {
      selectedPerson.value = { ...relationships[npcKey] };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : '未知错误';
    uiStore.showToast(`操作失败: ${msg}`, { type: 'error' });
    console.error('[心跳锁定]', error);
  }
};

const isHeartbeatLocked = (person: NpcProfile): boolean => {
  return person.心跳锁定 || false;
};

// 尝试从NPC身上偷窃物品
const attemptStealFromNpc = (npc: NpcProfile, item: Item) => {
  const actionDescription = `尝试从 ${npc.名字} 身上偷取 ${item.名称}`;
  actionQueue.addAction({
    type: 'npc_steal',
    itemName: item.名称,
    itemType: 'NPC偷窃',
    description: actionDescription,
    npcName: npc.名字,
    itemId: item.物品ID || item.名称,
    tradeType: 'steal'
  });
  uiStore.showToast(`已将偷窃 ${npc.名字} 物品的计划加入动作队列`, { type: 'success' });
};

// 总结NPC记忆
const summarizeMemories = async () => {
  if (!selectedPerson.value) return;
  const npcName = selectedPerson.value.名字;
  isSummarizing.value = true;

  try {
    const memories = selectedPerson.value.记忆 || [];
    if (memories.length < 3) {
      uiStore.showToast('至少需要3条记忆才能进行总结', { type: 'warning' });
      return;
    }

    const countToSummarize = Math.min(
      Math.max(3, memoriesToSummarize.value || 10),
      memories.length
    );

    // 提取最旧的N条记忆
    const memoriesToSummarizeList = memories.slice(0, countToSummarize);
    const remainingMemories = memories.slice(countToSummarize);

    // 构建AI提示词 - 使用标准JSON格式
    const memoriesText = memoriesToSummarizeList.map((m, i) => `${i + 1}. ${m}`).join('\n');

    // 🔥 获取精简版游戏存档数据（只包含NPC记忆总结需要的信息）
    const saveData = gameStateStore.toSaveData();
    const simplifiedSaveData = extractEssentialDataForNPCSummary(saveData);
    const saveDataJson = JSON.stringify(simplifiedSaveData, null, 2);


    const userPrompt = `这是一个纯粹的文本总结任务，不是游戏对话。请严格按照以下记忆内容进行总结，不要编造新内容。

【待总结的记忆内容】：
${memoriesText}

现在请严格根据上述记忆内容进行总结，不要偏离。游戏存档数据仅供参考，帮助你理解背景。`;

    uiStore.showToast('正在调用AI总结记忆...', { type: 'info' });

    const tavernHelper = (await import('@/utils/tavern')).getTavernHelper();
    if (!tavernHelper) {
      throw new Error('TavernHelper 未初始化');
    }

    // 读取记忆配置（和玩家记忆总结使用相同的配置）
    let useRawMode = true; // 默认使用Raw模式（推荐）
    let useStreaming = false; // 默认使用非流式传输
    try {
      const memorySettings = localStorage.getItem('memory-settings');
      if (memorySettings) {
        const settings = JSON.parse(memorySettings);
        useRawMode = settings.useRawMode !== false; // 默认true
        useStreaming = settings.useStreaming === true; // 默认false
      }
    } catch (error) {
      console.warn('[NPC记忆总结] 读取配置失败，使用默认值:', error);
    }

    console.log(`[NPC记忆总结] ${npcName} - 模式: ${useRawMode ? 'Raw模式（纯净总结）' : '标准模式（推荐）'}, 传输: ${useStreaming ? '流式' : '非流式'}`);

    let response: string;
    if (useRawMode) {
      // Raw模式：分条目发送提示词
      const rawResponse = await tavernHelper.generateRaw({
        ordered_prompts: [
          // 1. 角色定义
          { role: 'system', content: `你是${npcName}的记忆总结助手。这是一个纯文本总结任务，不是游戏对话或故事续写。` },

          // 2. 游戏存档数据
          { role: 'system', content: `【游戏存档数据】（供参考）：\n${saveDataJson}` },

          // 3. 关键约束
          { role: 'system', content: `【关键约束】：\n1. 这不是游戏推进，不要生成新剧情\n2. 这不是对话任务，不要生成角色对话\n3. 只总结用户提供的记忆内容，不要编造\n4. 必须严格基于原文，不要添加原文没有的内容` },

          // 4. 输出格式
          { role: 'system', content: `【输出格式】：\n\`\`\`json\n{"text": "总结内容"}\n\`\`\`` },

          // 5. 总结要求
          { role: 'system', content: `【总结要求】：\n- 第一人称"我"（${npcName}的视角）\n- 150-250字\n- 连贯的现代修仙小说叙述风格\n- 仅输出JSON，不要thinking/commands/options` },

          // 6. 必须保留
          { role: 'system', content: `【必须保留】：\n- 原文中的人名（特别是玩家名字）\n- 原文中的地名\n- 原文中的事件\n- 原文中的物品交换\n- 原文中的情感变化` },

          // 7. 必须忽略
          { role: 'system', content: `【必须忽略】：\n- 对话内容\n- 详细情绪描写\n- 过程细节` },

          // 8. 示例
          { role: 'system', content: `【示例】：\n原文："青云峰遇千夜。他帮我击退魔修。我很感激。他送我聚气丹。我们成为朋友。三天后藏经阁再遇。他求教剑法。我教他基础剑诀。"\n正确："三日前我在青云峰遇到了千夜，当时有魔修来袭，千夜出手相助，我才得以脱险。我很感激他的恩德，于是我们结为道友。千夜还赠予我一枚聚气丹，我们的情谊更加深厚。后来在藏经阁重逢，千夜向我求教剑法，我便传授了他基础剑诀。"\n错误："我继续修炼，又遇到了新的机缘..."（❌ 编造了原文没有的内容）` },

          // 9. 重要提醒
          { role: 'system', content: `【重要提醒】：\n- 不要把这当成游戏对话\n- 不要推进故事\n- 不要编造新内容\n- 严格基于用户提供的记忆进行总结` },

          // 10. 用户输入
          { role: 'user', content: userPrompt },

          // 🛡️ 添加随机前缀（规避内容检测）
          { role: 'user', content: ['Continue.', 'Proceed.', 'Next.', 'Go on.', 'Resume.'][Math.floor(Math.random() * 5)] },

          // 🛡️ 添加assistant角色的占位消息（防止输入截断）
          { role: 'assistant', content: '</input>' }
        ],
        should_stream: useStreaming,
        usageType: 'memory_summary'
      });
      response = String(rawResponse);
    } else {
      // 标准模式（推荐）：合并提示词，减少条目数量
      const systemPromptCombined = `你是${npcName}的记忆总结助手。这是一个纯文本总结任务，不是游戏对话或故事续写。

【游戏存档数据】（供参考）：
${saveDataJson}

【关键约束】：
1. 这不是游戏推进，不要生成新剧情
2. 这不是对话任务，不要生成角色对话
3. 只总结用户提供的记忆内容，不要编造
4. 必须严格基于原文，不要添加原文没有的内容

【输出格式】：
\`\`\`json
{"text": "总结内容"}
\`\`\`

【总结要求】：
- 第一人称"我"（${npcName}的视角）
- 150-250字
- 连贯的现代修仙小说叙述风格
- 仅输出JSON，不要thinking/commands/options

【必须保留】：
- 原文中的人名（特别是玩家名字）
- 原文中的地名
- 原文中的事件
- 原文中的物品交换
- 原文中的情感变化

【必须忽略】：
- 对话内容
- 详细情绪描写
- 过程细节

【示例】：
原文："青云峰遇千夜。他帮我击退魔修。我很感激。他送我聚气丹。我们成为朋友。三天后藏经阁再遇。他求教剑法。我教他基础剑诀。"
正确："三日前我在青云峰遇到了千夜，当时有魔修来袭，千夜出手相助，我才得以脱险。我很感激他的恩德，于是我们结为道友。千夜还赠予我一枚聚气丹，我们的情谊更加深厚。后来在藏经阁重逢，千夜向我求教剑法，我便传授了他基础剑诀。"
错误："我继续修炼，又遇到了新的机缘..."（❌ 编造了原文没有的内容）

【重要提醒】：
- 不要把这当成游戏对话
- 不要推进故事
- 不要编造新内容
- 严格基于用户提供的记忆进行总结`;

      const standardResponse = await tavernHelper.generate({
        user_input: userPrompt,
        should_stream: useStreaming,
        generation_id: `npc_memory_summary_${npcName}_${Date.now()}`,
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

    let summary: string;
    const responseText = String(response).trim();

    const jsonBlockMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch?.[1]) {
      try {
        summary = JSON.parse(jsonBlockMatch[1].trim()).text?.trim() || '';
      } catch {
        summary = '';
      }
    } else {
      try {
        summary = JSON.parse(responseText).text?.trim() || '';
      } catch {
        summary = responseText.trim();
      }
    }

    if (!summary || summary.length === 0) {
      throw new Error('AI返回了空的总结结果');
    }

    // 更新NPC数据
    const currentSaveData = gameStateStore.getCurrentSaveData();
    const relations = (currentSaveData as any)?.社交?.关系;
    if (!relations) {
      throw new Error('社交.关系 数据不存在');
    }

    const npcKey = Object.keys(relations).find(
      key => relations[key]?.名字 === npcName
    );

    if (!npcKey) {
      throw new Error(`找不到名为 ${npcName} 的人物`);
    }

    const npcProfile = relations[npcKey];

    // 添加到记忆总结数组
    if (!npcProfile.记忆总结) {
      npcProfile.记忆总结 = [];
    }
    npcProfile.记忆总结.push(summary.trim());

    // 更新记忆数组（删除已总结的记忆）
    npcProfile.记忆 = remainingMemories;

    // 🔥 先更新Pinia状态
    if (gameStateStore.relationships && gameStateStore.relationships[npcKey]) {
      gameStateStore.relationships[npcKey] = { ...npcProfile };
    }

    // 🔥 然后保存到存档
    await gameStateStore.saveGame();

    // 更新选中的人物（触发UI刷新）
    if (selectedPerson.value?.名字 === npcName) {
      selectedPerson.value = { ...npcProfile };
    }

    uiStore.showToast(`✅ 已成功总结 ${countToSummarize} 条记忆`, { type: 'success' });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    uiStore.showToast(`总结失败: ${errorMsg}`, { type: 'error' });
    console.error(`[RelationshipNetworkPanel] 记忆总结失败:`, error);
  } finally {
    isSummarizing.value = false;
  }
};

/**
 * 下载记忆功能
 * 将当前NPC的所有记忆（包括详细记忆和记忆总结）导出为JSON文件
 */
const downloadMemories = () => {
  if (!selectedPerson.value) {
    uiStore.showToast('未选择人物', { type: 'warning' });
    return;
  }

  try {
    const npcName = selectedPerson.value.名字;
    const memories = {
      人物名称: npcName,
      导出时间: new Date().toLocaleString('zh-CN'),
      详细记忆: selectedPerson.value.记忆 || [],
      记忆总结: selectedPerson.value.记忆总结 || [],
      记忆总数: (selectedPerson.value.记忆?.length || 0) + (selectedPerson.value.记忆总结?.length || 0)
    };

    const blob = new Blob([JSON.stringify(memories, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${npcName}_记忆_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    uiStore.showToast(`✅ 已下载 ${npcName} 的记忆`, { type: 'success' });
  } catch (error) {
    console.error('[下载记忆] 失败:', error);
    uiStore.showToast('下载记忆失败', { type: 'error' });
  }
};

/**
 * 下载完整人物数据
 * 导出当前NPC的所有数据（包括基础信息、记忆、背包等）
 */
const downloadCharacterData = () => {
  if (!selectedPerson.value) {
    uiStore.showToast('未选择人物', { type: 'warning' });
    return;
  }

  try {
    const npcName = selectedPerson.value.名字;
    const characterData = {
      导出信息: {
        人物名称: npcName,
        导出时间: new Date().toLocaleString('zh-CN'),
        数据版本: '1.0'
      },
      人物数据: selectedPerson.value
    };

    const blob = new Blob([JSON.stringify(characterData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${npcName}_完整数据_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    uiStore.showToast(`✅ 已下载 ${npcName} 的完整数据`, { type: 'success' });
  } catch (error) {
    console.error('[下载人物数据] 失败:', error);
    uiStore.showToast('下载人物数据失败', { type: 'error' });
  }
};

/**
 * 导出到世界书
 * 将NPC信息添加到游戏内的世界书系统中（不含记忆）
 */
const exportToWorldBook = async () => {
  if (!selectedPerson.value) {
    uiStore.showToast('未选择人物', { type: 'warning' });
    return;
  }

  try {
    const npc = selectedPerson.value;
    const npcName = npc.名字;

    // 获取或创建聊天世界书
    const tavernHelper = (await import('@/utils/tavern')).getTavernHelper();
    if (!tavernHelper) {
      uiStore.showToast(hasNativeTavernFlag.value ? '酒馆助手未初始化' : '当前环境不可用', { type: 'error' });
      return;
    }

    // 获取或创建当前聊天的世界书
    const lorebooks = await tavernHelper.getLorebooks();
    const worldbookName = '仙途_人物';
    if (!lorebooks.includes(worldbookName)) {
      await tavernHelper.createLorebook(worldbookName);
    }

    // 构建世界书条目内容（完整版，排除记忆）
    let entryContent = `# ${npcName}\n\n`;

    // 基础档案
    entryContent += `**基础档案**\n`;
    entryContent += `- 性别：${npc.性别 || '未知'}\n`;
    entryContent += `- 种族：${npc.种族 || '未知'}\n`;
    if (npc.出生日期) {
      const birthDate = npc.出生日期;
      entryContent += `- 出生日期：${birthDate.年}年${birthDate.月}月${birthDate.日}日\n`;
    }
    entryContent += `- 地位：${getNpcRealm(npc)}\n`;
    entryContent += `- ${t('特质')}：${getNpcSpiritRoot(npc)}\n`;
    if (npc.势力归属) entryContent += `- 势力：${npc.势力归属}\n`;
    if (npc.出生) entryContent += `- 出生地：${getNpcOrigin(npc.出生)}\n`;
    if (npc.当前位置?.描述) entryContent += `- 当前位置：${npc.当前位置.描述}\n`;

    // 外貌与性格
    entryContent += `\n**外貌与性格**\n`;
    entryContent += `${npc.外貌描述 || (npc as any).外貌 || '未描述'}\n`;
    if (npc.性格特征 && Array.isArray(npc.性格特征) && npc.性格特征.length > 0) {
      entryContent += `\n**性格特征**\n${npc.性格特征.map(t => `- ${t}`).join('\n')}\n`;
    } else if ((npc as any).性格) {
      entryContent += `\n**性格特点**\n${(npc as any).性格}\n`;
    }

    // 天赋能力
    if (npc.天赋 && Array.isArray(npc.天赋) && npc.天赋.length > 0) {
      entryContent += `\n**天赋能力**\n${npc.天赋.map(t => `- ${getTalentName(t)}${getTalentDescription(t) ? ': ' + getTalentDescription(t) : ''}`).join('\n')}\n`;
    }

    const innate = (npc as any).先天六维属性 ?? (npc as any).先天六司;
    if (innate && typeof innate === 'object') {
      entryContent += `\n**先天六维属性**\n`;
      entryContent += `- 体质：${innate.体质 ?? (innate as any).根骨 ?? 0}\n`;
      entryContent += `- 直觉：${innate.直觉 ?? (innate as any).灵性 ?? 0}\n`;
      entryContent += `- 悟性：${innate.悟性 || 0}\n`;
      entryContent += `- 气运：${innate.气运 || 0}\n`;
      entryContent += `- 魅力：${innate.魅力 || 0}\n`;
      entryContent += `- 心性：${innate.心性 || 0}\n`;
    }

    // 人格底线
    if (npc.人格底线 && Array.isArray(npc.人格底线) && npc.人格底线.length > 0) {
      entryContent += `\n**人格底线**\n${npc.人格底线.map(b => `- ${b}`).join('\n')}\n`;
    } else if (npc.人格底线 && typeof npc.人格底线 === 'string') {
      entryContent += `\n**人格底线**\n${npc.人格底线}\n`;
    }

    // 当前状态（实时）
    entryContent += `\n**当前状态（实时）**\n`;
    if (npc.当前外貌状态) entryContent += `- 外貌状态：${npc.当前外貌状态}\n`;
    if (npc.当前内心想法) entryContent += `- 内心想法：${npc.当前内心想法}\n`;

    // 背包物品
    if (npc.背包?.物品 && Object.keys(npc.背包.物品).length > 0) {
      entryContent += `\n**背包物品**\n`;
      Object.values(npc.背包.物品).forEach((item: Item) => {
        entryContent += `- ${item.名称}`;
        if (item.数量 > 1) entryContent += ` x${item.数量}`;
        if (item.描述) entryContent += `：${item.描述}`;
        entryContent += `\n`;
      });
    }

    const stones = npc.背包?.金钱 ?? (npc.背包 as any)?.灵石;
    if (stones && typeof stones === 'object') {
      const s = stones as Record<string, number>;
      const 现金 = s.现金 ?? s.下品 ?? 0;
      const 铜 = s.铜 ?? s.中品 ?? 0;
      const 银 = s.银 ?? s.上品 ?? 0;
      const 金 = s.金 ?? s.极品 ?? 0;
      const total = 现金 + 铜 + 银 + 金;
      if (total > 0) {
        entryContent += `\n**金钱**\n`;
        if (现金) entryContent += `- 现金：${现金}\n`;
        if (铜) entryContent += `- 铜：${铜}\n`;
        if (银) entryContent += `- 银：${银}\n`;
        if (金) entryContent += `- 金：${金}\n`;
      }
    }

    // 与玩家关系
    entryContent += `\n**与玩家关系**\n`;
    entryContent += `- 关系：${npc.与玩家关系 || '相识'}\n`;
    entryContent += `- 好感度：${npc.好感度 || 0}\n`;

    // 实时关注标记
    if (npc.实时关注) {
      entryContent += `- 实时关注：已启用（AI会主动更新此人物状态）\n`;
    }

    // 构建世界书条目（使用酒馆的WorldbookEntry格式）
    const newEntry = {
      name: npcName,
      enabled: true,
      strategy: {
        type: 'selective' as const,
        keys: [npcName, npc.种族 || '', npc.势力归属 || ''].filter(Boolean),
        keys_secondary: { logic: 'and_any' as const, keys: [] },
        scan_depth: 'same_as_global' as const
      },
      position: {
        type: 'after_character_definition' as const,
        role: 'system' as const,
        depth: 4,
        order: 100
      },
      content: entryContent,
      probability: 100,
      recursion: {
        prevent_incoming: false,
        prevent_outgoing: false,
        delay_until: null
      },
      effect: {
        sticky: null,
        cooldown: null,
        delay: null
      },
      extra: {
        来源: '仙途',
        导出时间: new Date().toLocaleString('zh-CN'),
        人物ID: npcName
      }
    };

    // 创建世界书条目
    await tavernHelper.createLorebookEntries(worldbookName, [newEntry]);

    uiStore.showToast(`✅ 已将 ${npcName} 添加到世界书「${worldbookName}」`, { type: 'success' });
  } catch (error) {
    console.error('[导出世界书] 失败:', error);
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    uiStore.showToast(`导出世界书失败: ${errorMsg}`, { type: 'error' });
  }
};

// 删除NPC
// 获取天赋名称的辅助函数
const getTalentName = (talent: unknown): string => {
  if (typeof talent === 'string') return talent;
  if (typeof talent === 'object' && talent !== null) {
    const t = talent as Record<string, unknown>;
    return String(t['名称'] || t['name'] || '未知天赋');
  }
  return '未知天赋';
};

// 获取天赋描述的辅助函数
const getTalentDescription = (talent: unknown): string => {
  if (typeof talent === 'string') return '';
  if (typeof talent === 'object' && talent !== null) {
    const t = talent as Record<string, unknown>;
    return String(t['描述'] || t['description'] || '');
  }
  return '';
};

// 显示天赋详情
const showTalentDetail = (talent: unknown) => {
  const name = getTalentName(talent);
  const desc = getTalentDescription(talent);
  if (desc) {
    uiStore.showDetailModal({ title: name, content: desc });
  }
};

const confirmDeleteNpc = (person: NpcProfile) => {
  if (!person) return;
  uiStore.showRetryDialog({
    title: '删除人物',
    message: `你确定要从这个世界中永久删除【${person.名字}】吗？此操作无法撤销，所有与该人物相关的数据都将消失。`,
    confirmText: '确认删除',
    cancelText: '取消',
    onConfirm: async () => {
      // 🔥 提前清空选择，避免删除后UI尝试渲染不存在的NPC
      const npcNameToDelete = person.名字;
      const wasSelected = selectedPerson.value?.名字 === npcNameToDelete;

      if (wasSelected) {
        selectedPerson.value = null;
        isDetailViewActive.value = false;
      }

      try {
        // deleteNpc 内部会自动保存到存档
        await characterStore.deleteNpc(npcNameToDelete);
        // 删除成功，无需额外操作（已提前清空选择）
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '未知错误';
        uiStore.showToast(`删除失败: ${errorMsg}`, { type: 'error' });
        console.error('删除NPC失败:', error);

        // 🔥 如果删除失败且之前清空了选择，尝试重新从人物列表中找到该NPC并恢复选择
        // （因为deleteNpc函数会回滚数据）
        if (wasSelected) {
          const restoredNpc = relationships.value.find(npc => npc.名字 === npcNameToDelete);
          if (restoredNpc) {
            selectedPerson.value = restoredNpc;
            isDetailViewActive.value = true;
          }
        }
      }
    },
    onCancel: () => {}
  });
};
</script>

<style scoped>
.raw-data-container {
  background-color: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 1rem;
  max-height: 600px;
  overflow-y: auto;
  font-size: 0.8rem;
}

.raw-data-container pre {
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

.spirit-stones-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
}

.spirit-stone-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: var(--color-surface);
  border-radius: 4px;
  border: 1px solid var(--color-border);
  font-size: 0.85rem;
}

.spirit-stone-item span:first-child {
  color: var(--color-text-secondary);
}

.spirit-stone-item span:last-child {
  font-weight: 600;
  color: var(--color-primary);
}

.relationship-network-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
}

.panel-content {
  flex: 1;
  overflow: hidden;
}

.relationships-container {
  height: 100%;
  display: flex;
  background: var(--color-surface);
  overflow: hidden;
}

.relationship-list {
  width: 280px; /* 窄一点 */
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
}

.list-header {
  padding: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.panel-title {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-primary);
  text-align: center;
}

.search-bar {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.5rem;
}

.search-bar svg {
  color: var(--color-text-secondary);
  margin-right: 0.5rem;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text);
  font-size: 0.875rem;
}

.list-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  text-align: center;
  color: var(--color-text-secondary);
}

.empty-icon {
  opacity: 0.5;
  margin-bottom: 1rem;
}

.empty-text {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.empty-hint {
  font-size: 0.8rem;
  opacity: 0.8;
}

.person-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.person-card {
  display: flex;
  align-items: center;
  padding: 0.75rem; /* 更紧凑 */
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.person-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
  transform: translateY(-1px);
}

.person-card.selected {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1));
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
}

.person-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: white;
  margin-right: 0.75rem;
  flex-shrink: 0;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.avatar-text {
  font-size: 1.2rem;
}

.person-info {
  flex: 1;
  min-width: 0;
}

.person-name {
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.person-meta {
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.relationship-type {
  background: rgba(59, 130, 246, 0.1);
  color: var(--color-primary);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.attention-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(156, 163, 175, 0.1);
  border: 1px solid rgba(156, 163, 175, 0.2);
  padding: 0;
  outline: none;
  position: relative;
  z-index: 100;
  pointer-events: auto;
}

.attention-toggle:hover {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
  transform: scale(1.1);
}

.attention-icon {
  transition: all 0.2s ease;
}

.attention-icon.active {
  color: #22c55e;
}

.attention-icon.inactive {
  color: #9ca3af;
}

.attention-toggle:hover .attention-icon.inactive {
  color: #3b82f6;
}

.attention-toggle:hover .attention-icon.active {
  color: #16a34a;
}

.heartbeat-lock-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}
.heartbeat-lock-toggle:hover {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}
.heartbeat-lock-toggle .lock-icon.locked {
  color: var(--color-warning, #eab308);
}
.heartbeat-lock-toggle .lock-icon.unlocked {
  color: var(--color-text-secondary);
}

.person-realm {
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.person-realm .realm-label {
  margin-right: 0.25rem;
}

.person-realm .realm-value {
  color: var(--color-primary);
  font-weight: 600;
}

.intimacy-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.intimacy-bar {
  flex: 1;
  height: 4px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.intimacy-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.intimacy-high {
  background: linear-gradient(90deg, #22c55e, #16a34a);
}
.intimacy-good {
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
}
.intimacy-medium {
  background: linear-gradient(90deg, #8b5cf6, #7c3aed);
}
.intimacy-low {
  background: linear-gradient(90deg, #f59e0b, #d97706);
}
.intimacy-neutral {
  background: linear-gradient(90deg, #6b7280, #4b5563);
}
.intimacy-dislike {
  background: linear-gradient(90deg, #f97316, #ea580c);
}
.intimacy-hostile {
  background: linear-gradient(90deg, #dc2626, #b91c1c);
}
.intimacy-enemy {
  background: linear-gradient(90deg, #ef4444, #dc2626);
}

.intimacy-value {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  min-width: 30px;
  text-align: right;
}

.npc-core-stats {
  margin-top: 0.5rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem 0.5rem;
  font-size: 0.72rem;
  color: var(--color-text-secondary);
}

.npc-core-stat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(59, 130, 246, 0.06);
  border: 1px solid rgba(59, 130, 246, 0.08);
}

.npc-core-label {
  font-weight: 600;
  color: var(--color-text-secondary);
}

.npc-core-value {
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.arrow-icon {
  color: var(--color-border-hover);
  transition: transform 0.2s;
}

.person-card.selected .arrow-icon {
  transform: rotate(90deg);
  color: var(--color-primary);
}

.relationship-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0; /* 关键修复：允许flex项收缩，防止内容溢出 */
  overflow: hidden; /* 隐藏所有溢出，滚动由子元素处理 */
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.detail-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: white;
  font-size: 1.5rem;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  flex-shrink: 0;
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
}

.detail-info {
  flex: 1;
  min-width: 0; /* 允许flex项收缩，防止长名称撑开容器 */
}

.detail-name {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
  word-break: break-all; /* 强制长名称换行 */
}

.detail-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.relationship-badge,
.intimacy-badge,
.race-badge,
.faction-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.relationship-badge {
  background: rgba(59, 130, 246, 0.1);
  color: var(--color-primary);
}

.race-badge {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.faction-badge {
  background: rgba(168, 85, 247, 0.1);
  color: #a855f7;
  border: 1px solid rgba(168, 85, 247, 0.3);
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  flex: 1; /* 占据剩余空间 */
  min-height: 0; /* 允许收缩 */
  overflow-y: auto; /* 内容溢出时滚动 */
  padding: 1rem;
}

.tab-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.empty-state-small {
  padding: 2rem;
  text-align: center;
  color: var(--color-text-secondary);
  font-style: italic;
}

.detail-section {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1rem;
}

.section-title {
  margin: 0 0 1rem 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

/* NPC核心数值进度条样式 */
.npc-vitals-container {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.npc-vital-row {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.npc-vital-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
}

.npc-vital-name {
  font-weight: 600;
  color: var(--color-text);
}

.npc-vital-nums {
  color: var(--color-text-secondary);
}

.npc-vital-track {
  height: 10px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 5px;
  overflow: hidden;
}

.npc-vital-bar {
  height: 100%;
  border-radius: 5px;
  transition: width 0.3s ease;
}

.npc-vital-bar.red-bar {
  background: linear-gradient(90deg, #ef4444, #f87171);
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
}

.npc-vital-bar.blue-bar {
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
}

.npc-vital-bar.gold-bar {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
}

.npc-vital-bar.purple-bar {
  background: linear-gradient(90deg, #a855f7, #c084fc);
  box-shadow: 0 0 8px rgba(168, 85, 247, 0.4);
}


.info-grid-2col {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.info-value {
  font-size: 0.875rem;
  color: var(--color-text);
  font-weight: 600;
}

.memory-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}

.memory-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.summary-mode-hint {
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: rgba(59, 130, 246, 0.08);
  border-left: 3px solid #3b82f6;
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.summary-mode-hint strong {
  color: var(--color-primary);
  font-weight: 600;
}

.memory-actions-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.memory-count {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  background: rgba(59, 130, 246, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-weight: 500;
}

.memory-controls-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.download-memory-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border: none;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.download-memory-btn:hover {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.summarize-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.summarize-input {
  width: 60px;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 0.75rem;
  text-align: center;
  transition: all 0.2s ease;
}

.summarize-input:focus {
  outline: none;
  border-color: #8b5cf6;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
}

.summarize-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  color: white;
  border: none;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.summarize-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #7c3aed, #6d28d9);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
}

.summarize-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.memory-summary-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.memory-summary-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(124, 58, 237, 0.05));
  border-radius: 8px;
  border-left: 3px solid #8b5cf6;
}

.summary-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.summary-text {
  flex: 1;
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--color-text);
}

.memory-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
  margin-top: 1rem;
}

.pagination-btn {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.5rem 1rem;
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: var(--color-surface);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.pagination-info {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  font-weight: 500;
  text-align: center;
}

.jump-to-page {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.page-input {
  width: 60px;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 0.75rem;
  text-align: center;
  transition: all 0.2s ease;
}

.page-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.jump-btn {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border: none;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.jump-btn:hover {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.memory-summary-section {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(124, 58, 237, 0.08));
  border-left: 4px solid #8b5cf6;
}

.memory-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 0.75rem;
  background: var(--color-surface);
  border-radius: 6px;
  border-left: 3px solid var(--color-primary);
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--color-text-secondary);
}

.memory-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.memory-time {
  font-size: 0.75rem;
  color: var(--color-primary);
  font-weight: 600;
  opacity: 0.8;
}

.memory-event {
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  line-height: 1.5;
}

.memory-actions {
  display: flex;
  gap: 6px;
}

.memory-btn {
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  background: var(--color-background);
}
.memory-btn.edit {
  color: #2563eb;
  border-color: #bfdbfe;
}
.memory-btn.delete {
  color: #dc2626;
  border-color: #fecaca;
}

/* 简化：外貌描述样式 */
.appearance-description {
  padding: 1rem;
  background: rgba(147, 51, 234, 0.05);
  border-radius: 8px;
  border-left: 3px solid #9333ea;
}

.description-text {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--color-text);
  margin: 0;
  font-style: italic;
}

.subsection-title {
  margin: 0 0 0.75rem 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
}

.activity-history-section {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
}

.activity-history-list {
  margin: 0;
  padding-left: 1.25rem;
  list-style: disc;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}

.activity-history-item {
  margin-bottom: 0.25rem;
}

.talents-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.talent-tag {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.1));
  color: #3b82f6;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.attributes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 0.75rem;
}

.attribute-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem;
  background: var(--color-surface);
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.attr-label {
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.25rem;
  font-weight: 500;
}

.attr-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-primary);
}

/* NPC物品样式 */
.npc-inventory {
  margin-top: 0.75rem;
}

.npc-items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 0.75rem;
}

.npc-item-card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.75rem;
  transition: all 0.2s ease;
}

.npc-item-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.npc-item-card.quality-凡 {
  border-left: 3px solid #6b7280;
}

.npc-item-card.quality-黄 {
  border-left: 3px solid #f59e0b;
}

.npc-item-card.quality-玄 {
  border-left: 3px solid #8b5cf6;
}

.npc-item-card.quality-地 {
  border-left: 3px solid #06b6d4;
}

.npc-item-card.quality-天 {
  border-left: 3px solid #ec4899;
}

.npc-item-card.quality-仙 {
  border-left: 3px solid #f59e0b;
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.3);
}

.npc-item-card.quality-神 {
  border-left: 3px solid #9333ea;
  box-shadow: 0 0 15px rgba(147, 51, 234, 0.4);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.item-name {
  font-weight: 600;
  color: var(--color-text);
  font-size: 0.9rem;
}

.item-type {
  background: var(--color-surface);
  color: var(--color-text-secondary);
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
}

.item-quality {
  margin-bottom: 0.5rem;
}

.quality-text {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.item-quantity {
  text-align: right;
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
  /* 使用主题主色，增强与卡片背景的对比度 */
  color: var(--color-primary);
  font-weight: 700;
}

.item-description {
  margin-bottom: 0.75rem;
}

.item-description p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.item-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.trade-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: linear-gradient(135deg, #059669, #047857);
  color: white;
  border: none;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.trade-btn:hover {
  background: linear-gradient(135deg, #047857, #065f46);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3);
}

.trade-btn:active {
  transform: translateY(0);
}

.request-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border: none;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.request-btn:hover {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.request-btn:active {
  transform: translateY(0);
}

.steal-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  color: white;
  border: none;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.steal-btn:hover {
  background: linear-gradient(135deg, #b91c1c, #991b1b);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3);
}

.steal-btn:active {
  transform: translateY(0);
}

.empty-inventory {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  color: var(--color-text-secondary);
}

.empty-inventory .empty-icon {
  margin-bottom: 0.75rem;
  opacity: 0.5;
}

.no-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: var(--color-text-secondary);
}

.placeholder-icon {
  opacity: 0.5;
  margin-bottom: 1rem;
}

.placeholder-text {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.placeholder-hint {
  font-size: 0.85rem;
  opacity: 0.8;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* === NSFW 私密信息样式 === */
.nsfw-section {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.05), rgba(219, 39, 119, 0.05));
  border: 2px solid rgba(236, 72, 153, 0.3);
}

.nsfw-subsection {
  margin-bottom: 1rem;
}

.nsfw-subsection:last-child {
  margin-bottom: 0;
}

.development-bars {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dev-bar-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dev-bar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
}

.dev-label {
  color: var(--color-text);
  font-weight: 500;
}

.dev-value {
  color: #ec4899;
  font-weight: 700;
  font-size: 0.75rem;
}

.dev-bar-track {
  height: 8px;
  background: rgba(236, 72, 153, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.dev-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #ec4899, #db2777);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-正常 {
  background: rgba(107, 114, 128, 0.2);
  color: #6b7280;
}

.status-微湿 {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.status-发情 {
  background: rgba(236, 72, 153, 0.2);
  color: #ec4899;
}

.status-高潮 {
  background: rgba(220, 38, 38, 0.2);
  color: #dc2626;
}

.status-贤者时间 {
  background: rgba(139, 92, 246, 0.2);
  color: #8b5cf6;
}

.fetish-tag {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(219, 39, 119, 0.15));
  color: #ec4899;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid rgba(236, 72, 153, 0.3);
}

.partner-tag {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.12), rgba(219, 39, 119, 0.12));
  color: #db2777;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  border: 1px solid rgba(236, 72, 153, 0.25);
}

.partner-list {
  margin-top: 0.75rem;
}

.toggle-more-btn {
  margin-top: 0.75rem;
  background: rgba(236, 72, 153, 0.08);
  border: 1px solid rgba(236, 72, 153, 0.25);
  color: #db2777;
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-more-btn:hover {
  background: rgba(236, 72, 153, 0.12);
  border-color: rgba(236, 72, 153, 0.35);
}

.pregnancy-info {
  padding: 0.75rem;
  background: var(--color-surface);
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.pregnancy-active {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.pregnancy-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.pregnancy-details {
  flex: 1;
  font-size: 0.85rem;
  color: var(--color-text);
  line-height: 1.6;
}

.pregnancy-inactive {
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}

.first-time-info {
  padding: 0.75rem;
  background: rgba(236, 72, 153, 0.05);
  border-radius: 6px;
  border-left: 3px solid #ec4899;
  font-size: 0.85rem;
  color: var(--color-text);
}

/* 实时状态高亮区域（通用）*/
.highlight-section {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(147, 51, 234, 0.05));
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid rgba(59, 130, 246, 0.15);
}

.realtime-status {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.status-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--color-background);
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.status-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
  line-height: 1;
}

.status-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.status-label {
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-text {
  font-size: 0.85rem;
  color: var(--color-text);
  line-height: 1.5;
  font-style: italic;
}

.status-item-actions .status-content {
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.toggle-switch-inline {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
}
.toggle-switch-inline input {
  opacity: 0;
  width: 0;
  height: 0;
}
.toggle-switch-inline .toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-border);
  border-radius: 20px;
  transition: 0.3s;
}
.toggle-switch-inline .toggle-slider::before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: 0.3s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.toggle-switch-inline input:checked + .toggle-slider {
  background: var(--color-primary, #3b82f6);
}
.toggle-switch-inline input:checked + .toggle-slider::before {
  transform: translateX(16px);
}
.status-hint {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.desire-fill {
  background: linear-gradient(90deg, #f59e0b, #dc2626);
}

.mini-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  font-weight: 600;
  margin-bottom: 0.5rem;
}

/* 性经验统计 */
.experience-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.exp-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--color-surface);
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.exp-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.exp-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.exp-label {
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.exp-value {
  font-size: 0.95rem;
  color: #ec4899;
  font-weight: 700;
}

.last-time-info {
  padding: 0.5rem 0.75rem;
  background: rgba(236, 72, 153, 0.05);
  border-radius: 4px;
  font-size: 0.8rem;
  text-align: center;
}

.last-time-label {
  color: var(--color-text-secondary);
  margin-right: 0.5rem;
}

.last-time-value {
  color: var(--color-text);
  font-weight: 600;
}

/* 身体部位列表 */
.body-parts-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.body-part-item {
  padding: 0.75rem;
  background: var(--color-surface);
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.part-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.part-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
}

.part-mark {
  font-size: 0.7rem;
  padding: 0.125rem 0.375rem;
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(219, 39, 119, 0.2));
  color: #ec4899;
  border-radius: 4px;
  font-weight: 500;
}

.part-description {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  font-style: italic;
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  background: rgba(236, 72, 153, 0.05);
  border-radius: 4px;
  line-height: 1.4;
}

.part-stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.part-stat {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.stat-label {
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  min-width: 50px;
}

.stat-bar-mini {
  flex: 1;
  height: 6px;
  background: rgba(236, 72, 153, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.stat-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.stat-bar-fill.sensitivity {
  background: linear-gradient(90deg, #f59e0b, #ec4899);
}

.stat-bar-fill.development {
  background: linear-gradient(90deg, #8b5cf6, #ec4899);
}

.stat-value {
  font-size: 0.7rem;
  color: #ec4899;
  font-weight: 700;
  min-width: 35px;
  text-align: right;
}

/* 体液状态 */
.fluid-status {
  padding: 0.75rem;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(236, 72, 153, 0.08));
  border-radius: 6px;
  border-left: 3px solid #3b82f6;
  font-size: 0.85rem;
  color: var(--color-text);
  font-style: italic;
}

/* 特殊体质标签 */
.special-trait-tag {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(236, 72, 153, 0.15));
  color: #a855f7;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid rgba(168, 85, 247, 0.3);
}

/* ========== 人格底线样式 ========== */
.personality-section {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(249, 115, 22, 0.08));
  border-left: 4px solid #ef4444;
}

.personality-bottomlines {
  margin-bottom: 0.75rem;
}

.bottomline-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.bottomline-tag {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(249, 115, 22, 0.15));
  color: #ef4444;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  border: 1.5px solid rgba(239, 68, 68, 0.4);
  display: inline-flex;
  align-items: center;
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.1);
  transition: all 0.2s ease;
}

.bottomline-tag:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.6);
}

.bottomline-empty {
  color: var(--text-secondary);
  font-style: italic;
  font-size: 0.875rem;
  padding: 0.5rem 0;
}

.bottomline-warning {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  background: rgba(239, 68, 68, 0.1);
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.warning-icon {
  font-size: 1.1rem;
  color: #f59e0b;
  flex-shrink: 0;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.1);
  }
}

.warning-text {
  color: #dc2626;
  font-size: 0.8rem;
  line-height: 1.4;
  font-weight: 500;
}

/* ========== Tab导航样式 ========== */
.detail-tabs {
  display: flex;
  gap: 0.5rem;
  padding: 0 0 1rem 0;
  border-bottom: 2px solid var(--color-border);
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.tab-btn {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px 8px 0 0;
  padding: 0.5rem 1rem;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  position: relative;
  outline: none;
}

.tab-btn:hover {
  background: var(--color-surface);
  border-color: var(--color-primary);
  color: var(--color-text);
  transform: translateY(-2px);
}

.tab-btn.active {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1));
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-primary);
}

.tab-panel {
  animation: fadeIn 0.3s ease;
}

/* ========== 响应式2列布局样式 ========== */
.info-grid-responsive {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

/* 小屏幕时切换为单列 */
@media (max-width: 500px) {
  .info-grid-responsive {
    grid-template-columns: 1fr;
  }
}

.info-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: transparent;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  transition: background 0.2s ease;
}

.info-item-row:hover {
  background: rgba(59, 130, 246, 0.03);
}

.info-item-row .info-label {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  font-weight: 500;
  min-width: 50px;
}

.info-item-row .info-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
  text-align: right;
  flex: 1;
  word-break: break-word;
}

/* ========== NPC记忆列表样式 ========== */
.npc-memories-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.npc-memory-item {
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.05), rgba(249, 115, 22, 0.05));
  border-left: 3px solid #eab308;
  border-radius: 4px;
  padding: 10px 12px;
  transition: all 0.2s ease;
}

.npc-memory-item:hover {
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.1), rgba(249, 115, 22, 0.1));
  transform: translateX(4px);
  box-shadow: 0 2px 6px rgba(234, 179, 8, 0.15);
}

.npc-memory-content {
  font-size: 0.85rem;
  color: var(--color-text);
  line-height: 1.5;
}

/* ========== NPC六司属性样式 ========== */
.npc-attributes-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.npc-attr-group {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(147, 51, 234, 0.05));
  border: 1px solid rgba(59, 130, 246, 0.15);
  border-radius: 8px;
  padding: 10px;
}

.npc-attr-group-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: 8px;
  padding-left: 4px;
}

.npc-attr-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.npc-attr-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.npc-attr-item:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
}

.npc-attr-item.final {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(147, 51, 234, 0.12));
}

.npc-attr-item.final:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(147, 51, 234, 0.2));
}

.npc-attr-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-bottom: 2px;
  font-weight: 500;
}

.npc-attr-value {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-primary);
}

.name-and-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.delete-npc-btn {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.delete-npc-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
  color: #ef4444;
  transform: scale(1.1);
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-btn {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.action-btn.download-btn:hover {
  background: rgba(59, 130, 246, 0.1);
  border-color: #3b82f6;
  color: #3b82f6;
  transform: scale(1.1);
}

.action-btn.export-btn:hover {
  background: rgba(16, 185, 129, 0.1);
  border-color: #10b981;
  color: #10b981;
  transform: scale(1.1);
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  position: relative;
  z-index: 10;
  pointer-events: auto;
}

.delete-btn-card {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(156, 163, 175, 0.1);
  border: 1px solid rgba(156, 163, 175, 0.2);
  color: #9ca3af;
  padding: 0;
  outline: none;
  position: relative;
  z-index: 100;
  pointer-events: auto;
}

.delete-btn-card:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
  color: #ef4444;
  transform: scale(1.1);
}

.back-to-list-btn {
  display: none; /* 默认隐藏 */
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  margin-right: 0.5rem;
}

.back-to-list-btn:hover {
  background: var(--color-surface);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

@media (max-width: 768px) {
  .relationships-container {
    position: relative;
    overflow: hidden;
  }

  .relationship-list,
  .relationship-detail {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    transition: transform 0.3s ease-in-out;
    backface-visibility: hidden;
  }

  .relationship-list {
    transform: translateX(0);
    z-index: 10;
  }

  .relationship-detail {
    transform: translateX(100%);
    z-index: 20;
    border-left: none; /* 移除左边框 */
  }

  .relationships-container.details-active .relationship-list {
    transform: translateX(-100%);
  }

  .relationships-container.details-active .relationship-detail {
    transform: translateX(0);
  }

  .back-to-list-btn {
    display: flex; /* 在移动端显示 */
  }

  .detail-header {
    padding: 0.75rem 1rem;
  }
}

/* ====== NPC Editing UI Styles ====== */

.list-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

.create-npc-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 0.75rem;
  color: var(--text-secondary, #aab);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.create-npc-btn:hover {
  color: var(--primary, #8af);
  border-color: var(--primary, #8af);
  background: rgba(136, 170, 255, 0.1);
}

/* Editable row: hover-reveal edit icon */
.editable-row { cursor: pointer; }
.editable-row:hover { background: rgba(255,255,255,0.02); }

.inline-edit-icon {
  opacity: 0;
  transition: opacity 0.15s;
  margin-left: 4px;
  color: var(--text-muted, #667);
  vertical-align: middle;
}
.editable-row:hover .inline-edit-icon,
.editable-text:hover .inline-edit-icon,
.editable-badge:hover .inline-edit-icon,
.editable-badge:hover .badge-edit-icon {
  opacity: 0.7;
}

/* Editable badges */
.editable-badge {
  cursor: pointer;
  position: relative;
}
.badge-edit-icon {
  opacity: 0;
  transition: opacity 0.15s;
  margin-left: 2px;
}
.badge-edit-input {
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--primary, #8af);
  border-radius: 4px;
  color: inherit;
  font-size: 0.7rem;
  padding: 1px 4px;
  width: 60px;
  outline: none;
}
.badge-edit-num {
  width: 40px;
}

/* Inline edit inputs */
.inline-edit-input {
  background: rgba(0,0,0,0.2);
  border: 1px solid var(--primary, #8af);
  border-radius: 4px;
  color: var(--text-primary, #eee);
  font-size: 0.8rem;
  padding: 4px 8px;
  width: 100%;
  outline: none;
  transition: border-color 0.2s;
}
.inline-edit-input:focus {
  border-color: var(--primary-bright, #aaf);
  box-shadow: 0 0 4px rgba(136,170,255,0.2);
}

.inline-edit-input-sm {
  background: rgba(0,0,0,0.2);
  border: 1px solid var(--primary, #8af);
  border-radius: 4px;
  color: var(--text-primary, #eee);
  font-size: 0.75rem;
  padding: 2px 6px;
  width: 60px;
  outline: none;
}

.inline-edit-textarea {
  background: rgba(0,0,0,0.2);
  border: 1px solid var(--primary, #8af);
  border-radius: 4px;
  color: var(--text-primary, #eee);
  font-size: 0.8rem;
  padding: 6px 8px;
  width: 100%;
  outline: none;
  resize: vertical;
  min-height: 60px;
}

.editable-text {
  cursor: pointer;
}
.editable-text:hover {
  color: var(--primary, #8af);
}

/* Edit actions row */
.edit-actions-row {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}
.edit-confirm-btn, .edit-cancel-btn {
  padding: 3px 10px;
  font-size: 0.7rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}
.edit-confirm-btn {
  background: var(--primary, #8af);
  color: #000;
}
.edit-cancel-btn {
  background: rgba(255,255,255,0.1);
  color: var(--text-secondary, #aab);
}

/* Inline Check/Cancel Buttons */
.edit-actions-inline {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 4px;
}
.edit-ok-btn, .edit-no-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  padding: 0;
  color: #fff;
  transition: all 0.2s;
}
.edit-ok-btn {
  background: rgba(66, 184, 131, 0.2);
  color: #42b983;
}
.edit-ok-btn:hover {
  background: rgba(66, 184, 131, 0.4);
}
.edit-no-btn {
  background: rgba(255, 80, 80, 0.2);
  color: #ff5050;
}
.edit-no-btn:hover {
  background: rgba(255, 80, 80, 0.4);
}

/* Badge Action Buttons */
.badge-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  padding: 0;
  margin-left: 2px;
}
.badge-action-btn.confirm {
  background: rgba(66, 184, 131, 0.3);
  color: #42b983;
}
.badge-action-btn.confirm:hover {
  background: rgba(66, 184, 131, 0.6);
}
.badge-action-btn.cancel {
  background: rgba(255, 80, 80, 0.3);
  color: #ff5050;
}
.badge-action-btn.cancel:hover {
  background: rgba(255, 80, 80, 0.6);
}

/* Stat Edit Group */
.stat-edit-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Location dropdown */
.location-edit-wrapper {
  position: relative;
  width: 100%;
}
.location-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--bg-dark, #1a1a2e);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  max-height: 160px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}
.location-option {
  padding: 6px 10px;
  font-size: 0.8rem;
  color: var(--text-secondary, #aab);
  cursor: pointer;
  transition: background 0.15s;
}
.location-option:hover {
  background: rgba(136,170,255,0.1);
  color: var(--primary, #8af);
}
.location-edit-actions {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}
.loc-confirm-btn, .loc-cancel-btn {
  display: flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 0.7rem;
  transition: all 0.2s;
}
.loc-confirm-btn {
  background: var(--primary, #8af);
  color: #000;
}
.loc-cancel-btn {
  background: rgba(255,255,255,0.1);
  color: var(--text-secondary, #aab);
}

/* List tag add/delete */
.editable-list {
  flex-wrap: wrap;
}
.with-delete {
  position: relative;
  padding-right: 18px !important;
}
.tag-delete-btn {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 16px;
  height: 16px;
  font-size: 12px;
  line-height: 14px;
  text-align: center;
  border: none;
  border-radius: 50%;
  background: rgba(255,80,80,0.7);
  color: #fff;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
  padding: 0;
}
.with-delete:hover .tag-delete-btn {
  opacity: 1;
}

.add-tag {
  cursor: pointer;
  border-style: dashed !important;
  opacity: 0.6;
  transition: opacity 0.2s;
}
.add-tag:hover {
  opacity: 1;
  border-color: var(--primary, #8af) !important;
}
.tag-add-input {
  background: transparent;
  border: none;
  color: inherit;
  font-size: inherit;
  width: 60px;
  outline: none;
}

/* Item delete button */
.item-delete-btn {
  margin-left: auto;
  padding: 2px 4px;
  border: none;
  background: rgba(255,80,80,0.2);
  color: #f55;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}
.npc-item-card:hover .item-delete-btn {
  opacity: 1;
}
.item-delete-btn:hover {
  background: rgba(255,80,80,0.4);
}

/* Section header with action button */
.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.add-item-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 0.7rem;
  border: 1px dashed rgba(255,255,255,0.15);
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary, #aab);
  cursor: pointer;
  transition: all 0.2s;
}
.add-item-btn:hover {
  border-color: var(--primary, #8af);
  color: var(--primary, #8af);
}

/* Create blank NSFW profile button */
.create-blank-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  padding: 4px 10px;
  font-size: 0.7rem;
  border: 1px dashed rgba(255,255,255,0.15);
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary, #aab);
  cursor: pointer;
}
.create-blank-btn:hover {
  border-color: var(--primary, #8af);
  color: var(--primary, #8af);
}

/* AI Refine button */
.refine-btn {
  position: relative;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.animate-spin {
  animation: spin 1s linear infinite;
}


/* Add item modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.add-item-modal {
  background: var(--bg-dark, #1a1a2e);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 1.5rem;
  width: 420px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  animation: modalPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modalPop {
  from { opacity: 0; transform: scale(0.9) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

/* Glassy Modal Styles */
.glass-modal {
  background: rgba(30, 30, 40, 0.95);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-highlight, #fff);
  letter-spacing: 0.02em;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted, #889);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  transition: all 0.2s;
}
.close-btn:hover {
  background: rgba(255,255,255,0.1);
  color: var(--color-text);
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-group-row {
  display: flex;
  gap: 1rem;
}
.form-group.half { flex: 1; }

.form-group label {
  font-size: 0.75rem;
  color: var(--text-secondary, #aab);
  font-weight: 500;
}

.form-input {
  background: rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  color: var(--text-primary, #eee);
  font-size: 0.9rem;
  padding: 8px 12px;
  outline: none;
  transition: all 0.2s;
}
.glow-input:focus, .form-input:focus {
  background: rgba(0, 0, 0, 0.3);
  border-color: var(--primary, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 1.5rem;
  justify-content: flex-end;
}

.modal-btn {
  padding: 8px 20px;
  font-size: 0.85rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.modal-btn.cancel {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary, #ccc);
}
.modal-btn.cancel:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.modal-btn.confirm {
  background: var(--primary, #3b82f6);
  color: #fff;
}
.glow-btn {
  background: linear-gradient(135deg, var(--primary, #3b82f6), var(--secondary, #8b5cf6));
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
}
.glow-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.35);
}

</style>

<style scoped>
/* Location Edit Styles - Appended */
.location-edit-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.location-input-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.location-select {
  flex: 1;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: var(--color-text);
  padding: 4px 8px;
  font-size: 0.85rem;
  outline: none;
}
.location-select option {
  background: #1e1e1e; /* Fallback dark bg */
  color: #eee;
}

.location-select:focus {
  border-color: var(--color-primary);
}

.toggle-input-mode-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-input-mode-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text);
}

.location-edit-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
