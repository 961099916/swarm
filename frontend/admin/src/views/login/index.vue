<!-- File: /Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/views/login/index.vue -->
<template>
  <div class="login-wrapper">
    <!-- 背景流光星尘效果 -->
    <div class="background-decorations">
      <div class="glow-orb orb-1"></div>
      <div class="glow-orb orb-2"></div>
    </div>

    <!-- 登录卡片 (Glassmorphism 玻璃微光质感) -->
    <div class="login-card">
      <div class="login-header">
        <div class="logo-box animate__animated animate__fadeInDown">
          <el-icon class="logo-icon" :size="38"><Cpu /></el-icon>
        </div>
        <h1 class="login-title">Swarm Cluster</h1>
        <p class="login-subtitle">集群超级管理控制后台</p>
      </div>

      <el-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="loginRules"
        label-position="top"
        class="login-form"
        @keyup.enter="handleLoginSubmit"
      >
        <el-form-item prop="username" label="管理员账户">
          <el-input
            v-model="loginForm.username"
            placeholder="请输入管理员用户名"
            prefix-icon="User"
            clearable
          />
        </el-form-item>

        <el-form-item prop="password" label="安全口令">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入管理员密码"
            prefix-icon="Lock"
            show-password
            clearable
          />
        </el-form-item>

        <el-form-item prop="superKey" label="超级安全密钥 (可选/双重验证)">
          <el-input
            v-model="loginForm.superKey"
            type="password"
            placeholder="无则留空，启用双重验证时必填"
            prefix-icon="Key"
            show-password
            clearable
          />
        </el-form-item>

        <el-form-item class="action-item">
          <el-button
            :loading="loading"
            type="primary"
            class="submit-btn"
            @click="handleLoginSubmit"
          >
            校验身份并初始化集群
          </el-button>
        </el-form-item>
      </el-form>

      <div class="login-footer">
        <span>© 2026 Swarm Core, Inc. All rights reserved.</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Cpu } from '@element-plus/icons-vue';
import request from '@/utils/request';

const router = useRouter();
const loginFormRef = ref();
const loading = ref(false);

const loginForm = reactive({
  username: '',
  password: '',
  superKey: '',
});

const loginRules = {
  username: [{ required: true, message: '请输入管理员账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入安全口令', trigger: 'blur' }],
};

const handleLoginSubmit = () => {
  loginFormRef.value.validate(async (valid: boolean) => {
    if (!valid) return;
    
    loading.value = true;
    try {
      const response = await request.post('/api/v1/auth/admin/login', {
        username: loginForm.username,
        password: loginForm.password,
        superKey: loginForm.superKey || undefined,
      });

      if (response.data && response.data.success) {
        const { token, user } = response.data.data;
        
        localStorage.setItem('admin_token', token);
        localStorage.setItem('admin_user', JSON.stringify(user));
        
        ElMessage({
          message: `身份校验成功！欢迎回来，${user.nickname || '超级管理员'}`,
          type: 'success',
          duration: 2000,
        });

        // 延迟跳转，提供顺滑体验
        setTimeout(() => {
          router.push('/dashboard');
        }, 800);
      } else {
        throw new Error(response.data?.error || '身份校验失败，请检查账号密码');
      }
    } catch (error: any) {
      console.error('[Login] 登录请求异常:', error);
      ElMessage({
        message: error.message || '系统繁忙，身份校验未通过',
        type: 'error',
        duration: 3000,
      });
    } finally {
      loading.value = false;
    }
  });
};
</script>

<style scoped>
/* 登录主容器 */
.login-wrapper {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #0d0f12;
  overflow: hidden;
  font-family: 'Outfit', 'Inter', sans-serif;
}

/* 流光背景特效 */
.background-decorations {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.glow-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.18;
  mix-blend-mode: screen;
  pointer-events: none;
}

.orb-1 {
  top: -10%;
  left: 15%;
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, #ff6b6b 0%, rgba(255,107,107,0) 70%);
  animation: orbFloat 25s ease-in-out infinite alternate;
}

.orb-2 {
  bottom: -15%;
  right: 10%;
  width: 700px;
  height: 700px;
  background: radial-gradient(circle, #ffa07a 0%, rgba(255,160,122,0) 70%);
  animation: orbFloat 30s ease-in-out infinite alternate-reverse;
}

@keyframes orbFloat {
  0% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(80px, 40px) scale(1.1);
  }
  100% {
    transform: translate(-40px, -60px) scale(0.9);
  }
}

/* Glassmorphism 卡片设计 */
.login-card {
  position: relative;
  z-index: 10;
  width: 440px;
  padding: 48px;
  background: rgba(37, 33, 30, 0.65);
  border: 1px solid rgba(255, 248, 240, 0.08);
  border-radius: 24px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.login-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 107, 107, 0.05);
}

/* 头部样式 */
.login-header {
  text-align: center;
  margin-bottom: 36px;
}

.logo-box {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 76px;
  height: 76px;
  background: linear-gradient(135deg, #ff6b6b 0%, #ffa07a 100%);
  border-radius: 20px;
  margin-bottom: 20px;
  box-shadow: 0 8px 24px rgba(255, 107, 107, 0.3);
}

.logo-icon {
  color: #ffffff;
  animation: pulse 3s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.06); }
  100% { transform: scale(1); }
}

.login-title {
  color: #ffffff;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
  margin: 0 0 6px 0;
}

.login-subtitle {
  color: #8c9ba5;
  font-size: 14px;
  margin: 0;
}

/* 表单定制 */
.login-form :deep(.el-form-item__label) {
  color: #a3b1cc;
  font-weight: 600;
  font-size: 13px;
  padding-bottom: 4px;
}

.login-form :deep(.el-input__wrapper) {
  background-color: rgba(13, 15, 18, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: none !important;
  border-radius: 12px;
  padding: 8px 16px;
  transition: border-color 0.25s ease;
}

.login-form :deep(.el-input__wrapper:hover) {
  border-color: rgba(255, 107, 107, 0.4);
}

.login-form :deep(.el-input__wrapper.is-focus) {
  border-color: #ff6b6b;
}

.login-form :deep(.el-input__inner) {
  color: #ffffff;
  font-size: 14px;
}

.login-form :deep(.el-input__inner::placeholder) {
  color: #4a5568;
}

.login-form :deep(.el-input__icon) {
  color: #4a5568;
}

.action-item {
  margin-top: 36px;
}

/* 按钮渐变与微动效 */
.submit-btn {
  width: 100%;
  height: 48px;
  background: linear-gradient(90deg, #ff6b6b 0%, #ffa07a 100%);
  border: none;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
  box-shadow: 0 6px 20px rgba(255, 107, 107, 0.2);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.submit-btn:hover {
  background: linear-gradient(90deg, #ff8585 0%, #ffb08f 100%);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(255, 107, 107, 0.35);
}

.submit-btn:active {
  transform: translateY(1px);
}

.login-footer {
  text-align: center;
  margin-top: 28px;
  color: #4a5568;
  font-size: 12px;
}
</style>
