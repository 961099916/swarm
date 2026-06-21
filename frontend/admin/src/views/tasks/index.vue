<!-- File: /Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/views/tasks/index.vue -->
<template>
  <div class="tasks-container">
    <!-- 顶部过滤 -->
    <el-card class="filter-card glass-card">
      <div class="filter-row">
        <div class="filter-left">
          <el-input
            v-model="searchQuery"
            placeholder="搜索任务 ID / 用户 ID"
            prefix-icon="Search"
            clearable
            class="search-input"
            @clear="fetchTasks"
            @keyup.enter="fetchTasks"
          />
          <el-select v-model="statusFilter" placeholder="任务状态" clearable class="filter-select" @change="fetchTasks">
            <el-option label="等待中" value="PENDING" />
            <el-option label="运行中" value="RUNNING" />
            <el-option label="执行成功" value="SUCCESS" />
            <el-option label="执行失败" value="FAILED" />
            <el-option label="已取消" value="CANCELLED" />
          </el-select>
        </div>
        <el-button type="primary" class="search-btn" @click="fetchTasks">搜索</el-button>
      </div>
    </el-card>

    <!-- 任务列表 -->
    <el-card class="table-card glass-card">
      <el-table :data="tasks" v-loading="loading" style="width: 100%" class="dark-table">
        <el-table-column prop="id" label="任务 ID" width="220" show-overflow-tooltip />
        <el-table-column prop="userId" label="关联用户 ID" width="220" show-overflow-tooltip />
        <el-table-column prop="taskType" label="类型" width="160">
          <template #default="scope">
            <el-tag type="info" effect="plain">{{ scope.row.taskType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="scope">
            <el-tag :type="getStatusTagType(scope.row.status)" effect="dark">
              {{ formatStatus(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="creditsCost" label="积分消耗" width="100">
          <template #default="scope">
            <span class="num-font text-warning">{{ scope.row.creditsCost }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="costUsd" label="审计费用" width="110">
          <template #default="scope">
            <span class="num-font text-success">${{ scope.row.costUsd ? scope.row.costUsd.toFixed(5) : '0.00000' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="scope">
            <span class="num-font text-muted">{{ formatTime(scope.row.createdAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <div class="action-buttons">
              <el-button size="small" @click="viewPayload(scope.row)">参数</el-button>
              <el-button
                v-if="scope.row.status === 'RUNNING' || scope.row.status === 'PENDING'"
                size="small"
                type="danger"
                @click="handleCancelTask(scope.row.id)"
              >
                中止
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          layout="total, prev, pager, next"
          :total="totalCount"
          @current-change="fetchTasks"
        />
      </div>
    </el-card>

    <!-- 弹窗：Payload 参数展示 -->
    <el-dialog v-model="payloadVisible" title="任务执行 Payload / 结果参数" width="550px" class="dark-dialog">
      <div class="code-box">
        <pre>{{ formattedPayload }}</pre>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/utils/request';

const loading = ref(false);
const tasks = ref([]);
const page = ref(1);
const pageSize = ref(10);
const totalCount = ref(0);

const searchQuery = ref('');
const statusFilter = ref('');

const payloadVisible = ref(false);
const activePayload = ref<any>(null);

const getStatusTagType = (status: string) => {
  switch (status) {
    case 'SUCCESS': return 'success';
    case 'RUNNING': return 'warning';
    case 'PENDING': return 'info';
    case 'FAILED': return 'danger';
    case 'CANCELLED': return 'danger';
    default: return 'info';
  }
};

const formatStatus = (status: string) => {
  switch (status) {
    case 'SUCCESS': return '执行成功';
    case 'RUNNING': return '运行中';
    case 'PENDING': return '等待中';
    case 'FAILED': return '执行失败';
    case 'CANCELLED': return '已取消';
    default: return status;
  }
};

const formatTime = (timeStr: string) => {
  if (!timeStr) return '-';
  const d = new Date(timeStr);
  return d.toLocaleString('zh-CN', { hour12: false });
};

const formattedPayload = computed(() => {
  if (!activePayload.value) return '';
  try {
    const raw = typeof activePayload.value === 'string' ? JSON.parse(activePayload.value) : activePayload.value;
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(activePayload.value);
  }
});

const fetchTasks = async () => {
  loading.value = true;
  const offset = (page.value - 1) * pageSize.value;
  try {
    const response = await request.get('/api/v1/admin/tasks', {
      params: {
        search: searchQuery.value || undefined,
        status: statusFilter.value || undefined,
        limit: pageSize.value,
        offset,
      },
    });
    if (response.data && response.data.success) {
      tasks.value = response.data.data || [];
      // 模拟总数统计
      totalCount.value = tasks.value.length >= pageSize.value ? page.value * pageSize.value + 1 : page.value * pageSize.value;
    }
  } catch (error: any) {
    ElMessage.error(error.message || '获取任务列表失败');
  } finally {
    loading.value = false;
  }
};

const viewPayload = (row: any) => {
  // 结合任务的 Payload 和 ResultSummary 一起展示
  activePayload.value = {
    taskPayload: row.payload ? JSON.parse(row.payload) : {},
    resultSummary: row.resultSummary || '无结果摘要',
    workflowRunId: row.workflowRunId,
  };
  payloadVisible.value = true;
};

const handleCancelTask = (taskId: string) => {
  ElMessageBox.confirm('确定要强制中断当前正在排队或执行的智能体任务吗？（这会触发后端补偿回滚并退还积分）', '中止确认', {
    confirmButtonText: '确定中止',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    try {
      const res = await request.put(`/api/v1/admin/tasks/${taskId}/cancel`);
      if (res.data.success) {
        ElMessage.success('任务中止指令成功下发');
        fetchTasks();
      }
    } catch (e: any) {
      ElMessage.error(e.message || '中止任务失败');
    }
  }).catch(() => {});
};

onMounted(() => {
  fetchTasks();
});
</script>

<style scoped>
.tasks-container {
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

.filter-left {
  display: flex;
  gap: 16px;
  flex: 1;
}

.search-input {
  width: 280px;
}

.filter-select {
  width: 140px;
}

.search-btn {
  background: linear-gradient(90deg, #ff6b6b 0%, #7209b7 100%);
  border: none;
  font-weight: 600;
  border-radius: 8px;
}

.search-btn:hover {
  background: linear-gradient(90deg, #ff8585 0%, #8522c7 100%);
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.code-box {
  background-color: #0d0f12;
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 16px;
  border-radius: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.code-box pre {
  margin: 0;
  font-family: monospace;
  font-size: 13px;
  color: #ff8585;
  white-space: pre-wrap;
}

.text-warning {
  color: #ff9f1c;
  font-weight: 600;
}

.text-success {
  color: #2ec4b6;
  font-weight: 600;
}

.text-muted {
  color: #4a5568;
}
</style>
