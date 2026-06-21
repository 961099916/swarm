<!-- File: /Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/views/users/index.vue -->
<template>
  <div class="users-container">
    <!-- 顶部过滤与搜索面板 -->
    <el-card class="filter-card glass-card">
      <div class="filter-row">
        <div class="filter-left">
          <el-input
            v-model="searchQuery"
            placeholder="搜索昵称 / OpenID"
            prefix-icon="Search"
            clearable
            class="search-input"
            @clear="fetchUsers"
            @keyup.enter="fetchUsers"
          />
          <el-select v-model="roleFilter" placeholder="过滤角色" clearable class="filter-select" @change="fetchUsers">
            <el-option label="普通用户" value="FREE_USER" />
            <el-option label="企业VIP" value="VIP" />
            <el-option label="管理员" value="ADMIN" />
          </el-select>
          <el-select v-model="statusFilter" placeholder="过滤状态" clearable class="filter-select" @change="fetchUsers">
            <el-option label="正常" value="0" />
            <el-option label="封禁" value="1" />
          </el-select>
        </div>
        <el-button type="primary" class="search-btn" @click="fetchUsers">查询</el-button>
      </div>
    </el-card>

    <!-- 用户列表表格 -->
    <el-card class="table-card glass-card">
      <el-table :data="users" v-loading="loading" style="width: 100%" class="dark-table">
        <el-table-column prop="id" label="用户 ID" width="220" show-overflow-tooltip />
        <el-table-column prop="nickname" label="昵称" min-width="120">
          <template #default="scope">
            <div class="user-avatar-cell">
              <el-avatar :size="24" :src="scope.row.avatarUrl || '/static/default_avatar.png'" />
              <span>{{ scope.row.nickname || '未同步微信' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="role" label="角色" width="120">
          <template #default="scope">
            <el-tag :type="getRoleTagType(scope.row.role)">
              {{ scope.row.role === 'ADMIN' ? '管理员' : scope.row.role === 'VIP' ? '高级VIP' : '免费用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="credits" label="积分余额" width="120">
          <template #default="scope">
            <span class="num-font text-warning">{{ scope.row.credits }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="isBanned" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.isBanned === 1 ? 'danger' : 'success'" effect="dark">
              {{ scope.row.isBanned === 1 ? '已封禁' : '活跃' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="注册时间" width="180">
          <template #default="scope">
            <span class="num-font text-muted">{{ formatTime(scope.row.createdAt) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="340" fixed="right">
          <template #default="scope">
            <div class="action-buttons">
              <el-button size="small" @click="openCreditsDialog(scope.row)">调额</el-button>
              <el-button size="small" @click="openRoleDialog(scope.row)">授权</el-button>
              <el-button size="small" type="warning" @click="handleKickUser(scope.row.id)">强制下线</el-button>
              <el-button
                size="small"
                :type="scope.row.isBanned === 1 ? 'success' : 'danger'"
                @click="handleToggleBan(scope.row)"
              >
                {{ scope.row.isBanned === 1 ? '解封' : '封禁' }}
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
          @current-change="fetchUsers"
        />
      </div>
    </el-card>

    <!-- 弹窗 1：积分调整 Dialog -->
    <el-dialog v-model="creditsDialogVisible" title="调整用户积分额度" width="400px" class="dark-dialog">
      <el-form :model="creditsForm" label-position="top">
        <el-form-item label="调整额度 (输入正数增加，负数扣减)">
          <el-input-number v-model="creditsForm.delta" :min="-10000" :max="10000" class="w-full" />
        </el-form-item>
        <el-form-item label="调整事由">
          <el-input v-model="creditsForm.reason" placeholder="如: 活动增发 / 违规扣减" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="creditsDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitCreditsChange" :loading="submitLoading">提交</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 弹窗 2：角色授权 Dialog -->
    <el-dialog v-model="roleDialogVisible" title="变更用户权限角色" width="400px" class="dark-dialog">
      <el-form :model="roleForm" label-position="top">
        <el-form-item label="目标角色">
          <el-select v-model="roleForm.role" class="w-full">
            <el-option label="免费用户" value="FREE_USER" />
            <el-option label="高级VIP" value="VIP" />
            <el-option label="集群超级管理员" value="ADMIN" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="roleDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitRoleChange" :loading="submitLoading">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/utils/request';

const loading = ref(false);
const submitLoading = ref(false);
const users = ref([]);
const page = ref(1);
const pageSize = ref(10);
const totalCount = ref(0);

const searchQuery = ref('');
const roleFilter = ref('');
const statusFilter = ref('');

// 积分 Dialog
const creditsDialogVisible = ref(false);
let selectedUser = reactive<any>({});
const creditsForm = reactive({
  delta: 0,
  reason: '',
});

// 角色 Dialog
const roleDialogVisible = ref(false);
const roleForm = reactive({
  role: 'FREE_USER',
});

const getRoleTagType = (role: string) => {
  if (role === 'ADMIN') return 'danger';
  if (role === 'VIP') return 'warning';
  return 'info';
};

const formatTime = (timeStr: string) => {
  if (!timeStr) return '-';
  const d = new Date(timeStr);
  return d.toLocaleString('zh-CN', { hour12: false });
};

const fetchUsers = async () => {
  loading.value = true;
  const offset = (page.value - 1) * pageSize.value;
  try {
    const response = await request.get(`/api/v1/admin/users`, {
      params: {
        search: searchQuery.value || undefined,
        role: roleFilter.value || undefined,
        status: statusFilter.value || undefined,
        limit: pageSize.value,
        offset,
      },
    });
    if (response.data && response.data.success) {
      users.value = response.data.data || [];
      // 模拟分页统计（因为后端 D1 返回无全局 COUNT）
      totalCount.value = users.value.length >= pageSize.value ? page.value * pageSize.value + 1 : page.value * pageSize.value;
    }
  } catch (error: any) {
    ElMessage.error(error.message || '拉取用户列表失败');
  } finally {
    loading.value = false;
  }
};

const openCreditsDialog = (row: any) => {
  Object.assign(selectedUser, row);
  creditsForm.delta = 0;
  creditsForm.reason = 'ADMIN_ADJUST';
  creditsDialogVisible.value = true;
};

const submitCreditsChange = async () => {
  submitLoading.value = true;
  try {
    const res = await request.put(`/api/v1/admin/users/${selectedUser.id}/credits`, {
      delta: creditsForm.delta,
      reason: creditsForm.reason || 'ADMIN_ADJUST',
    });
    if (res.data.success) {
      ElMessage.success('用户积分调整成功');
      creditsDialogVisible.value = false;
      fetchUsers();
    }
  } catch (err: any) {
    ElMessage.error(err.message || '调整失败');
  } finally {
    submitLoading.value = false;
  }
};

const openRoleDialog = (row: any) => {
  Object.assign(selectedUser, row);
  roleForm.role = row.role || 'FREE_USER';
  roleDialogVisible.value = true;
};

const submitRoleChange = async () => {
  submitLoading.value = true;
  try {
    const res = await request.put(`/api/v1/admin/users/${selectedUser.id}/role`, {
      role: roleForm.role,
    });
    if (res.data.success) {
      ElMessage.success('角色变更成功，鉴权缓存已刷新');
      roleDialogVisible.value = false;
      fetchUsers();
    }
  } catch (err: any) {
    ElMessage.error(err.message || '变更失败');
  } finally {
    submitLoading.value = false;
  }
};

const handleKickUser = (userId: string) => {
  ElMessageBox.confirm('确定要强制该用户下线并注销其所有 JWT 凭证吗？', '强制注销', {
    confirmButtonText: '确定下线',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    try {
      const res = await request.post(`/api/v1/admin/users/${userId}/invalidate`);
      if (res.data.success) {
        ElMessage.success('用户凭证已宣告失效，已强制下线');
        fetchUsers();
      }
    } catch (e: any) {
      ElMessage.error(e.message || '下线操作失败');
    }
  }).catch(() => {});
};

const handleToggleBan = (row: any) => {
  const targetStatus = row.isBanned === 1 ? 0 : 1;
  const word = targetStatus === 1 ? '封禁' : '解封';
  ElMessageBox.confirm(`确定要${word}该用户吗？${targetStatus === 1 ? '封禁后该用户将无权访问系统任何 API' : ''}`, `${word}确认`, {
    confirmButtonText: `确定${word}`,
    cancelButtonText: '取消',
    type: 'error',
  }).then(async () => {
    try {
      const res = await request.post(`/api/v1/admin/users/${row.id}/ban`, {
        isBanned: targetStatus,
      });
      if (res.data.success) {
        ElMessage.success(`用户已被成功${word}`);
        fetchUsers();
      }
    } catch (e: any) {
      ElMessage.error(e.message || '操作失败');
    }
  }).catch(() => {});
};

onMounted(() => {
  fetchUsers();
});
</script>

<style scoped>
.users-container {
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
  width: 240px;
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

/* 列表表格 */
.user-avatar-cell {
  display: flex;
  align-items: center;
  gap: 10px;
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

.w-full {
  width: 100%;
}

.text-warning {
  color: #ff9f1c;
  font-weight: 600;
}

.text-muted {
  color: #4a5568;
}
</style>
