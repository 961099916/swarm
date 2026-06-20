<!-- File: /Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/views/prompts/index.vue -->
<template>
  <div class="prompts-container">
    <el-row :gutter="20">
      <!-- 左侧：提示词密钥分组列表 -->
      <el-col :span="10">
        <el-card class="glass-card left-list-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">系统 Prompt 模版密钥</span>
              <el-input
                v-model="searchQuery"
                placeholder="搜索 Key / 描述"
                :prefix-icon="searchIcon"
                clearable
                size="small"
                class="search-input"
              />
            </div>
          </template>

          <el-table
            :data="filteredKeys"
            v-loading="keysLoading"
            highlight-current-row
            @current-change="handleSelectKey"
            class="dark-table"
            style="width: 100%"
          >
            <el-table-column prop="key" label="模版 Key" min-width="150" show-overflow-tooltip />
            <el-table-column prop="activeVersion" label="当前版" width="70" align="center">
              <template #default="scope">
                <el-tag size="small" type="success" effect="dark">v{{ scope.row.activeVersion }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="latestVersion" label="最新版" width="70" align="center">
              <template #default="scope">
                <el-tag size="small" type="info">v{{ scope.row.latestVersion }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <!-- 右侧：当前所选 Prompt 的历史版本与预览 -->
      <el-col :span="14">
        <div v-if="!selectedPromptKey" class="empty-state-wrapper">
          <el-card class="glass-card empty-card">
            <el-empty description="请在左侧选择一个 Prompt 模板以查看版本历史" />
          </el-card>
        </div>

        <el-card v-else class="glass-card right-detail-card" v-loading="detailLoading">
          <template #header>
            <div class="card-header header-actions">
              <div class="header-left-title">
                <span class="card-title text-gradient">{{ selectedPromptKey }}</span>
                <span class="prompt-desc" v-if="selectedPromptDesc">{{ selectedPromptDesc }}</span>
              </div>
              <el-button
                type="primary"
                size="small"
                class="action-btn-primary"
                @click="openPublishDialog"
              >
                发布新版本
              </el-button>
            </div>
          </template>

          <!-- 历史版本时间线列表 -->
          <div class="versions-timeline">
            <el-timeline>
              <el-timeline-item
                v-for="ver in promptVersions"
                :key="ver.version"
                :type="ver.isActive ? 'success' : 'primary'"
                :hollow="!ver.isActive"
                timestamp=""
                placement="top"
              >
                <el-card class="version-item-card">
                  <div class="version-header">
                    <div class="version-meta">
                      <span class="version-number">Version {{ ver.version }}</span>
                      <el-tag v-if="ver.isActive" size="small" type="success" effect="dark" class="active-badge">
                        当前激活
                      </el-tag>
                      <span class="version-time">{{ formatTime(ver.createdAt) }}</span>
                    </div>
                    <div class="version-actions">
                      <el-button
                        v-if="!ver.isActive"
                        size="small"
                        type="warning"
                        @click="handleRollback(ver.version)"
                      >
                        激活此版本
                      </el-button>
                    </div>
                  </div>

                  <div class="version-desc" v-if="ver.description">
                    <strong>发布说明:</strong> {{ ver.description }}
                  </div>

                  <!-- 代码预览区域 -->
                  <div class="prompt-preview-box">
                    <div class="preview-header">
                      <span>模版内容预览</span>
                      <el-button size="small" link type="primary" @click="copyToClipboard(ver.content)">
                        复制
                      </el-button>
                    </div>
                    <pre class="code-pre"><code>{{ ver.content }}</code></pre>
                  </div>
                </el-card>
              </el-timeline-item>
            </el-timeline>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 弹出发布新版本对话框 -->
    <el-dialog v-model="publishDialogVisible" title="发布新版本 Prompt" width="650px" class="dark-dialog">
      <el-form :model="publishForm" label-position="top">
        <el-form-item label="模版 Key">
          <el-input v-model="publishForm.key" disabled />
        </el-form-item>
        <el-form-item label="发布说明 (Description)" required>
          <el-input
            v-model="publishForm.description"
            placeholder="例如: 优化多轮对话下的决策准确性"
            clearable
          />
        </el-form-item>
        <el-form-item label="模版内容 (Content)" required>
          <el-input
            v-model="publishForm.content"
            type="textarea"
            :rows="12"
            placeholder="请输入提示词系统模板内容，支持 {{goal}} 等插值"
            class="textarea-editor"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="publishDialogVisible = false">取消</el-button>
          <el-button type="primary" class="action-btn-primary" @click="submitPublish" :loading="submitLoading">
            确认发布
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search } from '@element-plus/icons-vue';
import request from '@/utils/request';

const searchIcon = Search;

interface PromptKeyItem {
  key: string;
  activeVersion: number;
  latestVersion: number;
  description: string | null;
  lastUpdated: string;
}

interface PromptVersionItem {
  key: string;
  version: number;
  content: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

const searchQuery = ref('');
const keysLoading = ref(false);
const detailLoading = ref(false);
const submitLoading = ref(false);

const promptKeys = ref<PromptKeyItem[]>([]);
const promptVersions = ref<PromptVersionItem[]>([]);

const selectedPromptKey = ref('');
const selectedPromptDesc = ref('');

// 过滤左侧模版 Key 列表
const filteredKeys = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return promptKeys.value;
  return promptKeys.value.filter(
    (item) =>
      item.key.toLowerCase().includes(query) ||
      (item.description && item.description.toLowerCase().includes(query))
  );
});

