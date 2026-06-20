<!-- File: /Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/layout/index.vue -->
<template>
  <el-container class="app-layout">
    <!-- 侧边菜单栏 (支持折叠) -->
    <el-aside :width="isCollapse ? '64px' : '240px'" class="sider-wrapper">
      <div class="sider-logo">
        <el-icon class="logo-icon"><Cpu /></el-icon>
        <span v-show="!isCollapse" class="logo-text">Swarm Admin</span>
      </div>

      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse"
        background-color="transparent"
        text-color="#a3b1cc"
        active-text-color="#ffffff"
        class="side-menu"
        router
      >
        <el-menu-item index="/dashboard">
          <el-icon><Odometer /></el-icon>
          <template #title>管理控制台</template>
        </el-menu-item>

        <el-menu-item index="/users">
          <el-icon><User /></el-icon>
          <template #title>用户管理</template>
        </el-menu-item>

        <el-menu-item index="/tasks">
          <el-icon><List /></el-icon>
          <template #title>任务监控</template>
        </el-menu-item>

        <el-menu-item index="/agents">
          <el-icon><Cpu /></el-icon>
          <template #title>智能体管理</template>
        </el-menu-item>

        <el-menu-item index="/tools">
          <el-icon><Tools /></el-icon>
          <template #title>工具库配置</template>
        </el-menu-item>

        <el-menu-item index="/knowledge">
          <el-icon><Notebook /></el-icon>
          <template #title>知识库管理</template>
        </el-menu-item>

        <el-menu-item index="/quiz">
          <el-icon><Checked /></el-icon>
          <template #title>评测测试管理</template>
        </el-menu-item>

        <el-menu-item index="/prompts">
          <el-icon><Brush /></el-icon>
          <template #title>提示词管理</template>
        </el-menu-item>

        <el-menu-item index="/audit-logs">
          <el-icon><Document /></el-icon>
          <template #title>审计与监控</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container class="main-container">
      <!-- 头部 Header 导航 -->
      <el-header height="64px" class="header-wrapper">
        <div class="header-left">
          <div class="toggle-collapse" @click="toggleMenuCollapse">
            <el-icon :size="20">
              <Fold v-if="!isCollapse" />
              <Expand v-else />
            </el-icon>
          </div>
          <!-- 面包屑导航 -->
          <el-breadcrumb separator="/" class="breadcrumb">
            <el-breadcrumb-item>集群主控</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentRouteTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="header-right">
          <!-- TraceID 安全观测状态条 (可观测性红线) -->
          <div class="trace-observability-bar" v-if="lastRequestTraceId">
            <span class="pulse-dot"></span>
            <span class="trace-txt">观测 TraceID: {{ lastRequestTraceId }}</span>
          </div>

          <!-- 用户个人中心下拉菜单 -->
          <el-dropdown trigger="click" @command="handleUserCommand">
            <div class="user-profile">
              <el-avatar
                :size="32"
                :src="adminUser.avatarUrl || '/static/default_avatar.png'"
                class="user-avatar"
              />
              <span class="user-name">{{ adminUser.nickname || '管理员' }}</span>
              <el-icon class="dropdown-arrow"><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu class="user-dropdown-menu">
                <el-dropdown-item command="profile" disabled>
                  <el-icon><User /></el-icon>个人详情
                </el-dropdown-item>
                <el-dropdown-item command="logout" divided>
                  <el-icon><SwitchButton /></el-icon>安全注销
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 主要内容展示区域 -->
      <el-main class="content-wrapper">
        <router-view v-slot="{ Component }">
          <transition name="fade-transform" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessageBox, ElMessage } from 'element-plus';
import {
  Cpu,
  Odometer,
  User,
  List,
  Tools,
  Document,
  Fold,
  Expand,
  ArrowDown,
  SwitchButton,
  Notebook,
  Checked,
  Brush,
} from '@element-plus/icons-vue';
import request from '@/utils/request';

const route = useRoute();
const router = useRouter();

const isCollapse = ref(false);
const adminUser = ref<{ nickname?: string; avatarUrl?: string | null }>({});
const lastRequestTraceId = ref('');

// 动态追踪激活路由项
const activeMenu = computed(() => route.path);
const currentRouteTitle = computed(() => (route.meta.title as string) || '控制台');

