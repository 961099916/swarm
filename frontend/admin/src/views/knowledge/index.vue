<!-- File: /Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/views/knowledge/index.vue -->
<template>
  <div class="knowledge-container">
    <!-- 顶部过滤与搜索面板 -->
    <el-card class="filter-card glass-card">
      <div class="filter-row">
        <div class="filter-left">
          <el-input
            v-model="searchQuery"
            placeholder="搜索文档名称"
            prefix-icon="Search"
            clearable
            class="search-input"
            @clear="fetchDocuments"
            @keyup.enter="fetchDocuments"
          />
        </div>
        <el-button type="primary" class="search-btn" @click="fetchDocuments">查询文档</el-button>
      </div>
    </el-card>

    <!-- 知识库文档列表 -->
    <el-card class="table-card glass-card">
      <el-table :data="documents" v-loading="loading" style="width: 100%" class="dark-table">
        <el-table-column prop="id" label="文档 ID" width="240" show-overflow-tooltip />
        <el-table-column prop="kbId" label="知识库 ID" width="220" show-overflow-tooltip />
        <el-table-column prop="filename" label="文档名称" min-width="180" show-overflow-tooltip>
          <template #default="scope">
            <div class="file-name-cell">
              <el-icon class="file-icon"><Document /></el-icon>
              <span>{{ scope.row.filename }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="fileSize" label="大小" width="120">
          <template #default="scope">
            <span class="num-font text-warning">{{ formatSize(scope.row.fileSize) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="scope">
            <span class="num-font text-muted">{{ formatTime(scope.row.createdAt) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="scope">
            <div class="action-buttons">
              <el-button
                size="small"
                type="danger"
                @click="handleDeleteDocument(scope.row)"
              >
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页栏 -->
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          layout="total, prev, pager, next"
          :total="totalCount"
          @current-change="fetchDocuments"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Document } from '@element-plus/icons-vue';
import request from '@/utils/request';

// 定义文档数据契约
interface DocumentItem {
  id: string;
  kbId: string;
  filename: string;
  fileSize: number;
  createdAt: string;
}

const loading = ref(false);
const documents = ref<DocumentItem[]>([]);
const page = ref(1);
const pageSize = ref(10);
const totalCount = ref(0);
const searchQuery = ref('');

const formatSize = (bytes: number) => {
  if (bytes === undefined || bytes === null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
};

const formatTime = (timeStr: string) => {
  if (!timeStr) return '-';
  const d = new Date(timeStr);
  return d.toLocaleString('zh-CN', { hour12: false });
};

const fetchDocuments = async () => {
  loading.value = true;
  const offset = (page.value - 1) * pageSize.value;
  try {
    const response = await request.get(`/api/v1/admin/knowledge/documents`, {
      params: {
        limit: pageSize.value,
        offset,
        search: searchQuery.value || undefined,
      },
    });
    if (response.data && response.data.success) {
      documents.value = response.data.data || [];
      // 模拟分页统计
      totalCount.value = documents.value.length >= pageSize.value 
        ? page.value * pageSize.value + 1 
        : (page.value - 1) * pageSize.value + documents.value.length;
    }
  } catch (error: any) {
    ElMessage.error(error.message || '拉取文档列表失败');
  } finally {
    loading.value = false;
  }
};

const handleDeleteDocument = (row: DocumentItem) => {
  ElMessageBox.confirm(
    `确定要物理下线并彻底删除文档「${row.filename}」吗？此操作将清空 D1 存储并物理擦除数据库相关记录，不可撤销。`,
    '高危物理删除确认',
    {
      confirmButtonText: '确定物理删除',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'dark-message-box',
    }
  ).then(async () => {
    loading.value = true;
    try {
      const res = await request.delete(`/api/v1/admin/knowledge/documents/delete`, {
        params: {
          docId: row.id,
        },
      });
      if (res.data && res.data.success) {
        ElMessage.success('文档已物理删除成功，关联存储已释放。');
        fetchDocuments();
      }
    } catch (err: any) {
      ElMessage.error(err.message || '物理删除文档失败');
    } finally {
      loading.value = false;
    }
  }).catch(() => {});
};

onMounted(() => {
  fetchDocuments();
});
</script>

<style scoped>
.knowledge-container {
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

.search-btn {
  background: linear-gradient(90deg, #ff6b6b 0%, #7209b7 100%);
  border: none;
  font-weight: 600;
  border-radius: 8px;
}

.search-btn:hover {
  background: linear-gradient(90deg, #ff8585 0%, #8522c7 100%);
}

.file-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-icon {
  color: #ff6b6b;
  font-size: 16px;
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

.text-warning {
  color: #ff9f1c;
  font-weight: 600;
}

.text-muted {
  color: #4a5568;
}

.num-font {
  font-family: monospace;
}
</style>