const formatTime = (timeStr: string) => {
  if (!timeStr) return '-';
  const d = new Date(timeStr);
  return d.toLocaleString('zh-CN', { hour12: false });
};

// 获取 Prompt 简要密钥列表
const fetchPromptKeys = async () => {
  keysLoading.value = true;
  try {
    const res = await request.get('/api/v1/admin/prompts');
    if (res.data && res.data.success) {
      promptKeys.value = res.data.data || [];
    }
  } catch (err: any) {
    ElMessage.error(err.message || '获取提示词列表失败');
  } finally {
    keysLoading.value = false;
  }
};

// 选择模版 Key 切换右侧历史版本
const handleSelectKey = (val: PromptKeyItem | null) => {
  if (!val) return;
  selectedPromptKey.value = val.key;
  selectedPromptDesc.value = val.description || '';
  fetchPromptVersions(val.key);
};

// 获取某个提示词的全部历史版本
const fetchPromptVersions = async (key: string) => {
  detailLoading.value = true;
  try {
    const res = await request.get('/api/v1/admin/prompts/versions', {
      params: { key },
    });
    if (res.data && res.data.success) {
      promptVersions.value = res.data.data || [];
    }
  } catch (err: any) {
    ElMessage.error(err.message || '获取提示词版本历史失败');
  } finally {
    detailLoading.value = false;
  }
};

// 切换激活版本 (回滚/灰度)
const handleRollback = (version: number) => {
  ElMessageBox.confirm(
    `确定要将模版「${selectedPromptKey.value}」的激活版本切换回 v${version} 吗？切换后将即时清空 Redis/KV 缓存，影响全系统运行时的调度判定。`,
    '切换激活提示词确认',
    {
      confirmButtonText: '切换并更新缓存',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'dark-message-box',
    }
  ).then(async () => {
    detailLoading.value = true;
    try {
      const res = await request.post('/api/v1/admin/prompts/active', {
        key: selectedPromptKey.value,
        version: version,
      });
      if (res.data && res.data.success) {
        ElMessage.success('提示词激活版本切换成功，运行时缓存已强制清空失效。');
        fetchPromptVersions(selectedPromptKey.value);
        fetchPromptKeys();
      }
    } catch (err: any) {
      ElMessage.error(err.message || '切换激活版本失败');
    } finally {
      detailLoading.value = false;
    }
  }).catch(() => {});
};

// ──────────────────────────────────────────────────
// 发布新版本 Prompt 控制流
// ──────────────────────────────────────────────────
const publishDialogVisible = ref(false);
const publishForm = ref({
  key: '',
  description: '',
  content: '',
});