onMounted(() => {
  const rawUser = localStorage.getItem('admin_user');
  if (rawUser) {
    try {
      adminUser.value = JSON.parse(rawUser);
    } catch {
      adminUser.value = {};
    }
  }

  // 监听并实时截获 Axios 中的最新 TraceID 并在界面可观测状态栏渲染
  request.interceptors.request.use((config) => {
    if (config.headers && config.headers['X-Trace-Id']) {
      lastRequestTraceId.value = config.headers['X-Trace-Id'] as string;
    }
    return config;
  });
});

const toggleMenuCollapse = () => {
  isCollapse.value = !isCollapse.value;
};

const handleUserCommand = (command: string) => {
  if (command === 'logout') {
    ElMessageBox.confirm(
      '确定要注销并安全退出当前集群管理后台吗？',
      '注销确认',
      {
        confirmButtonText: '确定退出',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'dark-message-box',
      }
    ).then(async () => {
      try {
        // 调用后端登出清理 session
        await request.post('/api/v1/auth/logout');
      } catch (e) {
        console.warn('API登出处理异常，本地强制清理：', e);
      } finally {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        ElMessage({
          type: 'success',
          message: '已成功安全退出当前登录状态。',
        });
        router.push('/login');
      }
    }).catch(() => {});
  }
};
</script>

<style scoped>
/* 主布局容器 */
.app-layout {
  width: 100vw;
  height: 100vh;
  background-color: var(--bg-root);
  color: #ffffff;
  overflow: hidden;
  font-family: 'Outfit', 'Inter', sans-serif;
}

/* 侧边菜单栏样式 */
.sider-wrapper {
  background-color: var(--bg-surface);
  border-right: 1px solid var(--el-border-color-light);
  display: flex;
  flex-direction: column;
  transition: width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.sider-logo {
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.logo-icon {
  font-size: 28px;
  color: #ff6b6b;
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: #ffffff;
}

.side-menu {
  border: none;
  flex: 1;
  padding-top: 16px;
}

.side-menu :deep(.el-menu-item) {
  height: 52px;
  line-height: 52px;
  margin: 4px 12px;
  border-radius: 10px;
  transition: all 0.2s ease;
}

.side-menu :deep(.el-menu-item:hover) {
  background-color: rgba(255, 255, 255, 0.03) !important;
  color: #ffffff !important;
}

.side-menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(90deg, rgba(255, 107, 107, 0.15) 0%, rgba(255, 160, 122, 0.06) 100%) !important;
  border: 1px solid var(--brand-border) !important;
  color: #ffffff !important;
  font-weight: 600;
}

/* 头部导航样式 */
.header-wrapper {
  background-color: var(--bg-surface);
  border-bottom: 1px solid var(--el-border-color-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  z-index: 20;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.toggle-collapse {
  cursor: pointer;
  color: #a3b1cc;
  display: flex;
  align-items: center;
  transition: color 0.2s ease;
}

.toggle-collapse:hover {
  color: #ffffff;
}

.breadcrumb :deep(.el-breadcrumb__inner) {
  color: #4a5568 !important;
  font-weight: 500;
}

.breadcrumb :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
  color: #ffffff !important;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 24px;
}

/* TraceID 安全观测状态条 */
.trace-observability-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: rgba(255, 107, 107, 0.05);
  border: 1px solid rgba(255, 107, 107, 0.1);
  padding: 6px 14px;
  border-radius: 20px;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  background-color: #ff6b6b;
  border-radius: 50%;
  box-shadow: 0 0 8px #ff6b6b;
  animation: pulseLight 1.5s infinite alternate;
}

@keyframes pulseLight {
  0% { transform: scale(0.9); opacity: 0.5; }
  100% { transform: scale(1.3); opacity: 1; }
}

.trace-txt {
  font-size: 11px;
  font-family: monospace;
  color: #ff8585;
}

/* 用户 Profile 下拉 */
.user-profile {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background-color 0.2s ease;
}

.user-profile:hover {
  background-color: rgba(255, 255, 255, 0.03);
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: #a3b1cc;
}

.dropdown-arrow {
  font-size: 12px;
  color: #4a5568;
}

/* 内容主体 */
.content-wrapper {
  background-color: var(--bg-content);
  padding: 24px;
  overflow-y: auto;
}

/* 路由转场动画 */
.fade-transform-enter-active,
.fade-transform-leave-active {
  transition: all 0.3s ease;
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateX(-15px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(15px);
}
</style>
