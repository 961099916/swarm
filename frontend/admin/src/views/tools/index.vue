<!-- File: /Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/views/tools/index.vue -->
<template>
  <div class="tools-container">
    <!-- 顶部过滤 -->
    <el-card class="filter-card glass-card">
      <div class="filter-row">
        <div class="filter-left">
          <el-input
            v-model="searchQuery"
            placeholder="搜索工具名称 / 描述"
            prefix-icon="Search"
            clearable
            class="search-input"
            @clear="fetchTools"
            @keyup.enter="fetchTools"
          />
        </div>
        <el-button type="primary" class="create-btn" @click="openCreateDialog">
          + 新增系统工具
        </el-button>
      </div>
    </el-card>

    <!-- 工具列表表格 -->
    <el-card class="table-card glass-card">
      <el-table :data="filteredTools" v-loading="loading" style="width: 100%" class="dark-table">
        <el-table-column prop="name" label="工具 Key" width="160" />
        <el-table-column prop="description" label="功能描述" min-width="180" />
        <el-table-column prop="category" label="分类" width="120">
          <template #default="scope">
            <el-tag type="warning">{{ scope.row.category }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="enabled" label="运行状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.enabled === 1 ? 'success' : 'danger'" effect="dark">
              {{ scope.row.enabled === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="最后修改" width="180">
          <template #default="scope">
            <span class="num-font text-muted">{{ formatTime(scope.row.updatedAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="220" fixed="right">
          <template #default="scope">
            <div class="action-buttons">
              <el-button size="small" @click="openEditDialog(scope.row)">代码配置</el-button>
              <el-button size="small" type="danger" @click="handleDeleteTool(scope.row.name)">
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 弹窗：FaaS 代码与参数 Schema 配置 Dialog -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="800px" class="dark-dialog large-dialog">
      <el-form ref="toolFormRef" :model="toolForm" :rules="toolRules" label-position="top">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item prop="name" label="工具唯一标识 (name)">
              <el-input v-model="toolForm.name" :disabled="isEdit" placeholder="如: weather_query" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item prop="category" label="工具类别">
              <el-input v-model="toolForm.category" placeholder="如: general / search" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="启用状态">
              <el-select v-model="toolForm.enabled" class="w-full">
                <el-option label="启用" :value="1" />
                <el-option label="禁用" :value="0" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item prop="description" label="工具描述 (指示大模型在何时且如何调用)">
          <el-input v-model="toolForm.description" placeholder="此描述十分重要，LLM 将根据此文匹配调用场景" />
        </el-form-item>

        <el-form-item prop="paramsSchema" label="入参 JSON Schema 参数校验规范">
          <el-input
            v-model="toolForm.paramsSchema"
            type="textarea"
            :rows="4"
            class="code-textarea"
            placeholder="[{'name': 'city', 'type': 'string', 'required': true, 'description': '目标城市'}]"
          />
        </el-form-item>

        <!-- FaaS 动态 JS 代码运行器 -->
        <el-form-item label="动态 JS 执行脚本 (FaaS 纯函数模式)">
          <div class="editor-header">
            <span class="editor-title">async function run(input, context) {</span>
          </div>
          <el-input
            v-model="toolForm.script"
            type="textarea"
            :rows="12"
            class="code-textarea script-editor"
            placeholder="  // 编写您要动态执行的沙箱 JS 代码\n  const res = await fetch('https://api.example.com');\n  return await res.text();"
          />
          <div class="editor-footer">
            <span class="editor-title">}</span>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitToolForm" :loading="submitLoading">编译并保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/utils/request';

const loading = ref(false);
const submitLoading = ref(false);
const searchQuery = ref('');
const tools = ref<any[]>([]);

const dialogVisible = ref(false);
const isEdit = ref(false);
const dialogTitle = computed(() => isEdit.value ? '编辑系统工具 FaaS 配置' : '创建新系统工具');

const toolFormRef = ref();
const toolForm = ref({
  name: '',
  description: '',
  category: 'general',
  enabled: 1,
  paramsSchema: '[]',
  script: '',
});

const toolRules = {
  name: [{ required: true, message: '标识 Key 不能为空', trigger: 'blur' }],
  description: [{ required: true, message: '工具匹配描述不能为空', trigger: 'blur' }],
  paramsSchema: [{ required: true, message: '参数 Schema 规则不能为空', trigger: 'blur' }],
};

const filteredTools = computed(() => {
  if (!searchQuery.value) return tools.value;
  const q = searchQuery.value.toLowerCase();
  return tools.value.filter(t =>
    t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
  );
});

const formatTime = (timeStr: string) => {
  if (!timeStr) return '-';
  const d = new Date(timeStr);
  return d.toLocaleString('zh-CN', { hour12: false });
};

const fetchTools = async () => {
  loading.value = true;
  try {
    const res = await request.get('/api/v1/admin/tools');
    if (res.data.success) {
      tools.value = res.data.data || [];
    }
  } catch (err: any) {
    ElMessage.error(err.message || '获取工具列表失败');
  } finally {
    loading.value = false;
  }
};

const openCreateDialog = () => {
  isEdit.value = false;
  toolForm.value = {
    name: '',
    description: '',
    category: 'general',
    enabled: 1,
    paramsSchema: '[]',
    script: 'async function run(input, context) {\n  // 写入代码...\n  return "SUCCESS";\n}',
  };
  dialogVisible.value = true;
};

const openEditDialog = (tool: any) => {
  isEdit.value = true;
  toolForm.value = {
    name: tool.name,
    description: tool.description,
    category: tool.category,
    enabled: tool.enabled,
    paramsSchema: tool.paramsSchema,
    script: tool.script || '',
  };
  dialogVisible.value = true;
};

const submitToolForm = () => {
  toolFormRef.value.validate(async (valid: boolean) => {
    if (!valid) return;
    
    // 简易格式校验：验证 paramsSchema 是否为合法的 JSON String
    try {
      JSON.parse(toolForm.value.paramsSchema);
    } catch {
      ElMessage.error('入参 JSON Schema 不是合法的 JSON 字符串');
      return;
    }

    submitLoading.value = true;
    try {
      const url = isEdit.value ? '/api/v1/admin/tools/update' : '/api/v1/admin/tools/create';
      const res = await request.post(url, {
        name: toolForm.value.name,
        description: toolForm.value.description,
        category: toolForm.value.category,
        enabled: toolForm.value.enabled,
        paramsSchema: toolForm.value.paramsSchema,
        script: toolForm.value.script,
        method: 'GET',
        headers: '{}',
      });
      if (res.data.success) {
        ElMessage.success('工具发布保存成功');
        dialogVisible.value = false;
        fetchTools();
      }
    } catch (err: any) {
      ElMessage.error(err.message || '保存失败');
    } finally {
      submitLoading.value = false;
    }
  });
};

const handleDeleteTool = (name: string) => {
  ElMessageBox.confirm('确定要从系统中彻底删除此工具定义吗？这将导致绑定了该工具的智能体任务在调用时抛出 runtime 错误！', '强行删除', {
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    type: 'error',
  }).then(async () => {
    try {
      const res = await request.delete('/api/v1/admin/tools/delete', {
        data: { name },
      });
      if (res.data.success) {
        ElMessage.success('工具卸载完成');
        fetchTools();
      }
    } catch (e: any) {
      ElMessage.error(e.message || '删除失败');
    }
  }).catch(() => {});
};

onMounted(() => {
  fetchTools();
});
</script>

<style scoped>
.tools-container {
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

.action-buttons {
  display: flex;
  gap: 8px;
}

/* 伪终端编辑器样式 */
.editor-header, .editor-footer {
  background-color: #0b0c0f;
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 8px 16px;
  color: #ff6b6b;
  font-family: monospace;
  font-size: 13px;
}

.editor-header {
  border-bottom: none;
  border-radius: 8px 8px 0 0;
}

.editor-footer {
  border-top: none;
  border-radius: 0 0 8px 8px;
}

.code-textarea :deep(.el-textarea__inner) {
  background-color: #0d0f12 !important;
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
  color: #a3b1cc !important;
  font-family: monospace !important;
  font-size: 13px !important;
  border-radius: 8px;
  box-shadow: none !important;
}

.script-editor :deep(.el-textarea__inner) {
  border-radius: 0 !important;
  border-top: none !important;
  border-bottom: none !important;
  color: #2ec4b6 !important;
}

.w-full {
  width: 100%;
}

.text-muted {
  color: #4a5568;
}
</style>
