<template>
  <div class="relationship-network-panel">
    <div class="panel-content">
      <!-- 人物关系列表 -->
      <div class="relationships-container" :class="{ 'details-active': isDetailViewActive }">
        <!-- 左侧：人物列表 -->
        <div class="relationship-list">
          <div class="list-header">
            <h3 class="panel-title">人物关系</h3>
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
                        @click.stop="confirmDeleteNpc(person)"
                        class="delete-btn-card"
                        title="删除人物"
                      >
                        <Trash2 :size="14" />
                      </button>
                    </div>
                  </div>
                  <div class="person-realm" v-if="getNpcRealm(person) !== '未知'">
                    <span class="realm-label">境界:</span>
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
                      @click="downloadCharacterData"
                      class="action-btn download-btn"
                      title="下载完整人物数据"
                    >
                      <Download :size="16" />
                    </button>
                    <button
                      v-if="isTavernEnvFlag"
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
                  <span class="relationship-badge">{{ selectedPerson.与玩家关系 || '相识' }}</span>
                  <span class="intimacy-badge" :class="getIntimacyClass(selectedPerson.好感度)">
                    好感 {{ selectedPerson.好感度 || 0 }}
                  </span>
                  <span class="race-badge">{{ selectedPerson.种族 || '人族' }}</span>
                  <span v-if="selectedPerson.势力归属" class="faction-badge">{{
                    selectedPerson.势力归属
                  }}</span>
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
                      <div class="info-item-row">
                        <span class="info-label">境界</span
                        ><span class="info-value">{{ getNpcRealm(selectedPerson) }}</span>
                      </div>
                      <div class="info-item-row">
                        <span class="info-label">性别</span
                        ><span class="info-value">{{ selectedPerson.性别 || '未知' }}</span>
                      </div>
                      <div class="info-item-row">
                        <span class="info-label">年龄</span
                        ><span class="info-value">{{ getNpcAge(selectedPerson) }}</span>
                      </div>
                      <div class="info-item-row">
                        <span class="info-label">{{ traitOrRootLabel }}</span
                        ><span class="info-value">{{ getNpcSpiritRoot(selectedPerson) }}</span>
                      </div>
                      <div class="info-item-row" v-if="selectedPerson.当前位置">
                        <span class="info-label">位置</span
                        ><span class="info-value">{{ selectedPerson.当前位置.描述 }}</span>
                      </div>
                      <div class="info-item-row" v-if="selectedPerson.出生">
                        <span class="info-label">出生</span
                        ><span class="info-value">{{ getNpcOrigin(selectedPerson.出生) }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- 核心数值（体力/精力 兼容 气血/灵气；神识有值才显示） -->
                  <div class="detail-section" v-if="hasNpcCoreStats(selectedPerson)">
                    <h5 class="section-title">核心数值</h5>
                    <div class="npc-vitals-container">
                      <div class="npc-vital-row">
                        <div class="npc-vital-meta">
                          <span class="npc-vital-name">{{ t('体力') }}</span>
                          <span class="npc-vital-nums">{{ formatNpcStatPair(selectedPerson, '体力') }}</span>
                        </div>
                        <div class="npc-vital-track">
                          <div class="npc-vital-bar red-bar" :style="{ width: getNpcStatPercentage(selectedPerson, '体力') + '%' }"></div>
                        </div>
                      </div>
                      <div class="npc-vital-row">
                        <div class="npc-vital-meta">
                          <span class="npc-vital-name">{{ t('精力') }}</span>
                          <span class="npc-vital-nums">{{ formatNpcStatPair(selectedPerson, '精力') }}</span>
                        </div>
                        <div class="npc-vital-track">
                          <div class="npc-vital-bar blue-bar" :style="{ width: getNpcStatPercentage(selectedPerson, '精力') + '%' }"></div>
                        </div>
                      </div>
                      <div class="npc-vital-row" v-if="hasNpcStatPair(selectedPerson, '神识')">
                        <div class="npc-vital-meta">
                          <span class="npc-vital-name">{{ t('神识') }}</span>
                          <span class="npc-vital-nums">{{ formatNpcStatPair(selectedPerson, '神识') }}</span>
                        </div>
                        <div class="npc-vital-track">
                          <div class="npc-vital-bar gold-bar" :style="{ width: getNpcStatPercentage(selectedPerson, '神识') + '%' }"></div>
                        </div>
                      </div>
                      <div class="npc-vital-row">
                        <div class="npc-vital-meta">
                          <span class="npc-vital-name">寿元</span>
                          <span class="npc-vital-nums">{{ formatNpcLifespan(selectedPerson) }}</span>
                        </div>
                        <div class="npc-vital-track">
                          <div class="npc-vital-bar purple-bar" :style="{ width: getNpcLifespanPercentage(selectedPerson) + '%' }"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 外貌与性格 -->
                  <div
                    class="detail-section"
                    v-if="selectedPerson.外貌描述 || selectedPerson.性格特征?.length"
                  >
                    <h5 class="section-title">外貌与性格</h5>
                    <div v-if="selectedPerson.外貌描述" class="appearance-description">
                      <p class="description-text">{{ selectedPerson.外貌描述 }}</p>
                    </div>
                    <div
                      v-if="selectedPerson.性格特征?.length"
                      class="talents-grid"
                      style="margin-top: 1rem"
                    >
                      <span
                        v-for="trait in selectedPerson.性格特征"
                        :key="trait"
                        class="talent-tag"
                        >{{ trait }}</span
                      >
                    </div>
                  </div>

                  <!-- 天赋与六司 -->
                  <div
                    class="detail-section"
                    v-if="selectedPerson.天赋?.length || selectedPerson.先天六司"
                  >
                    <h5 class="section-title">天赋与六司</h5>
                    <div v-if="selectedPerson.天赋?.length">
                      <h6 class="subsection-title">天赋能力</h6>
                      <div class="talents-grid">
                        <span
                          v-for="(talent, index) in selectedPerson.天赋"
                          :key="index"
                          class="talent-tag"
                          @click="showTalentDetail(talent)"
                          style="cursor: pointer"
                        >
                          {{ getTalentName(talent) }}
                        </span>
                      </div>
                    </div>
                    <div v-if="selectedPerson.先天六司" style="margin-top: 1rem">
                      <h6 class="subsection-title">先天六司</h6>
                      <div class="attributes-grid">
                        <div class="attribute-item">
                          <span class="attr-label">体质</span
                          ><span class="attr-value">{{ selectedPerson.先天六司.体质 ?? selectedPerson.先天六司.根骨 ?? 0 }}</span>
                        </div>
                        <div class="attribute-item">
                          <span class="attr-label">直觉</span
                          ><span class="attr-value">{{ selectedPerson.先天六司.直觉 ?? selectedPerson.先天六司.灵性 ?? 0 }}</span>
                        </div>
                        <div class="attribute-item">
                          <span class="attr-label">悟性</span
                          ><span class="attr-value">{{ selectedPerson.先天六司.悟性 || 0 }}</span>
                        </div>
                        <div class="attribute-item">
                          <span class="attr-label">气运</span
                          ><span class="attr-value">{{ selectedPerson.先天六司.气运 || 0 }}</span>
                        </div>
                        <div class="attribute-item">
                          <span class="attr-label">魅力</span
                          ><span class="attr-value">{{ selectedPerson.先天六司.魅力 || 0 }}</span>
                        </div>
                        <div class="attribute-item">
                          <span class="attr-label">心性</span
                          ><span class="attr-value">{{ selectedPerson.先天六司.心性 || 0 }}</span>
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
                      <div v-if="selectedPerson.人格底线?.length" class="bottomline-tags">
                        <span
                          v-for="(line, index) in selectedPerson.人格底线"
                          :key="index"
                          class="bottomline-tag"
                          >{{ line }}</span
                        >
                      </div>
                      <div v-else class="bottomline-empty">未记录人格底线</div>
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
                      <div class="status-item">
                        <span class="status-icon">😶</span>
                        <div class="status-content">
                          <div class="status-label">外貌状态</div>
                          <div class="status-text">
                            {{ selectedPerson.当前外貌状态 || '神态自然，衣衫整洁' }}
                          </div>
                        </div>
                      </div>
                      <div class="status-item">
                        <span class="status-icon">💭</span>
                        <div class="status-content">
                          <div class="status-label">内心想法</div>
                          <div class="status-text">
                            {{ selectedPerson.当前内心想法 || '心如止水，平静无波' }}
                          </div>
                        </div>
                      </div>
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
                          <div class="info-item-row">
                            <span class="info-label">是否为处女</span
                            ><span class="info-value">{{ privacy.是否为处女 ? '是' : '否' }}</span>
                          </div>
                          <div class="info-item-row">
                            <span class="info-label">性格倾向</span
                            ><span class="info-value">{{ privacy.性格倾向 || '无' }}</span>
                          </div>
                          <div class="info-item-row">
                            <span class="info-label">性取向</span
                            ><span class="info-value">{{ privacy.性取向 || '无' }}</span>
                          </div>
                          <div class="info-item-row">
                            <span class="info-label">当前性状态</span
                            ><span class="info-value">{{ privacy.当前性状态 || '无' }}</span>
                          </div>
                          <div class="info-item-row">
                            <span class="info-label">体液分泌状态</span
                            ><span class="info-value"
                              ><span
                                class="status-badge"
                                :class="`status-${privacy.体液分泌状态 || '正常'}`"
                                >{{ privacy.体液分泌状态 || '正常' }}</span
                              ></span
                            >
                          </div>
                          <div class="info-item-row">
                            <span class="info-label">性交总次数</span
                            ><span class="info-value">{{ privacy.性交总次数 ?? 0 }}</span>
                          </div>
                        </div>

                        <div class="development-bars" style="margin-top: 0.75rem">
                          <div class="dev-bar-item">
                            <div class="dev-bar-header">
                              <span class="dev-label">性渴望程度</span>
                              <span class="dev-value">{{ privacy.性渴望程度 ?? 0 }}/100</span>
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
                        v-if="privacyFetishesAll.length || privacyTraitsAll.length"
                        class="nsfw-subsection"
                      >
                        <h6 class="subsection-title">偏好与体质</h6>
                        <div v-if="privacyFetishesAll.length" class="bottomline-tags">
                          <span
                            v-for="(kink, index) in privacyFetishesAll"
                            :key="`${kink}-${index}`"
                            class="fetish-tag"
                            >{{ kink }}</span
                          >
                        </div>
                        <div
                          v-if="privacyTraitsAll.length"
                          class="bottomline-tags"
                          style="margin-top: 0.5rem"
                        >
                          <span
                            v-for="(trait, index) in privacyTraitsAll"
                            :key="`${trait}-${index}`"
                            class="special-trait-tag"
                            >{{ trait }}</span
                          >
                        </div>
                      </div>

                      <!-- 性伴侣名单 -->
                      <div v-if="privacyPartnersAll.length" class="nsfw-subsection">
                        <h6 class="subsection-title">性伴侣名单</h6>
                        <div class="bottomline-tags partner-list">
                          <span
                            v-for="(partner, index) in privacyPartners"
                            :key="`${partner}-${index}`"
                            class="partner-tag"
                            >{{ partner }}</span
                          >
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
                      <div v-if="privacyBodyPartsAll.length" class="nsfw-subsection">
                        <h6 class="subsection-title">身体部位</h6>

                        <div class="body-parts-list">
                          <div
                            v-for="(part, index) in privacyBodyParts"
                            :key="`${part.部位名称}-${index}`"
                            class="body-part-item"
                          >
                            <div class="part-header">
                              <span class="part-name">{{
                                part.部位名称 || `部位${index + 1}`
                              }}</span>
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

                    <div v-else class="bottomline-empty">暂无私密信息（等待AI生成）</div>
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
                    <h5 class="section-title">背包</h5>
                    <div v-if="selectedPerson.背包?.金钱 || selectedPerson.背包?.灵石" class="spirit-stones-grid">
                      <div class="spirit-stone-item" v-for="g in ['下品','中品','上品','极品']" :key="g">
                        <span>{{ g }}金钱</span><span>{{ (selectedPerson.背包.金钱 ?? selectedPerson.背包.灵石)?.[g] || 0 }}</span>
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
  Loader2, ChevronRight, Package, ArrowRightLeft, Eye, EyeOff, Trash2, ArrowLeft, Download, BookOpen
} from 'lucide-vue-next';
import { useUIStore } from '@/stores/uiStore';
import { useCharacterStore } from '@/stores/characterStore';
import { useGameStateStore } from '@/stores/gameStateStore';
import { getMemoryTime, getMemoryEvent } from '@/utils/memoryUtils';
import { isTavernEnv } from '@/utils/tavern';
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