const openPublishDialog = () => {
  // 获取当前激活的版本内容作为发布新版本的默认初始模板，提升管理员操作效率
  const activeVer = promptVersions.value.find((v) => v.isActive);
  publishForm.value = {
    key: selectedPromptKey.value,
    description: '',
    content: activeVer ? activeVer.content : '',
  };
  publishDialogVisible.value = true;
};

const submitPublish = async () => {
  if (!publishForm.value.description.trim()) {
    ElMessage.warning('请输入发布版本说明');
    return;
  }
  if (!publishForm.value.content.trim()) {
    ElMessage.warning('请输入提示词模板内容');
    return;
  }

  submitLoading.value = true;
  try {
    const res = await request.post('/api/v1/admin/prompts/create', {
      key: publishForm.value.key,
      description: publishForm.value.description.trim(),
      content: publishForm.value.content,
    });
    if (res.data && res.data.success) {
      ElMessage.success(`新版本 v${res.data.version} 发布成功，且已自动激活上线。`);
      publishDialogVisible.value = false;
      fetchPromptVersions(selectedPromptKey.value);
      fetchPromptKeys();
    }
  } catch (err: any) {
    ElMessage.error(err.message || '发布新版本提示词失败');
  } finally {
    submitLoading.value = false;
  }
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
    .then(() => {
      ElMessage.success('提示词已复制到剪贴板');
    })
    .catch(() => {
      ElMessage.error('复制失败，请手动选择复制');
    });
};

onMounted(() => {
  fetchPromptKeys();
});
</script>

<style scoped>
.prompts-container {
  padding: 0;
}

.glass-card {
  background: #0f111a !important;
  border: 1px solid rgba(255, 255, 255, 0.04) !important;
  border-radius: 16px !important;
  box-shadow: none !important;
}

.left-list-card {
  height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
}

.left-list-card :deep(.el-card__body) {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.card-title {
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
}

.text-gradient {
  background: linear-gradient(90deg, #ff6b6b 0%, #a29bfe 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.search-input {
  width: 180px;
}

.header-left-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.prompt-desc {
  font-size: 12px;
  color: #a3b1cc;
}

.empty-state-wrapper {
  height: calc(100vh - 120px);
}

.empty-card {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.right-detail-card {
  height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
}

.right-detail-card :deep(.el-card__body) {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.versions-timeline {
  padding-top: 10px;
}

.version-item-card {
  background-color: rgba(255, 255, 255, 0.01) !important;
  border: 1px solid rgba(255, 255, 255, 0.03) !important;
  border-radius: 12px !important;
  margin-bottom: 8px;
}

.version-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.version-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.version-number {
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
}

.version-time {
  font-size: 12px;
  color: #4a5568;
  font-family: monospace;
}

.version-desc {
  font-size: 13px;
  color: #a3b1cc;
  margin-bottom: 16px;
  background-color: rgba(255, 255, 255, 0.02);
  padding: 8px 12px;
  border-radius: 6px;
  border-left: 3px solid #7209b7;
}

.prompt-preview-box {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  overflow: hidden;
}

.preview-header {
  background-color: rgba(255, 255, 255, 0.03);
  padding: 8px 16px;
  font-size: 12px;
  color: #a3b1cc;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.code-pre {
  margin: 0;
  padding: 16px;
  background-color: #08090d;
  color: #ffb86c; /* 代码高亮橙色 */
  font-family: 'Fira Code', 'Courier New', Courier, monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 250px;
  overflow-y: auto;
}

.action-btn-primary {
  background: linear-gradient(90deg, #ff6b6b 0%, #7209b7 100%);
  border: none;
  font-weight: 600;
  border-radius: 8px;
}

.action-btn-primary:hover {
  background: linear-gradient(90deg, #ff8585 0%, #8522c7 100%);
}

.textarea-editor :deep(.el-textarea__inner) {
  background-color: #08090d !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: #a29bfe !important;
  font-family: 'Fira Code', 'Courier New', Courier, monospace;
  font-size: 13px;
  border-radius: 10px;
  padding: 16px;
}

.textarea-editor :deep(.el-textarea__inner:focus) {
  border-color: #ff6b6b !important;
}
</style>
