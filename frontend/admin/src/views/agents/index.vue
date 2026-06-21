<!-- File: /Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/views/agents/index.vue -->
<template>
  <div class="agents-container">
    <!-- 顶部过滤与新建 -->
    <el-card class="filter-card glass-card">
      <div class="filter-row">
        <div class="filter-left">
          <el-input
            v-model="searchQuery"
            placeholder="搜索智能体名称 / 角色描述"
            prefix-icon="Search"
            clearable
            class="search-input"
            @clear="fetchAgents"
            @keyup.enter="fetchAgents"
          />
        </div>
        <el-button type="primary" class="create-btn" @click="openCreateDialog">
          + 新建智能体
        </el-button>
      </div>
    </el-card>

    <!-- 智能体网格 -->
    <div class="agents-grid" v-loading="loading">
      <div v-for="agent in filteredAgents" :key="agent.id" class="agent-card">
        <div class="agent-badge" :class="agent.isPreset === 1 ? 'preset-tag' : 'custom-tag'">
          {{ agent.isPreset === 1 ? '系统预置' : '用户自定义' }}
        </div>
        <div class="agent-body">
          <div class="agent-avatar">
            <el-icon :size="28" class="avatar-icon"><Cpu /></el-icon>
          </div>
          <div class="agent-info">
            <h3 class="agent-name">{{ agent.name }}</h3>
            <span class="agent-role">{{ agent.role || '未配置角色' }}</span>
          </div>
        </div>
        
        <div class="agent-details">
          <div class="detail-item">
            <span class="lbl">调度模型:</span>
            <span class="val num-font">{{ agent.model }}</span>
          </div>
          <div class="detail-item">
            <span class="lbl">挂载工具:</span>
            <div class="tool-tags-wrap">
              <el-tag v-for="tool in parseTools(agent.tools)" :key="tool" size="small" type="info" class="tool-tag">
                {{ tool }}
              </el-tag>
              <span v-if="!parseTools(agent.tools).length" class="text-muted">无</span>
            </div>
          </div>
        </div>

        <div class="agent-prompt-preview">
          <span class="lbl">系统提示词 (System Prompt):</span>
          <p class="prompt-text">{{ agent.systemPrompt }}</p>
        </div>

        <div class="agent-actions">
          <el-button size="small" @click="openEditDialog(agent)">配置编辑</el-button>
          <el-button size="small" type="danger" :disabled="agent.isPreset === 1" @click="handleDeleteAgent(agent.id)">
            卸载
          </el-button>
        </div>
      </div>
    </div>

    <!-- 弹窗：新建 / 编辑智能体 Dialog -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" class="dark-dialog">
      <el-form ref="agentFormRef" :model="agentForm" :rules="agentRules" label-position="top">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item prop="name" label="智能体名称">
              <el-input v-model="agentForm.name" placeholder="请输入智能体名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item prop="role" label="职能设定 (Role)">
              <el-input v-model="agentForm.role" placeholder="如: 提供实时数据清洗分析" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item prop="model" label="决策引擎模型">
              <el-select v-model="agentForm.model" class="w-full">
                <el-option label="Llama 3.1 8B (默认)" value="@cf/meta/llama-3.1-8b-instruct-fp8" />
                <el-option label="Llama 3.2 3B" value="@cf/meta/llama-3.2-3b-instruct" />
                <el-option label="Qwen 2.5 7B" value="@cf/qwen/qwen2.5-7b-instruct" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="挂载工具集 (JSON Array)">
              <el-select v-model="agentForm.toolsList" multiple collapse-tags placeholder="选择要绑定的工具" class="w-full">
                <el-option v-for="t in availableTools" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item prop="systemPrompt" label="系统设定 (System Prompt)">
          <el-input
            v-model="agentForm.systemPrompt"
            type="textarea"
            :rows="6"
            placeholder="请详细描述该智能体在协同链条中的决策逻辑和行为指南。"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitAgentForm" :loading="submitLoading">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Cpu } from '@element-plus/icons-vue';
import request from '@/utils/request';

const loading = ref(false);
const submitLoading = ref(false);
const searchQuery = ref('');
const agents = ref<any[]>([]);
const availableTools = ref<string[]>(['weather_query', 'web_fetch', 'search_web', 'email_notify', 'llm_refinement', 'llm_chat']);

const dialogVisible = ref(false);
const isEdit = ref(false);
const dialogTitle = computed(() => isEdit.value ? '编辑智能体配置' : '新建智能体定义');

const agentFormRef = ref();
const agentForm = ref({
  id: '',
  name: '',
  role: '',
  model: '@cf/meta/llama-3.1-8b-instruct-fp8',
  toolsList: [] as string[],
  systemPrompt: '',
});

const agentRules = {
  name: [{ required: true, message: '名称不能为空', trigger: 'blur' }],
  role: [{ required: true, message: '角色职能设定不能为空', trigger: 'blur' }],
  systemPrompt: [{ required: true, message: '系统 Prompt 设定不能为空', trigger: 'blur' }],
};