onMounted(() => {
  isTavernEnvFlag.value = isTavernEnv();
});

onActivated(() => {
  isTavernEnvFlag.value = isTavernEnv();
});
const { t } = useI18n();
const traitOrRootLabel = computed(() => t(USE_MING_PROMPTS ? '特质' : '灵根'));
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

// Tab管理
const activeTab = ref('basic');
const tabs = computed(() => {
  const baseTabs = [
    { id: 'basic', label: '基本信息', icon: '📋' },
    { id: 'status', label: '实时状态', icon: '💭' },
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


// 获取NPC境界信息
const getNpcRealm = (npc: NpcProfile): string => {
  const realmField = npc.境界;
  if (!realmField) return '未知';

  if (typeof realmField === 'object' && realmField !== null) {
    const name = realmField.名称 || '';
    const stage = realmField.阶段 || '';
    if (name) {
      return stage ? `${name}${stage}` : name;
    }
  }

  if (typeof realmField === 'string') {
    return realmField;
  }

  return '未知';
};

// 获取NPC灵根信息
const getNpcSpiritRoot = (npc: NpcProfile): string => {
  return formatSpiritRoot(npc.灵根);
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

const toFiniteNumber = (value: unknown): number | null => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

type NpcCoreStatKey = '体力' | '精力' | '神识' | '气血' | '灵气';

const getNpcStatPair = (npc: NpcProfile, key: NpcCoreStatKey): { current: number | null; max: number | null } => {
  const attrs = (npc as any)?.属性;
  let raw: unknown = attrs?.[key];
  if (key === '体力') raw = attrs?.体力 ?? attrs?.气血;
  else if (key === '精力') raw = attrs?.精力 ?? attrs?.灵气;
  if (!raw || typeof raw !== 'object') {
    return { current: null, max: null };
  }
  const current = toFiniteNumber((raw as any).当前 ?? (raw as any).current);
  const max = toFiniteNumber((raw as any).上限 ?? (raw as any).max);
  return { current, max };
};

const formatNpcStatPair = (npc: NpcProfile, key: NpcCoreStatKey): string => {
  const { current, max } = getNpcStatPair(npc, key);
  if (current === null && max === null) return '--';
  if (current === null) return `--/${max}`;
  if (max === null) return `${current}/--`;
  return `${current}/${max}`;
};

const getNpcLifespanMax = (npc: NpcProfile): number | null => {
  const raw = (npc as any)?.属性?.寿元上限 ?? (npc as any)?.寿元上限 ?? (npc as any)?.寿命?.上限;
  return toFiniteNumber(raw);
};

const hasNpcStatPair = (npc: NpcProfile, key: NpcCoreStatKey): boolean => {
  const pair = getNpcStatPair(npc, key);
  return pair.current !== null || pair.max !== null;
};

const hasNpcCoreStats = (npc: NpcProfile): boolean => {
  return hasNpcStatPair(npc, '体力') || hasNpcStatPair(npc, '精力') || hasNpcStatPair(npc, '神识') || getNpcLifespanMax(npc) !== null;
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

// 格式化灵根显示
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

// 格式化灵根显示
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

const getNpcStatPercentage = (npc: NpcProfile, key: NpcCoreStatKey): number => {
  const { current, max } = getNpcStatPair(npc, key);
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
    if (npc.类型 === '普通') continue;
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
      uiStore.showToast(isTavernEnvFlag.value ? '酒馆助手未初始化' : '当前环境不可用', { type: 'error' });
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
    entryContent += `- 境界：${getNpcRealm(npc)}\n`;
    entryContent += `- ${t(USE_MING_PROMPTS ? '特质' : '灵根')}：${getNpcSpiritRoot(npc)}\n`;
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

    // 先天六司
    if (npc.先天六司) {
      entryContent += `\n**先天六司**\n`;
      entryContent += `- 体质：${npc.先天六司.体质 ?? npc.先天六司.根骨 ?? 0}\n`;
      entryContent += `- 直觉：${npc.先天六司.直觉 ?? npc.先天六司.灵性 ?? 0}\n`;
      entryContent += `- 悟性：${npc.先天六司.悟性 || 0}\n`;
      entryContent += `- 气运：${npc.先天六司.气运 || 0}\n`;
      entryContent += `- 魅力：${npc.先天六司.魅力 || 0}\n`;
      entryContent += `- 心性：${npc.先天六司.心性 || 0}\n`;
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

    // 货币（金钱 ?? 灵石）
    const stones = npc.背包?.金钱 ?? npc.背包?.灵石;
    if (stones) {
      const total = (stones.下品 || 0) + (stones.中品 || 0) + (stones.上品 || 0) + (stones.极品 || 0);
      if (total > 0) {
        entryContent += `\n**金钱**\n`;
        if (stones.下品) entryContent += `- 下品：${stones.下品}\n`;
        if (stones.中品) entryContent += `- 中品：${stones.中品}\n`;
        if (stones.上品) entryContent += `- 上品：${stones.上品}\n`;
        if (stones.极品) entryContent += `- 极品：${stones.极品}\n`;
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
</style>