const parseTools = (toolsStr: string | any) => {
  if (!toolsStr) return [];
  try {
    return typeof toolsStr === 'string' ? JSON.parse(toolsStr) : toolsStr;
  } catch {
    return [];
  }
};

const filteredAgents = computed(() => {
  if (!searchQuery.value) return agents.value;
  const q = searchQuery.value.toLowerCase();
  return agents.value.filter(a =>
    a.name.toLowerCase().includes(q) || (a.role && a.role.toLowerCase().includes(q))
  );
});

const fetchAgents = async () => {
  loading.value = true;
  try {
    const res = await request.get('/api/v1/admin/agents');
    if (res.data.success) {
      agents.value = res.data.data || [];
    }
  } catch (err: any) {
    ElMessage.error(err.message || '获取智能体列表失败');
  } finally {
    loading.value = false;
  }
};

const openCreateDialog = () => {
  isEdit.value = false;
  agentForm.value = {
    id: '',
    name: '',
    role: '',
    model: '@cf/meta/llama-3.1-8b-instruct-fp8',
    toolsList: [],
    systemPrompt: '',
  };
  dialogVisible.value = true;
};

const openEditDialog = (agent: any) => {
  isEdit.value = true;
  agentForm.value = {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    model: agent.model,
    toolsList: parseTools(agent.tools),
    systemPrompt: agent.systemPrompt,
  };
  dialogVisible.value = true;
};

const submitAgentForm = () => {
  agentFormRef.value.validate(async (valid: boolean) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      const payload = {
        id: agentForm.value.id || undefined,
        name: agentForm.value.name,
        role: agentForm.value.role,
        model: agentForm.value.model,
        tools: JSON.stringify(agentForm.value.toolsList),
        systemPrompt: agentForm.value.systemPrompt,
        avatar: 'cpu',
      };
      
      const res = await request.put('/api/v1/admin/agents/update', payload);
      if (res.data.success) {
        ElMessage.success('智能体配置保存成功');
        dialogVisible.value = false;
        fetchAgents();
      }
    } catch (err: any) {
      ElMessage.error(err.message || '保存失败');
    } finally {
      submitLoading.value = false;
    }
  });
};

const handleDeleteAgent = (agentId: string) => {
  ElMessageBox.confirm('确定要从系统中彻底删除（卸载）此自定义智能体吗？', '卸载确认', {
    confirmButtonText: '确定卸载',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    try {
      const res = await request.delete('/api/v1/admin/agents/delete', {
        data: { id: agentId },
      });
      if (res.data.success) {
        ElMessage.success('智能体卸载成功');
        fetchAgents();
      }
    } catch (e: any) {
      ElMessage.error(e.message || '卸载失败');
    }
  }).catch(() => {});
};

onMounted(() => {
  fetchAgents();
});
</script>

<style scoped>
.agents-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.glass-card {
  background: #0f111a !important;
  border: 1px solid rgba(255, 255, 255, 0.04) !important;
  border-radius: 16px !important;
  box-shadow: none !important;
}

.filter-card {
  padding: 8px 16px;
}

.filter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-input {
  width: 280px;
}

.create-btn {
  background: linear-gradient(90deg, #ff6b6b 0%, #7209b7 100%);
  border: none;
  font-weight: 600;
  border-radius: 8px;
}

.create-btn:hover {
  background: linear-gradient(90deg, #ff8585 0%, #8522c7 100%);
}

/* 智能体网格 */
.agents-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.agent-card {
  position: relative;
  background-color: #0f111a;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: transform 0.3s ease, border-color 0.3s ease;
}

.agent-card:hover {
  transform: translateY(-4px);
  border-color: rgba(255, 107, 107, 0.3);
}

.agent-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

.preset-tag {
  background-color: rgba(46, 196, 182, 0.1);
  color: #2ec4b6;
  border: 1px solid rgba(46, 196, 182, 0.2);
}

.custom-tag {
  background-color: rgba(255, 107, 107, 0.1);
  color: #ff6b6b;
  border: 1px solid rgba(255, 107, 107, 0.2);
}

.agent-body {
  display: flex;
  align-items: center;
  gap: 14px;
}

.agent-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 12px;
}

.avatar-icon {
  color: #ff6b6b;
}

.agent-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.agent-name {
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
}

.agent-role {
  font-size: 12px;
  color: #8c9ba5;
}

.agent-details {
  background-color: rgba(0, 0, 0, 0.2);
  padding: 12px 16px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.detail-item .lbl {
  color: #4a5568;
  font-weight: 600;
}

.detail-item .val {
  color: #a3b1cc;
}

.tool-tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
}

.tool-tag {
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: #a3b1cc;
}

.agent-prompt-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.agent-prompt-preview .lbl {
  font-size: 11px;
  color: #4a5568;
  font-weight: 600;
}

.prompt-text {
  font-size: 12px;
  color: #8c9ba5;
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-actions {
  display: flex;
  gap: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.03);
  padding-top: 16px;
}

.agent-actions .el-button {
  flex: 1;
}

.w-full {
  width: 100%;
}

.text-muted {
  color: #4a5568;
}
</style>
